import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class SupabaseAuthService {
  private agentJwtSecret: string;

  constructor(private configService: ConfigService) {
    try {
      console.log('🔐 [SupabaseAuthService] Initializing Agent token verification...');
      const secret = this.configService.get<string>('AGENT_JWT_SECRET');

      console.log('🔐 [SupabaseAuthService] AGENT_JWT_SECRET:', secret ? '✅ Set' : '❌ Missing');

      if (!secret) {
        throw new Error('AGENT_JWT_SECRET must be set in environment variables');
      }

      this.agentJwtSecret = secret;

      console.log('✅ [SupabaseAuthService] Agent token verification initialized successfully');
    } catch (error) {
      console.error('❌ [SupabaseAuthService] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Validate Agent JWT token and extract user ID
   * @param token - Agent JWT token from Authorization header
   * @returns User ID (UUID string)
   * @throws Error if token is invalid or expired
   */
  async getUserIdFromToken(token: string): Promise<string> {
    try {
      console.log('🔐 [SupabaseAuthService] Validating Agent token...');
      console.log('🔐 [SupabaseAuthService] Token length:', token?.length || 0);
      console.log('🔐 [SupabaseAuthService] Token preview:', token?.substring(0, 20) + '...');
      console.log('🔐 [SupabaseAuthService] Secret configured:', !!this.agentJwtSecret);
      
      // Verify the Agent JWT token
      const decoded = jwt.verify(token, this.agentJwtSecret) as any;

      console.log('🔐 [SupabaseAuthService] Token validation result:', { 
        hasDecoded: !!decoded,
        tokenType: decoded?.type,
        userId: decoded?.userId,
        iat: decoded?.iat,
        exp: decoded?.exp,
        expiresAt: decoded?.exp ? new Date(decoded.exp * 1000).toISOString() : null
      });

      // Check token type
      if (decoded.type !== 'agent_access') {
        const errorMsg = `Invalid token type: ${decoded.type || 'unknown'}. Expected 'agent_access'`;
        console.error('❌ [SupabaseAuthService] Token validation failed:', errorMsg);
        throw new Error(errorMsg);
      }

      // Extract user ID from token payload
      if (!decoded.userId) {
        console.error('❌ [SupabaseAuthService] User ID not found in token payload');
        throw new Error('User ID not found in token');
      }

      console.log('✅ [SupabaseAuthService] Agent token validated successfully. User ID:', decoded.userId);
      return decoded.userId;
    } catch (error) {
      console.error('❌ [SupabaseAuthService] Token validation error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Provide more specific error messages
      if (errorMessage.includes('expired')) {
        console.error('❌ [SupabaseAuthService] Token has expired');
        throw new Error('Token has expired. Please refresh your session.');
      } else if (errorMessage.includes('invalid signature')) {
        console.error('❌ [SupabaseAuthService] Invalid token signature - JWT secret mismatch!');
        throw new Error('Invalid token signature. JWT secret mismatch between Brandscaling and backend.');
      } else if (errorMessage.includes('invalid')) {
        console.error('❌ [SupabaseAuthService] Invalid token format');
        throw new Error('Invalid token. Please log in again.');
      }
      
      console.error('❌ [SupabaseAuthService] Unknown validation error:', errorMessage);
      throw new Error(`Token validation failed: ${errorMessage}`);
    }
  }
}