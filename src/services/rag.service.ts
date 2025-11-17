import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChromaClient, Collection } from 'chromadb';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class RagService implements OnModuleInit {
  private client: ChromaClient;
  private collection: Collection;
  private openai: OpenAI;
  private isInitialized = false;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }

    // Initialize ChromaDB (may fail if not installed)
    try {
      this.client = new ChromaClient();
    } catch (error) {
      console.log('ChromaDB not available, using fallback understanding');
      this.isInitialized = false;
    }
  }

  async onModuleInit() {
    try {
      await this.initializeKnowledgeBase();
    } catch (error) {
      console.error('Failed to initialize RAG knowledge base:', error);
      console.error('RAG will use fallback mode without KB search');
      this.isInitialized = false;
    }
  }

  /**
   * Initialize and embed KB files into vector database
   */
  private async initializeKnowledgeBase() {
    if (!this.client) {
      console.log('ChromaDB client not available, skipping KB initialization');
      this.isInitialized = false;
      return;
    }

    try {
      // Create or get collection
      try {
        this.collection = await this.client.getOrCreateCollection({
          name: 'psychology_knowledge_base',
          metadata: { description: 'Validated psychological constructs and research' },
        });
      } catch {
        this.collection = await this.client.createCollection({
          name: 'psychology_knowledge_base',
          metadata: { description: 'Validated psychological constructs and research' },
        });
      }

      // Check if already embedded
      const count = await this.collection.count();
      if (count > 0) {
        console.log(`Knowledge base already initialized with ${count} chunks`);
        this.isInitialized = true;
        return;
      }

      // Embed KB files
      await this.embedKBFiles();
      this.isInitialized = true;
      console.log('✅ Knowledge base initialized successfully');
    } catch (error) {
      console.error('Error initializing knowledge base:', error);
    }
  }

  /**
   * Embed all KB files into vector database
   */
  private async embedKBFiles() {
    const kbPath = path.join(process.cwd(), 'KB');

    if (!fs.existsSync(kbPath)) {
      console.log('KB folder not found, skipping embedding');
      return;
    }

    const files = fs.readdirSync(kbPath).filter((f) => f.endsWith('.txt'));

    for (const file of files) {
      const filePath = path.join(kbPath, file);
      const content = fs.readFileSync(filePath, 'utf-8');

      // Chunk the content
      const chunks = this.chunkText(content, file);

      // Embed chunks
      if (chunks.length > 0 && this.openai) {
        await this.embedChunks(chunks, file);
      }
    }
  }

  /**
   * Chunk text into semantic sections
   */
  private chunkText(content: string, source: string): Array<{ text: string; metadata: any }> {
    const chunks: Array<{ text: string; metadata: any }> = [];

    // Split by section markers
    const sections = content.split(/={50,}/);

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i].trim();
      if (section.length < 50) continue; // Skip too short sections

      // Further split long sections into paragraphs
      if (section.length > 2000) {
        const paragraphs = section.split(/\n\n+/);
        let currentChunk = '';

        for (const para of paragraphs) {
          if ((currentChunk + para).length > 1500) {
            if (currentChunk) {
              chunks.push({
                text: currentChunk.trim(),
                metadata: { source, section: i, type: 'paragraph_group' },
              });
            }
            currentChunk = para;
          } else {
            currentChunk += '\n\n' + para;
          }
        }

        if (currentChunk) {
          chunks.push({
            text: currentChunk.trim(),
            metadata: { source, section: i, type: 'paragraph_group' },
          });
        }
      } else {
        chunks.push({
          text: section,
          metadata: { source, section: i, type: 'section' },
        });
      }
    }

    return chunks;
  }

  /**
   * Embed chunks and store in vector DB
   */
  private async embedChunks(chunks: Array<{ text: string; metadata: any }>, source: string) {
    const batchSize = 10;

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);

      try {
        // Generate embeddings
        const response = await this.openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: batch.map((c) => c.text),
        });

        // Store in ChromaDB
        await this.collection.add({
          ids: batch.map((_, idx) => `${source}_chunk_${i + idx}`),
          documents: batch.map((c) => c.text),
          metadatas: batch.map((c) => c.metadata),
          embeddings: response.data.map((e) => e.embedding),
        });

        console.log(`Embedded ${batch.length} chunks from ${source}`);
      } catch (error) {
        console.error(`Error embedding batch from ${source}:`, error);
      }
    }
  }

  /**
   * Search knowledge base for relevant context (SILENT - for agent's understanding)
   */
  async searchKnowledge(query: string, topK: number = 3): Promise<string[]> {
    if (!this.isInitialized || !this.openai) {
      return [];
    }

    try {
      // Generate query embedding
      const queryEmbedding = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: query,
      });

      // Search vector DB
      const results = await this.collection.query({
        queryEmbeddings: [queryEmbedding.data[0].embedding],
        nResults: topK,
      });

      return (results.documents[0] || []).filter((doc): doc is string => doc !== null);
    } catch (error) {
      console.error('Error searching knowledge base:', error);
      return [];
    }
  }

  /**
   * Get psychological understanding from conversation
   * This is INTERNAL - never shown to user
   */
  async getDeepUnderstanding(
    conversationHistory: string,
    currentMessage: string,
  ): Promise<{
    personality: any;
    mentalState: any;
    selfConcept: any;
    interpersonalStyle: any;
    coreNeeds: string[];
    bestApproach: string;
  }> {
    if (!this.isInitialized || !this.openai) {
      console.log('Using fallback understanding (RAG not initialized)');
      return this.getFallbackUnderstanding(currentMessage);
    }

    const fullContext = `${conversationHistory}\n\nCurrent: ${currentMessage}`;

    // Search for relevant psychological patterns
    const [personalityContext, mentalHealthContext, selfEsteemContext, interpersonalContext] =
      await Promise.all([
        this.searchKnowledge(`Big Five personality patterns: ${fullContext}`, 2),
        this.searchKnowledge(`DASS depression anxiety stress patterns: ${fullContext}`, 2),
        this.searchKnowledge(`Self-esteem RSE patterns: ${fullContext}`, 2),
        this.searchKnowledge(`Dark Triad interpersonal patterns: ${fullContext}`, 2),
      ]);

    // Build understanding (GPT analyzes silently)
    const understanding = await this.analyzeWithContext(currentMessage, {
      personality: personalityContext,
      mentalHealth: mentalHealthContext,
      selfEsteem: selfEsteemContext,
      interpersonal: interpersonalContext,
    });

    return understanding;
  }

  /**
   * Analyze conversation with psychological context (INTERNAL)
   */
  private async analyzeWithContext(
    message: string,
    contexts: {
      personality: string[];
      mentalHealth: string[];
      selfEsteem: string[];
      interpersonal: string[];
    },
  ): Promise<any> {
    if (!this.openai) {
      return this.getFallbackUnderstanding(message);
    }

    try {
      const prompt = `You are a psychologist analyzing a person's message to understand them deeply.

PSYCHOLOGICAL RESEARCH CONTEXT:

PERSONALITY (Big Five):
${contexts.personality.join('\n\n')}

MENTAL HEALTH (DASS):
${contexts.mentalHealth.join('\n\n')}

SELF-ESTEEM (RSE):
${contexts.selfEsteem.join('\n\n')}

INTERPERSONAL STYLE (Dark Triad):
${contexts.interpersonal.join('\n\n')}

USER'S MESSAGE: "${message}"

Analyze this person SILENTLY (this is internal analysis, not shown to user).

Return JSON only:
{
  "personality": {
    "openness": "low|moderate|high",
    "conscientiousness": "low|moderate|high",
    "extraversion": "low|moderate|high",
    "agreeableness": "low|moderate|high",
    "neuroticism": "low|moderate|high",
    "confidence": "low|medium|high"
  },
  "mentalState": {
    "depression": "none|mild|moderate|severe",
    "anxiety": "none|mild|moderate|severe",
    "stress": "none|mild|moderate|severe",
    "indicators": ["specific signs seen"]
  },
  "selfEsteem": {
    "level": "low|moderate|high",
    "specificConcerns": ["e.g., feels like failure"]
  },
  "interpersonalStyle": {
    "machiavellianism": "low|moderate|high",
    "narcissism": "low|moderate|high",
    "psychopathy": "low|moderate|high"
  },
  "coreNeeds": ["primary needs: direction, connection, stress relief, etc."],
  "bestApproach": "How to advise them: direct/gentle, structured/flexible, etc."
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content;
      return content ? JSON.parse(content) : this.getFallbackUnderstanding(message);
    } catch (error) {
      console.error('Error analyzing with context:', error);
      return this.getFallbackUnderstanding(message);
    }
  }

  /**
   * Fallback understanding without RAG (smarter pattern detection)
   */
  private getFallbackUnderstanding(message: string): any {
    const lower = message.toLowerCase();

    // Detect personality patterns
    const personality = {
      openness: this.detectOpenness(lower),
      conscientiousness: this.detectConscientiousness(lower),
      extraversion: this.detectExtraversion(lower),
      agreeableness: this.detectAgreeableness(lower),
      neuroticism: this.detectNeuroticism(lower),
      confidence: 'medium' as const,
    };

    // Detect mental state
    const mentalState = {
      depression: this.detectDepression(lower),
      anxiety: this.detectAnxiety(lower),
      stress: this.detectStress(lower),
      indicators: this.getIndicators(lower),
    };

    // Detect self-esteem
    const selfConcept = {
      level: this.detectSelfEsteem(lower),
      specificConcerns: this.getSelfEsteemConcerns(lower),
    };

    // Detect interpersonal style
    const interpersonalStyle = {
      machiavellianism: 'low' as const,
      narcissism: 'low' as const,
      psychopathy: 'low' as const,
    };

    // Identify core needs
    const coreNeeds = this.identifyCoreNeeds(lower, mentalState, selfConcept);

    // Determine best approach
    const bestApproach = this.determineBestApproach(mentalState, selfConcept, personality);

    return {
      personality,
      mentalState,
      selfConcept,
      interpersonalStyle,
      coreNeeds,
      bestApproach,
    };
  }

  // Personality detection methods
  private detectOpenness(message: string): 'low' | 'moderate' | 'high' {
    if (message.match(/creative|curious|new ideas|imagination|abstract/)) return 'high';
    if (message.match(/routine|traditional|practical|conventional/)) return 'low';
    return 'moderate';
  }

  private detectConscientiousness(message: string): 'low' | 'moderate' | 'high' {
    if (message.match(/organized|plan|prepared|detail|schedule|perfect/)) return 'high';
    if (message.match(/procrastinat|mess|forget|late|disorganized/)) return 'low';
    return 'moderate';
  }

  private detectExtraversion(message: string): 'low' | 'moderate' | 'high' {
    if (message.match(/party|social|friends|people|outgoing|talk/)) return 'high';
    if (message.match(/alone|solitude|quiet|introvert|prefer.*alone|people.*exhaust/)) return 'low';
    return 'moderate';
  }

  private detectAgreeableness(message: string): 'low' | 'moderate' | 'high' {
    if (message.match(/help.*others|empathy|care.*about|sympathy/)) return 'high';
    if (message.match(/people.*annoying|don't care|selfish/)) return 'low';
    return 'moderate';
  }

  private detectNeuroticism(message: string): 'low' | 'moderate' | 'high' {
    if (message.match(/stress|worry|anxious|nervous|upset|mood.*swing/)) return 'high';
    if (message.match(/calm|relaxed|stable|don't worry/)) return 'low';
    return 'moderate';
  }

  // Mental state detection
  private detectDepression(message: string): 'none' | 'mild' | 'moderate' | 'severe' {
    const indicators = [
      /nothing.*matters/,
      /empty|hollow|numb/,
      /hopeless|no.*point/,
      /can't.*feel/,
      /don't.*care.*anymore/,
      /just.*exist/,
    ];

    const matches = indicators.filter((pattern) => pattern.test(message)).length;
    if (matches >= 3) return 'severe';
    if (matches >= 2) return 'moderate';
    if (matches >= 1 || message.match(/sad|down|depressed/)) return 'mild';
    return 'none';
  }

  private detectAnxiety(message: string): 'none' | 'mild' | 'moderate' | 'severe' {
    const count = (message.match(/worry|anxious|nervous|panic|scared|afraid/g) || []).length;
    if (count >= 3) return 'severe';
    if (count >= 2) return 'moderate';
    if (count >= 1) return 'mild';
    return 'none';
  }

  private detectStress(message: string): 'none' | 'mild' | 'moderate' | 'severe' {
    if (message.match(/burnout|can't.*take|breaking.*point/)) return 'severe';
    if (message.match(/overwhelm|too.*much|pressure/)) return 'moderate';
    if (message.match(/stress|busy|hectic/)) return 'mild';
    return 'none';
  }

  private getIndicators(message: string): string[] {
    const indicators: string[] = [];
    if (message.match(/can't.*sleep/)) indicators.push('sleep disturbance');
    if (message.match(/tired|exhausted|fatigue/)) indicators.push('fatigue');
    if (message.match(/irritable|snap|angry/)) indicators.push('irritability');
    if (message.match(/alone|lonely|isolated/)) indicators.push('social withdrawal');
    return indicators;
  }

  // Self-esteem detection
  private detectSelfEsteem(message: string): 'low' | 'moderate' | 'high' {
    const lowIndicators = [
      /failure|failed/,
      /useless|worthless/,
      /not.*good.*enough/,
      /can't.*do.*anything/,
      /hate.*myself/,
      /no.*good.*at/,
    ];

    const matches = lowIndicators.filter((pattern) => pattern.test(message)).length;
    if (matches >= 2) return 'low';
    if (matches >= 1) return 'moderate';

    if (message.match(/confident|proud|capable|good.*at/)) return 'high';
    return 'moderate';
  }

  private getSelfEsteemConcerns(message: string): string[] {
    const concerns: string[] = [];
    if (message.match(/failure/)) concerns.push('feels like a failure');
    if (message.match(/useless/)) concerns.push('feels useless');
    if (message.match(/not.*good/)) concerns.push('feels inadequate');
    return concerns;
  }

  // Core needs identification
  private identifyCoreNeeds(message: string, mentalState: any, selfConcept: any): string[] {
    const needs: string[] = [];

    // Based on mental state
    if (mentalState.stress !== 'none') needs.push('stress relief');
    if (mentalState.depression !== 'none') needs.push('hope and meaning');
    if (mentalState.anxiety !== 'none') needs.push('calming and safety');

    // Based on self-esteem
    if (selfConcept.level === 'low') needs.push('validation and self-compassion');

    // Based on message content
    if (message.match(/stuck|don't know|confused/)) needs.push('clarity and direction');
    if (message.match(/alone|lonely|friends/)) needs.push('connection');
    if (message.match(/career|job|work/)) needs.push('career guidance');
    if (message.match(/should I|what do I/)) needs.push('decision support');

    return needs.length > 0 ? needs : ['support'];
  }

  // Best approach determination
  private determineBestApproach(mentalState: any, selfConcept: any, personality: any): string {
    const approaches: string[] = [];

    if (mentalState.depression === 'severe' || mentalState.depression === 'moderate') {
      approaches.push('gentle and validating');
    }
    if (selfConcept.level === 'low') {
      approaches.push('build confidence with small wins');
    }
    if (personality.neuroticism === 'high') {
      approaches.push('calming and reassuring');
    }
    if (personality.conscientiousness === 'high') {
      approaches.push('structured and specific');
    }
    if (personality.extraversion === 'low') {
      approaches.push('respect need for solitude');
    }

    return approaches.length > 0 ? approaches.join(', ') : 'empathetic and practical';
  }
}
