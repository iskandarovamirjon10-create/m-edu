import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

interface RequestMetric {
  method: string;
  path: string;
  statusCode: number;
  responseTimeMs: number;
  timestamp: number;
}

const BUFFER_SIZE = 1000;

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  private buffer: RequestMetric[] = [];
  private head = 0;
  private count = 0;

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();

    res.on('finish', () => {
      const metric: RequestMetric = {
        method: req.method,
        path: req.route?.path ?? req.path,
        statusCode: res.statusCode,
        responseTimeMs: Date.now() - start,
        timestamp: Date.now(),
      };

      if (this.count < BUFFER_SIZE) {
        this.buffer[this.head] = metric;
        this.head = (this.head + 1) % BUFFER_SIZE;
        this.count++;
      } else {
        this.buffer[this.head] = metric;
        this.head = (this.head + 1) % BUFFER_SIZE;
      }
    });

    next();
  }

  getMetrics(period?: string): {
    totalRequests: number;
    errorCount: number;
    errorRate: number;
    avgResponseTimeMs: number;
    p95ResponseTimeMs: number;
    p99ResponseTimeMs: number;
    requestsPerMinute: number;
    endpointBreakdown: Array<{
      method: string;
      path: string;
      count: number;
      avgResponseTimeMs: number;
      errorCount: number;
    }>;
  } {
    const now = Date.now();
    let cutoff = now - 60 * 60 * 1000;
    if (period === '5m') cutoff = now - 5 * 60 * 1000;
    else if (period === '15m') cutoff = now - 15 * 60 * 1000;
    else if (period === '1h') cutoff = now - 60 * 60 * 1000;
    else if (period === '24h') cutoff = now - 24 * 60 * 60 * 1000;

    const recent = this.getRecentMetrics(cutoff);
    const totalRequests = recent.length;
    const errorCount = recent.filter((m) => m.statusCode >= 400).length;
    const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;
    const avgResponseTimeMs =
      totalRequests > 0
        ? recent.reduce((sum, m) => sum + m.responseTimeMs, 0) / totalRequests
        : 0;

    const sortedTimes = recent.map((m) => m.responseTimeMs).sort((a, b) => a - b);
    const p95ResponseTimeMs = this.percentile(sortedTimes, 0.95);
    const p99ResponseTimeMs = this.percentile(sortedTimes, 0.99);

    const timeSpanMs = now - (recent[0]?.timestamp ?? now);
    const requestsPerMinute =
      timeSpanMs > 0 ? (totalRequests / timeSpanMs) * 60 * 1000 : 0;

    const endpointMap = new Map<string, { count: number; totalMs: number; errors: number }>();
    for (const m of recent) {
      const key = `${m.method}:${m.path}`;
      const entry = endpointMap.get(key) ?? { count: 0, totalMs: 0, errors: 0 };
      entry.count++;
      entry.totalMs += m.responseTimeMs;
      if (m.statusCode >= 400) entry.errors++;
      endpointMap.set(key, entry);
    }

    const endpointBreakdown = Array.from(endpointMap.entries()).map(([key, data]) => {
      const [method, path] = key.split(':');
      return {
        method,
        path,
        count: data.count,
        avgResponseTimeMs: data.count > 0 ? data.totalMs / data.count : 0,
        errorCount: data.errors,
      };
    });

    return {
      totalRequests,
      errorCount,
      errorRate: Math.round(errorRate * 100) / 100,
      avgResponseTimeMs: Math.round(avgResponseTimeMs),
      p95ResponseTimeMs,
      p99ResponseTimeMs,
      requestsPerMinute: Math.round(requestsPerMinute * 100) / 100,
      endpointBreakdown: endpointBreakdown.sort((a, b) => b.count - a.count),
    };
  }

  private getRecentMetrics(cutoff: number): RequestMetric[] {
    if (this.count === 0) return [];
    const result: RequestMetric[] = [];
    const size = Math.min(this.count, BUFFER_SIZE);
    for (let i = 0; i < size; i++) {
      const idx = (this.head - size + i + BUFFER_SIZE * 2) % BUFFER_SIZE;
      const m = this.buffer[idx];
      if (m && m.timestamp >= cutoff) result.push(m);
    }
    return result;
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, idx)];
  }
}
