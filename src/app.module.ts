import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './controllers/app.controller';
import { ChatController } from './controllers/chat.controller';
import { CreditsController } from './controllers/credits.controller';
import { ChatService } from './services/chat.service';
import { PersonalityAnalyzerService } from './services/personality-analyzer.service';
import { AdviceGeneratorService } from './services/advice-generator.service';
import { ConversationAnalyzerService } from './services/conversation-analyzer.service';
import { ParallelLLMService } from './services/parallel-llm.service';
import { LLMOrchestratorService } from './services/llm-orchestrator.service';
import { OpenAIProvider } from './providers/openai.provider';
import { ClaudeProvider } from './providers/claude.provider';
import { DeepSeekProvider } from './providers/deepseek.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { CreditService } from './services/credit.service';
import { SubscriptionService } from './services/subscription.service';
import { IOSBackendService } from './services/ios-backend.service';
import { EdnaProfileService } from './services/edna-profile.service';
import { ChatRepositoryAdapter } from './repositories/chat-repository.adapter';
import { RollingSummaryService } from './services/rolling-summary.service';
import { BudgetTrackerService } from './services/budget-tracker.service';
import { UsageStoreService } from './services/usage-store.service';
import { GuestSessionService } from './services/guest-session.service';
import { FaqChatController } from './faq-chatbot/faq-chat.controller';
import { FaqChatService } from './faq-chatbot/faq-chat.service';
import { FaqKnowledgeLoaderService } from './faq-chatbot/faq-knowledge-loader.service';
import { FaqRetrievalService } from './faq-chatbot/faq-retrieval.service';
import { FaqChatCacheService } from './faq-chatbot/faq-chat-cache.service';
import { FaqChatRateLimitGuard } from './faq-chatbot/faq-chat-rate-limit.guard';
import { ComplianceModule } from './compliance/compliance.module';

/**
 * App Module - NO DATABASE REQUIRED
 * 
 * This backend is stateless. All data storage is handled by Munawar's backend:
 * - Chat sessions/messages → Munawar's backend → Supabase
 * - User profiles/E-DNA → Munawar's backend → Supabase
 * 
 * This backend only:
 * - Processes messages with LLMs (OpenAI, Claude, etc.)
 * - Calls Munawar's backend APIs for data
 * - FAQ chatbot (`/faq-chat`) from `faq-chatbot-knowledge/` — separate from DI agent
 * - Compliance (`/api/compliance`, `/api/contracts`, `/api/webhooks`) — Amiqus + DocuSeal; isolated module
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ComplianceModule,
    // NO DatabaseModule - all data goes to Munawar's backend
  ],
  controllers: [AppController, ChatController, CreditsController, FaqChatController],
  providers: [
    ChatService,
    PersonalityAnalyzerService,
    AdviceGeneratorService,
    ConversationAnalyzerService,
    ParallelLLMService,
    // LLM Providers
    OpenAIProvider,
    ClaudeProvider,
    DeepSeekProvider,
    GeminiProvider,
    LLMOrchestratorService,
    // Usage persistence (file-based, survives restarts)
    UsageStoreService,
    // Credit System (enforced with file-based persistence)
    CreditService,
    SubscriptionService,
    // Chat Repository Adapter (uses Munawar's backend API)
    ChatRepositoryAdapter,
    // iOS/Munawar Backend Integration
    IOSBackendService,
    // E-DNA Profile Service
    EdnaProfileService,
    // Rolling Summary Service (for cost-effective long conversations)
    RollingSummaryService,
    // Budget Tracker Service (for per-model monthly credit limits)
    BudgetTrackerService,
    // Guest chat (in-memory only; no E-DNA, no Munawar persistence)
    GuestSessionService,
    // FAQ chatbot (separate from DI agent; knowledge in faq-chatbot-knowledge/)
    FaqKnowledgeLoaderService,
    FaqRetrievalService,
    FaqChatCacheService,
    FaqChatRateLimitGuard,
    FaqChatService,
  ],
})
export class AppModule {}
