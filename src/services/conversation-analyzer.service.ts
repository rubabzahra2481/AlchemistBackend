import { Injectable } from '@nestjs/common';

export interface ConversationInsights {
  recurringThemes: string[];
  behavioralPatterns: string[]; // NEW: Detect patterns like start-quit, procrastination, etc.
  emotionalProgression: string;
  hiddenConcerns: string[];
  conversationDepth: 'surface' | 'moderate' | 'deep';
  trustLevel: 'guarded' | 'opening' | 'trusting';
  recommendedApproach: string;
}

@Injectable()
export class ConversationAnalyzerService {
  /**
   * Analyzes conversation patterns across multiple messages
   */
  analyzeConversation(messages: Array<{ role: string; content: string }>): ConversationInsights {
    const userMessages = messages
      .filter((m) => m.role === 'user')
      .map((m) => m.content.toLowerCase());

    return {
      recurringThemes: this.findRecurringThemes(userMessages),
      behavioralPatterns: this.detectBehavioralPatterns(userMessages),
      emotionalProgression: this.trackEmotionalProgression(userMessages),
      hiddenConcerns: this.detectHiddenConcerns(userMessages),
      conversationDepth: this.assessDepth(userMessages),
      trustLevel: this.assessTrust(userMessages),
      recommendedApproach: this.determineApproach(userMessages),
    };
  }

  /**
   * Detect behavioral patterns across conversation (NEW - CRITICAL FIX)
   * This is the missing piece for understanding humans deeply
   */
  private detectBehavioralPatterns(messages: string[]): string[] {
    if (messages.length < 2) return [];

    const patterns: string[] = [];
    const fullText = messages.join(' ');

    // Pattern 1: Start-Quit Pattern (CRITICAL - was completely missing)
    const startQuitIndicators = [
      /start.*quit|quit.*after|gave up|stopped.*after/,
      /tried.*stop|began.*quit|abandon/,
      /couldn't.*finish|didn't.*complete|never.*finish/,
    ];
    const startQuitCount = startQuitIndicators.filter((pattern) => pattern.test(fullText)).length;

    // Also check for multiple specific examples (business, gym, guitar, etc.)
    const specificExamples = [
      /business|startup|company/,
      /gym|exercise|workout|fitness/,
      /guitar|piano|music|instrument/,
      /course|class|learning|study/,
      /hobby|project/,
    ].filter((pattern) => pattern.test(fullText));

    if (startQuitCount >= 2 || (startQuitCount >= 1 && specificExamples.length >= 2)) {
      patterns.push(
        'Start-Quit Pattern: Repeatedly starts things but struggles to complete them. This may indicate fear of failure, low self-efficacy, or underlying avoidance.',
      );
    }

    // Pattern 2: Procrastination / Avoidance
    const procrastinationCount = [
      /procrastinat/,
      /can't.*focus|unable.*concentrate/,
      /avoid|put.*off|delay/,
      /distract/,
    ].filter((pattern) => pattern.test(fullText)).length;

    if (procrastinationCount >= 2) {
      patterns.push(
        'Chronic Procrastination: Persistent difficulty with task initiation or focus. May stem from anxiety, perfectionism, or task aversion.',
      );
    }

    // Pattern 3: Self-Criticism / Low Self-Worth
    const selfCriticismCount = [
      /don't deserve|not good enough|everyone.*better/,
      /failure|useless|worthless/,
      /imposter|fraud|fake/,
      /should.*better|not.*smart/,
    ].filter((pattern) => pattern.test(fullText)).length;

    if (selfCriticismCount >= 2) {
      patterns.push(
        'Persistent Self-Criticism: Recurring negative self-evaluation. Indicates low self-esteem or imposter syndrome.',
      );
    }

    // Pattern 4: Feeling Trapped / Powerless
    const trappedCount = [
      /stuck|trapped|can't escape/,
      /no choice|no control|powerless/,
      /dead inside|numb|empty/,
      /robot|automaton|going through motions/,
    ].filter((pattern) => pattern.test(fullText)).length;

    if (trappedCount >= 2) {
      patterns.push('Feeling Trapped/Powerless: Sense of being stuck without control or agency.');
    }

    // Pattern 5: Decision Paralysis
    const indecisionCount = [
      /don't know.*do|can't decide|confused/,
      /too many.*options|overwhelmed.*choice/,
      /what if.*wrong|scared.*decide/,
    ].filter((pattern) => pattern.test(fullText)).length;

    if (indecisionCount >= 2) {
      patterns.push(
        'Decision Paralysis: Difficulty making decisions. May stem from perfectionism, fear of consequences, or information overload.',
      );
    }

    // Pattern 6: Seeking External Validation
    const validationCount = [
      /should I|is it okay|am I allowed/,
      /what.*think|do you think I/,
      /permission|approval/,
    ].filter((pattern) => pattern.test(fullText)).length;

    if (validationCount >= 2) {
      patterns.push(
        "Seeking External Validation: Relies heavily on others' opinions. May indicate low self-trust or people-pleasing tendencies.",
      );
    }

    return patterns;
  }

  /**
   * Find themes mentioned multiple times
   */
  private findRecurringThemes(messages: string[]): string[] {
    const themes: Map<string, number> = new Map();

    const themePatterns = {
      career: /career|job|work/,
      relationships: /relationship|friend|family|partner|people/,
      stress: /stress|overwhelm|pressure|burnout/,
      'self-worth': /failure|useless|not good|inadequate/,
      anxiety: /worry|anxious|nervous|scared/,
      depression: /sad|empty|hopeless|nothing.*matters/,
      direction: /stuck|lost|don't know|confused|purpose/,
    };

    for (const message of messages) {
      for (const [theme, pattern] of Object.entries(themePatterns)) {
        if (pattern.test(message)) {
          themes.set(theme, (themes.get(theme) || 0) + 1);
        }
      }
    }

    return Array.from(themes.entries())
      .filter(([_, count]) => count >= 2) // Mentioned at least twice
      .sort((a, b) => b[1] - a[1])
      .map(([theme]) => theme);
  }

  /**
   * Track if emotional state is improving, worsening, or stable
   */
  private trackEmotionalProgression(messages: string[]): string {
    if (messages.length < 2) return 'initial';

    const getEmotionalScore = (msg: string): number => {
      let score = 0;
      // Negative indicators
      if (msg.match(/hopeless|nothing.*matters|want.*die/)) score -= 3;
      if (msg.match(/failure|useless|can't/)) score -= 2;
      if (msg.match(/stress|worry|anxious/)) score -= 1;
      // Positive indicators
      if (msg.match(/better|hope|try|want.*to/)) score += 1;
      if (msg.match(/thank|help|understand/)) score += 2;
      return score;
    };

    const firstScore = getEmotionalScore(messages[0]);
    const lastScore = getEmotionalScore(messages[messages.length - 1]);

    if (lastScore > firstScore + 1) return 'improving';
    if (lastScore < firstScore - 1) return 'worsening';
    return 'stable';
  }

  /**
   * Detect concerns they haven't stated directly
   */
  private detectHiddenConcerns(messages: string[]): string[] {
    const concerns: string[] = [];
    const fullText = messages.join(' ');

    // Minimization patterns ("just", "not a big deal")
    const minimizationMatches = fullText.match(/(just|only|not.*big.*deal|it's fine)/g);
    if (minimizationMatches && minimizationMatches.length >= 2) {
      concerns.push('minimizing their problems');
    }

    // Seeking permission patterns
    if (fullText.match(/should I|is it okay|am I allowed|would it be/)) {
      concerns.push('seeking external validation');
    }

    // Perfection/control patterns
    const perfectionMatches = fullText.match(/perfect|exactly|must|always|never/g);
    if (perfectionMatches && perfectionMatches.length >= 2) {
      concerns.push('perfectionism or rigid thinking');
    }

    // Comparison patterns
    if (fullText.match(/everyone else|other people|compared to|better than/)) {
      concerns.push('comparing self to others');
    }

    // Avoidance patterns
    if (fullText.match(/avoid|escape|run away|can't face/)) {
      concerns.push('avoidance behavior');
    }

    return concerns;
  }

  /**
   * Assess conversation depth
   */
  private assessDepth(messages: string[]): 'surface' | 'moderate' | 'deep' {
    if (messages.length === 0) return 'surface';

    const fullText = messages.join(' ');
    const wordCount = fullText.split(/\s+/).length;
    const avgLength = wordCount / messages.length;

    // Check for vulnerability indicators
    const vulnerabilityMarkers = [
      /I feel/,
      /I'm scared/,
      /I don't know/,
      /help me/,
      /I can't/,
    ].filter((pattern) => pattern.test(fullText)).length;

    if (avgLength > 30 && vulnerabilityMarkers >= 3) return 'deep';
    if (avgLength > 15 && vulnerabilityMarkers >= 1) return 'moderate';
    return 'surface';
  }

  /**
   * Assess trust level based on vulnerability
   */
  private assessTrust(messages: string[]): 'guarded' | 'opening' | 'trusting' {
    if (messages.length === 0) return 'guarded';

    const fullText = messages.join(' ');

    // Guarded indicators
    if (fullText.match(/I'm fine|not a big deal|don't worry/)) return 'guarded';

    // Trusting indicators
    const trustMarkers = [
      /I feel/,
      /I'm scared/,
      /I struggle/,
      /I don't know/,
      /please help/,
    ].filter((pattern) => pattern.test(fullText)).length;

    if (trustMarkers >= 3) return 'trusting';
    if (trustMarkers >= 1) return 'opening';
    return 'guarded';
  }

  /**
   * Determine best approach based on patterns
   */
  private determineApproach(messages: string[]): string {
    const fullText = messages.join(' ');
    const approaches: string[] = [];

    if (fullText.match(/failure|useless|not good/)) {
      approaches.push('validate first, then build confidence');
    }
    if (fullText.match(/anxious|worry|nervous/)) {
      approaches.push('calm and reassuring tone');
    }
    if (fullText.match(/stuck|don't know|confused/)) {
      approaches.push('ask clarifying questions');
    }
    if (fullText.match(/fine|not a big deal/)) {
      approaches.push('gently challenge minimization');
    }

    return approaches.length > 0 ? approaches.join('; ') : 'empathetic and exploratory';
  }
}
