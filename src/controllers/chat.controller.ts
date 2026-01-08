import { Controller, Post, Body, Get, Param, Delete, Patch, Res, UseGuards, Query, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { ChatRequestDto, ChatResponseDto } from '../dto/chat.dto';
import { ChatService } from '../services/chat.service';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { v4 as uuidv4 } from 'uuid';
import { getAvailableLLMs, DEFAULT_LLM } from '../config/llm-models.config';
import { CreditService } from '../services/credit.service';

// Default anonymous user ID for non-authenticated usage
const ANONYMOUS_USER_ID = 'anonymous-user';

@ApiTags('chat')
@Controller('chat')
@UseGuards(RateLimitGuard) // Only rate limiting, no auth
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly creditService: CreditService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Send a message and get personalized advice' })
  @ApiResponse({ status: 200, description: 'Returns advice and personality analysis' })
  async chat(
    @Body() chatRequest: ChatRequestDto,
  ): Promise<ChatResponseDto> {
    const sessionId = chatRequest.sessionId || uuidv4();
    const selectedLLM = chatRequest.selectedLLM || DEFAULT_LLM;
    // Use anonymous user ID for non-authenticated usage
    return await this.chatService.processMessage(
      chatRequest.message,
      sessionId,
      selectedLLM,
      ANONYMOUS_USER_ID,
    );
  }

  @Get('session/:sessionId/history')
  @ApiOperation({ summary: 'Get conversation history for a session' })
  async getHistory(
    @Param('sessionId') sessionId: string,
  ) {
    return await this.chatService.getSessionHistory(sessionId, ANONYMOUS_USER_ID);
  }

  @Delete('session/:sessionId')
  @ApiOperation({ summary: 'Delete a chat session and all its messages' })
  @ApiResponse({ status: 200, description: 'Session deleted successfully' })
  async deleteSession(
    @Param('sessionId') sessionId: string,
  ) {
    await this.chatService.clearSession(sessionId, ANONYMOUS_USER_ID);
    return { message: 'Session deleted successfully' };
  }

  @Patch('session/:sessionId')
  @ApiOperation({ summary: 'Rename a chat session' })
  @ApiResponse({ status: 200, description: 'Session renamed successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid title' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async renameSession(
    @Param('sessionId') sessionId: string,
    @Body() body: { title: string },
  ) {
    try {
      // Validate input
      if (!body || !body.title || typeof body.title !== 'string') {
        throw new HttpException('Title is required and must be a string', HttpStatus.BAD_REQUEST);
      }
      
      const trimmedTitle = body.title.trim();
      if (!trimmedTitle) {
        throw new HttpException('Title cannot be empty', HttpStatus.BAD_REQUEST);
      }
      
      if (trimmedTitle.length > 255) {
        throw new HttpException('Title must be 255 characters or less', HttpStatus.BAD_REQUEST);
      }
      
      // Rename session
      await this.chatService.renameSession(sessionId, ANONYMOUS_USER_ID, trimmedTitle);
      return { message: 'Session renamed successfully' };
    } catch (error: any) {
      // Re-throw HttpException as-is
      if (error instanceof HttpException) {
        throw error;
      }
      
      // Handle specific error messages from service
      if (error?.message?.includes('not found') || error?.message?.includes('permission')) {
        throw new HttpException(
          error.message,
          HttpStatus.NOT_FOUND,
        );
      }
      
      // Handle other errors
      console.error('Error renaming session:', error);
      throw new HttpException(
        error?.message || 'Failed to rename session',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Get all chat sessions' })
  async getAllSessions() {
    console.log('📥 [ChatController] GET /chat/sessions called');
    try {
      const sessions = await this.chatService.getAllSessions(ANONYMOUS_USER_ID);
      console.log('✅ [ChatController] Returning sessions:', sessions?.length || 0);
      return sessions;
    } catch (error) {
      console.error('❌ [ChatController] Error getting sessions:', error);
      throw error;
    }
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

  @Get('credits')
  @ApiOperation({ summary: 'Get credit usage statistics' })
  @ApiResponse({ status: 200, description: 'Returns credit usage statistics' })
  async getCredits() {
    const stats = await this.creditService.getUsageStats(ANONYMOUS_USER_ID);
    const creditCheck = await this.creditService.checkCredits(ANONYMOUS_USER_ID);
    
    return {
      ...stats,
      warning: creditCheck.warning,
      allowed: creditCheck.allowed,
      message: creditCheck.message,
    };
  }
}
