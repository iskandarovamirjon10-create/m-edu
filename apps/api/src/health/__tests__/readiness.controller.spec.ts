import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Response } from 'express';
import { ReadinessController } from '../readiness.controller';
import { PrismaService } from '../../prisma/prisma.service';

function makeResponse() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

describe('ReadinessController', () => {
  let prisma: { $queryRaw: ReturnType<typeof vi.fn> };
  let controller: ReadinessController;

  beforeEach(() => {
    prisma = { $queryRaw: vi.fn() };
    controller = new ReadinessController(prisma as unknown as PrismaService);
  });

  it('returns 200 ready when the database responds', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    const res = makeResponse();
    await controller.check(res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ready', database: 'up' }),
    );
  });

  it('returns 503 not_ready when the database is unreachable (fail closed)', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));
    const res = makeResponse();
    await controller.check(res);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'not_ready', database: 'down' }),
    );
  });

  it('never leaks internal error details in the response body', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('secret dsn details'));
    const res = makeResponse();
    await controller.check(res);
    const body = res.json.mock.calls[0][0];
    expect(JSON.stringify(body)).not.toContain('secret');
  });
});
