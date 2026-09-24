export class MemoryCache<T> {
  private cache = new Map<string, { data: T; expiresAt: number }>();

  constructor(private defaultTTL = 60000) {}

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.data;
  }

  set(key: string, data: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl ?? this.defaultTTL);
    this.cache.set(key, { data, expiresAt });

    if (Math.random() < 0.05) {
      const now = Date.now();
      for (const [k, v] of this.cache.entries()) {
        if (v.expiresAt < now) {
          this.cache.delete(k);
        }
      }
    }
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidatePrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) this.cache.delete(key);
    }
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    this.evictExpired();
    return this.cache.size;
  }

  keys(): string[] {
    this.evictExpired();
    return Array.from(this.cache.keys());
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) this.cache.delete(key);
    }
  }
}
