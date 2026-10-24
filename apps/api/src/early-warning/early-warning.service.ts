import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EarlyWarningQueryDto } from './dto/early-warning.dto';

export interface EarlyWarningSummary {
  open: number;
  critical: number;
  high: number;
  resolvedThisWeek: number;
  byRule: Record<string, number>;
  total: number;
}

export interface EarlyWarningItem {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  entityType: string;
  entityId: string;
  entityName: string;
  message: string;
  detectedAt: Date;
}

export interface ScanResult {
  created: number;
  scanned: number;
  fixed: number;
  /** Real candidate count found by the scan (persistence = 0 until model). */
  detected: number;
  message?: string;
}

@Injectable()
export class EarlyWarningService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(orgId: string): Promise<EarlyWarningSummary> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const [overduePayments, staleLeads, lowAttendance, resolvedLogs] = await Promise.all([
      this.prisma.payment.findMany({
        where: {
          organizationId: orgId,
          status: { in: ['PENDING', 'OVERDUE'] },
          dueDate: { lt: sevenDaysAgo },
        },
        include: { student: { include: { user: { select: { firstName: true, lastName: true } } } } },
      }),
      this.prisma.lead.findMany({
        where: {
          organizationId: orgId,
          stage: { in: ['NEW', 'CONTACTED'] },
          updatedAt: { lt: fourteenDaysAgo },
        },
      }),
      this.getLowAttendanceStudents(orgId, fourteenDaysAgo),
      this.prisma.auditLog.findMany({
        where: {
          organizationId: orgId,
          action: 'EARLY_WARNING_RESOLVED',
          resource: 'EarlyWarning',
        },
        select: { resourceId: true, timestamp: true },
      }),
    ]);

    const resolvedIds = new Set(
      resolvedLogs
        .map(l => l.resourceId)
        .filter((id): id is string => Boolean(id)),
    );

    const paymentWarnings = overduePayments
      .map(p => ({
        id: `payment-${p.id}`,
        ruleId: 'payment-overdue',
        ruleName: 'Payment Overdue',
        severity: 'CRITICAL' as const,
        entityType: 'PAYMENT',
        entityId: p.id,
        entityName: p.student?.user
          ? `${p.student.user.firstName} ${p.student.user.lastName}`
          : p.id,
        message: `Payment of ${p.amount} is overdue`,
        detectedAt: p.updatedAt,
      }))
      .filter(w => !resolvedIds.has(w.id));

    const leadWarnings = staleLeads
      .map(l => ({
        id: `lead-${l.id}`,
        ruleId: 'lead-stale',
        ruleName: 'Stale Lead',
        severity: 'MEDIUM' as const,
        entityType: 'LEAD',
        entityId: l.id,
        entityName: `${l.firstName} ${l.lastName ?? ''}`.trim(),
        message: 'Lead has had no activity for over 14 days',
        detectedAt: l.updatedAt,
      }))
      .filter(w => !resolvedIds.has(w.id));

    const attendanceWarnings = lowAttendance
      .map(s => ({
        id: `attendance-${s.id}`,
        ruleId: 'attendance-low',
        ruleName: 'Low Attendance',
        severity: 'HIGH' as const,
        entityType: 'STUDENT',
        entityId: s.id,
        entityName: s.name,
        message: `Attendance rate is ${s.rate}% (below 70%)`,
        detectedAt: new Date(),
      }))
      .filter(w => !resolvedIds.has(w.id));

    const allWarnings = [...paymentWarnings, ...leadWarnings, ...attendanceWarnings];

    const byRule: Record<string, number> = {
      'payment-overdue': paymentWarnings.length,
      'lead-stale': leadWarnings.length,
      'attendance-low': attendanceWarnings.length,
    };

    const open = allWarnings.length;
    const critical = paymentWarnings.length;
    const high = attendanceWarnings.length;

    return {
      open,
      critical,
      high,
      resolvedThisWeek: resolvedLogs.filter((l: any) => !l.timestamp || new Date(l.timestamp) >= sevenDaysAgo).length,
      byRule,
      total: open,
    };
  }

  async findAll(
    orgId: string,
    query: EarlyWarningQueryDto,
  ): Promise<{ items: EarlyWarningItem[]; total: number }> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const [overduePayments, staleLeads, lowAttendance, resolvedLogs] = await Promise.all([
      this.prisma.payment.findMany({
        where: {
          organizationId: orgId,
          status: { in: ['PENDING', 'OVERDUE'] },
          dueDate: { lt: sevenDaysAgo },
        },
        include: { student: { include: { user: { select: { firstName: true, lastName: true } } } } },
      }),
      this.prisma.lead.findMany({
        where: {
          organizationId: orgId,
          stage: { in: ['NEW', 'CONTACTED'] },
          updatedAt: { lt: fourteenDaysAgo },
        },
      }),
      this.getLowAttendanceStudents(orgId, fourteenDaysAgo),
      this.prisma.auditLog.findMany({
        where: {
          organizationId: orgId,
          action: 'EARLY_WARNING_RESOLVED',
          resource: 'EarlyWarning',
        },
        select: { resourceId: true },
      }),
    ]);

    const resolvedIds = new Set(
      resolvedLogs
        .map(l => l.resourceId)
        .filter((id): id is string => Boolean(id)),
    );

    const paymentWarnings = overduePayments
      .map(p => ({
        id: `payment-${p.id}`,
        ruleId: 'payment-overdue',
        ruleName: 'Payment Overdue',
        severity: 'CRITICAL' as const,
        entityType: 'PAYMENT',
        entityId: p.id,
        entityName: p.student?.user
          ? `${p.student.user.firstName} ${p.student.user.lastName}`
          : p.id,
        message: `Payment of ${p.amount} is overdue`,
        detectedAt: p.updatedAt,
      }))
      .filter(w => !resolvedIds.has(w.id));

    const leadWarnings = staleLeads
      .map(l => ({
        id: `lead-${l.id}`,
        ruleId: 'lead-stale',
        ruleName: 'Stale Lead',
        severity: 'MEDIUM' as const,
        entityType: 'LEAD',
        entityId: l.id,
        entityName: `${l.firstName} ${l.lastName ?? ''}`.trim(),
        message: 'Lead has had no activity for over 14 days',
        detectedAt: l.updatedAt,
      }))
      .filter(w => !resolvedIds.has(w.id));

    const attendanceWarnings = lowAttendance
      .map(s => ({
        id: `attendance-${s.id}`,
        ruleId: 'attendance-low',
        ruleName: 'Low Attendance',
        severity: 'HIGH' as const,
        entityType: 'STUDENT',
        entityId: s.id,
        entityName: s.name,
        message: `Attendance rate is ${s.rate}% (below 70%)`,
        detectedAt: new Date(),
      }))
      .filter(w => !resolvedIds.has(w.id));

    let items = [...paymentWarnings, ...leadWarnings, ...attendanceWarnings];

    if (query.severity) {
      items = items.filter(i => i.severity === query.severity);
    }
    if (query.ruleId) {
      items = items.filter(i => i.ruleId === query.ruleId);
    }
    if (query.entityType) {
      items = items.filter(i => i.entityType === query.entityType);
    }

    const limit = query.limit ?? 50;
    const page = query.page ?? 1;
    const total = items.length;
    items = items.slice((page - 1) * limit, page * limit);

    return { items, total };
  }

  async runScan(orgId: string): Promise<ScanResult> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const [overduePayments, staleLeads, lowAttendance, resolvedLogs] = await Promise.all([
      this.prisma.payment.findMany({
        where: {
          organizationId: orgId,
          status: { in: ['PENDING', 'OVERDUE'] },
          dueDate: { lt: sevenDaysAgo },
        },
      }),
      this.prisma.lead.findMany({
        where: {
          organizationId: orgId,
          stage: { in: ['NEW', 'CONTACTED'] },
          updatedAt: { lt: fourteenDaysAgo },
        },
      }),
      this.getLowAttendanceStudents(orgId, fourteenDaysAgo),
      this.prisma.auditLog.findMany({
        where: {
          organizationId: orgId,
          action: 'EARLY_WARNING_RESOLVED',
          resource: 'EarlyWarning',
          timestamp: { gte: sevenDaysAgo },
        },
        select: { resourceId: true },
      }),
    ]);

    const resolvedIds = new Set(
      resolvedLogs
        .map(l => l.resourceId)
        .filter((id): id is string => Boolean(id)),
    );

    const scanned = overduePayments.length + staleLeads.length + lowAttendance.length;
    const unresolvedPayments = overduePayments.filter(p => !resolvedIds.has(`payment-${p.id}`)).length;
    const unresolvedLeads = staleLeads.filter(l => !resolvedIds.has(`lead-${l.id}`)).length;
    const unresolvedAttendance = lowAttendance.filter(s => !resolvedIds.has(`attendance-${s.id}`)).length;
    const detected = unresolvedPayments + unresolvedLeads + unresolvedAttendance;

    return {
      scanned,
      detected,
      created: 0,
      fixed: resolvedLogs.length,
      message: `Scan complete: ${detected} active warning(s) detected (${resolvedLogs.length} resolved this week).`,
    };
  }

  async resolve(
    orgId: string,
    id: string,
    userId: string,
    note?: string,
  ): Promise<{ ok: boolean }> {
    await this.prisma.auditLog.create({
      data: {
        organizationId: orgId,
        userId,
        action: 'EARLY_WARNING_RESOLVED',
        resource: 'EarlyWarning',
        resourceId: id,
        changes: {
          warningId: id,
          note: note ?? null,
          resolvedBy: userId,
          resolvedAt: new Date().toISOString(),
        },
      },
    });
    return { ok: true };
  }

  private async getLowAttendanceStudents(
    orgId: string,
    since: Date,
  ): Promise<Array<{ id: string; name: string; rate: number }>> {
    // DB-02: Bounded query to prevent unbounded heap memory consumption
    const records = await this.prisma.attendance.findMany({
      take: 5000,
      where: {
        organizationId: orgId,
        date: { gte: since },
      },
      select: {
        studentId: true,
        status: true,
        student: {
          select: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    const grouped = new Map<
      string,
      { name: string; total: number; present: number }
    >();

    for (const rec of records) {
      if (!grouped.has(rec.studentId)) {
        grouped.set(rec.studentId, {
          name: rec.student?.user
            ? `${rec.student.user.firstName} ${rec.student.user.lastName}`
            : rec.studentId,
          total: 0,
          present: 0,
        });
      }
      const g = grouped.get(rec.studentId)!;
      g.total++;
      // LOGIC-01: LATE and EXCUSED records count towards attendance (not truant)
      if (rec.status === 'PRESENT' || rec.status === 'LATE' || rec.status === 'EXCUSED') {
        g.present++;
      }
    }

    const result: Array<{ id: string; name: string; rate: number }> = [];
    for (const [studentId, data] of grouped) {
      const rate = Math.round((data.present / data.total) * 100);
      if (data.total >= 3 && rate < 70) {
        result.push({ id: studentId, name: data.name, rate });
      }
    }
    return result;
  }
}

