import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserSubscription, SubscriptionTier } from '../entities/user-subscription.entity';
import { SUBSCRIPTION_PLANS } from '../config/subscription.config';

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectRepository(UserSubscription)
    private subscriptionRepository: Repository<UserSubscription>,
  ) {}

  /**
   * Get or create subscription for user (defaults to FREE)
   */
  async getOrCreateSubscription(userId: string): Promise<UserSubscription> {
    let subscription = await this.subscriptionRepository.findOne({
      where: { userId },
    });

    if (!subscription) {
      // Create free subscription for new user
      const plan = SUBSCRIPTION_PLANS[SubscriptionTier.FREE];
      const now = new Date();
      const cycleStart = new Date(now.getFullYear(), now.getMonth(), 1); // First day of month
      const cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Last day of month

      subscription = this.subscriptionRepository.create({
        userId,
        tier: SubscriptionTier.FREE,
        tokensUsed: 0,
        tokensIncluded: plan.tokensIncluded,
        billingCycleStart: cycleStart,
        billingCycleEnd: cycleEnd,
        premiumRepliesUsed: 0,
        premiumRepliesIncluded: plan.premiumRepliesIncluded,
        isActive: true,
      });

      subscription = await this.subscriptionRepository.save(subscription);
      console.log(`✅ [Subscription] Created FREE subscription for user ${userId}`);
    } else {
      // Check if billing cycle needs reset
      await this.checkAndResetBillingCycle(subscription);
    }

    return subscription;
  }

  /**
   * Check if billing cycle has expired and reset if needed
   */
  async checkAndResetBillingCycle(subscription: UserSubscription): Promise<void> {
    const now = new Date();
    
    // If cycle end has passed, reset to new cycle
    if (now > subscription.billingCycleEnd) {
      const plan = SUBSCRIPTION_PLANS[subscription.tier];
      const cycleStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      subscription.tokensUsed = 0;
      subscription.tokensIncluded = plan.tokensIncluded;
      subscription.billingCycleStart = cycleStart;
      subscription.billingCycleEnd = cycleEnd;
      subscription.premiumRepliesUsed = 0;
      subscription.premiumRepliesIncluded = plan.premiumRepliesIncluded;

      await this.subscriptionRepository.save(subscription);
      console.log(`🔄 [Subscription] Reset billing cycle for user ${subscription.userId}`);
    }
  }

  /**
   * Update user subscription tier
   */
  async updateSubscriptionTier(
    userId: string,
    newTier: SubscriptionTier,
  ): Promise<UserSubscription> {
    const subscription = await this.getOrCreateSubscription(userId);
    const plan = SUBSCRIPTION_PLANS[newTier];

    subscription.tier = newTier;
    subscription.tokensIncluded = plan.tokensIncluded;
    subscription.premiumRepliesIncluded = plan.premiumRepliesIncluded;
    // Reset billing cycle when tier changes
    const now = new Date();
    subscription.billingCycleStart = new Date(now.getFullYear(), now.getMonth(), 1);
    subscription.billingCycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    await this.subscriptionRepository.save(subscription);
    console.log(`✅ [Subscription] Updated tier to ${newTier} for user ${userId}`);

    return subscription;
  }

  /**
   * Get subscription plan config for user
   */
  async getSubscriptionPlan(userId: string): Promise<typeof SUBSCRIPTION_PLANS[SubscriptionTier]> {
    const subscription = await this.getOrCreateSubscription(userId);
    return SUBSCRIPTION_PLANS[subscription.tier];
  }
}

