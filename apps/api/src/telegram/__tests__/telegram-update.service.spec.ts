import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TelegramUpdateService } from '../telegram-update.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('TelegramUpdateService', () => {
  let service: TelegramUpdateService;
  let prisma: {
    telegramUpdate: {
      create: ReturnType<typeof vi.fn>;
      deleteMany: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    prisma = {
      telegramUpdate: {
        create: vi.fn().mockResolvedValue({}),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    service = new TelegramUpdateService(prisma as unknown as PrismaService);
  });

  it('claims an unseen update so it is processed exactly once', async () => {
    await expect(service.claim(10001n)).resolves.toBe(true);
    expect(prisma.telegramUpdate.create).toHaveBeenCalledWith({
      data: { updateId: 10001n, status: 'PROCESSED' },
    });
  });

  it('reports a duplicate when the update id already exists', async () => {
    prisma.telegramUpdate.create.mockRejectedValue(
      Object.assign(new Error('unique'), { code: 'P2002' }),
    );
    await expect(service.claim(10001n)).resolves.toBe(false);
  });

  it('rethrows unexpected database failures instead of silently swallowing them', async () => {
    prisma.telegramUpdate.create.mockRejectedValue(new Error('connection lost'));
    await expect(service.claim(10001n)).rejects.toThrow('connection lost');
  });

  it('purges dedup rows older than the retention cutoff', async () => {
    prisma.telegramUpdate.deleteMany.mockResolvedValue({ count: 7 });
    const cutoff = new Date('2026-01-01');
    await expect(service.purgeOlderThan(cutoff)).resolves.toBe(7);
    expect(prisma.telegramUpdate.deleteMany).toHaveBeenCalledWith({
      where: { receivedAt: { lt: cutoff } },
    });
  });
});
