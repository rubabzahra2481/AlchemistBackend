import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { CreditService } from '../services/credit.service';

@Injectable()
export class CreditGuard implements CanActivate {
  constructor(private creditService: CreditService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;

    if (!userId) {
      throw new HttpException('User ID not found', HttpStatus.UNAUTHORIZED);
    }

    // Check credits
    const creditCheck = await this.creditService.checkCredits(userId);

    if (!creditCheck.allowed) {
      throw new HttpException(
        {
          message: creditCheck.message || 'Credit limit reached',
          code: 'CREDIT_LIMIT_EXCEEDED',
          tokensUsed: creditCheck.tokensUsed,
          tokensIncluded: creditCheck.tokensIncluded,
          usagePercentage: creditCheck.usagePercentage,
        },
        HttpStatus.PAYMENT_REQUIRED, // 402 Payment Required
      );
    }

    // Attach credit info to request for later use
    request.creditInfo = creditCheck;

    // Log warning if at 80%
    if (creditCheck.warning) {
      console.warn(
        `⚠️ [CreditGuard] User ${userId} at ${creditCheck.usagePercentage.toFixed(1)}% usage`,
      );
    }

    return true;
  }
}

