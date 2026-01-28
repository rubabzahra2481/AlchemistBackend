import { Injectable, HttpException, HttpStatus, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * iOS Backend Integration Service
 * Connects to Munawar's backend API with JWT authentication
 * 
 * Base URL: Configured via IOS_BACKEND_URL environment variable
 * Auth: JWT token from /api/agent/auth/login
 */

// User E-DNA Profile response
export interface UserEDNAProfile {
  success: boolean;
  user: {
    id: string;
    email?: string;
    name?: string;
    typeId?: string;
    tier: string;
  };
  ednaProfile: {
    coreType: string;
    subtype?: string;
    confidence: number;
    completionPercentage: number;
  };
}

// User response
export interface UserResponse {
  success: boolean;
  user: {
    id: string;
    email: string;
    name?: string;
    type_id?: string;
    tier: string;
    hasCompletedQuiz?: boolean;
    createdAt: string;
    updatedAt?: string;
  };
}

// Users list response
export interface UsersListResponse {
  success: boolean;
  users: Array<{
    id: string;
    email: string;
    name?: string;
    type_id?: string;
    tier: string;
    hasCompletedQuiz?: boolean;
    createdAt: string;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Session response
export interface SessionResponse {
  success: boolean;
  session: {
    id: string;
    userId: string;
    agentId?: string;
    title?: string;
    context?: any;
    isActive: boolean;
    startedAt: string;
    endedAt?: string;
    messageCount?: number;
  };
}

// Sessions list response
export interface SessionsListResponse {
  success: boolean;
  sessions: Array<{
    id: string;
    title?: string;
    isActive: boolean;
    startedAt: string;
    endedAt?: string;
    messageCount: number;
  }>;
}

// Message response
export interface MessageResponse {
  success: boolean;
  message: {
    id: string;
    sessionId: string;
    role: 'user' | 'agent';
    content: string;
    metadata?: any;
    createdAt: string;
  };
}

// Messages list response
export interface MessagesListResponse {
  success: boolean;
  messages: Array<{
    id: string;
    sessionId: string;
    role: 'user' | 'agent';
    content: string;
    metadata?: any;
    createdAt: string;
  }>;
  total: number;
}

// Quiz history response
export interface QuizHistoryResponse {
  success: boolean;
  quizHistory: Array<{
    sessionId: string;
    layerNumber: number;
    questionsAnswered: number;
    totalQuestions: number;
    completedAt: string;
    identity: string;
  }>;
}

// Workbooks response
export interface WorkbooksResponse {
  success: boolean;
  user: {
    typeId: string;
    tier: string;
    tierRank: number;
  };
  workbooks: Array<{
    id: string;
    name: string;
    title: string;
    typeId: string;
    tier: string;
    createdAt: string;
    hasInstance: boolean;
    lastSavedAt?: string;
    isCompleted: boolean;
  }>;
}

@Injectable()
export class IOSBackendService implements OnModuleInit {
  private readonly baseUrl: string;
  private readonly agentEmail: string;
  private readonly agentPassword: string;
  private jwtToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private readonly timeout = 30000;

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('IOS_BACKEND_URL') || 
      'http://192.168.0.219:3000';
    this.agentEmail = this.configService.get<string>('IOS_BACKEND_EMAIL') || 
      'rubab@brandscaling.com';
    this.agentPassword = this.configService.get<string>('IOS_BACKEND_PASSWORD') || 
      'rubab-secure-password-2026';
    
    console.log(`🔗 [IOSBackend] Initialized with base URL: ${this.baseUrl}`);
  }

  /**
   * Initialize - login on module start (non-blocking)
   */
  async onModuleInit() {
    if (this.configService.get<string>('USE_IOS_BACKEND') === 'true' ||
        this.configService.get<string>('USE_IOS_EDNA') === 'true') {
      console.log('🔐 [IOSBackend] Attempting initial login...');
      try {
        await this.login();
      } catch (error: any) {
        console.warn(`⚠️ [IOSBackend] Initial login failed (will retry on first request): ${error?.message}`);
        // Don't crash - will retry on first actual request
      }
    }
  }

  /**
   * Login to get JWT token
   */
  async login(): Promise<boolean> {
    try {
      console.log(`🔐 [IOSBackend] Logging in as ${this.agentEmail}...`);
      
      const response = await fetch(`${this.baseUrl}/api/agent/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: this.agentEmail,
          password: this.agentPassword,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`❌ [IOSBackend] Login failed: ${error}`);
        return false;
      }

      const data = await response.json();
      if (data.success && data.token) {
        this.jwtToken = data.token;
        // Token expires in 24 hours, refresh at 23 hours
        this.tokenExpiry = new Date(Date.now() + 23 * 60 * 60 * 1000);
        console.log(`✅ [IOSBackend] Login successful! Agent ID: ${data.agent?.id}`);
        return true;
      }

      console.error(`❌ [IOSBackend] Login failed: No token in response`);
      return false;
    } catch (error: any) {
      console.error(`❌ [IOSBackend] Login error:`, error.message);
      return false;
    }
  }

  /**
   * Ensure we have a valid token
   */
  private async ensureAuthenticated(): Promise<void> {
    if (!this.jwtToken || !this.tokenExpiry || new Date() > this.tokenExpiry) {
      const success = await this.login();
      if (!success) {
        throw new HttpException('Failed to authenticate with iOS backend', HttpStatus.UNAUTHORIZED);
      }
    }
  }

  /**
   * Make authenticated request to iOS backend
   */
  private async makeRequest<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    endpoint: string,
    body?: any,
  ): Promise<T> {
    await this.ensureAuthenticated();

    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.jwtToken}`,
    };

    const options: RequestInit = {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    };

    try {
      console.log(`📤 [IOSBackend] ${method} ${endpoint}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      // Handle 401 - try to re-login once
      if (response.status === 401) {
        console.log('🔄 [IOSBackend] Token expired, re-authenticating...');
        this.jwtToken = null;
        await this.ensureAuthenticated();
        
        // Retry request with new token
        headers['Authorization'] = `Bearer ${this.jwtToken}`;
        const retryResponse = await fetch(url, { ...options, headers });
        
        if (!retryResponse.ok) {
          const errorText = await retryResponse.text();
          throw new HttpException(
            `iOS Backend Error: ${retryResponse.status} - ${errorText}`,
            retryResponse.status,
          );
        }
        
        const data = await retryResponse.json();
        console.log(`📥 [IOSBackend] Success (after retry): ${endpoint}`);
        return data as T;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [IOSBackend] Error ${response.status}: ${errorText}`);
        throw new HttpException(
          `iOS Backend Error: ${response.status} - ${errorText}`,
          response.status,
        );
      }

      const data = await response.json();
      console.log(`📥 [IOSBackend] Success: ${endpoint}`);
      return data as T;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new HttpException('iOS Backend request timeout', HttpStatus.GATEWAY_TIMEOUT);
      }
      if (error instanceof HttpException) {
        throw error;
      }
      console.error(`❌ [IOSBackend] Request failed:`, error.message);
      throw new HttpException(
        `iOS Backend connection error: ${error.message}`,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  // ============================================
  // USER ENDPOINTS
  // ============================================

  /**
   * Get all users with pagination
   */
  async getAllUsers(page: number = 1, limit: number = 50, search?: string): Promise<UsersListResponse> {
    let endpoint = `/api/agent/users?page=${page}&limit=${limit}`;
    if (search) {
      endpoint += `&search=${encodeURIComponent(search)}`;
    }
    return await this.makeRequest<UsersListResponse>('GET', endpoint);
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<UserResponse> {
    return await this.makeRequest<UserResponse>('GET', `/api/agent/users/${userId}`);
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<UserResponse> {
    return await this.makeRequest<UserResponse>(
      'GET',
      `/api/agent/users/by-email/${encodeURIComponent(email)}`,
    );
  }

  /**
   * Get user's E-DNA profile
   */
  async getUserProfile(userId: string): Promise<UserEDNAProfile | null> {
    try {
      return await this.makeRequest<UserEDNAProfile>(
        'GET',
        `/api/agent/users/${userId}/profile`,
      );
    } catch (error) {
      console.warn(`⚠️ [IOSBackend] Could not fetch user profile for ${userId}`);
      return null;
    }
  }

  /**
   * Get user's workbooks
   */
  async getUserWorkbooks(userId: string): Promise<WorkbooksResponse | null> {
    try {
      return await this.makeRequest<WorkbooksResponse>(
        'GET',
        `/api/agent/users/${userId}/workbooks`,
      );
    } catch (error) {
      console.warn(`⚠️ [IOSBackend] Could not fetch workbooks for ${userId}`);
      return null;
    }
  }

  /**
   * Get user's quiz history
   */
  async getUserQuizHistory(userId: string): Promise<QuizHistoryResponse | null> {
    try {
      return await this.makeRequest<QuizHistoryResponse>(
        'GET',
        `/api/agent/users/${userId}/quiz-history`,
      );
    } catch (error) {
      console.warn(`⚠️ [IOSBackend] Could not fetch quiz history for ${userId}`);
      return null;
    }
  }

  /**
   * Get user's complete E-DNA quiz results (7-layer data)
   */
  async getUserQuizResults(userId: string): Promise<any | null> {
    try {
      return await this.makeRequest<any>(
        'GET',
        `/api/agent/users/${userId}/quiz-results`,
      );
    } catch (error) {
      console.warn(`⚠️ [IOSBackend] Could not fetch quiz results for ${userId}`);
      return null;
    }
  }

  // ============================================
  // SESSION ENDPOINTS
  // ============================================

  /**
   * Create a new chat session
   */
  async createSession(
    userId: string,
    title?: string,
    context?: any,
  ): Promise<SessionResponse> {
    return await this.makeRequest<SessionResponse>(
      'POST',
      `/api/agent/sessions`,
      { userId, title, context },
    );
  }

  /**
   * Get user's sessions
   */
  async getUserSessions(userId: string, active?: boolean, limit: number = 20): Promise<SessionsListResponse> {
    let endpoint = `/api/agent/users/${userId}/sessions?limit=${limit}`;
    if (active !== undefined) {
      endpoint += `&active=${active}`;
    }
    return await this.makeRequest<SessionsListResponse>('GET', endpoint);
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<SessionResponse> {
    return await this.makeRequest<SessionResponse>('GET', `/api/agent/sessions/${sessionId}`);
  }

  /**
   * Update session
   */
  async updateSession(
    sessionId: string,
    updates: {
      title?: string;
      context?: any;
      isActive?: boolean;
    },
  ): Promise<SessionResponse> {
    return await this.makeRequest<SessionResponse>(
      'PATCH',
      `/api/agent/sessions/${sessionId}`,
      updates,
    );
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<{ success: boolean; message: string }> {
    return await this.makeRequest<{ success: boolean; message: string }>(
      'DELETE',
      `/api/agent/sessions/${sessionId}`,
    );
  }

  // ============================================
  // MESSAGE ENDPOINTS
  // ============================================

  /**
   * Get session messages
   */
  async getSessionMessages(
    sessionId: string,
    limit: number = 100,
    offset: number = 0,
  ): Promise<MessagesListResponse> {
    return await this.makeRequest<MessagesListResponse>(
      'GET',
      `/api/agent/sessions/${sessionId}/messages?limit=${limit}&offset=${offset}`,
    );
  }

  /**
   * Create a message
   */
  async createMessage(
    sessionId: string,
    role: 'user' | 'agent',
    content: string,
    metadata?: any,
  ): Promise<MessageResponse> {
    return await this.makeRequest<MessageResponse>(
      'POST',
      `/api/agent/sessions/${sessionId}/messages`,
      { role, content, metadata },
    );
  }

  /**
   * Get last message in session
   */
  async getLastMessage(sessionId: string): Promise<MessageResponse | null> {
    try {
      return await this.makeRequest<MessageResponse>(
        'GET',
        `/api/agent/sessions/${sessionId}/messages/last`,
      );
    } catch (error) {
      return null;
    }
  }

  /**
   * Get message count for session
   */
  async getMessageCount(sessionId: string): Promise<number> {
    try {
      const result = await this.makeRequest<{ success: boolean; count: number }>(
        'GET',
        `/api/agent/sessions/${sessionId}/messages/count`,
      );
      return result.count;
    } catch (error) {
      return 0;
    }
  }

  // ============================================
  // HEALTH CHECK
  // ============================================

  /**
   * Check if iOS backend is available and we can authenticate
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.ensureAuthenticated();
      return true;
    } catch (error) {
      return false;
    }
  }
}
