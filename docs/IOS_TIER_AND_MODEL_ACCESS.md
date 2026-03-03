# Backend Tier & Model Access — iOS App Implementation Guide

This document describes how agent pricing and model access work on the backend so the iOS app can implement tier-aware UI (model picker, limits, upgrade prompts).

---

## 1. API to get user tier and allowed models

**Endpoint:** `GET /chat/tier-info/:userId`  
**Headers:** Optional `Authorization: Bearer <jwt>` (for Munawar backend when resolving tier)

**Response shape:**

```json
{
  "userId": "uuid",
  "tier": "free",
  "tierDisplay": {
    "name": "Free",
    "color": "#6B7280",
    "badge": "🆓",
    "features": ["Basic models only", "500 token responses", "Limited context"]
  },
  "limits": {
    "maxOutputTokens": 500,
    "maxInputTokens": 4000,
    "maxOutputWords": 400,
    "maxInputWords": 3200
  },
  "allowedModels": ["gpt-4o-mini", "gpt-3.5-turbo", "claude-3-haiku", "gemini-1.5-flash"],
  "defaultModel": "gpt-4o-mini",
  "models": [
    {
      "id": "gpt-4o-mini",
      "name": "gpt-4o-mini",
      "provider": "openai",
      "maxTokens": 4000,
      "allowed": true,
      "pricingTier": "cheap",
      "isDefault": true
    },
    {
      "id": "gpt-4o",
      "name": "gpt-4o",
      "provider": "openai",
      "maxTokens": 4000,
      "allowed": false,
      "pricingTier": "standard",
      "isDefault": false
    }
  ],
  "budgetStatus": [
    {
      "modelId": "claude-3-5-sonnet",
      "modelName": "Claude 3 5 Sonnet",
      "monthlyLimit": 10,
      "spent": 2.5,
      "remaining": 7.5,
      "percentageUsed": 25
    }
  ],
  "message": "You're on the Free plan. Basic models only. 500 token responses. Limited context."
}
```

- **tier:** Normalized tier string used in backend logic.
- **tierDisplay:** For UI (name, color, badge, feature list).
- **limits:** Per-tier output/input token caps (and approximate word counts).
- **allowedModels:** Model IDs the user is allowed to use.
- **defaultModel:** Fallback model for this tier (use when user has no preference or selection is invalid).
- **models:** Full list of all models with `allowed`, `pricingTier`, `isDefault` for picker/UX.
- **budgetStatus:** Only for premium models that have a monthly $ budget; empty for free tier.

**Tier source:** Backend resolves tier from Munawar’s backend (e.g. `getUserProfile` / `getUserById`). If unavailable, tier defaults to `"free"`.

---

## 2. Tiers and model access (who can use which models)

**Tiers:** `free` | `basic` | `standard` | `pro` | `elite`

**Model pricing categories (backend):**

| Category   | Model IDs                                      |
|-----------|-------------------------------------------------|
| cheap     | gpt-4o-mini, gpt-3.5-turbo, claude-3-haiku, gemini-1.5-flash |
| standard  | gpt-4o, deepseek-chat, gemini-1.5-pro           |
| premium   | claude-3-5-sonnet                               |
| expensive | claude-3-opus, gpt-4-turbo                      |

**Access by tier:**

| Tier     | Allowed categories        | Blocked (specific) | Default model  |
|----------|---------------------------|--------------------|----------------|
| free     | cheap only                | —                  | gpt-4o-mini    |
| basic    | cheap, standard           | gpt-4o             | gpt-4o-mini    |
| standard | cheap, standard           | —                  | gpt-4o         |
| pro      | cheap, standard, premium  | —                  | gpt-4o         |
| elite    | cheap, standard, premium, expensive | —        | gpt-4o         |

So:

- **Free:** Only cheap models (e.g. gpt-4o-mini, gpt-3.5-turbo, claude-3-haiku, gemini-1.5-flash).
- **Basic:** Cheap + standard, but **gpt-4o is blocked** (other standard models allowed).
- **Standard:** Cheap + standard, no blocks; default gpt-4o.
- **Pro:** Cheap + standard + premium (e.g. claude-3-5-sonnet); expensive models still blocked.
- **Elite:** All models, including expensive (claude-3-opus, gpt-4-turbo).

---

## 3. Token limits per tier

| Tier     | maxOutputTokens | maxInputTokens |
|----------|-----------------|----------------|
| free     | 500             | 4,000          |
| basic    | 1,000           | 8,000          |
| standard | 2,000           | 16,000         |
| pro      | 4,000           | 32,000         |
| elite    | 8,000           | 128,000        |

iOS can use these for UX (e.g. “Up to ~400 words per reply” for free) and to avoid sending requests that would exceed limits.

---

## 4. Premium model monthly budgets (Pro / Elite)

Only Pro and Elite have non-zero monthly $ budgets for premium/expensive models:

**Pro:**

- claude-3-5-sonnet: $10/month
- claude-3-opus: $0 (blocked)
- gpt-4-turbo: $0 (blocked)

**Elite:**

- claude-3-5-sonnet: $50/month
- claude-3-opus: $25/month
- gpt-4-turbo: $25/month

Backend tracks spend and returns `budgetStatus` from `GET /chat/tier-info/:userId`. If budget is exceeded for a model, the backend returns an error when that model is used (see below).

---

## 5. Sending a message (enforcing access on backend)

**Endpoints:** `POST /chat` or `POST /chat/stream`  
**Body includes:** `message`, `userId`, `sessionId`, `selectedLLM` (model id), etc.

**Backend behavior:**

1. Resolves user tier (from Munawar backend using `userId` / JWT).
2. Checks `canAccessModel(userTier, selectedLLM)`:
   - If **not allowed:** backend returns **error** (e.g. 403 or error payload). It does **not** silently switch to another model. The client should only send allowed models.
3. For premium/expensive models, checks monthly budget:
   - If over limit: backend returns error (e.g. “Monthly budget exceeded for this model”).

So the iOS app should:

- Only let the user **select** models that appear in `allowedModels` or have `allowed: true` in `models`.
- Use `defaultModel` when the user has not chosen a model or after tier downgrade.
- Send that `selectedLLM` in the request; if the user is on a tier that doesn’t allow it, the backend will reject the request.

---

## 6. Suggested iOS implementation

1. **On login / app open (and when user may have changed plan):**  
   Call `GET /chat/tier-info/:userId` (with auth if needed). Cache `tier`, `tierDisplay`, `allowedModels`, `defaultModel`, `limits`, `models`, `budgetStatus`.

2. **Model picker:**  
   Show only models with `allowed: true` (or whose `id` is in `allowedModels`). Mark `defaultModel` (e.g. “Default”) and optionally show `pricingTier` or lock icon for premium/expensive.

3. **Sending a message:**  
   Send `selectedLLM` that is one of the allowed models (or omit and let backend use default if your API supports it). If the user’s tier changes and they had a premium model selected, switch selection to `defaultModel` and optionally show a short “Plan changed” message.

4. **Limits and upgrade prompts:**  
   Use `tierDisplay.name`, `tierDisplay.features`, and `limits` to show “You’re on the Free plan. 500 token responses.” and an upgrade CTA. Use `budgetStatus` to show “Claude 3.5 Sonnet: $7.50 of $10 used this month” for Pro/Elite.

5. **Errors:**  
   If the backend returns an error about “tier does not have access to X” or “Monthly budget exceeded”, show the error message and either switch to `defaultModel` or prompt to upgrade / choose another model.

---

## 7. Config files (for reference)

- **Tiers, model access, limits, budgets:** `backend/src/config/tier-pricing.config.ts`
- **Model list and provider mapping:** `backend/src/config/llm-models.config.ts`
- **Tier info API:** `backend/src/controllers/chat.controller.ts` (`GET tier-info/:userId`)
- **Enforcement:** `backend/src/services/chat.service.ts` (`validateModelAccessAndBudget`)

No API contract changes are required for the iOS app beyond calling `GET /chat/tier-info/:userId` and using the returned `allowedModels` / `models[].allowed` and `defaultModel` when building the model picker and request body.
