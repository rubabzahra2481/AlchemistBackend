import { Injectable, OnModuleInit } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Session Service - Local Chat Session Storage
 * 
 * Stores all chat sessions and messages locally (no external dependencies).
 * Uses file-based storage (easily replaceable with PostgreSQL later).
 */

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  sequenceNumber: number;
  metadata?: {
    selectedLLM?: string;
    reasoning?: string;
    analysis?: any;
    recommendations?: string[];
    profileSnapshot?: any;
    frameworksTriggered?: string[];
  };
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  isActive: boolean;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  context?: {
    selectedLLM?: string;
    currentProfile?: any;
  };
}

interface SessionsStore {
  sessions: ChatSession[];
  messages: ChatMessage[];
}

@Injectable()
export class SessionService implements OnModuleInit {
  private sessions: Map<string, ChatSession> = new Map(); // sessionId -> session
  private sessionsByUser: Map<string, Set<string>> = new Map(); // userId -> sessionIds
  private messages: Map<string, ChatMessage[]> = new Map(); // sessionId -> messages
  private readonly storePath: string;

  constructor() {
    this.storePath = path.join(process.cwd(), 'data', 'sessions.json');
  }

  async onModuleInit() {
    await this.loadData();
    console.log(`💬 [SessionService] Initialized with ${this.sessions.size} sessions`);
  }

  /**
   * Load data from file storage
   */
  private async loadData(): Promise<void> {
    try {
      const dataDir = path.dirname(this.storePath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      if (fs.existsSync(this.storePath)) {
        const data = fs.readFileSync(this.storePath, 'utf-8');
        const store: SessionsStore = JSON.parse(data);

        for (const session of store.sessions) {
          this.sessions.set(session.id, session);
          
          if (!this.sessionsByUser.has(session.userId)) {
            this.sessionsByUser.set(session.userId, new Set());
          }
          this.sessionsByUser.get(session.userId)!.add(session.id);
        }

        for (const message of store.messages) {
          if (!this.messages.has(message.sessionId)) {
            this.messages.set(message.sessionId, []);
          }
          this.messages.get(message.sessionId)!.push(message);
        }
      }
    } catch (error: any) {
      console.warn(`⚠️ [SessionService] Could not load data: ${error.message}`);
    }
  }

  /**
   * Save data to file storage
   */
  private async saveData(): Promise<void> {
    try {
      const dataDir = path.dirname(this.storePath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      const allMessages: ChatMessage[] = [];
      this.messages.forEach(msgs => allMessages.push(...msgs));

      const store: SessionsStore = {
        sessions: Array.from(this.sessions.values()),
        messages: allMessages,
      };

      fs.writeFileSync(this.storePath, JSON.stringify(store, null, 2));
    } catch (error: any) {
      console.error(`❌ [SessionService] Could not save data: ${error.message}`);
    }
  }

  /**
   * Get or create a session
   */
  async getOrCreateSession(
    sessionId: string,
    userId: string,
    selectedLLM?: string,
  ): Promise<ChatSession> {
    // Check if session exists
    let session = this.sessions.get(sessionId);
    
    if (session) {
      return session;
    }

    // Create new session
    const now = new Date().toISOString();
    session = {
      id: sessionId,
      userId,
      title: 'New Chat',
      isActive: true,
      messageCount: 0,
      createdAt: now,
      updatedAt: now,
      context: { selectedLLM },
    };

    this.sessions.set(sessionId, session);
    this.messages.set(sessionId, []);

    if (!this.sessionsByUser.has(userId)) {
      this.sessionsByUser.set(userId, new Set());
    }
    this.sessionsByUser.get(userId)!.add(sessionId);

    await this.saveData();
    console.log(`✅ [SessionService] Created session: ${sessionId} for user: ${userId}`);
    
    return session;
  }

  /**
   * Save a message
   */
  async saveMessage(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
    metadata?: ChatMessage['metadata'],
  ): Promise<ChatMessage> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const messages = this.messages.get(sessionId) || [];
    const sequenceNumber = messages.length + 1;

    const message: ChatMessage = {
      id: uuidv4(),
      sessionId,
      role,
      content,
      createdAt: new Date().toISOString(),
      sequenceNumber,
      metadata,
    };

    messages.push(message);
    this.messages.set(sessionId, messages);

    // Update session
    session.messageCount = messages.length;
    session.updatedAt = message.createdAt;
    
    // Auto-generate title from first user message
    if (role === 'user' && messages.length === 1) {
      session.title = content.substring(0, 50) + (content.length > 50 ? '...' : '');
    }

    await this.saveData();
    return message;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): ChatSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get all sessions for a user
   */
  getUserSessions(userId: string, limit: number = 20): ChatSession[] {
    const sessionIds = this.sessionsByUser.get(userId);
    if (!sessionIds) return [];

    const sessions = Array.from(sessionIds)
      .map(id => this.sessions.get(id)!)
      .filter(s => s != null)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limit);

    return sessions;
  }

  /**
   * Get messages for a session
   */
  getSessionMessages(sessionId: string): ChatMessage[] {
    return this.messages.get(sessionId) || [];
  }

  /**
   * Update session
   */
  async updateSession(
    sessionId: string,
    updates: Partial<Pick<ChatSession, 'title' | 'context' | 'isActive'>>,
  ): Promise<ChatSession | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    if (updates.title !== undefined) session.title = updates.title;
    if (updates.context !== undefined) session.context = { ...session.context, ...updates.context };
    if (updates.isActive !== undefined) session.isActive = updates.isActive;
    session.updatedAt = new Date().toISOString();

    await this.saveData();
    return session;
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    this.sessions.delete(sessionId);
    this.messages.delete(sessionId);
    
    const userSessions = this.sessionsByUser.get(session.userId);
    if (userSessions) {
      userSessions.delete(sessionId);
    }

    await this.saveData();
    console.log(`🗑️ [SessionService] Deleted session: ${sessionId}`);
    return true;
  }

  /**
   * Get message count for session
   */
  getMessageCount(sessionId: string): number {
    return this.messages.get(sessionId)?.length || 0;
  }

  /**
   * Get last message for session
   */
  getLastMessage(sessionId: string): ChatMessage | null {
    const messages = this.messages.get(sessionId);
    if (!messages || messages.length === 0) return null;
    return messages[messages.length - 1];
  }
}
