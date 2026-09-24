import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ObservabilityService } from '../observability.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MetricsMiddleware } from '../metrics.middleware';

vi.mock('ioredis', () => {
  return {
    default: class MockRedis {
      async ping() {
        return 'PONG';
      }
      async quit() {
        return 'OK';
      }
      on() {
        return this;
      }
    },
  };
});

vi.mock('bullmq', () => {
  return {
    Queue: class MockQueue {
      async getWaitingCount() { return 0; }
      async getActiveCount() { return 0; }
      async getCompletedCount() { return 0; }
      async getFailedCount() { return 0; }
      async getDelayedCount() { return 0; }
      async close() { return undefined; }
    },
  };
});

describe('ObservabilityService', () => {
  let service: ObservabilityService;
  let prisma: { $queryRaw: ReturnType<typeof vi.fn> };
  let metricsMiddleware: MetricsMiddleware;

  beforeEach(async () => {
    prisma = { $queryRaw: vi.fn().mockResolvedValue([{ count: 5n }]) };
    metricsMiddleware = new MetricsMiddleware();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ObservabilityService,
        { provide: PrismaService, useValue: prisma },
        { provide: MetricsMiddleware, useValue: metricsMiddleware },
      ],
    }).compile();

    service = module.get(ObservabilityService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getHealthCheck', () => {
    it('should return health status with services and memory', async () => {
      const result = await service.getHealthCheck();
      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('services');
      expect(result).toHaveProperty('memory');
      expect(result).toHaveProperty('uptime');
      expect(typeof result.uptime).toBe('number');
    });
  });

  describe('getSystemMetrics', () => {
    it('should return system metrics with cpu and memory', async () => {
      const result = await service.getSystemMetrics();
      expect(result).toHaveProperty('uptime');
      expect(result).toHaveProperty('nodeVersion');
      expect(result).toHaveProperty('cpu');
      expect(result).toHaveProperty('memory');
      expect(result.cpu).toHaveProperty('cores');
      expect(result.cpu).toHaveProperty('loadAverage');
      expect(result.memory).toHaveProperty('total');
      expect(result.memory).toHaveProperty('usagePercent');
    });
  });

  describe('getQueueHealth', () => {
    it('should return an array of queue statuses', async () => {
      const result = await service.getQueueHealth();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('status');
    });
  });

  describe('getIntegrationHealth', () => {
    it('should return integration statuses', () => {
      const result = service.getIntegrationHealth();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(4);
      expect(result.map((i) => i.name)).toContain('Telegram Bot');
      expect(result.map((i) => i.name)).toContain('SMTP Email');
    });
  });

  describe('getApiMetrics', () => {
    it('should return api metrics from middleware', () => {
      const result = service.getApiMetrics();
      expect(result).toHaveProperty('totalRequests');
      expect(result).toHaveProperty('errorRate');
      expect(result).toHaveProperty('avgResponseTimeMs');
      expect(result).toHaveProperty('p95ResponseTimeMs');
      expect(result).toHaveProperty('p99ResponseTimeMs');
      expect(result).toHaveProperty('requestsPerMinute');
      expect(result).toHaveProperty('endpointBreakdown');
    });
  });

  describe('getDatabaseMetrics', () => {
    it('should return database metrics', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([{ count: 10n }])
        .mockResolvedValueOnce([
          {
            tup_returned: 1000n,
            tup_fetched: 500n,
            xact_commit: 200n,
            xact_rollback: 5n,
            blks_read: 100n,
            blks_hit: 900n,
          },
        ]);

      const result = await service.getDatabaseMetrics();
      expect(result).toHaveProperty('activeConnections');
      expect(result).toHaveProperty('totalQueries');
      expect(result).toHaveProperty('cacheHitRatio');
      expect(result.activeConnections).toBe(10);
      expect(result.totalQueries).toBe(205);
      expect(result.cacheHitRatio).toBe(90);
    });

    it('should handle database errors gracefully', async () => {
      prisma.$queryRaw.mockRejectedValueOnce(new Error('Connection failed'));
      const result = await service.getDatabaseMetrics();
      expect(result.activeConnections).toBe(0);
      expect(result.totalQueries).toBe(0);
    });
  });
});
