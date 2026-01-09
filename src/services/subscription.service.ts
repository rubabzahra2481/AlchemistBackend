import { Injectable } from '@nestjs/common';
import { UserSubscription, SubscriptionTier } from '../entities/user-subscription.entity';
import { SUBSCRIPTION_PLANS } from '../config/subscription.config';

@Injectable()
export class SubscriptionService {
  /**
   * Get or create subscription for user (returns mock FREE subscription - no database)
   * Since authentication is disabled, we return unlimited FREE access
   */
  async getOrCreateSubscription(userId: string): Promise<UserSubscription> {
    // Return a mock FREE subscription with high limits (no database needed)
      const plan = SUBSCRIPTION_PLANS[SubscriptionTier.FREE];
      const now = new Date();
    const cycleStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const mockSubscription: UserSubscription = {
        userId,
        tier: SubscriptionTier.FREE,
        tokensUsed: 0,
      tokensIncluded: 1000000, // 1M tokens - effectively unlimited
        billingCycleStart: cycleStart,
        billingCycleEnd: cycleEnd,
        premiumRepliesUsed: 0,
      premiumRepliesIncluded: 100,
        isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    return mockSubscription;
  }

  /**
   * Check if billing cycle has expired and reset if needed (no-op for mock)
   */
  async checkAndResetBillingCycle(subscription: UserSubscription): Promise<void> {
    // No-op for mock subscription
  }

  /**
   * Update user subscription tier (no-op for mock)
   */
  async updateSubscriptionTier(
    userId: string,
    newTier: SubscriptionTier,
  ): Promise<UserSubscription> {
    // Return mock subscription with requested tier
    return this.getOrCreateSubscription(userId);
  }

  /**
   * Get subscription plan config for user
   */
  async getSubscriptionPlan(userId: string): Promise<typeof SUBSCRIPTION_PLANS[SubscriptionTier]> {
    return SUBSCRIPTION_PLANS[SubscriptionTier.FREE];
  }
}

