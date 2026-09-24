import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EndpointStats, MetricsInterceptor } from './metrics.interceptor';
import { MemoryCache } from './cache.util';
import * as fs from 'fs';
import * as path from 'path';

export interface NPlusOneIssue {
  file: string;
  line: number;
  method: string;
  pattern: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface UnboundedQuery {
  file: string;
  line: number;
  model: string;
  method: string;
  suggestion: string;
}

export interface IndexSuggestion {
  model: string;
  fields: string[];
  reason: string;
  sql: string;
}

export interface PerformanceAudit {
  nPlusOneIssues: NPlusOneIssue[];
  unboundedQueries: UnboundedQuery[];
  indexSuggestions: IndexSuggestion[];
  slowEndpoints: EndpointStats[];
  cacheStats: { dashboardKeys: number; executiveKeys: number; analyticsKeys: number; studentCountKeys: number; hits: number; misses: number; hitRate: number };
  summary: {
    totalIssues: number;
    criticalCount: number;
    warningCount: number;
    infoCount: number;
  };
}

@Injectable()
export class PerformanceService {
  private dashboardCache = new MemoryCache<unknown>(60000);
  private executiveCache = new MemoryCache<unknown>(30000);
  private analyticsCache = new MemoryCache<unknown>(30000);
  private studentCountCache = new MemoryCache<unknown>(30000);

  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsInterceptor,
  ) {}

  getCached(key: string): unknown | undefined {
    const val = this.dashboardCache.get(key) ?? this.executiveCache.get(key) ?? this.analyticsCache.get(key) ?? this.studentCountCache.get(key);
    if (val !== undefined) { this.cacheHits++; return val; }
    this.cacheMisses++;
    return undefined;
  }

  setCache(key: string, data: unknown, ttl: number = 60000, type: 'dashboard' | 'executive' | 'analytics' | 'studentCount' = 'dashboard'): void {
    const cacheMap = { dashboard: this.dashboardCache, executive: this.executiveCache, analytics: this.analyticsCache, studentCount: this.studentCountCache };
    cacheMap[type].set(key, data, ttl);
  }

  getCacheStats() {
    const total = this.cacheHits + this.cacheMisses;
    return {
      dashboardKeys: this.dashboardCache.size(),
      executiveKeys: this.executiveCache.size(),
      analyticsKeys: this.analyticsCache.size(),
      studentCountKeys: this.studentCountCache.size(),
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: total > 0 ? Math.round((this.cacheHits / total) * 100) : 0,
    };
  }

  async getNPlusOneReport(): Promise<NPlusOneIssue[]> {
    const issues: NPlusOneIssue[] = [];
    const srcDir = path.resolve(__dirname, '..');

    try {
      await this.scanDirectory(srcDir, issues);
    } catch {
      return issues;
    }

    return issues;
  }

  // Async traversal: a synchronous recursive readdir/readFile walk over the
  // whole source tree blocks the Node event loop for the duration of the
  // audit. Using fs.promises yields between files instead.
  private async scanDirectory(dir: string, issues: NPlusOneIssue[]): Promise<void> {
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '__tests__') {
        await this.scanDirectory(fullPath, issues);
      } else if (entry.isFile() && entry.name.endsWith('.service.ts') && !entry.name.endsWith('.spec.ts')) {
        await this.analyzeServiceFile(fullPath, issues);
      }
    }
  }

  private async analyzeServiceFile(filePath: string, issues: NPlusOneIssue[]): Promise<void> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const relativePath = path.relative(path.resolve(__dirname, '..'), filePath);
      let currentMethod = '';

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const methodMatch = line.match(/async\s+(\w+)\s*\(/);
        if (methodMatch) currentMethod = methodMatch[1];

        if (line.includes('for ') || line.includes('forEach')) {
          for (let j = i + 1; j < Math.min(i + 20, lines.length); j++) {
            if (lines[j].includes('findMany') || lines[j].includes('findFirst') || lines[j].includes('findUnique')) {
              issues.push({
                file: relativePath,
                line: i + 1,
                method: currentMethod,
                pattern: 'Loop with individual DB query inside',
                severity: 'HIGH',
              });
              break;
            }
            if (lines[j].match(/\b(async|return|}\s*$)/) && !lines[j].includes('find')) break;
          }
        }

        if (line.includes('await') && line.includes('findMany')) {
          const isInsideLoop = lines.slice(Math.max(0, i - 15), i).some(
            (l) => l.includes('for ') || l.includes('forEach'),
          );
          if (isInsideLoop) {
            issues.push({
              file: relativePath,
              line: i + 1,
              method: currentMethod,
              pattern: 'findMany inside a loop iteration',
              severity: 'HIGH',
            });
          }
        }

        if (line.includes('.count(') && lines.slice(Math.max(0, i - 10), i).some((l) => l.includes('Promise.all'))) {
          const promiseAllLines = lines.slice(0, i).reverse();
          const promiseAllStart = promiseAllLines.findIndex((l) => l.includes('Promise.all'));
          if (promiseAllStart >= 0) {
            const actualStart = i - promiseAllStart - 1;
            const countInSameBlock = lines.slice(actualStart, i + 1).filter((l) => l.includes('.count(')).length;
            if (countInSameBlock > 3) {
              issues.push({
                file: relativePath,
                line: i + 1,
                method: currentMethod,
                pattern: `Multiple count queries in Promise.all (${countInSameBlock}+) — consider a single aggregate query`,
                severity: 'MEDIUM',
              });
            }
          }
        }
      }
    } catch {
      return;
    }
  }

  async getUnboundedQueryReport(): Promise<UnboundedQuery[]> {
    const queries: UnboundedQuery[] = [];
    const srcDir = path.resolve(__dirname, '..');

    try {
      await this.scanForUnbounded(srcDir, queries);
    } catch {
      return queries;
    }

    return queries;
  }

  private async scanForUnbounded(dir: string, queries: UnboundedQuery[]): Promise<void> {
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '__tests__') {
        await this.scanForUnbounded(fullPath, queries);
      } else if (entry.isFile() && entry.name.endsWith('.service.ts') && !entry.name.endsWith('.spec.ts')) {
        await this.analyzeForUnbounded(fullPath, queries);
      }
    }
  }

  private async analyzeForUnbounded(filePath: string, queries: UnboundedQuery[]): Promise<void> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const relativePath = path.relative(path.resolve(__dirname, '..'), filePath);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('findMany') && !lines.slice(i, Math.min(i + 10, lines.length)).some((l) => l.includes('take:'))) {
          const modelMatch = line.match(/\.(\w+)\.findMany/);
          const methodMatch = lines.slice(0, i).reverse().find((l) => l.match(/async\s+(\w+)/));
          const method = methodMatch?.match(/async\s+(\w+)/)?.[1] || 'unknown';

          if (!line.includes('skip') && !line.includes('take')) {
            const hasPagination = lines.slice(Math.max(0, i - 5), i).some(
              (l) => l.includes('page') || l.includes('limit') || l.includes('parsePagination'),
            );
            if (!hasPagination) {
              queries.push({
                file: relativePath,
                line: i + 1,
                model: modelMatch?.[1] || 'unknown',
                method,
                suggestion: 'Add take/limit to prevent unbounded result sets',
              });
            }
          }
        }
      }
    } catch {
      return;
    }
  }

  async getIndexSuggestions(): Promise<IndexSuggestion[]> {
    const suggestions: IndexSuggestion[] = [];

    const modelsWithMissingIndexes = [
      { model: 'StudentGroup', fields: ['organizationId'], reason: 'StudentGroup queries often filter by organizationId but no dedicated index exists beyond the composite PK' },
      { model: 'SalaryRecord', fields: ['employeeId', 'status'], reason: 'Payroll queries filter by employee and status frequently' },
      { model: 'FollowUp', fields: ['organizationId', 'scheduledAt'], reason: 'FollowUp list queries filter by org and sort by scheduledAt' },
      { model: 'Invoice', fields: ['studentId', 'status'], reason: 'Invoice lookups by student and status are common in student detail pages' },
      { model: 'Grade', fields: ['organizationId', 'createdAt'], reason: 'Grade listing by org ordered by date is a common access pattern' },
      { model: 'Attendance', fields: ['organizationId', 'studentId', 'date'], reason: 'Attendance analytics filter by org+student+date range' },
      { model: 'Notification', fields: ['userId', 'isRead'], reason: 'Notification queries filter by user and read status' },
      { model: 'Payment', fields: ['createdAt'], reason: 'Payment listing sorted by createdAt benefits from a dedicated index' },
      { model: 'Expense', fields: ['organizationId', 'category'], reason: 'Expense reports filter by org and category' },
    ];

    for (const m of modelsWithMissingIndexes) {
      const indexExists = await this.checkIndexExists(m.model, m.fields);
      if (!indexExists) {
        suggestions.push({
          model: m.model,
          fields: m.fields,
          reason: m.reason,
          sql: `CREATE INDEX idx_${m.model.toLowerCase()}_${m.fields.join('_')} ON "${m.model}"(${m.fields.map((f) => `"${f}"`).join(', ')});`,
        });
      }
    }

    return suggestions;
  }

  private async checkIndexExists(model: string, fields: string[]): Promise<boolean> {
    try {
      const result = await this.prisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(*) as count FROM pg_indexes WHERE tablename = $1 AND indexdef LIKE $2`,
        model.toLowerCase(),
        `%${fields[0]}%`,
      );
      return Number(result[0]?.count ?? 0) > 0;
    } catch {
      return false;
    }
  }

  getSlowEndpoints() {
    return this.metrics.getSlowEndpoints();
  }

  async runPerformanceAudit(): Promise<PerformanceAudit> {
    const [nPlusOneIssues, unboundedQueries, indexSuggestions, slowEndpoints] = await Promise.all([
      this.getNPlusOneReport(),
      this.getUnboundedQueryReport(),
      this.getIndexSuggestions(),
      this.getSlowEndpoints(),
    ]);

    const cacheStats = this.getCacheStats();

    const criticalCount = nPlusOneIssues.filter((i) => i.severity === 'HIGH').length + slowEndpoints.length;
    const warningCount = nPlusOneIssues.filter((i) => i.severity === 'MEDIUM').length + unboundedQueries.length;
    const infoCount = nPlusOneIssues.filter((i) => i.severity === 'LOW').length + indexSuggestions.length;

    return {
      nPlusOneIssues,
      unboundedQueries,
      indexSuggestions,
      slowEndpoints,
      cacheStats,
      summary: {
        totalIssues: criticalCount + warningCount + infoCount,
        criticalCount,
        warningCount,
        infoCount,
      },
    };
  }
}
