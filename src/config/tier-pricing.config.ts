/**
 * Tier-based Pricing Configuration
 * 
 * This file defines:
 * 1. Model access restrictions per tier
 * 2. Output token limits per tier
 * 3. Monthly budget limits per model for premium tiers
 */

export type UserTier = 'free' | 'basic' | 'standard' | 'pro' | 'elite';

/**
 * Model pricing categories based on cost
 */
export enum ModelPricingTier {
  CHEAP = 'cheap',           // gpt-4o-mini, gpt-3.5-turbo, claude-3-haiku, gemini-flash
  STANDARD = 'standard',     // gpt-4o, deepseek-chat, gemini-1.5-pro
  PREMIUM = 'premium',       // claude-3-5-sonnet
  EXPENSIVE = 'expensive',   // claude-3-opus, gpt-4-turbo
}

/**
 * Model cost classification
 */
export const MODEL_PRICING_TIERS: Record<string, ModelPricingTier> = {
  // Cheap models (~$0.15-0.50 per 1M input tokens)
  'gpt-4o-mini': ModelPricingTier.CHEAP,
  'gpt-3.5-turbo': ModelPricingTier.CHEAP,
  'claude-3-haiku': ModelPricingTier.CHEAP,
  'gemini-1.5-flash': ModelPricingTier.CHEAP,
  
  // Standard models (~$2.50-5 per 1M input tokens)
  'gpt-4o': ModelPricingTier.STANDARD,
  'deepseek-chat': ModelPricingTier.STANDARD,
  'gemini-1.5-pro': ModelPricingTier.STANDARD,
  
  // Premium models (~$3-15 per 1M input tokens)
  'claude-3-5-sonnet': ModelPricingTier.PREMIUM,
  
  // Expensive models (~$15-75 per 1M input tokens)
  'claude-3-opus': ModelPricingTier.EXPENSIVE,
  'gpt-4-turbo': ModelPricingTier.EXPENSIVE,
};

/**
 * Tier-based model access control
 */
export interface TierModelAccess {
  allowedModels: ModelPricingTier[];
  blockedModels?: string[]; // Specific model IDs to block
  defaultModel: string;
}

export const TIER_MODEL_ACCESS: Record<UserTier, TierModelAccess> = {
  free: {
    allowedModels: [ModelPricingTier.CHEAP],
    defaultModel: 'gpt-4o-mini',
  },
  basic: {
    allowedModels: [ModelPricingTier.CHEAP, ModelPricingTier.STANDARD],
    blockedModels: ['gpt-4o'], // Block gpt-4o for basic tier
    defaultModel: 'gpt-4o-mini',
  },
  standard: {
    allowedModels: [ModelPricingTier.CHEAP, ModelPricingTier.STANDARD],
    defaultModel: 'gpt-4o',
  },
  pro: {
    allowedModels: [ModelPricingTier.CHEAP, ModelPricingTier.STANDARD, ModelPricingTier.PREMIUM],
    defaultModel: 'gpt-4o',
  },
  elite: {
    allowedModels: [ModelPricingTier.CHEAP, ModelPricingTier.STANDARD, ModelPricingTier.PREMIUM, ModelPricingTier.EXPENSIVE],
    defaultModel: 'gpt-4o',
  },
};

/**
 * Tier-based output token limits
 */
export interface TierOutputLimits {
  maxOutputTokens: number;
  maxInputTokens?: number; // Optional input limit
}

export const TIER_OUTPUT_LIMITS: Record<UserTier, TierOutputLimits> = {
  free: {
    maxOutputTokens: 500,     // ~400 words
    maxInputTokens: 4000,     // Context window limit
  },
  basic: {
    maxOutputTokens: 1000,    // ~800 words
    maxInputTokens: 8000,
  },
  standard: {
    maxOutputTokens: 2000,    // ~1600 words
    maxInputTokens: 16000,
  },
  pro: {
    maxOutputTokens: 4000,    // ~3200 words
    maxInputTokens: 32000,
  },
  elite: {
    maxOutputTokens: 8000,    // ~6400 words
    maxInputTokens: 128000,   // Full context window
  },
};

/**
 * Monthly budget limits per model (in dollars)
 * Only applies to premium/expensive models
 */
export interface ModelBudgetLimit {
  modelId: string;
  monthlyBudget: number; // in USD
  tier: UserTier;
}

export const PREMIUM_MODEL_BUDGETS: ModelBudgetLimit[] = [
  // Pro tier budgets
  { modelId: 'claude-3-5-sonnet', monthlyBudget: 10, tier: 'pro' },
  { modelId: 'claude-3-opus', monthlyBudget: 0, tier: 'pro' }, // Blocked
  { modelId: 'gpt-4-turbo', monthlyBudget: 0, tier: 'pro' }, // Blocked
  
  // Elite tier budgets
  { modelId: 'claude-3-5-sonnet', monthlyBudget: 50, tier: 'elite' },
  { modelId: 'claude-3-opus', monthlyBudget: 25, tier: 'elite' },
  { modelId: 'gpt-4-turbo', monthlyBudget: 25, tier: 'elite' },
];

/**
 * Get allowed models for a user tier
 */
export function getAllowedModelsForTier(userTier: UserTier): string[] {
  const tierAccess = TIER_MODEL_ACCESS[userTier];
  const allowedPricingTiers = tierAccess.allowedModels;
  const blockedModels = tierAccess.blockedModels || [];
  
  const allowedModels = Object.entries(MODEL_PRICING_TIERS)
    .filter(([modelId, pricingTier]) => 
      allowedPricingTiers.includes(pricingTier) && !blockedModels.includes(modelId)
    )
    .map(([modelId]) => modelId);
  
  return allowedModels;
}

/**
 * Check if a user can access a specific model
 */
export function canAccessModel(userTier: UserTier, modelId: string): boolean {
  const allowedModels = getAllowedModelsForTier(userTier);
  return allowedModels.includes(modelId);
}

/**
 * Get output token limit for a tier
 */
export function getOutputLimitForTier(userTier: UserTier): number {
  return TIER_OUTPUT_LIMITS[userTier].maxOutputTokens;
}

/**
 * Get input token limit for a tier
 */
export function getInputLimitForTier(userTier: UserTier): number {
  return TIER_OUTPUT_LIMITS[userTier].maxInputTokens || 16000;
}

/**
 * Get monthly budget for a specific model and tier
 */
export function getMonthlyBudgetForModel(userTier: UserTier, modelId: string): number {
  const budget = PREMIUM_MODEL_BUDGETS.find(
    b => b.tier === userTier && b.modelId === modelId
  );
  return budget?.monthlyBudget || 0;
}

/**
 * Get the default model for a tier (fallback if requested model is blocked)
 */
export function getDefaultModelForTier(userTier: UserTier): string {
  return TIER_MODEL_ACCESS[userTier].defaultModel;
}

/**
 * Validate and sanitize user tier string
 */
export function validateUserTier(tier: string | undefined): UserTier {
  const normalizedTier = (tier || 'free').toLowerCase();
  const validTiers: UserTier[] = ['free', 'basic', 'standard', 'pro', 'elite'];
  
  if (validTiers.includes(normalizedTier as UserTier)) {
    return normalizedTier as UserTier;
  }
  
  console.warn(`⚠️ Invalid tier "${tier}", defaulting to 'free'`);
  return 'free';
}

/**
 * Get tier display information
 */
export function getTierDisplayInfo(userTier: UserTier): { 
  name: string; 
  color: string; 
  badge: string;
  features: string[];
} {
  const tierInfo = {
    free: {
      name: 'Free',
      color: '#6B7280',
      badge: '🆓',
      features: ['Basic models only', '500 token responses', 'Limited context'],
    },
    basic: {
      name: 'Basic',
      color: '#3B82F6',
      badge: '⭐',
      features: ['Standard models', '1000 token responses', 'Extended context'],
    },
    standard: {
      name: 'Standard',
      color: '#10B981',
      badge: '⭐⭐',
      features: ['All standard models', '2000 token responses', 'Full context'],
    },
    pro: {
      name: 'Pro',
      color: '#8B5CF6',
      badge: '⭐⭐⭐',
      features: ['Premium models', '4000 token responses', 'Priority support'],
    },
    elite: {
      name: 'Elite',
      color: '#F59E0B',
      badge: '👑',
      features: ['All models', '8000 token responses', 'Unlimited context'],
    },
  };
  
  return tierInfo[userTier];
}
