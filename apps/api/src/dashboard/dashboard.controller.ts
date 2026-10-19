import { Controller, Get, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { OrgRateLimiter } from '../camera/org-rate-limiter';
import { DashboardService } from './dashboard.service';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  /** Per-tenant bound on dashboard aggregation queries (see AnalyticsController). */
  private readonly orgLimiter = new OrgRateLimiter();

  constructor(private readonly dashboardService: DashboardService) {}

  @Roles('ORG_ADMIN', 'MANAGER', 'SUPER_ADMIN')
  @Get('stats')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  getStats(@CurrentUser('organizationId') orgId: string) {
    if (!orgId) {
      throw new BadRequestException('Organization context is required');
    }
    this.orgLimiter.assert(orgId, 'dashboard-stats', 60, 60_000);
    return this.dashboardService.getStats(orgId);
  }

  @Roles('ORG_ADMIN', 'MANAGER', 'SUPER_ADMIN')
  @Get('revenue')
  @ApiOperation({ summary: 'Get dashboard monthly revenue series' })
  getRevenue(
    @CurrentUser('organizationId') orgId: string,
    @Query('period') period?: string,
  ) {
    if (!orgId) {
      throw new BadRequestException('Organization context is required');
    }
    this.orgLimiter.assert(orgId, 'dashboard-revenue', 60, 60_000);
    return this.dashboardService.getMonthlyRevenue(orgId, period);
  }
}
