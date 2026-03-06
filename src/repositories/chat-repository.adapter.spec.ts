import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ChatRepositoryAdapter } from './chat-repository.adapter';
import { IOSBackendService } from '../services/ios-backend.service';

/**
 * Ensures we never send empty content to Munawar's API (avoids 400 "Content is required").
 */
describe('ChatRepositoryAdapter (ensureContent / no empty to Munawar)', () => {
  let adapter: ChatRepositoryAdapter;
  let createMessageSpy: jest.SpyInstance;

  beforeEach(async () => {
    const mockIosBackend = {
      createMessage: jest.fn().mockResolvedValue({
        message: { id: 'm1', sessionId: 's1', role: 'agent', content: 'ok', createdAt: new Date() },
      }),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatRepositoryAdapter,
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: IOSBackendService, useValue: mockIosBackend },
      ],
    }).compile();
    adapter = module.get(ChatRepositoryAdapter);
    createMessageSpy = module.get(IOSBackendService).createMessage as jest.Mock;
  });

  it('saveAssistantMessage with empty string sends fallback to createMessage', async () => {
    await adapter.saveAssistantMessage(
      's1', 'u1', '', 2, 'gpt-4o', undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    );
    expect(createMessageSpy).toHaveBeenCalledWith(
      's1', 'agent', expect.any(String), expect.any(Object), undefined,
    );
    const contentArg = createMessageSpy.mock.calls[0][2];
    expect(contentArg).toBe('(Response unavailable. Please try again.)');
    expect(contentArg.length).toBeGreaterThan(0);
  });

  it('saveAssistantMessage with whitespace-only sends fallback', async () => {
    await adapter.saveAssistantMessage(
      's1', 'u1', '   \n\t  ', 2, 'gpt-4o', undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    );
    const contentArg = createMessageSpy.mock.calls[0][2];
    expect(contentArg.trim().length).toBeGreaterThan(0);
    expect(contentArg).toBe('(Response unavailable. Please try again.)');
  });

  it('saveUserMessage with empty string sends fallback', async () => {
    await adapter.saveUserMessage('s1', 'u1', '', 1, undefined);
    expect(createMessageSpy).toHaveBeenCalledWith(
      's1', 'user', '(No message content)', expect.any(Object), undefined,
    );
  });

  it('saveAssistantMessage with valid content passes it through', async () => {
    const valid = 'Hello, here is my response.';
    await adapter.saveAssistantMessage(
      's1', 'u1', valid, 2, 'gpt-4o', undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    );
    expect(createMessageSpy.mock.calls[0][2]).toBe(valid);
  });
});
