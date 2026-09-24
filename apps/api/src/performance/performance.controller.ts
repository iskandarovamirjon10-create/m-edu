import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { PerformanceService } from './performance.service';
import { AllowAnyRole } from '../auth/roles.decorator';

@ApiTags('Performance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('performance')
export class PerformanceController {
  constructor(private readonly performanceService: PerformanceService) {}

  @AllowAnyRole()
  @Get('audit')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Run comprehensive performance audit' })
  runAudit() {
    return this.performanceService.runPerformanceAudit();
  }

  @AllowAnyRole()
  @Get('slow-endpoints')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get slow endpoint tracking data' })
  getSlowEndpoints() {
    return this.performanceService.getSlowEndpoints();
  }

  @AllowAnyRole()
  @Get('cache-stats')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get cache hit/miss statistics' })
  getCacheStats() {
    return this.performanceService.getCacheStats();
  }
}
