import { Injectable } from '@nestjs/common';
import { PersonalityAnalysis, QuotientScore } from '../dto/chat.dto';
import { QUOTIENTS_KNOWLEDGE_BASE, getQuotientById } from '../knowledge-base/quotients.data';
import { HumanProfile } from './human-understanding.service';
import { LLMOrchestratorService } from './llm-orchestrator.service';
import { CreditService } from './credit.service';
import { BudgetTrackerService } from './budget-tracker.service';
import { isPremiumModel } from '../config/subscription.config';
import { EdnaProfileService } from './edna-profile.service';
import { EdnaProfileFull } from '../knowledge-base/edna-traits.data';
import { RollingSummaryService } from './rolling-summary.service';
import { getOutputLimitForTier, UserTier, validateUserTier } from '../config/tier-pricing.config';
import { ALCHEMIST_VOICE_SYSTEM_BLOCK } from '../knowledge-base/alchemist-voice.data';
import {
  getDecisionIntelligenceSystemPrompt,
  type DecisionCoreType,
} from '../knowledge-base/decision-intelligence-agent.prompt';
import { GUEST_DECISION_COACH_SYSTEM_PROMPT } from '../knowledge-base/guest-decision-coach.prompt';
import { GUEST_MAX_OUTPUT_TOKENS } from '../config/guest.config';

@Injectable()
export class AdviceGeneratorService {
  constructor(
    private llmOrchestrator: LLMOrchestratorService,
    private creditService: CreditService,
    private budgetTracker: BudgetTrackerService,
    private ednaProfileService: EdnaProfileService,
    private rollingSummaryService: RollingSummaryService,
  ) {}

  /**
   * Generate advice with clean psychological profile using orchestrator
   * Now includes E-DNA profile for personalized responses
   */
  async generateAdviceWithProfile(
    userMessage: string,
    profile: any,
    conversationHistory: any[],
    selectedLLM: string = 'gpt-4o',
    sessionId?: string,
    userId?: string,
    ednaProfile?: EdnaProfileFull | null,
    userTier: string = 'free', // NEW: tier for history limits
    decisionIntelligenceMode?: boolean,
  ): Promise<{ response: string; reasoning?: string }> {
    // Note: Crisis detection happens in parallel-llm.service.ts (safety gate)
    // The crisis indicators are stored in profile.safety and profile.dass.requiresCrisisResponse
    // We trust the LLM to respond appropriately when it sees these flags in the profile
    // Modern LLMs (GPT-4o, Claude, etc.) are trained on crisis response protocols

    // DEBUG: Log what we received
    console.log(`🤖 [AdviceGenerator] Generating advice:`);
    console.log(`   - userId: ${userId}`);
    console.log(`   - hasEdnaProfile: ${!!ednaProfile}`);
    console.log(`   - ednaProfileType: ${ednaProfile?.layers?.layer1?.coreType || 'NONE'}`);
    console.log(`   - conversationHistoryLength: ${conversationHistory.length}`);
    console.log(`   - profileKeys: ${Object.keys(profile || {}).join(', ')}`);
    console.log(`   - userTier: ${userTier}`);
    console.log(`   - decisionIntelligenceMode: ${!!decisionIntelligenceMode}`);

    try {
      const systemPrompt = decisionIntelligenceMode
        ? this.buildDecisionIntelligenceSystemPrompt(ednaProfile)
        : this.buildCleanSystemPrompt(profile, ednaProfile);
      console.log(`🤖 [AdviceGenerator] System prompt length: ${systemPrompt.length} chars (DI: ${!!decisionIntelligenceMode})`);

      const userMessagePrompt = decisionIntelligenceMode
        ? userMessage
        : this.buildUserMessagePrompt(userMessage, profile);
      
      // ROLLING SUMMARY: Use optimized history instead of full history
      // This prevents cost explosion on long conversations
      const { summary, recentMessages } = await this.rollingSummaryService.getOptimizedHistory(
        sessionId || 'default',
        conversationHistory,
        userTier,
      );
      
      console.log(`📝 [AdviceGenerator] Using rolling summary:`);
      console.log(`   - Full history: ${conversationHistory.length} messages`);
      console.log(`   - Recent messages sent: ${recentMessages.length}`);
      console.log(`   - Has summary: ${!!summary}`);

      // Build messages with rolling summary instead of full history
      const reasoningMessages: any[] = [
        { role: 'system', content: systemPrompt },
      ];
      
      // Add rolling summary as context if available
      if (summary) {
        reasoningMessages.push({
          role: 'system',
          content: `[CONVERSATION CONTEXT - Summary of earlier messages]\n${summary}\n[END CONTEXT]`,
        });
      }
      
      // Add recent messages (not full history)
      reasoningMessages.push(
        ...recentMessages.map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
      );
      
      // Add current user message
      reasoningMessages.push({
        role: 'user',
        content: userMessagePrompt,
      });

      // Store for debug access
      (this as any).__lastAdviceDebug = {
        systemPrompt,
        conversationHistory: conversationHistory.map((msg) => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
        })),
        userMessagePrompt,
        fullMessages: reasoningMessages,
        ednaProfile: ednaProfile ? {
          characterSummary: ednaProfile.characterSummary,
          layers: ednaProfile.layers,
        } : null,
        profile: profile,
      };

      // 🎯 Get output token limit based on user tier
      const userTierValidated: UserTier = validateUserTier(userTier);
      const maxOutputTokens = getOutputLimitForTier(userTierValidated);
      console.log(`📊 [AdviceGenerator] Output limit for tier "${userTierValidated}": ${maxOutputTokens} tokens`);

      const llmResponse = await this.llmOrchestrator.generateResponse(
        selectedLLM,
        reasoningMessages,
        {
          temperature: 0.7,
          max_tokens: maxOutputTokens, // Full tier limit so both reasoning and response fit (was 600 cap → caused truncation → empty response)
          response_format: 'json_object', // Force JSON output for OpenAI
        },
      );

      // Track token usage for advice generation
      if (userId && sessionId && llmResponse.usage) {
        try {
          const inputTokens = llmResponse.usage.prompt_tokens || llmResponse.usage.input_tokens || 0;
          const outputTokens = llmResponse.usage.completion_tokens || llmResponse.usage.output_tokens || 0;
          const totalTokens = llmResponse.usage.total_tokens || (inputTokens + outputTokens);

          if (totalTokens > 0) {
            await this.creditService.recordTokenUsage(
              userId,
              sessionId,
              totalTokens,
              inputTokens,
              outputTokens,
              selectedLLM,
              'advice',
              null,
            );
            
            // 💰 Track budget usage for premium models
            await this.budgetTracker.trackUsage(userId, selectedLLM, inputTokens, outputTokens);

            // Check if premium model and record premium reply usage
            if (isPremiumModel(selectedLLM)) {
              const premiumCheck = await this.creditService.canUsePremiumModel(userId);
              if (premiumCheck.allowed && premiumCheck.cost) {
                // Pay-per-use premium reply
                await this.creditService.recordPremiumReplyUsage(userId, sessionId, premiumCheck.cost);
              } else if (premiumCheck.allowed) {
                // Included premium reply (quota)
                await this.creditService.recordPremiumReplyUsage(userId, sessionId, 0);
              }
            }
          }
        } catch (error) {
          console.error('❌ [AdviceGenerator] Failed to track tokens:', error);
          // Don't throw - continue even if tracking fails
        }
      }

      let fullResponse = llmResponse.content || "I'm here to listen. What's on your mind?";

      // DEBUG: Decision Intelligence — check if end validator made it into the response
      if (decisionIntelligenceMode) {
        const hasEndValidator =
          /3\.\s*Logic\s*\(end validator\)/i.test(fullResponse) ||
          /3\.\s*Emotion\s*\(end validator\)/i.test(fullResponse) ||
          fullResponse.includes('end validator');
        console.log(`🔬 [DI DEBUG] Raw LLM response length: ${fullResponse.length}`);
        console.log(`🔬 [DI DEBUG] Contains end validator: ${hasEndValidator}`);
        console.log(`🔬 [DI DEBUG] Response snippet (first 600 chars): ${fullResponse.slice(0, 600).replace(/\n/g, ' ')}`);
      }

      // Parse JSON response
      let cleanResponse = '';
      let extractedReasoning = '';

      try {
        // Try to parse as JSON first
        const jsonResponse = JSON.parse(fullResponse);
        if (jsonResponse.response && jsonResponse.reasoning) {
          cleanResponse = jsonResponse.response.trim();
          extractedReasoning = jsonResponse.reasoning.trim();
        } else {
          // Fallback: incomplete JSON
          cleanResponse = jsonResponse.response || fullResponse;
          extractedReasoning =
            jsonResponse.reasoning || 'LLM provided response without structured reasoning';
        }
      } catch (jsonError) {
        // Fallback: Not JSON - try old format with RESPONSE:/REASONING: markers
        const hasResponseMarker = fullResponse.includes('RESPONSE:');
        const hasReasoningMarker = fullResponse.includes('REASONING:');

        if (hasResponseMarker) {
          const responseMatch = fullResponse.match(/RESPONSE:\s*(.+?)(?:\s+REASONING:|$)/s);
          if (responseMatch && responseMatch[1]) {
            cleanResponse = responseMatch[1].trim();
            if (hasReasoningMarker) {
              const reasoningMatch = fullResponse.match(/REASONING:\s*(.+)/s);
              if (reasoningMatch) {
                extractedReasoning = reasoningMatch[1].trim();
              }
            }
          }
        } else if (hasReasoningMarker) {
          const parts = fullResponse.split(/\s+REASONING:\s*/);
          cleanResponse = parts[0].trim();
          extractedReasoning = parts[1]
            ? parts[1].trim()
            : 'LLM did not provide structured reasoning';
        } else {
          // Last resort: use raw response
          cleanResponse = fullResponse.trim();
          extractedReasoning = 'LLM did not follow the expected format - reasoning unavailable';
        }
      }

      // Decision Intelligence: ensure end-validator third point is present (safety net if LLM skipped it)
      if (decisionIntelligenceMode && cleanResponse) {
        const coreType = this.getDecisionCoreType(ednaProfile);
        cleanResponse = this.ensureEndValidatorInResponse(cleanResponse, coreType);
      }

      // Root-cause fix: LLM sometimes returns {"reasoning": "...", "response": ""}. Never return empty.
      const EMPTY_RESPONSE_FALLBACK = "Could you say a bit more so I can respond properly?";
      if (!cleanResponse || !cleanResponse.trim()) {
        console.warn('[AdviceGenerator] LLM returned empty response; using fallback. Raw length:', fullResponse?.length ?? 0);
        cleanResponse = EMPTY_RESPONSE_FALLBACK;
      }

      // Note: Don't strip ** markdown as frontend renders it as bold

      // Log for debugging
      const fs = require('fs');
      const path = require('path');
      const reasoningLog = path.join(process.cwd(), 'reasoning.log');
      const timestamp = new Date().toISOString();
      const logEntry = `\n[${timestamp}] ===== LLM REASONING =====\n${extractedReasoning}\n\n`;
      fs.appendFileSync(reasoningLog, logEntry);

      return {
        response: cleanResponse,
        reasoning: extractedReasoning,
      };
    } catch (error) {
      console.error('LLM API error:', error);
      return { response: "I'm here to listen. What's on your mind?" };
    }
  }

  /**
   * STREAMING VERSION of generateAdviceWithProfile
   * Uses the EXACT SAME perfect prompt (buildCleanSystemPrompt) but streams the response
   * This is for /chat endpoint with stream=true
   */
  async *generateAdviceWithProfileStreaming(
    userMessage: string,
    profile: any,
    conversationHistory: any[],
    selectedLLM: string = 'gpt-4o',
    sessionId?: string,
    userId?: string,
    ednaProfile?: EdnaProfileFull | null,
    userTier: string = 'free',
    decisionIntelligenceMode?: boolean,
  ): AsyncGenerator<{ type: 'token' | 'reasoning' | 'done'; content: string }, void, unknown> {
    try {
      const systemPrompt = decisionIntelligenceMode
        ? this.buildDecisionIntelligenceSystemPrompt(ednaProfile)
        : this.buildCleanSystemPrompt(profile, ednaProfile);
      const userMessagePrompt = decisionIntelligenceMode ? userMessage : this.buildUserMessagePrompt(userMessage, profile);

      console.log(`\n🔥🔥🔥 [AdviceGenerator STREAM V2] CALLED`);
      console.log(`   - userMessage: ${userMessage?.substring(0, 50)}...`);
      console.log(`   - systemPrompt length: ${systemPrompt.length} chars (DI: ${!!decisionIntelligenceMode})`);
      console.log(`   - hasEdnaProfile: ${!!ednaProfile}`);
      console.log(`   - userTier: ${userTier}`);

      // ROLLING SUMMARY: Same logic as non-streaming
      const { summary, recentMessages } = await this.rollingSummaryService.getOptimizedHistory(
        sessionId || 'default',
        conversationHistory,
        userTier,
      );

      console.log(`📝 [AdviceGenerator STREAM V2] Rolling summary: ${recentMessages.length} recent msgs, hasSummary: ${!!summary}`);

      // Build messages array - SAME as non-streaming
      const reasoningMessages: any[] = [
        { role: 'system', content: systemPrompt },
      ];

      if (summary) {
        reasoningMessages.push({
          role: 'system',
          content: `[CONVERSATION CONTEXT - Summary of earlier messages]\n${summary}\n[END CONTEXT]`,
        });
      }

      reasoningMessages.push(
        ...recentMessages.map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
        { role: 'user', content: userMessagePrompt },
      );

      // Get output token limit based on tier
      const userTierValidated: UserTier = validateUserTier(userTier);
      const maxOutputTokens = getOutputLimitForTier(userTierValidated);

      // Stream the response
      let fullResponse = '';
      let lastReasoningExtracted = '';
      let hasSeenResponseField = false;

      const streamOptions: any = {
        temperature: 0.7,
        max_tokens: maxOutputTokens,
      };

      // Add response_format for OpenAI models
      if (selectedLLM.startsWith('gpt-') || selectedLLM.startsWith('o1-')) {
        streamOptions.response_format = { type: 'json_object' };
      }

      for await (const chunk of this.llmOrchestrator.generateStream(
        selectedLLM,
        reasoningMessages,
        streamOptions,
      )) {
        fullResponse += chunk;

        // Check if we've entered the response field
        if (fullResponse.includes('"response"')) {
          hasSeenResponseField = true;
        }

        // Extract reasoning incrementally (before response field appears)
        if (!hasSeenResponseField && fullResponse.includes('"reasoning"')) {
          const reasoningMatch = fullResponse.match(/"reasoning"\s*:\s*"((?:[^"\\]|\\.)*?)(?:"\s*,|\s*"response"|$)/);
          if (reasoningMatch && reasoningMatch[1]) {
            const currentReasoning = reasoningMatch[1]
              .replace(/\\n/g, '\n')
              .replace(/\\"/g, '"')
              .replace(/\\t/g, '\t')
              .replace(/\\\\/g, '\\');

            if (currentReasoning.length > lastReasoningExtracted.length) {
              lastReasoningExtracted = currentReasoning;
              console.log(`💭 [STREAMING REASONING] Yielding reasoning chunk: ${currentReasoning.substring(0, 80)}...`);
              yield { type: 'reasoning', content: currentReasoning };
            }
          }
        }

        // Stream all tokens
        yield { type: 'token', content: chunk };
      }

      // Final parse to extract complete reasoning and response
      let finalReasoning = '';
      let finalResponse = '';
      try {
        const finalJson = JSON.parse(fullResponse);
        if (finalJson.reasoning) finalReasoning = finalJson.reasoning;
        if (finalJson.response) finalResponse = finalJson.response;
      } catch (e) {
        // Fallback regex extraction
        const reasoningMatch = fullResponse.match(/"reasoning"\s*:\s*"([\s\S]*?)"\s*,/);
        const responseMatch = fullResponse.match(/"response"\s*:\s*"([\s\S]*?)"\s*}/);
        if (reasoningMatch) finalReasoning = reasoningMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
        if (responseMatch) finalResponse = responseMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
      }

      // DEBUG: Decision Intelligence — check if end validator in streamed response
      if (decisionIntelligenceMode) {
        const textToCheck = finalResponse || fullResponse;
        const hasEndValidator =
          /3\.\s*Logic\s*\(end validator\)/i.test(textToCheck) ||
          /3\.\s*Emotion\s*\(end validator\)/i.test(textToCheck) ||
          textToCheck.includes('end validator');
        console.log(`🔬 [DI STREAM DEBUG] Response length: ${textToCheck.length}, contains end validator: ${hasEndValidator}`);
        console.log(`🔬 [DI STREAM DEBUG] Response snippet: ${textToCheck.slice(0, 500).replace(/\n/g, ' ')}`);
        // Safety net: inject end validator if missing
        const coreType = this.getDecisionCoreType(ednaProfile);
        finalResponse = this.ensureEndValidatorInResponse(finalResponse || fullResponse, coreType);
      }

      // Root-cause fix: never yield empty response (LLM sometimes returns empty "response" field)
      const streamFallback = "I'm here. Could you say a bit more so I can respond properly?";
      const outContent = (finalResponse || fullResponse || '').trim();
      const contentToYield = outContent.length > 0 ? outContent : streamFallback;
      if (outContent.length === 0) {
        console.warn('[AdviceGenerator STREAM] LLM returned empty response; using fallback. fullResponse length:', fullResponse?.length ?? 0);
      }

      // Yield final reasoning if we got more
      if (finalReasoning && finalReasoning !== lastReasoningExtracted) {
        yield { type: 'reasoning', content: finalReasoning };
      }

      yield { type: 'done', content: contentToYield };
    } catch (error: any) {
      console.error('Error in generateAdviceWithProfileStreaming:', error);
      yield { type: 'done', content: `Error: ${error.message}` };
    }
  }

  /**
   * Generate streaming advice response (OLD - uses simpler prompt)
   * @deprecated Use generateAdviceWithProfileStreaming instead
   */
  async *generateAdviceStream(
    userMessage: string,
    profile: any,
    conversationHistory: any[],
    selectedLLM: string = 'gpt-4o',
    sessionId?: string,
    userId?: string,
    ednaProfile?: EdnaProfileFull | null,
    userTier: string = 'free', // NEW: tier for history limits
    decisionIntelligenceMode?: boolean,
  ): AsyncGenerator<{ type: 'token' | 'reasoning' | 'done'; content: string }, void, unknown> {
    try {
      const systemPrompt = decisionIntelligenceMode
        ? this.buildDecisionIntelligenceSystemPrompt(ednaProfile)
        : this.buildCleanSystemPrompt(profile, ednaProfile);
      const userMessagePrompt = decisionIntelligenceMode ? userMessage : this.buildUserMessagePrompt(userMessage, profile);

      // ROLLING SUMMARY: Use optimized history instead of full history
      const { summary, recentMessages } = await this.rollingSummaryService.getOptimizedHistory(
        sessionId || 'default',
        conversationHistory,
        userTier,
      );
      
      console.log(`📝 [AdviceStream] Using rolling summary: ${recentMessages.length} recent msgs, hasSummary: ${!!summary}`);

      // Build messages with rolling summary
      const reasoningMessages: any[] = [
        { role: 'system', content: systemPrompt },
      ];
      
      if (summary) {
        reasoningMessages.push({
          role: 'system',
          content: `[CONVERSATION CONTEXT]\n${summary}\n[END CONTEXT]`,
        });
      }
      
      reasoningMessages.push(
        ...recentMessages.map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
        {
          role: 'user',
          content: userMessagePrompt,
        },
      );

      let fullResponse = '';
      let lastReasoningExtracted = '';
      let hasSeenResponseField = false;

      // 🎯 Get output token limit based on user tier
      const userTierValidated: UserTier = validateUserTier(userTier);
      const maxOutputTokens = getOutputLimitForTier(userTierValidated);
      console.log(`📊 [AdviceGenerator Stream] Output limit for tier "${userTierValidated}": ${maxOutputTokens} tokens`);

      // Stream the response - parse JSON incrementally to extract reasoning and response
      // Force JSON output format for OpenAI models
      const streamOptions: any = {
        temperature: 0.7,
        max_tokens: maxOutputTokens, // Full tier limit so both reasoning and response fit (was 600 cap → caused truncation → empty response)
      };
      
      // Add response_format for OpenAI models to force JSON output
      if (selectedLLM.startsWith('gpt-') || selectedLLM.startsWith('o1-')) {
        streamOptions.response_format = { type: 'json_object' };
      }
      
      for await (const chunk of this.llmOrchestrator.generateStream(
        selectedLLM,
        reasoningMessages,
        streamOptions,
      )) {
        fullResponse += chunk;
        
        // Debug: Log first few chunks to see what we're getting
        if (fullResponse.length < 200) {
          console.log(`🔍 [AdviceGenerator Stream] First chunk: "${fullResponse.substring(0, 100)}..."`);
        }
        
        // Check if we've entered the response field
        if (fullResponse.includes('"response"')) {
          hasSeenResponseField = true;
          console.log(`✅ [AdviceGenerator Stream] Response field detected`);
        }
        
        // Extract reasoning incrementally (before response field appears)
        if (!hasSeenResponseField && fullResponse.includes('"reasoning"')) {
          // Try multiple regex patterns to extract reasoning
          let reasoningMatch = fullResponse.match(/"reasoning"\s*:\s*"((?:[^"\\]|\\.)*?)(?:"\s*,|\s*"response"|$)/);
          
          // Fallback: simpler pattern if first one fails
          if (!reasoningMatch) {
            reasoningMatch = fullResponse.match(/"reasoning"\s*:\s*"([^"]*?)(?:"\s*,|\s*"response")/);
          }
          
          if (reasoningMatch && reasoningMatch[1]) {
            const currentReasoning = reasoningMatch[1]
              .replace(/\\n/g, '\n')
              .replace(/\\"/g, '"')
              .replace(/\\t/g, '\t')
              .replace(/\\\\/g, '\\');
            
            // Only yield if reasoning has changed and is longer
            if (currentReasoning !== lastReasoningExtracted && currentReasoning.length > lastReasoningExtracted.length) {
              lastReasoningExtracted = currentReasoning;
              console.log(`🧠 [AdviceGenerator Stream] Yielding reasoning chunk (${currentReasoning.length} chars): "${currentReasoning.substring(0, 50)}..."`);
              yield { type: 'reasoning', content: currentReasoning };
            }
          } else if (fullResponse.includes('"reasoning"')) {
            // Debug: We see "reasoning" but regex didn't match
            console.log(`⚠️ [AdviceGenerator Stream] Found "reasoning" but regex didn't match. Full so far: "${fullResponse.substring(0, 200)}"`);
          }
        }
        
        // Stream tokens (frontend will parse JSON to extract response)
        yield { type: 'token', content: chunk };
      }

      // Final parse to extract complete reasoning and response
      let finalReasoning = '';
      let finalResponse = '';
      try {
        const finalJson = JSON.parse(fullResponse);
        if (finalJson.reasoning) {
          finalReasoning = finalJson.reasoning;
        }
        if (finalJson.response) {
          finalResponse = finalJson.response;
        }
      } catch (e) {
        // If JSON parse fails, try regex extraction as fallback
        const reasoningMatch = fullResponse.match(/"reasoning"\s*:\s*"([\s\S]*?)"\s*,/);
        const responseMatch = fullResponse.match(/"response"\s*:\s*"([\s\S]*?)"\s*}/);
        if (reasoningMatch) {
          finalReasoning = reasoningMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
        }
        if (responseMatch) {
          finalResponse = responseMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
        }
      }

      const streamFallbackOld = "I'm here. Could you say a bit more so I can respond properly?";
      const outContentOld = (finalResponse || fullResponse || '').trim();
      const contentToYieldOld = outContentOld.length > 0 ? outContentOld : streamFallbackOld;
      if (outContentOld.length === 0) {
        console.warn('[AdviceGenerator Stream OLD] LLM returned empty response; using fallback.');
      }
      yield { type: 'done', content: contentToYieldOld };
    } catch (error) {
      console.error('Error in streaming advice generation:', error);
      yield { type: 'done', content: `Error: ${error.message}` };
    }
  }

  /**
   * Build streaming system prompt - outputs PLAIN TEXT (no JSON)
   * Same quality as the main prompt but optimized for streaming
   */
  private buildStreamingSystemPrompt(profile: any, ednaProfile?: EdnaProfileFull | null): string {
    const profileSummary = this.buildCleanProfileSummary(profile);
    const summaryForThisMessage = profile?.summaryForThisMessage
      ? JSON.stringify(profile.summaryForThisMessage)
      : '';
    const safetyBlock = profile?.safety ? `Safety: ${JSON.stringify(profile.safety)}` : '';
    
    // E-DNA Integration (same pattern as buildCleanSystemPrompt)
    let ednaContext = '';
    let ednaInstructions = '';
    let ednaProfileSummary = '';
    let ednaCharacterSummary = '';
    if (ednaProfile) {
      ednaInstructions = this.ednaProfileService.getInstructionsForAdvice(ednaProfile);
      ednaCharacterSummary = ednaProfile.characterSummary || '';
      ednaProfileSummary = this.ednaProfileService.getProfileSummaryForAdvice(ednaProfile);
      const l1 = ednaProfile.layers.layer1;
      const l2 = ednaProfile.layers.layer2;
      ednaContext = `This person is a ${l1.coreType} (${l1.strength} strength) with a ${l2.subtype} subtype.`;
    }
    
    const hasDeepProfile = profile && (profile.summaryForThisMessage || Object.keys(profile).length > 2);
    const integrationContext = profile?.integrationContext ? `\nIntegration context: ${profile.integrationContext}` : '';
    
    if (profileSummary || ednaProfile) {
      return `=== THE ALCHEMIST (Streaming Mode) ===

You transform thoughts into growth. You have deep insight into this person. Speak directly and warmly.

${ednaContext ? `🧬 WHO THEY ARE: ${ednaContext}` : ''}
${ednaCharacterSummary ? `🧬 CHARACTER: ${ednaCharacterSummary}` : ''}
${ednaProfileSummary ? `🧬 E-DNA PROFILE:\n${ednaProfileSummary}` : ''}
${ednaInstructions ? `📋 HOW TO REACH THEM:\n${ednaInstructions}` : ''}

${profileSummary ? `🧠 CURRENT STATE:\n${profileSummary}` : ''}
${integrationContext}${safetyBlock}

${summaryForThisMessage ? `🎯 THIS MESSAGE:\n${summaryForThisMessage}` : ''}

=== YOUR RESPONSE STYLE ===

${hasDeepProfile ? `You KNOW this person. Show it. Speak to their patterns, fears, and strengths.` : `You're getting to know them. Be warm and curious.`}

**DON'T:**
- Use numbered lists or bullet points for emotional topics
- Give generic advice anyone could get from ChatGPT  
- Say "Here's what you can do:" followed by steps
- Sound like a helper bot

**DO:**
- Speak conversationally like a wise friend who knows them
- Name their specific patterns without jargon
- Show you understand WHY they're struggling
- Use **bold** for key phrases when it adds emphasis

**Length:**
- Simple questions: 2-3 sentences
- Emotional sharing: One paragraph (4-6 sentences), conversational
- Deep existential: 1-2 paragraphs

${ALCHEMIST_VOICE_SYSTEM_BLOCK}

CRITICAL OUTPUT FORMAT - YOU MUST FOLLOW THIS EXACTLY:
Output your response as a valid JSON object with exactly two fields:
1. "reasoning" - Your internal thought process (what you're thinking before responding)
2. "response" - Your actual conversational message to the user

Example:
{"reasoning": "This person is expressing anxiety about work. They need validation and practical support.", "response": "I hear how overwhelming work feels right now. Let's break this down together—what's the one thing that's weighing on you most?"}

IMPORTANT: 
- Output ONLY the JSON object, nothing else
- Always include both fields
- Keep reasoning to 2–4 sentences so the response field has room
- The reasoning is your internal thoughts; the response is what you say to them (conversational, warm, direct) — response must never be empty`;
    } else {
      return `=== THE ALCHEMIST (First Meeting - Streaming) ===

You are the Alchemist meeting someone new. Be warm, genuine, curious.

**YOUR APPROACH:**
- For greetings: Be warm and curious. "What brings you here?" beats "How can I help?"
- For questions: Answer helpfully, then get curious about what prompted it
- For emotional statements: Validate first, then gently explore
- For practical questions: Offer guidance AND ask what matters to them

**YOUR TONE:**
Warm but not performative. Interested but not intrusive. You're a wise friend, not a customer service bot.

${ALCHEMIST_VOICE_SYSTEM_BLOCK}

Keep responses conversational — usually under 50 words unless they've given you more.

CRITICAL OUTPUT FORMAT:
- Write your response as plain conversational text
- Do NOT wrap your response in JSON
- Do NOT use {"response": ...} or {"reasoning": ...} format
- Do NOT output any curly braces { }
- Just write your message directly as if talking to them

Example of WRONG output: {"response": "Hello!"}
Example of CORRECT output: Hello! What brings you here today?`;
    }
  }

  /**
   * Get Decision Intelligence core type from E-DNA profile.
   */
  private getDecisionCoreType(ednaProfile?: EdnaProfileFull | null): DecisionCoreType {
    const raw = ednaProfile?.layers?.layer1?.coreType?.toLowerCase() || 'mixed';
    return raw === 'architect' || raw === 'alchemist' ? raw : 'mixed';
  }

  /**
   * If the response looks like a summary (has 1. and 2.) but is missing the end-validator third point,
   * inject it so the client always sees the full decision loop.
   */
  private ensureEndValidatorInResponse(responseText: string, coreType: DecisionCoreType): string {
    // Only skip if we already have correctly numbered "3. Logic (end validator)" or "3. Emotion (end validator)"
    const hasCorrectEndValidator =
      /3\.\s*Logic\s*\(end validator\)/i.test(responseText) ||
      /3\.\s*Emotion\s*\(end validator\)/i.test(responseText) ||
      /3\.\s*\[?Dominant validator\]?/i.test(responseText);
    if (hasCorrectEndValidator) return responseText;

    // Remove wrongly numbered "1. Logic (end validator)" / "1. Emotion (end validator)" (allow ** before 1.)
    let text = responseText
      .replace(/\n\s*(\*\*)?1\.\s*(\*\*)?Logic\s*\(end validator\)(\*\*)?\s*:?[^\n]*/gi, '\n')
      .replace(/\n\s*(\*\*)?1\.\s*(\*\*)?Emotion\s*\(end validator\)(\*\*)?\s*:?[^\n]*/gi, '\n')
      .replace(/\n\s*(\*\*)?1\.\s*(\*\*)?\[?Dominant validator\]?(\*\*)?\s*:?[^\n]*/gi, '\n');
    text = text.replace(/\n{3,}/g, '\n\n').trim();

    // Fallback: fix number in place if a "1. Logic (end validator)" line somehow remains (e.g. different formatting)
    text = text
      .replace(/1\.\s*Logic\s*\(end validator\)/gi, '3. Logic (end validator)')
      .replace(/1\.\s*Emotion\s*\(end validator\)/gi, '3. Emotion (end validator)');

    // Match "1. Logic" or "1. **Logic:**" and "2. Emotion" or "2. **Emotion:**" (allow markdown)
    const hasLogicThenEmotion = /1\.\s*(\*\*)?Logic(\*\*)?\s*:?/i.test(text) && /2\.\s*(\*\*)?Emotion(\*\*)?\s*:?/i.test(text);
    const hasEmotionThenLogic = /1\.\s*(\*\*)?Emotion(\*\*)?\s*:?/i.test(text) && /2\.\s*(\*\*)?Logic(\*\*)?\s*:?/i.test(text);
    if (!hasLogicThenEmotion && !hasEmotionThenLogic) return responseText;

    // Third point text — statement (not question), same style for all types (Architect: Logic, Alchemist: Emotion, Mixed: Dominant)
    const thirdPoint =
      coreType === 'architect'
        ? '3. Logic (end validator): Given the logic and emotion you shared, your logic concludes the next step.'
        : coreType === 'alchemist'
          ? '3. Emotion (end validator): Given the logic and emotion you shared, your gut points to the next step.'
          : '3. Dominant validator: Given both logic and emotion you shared, your dominant validator (logic or emotion) points to what you need to decide.';
    const summaryLine = 'In summary: logic, emotion, and your end validator point to what you need to decide.';

    // Insert the 3rd point immediately after the "2. Emotion" (or "2. Logic") paragraph so it is the literal third point
    const beforeInsert = text;
    if (hasLogicThenEmotion) {
      text = text.replace(
        /(2\.\s*(\*\*)?Emotion(\*\*)?\s*:?[^\n]*(?:\n(?!\n)[^\n]*)*)(\n\n)/i,
        `$1\n\n${thirdPoint}$4`,
      );
    } else if (hasEmotionThenLogic) {
      text = text.replace(
        /(2\.\s*(\*\*)?Logic(\*\*)?\s*:?[^\n]*(?:\n(?!\n)[^\n]*)*)(\n\n)/i,
        `$1\n\n${thirdPoint}$4`,
      );
    }
    // Fallback: if paragraph pattern didn't match, insert before decision step
    if (text === beforeInsert) {
      const decisionStepPattern = /(?:Now,?\s+)?(?:[Tt]his (?:is the |leads us to the )?[Dd]ecision step|[Dd]ecision step)\s*:?|(?:Now,?\s*)?(?:let's\s+)?(?:focus on the\s+|get to the\s+|finalize your\s+)?[Dd]ecision step\s*:?|(?:Now,? )?[Dd]o you (?:have|feel) enough|(?:Now,?\s*)?[Ll]et's (?:focus on making a decision|finalize this|finalize your decision)\s*:?/i;
      const match = text.match(decisionStepPattern);
      if (match) {
        text = text.replace(decisionStepPattern, `\n\n${thirdPoint}\n\n${summaryLine}\n\n$&`);
      } else {
        text = text.trimEnd() + `\n\n${thirdPoint}\n\n${summaryLine}\n\n`;
      }
    } else {
      // Summary line before the decision step
      const decisionStepPattern = /(?:Now,?\s+)?(?:[Tt]his (?:is the |leads us to the )?[Dd]ecision step|[Dd]ecision step)\s*:?|(?:Now,?\s*)?(?:let's\s+)?(?:focus on the\s+|get to the\s+|finalize your\s+)?[Dd]ecision step\s*:?|(?:Now,? )?[Dd]o you (?:have|feel) enough|(?:Now,?\s*)?[Ll]et's (?:focus on making a decision|finalize this|finalize your decision)\s*:?/i;
      if (text.match(decisionStepPattern) && !text.includes(summaryLine)) {
        text = text.replace(decisionStepPattern, `\n\n${summaryLine}\n\n$&`);
      }
    }

    return text;
  }

  /**
   * Build system prompt for Decision Intelligence Agent mode (workbook-guided decision making).
   * Uses core type from E-DNA to inject the correct type block; defaults to 'mixed' if no profile.
   */
  private buildDecisionIntelligenceSystemPrompt(ednaProfile?: EdnaProfileFull | null): string {
    const coreType = this.getDecisionCoreType(ednaProfile);
    const subtype = ednaProfile?.layers?.layer2?.subtype;
    const identityLabel = subtype
      ? `${coreType.charAt(0).toUpperCase() + coreType.slice(1)} — ${subtype}`
      : coreType.charAt(0).toUpperCase() + coreType.slice(1);
    const prompt = getDecisionIntelligenceSystemPrompt(coreType, { identityLabel });
    const hasCritical = prompt.includes('CRITICAL') && prompt.includes('end validator');
    console.log(`🔬 [DI DEBUG] coreType: ${coreType}, prompt has CRITICAL+end validator: ${hasCritical}, length: ${prompt.length}`);
    return prompt;
  }

  /**
   * Build clean system prompt with psychological insights and E-DNA profile
   * THE 10/10 ALCHEMIST PROMPT - Complete Integration
   */
  private buildCleanSystemPrompt(profile: any, ednaProfile?: EdnaProfileFull | null): string {
    const profileSummary = this.buildCleanProfileSummary(profile);
    const summaryForThisMessage = profile?.summaryForThisMessage
      ? JSON.stringify(profile.summaryForThisMessage)
      : '';
    const safetyBlock = profile?.safety ? `Safety: ${JSON.stringify(profile.safety)}` : '';

    // Build E-DNA context: INSTRUCTIONS (how to communicate) + Character Summary + Detailed profile + Brief identity
    let ednaContext = '';
    let ednaInstructions = '';
    let ednaProfileSummary = '';
    let ednaCharacterSummary = '';
    if (ednaProfile) {
      // Get actionable instructions for how to respond to this person
      ednaInstructions = this.ednaProfileService.getInstructionsForAdvice(ednaProfile);
      
      // Get the hardcoded character summary (condensed overview)
      ednaCharacterSummary = ednaProfile.characterSummary || '';
      
      // Get detailed profile summary with all 7 layers
      ednaProfileSummary = this.ednaProfileService.getProfileSummaryForAdvice(ednaProfile);
      console.log(`🧬 [AdviceGenerator] E-DNA Character Summary: ${ednaCharacterSummary.substring(0, 150)}...`);
      console.log(`🧬 [AdviceGenerator] E-DNA Profile Summary length: ${ednaProfileSummary.length} chars`);
      
      // Brief identity context
      const l1 = ednaProfile.layers.layer1;
      const l2 = ednaProfile.layers.layer2;
      ednaContext = `This person is a ${l1.coreType} (${l1.strength} strength) with a ${l2.subtype} subtype.`;
    }

    // Build integration context (conflicts, similarities, mild cases)
    let integrationContext = '';
    if (profile?.integrationMeta) {
      const meta = profile.integrationMeta;
      const parts: string[] = [];

      if (meta.similarities && meta.similarities.length > 0) {
        parts.push(
          `MODEL AGREEMENTS (Higher confidence - multiple tests confirmed): ${meta.similarities.map((s: any) => s.agreement).join('; ')}`,
        );
      }

      if (meta.mildCases && meta.mildCases.length > 0) {
        parts.push(
          `MODERATE/BALANCED TRAITS (Person is in-between, not extreme): ${meta.mildCases.map((m: any) => `${m.trait} (${m.interpretation})`).join('; ')}`,
        );
      }

      if (meta.conflictResolutions && meta.conflictResolutions.length > 0) {
        parts.push(
          `RESOLVED CONFLICTS (Confidence reduced due to model disagreement): ${meta.conflictResolutions.map((r: any) => `${r.conflict} - ${r.action}`).join('; ')}`,
        );
      }

      if (parts.length > 0) {
        integrationContext = `\nINTEGRATION CONTEXT (How models relate):\n${parts.join('\n')}\n`;
      }
    }

    // Count conversation depth (approximate from if we have profile data)
    const hasDeepProfile = profileSummary && profileSummary.length > 100;

    if (profileSummary || ednaContext || ednaInstructions || ednaProfileSummary || ednaCharacterSummary) {
      return `=== THE ALCHEMIST'S ART ===

You are the Alchemist. You don't just hear words — you sense the energy beneath them.

**YOUR CORE BELIEF:**
Every difficult feeling has purpose. Every "flaw" is a strength overused or misapplied. Every person carries their own answers — they need help finding them, not being told them. The struggle someone brings you is rarely the full story — there's always something deeper trying to emerge.

**HOW YOU RESPOND:**
You don't follow a formula. You read what's needed in THIS moment:
- Sometimes they need to be heard before anything else
- Sometimes they need a different perspective immediately  
- Sometimes they need a question that opens something
- Sometimes they need permission to feel what they feel
- Sometimes they need practical steps right now
- Sometimes they need to sit in the unknown

Trust your read. If you sense they need space, give space. If you sense they need direction, give direction. If you sense they need to be challenged, challenge gently. There is no right order — only the right response for THIS person in THIS moment.

**YOUR GIFT:**
You see what others miss. The shadow that points to light. The fear that reveals what matters. The pattern that's ready to shift. You don't impose meaning — you help them discover the meaning that's already there.

**YOUR TONE:**
Warm but not soft. Deep but not heavy. Confident but curious. You can be profound without being pretentious, practical without being cold. You speak to people's potential without dismissing their pain.

${ALCHEMIST_VOICE_SYSTEM_BLOCK}

=== THE ALCHEMIST'S SHADOWS (What NOT to Do) ===

Even alchemists can fall into traps. Notice if you're doing these and pivot:

❌ **The Lecturer** — Giving wisdom nobody asked for. If they wanted a TED talk, they'd watch one.
❌ **The Validator** — So supportive you never challenge. Endless "that's valid" without movement.
❌ **The Fixer** — Jumping to solutions before understanding. You're not a vending machine.
❌ **The Mirror** — Only reflecting back, never offering. "I hear you're sad" isn't help.
❌ **The Mystic** — So abstract it means nothing. Vague wisdom is just noise.
❌ **The Therapist** — "And how does that make you feel?" on repeat. You're a guide, not a cliché.
❌ **The Projector** — Assuming they feel what YOU would feel. They're not you.

=== THE SHAPE OF YOUR RESPONSE ===

Let their message guide your response's shape:

• **They wrote a lot** → They need to be heard. Acknowledge the fullness before responding.
• **They wrote little** → They're either guarded or clear. Sense which. Match their economy or gently invite more.
• **They asked a question** → Answer it. Don't deflect into "what do YOU think?" unless that truly serves.
• **They didn't ask anything** → They're processing. You can ask, reflect, or offer — sense what's needed.
• **They're in pain** → Brevity with warmth. Don't overwhelm with words.
• **They want action** → Give concrete next steps. Don't philosophize.
• **They want understanding** → Go deep. This is your moment.

=== WHERE ARE WE IN THE JOURNEY? ===

Not all moments are equal:
${hasDeepProfile ? `- **They've shared and you know them now**: Honor what they've revealed. Go deeper if they're ready. Build on what you know.` : `- **Early exchange**: They're testing the waters. Be warm, be curious, earn trust. Don't assume too much.`}
- **After they've opened up**: Let it land. Don't rush to the next insight.
- **After resistance or deflection**: Slow down. Something touched a nerve. Create safety.
- **When they're stuck in loops**: Gently interrupt the pattern. Name it with care.

Read where you are, not just what they said.

=== WEAVING IT TOGETHER (Your Three Streams of Insight) ===

You have three streams of insight. Let all three inform you without being enslaved by any:

**1. E-DNA INSTRUCTIONS = HOW to reach this specific person**
Their wavelength. The way they process, learn, and grow. Speak on their frequency.
${ednaContext ? `\n🧬 WHO THEY ARE: ${ednaContext}` : ''}
${ednaCharacterSummary ? `\n🧬 CHARACTER SUMMARY (Hardcoded E-DNA Overview):\n${ednaCharacterSummary}` : ''}
${ednaProfileSummary ? `\n🧬 COMPLETE E-DNA PROFILE (All 7 Layers - Detailed):\n${ednaProfileSummary}` : ''}
${ednaInstructions ? `\n📋 TAILORED APPROACH (How to Communicate):\n${ednaInstructions}` : ''}

**2. PSYCHOLOGICAL PROFILE = WHAT they're carrying right now**
Their current weather — emotional state, thought patterns, underlying dynamics.
${profileSummary ? `\n🧠 CURRENT STATE:\n${profileSummary}` : '(Building understanding as they share)'}
${integrationContext}${safetyBlock}

**3. MESSAGE SUMMARY = WHERE to focus this response**
Your compass for this specific exchange. What emerged that needs addressing.
${summaryForThisMessage ? `\n🎯 THIS MESSAGE REVEALS:\n${summaryForThisMessage}` : ''}

The Alchemist's art: The data serves the human, not the other way around. Use insights to understand, not to label.

=== SHOWING WHAT YOU KNOW (This Is What Makes You Different) ===

You have deep insight into this person. A generic AI doesn't. **Show the difference.**

**DON'T** give generic advice anyone could get from ChatGPT.
**DO** speak to THEIR specific patterns, fears, strengths, and ways of processing.

**How to surface insights naturally (without technical terms):**

Instead of generic: "It's normal to feel uncertain"
Say profile-informed: "I notice there's a part of you that's searching for certainty before you can move — but that same part is also what makes you thorough and thoughtful"

Instead of generic: "Try breaking it into smaller steps"
Say profile-informed: "Given how you process things, starting with one small experiment might feel more natural than a big plan — you learn by doing, not by planning"

Instead of generic: "Your feelings are valid"
Say profile-informed: "The way you're holding both the doubt AND the belief at the same time — that's not weakness, that's your way of making sure the choice is really right for you"

**Techniques to show the knowing:**

1. **Name their pattern** (without jargon): "I notice you tend to..." / "There's a part of you that..."
2. **Speak to their specific fear**: "What if the worry underneath is actually about..." 
3. **Honor their specific strength**: "The same thing that makes you [struggle] is what makes you [strength]..."
4. **Reference their processing style**: "For someone who [E-DNA trait], this might feel like..." / "Given how you take in information..."
5. **Connect to their deeper motivation**: "What I hear underneath is..." / "The real question seems to be..."
6. **Acknowledge the complexity they're holding**: "You're carrying [X] AND [Y] at the same time — that's not easy"

**Response length guidance:**

- **Simple questions** (breakfast, logistics): 2-3 sentences. Helpful and warm.
- **Emotional sharing** (struggle, pain, confusion): One solid paragraph (4-6 sentences). NO NUMBERED LISTS. Conversational, not prescriptive.
- **Deep existential** (life direction, identity, meaning): 1-2 paragraphs. Go deep. They've invited depth.
- **Anger/frustration**: Validate first, then gentle perspective. Don't lecture.

**CRITICAL: AVOID THE "AI HELPER" TRAP**

❌ DON'T default to numbered lists of "steps" or "tips"
❌ DON'T say "Here's what you can do:" followed by bullet points
❌ DON'T give generic self-help advice that any AI could give
❌ DON'T be prescriptive when they're sharing feelings

✅ DO speak conversationally, like a wise friend who knows them
✅ DO weave insights into natural sentences
✅ DO name their specific patterns and fears
✅ DO show you understand WHY they're struggling (based on their profile)

**Example of what NOT to do:**
"Here are some steps to consider:
1. Reflect on your goals
2. Create a plan
3. Seek support..."
This is generic AI slop. Anyone could get this from ChatGPT.

**Example of what TO do:**
"There's something powerful happening here — you're holding both the doubt AND the belief at the same time. That's actually your way of making sure any choice you make is truly yours, not just a reaction to pressure. The part of you that still believes? It's worth listening to. Not because it guarantees success, but because that inner knowing is how you've always navigated — feeling your way toward what's right, even when the path isn't clear."

Notice: No numbered lists. Speaks to THEIR specific pattern. Shows understanding of HOW they process. Feels like someone who knows them.

**The test for richness:**
Could a generic AI without your profile data give this same response? If yes, dig deeper. What do YOU know about THIS person that changes the response?

=== HOW YOU KNOW IT'S RIGHT (Before You Send) ===

Sense:
- Does this LAND or does it float above them?
- Would this feel true if someone said it to you in this moment?
- Is this about THEM or about you sounding wise?
- Does it open something or close something?
- Would they want to respond to this, or feel "handled"?

The right response has a kind of inevitability — like it's what they needed to hear, even if they didn't know it.

=== THIS MOMENT IN THEIR JOURNEY ===

This isn't just one response — it's a step in their transformation.

Ask yourself:
- What's trying to emerge in them?
- What's the next smallest shift that would matter?
- What seed am I planting, even if it blooms later?

You're not solving their life in one message. You're being present to THIS moment while holding the larger becoming.

=== YOUR LIMITS ===

You're a catalyst, not a savior. Some things need professional help — guide them there with care if needed. Some transformations take time — plant seeds. You hold your insights lightly — people are always more complex than any framework.

=== THE TEST ===

After talking to you, do they feel more themselves? More capable? Like something shifted, even slightly? That's the Alchemist's work.

CRITICAL OUTPUT FORMAT — You MUST respond with valid JSON in this EXACT format (no other text before or after):
{
  "reasoning": "Your private thought process: What do you understand about this person from their E-DNA profile (all 7 layers) and current psychological state? What deeper pattern or insight emerges when you combine this knowledge with their specific message? What makes your response uniquely tailored to them rather than generic advice? Think through this naturally - weave together insights from their core type, subtype, learning style, communication preferences, values, and current emotional state. Don't follow a rigid template - let your understanding flow naturally.",
  "response": "Your response that shows you KNOW this person across ALL their layers. Reference their specific patterns without using jargon. For emotional topics: one rich paragraph (4-6 sentences). For simple questions: 2-3 sentences. Use **bold** for key phrases. Use \\n for line breaks when needed."
}
Keep "reasoning" to 2–4 sentences so "response" has room. The "response" field must NEVER be empty — it must always contain your actual reply to the user.`;
    } else {
      // Early conversation - no profile yet
      return `=== THE ALCHEMIST'S ART (First Meeting) ===

You are the Alchemist. This is your first exchange with someone new.

**YOUR APPROACH:**
You don't have psychological insights yet — and that's perfect. This is about meeting them, not analyzing them.

- For greetings: Be warm and genuinely curious. "What brings you here?" beats "How can I help?"
- For questions: Answer helpfully, then get curious about what prompted the question
- For emotional statements: Validate first, then gently explore when it started
- For practical questions (career, business, decisions): Offer guidance AND ask what matters to them about it
- For anything else: Be present, be real, help with whatever they need

**YOUR TONE:**
Warm but not performative. Interested but not intrusive. You're not a customer service bot ("How may I assist you today?"). You're a wise friend they just met.

${ALCHEMIST_VOICE_SYSTEM_BLOCK}

**KEY PRINCIPLE:**
Don't assume they have problems. They might just want to chat, get advice, or think out loud. Meet them where they are.

Keep responses conversational — usually under 50 words unless they've given you more to work with.

CRITICAL OUTPUT FORMAT — You MUST respond with valid JSON in this EXACT format (no other text before or after):
{
  "reasoning": "Your read of this first exchange: What you notice, what you're curious about, why you're responding this way",
  "response": "Your warm, genuine response — meeting them where they are. Use \\n for line breaks if needed."
}
Keep reasoning to 2–4 sentences. The "response" field must never be empty.`;
    }
  }

  /**
   * Build user message prompt
   */
  private buildUserMessagePrompt(userMessage: string, profile: any): string {
    const isSimpleOrGibberish = this.isSimpleOrGibberish(userMessage);

    if (isSimpleOrGibberish) {
      return userMessage; // Let GPT-4o handle naturally
    } else {
      return userMessage; // Use original message for complex content
    }
  }

  /**
   * Check if message is simple greeting or gibberish
   */
  private isSimpleOrGibberish(message: string): boolean {
    const simpleGreetings =
      /^(hi|hello|hey|good morning|good afternoon|good evening|howdy|sup|yo)$/i;
    const gibberishPattern = /^[^a-zA-Z\s]*$|^.{1,3}$|^[a-z]{1,3}$/i;

    return simpleGreetings.test(message.trim()) || gibberishPattern.test(message.trim());
  }

  /**
   * Build clean profile summary
   */
  private buildCleanProfileSummary(profile: any): string {
    if (!profile) return '';

    const parts: string[] = [];

    if (profile.bigFive) {
      parts.push(`Big Five: ${JSON.stringify(profile.bigFive)}`);
    }
    if (profile.dass) {
      parts.push(`Mental State: ${JSON.stringify(profile.dass)}`);
    }
    if (profile.rse) {
      parts.push(`Self-Esteem: ${JSON.stringify(profile.rse)}`);
    }
    if (profile.darkTriad) {
      parts.push(`Interpersonal Style: ${JSON.stringify(profile.darkTriad)}`);
    }
    if (profile.crt) {
      parts.push(`Thinking Style: ${JSON.stringify(profile.crt)}`);
    }
    if (profile.attachment) {
      parts.push(`Attachment Style: ${JSON.stringify(profile.attachment)}`);
    }
    if (profile.enneagram) {
      parts.push(`Enneagram Type: ${JSON.stringify(profile.enneagram)}`);
    }
    if (profile.mbti) {
      parts.push(`MBTI: ${JSON.stringify(profile.mbti)}`);
    }
    if (profile.erikson) {
      parts.push(`Erikson Stage: ${JSON.stringify(profile.erikson)}`);
    }
    if (profile.gestalt) {
      parts.push(`Gestalt Awareness: ${JSON.stringify(profile.gestalt)}`);
    }
    if (profile.bioPsych) {
      parts.push(`Bio-Psych Factors: ${JSON.stringify(profile.bioPsych)}`);
    }

    return parts.join('\n');
  }

  // -------------------------------------------------------------------------
  // Guest chat (no E-DNA, no Munawar; in-memory only)
  // -------------------------------------------------------------------------

  getGuestSystemPrompt(): string {
    return GUEST_DECISION_COACH_SYSTEM_PROMPT;
  }

  /**
   * Generate one reply for guest users. No E-DNA, no credit tracking.
   * Uses free-tier output limit. Conversation history is passed in (from GuestSessionService).
   */
  async generateGuestAdvice(
    userMessage: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    selectedLLM: string = 'gpt-4o-mini',
  ): Promise<{ response: string; reasoning?: string }> {
    const systemPrompt = this.getGuestSystemPrompt();
    const historyForLlm = conversationHistory.map((m) => ({ role: m.role, content: m.content }));
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...historyForLlm,
      { role: 'user', content: userMessage },
    ];
    console.log(`[Guest] LLM call: ${historyForLlm.length} history messages + 1 current = ${messages.length - 1} turns`);
    const options: any = { temperature: 0.7, max_tokens: GUEST_MAX_OUTPUT_TOKENS };
    if (selectedLLM.startsWith('gpt-') || selectedLLM.startsWith('o1-')) {
      options.response_format = { type: 'json_object' };
    }
    const llmResponse = await this.llmOrchestrator.generateResponse(selectedLLM, messages, options);
    const fullResponse = llmResponse.content || '';

    let cleanResponse = '';
    let extractedReasoning = '';
    try {
      const json = JSON.parse(fullResponse);
      cleanResponse = (json.response || '').trim();
      extractedReasoning = (json.reasoning || '').trim();
    } catch {
      const responseMatch = fullResponse.match(/"response"\s*:\s*"([\s\S]*?)"\s*}/);
      const reasoningMatch = fullResponse.match(/"reasoning"\s*:\s*"([\s\S]*?)"\s*,/);
      if (responseMatch) cleanResponse = responseMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').trim();
      if (reasoningMatch) extractedReasoning = reasoningMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').trim();
    }
    if (!cleanResponse) {
      console.warn('[Guest] LLM returned empty response. Raw length:', fullResponse?.length ?? 0, 'First 200 chars:', fullResponse?.slice(0, 200));
      const lastAssistant = conversationHistory.length >= 2 ? conversationHistory[conversationHistory.length - 1]?.content : undefined;
      cleanResponse = this.getGuestFallbackResponse(userMessage, lastAssistant);
    }
    return { response: cleanResponse, reasoning: extractedReasoning || undefined };
  }

  /**
   * Contextual fallback when guest LLM returns empty. Never repeats the same question.
   * Uses last user message and optionally last assistant message to choose a forward-moving reply.
   */
  private getGuestFallbackResponse(lastUserMessage: string, lastAssistantResponse?: string): string {
    const lower = (lastUserMessage || '').toLowerCase().trim();
    const lastAssistant = (lastAssistantResponse || '').toLowerCase();
    const alreadyPastFirstInstinct =
      /first instinct|facts and numbers|how it feels\?/.test(lastAssistant) ||
      /got it|what are the main facts|options you're weighing|how does this decision feel/.test(lastAssistant);

    if (/\b(feel|feels|felt|feeling|emotion|gut|instinct|feelings)\b/.test(lower)) {
      return "Got it — so your instinct was more about how it feels. What are the main facts or options you're weighing?";
    }
    if (/\b(logic|logical|facts|numbers|data|pros|cons|budget|safety)\b/.test(lower)) {
      return "Got it — so the facts came first. How does this decision feel to you right now, on a scale of 1 to 10?";
    }
    if (/\b(7|8|9|10|scale|out of 10)\b/.test(lower) || /\d\s*out of\s*10/.test(lower)) {
      return "Thanks, that helps. Do you feel you have enough to make the decision now, or do you want to look at more options?";
    }
    if (/\b(enough|decide|decision)\b/.test(lower) && /\b(ready|have enough|think)\b/.test(lower)) {
      return "Great. What's the decision you're making? Put it in your own words.";
    }
    if (alreadyPastFirstInstinct) {
      return "That's helpful. What are the main facts or options you're weighing, or how does this decision feel to you from 1 to 10?";
    }
    if (/\b(car|buy|purchase|job|old)\b/.test(lower) || lower.length > 8) {
      return "Let's work through that. Was your first instinct more about the facts and numbers, or more about how it feels?";
    }
    return "What are the main facts or options you're considering for this decision?";
  }

  /**
   * Stream guest reply (same prompt and limits as generateGuestAdvice).
   */
  async *generateGuestAdviceStream(
    userMessage: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    selectedLLM: string = 'gpt-4o-mini',
  ): AsyncGenerator<{ type: 'reasoning' | 'token' | 'done'; content: string }, void, unknown> {
    const systemPrompt = this.getGuestSystemPrompt();
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: userMessage },
    ];
    const options: any = { temperature: 0.7, max_tokens: GUEST_MAX_OUTPUT_TOKENS };
    if (selectedLLM.startsWith('gpt-') || selectedLLM.startsWith('o1-')) {
      options.response_format = { type: 'json_object' };
    }
    let fullResponse = '';
    let lastReasoning = '';
    for await (const chunk of this.llmOrchestrator.generateStream(selectedLLM, messages, options)) {
      fullResponse += chunk;
      if (!fullResponse.includes('"response"')) {
        const m = fullResponse.match(/"reasoning"\s*:\s*"((?:[^"\\]|\\.)*?)(?:"\s*,|\s*"response"|$)/);
        if (m && m[1]) {
          const current = m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
          if (current.length > lastReasoning.length) {
            lastReasoning = current;
            yield { type: 'reasoning', content: current };
          }
        }
      }
      yield { type: 'token', content: chunk };
    }
    let finalResponse = '';
    try {
      const json = JSON.parse(fullResponse);
      finalResponse = (json.response || '').trim();
    } catch {
      const responseMatch = fullResponse.match(/"response"\s*:\s*"([\s\S]*?)"\s*}/);
      if (responseMatch) finalResponse = responseMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').trim();
    }
    if (!finalResponse) {
      console.warn('[Guest Stream] LLM returned empty response. Raw length:', fullResponse?.length ?? 0);
      const lastAssistant = conversationHistory.length >= 2 ? conversationHistory[conversationHistory.length - 1]?.content : undefined;
      finalResponse = this.getGuestFallbackResponse(userMessage, lastAssistant);
    }
    yield { type: 'done', content: finalResponse };
  }
}
