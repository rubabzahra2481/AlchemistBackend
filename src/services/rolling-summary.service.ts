import { Injectable } from '@nestjs/common';
import { LLMOrchestratorService } from './llm-orchestrator.service';

interface RollingSummaryCache {
  summary: string;
  lastMessageCount: number;
  lastUpdated: Date;
}

@Injectable()
export class RollingSummaryService {
  private summaryCache: Map<string, RollingSummaryCache> = new Map();
  
  // Configuration
  private readonly SUMMARY_TRIGGER_COUNT = 10; // Generate summary every N messages
  private readonly RECENT_MESSAGES_TO_KEEP = 10; // Keep last N messages in full
  private readonly SUMMARY_MODEL = 'gpt-4o-mini'; // Cheap model for summaries
  private readonly MAX_SUMMARY_TOKENS = 300; // Keep summaries concise

  constructor(private readonly llmOrchestrator: LLMOrchestratorService) {}

  /**
   * Get optimized history for LLM calls
   * Returns: rolling summary + recent messages (instead of full history)
   */
  async getOptimizedHistory(
    sessionId: string,
    fullHistory: any[],
    tier: string = 'free',
  ): Promise<{ summary: string | null; recentMessages: any[] }> {
    const historyLength = fullHistory.length;
    
    // Get tier-based limits
    const limits = this.getTierLimits(tier);
    
    // If history is short, no need for summary
    if (historyLength <= limits.recentMessagesToKeep) {
      return {
        summary: null,
        recentMessages: fullHistory,
      };
    }

    // Check if we need to update the summary
    const cached = this.summaryCache.get(sessionId);
    const needsUpdate = !cached || 
      (historyLength - cached.lastMessageCount >= this.SUMMARY_TRIGGER_COUNT);

    if (needsUpdate) {
      // Messages to summarize (everything except recent ones)
      const messagesToSummarize = fullHistory.slice(0, -limits.recentMessagesToKeep);
      
      if (messagesToSummarize.length > 0) {
        const summary = await this.generateSummary(messagesToSummarize, cached?.summary);
        
        this.summaryCache.set(sessionId, {
          summary,
          lastMessageCount: historyLength,
          lastUpdated: new Date(),
        });

        console.log(`📝 [RollingSummary] Updated summary for session ${sessionId}`);
        console.log(`   - Summarized ${messagesToSummarize.length} old messages`);
        console.log(`   - Keeping ${limits.recentMessagesToKeep} recent messages`);
      }
    }

    // Return summary + recent messages
    const currentCache = this.summaryCache.get(sessionId);
    return {
      summary: currentCache?.summary || null,
      recentMessages: fullHistory.slice(-limits.recentMessagesToKeep),
    };
  }

  /**
   * Generate a summary of conversation history
   */
  private async generateSummary(
    messages: any[],
    existingSummary?: string,
  ): Promise<string> {
    try {
      // Format messages for summarization
      const conversationText = messages
        .map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`)
        .join('\n');

      const systemPrompt = `You are a conversation summarizer. Create a concise summary that captures:
1. Key topics discussed
2. Important user concerns/emotions
3. Any decisions or conclusions reached
4. User's personality traits or patterns observed

Keep it under 200 words. Focus on what would help an AI continue this conversation naturally.

${existingSummary ? `Previous summary to incorporate:\n${existingSummary}` : ''}`;

      const response = await this.llmOrchestrator.generateResponse(
        this.SUMMARY_MODEL,
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Summarize this conversation:\n\n${conversationText}` },
        ],
        { 
          temperature: 0.3, 
          max_tokens: this.MAX_SUMMARY_TOKENS 
        },
      );

      return response.content || 'No summary generated';
    } catch (error) {
      console.error('[RollingSummary] Error generating summary:', error);
      return existingSummary || 'Unable to generate summary';
    }
  }

  /**
   * Get tier-based history limits
   */
  private getTierLimits(tier: string): { 
    recentMessagesToKeep: number; 
    maxHistoryTokens: number;
  } {
    const tierLimits: Record<string, { recentMessagesToKeep: number; maxHistoryTokens: number }> = {
      free: { recentMessagesToKeep: 6, maxHistoryTokens: 1500 },
      basic: { recentMessagesToKeep: 10, maxHistoryTokens: 4000 },
      standard: { recentMessagesToKeep: 20, maxHistoryTokens: 12000 },
      pro: { recentMessagesToKeep: 40, maxHistoryTokens: 32000 },
      elite: { recentMessagesToKeep: 100, maxHistoryTokens: 96000 },
    };

    return tierLimits[tier.toLowerCase()] || tierLimits.free;
  }

  /**
   * Build messages array for LLM with rolling summary
   */
  buildMessagesWithSummary(
    systemPrompt: string,
    summary: string | null,
    recentMessages: any[],
    currentUserMessage: string,
  ): any[] {
    const messages: any[] = [
      { role: 'system', content: systemPrompt },
    ];

    // Add rolling summary as context if available
    if (summary) {
      messages.push({
        role: 'system',
        content: `[CONVERSATION CONTEXT - Summary of earlier messages]\n${summary}\n[END CONTEXT]`,
      });
    }

    // Add recent messages in full
    messages.push(
      ...recentMessages.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
    );

    // Add current user message
    messages.push({
      role: 'user',
      content: currentUserMessage,
    });

    return messages;
  }

  /**
   * Clear summary cache for a session (e.g., when starting new chat)
   */
  clearSessionSummary(sessionId: string): void {
    this.summaryCache.delete(sessionId);
    console.log(`🗑️ [RollingSummary] Cleared summary for session ${sessionId}`);
  }

  /**
   * Clear all cached summaries
   */
  clearAllSummaries(): void {
    this.summaryCache.clear();
    console.log(`🗑️ [RollingSummary] Cleared all summaries`);
  }

  /**
   * Get summary stats for debugging
   */
  getStats(): { totalSessions: number; sessions: string[] } {
    return {
      totalSessions: this.summaryCache.size,
      sessions: Array.from(this.summaryCache.keys()),
    };
  }
}
