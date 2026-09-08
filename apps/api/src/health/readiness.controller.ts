import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Readiness probe — distinguishes "process is up" (liveness, /health) from
 * "process can actually serve traffic" (readiness, /readiness).
 *
 * Readiness returns HTTP 503 while a critical dependency (the database) is
 * unreachable so orchestrators stop routing traffic / restart the pod.
 * Internals are never exposed: only a coarse status + database flag.
 */
@ApiTags('Health')
@Controller('readiness')
@SkipThrottle()
export class ReadinessController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Readiness probe — 200 when ready, 503 while a critical dependency is down' })
  async check(@Res() res: Response) {
    let database = 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = 'up';
    } catch {
      database = 'down';
    }

    const ready = database === 'up';
    return res.status(ready ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).json({
      status: ready ? 'ready' : 'not_ready',
      database,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  }
}
