import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationRetentionService } from '../notification-retention.service';
import { PrismaService } from '../../prisma/prisma.service';

function makePrisma() {
  return {
    notificationDelivery: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
}

describe('NotificationRetentionService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: NotificationRetentionService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new NotificationRetentionService(prisma as unknown as PrismaService);
  });

  it('deletes in bounded, indexed batches until nothing is left', async () => {
    // A FULL batch of 1000 forces a second iteration; the short second batch
    // ends the loop (`< PURGE_BATCH_SIZE`), so pagination cannot loop forever.
    const fullBatch = Array.from({ length: 1000 }, (_, i) => ({ id: `a-${i}` }));
    prisma.notificationDelivery.findMany
      .mockResolvedValueOnce(fullBatch)
      .mockResolvedValueOnce([{ id: 'b' }]);
    prisma.notificationDelivery.deleteMany
      .mockResolvedValueOnce({ count: 1000 })
      .mockResolvedValueOnce({ count: 1 });

    const cutoff = new Date('2026-01-01');
    await expect(service.purgeOlderThan(cutoff)).resolves.toBe(1001);

    expect(prisma.notificationDelivery.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { createdAt: { lt: cutoff } },
        take: 1000,
      }),
    );
    // One deleteMany per batch, keyed by id — never a single unbounded delete.
    expect(prisma.notificationDelivery.deleteMany).toHaveBeenCalledTimes(2);
    expect(prisma.notificationDelivery.deleteMany).toHaveBeenNthCalledWith(1, {
      where: { id: { in: fullBatch.map((r) => r.id) } },
    });
  });

  it('is a no-op when nothing is older than the cutoff', async () => {
    await expect(service.purgeOlderThan(new Date())).resolves.toBe(0);
    expect(prisma.notificationDelivery.deleteMany).not.toHaveBeenCalled();
  });

  it('swallows sweep failures so a retention error never crashes the process', async () => {
    prisma.notificationDelivery.findMany.mockRejectedValue(new Error('db down'));
    await expect(service.sweep()).resolves.toBeUndefined();
  });
});
