import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class InitAmiqusDto {
  @ApiProperty({ example: 'Jane' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  lastName: string;

  @ApiProperty({ example: 'jane.doe@example.com' })
  @IsEmail()
  @MaxLength(320)
  email: string;
}

export type ContractType = 'HSPSLA' | 'TENANTS' | 'REFERRAL';

/**
 * Unified DTO for /api/contracts/init-docuseal.
 *
 * For HSPSLA / TENANTS: provide hspEmail, hspName, companyName, companyRegNumber,
 *   registeredAddress, and contractType.
 *
 * For REFERRAL: provide applicantEmail and contractType = 'REFERRAL'.
 *   templateId is optional (defaults to REFERRAL_TEMPLATE_ID env var or 3).
 */
export class InitDocuSealDto {
  @ApiProperty({ enum: ['HSPSLA', 'TENANTS', 'REFERRAL'] })
  @IsString()
  @IsIn(['HSPSLA', 'TENANTS', 'REFERRAL'])
  contractType: ContractType;

  // ── REFERRAL-only fields ──────────────────────────────────────────────────

  @ApiPropertyOptional({ example: 'applicant@example.com', description: 'Required for REFERRAL contract type' })
  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  applicantEmail?: string;

  @ApiPropertyOptional({ example: 3, description: 'DocuSeal template ID override (REFERRAL only)' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  templateId?: number;

  // ── HSPSLA / TENANTS fields ───────────────────────────────────────────────

  @ApiPropertyOptional({ example: 'hsp@example.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  hspEmail?: string;

  @ApiPropertyOptional({ example: 'Jane HSP' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  hspName?: string;

  @ApiPropertyOptional({ example: 'Acme Housing Ltd' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  companyName?: string;

  @ApiPropertyOptional({ example: '12345678' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  companyRegNumber?: string;

  @ApiPropertyOptional({ example: '1 London Road, London, EC1A 1BB' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  registeredAddress?: string;
}

/** Optional nested shapes some Amiqus webhook payloads use */
export class AmiqusWebhookRecordDto {
  @ApiPropertyOptional()
  @IsOptional()
  id?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;
}

/**
 * Webhook bodies vary by Amiqus configuration. We only validate when these fields exist;
 * the service still reads from the raw object for fallbacks.
 */
export class AmiqusWebhookDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  id?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => AmiqusWebhookRecordDto)
  record?: AmiqusWebhookRecordDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}

export class DocuSealWebhookSubmissionDto {
  @ApiPropertyOptional()
  @IsOptional()
  id?: number;

  @ApiPropertyOptional()
  @IsOptional()
  template_id?: number;
}

/**
 * DocuSeal webhook payloads differ by event type; keep optional fields for validation only.
 */
export class DocuSealWebhookDto {
  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => DocuSealWebhookSubmissionDto)
  submission?: DocuSealWebhookSubmissionDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
