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
    const store: Record<string, any> = {};
    const mockUsageStore = {
      getCreditRecord: jest.fn((key: string) => store[key]),
      setCreditRecord: jest.fn((key: string, value: any) => { store[key] = value; }),
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

  it('should return credit check with credits from local store when record exists', async () => {
    const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const key = `${userId}:${currentMonth}`;
    (usageStore.setCreditRecord as jest.Mock)(key, { userId, month: currentMonth, creditsUsed: 10, requestCount: 5 });
    const result = await service.checkCredits(userId, 'free');
    expect(result.creditsUsed).toBe(10);
    expect(result.creditsIncluded).toBe(100);
    expect(result.tokensUsed).toBe(10_000);
    expect(result.tokensIncluded).toBe(100_000);
    expect(iosBackend.getUserSessions).not.toHaveBeenCalled();
  });

  it('should read-back from Munawar when local store is empty and USE_IOS_BACKEND=true', async () => {
    const result = await service.checkCredits(userId, 'free');
    expect(iosBackend.getUserSessions).toHaveBeenCalledWith(userId, undefined, 10);
    expect(iosBackend.getSessionMessages).toHaveBeenCalledWith('session-1', 50);
    expect(result.creditsUsed).toBe(25);
    expect(result.creditsIncluded).toBe(100);
    expect(result.tokensUsed).toBe(25_000);
    expect(result.tokensIncluded).toBe(100_000);
    expect(usageStore.setCreditRecord).toHaveBeenCalledWith(
      expect.stringContaining(userId),
      expect.objectContaining({ userId, creditsUsed: 25, requestCount: 0, topUpCarried: 0, topUpAddedThisMonth: 0 }),
    );
  });

  it('should not call Munawar when USE_IOS_BACKEND is not true', async () => {
    (configService.get as jest.Mock).mockImplementation((key: string) =>
      key === 'USE_IOS_BACKEND' ? 'false' : undefined,
    );
    const result = await service.checkCredits(userId, 'free');
    expect(iosBackend.getUserSessions).not.toHaveBeenCalled();
    expect(result.tokensUsed).toBe(0);
  });

  it('getUsageStats should reflect read-back when local store is empty', async () => {
    const result = await service.getUsageStats(userId, 'free');
    expect(result.creditsUsed).toBe(25);
    expect(result.creditsIncluded).toBe(100);
    expect(result.tokensUsed).toBe(25_000);
    expect(result.tokensIncluded).toBe(100_000);
  });

  it('addTopUp should add credits and persist topUpCredits; checkCredits uses effective allowance', async () => {
    const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const key = `${userId}:${currentMonth}`;
    (usageStore.setCreditRecord as jest.Mock)(key, { userId, month: currentMonth, creditsUsed: 80, requestCount: 10 });
    const added = await service.addTopUp(userId, 50);
    expect(added.creditsAdded).toBe(50);
    expect(added.totalTopUpThisMonth).toBe(50);
    expect(usageStore.setCreditRecord).toHaveBeenCalledWith(
      expect.stringContaining(userId),
      expect.objectContaining({ creditsUsed: 80, requestCount: 10, topUpCredits: 50, topUpCarried: 0, topUpAddedThisMonth: 50 }),
    );
    const check = await service.checkCredits(userId, 'free');
    expect(check.creditsIncluded).toBe(150);
    expect(check.creditsUsed).toBe(80);
    expect(check.allowed).toBe(true);
  });
});
