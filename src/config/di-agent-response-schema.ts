/**
 * OpenAI Structured Outputs schema for the DI agent.
 * Guarantees valid JSON with non-empty "response" so we avoid empty-response fallbacks and loops.
 * Supported on gpt-4o, gpt-4o-mini (and later). Use with response_format when calling OpenAI.
 */
export const DI_AGENT_RESPONSE_JSON_SCHEMA = {
  type: 'json_schema' as const,
  json_schema: {
    name: 'di_agent_response',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        response: {
          type: 'string',
          description: 'What you say to the user. Must be non-empty. Short answers like "Got it—logic first. Give me the facts." are valid.',
        },
        reasoning: {
          type: 'string',
          description: 'Your internal reasoning (2–4 sentences).',
        },
      },
      required: ['response', 'reasoning'],
      additionalProperties: false,
    },
  },
};

/** OpenAI model IDs that support Structured Outputs (json_schema). */
export const OPENAI_STRUCTURED_OUTPUT_MODELS = ['gpt-4o', 'gpt-4o-mini'];

export function useStructuredOutputForModel(selectedLLM: string): boolean {
  return OPENAI_STRUCTURED_OUTPUT_MODELS.includes(selectedLLM);
}
