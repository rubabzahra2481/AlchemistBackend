/**
 * Structured output for FAQ chat (OpenAI gpt-4o / gpt-4o-mini).
 */
export const FAQ_CHAT_RESPONSE_JSON_SCHEMA = {
  type: 'json_schema' as const,
  json_schema: {
    name: 'faq_chat_response',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        response: {
          type: 'string',
          description: 'User-facing reply. Polite out-of-scope message if outOfScope is true.',
        },
        outOfScope: {
          type: 'boolean',
          description: 'True if no retrieved FAQ supports a grounded answer.',
        },
        citedFaqIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs of FAQs used to compose the answer; empty if outOfScope.',
        },
      },
      required: ['response', 'outOfScope', 'citedFaqIds'],
      additionalProperties: false,
    },
  },
};

export function faqChatUsesStructuredOutput(model: string): boolean {
  return model === 'gpt-4o' || model === 'gpt-4o-mini';
}
