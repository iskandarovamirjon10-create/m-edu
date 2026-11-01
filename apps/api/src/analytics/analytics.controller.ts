import { Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { OrgRateLimiter } from '../camera/org-rate-limiter';
import { AnalyticsService } from './analytics.service';
import { FinancialBrainService } from './financial-brain.service';
import { ExecutiveSummaryService } from './executive-summary.service';
import { PayrollAnalyticsService } from './payroll-analytics.service';
import { CrmAnalyticsService } from './crm-analytics.service';
import { AnomalyDetectionService } from './anomaly-detection.service';
import { ReconciliationService } from './reconciliation.service';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER')
@Controller('analytics')
export class AnalyticsController {
  private readonly orgLimiter = new OrgRateLimiter();

  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly financialBrainService: FinancialBrainService,
    private readonly executiveSummaryService: ExecutiveSummaryService,
    private readonly payrollAnalyticsService: PayrollAnalyticsService,
    private readonly crmAnalyticsService: CrmAnalyticsService,
    private readonly anomalyDetectionService: AnomalyDetectionService,
    private readonly reconciliationService: ReconciliationService,
  ) {}

  // ── Overview ──────────────────────────────────────────────────────

  @Get('overview')
  @ApiOperation({ summary: 'Get analytics overview' })
  getOverview(@CurrentUser('organizationId') orgId: string) {
    if (!orgId) throw new ForbiddenException('Organization context is required');
    this.orgLimiter.assert(orgId, 'analytics-overview', 30, 60_000);
    return this.analyticsService.getOverview(orgId);
  }

  @Get('groups/:id/profitability')
  @ApiOperation({ summary: 'Get group profitability and contribution' })
  getGroupProfitability(
    @CurrentUser('organizationId') orgId: string,
    @Param('id', ParseUUIDPipe) groupId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    if (!orgId) throw new ForbiddenException('Organization context is required');
    this.orgLimiter.assert(orgId, 'analytics-profitability', 60, 60_000);
    const start = (() => { const d = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1); return Number.isNaN(d.getTime()) ? new Date(new Date().getFullYear(), 0, 1) : d; })();
    const end = endDate ? new Date(endDate) : new Date();
    return this.financialBrainService.getGroupContribution(orgId, groupId, start, end);
  }

  // ── Executive Summary ─────────────────────────────────────────────

  @Get('executive-summary')
  @ApiOperation({ summary: 'Executive dashboard summary' })
  getExecutiveSummary(@CurrentUser('organizationId') orgId: string) {
    this.orgLimiter.assert(orgId, 'analytics-executive', 30, 60_000);
    return this.executiveSummaryService.getSummary(orgId);
  }

  // ── Payroll Analytics ─────────────────────────────────────────────

  @Get('payroll/summary')
  @ApiOperation({ summary: 'Payroll summary analytics' })
  getPayrollSummary(
    @CurrentUser('organizationId') orgId: string,
    @Query('period') period?: string,
  ) {
    this.orgLimiter.assert(orgId, 'analytics-payroll', 30, 60_000);
    return this.payrollAnalyticsService.getPayrollSummary(orgId, period);
  }

  @Get('payroll/by-teacher')
  @ApiOperation({ summary: 'Payroll breakdown by teacher' })
  getPayrollByTeacher(
    @CurrentUser('organizationId') orgId: string,
    @Query('period') period?: string,
  ) {
    this.orgLimiter.assert(orgId, 'analytics-payroll', 30, 60_000);
    return this.payrollAnalyticsService.getPayrollByTeacher(orgId, period);
  }

  @Get('payroll/trend')
  @ApiOperation({ summary: 'Payroll trend over time' })
  getPayrollTrend(
    @CurrentUser('organizationId') orgId: string,
    @Query('months') months?: string,
  ) {
    this.orgLimiter.assert(orgId, 'analytics-payroll', 30, 60_000);
    return this.payrollAnalyticsService.getPayrollTrend(orgId, months ? Number(months) : undefined);
  }

  @Get('payroll/ratio')
  @ApiOperation({ summary: 'Payroll-to-revenue ratio' })
  getPayrollRatio(
    @CurrentUser('organizationId') orgId: string,
    @Query('months') months?: string,
  ) {
    this.orgLimiter.assert(orgId, 'analytics-payroll', 30, 60_000);
    return this.payrollAnalyticsService.getPayrollToRevenueRatio(orgId, months ? Number(months) : undefined);
  }

  @Get('payroll/efficiency')
  @ApiOperation({ summary: 'Lesson cost efficiency analytics' })
  getPayrollEfficiency(@CurrentUser('organizationId') orgId: string) {
    this.orgLimiter.assert(orgId, 'analytics-payroll', 30, 60_000);
    return this.payrollAnalyticsService.getLessonEfficiency(orgId);
  }

  // ── CRM Analytics ─────────────────────────────────────────────────

  @Get('crm/funnel')
  @ApiOperation({ summary: 'CRM funnel analysis' })
  getCrmFunnel(@CurrentUser('organizationId') orgId: string) {
    this.orgLimiter.assert(orgId, 'analytics-crm', 30, 60_000);
    return this.crmAnalyticsService.getFunnelAnalysis(orgId);
  }

  @Get('crm/sources')
  @ApiOperation({ summary: 'Lead source performance' })
  getCrmSources(@CurrentUser('organizationId') orgId: string) {
    this.orgLimiter.assert(orgId, 'analytics-crm', 30, 60_000);
    return this.crmAnalyticsService.getSourcePerformance(orgId);
  }

  @Get('crm/velocity')
  @ApiOperation({ summary: 'Pipeline velocity metrics' })
  getCrmVelocity(@CurrentUser('organizationId') orgId: string) {
    this.orgLimiter.assert(orgId, 'analytics-crm', 30, 60_000);
    return this.crmAnalyticsService.getPipelineVelocity(orgId);
  }

  @Get('crm/lost-reasons')
  @ApiOperation({ summary: 'Lead loss reasons breakdown' })
  getCrmLostReasons(@CurrentUser('organizationId') orgId: string) {
    this.orgLimiter.assert(orgId, 'analytics-crm', 30, 60_000);
    return this.crmAnalyticsService.getLostReasons(orgId);
  }

  @Get('crm/aging')
  @ApiOperation({ summary: 'Lead aging analysis' })
  getCrmAging(
    @CurrentUser('organizationId') orgId: string,
    @Query('limit') limit?: string,
  ) {
    this.orgLimiter.assert(orgId, 'analytics-crm', 30, 60_000);
    return this.crmAnalyticsService.getLeadAging(orgId, limit ? Number(limit) : undefined);
  }

  @Get('crm/moderators')
  @ApiOperation({ summary: 'Moderator activity analytics' })
  getCrmModerators(@CurrentUser('organizationId') orgId: string) {
    this.orgLimiter.assert(orgId, 'analytics-crm', 30, 60_000);
    return this.crmAnalyticsService.getModeratorActivity(orgId);
  }

  // ── Anomaly Detection ─────────────────────────────────────────────

  @Get('anomalies')
  @ApiOperation({ summary: 'Detect all anomalies' })
  getAnomalies(@CurrentUser('organizationId') orgId: string) {
    this.orgLimiter.assert(orgId, 'analytics-anomalies', 30, 60_000);
    return this.anomalyDetectionService.detectAll(orgId);
  }

  // ── Financial Brain ───────────────────────────────────────────────

  @Get('financial/cash-flow')
  @ApiOperation({ summary: 'Cash flow analysis' })
  getCashFlow(
    @CurrentUser('organizationId') orgId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    this.orgLimiter.assert(orgId, 'analytics-financial', 30, 60_000);
    const start = (() => { const d = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1); return Number.isNaN(d.getTime()) ? new Date(new Date().getFullYear(), 0, 1) : d; })();
    const end = endDate ? new Date(endDate) : new Date();
    return this.financialBrainService.getCashFlow(orgId, start, end);
  }

  @Get('financial/forecast')
  @ApiOperation({ summary: 'Financial forecast' })
  getForecast(
    @CurrentUser('organizationId') orgId: string,
    @Query('days') days?: string,
  ) {
    this.orgLimiter.assert(orgId, 'analytics-financial', 30, 60_000);
    return this.financialBrainService.getForecast(orgId, days ? Number(days) : 30);
  }

  @Get('financial/anomalies')
  @ApiOperation({ summary: 'Financial anomaly detection' })
  getFinancialAnomalies(
    @CurrentUser('organizationId') orgId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    this.orgLimiter.assert(orgId, 'analytics-financial', 30, 60_000);
    const start = (() => { const d = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1); return Number.isNaN(d.getTime()) ? new Date(new Date().getFullYear(), 0, 1) : d; })();
    const end = endDate ? new Date(endDate) : new Date();
    return this.financialBrainService.detectAnomalies(orgId, start, end);
  }

  @Get('financial/what-if')
  @ApiOperation({ summary: 'What-if financial simulation' })
  async getWhatIf(
    @CurrentUser('organizationId') orgId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('priceIncrease') priceIncrease?: string,
    @Query('studentVolume') studentVolume?: string,
    @Query('payrollIncrease') payrollIncrease?: string,
  ) {
    this.orgLimiter.assert(orgId, 'analytics-financial', 30, 60_000);
    const start = (() => { const d = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1); return Number.isNaN(d.getTime()) ? new Date(new Date().getFullYear(), 0, 1) : d; })();
    const end = endDate ? new Date(endDate) : new Date();
    const baseCashFlow = await this.financialBrainService.getCashFlow(orgId, start, end);
    return this.financialBrainService.simulateWhatIf(baseCashFlow as any, {
      priceIncreasePercent: priceIncrease ? Number(priceIncrease) : undefined,
      studentVolumePercent: studentVolume ? Number(studentVolume) : undefined,
      payrollIncreasePercent: payrollIncrease ? Number(payrollIncrease) : undefined,
    });
  }

  @Get('financial/reconciliation')
  @ApiOperation({ summary: 'Financial period reconciliation' })
  getReconciliation(
    @CurrentUser('organizationId') orgId: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    this.orgLimiter.assert(orgId, 'analytics-financial', 30, 60_000);
    const y = (year ? Number(year) : new Date().getFullYear()) || new Date().getFullYear();
    const m = month ? Number(month) : new Date().getMonth() + 1;
    return this.financialBrainService.reconcilePeriod(orgId, y, m);
  }

  // ── Reconciliation ────────────────────────────────────────────────

  @Get('reconciliation/report')
  @ApiOperation({ summary: 'Full reconciliation report' })
  getReconciliationReport(
    @CurrentUser('organizationId') orgId: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    this.orgLimiter.assert(orgId, 'analytics-reconciliation', 30, 60_000);
    const y = (year ? Number(year) : new Date().getFullYear()) || new Date().getFullYear();
    const m = month ? Number(month) : new Date().getMonth() + 1;
    return this.reconciliationService.getReconciliationReport(orgId, y, m);
  }

  @Get('reconciliation/discrepancies')
  @ApiOperation({ summary: 'Detect reconciliation discrepancies' })
  getReconciliationDiscrepancies(
    @CurrentUser('organizationId') orgId: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    this.orgLimiter.assert(orgId, 'analytics-reconciliation', 30, 60_000);
    const y = (year ? Number(year) : new Date().getFullYear()) || new Date().getFullYear();
    const m = month ? Number(month) : new Date().getMonth() + 1;
    return this.reconciliationService.detectDiscrepancies(orgId, y, m);
  }

  @Get('reconciliation/student-balances')
  @ApiOperation({ summary: 'Student balance report' })
  getStudentBalances(@CurrentUser('organizationId') orgId: string) {
    this.orgLimiter.assert(orgId, 'analytics-reconciliation', 30, 60_000);
    return this.reconciliationService.getStudentBalanceReport(orgId);
  }

  @Get('reconciliation/history')
  @ApiOperation({ summary: 'Reconciliation history' })
  getReconciliationHistory(@CurrentUser('organizationId') orgId: string) {
    this.orgLimiter.assert(orgId, 'analytics-reconciliation', 30, 60_000);
    return this.reconciliationService.getReconciliationHistory(orgId);
  }
}

