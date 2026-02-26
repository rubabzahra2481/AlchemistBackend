import { IsString, IsNotEmpty, IsOptional, IsUUID, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class ChatRequestDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 2000, { message: 'Message must be between 1 and 2000 characters' })
  @Transform(({ value }) => value?.trim()) // Trim whitespace
  @Matches(/^(?!\s*$).+/, { message: 'Message cannot be only whitespace' }) // No whitespace-only
  message: string;

  @IsOptional()
  @IsString()
  @IsUUID('4', { message: 'Session ID must be a valid UUID' })
  sessionId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50, { message: 'Selected LLM must be between 1 and 50 characters' })
  selectedLLM?: string;

  @IsOptional()
  @IsString()
  @Length(36, 36, { message: 'User ID must be a valid UUID (36 characters)' })
  userId?: string;  // iOS app user ID for E-DNA personalization

  @IsOptional()
  stream?: boolean;  // Enable streaming response via SSE

  @IsOptional()
  decisionIntelligenceMode?: boolean;  // Use Decision Intelligence Agent flow (workbook-guided decision making)
}

export class ChatResponseDto {
  response: string;
  sessionId: string;
  analysis: PersonalityAnalysis;
  recommendations: string[];
  reasoning?: string; // LLM's internal reasoning (optional)
  // Cleaned psychological profile used by the responder (includes safety and per-message summary)
  profile?: any;
}

export interface PersonalityAnalysis {
  dominantQuotients: QuotientScore[];
  needsAttention: QuotientScore[];
  overallInsights: string;
  conversationContext: string;
}

export interface QuotientScore {
  quotientId: string;
  quotientName: string;
  score: number; // 0-100
  confidence: number; // 0-1
  indicators: string[];
}
