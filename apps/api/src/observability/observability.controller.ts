import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ObservabilityService } from './observability.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { AllowAnyRole } from '../auth/roles.decorator';

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

  @AllowAnyRole()
  @Get('health')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  async getHealthCheck() {
    return this.observabilityService.getHealthCheck();
  }

  @AllowAnyRole()
  @Get('metrics')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  async getSystemMetrics() {
    return this.observabilityService.getSystemMetrics();
  }

  @AllowAnyRole()
  @Get('queues')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  async getQueueHealth() {
    return this.observabilityService.getQueueHealth();
  }

  @AllowAnyRole()
  @Get('integrations')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  getIntegrationHealth() {
    return this.observabilityService.getIntegrationHealth();
  }

  @AllowAnyRole()
  @Get('api-metrics')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  getApiMetrics(@Query('period') period?: string) {
    return this.observabilityService.getApiMetrics(period);
  }

  @AllowAnyRole()
  @Get('database')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  async getDatabaseMetrics() {
    return this.observabilityService.getDatabaseMetrics();
  }
}
