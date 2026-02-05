import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ILLMProvider, LLMOptions, LLMResponse } from '../interfaces/llm-provider.interface';

@Injectable()
export class DeepSeekProvider implements ILLMProvider {
  private client: OpenAI;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('DEEPSEEK_API_KEY');
    if (!apiKey) {
      throw new Error('DEEPSEEK_API_KEY is not set');
    }
    this.client = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://api.deepseek.com/v1',
    });
  }

  async generateResponse(
    model: string,
    messages: any[],
    options: LLMOptions,
  ): Promise<LLMResponse> {
    try {
      const completion = await this.client.chat.completions.create({
        model: 'deepseek-chat',
        messages: messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.max_tokens || 4000,
        top_p: options.top_p,
      });

      return {
        content: completion.choices[0]?.message?.content || '',
        model: model,
        usage: completion.usage,
      };
    } catch (error) {
      console.error('DeepSeek API error:', error);
      throw new Error(`DeepSeek API error: ${error.message}`);
    }
  }
}
