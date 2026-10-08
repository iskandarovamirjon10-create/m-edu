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

  async publish(channel: string, payload: any): Promise<void> {
    if (!this.pubClient) return;
    try {
      const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
      await this.pubClient.publish(channel, message);
    } catch (err) {
      this.logger.warn(`Failed to publish to ${channel}: ${getErrorMessage(err)}`);
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.pubClient) return null;
    try {
      return await this.pubClient.get(key);
    } catch {
      return null;
    }
  }

  async set(key: string, value: string, ttlMs: number): Promise<void> {
    if (!this.pubClient) return;
    try {
      await this.pubClient.set(key, value, 'PX', ttlMs);
    } catch (err) {
      this.logger.warn(`Failed to set Redis key ${key}: ${getErrorMessage(err)}`);
    }
  }

  async subscribe(channel: string, handler: (payload: string) => void): Promise<void> {
    if (!this.subClient) return;
    
    let handlers = this.subscribers.get(channel);
    if (!handlers) {
      handlers = [];
      this.subscribers.set(channel, handlers);
      try {
        await this.subClient.subscribe(channel);
      } catch (err) {
        this.logger.warn(`Failed to subscribe to ${channel}: ${getErrorMessage(err)}`);
      }
    }
    handlers.push(handler);
  }
}

