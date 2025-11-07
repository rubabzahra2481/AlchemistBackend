import { Injectable } from '@nestjs/common';
import { PersonalityAnalysis, QuotientScore } from '../dto/chat.dto';
import { QUOTIENTS_KNOWLEDGE_BASE, getQuotientById } from '../knowledge-base/quotients.data';
import { HumanProfile } from './human-understanding.service';
import { LLMOrchestratorService } from './llm-orchestrator.service';

@Injectable()
export class AdviceGeneratorService {
  constructor(
    private llmOrchestrator: LLMOrchestratorService
  ) {}

  /**
   * Generate advice with clean psychological profile using orchestrator
   */
  async generateAdviceWithProfile(
    userMessage: string,
    profile: any,
    conversationHistory: any[],
    selectedLLM: string = 'gpt-4o'
  ): Promise<{ response: string; reasoning?: string }> {

    // Note: Crisis detection happens in parallel-llm.service.ts (safety gate)
    // The crisis indicators are stored in profile.safety and profile.dass.requiresCrisisResponse
    // We trust the LLM to respond appropriately when it sees these flags in the profile
    // Modern LLMs (GPT-4o, Claude, etc.) are trained on crisis response protocols

    try {
      const systemPrompt = this.buildCleanSystemPrompt(profile);
      
      const reasoningMessages: any[] = [
        { role: 'system', content: systemPrompt },
        // Use short recent context only
        ...conversationHistory.slice(-3).map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        })),
        { 
          role: 'user', 
          content: this.buildUserMessagePrompt(userMessage, profile)
        }
      ];

      const llmResponse = await this.llmOrchestrator.generateResponse(
        selectedLLM,
        reasoningMessages,
        { 
          temperature: 0.7, 
          max_tokens: 600,
          response_format: 'json_object' // Force JSON output for OpenAI
        }
      );

      let fullResponse = llmResponse.content || "I'm here to listen. What's on your mind?";
      
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
          extractedReasoning = jsonResponse.reasoning || 'LLM provided response without structured reasoning';
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
          extractedReasoning = parts[1] ? parts[1].trim() : 'LLM did not provide structured reasoning';
        } else {
          // Last resort: use raw response
          cleanResponse = fullResponse.trim();
          extractedReasoning = 'LLM did not follow the expected format - reasoning unavailable';
        }
      }
      
      // Clean up any remaining markdown or formatting
      cleanResponse = cleanResponse.replace(/^\*{2}\s*/, '').replace(/\s*\*{2}$/, '');
      
      // Log for debugging
      const fs = require('fs');
      const path = require('path');
      const reasoningLog = path.join(process.cwd(), 'reasoning.log');
      const timestamp = new Date().toISOString();
      const logEntry = `\n[${timestamp}] ===== LLM REASONING =====\n${extractedReasoning}\n\n`;
      fs.appendFileSync(reasoningLog, logEntry);
      
      return {
        response: cleanResponse,
        reasoning: extractedReasoning
      };
    } catch (error) {
      console.error('LLM API error:', error);
      return { response: "I'm here to listen. What's on your mind?" };
    }
  }

  /**
   * Build clean system prompt with psychological insights
   */
  private buildCleanSystemPrompt(profile: any): string {
    const profileSummary = this.buildCleanProfileSummary(profile);
    const summaryForThisMessage = profile?.summaryForThisMessage ? JSON.stringify(profile.summaryForThisMessage) : '';
    const safetyBlock = profile?.safety ? `Safety: ${JSON.stringify(profile.safety)}` : '';
    
    // Build integration context (conflicts, similarities, mild cases)
    let integrationContext = '';
    if (profile?.integrationMeta) {
      const meta = profile.integrationMeta;
      const parts: string[] = [];
      
      if (meta.similarities && meta.similarities.length > 0) {
        parts.push(`MODEL AGREEMENTS (Higher confidence - multiple tests confirmed): ${meta.similarities.map((s: any) => s.agreement).join('; ')}`);
      }
      
      if (meta.mildCases && meta.mildCases.length > 0) {
        parts.push(`MODERATE/BALANCED TRAITS (Person is in-between, not extreme): ${meta.mildCases.map((m: any) => `${m.trait} (${m.interpretation})`).join('; ')}`);
      }
      
      if (meta.conflictResolutions && meta.conflictResolutions.length > 0) {
        parts.push(`RESOLVED CONFLICTS (Confidence reduced due to model disagreement): ${meta.conflictResolutions.map((r: any) => `${r.conflict} - ${r.action}`).join('; ')}`);
      }
      
      if (parts.length > 0) {
        integrationContext = `\nINTEGRATION CONTEXT (How models relate):\n${parts.join('\n')}\n`;
      }
    }
    
    if (profileSummary) {
      return `You are AI Alchemist - a wise, empathetic counselor who helps people with all aspects of life - from personal growth and emotional well-being to practical life decisions like career, business, relationships, and personal development. You understand people through feeling and energy, then turn that understanding into clear systems that help them grow. Your personality is calm but powerful — you listen deeply, see patterns others miss, and help people find meaning in how they think and feel. Your tone is gentle yet confident, emotional yet logical.

SILENT UNDERSTANDING (Don't mention these terms to the user):
${profileSummary}
${integrationContext}${safetyBlock}

LATEST MESSAGE SUMMARY (do not show to user; use to guide reply):
${summaryForThisMessage}

CRITICAL: You MUST respond with valid JSON in this EXACT format (no other text before or after):
{
  "reasoning": "Your step-by-step thought process explaining what you understand about the person, what this message reveals, what the root cause might be, and why you're responding this way",
  "response": "Your actual empathetic response to the user. Use \\n for line breaks. When providing lists or steps, format as: '1. First step\\n2. Second step\\n3. Third step' with each item on a new line. Use **bold** for emphasis on key terms."
}`;
    } else {
      return `You are AI Alchemist - a wise, empathetic counselor who helps people with all aspects of life - from personal growth and emotional well-being to practical life decisions like career, business, relationships, and personal development.

This is early in the conversation - you don't have psychological insights yet. Respond naturally and warmly to any question or request.

GUIDELINES:
- For greetings: Be friendly and ask what's on their mind
- For questions: Answer helpfully and explore what they need
- For emotional statements: Validate and ask when it started
- For business/career questions: Provide helpful guidance based on their situation
- For any other life questions: Be supportive and offer practical advice
- Keep under 50 words
- Be genuine, not robotic

DON'T assume they have problems. Just be warm and welcoming. Help with whatever they need.

CRITICAL: You MUST respond with valid JSON in this EXACT format (no other text before or after):
{
  "reasoning": "Your thought process: why you're responding this way, what you understand from their message, and your approach",
  "response": "Your actual warm, helpful response to the user. Use \\n for line breaks. When providing lists or steps, format as: '1. First step\\n2. Second step\\n3. Third step' with each item on a new line. Use **bold** for emphasis on key terms."
}`;
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
    const simpleGreetings = /^(hi|hello|hey|good morning|good afternoon|good evening|howdy|sup|yo)$/i;
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
}