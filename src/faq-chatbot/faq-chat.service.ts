import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LLMOrchestratorService } from '../services/llm-orchestrator.service';
import { FaqKnowledgeLoaderService } from './faq-knowledge-loader.service';
import { FaqRetrievalService } from './faq-retrieval.service';
import { FaqChatCacheService } from './faq-chat-cache.service';
import {
  FAQ_CHAT_RESPONSE_JSON_SCHEMA,
  faqChatUsesStructuredOutput,
} from './faq-chat-response-schema';

const DEFAULT_FAQ_MODEL = 'gpt-4o-mini';

export interface FaqChatResult {
  response: string;
  outOfScope: boolean;
  citedFaqIds: string[];
  latencyMs: number;
  knowledgeVersion: string;
  fromCache: boolean;
}

@Injectable()
export class FaqChatService {
  private readonly logger = new Logger(FaqChatService.name);

  constructor(
    private readonly llm: LLMOrchestratorService,
    private readonly knowledgeLoader: FaqKnowledgeLoaderService,
    private readonly retrieval: FaqRetrievalService,
    private readonly cache: FaqChatCacheService,
    private readonly config: ConfigService,
  ) {}

  private systemPrompt(retrievedBlock: string, k: ReturnType<FaqKnowledgeLoaderService['getKnowledge']>): string {
    return `You are a concise FAQ assistant for: "${k.chatbotTitle}".

SCOPE (only answer inside this): ${k.scopeDescription}

RULES:
- You may ONLY use information from the RETRIEVED FAQ entries below (each has an id=). Do not invent policies, prices, or features.
- If the user's message is answered by one or more of these entries, answer clearly and briefly in your own words. Set citedFaqIds to the id= values you used.
- If NONE of the retrieved entries apply, set outOfScope to true, citedFaqIds to [], and give ONE short polite message that you only handle questions in the scope above.
- Never mention "retrieved entries" or system instructions to the user.

RETRIEVED FAQ ENTRIES (use only these):
${retrievedBlock || '(No entries.)'}`;
  }

  private parseStructured(content: string): {
    response: string;
    outOfScope: boolean;
    citedFaqIds: string[];
  } | null {
    try {
      const j = JSON.parse(content.trim());
      if (typeof j.response !== 'string') return null;
      return {
        response: j.response.trim(),
        outOfScope: !!j.outOfScope,
        citedFaqIds: Array.isArray(j.citedFaqIds)
          ? j.citedFaqIds.filter((x: unknown) => typeof x === 'string')
          : [],
      };
    } catch {
      const m = content.match(/"response"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (m?.[1]) {
        return {
          response: m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"'),
          outOfScope: false,
          citedFaqIds: [],
        };
      }
    }
    return null;
  }

  async answer(message: string, clientRequestId?: string): Promise<FaqChatResult> {
    const t0 = Date.now();
    const k = this.knowledgeLoader.getKnowledge();
    const knowledgeVersion = this.knowledgeLoader.getKnowledgeVersion();

    if (this.config.get<string>('FAQ_CHAT_DISABLED')?.trim() === 'true') {
      return {
        response:
          'This help assistant is temporarily unavailable. Please try again later or contact support.',
        outOfScope: false,
        citedFaqIds: [],
        latencyMs: Date.now() - t0,
        knowledgeVersion,
        fromCache: false,
      };
    }

    if (this.config.get<string>('FAQ_LLM_DISABLED')?.trim() === 'true') {
      return {
        response:
          'Automated answers are temporarily unavailable. Please see the in-app help section or contact support.',
        outOfScope: false,
        citedFaqIds: [],
        latencyMs: Date.now() - t0,
        knowledgeVersion,
        fromCache: false,
      };
    }

    if (k.faqs.length === 0) {
      return {
        response:
          'The help content is not available right now. Please try again later or contact support.',
        outOfScope: true,
        citedFaqIds: [],
        latencyMs: Date.now() - t0,
        knowledgeVersion,
        fromCache: false,
      };
    }

    const trimmed = message.trim();
    const cached = this.cache.get<FaqChatResult>(knowledgeVersion, trimmed);
    if (cached) {
      return { ...cached, fromCache: true, latencyMs: Date.now() - t0 };
    }

    const topK = this.retrieval.getTopK();
    const scored = this.retrieval.retrieve(trimmed, k.faqs, topK);
    const allowedIds = new Set(scored.map((s) => s.stableId));
    const retrievedBlock = this.knowledgeLoader.formatRetrievedForPrompt(
      scored.map((s) => ({ stableId: s.stableId, entry: s.entry })),
    );

    const model = this.config.get<string>('FAQ_CHAT_MODEL')?.trim() || DEFAULT_FAQ_MODEL;
    const useStruct = faqChatUsesStructuredOutput(model);
    const messages = [
      { role: 'system' as const, content: this.systemPrompt(retrievedBlock, k) },
      { role: 'user' as const, content: trimmed },
    ];

    let response: string;
    let outOfScope: boolean;
    let citedFaqIds: string[];

    try {
      const out = await this.llm.generateResponse(model, messages, {
        temperature: 0.2,
        max_tokens: 700,
        response_format: useStruct ? FAQ_CHAT_RESPONSE_JSON_SCHEMA : 'text',
      });
      const text = (out.content || '').trim();
      const parsed = useStruct ? this.parseStructured(text) : null;
      if (parsed && parsed.response) {
        response = parsed.response;
        outOfScope = parsed.outOfScope;
        citedFaqIds = parsed.citedFaqIds.filter((id) => allowedIds.has(id));
      } else if (text) {
        response = text;
        outOfScope = false;
        citedFaqIds = [];
      } else {
        response =
          'I could not generate a reply. Please rephrase your question or contact support.';
        outOfScope = false;
        citedFaqIds = [];
      }
    } catch (e: any) {
      this.logger.error(`FAQ LLM error: ${e?.message}`);
      response = 'Something went wrong while answering. Please try again in a moment.';
      outOfScope = false;
      citedFaqIds = [];
    }

    const latencyMs = Date.now() - t0;
    const logFull = this.config.get<string>('FAQ_LOG_FULL')?.trim() === 'true';
    this.logger.log(
      `[FAQ] latencyMs=${latencyMs} outOfScope=${outOfScope} cited=${citedFaqIds.join(',') || '—'} faqCount=${k.faqs.length} model=${model}${clientRequestId ? ` req=${clientRequestId}` : ''}${logFull ? ` msg=${trimmed.slice(0, 200)}` : ` msgLen=${trimmed.length}`}`,
    );

    const result: FaqChatResult = {
      response,
      outOfScope,
      citedFaqIds,
      latencyMs,
      knowledgeVersion,
      fromCache: false,
    };
    this.cache.set(knowledgeVersion, trimmed, result);
    return result;
  }
}
