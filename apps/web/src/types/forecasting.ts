/**
 * Financial and operational forecasting models.
 */

export type ForecastMetric =
  | 'REVENUE'
  | 'ENROLLMENTS'
  | 'ATTENDANCE'
  | 'ATTRITION'
  | 'CHURN';

export interface ForecastPoint {
  date: string; // YYYY-MM-DD or YYYY-MM
  predicted: number;
  lowerBound: number; // confidence interval lower
  upperBound: number; // confidence interval upper
  actual?: number; // present when date is in the past
}

export interface Forecast {
  metric: ForecastMetric;
  /** Time horizon (e.g. 30 days, 6 months). */
  horizon: string;
  method: string;
  /** 0-1; higher = more certain. */
  confidence: number;
  points: ForecastPoint[];
  generatedAt: string;
  insights: string[];
}

/** Shape returned by GET /analytics/financial/forecast */
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

/** Alias kept for the CALCULATED branch of the forecast union. */
export type ForecastData = Extract<ForecastResult, { status: 'CALCULATED' }>;

/** Shape returned by GET /analytics/financial/what-if */
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
