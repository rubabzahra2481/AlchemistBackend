import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
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
import { DatabaseModule } from './database/database.module';
import { ChatRepository } from './repositories/chat.repository';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule, // ✅ Add database module
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
    // Credit System (no auth required)
    CreditService,
    SubscriptionService,
    // Database
    ChatRepository, // ✅ Add repository
  ],
})
export class AppModule {}
