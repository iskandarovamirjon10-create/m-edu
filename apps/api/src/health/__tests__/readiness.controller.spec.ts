import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReadinessController } from '../readiness.controller';

function makeResponse() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

describe('ReadinessController', () => {
  let prisma: any;
  let controller: ReadinessController;

  beforeEach(() => {
    prisma = { $queryRaw: vi.fn() };
    controller = new ReadinessController(prisma);
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
