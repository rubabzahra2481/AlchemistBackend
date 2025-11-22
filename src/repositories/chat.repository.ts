import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatSession } from '../entities/chat-session.entity';
import { ChatMessage } from '../entities/chat-message.entity';

@Injectable()
export class ChatRepository {
  constructor(
    @InjectRepository(ChatSession)
    private readonly sessionRepository: Repository<ChatSession>,
    @InjectRepository(ChatMessage)
    private readonly messageRepository: Repository<ChatMessage>,
  ) {}

  /**
   * Get or create a chat session
   */
  async getOrCreateSession(
    sessionId: string,
    userId: string,
    selectedLLM?: string,
  ): Promise<ChatSession> {
    let session = await this.sessionRepository.findOne({
      where: { id: sessionId, userId },
      relations: ['messages'],
    });

    if (!session) {
      session = this.sessionRepository.create({
        id: sessionId,
        userId,
        title: null,
        currentProfile: null,
        lastActivity: new Date(),
        messageCount: 0,
        selectedLLM: selectedLLM || null,
      });
      await this.sessionRepository.save(session);
    }

    return session;
  }

  /**
   * Save a user message to database
   */
  async saveUserMessage(
    sessionId: string,
    userId: string,
    content: string,
    sequenceNumber: number,
  ): Promise<ChatMessage> {
    const message = this.messageRepository.create({
      sessionId,
      userId,
      role: 'user',
      content,
      sequenceNumber,
      selectedLLM: null,
      reasoning: null,
      analysis: null,
      recommendations: null,
      profileSnapshot: null,
    });

    return await this.messageRepository.save(message);
  }

  /**
   * Save an assistant message with metadata
   */
  async saveAssistantMessage(
    sessionId: string,
    userId: string,
    content: string,
    sequenceNumber: number,
    selectedLLM: string,
    reasoning?: string,
    analysis?: any,
    recommendations?: string[],
    profileSnapshot?: any,
  ): Promise<ChatMessage> {
    const message = this.messageRepository.create({
      sessionId,
      userId,
      role: 'assistant',
      content,
      sequenceNumber,
      selectedLLM,
      reasoning: reasoning || null,
      analysis: analysis || null,
      recommendations: recommendations || null,
      profileSnapshot: profileSnapshot || null,
    });

    return await this.messageRepository.save(message);
  }

  /**
   * Update session metadata
   */
  async updateSession(
    sessionId: string,
    userId: string,
    updates: {
      title?: string;
      currentProfile?: any;
      messageCount?: number;
      selectedLLM?: string;
    },
  ): Promise<void> {
    await this.sessionRepository.update(
      { id: sessionId, userId }, // Only update if user owns session
      {
        ...updates,
        lastActivity: new Date(),
        updatedAt: new Date(),
      },
    );
  }

  /**
   * Get all messages for a session (ordered by sequence number)
   */
  async getSessionMessages(sessionId: string, userId: string): Promise<ChatMessage[]> {
    return await this.messageRepository.find({
      where: { sessionId, userId },
      order: { sequenceNumber: 'ASC' },
    });
  }

  /**
   * Get all sessions for a user (ordered by last activity)
   */
  async getUserSessions(userId: string): Promise<ChatSession[]> {
    return await this.sessionRepository.find({
      where: { userId },
      order: { lastActivity: 'DESC' },
      relations: ['messages'],
      take: 100, // Limit to 100 most recent sessions
    });
  }

  /**
   * Get a single session by ID (only if user owns it)
   */
  async getSessionById(sessionId: string, userId: string): Promise<ChatSession | null> {
    return await this.sessionRepository.findOne({
      where: { id: sessionId, userId },
      relations: ['messages'],
      order: { messages: { sequenceNumber: 'ASC' } },
    });
  }

  /**
   * Delete a session and all its messages (cascade delete)
   */
  async deleteSession(sessionId: string, userId: string): Promise<void> {
    await this.sessionRepository.delete({ id: sessionId, userId });
  }

  /**
   * Get session message count
   */
  async getSessionMessageCount(sessionId: string): Promise<number> {
    return await this.messageRepository.count({ where: { sessionId } });
  }

  /**
   * Get last message for a session (for sidebar display)
   */
  async getLastMessageForSession(sessionId: string, userId: string): Promise<ChatMessage | null> {
    return await this.messageRepository.findOne({
      where: { sessionId, userId },
      order: { sequenceNumber: 'DESC' },
    });
  }
}


