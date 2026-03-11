import { IsString, IsNotEmpty, IsOptional, IsUUID, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class GuestChatRequestDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 500000, {
    message: 'Message must be between 1 and 500,000 characters.',
  })
  @Transform(({ value }) => value?.trim())
  @Matches(/^(?!\s*$).+/, { message: 'Message cannot be only whitespace' })
  message: string;

  @IsOptional()
  @IsString()
  @IsUUID('4', { message: 'Session ID must be a valid UUID' })
  sessionId?: string;

  /** Client sends this after first response so we can enforce message cap. If omitted, server generates one. */
  @IsOptional()
  @IsString()
  @Length(1, 64)
  guestUserId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  selectedLLM?: string;

  @IsOptional()
  stream?: boolean;
}

export interface GuestChatResponseDto {
  response: string;
  reasoning?: string;
  /** Present when server generated a new guest id; client should send this on subsequent requests */
  guestUserId?: string;
  sessionId?: string;
  /** Current message count for this guest (for UI: "X of 30 messages") */
  messagesUsed?: number;
  /** Max messages allowed for guest */
  messagesCap?: number;
}
