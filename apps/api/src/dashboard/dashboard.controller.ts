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

  @Roles('PLATFORM_OWNER', 'SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER')
  @Get('stats')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  getStats(
    @CurrentUser('organizationId') orgId: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const effectiveOrgId = orgId || queryOrgId;
    if (!effectiveOrgId) {
      throw new BadRequestException('Organization context is required');
    }
    this.orgLimiter.assert(effectiveOrgId, 'dashboard-stats', 60, 60_000);
    return this.dashboardService.getStats(effectiveOrgId);
  }

  @Roles('PLATFORM_OWNER', 'SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER')
  @Get('revenue')
  @ApiOperation({ summary: 'Get dashboard monthly revenue series' })
  getRevenue(
    @CurrentUser('organizationId') orgId: string,
    @Query('period') period?: string,
    @Query('organizationId') queryOrgId?: string,
  ) {
    const effectiveOrgId = orgId || queryOrgId;
    if (!effectiveOrgId) {
      throw new BadRequestException('Organization context is required');
    }
    this.orgLimiter.assert(effectiveOrgId, 'dashboard-revenue', 60, 60_000);
    return this.dashboardService.getMonthlyRevenue(effectiveOrgId, period);
  }
}
