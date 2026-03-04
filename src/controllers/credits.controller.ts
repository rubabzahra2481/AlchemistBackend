import { Controller, Post, Body, Headers, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CreditService } from '../services/credit.service';
import { ConfigService } from '@nestjs/config';

/** Body for top-up endpoint (called by Munawar's backend after payment). */
export class TopUpBodyDto {
  userId: string;
  credits: number;
}

@ApiTags('credits')
@Controller('credits')
export class CreditsController {
  constructor(
    private readonly creditService: CreditService,
    private readonly configService: ConfigService,
  ) {}

  @Post('top-up')
  @ApiOperation({ summary: 'Add top-up credits for a user (server-to-server, after payment)' })
  @ApiResponse({ status: 200, description: 'Credits added; returns creditsAdded and totalTopUpThisMonth' })
  @ApiResponse({ status: 401, description: 'Invalid or missing TOPUP_SECRET' })
  @ApiResponse({ status: 400, description: 'Invalid body (userId or credits)' })
  async topUp(
    @Body() body: TopUpBodyDto,
    @Headers('x-topup-secret') topUpSecretHeader?: string,
  ): Promise<{ success: boolean; creditsAdded: number; totalTopUpThisMonth: number }> {
    const secret = this.configService.get<string>('TOPUP_SECRET');
    if (!secret || secret.length < 8) {
      throw new HttpException(
        'Top-up endpoint is not configured (TOPUP_SECRET missing or too short)',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    const provided = topUpSecretHeader?.trim();
    if (provided !== secret) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    const userId = body?.userId;
    const credits = typeof body?.credits === 'number' ? body.credits : Number(body?.credits);

    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }
    if (!Number.isFinite(credits) || credits <= 0) {
      throw new HttpException('credits must be a positive number', HttpStatus.BAD_REQUEST);
    }

    const result = await this.creditService.addTopUp(userId.trim(), credits);
    return {
      success: true,
      creditsAdded: result.creditsAdded,
      totalTopUpThisMonth: result.totalTopUpThisMonth,
    };
  }
}
