import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  NotificationDeliveryService,
  telegramDeliveryDedupKey,
} from '../notification-delivery.service';
import { PrismaService } from '../../prisma/prisma.service';

function makePrisma() {
  return {
    notificationDelivery: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
}

const BASE = {
  organizationId: 'org-1',
  eventId: 'job-1',
  eventType: 'ATTENDANCE_MARKED_ABSENT',
  entityType: 'Attendance',
  entityId: 'att-1',
  principalType: 'PARENT_ACCOUNT' as const,
  principalId: 'p-1',
  telegramAccountId: 'acct-1',
  dedupKey: 'dedup-1',
};

describe('telegramDeliveryDedupKey', () => {
  it('is deterministic and scoped to principal + event + entity + day', () => {
    const a = telegramDeliveryDedupKey({
      principalType: 'PARENT_ACCOUNT',
      principalId: 'p-1',
      eventType: 'ATTENDANCE_MARKED_ABSENT',
      entityId: 'att-1',
      occurredAt: '2026-06-01T08:00:00Z',
    });
    const sameDay = telegramDeliveryDedupKey({
      principalType: 'PARENT_ACCOUNT',
      principalId: 'p-1',
      eventType: 'ATTENDANCE_MARKED_ABSENT',
      entityId: 'att-1',
      occurredAt: '2026-06-01T20:00:00Z',
    });
    const otherPrincipal = telegramDeliveryDedupKey({
      principalType: 'PARENT_ACCOUNT',
      principalId: 'p-2',
      eventType: 'ATTENDANCE_MARKED_ABSENT',
      entityId: 'att-1',
      occurredAt: '2026-06-01T08:00:00Z',
    });

    expect(a).toBe(sameDay);
    expect(a).not.toBe(otherPrincipal);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('NotificationDeliveryService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: NotificationDeliveryService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new NotificationDeliveryService(prisma as unknown as PrismaService);
  });

  it('creates a tracking row on the first attempt', async () => {
    prisma.notificationDelivery.findUnique.mockResolvedValue(null);
    prisma.notificationDelivery.create.mockResolvedValue({ id: 'nd-1', attempts: 1 });

    const tracked = await service.ensureTracked({ ...BASE, title: 'T', body: 'B' });

    expect(tracked).toEqual({ id: 'nd-1', alreadySent: false, attempts: 1 });
    expect(prisma.notificationDelivery.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dedupKey: 'dedup-1',
          organizationId: 'org-1',
          status: 'PENDING',
          attempts: 1,
          telegramAccountId: 'acct-1',
        }),
      }),
    );
  });

  it('reuses the row on a duplicate event and reports a prior success', async () => {
    prisma.notificationDelivery.findUnique.mockResolvedValue({
      id: 'nd-1',
      status: 'SENT',
      attempts: 1,
    });
    prisma.notificationDelivery.update.mockResolvedValue({
      id: 'nd-1',
      status: 'SENT',
      attempts: 2,
    });

    const tracked = await service.ensureTracked(BASE);

    expect(tracked.alreadySent).toBe(true);
    expect(tracked.attempts).toBe(2);
    expect(prisma.notificationDelivery.create).not.toHaveBeenCalled();
  });

  it('resolves a create race via the unique dedup key', async () => {
    prisma.notificationDelivery.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'nd-1', status: 'PENDING', attempts: 1 });
    prisma.notificationDelivery.create.mockRejectedValue(
      Object.assign(new Error('unique'), { code: 'P2002' }),
    );

    const tracked = await service.ensureTracked(BASE);
    expect(tracked.id).toBe('nd-1');
    expect(tracked.alreadySent).toBe(false);
  });

  it('records a quiet-hours deferral with the content needed to re-deliver', async () => {
    const until = new Date('2026-06-02T02:00:00Z');
    await service.markDeferred('nd-1', until, { title: 'T', body: 'B' });

    expect(prisma.notificationDelivery.update).toHaveBeenCalledWith({
      where: { id: 'nd-1' },
      data: expect.objectContaining({
        status: 'DEFERRED',
        deferredUntil: until,
        title: 'T',
        body: 'B',
      }),
    });
  });

  it('records categorized failures without throwing', async () => {
    prisma.notificationDelivery.update.mockRejectedValue(new Error('db down'));
    await expect(service.markFailed('nd-1', 'TIMEOUT', 'acct-1')).resolves.toBeUndefined();
  });

  it('claims due deferred rows atomically and recovers abandoned claims', async () => {
    prisma.notificationDelivery.updateMany.mockResolvedValue({ count: 2 });
    await service.recoverStaleProcessing(600_000);
    expect(prisma.notificationDelivery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'PROCESSING' }),
        data: { status: 'DEFERRED' },
      }),
    );
  });

  it('returns [] without a claim query when nothing is due', async () => {
    prisma.notificationDelivery.findMany.mockResolvedValue([]);
    await expect(service.claimDueDeferred(10)).resolves.toEqual([]);
    expect(prisma.notificationDelivery.updateMany).not.toHaveBeenCalled();
  });
});
