import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LLMOrchestratorService } from './llm-orchestrator.service';
import { CreditService } from './credit.service';

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

// =============================================================================
// INTELLIGENT PSYCHOLOGICAL SIGNAL ROUTER PROMPT
// =============================================================================
const PSYCHOLOGICAL_SIGNAL_ROUTER = `
You are a psychological signal detector. Your one job:

**Does this message contain ANY psychological information about the speaker?**

Not "does this person need help" - everyone does. The question is: **Is there signal here to analyze?**

---

## What IS Psychological Signal?

Anything revealing the speaker's:
- Emotional state (how they feel)
- Personality (how they typically are)
- Thinking patterns (how they process)
- Self-perception (how they see themselves)
- Relationship patterns (how they connect)
- Motivations and fears (what drives them)
- Coping mechanisms (how they handle difficulty)
- Bio-environmental factors (sleep, stress, health, substances)

---

## What is NOT Signal?

Messages with zero information about the person's inner world:
- Pure greetings: "Hi", "Hello", "Hey there"
- Factual questions with no self-reference: "What's 2+2?", "What time is it?"
- Simple acknowledgments: "Ok", "Thanks", "Got it"
- Commands with no personal content: "Show me the menu", "List the options"

---

## The Gray Area (Read Carefully)

Some messages SEEM neutral but contain hidden signal:
- "I finally got out of bed today" → Signal! "Finally" reveals struggle
- "I went to the store" → No signal (unless context suggests difficulty)
- "I guess I should do my work" → Signal! "I guess" + "should" = reluctance/pressure
- "My boss wants me to do something" → No signal (just a fact)
- "My boss is making me anxious" → Signal! Emotional impact revealed
- "Whatever, it doesn't matter" → Signal! Dismissiveness often hides feeling unheard
- "I don't know" → Depends on context - could be genuine uncertainty or avoidance
- "It's fine" → Often signals it's NOT fine - note the flatness

---

## Messages About Others

When someone talks about another person's psychology:
- "My friend seems depressed" → Low signal about user, but may reveal concern patterns, empathy, or projection
- "How do I help someone with anxiety?" → User may be asking about themselves indirectly
- Focus on what this reveals about the SPEAKER, if anything

---

## Important: These Examples Are NOT Exhaustive

The examples above are just illustrations. In reality, you will encounter:

**Messages we haven't thought of:**
- Poetic or metaphorical expressions: "I feel like I'm drowning in quicksand"
- Cultural references: "I'm having a Walter White moment"
- Slang and new language: "I'm lowkey spiraling rn", "no cap I'm cooked"
- Sarcasm: "Oh great, another perfect day" (might be genuine OR ironic)
- Code-switching: Mix of languages or communication styles
- Stream of consciousness: Rambling without clear structure
- Venting without asking for help
- Philosophical musings that reveal psychology
- Dreams and fantasies they're sharing
- Jokes that hide real feelings
- Song lyrics or quotes that resonate with them

**Unexpected formats:**
- Single emojis: "😔" (this HAS signal!)
- Voice-to-text with errors
- Typos: "I'm so tried" (tired? trying?)
- ALL CAPS: "I CAN'T DO THIS ANYMORE"
- Excessive punctuation: "I'm fine........"
- Ellipses that trail off: "I thought maybe..."
- Very long paragraphs (may indicate need to be heard)
- Very short fragments (may indicate shutdown)

**Content you won't expect:**
- Niche hobbies revealing personality
- Work situations with hidden emotional content
- Family dynamics from different cultures
- Medical situations with psychological components
- Financial stress disguised as practical questions
- Relationship structures you may not be familiar with
- Grief expressed in unexpected ways
- Joy and success (yes, positive messages have signal too!)
- Spiritual or existential content
- Body image and physical self-perception
- Academic or career pressure
- Social media and comparison patterns

**The key principle:**
Don't pattern-match to these examples. Use your understanding of human psychology. If a message reveals ANYTHING about how this person thinks, feels, relates, copes, or perceives themselves - there is signal, even if it looks nothing like my examples.

When in doubt: if you sense something about the person from their message, there's signal. Trust your read.

---

## Your Available Lenses

When there IS signal, pick ALL relevant lenses. **One message often triggers multiple frameworks.**

---

**dass** - Current emotional state (Depression, Anxiety, Stress)
Use when the message reveals how they're feeling emotionally - whether stated directly ("I feel anxious") or indirectly through their tone, situation, or behavior. Emotional distress can show through what they say, how they say it, what they're going through, or how they're coping. Not just emotion words - the overall emotional weight of the message.

---

**bigFive** - Personality traits (who they ARE as a person)
Detects the Big Five personality dimensions (OCEAN):
- **Openness**: creativity, curiosity, imagination, love of learning, trying new things
- **Conscientiousness**: self-control, organization, discipline, planning, responsibility, attention to detail
- **Extraversion**: social energy, social interactivity, talkativeness, enjoying people, outgoing nature
- **Agreeableness**:  helpfulness, kindness, cooperation, empathy, trust, caring about others
- **Neuroticism**: emotional sensitivity, tendency to worry, self-doubt, mood swings, depression, irritability, and moodiness.

Use when: Message reveals HOW they typically think, feel, or behave as a pattern - not just a one-time emotion.
Example: "I always plan everything" → Conscientiousness. "I get anxious easily" → Neuroticism. "I love meeting new people" → Extraversion.

---

**rse** - Self-worth and self-esteem
Use when the message reveals how they see themselves - their sense of value, competence, or worth. This shows in how they talk about their abilities, achievements, failures, or place in the world. Self-esteem can be high, low, or fragile - look for the underlying belief about "am I good enough?"

---

**enneagram** - Core motivations, fears, and personality patterns
Detects the 9 Enneagram personality types based on:
- **Core fears & desires** (what they avoid vs. seek)
- **Worldview** (how they see life and relationships)
- **Coping patterns** (how they handle stress, conflict, decisions)
- **Emotional habits** (anger, shame, fear patterns)
- **Relationship dynamics** (how they connect with or withdraw from others)

The 9 types: Perfectionist, Helper, Achiever, Individualist, Investigator, Loyalist, Enthusiast, Challenger, Peacemaker

Use when: Message reveals patterns in how they think, relate, cope, or what drives their behavior - even if they don't explicitly state fears or desires. Any message showing personality patterns, coping mechanisms, relationship styles, or emotional tendencies can be Enneagram-relevant.

---

**crt** - How they make decisions
Use when message reveals thinking patterns - do they go with gut feelings or analyze carefully? Are they impulsive or deliberate? Do they trust instincts or need to think things through?

---

**darkTriad** - Manipulation / superiority patterns (RARE)
Use ONLY when message clearly shows: using others for personal gain, feeling superior to everyone, or lacking empathy/remorse. Most messages won't have this.

---

**attachment** - How they connect with and trust others
Use when the message reveals relationship patterns - how they approach closeness, trust, dependency, or independence with ANY people (not just romantic). Do they push people away? Cling too tightly? Struggle to trust? Feel secure in connections? This shapes how they relate to everyone.

---

**mbti** - How they process the world
Use when message reveals: where they get energy (people vs alone), how they take in info (details vs big picture), how they decide (logic vs values), how they structure life (planned vs spontaneous).

---

**erikson** - Life stage and developmental challenges
Use when the message reveals struggles about growing, maturing, or finding one's place in life. Questions about trust, independence, identity, connection, purpose, or legacy. The big "life chapter" questions - who am I becoming, where do I belong, what am I building, did my choices matter. Developmental transitions and existential turning points.

---

**gestalt** - Emotional awareness and unfinished business
Use when the message reveals how connected or disconnected they are from their own feelings. Are they fully present with their emotions? Avoiding something? Deflecting? Stuck on something unresolved from the past? The gap between what they feel and what they acknowledge.

---

**bioPsych** - Physical and biological factors affecting mood
Use when the message suggests physical factors might be influencing their state - sleep, energy, health, substances, body sensations, environment. Can be explicit ("I haven't slept") or implicit (signs of exhaustion, physical complaints, lifestyle factors). The body-mind connection.

---

## IMPORTANT: Think Like a Therapist

A therapist hearing "I feel anxious about starting my business" would think:

1. "They're anxious right now" → **dass**
2. "They seem like someone who worries" → **bigFive** (neuroticism)
3. "They're afraid of something - maybe failure or uncertainty" → **enneagram**

**Select ALL frameworks that a thoughtful therapist would find relevant. Don't be stingy.**

---

## Calibrating Your Confidence

**High confidence:** The signal is clear and unmistakable
- "I've been crying every night this week" → high, obvious emotional state
- "I always procrastinate and hate myself for it" → high, clear trait + self-criticism

**Medium confidence:** Signal is present but interpretation could vary
- "I finally got out of bed" → medium, could be casual or could indicate struggle
- "People exhaust me" → medium, could be introversion or could be deeper isolation

**Low confidence:** You sense something but aren't sure
- "Interesting day today." → low, might be neutral or might be hiding something
- "Yeah" → low, flatness might mean something or might just be brief

When confidence is low, still report the signal if you sense it. Better to flag something ambiguous than miss something important.

---

## Your Response Format

Respond ONLY with valid JSON:

{
  "hasSignal": true,
  "confidence": "high",
  "frameworks": ["dass", "rse"],
  "signalType": "self-criticism about recent emotional struggles",
  "reasoning": "Brief explanation of what you detected and why"
}

If no signal:

{
  "hasSignal": false,
  "confidence": "high",
  "frameworks": [],
  "signalType": "no psychological content",
  "reasoning": "This is a simple greeting/factual question with no self-reference"
}

---

## Final Reminder

You're detecting SIGNAL, not need.

- "I'm the happiest I've ever been!" → HAS signal (emotional state, self-perception)
- "I just got promoted!" → HAS signal (achievement, possibly self-worth)
- "I finally left that toxic relationship" → HAS signal (boundaries, growth, attachment)

Positive messages have signal too. You're not looking for problems - you're looking for psychological information.

Trust your instincts. If you sense something about the person, there's signal.
`;

// Simple regex filter for OBVIOUSLY non-psychological messages (saves LLM calls)
const OBVIOUS_NO_SIGNAL_PATTERNS = [
  /^(hi|hello|hey|yo|sup)[\s!.?]*$/i,                    // Pure greetings
  /^(ok|okay|k|sure|yes|no|yeah|nah|yep|nope)[\s!.?]*$/i, // Simple acknowledgments
  /^(thanks|thank you|ty|thx)[\s!.?]*$/i,                 // Thanks
  /^(bye|goodbye|see ya|later|cya)[\s!.?]*$/i,            // Farewells
  /^(good morning|good night|gm|gn)[\s!.?]*$/i,           // Time greetings
  /^what time is it\??$/i,                                 // Time question
  /^what('s| is) the (weather|date|time)\??$/i,           // Factual questions
];

@Injectable()
export class ParallelLLMService {
  private sessionCache = new Map<string, PsychologicalProfile>();
  private promptCache = new Map<string, string>();

  constructor(
    private configService: ConfigService,
    private llmOrchestrator: LLMOrchestratorService,
    private creditService: CreditService,
  ) {}

  // Load and cache KB system prompts (verbatim). If file contains a JSON object
  // with { role: 'system', content: [...] }, join the content array; otherwise use raw text.
  private getKBPrompt(fileName: string): string {
    // ALWAYS reload from disk (no cache) to get latest changes
    // Cache disabled during development
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Fix path resolution: use __dirname to get correct path regardless of cwd
      // __dirname points to dist/src/services, so go up 3 levels to backend root
      let kbPath = path.join(__dirname, '..', '..', '..', 'KB', fileName);
      
      // Fallback: try from cwd if __dirname path doesn't exist
      if (!fs.existsSync(kbPath)) {
        // Try without 'backend' prefix (when cwd is already in backend)
        kbPath = path.join(process.cwd(), 'KB', fileName);
      }
      if (!fs.existsSync(kbPath)) {
        // Try with 'backend' prefix (when cwd is project root)
        kbPath = path.join(process.cwd(), 'backend', 'KB', fileName);
      }
      
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
    const result = this.detectExtraTheoryTriggersWithMatches(message);
    return result.flags;
  }

  // Detect extra theory triggers AND return matched keywords for debug display
  private detectExtraTheoryTriggersWithMatches(message: string): {
    flags: {
      hasAttachment: boolean;
      hasEnneagram: boolean;
      hasMBTI: boolean;
      hasErikson: boolean;
      hasGestalt: boolean;
      hasBioPsych: boolean;
    };
    matchedKeywords: {
      attachment: string[];
      enneagram: string[];
      mbti: string[];
      erikson: string[];
      gestalt: string[];
      bioPsych: string[];
    };
  } {
    const lower = message.toLowerCase();

    // Define keyword arrays for each theory
    const attachmentKeywords = ['please don\'t leave', 'leave me', 'abandon', 'need you', 'close', 'closeness', 'too close', 'space', 'independent', 'depend', 'trust', 'afraid of love', 'afraid of closeness'];
    const enneagramKeywords = ['be right', 'be loved', 'be admired', 'unique', 'authentic', 'understand', 'protect energy', 'safe', 'support', 'freedom', 'happiness', 'control', 'independent', 'peace', 'harmony'];
    const mbtiKeywords = ['i am an introvert', 'i am an extrovert', 'i am introverted', 'i am extroverted', 'ambivert', 'mbti', 'personality type', 'my type is', 'sensing type', 'intuitive type', 'thinking type', 'feeling type', 'judging type', 'perceiving type'];
    const eriksonKeywords = ['who am i', 'purpose', 'identity', 'belong', 'trust', 'love', 'lonely', 'useless', 'meaningful', 'legacy', 'stuck', 'regret', 'life review'];
    const gestaltKeywords = ['right now i feel', 'i notice', 'avoid', 'numb', 'joke', 'humor to avoid', 'go along', 'they make me feel', 'it\'s my fault', 'i shouldn\'t feel', 'i freeze', 'can\'t act'];
    const bioPsychKeywords = ['sleep', 'slept', 'insomnia', 'tired', 'exhausted', 'fatigue', 'burnout', 'headache', 'pain', 'sick', 'ill', 'fever', 'period', 'pms', 'hormones', 'caffeine', 'coffee', 'alcohol', 'drunk', 'hungover', 'hungry', 'skipped meal', 'dehydrated', 'exercise', 'sedentary', 'sitting', 'heat', 'cold', 'noise', 'messy', 'crowded', 'overload', 'multitask', 'lonely', 'isolated', 'financial', 'money', 'debt', 'job', 'moving', 'breakup'];

    // Find matched keywords for each category
    const matchedAttachment = attachmentKeywords.filter(kw => lower.includes(kw));
    const matchedEnneagram = enneagramKeywords.filter(kw => lower.includes(kw));
    const matchedMBTI = mbtiKeywords.filter(kw => lower.includes(kw));
    const matchedErikson = eriksonKeywords.filter(kw => lower.includes(kw));
    const matchedGestalt = gestaltKeywords.filter(kw => lower.includes(kw));
    const matchedBioPsych = bioPsychKeywords.filter(kw => lower.includes(kw));

    return {
      flags: {
        hasAttachment: matchedAttachment.length > 0,
        hasEnneagram: matchedEnneagram.length > 0,
        hasMBTI: matchedMBTI.length > 0,
        hasErikson: matchedErikson.length > 0,
        hasGestalt: matchedGestalt.length > 0,
        hasBioPsych: matchedBioPsych.length > 0,
      },
      matchedKeywords: {
        attachment: matchedAttachment,
        enneagram: matchedEnneagram,
        mbti: matchedMBTI,
        erikson: matchedErikson,
        gestalt: matchedGestalt,
        bioPsych: matchedBioPsych,
      },
    };
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
    // Extract plain_english_insight from each framework (generated by framework LLM)
    const frameworkInsights: string[] = [];
    const p = profile as any; // Cast to any to access plain_english_insight
    
    if (p.bigFive?.plain_english_insight) {
      frameworkInsights.push(`[BigFive Personality]: ${p.bigFive.plain_english_insight}`);
    }
    
    if (p.dass?.plain_english_insight) {
      frameworkInsights.push(`[DASS Emotional State]: ${p.dass.plain_english_insight}`);
    }
    
    if (p.rse?.plain_english_insight) {
      frameworkInsights.push(`[RSE Self-Esteem]: ${p.rse.plain_english_insight}`);
    }
    
    if (p.crt?.plain_english_insight) {
      frameworkInsights.push(`[CRT Thinking Style]: ${p.crt.plain_english_insight}`);
    }
    
    if (p.darkTriad?.plain_english_insight) {
      frameworkInsights.push(`[Dark Triad]: ${p.darkTriad.plain_english_insight}`);
    }
    
    if (p.attachment?.plain_english_insight) {
      frameworkInsights.push(`[Attachment]: ${p.attachment.plain_english_insight}`);
    }
    
    if (p.enneagram?.plain_english_insight) {
      frameworkInsights.push(`[Enneagram]: ${p.enneagram.plain_english_insight}`);
    }

    const system = `You are the Synthesis LLM. Your job is to combine the plain English insights from each psychological framework into ONE unified summary.

FRAMEWORK INSIGHTS (each generated by a specialized LLM):
${frameworkInsights.length > 0 ? frameworkInsights.join('\n') : '(No framework insights available)'}

USER'S MESSAGE: "${message}"

YOUR TASK:
Combine the framework insights above into a coherent psychological profile summary. Do NOT re-analyze the message - just synthesize what the frameworks already found.

CONFLICT RESOLUTION:
If frameworks seem to contradict each other, reason through it:
- Could both be true in different contexts? (e.g., anxious about work but confident socially)
- Is one more specific than the other? (trust the more specific one)
- Does one explain the other? (e.g., low self-esteem CAUSING anxiety - both true, related)
- If truly contradictory, which insight has stronger/clearer language?
Put your reasoning in the "conflict_resolution" field.

Output JSON only:
{
  "summary": "2-3 sentences combining all the framework insights into a unified psychological picture",
  "key_signals": ["main psychological signals from the insights"],
  "conflicts": ["any contradictory findings between frameworks - or empty if none"],
  "conflict_resolution": "If conflicts exist, explain which to trust and WHY. If no conflicts, say 'No conflicts - findings are consistent or complementary'",
  "risks": ["psychological risks mentioned in insights"],
  "strengths": ["positive traits/resources mentioned"],
  "focus_for_reply": ["what the AI response should emphasize based on insights"],
  "evidence_refs": ["key phrases from user message that triggered insights"]
}`;

    const contextObj = {
      user_message: message,
      framework_insights: frameworkInsights,
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

      // ALL messages go through the intelligent router (except obvious greetings handled above)
      // The intelligent router decides which frameworks to run based on understanding, not keywords
      let classification: any;
      classification = await this.classifyMessage(message, history, selectedLLM, sessionId, userId);

      // Safety override: If local check found crisis, ensure it's flagged
      if (safety.flag === 'risk') {
        classification.hasCrisisIndicators = true;
        classification.urgency = 'critical';
      }

      // Check if any indicators found (including ALL frameworks - core AND extended)
      const hasAnyIndicators =
        classification.hasCrisisIndicators ||
        classification.hasEmotionalContent ||
        classification.hasSelfWorthContent ||
        classification.hasDarkTriadIndicators ||
        classification.hasPersonalityIndicators ||
        classification.hasCognitiveIndicators ||
        // Extended frameworks - MUST be checked or they won't be called!
        classification.hasAttachment ||
        classification.hasEnneagram ||
        classification.hasMBTI ||
        classification.hasErikson ||
        classification.hasGestalt ||
        classification.hasBioPsych;

      if (!hasAnyIndicators) {
        // No indicators → Return cached profile (if any)
        return this.sessionCache.get(sessionId) || null;
      }

      // Build list of matched frameworks ONLY from what the router LLM returned
      // NO additional keyword detection - trust the intelligent router's decision
      const matchedFrameworks: string[] = [];

      // Core frameworks (from router classification)
      if (classification.hasPersonalityIndicators) matchedFrameworks.push('bigFive');
      if (classification.hasDarkTriadIndicators) matchedFrameworks.push('darkTriad');
      if (classification.hasEmotionalContent || classification.hasCrisisIndicators) matchedFrameworks.push('dass');
      if (classification.hasSelfWorthContent) matchedFrameworks.push('rse');
      if (classification.hasCognitiveIndicators) matchedFrameworks.push('crt');
      
      // Extended frameworks (from router classification ONLY - no keyword override)
      if (classification.hasAttachment) matchedFrameworks.push('attachment');
      if (classification.hasEnneagram) matchedFrameworks.push('enneagram');
      if (classification.hasMBTI) matchedFrameworks.push('mbti');
      if (classification.hasErikson) matchedFrameworks.push('erikson');
      if (classification.hasGestalt) matchedFrameworks.push('gestalt');
      if (classification.hasBioPsych) matchedFrameworks.push('bioPsych');

      // Deduplicate (in case of any overlap)
      const selectedFrameworks = [...new Set(matchedFrameworks)];

      console.log(`🎯 [Framework] Running ${selectedFrameworks.length} frameworks: ${selectedFrameworks.join(', ')}`);

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
        if (result) {
          newProfile[type] = result;
        }
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
    const result = this.quickKeywordCheckWithMatches(message);
    return result.flags;
  }

  /**
   * Quick keyword check that also returns the actual keywords that matched
   * Used by debug endpoint to show exactly which words triggered each category
   */
  private quickKeywordCheckWithMatches(message: string): {
    flags: Partial<Classification>;
    matchedKeywords: {
      crisis: string[];
      personality: string[];
      emotional: string[];
      selfWorth: string[];
      darkTriad: string[];
      cognitive: string[];
    };
  } {
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
    const matchedCrisis = crisisKeywords.filter((kw) => lower.includes(kw));
    const hasCrisisIndicators = matchedCrisis.length > 0;

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
    const matchedPersonality = personalityKeywords.filter((kw) => lower.includes(kw));
    const hasPersonalityIndicators = matchedPersonality.length > 0;

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
    const matchedEmotional = emotionalKeywords.filter((kw) => lower.includes(kw));
    const hasEmotionalContent = matchedEmotional.length > 0;

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
    const matchedSelfWorth = selfWorthKeywords.filter((kw) => lower.includes(kw));
    const hasSelfWorthContent = matchedSelfWorth.length > 0;

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
    const matchedDarkTriad = darkTriadKeywords.filter((kw) => lower.includes(kw));
    const hasDarkTriadIndicators = matchedDarkTriad.length > 0;

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
    const matchedCognitive = cognitiveKeywords.filter((kw) => lower.includes(kw));
    const hasCognitiveIndicators = matchedCognitive.length > 0;

    return {
      flags: {
        hasCrisisIndicators,
        hasPersonalityIndicators,
        hasEmotionalContent,
        hasSelfWorthContent,
        hasDarkTriadIndicators,
        hasCognitiveIndicators,
      },
      matchedKeywords: {
        crisis: matchedCrisis,
        personality: matchedPersonality,
        emotional: matchedEmotional,
        selfWorth: matchedSelfWorth,
        darkTriad: matchedDarkTriad,
        cognitive: matchedCognitive,
      },
    };
  }

  /**
   * Classify message using INTELLIGENT ROUTER - LLM for all messages except obvious no-signal
   * This is the production router that uses human-like understanding
   */
  private async classifyMessage(
    message: string,
    history: any[],
    selectedLLM: string,
    sessionId: string,
    userId?: string,
  ): Promise<Classification> {
    const trimmedMessage = message.trim();

    // =======================================================================
    // STAGE 1: Check for OBVIOUSLY non-psychological messages (saves LLM call)
    // =======================================================================
    const isObviouslyNoSignal = OBVIOUS_NO_SIGNAL_PATTERNS.some(pattern => pattern.test(trimmedMessage));
    
    if (isObviouslyNoSignal) {
      console.log('[ROUTER] Message is obviously non-psychological - skipping LLM');
      return {
        hasCrisisIndicators: false,
        hasEmotionalContent: false,
        hasSelfWorthContent: false,
        hasDarkTriadIndicators: false,
        hasPersonalityIndicators: false,
        hasCognitiveIndicators: false,
        urgency: 'low',
      };
    }

    // =======================================================================
    // STAGE 2: Use Intelligent LLM Router for everything else
    // =======================================================================
    console.log('[ROUTER] Using intelligent LLM router for psychological signal detection');

    try {
      // Build context from recent history
      const recentContext = history.slice(-3).map(m => m.content).join(' | ') || 'No previous context';

      // Build the full prompt with the message and context
      const llmPrompt = PSYCHOLOGICAL_SIGNAL_ROUTER + `

---

**NOW ANALYZE THIS MESSAGE:**

Message: "${message}"
Recent context: "${recentContext}"

Respond with JSON only:`;

      const { response } = await this.callLLMWithTokenTracking(
        userId,
        sessionId,
        'gpt-4o-mini', // Always use 4o-mini for router (fast + cheap + smart enough)
        [{ role: 'user', content: llmPrompt }],
        { temperature: 0.0, max_tokens: 500 },
        'classification',
        null,
      );

      const llmResult = this.parseJsonSafe(response.content, {
        hasSignal: true,
        confidence: 'low',
        frameworks: ['bigFive', 'dass'],
        signalType: 'parse error fallback',
      });

      console.log('[ROUTER] LLM Result:', JSON.stringify(llmResult, null, 2));

      // Map the intelligent router's framework array to the old boolean flags
      // IMPORTANT: Each flag should map to ONLY its own framework, no cross-contamination
      const frameworks = llmResult.frameworks || [];
      const signalType = (llmResult.signalType || '').toLowerCase();
      
      return {
        hasCrisisIndicators: frameworks.includes('crisis') || signalType.includes('crisis'),
        hasEmotionalContent: frameworks.includes('dass'),  // FIXED: Only DASS, not bigFive
        hasSelfWorthContent: frameworks.includes('rse'),
        hasDarkTriadIndicators: frameworks.includes('darkTriad'),
        hasPersonalityIndicators: frameworks.includes('bigFive'),
        hasCognitiveIndicators: frameworks.includes('crt'),
        hasAttachment: frameworks.includes('attachment'),
        hasEnneagram: frameworks.includes('enneagram'),
        hasMBTI: frameworks.includes('mbti'),
        hasErikson: frameworks.includes('erikson'),
        hasGestalt: frameworks.includes('gestalt'),
        hasBioPsych: frameworks.includes('bioPsych'),
        urgency: this.determineUrgency(llmResult, frameworks),
      };
    } catch (error) {
      console.error('[ROUTER] Error in intelligent classification:', error);
      // On error, be conservative - run only DASS (basic emotional check)
      return {
        hasCrisisIndicators: false,
        hasEmotionalContent: true, // Only DASS
        hasSelfWorthContent: false,
        hasDarkTriadIndicators: false,
        hasPersonalityIndicators: false, // Don't force BigFive
        hasCognitiveIndicators: false,
        hasAttachment: false,
        hasEnneagram: false,
        hasMBTI: false,
        hasErikson: false,
        hasGestalt: false,
        hasBioPsych: false,
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
  "plain_english_insight": "One sentence summarizing personality findings, e.g. 'This person shows high anxiety/neuroticism when discussing business decisions, suggesting emotional sensitivity to uncertainty'"
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

Analyze for Depression, Anxiety, and Stress ONLY. Return JSON:

CRITICAL DISTINCTIONS:
- DEPRESSION = sadness, hopelessness, emptiness, "nothing matters", loss of interest in life
- NOT DEPRESSION = self-doubt, "not good enough", low confidence, fear of failure (these are SELF-ESTEEM issues, not depression)
- ANXIETY = fear, worry, nervousness, tension, dread about future
- STRESS = overwhelmed, pressured, can't relax, too much to do

If message shows self-doubt about ability (like "I'm not good enough"), mark depression as "normal" - that's a self-esteem issue, NOT depression.

{
  "depression": "normal/mild/moderate/severe/extremely_severe",
  "anxiety": "normal/mild/moderate/severe/extremely_severe", 
  "stress": "normal/mild/moderate/severe/extremely_severe",
  "concerns": ["concern 1", "concern 2"],
  "requiresCrisisResponse": true/false,
  "plain_english_insight": "One sentence summarizing emotional state"
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
  "indicators": ["indicator 1", "indicator 2"],
  "plain_english_insight": "One sentence about self-worth, e.g. 'This person shows moderate self-esteem but expresses doubt about their ability to succeed in business'"
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
  "plain_english_insight": "One sentence about manipulation/ego traits, e.g. 'No concerning Dark Triad indicators detected in this message'"
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
  "plain_english_insight": "One sentence about decision-making style, e.g. 'This person tends to trust gut feelings over analytical thinking when making decisions'"
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
      const enhancedPrompt = `${sys}

IMPORTANT ADDITION: After your analysis, add a "plain_english_insight" field with ONE sentence summarizing the attachment pattern detected.
Example: "plain_english_insight": "This person shows anxious attachment patterns - seeking reassurance and fearing abandonment in relationships."`;

      const { response: res } = await this.callLLMWithTokenTracking(
        userId,
        sessionId,
        selectedLLM,
        [
          { role: 'system', content: enhancedPrompt },
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
      // Generate plain_english_insight if LLM didn't include it
      if (!parsed.plain_english_insight && parsed.Attachment_Style) {
        parsed.plain_english_insight = `This person shows ${parsed.Attachment_Style} attachment patterns${parsed.Key_Indicators ? ` (indicators: ${parsed.Key_Indicators.slice(0,2).join(', ')})` : ''}.`;
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
      // Add instruction for plain_english_insight
      const enhancedPrompt = `${sys}

IMPORTANT ADDITION: After your analysis, add a "plain_english_insight" field with ONE sentence summarizing what this reveals about the person's core motivation.
Example: "plain_english_insight": "This person appears driven by Type 3 achiever motivation - they fear being seen as worthless and are anxious about success in their new venture."`;

      const { response: res } = await this.callLLMWithTokenTracking(
        userId,
        sessionId,
        selectedLLM,
        [
          { role: 'system', content: enhancedPrompt },
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
      // Generate plain_english_insight if LLM didn't include it
      if (!parsed.plain_english_insight && parsed.Primary_Type) {
        parsed.plain_english_insight = `This person shows Type ${parsed.Primary_Type} patterns${parsed.Core_Motivation ? ` (motivated by ${parsed.Core_Motivation})` : ''}${parsed.Core_Fear ? ` with underlying fear of ${parsed.Core_Fear}` : ''}.`;
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
            content: `Message: "${message}"\n\nAnalyze for MBTI type. Return JSON only:\n{"EI": "I/E/unknown", "SN": "S/N/unknown", "TF": "T/F/unknown", "JP": "J/P/unknown", "Confidence": {"EI": 0.7}, "Evidence": ["quote here"], "plain_english_insight": "One sentence summary of MBTI indicators detected"}`,
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
      // Generate plain_english_insight if LLM didn't include it
      if (!parsed.plain_english_insight) {
        const mbtiType = `${parsed.EI || '?'}${parsed.SN || '?'}${parsed.TF || '?'}${parsed.JP || '?'}`;
        parsed.plain_english_insight = `MBTI indicators suggest ${mbtiType !== '????' ? mbtiType : 'incomplete data'} tendencies${parsed.Evidence?.length ? ` based on: ${parsed.Evidence[0]}` : ''}.`;
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
      const enhancedPrompt = `${sys}

IMPORTANT ADDITION: After your analysis, add a "plain_english_insight" field with ONE sentence summarizing the developmental stage or life challenge detected.
Example: "plain_english_insight": "This person appears to be navigating the Identity vs. Role Confusion stage, questioning who they are in this new business venture."`;

      const { response: res } = await this.callLLMWithTokenTracking(
        userId,
        sessionId,
        selectedLLM,
        [
          { role: 'system', content: enhancedPrompt },
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
      // Generate plain_english_insight if LLM didn't include it
      if (!parsed.plain_english_insight && parsed.Stage) {
        parsed.plain_english_insight = `This person is navigating ${parsed.Stage}${parsed.Conflict ? ` (${parsed.Conflict})` : ''}.`;
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
      const enhancedPrompt = `${sys}

IMPORTANT ADDITION: After your analysis, add a "plain_english_insight" field with ONE sentence summarizing the awareness or unfinished business detected.
Example: "plain_english_insight": "This person shows incomplete awareness - they feel the anxiety but haven't connected it to their underlying fear of failure."`;

      const { response: res } = await this.callLLMWithTokenTracking(
        userId,
        sessionId,
        selectedLLM,
        [
          { role: 'system', content: enhancedPrompt },
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
      // Generate plain_english_insight if LLM didn't include it
      if (!parsed.plain_english_insight && (parsed.Awareness_Level || parsed.Unfinished_Business)) {
        parsed.plain_english_insight = `Gestalt analysis: ${parsed.Awareness_Level ? `Awareness level is ${parsed.Awareness_Level}` : ''}${parsed.Unfinished_Business ? `. Unfinished business: ${parsed.Unfinished_Business}` : ''}.`;
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
            content: `Message: "${message}"\n\nAnalyze for biological/lifestyle factors. Return JSON only:\n{"Possible_Factors": ["Sleep", "Nutrition", "Exercise", etc.], "Confidence_By_Factor": {"Sleep": 0.7}, "Evidence": ["quote here"], "Notes": "", "plain_english_insight": "One sentence about biological/lifestyle factors that might be contributing"}`,
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
      // Generate plain_english_insight if LLM didn't include it
      if (!parsed.plain_english_insight && parsed.Possible_Factors?.length) {
        parsed.plain_english_insight = `Biological factors to consider: ${parsed.Possible_Factors.join(', ')}${parsed.Notes ? `. ${parsed.Notes}` : ''}.`;
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

  /**
   * DEBUG: Intelligent Router - Classify message using LLM for psychological signal detection
   * Uses a human-like approach to detect ANY psychological information in messages
   */
  async classifyMessageWithDebug(
    message: string,
    history: any[],
    selectedLLM: string,
    sessionId: string,
    userId?: string,
  ): Promise<{
    classification: any;
    meta: {
      method: 'obvious_no_signal' | 'intelligent_llm_router';
      tokenCount: number;
      llmUsed: boolean;
      llmModel?: string;
      llmPrompt?: string;
      llmResponse?: string;
      llmParsed?: any;
      reasoning: string;
      confidence?: string;
      signalType?: string;
      frameworksSelected?: string[];
    };
  }> {
    const tokenApprox = message.trim().split(/\s+/).filter(Boolean).length;
    const trimmedMessage = message.trim();

    // =======================================================================
    // STAGE 1: Check for OBVIOUSLY non-psychological messages (saves LLM call)
    // =======================================================================
    const isObviouslyNoSignal = OBVIOUS_NO_SIGNAL_PATTERNS.some(pattern => pattern.test(trimmedMessage));
    
    if (isObviouslyNoSignal) {
      console.log('[ROUTER] Message is obviously non-psychological - skipping LLM');
      
      // Return empty classification - no frameworks will run
      const classification = {
        hasCrisisIndicators: false,
        hasEmotionalContent: false,
        hasSelfWorthContent: false,
        hasDarkTriadIndicators: false,
        hasPersonalityIndicators: false,
        hasCognitiveIndicators: false,
        hasAttachment: false,
        hasEnneagram: false,
        hasMBTI: false,
        hasErikson: false,
        hasGestalt: false,
        hasBioPsych: false,
        urgency: 'low' as const,
        hasSignal: false,
      };

      return {
        classification,
        meta: {
          method: 'obvious_no_signal',
          tokenCount: tokenApprox,
          llmUsed: false,
          confidence: 'high',
          signalType: 'no psychological content - pure greeting/acknowledgment',
          frameworksSelected: [],
          reasoning: `🚫 OBVIOUS NO-SIGNAL DETECTED

The message "${trimmedMessage}" matches a known pattern for messages with zero psychological content:
• Pure greetings (hi, hello, hey)
• Simple acknowledgments (ok, thanks, got it)
• Factual questions (what time is it)
• Basic farewells (bye, goodbye)

No LLM call needed - these messages contain no information about the person's psychology.
No frameworks will be triggered.`,
        },
      };
    }

    // =======================================================================
    // STAGE 2: Use Intelligent LLM Router for everything else
    // =======================================================================
    console.log('[ROUTER] Using intelligent LLM router for psychological signal detection');

    // Build context from recent history
    const recentContext = history.slice(-3).map(m => m.content).join(' | ') || 'No previous context';

    // Build the full prompt with the message and context
    const llmPrompt = PSYCHOLOGICAL_SIGNAL_ROUTER + `

---

**NOW ANALYZE THIS MESSAGE:**

Message: "${message}"
Recent context: "${recentContext}"

Respond with JSON only:`;

    try {
      const { response } = await this.callLLMWithTokenTracking(
        userId,
        sessionId,
        'gpt-4o-mini', // Always use 4o-mini for router (fast + cheap + smart enough)
        [{ role: 'user', content: llmPrompt }],
        { temperature: 0.0, max_tokens: 500 },
        'classification',
        null,
      );

      const llmResult = this.parseJsonSafe(response.content, {
        hasSignal: false,
        confidence: 'low',
        frameworks: [],
        signalType: 'parse error',
        reasoning: 'Could not parse LLM response'
      });

      console.log('[ROUTER] LLM Result:', JSON.stringify(llmResult, null, 2));

      // Map the intelligent router's framework array to the old boolean flags
      const frameworks = llmResult.frameworks || [];
      
      const classification = {
        // Signal detection
        hasSignal: llmResult.hasSignal || false,
        
        // Map frameworks to old boolean flags for backward compatibility
        // IMPORTANT: Each flag maps ONLY to its own framework - no cross-contamination
        hasCrisisIndicators: frameworks.includes('crisis') || llmResult.signalType?.toLowerCase().includes('crisis'),
        hasEmotionalContent: frameworks.includes('dass'),  // FIXED: Only DASS, not bigFive
        hasSelfWorthContent: frameworks.includes('rse'),
        hasDarkTriadIndicators: frameworks.includes('darkTriad'),
        hasPersonalityIndicators: frameworks.includes('bigFive'),
        hasCognitiveIndicators: frameworks.includes('crt'),
        hasAttachment: frameworks.includes('attachment'),
        hasEnneagram: frameworks.includes('enneagram'),
        hasMBTI: frameworks.includes('mbti'),
        hasErikson: frameworks.includes('erikson'),
        hasGestalt: frameworks.includes('gestalt'),
        hasBioPsych: frameworks.includes('bioPsych'),
        
        // Determine urgency based on signal type and frameworks
        urgency: this.determineUrgency(llmResult, frameworks),
      };

      // Build human-readable reasoning
      const frameworkExplanations: Record<string, string> = {
        bigFive: 'Personality traits detected (how they typically behave)',
        dass: 'Current emotional state detected (how they feel now)',
        rse: 'Self-worth content detected (how they value themselves)',
        crt: 'Thinking style detected (how they make decisions)',
        darkTriad: 'Manipulation/superiority patterns detected',
        attachment: 'Relationship patterns detected (how they connect)',
        enneagram: 'Core motivations/fears detected (what drives them)',
        erikson: 'Life stage challenges detected (identity/meaning)',
        gestalt: 'Awareness/avoidance patterns detected',
        bioPsych: 'Physical/environmental factors detected',
        mbti: 'Cognitive preferences detected',
      };

      const selectedFrameworkExplanations = frameworks
        .map(f => `• ${frameworkExplanations[f] || f}`)
        .join('\n');

      return {
        classification,
        meta: {
          method: 'intelligent_llm_router',
          tokenCount: tokenApprox,
          llmUsed: true,
          llmModel: 'gpt-4o-mini',
          llmPrompt,
          llmResponse: response.content,
          llmParsed: llmResult,
          confidence: llmResult.confidence || 'medium',
          signalType: llmResult.signalType || 'unknown',
          frameworksSelected: frameworks,
          reasoning: `🧠 INTELLIGENT ROUTER ANALYSIS

📊 Signal Detected: ${llmResult.hasSignal ? 'YES' : 'NO'}
🎯 Confidence: ${llmResult.confidence || 'medium'}
📝 Signal Type: "${llmResult.signalType || 'unknown'}"

${llmResult.hasSignal ? `🔬 Frameworks Selected (${frameworks.length}):
${selectedFrameworkExplanations || '(none)'}` : '⏭️ No frameworks will run - message has no psychological content'}

💭 LLM Reasoning: "${llmResult.reasoning || 'No reasoning provided'}"

---
The intelligent router reads the message like a human therapist would - looking for what the message reveals about the person's psychology, not just matching keywords.`,
        },
      };
    } catch (error) {
      console.error('[ROUTER] Error in intelligent classification:', error);
      
      // On error, be conservative - assume there might be signal
      return {
        classification: {
          hasSignal: true, // Assume signal on error to be safe
          hasCrisisIndicators: false,
          hasEmotionalContent: true, // Only DASS on error
          hasSelfWorthContent: false,
          hasDarkTriadIndicators: false,
          hasPersonalityIndicators: false, // Don't force BigFive
          hasCognitiveIndicators: false,
          hasAttachment: false,
          hasEnneagram: false,
          hasMBTI: false,
          hasErikson: false,
          hasGestalt: false,
          hasBioPsych: false,
          urgency: 'low' as const,
        },
        meta: {
          method: 'intelligent_llm_router',
          tokenCount: tokenApprox,
          llmUsed: true,
          llmModel: 'gpt-4o-mini',
          llmPrompt,
          confidence: 'low',
          signalType: 'error fallback',
          frameworksSelected: ['bigFive', 'dass'], // Run basic frameworks on error
          reasoning: `⚠️ ROUTER ERROR - FALLBACK MODE

Error: ${error.message}

Falling back to conservative classification:
• Assuming message may have signal
• Running basic frameworks (BigFive, DASS) to be safe
• This ensures we don't miss important psychological content`,
        },
      };
    }
  }

  /**
   * Helper to determine urgency based on LLM analysis
   */
  private determineUrgency(llmResult: any, frameworks: string[]): 'critical' | 'high' | 'medium' | 'low' {
    const signalType = (llmResult.signalType || '').toLowerCase();
    
    // Check for crisis indicators
    if (signalType.includes('crisis') || signalType.includes('suicide') || signalType.includes('self-harm')) {
      return 'critical';
    }
    
    // Check for high-urgency signals
    if (signalType.includes('distress') || signalType.includes('urgent') || frameworks.includes('darkTriad')) {
      return 'high';
    }
    
    // Check confidence level
    if (llmResult.confidence === 'high' && frameworks.length > 0) {
      return 'medium';
    }
    
    // Default to low
    return 'low';
  }
}

// New analyzers using KB system prompts (Attachment, Enneagram, MBTI, Erikson, Gestalt)
// Placed inside class above; ensure not outside class. (Note: Editor appended earlier class end; re-open class)
