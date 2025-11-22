import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseAuthService {
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment variables');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Validate Supabase JWT token and extract user ID
   * @param token - JWT token from Authorization header
   * @returns User ID (UUID string)
   * @throws Error if token is invalid or expired
   */
  async getUserIdFromToken(token: string): Promise<string> {
    try {
      // Verify the JWT token using Supabase's built-in verification
      const { data: { user }, error } = await this.supabase.auth.getUser(token);

      if (error || !user) {
        throw new Error(`Invalid token: ${error?.message || 'User not found'}`);
      }

      if (!user.id) {
        throw new Error('User ID not found in token');
      }

      return user.id;
    } catch (error) {
      throw new Error(`Token validation failed: ${error.message}`);
    }
  }
}

