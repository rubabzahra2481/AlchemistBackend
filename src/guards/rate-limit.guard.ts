import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

@Injectable()
export class RateLimitGuard implements CanActivate {
  private requests: Map<string, number[]> = new Map();
  private readonly maxRequests = 300; // Max requests (increased for QA testing)
  private readonly windowMs = 60000; // Per minute

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const ip = request.ip || request.connection.remoteAddress;
    const now = Date.now();

    // Get existing requests for this IP
    const userRequests = this.requests.get(ip) || [];

    // Filter out old requests outside the window
    const recentRequests = userRequests.filter((time) => now - time < this.windowMs);

    // Check if limit exceeded
    if (recentRequests.length >= this.maxRequests) {
      throw new HttpException(
        'Too many requests. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Add current request
    recentRequests.push(now);
    this.requests.set(ip, recentRequests);

    // Cleanup old entries periodically
    if (Math.random() < 0.01) {
      this.cleanup();
    }

    return true;
  }

  private cleanup() {
    const now = Date.now();
    for (const [ip, times] of this.requests.entries()) {
      const recent = times.filter((time) => now - time < this.windowMs);
      if (recent.length === 0) {
        this.requests.delete(ip);
      } else {
        this.requests.set(ip, recent);
      }
    }
  }
}
