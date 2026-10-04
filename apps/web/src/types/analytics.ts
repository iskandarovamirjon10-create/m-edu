/**
 * Analytics domain aggregator and view models.
 * Combines CRM, Financial, Academic Risk, and Operational Analytics.
 */

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

export type {
  FinancialAnomaly,
  CashFlowData,
  ReconciliationData,
} from './finance';

export type {
  AcademicRiskSummary,
  AcademicRiskFactor,
  AcademicRiskItem,
  RiskLevel,
  RiskFactor,
  AcademicRisk,
} from './risk';

export type {
  WorkloadSummary,
  TeacherWorkload,
  TeacherWorkloadItem,
} from './workload';

export type {
  ForecastResult,
  ForecastData,
  WhatIfSimulationData,
  Forecast,
  ForecastPoint,
  ForecastMetric,
} from './forecasting';

export type {
  EarlyWarningSummary,
} from './warnings';

export type {
  CRMFunnelResponse,
  CRMVelocityResponse,
  CRMLostReasonsResponse,
  CRMAgingLead,
  CRMAgingResponse,
  CRMModeratorStats,
  CRMSources,
} from './crm-analytics';

export type {
  DashboardStats,
  AnalyticsOverview,
} from './dashboard';
