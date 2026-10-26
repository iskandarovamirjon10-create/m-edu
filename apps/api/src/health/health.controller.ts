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
}
