import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HealthController } from '../health.controller';
import { PrismaService } from '../../prisma/prisma.service';

describe('HealthController', () => {
  let prisma: { $queryRaw: ReturnType<typeof vi.fn> };
  let controller: HealthController;

  beforeEach(() => {
    prisma = { $queryRaw: vi.fn() };
    controller = new HealthController(prisma as unknown as PrismaService);
  });

  it('returns ok and database up when query succeeds', async () => {
    prisma.$queryRaw.mockResolvedValue([{ 1: 1 }]);

    const result = await controller.check();

    expect(result.status).toBe('ok');
    expect(result.database).toBe('up');
    expect(typeof result.uptime).toBe('number');
    expect(typeof result.timestamp).toBe('string');
  });

  it('returns degraded and database down when query fails', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('db down'));

    const result = await controller.check();

    expect(result.status).toBe('degraded');
    expect(result.database).toBe('down');
    expect(typeof result.uptime).toBe('number');
    expect(typeof result.timestamp).toBe('string');
  });
});
