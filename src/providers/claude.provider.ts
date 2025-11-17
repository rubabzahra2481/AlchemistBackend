import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { ILLMProvider, LLMOptions, LLMResponse } from '../interfaces/llm-provider.interface';

@Injectable()
export class ClaudeProvider implements ILLMProvider {
  private client: Anthropic;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set');
    }
    this.client = new Anthropic({
      apiKey: apiKey,
    });
  }

  async generateResponse(
    model: string,
    messages: any[],
    options: LLMOptions,
  ): Promise<LLMResponse> {
    try {
      // Convert OpenAI format to Claude format
      const claudeMessages = this.convertToClaudeFormat(messages);

      const response = await this.client.messages.create({
        model: model,
        max_tokens: options.max_tokens || 4000,
        temperature: options.temperature || 0.7,
        messages: claudeMessages,
      });

      return {
        content: (response.content[0] as any)?.text || '',
        model: model,
        usage: response.usage,
      };
    } catch (error) {
      console.error('Claude API error:', error);
      throw new Error(`Claude API error: ${error.message}`);
    }
  }

  private convertToClaudeFormat(messages: any[]): any[] {
    return messages.map((msg) => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content,
    }));
  }
}
