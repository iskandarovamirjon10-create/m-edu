import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { redisQueueConnection, isRedisEnabled } from '../../config/redis.config';
import { getErrorMessage } from '../../lib/error';

@Injectable()
export class RedisPubSubService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisPubSubService.name);
  private pubClient: Redis | null = null;
  private subClient: Redis | null = null;
  private readonly subscribers = new Map<string, Array<(payload: string) => void>>();

  onModuleInit() {
    if (!isRedisEnabled()) {
      this.logger.warn('Redis is disabled. Real-time pub/sub will not work across replicas.');
      return;
    }

    const options = redisQueueConnection();
    
    // Create publisher
    this.pubClient = new Redis({
      ...options,
      enableOfflineQueue: false,
    });
    this.pubClient.on('error', (err) => this.logger.warn('PubClient error: ' + getErrorMessage(err)));

    // Create subscriber
    this.subClient = new Redis({
      ...options,
      enableOfflineQueue: false,
    });
    this.subClient.on('error', (err) => this.logger.warn('SubClient error: ' + getErrorMessage(err)));

    this.subClient.on('message', (channel, message) => {
      const handlers = this.subscribers.get(channel);
      if (handlers) {
        for (const handler of handlers) {
          try {
            handler(message);
          } catch (err) {
            this.logger.error(`Error in pub/sub handler for channel ${channel}`, getErrorMessage(err));
          }
        }
      }
    });
  }

  onModuleDestroy() {
    this.pubClient?.disconnect();
    this.subClient?.disconnect();
    this.pubClient = null;
    this.subClient = null;
  }

  /**
   * Liveness of the Redis connection, for readiness/health probes.
   *
   * Returns `true` when Redis is disabled for this process (development
   * escape hatch — Redis is not a dependency then), otherwise performs a
   * bounded PING and returns whether Redis answered. Never throws.
   */
  async ping(): Promise<boolean> {
    if (!isRedisEnabled()) return true;
    if (!this.pubClient) return false;
    try {
      return (await this.pubClient.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  private readonly memoryStore = new Map<string, { value: string; expiresAt: number }>();

  async publish(channel: string, payload: any): Promise<void> {
    const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
    if (!this.pubClient) {
      // Local in-memory dispatch when Redis is disabled or offline
      const handlers = this.subscribers.get(channel);
      if (handlers) {
        for (const handler of handlers) {
          try {
            handler(message);
          } catch (err) {
            this.logger.error(`Error in local pub/sub handler for channel ${channel}`, getErrorMessage(err));
          }
        }
      }
      return;
    }
    try {
      await this.pubClient.publish(channel, message);
    } catch (err) {
      this.logger.warn(`Failed to publish to ${channel}: ${getErrorMessage(err)}`);
      // Fallback local dispatch on publish error
      const handlers = this.subscribers.get(channel);
      if (handlers) {
        for (const handler of handlers) {
          try {
            handler(message);
          } catch (subErr) {
            this.logger.error(`Error in fallback pub/sub handler for channel ${channel}`, getErrorMessage(subErr));
          }
        }
      }
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.pubClient) {
      const entry = this.memoryStore.get(key);
      if (!entry) return null;
      if (Date.now() > entry.expiresAt) {
        this.memoryStore.delete(key);
        return null;
      }
      return entry.value;
    }
    try {
      return await this.pubClient.get(key);
    } catch {
      const entry = this.memoryStore.get(key);
      if (entry && Date.now() <= entry.expiresAt) {
        return entry.value;
      }
      return null;
    }
  }

  private pruneExpiredMemoryStore(): void {
    const now = Date.now();
    for (const [key, entry] of this.memoryStore.entries()) {
      if (now > entry.expiresAt) {
        this.memoryStore.delete(key);
      }
    }
  }

  async set(key: string, value: string, ttlMs: number): Promise<void> {
    if (this.memoryStore.size > 500) {
      this.pruneExpiredMemoryStore();
    }
    // Always keep in memory store as fallback
    this.memoryStore.set(key, { value, expiresAt: Date.now() + ttlMs });
    if (!this.pubClient) return;
    try {
      await this.pubClient.set(key, value, 'PX', ttlMs);
    } catch (err) {
      this.logger.warn(`Failed to set Redis key ${key}: ${getErrorMessage(err)}`);
    }
  }

  async setIfNotExists(key: string, value: string, ttlMs: number): Promise<boolean> {
    if (this.memoryStore.size > 500) {
      this.pruneExpiredMemoryStore();
    }
    if (this.pubClient) {
      try {
        const res = await this.pubClient.set(key, value, 'PX', ttlMs, 'NX');
        const success = res === 'OK';
        if (success) {
          this.memoryStore.set(key, { value, expiresAt: Date.now() + ttlMs });
        }
        return success;
      } catch (err) {
        this.logger.warn(`Failed to setNX Redis key ${key}: ${getErrorMessage(err)}`);
      }
    }
    const now = Date.now();
    const existing = this.memoryStore.get(key);
    if (existing && existing.expiresAt > now) {
      return false;
    }
    this.memoryStore.set(key, { value, expiresAt: now + ttlMs });
    return true;
  }

  async delete(key: string): Promise<void> {
    this.memoryStore.delete(key);
    if (!this.pubClient) return;
    try {
      await this.pubClient.del(key);
    } catch (err) {
      this.logger.warn(`Failed to delete Redis key ${key}: ${getErrorMessage(err)}`);
    }
  }

  async del(key: string): Promise<void> {
    return this.delete(key);
  }

  async subscribe(channel: string, handler: (payload: string) => void): Promise<void> {
    let handlers = this.subscribers.get(channel);
    if (!handlers) {
      handlers = [];
      this.subscribers.set(channel, handlers);
      if (this.subClient) {
        try {
          await this.subClient.subscribe(channel);
        } catch (err) {
          this.logger.warn(`Failed to subscribe to ${channel}: ${getErrorMessage(err)}`);
        }
      }
    }
    handlers.push(handler);
  }
}

