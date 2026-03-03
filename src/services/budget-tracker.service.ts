import { Injectable } from '@nestjs/common';
import { UserTier, getMonthlyBudgetForModel, MODEL_PRICING_TIERS, ModelPricingTier } from '../config/tier-pricing.config';
import { UsageStoreService } from './usage-store.service';

/**
 * Approximate pricing per 1M tokens (combined input + output)
 * Based on current market rates (Feb 2026)
 */
const MODEL_PRICING_PER_1M_TOKENS: Record<string, { input: number; output: number }> = {
  // OpenAI
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4-turbo': { input: 10.00, output: 30.00 },
  
  // Anthropic
  'claude-3-haiku': { input: 0.25, output: 1.25 },
  'claude-3-5-sonnet': { input: 3.00, output: 15.00 },
  'claude-3-opus': { input: 15.00, output: 75.00 },
  
  // Others
  'deepseek-chat': { input: 0.27, output: 1.10 },
  'gemini-1.5-flash': { input: 0.075, output: 0.30 },
  'gemini-1.5-pro': { input: 1.25, output: 5.00 },
};

interface BudgetUsage {
  userId: string;
  modelId: string;
  month: string; // Format: YYYY-MM
  spentUSD: number;
  inputTokens: number;
  outputTokens: number;
  requestCount: number;
}

@Injectable()
export class BudgetTrackerService {
  constructor(private usageStore: UsageStoreService) {}


  /**
   * Get budget key for storage
   */
  private getBudgetKey(userId: string, modelId: string, month: string): string {
    return `${userId}:${modelId}:${month}`;
  }

  /**
   * Get current month string
   */
  private getCurrentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Calculate cost for token usage
   */
  private calculateCost(modelId: string, inputTokens: number, outputTokens: number): number {
    const pricing = MODEL_PRICING_PER_1M_TOKENS[modelId];
    
    if (!pricing) {
      console.warn(`⚠️ [BudgetTracker] No pricing data for model ${modelId}, using default`);
      return ((inputTokens + outputTokens) / 1_000_000) * 2.5; // Default estimate
    }
    
    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;
    
    return inputCost + outputCost;
  }

  /**
   * Track token usage for a model
   */
  async trackUsage(
    userId: string,
    modelId: string,
    inputTokens: number,
    outputTokens: number,
  ): Promise<void> {
    const month = this.getCurrentMonth();
    const key = this.getBudgetKey(userId, modelId, month);
    
    const cost = this.calculateCost(modelId, inputTokens, outputTokens);
    
    const existing: BudgetUsage | undefined = this.usageStore.getBudgetRecord(key);
    
    if (existing) {
      existing.spentUSD += cost;
      existing.inputTokens += inputTokens;
      existing.outputTokens += outputTokens;
      existing.requestCount += 1;
      this.usageStore.setBudgetRecord(key, existing);
    } else {
      this.usageStore.setBudgetRecord(key, {
        userId,
        modelId,
        month,
        spentUSD: cost,
        inputTokens,
        outputTokens,
        requestCount: 1,
      });
    }
    
    const record = this.usageStore.getBudgetRecord(key);
    console.log(
      `💰 [BudgetTracker] User ${userId.slice(0, 8)}... spent $${cost.toFixed(4)} on ${modelId} (total this month: $${record?.spentUSD.toFixed(2)})`
    );
  }

  /**
   * Check if user has budget remaining for a model
   */
  async checkBudget(
    userId: string,
    userTier: UserTier,
    modelId: string,
  ): Promise<{ 
    allowed: boolean; 
    reason?: string;
    spent: number;
    limit: number;
    remaining: number;
  }> {
    // Only track premium/expensive models
    const pricingTier = MODEL_PRICING_TIERS[modelId];
    if (pricingTier !== ModelPricingTier.PREMIUM && pricingTier !== ModelPricingTier.EXPENSIVE) {
      return { allowed: true, spent: 0, limit: Infinity, remaining: Infinity };
    }
    
    const monthlyBudget = getMonthlyBudgetForModel(userTier, modelId);
    
    // If no budget limit, allow
    if (monthlyBudget === 0 || monthlyBudget === Infinity) {
      return { allowed: true, spent: 0, limit: monthlyBudget, remaining: monthlyBudget };
    }
    
    const month = this.getCurrentMonth();
    const key = this.getBudgetKey(userId, modelId, month);
    const usage: BudgetUsage | undefined = this.usageStore.getBudgetRecord(key);
    
    const spent = usage?.spentUSD || 0;
    const remaining = monthlyBudget - spent;
    
    if (spent >= monthlyBudget) {
      return {
        allowed: false,
        reason: `Monthly budget exceeded for ${modelId}. You've spent $${spent.toFixed(2)} of your $${monthlyBudget} limit.`,
        spent,
        limit: monthlyBudget,
        remaining: 0,
      };
    }
    
    return {
      allowed: true,
      spent,
      limit: monthlyBudget,
      remaining,
    };
  }

  /**
   * Get usage stats for a user
   */
  async getUserUsageStats(userId: string, month?: string): Promise<{
    totalSpent: number;
    byModel: Array<{ modelId: string; spent: number; tokens: number; requests: number }>;
  }> {
    const targetMonth = month || this.getCurrentMonth();
    const userUsage: BudgetUsage[] = [];
    
    for (const key of this.usageStore.getAllBudgetKeys()) {
      const usage: BudgetUsage = this.usageStore.getBudgetRecord(key);
      if (usage && usage.userId === userId && usage.month === targetMonth) {
        userUsage.push(usage);
      }
    }
    
    const totalSpent = userUsage.reduce((sum, u) => sum + u.spentUSD, 0);
    const byModel = userUsage.map(u => ({
      modelId: u.modelId,
      spent: u.spentUSD,
      tokens: u.inputTokens + u.outputTokens,
      requests: u.requestCount,
    }));
    
    return { totalSpent, byModel };
  }

  /**
   * Reset budget for a user (for testing or monthly reset)
   */
  async resetBudget(userId: string, modelId?: string): Promise<void> {
    const month = this.getCurrentMonth();
    
    if (modelId) {
      const key = this.getBudgetKey(userId, modelId, month);
      this.usageStore.deleteBudgetRecord(key);
      console.log(`🔄 [BudgetTracker] Reset budget for ${userId} on ${modelId}`);
    } else {
      for (const key of this.usageStore.getAllBudgetKeys()) {
        const usage: BudgetUsage = this.usageStore.getBudgetRecord(key);
        if (usage && usage.userId === userId && usage.month === month) {
          this.usageStore.deleteBudgetRecord(key);
        }
      }
      console.log(`🔄 [BudgetTracker] Reset all budgets for ${userId}`);
    }
  }

  /**
   * Get estimated cost for a request (before making it)
   */
  estimateCost(modelId: string, estimatedInputTokens: number, estimatedOutputTokens: number): number {
    return this.calculateCost(modelId, estimatedInputTokens, estimatedOutputTokens);
  }
}
