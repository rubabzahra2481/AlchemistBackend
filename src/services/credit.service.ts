import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SubscriptionService } from './subscription.service';
import { UsageStoreService } from './usage-store.service';
import { IOSBackendService } from './ios-backend.service';
import { UserTier } from '../config/tier-pricing.config';

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

interface UserUsageRecord {
  userId: string;
  month: string;
  tokensUsed: number;
  requestCount: number;
}

const TIER_TOKEN_ALLOWANCE: Record<UserTier, number> = {
  free: 100_000,
  basic: 400_000,
  standard: 1_000_000,
  pro: 1_500_000,
  elite: 6_000_000,
};

@Injectable()
export class CreditService {
  constructor(
    private subscriptionService: SubscriptionService,
    private usageStore: UsageStoreService,
    private configService: ConfigService,
    private iosBackend: IOSBackendService,
  ) {}

  private getUsageKey(userId: string, month: string): string {
    return `${userId}:${month}`;
  }

  private getCurrentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private getAllowanceForTier(userTier: UserTier): number {
    return TIER_TOKEN_ALLOWANCE[userTier] || TIER_TOKEN_ALLOWANCE.free;
  }

  /**
   * Fetches the latest credit snapshot from Munawar's DB (latest agent message metadata.credits)
   * so we can restore our running total after a restart. Only used when local store is empty.
   */
  private async fetchUsageFromMunawar(userId: string): Promise<{ tokensUsed: number; tokensIncluded: number } | null> {
    const useIos = this.configService.get<string>('USE_IOS_BACKEND') === 'true';
    if (!useIos) return null;
    try {
      const sessionsRes = await this.iosBackend.getUserSessions(userId, undefined, 10);
      if (!sessionsRes?.success || !sessionsRes.sessions?.length) return null;
      const sessions = sessionsRes.sessions;
      let best: { tokensUsed: number; tokensIncluded: number; createdAt: string } | null = null;
      for (const session of sessions) {
        const msgRes = await this.iosBackend.getSessionMessages(session.id, 50);
        if (!msgRes?.success || !msgRes.messages?.length) continue;
        for (const msg of msgRes.messages) {
          if (msg.role !== 'agent' || !msg.metadata?.credits) continue;
          const c = msg.metadata.credits as { tokensUsed?: number; tokensIncluded?: number };
          const tokensUsed = typeof c.tokensUsed === 'number' ? c.tokensUsed : 0;
          const tokensIncluded = typeof c.tokensIncluded === 'number' ? c.tokensIncluded : 0;
          const createdAt = msg.createdAt ?? '';
          if (!best || (createdAt && createdAt > best.createdAt)) {
            best = { tokensUsed, tokensIncluded, createdAt };
          }
        }
      }
      return best ? { tokensUsed: best.tokensUsed, tokensIncluded: best.tokensIncluded } : null;
    } catch (e) {
      console.warn('[Credit] Read-back from Munawar failed:', (e as Error).message);
      return null;
    }
  }

  private async getUsageThisMonth(userId: string): Promise<UserUsageRecord> {
    const month = this.getCurrentMonth();
    const key = this.getUsageKey(userId, month);
    let record = this.usageStore.getCreditRecord(key);
    if (!record || record.tokensUsed === 0) {
      const fromMunawar = await this.fetchUsageFromMunawar(userId);
      if (fromMunawar) {
        record = {
          userId,
          month,
          tokensUsed: fromMunawar.tokensUsed,
          requestCount: 0,
        };
        this.usageStore.setCreditRecord(key, record);
        console.log(
          `📥 [Credit] Read-back from Munawar: restored tokensUsed=${fromMunawar.tokensUsed.toLocaleString()} for ${userId.slice(0, 8)}...`,
        );
      }
    }
    return record || { userId, month, tokensUsed: 0, requestCount: 0 };
  }

  async checkCredits(userId: string, userTier?: UserTier): Promise<CreditCheckResult> {
    const tier = userTier || 'free';
    const allowance = this.getAllowanceForTier(tier);
    const usage = await this.getUsageThisMonth(userId);
    const tokensUsed = usage.tokensUsed;
    const tokensAvailable = Math.max(0, allowance - tokensUsed);
    const usagePercentage = allowance > 0 ? (tokensUsed / allowance) * 100 : 0;
    const warning = usagePercentage >= 80;
    const allowed = tokensUsed < allowance;

    let message: string | undefined;
    if (!allowed) {
      message = `Credit limit reached. You've used ${tokensUsed.toLocaleString()} of ${allowance.toLocaleString()} tokens this month. Upgrade your plan or wait until next month.`;
    } else if (warning) {
      message = `You've used ${usagePercentage.toFixed(0)}% of your monthly tokens (${tokensUsed.toLocaleString()} / ${allowance.toLocaleString()}).`;
    }

    return {
      allowed,
      tokensAvailable,
      tokensUsed,
      tokensIncluded: allowance,
      usagePercentage,
      warning,
      frameworkCap: 11,
      premiumRepliesAvailable: 100,
      premiumRepliesUsed: 0,
      message,
    };
  }

  async canUsePremiumModel(userId: string): Promise<{ allowed: boolean; cost?: number; message?: string }> {
    return { allowed: true };
  }

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
    const month = this.getCurrentMonth();
    const key = this.getUsageKey(userId, month);
    const existing = await this.getUsageThisMonth(userId);

    existing.tokensUsed += tokens;
    existing.requestCount += 1;
    this.usageStore.setCreditRecord(key, existing);

    console.log(
      `📊 [Credit] +${tokens} tokens (${callType}) → total: ${existing.tokensUsed.toLocaleString()} for ${userId.slice(0, 8)}...`
    );
  }

  async recordPremiumReplyUsage(
    userId: string,
    sessionId: string | null,
    cost: number,
  ): Promise<void> {
    console.log(`💎 [Credit] Premium reply recorded for ${userId.slice(0, 8)}...`);
  }

  async getUsageStats(userId: string, userTier?: UserTier): Promise<{
    tokensUsed: number;
    tokensIncluded: number;
    usagePercentage: number;
    premiumRepliesUsed: number;
    premiumRepliesIncluded: number;
    frameworkCap: number;
  }> {
    const tier = userTier || 'free';
    const allowance = this.getAllowanceForTier(tier);
    const usage = await this.getUsageThisMonth(userId);
    const usagePercentage = allowance > 0 ? (usage.tokensUsed / allowance) * 100 : 0;

    return {
      tokensUsed: usage.tokensUsed,
      tokensIncluded: allowance,
      usagePercentage,
      premiumRepliesUsed: 0,
      premiumRepliesIncluded: 100,
      frameworkCap: 11,
    };
  }

  async resetUsage(userId: string): Promise<void> {
    const month = this.getCurrentMonth();
    const key = this.getUsageKey(userId, month);
    this.usageStore.deleteCreditRecord(key);
    console.log(`🔄 [Credit] Reset usage for ${userId.slice(0, 8)}...`);
  }
}
