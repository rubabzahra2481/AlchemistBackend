import { Controller, Post, Body, Get, Param, Delete, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { ChatRequestDto, ChatResponseDto } from '../dto/chat.dto';
import { ChatService } from '../services/chat.service';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { v4 as uuidv4 } from 'uuid';
import { getAvailableLLMs, DEFAULT_LLM } from '../config/llm-models.config';

@ApiTags('chat')
@Controller('chat')
@UseGuards(RateLimitGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @ApiOperation({ summary: 'Send a message and get personalized advice' })
  @ApiResponse({ status: 200, description: 'Returns advice and personality analysis' })
  async chat(@Body() chatRequest: ChatRequestDto): Promise<ChatResponseDto> {
    const sessionId = chatRequest.sessionId || uuidv4();
    const selectedLLM = chatRequest.selectedLLM || DEFAULT_LLM;
    return await this.chatService.processMessage(chatRequest.message, sessionId, selectedLLM);
  }

  @Get('session/:sessionId/history')
  @ApiOperation({ summary: 'Get conversation history for a session' })
  async getHistory(@Param('sessionId') sessionId: string) {
    return this.chatService.getSessionHistory(sessionId);
  }

  @Delete('session/:sessionId')
  @ApiOperation({ summary: 'Clear conversation history for a session' })
  async clearSession(@Param('sessionId') sessionId: string) {
    this.chatService.clearSession(sessionId);
    return { message: 'Session cleared successfully' };
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
