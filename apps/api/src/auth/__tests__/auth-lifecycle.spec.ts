import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthService } from '../auth.service';
import type { JwtService } from '@nestjs/jwt';

function createMocks() {
  const prisma = {
    session: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      count: vi.fn().mockResolvedValue(0),
    },
    parentSession: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    passwordResetToken: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    authorizationCode: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    $transaction: vi.fn(),
  };
  const jwt = {
    sign: vi.fn(() => 'signed'),
    decode: vi.fn(() => null),
  } as unknown as JwtService;
  return { prisma, jwt };
}

/**
 * The purge interval must be started exactly once by the Nest lifecycle and
 * released on shutdown: one timer in, zero timers out, no leaked handles.
 */
describe('AuthService cleanup lifecycle', () => {
  let prisma: ReturnType<typeof createMocks>['prisma'];
  let jwt: JwtService;
  let svc: AuthService;

  beforeEach(() => {
    vi.useFakeTimers();
    const mocks = createMocks();
    prisma = mocks.prisma;
    jwt = mocks.jwt;
    svc = new AuthService(prisma as never, jwt);
  });

  afterEach(() => {
    svc.onModuleDestroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('creates no timer until the Nest lifecycle starts it', () => {
    expect(svc['cleanupTimer']).toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('starts exactly one timer on module init (repeated init is a no-op)', () => {
    svc.onModuleInit();
    const first = svc['cleanupTimer'];
    expect(first).toBeDefined();

    svc.onModuleInit();
    svc.onModuleInit();

    expect(svc['cleanupTimer']).toBe(first);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('runs the purge on every interval tick', async () => {
    const purge = vi
      .spyOn(svc, 'cleanupExpiredEntries')
      .mockResolvedValue(undefined as never);

    svc.onModuleInit();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(purge).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(120_000);
    expect(purge).toHaveBeenCalledTimes(3);
  });

  it('clears the timer on module destroy — no timer survives shutdown', async () => {
    const purge = vi
      .spyOn(svc, 'cleanupExpiredEntries')
      .mockResolvedValue(undefined as never);

    svc.onModuleInit();
    expect(vi.getTimerCount()).toBe(1);

    svc.onModuleDestroy();
    expect(svc['cleanupTimer']).toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);

    // Ticks after shutdown must never fire the purge again.
    await vi.advanceTimersByTimeAsync(600_000);
    expect(purge).not.toHaveBeenCalled();
  });

  it('destroy is idempotent and safe before init', () => {
    expect(() => svc.onModuleDestroy()).not.toThrow();
    svc.onModuleInit();
    expect(() => svc.onModuleDestroy()).not.toThrow();
    expect(() => svc.onModuleDestroy()).not.toThrow();
    expect(svc['cleanupTimer']).toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });
});
