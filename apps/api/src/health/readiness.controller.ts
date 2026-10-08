import { Controller, Get, HttpStatus, Optional, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { RedisPubSubService } from '../common/redis/redis-pubsub.service';
import { isRedisEnabled } from '../config/redis.config';
import { AllowPublic } from '../auth/public.decorator';

/**
 * Readiness probe — distinguishes "process is up" (liveness, /health) from
 * "process can actually serve traffic" (readiness, /readiness).
 *
 * Readiness returns HTTP 503 while a critical dependency is unreachable so
 * orchestrators stop routing traffic / restart the pod. The database is always
 * critical; Redis is critical whenever it is enabled (in production it is —
 * `assertValidConfig()` refuses to start production with Redis disabled),
 * because notifications and scheduled jobs are delivered through it. A
 * readiness probe that reported "ready" while Redis was down let an
 * orchestrator keep routing traffic to a replica that could not process
 * notifications or cron work.
 *
 * Internals are never exposed: only coarse status flags.
 */
@AllowPublic()
@Controller('readiness')
@SkipThrottle()
export class ReadinessController {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly redisPubSub?: RedisPubSubService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Readiness probe — 200 when ready, 503 while a critical dependency is down' })
  async check(@Res() res: Response) {
    let database: 'up' | 'down' = 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = 'up';
    } catch {
      database = 'down';
    }

    // Redis is a required runtime dependency in production (notification and
    // job queues). When disabled for local development it is not a
    // readiness gate at all.
    let redis: 'up' | 'down' | 'disabled' = 'disabled';
    if (isRedisEnabled()) {
      try {
        redis = (await this.redisPubSub?.ping()) ? 'up' : 'down';
      } catch {
        redis = 'down';
      }
    }

    const ready = database === 'up' && (redis === 'up' || redis === 'disabled');
    return res.status(ready ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).json({
      status: ready ? 'ready' : 'not_ready',
      database,
      redis,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  }
}