import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseAuthService {
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    try {
      console.log('🔐 [SupabaseAuthService] Initializing Supabase client...');
      const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
      const supabaseKey = this.configService.get<string>('SUPABASE_ANON_KEY');

      console.log('🔐 [SupabaseAuthService] SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
      console.log('🔐 [SupabaseAuthService] SUPABASE_ANON_KEY:', supabaseKey ? '✅ Set' : '❌ Missing');

      if (!supabaseUrl || !supabaseKey) {
        const missing: string[] = [];
        if (!supabaseUrl) missing.push('SUPABASE_URL');
        if (!supabaseKey) missing.push('SUPABASE_ANON_KEY');
        throw new Error(`${missing.join(' and ')} must be set in environment variables`);
      }

      this.supabase = createClient(supabaseUrl, supabaseKey);
      console.log('✅ [SupabaseAuthService] Supabase client initialized successfully');
    } catch (error) {
      console.error('❌ [SupabaseAuthService] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Validate Supabase JWT token and extract user ID
   * @param token - JWT token from Authorization header
   * @returns User ID (UUID string)
   * @throws Error if token is invalid or expired
   */
  async getUserIdFromToken(token: string): Promise<string> {
    try {
      console.log('🔐 [SupabaseAuthService] Validating token...');
      // Verify the JWT token using Supabase's built-in verification
      const { data: { user }, error } = await this.supabase.auth.getUser(token);

      console.log('🔐 [SupabaseAuthService] Token validation result:', { 
        hasUser: !!user, 
        hasError: !!error,
        errorMessage: error?.message,
        userId: user?.id 
      });

      if (error || !user) {
        const errorMsg = `Invalid token: ${error?.message || 'User not found'}`;
        console.error('❌ [SupabaseAuthService] Token validation failed:', errorMsg);
        throw new Error(errorMsg);
      }

      if (!user.id) {
        console.error('❌ [SupabaseAuthService] User ID not found in user object');
        throw new Error('User ID not found in token');
      }

      console.log('✅ [SupabaseAuthService] Token validated successfully. User ID:', user.id);
      return user.id;
    } catch (error) {
      console.error('❌ [SupabaseAuthService] Token validation error:', error);
      throw new Error(`Token validation failed: ${error.message}`);
    }
  }
}

