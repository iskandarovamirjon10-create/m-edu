import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { SystemHealthService } from './system-health.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ADMIN_ROLES } from '../auth/authorization.policy';

@ApiTags('System Health')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
@Controller('system-health')
export class SystemHealthController {
  constructor(private readonly systemHealthService: SystemHealthService) {}

  @SkipThrottle()
  @Get('summary')
  @ApiOperation({ summary: 'Get system health summary' })
  async getSummary() {
    return this.systemHealthService.getSummary();
  }

  @SkipThrottle()
  @Get('components')
  @ApiOperation({ summary: 'Get individual component health' })
  async getComponents() {
    const summary = await this.systemHealthService.getSummary();
    return summary.components;
  }
}
