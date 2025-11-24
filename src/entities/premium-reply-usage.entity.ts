import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('premium_reply_usage')
@Index(['userId', 'billingMonth'])
export class PremiumReplyUsage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id', nullable: false })
  userId: string;

  @Column({ type: 'uuid', name: 'session_id', nullable: true })
  sessionId: string | null;

  @Column({ type: 'varchar', length: 7, name: 'billing_month', nullable: false })
  billingMonth: string; // Format: 'YYYY-MM' for monthly tracking

  @Column({ type: 'integer', default: 0 })
  count: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'total_cost', default: 0 })
  totalCost: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @CreateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

