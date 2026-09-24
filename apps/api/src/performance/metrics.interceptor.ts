import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, tap } from 'rxjs';

export interface RequestMetric {
  endpoint: string;
  method: string;
  duration: number;
  timestamp: number;
  statusCode: number;
}

export interface EndpointStats {
  endpoint: string;
  method: string;
  callCount: number;
  totalDuration: number;
  avgDuration: number;
  maxDuration: number;
  minDuration: number;
  errorCount: number;
  lastCalled: string;
}

const BUFFER_SIZE = 1000;
const SLOW_THRESHOLD_MS = 500;

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  private buffer: RequestMetric[] = [];
  private statsCache = new Map<string, EndpointStats>();
  private statsCacheDirty = true;

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - start;
          const res = context.switchToHttp().getResponse();
          this.recordMetric(req.method, req.route?.path || req.url, duration, res.statusCode);
          if (duration > SLOW_THRESHOLD_MS) {
            console.warn(
              `[PERF] Slow request: ${req.method} ${req.route?.path || req.url} took ${duration}ms`,
            );
          }
        },
        error: (err) => {
          const duration = Date.now() - start;
          this.recordMetric(req.method, req.route?.path || req.url, duration, err.status || 500);
        },
      }),
    );
  }

  private recordMetric(method: string, endpoint: string, duration: number, statusCode: number): void {
    const metric: RequestMetric = {
      endpoint,
      method,
      duration,
      timestamp: Date.now(),
      statusCode,
    };

    this.buffer.push(metric);
    if (this.buffer.length > BUFFER_SIZE) {
      this.buffer = this.buffer.slice(-BUFFER_SIZE);
    }

    const key = `${method}:${endpoint}`;
    const existing = this.statsCache.get(key);
    if (existing) {
      existing.callCount++;
      existing.totalDuration += duration;
      existing.avgDuration = existing.totalDuration / existing.callCount;
      existing.maxDuration = Math.max(existing.maxDuration, duration);
      existing.minDuration = Math.min(existing.minDuration, duration);
      existing.lastCalled = new Date().toISOString();
      if (statusCode >= 400) existing.errorCount++;
    } else {
      this.statsCache.set(key, {
        endpoint,
        method,
        callCount: 1,
        totalDuration: duration,
        avgDuration: duration,
        maxDuration: duration,
        minDuration: duration,
        errorCount: statusCode >= 400 ? 1 : 0,
        lastCalled: new Date().toISOString(),
      });
    }
    this.statsCacheDirty = true;
  }

  getSlowEndpoints(thresholdMs = SLOW_THRESHOLD_MS): EndpointStats[] {
    return Array.from(this.statsCache.values())
      .filter((s) => s.avgDuration > thresholdMs)
      .sort((a, b) => b.avgDuration - a.avgDuration);
  }

  getEndpointStats(): EndpointStats[] {
    return Array.from(this.statsCache.values()).sort((a, b) => b.callCount - a.callCount);
  }

  getRecentMetrics(count = 100): RequestMetric[] {
    return this.buffer.slice(-count);
  }

  getRollingAverage(): number {
    if (this.buffer.length === 0) return 0;
    const sum = this.buffer.reduce((acc, m) => acc + m.duration, 0);
    return Math.round(sum / this.buffer.length);
  }

  getErrorRate(): number {
    if (this.buffer.length === 0) return 0;
    const errors = this.buffer.filter((m) => m.statusCode >= 400).length;
    return Math.round((errors / this.buffer.length) * 100 * 100) / 100;
  }

  getTotalRequests(): number {
    return this.buffer.length;
  }
}
