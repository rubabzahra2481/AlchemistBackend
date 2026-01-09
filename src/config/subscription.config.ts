import { SubscriptionTier } from '../entities/user-subscription.entity';

export interface SubscriptionPlanConfig {
  tier: SubscriptionTier;
  price: number; // Monthly price in USD
  tokensIncluded: number; // Monthly token allowance
  frameworkCap: number; // Max frameworks per message
  defaultModel: string; // Default LLM model
  premiumRepliesIncluded: number; // Premium replies per month (0 = none included)
  premiumReplyCost: number; // Cost per premium reply after included quota
  overageCostPer1k: number; // Cost per 1k tokens for overage
  allowsPremiumByDefault: boolean; // Whether premium model is default
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionTier, SubscriptionPlanConfig> = {
  [SubscriptionTier.FREE]: {
    tier: SubscriptionTier.FREE,
    price: 0,
    tokensIncluded: 100000, // 100k tokens/month
    frameworkCap: 6, // 6 frameworks per message (increased for anonymous users)
    defaultModel: 'gpt-4o', // Mid model
    premiumRepliesIncluded: 0,
    premiumReplyCost: 0, // Not available on free tier
    overageCostPer1k: 0.01, // $0.01 per 1k tokens
    allowsPremiumByDefault: false,
  },
  [SubscriptionTier.STARTER]: {
    tier: SubscriptionTier.STARTER,
    price: 4,
    tokensIncluded: 400000, // 400k tokens/month
    frameworkCap: 2, // 2 frameworks per message
    defaultModel: 'gpt-4o', // Mid model
    premiumRepliesIncluded: 0,
    premiumReplyCost: 0.5, // $0.50 per premium reply
    overageCostPer1k: 0.012, // $0.012 per 1k tokens
    allowsPremiumByDefault: false,
  },
  [SubscriptionTier.PRO]: {
    tier: SubscriptionTier.PRO,
    price: 15,
    tokensIncluded: 1500000, // 1.5M tokens/month
    frameworkCap: 3, // 3 frameworks per message
    defaultModel: 'gpt-4o', // Mid model
    premiumRepliesIncluded: 10, // 10 premium replies/month
    premiumReplyCost: 0.3, // $0.30 per premium reply after quota
    overageCostPer1k: 0.009, // $0.009 per 1k tokens
    allowsPremiumByDefault: false,
  },
  [SubscriptionTier.BUSINESS]: {
    tier: SubscriptionTier.BUSINESS,
    price: 59,
    tokensIncluded: 6000000, // 6M tokens/month
    frameworkCap: 6, // 6 frameworks per message
    defaultModel: 'gpt-4o', // Premium model by default
    premiumRepliesIncluded: -1, // Unlimited
    premiumReplyCost: 0,
    overageCostPer1k: 0.006, // $0.006 per 1k tokens
    allowsPremiumByDefault: true, // Premium model is default
  },
};

// Premium models (for premium reply tracking)
export const PREMIUM_MODELS = ['claude-3-opus', 'gpt-4-turbo'];

// Mid/default models
export const MID_MODELS = ['gpt-4o', 'claude-3-5-sonnet', 'deepseek-chat', 'gemini-1.5-pro'];

/**
 * Check if a model is premium
 */
export function isPremiumModel(modelId: string): boolean {
  return PREMIUM_MODELS.includes(modelId);
}

/**
 * Get default model for tier
 */
export function getDefaultModelForTier(tier: SubscriptionTier): string {
  return SUBSCRIPTION_PLANS[tier].defaultModel;
}

/**
 * Get framework priority order (personality > emotional > crisis)
 * Returns frameworks in priority order
 */
export function getFrameworkPriorityOrder(): Array<{
  name: string;
  priority: number;
  category: 'personality' | 'emotional' | 'crisis';
}> {
  return [
    // Personality frameworks (highest priority)
    { name: 'bigFive', priority: 1, category: 'personality' },
    { name: 'darkTriad', priority: 2, category: 'personality' },
    { name: 'mbti', priority: 3, category: 'personality' },
    { name: 'enneagram', priority: 4, category: 'personality' },
    { name: 'attachment', priority: 5, category: 'personality' },
    { name: 'erikson', priority: 6, category: 'personality' },
    { name: 'gestalt', priority: 7, category: 'personality' },
    { name: 'bioPsych', priority: 8, category: 'personality' },
    // Emotional frameworks (medium priority)
    { name: 'dass', priority: 9, category: 'emotional' },
    { name: 'rse', priority: 10, category: 'emotional' },
    // Crisis frameworks (lower priority, but may override if urgent)
    { name: 'crt', priority: 11, category: 'crisis' },
  ];
}

/**
 * Select frameworks based on tier cap and priority
 * Priority: personality > emotional > crisis
 */
export function selectFrameworksByPriority(
  matchedFrameworks: string[],
  tierCap: number,
  hasCrisisIndicators: boolean = false,
): string[] {
  const priorityOrder = getFrameworkPriorityOrder();
  
  // Sort matched frameworks by priority
  const sorted = matchedFrameworks
    .map((name) => priorityOrder.find((f) => f.name === name))
    .filter((f) => f !== undefined)
    .sort((a, b) => a!.priority - b!.priority)
    .map((f) => f!.name);

  // Crisis override: if crisis detected, ensure DASS is included (it handles crisis)
  if (hasCrisisIndicators && sorted.includes('dass')) {
    // Move DASS to front if not already
    const dassIndex = sorted.indexOf('dass');
    if (dassIndex > 0) {
      sorted.splice(dassIndex, 1);
      sorted.unshift('dass');
    }
  }

  // Apply tier cap (max frameworks per message)
  const maxFrameworks = Math.min(tierCap, 8); // Hard cap at 8
  return sorted.slice(0, maxFrameworks);
}

