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
  private readonly timeout = 30000;
  
  // For local testing only - production uses JWT passthrough
  private readonly testEmail: string;
  private readonly testPassword: string;
  private testJwtToken: string | null = null;
  private testTokenExpiry: Date | null = null;
  private readonly isLocalDev: boolean;

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('IOS_BACKEND_URL') || 
      'http://192.168.0.219:3000';
    
    // Test credentials only for local development
    this.testEmail = this.configService.get<string>('IOS_BACKEND_EMAIL') || '';
    this.testPassword = this.configService.get<string>('IOS_BACKEND_PASSWORD') || '';
    this.isLocalDev = !!this.testEmail && !!this.testPassword;
    
    console.log(`🔗 [IOSBackend] Initialized with base URL: ${this.baseUrl}`);
    console.log(`🔗 [IOSBackend] Mode: ${this.isLocalDev ? 'LOCAL DEV (test login)' : 'PRODUCTION (JWT passthrough)'}`);
  }

  /**
   * Initialize - only login in local dev mode
   */
  async onModuleInit() {
    if (this.isLocalDev && (
        this.configService.get<string>('USE_IOS_BACKEND') === 'true' ||
        this.configService.get<string>('USE_IOS_EDNA') === 'true')) {
      console.log('🔐 [IOSBackend] LOCAL DEV: Attempting test login...');
      try {
        await this.loginForLocalDev();
      } catch (error: any) {
        console.warn(`⚠️ [IOSBackend] Test login failed: ${error?.message}`);
      }
    }
  }

  /**
   * Login for LOCAL DEVELOPMENT only
   * Production uses JWT passthrough from iOS app
   */
  private async loginForLocalDev(): Promise<boolean> {
    if (!this.testEmail || !this.testPassword) {
      console.log('🔐 [IOSBackend] No test credentials - skipping dev login');
      return false;
    }
    
    try {
      console.log(`🔐 [IOSBackend] DEV: Logging in as ${this.testEmail}...`);
      
      const response = await fetch(`${this.baseUrl}/api/agent/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: this.testEmail,
          password: this.testPassword,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`❌ [IOSBackend] DEV login failed: ${error}`);
        return false;
      }

      const data = await response.json();
      if (data.success && data.token) {
        this.testJwtToken = data.token;
        this.testTokenExpiry = new Date(Date.now() + 23 * 60 * 60 * 1000);
        console.log(`✅ [IOSBackend] DEV login successful!`);
        return true;
      }

      return false;
    } catch (error: any) {
      console.error(`❌ [IOSBackend] DEV login error:`, error.message);
      return false;
    }
  }

  /**
   * Get effective JWT - use passed token or fall back to dev token
   */
  private async getEffectiveJwt(userJwt?: string): Promise<string> {
    // Production: Use the JWT passed from iOS app
    if (userJwt) {
      return userJwt;
    }
    
    // Local dev fallback: Use test token
    if (this.isLocalDev) {
      if (!this.testJwtToken || !this.testTokenExpiry || new Date() > this.testTokenExpiry) {
        await this.loginForLocalDev();
      }
      if (this.testJwtToken) {
        return this.testJwtToken;
      }
    }
    
    throw new HttpException(
      'No JWT token available - iOS app must send Authorization header',
      HttpStatus.UNAUTHORIZED
    );
  }

  /**
   * Make authenticated request to iOS backend
   * @param userJwt - JWT token from iOS app (production) - optional for local dev
   */
  private async makeRequest<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    endpoint: string,
    body?: any,
    userJwt?: string,
  ): Promise<T> {
    const jwt = await this.getEffectiveJwt(userJwt);
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwt}`,
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

      // Handle 401 - token is invalid/expired
      if (response.status === 401) {
        console.error('❌ [IOSBackend] JWT token is invalid or expired');
          throw new HttpException(
          'JWT token is invalid or expired - user needs to re-login in iOS app',
          HttpStatus.UNAUTHORIZED,
          );
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
  // All methods accept optional userJwt for production JWT passthrough
  // ============================================

  /**
   * Get all users with pagination
   */
  async getAllUsers(page: number = 1, limit: number = 50, search?: string, userJwt?: string): Promise<UsersListResponse> {
    let endpoint = `/api/agent/users?page=${page}&limit=${limit}`;
    if (search) {
      endpoint += `&search=${encodeURIComponent(search)}`;
    }
    return await this.makeRequest<UsersListResponse>('GET', endpoint, undefined, userJwt);
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string, userJwt?: string): Promise<UserResponse> {
    return await this.makeRequest<UserResponse>('GET', `/api/agent/users/${userId}`, undefined, userJwt);
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string, userJwt?: string): Promise<UserResponse> {
    return await this.makeRequest<UserResponse>(
      'GET',
      `/api/agent/users/by-email/${encodeURIComponent(email)}`,
      undefined,
      userJwt,
    );
  }

  /**
   * Get user's E-DNA profile
   */
  async getUserProfile(userId: string, userJwt?: string): Promise<UserEDNAProfile | null> {
    try {
      return await this.makeRequest<UserEDNAProfile>(
        'GET',
        `/api/agent/users/${userId}/profile`,
        undefined,
        userJwt,
      );
    } catch (error) {
      console.warn(`⚠️ [IOSBackend] Could not fetch user profile for ${userId}`);
      return null;
    }
  }

  /**
   * Get user's workbooks
   */
  async getUserWorkbooks(userId: string, userJwt?: string): Promise<WorkbooksResponse | null> {
    try {
      return await this.makeRequest<WorkbooksResponse>(
        'GET',
        `/api/agent/users/${userId}/workbooks`,
        undefined,
        userJwt,
      );
    } catch (error) {
      console.warn(`⚠️ [IOSBackend] Could not fetch workbooks for ${userId}`);
      return null;
    }
  }

  /**
   * Get user's quiz history
   */
  async getUserQuizHistory(userId: string, userJwt?: string): Promise<QuizHistoryResponse | null> {
    try {
      return await this.makeRequest<QuizHistoryResponse>(
        'GET',
        `/api/agent/users/${userId}/quiz-history`,
        undefined,
        userJwt,
      );
    } catch (error) {
      console.warn(`⚠️ [IOSBackend] Could not fetch quiz history for ${userId}`);
      return null;
    }
  }

  /**
   * Get user's complete E-DNA quiz results (7-layer data)
   */
  async getUserQuizResults(userId: string, userJwt?: string): Promise<any | null> {
    try {
      return await this.makeRequest<any>(
        'GET',
        `/api/agent/users/${userId}/quiz-results`,
        undefined,
        userJwt,
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
    userJwt?: string,
  ): Promise<SessionResponse> {
    return await this.makeRequest<SessionResponse>(
      'POST',
      `/api/agent/sessions`,
      { userId, title, context },
      userJwt,
    );
  }

  /**
   * Get user's sessions
   */
  async getUserSessions(userId: string, active?: boolean, limit: number = 20, userJwt?: string): Promise<SessionsListResponse> {
    let endpoint = `/api/agent/users/${userId}/sessions?limit=${limit}`;
    if (active !== undefined) {
      endpoint += `&active=${active}`;
    }
    return await this.makeRequest<SessionsListResponse>('GET', endpoint, undefined, userJwt);
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string, userJwt?: string): Promise<SessionResponse> {
    return await this.makeRequest<SessionResponse>('GET', `/api/agent/sessions/${sessionId}`, undefined, userJwt);
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
    userJwt?: string,
  ): Promise<SessionResponse> {
    return await this.makeRequest<SessionResponse>(
      'PATCH',
      `/api/agent/sessions/${sessionId}`,
      updates,
      userJwt,
    );
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string, userJwt?: string): Promise<{ success: boolean; message: string }> {
    return await this.makeRequest<{ success: boolean; message: string }>(
      'DELETE',
      `/api/agent/sessions/${sessionId}`,
      undefined,
      userJwt,
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
    userJwt?: string,
  ): Promise<MessagesListResponse> {
    return await this.makeRequest<MessagesListResponse>(
      'GET',
      `/api/agent/sessions/${sessionId}/messages?limit=${limit}&offset=${offset}`,
      undefined,
      userJwt,
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
    userJwt?: string,
  ): Promise<MessageResponse> {
    return await this.makeRequest<MessageResponse>(
      'POST',
      `/api/agent/sessions/${sessionId}/messages`,
      { role, content, metadata },
      userJwt,
    );
  }

  /**
   * Get last message in session
   */
  async getLastMessage(sessionId: string, userJwt?: string): Promise<MessageResponse | null> {
    try {
      return await this.makeRequest<MessageResponse>(
        'GET',
        `/api/agent/sessions/${sessionId}/messages/last`,
        undefined,
        userJwt,
      );
    } catch (error) {
      return null;
    }
  }

  /**
   * Get message count for session
   */
  async getMessageCount(sessionId: string, userJwt?: string): Promise<number> {
    try {
      const result = await this.makeRequest<{ success: boolean; count: number }>(
        'GET',
        `/api/agent/sessions/${sessionId}/messages/count`,
        undefined,
        userJwt,
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
   * Check if iOS backend is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Just check if the server is reachable
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}
