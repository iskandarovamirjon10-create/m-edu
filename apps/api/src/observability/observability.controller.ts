import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ObservabilityService } from './observability.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

/**
 * Observability endpoints expose infrastructure-sensitive data: DB connection
 * stats, queue depths, host memory/CPU, integration configuration status and
 * per-endpoint latency/error breakdowns. This intel is exactly what an
 * attacker needs to plan an intrusion, so every route here is locked to
 * SUPER_ADMIN and requires a valid JWT (never publicly reachable).
 */
@ApiTags('Observability')
@ApiBearerAuth()
@Controller('observability')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class ObservabilityController {
  constructor(private readonly observabilityService: ObservabilityService) {}

  @Get('health')
  async getHealthCheck() {
    return this.observabilityService.getHealthCheck();
  }

  @Get('metrics')
  async getSystemMetrics() {
    return this.observabilityService.getSystemMetrics();
  }

  @Get('queues')
  async getQueueHealth() {
    return this.observabilityService.getQueueHealth();
  }

  @Get('integrations')
  getIntegrationHealth() {
    return this.observabilityService.getIntegrationHealth();
  }

  @Get('api-metrics')
  getApiMetrics(@Query('period') period?: string) {
    return this.observabilityService.getApiMetrics(period);
  }

  @Get('database')
  async getDatabaseMetrics() {
    return this.observabilityService.getDatabaseMetrics();
  }
}

