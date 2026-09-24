import { Logger } from '@nestjs/common';
import * as crypto from 'node:crypto';

export interface DistributedLockOptions {
  ttlMs?: number;
  timeoutMs?: number;
}

const DEFAULT_TTL_MS = 60_000;
const DEFAULT_TIMEOUT_MS = 10_000;

const LUA_RELEASE_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end
`;

export class DistributedLockService {
  private readonly logger = new Logger(DistributedLockService.name);

  constructor(private readonly redisClient: {
    set: (key: string, value: string, mode: 'PX', ttl: number, flag: 'NX') => Promise<boolean | null | string>;
    eval: (script: string, numKeys: number, ...args: (string | number)[]) => Promise<unknown>;
  }) {}

  async acquireLock(
    key: string,
    opts: DistributedLockOptions = {},
  ): Promise<string | null> {
    const ttl = opts.ttlMs ?? DEFAULT_TTL_MS;
    const timeout = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const lockValue = crypto.randomUUID();

    const start = Date.now();

    while (Date.now() - start < timeout) {
      const result = await this.redisClient.set(key, lockValue, 'PX', ttl, 'NX');
      if (result === true || result === 'OK') {
        this.logger.debug(`Lock acquired: ${key}`);
        return lockValue;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.logger.warn(`Lock acquisition timed out: ${key}`);
    return null;
  }

  async releaseLock(key: string, lockValue: string): Promise<void> {
    try {
      const result = await this.redisClient.eval(
        LUA_RELEASE_SCRIPT,
        1,
        key,
        lockValue,
      );

      if (result === 1) {
        this.logger.debug(`Lock released: ${key}`);
      } else {
        this.logger.debug(`Lock not held or expired: ${key}`);
      }
    } catch (err: unknown) {
      this.logger.warn(`Failed to release lock: ${key}`, err instanceof Error ? err.stack : String(err));
    }
  }

  async withLock<T>(
    key: string,
    fn: () => Promise<T>,
    opts: DistributedLockOptions = {},
  ): Promise<T | null> {
    const lockValue = await this.acquireLock(key, opts);
    if (!lockValue) {
      return null;
    }

    try {
      return await fn();
    } finally {
      await this.releaseLock(key, lockValue);
    }
  }
}
