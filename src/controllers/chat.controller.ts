import { Controller, Post, Body, Get, Param, Delete, Res, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { ChatRequestDto, ChatResponseDto } from '../dto/chat.dto';
import { ChatService } from '../services/chat.service';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { SupabaseAuthGuard } from '../guards/supabase-auth.guard';
import { UserId } from '../decorators/user.decorator';
import { v4 as uuidv4 } from 'uuid';
import { getAvailableLLMs, DEFAULT_LLM } from '../config/llm-models.config';

@ApiTags('chat')
@Controller('chat')
@UseGuards(RateLimitGuard, SupabaseAuthGuard) // Add SupabaseAuthGuard to protect all endpoints
@ApiBearerAuth() // Indicates that this endpoint requires authentication
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @ApiOperation({ summary: 'Send a message and get personalized advice' })
  @ApiResponse({ status: 200, description: 'Returns advice and personality analysis' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing token' })
  async chat(
    @Body() chatRequest: ChatRequestDto,
    @UserId() userId: string, // Get user ID from validated token
  ): Promise<ChatResponseDto> {
    const sessionId = chatRequest.sessionId || uuidv4();
    const selectedLLM = chatRequest.selectedLLM || DEFAULT_LLM;
    // Pass userId to processMessage - this will be stored with chat history
    return await this.chatService.processMessage(
      chatRequest.message,
      sessionId,
      selectedLLM,
      userId,
    );
  }

  @Get('session/:sessionId/history')
  @ApiOperation({ summary: 'Get conversation history for a session' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing token' })
  async getHistory(
    @Param('sessionId') sessionId: string,
    @UserId() userId: string, // Ensure user can only access their own sessions
  ) {
    return await this.chatService.getSessionHistory(sessionId, userId);
  }

  @Delete('session/:sessionId')
  @ApiOperation({ summary: 'Clear conversation history for a session' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing token' })
  async clearSession(
    @Param('sessionId') sessionId: string,
    @UserId() userId: string, // Ensure user can only delete their own sessions
  ) {
    await this.chatService.clearSession(sessionId, userId);
    return { message: 'Session cleared successfully' };
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Get all chat sessions for the authenticated user' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing token' })
  async getAllSessions(@UserId() userId: string) {
    return await this.chatService.getAllSessions(userId);
  }

  @Get('quotients')
  @ApiOperation({ summary: 'Get all available quotients information' })
  async getQuotients() {
    return this.chatService.getAllQuotientsInfo();
  }

  @Get('quotients/:id')
  @ApiOperation({ summary: 'Get detailed information about a specific quotient' })
  async getQuotient(@Param('id') id: string) {
    return this.chatService.getQuotientInfo(id);
  }

  @Get('llms')
  @ApiOperation({ summary: 'Get available LLM models for selection' })
  @ApiResponse({ status: 200, description: 'Returns list of available LLM models' })
  async getAvailableLLMs() {
    return {
      default: DEFAULT_LLM,
      models: getAvailableLLMs(),
    };
  }
}
