import { Injectable, Logger } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import { Redis } from 'ioredis';

@Injectable()
export class ResilientRedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(ResilientRedisThrottlerStorage.name);
  private redis: Redis;
  private isRedisConnected = false;
  private memoryStorage = new Map<string, { totalHits: number; expiresAt: number }>();

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
      retryStrategy: (times) => {
        return Math.min(times * 1000, 5000);
      },
    });

    this.redis.on('connect', () => {
      this.isRedisConnected = true;
      this.logger.log('Redis connected for Throttler');
    });

    this.redis.on('error', (err) => {
      if (this.isRedisConnected) {
        this.logger.error(`Redis error: ${err.message}`);
      }
      this.isRedisConnected = false;
    });
  }

  async increment(key: string, ttl: number, limit: number, blockDuration: number, throttlerName: string): Promise<ThrottlerStorageRecord> {
    if (this.isRedisConnected) {
      try {
        const fullKey = `throttler:${throttlerName}:${key}`;
        const multi = this.redis.multi();
        multi.incr(fullKey);
        multi.pttl(fullKey);
        const results = await multi.exec();
        
        if (!results) {
            throw new Error('Redis multi failed');
        }

        const hits = results[0][1] as number;
        let timeToLive = results[1][1] as number;

        if (timeToLive === -1 || timeToLive === -2) {
          await this.redis.pexpire(fullKey, ttl);
          timeToLive = ttl;
        }

        return {
          totalHits: hits,
          timeToExpire: Math.ceil(timeToLive / 1000),
          isBlocked: hits > limit,
          timeToBlockExpire: hits > limit ? Math.ceil(blockDuration / 1000) : 0,
        };
      } catch (err) {
        this.logger.warn(`Redis throttling failed, falling back to memory: ${err.message}`);
        this.isRedisConnected = false;
      }
    }

    return this.memoryIncrement(key, ttl, limit, blockDuration, throttlerName);
  }

  private memoryIncrement(key: string, ttl: number, limit: number, blockDuration: number, throttlerName: string): ThrottlerStorageRecord {
    const fullKey = `throttler:${throttlerName}:${key}`;
    const now = Date.now();
    
    let record = this.memoryStorage.get(fullKey);
    if (!record || record.expiresAt < now) {
      record = { totalHits: 0, expiresAt: now + ttl };
    }

    record.totalHits += 1;
    this.memoryStorage.set(fullKey, record);

    if (Math.random() < 0.01) {
      for (const [k, v] of this.memoryStorage.entries()) {
        if (v.expiresAt < now) {
          this.memoryStorage.delete(k);
        }
      }
    }

    return {
      totalHits: record.totalHits,
      timeToExpire: Math.ceil((record.expiresAt - now) / 1000),
      isBlocked: record.totalHits > limit,
      timeToBlockExpire: record.totalHits > limit ? Math.ceil(blockDuration / 1000) : 0,
    };
  }
}
