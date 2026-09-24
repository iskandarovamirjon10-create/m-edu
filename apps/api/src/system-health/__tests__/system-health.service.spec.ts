import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SystemHealthService } from '../system-health.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('SystemHealthService', () => {
  let service: SystemHealthService;
  let prisma: {
    $queryRaw: ReturnType<typeof vi.fn>;
    organization: {
      count: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = {
      $queryRaw: vi.fn(),
      organization: {
        count: vi.fn(),
      },
    };
    service = new SystemHealthService(prisma as unknown as PrismaService);
  });

  it('returns UP status for all components when healthy', async () => {
    prisma.$queryRaw.mockResolvedValue([{ 1: 1 }]);
    prisma.organization.count.mockResolvedValue(5);

    const summary = await service.getSummary();

    expect(summary.uptime).toBeGreaterThanOrEqual(0);
    expect(summary.components).toHaveLength(4);

    const db = summary.components.find((c) => c.name === 'database');
    expect(db).toBeDefined();
    expect(db?.status).toBe('UP');

    const prismaComp = summary.components.find((c) => c.name === 'prisma');
    expect(prismaComp).toBeDefined();
    expect(prismaComp?.status).toBe('UP');
    expect(prismaComp?.details).toEqual({ organizationCount: 5 });

    const memory = summary.components.find((c) => c.name === 'memory');
    expect(memory).toBeDefined();
    expect(['UP', 'DEGRADED']).toContain(memory?.status);

    const disk = summary.components.find((c) => c.name === 'disk');
    expect(disk).toBeDefined();
    expect(disk?.status).toBe('UP');
  });

  it('returns DOWN status for database when query fails', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('Connection failed'));
    prisma.organization.count.mockResolvedValue(5);

    const summary = await service.getSummary();
    const db = summary.components.find((c) => c.name === 'database');

    expect(db?.status).toBe('DOWN');
    expect(db?.details).toEqual({ error: 'Connection failed' });
  });

  it('returns DOWN status for prisma when organization count fails', async () => {
    prisma.$queryRaw.mockResolvedValue([{ 1: 1 }]);
    prisma.organization.count.mockRejectedValue(new Error('Prisma error'));

    const summary = await service.getSummary();
    const prismaComp = summary.components.find((c) => c.name === 'prisma');

    expect(prismaComp?.status).toBe('DOWN');
    expect(prismaComp?.details).toEqual({ error: 'Prisma error' });
  });
});
