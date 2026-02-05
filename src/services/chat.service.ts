import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PersonalityAnalyzerService, ConversationMessage } from './personality-analyzer.service';
import { AdviceGeneratorService } from './advice-generator.service';
import { ConversationAnalyzerService } from './conversation-analyzer.service';
import { ParallelLLMService } from './parallel-llm.service';
import { LLMOrchestratorService } from './llm-orchestrator.service';
import { CreditService } from './credit.service';
import { SubscriptionService } from './subscription.service';
import { IOSBackendService } from './ios-backend.service';
import { EdnaProfileService } from './edna-profile.service';
import { BudgetTrackerService } from './budget-tracker.service';
import { ChatResponseDto } from '../dto/chat.dto';
import { getAllQuotients, getQuotientById } from '../knowledge-base/quotients.data';
import { ChatRepositoryAdapter } from '../repositories/chat-repository.adapter';
import { isPremiumModel } from '../config/subscription.config';
import { ConfigService } from '@nestjs/config';
import { 
  validateUserTier, 
  canAccessModel, 
  getDefaultModelForTier, 
  getOutputLimitForTier,
  getAllowedModelsForTier,
  UserTier 
} from '../config/tier-pricing.config';

@Injectable()
export class ChatService {
  // Keep in-memory cache for active sessions (optional - for performance)
  private sessionCache = new Map<
    string,
    {
      history: any[];
      profile: any;
      lastActivity: Date;
    }
  >();

  private readonly useIOSEDNA: boolean;

  constructor(
    private readonly personalityAnalyzer: PersonalityAnalyzerService,
    private readonly adviceGenerator: AdviceGeneratorService,
    private readonly conversationAnalyzer: ConversationAnalyzerService,
    private readonly parallelLLM: ParallelLLMService,
    private readonly llmOrchestrator: LLMOrchestratorService,
    private readonly creditService: CreditService,
    private readonly subscriptionService: SubscriptionService,
    private readonly chatRepository: ChatRepositoryAdapter,
    private readonly iosBackend: IOSBackendService, // 🔗 iOS backend for E-DNA
    private readonly ednaProfileService: EdnaProfileService, // 🧬 E-DNA profile service
    private readonly budgetTracker: BudgetTrackerService, // 💰 Budget tracking for premium models
    private readonly configService: ConfigService,
  ) {
    // USE_IOS_EDNA: Fetch E-DNA profiles from iOS backend for personalization
    // USE_IOS_BACKEND: Use iOS backend for chat storage (requires all endpoints)
    this.useIOSEDNA = this.configService.get<string>('USE_IOS_EDNA') === 'true';
    console.log(`🧬 [ChatService] iOS E-DNA profile fetch: ${this.useIOSEDNA ? 'ENABLED' : 'DISABLED'}`);
  }

  /**
   * Main method to process user messages
   * Uses parallel LLM approach with Smart Incremental analysis (Option 2)
   * @param userId - User ID (can be anonymous for non-authenticated usage)
   * @param userJwt - JWT token from iOS app for production (passed to Munawar's backend)
   */
  async processMessage(
    message: string,
    sessionId: string,
    selectedLLM: string = 'gpt-4o',
    userId: string = '00000000-0000-0000-0000-000000000000', // Default anonymous UUID
    userJwt?: string, // JWT from iOS app
  ): Promise<ChatResponseDto> {
    try {

      // ✅ Get or create session in database
      const session = await this.chatRepository.getOrCreateSession(
        sessionId,
        userId,
        selectedLLM,
        userJwt, // Pass JWT for iOS backend auth
      );
      
      // Use the actual session ID from the database (may differ from input for iOS backend)
      const actualSessionId = session.id || sessionId;

      // ✅ Load existing messages from database
      const existingMessages = await this.chatRepository.getSessionMessages(actualSessionId, userId, userJwt);
      
      // ✅ Get next sequence number
      const nextSequenceNumber = existingMessages.length + 1;

      // ✅ Save user message to database
      await this.chatRepository.saveUserMessage(actualSessionId, userId, message, nextSequenceNumber, userJwt);

      // ✅ Build history array for analysis (from existing messages + new message)
      // Ensure all timestamps are valid Date objects for ConversationMessage interface
      const history: ConversationMessage[] = [
        ...existingMessages.map((m) => ({ 
          role: m.role as 'user' | 'assistant', 
          content: m.content, 
          timestamp: m.createdAt || new Date() 
        })),
        { role: 'user' as const, content: message, timestamp: new Date() },
      ];

      // Get history WITHOUT the current message (since we pass message separately to analyzers)
      // Ensure all timestamps are valid Date objects
      const historyBeforeCurrent: ConversationMessage[] = existingMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: m.createdAt || new Date(),
      }));

      // Check credits before processing (CreditGuard already checked, but verify here too)
      const creditCheck = await this.creditService.checkCredits(userId);
      if (!creditCheck.allowed) {
        throw new Error(creditCheck.message || 'Credit limit reached');
      }

      // NEW: Parallel LLM analysis with classification and selective analysis
      // Pass history WITHOUT the current message (we pass the message separately)
      // Now includes userId for framework cap enforcement
      const psychProfile = await this.parallelLLM.analyze(
        message,
        historyBeforeCurrent,
        actualSessionId,
        selectedLLM,
        userId, // Pass userId for credit checking and framework caps
      );

      // Analyze conversation patterns across history (for behavioral patterns)
      const conversationInsights = this.conversationAnalyzer.analyzeConversation(history);

      // Build basic personality analysis (for compatibility)
      const analysis = this.personalityAnalyzer.analyzePersonality(message, actualSessionId, history);

      // Build enhanced insights from parallel LLM results + conversation patterns
      const enhancedInsights = this.buildEnhancedInsightsFromProfile(
        psychProfile,
        conversationInsights,
      );
      analysis.overallInsights = enhancedInsights;

      // Build a cleaned Profile object with confidence/evidence gating and safety/conflict
      let cleanedProfile = this.buildCleanProfile(psychProfile);

      // 📝 Extract user tier from Munawar's backend
      let userTierRaw = 'free'; // Default fallback

      // 🔗 Fetch E-DNA profile from iOS backend if enabled (for personalization)
      if (this.useIOSEDNA && userId !== '00000000-0000-0000-0000-000000000000') {
        try {
          const ednaProfile = await this.iosBackend.getUserProfile(userId, userJwt);
          if (ednaProfile?.success && ednaProfile.ednaProfile) {
            // Extract tier from user profile
            if (ednaProfile.user?.tier) {
              userTierRaw = ednaProfile.user.tier.toLowerCase();
              console.log(`📝 [ChatService] User tier: ${userTierRaw}`);
            }
            
            // Merge E-DNA profile into cleaned profile for personalization
            const confidence = typeof ednaProfile.ednaProfile.confidence === 'string' 
              ? parseFloat(ednaProfile.ednaProfile.confidence) 
              : ednaProfile.ednaProfile.confidence;
            cleanedProfile = {
              ...cleanedProfile,
              edna: {
                coreType: ednaProfile.ednaProfile.coreType,
                typeId: ednaProfile.user?.typeId || ednaProfile.ednaProfile.coreType,
                subtype: ednaProfile.ednaProfile.subtype,
                confidence: confidence || 0,
                tier: ednaProfile.user?.tier,
              },
            };
            console.log(`🧬 [ChatService] E-DNA profile loaded: ${ednaProfile.ednaProfile.coreType} (${confidence} confidence)`);
          }
        } catch (error: any) {
          console.warn(`⚠️ [ChatService] Could not fetch E-DNA profile:`, error?.message);
          // Continue without E-DNA profile - not critical
        }
      }
      
      // If tier not found from getUserProfile, try getUserById as fallback
      if (userTierRaw === 'free' && userId !== '00000000-0000-0000-0000-000000000000') {
        try {
          const userResponse = await this.iosBackend.getUserById(userId, userJwt);
          if (userResponse?.success && userResponse.user?.tier) {
            userTierRaw = userResponse.user.tier.toLowerCase();
            console.log(`📝 [ChatService] User tier from getUserById: ${userTierRaw}`);
          }
        } catch (error: any) {
          console.warn(`⚠️ [ChatService] Could not fetch user tier:`, error?.message);
        }
      }

      // 🎯 Validate and normalize user tier
      const userTier: UserTier = validateUserTier(userTierRaw);
      console.log(`🎯 [ChatService] Validated user tier: ${userTier}`);

      // 🚫 Validate model access and budget
      let finalLLM = selectedLLM;
      try {
        finalLLM = await this.validateModelAccessAndBudget(userId, userTier, selectedLLM);
      } catch (error: any) {
        // If validation fails, throw error to user
        throw new HttpException(error.message, HttpStatus.FORBIDDEN);
      }

      // 🧬 Get E-DNA profile for the user (cached, or fetch if not available)
      let ednaProfile: any = null;
      console.log(`🧬 [ChatService] E-DNA Check: isEnabled=${this.ednaProfileService.isEnabled()}, userId=${userId}, hasJwt=${!!userJwt}`);
      if (this.ednaProfileService.isEnabled() && userId !== '00000000-0000-0000-0000-000000000000') {
        try {
          ednaProfile = await this.ednaProfileService.getEdnaProfile(userId, false, userJwt);
          if (ednaProfile) {
            console.log(`🧬 [ChatService] ✅ E-DNA profile LOADED: ${ednaProfile.layers?.layer1?.coreType} - ${ednaProfile.layers?.layer2?.subtype}`);
          } else {
            console.log(`🧬 [ChatService] ⚠️ E-DNA profile returned NULL for user ${userId}`);
          }
        } catch (ednaError: any) {
          console.error(`🧬 [ChatService] ❌ E-DNA profile FAILED: ${ednaError?.message}`);
        }
      } else {
        console.log(`🧬 [ChatService] ⚠️ E-DNA SKIPPED: enabled=${this.ednaProfileService.isEnabled()}, isAnonymous=${userId === '00000000-0000-0000-0000-000000000000'}`);
      }

      // Generate personalized advice with cleaned profile, E-DNA profile, and short context
      // Pass history WITHOUT the current message (it's passed separately as userMessage parameter)
      const adviceResult = await this.adviceGenerator.generateAdviceWithProfile(
        message,
        cleanedProfile,
        historyBeforeCurrent, // Reuse the variable declared above
        finalLLM,
        actualSessionId,
        userId,
        ednaProfile, // 🧬 Pass E-DNA profile for personalization
        userTier, // 📝 Pass tier for rolling summary history limits (extracted from Munawar's backend)
      );

      // Generate context-aware recommendations
      const recommendations = this.generateContextualRecommendations(
        analysis,
        conversationInsights,
        message,
      );

      // ✅ Save assistant message to database with all metadata
      const assistantSequenceNumber = nextSequenceNumber + 1;
      await this.chatRepository.saveAssistantMessage(
        actualSessionId,
        userId,
        adviceResult.response,
        assistantSequenceNumber,
        selectedLLM,
        adviceResult.reasoning,
        analysis,
        recommendations,
        cleanedProfile,
        undefined, // frameworksTriggered
        userJwt,
      );

      // ✅ Update session in database (title, profile, message count, last activity)
      const messageCount = await this.chatRepository.getSessionMessageCount(actualSessionId, userJwt);
      
      // Auto-generate title from first user message if not set
      // Explicitly convert null to undefined for TypeScript type safety
      let title: string | undefined = session.title ?? undefined;
      if (!title && existingMessages.length === 0) {
        // First message - create title from first 50 characters
        title = message.length > 50 ? message.substring(0, 50) + '...' : message;
      }

      // Build update object with explicit null-to-undefined conversion
      const sessionUpdates: {
        title?: string;
        currentProfile?: any;
        messageCount?: number;
        selectedLLM?: string;
      } = {
        currentProfile: cleanedProfile,
        messageCount,
        selectedLLM,
      };

      // Only include title if it's defined (exclude null/undefined/empty string)
      if (title && title.trim().length > 0) {
        sessionUpdates.title = title;
      }

      await this.chatRepository.updateSession(actualSessionId, userId, sessionUpdates, userJwt);

      return {
        response: adviceResult.response,
        sessionId: actualSessionId, // Return the actual session ID from database
        analysis,
        recommendations,
        reasoning: adviceResult.reasoning, // Include reasoning in response
        profile: cleanedProfile,
      };
    } catch (error) {
      console.error('Error in processMessage:', error);

      // Re-throw HttpExceptions (like tier restrictions) so they reach the client
      if (error instanceof HttpException) {
        throw error;
      }

      // Return a fallback response for other errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        response: "I'm here to help! What's on your mind today?",
        sessionId,
        analysis: {
          overallInsights: 'New conversation',
          dominantQuotients: [],
          needsAttention: [],
          conversationContext: 'Starting new conversation',
        },
        recommendations: [],
        reasoning: `Error: ${errorMessage}`,
      };
    }
  }

  /**
   * Streaming version of processMessage - uses the SAME perfect logic but streams the response
   * This is the /chat endpoint with stream=true
   */
  async *processMessageWithStreaming(
    message: string,
    sessionId: string,
    selectedLLM: string = 'gpt-4o',
    userId: string = '00000000-0000-0000-0000-000000000000',
    userJwt?: string,
  ): AsyncGenerator<{ type: string; data: any }, void, unknown> {
    console.log(`\n🔥🔥🔥 [ChatService.processMessageWithStreaming] CALLED`);
    console.log(`📝 Message: ${message?.substring(0, 50)}...`);
    console.log(`📝 SessionId: ${sessionId}`);
    console.log(`📝 UserId: ${userId}`);
    console.log(`📝 LLM: ${selectedLLM}`);
    try {
      // Yield analyzing status
      yield { type: 'analyzing', data: { message: 'Analyzing your message...' } };

      // ✅ Get or create session in database (SAME AS processMessage)
      const session = await this.chatRepository.getOrCreateSession(sessionId, userId, selectedLLM, userJwt);
      const actualSessionId = session.id || sessionId;

      // ✅ Load existing messages
      const existingMessages = await this.chatRepository.getSessionMessages(actualSessionId, userId, userJwt);
      const nextSequenceNumber = existingMessages.length + 1;

      // ✅ Save user message
      await this.chatRepository.saveUserMessage(actualSessionId, userId, message, nextSequenceNumber, userJwt);

      // ✅ Build history
      const historyBeforeCurrent: ConversationMessage[] = existingMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: m.createdAt || new Date(),
      }));

      // Check credits
      const creditCheck = await this.creditService.checkCredits(userId);
      if (!creditCheck.allowed) {
        yield { type: 'error', data: { message: creditCheck.message || 'Credit limit reached' } };
        return;
      }

      // ✅ Parallel LLM analysis (SAME AS processMessage)
      const psychProfile = await this.parallelLLM.analyze(
        message,
        historyBeforeCurrent,
        actualSessionId,
        selectedLLM,
        userId,
      );

      // Build analysis and insights (SAME AS processMessage)
      const history: ConversationMessage[] = [
        ...historyBeforeCurrent,
        { role: 'user' as const, content: message, timestamp: new Date() },
      ];
      const conversationInsights = this.conversationAnalyzer.analyzeConversation(history);
      const analysis = this.personalityAnalyzer.analyzePersonality(message, actualSessionId, history);
      const enhancedInsights = this.buildEnhancedInsightsFromProfile(psychProfile, conversationInsights);
      analysis.overallInsights = enhancedInsights;
      let cleanedProfile = this.buildCleanProfile(psychProfile);

      // 📝 Get user tier (SAME AS processMessage)
      let userTierRaw = 'free';
      if (this.useIOSEDNA && userId !== '00000000-0000-0000-0000-000000000000') {
        try {
          const ednaProfileResponse = await this.iosBackend.getUserProfile(userId, userJwt);
          if (ednaProfileResponse?.success && ednaProfileResponse.user?.tier) {
            userTierRaw = ednaProfileResponse.user.tier.toLowerCase();
          }
        } catch (error: any) {
          try {
            const userResponse = await this.iosBackend.getUserById(userId, userJwt);
            if (userResponse?.success && userResponse.user?.tier) {
              userTierRaw = userResponse.user.tier.toLowerCase();
            }
          } catch (fallbackError: any) {
            console.warn(`⚠️ [ChatService StreamV2] Could not fetch user tier`);
          }
        }
      }
      const userTier: UserTier = validateUserTier(userTierRaw);

      // 🚫 Validate model access and budget
      let finalLLM = selectedLLM;
      try {
        finalLLM = await this.validateModelAccessAndBudget(userId, userTier, selectedLLM);
      } catch (error: any) {
        yield { type: 'error', data: { message: error.message } };
        return;
      }

      // 🧬 Get E-DNA profile (SAME AS processMessage)
      let ednaProfile: any = null;
      console.log(`\n🧬🧬🧬 [ChatService] FETCHING E-DNA for userId: ${userId}`);
      console.log(`🧬 [ChatService] E-DNA service enabled: ${this.ednaProfileService.isEnabled()}`);
      console.log(`🧬 [ChatService] Is anonymous user: ${userId === '00000000-0000-0000-0000-000000000000'}`);
      
      if (this.ednaProfileService.isEnabled() && userId !== '00000000-0000-0000-0000-000000000000') {
        try {
          ednaProfile = await this.ednaProfileService.getEdnaProfile(userId, false, userJwt);
          console.log(`🧬 [ChatService] ✅ E-DNA profile LOADED! CoreType: ${ednaProfile?.layer1?.coreType || 'unknown'}`);
        } catch (ednaError: any) {
          console.error(`🧬 [ChatService StreamV2] ❌ E-DNA profile FAILED: ${ednaError?.message}`);
        }
      } else {
        console.log(`🧬 [ChatService] ⚠️ E-DNA SKIPPED - service disabled or anonymous user`);
      }

      // Send profile and analysis data
      yield { type: 'profile', data: cleanedProfile };
      yield { type: 'analysis', data: analysis };
      yield { type: 'generating', data: { message: 'Generating response...' } };

      // ✅ Stream the advice using the SAME perfect generateAdviceWithProfile logic
      let fullResponse = '';
      let reasoning = '';

      for await (const chunk of this.adviceGenerator.generateAdviceWithProfileStreaming(
        message,
        cleanedProfile,
        historyBeforeCurrent,
        finalLLM,
        actualSessionId,
        userId,
        ednaProfile,
        userTier,
      )) {
        if (chunk.type === 'token') {
          fullResponse += chunk.content;
          yield { type: 'token', data: { content: chunk.content } };
        } else if (chunk.type === 'reasoning') {
          reasoning = chunk.content;
          yield { type: 'reasoning', data: { content: chunk.content } };
        } else if (chunk.type === 'done') {
          if (chunk.content) {
            fullResponse = chunk.content;
          }
        }
      }

      // Generate recommendations
      const recommendations = this.generateContextualRecommendations(analysis, conversationInsights, message);

      // ✅ Save assistant message (SAME AS processMessage)
      const assistantSequenceNumber = nextSequenceNumber + 1;
      await this.chatRepository.saveAssistantMessage(
        actualSessionId,
        userId,
        fullResponse,
        assistantSequenceNumber,
        selectedLLM,
        reasoning,
        analysis,
        recommendations,
        cleanedProfile,
        undefined,
        userJwt,
      );

      // ✅ Update session
      const messageCount = await this.chatRepository.getSessionMessageCount(actualSessionId, userJwt);
      let title: string | undefined = session.title ?? undefined;
      if (!title && existingMessages.length === 0) {
        title = message.length > 50 ? message.substring(0, 50) + '...' : message;
      }

      const sessionUpdates: { title?: string; currentProfile?: any; messageCount?: number; selectedLLM?: string } = {
        currentProfile: cleanedProfile,
        messageCount,
        selectedLLM,
      };
      if (title && title.trim().length > 0) {
        sessionUpdates.title = title;
      }
      await this.chatRepository.updateSession(actualSessionId, userId, sessionUpdates, userJwt);

      // Final done chunk
      console.log(`🏁 [ChatService] Sending DONE chunk. Reasoning length: ${reasoning?.length || 0}, sample: ${reasoning?.substring(0, 80)}`);
      yield {
        type: 'done',
        data: {
          response: fullResponse,
          sessionId: actualSessionId,
          analysis,
          recommendations,
          reasoning,
          profile: cleanedProfile,
        },
      };
    } catch (error: any) {
      console.error('Error in processMessageWithStreaming:', error);
      yield { type: 'error', data: { message: error.message || 'An error occurred' } };
    }
  }

  /**
   * Build enhanced insights from parallel LLM profile + conversation patterns
   */
  private buildEnhancedInsightsFromProfile(profile: any, insights: any): string {
    const parts: string[] = [];

    // Add behavioral patterns (from conversation analyzer)
    if (insights.behavioralPatterns && insights.behavioralPatterns.length > 0) {
      parts.push(`IMPORTANT PATTERN DETECTED: ${insights.behavioralPatterns[0]}`);
    }

    // Add Big Five insights (from parallel LLM)
    if (profile?.bigFive?.insights && profile.bigFive.insights.length > 0) {
      parts.push(`Personality: ${profile.bigFive.insights.join('; ')}`);
    }

    // Add mental health concerns (from parallel LLM)
    if (profile?.dass?.concerns && profile.dass.concerns.length > 0) {
      parts.push(`⚠️ ${profile.dass.concerns[0]}`);
    }

    // Add self-esteem (from parallel LLM)
    if (profile?.rse?.indicators && profile.rse.indicators.length > 0) {
      parts.push(`Self-Esteem: ${profile.rse.level} (${profile.rse.indicators[0]})`);
    }

    // Add interpersonal patterns (from parallel LLM)
    if (profile?.darkTriad?.insights && profile.darkTriad.insights.length > 0) {
      parts.push(`Interpersonal Patterns: ${profile.darkTriad.insights.join(', ')}`);
    }

    // Add cognitive/thinking style (from parallel LLM)
    if (profile?.crt?.insights && profile.crt.insights.length > 0) {
      parts.push(`Thinking Style: ${profile.crt.insights.join('; ')}`);
    }

    // Add recurring theme context
    if (insights.recurringThemes && insights.recurringThemes.length > 0) {
      parts.push(`Recurring focus: ${insights.recurringThemes[0]}`);
    }

    // Add emotional progression
    if (insights.emotionalProgression === 'worsening') {
      parts.push(`Emotional state appears to be declining - needs immediate support`);
    } else if (insights.emotionalProgression === 'improving') {
      parts.push(`Showing signs of progress`);
    }

    return parts.length > 0 ? parts.join('. ') : '';
  }

  // Create a clean Profile object for the responder
  // Enhanced with conflict/similarity/mild handling
  /**
   * Validate model access and budget for a user
   * @returns The validated model to use (may throw if access denied)
   */
  private async validateModelAccessAndBudget(
    userId: string,
    userTier: UserTier,
    requestedModel: string,
  ): Promise<string> {
    // 🚫 Check if user can access the requested model
    if (!canAccessModel(userTier, requestedModel)) {
      const allowedModels = getAllowedModelsForTier(userTier);
      const fallbackModel = getDefaultModelForTier(userTier);
      
      console.warn(
        `🚫 [ChatService] User tier "${userTier}" cannot access model "${requestedModel}". Falling back to "${fallbackModel}"`
      );
      
      throw new Error(
        `Your ${userTier} tier does not have access to ${requestedModel}. ` +
        `Available models: ${allowedModels.join(', ')}. ` +
        `Please upgrade your plan or select a different model.`
      );
    }

    // 💰 Check monthly budget for premium models
    const budgetCheck = await this.budgetTracker.checkBudget(userId, userTier, requestedModel);
    if (!budgetCheck.allowed) {
      console.warn(`💰 [ChatService] Budget exceeded: ${budgetCheck.reason}`);
      throw new Error(budgetCheck.reason || 'Monthly budget exceeded for this model');
    }
    
    if (budgetCheck.limit !== Infinity) {
      console.log(
        `💰 [ChatService] Budget status for ${requestedModel}: $${budgetCheck.spent.toFixed(2)}/$${budgetCheck.limit} (${budgetCheck.remaining.toFixed(2)} remaining)`
      );
    }

    return requestedModel;
  }

  private buildCleanProfile(profile: any) {
    if (!profile || typeof profile !== 'object') return profile;
    const clone: any = {};

    // Always pass through safety and per-message summary if present
    if (profile.safety) clone.safety = profile.safety;
    if (profile.summaryForThisMessage) clone.summaryForThisMessage = profile.summaryForThisMessage;

    // Helper to gate by confidence >= 0.5 and has evidence if present
    const passGate = (obj: any) => {
      if (!obj || typeof obj !== 'object') return false;
      const conf = obj.Confidence ?? obj.confidence;
      const evidence = obj.Evidence ?? obj.evidence;
      if (conf === undefined) return true; // keep if analyzer didn't return confidence

      // Handle object-based confidence (e.g. MBTI: {EI: 0.7, SN: 0.5})
      if (typeof conf === 'object' && conf !== null) {
        const maxConf = Math.max(...Object.values(conf).filter((v: any) => typeof v === 'number'));
        if (maxConf >= 0.5) {
          if (Array.isArray(evidence)) return evidence.length > 0;
          return true;
        }
        return false;
      }

      // Handle number confidence
      if (typeof conf === 'number' && conf >= 0.5) {
        if (Array.isArray(evidence)) return evidence.length > 0; // require evidence when provided
        return true;
      }
      return false;
    };

    // Helper to normalize scores (handles both numeric and string formats)
    const getScore = (
      value: any,
      highThreshold: number = 4,
      lowThreshold: number = 2,
    ): 'high' | 'medium' | 'low' | null => {
      if (value === null || value === undefined) return null;
      if (typeof value === 'number') {
        if (value >= highThreshold) return 'high';
        if (value <= lowThreshold) return 'low';
        return 'medium'; // Between thresholds = mild/in-between
      }
      if (typeof value === 'string') {
        const lower = value.toLowerCase();
        if (lower.includes('high') || lower.includes('severe') || lower === 'high') return 'high';
        if (lower.includes('low') || lower.includes('normal') || lower === 'low') return 'low';
        return 'medium';
      }
      return null;
    };

    // Helper to get numeric value for calculations
    const getNumericScore = (value: any): number | null => {
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const lower = value.toLowerCase();
        if (lower.includes('high') || lower.includes('severe')) return 4.5;
        if (lower.includes('low') || lower.includes('normal')) return 1.5;
        return 3.0; // medium/mild
      }
      return null;
    };

    // Store original modules first (before integration)
    const modules: any = {};
    if (profile.bigFive && passGate(profile.bigFive)) modules.bigFive = profile.bigFive;
    if (profile.dass && passGate(profile.dass)) modules.dass = profile.dass;
    if (profile.rse && passGate(profile.rse)) modules.rse = profile.rse;
    if (profile.darkTriad && passGate(profile.darkTriad)) modules.darkTriad = profile.darkTriad;
    if (profile.crt && passGate(profile.crt)) modules.crt = profile.crt;
    if (profile.attachment && passGate(profile.attachment)) modules.attachment = profile.attachment;
    // Enneagram uses lower threshold (0.2) because KB returns low confidence for ambiguous messages
    if (profile.enneagram) {
      const conf = profile.enneagram.Confidence ?? profile.enneagram.confidence;
      const evidence = profile.enneagram.Evidence ?? profile.enneagram.evidence;
      // Accept if confidence >= 0.2 (lower than standard 0.5) AND has evidence
      const passed = conf === undefined || (typeof conf === 'number' && conf >= 0.2 && Array.isArray(evidence) && evidence.length > 0);
      if (passed) modules.enneagram = profile.enneagram;
    }

    if (profile.mbti && passGate(profile.mbti)) modules.mbti = profile.mbti;
    if (profile.erikson && passGate(profile.erikson)) modules.erikson = profile.erikson;
    if (profile.gestalt && passGate(profile.gestalt)) modules.gestalt = profile.gestalt;
    if (profile.bioPsych && passGate(profile.bioPsych)) modules.bioPsych = profile.bioPsych;

    // Enhanced conflict detection: check for theoretical conflicts between overlapping models
    const conflicts: string[] = [];

    try {
      const bf = profile.bigFive;
      const dass = profile.dass;
      const rse = profile.rse;
      const dt = profile.darkTriad;
      const mbti = profile.mbti;
      const ennea = profile.enneagram;

      // Helper to normalize scores (handle both numeric and string formats)
      const getScore = (
        value: any,
        highThreshold: number = 4,
        lowThreshold: number = 2,
      ): 'high' | 'medium' | 'low' | null => {
        if (value === null || value === undefined) return null;
        if (typeof value === 'number') {
          if (value >= highThreshold) return 'high';
          if (value <= lowThreshold) return 'low';
          return 'medium';
        }
        if (typeof value === 'string') {
          const lower = value.toLowerCase();
          if (lower.includes('high') || lower.includes('severe') || lower === 'high') return 'high';
          if (lower.includes('low') || lower.includes('normal') || lower === 'low') return 'low';
          return 'medium';
        }
        return null;
      };

      // Conflict 1: High Neuroticism but Low Anxiety (DASS)
      // Theory: Neuroticism should correlate with anxiety. High Neuroticism + low anxiety = conflicting signals
      if (bf && dass) {
        const neuroticism = getScore(bf.Neuroticism ?? bf.neuroticism);
        const anxiety = getScore(dass.anxiety ?? dass.Anxiety, 3, 2);
        if (
          neuroticism === 'high' &&
          anxiety === 'low' &&
          bf.Confidence >= 0.7 &&
          dass.Confidence >= 0.7
        ) {
          conflicts.push('High Neuroticism (Big5) conflicts with Low Anxiety (DASS)');
        }
      }

      // Conflict 2: High Agreeableness + High Dark Triad
      // Theory: Dark Triad correlates with low Agreeableness. Both high = theoretical conflict
      if (bf && dt) {
        const agree = getScore(bf.Agreeableness ?? bf.agreeableness);
        const mach = getScore(dt.Machiavellianism ?? dt.machiavellianism);
        const narc = getScore(dt.Narcissism ?? dt.narcissism);
        const psych = getScore(dt.Psychopathy ?? dt.psychopathy);
        const highDT = mach === 'high' || narc === 'high' || psych === 'high';
        if (agree === 'high' && highDT) {
          conflicts.push('High Agreeableness (Big5) conflicts with High Dark Triad traits');
        }
      }

      // Conflict 3: Extraversion/Introversion Consistency Check
      // Theory: Big5 Extraversion, MBTI E/I, and Enneagram (Type 7 vs Type 5) should align
      if (bf || mbti || ennea) {
        const extraversionSignals: ('high' | 'low' | null)[] = [];

        if (bf) {
          const ext = getScore(bf.Extraversion ?? bf.extraversion);
          if (ext === 'high') extraversionSignals.push('high');
          if (ext === 'low') extraversionSignals.push('low');
        }

        if (mbti) {
          const ei = mbti.EI;
          if (
            ei === 'E' &&
            mbti.Confidence &&
            (typeof mbti.Confidence === 'object'
              ? mbti.Confidence.EI >= 0.7
              : mbti.Confidence >= 0.7)
          ) {
            extraversionSignals.push('high');
          } else if (
            ei === 'I' &&
            mbti.Confidence &&
            (typeof mbti.Confidence === 'object'
              ? mbti.Confidence.EI >= 0.7
              : mbti.Confidence >= 0.7)
          ) {
            extraversionSignals.push('low');
          }
        }

        if (ennea) {
          const type = ennea.Primary_Type;
          // Type 7 (Enthusiast) is extraverted, Type 5 (Investigator) is introverted
          if (type === 7 && ennea.Confidence >= 0.7) extraversionSignals.push('high');
          if (type === 5 && ennea.Confidence >= 0.7) extraversionSignals.push('low');
        }

        const highCount = extraversionSignals.filter((s) => s === 'high').length;
        const lowCount = extraversionSignals.filter((s) => s === 'low').length;

        // If we have 2+ signals and they conflict (mix of high and low), that's a conflict
        if (extraversionSignals.length >= 2 && highCount > 0 && lowCount > 0) {
          conflicts.push(
            `Mixed Extraversion/Introversion signals (${highCount} high, ${lowCount} low)`,
          );
        }
      }

      // Conflict 4: Self-Esteem Consistency
      // Theory: Low RSE should correlate with high Neuroticism and/or DASS Depression
      if (rse && (bf || dass)) {
        const rseLevel = rse.level?.toLowerCase();
        const isLowSelfEsteem = rseLevel === 'low' || rseLevel === 'very low';

        if (isLowSelfEsteem && rse.Confidence >= 0.7) {
          let inconsistent = false;

          if (bf) {
            const neuroticism = getScore(bf.Neuroticism ?? bf.neuroticism);
            // Low self-esteem should correlate with high Neuroticism
            if (neuroticism === 'low' && bf.Confidence >= 0.7) {
              inconsistent = true;
            }
          }

          if (dass && !inconsistent) {
            const depression = getScore(dass.depression ?? dass.Depression, 3, 2);
            // Low self-esteem should correlate with at least mild depression
            if (depression === 'low' || depression === null) {
              inconsistent = true;
            }
          }

          if (inconsistent) {
            conflicts.push(
              'Low Self-Esteem (RSE) conflicts with low Neuroticism/Depression indicators',
            );
          }
        }
      }

      // Conflict 5: Stress vs Conscientiousness
      // Theory: High Conscientiousness (organized, responsible) might conflict with extreme stress
      if (bf && dass) {
        const consci = getScore(bf.Conscientiousness ?? bf.conscientiousness);
        const stress = getScore(dass.stress ?? dass.Stress, 3, 2);
        // High Conscientiousness people are usually better at managing stress
        // But moderate stress with very high Conscientiousness can indicate perfectionism-related stress
        // We'll flag if Conscientiousness is very high AND stress is very high (perfectionism conflict)
        if (
          consci === 'high' &&
          stress === 'high' &&
          bf.Confidence >= 0.7 &&
          dass.Confidence >= 0.7
        ) {
          conflicts.push(
            'High Conscientiousness + High Stress may indicate perfectionism-related tension',
          );
        }
      }
    } catch (error) {
      console.warn('Error in conflict detection:', error);
    }

    // ====================================================================
    // HANDLE THREE SITUATIONS: CONFLICTS, SIMILARITIES, MILD/IN-BETWEEN
    // ====================================================================

    const integrations: any = {
      similarities: [],
      mildCases: [],
      conflictResolutions: [],
    };

    try {
      const bf = modules.bigFive;
      const dass = modules.dass;
      const rse = modules.rse;
      const dt = modules.darkTriad;
      const mbti = modules.mbti;
      const ennea = modules.enneagram;

      // ===========================================
      // SITUATION 1: HANDLE CONFLICTS
      // ===========================================
      // When models disagree, reduce confidence and mark as uncertain

      // Conflict: Neuroticism vs Anxiety
      if (bf && dass && conflicts.some((c) => c.includes('Neuroticism'))) {
        const bfConf = bf.Confidence ?? bf.confidence ?? 0.8;
        const dassConf = dass.Confidence ?? dass.confidence ?? 0.8;

        // Use the higher confidence result, but reduce it
        if (bfConf >= dassConf) {
          bf.Confidence = Math.max(0.4, bfConf * 0.7); // Reduce by 30%
          bf.integrationNote = 'Confidence reduced due to conflict with DASS Anxiety';
        } else {
          dass.Confidence = Math.max(0.4, dassConf * 0.7);
          dass.integrationNote = 'Confidence reduced due to conflict with Big5 Neuroticism';
        }
        integrations.conflictResolutions.push({
          conflict: 'Neuroticism vs Anxiety',
          action: 'Reduced confidence on conflicting model',
          finalConfidence: Math.max(bfConf, dassConf) * 0.7,
        });
      }

      // Conflict: Agreeableness vs Dark Triad
      if (bf && dt && conflicts.some((c) => c.includes('Agreeableness'))) {
        const bfConf = bf.Confidence ?? bf.confidence ?? 0.8;
        const dtConf = dt.Confidence ?? dt.confidence ?? 0.8;

        // Dark Triad usually wins (more specific), but reduce both
        dt.Confidence = Math.max(0.4, dtConf * 0.75);
        bf.Confidence = Math.max(0.4, bfConf * 0.8);
        bf.integrationNote = 'Agreeableness may be situational, not trait-based';
        integrations.conflictResolutions.push({
          conflict: 'Agreeableness vs Dark Triad',
          action: 'Both reduced, favoring Dark Triad (more specific)',
        });
      }

      // Conflict: Extraversion inconsistency
      if (conflicts.some((c) => c.includes('Extraversion'))) {
        const signals: Array<{
          source: string;
          value: 'high' | 'low' | 'medium' | null;
          conf: number;
        }> = [];
        if (bf)
          signals.push({
            source: 'Big5',
            value: getScore(bf.Extraversion ?? bf.extraversion),
            conf: bf.Confidence ?? 0.8,
          });
        if (mbti) {
          const eiValue: 'high' | 'low' | null =
            mbti.EI === 'E' ? 'high' : mbti.EI === 'I' ? 'low' : null;
          signals.push({
            source: 'MBTI',
            value: eiValue,
            conf:
              typeof mbti.Confidence === 'object'
                ? (mbti.Confidence as any).EI
                : (mbti.Confidence ?? 0.8),
          });
        }
        if (ennea) {
          const enneaValue: 'high' | 'low' | null =
            ennea.Primary_Type === 7 ? 'high' : ennea.Primary_Type === 5 ? 'low' : null;
          signals.push({ source: 'Enneagram', value: enneaValue, conf: ennea.Confidence ?? 0.8 });
        }

        if (signals.length > 0) {
          // Use highest confidence, but mark as uncertain
          const highest = signals.reduce((max, s) => (s.conf > max.conf ? s : max), signals[0]);
          const highestSource = `${highest.source} (conflicting signals, using highest confidence)`;
          integrations.conflictResolutions.push({
            conflict: 'Extraversion/Introversion',
            action: `Using ${highestSource} result, but marked as uncertain`,
            signals: signals.length,
          });
        }
      }

      // ===========================================
      // SITUATION 2: HANDLE SIMILARITIES/AGREEMENT
      // ===========================================
      // When multiple models agree, boost confidence (triangulation)

      // Similarity: Anxiety signals (Neuroticism + DASS Anxiety)
      if (bf && dass && !conflicts.some((c) => c.includes('Neuroticism'))) {
        const neuroticism = getScore(bf.Neuroticism ?? bf.neuroticism);
        const anxiety = getScore(dass.anxiety ?? dass.Anxiety, 3, 2);

        if (neuroticism === 'high' && anxiety === 'high') {
          // Both agree - boost confidence
          const bfConf = bf.Confidence ?? bf.confidence ?? 0.8;
          const dassConf = dass.Confidence ?? dass.confidence ?? 0.8;
          bf.Confidence = Math.min(1.0, bfConf * 1.15); // Boost by 15%
          dass.Confidence = Math.min(1.0, dassConf * 1.15);
          integrations.similarities.push({
            models: ['Big5 Neuroticism', 'DASS Anxiety'],
            agreement: 'High anxiety confirmed by both models',
            confidenceBoost: '15%',
          });
        }
      }

      // Similarity: Extraversion agreement
      if (bf && (mbti || ennea) && !conflicts.some((c) => c.includes('Extraversion'))) {
        const bfExtra = getScore(bf.Extraversion ?? bf.extraversion);
        let agreementCount = 1; // Big5 counts as 1

        if (mbti && mbti.EI === 'E' && bfExtra === 'high') agreementCount++;
        if (mbti && mbti.EI === 'I' && bfExtra === 'low') agreementCount++;
        if (ennea && ennea.Primary_Type === 7 && bfExtra === 'high') agreementCount++;
        if (ennea && ennea.Primary_Type === 5 && bfExtra === 'low') agreementCount++;

        if (agreementCount >= 2) {
          // Multiple models agree - boost Big5 confidence
          const bfConf = bf.Confidence ?? bf.confidence ?? 0.8;
          bf.Confidence = Math.min(1.0, bfConf * 1.2); // Boost by 20%
          integrations.similarities.push({
            models: ['Big5 Extraversion', mbti ? 'MBTI' : '', ennea ? 'Enneagram' : ''].filter(
              Boolean,
            ),
            agreement: `${agreementCount} models agree on Extraversion level`,
            confidenceBoost: '20%',
          });
        }
      }

      // Similarity: Self-esteem consistency (RSE + Neuroticism/Depression)
      if (rse && (bf || dass) && !conflicts.some((c) => c.includes('Self-Esteem'))) {
        const rseLevel = rse.level?.toLowerCase();
        const isLowSelfEsteem = rseLevel === 'low' || rseLevel === 'very low';

        if (isLowSelfEsteem) {
          const neuroticism = bf ? getScore(bf.Neuroticism ?? bf.neuroticism) : null;
          const depression = dass ? getScore(dass.depression ?? dass.Depression, 3, 2) : null;

          if (neuroticism === 'high' || (depression && depression !== 'low')) {
            // Models agree - boost confidence
            const rseConf = rse.Confidence ?? rse.confidence ?? 0.8;
            rse.Confidence = Math.min(1.0, rseConf * 1.15);
            integrations.similarities.push({
              models: [
                'RSE',
                neuroticism === 'high' ? 'Big5 Neuroticism' : '',
                depression ? 'DASS Depression' : '',
              ].filter(Boolean),
              agreement: 'Low self-esteem confirmed by multiple indicators',
              confidenceBoost: '15%',
            });
          }
        }
      }

      // ===========================================
      // SITUATION 3: HANDLE MILD/IN-BETWEEN CASES
      // ===========================================
      // When scores are in the middle range, recognize as "balanced" or "moderate"

      // Mild case: Neuroticism is medium (2-4 range)
      if (bf) {
        const neuroticism = getNumericScore(bf.Neuroticism ?? bf.neuroticism);
        if (neuroticism !== null && neuroticism >= 2.5 && neuroticism <= 3.5) {
          if (!bf.integrationNote) bf.integrationNote = '';
          bf.integrationNote +=
            (bf.integrationNote ? '; ' : '') + 'Moderate/balanced emotional sensitivity';
          integrations.mildCases.push({
            trait: 'Neuroticism',
            value: neuroticism.toFixed(1),
            interpretation: 'Moderate - neither highly anxious nor very calm',
          });
        }
      }

      // Mild case: Extraversion is medium
      if (bf) {
        const extraversion = getNumericScore(bf.Extraversion ?? bf.extraversion);
        if (extraversion !== null && extraversion >= 2.5 && extraversion <= 3.5) {
          if (!bf.integrationNote) bf.integrationNote = '';
          bf.integrationNote +=
            (bf.integrationNote ? '; ' : '') + 'Balanced social energy (ambivert)';
          integrations.mildCases.push({
            trait: 'Extraversion',
            value: extraversion.toFixed(1),
            interpretation: 'Moderate - comfortable in both social and solitary settings',
          });
        }
      }

      // Mild case: DASS scores are all normal/mild
      if (dass) {
        const anxiety = getNumericScore(dass.anxiety ?? dass.Anxiety);
        const depression = getNumericScore(dass.depression ?? dass.Depression);
        const stress = getNumericScore(dass.stress ?? dass.Stress);

        if (anxiety !== null && depression !== null && stress !== null) {
          const allMild = anxiety <= 3 && depression <= 3 && stress <= 3;
          if (allMild && (anxiety >= 1 || depression >= 1 || stress >= 1)) {
            dass.integrationNote =
              'All emotional distress levels are mild/normal - generally stable emotional state';
            integrations.mildCases.push({
              trait: 'DASS (all dimensions)',
              values: {
                anxiety: anxiety.toFixed(1),
                depression: depression.toFixed(1),
                stress: stress.toFixed(1),
              },
              interpretation: 'Mild levels across the board - emotionally balanced',
            });
          }
        }
      }

      // Mild case: Self-esteem is medium
      if (rse) {
        const rseLevel = rse.level?.toLowerCase();
        if (rseLevel === 'medium' || rseLevel === 'moderate') {
          rse.integrationNote = 'Moderate self-esteem - balanced self-view with occasional doubt';
          integrations.mildCases.push({
            trait: 'Self-Esteem',
            value: rseLevel,
            interpretation: 'Moderate - neither very confident nor very insecure',
          });
        }
      }
    } catch (error) {
      console.warn('Error in integration handling:', error);
    }

    // ====================================================================
    // FINALIZE: Copy integrated modules and metadata
    // ====================================================================

    // Copy modules (which may have been modified with confidence adjustments and notes)
    Object.keys(modules).forEach((key) => {
      clone[key] = modules[key];
    });

    // Add integration metadata
    if (
      integrations.similarities.length > 0 ||
      integrations.mildCases.length > 0 ||
      integrations.conflictResolutions.length > 0
    ) {
      clone.integrationMeta = {
        similarities: integrations.similarities,
        mildCases: integrations.mildCases,
        conflictResolutions: integrations.conflictResolutions,
      };
    }

    // Set conflict flag and details
    clone.conflict = conflicts.length > 0;
    if (conflicts.length > 0) {
      clone.conflictDetails = conflicts;
    }

    return clone;
  }

  /**
   * Build enhanced insights combining personality + conversation patterns (OLD METHOD - kept for compatibility)
   */
  private buildEnhancedInsights(
    analysis: any,
    insights: any,
    currentMessage: string,
    psychProfile?: any,
  ): string {
    const parts: string[] = [];

    // Add BEHAVIORAL PATTERNS (STAGE 1 FIX)
    if (insights.behavioralPatterns && insights.behavioralPatterns.length > 0) {
      parts.push(`IMPORTANT PATTERN DETECTED: ${insights.behavioralPatterns[0]}`);

      if (insights.behavioralPatterns.length > 1) {
        parts.push(`Additional pattern: ${insights.behavioralPatterns[1]}`);
      }
    }

    // Add PSYCHOLOGICAL PROFILE from KB (STAGE 2 - NEW!)
    if (psychProfile) {
      const psychInsights: string[] = [];

      // Big Five insights
      if (psychProfile.bigFive.insights.length > 0) {
        psychInsights.push(`Personality: ${psychProfile.bigFive.insights.slice(0, 2).join('; ')}`);
      }

      // Mental health concerns (CRITICAL)
      if (psychProfile.mentalHealth.concerns.length > 0) {
        psychInsights.push(`⚠️ ${psychProfile.mentalHealth.concerns[0]}`);
      }

      // Self-esteem
      if (
        psychProfile.selfEsteem.level === 'low' &&
        psychProfile.selfEsteem.indicators.length > 0
      ) {
        psychInsights.push(`Self-Esteem: Low (${psychProfile.selfEsteem.indicators[0]})`);
      }

      // Core needs (SDT)
      if (
        psychProfile.coreNeeds.analysis &&
        !psychProfile.coreNeeds.analysis.includes('reasonably met')
      ) {
        psychInsights.push(`Core Needs: ${psychProfile.coreNeeds.analysis}`);
      }

      if (psychInsights.length > 0) {
        parts.push(`PSYCHOLOGICAL ASSESSMENT: ${psychInsights.join('. ')}`);
      }
    }

    // Add recurring theme context
    if (insights.recurringThemes.length > 0) {
      parts.push(`Recurring focus: ${insights.recurringThemes[0]}`);
    }

    // Add emotional progression
    if (insights.emotionalProgression === 'worsening') {
      parts.push(`Emotional state appears to be declining - needs immediate support`);
    } else if (insights.emotionalProgression === 'improving') {
      parts.push(`Showing signs of progress`);
    }

    // Add hidden concerns
    if (insights.hiddenConcerns.length > 0) {
      parts.push(`Subtext detected: ${insights.hiddenConcerns[0]}`);
    }

    // Add conversation depth context
    parts.push(`Trust level: ${insights.trustLevel}`);
    parts.push(`Recommended approach: ${insights.recommendedApproach}`);

    // Add original insights if available
    if (analysis.overallInsights && !analysis.overallInsights.includes('balanced profile')) {
      parts.push(analysis.overallInsights);
    }

    return parts.join('. ');
  }

  /**
   * Generate recommendations based on conversation context
   */
  private generateContextualRecommendations(
    analysis: any,
    insights: any,
    message: string,
  ): string[] {
    const recs: string[] = [];

    // Based on recurring themes
    if (insights.recurringThemes.includes('stress')) {
      recs.push('Take one thing off your plate this week');
    }
    if (insights.recurringThemes.includes('self-worth')) {
      recs.push('Write down one thing you did well today');
    }
    if (insights.recurringThemes.includes('direction')) {
      recs.push('Explore what makes you lose track of time');
    }

    // Based on trust level
    if (insights.trustLevel === 'guarded') {
      recs.push('Be honest with yourself about what you really need');
    }

    // Based on hidden concerns
    if (insights.hiddenConcerns.includes('minimizing their problems')) {
      recs.push("Your feelings matter - don't dismiss them");
    }

    // Add default if empty
    if (recs.length === 0) {
      recs.push('Take it one small step at a time');
    }

    return recs.slice(0, 3);
  }

  /**
   * Generate natural recommendations (no jargon)
   */
  private generateSimpleRecommendations(profile: any): string[] {
    const recs: string[] = [];

    if (profile.mentalState?.stress !== 'none') {
      recs.push('Take regular breaks - even 5 minutes helps');
    }

    if (profile.selfEsteem?.level === 'low') {
      recs.push('Write down one thing you did well today');
    }

    if (profile.darkTriad?.insights?.some((i: string) => i.toLowerCase().includes('manipulat'))) {
      recs.push('Focus on building genuine connections');
    }

    if (recs.length === 0) {
      recs.push('Practice daily self-reflection');
    }

    return recs.slice(0, 3);
  }

  /**
   * Gets conversation history for a session
   */
  async getSessionHistory(sessionId: string, userId: string = '00000000-0000-0000-0000-000000000000', userJwt?: string): Promise<any[]> {
    // ✅ Get messages from database
    const messages = await this.chatRepository.getSessionMessages(sessionId, userId, userJwt);
    return messages.map((m) => ({
      role: m.role,
      content: m.content,
      timestamp: m.createdAt,
      reasoning: m.reasoning,
      analysis: m.analysis,
      profile: m.profileSnapshot,
      recommendations: m.recommendations,
    }));
  }

  /**
   * Clears a session
   */
  async clearSession(sessionId: string, userId: string = '00000000-0000-0000-0000-000000000000', userJwt?: string): Promise<void> {
    // ✅ Delete session from database (cascade delete will remove all messages)
    await this.chatRepository.deleteSession(sessionId, userId, userJwt);
    
    // Also clear from other services for compatibility
    this.personalityAnalyzer.clearHistory(sessionId);
    this.parallelLLM.clearSession(sessionId);
  }

  /**
   * Rename a chat session
   * @param sessionId - Session ID to rename
   * @param userId - User ID to verify ownership
   * @param newTitle - New title for the session
   * @param userJwt - JWT for iOS backend auth
   */
  async renameSession(sessionId: string, userId: string, newTitle: string, userJwt?: string): Promise<void> {
    if (!userId || !newTitle || !newTitle.trim()) {
      throw new Error('User ID and title are required');
    }

    // Check if session exists and user owns it
    const session = await this.chatRepository.getSessionById(sessionId, userId, userJwt);
    if (!session) {
      throw new Error('Session not found or you do not have permission to rename it');
    }

    // Update session title (session existence already verified above)
    await this.chatRepository.updateSession(sessionId, userId, {
      title: newTitle.trim(),
    }, userJwt);
  }

  /**
   * Get all sessions for a user
   */
  async getAllSessions(userId: string = '00000000-0000-0000-0000-000000000000', userJwt?: string) {
    // ✅ Get sessions from database
    const sessions = await this.chatRepository.getUserSessions(userId, userJwt);
    // Get last message for each session to show in sidebar
    const sessionsWithLastMessage = await Promise.all(
      sessions.map(async (s) => {
        const lastMessage = await this.chatRepository.getLastMessageForSession(s.id, userId, userJwt);
        return {
          id: s.id,
          title: s.title || 'Untitled Chat',
          lastMessage: lastMessage?.content || '',
          lastActivity: s.lastActivity,
          messageCount: s.messageCount,
          createdAt: s.createdAt,
          selectedLLM: s.selectedLLM,
        };
      })
    );
    return sessionsWithLastMessage;
  }

  /**
   * Gets all quotients information
   */
  getAllQuotientsInfo() {
    return getAllQuotients().map((q) => ({
      id: q.id,
      name: q.name,
      fullName: q.fullName,
      description: q.description,
      keyAspects: q.keyAspects,
      importanceInLife: q.importanceInLife,
    }));
  }

  /**
   * Gets detailed information about a specific quotient
   */
  getQuotientInfo(id: string) {
    const quotient = getQuotientById(id);
    if (!quotient) {
      throw new Error('Quotient not found');
    }
    return quotient;
  }

  /**
   * Process message with streaming response
   */
  async *processMessageStream(
    message: string,
    sessionId: string,
    selectedLLM: string = 'gpt-4o',
    userId: string = '00000000-0000-0000-0000-000000000000',
    userJwt?: string,
  ): AsyncGenerator<{ type: string; data: any }, void, unknown> {
    try {
      // ✅ Get or create session in database
      const session = await this.chatRepository.getOrCreateSession(
        sessionId,
        userId,
        selectedLLM,
        userJwt,
      );
      
      const actualSessionId = session.id || sessionId;

      // ✅ Load existing messages from database
      const existingMessages = await this.chatRepository.getSessionMessages(actualSessionId, userId, userJwt);
      
      // ✅ Get next sequence number
      const nextSequenceNumber = existingMessages.length + 1;

      // ✅ Save user message to database
      await this.chatRepository.saveUserMessage(actualSessionId, userId, message, nextSequenceNumber, userJwt);

      // ✅ Build history array
      const historyBeforeCurrent: ConversationMessage[] = existingMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: m.createdAt || new Date(),
      }));

      // Check credits
      const creditCheck = await this.creditService.checkCredits(userId);
      if (!creditCheck.allowed) {
        yield { type: 'error', data: { message: creditCheck.message || 'Credit limit reached' } };
        return;
      }

      // Run psychological analysis (non-streaming, happens first)
      yield { type: 'analyzing', data: { message: 'Analyzing your message...' } };
      
      const psychProfile = await this.parallelLLM.analyze(
        message,
        historyBeforeCurrent,
        actualSessionId,
        selectedLLM,
        userId,
      );

      const conversationInsights = this.conversationAnalyzer.analyzeConversation([
        ...existingMessages.map((m) => ({ 
          role: m.role as 'user' | 'assistant', 
          content: m.content, 
          timestamp: m.createdAt || new Date() 
        })),
        { role: 'user' as const, content: message, timestamp: new Date() },
      ]);

      const analysis = this.personalityAnalyzer.analyzePersonality(message, actualSessionId, [
        ...existingMessages.map((m) => ({ 
          role: m.role as 'user' | 'assistant', 
          content: m.content, 
          timestamp: m.createdAt || new Date() 
        })),
        { role: 'user' as const, content: message, timestamp: new Date() },
      ]);

      const enhancedInsights = this.buildEnhancedInsightsFromProfile(psychProfile, conversationInsights);
      analysis.overallInsights = enhancedInsights;

      let cleanedProfile = this.buildCleanProfile(psychProfile);
      
      // 📝 Extract user tier from Munawar's backend
      let userTierRaw = 'free'; // Default fallback

      // Fetch E-DNA profile and tier
      let ednaProfile: any = null;
      if (this.ednaProfileService.isEnabled() && userId !== '00000000-0000-0000-0000-000000000000') {
        try {
          ednaProfile = await this.ednaProfileService.getEdnaProfile(userId, false, userJwt);
        } catch (ednaError: any) {
          console.error(`🧬 [ChatService] ❌ E-DNA profile FAILED: ${ednaError?.message}`);
        }
      }
      
      // Try to get tier from getUserProfile
      if (this.useIOSEDNA && userId !== '00000000-0000-0000-0000-000000000000') {
        try {
          const ednaProfileResponse = await this.iosBackend.getUserProfile(userId, userJwt);
          if (ednaProfileResponse?.success && ednaProfileResponse.user?.tier) {
            userTierRaw = ednaProfileResponse.user.tier.toLowerCase();
            console.log(`📝 [ChatService Stream] User tier: ${userTierRaw}`);
          }
        } catch (error: any) {
          // Try getUserById as fallback
          try {
            const userResponse = await this.iosBackend.getUserById(userId, userJwt);
            if (userResponse?.success && userResponse.user?.tier) {
              userTierRaw = userResponse.user.tier.toLowerCase();
              console.log(`📝 [ChatService Stream] User tier from getUserById: ${userTierRaw}`);
            }
          } catch (fallbackError: any) {
            console.warn(`⚠️ [ChatService Stream] Could not fetch user tier`);
          }
        }
      }

      // 🎯 Validate and normalize user tier
      const userTier: UserTier = validateUserTier(userTierRaw);
      console.log(`🎯 [ChatService Stream] Validated user tier: ${userTier}`);

      // 🚫 Validate model access and budget
      let finalLLM = selectedLLM;
      try {
        finalLLM = await this.validateModelAccessAndBudget(userId, userTier, selectedLLM);
      } catch (error: any) {
        yield { type: 'error', data: { message: error.message } };
        return;
      }

      // Send profile data
      yield { type: 'profile', data: cleanedProfile };
      yield { type: 'analysis', data: analysis };

      // Stream the advice response
      yield { type: 'generating', data: { message: 'Generating response...' } };
      
      let fullResponse = '';
      let reasoning = '';

      // Stream tokens as they arrive
      for await (const chunk of this.adviceGenerator.generateAdviceStream(
        message,
        cleanedProfile,
        historyBeforeCurrent,
        finalLLM,
        actualSessionId,
        userId,
        ednaProfile,
        userTier, // 📝 Pass tier for rolling summary history limits (extracted from Munawar's backend)
      )) {
        if (chunk.type === 'token') {
          fullResponse += chunk.content;
          // Yield each token immediately for real-time streaming
          yield { type: 'token', data: { content: chunk.content } };
        } else if (chunk.type === 'reasoning') {
          reasoning = chunk.content;
          yield { type: 'reasoning', data: { content: chunk.content } };
        } else if (chunk.type === 'done') {
          // If we got a done with content, use it; otherwise use accumulated
          if (chunk.content && chunk.content !== fullResponse) {
            fullResponse = chunk.content;
          }
        }
      }

      // Generate recommendations
      const recommendations = this.generateContextualRecommendations(
        analysis,
        conversationInsights,
        message,
      );

      // Save assistant message
      const assistantSequenceNumber = nextSequenceNumber + 1;
      await this.chatRepository.saveAssistantMessage(
        actualSessionId,
        userId,
        fullResponse,
        assistantSequenceNumber,
        selectedLLM,
        reasoning,
        analysis,
        recommendations,
        cleanedProfile,
        undefined,
        userJwt,
      );

      // Update session
      const messageCount = await this.chatRepository.getSessionMessageCount(actualSessionId, userJwt);
      let title: string | undefined = session.title ?? undefined;
      if (!title && existingMessages.length === 0) {
        title = message.length > 50 ? message.substring(0, 50) + '...' : message;
      }

      const sessionUpdates: {
        title?: string;
        currentProfile?: any;
        messageCount?: number;
        selectedLLM?: string;
      } = {
        currentProfile: cleanedProfile,
        messageCount,
        selectedLLM,
      };

      if (title && title.trim().length > 0) {
        sessionUpdates.title = title;
      }

      await this.chatRepository.updateSession(actualSessionId, userId, sessionUpdates, userJwt);

      // Send final data
      yield { type: 'done', data: { 
        sessionId: actualSessionId,
        response: fullResponse,
        reasoning,
        analysis,
        recommendations,
        profile: cleanedProfile,
      } };
    } catch (error: any) {
      console.error('Error in processMessageStream:', error);
      yield { type: 'error', data: { message: error.message || 'An error occurred' } };
    }
  }
}
