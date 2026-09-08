import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { SystemHealthService } from './system-health.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('System Health')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
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
