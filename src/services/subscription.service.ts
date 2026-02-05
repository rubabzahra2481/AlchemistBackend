import { Injectable } from '@nestjs/common';
import { SUBSCRIPTION_PLANS, SubscriptionTier } from '../config/subscription.config';

/**
 * User Subscription Interface (no database dependency)
 */
export interface UserSubscription {
  userId: string;
  tier: SubscriptionTier;
  tokensUsed: number;
  tokensIncluded: number;
  billingCycleStart: Date;
  billingCycleEnd: Date;
  premiumRepliesUsed: number;
  premiumRepliesIncluded: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class SubscriptionService {
  /**
   * Get or create subscription for user (returns mock FREE subscription - no database)
   */
  async getOrCreateSubscription(userId: string): Promise<UserSubscription> {
    const plan = SUBSCRIPTION_PLANS[SubscriptionTier.FREE];
    const now = new Date();
    const cycleStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const mockSubscription: UserSubscription = {
      userId,
      tier: SubscriptionTier.FREE,
      tokensUsed: 0,
      tokensIncluded: 1000000,
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

  async checkAndResetBillingCycle(subscription: UserSubscription): Promise<void> {
    // No-op for mock subscription
  }

  async updateSubscriptionTier(
    userId: string,
    newTier: SubscriptionTier,
  ): Promise<UserSubscription> {
    return this.getOrCreateSubscription(userId);
  }

  async getSubscriptionPlan(userId: string): Promise<typeof SUBSCRIPTION_PLANS[SubscriptionTier]> {
    return SUBSCRIPTION_PLANS[SubscriptionTier.FREE];
  }
}
