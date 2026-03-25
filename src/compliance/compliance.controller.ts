import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ComplianceService } from './compliance.service';
import { InitAmiqusDto, InitDocuSealDto } from './dto/compliance.dto';

@ApiTags('compliance')
@Controller('api/compliance')
export class ComplianceApiController {
  constructor(private readonly compliance: ComplianceService) {}

  @Post('init-amiqus')
  @ApiOperation({ summary: 'Start Amiqus KYC + DBS record; returns perform_url' })
  async initAmiqus(@Body() dto: InitAmiqusDto) {
    return this.compliance.initAmiqus(dto);
  }
}

@ApiTags('compliance-contracts')
@Controller('api/contracts')
export class ContractsApiController {
  constructor(private readonly compliance: ComplianceService) {}

  @Post('init-docuseal')
  @ApiOperation({ summary: 'Create DocuSeal submission (HSP + PMA); returns HSP slug for embed' })
  async initDocuSeal(@Body() dto: InitDocuSealDto) {
    return this.compliance.initDocuSeal(dto);
  }
}

@ApiTags('compliance-webhooks')
@Controller('api/webhooks')
export class ComplianceWebhooksController {
  constructor(private readonly compliance: ComplianceService) {}

  @Post('amiqus')
  @ApiOperation({ summary: 'Amiqus record status webhook' })
  async amiqusWebhook(@Req() req: Request) {
    return this.compliance.handleAmiqusWebhook(this.bodyAsRecord(req.body));
  }

  @Post('docuseal')
  @ApiOperation({ summary: 'DocuSeal submission webhook' })
  async docusealWebhook(@Req() req: Request) {
    return this.compliance.handleDocuSealWebhook(this.bodyAsRecord(req.body));
  }

  private bodyAsRecord(body: unknown): Record<string, unknown> {
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      return body as Record<string, unknown>;
    }
    return {};
  }
}
