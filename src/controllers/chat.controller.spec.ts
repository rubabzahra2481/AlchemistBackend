import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'express';
import { ChatController } from './chat.controller';
import { ChatService } from '../services/chat.service';
import { CreditService } from '../services/credit.service';
import { EdnaProfileService } from '../services/edna-profile.service';
import { ParallelLLMService } from '../services/parallel-llm.service';

describe('ChatController', () => {
  let controller: ChatController;
  let chatService: jest.Mocked<ChatService>;

  const mockChatService = {
    processMessage: jest.fn(),
    processMessageWithStreaming: jest.fn(),
    processMessageStream: jest.fn(),
  };

  const mockCreditService = {};
  const mockEdnaProfileService = {};
  const mockParallelLLMService = {};

  function createMockRes(): Partial<Response> {
    return {
      setHeader: jest.fn().mockReturnThis(),
      write: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
    } as Partial<Response>;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        { provide: ChatService, useValue: mockChatService },
        { provide: CreditService, useValue: mockCreditService },
        { provide: EdnaProfileService, useValue: mockEdnaProfileService },
        { provide: ParallelLLMService, useValue: mockParallelLLMService },
      ],
    }).compile();

    controller = module.get<ChatController>(ChatController);
    chatService = module.get(ChatService) as jest.Mocked<ChatService>;

    (chatService.processMessage as jest.Mock).mockResolvedValue({
      response: 'ok',
      sessionId: 'test-session',
      analysis: {} as any,
      recommendations: [],
    });
  });

  describe('decision mode on by default', () => {
    it.only('should pass decisionIntelligenceMode=true when field is omitted (non-streaming)', async () => {
      const res = createMockRes() as Response;
      const body = {
        message: 'hello',
        stream: false,
        // decisionIntelligenceMode omitted
      };

      await controller.chat(body as any, res);

      expect(chatService.processMessage).toHaveBeenCalledTimes(1);
      expect(chatService.processMessage).toHaveBeenCalledWith(
        'hello',
        expect.any(String),
        expect.any(String),
        expect.any(String),
        undefined,
        true, // default ON
      );
    });

    it('should pass decisionIntelligenceMode=true when field is explicitly true (non-streaming)', async () => {
      const res = createMockRes() as Response;
      const body = {
        message: 'hello',
        stream: false,
        decisionIntelligenceMode: true,
      };

      await controller.chat(body as any, res);

      expect(chatService.processMessage).toHaveBeenCalledWith(
        'hello',
        expect.any(String),
        expect.any(String),
        expect.any(String),
        undefined,
        true,
      );
    });

    it('should pass decisionIntelligenceMode=false only when field is explicitly false (non-streaming)', async () => {
      const res = createMockRes() as Response;
      const body = {
        message: 'hello',
        stream: false,
        decisionIntelligenceMode: false,
      };

      await controller.chat(body as any, res);

      expect(chatService.processMessage).toHaveBeenCalledWith(
        'hello',
        expect.any(String),
        expect.any(String),
        expect.any(String),
        undefined,
        false,
      );
    });

    it('should pass decisionIntelligenceMode=true when field is omitted (streaming)', async () => {
      const res = createMockRes() as Response;
      const body = {
        message: 'hello',
        stream: true,
        // decisionIntelligenceMode omitted
      };

      (chatService.processMessageWithStreaming as jest.Mock).mockImplementation(async function* () {
        yield { type: 'done', data: {} };
      });

      await controller.chat(body as any, res);

      expect(chatService.processMessageWithStreaming).toHaveBeenCalledTimes(1);
      expect(chatService.processMessageWithStreaming).toHaveBeenCalledWith(
        'hello',
        expect.any(String),
        expect.any(String),
        expect.any(String),
        undefined,
        true, // default ON
      );
    });

    it('should pass decisionIntelligenceMode=false when explicitly false (streaming)', async () => {
      const res = createMockRes() as Response;
      const body = {
        message: 'hello',
        stream: true,
        decisionIntelligenceMode: false,
      };

      (chatService.processMessageWithStreaming as jest.Mock).mockImplementation(async function* () {
        yield { type: 'done', data: {} };
      });

      await controller.chat(body as any, res);

      expect(chatService.processMessageWithStreaming).toHaveBeenCalledWith(
        'hello',
        expect.any(String),
        expect.any(String),
        expect.any(String),
        undefined,
        false,
      );
    });
  });
});
