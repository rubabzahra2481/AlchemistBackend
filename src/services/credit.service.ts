import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SubscriptionService } from './subscription.service';
import { UsageStoreService } from './usage-store.service';
import { IOSBackendService } from './ios-backend.service';
import { UserTier } from '../config/tier-pricing.config';

/** 1 credit = 1000 tokens (used for display and storage). */
export const TOKENS_PER_CREDIT = 1000;

export interface CreditCheckResult {
  allowed: boolean;
  tokensAvailable: number;
  tokensUsed: number;
  tokensIncluded: number;
  creditsUsed: number;
  creditsIncluded: number;
  /** Base monthly allowance for tier (resets each month; no carry). */
  baseAllowance?: number;
  /** Top-up carried from previous month (unused top-up only). */
  topUpCarried?: number;
  /** Top-up purchased this month. */
  topUpAddedThisMonth?: number;
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
  /** Stored in credits (1 credit = 1000 tokens). Legacy: tokensUsed may exist from old data. */
  creditsUsed?: number;
  tokensUsed?: number;
  requestCount: number;
  /** Total top-up available this month = topUpCarried + topUpAddedThisMonth. */
  topUpCredits?: number;
  /** Top-up carried from previous month (unused). */
  topUpCarried?: number;
  /** Top-up purchased this month. */
  topUpAddedThisMonth?: number;
}

/** Monthly allowance in credits (1 credit = 1000 tokens). Free 100 = 100k tokens, etc. */
const TIER_CREDIT_ALLOWANCE: Record<UserTier, number> = {
  free: 100,
  basic: 400,
  standard: 1_000,
  pro: 1_500,
  elite: 6_000,
};

@Injectable()
export class CreditService {
  constructor(
    private subscriptionService: SubscriptionService,
    private usageStore: UsageStoreService,
    private configService: ConfigService,
    private iosBackend: IOSBackendService,
  ) {}

  /** Normalize userId so credits are consistent whether client sends uppercase or lowercase (e.g. UUID). */
  private normalizeUserId(userId: string): string {
    return typeof userId === 'string' ? userId.trim().toLowerCase() : String(userId || '').trim().toLowerCase();
  }

  private getUsageKey(userId: string, month: string): string {
    return `${this.normalizeUserId(userId)}:${month}`;
  }

  private getCurrentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private getPreviousMonth(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    if (month === 0) {
      return `${year - 1}-12`;
    }
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  private getAllowanceForTier(userTier: UserTier): number {
    return TIER_CREDIT_ALLOWANCE[userTier] || TIER_CREDIT_ALLOWANCE.free;
  }

  /**
   * Fetches the latest credit snapshot from Munawar's DB (latest agent message metadata.credits)
   * so we can restore our running total after a restart. Only used when local store is empty.
   * Accepts both credits (creditsUsed/creditsIncluded) and legacy tokens (tokensUsed/tokensIncluded).
   */
  private async fetchUsageFromMunawar(userId: string): Promise<{ creditsUsed: number; creditsIncluded: number } | null> {
    const useIos = this.configService.get<string>('USE_IOS_BACKEND') === 'true';
    if (!useIos) return null;
    try {
      const sessionsRes = await this.iosBackend.getUserSessions(userId, undefined, 10);
      if (!sessionsRes?.success || !sessionsRes.sessions?.length) return null;
      const sessions = sessionsRes.sessions;
      let best: { creditsUsed: number; creditsIncluded: number; createdAt: string } | null = null;
      for (const session of sessions) {
        const msgRes = await this.iosBackend.getSessionMessages(session.id, 50);
        if (!msgRes?.success || !msgRes.messages?.length) continue;
        for (const msg of msgRes.messages) {
          if (msg.role !== 'agent' || !msg.metadata?.credits) continue;
          const c = msg.metadata.credits as {
            creditsUsed?: number;
            creditsIncluded?: number;
            tokensUsed?: number;
            tokensIncluded?: number;
          };
          let creditsUsed: number;
          let creditsIncluded: number;
          if (typeof c.creditsUsed === 'number' && typeof c.creditsIncluded === 'number') {
            creditsUsed = c.creditsUsed;
            creditsIncluded = c.creditsIncluded;
          } else if (typeof c.tokensUsed === 'number' && typeof c.tokensIncluded === 'number') {
            creditsUsed = c.tokensUsed / TOKENS_PER_CREDIT;
            creditsIncluded = c.tokensIncluded / TOKENS_PER_CREDIT;
          } else {
            continue;
          }
          const createdAt = msg.createdAt ?? '';
          if (!best || (createdAt && createdAt > best.createdAt)) {
            best = { creditsUsed, creditsIncluded, createdAt };
          }
        }
      }
      return best ? { creditsUsed: best.creditsUsed, creditsIncluded: best.creditsIncluded } : null;
    } catch (e) {
      console.warn('[Credit] Read-back from Munawar failed:', (e as Error).message);
      return null;
    }
  }

  /**
   * Ensures current-month record exists; if not, creates it (optionally rolling over unused top-up from previous month).
   * Base monthly allowance never carries; only unused top-up carries to the new month.
   */
  private ensureCurrentMonthRecord(userId: string, tier: UserTier): UserUsageRecord | null {
    const month = this.getCurrentMonth();
    const key = this.getUsageKey(userId, month);
    let record = this.usageStore.getCreditRecord(key) as UserUsageRecord | undefined;
    if (record) return record;

    const prevMonth = this.getPreviousMonth();
    const prevKey = this.getUsageKey(userId, prevMonth);
    const prevRecord = this.usageStore.getCreditRecord(prevKey) as UserUsageRecord | undefined;
    const base = this.getAllowanceForTier(tier);
    let topUpCarried = 0;
    if (prevRecord) {
      const prevUsed = typeof prevRecord.creditsUsed === 'number'
        ? prevRecord.creditsUsed
        : (typeof prevRecord.tokensUsed === 'number' ? prevRecord.tokensUsed / TOKENS_PER_CREDIT : 0);
      const prevTopUp = typeof (prevRecord as any).topUpCredits === 'number'
        ? (prevRecord as any).topUpCredits
        : 0;
      const consumedFromTopUp = Math.max(0, prevUsed - base);
      topUpCarried = Math.max(0, prevTopUp - consumedFromTopUp);
      if (topUpCarried > 0) {
        console.log(
          `📅 [Credit] Month rollover: carried ${topUpCarried.toFixed(1)} top-up credits to ${month} for ${userId.slice(0, 8)}...`,
        );
      }
    }
    const newRecord: UserUsageRecord = {
      userId,
      month,
      creditsUsed: 0,
      requestCount: 0,
      topUpCredits: topUpCarried,
      topUpCarried,
      topUpAddedThisMonth: 0,
    };
    this.usageStore.setCreditRecord(key, newRecord);
    return newRecord;
  }

  /** Returns usage in credits (1 credit = 1000 tokens). Migrates legacy tokensUsed to creditsUsed. Does month rollover when needed. */
  private async getUsageThisMonth(userId: string, tier?: UserTier): Promise<{
    userId: string;
    month: string;
    creditsUsed: number;
    requestCount: number;
    topUpCredits: number;
    topUpCarried: number;
    topUpAddedThisMonth: number;
  }> {
    const month = this.getCurrentMonth();
    const key = this.getUsageKey(userId, month);
    const userTier = tier || 'free';
    this.ensureCurrentMonthRecord(userId, userTier);
    let record = this.usageStore.getCreditRecord(key) as UserUsageRecord | undefined;
    let creditsUsed = 0;
    let topUpCredits = 0;
    let topUpCarried = 0;
    let topUpAddedThisMonth = 0;
    if (record) {
      if (typeof (record as any).topUpCarried === 'number') topUpCarried = (record as any).topUpCarried;
      if (typeof (record as any).topUpAddedThisMonth === 'number') topUpAddedThisMonth = (record as any).topUpAddedThisMonth;
      if (typeof (record as any).topUpCredits === 'number') topUpCredits = (record as any).topUpCredits;
      else {
        topUpCredits = topUpCarried + topUpAddedThisMonth;
        record = { ...record, topUpCredits };
        this.usageStore.setCreditRecord(key, record);
      }
      if (typeof record.creditsUsed === 'number') {
        creditsUsed = record.creditsUsed;
      } else if (typeof record.tokensUsed === 'number') {
        creditsUsed = record.tokensUsed / TOKENS_PER_CREDIT;
        record = { ...record, creditsUsed, requestCount: record.requestCount ?? 0, topUpCredits, topUpCarried, topUpAddedThisMonth };
        this.usageStore.setCreditRecord(key, record);
      }
    }
    const hasRolloverOrUsage = record && ((record as any).creditsUsed > 0 || (record as any).topUpCarried > 0);
    if (record && creditsUsed === 0 && !hasRolloverOrUsage) {
      const fromMunawar = await this.fetchUsageFromMunawar(userId);
      if (fromMunawar && fromMunawar.creditsUsed > 0) {
        creditsUsed = fromMunawar.creditsUsed;
        record = {
          ...record,
          creditsUsed,
          topUpCredits: (record as any).topUpCredits ?? topUpCredits,
          topUpCarried: (record as any).topUpCarried ?? topUpCarried,
          topUpAddedThisMonth: (record as any).topUpAddedThisMonth ?? topUpAddedThisMonth,
        };
        this.usageStore.setCreditRecord(key, record);
        console.log(
          `📥 [Credit] Read-back from Munawar: restored creditsUsed=${creditsUsed.toFixed(2)} for ${userId.slice(0, 8)}...`,
        );
      }
    }
    const out = record
      ? {
          userId: record.userId,
          month: record.month,
          creditsUsed: (record as any).creditsUsed ?? creditsUsed,
          requestCount: record.requestCount ?? 0,
          topUpCredits: (record as any).topUpCredits ?? topUpCredits,
          topUpCarried: (record as any).topUpCarried ?? topUpCarried,
          topUpAddedThisMonth: (record as any).topUpAddedThisMonth ?? topUpAddedThisMonth,
        }
      : { userId, month, creditsUsed: 0, requestCount: 0, topUpCredits: 0, topUpCarried: 0, topUpAddedThisMonth: 0 };
    return out;
  }

  /** Top-up credits for this user this month (carried + added). */
  private getTopUpForUserThisMonth(userId: string): number {
    const month = this.getCurrentMonth();
    const key = this.getUsageKey(userId, month);
    const record = this.usageStore.getCreditRecord(key) as UserUsageRecord | undefined;
    return typeof (record as any)?.topUpCredits === 'number' ? (record as any).topUpCredits : 0;
  }

  /** Effective allowance = tier base + top-up for this month. Base resets each month; only top-up can carry. */
  private getEffectiveAllowance(userId: string, userTier: UserTier): number {
    const base = this.getAllowanceForTier(userTier);
    const topUp = this.getTopUpForUserThisMonth(userId);
    return base + topUp;
  }

  async checkCredits(userId: string, userTier?: UserTier): Promise<CreditCheckResult> {
    const tier = userTier || 'free';
    const baseAllowance = this.getAllowanceForTier(tier);
    const usage = await this.getUsageThisMonth(userId, tier);
    const creditsIncluded = baseAllowance + usage.topUpCredits;
    const creditsUsed = usage.creditsUsed;
    const creditsAvailable = Math.max(0, creditsIncluded - creditsUsed);
    const usagePercentage = creditsIncluded > 0 ? (creditsUsed / creditsIncluded) * 100 : 0;
    const warning = usagePercentage >= 80;
    const allowed = creditsUsed < creditsIncluded;

    let message: string | undefined;
    if (!allowed) {
      message = `Credit limit reached. You've used ${creditsUsed.toFixed(1)} of ${creditsIncluded.toLocaleString()} credits this month. Upgrade your plan or wait until next month.`;
    } else if (warning) {
      message = `You've used ${usagePercentage.toFixed(0)}% of your monthly credits (${creditsUsed.toFixed(1)} / ${creditsIncluded.toLocaleString()}).`;
    }

    return {
      allowed,
      tokensAvailable: Math.round(creditsAvailable * TOKENS_PER_CREDIT),
      tokensUsed: Math.round(creditsUsed * TOKENS_PER_CREDIT),
      tokensIncluded: Math.round(creditsIncluded * TOKENS_PER_CREDIT),
      creditsUsed,
      creditsIncluded,
      baseAllowance,
      topUpCarried: usage.topUpCarried,
      topUpAddedThisMonth: usage.topUpAddedThisMonth,
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
    this.ensureCurrentMonthRecord(userId, 'free');
    const existing = await this.getUsageThisMonth(userId, 'free');
    const creditsToAdd = tokens / TOKENS_PER_CREDIT;
    const newCreditsUsed = existing.creditsUsed + creditsToAdd;

    this.usageStore.setCreditRecord(key, {
      userId,
      month,
      creditsUsed: newCreditsUsed,
      requestCount: existing.requestCount + 1,
      topUpCredits: existing.topUpCredits ?? 0,
      topUpCarried: existing.topUpCarried ?? 0,
      topUpAddedThisMonth: existing.topUpAddedThisMonth ?? 0,
    });

    console.log(
      `📊 [Credit] +${tokens} tokens → +${creditsToAdd.toFixed(2)} credits (${callType}) → total: ${newCreditsUsed.toFixed(2)} credits for ${userId.slice(0, 8)}...`
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
    creditsUsed: number;
    creditsIncluded: number;
    baseAllowance: number;
    topUpCarried: number;
    topUpAddedThisMonth: number;
    usagePercentage: number;
    premiumRepliesUsed: number;
    premiumRepliesIncluded: number;
    frameworkCap: number;
  }> {
    const tier = userTier || 'free';
    const baseAllowance = this.getAllowanceForTier(tier);
    const usage = await this.getUsageThisMonth(userId, tier);
    const creditsIncluded = baseAllowance + usage.topUpCredits;
    const creditsUsed = usage.creditsUsed;
    const usagePercentage = creditsIncluded > 0 ? (creditsUsed / creditsIncluded) * 100 : 0;

    return {
      tokensUsed: Math.round(creditsUsed * TOKENS_PER_CREDIT),
      tokensIncluded: Math.round(creditsIncluded * TOKENS_PER_CREDIT),
      creditsUsed,
      creditsIncluded,
      baseAllowance,
      topUpCarried: usage.topUpCarried,
      topUpAddedThisMonth: usage.topUpAddedThisMonth,
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

  /**
   * Add top-up credits for a user for the current month (called by Munawar's backend after payment).
   * Stored as topUpAddedThisMonth; effective allowance = base + topUpCarried + topUpAddedThisMonth.
   */
  async addTopUp(userId: string, credits: number): Promise<{ creditsAdded: number; totalTopUpThisMonth: number }> {
    if (!Number.isFinite(credits) || credits <= 0) {
      throw new Error('credits must be a positive number');
    }
    this.ensureCurrentMonthRecord(userId, 'free');
    const month = this.getCurrentMonth();
    const key = this.getUsageKey(userId, month);
    const record = this.usageStore.getCreditRecord(key) as UserUsageRecord | undefined;
    const creditsUsed = typeof record?.creditsUsed === 'number' ? record.creditsUsed : (typeof record?.tokensUsed === 'number' ? record.tokensUsed / TOKENS_PER_CREDIT : 0);
    const requestCount = record?.requestCount ?? 0;
    const topUpCarried = typeof (record as any)?.topUpCarried === 'number' ? (record as any).topUpCarried : 0;
    const topUpAddedThisMonth = typeof (record as any)?.topUpAddedThisMonth === 'number' ? (record as any).topUpAddedThisMonth : (typeof (record as any)?.topUpCredits === 'number' ? (record as any).topUpCredits : 0);
    const newTopUpAdded = topUpAddedThisMonth + credits;
    const newTopUpTotal = topUpCarried + newTopUpAdded;

    this.usageStore.setCreditRecord(key, {
      userId,
      month,
      creditsUsed,
      requestCount,
      topUpCredits: newTopUpTotal,
      topUpCarried,
      topUpAddedThisMonth: newTopUpAdded,
    });

    console.log(
      `💰 [Credit] Top-up: +${credits} credits for ${userId.slice(0, 8)}... → total top-up this month: ${newTopUpTotal}`,
    );
    return { creditsAdded: credits, totalTopUpThisMonth: newTopUpTotal };
  }
}
