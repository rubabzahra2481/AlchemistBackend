# DI Agent Response Handling — Best Practices

This doc describes how we avoid empty responses and the "Could you say a bit more?" loop.

## 1. Structured Outputs (OpenAI)

**Best practice: use the API to enforce shape, not prompts alone.**

- For **gpt-4o** and **gpt-4o-mini**, we use OpenAI **Structured Outputs** (`response_format` with `json_schema`).
- Schema: `{ response: string, reasoning: string }`, both required, `additionalProperties: false`, `strict: true`.
- The API then guarantees valid JSON that matches the schema (no malformed or truncated JSON from our parser’s perspective).
- Config: `config/di-agent-response-schema.ts`. Used in non-streaming and streaming DI flows when `useStructuredOutputForModel(selectedLLM)` is true.

## 2. Resilient Parsing When JSON Fails

- If `JSON.parse` throws (e.g. truncated or malformed JSON), we first try **regex extraction** of `"response"` and `"reasoning"` from the raw string before falling back to other formats (RESPONSE:/REASONING: or raw).
- That way we still get a usable reply when the model returns almost-valid JSON.

## 3. Context-Aware Empty Fallback

- If we still end up with an **empty** `response`, we avoid a generic "Could you say a bit more?" when the user has already given a **short valid answer** (e.g. "It was logical", "My first instinct was logical", "Emotional", "7" for scale).
- We use `getShortAnswerFallback(userMessage)` to return a **step-appropriate** continuation (e.g. "Got it—logic first. Give me all the logical data...") so the conversation moves forward instead of looping.
- Only if that returns null do we use the generic fallback.

## 4. Prompt and Schema Together

- The **prompt** tells the model: short answers are valid; never return an empty response; put real reply text in `response`.
- The **schema** enforces the structure. Together they reduce empty/malformed output and the need for generic fallbacks.

## Summary

| Layer | What we do |
|-------|------------|
| **API** | Structured Outputs (json_schema) for gpt-4o / gpt-4o-mini so output always matches `{ response, reasoning }`. |
| **Parse** | On parse failure, regex-extract `response` / `reasoning` from raw string before other fallbacks. |
| **Empty** | If `response` is still empty, use context-aware fallback for short step-answers; otherwise generic "say a bit more". |

This follows common practice: **constrain at the API where possible**, **parse defensively**, and **handle empty with context-aware fallbacks** instead of a single generic message.
