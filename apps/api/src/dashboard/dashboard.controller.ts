import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { OrgRateLimiter } from '../camera/org-rate-limiter';
import { DashboardService } from './dashboard.service';
import { AllowAnyRole } from '../auth/roles.decorator';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  /** Per-tenant bound on dashboard aggregation queries (see AnalyticsController). */
  private readonly orgLimiter = new OrgRateLimiter();

  constructor(private readonly dashboardService: DashboardService) {}

  @AllowAnyRole()
  @Get('stats')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  getStats(@CurrentUser('organizationId') orgId: string) {
    this.orgLimiter.assert(orgId, 'dashboard-stats', 60, 60_000);
    return this.dashboardService.getStats(orgId);
  }
}
