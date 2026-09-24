import { Injectable, Logger } from '@nestjs/common';
import { cpus, loadavg, totalmem, freemem } from 'os';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsMiddleware } from './metrics.middleware';

@Injectable()
export class ObservabilityService {
  private readonly logger = new Logger(ObservabilityService.name);
  private readonly startTime = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly metricsMiddleware: MetricsMiddleware,
  ) {}

  async getHealthCheck() {
    const [postgres, redis] = await Promise.allSettled([
      this.checkPostgres(),
      this.checkRedis(),
    ]);

    const mem = process.memoryUsage();

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      services: {
        postgres: postgres.status === 'fulfilled' ? postgres.value : { status: 'down', error: (postgres.reason as Error)?.message },
        redis: redis.status === 'fulfilled' ? redis.value : { status: 'down', error: (redis.reason as Error)?.message },
      },
      memory: {
        rss: mem.rss,
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
        external: mem.external,
      },
    };
  }

  async getSystemMetrics() {
    const mem = process.memoryUsage();
    const cpuInfo = cpus();
    const loadAvg = loadavg();
    const totalMem = totalmem();
    const freeMem = freemem();

    return {
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cpu: {
        model: cpuInfo[0]?.model ?? 'unknown',
        cores: cpuInfo.length,
        loadAverage: {
          '1m': Math.round(loadAvg[0] * 100) / 100,
          '5m': Math.round(loadAvg[1] * 100) / 100,
          '15m': Math.round(loadAvg[2] * 100) / 100,
        },
      },
      memory: {
        total: totalMem,
        free: freeMem,
        used: totalMem - freeMem,
        usagePercent: Math.round(((totalMem - freeMem) / totalMem) * 10000) / 100,
        process: {
          rss: mem.rss,
          heapUsed: mem.heapUsed,
          heapTotal: mem.heapTotal,
          external: mem.external,
        },
      },
    };
  }

  async getQueueHealth(): Promise<Array<{
    name: string;
    status: string;
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }>> {
    try {
      const { Queue } = await import('bullmq');
      const host = process.env.REDIS_HOST || 'localhost';
      const port = Number(process.env.REDIS_PORT) || 6379;

      const queueNames = ['background-jobs'];
      const results: Array<{
        name: string;
        status: string;
        waiting: number;
        active: number;
        completed: number;
        failed: number;
        delayed: number;
      }> = [];

      for (const name of queueNames) {
        let queue: InstanceType<typeof Queue> | null = null;
        try {
          queue = new Queue(name, { 
            connection: { 
              host, 
              port, 
              maxRetriesPerRequest: 0, 
              connectTimeout: 500,
              commandTimeout: 500,
            } 
          });
          
          const statsPromise = Promise.all([
            queue.getWaitingCount(),
            queue.getActiveCount(),
            queue.getCompletedCount(),
            queue.getFailedCount(),
            queue.getDelayedCount(),
          ]);

          // Enforce a hard 1-second timeout
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Redis timeout')), 1000)
          );

          const [waiting, active, completed, failed, delayed] = 
            await Promise.race([statsPromise, timeoutPromise]) as number[];
            
          results.push({ name, status: 'healthy', waiting, active, completed, failed, delayed });
        } catch {
          results.push({ name, status: 'down', waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 });
        } finally {
          if (queue) {
            // Fire and forget close, don't await to avoid hanging on disconnect
            queue.close().catch(() => undefined);
          }
        }
      }

      return results;
    } catch {
      return [{ name: 'background-jobs', status: 'unavailable', waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 }];
    }
  }

  getIntegrationHealth() {
    return [
      { name: 'Telegram Bot', status: process.env.TELEGRAM_BOT_TOKEN ? 'configured' : 'not_configured', details: 'Bot token ' + (process.env.TELEGRAM_BOT_TOKEN ? 'present' : 'missing') },
      { name: 'SMS Provider', status: process.env.SMS_API_KEY ? 'configured' : 'not_configured', details: 'API key ' + (process.env.SMS_API_KEY ? 'present' : 'missing') },
      { name: 'SMTP Email', status: process.env.SMTP_HOST ? 'configured' : 'not_configured', details: 'SMTP host ' + (process.env.SMTP_HOST ?? 'not set') },
      { name: 'External APIs', status: 'implemented', details: 'Integration layer ready' },
    ];
  }

  getApiMetrics(period?: string) {
    return this.metricsMiddleware.getMetrics(period);
  }

  async getDatabaseMetrics() {
    try {
      const result = await this.prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*) as count FROM pg_stat_activity WHERE datname = current_database()`;
      const activeConnections = Number(result[0]?.count ?? 0);

      const stats = await this.prisma.$queryRaw<Array<{ tup_returned: bigint; tup_fetched: bigint; xact_commit: bigint; xact_rollback: bigint; blks_read: bigint; blks_hit: bigint }>>`SELECT tup_returned, tup_fetched, xact_commit, xact_rollback, blks_read, blks_hit
         FROM pg_stat_database WHERE datname = current_database()`;

      const s = stats[0];
      return {
        activeConnections,
        totalQueries: s ? Number(s.xact_commit) + Number(s.xact_rollback) : 0,
        committedQueries: s ? Number(s.xact_commit) : 0,
        rolledBackQueries: s ? Number(s.xact_rollback) : 0,
        cacheHitRatio: s && Number(s.blks_hit) + Number(s.blks_read) > 0
          ? Math.round((Number(s.blks_hit) / (Number(s.blks_hit) + Number(s.blks_read))) * 10000) / 100
          : 0,
        tuplesReturned: s ? Number(s.tup_returned) : 0,
        tuplesFetched: s ? Number(s.tup_fetched) : 0,
      };
    } catch (error) {
      this.logger.warn(`Database metrics query failed: ${(error as Error).message}`);
      return { activeConnections: 0, totalQueries: 0, committedQueries: 0, rolledBackQueries: 0, cacheHitRatio: 0, tuplesReturned: 0, tuplesFetched: 0 };
    }
  }

  private async checkPostgres() {
    const start = Date.now();
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'connected', responseTimeMs: Date.now() - start };
  }

  private async checkRedis(): Promise<{ status: string; responseTimeMs: number }> {
    try {
      const RedisModule = await import('ioredis');
      const RedisCtor = (RedisModule.default ?? RedisModule) as unknown as {
        new (opts: Record<string, unknown>): {
          ping(): Promise<string>;
          quit(): Promise<unknown>;
        };
      };
      const host = process.env.REDIS_HOST || 'localhost';
      const port = Number(process.env.REDIS_PORT) || 6379;
      const client = new RedisCtor({ host, port, maxRetriesPerRequest: 1, connectTimeout: 3000 });
      const start = Date.now();
      const pong = await client.ping();
      await client.quit();
      return { status: pong === 'PONG' ? 'connected' : 'degraded', responseTimeMs: Date.now() - start };
    } catch {
      return { status: 'down', responseTimeMs: 0 };
    }
  }
}
