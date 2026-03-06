import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IOSBackendService } from '../services/ios-backend.service';

/** Credit snapshot for iOS: stored in message metadata (Munawar agent_messages.metadata JSONB). 1 credit = 1000 tokens. */
export interface CreditsSnapshot {
  allowed: boolean;
  tokensUsed: number;
  tokensIncluded: number;
  creditsUsed: number;
  creditsIncluded: number;
  /** Base monthly allowance (resets each month). */
  baseAllowance?: number;
  /** Top-up carried from previous month (unused). */
  topUpCarried?: number;
  /** Top-up purchased this month. */
  topUpAddedThisMonth?: number;
  usagePercentage: number;
  warning: boolean;
  message: string | null;
}

/**
 * Chat Repository Adapter - Uses Munawar's Backend Only
 * 
 * All chat data (sessions, messages) is stored in Munawar's backend → Supabase.
 * No local database required.
 * 
 * All methods accept optional userJwt parameter:
 * - Production: JWT passed from iOS app in request header
 * - Local dev: Falls back to test credentials
 */
@Injectable()
export class ChatRepositoryAdapter {
  constructor(
    private configService: ConfigService,
    private iosBackend: IOSBackendService,
  ) {
    console.log('📦 [ChatRepositoryAdapter] Using Munawar\'s Backend API for all data storage');
  }

  /**
   * Get or create a chat session
   */
  async getOrCreateSession(
    sessionId: string,
    userId: string,
    selectedLLM?: string,
    userJwt?: string,
  ): Promise<any> {
      try {
        // Try to get existing session first
      const existing = await this.iosBackend.getSession(sessionId, userJwt);
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
    const result = await this.iosBackend.createSession(userId, undefined, { selectedLLM }, userJwt);
      return {
        id: result.session.id,
        userId: result.session.userId,
        title: result.session.title,
        isActive: result.session.isActive,
        messageCount: 0,
        createdAt: result.session.startedAt,
      };
  }

  /**
   * Save a user message
   */
  /** Ensure content is non-empty so iOS backend does not return 400 "Content is required". */
  private ensureContent(content: string | undefined | null, fallback: string): string {
    const s = typeof content === 'string' ? content.trim() : '';
    return s.length > 0 ? s : fallback;
  }

  async saveUserMessage(
    sessionId: string,
    userId: string,
    content: string,
    sequenceNumber: number,
    userJwt?: string,
  ): Promise<any> {
      const safeContent = this.ensureContent(content, '(No message content)');
      const result = await this.iosBackend.createMessage(sessionId, 'user', safeContent, {
        sequenceNumber,
    }, userJwt);
      return {
        id: result.message.id,
        sessionId: result.message.sessionId,
        role: result.message.role,
        content: result.message.content,
        createdAt: result.message.createdAt,
      };
  }

  /**
   * Save an assistant message with metadata (including optional credits snapshot for iOS).
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
    userJwt?: string,
    creditsSnapshot?: CreditsSnapshot,
  ): Promise<any> {
      const metadata: Record<string, unknown> = {
        sequenceNumber,
        selectedLLM,
        reasoning,
        analysis,
        recommendations,
        profileSnapshot,
        frameworksTriggered,
      };
      if (creditsSnapshot) {
        metadata.credits = creditsSnapshot;
      }
      const safeContent = this.ensureContent(content, '(Response unavailable. Please try again.)');
      const result = await this.iosBackend.createMessage(sessionId, 'agent', safeContent, metadata, userJwt);
      return {
        id: result.message.id,
        sessionId: result.message.sessionId,
        role: result.message.role,
        content: result.message.content,
        createdAt: result.message.createdAt,
      };
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
    userJwt?: string,
  ): Promise<void> {
      await this.iosBackend.updateSession(sessionId, {
        title: updates.title,
        context: {
          currentProfile: updates.currentProfile,
          selectedLLM: updates.selectedLLM,
        },
    }, userJwt);
  }

  /**
   * Get all messages for a session
   */
  async getSessionMessages(sessionId: string, userId: string, userJwt?: string): Promise<any[]> {
      try {
      const result = await this.iosBackend.getSessionMessages(sessionId, 100, 0, userJwt);
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
      console.error('❌ [ChatRepositoryAdapter] getSessionMessages FAILED');
      console.error(`   Session ID: ${sessionId}`);
      console.error(`   User ID: ${userId}`);
      console.error(`   JWT provided: ${!!userJwt}`);
      console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`);
        return [];
      }
  }

  /**
   * Get all sessions for a user
   */
  async getUserSessions(userId: string, userJwt?: string): Promise<any[]> {
      try {
      const result = await this.iosBackend.getUserSessions(userId, undefined, 20, userJwt);
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

  /**
   * Get a single session by ID
   */
  async getSessionById(sessionId: string, userId: string, userJwt?: string): Promise<any | null> {
      try {
      const result = await this.iosBackend.getSession(sessionId, userJwt);
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

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string, userId: string, userJwt?: string): Promise<void> {
    await this.iosBackend.deleteSession(sessionId, userJwt);
  }

  /**
   * Get session message count
   */
  async getSessionMessageCount(sessionId: string, userJwt?: string): Promise<number> {
    return await this.iosBackend.getMessageCount(sessionId, userJwt);
  }

  /**
   * Get last message for a session
   */
  async getLastMessageForSession(sessionId: string, userId: string, userJwt?: string): Promise<any | null> {
    const result = await this.iosBackend.getLastMessage(sessionId, userJwt);
    if (!result?.success) return null;
      return {
        id: result.message.id,
        sessionId: result.message.sessionId,
        role: result.message.role === 'agent' ? 'assistant' : result.message.role,
        content: result.message.content,
        createdAt: new Date(result.message.createdAt),
      };
  }

  /**
   * Get user's E-DNA profile from iOS backend
   */
  async getUserEDNAProfile(userId: string, userJwt?: string): Promise<any | null> {
    return await this.iosBackend.getUserProfile(userId, userJwt);
  }
}
