import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseAuthService } from '../services/supabase-auth.service';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private supabaseAuthService: SupabaseAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('No authorization header found');
    }

    // Extract token from "Bearer <token>"
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      console.log('🔐 [SupabaseAuthGuard] Starting token validation...');
      // Validate token and get user ID
      const userId = await this.supabaseAuthService.getUserIdFromToken(token);

      console.log('✅ [SupabaseAuthGuard] Token validated. User ID:', userId);
      // Attach user ID to request so we can access it with @UserId() decorator
      request.user = { id: userId };

      return true;
    } catch (error) {
      console.error('❌ [SupabaseAuthGuard] Authentication failed:', error.message);
      console.error('❌ [SupabaseAuthGuard] Full error:', error);
      throw new UnauthorizedException(`Authentication failed: ${error.message}`);
    }
  }
}


