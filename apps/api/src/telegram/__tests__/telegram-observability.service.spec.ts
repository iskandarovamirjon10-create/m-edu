import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TelegramObservabilityService } from '../telegram-observability.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramService } from '../telegram.service';

function makePrisma() {
  return {
    telegramAccount: {
      count: vi.fn().mockImplementation(({ where }: { where: { status?: string } }) => {
        switch (where.status) {
          case 'ACTIVE':
            return Promise.resolve(5);
          case 'DISCONNECTED':
            return Promise.resolve(2);
          case 'BLOCKED':
            return Promise.resolve(1);
          case 'SUSPENDED':
            return Promise.resolve(1);
          default:
            return Promise.resolve(9);
        }
      }),
      aggregate: vi.fn().mockResolvedValue({ _max: { lastSeenAt: new Date('2026-06-01T10:00:00Z') } }),
    },
    notificationDelivery: {
      groupBy: vi.fn().mockResolvedValue([
        { status: 'SENT', _count: { _all: 10 } },
        { status: 'FAILED', _count: { _all: 2 } },
        { status: 'DEFERRED', _count: { _all: 3 } },
        { status: 'SKIPPED', _count: { _all: 1 } },
      ]),
      findMany: vi.fn().mockResolvedValue([
        {
          eventType: 'ATTENDANCE_MARKED_ABSENT',
          channel: 'TELEGRAM',
          failureCategory: 'BLOCKED_USER',
          attempts: 1,
          failedAt: new Date('2026-06-01T09:00:00Z'),
        },
      ]),
    },
    telegramUpdate: {
      count: vi.fn().mockResolvedValue(42),
      findFirst: vi.fn().mockResolvedValue({ receivedAt: new Date('2026-06-01T11:00:00Z') }),
    },
  };
}

describe('TelegramObservabilityService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let telegram: { isConfigured: ReturnType<typeof vi.fn>; getBotUsername: ReturnType<typeof vi.fn> };
  let service: TelegramObservabilityService;

  beforeEach(() => {
    prisma = makePrisma();
    telegram = {
      isConfigured: vi.fn().mockReturnValue(true),
      getBotUsername: vi.fn().mockReturnValue('medu_bot'),
    };
    service = new TelegramObservabilityService(
      prisma as unknown as PrismaService,
      telegram as unknown as TelegramService,
    );
  });

  it('scopes every tenant query to the caller organization', async () => {
    await service.overview({ organizationId: 'org-1', role: 'ORG_ADMIN' });

    for (const call of prisma.telegramAccount.count.mock.calls) {
      expect(call[0].where.organizationId).toBe('org-1');
    }
    expect(prisma.telegramAccount.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org-1' } }),
    );
    expect(prisma.notificationDelivery.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org-1', channel: 'TELEGRAM' }),
      }),
    );
    expect(prisma.notificationDelivery.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1', status: 'FAILED' },
        take: 20,
      }),
    );
  });

  it('reports lifecycle counts + 24h delivery health', async () => {
    const overview = await service.overview({ organizationId: 'org-1', role: 'ORG_ADMIN' });

    expect(overview.accounts).toMatchObject({
      total: 9,
      active: 5,
      disconnected: 2,
      blocked: 1,
      suspended: 1,
    });
    expect(overview.deliveries.last24h).toEqual({
      sent: 10,
      failed: 2,
      deferred: 3,
      skipped: 1,
    });
    expect(overview.deliveries.recentFailures).toHaveLength(1);
    expect(overview.configured).toBe(true);
    expect(overview.botUsername).toBe('medu_bot');
  });

  it('hides the platform-wide webhook metric from an organization admin', async () => {
    const overview = await service.overview({ organizationId: 'org-1', role: 'ORG_ADMIN' });
    expect(overview.webhook).toBeNull();
    expect(prisma.telegramUpdate.count).not.toHaveBeenCalled();
  });

  it('exposes webhook health only to the existing platform super-admin', async () => {
    const overview = await service.overview({ organizationId: 'org-1', role: 'SUPER_ADMIN' });
    expect(overview.webhook).toEqual({
      updatesLast24h: 42,
      lastUpdateAt: new Date('2026-06-01T11:00:00Z'),
    });
  });

  it('never returns secrets or raw Telegram identifiers', async () => {
    const overview = await service.overview({ organizationId: 'org-1', role: 'SUPER_ADMIN' });
    const serialized = JSON.stringify(overview);

    for (const forbidden of [
      'token',
      'secret',
      'chatId',
      'telegramUserId',
      'password',
      'TELEGRAM_WEBHOOK',
      'TELEGRAM_CALLBACK',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
