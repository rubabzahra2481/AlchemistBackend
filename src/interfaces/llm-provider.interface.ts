export interface ILLMProvider {
  generateResponse(model: string, messages: any[], options: LLMOptions): Promise<LLMResponse>;
  generateStream?(model: string, messages: any[], options: LLMOptions): AsyncGenerator<string, void, unknown>;
}

/** Structured output schema for OpenAI (guarantees schema adherence, e.g. non-empty response). */
export interface LLMResponseFormatJsonSchema {
  type: 'json_schema';
  json_schema: {
    name: string;
    strict: boolean;
    schema: Record<string, unknown>;
  };
}

export interface LLMOptions {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  response_format?: 'json_object' | 'text' | LLMResponseFormatJsonSchema;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: any;
  reasoning?: string;
}
