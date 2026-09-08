import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { OrgRateLimiter } from '../camera/org-rate-limiter';
import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('analytics')
export class AnalyticsController {
  /**
   * Per-tenant bound on expensive aggregation work: the overview query runs
   * ~10 aggregate/raw queries over the whole org dataset. The global
   * ThrottlerGuard only bounds per-user traffic, so one org with many
   * accounts could otherwise hammer the shared database. 30/min per org is
   * generous for real dashboards while capping cross-tenant load.
   */
  private readonly orgLimiter = new OrgRateLimiter();

  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get analytics overview' })
  getOverview(@CurrentUser('organizationId') orgId: string) {
    this.orgLimiter.assert(orgId, 'analytics-overview', 30, 60_000);
    return this.analyticsService.getOverview(orgId);
  }
}
