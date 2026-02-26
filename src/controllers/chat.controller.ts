import { Controller, Post, Body, Get, Param, Delete, Patch, Res, UseGuards, Query, HttpException, HttpStatus, Headers, Sse } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { ChatRequestDto, ChatResponseDto } from '../dto/chat.dto';
import { ChatService } from '../services/chat.service';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { v4 as uuidv4 } from 'uuid';
import { getAvailableLLMs, DEFAULT_LLM } from '../config/llm-models.config';
import { CreditService } from '../services/credit.service';
import { EdnaProfileService } from '../services/edna-profile.service';
import { buildEdnaProfile, EdnaQuizResults, EdnaProfileFull } from '../knowledge-base/edna-traits.data';
import { ParallelLLMService } from '../services/parallel-llm.service';

// Default anonymous user ID for non-authenticated usage
const ANONYMOUS_USER_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Extract JWT token from Authorization header
 * Format: "Bearer <token>" -> returns just the token
 */
function extractJwtFromHeader(authHeader?: string): string | undefined {
  if (!authHeader) return undefined;
  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
    return parts[1];
  }
  return undefined;
}

@ApiTags('chat')
@Controller('chat')
@UseGuards(RateLimitGuard) // Only rate limiting, no auth
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly creditService: CreditService,
    private readonly ednaProfileService: EdnaProfileService,
    private readonly parallelLLMService: ParallelLLMService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Send a message and get personalized advice (supports streaming)' })
  @ApiResponse({ status: 200, description: 'Returns advice and personality analysis' })
  async chat(
    @Body() chatRequest: ChatRequestDto,
    @Res() res: Response,
    @Headers('authorization') authHeader?: string,
  ): Promise<void> {
    const sessionId = chatRequest.sessionId || uuidv4();
    const selectedLLM = chatRequest.selectedLLM || DEFAULT_LLM;
    // Use provided userId for iOS app users, or anonymous for non-authenticated usage
    const userId = chatRequest.userId || ANONYMOUS_USER_ID;
    // Extract JWT from header for production use
    const userJwt = extractJwtFromHeader(authHeader);
    // Decision Intelligence mode: always ON for all messages (client requirement)
    const decisionIntelligenceMode = true;

    // Debug: FULL request logging
    console.log(`\n🚀🚀🚀 [ChatController] INCOMING REQUEST`);
    console.log(`📡 [ChatController] Message: ${chatRequest.message?.substring(0, 50)}...`);
    console.log(`📡 [ChatController] UserId: ${userId}`);
    console.log(`📡 [ChatController] SessionId: ${sessionId}`);
    console.log(`📡 [ChatController] SelectedLLM: ${selectedLLM}`);
    console.log(`📡 [ChatController] stream param: ${chatRequest.stream}, type: ${typeof chatRequest.stream}`);
    console.log(`📡 [ChatController] Will use streaming: ${chatRequest.stream === true}`);

    // If streaming is requested, use SSE
    if (chatRequest.stream) {
      // Set headers for SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable proxy buffering

      try {
        // Use the perfect non-streaming processMessage logic but with streaming output
        for await (const chunk of this.chatService.processMessageWithStreaming(
          chatRequest.message,
          sessionId,
          selectedLLM,
          userId,
          userJwt,
          decisionIntelligenceMode,
        )) {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          if (typeof (res as any).flush === 'function') {
            (res as any).flush();
          }
        }
        res.end();
      } catch (error: any) {
        console.error('Streaming error:', error);
        res.write(`data: ${JSON.stringify({ type: 'error', data: { message: error.message } })}\n\n`);
        res.end();
      }
      return;
    }

    // Non-streaming: return full JSON response
    try {
      const result = await this.chatService.processMessage(
        chatRequest.message,
        sessionId,
        selectedLLM,
        userId,
        userJwt,
        decisionIntelligenceMode,
      );
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  @Post('stream')
  @ApiOperation({ summary: 'Send a message and get streaming advice response' })
  async chatStream(
    @Body() chatRequest: ChatRequestDto,
    @Res() res: Response,
    @Headers('authorization') authHeader?: string,
  ) {
    const sessionId = chatRequest.sessionId || uuidv4();
    const selectedLLM = chatRequest.selectedLLM || DEFAULT_LLM;
    const userId = chatRequest.userId || ANONYMOUS_USER_ID;
    const userJwt = extractJwtFromHeader(authHeader);
    // Decision Intelligence mode: always ON for all messages (client requirement)
    const decisionIntelligenceMode = true;

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    // Disable response buffering in Express
    if ((res as any).setNoDelay) {
      (res as any).setNoDelay(true);
    }

    try {
      for await (const chunk of this.chatService.processMessageStream(
        chatRequest.message,
        sessionId,
        selectedLLM,
        userId,
        userJwt,
        decisionIntelligenceMode,
      )) {
        // Send SSE formatted data and flush immediately
        const data = `data: ${JSON.stringify(chunk)}\n\n`;
        res.write(data);
        // Force flush the response to send data immediately
        if (res.flushHeaders) {
          res.flushHeaders();
        }
        // For Express, we need to flush the response
        if ((res as any).flush) {
          (res as any).flush();
        }
      }
      res.end();
    } catch (error: any) {
      console.error('Streaming error:', error);
      res.write(`data: ${JSON.stringify({ type: 'error', data: { message: error.message } })}\n\n`);
      res.end();
    }
  }

  @Get('session/:sessionId/history')
  @ApiOperation({ summary: 'Get conversation history for a session' })
  async getHistory(
    @Param('sessionId') sessionId: string,
  ) {
    return await this.chatService.getSessionHistory(sessionId, ANONYMOUS_USER_ID);
  }

  @Delete('session/:sessionId')
  @ApiOperation({ summary: 'Delete a chat session and all its messages' })
  @ApiResponse({ status: 200, description: 'Session deleted successfully' })
  async deleteSession(
    @Param('sessionId') sessionId: string,
  ) {
    await this.chatService.clearSession(sessionId, ANONYMOUS_USER_ID);
    return { message: 'Session deleted successfully' };
  }

  @Patch('session/:sessionId')
  @ApiOperation({ summary: 'Rename a chat session' })
  @ApiResponse({ status: 200, description: 'Session renamed successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid title' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async renameSession(
    @Param('sessionId') sessionId: string,
    @Body() body: { title: string },
  ) {
    try {
      // Validate input
      if (!body || !body.title || typeof body.title !== 'string') {
        throw new HttpException('Title is required and must be a string', HttpStatus.BAD_REQUEST);
      }
      
      const trimmedTitle = body.title.trim();
      if (!trimmedTitle) {
        throw new HttpException('Title cannot be empty', HttpStatus.BAD_REQUEST);
      }
      
      if (trimmedTitle.length > 255) {
        throw new HttpException('Title must be 255 characters or less', HttpStatus.BAD_REQUEST);
      }
      
      // Rename session
      await this.chatService.renameSession(sessionId, ANONYMOUS_USER_ID, trimmedTitle);
      return { message: 'Session renamed successfully' };
    } catch (error: any) {
      // Re-throw HttpException as-is
      if (error instanceof HttpException) {
        throw error;
      }
      
      // Handle specific error messages from service
      if (error?.message?.includes('not found') || error?.message?.includes('permission')) {
        throw new HttpException(
          error.message,
          HttpStatus.NOT_FOUND,
        );
      }
      
      // Handle other errors
      console.error('Error renaming session:', error);
      throw new HttpException(
        error?.message || 'Failed to rename session',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Get all chat sessions for a user' })
  async getAllSessions(
    @Query('userId') userId?: string,
    @Headers('authorization') authHeader?: string,
  ) {
    const effectiveUserId = userId || ANONYMOUS_USER_ID;
    const userJwt = extractJwtFromHeader(authHeader);
    console.log(`📥 [ChatController] GET /chat/sessions called for userId: ${effectiveUserId}`);
    try {
      const sessions = await this.chatService.getAllSessions(effectiveUserId, userJwt);
      console.log('✅ [ChatController] Returning sessions:', sessions?.length || 0);
      return sessions;
    } catch (error) {
      console.error('❌ [ChatController] Error getting sessions:', error);
      throw error;
    }
  }

  @Get('quotients')
  @ApiOperation({ summary: 'Get all available quotients information' })
  async getQuotients() {
    return this.chatService.getAllQuotientsInfo();
  }

  @Get('quotients/:id')
  @ApiOperation({ summary: 'Get detailed information about a specific quotient' })
  async getQuotient(@Param('id') id: string) {
    return this.chatService.getQuotientInfo(id);
  }

  @Get('llms')
  @ApiOperation({ summary: 'Get available LLM models for selection' })
  @ApiResponse({ status: 200, description: 'Returns list of available LLM models' })
  async getAvailableLLMs() {
    return {
      default: DEFAULT_LLM,
      models: getAvailableLLMs(),
    };
  }

  @Get('tier-info/:userId')
  @ApiOperation({ summary: 'Get user tier information, limits, and allowed models' })
  @ApiResponse({ status: 200, description: 'Returns tier info, limits, allowed models, and budget status' })
  async getTierInfo(
    @Param('userId') userId: string,
    @Headers('authorization') authHeader?: string,
  ): Promise<any> {
    const userJwt = extractJwtFromHeader(authHeader);
    const iosBackend = (this.chatService as any).iosBackend;
    const budgetTracker = (this.chatService as any).budgetTracker;
    
    // Get user tier
    let userTierRaw = 'free';
    try {
      const profileResponse = await iosBackend.getUserProfile(userId, userJwt);
      if (profileResponse?.success && profileResponse.user?.tier) {
        userTierRaw = profileResponse.user.tier.toLowerCase();
      }
    } catch (e: any) {
      try {
        const userResponse = await iosBackend.getUserById(userId, userJwt);
        if (userResponse?.success && userResponse.user?.tier) {
          userTierRaw = userResponse.user.tier.toLowerCase();
        }
      } catch (e2: any) {
        // Keep default 'free'
      }
    }

    // Import tier config functions
    const { 
      validateUserTier, 
      getAllowedModelsForTier, 
      getOutputLimitForTier,
      getInputLimitForTier,
      getDefaultModelForTier,
      getTierDisplayInfo,
      getMonthlyBudgetForModel,
      MODEL_PRICING_TIERS,
      ModelPricingTier
    } = require('../config/tier-pricing.config');

    const userTier = validateUserTier(userTierRaw);
    const tierInfo = getTierDisplayInfo(userTier);
    const allowedModels = getAllowedModelsForTier(userTier);
    const maxOutputTokens = getOutputLimitForTier(userTier);
    const maxInputTokens = getInputLimitForTier(userTier);
    const defaultModel = getDefaultModelForTier(userTier);

    // Get budget status for premium models
    const budgetStatus: any[] = [];
    const premiumModels = ['claude-3-5-sonnet', 'claude-3-opus', 'gpt-4-turbo'];
    
    for (const modelId of premiumModels) {
      const monthlyBudget = getMonthlyBudgetForModel(userTier, modelId);
      if (monthlyBudget > 0) {
        try {
          const budgetCheck = await budgetTracker.checkBudget(userId, userTier, modelId);
          budgetStatus.push({
            modelId,
            modelName: modelId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            monthlyLimit: monthlyBudget,
            spent: budgetCheck.spent,
            remaining: budgetCheck.remaining,
            percentageUsed: (budgetCheck.spent / monthlyBudget) * 100,
          });
        } catch (e: any) {
          // Skip if error
        }
      }
    }

    // Get all available models with their pricing tier
    const allModels = getAvailableLLMs();
    const modelsWithAccess = allModels.map(model => ({
      ...model,
      allowed: allowedModels.includes(model.id),
      pricingTier: MODEL_PRICING_TIERS[model.id] || 'unknown',
      isDefault: model.id === defaultModel,
    }));

    return {
      userId,
      tier: userTier,
      tierDisplay: tierInfo,
      limits: {
        maxOutputTokens,
        maxInputTokens,
        maxOutputWords: Math.floor(maxOutputTokens * 0.8), // Approximate
        maxInputWords: Math.floor(maxInputTokens * 0.8),
      },
      allowedModels,
      defaultModel,
      models: modelsWithAccess,
      budgetStatus,
      message: `You're on the ${tierInfo.name} plan. ${tierInfo.features.join('. ')}.`,
    };
  }

  @Get('test-tier/:userId')
  @ApiOperation({ summary: 'Test tier extraction from Munawar backend' })
  async testTier(@Param('userId') userId: string): Promise<any> {
    const iosBackend = (this.chatService as any).iosBackend;
    const results: any = { userId, methods: {} };
    
    try {
      // Test getUserProfile
      const profileResponse = await iosBackend.getUserProfile(userId);
      results.methods.getUserProfile = {
        success: profileResponse?.success || false,
        hasTier: !!profileResponse?.user?.tier,
        tier: profileResponse?.user?.tier || null,
        fullResponse: profileResponse,
      };
    } catch (e: any) {
      results.methods.getUserProfile = { error: e.message };
    }
    
    try {
      // Test getUserById
      const userResponse = await iosBackend.getUserById(userId);
      results.methods.getUserById = {
        success: userResponse?.success || false,
        hasTier: !!userResponse?.user?.tier,
        tier: userResponse?.user?.tier || null,
        fullResponse: userResponse,
      };
    } catch (e: any) {
      results.methods.getUserById = { error: e.message };
    }
    
    return results;
  }

  @Get('credits')
  @ApiOperation({ summary: 'Get credit usage statistics' })
  @ApiResponse({ status: 200, description: 'Returns credit usage statistics' })
  async getCredits() {
    const stats = await this.creditService.getUsageStats(ANONYMOUS_USER_ID);
    const creditCheck = await this.creditService.checkCredits(ANONYMOUS_USER_ID);
    
    return {
      ...stats,
      warning: creditCheck.warning,
      allowed: creditCheck.allowed,
      message: creditCheck.message,
    };
  }

  // ============================================
  // E-DNA PROFILE ENDPOINTS (for testing)
  // ============================================

  @Get('edna/:userId')
  @ApiOperation({ summary: 'Get E-DNA profile for a user (test endpoint)' })
  @ApiResponse({ status: 200, description: 'Returns E-DNA profile with trait definitions' })
  async getEdnaProfile(
    @Param('userId') userId: string,
    @Query('refresh') refresh?: string,
  ) {
    console.log(`🧬 [ChatController] GET /chat/edna/${userId} called (refresh=${refresh})`);
    
    if (!this.ednaProfileService.isEnabled()) {
      return {
        success: false,
        message: 'E-DNA profile service is not enabled. Set USE_EDNA_PROFILE=true or USE_IOS_EDNA=true in .env',
        enabled: false,
      };
    }

    try {
      const forceRefresh = refresh === 'true';
      const profile = await this.ednaProfileService.getEdnaProfile(userId, forceRefresh);
      
      if (!profile) {
        return {
          success: false,
          message: `No E-DNA profile found for user ${userId}. User may not have completed the quiz.`,
          userId,
        };
      }

      return {
        success: true,
        userId,
        profile,
        characterSummary: profile.characterSummary,
      };
    } catch (error: any) {
      console.error(`❌ [ChatController] E-DNA profile error:`, error);
      return {
        success: false,
        message: error.message || 'Failed to fetch E-DNA profile',
        userId,
      };
    }
  }

  @Get('edna/:userId/summary')
  @ApiOperation({ summary: 'Get E-DNA profile summary for advice (test endpoint)' })
  @ApiResponse({ status: 200, description: 'Returns condensed E-DNA profile for LLM' })
  async getEdnaProfileSummary(
    @Param('userId') userId: string,
  ) {
    console.log(`🧬 [ChatController] GET /chat/edna/${userId}/summary called`);
    
    if (!this.ednaProfileService.isEnabled()) {
      return {
        success: false,
        message: 'E-DNA profile service is not enabled',
      };
    }

    try {
      const profile = await this.ednaProfileService.getEdnaProfile(userId);
      
      if (!profile) {
        return {
          success: false,
          message: `No E-DNA profile found for user ${userId}`,
        };
      }

      const summary = this.ednaProfileService.getProfileSummaryForAdvice(profile);
      
      return {
        success: true,
        userId,
        summary,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to get E-DNA summary',
      };
    }
  }

  @Get('edna/:userId/instructions')
  @ApiOperation({ summary: 'Get E-DNA instructions for Advice LLM (what actually gets passed)' })
  @ApiResponse({ status: 200, description: 'Returns hardcoded instructions for how to respond' })
  async getEdnaInstructions(
    @Param('userId') userId: string,
  ) {
    console.log(`🧬 [ChatController] GET /chat/edna/${userId}/instructions called`);
    
    if (!this.ednaProfileService.isEnabled()) {
      return { success: false, message: 'E-DNA profile service is not enabled' };
    }

    try {
      const profile = await this.ednaProfileService.getEdnaProfile(userId);
      
      if (!profile) {
        return { success: false, message: `No E-DNA profile found for user ${userId}` };
      }

      const instructions = this.ednaProfileService.getInstructionsForAdvice(profile);
      
      return {
        success: true,
        userId,
        instructions,
      };
    } catch (error: any) {
      return { success: false, message: error.message || 'Failed to get E-DNA instructions' };
    }
  }

  @Get('edna/mock/test')
  @ApiOperation({ summary: 'Test E-DNA profile with mock data (for testing without iOS backend)' })
  @ApiResponse({ status: 200, description: 'Returns mock E-DNA profile' })
  async getMockEdnaProfile() {
    console.log(`🧬 [ChatController] GET /chat/edna/mock/test called`);
    
    // Mock quiz results matching the API format
    const mockQuizResults: EdnaQuizResults = {
      layer1: {
        coreType: 'architect',
        strength: 'Strong',
        architectScore: 8,
        alchemistScore: 2,
      },
      layer2: {
        subtype: 'Master Strategist',
        description: 'Strategy-first approach with long-term vision',
      },
      layer3: {
        integration: 'Medium',
        integrationPercent: 50,
      },
      layer4: {
        modalityPreference: 'Visual',
        approach: 'Sequential',
        conceptProcessing: 'Concrete',
        workingEnvironment: 'Adaptive',
        pace: 'Flexible',
      },
      layer5: {
        status: 'Neurotypical',
        traits: { ntScore: 6, ndScore: 0, teScore: 0 },
      },
      layer6: {
        mindset: 'Growth/Abundance',
        personality: 'Confident & Steady',
        communication: 'Direct Communicator',
      },
      layer7: {
        faithOrientation: 'Self-Reliant',
        controlOrientation: 'In Control',
        fairness: 'Responsibility',
        integrity: 'Direct Honesty',
        growth: 'Growth Focused',
        impact: 'Self-Focused Impact',
      },
    };

    // Build full profile using our trait definitions
    const mockUserId = 'mock-test-user';
    const profile = buildEdnaProfile(mockUserId, mockQuizResults, new Date().toISOString());
    const summary = this.ednaProfileService.getProfileSummaryForAdvice(profile);

    return {
      success: true,
      message: 'Mock E-DNA profile generated successfully',
      userId: mockUserId,
      profile,
      characterSummary: profile.characterSummary,
      adviceSummary: summary,
    };
  }

  @Get('edna/test/:coreType')
  @ApiOperation({ summary: 'Test E-DNA instructions for a specific core type' })
  @ApiResponse({ status: 200, description: 'Returns E-DNA instructions for specified core type' })
  async getTestInstructions(
    @Param('coreType') coreType: string,
    @Query('subtype') subtype?: string,
  ) {
    console.log(`🧬 [ChatController] GET /chat/edna/test/${coreType} called`);
    
    // Define test profiles for each core type
    const testProfiles: Record<string, EdnaQuizResults> = {
      'alchemist': {
        layer1: { coreType: 'alchemist', strength: 'Strong', architectScore: 2, alchemistScore: 8 },
        layer2: { subtype: subtype || 'Energetic Empath', description: 'Feels and connects deeply' },
        layer3: { integration: 'Medium', integrationPercent: 50 },
        layer4: { modalityPreference: 'Kinesthetic', approach: 'Global', conceptProcessing: 'Abstract', workingEnvironment: 'Collaborative', pace: 'Flexible' },
        layer5: { status: 'Neurotypical', traits: { ntScore: 6, ndScore: 0, teScore: 0 } },
        layer6: { mindset: 'Growth/Abundance', personality: 'High Empathy', communication: 'Diplomatic Communicator' },
        layer7: { faithOrientation: 'Faith-Guided', controlOrientation: 'Go With Flow', fairness: 'Compassion', integrity: 'Diplomatic Honesty', growth: 'Growth Focused', impact: 'Others-Focused Impact' },
      },
      'architect': {
        layer1: { coreType: 'architect', strength: 'Strong', architectScore: 8, alchemistScore: 2 },
        layer2: { subtype: subtype || 'Master Strategist', description: 'Strategic planning excellence' },
        layer3: { integration: 'Medium', integrationPercent: 50 },
        layer4: { modalityPreference: 'Visual', approach: 'Sequential', conceptProcessing: 'Concrete', workingEnvironment: 'Individual', pace: 'Fast-Paced' },
        layer5: { status: 'Neurotypical', traits: { ntScore: 6, ndScore: 0, teScore: 0 } },
        layer6: { mindset: 'Growth/Abundance', personality: 'Confident & Steady', communication: 'Direct Communicator' },
        layer7: { faithOrientation: 'Self-Reliant', controlOrientation: 'In Control', fairness: 'Responsibility', integrity: 'Direct Honesty', growth: 'Growth Focused', impact: 'Self-Focused Impact' },
      },
      'mixed': {
        layer1: { coreType: 'mixed', strength: 'Moderate', architectScore: 5, alchemistScore: 5 },
        layer2: { subtype: subtype || 'Switching Loop', description: 'Alternates between modes' },
        layer3: { integration: 'Low', integrationPercent: 30 },
        layer4: { modalityPreference: 'Multimodal', approach: 'Global', conceptProcessing: 'Abstract', workingEnvironment: 'Adaptive', pace: 'Flexible' },
        layer5: { status: 'Context Dependent', traits: { ntScore: 3, ndScore: 3, teScore: 0 } },
        layer6: { mindset: 'Growth/Scarcity', personality: 'Moderate Confidence', communication: 'Diplomatic Communicator' },
        layer7: { faithOrientation: 'Dual-Reliant', controlOrientation: 'Shared Control', fairness: 'Balanced', integrity: 'Balanced', growth: 'Steady Growth', impact: 'Shared Impact' },
      },
    };

    const normalizedCoreType = coreType.toLowerCase();
    const quizData = testProfiles[normalizedCoreType];
    
    if (!quizData) {
      return { success: false, message: `Invalid core type: ${coreType}. Use: alchemist, architect, or mixed` };
    }

    const profile = buildEdnaProfile(`test-${normalizedCoreType}`, quizData, new Date().toISOString());
    const instructions = this.ednaProfileService.getInstructionsForAdvice(profile);

    return {
      success: true,
      coreType: normalizedCoreType,
      subtype: quizData.layer2.subtype,
      profile: {
        layer1: quizData.layer1,
        layer2: quizData.layer2,
        layer4: quizData.layer4,
        layer6: quizData.layer6,
        layer7: quizData.layer7,
      },
      instructions,
    };
  }

  // ==================== DEBUG ENDPOINTS ====================

  @Post('debug/trace')
  @ApiOperation({ summary: 'Send a message and get full debug trace of all data flow' })
  @ApiResponse({ status: 200, description: 'Returns complete trace of message processing' })
  async debugTraceMessage(
    @Body() body: { message: string; userId?: string },
  ) {
    const userId = body.userId || '04F894C8-70D1-70BF-B074-0FB778637A2B';
    const message = body.message || 'I want to start a business but I am scared';
    
    console.log(`🔍 [Debug Trace] Processing message for user ${userId}`);
    
    const trace: any = {
      timestamp: new Date().toISOString(),
      input: { message, userId },
      steps: [],
    };

    try {
      // STEP 1: Fetch E-DNA Profile
      let ednaProfile: EdnaProfileFull | null = null;
      let ednaInstructions = '';
      
      if (this.ednaProfileService.isEnabled()) {
        ednaProfile = await this.ednaProfileService.getEdnaProfile(userId);
        if (ednaProfile) {
          ednaInstructions = this.ednaProfileService.getInstructionsForAdvice(ednaProfile);
        }
      }
      
      trace.steps.push({
        step: 1,
        name: 'E-DNA Profile Fetch',
        data: {
          profileLoaded: !!ednaProfile,
          coreType: ednaProfile?.layers?.layer1?.coreType,
          subtype: ednaProfile?.layers?.layer2?.subtype,
          strength: ednaProfile?.layers?.layer1?.strength,
          instructionsLength: ednaInstructions.length,
        },
        fullEdnaProfile: ednaProfile ? {
          layer1: ednaProfile.layers.layer1,
          layer2: ednaProfile.layers.layer2,
          layer3: ednaProfile.layers.layer3,
          layer4: ednaProfile.layers.layer4,
          layer5: ednaProfile.layers.layer5,
          layer6: ednaProfile.layers.layer6,
          layer7: ednaProfile.layers.layer7,
        } : null,
        ednaInstructions: ednaInstructions || '(No E-DNA instructions)',
      });

      // STEP 2: Process the actual message through ChatService
      // Generate a valid UUID for the debug session
      const debugSessionId = require('uuid').v4();
      const response = await this.chatService.processMessage(
        message,
        debugSessionId, // Valid UUID for debug session
        'gpt-4o',
        userId,
      );

      // STEP 2: Extract psychological analysis from response
      const frameworksTriggered = Object.keys(response.profile || {}).filter(k => 
        !['safety', 'summaryForThisMessage', 'integrationMeta', 'edna'].includes(k) && response.profile[k]
      );
      
      trace.steps.push({
        step: 2,
        name: 'Psychological Classification & Analysis',
        data: {
          safetyFlag: response.profile?.safety?.flag || 'none',
          frameworksTriggered: frameworksTriggered,
          frameworkCount: frameworksTriggered.length,
        },
        psychProfile: response.profile,
        // Show actual framework data
        frameworkResults: frameworksTriggered.reduce((acc: any, key: string) => {
          acc[key] = response.profile[key];
          return acc;
        }, {}),
      });

      // STEP 3: Per-message summary
      trace.steps.push({
        step: 3,
        name: 'Per-Message Summary (Synthesis)',
        data: response.profile?.summaryForThisMessage || { summary: 'No summary generated' },
        summaryGenerated: !!response.profile?.summaryForThisMessage,
      });

      // Get actual conversation history that was sent to advice LLM
      let conversationHistory: any[] = [];
      try {
        conversationHistory = await this.chatService.getSessionHistory(response.sessionId || debugSessionId, userId);
      } catch (e) {
        console.log('Could not fetch conversation history for debug:', e);
      }

      // Get actual advice LLM debug data
      const adviceGenerator = (this.chatService as any).adviceGenerator;
      const adviceDebug = (adviceGenerator as any).__lastAdviceDebug || null;

      // STEP 4: Advice LLM Response - WITH ACTUAL DATA
      trace.steps.push({
        step: 4,
        name: 'Advice LLM Response',
        description: 'The main LLM generates personalized advice using E-DNA instructions + psychological analysis + conversation history',
        data: {
          responseLength: response.response?.length || 0,
          hasReasoning: !!response.reasoning,
          conversationHistoryLength: conversationHistory.length,
          systemPromptLength: adviceDebug?.systemPrompt?.length || 0,
          totalMessagesSent: adviceDebug?.fullMessages?.length || 0,
        },
        // ACTUAL CONVERSATION HISTORY SENT TO LLM
        conversationHistorySent: adviceDebug?.conversationHistory || conversationHistory,
        conversationHistoryCount: adviceDebug?.conversationHistory?.length || conversationHistory.length,
        // ACTUAL SYSTEM PROMPT SENT
        systemPrompt: adviceDebug?.systemPrompt || '(Not captured)',
        // ACTUAL USER MESSAGE PROMPT
        userMessagePrompt: adviceDebug?.userMessagePrompt || '(Not captured)',
        // ACTUAL FULL MESSAGES ARRAY
        fullMessagesArray: adviceDebug?.fullMessages || null,
        // ACTUAL E-DNA DATA PASSED
        ednaDataPassed: adviceDebug?.ednaProfile || null,
        ednaCharacterSummary: adviceDebug?.ednaProfile?.characterSummary || null,
        ednaLayers: adviceDebug?.ednaProfile?.layers || null,
        // ACTUAL PROFILE DATA PASSED
        profileDataPassed: adviceDebug?.profile || null,
        // RESPONSE
        reasoning: response.reasoning,
        response: response.response,
      });

      trace.success = true;
      trace.finalResponse = response.response;

    } catch (error: any) {
      trace.success = false;
      trace.error = error.message;
    }

    return trace;
  }

  @Post('debug/trace-manual')
  @ApiOperation({ summary: 'Debug trace with manual E-DNA profile selection for testing' })
  @ApiResponse({ status: 200, description: 'Returns complete trace with manual profile' })
  async debugTraceManual(
    @Body() body: { 
      message: string; 
      userId?: string;
      useManualProfile?: boolean;
      manualProfile?: any;
    },
  ) {
    const userId = body.userId || '04F894C8-70D1-70BF-B074-0FB778637A2B';
    const message = body.message || 'I want to start a business but I am scared';
    const useManualProfile = body.useManualProfile !== false;
    
    console.log(`🔍 [Debug Trace Manual] Processing message with ${useManualProfile ? 'MANUAL' : 'API'} profile`);
    
    const trace: any = {
      timestamp: new Date().toISOString(),
      input: { message, userId, profileSource: useManualProfile ? 'manual' : 'api' },
      steps: [],
    };

    try {
      // STEP 1: Build E-DNA Profile (manual or from API)
      let ednaProfile: EdnaProfileFull | null = null;
      let ednaInstructions = '';
      
      if (useManualProfile && body.manualProfile) {
        // Convert manual form data to API format (quizResult format)
        const manualQuizResult: EdnaQuizResults = {
          layer1: {
            coreType: body.manualProfile.layer1?.coreType?.toLowerCase() || 'alchemist',
            strength: body.manualProfile.layer1?.strength || 'Strong',
            architectScore: body.manualProfile.layer1?.architectScore || 0,
            alchemistScore: body.manualProfile.layer1?.alchemistScore || 8,
          },
          layer2: {
            subtype: body.manualProfile.layer2?.subtype || 'Visionary Oracle',
            description: body.manualProfile.layer2?.description || '',
          },
          layer3: {
            integration: body.manualProfile.layer3?.integration || 'Medium',
            integrationPercent: body.manualProfile.layer3?.integrationPercent || 55,
          },
          layer4: {
            modalityPreference: body.manualProfile.layer4?.modalityPreference || 'Visual',
            approach: body.manualProfile.layer4?.approach || 'Structured/Sequential',
            conceptProcessing: body.manualProfile.layer4?.conceptProcessing || 'Abstract/Intuitive',
            workingEnvironment: body.manualProfile.layer4?.workingEnvironment || 'Adaptive',
            pace: body.manualProfile.layer4?.pace || 'Flexible',
          },
          layer5: {
            status: body.manualProfile.layer5?.status || 'Neurotypical',
            traits: body.manualProfile.layer5?.traits || { ntScore: 6, ndScore: 0, teScore: 0 },
          },
          layer6: {
            mindset: body.manualProfile.layer6?.mindset || 'Growth/Abundance',
            personality: body.manualProfile.layer6?.personality || 'Confident & Steady',
            communication: body.manualProfile.layer6?.communication || 'Direct Communicator',
          },
          layer7: {
            faithOrientation: body.manualProfile.layer7?.faithOrientation || 'Self-Reliant',
            controlOrientation: body.manualProfile.layer7?.controlOrientation || 'In Control',
            fairness: body.manualProfile.layer7?.fairness || 'Responsibility',
            integrity: body.manualProfile.layer7?.integrity || 'Direct Honesty',
            growth: body.manualProfile.layer7?.growth || 'Growth Focused',
            impact: body.manualProfile.layer7?.impact || 'Self-Focused Impact',
          },
        };
        
        // Build full profile from manual quiz result
        ednaProfile = buildEdnaProfile(userId, manualQuizResult);
        console.log(`📋 [Manual Profile] Built profile for ${ednaProfile.layers.layer1.coreType} - ${ednaProfile.layers.layer2.subtype}`);
        
        // Store in cache for this session
        this.ednaProfileService.setManualProfile(userId, ednaProfile);
        
      } else if (this.ednaProfileService.isEnabled()) {
        // Use real API
        ednaProfile = await this.ednaProfileService.getEdnaProfile(userId);
      }
      
      if (ednaProfile) {
        ednaInstructions = this.ednaProfileService.getInstructionsForAdvice(ednaProfile);
      }
      
      trace.steps.push({
        step: 1,
        name: 'E-DNA Profile Build',
        data: {
          profileSource: useManualProfile ? 'MANUAL FORM' : 'API CALL',
          profileLoaded: !!ednaProfile,
          coreType: ednaProfile?.layers?.layer1?.coreType,
          subtype: ednaProfile?.layers?.layer2?.subtype,
          strength: ednaProfile?.layers?.layer1?.strength,
          instructionsLength: ednaInstructions.length,
        },
        manualInputReceived: useManualProfile ? body.manualProfile : null,
        fullEdnaProfile: ednaProfile ? {
          layer1: ednaProfile.layers.layer1,
          layer2: ednaProfile.layers.layer2,
          layer3: ednaProfile.layers.layer3,
          layer4: ednaProfile.layers.layer4,
          layer5: ednaProfile.layers.layer5,
          layer6: ednaProfile.layers.layer6,
          layer7: ednaProfile.layers.layer7,
        } : null,
        ednaInstructions: ednaInstructions || '(No E-DNA instructions)',
      });

      // STEP 2: Run Router LLM Classification (with full debug details)
      const debugSessionId = require('uuid').v4();
      const selectedLLM = 'gpt-4o';
      
      // Get detailed router classification
      const routerResult = await this.parallelLLMService.classifyMessageWithDebug(
        message,
        [], // Empty history for debug
        selectedLLM,
        debugSessionId,
        userId,
      );
      
      trace.steps.push({
        step: 2,
        name: 'Intelligent Router Classification',
        description: 'The intelligent router reads the message like a human therapist and decides which psychological frameworks to run',
        data: {
          classificationMethod: routerResult.meta.method,
          tokenCount: routerResult.meta.tokenCount,
          llmUsed: routerResult.meta.llmUsed,
          llmModel: routerResult.meta.llmModel || 'N/A (no LLM call needed)',
        },
        classification: routerResult.classification,
        // New intelligent router fields
        confidence: routerResult.meta.confidence || 'unknown',
        signalType: routerResult.meta.signalType || 'unknown',
        frameworksSelected: routerResult.meta.frameworksSelected || [],
        llmParsed: routerResult.meta.llmParsed || null,
        // LLM call details (if used)
        llmPrompt: routerResult.meta.llmPrompt || null,
        llmResponse: routerResult.meta.llmResponse || null,
        llmUsed: routerResult.meta.llmUsed,
        llmModel: routerResult.meta.llmModel || null,
        reasoning: routerResult.meta.reasoning,
      });

      // STEP 3: Process the actual message through ChatService
      const response = await this.chatService.processMessage(
        message,
        debugSessionId,
        selectedLLM,
        userId,
      );

      // STEP 3: Extract psychological analysis from response
      const frameworksTriggered = Object.keys(response.profile || {}).filter(k => 
        !['safety', 'summaryForThisMessage', 'integrationMeta', 'edna'].includes(k) && response.profile[k]
      );
      
      trace.steps.push({
        step: 3,
        name: 'Psychological Framework Analysis',
        description: 'Based on router classification, these frameworks were called to analyze the message',
        data: {
          safetyFlag: response.profile?.safety?.flag || 'none',
          frameworksTriggered: frameworksTriggered,
          frameworkCount: frameworksTriggered.length,
        },
        psychProfile: response.profile,
        // Show actual framework data
        frameworkResults: frameworksTriggered.reduce((acc: any, key: string) => {
          acc[key] = response.profile[key];
          return acc;
        }, {}),
      });

      // STEP 4: Per-message summary
      trace.steps.push({
        step: 4,
        name: 'Per-Message Summary (Synthesis)',
        description: 'A synthesis LLM combines all framework results into a compact summary',
        data: response.profile?.summaryForThisMessage || { summary: 'No summary generated' },
        summaryGenerated: !!response.profile?.summaryForThisMessage,
      });

      // Get actual conversation history that was sent to advice LLM
      let conversationHistory: any[] = [];
      try {
        conversationHistory = await this.chatService.getSessionHistory(response.sessionId || debugSessionId, userId);
      } catch (e) {
        console.log('Could not fetch conversation history for debug:', e);
      }

      // Get actual advice LLM debug data
      const adviceGenerator = (this.chatService as any).adviceGenerator;
      const adviceDebug = (adviceGenerator as any).__lastAdviceDebug || null;

      // STEP 5: Advice LLM Response - WITH ACTUAL DATA
      trace.steps.push({
        step: 5,
        name: 'Advice LLM Response',
        description: 'The main LLM generates personalized advice using E-DNA instructions + psychological analysis + conversation history',
        data: {
          responseLength: response.response?.length || 0,
          hasReasoning: !!response.reasoning,
          conversationHistoryLength: conversationHistory.length,
          systemPromptLength: adviceDebug?.systemPrompt?.length || 0,
          totalMessagesSent: adviceDebug?.fullMessages?.length || 0,
        },
        // ACTUAL CONVERSATION HISTORY SENT TO LLM
        conversationHistorySent: adviceDebug?.conversationHistory || conversationHistory,
        conversationHistoryCount: adviceDebug?.conversationHistory?.length || conversationHistory.length,
        // ACTUAL SYSTEM PROMPT SENT
        systemPrompt: adviceDebug?.systemPrompt || '(Not captured)',
        // ACTUAL USER MESSAGE PROMPT
        userMessagePrompt: adviceDebug?.userMessagePrompt || '(Not captured)',
        // ACTUAL FULL MESSAGES ARRAY
        fullMessagesArray: adviceDebug?.fullMessages || null,
        // ACTUAL E-DNA DATA PASSED
        ednaDataPassed: adviceDebug?.ednaProfile || null,
        ednaCharacterSummary: adviceDebug?.ednaProfile?.characterSummary || null,
        ednaLayers: adviceDebug?.ednaProfile?.layers || null,
        // ACTUAL PROFILE DATA PASSED
        profileDataPassed: adviceDebug?.profile || null,
        // RESPONSE
        reasoning: response.reasoning,
        response: response.response,
      });

      trace.success = true;
      trace.finalResponse = response.response;

    } catch (error: any) {
      console.error(`❌ [Debug Trace Manual] Error:`, error);
      trace.success = false;
      trace.error = error.message;
    }

    return trace;
  }

  @Get('debug/llm-prompt/:userId')
  @ApiOperation({ summary: 'Preview the full LLM prompt that would be sent to Advice LLM' })
  @ApiResponse({ status: 200, description: 'Returns the complete system prompt' })
  async getFullLLMPromptPreview(
    @Param('userId') userId: string,
  ) {
    console.log(`🔍 [Debug] GET /chat/debug/llm-prompt/${userId} called`);
    
    try {
      // Get E-DNA profile
      let ednaProfile: EdnaProfileFull | null = null;
      let ednaInstructions = '';
      let ednaContext = '';
      
      if (this.ednaProfileService.isEnabled()) {
        ednaProfile = await this.ednaProfileService.getEdnaProfile(userId);
        if (ednaProfile) {
          ednaInstructions = this.ednaProfileService.getInstructionsForAdvice(ednaProfile);
          const l1 = ednaProfile.layers.layer1;
          const l2 = ednaProfile.layers.layer2;
          ednaContext = `This person is a ${l1.coreType} (${l1.strength} strength) with a ${l2.subtype} subtype.`;
        }
      }

      // Mock psychological profile (as would be generated during chat)
      const mockPsychProfile = {
        safety: { flag: 'none' },
        summaryForThisMessage: {
          summary: '(Summary would be generated based on actual message)',
          key_signals: ['Example signal 1', 'Example signal 2'],
          focus_for_reply: ['Focus area 1'],
        },
      };

      // Build sections exactly as advice-generator does
      const ednaSection = ednaContext ? `\nE-DNA IDENTITY: ${ednaContext}\n` : '';
      const ednaInstructionsSection = ednaInstructions ? `\n=== HOW TO RESPOND TO THIS PERSON (E-DNA INSTRUCTIONS) ===\n${ednaInstructions}\n` : '';
      const safetyBlock = `Safety: ${JSON.stringify(mockPsychProfile.safety)}`;
      const summaryJson = JSON.stringify(mockPsychProfile.summaryForThisMessage, null, 2);

      // The full system prompt
      const fullSystemPrompt = `You are AI Alchemist - a wise, empathetic counselor who helps people with all aspects of life - from personal growth and emotional well-being to practical life decisions like career, business, relationships, and personal development. You understand people through feeling and energy, then turn that understanding into clear systems that help them grow. Your personality is calm but powerful — you listen deeply, see patterns others miss, and help people find meaning in how they think and feel. Your tone is gentle yet confident, emotional yet logical.

SILENT UNDERSTANDING (Don't mention these terms to the user):
${ednaSection}${ednaInstructionsSection}
CURRENT PSYCHOLOGICAL STATE (how they feel right now):
(This section is populated during actual chat based on classification and framework analysis)
${safetyBlock}

LATEST MESSAGE SUMMARY (do not show to user; use to guide reply):
${summaryJson}

IMPORTANT: Follow the E-DNA INSTRUCTIONS above to tailor HOW you communicate. Use the psychological state to understand WHAT they need right now. The instructions tell you the best way to reach this person.

CRITICAL: You MUST respond with valid JSON in this EXACT format (no other text before or after):
{
  "reasoning": "Your step-by-step thought process explaining what you understand about the person, what this message reveals, what the root cause might be, and why you're responding this way",
  "response": "Your actual empathetic response to the user. Use \\n for line breaks. When providing lists or steps, format as: '1. First step\\n2. Second step\\n3. Third step' with each item on a new line. Use **bold** for emphasis on key terms."
}`;

      return {
        success: true,
        userId,
        sections: {
          hasEdna: !!ednaProfile,
          ednaIdentity: ednaContext || '(No E-DNA profile)',
          ednaInstructionsLength: ednaInstructions.length,
          hasPsychProfile: true,
          mockNote: 'Psychological profile is populated during actual chat based on real-time analysis',
        },
        fullSystemPrompt,
        ednaInstructions: ednaInstructions || '(No E-DNA instructions)',
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  @Get('debug/psych-flow')
  @ApiOperation({ summary: 'Get psychological analysis flow documentation' })
  @ApiResponse({ status: 200, description: 'Returns the psychological analysis pipeline stages' })
  async getPsychFlowDocs() {
    console.log(`🔍 [Debug] GET /chat/debug/psych-flow called`);
    
    const flow = {
      overview: 'The psychological analysis pipeline runs in parallel when a user sends a message. It consists of 4 stages that run before the Advice LLM generates a response.',
      stages: [
        {
          stage: 1,
          name: 'Classification (Router LLM)',
          model: 'gpt-4o-mini',
          purpose: 'Quick triage to determine which frameworks should analyze this message',
          triggers: {
            hasCrisisIndicators: 'Detects self-harm, suicidal ideation, violence',
            hasEmotionalContent: 'Detects emotional language → triggers DASS-42',
            hasSelfWorthContent: 'Detects self-esteem issues → triggers RSE',
            hasDarkTriadIndicators: 'Detects manipulation/exploitation → triggers Dark Triad',
            hasPersonalityIndicators: 'Detects personality-relevant content → triggers Big Five',
            hasCognitiveIndicators: 'Detects thinking patterns → triggers CRT',
            hasAttachment: 'Detects relationship patterns → triggers Attachment Style',
            hasEnneagram: 'Detects core motivations → triggers Enneagram',
            hasMBTI: 'Detects cognitive preferences → triggers MBTI',
            hasErikson: 'Detects life stage issues → triggers Erikson',
            hasGestalt: 'Detects awareness/avoidance → triggers Gestalt',
            hasBioPsych: 'Detects physical/environmental factors → triggers Bio-Psycho-Social',
          },
          output: 'Classification flags + urgency level (critical/high/medium/low)',
        },
        {
          stage: 2,
          name: 'Framework Analysis (Parallel LLM Calls)',
          model: 'gpt-4o-mini',
          purpose: 'Each triggered framework runs its own LLM call with specialized prompts',
          frameworks: [
            { name: 'Big Five (OCEAN)', trigger: 'hasPersonalityIndicators', analyzes: 'Openness, Conscientiousness, Extraversion, Agreeableness, Neuroticism' },
            { name: 'DASS-42', trigger: 'hasEmotionalContent', analyzes: 'Depression, Anxiety, Stress levels and concerns' },
            { name: 'RSE (Rosenberg)', trigger: 'hasSelfWorthContent', analyzes: 'Self-esteem level and indicators' },
            { name: 'Dark Triad', trigger: 'hasDarkTriadIndicators', analyzes: 'Machiavellianism, Narcissism, Psychopathy traits' },
            { name: 'CRT', trigger: 'hasCognitiveIndicators', analyzes: 'Thinking style, System 1 vs System 2 preference' },
            { name: 'Attachment Style', trigger: 'hasAttachment', analyzes: 'Secure, Anxious, Avoidant, Disorganized patterns' },
            { name: 'Enneagram', trigger: 'hasEnneagram', analyzes: 'Core type (1-9), motivations, fears' },
            { name: 'MBTI', trigger: 'hasMBTI', analyzes: '16 personality types, cognitive functions' },
            { name: 'Erikson', trigger: 'hasErikson', analyzes: 'Psychosocial development stage (8 stages)' },
            { name: 'Gestalt', trigger: 'hasGestalt', analyzes: 'Present awareness, contact/resistance patterns' },
            { name: 'Bio-Psycho-Social', trigger: 'hasBioPsych', analyzes: 'Biological, psychological, social factors' },
          ],
          output: 'Structured analysis from each framework with confidence scores',
        },
        {
          stage: 3,
          name: 'Per-Message Summary (Synthesis LLM)',
          model: 'gpt-4o-mini',
          purpose: 'Synthesize all framework results into a coherent summary for this specific message',
          input: 'All framework analysis results + conversation history',
          output: {
            summary: 'One-paragraph synthesis of psychological state',
            key_signals: 'Most important indicators detected',
            conflicts: 'Any contradictions between frameworks',
            risks: 'Potential concerns to address',
            strengths: 'Positive traits to leverage',
            focus_for_reply: 'What the response should prioritize',
            confidence: 'Overall confidence score (0-1)',
          },
        },
        {
          stage: 4,
          name: 'Advice Generation (Main LLM)',
          model: 'User-selected (default: gpt-4o)',
          purpose: 'Generate the final empathetic response',
          input: [
            'System prompt with AI Alchemist personality',
            'E-DNA profile instructions (HOW to communicate)',
            'Psychological profile summary (WHAT they need)',
            'Message summary (focus for this reply)',
            'Conversation history (last 3 messages)',
            'User message',
          ],
          output: 'JSON with reasoning + response',
        },
      ],
      dataFlow: {
        step1: 'User sends message → Classification LLM determines flags',
        step2: 'Flags trigger 0-11 framework LLM calls (run in parallel)',
        step3: 'Results merged → Summary LLM creates unified profile',
        step4: 'E-DNA + Psych profile → Advice LLM generates response',
      },
      tokenEstimates: {
        classification: '~200-400 tokens',
        perFramework: '~300-600 tokens each',
        summary: '~500-800 tokens',
        advice: '~800-1200 tokens',
        typicalTotal: '1,500-4,000 tokens per message (depends on triggered frameworks)',
      },
    };

    return { success: true, flow };
  }
}
