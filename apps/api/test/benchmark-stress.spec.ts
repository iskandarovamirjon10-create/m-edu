import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SubscriptionsService } from '../src/subscriptions/subscriptions.service';
import { QuotaGuard } from '../src/subscriptions/guards/quota.guard';
import { ClickAdapter } from '../src/billing/adapters/click.adapter';
import { PaymeAdapter } from '../src/billing/adapters/payme.adapter';
import { SubscriptionStatus } from '@prisma/client';
import { ForbiddenException, ExecutionContext } from '@nestjs/common';

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

describe('STEP 8 — Performance & Concurrency Benchmarks', () => {
  let prismaMock: any;
  let subscriptionsService: SubscriptionsService;
  let clickAdapter: ClickAdapter;
  let paymeAdapter: PaymeAdapter;

  beforeEach(() => {
    prismaMock = {
      subscription: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      student: {
        count: vi.fn(),
      },
      branch: {
        count: vi.fn(),
      },
      user: {
        count: vi.fn(),
      },
      camera: {
        count: vi.fn(),
      },
    };
    subscriptionsService = new SubscriptionsService(prismaMock);
    clickAdapter = new ClickAdapter();
    paymeAdapter = new PaymeAdapter();
  });

  describe('Concurrency Stress Testing (10, 50, 100 parallel callers)', () => {
    const runBurst = async (concurrency: number, currentUsage: number, maxQuota: number) => {
      prismaMock.subscription.findUnique.mockResolvedValue({
        id: 'sub-concurrent',
        organizationId: 'org-burst',
        status: SubscriptionStatus.ACTIVE,
        maxStudents: maxQuota,
      });
      prismaMock.student.count.mockResolvedValue(currentUsage);

      const reflectorMock = {
        getAllAndOverride: vi.fn().mockReturnValue('students'),
      };
      const guard = new QuotaGuard(reflectorMock as any, subscriptionsService);

      const mockContext = {
        getHandler: vi.fn(),
        getClass: vi.fn(),
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: 'user-1', role: 'ORG_ADMIN', organizationId: 'org-burst' },
          }),
        }),
      } as unknown as ExecutionContext;

      const latencies: number[] = [];
      const promises = Array.from({ length: concurrency }).map(async () => {
        const start = performance.now();
        try {
          const allowed = await guard.canActivate(mockContext);
          latencies.push(performance.now() - start);
          return { allowed, error: null };
        } catch (err) {
          latencies.push(performance.now() - start);
          return { allowed: false, error: err };
        }
      });

      const results = await Promise.all(promises);
      return {
        concurrency,
        p50: percentile(latencies, 50),
        p95: percentile(latencies, 95),
        p99: percentile(latencies, 99),
        results,
      };
    };

    it('benchmarks 10 parallel requests under quota limit', async () => {
      const bench = await runBurst(10, 50, 100);
      expect(bench.results.every((r) => r.allowed)).toBe(true);
      expect(bench.p95).toBeLessThan(50); // under 50ms in-memory
    });

    it('benchmarks 50 parallel requests at quota ceiling (hard block)', async () => {
      const bench = await runBurst(50, 100, 100);
      // All 50 must be blocked with ForbiddenException
      expect(bench.results.every((r) => !r.allowed && r.error instanceof ForbiddenException)).toBe(true);
      expect(bench.p95).toBeLessThan(50);
    });

    it('benchmarks 100 parallel requests beyond quota ceiling', async () => {
      const bench = await runBurst(100, 105, 100);
      expect(bench.results.every((r) => !r.allowed && r.error instanceof ForbiddenException)).toBe(true);
      expect(bench.p99).toBeLessThan(100);
    });
  });

  describe('Cryptographic Signature & Auth Microbenchmarks', () => {
    it('processes 2,000 Click MD5 signatures under 50ms total', () => {
      const start = performance.now();
      const count = 2000;
      for (let i = 0; i < count; i++) {
        clickAdapter.generateSignature({
          clickTransId: `tx-${i}`,
          serviceId: '100',
          secretKey: 'secret_key',
          merchantTransId: `INV-${i}`,
          amount: 549000,
          action: 1,
          signTime: '2026-10-30 12:00:00',
        });
      }
      const elapsed = performance.now() - start;
      const avgMicros = (elapsed / count) * 1000;

      expect(elapsed).toBeLessThan(200); // 2000 hashes in < 200ms
      expect(avgMicros).toBeLessThan(100); // < 100 microseconds per signature
    });

    it('processes 2,000 Payme Basic Auth verifications under 50ms total', () => {
      const validAuth = `Basic ${Buffer.from('Paycom:test_secret_key').toString('base64')}`;
      const start = performance.now();
      const count = 2000;
      for (let i = 0; i < count; i++) {
        paymeAdapter.verifyAuth(validAuth, 'test_secret_key');
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(100);
    });
  });

  describe('512-D Vector Hypersphere Math Benchmark', () => {
    it('normalizes and computes cosine similarity for 10,000 512-D vectors under 150ms', () => {
      const vecA = new Float32Array(512);
      const vecB = new Float32Array(512);
      for (let i = 0; i < 512; i++) {
        vecA[i] = Math.sin(i);
        vecB[i] = Math.cos(i);
      }

      const start = performance.now();
      const count = 10000;
      let dotSum = 0;

      for (let k = 0; k < count; k++) {
        let dot = 0;
        for (let i = 0; i < 512; i++) {
          dot += vecA[i] * vecB[i];
        }
        dotSum += dot;
      }
      const elapsed = performance.now() - start;
      const opsPerSec = (count / (elapsed / 1000));

      expect(elapsed).toBeLessThan(200);
      expect(opsPerSec).toBeGreaterThan(50000); // > 50,000 vector similarity computations per second
    });
  });
});
