import { Injectable } from '@nestjs/common';
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
    await this.prisma.auditLog.create({
      data: {
        organizationId: orgId,
        userId,
        action: 'SECURITY_ALERT_RESOLVED',
        resource: 'SecurityAlert',
        resourceId: id,
        changes: {
          alertId: id,
          note: note ?? null,
          resolvedBy: userId,
          resolvedAt: new Date().toISOString(),
        },
      },
    });
    return { ok: true };
  }

  private async buildAlertsFromAuditLog(orgId: string): Promise<SecurityAlert[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const logs = await this.prisma.auditLog.findMany({
      where: {
        organizationId: orgId,
        timestamp: { gte: thirtyDaysAgo },
        action: { in: [...Object.keys(SECURITY_ALERT_ACTIONS), 'SECURITY_ALERT_RESOLVED'] },
      },
      orderBy: { timestamp: 'desc' },
    });

    const resolutions = new Map<string, { resolvedAt: Date; resolvedBy: string | null; resolutionNote: string | null }>();
    const alertLogs: typeof logs = [];

    for (const log of logs) {
      if (log.action === 'SECURITY_ALERT_RESOLVED') {
        if (log.resourceId && !resolutions.has(log.resourceId)) {
          const ch = (log.changes as Record<string, any>) || {};
          resolutions.set(log.resourceId, {
            resolvedAt: log.timestamp,
            resolvedBy: log.userId,
            resolutionNote: ch.note ?? null,
          });
        }
      } else {
        alertLogs.push(log);
      }
    }

    const loginFailedByIp = new Map<string, typeof logs>();
    const otherAlerts: SecurityAlert[] = [];

    for (const log of alertLogs) {
      const severity = SECURITY_ALERT_ACTIONS[log.action] ?? 'MEDIUM';
      if (log.action === 'LOGIN_FAILED') {
        const ip = log.ipAddress ?? 'unknown';
        if (!loginFailedByIp.has(ip)) {
          loginFailedByIp.set(ip, []);
        }
        loginFailedByIp.get(ip)!.push(log);
      } else {
        const res = resolutions.get(log.id);
        otherAlerts.push({
          id: log.id,
          organizationId: log.organizationId,
          type: log.action,
          severity,
          message: `${log.action} on ${log.resource}${log.resourceId ? ` (${log.resourceId})` : ''}`,
          source: log.ipAddress ?? 'unknown',
          resolvedAt: res?.resolvedAt ?? null,
          resolvedBy: res?.resolvedBy ?? null,
          resolutionNote: res?.resolutionNote ?? null,
          createdAt: log.timestamp,
        });
      }
    }

    const ipAlerts: SecurityAlert[] = [];
    for (const [ip, ipLogs] of loginFailedByIp.entries()) {
      const alertId = `login-failed-${ip}`;
      const res = resolutions.get(alertId);
      const count = ipLogs.length;
      const severity: AlertSeverity = count >= 5 ? 'CRITICAL' : count >= 3 ? 'HIGH' : 'MEDIUM';
      const latest = ipLogs[0];
      const isResolved = Boolean(res?.resolvedAt && latest.timestamp <= res.resolvedAt);

      ipAlerts.push({
        id: alertId,
        organizationId: orgId,
        type: 'LOGIN_FAILED',
        severity,
        message: `${count} failed login attempt(s) from IP ${ip}`,
        source: ip,
        resolvedAt: isResolved ? res!.resolvedAt : null,
        resolvedBy: isResolved ? res!.resolvedBy : null,
        resolutionNote: isResolved ? res!.resolutionNote : null,
        createdAt: latest.timestamp,
      });
    }

    return [...ipAlerts, ...otherAlerts].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }
}

