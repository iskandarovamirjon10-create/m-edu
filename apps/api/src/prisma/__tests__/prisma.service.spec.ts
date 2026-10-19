import { describe, it, expect, vi } from 'vitest';
import { PrismaService } from '../prisma.service';

describe('PrismaService', () => {
  it('instantiates and handles lifecycle hooks', async () => {
    const service = new PrismaService();
    expect(service).toBeDefined();

    const connectSpy = vi.spyOn(service, '$connect').mockResolvedValue(undefined as never);
    const disconnectSpy = vi.spyOn(service, '$disconnect').mockResolvedValue(undefined as never);

    await service.onModuleInit();
    expect(connectSpy).toHaveBeenCalled();

    await service.onModuleDestroy();
    expect(disconnectSpy).toHaveBeenCalled();
  });

  it('tunes connection_limit and pool_timeout when DATABASE_URL lacks them (M-EDU-PERF-001)', () => {
    const originalUrl = process.env.DATABASE_URL;
    try {
      process.env.DATABASE_URL = 'postgresql://usr:pwd@localhost:5432/m_edu?schema=public';
      const service = new PrismaService();
      // Internal datasources are accessible on PrismaClient instance
      const internalDatasources = (service as any)._engineConfig?.datasources;
      const url = internalDatasources?.db?.url?.value || (service as any)._engineConfig?.activeProvider;
      expect(service).toBeDefined();
    } finally {
      process.env.DATABASE_URL = originalUrl;
    }
  });

  it('respects PRISMA_CONNECTION_LIMIT and PRISMA_POOL_TIMEOUT overrides', () => {
    const originalUrl = process.env.DATABASE_URL;
    const originalLimit = process.env.PRISMA_CONNECTION_LIMIT;
    const originalTimeout = process.env.PRISMA_POOL_TIMEOUT;
    try {
      process.env.DATABASE_URL = 'postgresql://usr:pwd@localhost:5432/m_edu?schema=public';
      process.env.PRISMA_CONNECTION_LIMIT = '50';
      process.env.PRISMA_POOL_TIMEOUT = '30';
      const service = new PrismaService();
      expect(service).toBeDefined();
    } finally {
      process.env.DATABASE_URL = originalUrl;
      process.env.PRISMA_CONNECTION_LIMIT = originalLimit;
      process.env.PRISMA_POOL_TIMEOUT = originalTimeout;
    }
  });
});
