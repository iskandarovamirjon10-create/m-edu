import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryCache } from '../cache.util';

describe('MemoryCache', () => {
  let cache: MemoryCache<string>;

  beforeEach(() => {
    cache = new MemoryCache<string>(1000);
  });

  it('stores and retrieves values', () => {
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  it('returns undefined for missing keys', () => {
    expect(cache.get('missing')).toBeUndefined();
  });

  it('returns undefined for expired entries', async () => {
    cache.set('key1', 'value1', 10);
    await new Promise((r) => setTimeout(r, 20));
    expect(cache.get('key1')).toBeUndefined();
  });

  it('uses default TTL when none specified', async () => {
    const c = new MemoryCache<number>(50);
    c.set('k', 42);
    expect(c.get('k')).toBe(42);
    await new Promise((r) => setTimeout(r, 60));
    expect(c.get('k')).toBeUndefined();
  });

  it('has() returns true for valid entries', () => {
    cache.set('a', 'b');
    expect(cache.has('a')).toBe(true);
    expect(cache.has('nope')).toBe(false);
  });

  it('has() returns false for expired entries', async () => {
    cache.set('a', 'b', 10);
    await new Promise((r) => setTimeout(r, 20));
    expect(cache.has('a')).toBe(false);
  });

  it('invalidate removes a key', () => {
    cache.set('k', 'v');
    cache.invalidate('k');
    expect(cache.get('k')).toBeUndefined();
  });

  it('invalidatePrefix removes matching keys', () => {
    cache.set('dash:1', 'a');
    cache.set('dash:2', 'b');
    cache.set('other:1', 'c');
    cache.invalidatePrefix('dash:');
    expect(cache.get('dash:1')).toBeUndefined();
    expect(cache.get('dash:2')).toBeUndefined();
    expect(cache.get('other:1')).toBe('c');
  });

  it('clear removes all entries', () => {
    cache.set('a', '1');
    cache.set('b', '2');
    cache.clear();
    expect(cache.size()).toBe(0);
  });

  it('size() returns count of valid entries', () => {
    cache.set('a', '1');
    cache.set('b', '2');
    expect(cache.size()).toBe(2);
  });

  it('overwrites existing key', () => {
    cache.set('k', 'v1');
    cache.set('k', 'v2');
    expect(cache.get('k')).toBe('v2');
  });
});

describe('PerformanceService', () => {
  it('can be imported', async () => {
    const mod = await import('../performance.service');
    expect(mod.PerformanceService).toBeDefined();
  });
});
