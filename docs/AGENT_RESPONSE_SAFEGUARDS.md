# Agent Response Safeguards (No Empty / Munawar 400)

This document lists all safeguards to prevent "agent not giving an answer" and Munawar's **400 "Content is required"** in production.

## 1. Repository layer (last line of defense)

- **`ChatRepositoryAdapter.ensureContent(content, fallback)`**  
  Before every `createMessage` call to Munawar:
  - **User message:** empty/whitespace → `"(No message content)"`
  - **Assistant message:** empty/whitespace → `"(Response unavailable. Please try again.)"`
- **Unit tests:** `src/repositories/chat-repository.adapter.spec.ts` (empty string, whitespace-only, valid content).

## 2. Advice generator (LLM output)

- **Non-streaming:** If parsed `response` is empty after JSON parse → replaced with  
  `"I'm here. Could you say a bit more so I can respond properly?"`
- **Streaming (both paths):** If final content is empty → same fallback before yielding `done` and before any save.
- **Prompt instructions:** All prompts state that the `"response"` field must never be empty and to keep reasoning to 2–4 sentences so response has room.
- **Token budget:** No 600 cap; full tier limit used so both reasoning and response fit (avoids truncation → empty response).

## 3. Chat service (before save to Munawar)

- **Non-streaming:** Content passed to `saveAssistantMessage` is whatever the advice generator returns (already guarded above). Repository `ensureContent` still applies.
- **Streaming (processMessageWithStreaming):** Before `saveAssistantMessage`, `contentToSave = fullResponse.trim() ? fullResponse : "I'm here. Something went wrong generating that reply. Please try again."` so we never save empty.
- **Streaming (processMessageStream):** Same `contentToSaveStream2` logic.
- **Non-streaming catch:** On any non–HttpException error, we save a **fallback assistant message** to Munawar so the DB always has a reply:  
  `"I'm here to help! Something went wrong on my side. Please try again."`
- **Streaming catch (both generators):** Same: we save a fallback assistant message so the user message already saved still has a reply in the DB.

## 4. DTO validation

- **Message:** `@IsNotEmpty()`, `@Length(1, 500000)`, `@Matches(/^(?!\s*$).+/)` so empty or whitespace-only messages are rejected with 400 before any LLM or Munawar call.

## 5. Test coverage

- **`scripts/test-agent-exhaustive.js`**  
  Run with backend on port 9000:  
  `node scripts/test-agent-exhaustive.js`  
  Covers: core types (alchemist, architect, mixed) non-empty, POST /chat (when Munawar up), streaming done event, DTO rejection of empty/whitespace, tier-info, short message "Hi", no unexpected 500.
- **`scripts/test-agent-response-empty.js`**  
  Quick check that test-response endpoint returns non-empty for alchemist, architect, mixed.
- **Unit:** `chat-repository.adapter.spec.ts` ensures `ensureContent` is used for both user and assistant and that empty/whitespace become fallbacks.

## 6. Checklist before production

- [ ] Backend and Munawar backend both deployed and reachable.
- [ ] Run `node scripts/test-agent-exhaustive.js` against staging/production URL (set `BACKEND_URL`).
- [ ] Run `npm test -- chat-repository.adapter.spec`.
- [ ] Confirm iOS app shows fallback text when our API returns the fallback (e.g. "Response unavailable. Please try again.") and does not show raw errors from Munawar.
