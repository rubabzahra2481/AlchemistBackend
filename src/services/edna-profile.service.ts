import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IOSBackendService } from './ios-backend.service';
import { 
  EdnaQuizResults, 
  EdnaProfileFull, 
  buildEdnaProfile 
} from '../knowledge-base/edna-traits.data';
import { buildInstructionsFromQuizResults, QuizResultsForInstructions } from '../knowledge-base/edna-instructions.data';

/**
 * E-DNA Profile Service
 * 
 * Fetches E-DNA quiz results from the iOS backend API and merges them
 * with hardcoded trait definitions to create a complete profile.
 * 
 * The profile is cached in-memory per user ID to avoid repeated API calls.
 */

// Quiz results response from the API
export interface QuizResultsResponse {
  success: boolean;
  user: {
    id: string;
    email: string;
    name?: string;
    tier: string;
  };
  hasQuizResults: boolean;
  quizResult?: {
    id: number;
    userId: string;
    sessionId: string;
    completedAt: string;
    layer1: {
      coreType: string;
      strength: string;
      architectScore: number;
      alchemistScore: number;
      decisionLoop?: string;
      decisionProcess?: string;
    };
    layer2: {
      subtype: string;
      description?: string;
      strength?: string;
      blindSpot?: string;
    };
    layer3: {
      integration: string;
      integrationPercent: number;
      description?: string;
    };
    layer4: {
      modalityPreference: string;
      approach: string;
      conceptProcessing: string;
      workingEnvironment: string;
      pace: string;
    };
    layer5: {
      status: string;
      description?: string;
      traits?: {
        ntScore: number;
        ndScore: number;
        teScore: number;
      };
    };
    layer6: {
      mindset: string;
      personality: string;
      communication: string;
    };
    layer7: {
      faithOrientation: string;
      controlOrientation: string;
      fairness: string;
      integrity: string;
      growth: string;
      impact: string;
    };
  };
}

@Injectable()
export class EdnaProfileService {
  // In-memory cache: userId -> EdnaProfileFull
  private profileCache = new Map<string, EdnaProfileFull>();
  
  private readonly baseUrl: string;
  private readonly enabled: boolean;

  constructor(
    private configService: ConfigService,
    private iosBackend: IOSBackendService,
  ) {
    this.baseUrl = this.configService.get<string>('IOS_BACKEND_URL') || 
      'http://192.168.0.221:3000';
    this.enabled = this.configService.get<string>('USE_EDNA_PROFILE') === 'true' ||
      this.configService.get<string>('USE_IOS_EDNA') === 'true';
    
    console.log(`🧬 [EdnaProfile] Service initialized. Enabled: ${this.enabled}`);
  }

  /**
   * Check if E-DNA profile integration is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get cached E-DNA profile for a user (if available)
   */
  getCachedProfile(userId: string): EdnaProfileFull | null {
    return this.profileCache.get(userId) || null;
  }

  /**
   * Set a manual profile for testing (bypasses API)
   */
  setManualProfile(userId: string, profile: EdnaProfileFull): void {
    console.log(`🧬 [EdnaProfile] Setting manual profile for user ${userId}`);
    this.profileCache.set(userId, profile);
  }

  /**
   * Fetch and build E-DNA profile for a user
   * Results are cached in memory
   * Falls back to mock profile for testing when iOS backend is unavailable
   * @param userJwt - JWT token from iOS app for production auth
   */
  async getEdnaProfile(userId: string, forceRefresh: boolean = false, userJwt?: string): Promise<EdnaProfileFull | null> {
    // Check cache first (unless force refresh)
    if (!forceRefresh && this.profileCache.has(userId)) {
      console.log(`🧬 [EdnaProfile] Returning cached profile for user ${userId}`);
      return this.profileCache.get(userId)!;
    }

    try {
      console.log(`🧬 [EdnaProfile] Fetching quiz results for user ${userId}...`);
      
      // Fetch quiz results from iOS backend
      const quizResults = await this.fetchQuizResults(userId, userJwt);
      
      if (!quizResults || !quizResults.hasQuizResults || !quizResults.quizResult) {
        console.log(`⚠️ [EdnaProfile] No quiz results found for user ${userId}, using mock profile for testing`);
        // Fall back to mock profile for testing
        return this.getMockProfile(userId);
      }

      // Convert API response to our EdnaQuizResults format
      const apiResult = quizResults.quizResult;
      const ednaQuizData: EdnaQuizResults = {
        layer1: {
          coreType: apiResult.layer1.coreType,
          strength: apiResult.layer1.strength,
          architectScore: apiResult.layer1.architectScore,
          alchemistScore: apiResult.layer1.alchemistScore,
        },
        layer2: {
          subtype: apiResult.layer2.subtype,
          description: apiResult.layer2.description,
        },
        layer3: {
          integration: apiResult.layer3.integration,
          integrationPercent: apiResult.layer3.integrationPercent,
        },
        layer4: {
          modalityPreference: apiResult.layer4.modalityPreference,
          approach: apiResult.layer4.approach,
          conceptProcessing: apiResult.layer4.conceptProcessing,
          workingEnvironment: apiResult.layer4.workingEnvironment,
          pace: apiResult.layer4.pace,
        },
        layer5: {
          status: apiResult.layer5.status,
          traits: apiResult.layer5.traits,
        },
        layer6: {
          mindset: apiResult.layer6.mindset,
          personality: apiResult.layer6.personality,
          communication: apiResult.layer6.communication,
        },
        layer7: {
          faithOrientation: apiResult.layer7.faithOrientation,
          controlOrientation: apiResult.layer7.controlOrientation,
          fairness: apiResult.layer7.fairness,
          integrity: apiResult.layer7.integrity,
          growth: apiResult.layer7.growth,
          impact: apiResult.layer7.impact,
        },
      };

      // Build full profile with hardcoded trait definitions
      const fullProfile = buildEdnaProfile(
        userId,
        ednaQuizData,
        apiResult.completedAt,
      );

      // Cache the profile
      this.profileCache.set(userId, fullProfile);
      
      console.log(`✅ [EdnaProfile] Built and cached profile for user ${userId}`);
      console.log(`   Core Type: ${fullProfile.layers.layer1.coreType}`);
      console.log(`   Subtype: ${fullProfile.layers.layer2.subtype}`);
      
      return fullProfile;
    } catch (error: any) {
      console.error(`❌ [EdnaProfile] Failed to fetch/build profile for ${userId}:`, error.message);
      console.log(`🧪 [EdnaProfile] Using mock profile for testing...`);
      return this.getMockProfile(userId);
    }
  }

  /**
   * Get mock E-DNA profile for testing when iOS backend is unavailable
   */
  getMockProfile(userId: string): EdnaProfileFull {
    // Check cache first
    const cacheKey = `mock-${userId}`;
    if (this.profileCache.has(cacheKey)) {
      console.log(`🧬 [EdnaProfile] Returning cached mock profile`);
      return this.profileCache.get(cacheKey)!;
    }

    // Build mock quiz results for an Alchemist (to test emotional-first instructions)
    const mockQuizData: EdnaQuizResults = {
      layer1: {
        coreType: 'alchemist',
        strength: 'Strong',
        architectScore: 2,
        alchemistScore: 8,
      },
      layer2: {
        subtype: 'Energetic Empath',
        description: 'Deeply feels and connects with others',
      },
      layer3: {
        integration: 'Medium',
        integrationPercent: 55,
      },
      layer4: {
        modalityPreference: 'Kinesthetic',
        approach: 'Global',
        conceptProcessing: 'Abstract',
        workingEnvironment: 'Collaborative',
        pace: 'Flexible',
      },
      layer5: {
        status: 'Neurotypical',
        traits: { ntScore: 7, ndScore: 2, teScore: 1 },
      },
      layer6: {
        mindset: 'Growth/Abundance',
        personality: 'High Empathy & Moderate Confidence',
        communication: 'Diplomatic Communicator',
      },
      layer7: {
        faithOrientation: 'Faith-Guided',
        controlOrientation: 'Go With Flow',
        fairness: 'Compassion',
        integrity: 'Diplomatic Honesty',
        growth: 'Growth Focused',
        impact: 'Others-Focused Impact',
      },
    };

    const mockProfile = buildEdnaProfile(userId, mockQuizData, new Date().toISOString());
    
    // Cache it
    this.profileCache.set(cacheKey, mockProfile);
    
    console.log(`🧪 [EdnaProfile] Generated mock profile: ${mockProfile.layers.layer1.coreType} - ${mockProfile.layers.layer2.subtype}`);
    
    return mockProfile;
  }

  /**
   * Fetch quiz results from iOS backend API
   * @param userJwt - JWT token from iOS app for production auth
   */
  private async fetchQuizResults(userId: string, userJwt?: string): Promise<QuizResultsResponse | null> {
    try {
      // Use the iOS backend service to make authenticated request
      const response = await this.iosBackend.getUserQuizResults(userId, userJwt);
      return response as QuizResultsResponse;
    } catch (error: any) {
      console.error(`❌ [EdnaProfile] API error:`, error.message);
      return null;
    }
  }

  /**
   * Clear cached profile for a user (e.g., when they retake quiz)
   */
  clearCache(userId: string): void {
    this.profileCache.delete(userId);
    console.log(`🧹 [EdnaProfile] Cleared cache for user ${userId}`);
  }

  /**
   * Clear all cached profiles
   */
  clearAllCache(): void {
    this.profileCache.clear();
    console.log(`🧹 [EdnaProfile] Cleared all profile cache`);
  }

  /**
   * Get profile summary for advice generator (condensed version)
   * This returns DESCRIPTIONS of who the person is
   */
  getProfileSummaryForAdvice(profile: EdnaProfileFull): string {
    if (!profile) return '';

    const l1 = profile.layers.layer1;
    const l2 = profile.layers.layer2;
    const l3 = profile.layers.layer3;
    const l4 = profile.layers.layer4;
    const l5 = profile.layers.layer5;
    const l6 = profile.layers.layer6;
    const l7 = profile.layers.layer7;

    const parts = [
      `E-DNA PROFILE (who this person fundamentally is):`,
      ``,
      `LAYER 1 - CORE TYPE: ${l1.coreType} (${l1.strength})`,
      l1.description,
      `Decision Style: ${l1.decisionStyle}`,
      `Strengths: ${l1.strengthAreas.join(', ')}`,
      `Blind Spots: ${l1.blindSpots.join(', ')}`,
      ``,
      `LAYER 2 - SUBTYPE: ${l2.subtype}`,
      l2.description,
      `Their approach: ${l2.approach}`,
      `Subtype Strengths: ${l2.strengths.join(', ')}`,
      `Subtype Challenges: ${l2.challenges.join(', ')}`,
      ``,
      `LAYER 3 - INTEGRATION LEVEL: ${l3.level} (${l3.integrationPercent}%)`,
      l3.description,
      `Meaning: ${l3.meaning}`,
      `Recommendation: ${l3.recommendation}`,
      ``,
      `LAYER 4 - LEARNING/WORKING STYLE:`,
      `- Modality: ${l4.modalityDescription}`,
      `- Approach: ${l4.approachDescription}`,
      `- Concept Processing: ${l4.conceptDescription}`,
      `- Environment: ${l4.environmentDescription}`,
      `- Pace: ${l4.paceDescription}`,
      ``,
      `LAYER 5 - NEUROTYPE STATUS: ${l5.status}`,
      l5.description,
      `Neurotype Strengths: ${l5.strengths.join(', ')}`,
      `Considerations: ${l5.considerations.join(', ')}`,
      ``,
      `LAYER 6 - MINDSET & COMMUNICATION:`,
      `- Mindset: ${l6.mindsetDescription}`,
      `- Personality: ${l6.personalityDescription}`,
      `- Communication: ${l6.communicationDescription}`,
      ``,
      `LAYER 7 - CORE VALUES:`,
      `- Faith: ${l7.faithDescription}`,
      `- Control: ${l7.controlDescription}`,
      `- Fairness: ${l7.fairnessDescription}`,
      `- Integrity: ${l7.integrityDescription}`,
      `- Growth: ${l7.growthDescription}`,
      `- Impact: ${l7.impactDescription}`,
    ];

    return parts.join('\n');
  }

  /**
   * Get INSTRUCTIONS for advice generator (how to communicate with this person)
   * This returns actionable instructions, NOT descriptions
   * Uses hardcoded instructions looked up by each quiz answer
   */
  getInstructionsForAdvice(profile: EdnaProfileFull): string {
    if (!profile) return '';

    // Build quiz results format from profile
    // The hardcoded instructions are looked up by each answer value
    const quizData: QuizResultsForInstructions = {
      layer1: {
        coreType: profile.layers.layer1.coreType,
      },
      layer2: {
        subtype: profile.layers.layer2.subtype,
      },
      layer3: {
        integration: profile.layers.layer3.level.replace(' Integration', ''),
      },
      layer4: {
        modalityPreference: profile.layers.layer4.modality,
        approach: profile.layers.layer4.approach,
        conceptProcessing: profile.layers.layer4.conceptProcessing,
        workingEnvironment: profile.layers.layer4.environment,
        pace: profile.layers.layer4.pace,
      },
      layer5: {
        status: profile.layers.layer5.status,
      },
      layer6: {
        mindset: profile.layers.layer6.mindset,
        personality: profile.layers.layer6.personality,
        communication: profile.layers.layer6.communication,
      },
      layer7: {
        faithOrientation: profile.layers.layer7.faithOrientation,
        controlOrientation: profile.layers.layer7.controlOrientation,
        fairness: profile.layers.layer7.fairness,
        integrity: profile.layers.layer7.integrity,
        growth: profile.layers.layer7.growth,
        impact: profile.layers.layer7.impact,
      },
    };

    // Look up hardcoded instruction for each answer and combine
    return buildInstructionsFromQuizResults(quizData);
  }
}
