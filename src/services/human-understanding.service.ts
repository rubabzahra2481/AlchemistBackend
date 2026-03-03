import { Injectable } from '@nestjs/common';

export interface HumanProfile {
  // SILENT INTERNAL ASSESSMENT (Never shown to user)
  personality: {
    openness: 'low' | 'moderate' | 'high';
    conscientiousness: 'low' | 'moderate' | 'high';
    extraversion: 'low' | 'moderate' | 'high';
    agreeableness: 'low' | 'moderate' | 'high';
    neuroticism: 'low' | 'moderate' | 'high';
    confidence: 'low' | 'medium' | 'high';
  };
  mentalState: {
    depression: 'none' | 'mild' | 'moderate' | 'severe';
    anxiety: 'none' | 'mild' | 'moderate' | 'severe';
    stress: 'none' | 'mild' | 'moderate' | 'severe';
    indicators: string[];
  };
  selfEsteem: {
    level: 'low' | 'moderate' | 'high';
    specificConcerns: string[];
  };
  interpersonalStyle: {
    machiavellianism: 'low' | 'moderate' | 'high';
    narcissism: 'low' | 'moderate' | 'high';
    psychopathy: 'low' | 'moderate' | 'high';
  };

  // What they actually need
  coreNeeds: string[];

  // How to talk to them
  bestApproach: string;

  // Conversation context
  topic: string;
  emotionalTone: 'distressed' | 'neutral' | 'hopeful' | 'confused';
}

/**
 * Human Understanding Service - SIMPLIFIED
 * 
 * Note: RAG functionality removed for App Runner compatibility.
 * This service now uses basic heuristics.
 */
@Injectable()
export class HumanUnderstandingService {
  /**
   * Build understanding of the human from conversation
   * Uses basic heuristics instead of RAG
   */
  async understandHuman(
    currentMessage: string,
    conversationHistory: Array<{ role: string; content: string }>,
  ): Promise<HumanProfile> {
    const context = this.analyzeConversationContext(currentMessage);

    return {
      personality: {
        openness: 'moderate',
        conscientiousness: 'moderate',
        extraversion: 'moderate',
        agreeableness: 'moderate',
        neuroticism: 'moderate',
        confidence: 'medium',
      },
      mentalState: {
        depression: 'none',
        anxiety: 'none',
        stress: 'none',
        indicators: [],
      },
      selfEsteem: { level: 'moderate', specificConcerns: [] },
      interpersonalStyle: {
        machiavellianism: 'low',
        narcissism: 'low',
        psychopathy: 'low',
      },
      coreNeeds: ['understanding', 'guidance'],
      bestApproach: 'empathetic and supportive',
      topic: context.topic,
      emotionalTone: context.emotionalTone,
    };
  }

  /**
   * Analyze conversation context
   */
  private analyzeConversationContext(message: string): {
    topic: string;
    emotionalTone: 'distressed' | 'neutral' | 'hopeful' | 'confused';
  } {
    const lower = message.toLowerCase();

    // Detect topic
    let topic = 'general';
    if (lower.match(/career|job|work/)) topic = 'career';
    else if (lower.match(/relationship|friend|family|partner/)) topic = 'relationships';
    else if (lower.match(/stress|anxious|worry|overwhelm/)) topic = 'stress';
    else if (lower.match(/learn|study|skill|improve/)) topic = 'learning';
    else if (lower.match(/goal|future|direction|purpose/)) topic = 'direction';

    // Detect emotional tone
    let emotionalTone: 'distressed' | 'neutral' | 'hopeful' | 'confused' = 'neutral';
    if (lower.match(/help|stuck|don't know|lost|confused/)) emotionalTone = 'confused';
    else if (lower.match(/stress|anxious|overwhelm|panic|scared/)) emotionalTone = 'distressed';
    else if (lower.match(/want to|hope|try|improve|better/)) emotionalTone = 'hopeful';

    return { topic, emotionalTone };
  }

  /**
   * Generate natural human response
   */
  generateHumanResponse(profile: HumanProfile): string {
    const { mentalState, selfEsteem } = profile;

    let opening = '';
    if (mentalState.stress !== 'none' || mentalState.anxiety !== 'none') {
      opening = 'I can hear that this is weighing on you. ';
    } else if (profile.emotionalTone === 'confused') {
      opening = "It sounds like you're at a crossroads. ";
    } else if (selfEsteem.level === 'low') {
      opening = "I hear you, and I want you to know that what you're feeling is valid. ";
    }

    return opening;
  }
}
