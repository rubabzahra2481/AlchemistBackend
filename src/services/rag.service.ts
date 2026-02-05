import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * RAG Service - DISABLED
 * 
 * ChromaDB and better-sqlite3 removed to fix App Runner deployment.
 * This service now returns fallback responses.
 * 
 * If you need RAG functionality in the future, consider:
 * - Using a cloud-hosted vector database (Pinecone, Weaviate, etc.)
 * - Using OpenAI's embedding API with a managed database
 */
@Injectable()
export class RagService {
  private isInitialized = false;

  constructor(private configService: ConfigService) {
    console.log('📚 [RagService] Running in fallback mode (no vector DB)');
  }

  /**
   * Search knowledge base - returns empty in fallback mode
   */
  async searchKnowledge(query: string, limit: number = 3): Promise<string[]> {
    return [];
  }

  /**
   * Get context for a topic - returns empty in fallback mode
   */
  async getContextForTopic(topic: string): Promise<string> {
    return '';
  }

  /**
   * Check if RAG is available
   */
  isAvailable(): boolean {
    return this.isInitialized;
  }
}
