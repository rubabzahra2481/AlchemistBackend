import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ChatSession } from './chat-session.entity';

@Entity('chat_messages')
@Index(['sessionId', 'sequenceNumber'], { unique: true })
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'session_id', nullable: false })
  sessionId: string;

  @Column({ type: 'uuid', name: 'user_id', nullable: false })
  userId: string;

  @Column({ type: 'varchar', length: 20, nullable: false })
  role: 'user' | 'assistant';

  @Column({ type: 'text', nullable: false })
  content: string;

  @Column({ type: 'integer', name: 'sequence_number', nullable: false })
  sequenceNumber: number;

  @Column({ type: 'varchar', length: 50, name: 'selected_llm', nullable: true })
  selectedLLM: string | null;

  // Assistant message metadata (null for user messages)
  @Column({ type: 'text', nullable: true })
  reasoning: string | null;

  @Column({ type: 'jsonb', nullable: true })
  analysis: any | null;

  @Column({ type: 'text', array: true, nullable: true })
  recommendations: string[] | null;

  @Column({ type: 'jsonb', name: 'profile_snapshot', nullable: true })
  profileSnapshot: any | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @ManyToOne(() => ChatSession, (session) => session.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'session_id' })
  session: ChatSession;
}


