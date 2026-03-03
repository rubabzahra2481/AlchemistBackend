import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CreditService } from './credit.service';
import { SubscriptionService } from './subscription.service';
import { UsageStoreService } from './usage-store.service';
import { IOSBackendService } from './ios-backend.service';

describe('CreditService', () => {
  let service: CreditService;
  let usageStore: jest.Mocked<UsageStoreService>;
  let configService: jest.Mocked<ConfigService>;
  let iosBackend: jest.Mocked<IOSBackendService>;

  const userId = 'test-user-123';

  beforeEach(async () => {
    const mockUsageStore = {
      getCreditRecord: jest.fn().mockReturnValue(undefined),
      setCreditRecord: jest.fn(),
    };
    const mockConfig = {
      get: jest.fn().mockImplementation((key: string) => (key === 'USE_IOS_BACKEND' ? 'true' : undefined)),
    };
    const mockIosBackend = {
      getUserSessions: jest.fn().mockResolvedValue({
        success: true,
        sessions: [{ id: 'session-1' }],
      }),
      getSessionMessages: jest.fn().mockResolvedValue({
        success: true,
        messages: [
          {
            id: 'msg-1',
            sessionId: 'session-1',
            role: 'agent',
            content: 'Hello',
            metadata: {
              credits: { tokensUsed: 25_000, tokensIncluded: 100_000 },
            },
            createdAt: '2025-02-23T12:00:00Z',
          },
        ],
        total: 1,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreditService,
        { provide: SubscriptionService, useValue: {} },
        { provide: UsageStoreService, useValue: mockUsageStore },
        { provide: ConfigService, useValue: mockConfig },
        { provide: IOSBackendService, useValue: mockIosBackend },
      ],
    }).compile();

    service = module.get<CreditService>(CreditService);
    usageStore = module.get(UsageStoreService) as jest.Mocked<UsageStoreService>;
    configService = module.get(ConfigService) as jest.Mocked<ConfigService>;
    iosBackend = module.get(IOSBackendService) as jest.Mocked<IOSBackendService>;
  });

  it('should return credit check with tokens from local store when record exists', async () => {
    (usageStore.getCreditRecord as jest.Mock).mockReturnValue({
      userId,
      month: '2025-02',
      tokensUsed: 10_000,
      requestCount: 5,
    });
    const result = await service.checkCredits(userId, 'free');
    expect(result.tokensUsed).toBe(10_000);
    expect(result.tokensIncluded).toBe(100_000);
    expect(iosBackend.getUserSessions).not.toHaveBeenCalled();
  });

  it('should read-back from Munawar when local store is empty and USE_IOS_BACKEND=true', async () => {
    (usageStore.getCreditRecord as jest.Mock).mockReturnValue(undefined);
    const result = await service.checkCredits(userId, 'free');
    expect(iosBackend.getUserSessions).toHaveBeenCalledWith(userId, undefined, 10);
    expect(iosBackend.getSessionMessages).toHaveBeenCalledWith('session-1', 50);
    expect(result.tokensUsed).toBe(25_000);
    expect(result.tokensIncluded).toBe(100_000);
    expect(usageStore.setCreditRecord).toHaveBeenCalledWith(
      expect.stringContaining(userId),
      expect.objectContaining({ userId, tokensUsed: 25_000, requestCount: 0 }),
    );
  });

  it('should not call Munawar when USE_IOS_BACKEND is not true', async () => {
    (configService.get as jest.Mock).mockImplementation((key: string) =>
      key === 'USE_IOS_BACKEND' ? 'false' : undefined,
    );
    (usageStore.getCreditRecord as jest.Mock).mockReturnValue(undefined);
    const result = await service.checkCredits(userId, 'free');
    expect(iosBackend.getUserSessions).not.toHaveBeenCalled();
    expect(result.tokensUsed).toBe(0);
  });

  it('getUsageStats should reflect read-back when local store is empty', async () => {
    (usageStore.getCreditRecord as jest.Mock).mockReturnValue(undefined);
    const result = await service.getUsageStats(userId, 'free');
    expect(result.tokensUsed).toBe(25_000);
    expect(result.tokensIncluded).toBe(100_000);
  });
});
