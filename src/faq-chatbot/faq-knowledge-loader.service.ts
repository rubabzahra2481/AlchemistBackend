import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import type { FaqEntry, FaqKnowledgeFile } from './types/faq-knowledge.types';

@Injectable()
export class FaqKnowledgeLoaderService implements OnModuleInit {
  private readonly logger = new Logger(FaqKnowledgeLoaderService.name);
  private knowledge: FaqKnowledgeFile | null = null;
  private loadedPath: string | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.reload();
  }

  /** Resolve path: FAQ_KNOWLEDGE_PATH env, then cwd/faq-chatbot-knowledge/faqs.json, then cwd/backend/... */
  resolvePath(): string {
    const fromEnv = this.config.get<string>('FAQ_KNOWLEDGE_PATH')?.trim();
    if (fromEnv) return resolve(fromEnv);

    const candidates = [
      join(process.cwd(), 'faq-chatbot-knowledge', 'faqs.json'),
      join(process.cwd(), 'backend', 'faq-chatbot-knowledge', 'faqs.json'),
      join(process.cwd(), 'dist', 'faq-chatbot-knowledge', 'faqs.json'),
    ];
    for (const p of candidates) {
      if (existsSync(p)) return p;
    }
    return candidates[0];
  }

  reload(): void {
    const path = this.resolvePath();
    this.loadedPath = path;
    if (!existsSync(path)) {
      this.logger.error(`FAQ knowledge file not found: ${path}`);
      this.knowledge = {
        version: '0',
        chatbotTitle: 'FAQ Assistant',
        scopeDescription: 'No knowledge file loaded.',
        faqs: [],
      };
      return;
    }
    try {
      const raw = readFileSync(path, 'utf-8');
      const parsed = JSON.parse(raw) as FaqKnowledgeFile;
      if (!parsed.chatbotTitle || !parsed.scopeDescription || !Array.isArray(parsed.faqs)) {
        throw new Error('Invalid faqs.json: need chatbotTitle, scopeDescription, faqs[]');
      }
      for (const f of parsed.faqs) {
        if (!f.question?.trim() || !f.answer?.trim()) {
          throw new Error('Each FAQ needs non-empty question and answer');
        }
      }
      if (!parsed.version?.trim()) {
        parsed.version = '1';
      }
      this.knowledge = parsed;
      this.logger.log(`Loaded ${parsed.faqs.length} FAQs (v${parsed.version}) from ${path}`);
    } catch (e: any) {
      this.logger.error(`Failed to load FAQ file ${path}: ${e?.message}`);
      this.knowledge = {
        version: '0',
        chatbotTitle: 'FAQ Assistant',
        scopeDescription: 'Knowledge file failed to load.',
        faqs: [],
      };
    }
  }

  getKnowledge(): FaqKnowledgeFile {
    return (
      this.knowledge || {
        version: '0',
        chatbotTitle: 'FAQ Assistant',
        scopeDescription: 'No knowledge loaded.',
        faqs: [],
      }
    );
  }

  getLoadedPath(): string | null {
    return this.loadedPath;
  }

  /** Plain-text block injected into the LLM system prompt */
  formatFaqsForPrompt(): string {
    const k = this.getKnowledge();
    return k.faqs
      .map((f, i) => {
        const cat = f.category ? ` [${f.category}]` : '';
        return `${i + 1}.${cat}\nQ: ${f.question}\nA: ${f.answer}`;
      })
      .join('\n\n');
  }

  /** Subset for retrieval: each entry must show id for citations */
  formatRetrievedForPrompt(items: { stableId: string; entry: FaqEntry }[]): string {
    return items
      .map(({ stableId, entry }) => {
        const cat = entry.category ? ` category="${entry.category}"` : '';
        return `FAQ id="${stableId}"${cat}\nQ: ${entry.question}\nA: ${entry.answer}`;
      })
      .join('\n\n');
  }

  getKnowledgeVersion(): string {
    return this.getKnowledge().version?.trim() || '1';
  }
}
