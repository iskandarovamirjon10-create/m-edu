/**
 * Regression tests for the session cache boundary (F-CACHE-001 / F-SW-001).
 *
 * Invariants:
 *  1. `purgeSessionCaches()` wipes the TanStack query cache — no cached
 *     query data may survive a logout/account switch.
 *  2. It also deletes the service-worker Cache Storage buckets, so
 *     authenticated API responses cached by older SW versions cannot be
 *     replayed to the next user.
 *  3. Logout must never throw even when `caches` is unavailable
 *     (insecure context) or storage access fails.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('purgeSessionCaches — cross-account cache boundary', () => {
  let clearSensitiveQueryCache: () => void;
  let purgeSessionCaches: () => void;
  let mod: typeof import('../queryClient');

  beforeEach(async () => {
    vi.resetModules();
    localStorage.clear();
    // Fresh module graph → fresh singleton registered with the purge hook.
    mod = await import('../queryClient');
    const cleanup = await import('../sessionCleanup');
    clearSensitiveQueryCache = mod.clearSensitiveQueryCache;
    purgeSessionCaches = cleanup.purgeSessionCaches;
    // Seed the SINGLETON's cache (the one purge is registered against).
    mod.queryClient.setQueryData(['students'], { items: [{ id: 's1', name: 'Org A student' }] });
    mod.queryClient.setQueryData(['dashboard', 'stats'], { totalStudents: 42 });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('clears every cached query so no previous-account data survives', () => {
    expect(clearSensitiveQueryCache).toBeTypeOf('function');
    expect(mod.queryClient.getQueryData(['students'])).toBeDefined();
    clearSensitiveQueryCache();
    // The singleton must be empty after purge.
    expect(mod.queryClient.getQueryData(['students'])).toBeUndefined();
    expect(mod.queryClient.getQueryData(['dashboard', 'stats'])).toBeUndefined();
  });

  it('purgeSessionCaches removes service-worker cache buckets', async () => {
    const deleted: string[] = [];
    vi.stubGlobal('caches', {
      keys: vi.fn().mockResolvedValue(['medu-v1', 'medu-static-v1', 'other-app']),
      delete: vi.fn(async (name: string) => {
        deleted.push(name);
        return true;
      }),
      match: vi.fn().mockResolvedValue(undefined),
      open: vi.fn(),
    });
    purgeSessionCaches();
    await vi.waitFor(() => {
      expect(deleted).toEqual(expect.arrayContaining(['medu-v1', 'medu-static-v1']));
    });
    // Buckets belonging to other origins/apps must not be touched.
    expect(deleted).not.toContain('other-app');
  });

  it('never throws when Cache Storage is unavailable (insecure context)', () => {
    // jsdom has no `caches` — this is the insecure-context path.
    expect(() => purgeSessionCaches()).not.toThrow();
  });

  it('never throws when Cache Storage rejects', async () => {
    vi.stubGlobal('caches', {
      keys: vi.fn().mockRejectedValue(new Error('SecurityError')),
      delete: vi.fn(),
      match: vi.fn(),
      open: vi.fn(),
    });
    expect(() => purgeSessionCaches()).not.toThrow();
    // Allow the rejected promise chain to settle without unhandled rejection.
    await new Promise((r) => setTimeout(r, 0));
  });
});
