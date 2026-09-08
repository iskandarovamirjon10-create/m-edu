import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type ForecastMethod = 'MOVING_AVG' | 'LINEAR' | 'SEASONAL_NAIVE';
export type ForecastMetric = 'revenue' | 'enrollments' | 'attendance';

export interface ForecastPoint {
  month: string;
  actual: number | null;
  forecast: number | null;
  lower: number | null;
  upper: number | null;
}

export interface ForecastSeries {
  metric: ForecastMetric;
  method: ForecastMethod;
  historical: ForecastPoint[];
  projected: ForecastPoint[];
  projectedTotal: number;
}

export interface ForecastSummary {
  series: ForecastSeries[];
  projectedRevenue: number;
  projectedEnrollments: number;
}

@Injectable()
export class ForecastingService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(orgId: string): Promise<ForecastSummary> {
    const [revenue, enrollments, attendance] = await Promise.all([
      this.forecastMetric(orgId, 'revenue'),
      this.forecastMetric(orgId, 'enrollments'),
      this.forecastMetric(orgId, 'attendance'),
    ]);

    return {
      series: [revenue, enrollments, attendance],
      projectedRevenue: revenue.projectedTotal,
      projectedEnrollments: enrollments.projectedTotal,
    };
  }

  async findAll(
    orgId: string,
    query: any,
  ): Promise<{ items: ForecastSeries[] }> {
    const summary = await this.getSummary(orgId);
    let items = summary.series;

    if (query.metric) {
      items = items.filter(s => s.metric === query.metric);
    }
    if (query.method) {
      items = items.filter(s => s.method === query.method);
    }

    return { items };
  }

  private async forecastMetric(
    orgId: string,
    metric: ForecastMetric,
  ): Promise<ForecastSeries> {
    const months = 12;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

    const history = await this.getHistory(orgId, metric, start, months);
    const method: ForecastMethod = metric === 'attendance' ? 'SEASONAL_NAIVE' : 'LINEAR';

    const projectedPoints = this.project(history, method, 3);
    const projectedTotal = Math.round(
      projectedPoints.reduce((s, p) => s + (p.forecast ?? 0), 0),
    );

    return {
      metric,
      method,
      historical: history,
      projected: projectedPoints,
      projectedTotal,
    };
  }

  private async getHistory(
    orgId: string,
    metric: ForecastMetric,
    start: Date,
    months: number,
  ): Promise<ForecastPoint[]> {
    const points: ForecastPoint[] = [];

    for (let i = 0; i < months; i++) {
      const monthStart = new Date(start.getFullYear(), start.getMonth() + i, 1);
      const monthEnd = new Date(start.getFullYear(), start.getMonth() + i + 1, 1);
      const label = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`;

      let value = 0;
      if (metric === 'revenue') {
        const sum = await this.prisma.payment.aggregate({
          where: {
            organizationId: orgId,
            status: 'PAID',
            createdAt: { gte: monthStart, lt: monthEnd },
          },
          _sum: { amount: true },
        });
        value = sum._sum.amount ? Number(sum._sum.amount) : 0;
      } else if (metric === 'enrollments') {
        value = await this.prisma.student.count({
          where: {
            organizationId: orgId,
            createdAt: { gte: monthStart, lt: monthEnd },
          },
        });
      } else if (metric === 'attendance') {
        const total = await this.prisma.attendance.count({
          where: {
            organizationId: orgId,
            date: { gte: monthStart, lt: monthEnd },
          },
        });
        const present = await this.prisma.attendance.count({
          where: {
            organizationId: orgId,
            date: { gte: monthStart, lt: monthEnd },
            status: 'PRESENT',
          },
        });
        value = total > 0 ? Math.round((present / total) * 100) : 0;
      }

      points.push({ month: label, actual: value, forecast: null, lower: null, upper: null });
    }

    return points;
  }

  private project(
    history: ForecastPoint[],
    method: ForecastMethod,
    steps: number,
  ): ForecastPoint[] {
    const values = history.map(p => p.actual ?? 0);
    const lastMonth = history.length > 0 ? history[history.length - 1].month : '';
    const [lastYear, lastMonthNum] = lastMonth.split('-').map(Number);

    if (method === 'MOVING_AVG') {
      const window = values.slice(-3);
      const avg = window.length > 0
        ? window.reduce((s, v) => s + v, 0) / window.length
        : 0;
      const stddev = this.stddev(window);
      const band = 1.96 * stddev;

      const projected: ForecastPoint[] = [];
      for (let i = 1; i <= steps; i++) {
        const monthIdx = (lastMonthNum + i - 1) % 12 + 1;
        const year = lastYear + Math.floor((lastMonthNum + i - 1) / 12);
        const label = `${year}-${String(monthIdx).padStart(2, '0')}`;
        projected.push({
          month: label,
          actual: null,
          forecast: Math.round(avg * 100) / 100,
          lower: Math.max(0, Math.round((avg - band) * 100) / 100),
          upper: Math.round((avg + band) * 100) / 100,
        });
      }
      return projected;
    }

    if (method === 'LINEAR') {
      const n = values.length;
      if (n < 2) {
        return this.constantForecast(values, lastYear, lastMonthNum, steps);
      }
      let sumX = 0;
      let sumY = 0;
      let sumXY = 0;
      let sumXX = 0;
      for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += values[i];
        sumXY += i * values[i];
        sumXX += i * i;
      }
      const denom = n * sumXX - sumX * sumX;
      const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
      const intercept = (sumY - slope * sumX) / n;

      const fitted: number[] = [];
      for (let i = 0; i < n; i++) {
        fitted.push(slope * i + intercept);
      }
      const residuals = values.map((v, i) => v - fitted[i]);
      const stddev = this.stddev(residuals);
      const band = 1.96 * stddev;

      const projected: ForecastPoint[] = [];
      for (let i = 1; i <= steps; i++) {
        const x = n - 1 + i;
        const y = slope * x + intercept;
        const monthIdx = (lastMonthNum + i - 1) % 12 + 1;
        const year = lastYear + Math.floor((lastMonthNum + i - 1) / 12);
        const label = `${year}-${String(monthIdx).padStart(2, '0')}`;
        projected.push({
          month: label,
          actual: null,
          forecast: Math.max(0, Math.round(y * 100) / 100),
          lower: Math.max(0, Math.round((y - band) * 100) / 100),
          upper: Math.round((y + band) * 100) / 100,
        });
      }
      return projected;
    }

    if (method === 'SEASONAL_NAIVE') {
      const projected: ForecastPoint[] = [];
      for (let i = 1; i <= steps; i++) {
        const targetIdx = history.length + i - 1;
        const seasonalIdx = targetIdx - 12;
        const value = seasonalIdx >= 0 && seasonalIdx < values.length ? values[seasonalIdx] : 0;
        const recent = values.slice(-12);
        const stddev = this.stddev(recent);
        const band = 1.96 * stddev;
        const monthIdx = (lastMonthNum + i - 1) % 12 + 1;
        const year = lastYear + Math.floor((lastMonthNum + i - 1) / 12);
        const label = `${year}-${String(monthIdx).padStart(2, '0')}`;
        projected.push({
          month: label,
          actual: null,
          forecast: Math.round(value * 100) / 100,
          lower: Math.max(0, Math.round((value - band) * 100) / 100),
          upper: Math.round((value + band) * 100) / 100,
        });
      }
      return projected;
    }

    return [];
  }

  private constantForecast(
    values: number[],
    lastYear: number,
    lastMonthNum: number,
    steps: number,
  ): ForecastPoint[] {
    const avg = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0;
    const projected: ForecastPoint[] = [];
    for (let i = 1; i <= steps; i++) {
      const monthIdx = (lastMonthNum + i - 1) % 12 + 1;
      const year = lastYear + Math.floor((lastMonthNum + i - 1) / 12);
      const label = `${year}-${String(monthIdx).padStart(2, '0')}`;
      projected.push({
        month: label,
        actual: null,
        forecast: Math.round(avg * 100) / 100,
        lower: Math.round(avg * 100) / 100,
        upper: Math.round(avg * 100) / 100,
      });
    }
    return projected;
  }

  private stddev(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance =
      values.reduce((s, v) => s + (v - mean) * (v - mean), 0) / values.length;
    return Math.sqrt(variance);
  }
}
