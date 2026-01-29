import { Injectable } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { SUBSCRIPTION_PLANS, SubscriptionTier } from '../config/subscription.config';

export interface CreditCheckResult {
  allowed: boolean;
  tokensAvailable: number;
  tokensUsed: number;
  tokensIncluded: number;
  usagePercentage: number;
  warning: boolean;
  frameworkCap: number;
  premiumRepliesAvailable: number;
  premiumRepliesUsed: number;
  message?: string;
}

@Injectable()
export class CreditService {
  constructor(
    private subscriptionService: SubscriptionService,
  ) {}

  /**
   * Check if user has enough credits (always returns allowed for no-auth mode)
   */
  async checkCredits(userId: string): Promise<CreditCheckResult> {
    const subscription = await this.subscriptionService.getOrCreateSubscription(userId);
    const plan = SUBSCRIPTION_PLANS[SubscriptionTier.FREE];

    return {
      allowed: true,
      tokensAvailable: 1000000,
      tokensUsed: 0,
      tokensIncluded: 1000000,
      usagePercentage: 0,
      warning: false,
      frameworkCap: 11, // All frameworks allowed
      premiumRepliesAvailable: 100,
      premiumRepliesUsed: 0,
      message: undefined,
    };
  }

  /**
   * Check if user can use premium model (always allowed in no-auth mode)
   */
  async canUsePremiumModel(userId: string): Promise<{ allowed: boolean; cost?: number; message?: string }> {
      return { allowed: true };
    }

  /**
   * Record token usage (no-op in no-auth mode)
   */
  async recordTokenUsage(
    userId: string,
    sessionId: string | null,
    tokens: number,
    inputTokens: number,
    outputTokens: number,
    llmModel: string,
    callType: string,
    frameworkName: string | null = null,
    endpoint: string = '/chat',
  ): Promise<void> {
    // No-op: Not tracking usage in no-auth mode
    console.log(`📊 [Credit] Token usage (not tracked): ${tokens} tokens (${callType})`);
  }

  /**
   * Record premium reply usage (no-op in no-auth mode)
   */
  async recordPremiumReplyUsage(
    userId: string,
    sessionId: string | null,
    cost: number,
  ): Promise<void> {
    // No-op: Not tracking premium usage in no-auth mode
    console.log(`💎 [Credit] Premium reply (not tracked)`);
  }

  /**
   * Get usage statistics (returns mock unlimited stats)
   */
  async getUsageStats(userId: string): Promise<{
    tokensUsed: number;
    tokensIncluded: number;
    usagePercentage: number;
    premiumRepliesUsed: number;
    premiumRepliesIncluded: number;
    frameworkCap: number;
  }> {
    return {
      tokensUsed: 0,
      tokensIncluded: 1000000,
      usagePercentage: 0,
      premiumRepliesUsed: 0,
      premiumRepliesIncluded: 100,
      frameworkCap: 11,
    };
  }
}
