export interface Anomaly {
  type: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  metric: string;
  observed: number;
  baseline: number | null;
  period: string;
  recommendation: string;
  insufficientData?: boolean;
}

/**
 * Shape returned by GET /analytics/financial/anomalies — a leaner detector
 * than /analytics/anomalies (which returns the full Anomaly[] above).
 */
export interface FinancialAnomaly {
  type: string;
  description: string;
  severity: string;
  metric: string;
}

/** Shape returned by GET /analytics/financial/cash-flow. */
export interface CashFlowData {
  period?: { startDate: string; endDate: string };
  inflows: {
    cashCollected: number;
    refundsTotal: number;
    netCashInflow: number;
  };
  outflows: {
    expensesTotal: number;
    payrollTotal: number;
    totalOutflow: number;
  };
  netCashFlow: number;
}

export interface AcademicRiskSummary {
  total: number;
  high: number;
  medium: number;
  low: number;
  avgScore: number;
}

export interface AcademicRiskFactor {
  factorId: string;
  name: string;
  weight: number;
  score: number;
}

export interface AcademicRiskItem {
  studentId: string;
  studentName: string;
  groupId: string | null;
  groupName: string | null;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  riskScore: number;
  factors: AcademicRiskFactor[];
  lastGrade: number | null;
  attendanceRate: number;
  homeworkCompletion: number;
}

/** Shape returned by GET /analytics/financial/forecast. */
export type ForecastResult =
  | {
      status: 'CALCULATED';
      forecastDays: number;
      projectedRevenue: number;
      projectedPayroll: number;
      projectedExpenses: number;
      projectedNetCashFlow: number;
    }
  | { status: 'INSUFFICIENT_DATA'; reason?: string };

/** Shape returned by GET /analytics/financial/what-if. */
export type WhatIfSimulationData =
  | {
      status: 'SIMULATED';
      baseRevenue: number;
      projectedRevenue: number;
      basePayroll: number;
      projectedPayroll: number;
      baseNetCashFlow: number;
      projectedNetCashFlow: number;
      difference: number;
    }
  | { status: 'INSUFFICIENT_DATA'; reason?: string };

export interface ReconciliationData {
  receivables?: { totalInvoiced: number; totalPaid: number; difference: number };
  cashFlow?: { netCashFlow: number; outflows: number };
  expenses?: { total: number; general: number; payroll: number };
}

export interface EarlyWarningSummary {
  open: number;
  critical: number;
  high: number;
  resolvedThisWeek: number;
  byRule: Record<string, number>;
  total: number;
}

export interface WorkloadSummary {
  total: number;
  overloaded: number;
  balanced: number;
  underutilized: number;
  avgUtilization: number;
}

/** GET /analytics/crm/funnel */
/** Alias kept for the CALCULATED branch of the forecast union. */
export type ForecastData = Extract<ForecastResult, { status: 'CALCULATED' }>;

export interface CRMFunnelResponse {
  total: number;
  overallConversion: number;
  funnel: Array<{
    stage: string;
    count: number;
    conversionFromPrev: number;
    conversionFromTop: number;
  }>;
}

/** GET /analytics/crm/velocity */
export interface CRMVelocityResponse {
  stageVelocity: Array<{ stage: string; leadCount: number; avgDays: number; medianDays: number }>;
  avgDaysInPipeline: number;
  avgTimeToWin: number;
  totalActiveLeads: number;
}

/** GET /analytics/crm/lost-reasons */
export interface CRMLostReasonsResponse {
  totalLost: number;
  reasons: Array<{ reason: string; count: number }>;
}

export interface CRMAgingLead {
  id: string;
  name: string;
  stage: string;
  source: string | null;
  daysInPipeline: number;
  daysSinceUpdate: number;
  status: 'FRESH' | 'WARMING' | 'STALE' | 'STUCK';
  createdAt: string;
}

/** GET /analytics/crm/aging */
export interface CRMAgingResponse {
  leads: CRMAgingLead[];
  statusCounts: { FRESH: number; WARMING: number; STALE: number; STUCK: number };
  total: number;
}

/** GET /analytics/crm/moderators */
export interface CRMModeratorStats {
  moderatorId: string;
  name: string;
  email: string | null;
  totalLeads: number;
  wonLeads: number;
  lostLeads: number;
  activeLeads: number;
  conversionRate: number;
}

/** GET /analytics/crm/sources */
export interface CRMSources {
  source: string;
  totalLeads: number;
  wonLeads: number;
  lostLeads: number;
  conversionRate: number;
  avgDaysToConvert: number;
}
