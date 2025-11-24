import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum SubscriptionTier {
  FREE = 'free',
  STARTER = 'starter',
  PRO = 'pro',
  BUSINESS = 'business',
}

@Entity('user_subscriptions')
@Index(['userId'])
export class UserSubscription {
  @PrimaryColumn({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({
    type: 'enum',
    enum: SubscriptionTier,
    default: SubscriptionTier.FREE,
  })
  tier: SubscriptionTier;

  @Column({ type: 'bigint', name: 'tokens_used', default: 0 })
  tokensUsed: number;

  @Column({ type: 'bigint', name: 'tokens_included', default: 0 })
  tokensIncluded: number;

  @Column({ type: 'date', name: 'billing_cycle_start' })
  billingCycleStart: Date;

  @Column({ type: 'date', name: 'billing_cycle_end' })
  billingCycleEnd: Date;

  @Column({ type: 'integer', name: 'premium_replies_used', default: 0 })
  premiumRepliesUsed: number;

  @Column({ type: 'integer', name: 'premium_replies_included', default: 0 })
  premiumRepliesIncluded: number;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

