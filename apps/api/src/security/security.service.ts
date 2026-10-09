import { Injectable, NotImplementedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityAlertQueryDto } from './dto/security.dto';

type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface SecurityAlert {
  id: string;
  organizationId: string;
  type: string;
  severity: AlertSeverity;
  message: string;
  source: string;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
  createdAt: Date;
}

export interface SecuritySummary {
  total: number;
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  riskScore: number;
  detectedThisWeek: number;
  resolvedThisWeek: number;
}

const SECURITY_ALERT_ACTIONS: Record<string, AlertSeverity> = {
  LOGIN_FAILED: 'HIGH',
  UNAUTHORIZED_ACCESS: 'CRITICAL',
  PERMISSION_DENIED: 'MEDIUM',
  RATE_LIMIT_EXCEEDED: 'LOW',
  SUSPICIOUS_IP: 'HIGH',
  DATA_EXPORT: 'MEDIUM',
  BULK_DELETE: 'HIGH',
  PASSWORD_RESET: 'LOW',
  ROLE_CHANGED: 'HIGH',
  MFA_DISABLED: 'CRITICAL',
};

@Injectable()
export class SecurityService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(orgId: string): Promise<SecuritySummary> {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const weekAgoStart = new Date(weekAgo);
    weekAgoStart.setUTCHours(0, 0, 0, 0);

    const alerts = await this.buildAlertsFromAuditLog(orgId);

    const unresolved = alerts.filter(a => a.resolvedAt === null);
    const detectedThisWeek = alerts.filter(a => a.createdAt >= weekAgoStart).length;
    const resolvedThisWeek = alerts.filter(a =>
      a.resolvedAt !== null && a.resolvedAt >= weekAgoStart,
    ).length;

    const bySeverity: Record<string, number> = {};
    const byStatus: Record<string, number> = { resolved: 0, unresolved: 0 };
    const byType: Record<string, number> = {};

    for (const a of unresolved) {
      bySeverity[a.severity] = (bySeverity[a.severity] ?? 0) + 1;
      byStatus.unresolved++;
      byType[a.type] = (byType[a.type] ?? 0) + 1;
    }
    for (const _ of alerts.filter(a => a.resolvedAt !== null)) {
      byStatus.resolved++;
    }

    // Risk score: weighted sum by severity
    const riskScore = (
      (bySeverity['CRITICAL'] ?? 0) * 40 +
      (bySeverity['HIGH'] ?? 0) * 20 +
      (bySeverity['MEDIUM'] ?? 0) * 10 +
      (bySeverity['LOW'] ?? 0) * 2
    );

    return {
      total: unresolved.length,
      bySeverity,
      byStatus,
      byType,
      riskScore,
      detectedThisWeek,
      resolvedThisWeek,
    };
  }

  async findAlerts(orgId: string, query: SecurityAlertQueryDto): Promise<{ items: SecurityAlert[]; total: number }> {
    const allAlerts = await this.buildAlertsFromAuditLog(orgId);

    let items = allAlerts;
    if (query.severity) {
      items = items.filter(a => a.severity === query.severity);
    }
    if (query.type) {
      items = items.filter(a => a.type === query.type);
    }
    if (query.resolved === 'true') {
      items = items.filter(a => a.resolvedAt !== null);
    }
    if (query.resolved === 'false') {
      items = items.filter(a => a.resolvedAt === null);
    }

    const total = items.length;
    const takeRaw = Number(query.take ?? 50);
    const take = Math.min(
      Number.isFinite(takeRaw) && takeRaw > 0 ? Math.trunc(takeRaw) : 50,
      100,
    );
    const skip = Math.max(0, Number(query.skip) || 0);
    items = items.slice(skip, skip + take);

    return { items, total };
  }

  async resolve(
    orgId: string,
    id: string,
    userId: string,
    note?: string,
  ): Promise<{ ok: true }> {
    // H1: security alerts are DERIVED from the AuditLog at read time — there
    // is no SecurityAlert row to update. The previous implementation wrote to
    // DataQualityIssue (a different module's table), so "Resolve" displayed
    // success while the incident stayed open. Fail honestly until a
    // SecurityAlertResolution model lands.
    void orgId;
    void id;
    void userId;
    void note;
    throw new NotImplementedException(
      'Security alert resolution is derived from the audit log; persistence is not implemented yet.',
    );
  }

  private async buildAlertsFromAuditLog(orgId: string): Promise<SecurityAlert[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const logs = await this.prisma.auditLog.findMany({
      where: {
        organizationId: orgId,
        timestamp: { gte: thirtyDaysAgo },
        action: { in: Object.keys(SECURITY_ALERT_ACTIONS) },
      },
      orderBy: { timestamp: 'desc' },
    });

    const loginFailedByIp = new Map<string, typeof logs>();
    const otherAlerts: SecurityAlert[] = [];

    for (const log of logs) {
      const severity = SECURITY_ALERT_ACTIONS[log.action] ?? 'MEDIUM';
      if (log.action === 'LOGIN_FAILED') {
        const ip = log.ipAddress ?? 'unknown';
        if (!loginFailedByIp.has(ip)) {
          loginFailedByIp.set(ip, []);
        }
        loginFailedByIp.get(ip)!.push(log);
      } else {
        otherAlerts.push({
          id: log.id,
          organizationId: log.organizationId,
          type: log.action,
          severity,
          message: `${log.action} on ${log.resource}${log.resourceId ? ` (${log.resourceId})` : ''}`,
          source: log.ipAddress ?? 'unknown',
          resolvedAt: null,
          resolvedBy: null,
          resolutionNote: null,
          createdAt: log.timestamp,
        });
      }
    }

    const ipAlerts: SecurityAlert[] = [];
    for (const [ip, ipLogs] of loginFailedByIp.entries()) {
      const count = ipLogs.length;
      const severity: AlertSeverity = count >= 5 ? 'CRITICAL' : count >= 3 ? 'HIGH' : 'MEDIUM';
      const latest = ipLogs[0];
      ipAlerts.push({
        id: `login-failed-${ip}`,
        organizationId: orgId,
        type: 'LOGIN_FAILED',
        severity,
        message: `${count} failed login attempt(s) from IP ${ip}`,
        source: ip,
        resolvedAt: null,
        resolvedBy: null,
        resolutionNote: null,
        createdAt: latest.timestamp,
      });
    }

    return [...ipAlerts, ...otherAlerts].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }
}

