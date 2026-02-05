export interface ILLMProvider {
  generateResponse(model: string, messages: any[], options: LLMOptions): Promise<LLMResponse>;
  generateStream?(model: string, messages: any[], options: LLMOptions): AsyncGenerator<string, void, unknown>;
}

export interface LLMOptions {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  response_format?: 'json_object' | 'text';
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: any;
  reasoning?: string;
}
