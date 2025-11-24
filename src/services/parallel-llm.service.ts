import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LLMOrchestratorService } from './llm-orchestrator.service';
import { CreditService } from './credit.service';
import { SubscriptionService } from './subscription.service';
import { selectFrameworksByPriority, SUBSCRIPTION_PLANS } from '../config/subscription.config';

interface Classification {
  hasCrisisIndicators: boolean;
  hasEmotionalContent: boolean;
  hasSelfWorthContent: boolean;
  hasDarkTriadIndicators: boolean;
  hasPersonalityIndicators: boolean;
  hasCognitiveIndicators: boolean;
  // New theory triggers (LLM router flags)
  hasAttachment?: boolean;
  hasEnneagram?: boolean;
  hasMBTI?: boolean;
  hasErikson?: boolean;
  hasGestalt?: boolean;
  hasBioPsych?: boolean;
  urgency: 'critical' | 'high' | 'medium' | 'low';
}

interface PsychologicalProfile {
  bigFive?: {
    openness?: string;
    conscientiousness?: string;
    extraversion?: string;
    agreeableness?: string;
    neuroticism?: string;
    insights: string[];
  };
  dass?: {
    depression?: string;
    anxiety?: string;
    stress?: string;
    concerns: string[];
    requiresCrisisResponse?: boolean;
  };
  rse?: {
    level?: string;
    indicators: string[];
  };
  darkTriad?: {
    machiavellianism?: string;
    narcissism?: string;
    psychopathy?: string;
    insights: string[];
  };
  crt?: {
    thinkingStyle?: string;
    systemPreference?: string;
    insights: string[];
  };
  // Per-message synthesis summary (latest turn)
  summaryForThisMessage?: {
    summary: string;
    key_signals: string[];
    conflicts?: string[];
    risks?: string[];
    strengths?: string[];
    focus_for_reply?: string[];
    evidence_refs?: string[];
    confidence?: number;
  };
  // Optional safety flag from Safety Gate
  safety?: {
    flag: 'none' | 'risk';
    category?: 'self_harm' | 'harm_others' | 'abuse' | 'medical' | string;
  };
}

@Injectable()
export class ParallelLLMService {
  private sessionCache = new Map<string, PsychologicalProfile>();
  private promptCache = new Map<string, string>();

  constructor(
    private configService: ConfigService,
    private llmOrchestrator: LLMOrchestratorService,
    private creditService: CreditService,
    private subscriptionService: SubscriptionService,
  ) {}

  // Load and cache KB system prompts (verbatim). If file contains a JSON object
  // with { role: 'system', content: [...] }, join the content array; otherwise use raw text.
  private getKBPrompt(fileName: string): string {
    // ALWAYS reload from disk (no cache) to get latest changes
    // Cache disabled during development
    try {
      const fs = require('fs');
      const path = require('path');
      const kbPath = path.join(process.cwd(), 'backend', 'KB', fileName);
      const raw = fs.readFileSync(kbPath, 'utf8');
      let prompt = raw;
      try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.role === 'system' && Array.isArray(parsed.content)) {
          prompt = parsed.content.join('\n');
        }
      } catch (_) {
        // Not JSON; use raw as-is
      }
      return prompt;
    } catch (e) {
      console.error('Failed to load KB prompt:', fileName, e?.message);
      return '';
    }
  }

  // Lightweight trigger detection for new theories
  private detectExtraTheoryTriggers(message: string): {
    hasAttachment: boolean;
    hasEnneagram: boolean;
    hasMBTI: boolean;
    hasErikson: boolean;
    hasGestalt: boolean;
    hasBioPsych: boolean;
  } {
    const lower = message.toLowerCase();
    const hasAttachment =
      /(please don\'t leave|leave me|abandon|need you|close|closeness|too close|space|independent|depend|trust|afraid of love|afraid of closeness)/i.test(
        lower,
      );
    const hasEnneagram =
      /(be right|be loved|be admired|unique|authentic|understand|protect energy|safe|support|freedom|happiness|control|independent|peace|harmony)/i.test(
        lower,
      );
    const hasMBTI =
      /(i am an introvert|i am an extrovert|i am introverted|i am extroverted|ambivert|mbti|personality type|my type is|sensing type|intuitive type|thinking type|feeling type|judging type|perceiving type)/i.test(
        lower,
      );
    const hasErikson =
      /(who am i|purpose|identity|belong|trust|love|lonely|useless|meaningful|legacy|stuck|regret|life review)/i.test(
        lower,
      );
    const hasGestalt =
      /(right now i feel|i notice|avoid|numb|joke|humor to avoid|go along|they make me feel|it\'s my fault|i shouldn\'t feel|i freeze|can\'t act)/i.test(
        lower,
      );
    const hasBioPsych =
      /(sleep|slept|insomnia|tired|exhausted|fatigue|burnout|headache|pain|sick|ill|fever|period|pms|hormones|caffeine|coffee|alcohol|drunk|hungover|hungry|skipped meal|dehydrated|exercise|sedentary|sitting|heat|cold|noise|messy|crowded|overload|multitask|lonely|isolated|financial|money|debt|job|moving|breakup)/i.test(
        lower,
      );

    return { hasAttachment, hasEnneagram, hasMBTI, hasErikson, hasGestalt, hasBioPsych };
  }

  // Basic JSON parse with fallback extraction and optional retry helper can be added later
  /**
   * Helper to extract token counts from LLM response usage object
   */
  private extractTokenUsage(usage: any): {
    total: number;
    input: number;
    output: number;
  } {
    if (!usage) {
      return { total: 0, input: 0, output: 0 };
    }

    // Handle different provider formats
    const inputTokens = usage.prompt_tokens || usage.input_tokens || usage.totalTokens || 0;
    const outputTokens = usage.completion_tokens || usage.output_tokens || 0;
    const totalTokens = usage.total_tokens || (inputTokens + outputTokens);

    return {
      total: totalTokens,
      input: inputTokens,
      output: outputTokens,
    };
  }

  /**
   * Wrapper for LLM calls that automatically tracks token usage
   */
  private async callLLMWithTokenTracking(
    userId: string | undefined,
    sessionId: string,
    selectedLLM: string,
    messages: any[],
    options: any,
    callType: string,
    frameworkName: string | null = null,
  ): Promise<{ response: any; tokens: number }> {
    const response = await this.llmOrchestrator.generateResponse(selectedLLM, messages, options);
    
    // Extract token counts
    const tokenUsage = this.extractTokenUsage(response.usage);
    
    // Track token usage if userId is provided
    if (userId && tokenUsage.total > 0) {
      try {
        await this.creditService.recordTokenUsage(
          userId,
          sessionId,
          tokenUsage.total,
          tokenUsage.input,
          tokenUsage.output,
          selectedLLM,
          callType,
          frameworkName,
        );
      } catch (error) {
        console.error(`❌ [TokenTracking] Failed to record tokens for ${callType}:`, error);
        // Don't throw - continue even if tracking fails
      }
    }
    
    return { response, tokens: tokenUsage.total };
  }

  private parseJsonSafe(text: string, fallback: any) {
    if (!text || typeof text !== 'string') return fallback;

    // Step 1: Strip markdown code blocks if present
    let cleaned = text.trim();
    const codeBlockRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?```/g;
    const codeBlockMatch = codeBlockRegex.exec(cleaned);
    if (codeBlockMatch) {
      cleaned = codeBlockMatch[1].trim();
    }

    // Step 2: Try direct parse
    try {
      return JSON.parse(cleaned);
    } catch (_) {
      // Step 3: Try to extract first complete JSON object (handle nested braces)
      const start = cleaned.indexOf('{');
      if (start === -1) return fallback;

      let braceCount = 0;
      let end = start;
      for (let i = start; i < cleaned.length; i++) {
        if (cleaned[i] === '{') braceCount++;
        if (cleaned[i] === '}') braceCount--;
        if (braceCount === 0) {
          end = i;
          break;
        }
      }

      if (end > start) {
        const slice = cleaned.substring(start, end + 1);
        try {
          return JSON.parse(slice);
        } catch (parseErr) {
          console.warn('[parseJsonSafe] Failed to parse extracted JSON:', slice.substring(0, 200));
          return fallback;
        }
      }

      return fallback;
    }
  }

  // Create compact JSON summary for latest message (no advice)
  private async buildPerMessageSummary(
    message: string,
    profile: PsychologicalProfile,
    history: any[],
    selectedLLM: string,
    sessionId: string,
    userId?: string,
  ): Promise<PsychologicalProfile['summaryForThisMessage'] | null> {
    const system = [
      'You create a compact JSON summary for the latest message.',
      'Do not give advice. Output JSON only.',
      '{',
      '  "summary": "1-2 sentences in plain English",',
      '  "key_signals": [""],',
      '  "conflicts": [""],',
      '  "risks": [""],',
      '  "strengths": [""],',
      '  "focus_for_reply": [""],',
      '  "evidence_refs": [""],',
      '  "confidence": 0.0',
      '}',
    ].join('\n');

    const contextObj = {
      safety: profile.safety || { flag: 'none' },
      bigFive: profile.bigFive || null,
      dass: profile.dass || null,
      rse: profile.rse || null,
      darkTriad: profile.darkTriad || null,
      crt: profile.crt || null,
      attachment: (profile as any).attachment || null,
      enneagram: (profile as any).enneagram || null,
      mbti: (profile as any).mbti || null,
      erikson: (profile as any).erikson || null,
      gestalt: (profile as any).gestalt || null,
      bioPsych: (profile as any).bioPsych || null,
      latest_message: message,
    };

    try {
      // Use token tracking for summary LLM call
      const { response: res } = await this.callLLMWithTokenTracking(
        userId,
        sessionId,
        selectedLLM,
        [
          { role: 'system', content: system },
          { role: 'user', content: JSON.stringify(contextObj) },
        ],
        { temperature: 0.1, max_tokens: 350 },
        'summary',
        null,
      );
      return this.parseJsonSafe(res.content, null);
    } catch (e) {
      console.error('Summary LLM error:', e);
      return null;
    }
  }

  /**
   * Main analysis method - Smart Incremental with Option 2 (Accumulate Over Time)
   * Now respects framework caps and priority (personality > emotional > crisis)
   */
  async analyze(
    message: string,
    history: any[],
    sessionId: string,
    selectedLLM: string = 'gpt-4o',
    userId?: string, // User ID for credit checking and framework caps
  ): Promise<PsychologicalProfile | null> {
    try {
      // SESSION ISOLATION: Ensure profile cache is properly isolated per session
      // Check if this looks like a fresh start (only current message or empty history)
      // This prevents old session data from leaking into new conversations
      const isFreshStart = history.length <= 1; // Only current message, no history
      if (isFreshStart) {
        const cached = this.sessionCache.get(sessionId);
        // If we have cached data but this is a fresh start, something is wrong - clear it
        if (cached && Object.keys(cached).length > 0) {
          console.log(
            `[SESSION ISOLATION] Clearing cached profile for session ${sessionId} - detected fresh start (history length: ${history.length})`,
          );
          this.sessionCache.delete(sessionId);
        }
      }

      // SAFETY GATE (first step): detect high-risk language
      const riskPatterns = {
        self_harm: /suicid|kill.*myself|end.*it.*all|want.*die|harm.*myself|cut.*myself/i,
        harm_others: /kill (him|her|them)|hurt (him|her|them)/i,
        abuse: /abuse(d)?|violence|assault/i,
        medical: /overdose|poison|unconscious|not breathing/i,
      };
      let safety: PsychologicalProfile['safety'] = { flag: 'none' };
      if (riskPatterns.self_harm.test(message)) safety = { flag: 'risk', category: 'self_harm' };
      else if (riskPatterns.harm_others.test(message))
        safety = { flag: 'risk', category: 'harm_others' };
      else if (riskPatterns.abuse.test(message)) safety = { flag: 'risk', category: 'abuse' };
      else if (riskPatterns.medical.test(message)) safety = { flag: 'risk', category: 'medical' };

      // Quick greeting check (ONLY skip pure greetings)
      const isPureGreeting = /^(hi|hello|hey)$/i.test(message.trim());

      if (history.length === 0 && isPureGreeting && safety.flag !== 'risk') {
        return null; // Skip analysis for pure greeting as first message
      }

      // SHORT-INPUT ROUTER: for very short inputs, run light set + keyword triggers
      const tokenApprox = message.trim().split(/\s+/).filter(Boolean).length;
      let classification: any;
      if (tokenApprox < 25) {
        // Run keyword triggers for short inputs
        const keywordTriggers = this.detectExtraTheoryTriggers(message);
        classification = {
          hasCrisisIndicators: safety.flag === 'risk',
          hasEmotionalContent: true, // light set includes DASS
          hasSelfWorthContent: true, // include RSE
          hasDarkTriadIndicators: false,
          hasPersonalityIndicators: false,
          hasCognitiveIndicators: true, // include CRT
          urgency: safety.flag === 'risk' ? 'critical' : 'low',
          // Add keyword-triggered flags for short inputs
          hasAttachment: keywordTriggers.hasAttachment,
          hasEnneagram: keywordTriggers.hasEnneagram,
          hasMBTI: keywordTriggers.hasMBTI,
          hasErikson: keywordTriggers.hasErikson,
          hasGestalt: keywordTriggers.hasGestalt,
          hasBioPsych: keywordTriggers.hasBioPsych,
        };
      } else {
        // For everything else: Classify (hybrid)
        classification = await this.classifyMessage(message, history, selectedLLM, sessionId, userId);
      }

      // Safety override: If local check found crisis, ensure it's flagged
      if (safety.flag === 'risk') {
        classification.hasCrisisIndicators = true;
        classification.urgency = 'critical';
      }

      // Check if any indicators found
      const hasAnyIndicators =
        classification.hasCrisisIndicators ||
        classification.hasEmotionalContent ||
        classification.hasSelfWorthContent ||
        classification.hasDarkTriadIndicators ||
        classification.hasPersonalityIndicators ||
        classification.hasCognitiveIndicators;

      if (!hasAnyIndicators) {
        // No indicators → Return cached profile (if any)
        return this.sessionCache.get(sessionId) || null;
      }

      // Get framework cap based on user subscription tier
      let frameworkCap = 8; // Default max (hard cap)
      if (userId) {
        const subscription = await this.subscriptionService.getOrCreateSubscription(userId);
        const plan = SUBSCRIPTION_PLANS[subscription.tier];
        frameworkCap = plan.frameworkCap;
        console.log(`🎯 [Framework] User ${userId} tier ${subscription.tier}: framework cap = ${frameworkCap}`);
      }

      // Build list of matched frameworks based on classification
      const matchedFrameworks: string[] = [];

      // Personality frameworks (highest priority)
      if (classification.hasPersonalityIndicators) {
        matchedFrameworks.push('bigFive');
      }
      if (classification.hasDarkTriadIndicators) {
        matchedFrameworks.push('darkTriad');
      }

      // Emotional frameworks (medium priority)
      if (classification.hasCrisisIndicators || classification.hasEmotionalContent) {
        matchedFrameworks.push('dass');
      }
      if (classification.hasSelfWorthContent || classification.hasCrisisIndicators) {
        matchedFrameworks.push('rse');
      }

      // Crisis/Cognitive frameworks (lower priority)
      if (classification.hasCognitiveIndicators) {
        matchedFrameworks.push('crt');
      }

      // Extra frameworks from keywords
      const extraFromKeywords = this.detectExtraTheoryTriggers(message);
      const extraCombined = {
        hasAttachment: !!(classification.hasAttachment || extraFromKeywords.hasAttachment),
        hasEnneagram: !!(classification.hasEnneagram || extraFromKeywords.hasEnneagram),
        hasMBTI: !!(classification.hasMBTI || extraFromKeywords.hasMBTI),
        hasErikson: !!(classification.hasErikson || extraFromKeywords.hasErikson),
        hasGestalt: !!(classification.hasGestalt || extraFromKeywords.hasGestalt),
        hasBioPsych: !!(classification.hasBioPsych || extraFromKeywords.hasBioPsych),
      };

      if (extraCombined.hasAttachment) matchedFrameworks.push('attachment');
      if (extraCombined.hasEnneagram) matchedFrameworks.push('enneagram');
      if (extraCombined.hasMBTI) matchedFrameworks.push('mbti');
      if (extraCombined.hasErikson) matchedFrameworks.push('erikson');
      if (extraCombined.hasGestalt) matchedFrameworks.push('gestalt');
      if (extraCombined.hasBioPsych) matchedFrameworks.push('bioPsych');

      // Apply priority and cap: personality > emotional > crisis
      // Also enforce maximum 8 LLM calls total per message
      const maxFrameworkCalls = Math.min(frameworkCap, 8); // Hard cap at 8
      const selectedFrameworks = selectFrameworksByPriority(
        matchedFrameworks,
        maxFrameworkCalls,
        classification.hasCrisisIndicators,
      );

      console.log(`🎯 [Framework] Matched: ${matchedFrameworks.length}, Selected: ${selectedFrameworks.length} (cap: ${maxFrameworkCalls}, hard max: 8)`);

      // Run selected analyses in parallel
      const analysisPromises: Promise<any>[] = [];
      const analysisTypes: string[] = [];

      // Map framework names to their LLM calls (now with token tracking)
      const frameworkCallMap: Record<string, () => Promise<any>> = {
        dass: () => this.callLLMWithDASSKB(message, history, selectedLLM, sessionId, userId),
        rse: () => this.callLLMWithRSEKB(message, history, selectedLLM, sessionId, userId),
        bigFive: () => this.callLLMWithBigFiveKB(message, history, selectedLLM, sessionId, userId),
        darkTriad: () => this.callLLMWithDarkTriadKB(message, history, selectedLLM, sessionId, userId),
        crt: () => this.callLLMWithCRTKB(message, history, selectedLLM, sessionId, userId),
        attachment: () => this.callLLMWithAttachmentKB(message, selectedLLM, sessionId, userId),
        enneagram: () => this.callLLMWithEnneagramKB(message, selectedLLM, sessionId, userId),
        mbti: () => this.callLLMWithMBTIKB(message, selectedLLM, sessionId, userId),
        erikson: () => this.callLLMWithEriksonKB(message, selectedLLM, sessionId, userId),
        gestalt: () => this.callLLMWithGestaltKB(message, selectedLLM, sessionId, userId),
        bioPsych: () => this.callLLMWithBioPsychKB(message, selectedLLM, sessionId, userId),
      };

      // Execute only selected frameworks
      for (const framework of selectedFrameworks) {
        const callFn = frameworkCallMap[framework];
        if (callFn) {
          analysisPromises.push(callFn());
          analysisTypes.push(framework);
        }
      }

      const results = await Promise.all(analysisPromises);

      // Build profile from results
      const newProfile: PsychologicalProfile = {};
      results.forEach((result, index) => {
        const type = analysisTypes[index];
        newProfile[type] = result;
      });
      // attach safety flag
      newProfile.safety = safety;

      // Merge with cached profile (for historical accumulation)
      const cachedProfile = this.sessionCache.get(sessionId) || {};
      const mergedProfile = { ...cachedProfile, ...newProfile };

      // Build per-message summary (LLM JSON-only)
      // CRITICAL: Pass only NEW profile (this turn's analysis) to summary, not merged historical profile
      // This ensures summary only reflects current message, not old session data
      try {
        const summary = await this.buildPerMessageSummary(
          message,
          newProfile,
          history.slice(-3),
          selectedLLM,
          sessionId,
          userId,
        );
        if (summary) {
          mergedProfile.summaryForThisMessage = summary;
          // Also attach to newProfile for clarity
          newProfile.summaryForThisMessage = summary;
        }
      } catch (e) {
        console.error('Per-message summary failed:', e);
      }

      // Cache the updated profile
      this.sessionCache.set(sessionId, mergedProfile);

      return mergedProfile;
    } catch (error) {
      console.error('Error in parallel LLM analysis:', error);
      return this.sessionCache.get(sessionId) || null;
    }
  }

  /**
   * HYBRID: Quick keyword pre-check before LLM classification (for speed/consistency)
   */
  private quickKeywordCheck(message: string): Partial<Classification> {
    const lower = message.toLowerCase();

    // Crisis keywords (highest priority)
    const crisisKeywords = [
      'suicide',
      'suicidal',
      'kill myself',
      'want to die',
      'end it all',
      'self harm',
      'hurt myself',
      'better off dead',
      'give up on everything',
      'worthless',
      'hopeless',
      'nothing matters',
    ];
    const hasCrisisIndicators = crisisKeywords.some((kw) => lower.includes(kw));

    // Personality trait keywords (Big Five related)
    const personalityKeywords = [
      'outgoing',
      'shy',
      'extroverted',
      'introverted',
      'organized',
      'messy',
      'disorganized',
      'creative',
      'conventional',
      'anxious',
      'calm',
      'nervous',
      'worried',
      'kind',
      'assertive',
      'agreeable',
      'competitive',
      'open-minded',
      'traditional',
    ];
    const hasPersonalityIndicators = personalityKeywords.some((kw) => lower.includes(kw));

    // Emotional keywords
    const emotionalKeywords = [
      'sad',
      'depressed',
      'anxious',
      'stressed',
      'overwhelmed',
      'scared',
      'angry',
      'frustrated',
      'hopeless',
      'lonely',
      'tired',
      'exhausted',
    ];
    const hasEmotionalContent = emotionalKeywords.some((kw) => lower.includes(kw));

    // Self-worth keywords
    const selfWorthKeywords = [
      'not good enough',
      'worthless',
      'failure',
      'useless',
      'pathetic',
      'hate myself',
      "don't deserve",
      "can't do anything",
    ];
    const hasSelfWorthContent = selfWorthKeywords.some((kw) => lower.includes(kw));

    // Dark Triad keywords (manipulative, narcissistic, callous)
    const darkTriadKeywords = [
      'manipulate',
      'control',
      'use people',
      'better than',
      'superior',
      "don't care about others",
      'fake it',
    ];
    const hasDarkTriadIndicators = darkTriadKeywords.some((kw) => lower.includes(kw));

    // Cognitive/thinking style keywords (System 1 vs System 2)
    const cognitiveKeywords = [
      'gut',
      'instinct',
      'intuition',
      'impulsive',
      'spontaneous',
      'overthink',
      'overanalyze',
      'act first',
      'think later',
      'rational',
      'logical',
      'analyze everything',
      'think too much',
    ];
    const hasCognitiveIndicators = cognitiveKeywords.some((kw) => lower.includes(kw));

    return {
      hasCrisisIndicators,
      hasPersonalityIndicators,
      hasEmotionalContent,
      hasSelfWorthContent,
      hasDarkTriadIndicators,
      hasCognitiveIndicators,
    };
  }

  /**
   * Classify message to determine what analysis is needed (TRUE HYBRID: Keywords first, then LLM)
   */
  private async classifyMessage(
    message: string,
    history: any[],
    selectedLLM: string,
    sessionId: string,
    userId?: string,
  ): Promise<Classification> {
    try {
      // HYBRID STEP 1: Quick keyword check first (instant, 100% consistent)
      const keywordResults = this.quickKeywordCheck(message);

      // OPTIMIZATION: If keywords found ALL indicators clearly, skip LLM entirely (100% consistent + faster + cheaper)
      const hasAnyKeywordMatch = Object.values(keywordResults).some((v) => v === true);

      if (hasAnyKeywordMatch) {
        // Keyword matched - use keyword results directly (100% consistent, no LLM call)
        console.log('[CLASSIFICATION] Keyword match found - skipping LLM (100% consistent)');
        return {
          hasCrisisIndicators: keywordResults.hasCrisisIndicators || false,
          hasEmotionalContent: keywordResults.hasEmotionalContent || false,
          hasSelfWorthContent: keywordResults.hasSelfWorthContent || false,
          hasDarkTriadIndicators: keywordResults.hasDarkTriadIndicators || false,
          hasPersonalityIndicators: keywordResults.hasPersonalityIndicators || false,
          hasCognitiveIndicators: keywordResults.hasCognitiveIndicators || false,
          urgency: keywordResults.hasCrisisIndicators
            ? 'critical'
            : keywordResults.hasSelfWorthContent
              ? 'high'
              : keywordResults.hasEmotionalContent
                ? 'medium'
                : 'low',
        };
      }

      // HYBRID STEP 2: No keywords found - use LLM for edge cases (80% consistent)
      console.log('[CLASSIFICATION] No keyword match - using LLM for semantic understanding');

      // Use token tracking for classification LLM call
      const { response } = await this.callLLMWithTokenTracking(
        userId,
        sessionId,
        selectedLLM,
        [
          {
            role: 'user',
            content: `You are a psychological message classifier. Analyze what kind of analysis this message needs.

**What to look for:**

1. **Crisis Indicators**: Statements about suicide, self-harm, giving up on life, feeling hopeless or worthless to the point of danger.

2. **Emotional Content**: Expressions of sadness, depression, anxiety, stress, fear, anger, loneliness, or overwhelm.

3. **Self-Worth Issues**: Statements about not being good enough, being a failure, hating oneself, or not deserving good things.

4. **Personality Traits (Big Five)**: 
   - Statements about how someone behaves **socially** (outgoing, shy, loves/hates parties, prefers alone time)
   - Statements about how someone handles **responsibilities** (organized, messy, plans ahead, procrastinates)
   - Statements about how someone deals with **new ideas** (creative, traditional, open to change, resistant)
   - Statements about how someone treats **others** (kind, assertive, cooperative, competitive)
   - Statements about how someone manages **emotions** (calm, anxious, stable, worried, easily upset)

5. **Dark Triad Indicators**: Statements about manipulating others, using people, feeling superior, lacking empathy, or faking emotions.

6. **Cognitive/Thinking Style Indicators**: Statements about decision-making approach, intuitive vs analytical thinking, trusting gut vs thinking things through, impulsive vs deliberate behavior, overthinking.

7. **Attachment Indicators**: Need for closeness, fear of abandonment, avoiding closeness, mixed desire and fear, comfort with closeness/independence.
8. **Enneagram Indicators**: Core motivations/fears (be loved, succeed, be unique, be safe, be in control, be at peace, etc.).
9. **MBTI Indicators**: E/I, S/N, T/F, J/P language (energy source, info style, decision style, organization style).
10. **Erikson Stage Indicators**: Identity, intimacy, usefulness/legacy, life reflection/regret themes (S5–S8).
11. **Gestalt Indicators**: Present awareness, contact patterns (avoid/deflect/confluence/projection/retroflection), arousal without support.

**Few-shot Examples:**

Example 1:
Message: "I hate parties"
→ hasPersonalityIndicators: true (relates to social behavior/Extraversion)
→ hasEmotionalContent: false
→ hasSelfWorthContent: false
→ hasDarkTriadIndicators: false
→ hasCognitiveIndicators: false
→ hasCrisisIndicators: false
→ urgency: low

Example 2:
Message: "I'm very organized but I never plan anything"
→ hasPersonalityIndicators: true (relates to responsibility/Conscientiousness)
→ hasEmotionalContent: false
→ hasSelfWorthContent: false
→ hasDarkTriadIndicators: false
→ hasCognitiveIndicators: false
→ hasCrisisIndicators: false
→ urgency: low

Example 3:
Message: "I feel sad"
→ hasPersonalityIndicators: false
→ hasEmotionalContent: true
→ hasSelfWorthContent: false
→ hasDarkTriadIndicators: false
→ hasCognitiveIndicators: false
→ hasCrisisIndicators: false
→ urgency: medium

Example 4:
Message: "I'm not good enough"
→ hasPersonalityIndicators: false
→ hasEmotionalContent: false
→ hasSelfWorthContent: true
→ hasDarkTriadIndicators: false
→ hasCognitiveIndicators: false
→ hasCrisisIndicators: false
→ urgency: medium

Example 5:
Message: "I want to give up on everything"
→ hasPersonalityIndicators: false
→ hasEmotionalContent: true
→ hasSelfWorthContent: true
→ hasDarkTriadIndicators: false
→ hasCrisisIndicators: true
→ urgency: critical

Example 6:
Message: "What time is it?"
→ hasPersonalityIndicators: false
→ hasEmotionalContent: false
→ hasSelfWorthContent: false
→ hasDarkTriadIndicators: false
→ hasCognitiveIndicators: false
→ hasCrisisIndicators: false
→ urgency: low

Example 7:
Message: "I'm calm but I worry about everything"
→ hasPersonalityIndicators: true (relates to emotion management/Neuroticism)
→ hasEmotionalContent: true
→ hasSelfWorthContent: false
→ hasDarkTriadIndicators: false
→ hasCognitiveIndicators: false
→ hasCrisisIndicators: false
→ urgency: medium

Example 8:
Message: "I like to help people"
→ hasPersonalityIndicators: true (relates to treating others/Agreeableness)
→ hasEmotionalContent: false
→ hasSelfWorthContent: false
→ hasDarkTriadIndicators: false
→ hasCognitiveIndicators: false
→ hasCrisisIndicators: false
→ urgency: low

Example 9:
Message: "I don't care about others, I just use them"
→ hasPersonalityIndicators: false
→ hasEmotionalContent: false
→ hasSelfWorthContent: false
→ hasDarkTriadIndicators: true
→ hasCognitiveIndicators: false
→ hasCrisisIndicators: false
→ urgency: medium

Example 10:
Message: "Hi"
→ hasPersonalityIndicators: false
→ hasEmotionalContent: false
→ hasSelfWorthContent: false
→ hasDarkTriadIndicators: false
→ hasCognitiveIndicators: false
→ hasCrisisIndicators: false
→ urgency: low

Example 11:
Message: "I like to help"
→ hasPersonalityIndicators: true (relates to treating others/Agreeableness)
→ hasEmotionalContent: false
→ hasSelfWorthContent: false
→ hasDarkTriadIndicators: false
→ hasCognitiveIndicators: false
→ hasCrisisIndicators: false
→ urgency: low

Example 12:
Message: "I like routine"
→ hasPersonalityIndicators: true (relates to dealing with new ideas/Openness)
→ hasEmotionalContent: false
→ hasSelfWorthContent: false
→ hasDarkTriadIndicators: false
→ hasCognitiveIndicators: false
→ hasCrisisIndicators: false
→ urgency: low

Example 13:
Message: "I'm perfect at everything I do"
→ hasPersonalityIndicators: true (relates to treating others/Agreeableness, self-perception)
→ hasEmotionalContent: false
→ hasSelfWorthContent: false
→ hasDarkTriadIndicators: false
→ hasCognitiveIndicators: false
→ hasCrisisIndicators: false
→ urgency: low

Example 14:
Message: "I'm confident but I doubt myself constantly"
→ hasPersonalityIndicators: true (relates to emotion management/Neuroticism)
→ hasEmotionalContent: true
→ hasSelfWorthContent: false
→ hasDarkTriadIndicators: false
→ hasCognitiveIndicators: false
→ hasCrisisIndicators: false
→ urgency: medium

Example 15:
Message: "I always go with my gut, I don't overthink"
→ hasPersonalityIndicators: false
→ hasEmotionalContent: false
→ hasSelfWorthContent: false
→ hasDarkTriadIndicators: false
→ hasCognitiveIndicators: true (relates to intuitive/System 1 thinking)
→ hasCrisisIndicators: false
→ urgency: low

Example 16:
Message: "I think too much before making any decision"
→ hasPersonalityIndicators: false
→ hasEmotionalContent: false
→ hasSelfWorthContent: false
→ hasDarkTriadIndicators: false
→ hasCognitiveIndicators: true (relates to analytical/System 2 thinking)
→ hasCrisisIndicators: false
→ urgency: low

**Now classify this message:**

Message: "${message}"
Recent history: ${history
              .slice(-3)
              .map((m) => m.content)
              .join(', ')}

Return JSON:
{
  "hasCrisisIndicators": true/false,
  "hasEmotionalContent": true/false,
  "hasSelfWorthContent": true/false,
  "hasDarkTriadIndicators": true/false,
  "hasPersonalityIndicators": true/false,
  "hasCognitiveIndicators": true/false,
  "hasAttachment": true/false,
  "hasEnneagram": true/false,
  "hasMBTI": true/false,
  "hasErikson": true/false,
  "hasGestalt": true/false,
  "urgency": "critical/high/medium/low"
}`,
          },
        ],
        { temperature: 0.0, max_tokens: 1000 },
        'classification',
        null, // No framework name for classification
      );

      const llmResult = JSON.parse(response.content || '{}');

      // HYBRID STEP 2: Merge keyword results with LLM results (keyword wins if found)
      return {
        hasCrisisIndicators: keywordResults.hasCrisisIndicators || llmResult.hasCrisisIndicators,
        hasEmotionalContent: keywordResults.hasEmotionalContent || llmResult.hasEmotionalContent,
        hasSelfWorthContent: keywordResults.hasSelfWorthContent || llmResult.hasSelfWorthContent,
        hasDarkTriadIndicators:
          keywordResults.hasDarkTriadIndicators || llmResult.hasDarkTriadIndicators,
        hasPersonalityIndicators:
          keywordResults.hasPersonalityIndicators || llmResult.hasPersonalityIndicators,
        hasCognitiveIndicators:
          keywordResults.hasCognitiveIndicators || llmResult.hasCognitiveIndicators,
        hasAttachment: !!llmResult.hasAttachment,
        hasEnneagram: !!llmResult.hasEnneagram,
        hasMBTI: !!llmResult.hasMBTI,
        hasErikson: !!llmResult.hasErikson,
        hasGestalt: !!llmResult.hasGestalt,
        urgency: llmResult.urgency || 'low',
      };
    } catch (error) {
      console.error('Error classifying message:', error);
      // Return safe default with keyword results if available
      const keywordResults = this.quickKeywordCheck(message);
      return {
        hasCrisisIndicators: keywordResults.hasCrisisIndicators || false,
        hasEmotionalContent: keywordResults.hasEmotionalContent || false,
        hasSelfWorthContent: keywordResults.hasSelfWorthContent || false,
        hasDarkTriadIndicators: keywordResults.hasDarkTriadIndicators || false,
        hasPersonalityIndicators: keywordResults.hasPersonalityIndicators || false,
        hasCognitiveIndicators: keywordResults.hasCognitiveIndicators || false,
        urgency: 'low',
      };
    }
  }

  /**
   * Analyze personality using Big Five KB (with token tracking)
   */
  private async callLLMWithBigFiveKB(
    message: string,
    history: any[],
    selectedLLM: string,
    sessionId: string,
    userId?: string,
  ): Promise<any> {
    try {
      const sys = this.getKBPrompt('BIG5_Complete_Analysis.txt');
      const { response } = await this.callLLMWithTokenTracking(
        userId,
        sessionId,
        selectedLLM,
        [
          {
            role: 'system',
            content: sys,
          },
          {
            role: 'user',
            content: `Conversation:
${history
  .slice(-5)
  .map((m) => `${m.role}: ${m.content}`)
  .join('\n')}

Latest: "${message}"

Analyze Big Five traits. Return JSON:
{
  "openness": "high/medium/low",
  "conscientiousness": "high/medium/low",
  "extraversion": "high/medium/low",
  "agreeableness": "high/medium/low",
  "neuroticism": "high/medium/low",
  "insights": ["trait insight 1", "trait insight 2"]
}`,
          },
        ],
        { temperature: 0.0, max_tokens: 1000 },
        'framework',
        'bigFive',
      );

      return this.parseJsonSafe(response.content, { insights: [] });
    } catch (error) {
      console.error('Error in Big Five analysis:', error);
      return { insights: [] };
    }
  }

  /**
   * Analyze mental health using DASS-42 KB
   */
  private async callLLMWithDASSKB(
    message: string,
    history: any[],
    selectedLLM: string,
    sessionId: string,
    userId?: string,
  ): Promise<any> {
    try {
      const sys = this.getKBPrompt('DASS42_Complete_Analysis.txt');
      const { response } = await this.callLLMWithTokenTracking(
        userId,
        sessionId,
        selectedLLM,
        [
          {
            role: 'system',
            content: sys,
          },
          {
            role: 'user',
            content: `Conversation:
${history
  .slice(-5)
  .map((m) => `${m.role}: ${m.content}`)
  .join('\n')}

Latest: "${message}"

Analyze mental health. Return JSON:
{
  "depression": "normal/mild/moderate/severe/extremely_severe",
  "anxiety": "normal/mild/moderate/severe/extremely_severe",
  "stress": "normal/mild/moderate/severe/extremely_severe",
  "concerns": ["concern 1", "concern 2"],
  "requiresCrisisResponse": true/false
}`,
          },
        ],
        { temperature: 0.0, max_tokens: 1000 },
        'framework',
        'dass',
      );

      return this.parseJsonSafe(response.content, { concerns: [] });
    } catch (error) {
      console.error('Error in DASS analysis:', error);
      return { concerns: [] };
    }
  }

  /**
   * Analyze self-esteem using RSE KB
   */
  private async callLLMWithRSEKB(
    message: string,
    history: any[],
    selectedLLM: string,
    sessionId: string,
    userId?: string,
  ): Promise<any> {
    try {
      const sys = this.getKBPrompt('RSE_Complete_Analysis.txt');
      const { response } = await this.callLLMWithTokenTracking(
        userId,
        sessionId,
        selectedLLM,
        [
          {
            role: 'system',
            content: sys,
          },
          {
            role: 'user',
            content: `Conversation:
${history
  .slice(-5)
  .map((m) => `${m.role}: ${m.content}`)
  .join('\n')}

Latest: "${message}"

Analyze self-esteem. Return JSON:
{
  "level": "low/medium/high",
  "indicators": ["indicator 1", "indicator 2"]
}`,
          },
        ],
        { temperature: 0.0, max_tokens: 1000 },
        'framework',
        'rse',
      );

      return this.parseJsonSafe(response.content, { indicators: [] });
    } catch (error) {
      console.error('Error in RSE analysis:', error);
      return { indicators: [] };
    }
  }

  /**
   * Analyze Dark Triad traits using Dark Triad KB
   */
  private async callLLMWithDarkTriadKB(
    message: string,
    history: any[],
    selectedLLM: string,
    sessionId: string,
    userId?: string,
  ): Promise<any> {
    try {
      const sys = this.getKBPrompt('DarkTriad_Complete_Analysis.txt');
      const { response } = await this.callLLMWithTokenTracking(
        userId,
        sessionId,
        selectedLLM,
        [
          {
            role: 'system',
            content: sys,
          },
          {
            role: 'user',
            content: `Conversation:
${history
  .slice(-5)
  .map((m) => `${m.role}: ${m.content}`)
  .join('\n')}

Latest: "${message}"

Analyze Dark Triad traits. Return JSON:
{
  "machiavellianism": "high/medium/low/unknown",
  "narcissism": "high/medium/low/unknown",
  "psychopathy": "high/medium/low/unknown",
  "insights": ["insight 1", "insight 2"]
}`,
          },
        ],
        { temperature: 0.0, max_tokens: 1000 },
        'framework',
        'darkTriad',
      );

      return this.parseJsonSafe(response.content, { insights: [] });
    } catch (error) {
      console.error('Error in Dark Triad analysis:', error);
      return { insights: [] };
    }
  }

  /**
   * Analyze cognitive/thinking style using CRT KB
   */
  private async callLLMWithCRTKB(
    message: string,
    history: any[],
    selectedLLM: string,
    sessionId: string,
    userId?: string,
  ): Promise<any> {
    try {
      const sys = this.getKBPrompt('CRT_Complete_Analysis.txt');
      const { response } = await this.callLLMWithTokenTracking(
        userId,
        sessionId,
        selectedLLM,
        [
          {
            role: 'system',
            content: sys,
          },
          {
            role: 'user',
            content: `Conversation:
${history
  .slice(-5)
  .map((m) => `${m.role}: ${m.content}`)
  .join('\n')}

Latest: "${message}"

Analyze cognitive/thinking style. Return JSON:
{
  "thinkingStyle": "intuitive/balanced/analytical/unknown",
  "systemPreference": "system1/mixed/system2/unknown",
  "insights": ["insight 1", "insight 2"]
}`,
          },
        ],
        { temperature: 0.0, max_tokens: 1000 },
        'framework',
        'crt',
      );

      return this.parseJsonSafe(response.content, { insights: [] });
    } catch (error) {
      console.error('Error in CRT analysis:', error);
      return { insights: [] };
    }
  }

  // New analyzers using KB system prompts (Attachment, Enneagram, MBTI, Erikson, Gestalt)
  private async callLLMWithAttachmentKB(message: string, selectedLLM: string, sessionId: string, userId?: string): Promise<any> {
    try {
      const sys = this.getKBPrompt('AttachmentStyleClassifier.txt');
      const { response: res } = await this.callLLMWithTokenTracking(
        userId,
        sessionId,
        selectedLLM,
        [
          { role: 'system', content: sys },
          { role: 'user', content: message },
        ],
        { temperature: 0.0, max_tokens: 800 },
        'framework',
        'attachment',
      );
      const parsed = this.parseJsonSafe(res.content, null);
      if (!parsed || parsed.module_error) {
        console.warn('[Attachment] Failed to parse LLM response:', res.content?.substring(0, 300));
        return { module_error: true, raw_response: res.content?.substring(0, 200) };
      }
      return parsed;
    } catch (e) {
      console.error('Error in Attachment analysis:', e);
      return { module_error: true, error: e.message };
    }
  }

  private async callLLMWithEnneagramKB(message: string, selectedLLM: string, sessionId: string, userId?: string): Promise<any> {
    try {
      const sys = this.getKBPrompt('Enneagram.txt');
      const { response: res } = await this.callLLMWithTokenTracking(
        userId,
        sessionId,
        selectedLLM,
        [
          { role: 'system', content: sys },
          { role: 'user', content: message },
        ],
        { temperature: 0.0, max_tokens: 800 },
        'framework',
        'enneagram',
      );
      const parsed = this.parseJsonSafe(res.content, null);
      if (!parsed || parsed.module_error) {
        console.warn('[Enneagram] Failed to parse LLM response:', res.content?.substring(0, 300));
        return { module_error: true, raw_response: res.content?.substring(0, 200) };
      }
      return parsed;
    } catch (e) {
      console.error('Error in Enneagram analysis:', e);
      return { module_error: true, error: e.message };
    }
  }

  private async callLLMWithMBTIKB(message: string, selectedLLM: string, sessionId: string, userId?: string): Promise<any> {
    try {
      const sys = this.getKBPrompt('MBTI.txt');
      const { response: res } = await this.callLLMWithTokenTracking(
        userId,
        sessionId,
        selectedLLM,
        [
          { role: 'system', content: sys },
          {
            role: 'user',
            content: `Message: "${message}"\n\nAnalyze for MBTI type. Return JSON only:\n{"EI": "I", "SN": "unknown", "TF": "unknown", "JP": "unknown", "Confidence": {"EI": 0.7}, "Evidence": ["quote here"]}`,
          },
        ],
        { temperature: 0.0, max_tokens: 800 },
        'framework',
        'mbti',
      );
      const parsed = this.parseJsonSafe(res.content, null);
      if (!parsed || parsed.module_error) {
        console.warn('[MBTI] Failed to parse LLM response:', res.content?.substring(0, 300));
        return { module_error: true, raw_response: res.content?.substring(0, 200) };
      }
      return parsed;
    } catch (e) {
      console.error('Error in MBTI analysis:', e);
      return { module_error: true, error: e.message };
    }
  }

  private async callLLMWithEriksonKB(message: string, selectedLLM: string, sessionId: string, userId?: string): Promise<any> {
    try {
      const sys = this.getKBPrompt('EPSI_CompleteAnalysis.txt');
      const { response: res } = await this.callLLMWithTokenTracking(
        userId,
        sessionId,
        selectedLLM,
        [
          { role: 'system', content: sys },
          { role: 'user', content: message },
        ],
        { temperature: 0.0, max_tokens: 800 },
        'framework',
        'erikson',
      );
      const parsed = this.parseJsonSafe(res.content, null);
      if (!parsed || parsed.module_error) {
        console.warn('[Erikson] Failed to parse LLM response:', res.content?.substring(0, 300));
        return { module_error: true, raw_response: res.content?.substring(0, 200) };
      }
      return parsed;
    } catch (e) {
      console.error('Error in Erikson analysis:', e);
      return { module_error: true, error: e.message };
    }
  }

  private async callLLMWithGestaltKB(message: string, selectedLLM: string, sessionId: string, userId?: string): Promise<any> {
    try {
      const sys = this.getKBPrompt('GestaltAwareness.txt');
      const { response: res } = await this.callLLMWithTokenTracking(
        userId,
        sessionId,
        selectedLLM,
        [
          { role: 'system', content: sys },
          { role: 'user', content: message },
        ],
        { temperature: 0.0, max_tokens: 800 },
        'framework',
        'gestalt',
      );
      const parsed = this.parseJsonSafe(res.content, null);
      if (!parsed || parsed.module_error) {
        console.warn('[Gestalt] Failed to parse LLM response:', res.content?.substring(0, 300));
        return { module_error: true, raw_response: res.content?.substring(0, 200) };
      }
      return parsed;
    } catch (e) {
      console.error('Error in Gestalt analysis:', e);
      return { module_error: true, error: e.message };
    }
  }

  private async callLLMWithBioPsychKB(message: string, selectedLLM: string, sessionId: string, userId?: string): Promise<any> {
    try {
      const sys = this.getKBPrompt('Bio-PsychReasoner.txt');
      const { response: res } = await this.callLLMWithTokenTracking(
        userId,
        sessionId,
        selectedLLM,
        [
          { role: 'system', content: sys },
          {
            role: 'user',
            content: `Message: "${message}"\n\nAnalyze for biological/lifestyle factors. Return JSON only:\n{"Possible_Factors": ["Sleep"], "Confidence_By_Factor": {"Sleep": 0.7}, "Evidence": ["quote here"], "Notes": ""}`,
          },
        ],
        { temperature: 0.0, max_tokens: 800 },
        'framework',
        'bioPsych',
      );
      const parsed = this.parseJsonSafe(res.content, null);
      if (!parsed || parsed.module_error) {
        console.warn('[BioPsych] Failed to parse LLM response:', res.content?.substring(0, 300));
        return { module_error: true, raw_response: res.content?.substring(0, 200) };
      }
      return parsed;
    } catch (e) {
      console.error('Error in BioPsych analysis:', e);
      return { module_error: true, error: e.message };
    }
  }

  /**
   * Clear session cache
   */
  clearSession(sessionId: string): void {
    this.sessionCache.delete(sessionId);
  }
}

// New analyzers using KB system prompts (Attachment, Enneagram, MBTI, Erikson, Gestalt)
// Placed inside class above; ensure not outside class. (Note: Editor appended earlier class end; re-open class)
