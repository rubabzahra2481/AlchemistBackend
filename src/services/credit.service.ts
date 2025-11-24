import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { UserSubscription } from '../entities/user-subscription.entity';
import { TokenUsageLog } from '../entities/token-usage-log.entity';
import { PremiumReplyUsage } from '../entities/premium-reply-usage.entity';
import { SubscriptionService } from './subscription.service';
import { SUBSCRIPTION_PLANS, isPremiumModel } from '../config/subscription.config';

export interface CreditCheckResult {
  allowed: boolean;
  tokensAvailable: number;
  tokensUsed: number;
  tokensIncluded: number;
  usagePercentage: number;
  warning: boolean; // 80% threshold
  frameworkCap: number;
  premiumRepliesAvailable: number;
  premiumRepliesUsed: number;
  message?: string; // Error or warning message
}

@Injectable()
export class CreditService {
  constructor(
    @InjectRepository(UserSubscription)
    private subscriptionRepository: Repository<UserSubscription>,
    @InjectRepository(TokenUsageLog)
    private tokenUsageRepository: Repository<TokenUsageLog>,
    @InjectRepository(PremiumReplyUsage)
    private premiumReplyRepository: Repository<PremiumReplyUsage>,
    private subscriptionService: SubscriptionService,
    private dataSource: DataSource,
  ) {}

  /**
   * Check if user has enough credits for a request
   */
  async checkCredits(userId: string): Promise<CreditCheckResult> {
    const subscription = await this.subscriptionService.getOrCreateSubscription(userId);
    const plan = SUBSCRIPTION_PLANS[subscription.tier];

    const tokensAvailable = subscription.tokensIncluded - subscription.tokensUsed;
    const usagePercentage = (subscription.tokensUsed / subscription.tokensIncluded) * 100;

    const warning = usagePercentage >= 80;
    const blocked = usagePercentage >= 100;

    // Check premium replies
    let premiumRepliesAvailable = 0;
    if (plan.premiumRepliesIncluded > 0) {
      premiumRepliesAvailable = Math.max(0, plan.premiumRepliesIncluded - subscription.premiumRepliesUsed);
    } else if (plan.premiumRepliesIncluded === -1) {
      premiumRepliesAvailable = -1; // Unlimited
    }

    return {
      allowed: !blocked,
      tokensAvailable: Math.max(0, tokensAvailable),
      tokensUsed: subscription.tokensUsed,
      tokensIncluded: subscription.tokensIncluded,
      usagePercentage,
      warning,
      frameworkCap: plan.frameworkCap,
      premiumRepliesAvailable,
      premiumRepliesUsed: subscription.premiumRepliesUsed,
      message: blocked
        ? `Credit limit reached (${usagePercentage.toFixed(1)}% used). Please upgrade or wait for next billing cycle.`
        : warning
          ? `Warning: ${usagePercentage.toFixed(1)}% of credits used. Consider upgrading to avoid interruption.`
          : undefined,
    };
  }

  /**
   * Check if user can use premium model
   */
  async canUsePremiumModel(userId: string): Promise<{ allowed: boolean; cost?: number; message?: string }> {
    const subscription = await this.subscriptionService.getOrCreateSubscription(userId);
    const plan = SUBSCRIPTION_PLANS[subscription.tier];

    // Business tier: unlimited premium
    if (plan.allowsPremiumByDefault) {
      return { allowed: true };
    }

    // Free tier: no premium
    if (subscription.tier === 'free') {
      return {
        allowed: false,
        message: 'Premium models are not available on the free tier.',
      };
    }

    // Check premium reply quota
    if (plan.premiumRepliesIncluded > 0) {
      const used = subscription.premiumRepliesUsed;
      if (used < plan.premiumRepliesIncluded) {
        return { allowed: true };
      }
    }

    // Check if pay-per-use is allowed (Starter, Pro)
    if (plan.premiumReplyCost > 0) {
      return {
        allowed: true,
        cost: plan.premiumReplyCost,
      };
    }

    return {
      allowed: false,
      message: 'Premium model quota exceeded. Upgrade or wait for next billing cycle.',
    };
  }

  /**
   * Record token usage
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
    // Use transaction to ensure atomicity
    await this.dataSource.transaction(async (manager) => {
      // Update subscription token usage
      const subscription = await manager.findOne(UserSubscription, {
        where: { userId },
      });

      if (subscription) {
        subscription.tokensUsed = (subscription.tokensUsed || 0) + tokens;
        await manager.save(UserSubscription, subscription);
      }

      // Log token usage
      const usageLog = manager.create(TokenUsageLog, {
        userId,
        sessionId,
        tokens,
        inputTokens,
        outputTokens,
        llmModel,
        callType,
        frameworkName,
        isPremium: isPremiumModel(llmModel),
        endpoint,
      });

      await manager.save(TokenUsageLog, usageLog);
    });

    console.log(`📊 [Credit] Recorded ${tokens} tokens for user ${userId} (${callType})`);
  }

  /**
   * Record premium reply usage
   */
  async recordPremiumReplyUsage(
    userId: string,
    sessionId: string | null,
    cost: number,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      // Update subscription premium reply count
      const subscription = await manager.findOne(UserSubscription, {
        where: { userId },
      });

      if (subscription) {
        subscription.premiumRepliesUsed = (subscription.premiumRepliesUsed || 0) + 1;
        await manager.save(UserSubscription, subscription);
      }

      // Record premium reply usage
      const now = new Date();
      const billingMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      let premiumUsage = await manager.findOne(PremiumReplyUsage, {
        where: { userId, billingMonth },
      });

      if (!premiumUsage) {
        premiumUsage = manager.create(PremiumReplyUsage, {
          userId,
          sessionId,
          billingMonth,
          count: 0,
          totalCost: 0,
        });
      }

      premiumUsage.count += 1;
      premiumUsage.totalCost = (premiumUsage.totalCost || 0) + cost;

      await manager.save(PremiumReplyUsage, premiumUsage);
    });

    console.log(`💎 [Credit] Recorded premium reply for user ${userId} (cost: $${cost})`);
  }

  /**
   * Get usage statistics for user
   */
  async getUsageStats(userId: string): Promise<{
    tokensUsed: number;
    tokensIncluded: number;
    usagePercentage: number;
    premiumRepliesUsed: number;
    premiumRepliesIncluded: number;
    frameworkCap: number;
  }> {
    const subscription = await this.subscriptionService.getOrCreateSubscription(userId);
    const plan = SUBSCRIPTION_PLANS[subscription.tier];

    return {
      tokensUsed: subscription.tokensUsed,
      tokensIncluded: subscription.tokensIncluded,
      usagePercentage: (subscription.tokensUsed / subscription.tokensIncluded) * 100,
      premiumRepliesUsed: subscription.premiumRepliesUsed,
      premiumRepliesIncluded: plan.premiumRepliesIncluded,
      frameworkCap: plan.frameworkCap,
    };
  }
}

