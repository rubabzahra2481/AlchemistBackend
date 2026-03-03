import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ILLMProvider, LLMOptions, LLMResponse } from '../interfaces/llm-provider.interface';

@Injectable()
export class OpenAIProvider implements ILLMProvider {
  private client: OpenAI;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }
    this.client = new OpenAI({
      apiKey: apiKey,
    });
  }

  async generateResponse(
    model: string,
    messages: any[],
    options: LLMOptions,
  ): Promise<LLMResponse> {
    try {
      const requestParams: any = {
        model: model,
        messages: messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.max_tokens || 4000,
        top_p: options.top_p,
      };

      // Add JSON mode if explicitly requested
      if (options.response_format === 'json_object') {
        requestParams.response_format = { type: 'json_object' };
      }

      const completion = await this.client.chat.completions.create(requestParams);

      return {
        content: completion.choices[0]?.message?.content || '',
        model: model,
        usage: completion.usage,
      };
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error(`OpenAI API error: ${error.message}`);
    }
  }

  async *generateStream(
    model: string,
    messages: any[],
    options: LLMOptions,
  ): AsyncGenerator<string, void, unknown> {
    try {
      const requestParams: any = {
        model: model,
        messages: messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.max_tokens || 4000,
        top_p: options.top_p,
        stream: true,
      };

      // Add JSON mode if explicitly requested (note: streaming with JSON mode may not work perfectly)
      if (options.response_format === 'json_object') {
        requestParams.response_format = { type: 'json_object' };
      }

      const stream = await this.client.chat.completions.create(requestParams) as unknown as AsyncIterable<any>;

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          yield content;
        }
      }
    } catch (error) {
      console.error('OpenAI streaming error:', error);
      throw new Error(`OpenAI streaming error: ${error.message}`);
    }
  }
}
