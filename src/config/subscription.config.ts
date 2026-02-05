/**
 * Subscription Tier Enum (defined locally - no database dependency)
 */
export enum SubscriptionTier {
  FREE = 'free',
  STARTER = 'starter',
  PRO = 'pro',
  BUSINESS = 'business',
}

export interface SubscriptionPlanConfig {
  tier: SubscriptionTier;
  price: number;
  tokensIncluded: number;
  frameworkCap: number;
  defaultModel: string;
  premiumRepliesIncluded: number;
  premiumReplyCost: number;
  overageCostPer1k: number;
  allowsPremiumByDefault: boolean;
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionTier, SubscriptionPlanConfig> = {
  [SubscriptionTier.FREE]: {
    tier: SubscriptionTier.FREE,
    price: 0,
    tokensIncluded: 100000,
    frameworkCap: 6,
    defaultModel: 'gpt-4o',
    premiumRepliesIncluded: 0,
    premiumReplyCost: 0,
    overageCostPer1k: 0.01,
    allowsPremiumByDefault: false,
  },
  [SubscriptionTier.STARTER]: {
    tier: SubscriptionTier.STARTER,
    price: 4,
    tokensIncluded: 400000,
    frameworkCap: 2,
    defaultModel: 'gpt-4o',
    premiumRepliesIncluded: 0,
    premiumReplyCost: 0.5,
    overageCostPer1k: 0.012,
    allowsPremiumByDefault: false,
  },
  [SubscriptionTier.PRO]: {
    tier: SubscriptionTier.PRO,
    price: 15,
    tokensIncluded: 1500000,
    frameworkCap: 3,
    defaultModel: 'gpt-4o',
    premiumRepliesIncluded: 10,
    premiumReplyCost: 0.3,
    overageCostPer1k: 0.009,
    allowsPremiumByDefault: false,
  },
  [SubscriptionTier.BUSINESS]: {
    tier: SubscriptionTier.BUSINESS,
    price: 59,
    tokensIncluded: 6000000,
    frameworkCap: 6,
    defaultModel: 'gpt-4o',
    premiumRepliesIncluded: -1,
    premiumReplyCost: 0,
    overageCostPer1k: 0.006,
    allowsPremiumByDefault: true,
  },
};

export const PREMIUM_MODELS = ['claude-3-opus', 'gpt-4-turbo'];
export const MID_MODELS = ['gpt-4o', 'claude-3-5-sonnet', 'deepseek-chat', 'gemini-1.5-pro'];

export function isPremiumModel(modelId: string): boolean {
  return PREMIUM_MODELS.includes(modelId);
}

export function getDefaultModelForTier(tier: SubscriptionTier): string {
  return SUBSCRIPTION_PLANS[tier].defaultModel;
}

export function getFrameworkPriorityOrder(): Array<{
  name: string;
  priority: number;
  category: 'personality' | 'emotional' | 'crisis';
}> {
  return [
    { name: 'bigFive', priority: 1, category: 'personality' },
    { name: 'darkTriad', priority: 2, category: 'personality' },
    { name: 'mbti', priority: 3, category: 'personality' },
    { name: 'enneagram', priority: 4, category: 'personality' },
    { name: 'attachment', priority: 5, category: 'personality' },
    { name: 'erikson', priority: 6, category: 'personality' },
    { name: 'gestalt', priority: 7, category: 'personality' },
    { name: 'bioPsych', priority: 8, category: 'personality' },
    { name: 'dass', priority: 9, category: 'emotional' },
    { name: 'rse', priority: 10, category: 'emotional' },
    { name: 'crt', priority: 11, category: 'crisis' },
  ];
}

export function selectFrameworksByPriority(
  matchedFrameworks: string[],
  tierCap: number,
  hasCrisisIndicators: boolean = false,
): string[] {
  const priorityOrder = getFrameworkPriorityOrder();
  
  const sorted = matchedFrameworks
    .map((name) => priorityOrder.find((f) => f.name === name))
    .filter((f) => f !== undefined)
    .sort((a, b) => a!.priority - b!.priority)
    .map((f) => f!.name);

  if (hasCrisisIndicators && sorted.includes('dass')) {
    const dassIndex = sorted.indexOf('dass');
    if (dassIndex > 0) {
      sorted.splice(dassIndex, 1);
      sorted.unshift('dass');
    }
  }

  const maxFrameworks = Math.min(tierCap, 8);
  return sorted.slice(0, maxFrameworks);
}
