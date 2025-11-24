import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('token_usage_logs')
@Index(['userId', 'createdAt'])
@Index(['sessionId'])
export class TokenUsageLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id', nullable: false })
  userId: string;

  @Column({ type: 'uuid', name: 'session_id', nullable: true })
  sessionId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: false })
  endpoint: string;

  @Column({ type: 'bigint', default: 0 })
  tokens: number;

  @Column({ type: 'integer', name: 'input_tokens', default: 0 })
  inputTokens: number;

  @Column({ type: 'integer', name: 'output_tokens', default: 0 })
  outputTokens: number;

  @Column({ type: 'varchar', length: 50, name: 'llm_model', nullable: true })
  llmModel: string | null;

  @Column({ type: 'varchar', length: 50, name: 'call_type', nullable: true })
  callType: string | null; // 'classification', 'framework', 'summary', 'advice'

  @Column({ type: 'varchar', length: 50, name: 'framework_name', nullable: true })
  frameworkName: string | null; // 'bigFive', 'dass', 'rse', etc.

  @Column({ type: 'boolean', name: 'is_premium', default: false })
  isPremium: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}

