import { Injectable } from '@nestjs/common';
import { QUOTIENTS_KNOWLEDGE_BASE, QuotientData } from '../knowledge-base/quotients.data';
import { ANALYSIS_PATTERNS, AnalysisPattern } from '../knowledge-base/analysis-patterns';
import { QuotientScore, PersonalityAnalysis } from '../dto/chat.dto';

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

@Injectable()
export class PersonalityAnalyzerService {
  private conversationHistory: Map<string, ConversationMessage[]> = new Map();

  /**
   * Analyzes user messages to assess their personality across different quotients
   */
  analyzePersonality(
    message: string,
    sessionId: string,
    conversationHistory: ConversationMessage[],
  ): PersonalityAnalysis {
    const allMessages = conversationHistory
      .filter((m) => m.role === 'user')
      .map((m) => m.content)
      .join(' ');

    const combinedText = `${allMessages} ${message}`.toLowerCase();

    const quotientScores: QuotientScore[] = [];

    // Analyze each quotient
    for (const quotient of QUOTIENTS_KNOWLEDGE_BASE) {
      const pattern = ANALYSIS_PATTERNS.find((p) => p.quotientId === quotient.id);
      if (!pattern) continue;

      const score = this.calculateQuotientScore(combinedText, message, pattern, quotient);
      quotientScores.push(score);
    }

    // Sort by score
    quotientScores.sort((a, b) => b.score - a.score);

    // Identify dominant quotients (top 3 with score > 40)
    const dominantQuotients = quotientScores.filter((q) => q.score > 40).slice(0, 3);

    // Identify quotients needing attention (bottom 3 with score < 30)
    const needsAttention = quotientScores
      .filter((q) => q.score < 30)
      .slice(-3)
      .reverse();

    const overallInsights = this.generateOverallInsights(
      dominantQuotients,
      needsAttention,
      quotientScores,
    );

    const conversationContext = this.extractConversationContext(message, conversationHistory);

    return {
      dominantQuotients,
      needsAttention,
      overallInsights,
      conversationContext,
    };
  }

  /**
   * Calculates a score for a specific quotient based on message analysis
   */
  private calculateQuotientScore(
    fullText: string,
    currentMessage: string,
    pattern: AnalysisPattern,
    quotient: QuotientData,
  ): QuotientScore {
    let score = 50; // Base score
    let confidence = 0.5;
    const indicators: string[] = [];

    const currentLower = currentMessage.toLowerCase();

    // Keyword matching (weight: 30%)
    let keywordMatches = 0;
    for (const keyword of pattern.keywords) {
      if (fullText.includes(keyword)) {
        keywordMatches++;
      }
    }
    const keywordScore = Math.min((keywordMatches / pattern.keywords.length) * 30, 30);
    score += keywordScore - 15; // Adjust around base

    // Sentiment indicator matching (weight: 25%)
    let sentimentMatches = 0;
    for (const sentiment of pattern.sentimentIndicators) {
      if (currentLower.includes(sentiment.toLowerCase())) {
        sentimentMatches++;
        indicators.push(`Expressed: "${sentiment}"`);
      }
    }
    if (sentimentMatches > 0) {
      score += 25;
      confidence += 0.2;
    }

    // Question pattern matching (weight: 20%)
    let questionMatches = 0;
    for (const questionPattern of pattern.questionPatterns) {
      if (currentLower.includes(questionPattern.toLowerCase())) {
        questionMatches++;
        indicators.push(`Asked about: ${questionPattern}`);
      }
    }
    if (questionMatches > 0) {
      score += 20;
      confidence += 0.15;
    }

    // Behavioral marker inference (weight: 25%)
    const behavioralScore = this.assessBehavioralMarkers(currentMessage, pattern.behavioralMarkers);
    score += behavioralScore;
    if (behavioralScore > 10) {
      confidence += 0.15;
      indicators.push('Behavioral patterns detected');
    }

    // Check for characteristics alignment
    const characteristicAlignment = this.checkCharacteristics(currentMessage, quotient);
    if (characteristicAlignment.isHigh) {
      score += 10;
      indicators.push(`Shows high ${quotient.name} traits`);
    } else if (characteristicAlignment.isLow) {
      score -= 15;
      indicators.push(`Shows low ${quotient.name} traits`);
    }

    // Normalize score to 0-100
    score = Math.max(0, Math.min(100, score));
    confidence = Math.max(0, Math.min(1, confidence));

    return {
      quotientId: quotient.id,
      quotientName: quotient.fullName,
      score: Math.round(score),
      confidence: Math.round(confidence * 100) / 100,
      indicators: indicators.slice(0, 3), // Top 3 indicators
    };
  }

  /**
   * Assesses behavioral markers in the message
   */
  private assessBehavioralMarkers(message: string, markers: string[]): number {
    let score = 0;
    const lowerMessage = message.toLowerCase();

    // Simple heuristic based on message characteristics
    if (message.includes('?')) score += 5; // Asking questions
    if (message.split(' ').length > 20) score += 5; // Detailed explanation
    if (message.match(/I feel|I think|I believe/i)) score += 5; // Self-reflection
    if (message.match(/how|why|what|when|where/i)) score += 5; // Inquisitive

    return Math.min(score, 25);
  }

  /**
   * Checks if message aligns with high or low characteristics
   */
  private checkCharacteristics(
    message: string,
    quotient: QuotientData,
  ): { isHigh: boolean; isLow: boolean } {
    const lowerMessage = message.toLowerCase();
    let highMatches = 0;
    let lowMatches = 0;

    // Check high characteristics
    for (const characteristic of quotient.characteristics.high) {
      const keywords = this.extractKeywords(characteristic);
      if (keywords.some((kw) => lowerMessage.includes(kw))) {
        highMatches++;
      }
    }

    // Check low characteristics
    for (const characteristic of quotient.characteristics.low) {
      const keywords = this.extractKeywords(characteristic);
      if (keywords.some((kw) => lowerMessage.includes(kw))) {
        lowMatches++;
      }
    }

    return {
      isHigh: highMatches > lowMatches && highMatches >= 2,
      isLow: lowMatches > highMatches && lowMatches >= 2,
    };
  }

  /**
   * Extracts keywords from a characteristic description
   */
  private extractKeywords(text: string): string[] {
    const words = text
      .toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .split(' ')
      .filter((w) => w.length > 4); // Only meaningful words
    return words;
  }

  /**
   * Generates overall insights from the analysis
   */
  private generateOverallInsights(
    dominant: QuotientScore[],
    needsAttention: QuotientScore[],
    allScores: QuotientScore[],
  ): string {
    const insights: string[] = [];

    if (dominant.length > 0) {
      const topQuotient = dominant[0];
      insights.push(
        `Your ${topQuotient.quotientName} appears to be a strength (score: ${topQuotient.score}).`,
      );
    }

    if (needsAttention.length > 0) {
      const lowestQuotient = needsAttention[needsAttention.length - 1];
      insights.push(
        `Your ${lowestQuotient.quotientName} may benefit from development (score: ${lowestQuotient.score}).`,
      );
    }

    // Check for balance
    const scores = allScores.map((s) => s.score);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance =
      scores.reduce((sum, score) => sum + Math.pow(score - avg, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev < 15) {
      insights.push('You show a balanced profile across different quotients.');
    } else if (stdDev > 25) {
      insights.push('You have a specialized profile with distinct strengths and areas for growth.');
    }

    return insights.join(' ');
  }

  /**
   * Extracts conversation context
   */
  private extractConversationContext(message: string, history: ConversationMessage[]): string {
    const recentMessages = history.slice(-3);
    const topics: string[] = [];

    // Extract main topics from recent conversation
    if (message.toLowerCase().includes('career')) topics.push('career');
    if (message.toLowerCase().includes('relationship')) topics.push('relationships');
    if (message.toLowerCase().includes('learn')) topics.push('learning');
    if (message.toLowerCase().includes('stress')) topics.push('stress management');
    if (message.toLowerCase().includes('goal')) topics.push('goal setting');

    if (topics.length > 0) {
      return `Currently discussing: ${topics.join(', ')}`;
    }

    return 'General conversation';
  }

  /**
   * Stores conversation history
   */
  addToHistory(sessionId: string, role: 'user' | 'assistant', content: string): void {
    if (!this.conversationHistory.has(sessionId)) {
      this.conversationHistory.set(sessionId, []);
    }

    const history = this.conversationHistory.get(sessionId)!;
    history.push({
      role,
      content,
      timestamp: new Date(),
    });

    // Keep only last 20 messages
    if (history.length > 20) {
      history.shift();
    }
  }

  /**
   * Gets conversation history
   */
  getHistory(sessionId: string): ConversationMessage[] {
    return this.conversationHistory.get(sessionId) || [];
  }

  /**
   * Clears conversation history
   */
  clearHistory(sessionId: string): void {
    this.conversationHistory.delete(sessionId);
  }
}
