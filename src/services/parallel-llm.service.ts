import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LLMOrchestratorService } from './llm-orchestrator.service';

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
      const res = await this.llmOrchestrator.generateResponse(
        selectedLLM,
        [
          { role: 'system', content: system },
          { role: 'user', content: JSON.stringify(contextObj) },
        ],
        { temperature: 0.1, max_tokens: 350 },
      );
      return this.parseJsonSafe(res.content, null);
    } catch (e) {
      console.error('Summary LLM error:', e);
      return null;
    }
  }

  /**
   * Main analysis method - Smart Incremental with Option 2 (Accumulate Over Time)
   */
  async analyze(
    message: string,
    history: any[],
    sessionId: string,
    selectedLLM: string = 'gpt-4o',
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
        classification = await this.classifyMessage(message, history, selectedLLM);
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

      // Run necessary analyses in parallel
      const analysisPromises: Promise<any>[] = [];
      const analysisTypes: string[] = [];

      if (classification.hasCrisisIndicators || classification.hasEmotionalContent) {
        analysisPromises.push(this.callLLMWithDASSKB(message, history, selectedLLM));
        analysisTypes.push('dass');
      }

      if (classification.hasSelfWorthContent || classification.hasCrisisIndicators) {
        analysisPromises.push(this.callLLMWithRSEKB(message, history, selectedLLM));
        analysisTypes.push('rse');
      }

      if (classification.hasPersonalityIndicators) {
        analysisPromises.push(this.callLLMWithBigFiveKB(message, history, selectedLLM));
        analysisTypes.push('bigFive');
      }

      if (classification.hasDarkTriadIndicators) {
        analysisPromises.push(this.callLLMWithDarkTriadKB(message, history, selectedLLM));
        analysisTypes.push('darkTriad');
      }

      if (classification.hasCognitiveIndicators) {
        console.log('[CRT] Cognitive indicators detected - triggering CRT analysis');
        analysisPromises.push(this.callLLMWithCRTKB(message, history, selectedLLM));
        analysisTypes.push('crt');
      }

      // Combine LLM classification flags with keyword triggers
      const extraFromKeywords = this.detectExtraTheoryTriggers(message);
      const extraCombined = {
        hasAttachment: !!(classification.hasAttachment || extraFromKeywords.hasAttachment),
        hasEnneagram: !!(classification.hasEnneagram || extraFromKeywords.hasEnneagram),
        hasMBTI: !!(classification.hasMBTI || extraFromKeywords.hasMBTI),
        hasErikson: !!(classification.hasErikson || extraFromKeywords.hasErikson),
        hasGestalt: !!(classification.hasGestalt || extraFromKeywords.hasGestalt),
        hasBioPsych: !!(classification.hasBioPsych || extraFromKeywords.hasBioPsych),
      };

      // Trigger extra theory analyzers based on combined flags
      if (extraCombined.hasAttachment) {
        analysisPromises.push(this.callLLMWithAttachmentKB(message, selectedLLM));
        analysisTypes.push('attachment');
      }
      if (extraCombined.hasEnneagram) {
        analysisPromises.push(this.callLLMWithEnneagramKB(message, selectedLLM));
        analysisTypes.push('enneagram');
      }
      if (extraCombined.hasMBTI) {
        analysisPromises.push(this.callLLMWithMBTIKB(message, selectedLLM));
        analysisTypes.push('mbti');
      }
      if (extraCombined.hasErikson) {
        analysisPromises.push(this.callLLMWithEriksonKB(message, selectedLLM));
        analysisTypes.push('erikson');
      }
      if (extraCombined.hasGestalt) {
        analysisPromises.push(this.callLLMWithGestaltKB(message, selectedLLM));
        analysisTypes.push('gestalt');
      }
      if (extraCombined.hasBioPsych) {
        analysisPromises.push(this.callLLMWithBioPsychKB(message, selectedLLM));
        analysisTypes.push('bioPsych');
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

      const response = await this.llmOrchestrator.generateResponse(
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
   * Analyze personality using Big Five KB
   */
  private async callLLMWithBigFiveKB(
    message: string,
    history: any[],
    selectedLLM: string,
  ): Promise<any> {
    try {
      const sys = this.getKBPrompt('BIG5_Complete_Analysis.txt');
      const response = await this.llmOrchestrator.generateResponse(
        selectedLLM,
        [
          {
            role: 'system',
            content: sys,
          },
          {
            role: 'system',
            content: `You are a personality analyst trained on Big Five data from 19,719 people across 158 countries. 
Here is the comprehensive summary of Big Five personality findings:
Results from the 19,719-Participant Online Dataset
This Big Five personality study analyzed data from 19,719 participants across 158 countries who completed an online self-assessment around 2012. The test measured five major personality dimensions: Extraversion (how sociable and outgoing a person is), Neuroticism (how emotionally sensitive or easily stressed a person feels), Agreeableness (how kind, cooperative, and considerate someone is), Conscientiousness (how organized, responsible, and self-disciplined a person is), and Openness to Experience (how curious, imaginative, and open to new ideas someone tends to be).
[Scientific Foundation]
The Big Five framework is grounded in decades of lexical and statistical research showing that personality traits naturally appear in human language. Early work by Allport and Odbert (1936), Norman (1967), and Goldberg (1990) identified that the most important human personality differences are encoded in the adjectives we use to describe one another. Through analysis of thousands of trait words across multiple studies, five consistent clusters emerged—Extraversion, Agreeableness, Conscientiousness, Emotional Stability (the opposite of Neuroticism), and Intellect/Openness. These dimensions were not invented but discovered repeatedly through large-scale factor analyses of language data. The same five factors have been replicated in many languages and cultures, showing they are stable, universal, and empirically based. Each trait exists on a continuous scale, meaning every person has a unique combination of levels rather than fitting into fixed “types.”

[Group-Level Patterns]
On a 1-to-5 rating scale, where 3 represents a neutral midpoint, the average scores across all five traits ranged from 3.08 to 3.31. This means that, overall, participants described themselves as moderate on most traits—neither particularly high nor low in Extraversion, Neuroticism, Agreeableness, or Conscientiousness. The highest average score was for Openness (3.31), indicating that, as a group, participants rated themselves slightly higher on curiosity, creativity, and intellectual openness than on the other four traits. However, this does not mean that every person was high in Openness; rather, it reflects a small upward tendency in the group average.

Importantly, the individual scores covered the full 1-to-5 range on all traits, demonstrating substantial variation among individuals. This wide spread shows that while the group averages were near the midpoint, people differed greatly from one another, with some scoring very high or very low on each dimension. Statistical analysis also showed that individual differences (around 1.3 points of variation) were much larger than demographic differences such as gender or age.

When comparing genders, the differences were small and specific. Women scored, on average, 0.20 points higher on Neuroticism, showing slightly greater self-reported emotional sensitivity. For the other four traits—Extraversion, Openness, Agreeableness, and Conscientiousness—the differences between men and women were less than 0.10 points, meaning that the overall personality patterns were very similar across genders.

These results show that personality variation is primarily individual, not determined by gender or group membership. Each person's personality represents a unique combination of scores across the five traits, and the traits function as independent dimensions, not fixed "types." The data also highlight that this sample was not fully representative of the global population—most participants were young (average age 26), female (61%), English-speaking (63%), and from Western countries (44% from the United States). Therefore, the findings describe how this particular group of test-takers perceived themselves rather than universal human tendencies.

In summary, the study concludes that people in this dataset generally saw themselves as balanced and moderate across all personality traits, with a slight group-level lean toward Openness to Experience. At the same time, there was considerable diversity between individuals, showing that personality is best understood as a set of continuous, independent dimensions rather than categorical types.

Global and Developmental Context
Large international surveys and meta-analyses confirm that the Big Five framework is universal, replicating reliably across major regions, languages, and cultures. Studies using datasets from over 50 nations show that people worldwide also tend to score near the midpoint of each trait scale, meaning that most individuals describe themselves as moderate rather than extreme in Extraversion, Neuroticism, Agreeableness, Conscientiousness, or Openness.

There are, however, small regional patterns. For example, research using the IPIP-NEO and BFI instruments has found that, on average, East Asian samples (e.g., China, Japan) report slightly lower Openness and Agreeableness and somewhat higher Neuroticism than Western samples, while Northern European and English-speaking countries often show higher Extraversion and Openness and lower Neuroticism. These cross-cultural differences are modest, and most variation occurs within countries rather than between them, meaning that an individual can be highly introverted or extraverted in any culture.

Gender differences also appear globally but remain small and consistent: across most societies, women score higher on Neuroticism and Agreeableness than men, while differences in the other traits are minimal.

Age-related studies reveal a pattern known as the maturity principle. As people grow older, Conscientiousness and Agreeableness typically increase, reflecting greater self-discipline and empathy, while Neuroticism tends to decrease, showing improved emotional stability. Extraversion often declines slightly with age, and Openness to Experience increases during adolescence and early adulthood before tapering in later life. These gradual changes occur across cultures and suggest that personality develops toward greater stability and social maturity over the lifespan.

Links Between Personality and Life Outcomes
Extensive meta-analytic research connects Big Five traits with important life outcomes:

Mental Health & Well-Being:
High Neuroticism predicts greater risk of anxiety and depression, while Extraversion and Agreeableness are associated with higher happiness and life satisfaction. Emotional stability (low Neuroticism) consistently emerges as the strongest predictor of positive well-being.

Job Performance & Achievement:
Conscientiousness is the most reliable predictor of job performance across occupations, as conscientious individuals tend to be organized, dependable, and achievement-oriented. Low Neuroticism (emotional stability) also supports consistent performance. Other traits contribute in context-specific ways: Extraversion benefits social and leadership roles, Agreeableness aids teamwork, and Openness promotes creativity and learning.

Cognitive Ability:
Openness to Experience shows a modest positive relationship with intelligence and learning (correlation around r ≈ 0.2), suggesting that curiosity and imagination foster intellectual engagement.

Relationships:
Agreeableness and Conscientiousness predict more stable, satisfying relationships and lower divorce risk, while high Neuroticism increases relationship conflict and instability.

Health and Longevity:
Conscientiousness is a strong predictor of healthy behavior and long life, while high Neuroticism and low Conscientiousness relate to stress, risky behavior, and poorer health outcomes.

Overall Interpretation
Taken together, both the 19,719-participant dataset and global research show that the Big Five personality dimensions represent universal patterns of human individuality. Most people worldwide describe themselves as moderate on each trait, and the largest differences occur between individuals, not groups defined by gender, age, or nationality. Personality tends to develop gradually with age, and traits meaningfully influence well-being, work, relationships, and health — though they describe tendencies, not fixed outcomes.

In essence, the Big Five model demonstrates that while people everywhere share the same basic dimensions of personality, the unique combination of these traits within each person defines individual identity far more than cultural or demographic averages ever could.
---
CRITICAL: Individual variation (SD ~1.3) is 6-30x larger than gender differences. Focus on the PERSON, not demographics. Analyze personality using behavioral and linguistic patterns, not single statements. Base all reasoning on the empirical data above.

Analyze personality from conversation patterns, not surface statements. Use the research data above to interpret scores and provide insights based on real patterns from 19,719 participants.`,
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
  ): Promise<any> {
    try {
      const sys = this.getKBPrompt('DASS42_Complete_Analysis.txt');
      const response = await this.llmOrchestrator.generateResponse(
        selectedLLM, // Optimized for speed while maintaining quality
        [
          {
            role: 'system',
            content: sys,
          },
          {
            role: 'system',
            content: `You are a mental health analyst trained on DASS-42 data from global populations.
Here is the comprehensive summary of DASS-42 (Depression Anxiety Stress Scales) findings:

The Depression Anxiety Stress Scales (DASS-42) measure short-term emotional distress across three areas—Depression, Anxiety, and Stress—and are validated across more than 100 countries in over 50 languages. Global studies show that in the general population, average scores are low—around 5 for Depression, 3 for Anxiety, and 8 for Stress (on 0–42 scales)—indicating that most people experience only mild or occasional distress. About 15–25% of adults show moderate-to-severe symptoms, while severe distress remains relatively uncommon. Consistent trends appear across nations: young adults (18–24) report the highest levels of depression, anxiety, and stress, and women score slightly higher than men in anxiety and stress. Older adults tend to be more emotionally stable. Cross-cultural studies confirm that the DASS structure is universal, though average scores vary slightly—typically higher in Asian and developing regions and lower in Western samples, reflecting environmental and social pressures rather than measurement bias. DASS scores rise during global crises (for example, a 25% worldwide increase in anxiety and depression during COVID-19), showing that mental health fluctuates with life conditions. Key predictors of higher distress include high Neuroticism, low self-esteem, poor sleep, inactivity, and low social support, while regular exercise, adequate rest, social connection, and self-confidence strongly protect well-being. Overall, the DASS reveals that most people worldwide experience mild emotional distress as part of normal life, while more severe symptoms affect a smaller portion of the population, shaped by age, culture, and environmental stress.

---
CRITICAL: Mental health varies by context and life conditions. Analyze emotional distress from conversation patterns, not single words. Look for persistent themes of hopelessness, panic, or overwhelm. Use the research data above to interpret severity and provide insights based on real global patterns.`,
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
  ): Promise<any> {
    try {
      const sys = this.getKBPrompt('RSE_Complete_Analysis.txt');
      const response = await this.llmOrchestrator.generateResponse(
        selectedLLM, // Optimized for speed while maintaining quality
        [
          {
            role: 'system',
            content: sys,
          },
          {
            role: 'system',
            content: `You are a self-esteem analyst trained on RSE data from 47,974 people across 175 countries.
Here is the comprehensive summary of Rosenberg Self-Esteem Scale findings:

Condensed Comprehensive Summary

This Rosenberg Self-Esteem Scale (RSE) study analyzed data from 47,974 participants across 175 countries who completed a 10-item self-assessment measuring overall self-worth and satisfaction with oneself. Participants rated statements like "I feel that I have good qualities" or "I am satisfied with myself" on a 4-point scale. The sample was young (average age 27), 61% women, 37% men, and 63% English-speaking, with nearly half (47%) from the United States.

Average self-esteem was 26.2 out of 40, indicating moderate self-esteem. The majority—67% of participants—fell within the normal range (15–25 points). 13% scored low (below 15) and 19% scored high (above 25). Scores covered the full possible range (10–40), showing strong individual differences. Nearly 99% completed all questions, confirming high engagement and data reliability.

Gender differences were minimal: men averaged 26.9 and women 25.8, a small one-point gap. Self-esteem increased with age—from 25.9 (ages 13–24) to 27.5 (ages 55+)—indicating that confidence and self-acceptance grow over time. Respondents more easily agreed with "I have good qualities" (3.11/4) than "I am satisfied with myself" (2.69/4), showing that recognizing one's strengths doesn't always mean feeling content. Most disagreed with "I am a failure" (2.15/4) but admitted "I feel useless at times" (2.81/4)—demonstrating that temporary self-doubt is common and not the same as low self-worth.

Global and Developmental Patterns

Large-scale international studies using the RSE show that most people worldwide hold a positive self-view. Across 53 nations, average scores consistently sit above the midpoint, meaning people tend to rate themselves positively. This universal pattern suggests a shared human tendency to maintain self-worth.

Self-esteem rises through adolescence and adulthood, with global surveys of nearly a million participants showing steady increases from teenage years into middle age. As people mature, they typically feel more confident and secure in who they are.

Gender gaps in self-esteem are small but consistent. Men report slightly higher scores than women, especially in Western, industrialized nations (e.g., the U.S. and Europe). However, the difference nearly disappears in more collectivist or traditional societies, where social modesty and interdependence are more valued. Both men and women, across regions, show increasing self-esteem with age.

Culture plays a major role. People from individualistic cultures (valuing independence and self-expression) report higher self-esteem, while those from collectivist cultures (emphasizing humility and group harmony) report lower scores. Importantly, this doesn't imply people in collectivist societies lack confidence—rather, cultural norms discourage open self-praise, leading to more reserved responses. Thus, how people express self-esteem depends on cultural attitudes toward modesty and self-presentation.

Links to Personality and Mental Health

High self-esteem consistently correlates with positive psychological traits. Individuals with higher RSE scores tend to be more extraverted, emotionally stable, and socially confident, while low self-esteem is linked to neuroticism, anxiety, and depression. Those with higher self-esteem also tend to experience better emotional resilience, healthier relationships, and greater well-being.

Conversely, low self-esteem is associated with mental health struggles, including self-doubt, loneliness, and hopelessness. High self-esteem supports optimism, persistence, and interpersonal security. While not the only factor, a healthy level of self-esteem functions as a psychological buffer, protecting individuals from stress and enhancing life satisfaction.

Cross-Cultural Validity and Interpretation

The Rosenberg Self-Esteem Scale has proven reliable and valid across dozens of countries and languages. Its core structure holds up globally, confirming that "self-esteem" is a meaningful and measurable construct worldwide. However, researchers note that cultural factors—such as how people interpret negatively worded statements or use middle response options—can affect comparisons between countries. Despite these nuances, the fact that most groups score above neutral underscores a universal human pattern: people generally see themselves in a positive, worthwhile light.

Overall Interpretation

Taken together, both this 47,974-person dataset and global research show that self-esteem is a universal yet individually variable human trait. Most people maintain a balanced, moderately positive sense of self-worth, with small demographic differences. Age and culture influence how confidence is expressed, but the underlying pattern—valuing oneself—is shared across humanity.

Self-esteem is not fixed; it develops through experience, maturity, and self-awareness, supporting emotional stability and well-being. Globally, the evidence points to a simple but powerful truth: most people, regardless of culture, tend to view themselves as fundamentally worthy, capable, and good.

---
CRITICAL: Individual variation (SD ~6.35) is much larger than demographic differences. Focus on the PERSON'S language, not demographics. Analyze self-worth from patterns in how they talk about themselves, not single statements. Use the research data above to interpret self-esteem and provide insights based on real patterns from 47,974 participants.`,
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
  ): Promise<any> {
    try {
      const sys = this.getKBPrompt('DarkTriad_Complete_Analysis.txt');
      const response = await this.llmOrchestrator.generateResponse(
        selectedLLM, // Optimized for speed while maintaining quality
        [
          {
            role: 'system',
            content: sys,
          },
          {
            role: 'system',
            content: `You are a personality analyst trained on Dark Triad data from 18,192 people across 100 countries.
Here is the comprehensive summary of Dark Triad Personality findings:

Condensed Comprehensive Summary (Easy English)

The Dark Triad Personality Test looked at results from 18,192 people across about 100 countries, mostly from Western, English-speaking regions (51% from the U.S., 15% from the U.K., and 79% from English-speaking countries overall).

The test measured three personality traits that psychologists call "dark traits":

Machiavellianism – being strategic, calculating, or manipulative.

Narcissism – being self-centered, confident, or craving admiration.

Psychopathy – being impulsive, fearless, or lacking empathy.

Each trait was rated on a 1–5 scale, where 3 is neutral.

On average, people scored:

Machiavellianism: 3.71 (above average)

Narcissism: 3.03 (neutral)

Psychopathy: 2.98 (neutral)

This means people often admit to being strategic and tactical, but are neutral about being selfish or cold.
Machiavellianism stood out as the highest, suggesting many people see themselves as clever and practical rather than cruel or arrogant.
Almost 97.5% of people finished the test, showing strong attention and interest.

Key Insights

Strategic Thinking is Common: People are comfortable saying they use strategy or manipulation but don't strongly identify with being narcissistic or heartless.

Three Separate Traits: Each trait works independently — someone can score high on one but low on another.

Self-Selection Bias: People who take this kind of test are often more self-aware or curious about personality, so they might not represent the average population.

Cultural Context: People in Western countries may feel more open to admitting manipulative or self-focused behaviors, while those in modest, collectivist cultures are less likely to do so.

Global Patterns and Correlates

Typical Scores: Around the world, average scores are about Machiavellianism 3.1, Narcissism 2.8, and Psychopathy 2.4.
This means most people fall in the low to moderate range for these traits, and very high scorers are rare.

Gender Differences: Men tend to score a little higher on all three traits, especially psychopathy, though men and women overlap a lot.

Cultural Differences: These traits exist everywhere, though the averages vary slightly.

Western countries usually report lower psychopathy,

while some collectivist or developing regions report slightly higher averages.
Overall, the Dark Triad appears to be a universal part of human personality.

Connections with Other Personality Traits

All three traits are linked with low Agreeableness — people are less cooperative or kind.

Machiavellians and psychopaths also score low on Conscientiousness — meaning they are less organized or rule-following.

Narcissists are often outgoing and confident (high Extraversion), and sometimes achievement-driven.

Psychopaths usually have low Neuroticism — meaning they are calm and fearless.

Self-Esteem and Identity

Narcissists have high but fragile self-esteem — they appear confident but rely on praise to feel good about themselves.

Machiavellians and psychopaths often have unstable or low self-esteem, suggesting insecurity under the surface.

Mental Health

People with higher Dark Triad scores usually have lower well-being — more stress, loneliness, and less empathy.

However, some "dark" traits can help people cope with stress:

Grandiose narcissists may feel less depression because of strong self-confidence.

Machiavellian individuals with good planning skills ("Machiavellian agency") may handle pressure calmly.

In general, though, higher Dark Triad levels are linked to worse mental health.

Aggression and Antisocial Behavior

All three traits are connected to aggressive or antisocial actions, especially psychopathy (strongest link, r ≈ 0.3–0.4).

Machiavellians tend to use strategic or hidden aggression.

Narcissists may become aggressive when their ego is threatened ("narcissistic rage").

Psychopaths show the most serious antisocial behaviors like rule-breaking or violence.

Prosocial (Helping) Behavior

These traits are linked to low empathy and low kindness.

When people high in Dark Triad traits help others, it's often for personal benefit, not genuine care.

Workplace Impact

Narcissism and Machiavellianism can help people succeed in careers because they are confident and strategic.

However, when these traits are too strong, they harm ethics, teamwork, and trust.

People with high Dark Triad scores might rise quickly at work, but over time they create conflict or damage morale.

Life-Stage Trends

Dark Triad traits are highest in young people (teens to 20s), when competition and self-focus are stronger.

As people grow older, they usually become kinder, more responsible, and empathetic.

Older adults score lowest on all three traits, especially psychopathy and Machiavellianism.

Overall Interpretation

The Dark Triad traits exist in everyone, just in different amounts.

Most people are a little self-interested but not malicious.

These traits can bring ambition, confidence, and resilience when balanced — but if too strong, they lead to selfishness, manipulation, and loss of empathy.

Across all ages and cultures, the Dark Triad reflects the human struggle between strategic self-interest and moral responsibility.

In short:
People everywhere have some level of the "dark" traits.
Most are strategic, not sinister — practical and self-aware, but still capable of empathy and kindness.

---
CRITICAL: Dark Triad traits are normal variations in personality, not pathology. Analyze interpersonal patterns from conversation style—how they talk about others, relationships, and achieving goals. Use the research data above to interpret behaviors based on real patterns from 18,192 participants.`,
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
  ): Promise<any> {
    try {
      const sys = this.getKBPrompt('CRT_Complete_Analysis.txt');
      const response = await this.llmOrchestrator.generateResponse(
        selectedLLM, // Consistent with other analysis LLMs
        [
          {
            role: 'system',
            content: sys,
          },
          {
            role: 'system',
            content: `You are a cognitive style analyst trained on CRT (Cognitive Reflection Test) data from global studies across 20+ countries.
Here is the comprehensive summary of CRT findings:

Condensed Comprehensive Summary (Easy English)

The Cognitive Reflection Test (CRT) is a short test made of tricky puzzles that measure how well people can stop their quick, automatic thinking and use slow, logical thinking instead.
Each question gives a tempting "gut" answer that seems right but is actually wrong — like the well-known bat and ball problem.

Across the world, people usually score low on this test. Most people get only 1 or 2 out of 3 questions correct, about one-third get none right, and only about 17% get all correct.
This means most people rely on fast, intuitive thinking, and only a small group regularly think more carefully and reflectively.

Thinking Patterns

People who score high on the CRT are good at pausing, questioning their first thought, and reasoning carefully (called System 2 thinking).
People who score low often trust their gut feeling (called System 1 thinking).

Even top scorers often say the wrong answer first came to mind, showing that intuitive mistakes are natural for everyone.

This pattern is the same around the world. Studies in more than 20 countries find similar results — low scores and common "gut" mistakes, no matter the language or culture.

Demographic Trends

Gender: Men score a little higher on average, mostly because of small differences in math or number skills, but the gap is small.

Age: Younger adults do better than older adults, who more often choose the first intuitive answer. This may be due to lower math comfort, not just age.

Education: Education makes a big difference. People with higher education, especially top university students, usually score much better than the general public.

Cognitive and Behavioral Links

Reasoning Style: People with high CRT scores are less likely to make thinking mistakes (like jumping to conclusions or being fooled by framing). They make more logical decisions overall.

Intelligence & Math Skills: CRT scores are moderately linked to IQ and math ability (r ≈ 0.3–0.5) because the puzzles often involve simple numbers or logic.

Open-Minded Thinking: High CRT scorers enjoy thinking deeply, are curious, and open to new evidence. They are willing to question what they believe.

Beliefs and Misinformation: People with low CRT scores are more likely to believe conspiracy theories, pseudoscience, or fake news, while high scorers are more skeptical and careful about what they believe.

Religion: In many countries, people with higher CRT scores are less religious because they tend to analyze and question intuitive or supernatural beliefs.

Overall Interpretation

Overall, the CRT shows that most humans think fast and intuitively, but a smaller group can slow down and think carefully when needed.
Scores depend on education, math ability, and willingness to question your first instinct.

High CRT scorers are not just good at math — they are more reflective, open-minded, and better at avoiding reasoning errors.

In short: Most people trust their gut, but those who pause, reflect, and think twice make clearer and more rational choices.

---
CRITICAL: Cognitive style is NOT about intelligence - it's about thinking approach. Analyze decision-making patterns from conversation: Do they mention "gut feelings", "overthinking", "impulsive decisions", "analyzing everything"? Look for patterns in how they describe making choices, not IQ. Use the research data above to interpret thinking styles based on real global patterns.`,
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
      );

      return this.parseJsonSafe(response.content, { insights: [] });
    } catch (error) {
      console.error('Error in CRT analysis:', error);
      return { insights: [] };
    }
  }

  // New analyzers using KB system prompts (Attachment, Enneagram, MBTI, Erikson, Gestalt)
  private async callLLMWithAttachmentKB(message: string, selectedLLM: string): Promise<any> {
    try {
      const sys = this.getKBPrompt('AttachmentStyleClassifier.txt');
      const res = await this.llmOrchestrator.generateResponse(
        selectedLLM,
        [
          { role: 'system', content: sys },
          { role: 'user', content: message },
        ],
        { temperature: 0.0, max_tokens: 800 },
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

  private async callLLMWithEnneagramKB(message: string, selectedLLM: string): Promise<any> {
    try {
      const sys = this.getKBPrompt('Enneagram.txt');
      const res = await this.llmOrchestrator.generateResponse(
        selectedLLM,
        [
          { role: 'system', content: sys },
          { role: 'user', content: message },
        ],
        { temperature: 0.0, max_tokens: 800 },
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

  private async callLLMWithMBTIKB(message: string, selectedLLM: string): Promise<any> {
    try {
      const sys = this.getKBPrompt('MBTI.txt');
      const res = await this.llmOrchestrator.generateResponse(
        selectedLLM,
        [
          { role: 'system', content: sys },
          {
            role: 'user',
            content: `Message: "${message}"\n\nAnalyze for MBTI type. Return JSON only:\n{"EI": "I", "SN": "unknown", "TF": "unknown", "JP": "unknown", "Confidence": {"EI": 0.7}, "Evidence": ["quote here"]}`,
          },
        ],
        { temperature: 0.0, max_tokens: 800 },
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

  private async callLLMWithEriksonKB(message: string, selectedLLM: string): Promise<any> {
    try {
      const sys = this.getKBPrompt('EPSI_CompleteAnalysis.txt');
      const res = await this.llmOrchestrator.generateResponse(
        selectedLLM,
        [
          { role: 'system', content: sys },
          { role: 'user', content: message },
        ],
        { temperature: 0.0, max_tokens: 800 },
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

  private async callLLMWithGestaltKB(message: string, selectedLLM: string): Promise<any> {
    try {
      const sys = this.getKBPrompt('GestaltAwareness.txt');
      const res = await this.llmOrchestrator.generateResponse(
        selectedLLM,
        [
          { role: 'system', content: sys },
          { role: 'user', content: message },
        ],
        { temperature: 0.0, max_tokens: 800 },
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

  private async callLLMWithBioPsychKB(message: string, selectedLLM: string): Promise<any> {
    try {
      const sys = this.getKBPrompt('Bio-PsychReasoner.txt');
      const res = await this.llmOrchestrator.generateResponse(
        selectedLLM,
        [
          { role: 'system', content: sys },
          {
            role: 'user',
            content: `Message: "${message}"\n\nAnalyze for biological/lifestyle factors. Return JSON only:\n{"Possible_Factors": ["Sleep"], "Confidence_By_Factor": {"Sleep": 0.7}, "Evidence": ["quote here"], "Notes": ""}`,
          },
        ],
        { temperature: 0.0, max_tokens: 800 },
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
