# FAQ chatbot knowledge (replace this folder’s content)

**When you have real FAQs:** edit only the files here—no code changes required (unless you change the JSON shape).

## What to replace

| File | Purpose |
|------|---------|
| **`faqs.json`** | All FAQ entries and chatbot metadata. Replace with your content; keep the same structure (see below). |

Optional: set `FAQ_KNOWLEDGE_PATH` in `.env` to an absolute path if you store FAQs elsewhere.

## `faqs.json` shape

```json
{
  "version": "1",
  "chatbotTitle": "Short name shown to users",
  "scopeDescription": "One sentence: what this bot answers (used for out-of-scope replies).",
  "faqs": [
    {
      "id": "unique-id",
      "category": "Billing",
      "question": "How do I reset my password?",
      "answer": "Plain text answer. Can be multiple sentences."
    }
  ]
}
```

- **`version`**: string you bump when you change FAQs (invalidates server cache keys).
- **`id`**: stable string (slug); optional but helps debugging and citations.
- **`category`**: optional grouping for your UI; bot still uses full text.
- **`question` / `answer`**: required strings.

After editing, restart the backend so it reloads the file.

## Dummy content

The committed `faqs.json` is **placeholder only** for development and tests. Replace entirely with your product FAQs before production.
