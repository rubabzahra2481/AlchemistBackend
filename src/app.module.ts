import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './controllers/app.controller';
import { ChatController } from './controllers/chat.controller';
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
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // NO DatabaseModule - all data goes to Munawar's backend
  ],
  controllers: [AppController, ChatController],
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
    // Credit System (mocked - no DB needed)
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
  ],
})
export class AppModule {}
