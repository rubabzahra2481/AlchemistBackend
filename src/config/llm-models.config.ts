export const LLM_MODELS = {
  // OpenAI Models (using actual available models)
  'gpt-4o': { provider: 'openai', model: 'gpt-4o', maxTokens: 4000, temperature: 0.7 },
  'gpt-4o-mini': { provider: 'openai', model: 'gpt-4o-mini', maxTokens: 4000, temperature: 0.0 }, // Fast, cheap, good for classification
  'gpt-4-turbo': { provider: 'openai', model: 'gpt-4-turbo', maxTokens: 4000, temperature: 0.7 },
  'gpt-3.5-turbo': {
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    maxTokens: 2000,
    temperature: 0.7,
  },

  // Claude Models (using actual available models)
  'claude-3-5-sonnet': {
    provider: 'claude',
    model: 'claude-3-5-sonnet-20241022',
    maxTokens: 4000,
    temperature: 0.7,
  },
  'claude-3-opus': {
    provider: 'claude',
    model: 'claude-3-opus-20240229',
    maxTokens: 4000,
    temperature: 0.7,
  },
  'claude-3-haiku': {
    provider: 'claude',
    model: 'claude-3-haiku-20240307',
    maxTokens: 2000,
    temperature: 0.7,
  },

  // DeepSeek
  'deepseek-chat': {
    provider: 'deepseek',
    model: 'deepseek-chat',
    maxTokens: 4000,
    temperature: 0.7,
  },

  // Gemini Models (using actual available models)
  'gemini-1.5-pro': {
    provider: 'gemini',
    model: 'gemini-1.5-pro',
    maxTokens: 4000,
    temperature: 0.7,
  },
  'gemini-1.5-flash': {
    provider: 'gemini',
    model: 'gemini-1.5-flash',
    maxTokens: 2000,
    temperature: 0.7,
  },
};

// Default LLM configuration
export const DEFAULT_LLM = 'gpt-4o';

// Get available LLM models for frontend dropdown
export const getAvailableLLMs = () => {
  return Object.keys(LLM_MODELS).map((key) => ({
    id: key,
    name: LLM_MODELS[key].model,
    provider: LLM_MODELS[key].provider,
    maxTokens: LLM_MODELS[key].maxTokens,
  }));
};
