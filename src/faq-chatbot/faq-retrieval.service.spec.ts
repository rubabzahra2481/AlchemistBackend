import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FaqRetrievalService } from './faq-retrieval.service';
import type { FaqEntry } from './types/faq-knowledge.types';

function loadFaqs(): FaqEntry[] {
  const candidates = [
    join(process.cwd(), 'faq-chatbot-knowledge', 'faqs.json'),
    join(process.cwd(), 'backend', 'faq-chatbot-knowledge', 'faqs.json'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      const j = JSON.parse(readFileSync(p, 'utf-8'));
      return j.faqs as FaqEntry[];
    }
  }
  throw new Error('faqs.json not found for tests (run from backend/)');
}

function loadMatrix(): {
  retrievalTopK: number;
  retrievalChecks: { id: string; message: string; anyOfIds: string[] }[];
} {
  const candidates = [
    join(process.cwd(), 'faq-chatbot-knowledge', 'production-test-matrix.json'),
    join(process.cwd(), 'backend', 'faq-chatbot-knowledge', 'production-test-matrix.json'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      return JSON.parse(readFileSync(p, 'utf-8'));
    }
  }
  throw new Error('production-test-matrix.json not found');
}

describe('FaqRetrievalService', () => {
  let service: FaqRetrievalService;
  let faqs: FaqEntry[];

  beforeAll(async () => {
    faqs = loadFaqs();
    const moduleRef = await Test.createTestingModule({
      providers: [
        FaqRetrievalService,
        { provide: ConfigService, useValue: { get: () => undefined } },
      ],
    }).compile();
    service = moduleRef.get(FaqRetrievalService);
  });

  it('returns first K when user message has no scorable tokens', () => {
    const r = service.retrieve('???', faqs, 3);
    expect(r).toHaveLength(Math.min(3, faqs.length));
    expect(r.every((x) => x.score === 0)).toBe(true);
  });

  it('ranks reset-password high for password-related query', () => {
    const r = service.retrieve('I need to reset my password', faqs, 8);
    const ids = r.map((x) => x.stableId);
    expect(ids).toContain('reset-password');
    expect(r[0].stableId).toBe('reset-password');
  });

  it('respects topK cap', () => {
    const r = service.retrieve('credits subscription password support', faqs, 4);
    expect(r.length).toBeLessThanOrEqual(4);
  });

  describe('production-test-matrix retrievalChecks', () => {
    const matrix = loadMatrix();

    it.each(
      matrix.retrievalChecks.map((c) => [c.id, c.message, c.anyOfIds] as const),
    )('retrieval %s', (_id, message, anyOfIds) => {
      const topK = matrix.retrievalTopK || 8;
      const r = service.retrieve(message, faqs, topK);
      const ids = new Set(r.map((x) => x.stableId));
      const hit = anyOfIds.some((id) => ids.has(id));
      expect(hit).toBe(true);
    });
  });
});
