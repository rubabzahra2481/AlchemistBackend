import { Injectable } from '@nestjs/common';
import { ILLMProvider, LLMOptions, LLMResponse } from '../interfaces/llm-provider.interface';
import { LLM_MODELS } from '../config/llm-models.config';
import { OpenAIProvider } from '../providers/openai.provider';
import { ClaudeProvider } from '../providers/claude.provider';
import { DeepSeekProvider } from '../providers/deepseek.provider';
import { GeminiProvider } from '../providers/gemini.provider';

@Injectable()
export class LLMOrchestratorService {
  private providers: Map<string, ILLMProvider>;

  constructor(
    private openaiProvider: OpenAIProvider,
    private claudeProvider: ClaudeProvider,
    private deepseekProvider: DeepSeekProvider,
    private geminiProvider: GeminiProvider,
  ) {
    this.providers = new Map<string, ILLMProvider>([
      ['openai', this.openaiProvider],
      ['claude', this.claudeProvider],
      ['deepseek', this.deepseekProvider],
      ['gemini', this.geminiProvider],
    ]);
  }

  async generateResponse(
    selectedLLM: string,
    messages: any[],
    options: LLMOptions = {},
  ): Promise<LLMResponse> {
    const modelConfig = LLM_MODELS[selectedLLM];
    if (!modelConfig) {
      throw new Error(`LLM ${selectedLLM} not supported`);
    }

    const provider = this.providers.get(modelConfig.provider);
    if (!provider) {
      throw new Error(`Provider ${modelConfig.provider} not available`);
    }

    // Merge options with model config
    const finalOptions = {
      ...options,
      max_tokens: options.max_tokens || modelConfig.maxTokens,
      temperature: options.temperature || modelConfig.temperature,
    };

    try {
      return await provider.generateResponse(modelConfig.model, messages, finalOptions);
    } catch (error) {
      console.error(`Error with ${selectedLLM}:`, error);
      // Fallback to GPT-4o if available
      if (selectedLLM !== 'gpt-4o') {
        console.log('Falling back to GPT-4o...');
        return await this.generateResponse('gpt-4o', messages, options);
      }
      throw error;
    }
  }

  getAvailableModels(): string[] {
    return Object.keys(LLM_MODELS);
  }

  getModelInfo(selectedLLM: string) {
    return LLM_MODELS[selectedLLM] || null;
  }

  async *generateStream(
    selectedLLM: string,
    messages: any[],
    options: LLMOptions = {},
  ): AsyncGenerator<string, void, unknown> {
    const modelConfig = LLM_MODELS[selectedLLM];
    if (!modelConfig) {
      throw new Error(`LLM ${selectedLLM} not supported`);
    }

    const provider = this.providers.get(modelConfig.provider);
    if (!provider) {
      throw new Error(`Provider ${modelConfig.provider} not available`);
    }

    // Check if provider supports streaming
    if (!provider.generateStream) {
      throw new Error(`Streaming not supported for ${modelConfig.provider}`);
    }

    // Merge options with model config
    const finalOptions = {
      ...options,
      max_tokens: options.max_tokens || modelConfig.maxTokens,
      temperature: options.temperature || modelConfig.temperature,
    };

    try {
      yield* provider.generateStream(modelConfig.model, messages, finalOptions);
    } catch (error) {
      console.error(`Error streaming with ${selectedLLM}:`, error);
      throw error;
    }
  }
}
