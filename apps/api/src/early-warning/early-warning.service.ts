import { Injectable, NotImplementedException } from '@nestjs/common';
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

    const [overduePayments, staleLeads, lowAttendance] = await Promise.all([
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
    ]);

    const paymentWarnings = overduePayments.map(p => ({
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
    }));

    const leadWarnings = staleLeads.map(l => ({
      id: `lead-${l.id}`,
      ruleId: 'lead-stale',
      ruleName: 'Stale Lead',
      severity: 'MEDIUM' as const,
      entityType: 'LEAD',
      entityId: l.id,
      entityName: `${l.firstName} ${l.lastName ?? ''}`.trim(),
      message: `Lead has had no activity for over 14 days`,
      detectedAt: l.updatedAt,
    }));

    const attendanceWarnings = lowAttendance.map(s => ({
      id: `attendance-${s.id}`,
      ruleId: 'attendance-low',
      ruleName: 'Low Attendance',
      severity: 'HIGH' as const,
      entityType: 'STUDENT',
      entityId: s.id,
      entityName: s.name,
      message: `Attendance rate is ${s.rate}% (below 70%)`,
      detectedAt: new Date(),
    }));

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
      resolvedThisWeek: 0,
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

    const [overduePayments, staleLeads, lowAttendance] = await Promise.all([
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
    ]);

    const paymentWarnings = overduePayments.map(p => ({
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
    }));

    const leadWarnings = staleLeads.map(l => ({
      id: `lead-${l.id}`,
      ruleId: 'lead-stale',
      ruleName: 'Stale Lead',
      severity: 'MEDIUM' as const,
      entityType: 'LEAD',
      entityId: l.id,
      entityName: `${l.firstName} ${l.lastName ?? ''}`.trim(),
      message: `Lead has had no activity for over 14 days`,
      detectedAt: l.updatedAt,
    }));

    const attendanceWarnings = lowAttendance.map(s => ({
      id: `attendance-${s.id}`,
      ruleId: 'attendance-low',
      ruleName: 'Low Attendance',
      severity: 'HIGH' as const,
      entityType: 'STUDENT',
      entityId: s.id,
      entityName: s.name,
      message: `Attendance rate is ${s.rate}% (below 70%)`,
      detectedAt: new Date(),
    }));

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

    const [overduePayments, staleLeads, lowAttendance] = await Promise.all([
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
    ]);

    // M2: these were presented as "created/fixed" counters while NOTHING was
    // persisted (no EarlyWarning model exists). Report honest semantics:
    // `detected` = real candidates found in the scan, persistence count 0.
    const detected =
      overduePayments.length + staleLeads.length + lowAttendance.length;
    return {
      scanned: detected,
      detected,
      created: 0,
      fixed: 0,
      message: 'Scan completed. Persistence requires the EarlyWarning model (not yet implemented).',
    };
  }

  async resolve(
    _orgId: string,
    _id: string,
    _userId: string,
    _note?: string,
  ): Promise<{ ok: boolean }> {
    void _orgId;
    void _id;
    void _userId;
    void _note;
    // M2: resolving derived findings without a persistence model is a fake
    // success. Fail honestly until the EarlyWarning model lands.
    throw new NotImplementedException(
      'Early-warning persistence requires the EarlyWarning model (not yet implemented).',
    );
  }

  private async getLowAttendanceStudents(
    orgId: string,
    since: Date,
  ): Promise<Array<{ id: string; name: string; rate: number }>> {
    const records = await this.prisma.attendance.findMany({
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
      if (rec.status === 'PRESENT') g.present++;
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

