import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ILLMProvider, LLMOptions, LLMResponse } from '../interfaces/llm-provider.interface';

@Injectable()
export class GeminiProvider implements ILLMProvider {
  private genAI: GoogleGenerativeAI;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async generateResponse(
    model: string,
    messages: any[],
    options: LLMOptions,
  ): Promise<LLMResponse> {
    try {
      const genModel = this.genAI.getGenerativeModel({
        model: model,
        generationConfig: {
          temperature: options.temperature || 0.7,
          maxOutputTokens: options.max_tokens || 4000,
          topP: options.top_p || 0.95,
        },
      });

      // Convert messages to Gemini format
      const prompt = this.convertToGeminiFormat(messages);

      const result = await genModel.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      return {
        content: text,
        model: model,
      };
    } catch (error) {
      console.error('Gemini API error:', error);
      throw new Error(`Gemini API error: ${error.message}`);
    }
  }

  private convertToGeminiFormat(messages: any[]): string {
    return messages.map((msg) => `${msg.role}: ${msg.content}`).join('\n');
  }
}
