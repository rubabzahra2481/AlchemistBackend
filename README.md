# 🧠 AI Alchemist - Backend

NestJS backend for AI Alchemist - Psychological advisor with 11 analysis modules and multi-LLM support.

## 🚀 Features

- 🧠 11 Psychological analysis modules (Big5, DASS, RSE, Dark Triad, CRT, Attachment, Enneagram, MBTI, Erikson, Gestalt, BioPsych)
- 🤖 Multi-LLM orchestration (OpenAI GPT-4o, Claude, DeepSeek, Gemini)
- 🎯 Smart classification and selective analysis
- 🔄 Session management with profile accumulation
- ⚖️ Conflict resolution and similarity detection
- 🛡️ Crisis detection and safety gates
- 📊 Evidence-based analysis (125,660+ research participants)
- 🚀 RESTful API with Swagger documentation

## 🛠️ Tech Stack

- **Framework:** NestJS
- **Language:** TypeScript
- **LLM Providers:** OpenAI, Anthropic Claude, DeepSeek, Google Gemini
- **Validation:** class-validator, class-transformer
- **API Docs:** Swagger/OpenAPI

## 📦 Installation

```bash
# Install dependencies
npm install

# Run development server
npm run start:dev

# Build for production
npm run build
npm run start:prod
```

## ⚙️ Configuration

### **Required: Environment Variables**

Copy `.env.example` to `.env` and add your API keys:

```bash
cp .env.example .env
```

**Required (at least one):**
```bash
OPENAI_API_KEY=sk-...          # For GPT models
```

**Optional (only if using these providers):**
```bash
ANTHROPIC_API_KEY=sk-ant-...   # For Claude models
DEEPSEEK_API_KEY=...           # For DeepSeek
GOOGLE_API_KEY=...             # For Gemini models
```

**Server Configuration:**
```bash
PORT=5000                       # Default: 5000
NODE_ENV=development            # development/production
```

## 🔌 API Endpoints

### **Chat:**
- `POST /chat` - Send message and get advice
- `GET /chat/session/:id/history` - Get conversation history
- `DELETE /chat/session/:id` - Clear session

### **Models:**
- `GET /chat/llms` - Get available LLM models

### **Quotients:**
- `GET /chat/quotients` - Get all quotients info
- `GET /chat/quotients/:id` - Get specific quotient

### **Documentation:**
- `GET /api` - Swagger UI documentation

## 📊 Psychological Analysis Modules

1. **Big Five** (19,719 participants) - Personality traits
2. **DASS-42** - Depression, Anxiety, Stress
3. **RSE** (47,974 participants) - Self-esteem
4. **Dark Triad** (18,192 participants) - Machiavellianism, Narcissism, Psychopathy
5. **CRT** - Cognitive Reflection (System 1/2 thinking)
6. **Attachment** - Relationship patterns
7. **Enneagram** - Core motivations/fears
8. **MBTI** - Cognitive preferences
9. **Erikson** - Psychosocial development stages
10. **Gestalt** - Present awareness and contact patterns
11. **BioPsych** - Biological/lifestyle factors

## 📂 Project Structure

```
backend/
├── src/
│   ├── controllers/       # API endpoints
│   ├── services/         # Business logic
│   │   ├── chat.service.ts
│   │   ├── parallel-llm.service.ts
│   │   ├── advice-generator.service.ts
│   │   └── ...
│   ├── providers/        # LLM integrations
│   │   ├── openai.provider.ts
│   │   ├── claude.provider.ts
│   │   └── ...
│   ├── config/          # LLM model configurations
│   ├── dto/             # Data transfer objects
│   └── knowledge-base/  # Psychology patterns
├── KB/                  # Psychology knowledge base (11 modules)
├── scripts/             # Utility scripts
└── .env.example         # Environment variables template
```

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## 🚀 Running

### **Development:**
```bash
npm run start:dev
# Server: http://localhost:5000
# Swagger: http://localhost:5000/api
```

### **Production:**
```bash
npm run build
npm run start:prod
```

## 🐳 Docker

```bash
docker build -t ai-alchemist-backend .
docker run -p 5000:5000 --env-file .env ai-alchemist-backend
```

## 🔗 Frontend Repository

This backend requires the AI Alchemist frontend:
- Repository: [Link to your frontend repo]
- Must connect to: http://localhost:5000 (or your production URL)

## 📊 Example Request

```bash
curl -X POST http://localhost:5000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I feel anxious about my career",
    "sessionId": "optional-uuid",
    "selectedLLM": "gpt-4o"
  }'
```

## 📄 License

MIT










