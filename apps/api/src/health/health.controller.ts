import { Controller, Get, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AllowPublic } from '../auth/public.decorator';

@ApiTags('Health')
@AllowPublic()
@Controller('health')
// Health probes are exempt from rate limiting: orchestrators, load balancers
// and uptime monitors poll them far more often than interactive endpoints,
// and they perform no sensitive work.
@SkipThrottle()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Liveness + readiness check' })
  async check(@Res({ passthrough: true }) res: Response) {
    let database = 'down';
    try {
      if (typeof this.prisma.ping === 'function') {
        const isUp = await this.prisma.ping();
        database = isUp ? 'up' : 'down';
      } else {
        await this.prisma.$queryRaw`SELECT 1`;
        database = 'up';
      }
    } catch {
      database = 'down';
    }
    const payload = {
      status: database === 'up' ? 'ok' : 'degraded',
      database,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
    // The /health route doubles as the Docker HEALTHCHECK target. A dead
    // database means the container serves 500s while reporting healthy, so
    // the probe must fail (503) whenever the DB is unreachable.
    if (database !== 'up') {
      res.status(503);
    }
    return payload;
  }

  @Get('liveness')
  @ApiOperation({ summary: 'Kubernetes/Cloud Liveness probe — checks if process is responding' })
  liveness() {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('readiness')
  @ApiOperation({ summary: 'Kubernetes/Cloud Readiness probe — checks database connection' })
  async readiness(@Res({ passthrough: true }) res: Response) {
    let database = 'down';
    try {
      if (typeof this.prisma.ping === 'function') {
        const isUp = await this.prisma.ping();
        database = isUp ? 'up' : 'down';
      } else {
        await this.prisma.$queryRaw`SELECT 1`;
        database = 'up';
      }
    } catch {
      database = 'down';
    }

    if (database !== 'up') {
      res.status(503);
      return { status: 'down', database, timestamp: new Date().toISOString() };
    }

    return { status: 'ready', database, timestamp: new Date().toISOString() };
  }

  @Get('detailed')
  @ApiOperation({ summary: 'Detailed system health metrics for operators and monitoring' })
  async detailed(@Res({ passthrough: true }) res: Response) {
    let database = 'down';
    let dbLatencyMs = -1;
    const start = performance.now();
    try {
      if (typeof this.prisma.ping === 'function') {
        const isUp = await this.prisma.ping();
        database = isUp ? 'up' : 'down';
      } else {
        await this.prisma.$queryRaw`SELECT 1`;
        database = 'up';
      }
      dbLatencyMs = Math.round(performance.now() - start);
    } catch {
      database = 'down';
    }

    const mem = process.memoryUsage();
    const toMb = (bytes: number) => Math.round((bytes / 1024 / 1024) * 100) / 100;

    const payload = {
      status: database === 'up' ? 'ok' : 'degraded',
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      uptimeSeconds: Math.round(process.uptime()),
      database: {
        status: database,
        latencyMs: dbLatencyMs,
      },
      memory: {
        rssMb: toMb(mem.rss),
        heapTotalMb: toMb(mem.heapTotal),
        heapUsedMb: toMb(mem.heapUsed),
        externalMb: toMb(mem.external),
        heapUsagePercent: Math.round((mem.heapUsed / mem.heapTotal) * 100),
        pressure: (mem.heapUsed / mem.heapTotal) > 0.85 ? 'high' : 'normal',
      },
      timestamp: new Date().toISOString(),
    };

    if (database !== 'up') {
      res.status(503);
    }
    return payload;
  }
}
