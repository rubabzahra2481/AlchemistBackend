import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatRepository } from './chat.repository';
import { IOSBackendService } from '../services/ios-backend.service';

/**
 * Chat Repository Adapter
 * 
 * Switches between local database (PostgreSQL) and iOS Backend API (Munawar's backend)
 * based on environment configuration.
 * 
 * Set USE_IOS_BACKEND=true in .env to use iOS backend
 * Set USE_IOS_BACKEND=false (or omit) to use local database
 */
@Injectable()
export class ChatRepositoryAdapter {
  private readonly useIOSBackend: boolean;

  constructor(
    private configService: ConfigService,
    private localRepository: ChatRepository,
    private iosBackend: IOSBackendService,
  ) {
    this.useIOSBackend = this.configService.get<string>('USE_IOS_BACKEND') === 'true';
    console.log(`📦 [ChatRepositoryAdapter] Using ${this.useIOSBackend ? 'iOS Backend (Munawar API)' : 'Local Database'}`);
  }

  /**
   * Get or create a chat session
   */
  async getOrCreateSession(
    sessionId: string,
    userId: string,
    selectedLLM?: string,
  ): Promise<any> {
    if (this.useIOSBackend) {
      try {
        // Try to get existing session first
        const existing = await this.iosBackend.getSession(sessionId);
        if (existing?.success) {
          return {
            id: existing.session.id,
            userId: existing.session.userId,
            title: existing.session.title,
            isActive: existing.session.isActive,
            messageCount: existing.session.messageCount || 0,
            createdAt: existing.session.startedAt,
          };
        }
      } catch (error) {
        // Session doesn't exist, create new one
      }
      
      // Create new session
      const result = await this.iosBackend.createSession(userId, undefined, { selectedLLM });
      return {
        id: result.session.id,
        userId: result.session.userId,
        title: result.session.title,
        isActive: result.session.isActive,
        messageCount: 0,
        createdAt: result.session.startedAt,
      };
    }
    return await this.localRepository.getOrCreateSession(sessionId, userId, selectedLLM);
  }

  /**
   * Save a user message
   */
  async saveUserMessage(
    sessionId: string,
    userId: string,
    content: string,
    sequenceNumber: number,
  ): Promise<any> {
    if (this.useIOSBackend) {
      const result = await this.iosBackend.createMessage(sessionId, 'user', content, {
        sequenceNumber,
      });
      return {
        id: result.message.id,
        sessionId: result.message.sessionId,
        role: result.message.role,
        content: result.message.content,
        createdAt: result.message.createdAt,
      };
    }
    return await this.localRepository.saveUserMessage(sessionId, userId, content, sequenceNumber);
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
    frameworksTriggered?: string[],
  ): Promise<any> {
    if (this.useIOSBackend) {
      const result = await this.iosBackend.createMessage(sessionId, 'agent', content, {
        sequenceNumber,
        selectedLLM,
        reasoning,
        analysis,
        recommendations,
        profileSnapshot,
        frameworksTriggered,
      });
      return {
        id: result.message.id,
        sessionId: result.message.sessionId,
        role: result.message.role,
        content: result.message.content,
        createdAt: result.message.createdAt,
      };
    }
    return await this.localRepository.saveAssistantMessage(
      sessionId, userId, content, sequenceNumber,
      selectedLLM, reasoning, analysis, recommendations, profileSnapshot,
    );
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
    if (this.useIOSBackend) {
      await this.iosBackend.updateSession(sessionId, {
        title: updates.title,
        context: {
          currentProfile: updates.currentProfile,
          selectedLLM: updates.selectedLLM,
        },
      });
      return;
    }
    await this.localRepository.updateSession(sessionId, userId, updates);
  }

  /**
   * Get all messages for a session
   */
  async getSessionMessages(sessionId: string, userId: string): Promise<any[]> {
    if (this.useIOSBackend) {
      try {
        const result = await this.iosBackend.getSessionMessages(sessionId);
        return result.messages.map(m => ({
          id: m.id,
          sessionId: m.sessionId,
          role: m.role === 'agent' ? 'assistant' : m.role,
          content: m.content,
          createdAt: new Date(m.createdAt),
          sequenceNumber: m.metadata?.sequenceNumber,
          reasoning: m.metadata?.reasoning,
          analysis: m.metadata?.analysis,
          recommendations: m.metadata?.recommendations,
          profileSnapshot: m.metadata?.profileSnapshot,
        }));
      } catch (error) {
        console.warn(`⚠️ [ChatRepositoryAdapter] Could not fetch messages: ${error}`);
        return [];
      }
    }
    return await this.localRepository.getSessionMessages(sessionId, userId);
  }

  /**
   * Get all sessions for a user
   */
  async getUserSessions(userId: string): Promise<any[]> {
    if (this.useIOSBackend) {
      try {
        const result = await this.iosBackend.getUserSessions(userId);
        return result.sessions.map(s => ({
          id: s.id,
          title: s.title,
          lastActivity: s.endedAt || s.startedAt,
          messageCount: s.messageCount,
          createdAt: s.startedAt,
          isActive: s.isActive,
        }));
      } catch (error) {
        console.warn(`⚠️ [ChatRepositoryAdapter] Could not fetch sessions: ${error}`);
        return [];
      }
    }
    return await this.localRepository.getUserSessions(userId);
  }

  /**
   * Get a single session by ID
   */
  async getSessionById(sessionId: string, userId: string): Promise<any | null> {
    if (this.useIOSBackend) {
      try {
        const result = await this.iosBackend.getSession(sessionId);
        if (!result?.success) return null;
        return {
          id: result.session.id,
          userId: result.session.userId,
          title: result.session.title,
          isActive: result.session.isActive,
          messageCount: result.session.messageCount,
          createdAt: result.session.startedAt,
        };
      } catch (error) {
        return null;
      }
    }
    return await this.localRepository.getSessionById(sessionId, userId);
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string, userId: string): Promise<void> {
    if (this.useIOSBackend) {
      await this.iosBackend.deleteSession(sessionId);
      return;
    }
    await this.localRepository.deleteSession(sessionId, userId);
  }

  /**
   * Get session message count
   */
  async getSessionMessageCount(sessionId: string): Promise<number> {
    if (this.useIOSBackend) {
      return await this.iosBackend.getMessageCount(sessionId);
    }
    return await this.localRepository.getSessionMessageCount(sessionId);
  }

  /**
   * Get last message for a session
   */
  async getLastMessageForSession(sessionId: string, userId: string): Promise<any | null> {
    if (this.useIOSBackend) {
      const result = await this.iosBackend.getLastMessage(sessionId);
      if (!result?.success) return null;
      return {
        id: result.message.id,
        sessionId: result.message.sessionId,
        role: result.message.role === 'agent' ? 'assistant' : result.message.role,
        content: result.message.content,
        createdAt: new Date(result.message.createdAt),
      };
    }
    return await this.localRepository.getLastMessageForSession(sessionId, userId);
  }

  /**
   * Get user's E-DNA profile from iOS backend
   */
  async getUserEDNAProfile(userId: string): Promise<any | null> {
    if (this.useIOSBackend) {
      return await this.iosBackend.getUserProfile(userId);
    }
    return null;
  }
}
