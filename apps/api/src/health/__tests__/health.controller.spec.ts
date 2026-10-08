import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HealthController } from '../health.controller';
import { PrismaService } from '../../prisma/prisma.service';

describe('HealthController', () => {
  let prisma: { $queryRaw: ReturnType<typeof vi.fn> };
  let controller: HealthController;
  const makeRes = () => ({ status: vi.fn().mockReturnValue({}) }) as any;

  beforeEach(() => {
    prisma = { $queryRaw: vi.fn() };
    controller = new HealthController(prisma as unknown as PrismaService);
  });

  it('returns ok and database up when query succeeds', async () => {
    prisma.$queryRaw.mockResolvedValue([{ 1: 1 }]);

    const res = makeRes();
    const result = await controller.check(res);

    expect(result.status).toBe('ok');
    expect(result.database).toBe('up');
    expect(typeof result.uptime).toBe('number');
    expect(typeof result.timestamp).toBe('string');
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns degraded and database down when query fails', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('db down'));

    const res = makeRes();
    const result = await controller.check(res);

    expect(result.status).toBe('degraded');
    expect(result.database).toBe('down');
    expect(typeof result.uptime).toBe('number');
    expect(typeof result.timestamp).toBe('string');
    // The /health probe MUST fail (503) when the DB is unreachable so the
    // Docker HEALTHCHECK does not report a healthy container while it 500s.
    expect(res.status).toHaveBeenCalledWith(503);
  });
});
