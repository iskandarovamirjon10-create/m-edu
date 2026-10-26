import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PayrollStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  computePayroll,
  PayrollInputs,
  PayrollValidationError,
  toMajor2,
} from '@medu/financial-engine';
import { CreatePayrollRunDto, AdjustPayrollRunDto } from './dto/payroll.dto';
import { FinancialPeriodService } from '../analytics/financial-period.service';
import { withPrismaRetry } from '../lib/prisma-retry.util';

/**
 * Payroll lifecycle: DRAFT -> CALCULATED -> REVIEWED -> APPROVED -> PAID,
 * with CANCELLED reachable only from non-paid states. Illegal transitions
 * are rejected both here and by the transition table (defense in depth).
 *
 * Concurrency: every mutation re-reads the row inside a serializable
 * transaction and applies a guarded UPDATE, so two concurrent approvers
 * cannot both win, and a PAID run can never be modified afterwards.
 *
 * Money: inputs are quantized through the payroll engine (integer minor
 * units). Stored amounts are always exactly 2-decimal values.
 *
 * Audit: every lifecycle event is appended to AuditLog with actor, inputs
 * (engine snapshot) and result; historical rows are never mutated.
 */
const TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['CALCULATED', 'CANCELLED'],
  CALCULATED: ['REVIEWED', 'CANCELLED'],
  REVIEWED: ['APPROVED', 'CANCELLED'],
  APPROVED: ['PAID', 'CANCELLED'],
  PAID: [],
  CANCELLED: [],
};

@Injectable()
export class PayrollService {
  private readonly logger = new Logger(PayrollService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly financialPeriod: FinancialPeriodService,
  ) {}

  // ------------------------------------------------------------------
  // Queries
  // ------------------------------------------------------------------

  async listRuns(
    organizationId: string,
    query: { year?: number; month?: number; status?: string; teacherId?: string; page?: number; limit?: number },
  ) {
    const where: Prisma.PayrollRunWhereInput = { organizationId };
    if (query.year) where.periodYear = query.year;
    if (query.month) where.periodMonth = query.month;
    if (query.status) where.status = query.status as Prisma.EnumPayrollStatusFilter['equals'];
    if (query.teacherId) where.teacherId = query.teacherId;

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 50));

    const [items, total, agg] = await Promise.all([
      this.prisma.payrollRun.findMany({
        where,
        include: {
          teacher: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
        },
        orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.payrollRun.count({ where }),
      this.prisma.payrollRun.aggregate({
        where,
        _sum: { grossAmount: true, netAmount: true },
        _count: true,
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      totals: {
        gross: Number(agg._sum.grossAmount ?? 0),
        net: Number(agg._sum.netAmount ?? 0),
        runs: agg._count,
      },
    };
  }

  async getRun(organizationId: string, id: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id, organizationId },
      include: {
        teacher: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
      },
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    return run;
  }

  /** Per-period dashboard: counts and totals by status. */
  async getPeriodSummary(organizationId: string, year: number, month: number) {
    const runs = await this.prisma.payrollRun.findMany({
      where: { organizationId, periodYear: year, periodMonth: month },
      select: {
        status: true,
        grossAmount: true,
        netAmount: true,
        teacherId: true,
      },
    });

    const byStatus = { DRAFT: 0, CALCULATED: 0, REVIEWED: 0, APPROVED: 0, PAID: 0, CANCELLED: 0 } as Record<string, number>;
    let gross = 0;
    let net = 0;
    const teachers = new Set<string>();

    for (const r of runs) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      teachers.add(r.teacherId);
      if (r.status !== 'CANCELLED') {
        gross += Number(r.grossAmount);
        net += Number(r.netAmount);
      }
    }

    return {
      year,
      month,
      teachersCount: teachers.size,
      runs: runs.length,
      byStatus,
      totalGross: Math.round(gross * 100) / 100,
      totalNet: Math.round(net * 100) / 100,
      unpaid: byStatus.DRAFT + byStatus.CALCULATED + byStatus.REVIEWED + byStatus.APPROVED,
      paid: byStatus.PAID,
      pendingApproval: byStatus.REVIEWED + byStatus.APPROVED,
    };
  }

  // ------------------------------------------------------------------
  // Calculate
  // ------------------------------------------------------------------

  async calculateRun(organizationId: string, actorId: string, dto: CreatePayrollRunDto) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { id: dto.teacherId, organizationId },
      include: { user: { select: { id: true, isActive: true } } },
    });
    if (!teacher) throw new NotFoundException('Teacher not found');
    if (!teacher.user.isActive) throw new ConflictException('Teacher user is inactive');

    const periodStart = new Date(Date.UTC(dto.periodYear, dto.periodMonth - 1, 1));
    const periodEnd = new Date(Date.UTC(dto.periodYear, dto.periodMonth, 0, 23, 59, 59, 999));

    const conductedLessons = await this.prisma.lesson.count({
      where: {
        organizationId,
        teacherId: teacher.id,
        status: 'CONDUCTED',
        date: { gte: periodStart, lte: periodEnd },
      },
    });

    const lessonsForHours = await this.prisma.lesson.findMany({
      where: {
        organizationId,
        teacherId: teacher.id,
        status: 'CONDUCTED',
        date: { gte: periodStart, lte: periodEnd },
      },
      select: { startTime: true, endTime: true },
    });

    let totalMinutes = 0;
    for (const lesson of lessonsForHours) {
      const [sh, sm] = lesson.startTime.split(':').map(Number);
      const [eh, em] = lesson.endTime.split(':').map(Number);
      if ([sh, sm, eh, em].every(Number.isFinite)) {
        totalMinutes += Math.max(0, eh * 60 + em - (sh * 60 + sm));
      }
    }
    const derivedHoursWorked = Math.round((totalMinutes / 60) * 100) / 100;

    const absenceDays = dto.absenceDays ?? 0;
    const lateCount = dto.lateCount ?? 0;

    const salaryType = (dto.salaryType ?? teacher.salaryType) as 'MONTHLY' | 'HOURLY' | 'PER_LESSON';
    const baseAmount =
      dto.baseAmount ??
      (salaryType === 'HOURLY'
        ? teacher.hourlyRate
        : salaryType === 'PER_LESSON'
          ? teacher.lessonRate
          : null);
    if (baseAmount === null || baseAmount === undefined) {
      throw new BadRequestException(
        'baseAmount is required when the teacher has no rate configured for the selected salary type',
      );
    }

    const inputs: PayrollInputs = {
      salaryType,
      baseAmount,
      lessonsCount: dto.lessonsCount ?? (salaryType === 'PER_LESSON' ? conductedLessons : undefined),
      hoursWorked: dto.hoursWorked ?? (salaryType === 'HOURLY' ? derivedHoursWorked : undefined),
      overtimeHours: dto.overtimeHours,
      bonus: dto.bonus,
      absenceDays: dto.absenceDays ?? absenceDays,
      lateCount: dto.lateCount ?? lateCount,
      latePenaltyPerEvent: dto.latePenaltyPerEvent,
      otherDeduction: dto.otherDeduction,
      taxBasisPoints: dto.taxBasisPoints,
      workdaysInMonth: dto.workdaysInMonth,
    };

    let result;
    try {
      result = computePayroll(inputs);
    } catch (err) {
      if (err instanceof PayrollValidationError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }

    try {
      const run = await withPrismaRetry(async () => {
        return this.prisma.$transaction(async (tx) => {
          await this.financialPeriod.ensureNotClosedTx(tx, organizationId, periodStart);

          const created = await tx.payrollRun.create({
            data: {
              organizationId,
              teacherId: teacher.id,
              periodYear: dto.periodYear,
              periodMonth: dto.periodMonth,
              status: 'CALCULATED',
              salaryType: inputs.salaryType,
              baseAmount: toMajor2(inputs.baseAmount),
              lessonsCount: inputs.lessonsCount ?? conductedLessons,
              hoursWorked: toMajor2(inputs.hoursWorked ?? 0),
              hourlyRate: teacher.hourlyRate,
              lessonRate: teacher.lessonRate,
              overtimeHours: toMajor2(inputs.overtimeHours ?? 0),
              overtimeRate: dto.overtimeMultiplier !== undefined ? toMajor2(dto.overtimeMultiplier) : undefined,
              bonus: toMajor2(inputs.bonus ?? 0),
              absenceDays: result.absenceDays,
              absencePenalty: toMajor2(result.breakdown.totals.absenceMinor / 100),
              lateCount: result.lateCount,
              latePenalty: toMajor2(result.breakdown.totals.lateMinor / 100),
              otherDeduction: toMajor2(inputs.otherDeduction ?? 0),
              tax: result.taxAmount,
              grossAmount: result.grossAmount,
              netAmount: result.netAmount,
              breakdown: result.breakdown as unknown as Prisma.InputJsonValue,
              calculatedBy: actorId,
              calculatedAt: new Date(),
              updatedAt: new Date(),
            },
          });

          await this.auditWith(tx, {
            organizationId,
            userId: actorId,
            action: 'PAYROLL_CALCULATE',
            resource: 'PayrollRun',
            resourceId: created.id,
            changes: {
              period: { old: null, new: `${dto.periodYear}-${String(dto.periodMonth).padStart(2, '0')}` },
              teacherId: { old: null, new: teacher.id },
              gross: { old: null, new: result.grossAmount },
              net: { old: null, new: result.netAmount },
              engineVersion: { old: null, new: result.engineVersion },
            },
          });

          this.logger.log(
            `payroll_calculated org=${organizationId} run=${created.id} teacher=${teacher.id} net=${result.netAmount} engine=${result.engineVersion}`,
          );
          return created;
        });
      }, { logger: new Logger('PayrollService') });

      return run;
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === 'P2002') {
        throw new ConflictException(
          'A payroll run for this teacher and period already exists',
        );
      }
      throw err;
    }
  }

  // ------------------------------------------------------------------
  // Lifecycle transitions (guarded, transactional, audited)
  // ------------------------------------------------------------------

  private assertTransition(from: string, to: string) {
    if (!(TRANSITIONS[from] ?? []).includes(to)) {
      throw new ConflictException(`Illegal payroll status transition: ${from} -> ${to}`);
    }
  }

  private async transition(
    organizationId: string,
    actorId: string,
    id: string,
    to: string,
    extraData: Prisma.PayrollRunUpdateInput = {},
    auditChanges: Record<string, { old: unknown; new: unknown }> = {},
  ) {
    return withPrismaRetry(() => this.prisma.$transaction(async (tx) => {
      const run = await tx.payrollRun.findFirst({
        where: { id, organizationId },
        select: { id: true, status: true, teacherId: true, netAmount: true, periodYear: true, periodMonth: true },
      });
      if (!run) throw new NotFoundException('Payroll run not found');
      this.assertTransition(run.status, to);

      await this.financialPeriod.ensureNotClosedTx(
        tx,
        organizationId,
        new Date(Date.UTC(run.periodYear, run.periodMonth - 1, 1)),
      );

      const now = new Date();
      const stamps: Record<string, Prisma.PayrollRunUpdateInput> = {
        CALCULATED: { calculatedAt: now, calculatedBy: actorId },
        REVIEWED: { reviewedAt: now, reviewedBy: actorId },
        APPROVED: { approvedAt: now, approvedBy: actorId },
        PAID: { paidAt: now },
        CANCELLED: { cancelledAt: now, cancelledBy: actorId },
      };

      const updated = await tx.payrollRun.updateMany({
        // Guarded update: the WHERE clause repeats the expected status, so a
        // concurrent transition that already moved the row makes this a no-op
        // (count 0) instead of a double transition.
        where: { id: run.id, organizationId, status: run.status },
        data: { status: to as PayrollStatus, ...stamps[to], ...extraData },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Payroll run was modified concurrently, retry');
      }

      await this.auditWith(tx, {
        organizationId,
        userId: actorId,
        action: `PAYROLL_${to}`,
        resource: 'PayrollRun',
        resourceId: run.id,
        changes: {
          status: { old: run.status, new: to },
          // For the terminal money movement, record the paid amount.
          ...(to === 'PAID'
            ? { paidNet: { old: null, new: Number(run.netAmount) } }
            : {}),
          ...auditChanges,
        },
      });

      this.logger.log(`payroll_${to.toLowerCase()} org=${organizationId} run=${run.id} actor=${actorId}`);
      return tx.payrollRun.findFirst({ where: { id: run.id, organizationId } });
    }), { logger: new Logger('PayrollService') });
  }

  /** AuditService.record pinned to the same transaction client. */
  private auditWith(tx: Prisma.TransactionClient, params: Parameters<AuditService['record']>[0]) {
    return tx.auditLog.create({
      data: {
        organizationId: params.organizationId,
        userId: params.userId ?? null,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId ?? null,
        changes: (params.changes as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
        method: params.method ?? null,
        path: params.path ?? null,
        statusCode: params.statusCode ?? null,
      },
    });
  }

  review(organizationId: string, actorId: string, id: string) {
    return this.transition(organizationId, actorId, id, 'REVIEWED');
  }

  approve(organizationId: string, actorId: string, id: string) {
    return this.transition(organizationId, actorId, id, 'APPROVED');
  }

  /** Mark paid — the terminal financial transition. */
  pay(organizationId: string, actorId: string, id: string) {
    return this.transition(organizationId, actorId, id, 'PAID');
  }

  async cancel(organizationId: string, actorId: string, id: string, reason: string) {
    if (!reason || !reason.trim()) {
      throw new BadRequestException('A cancellation reason is required');
    }
    return this.transition(organizationId, actorId, id, 'CANCELLED', {
      cancelReason: reason.trim(),
    });
  }

  /** Adjust a DRAFT run (e.g. correction bonus/deduction) with full audit. */
  async adjust(organizationId: string, actorId: string, id: string, dto: AdjustPayrollRunDto) {
    const existing = await this.getRun(organizationId, id);

    if (existing.status !== 'DRAFT' && existing.status !== 'CALCULATED') {
      throw new ConflictException(
        `Only DRAFT or CALCULATED runs can be adjusted (current: ${existing.status})`,
      );
    }
    const bonus = dto.bonus !== undefined ? dto.bonus : Number(existing.bonus);
    const otherDeduction =
      dto.otherDeduction !== undefined ? dto.otherDeduction : Number(existing.otherDeduction);

    // Restore calculation parameters that were used at calculate time so an
    // adjustment never silently drops latePenalty / overtime / workdays inputs.
    const lateCount = existing.lateCount ?? 0;
    const latePenaltyPerEvent =
      lateCount > 0 ? Number(existing.latePenalty) / lateCount : undefined;
    const overtimeMultiplier =
      existing.overtimeRate != null ? Number(existing.overtimeRate) : undefined;
    let workdaysInMonth: number | undefined;
    if (
      existing.salaryType === 'MONTHLY' &&
      existing.absenceDays &&
      Number(existing.absencePenalty) > 0
    ) {
      const derived = Math.round(
        (Number(existing.baseAmount) * existing.absenceDays) /
          Number(existing.absencePenalty),
      );
      if (Number.isInteger(derived) && derived >= 1 && derived <= 31) {
        workdaysInMonth = derived;
      }
    }

    const recomputed = computePayroll({
      salaryType: existing.salaryType,
      baseAmount: existing.baseAmount,
      hoursWorked: existing.hoursWorked,
      lessonsCount: existing.lessonsCount,
      overtimeHours: existing.overtimeHours,
      overtimeMultiplier,
      bonus,
      absenceDays: existing.absenceDays,
      workdaysInMonth,
      lateCount,
      latePenaltyPerEvent,
      otherDeduction,
      taxBasisPoints: dto.taxBasisPoints,
    });

    await withPrismaRetry(async () => {
      await this.prisma.$transaction(async (tx) => {
        await this.financialPeriod.ensureNotClosedTx(
          tx,
          organizationId,
          new Date(Date.UTC(existing.periodYear, existing.periodMonth - 1, 1)),
        );

        const updated = await tx.payrollRun.updateMany({
          where: { id: existing.id, organizationId, status: existing.status },
          data: {
            bonus: dto.bonus !== undefined ? dto.bonus : undefined,
            otherDeduction: dto.otherDeduction !== undefined ? dto.otherDeduction : undefined,
            tax: recomputed.taxAmount,
            grossAmount: recomputed.grossAmount,
            netAmount: recomputed.netAmount,
            latePenalty: Number(
              (recomputed.breakdown.totals.lateMinor / 100).toFixed(2),
            ),
            absencePenalty: Number(
              (recomputed.breakdown.totals.absenceMinor / 100).toFixed(2),
            ),
            breakdown: recomputed.breakdown as unknown as Prisma.InputJsonValue,
          },
        });
        if (updated.count !== 1) {
          throw new ConflictException('Payroll run was modified concurrently, retry');
        }

        await this.auditWith(tx, {
          organizationId,
          userId: actorId,
          action: 'PAYROLL_ADJUST',
          resource: 'PayrollRun',
          resourceId: existing.id,
          changes: {
            bonus: { old: Number(existing.bonus), new: bonus },
            otherDeduction: { old: Number(existing.otherDeduction), new: otherDeduction },
            net: { old: Number(existing.netAmount), new: recomputed.netAmount },
          },
        });
      });
    }, { logger: new Logger('PayrollService') });

    return this.getRun(organizationId, id);
  }

  // ------------------------------------------------------------------
  // Revenue-Share & Retention KPI Model (% of student tuition)
  // ------------------------------------------------------------------

  async calculateRevenueShare(
    organizationId: string,
    params: {
      teacherId: string;
      year: number;
      month: number;
      revenueSharePercentage?: number;
      retentionBonusPercentage?: number;
    },
  ) {
    const { teacherId, year, month } = params;
    const sharePct = params.revenueSharePercentage ?? 40;
    const bonusPct = params.retentionBonusPercentage ?? 10;

    const teacher = await this.prisma.teacher.findFirst({
      where: { id: teacherId, organizationId },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        groups: {
          select: {
            id: true,
            name: true,
            enrollments: { select: { studentId: true, isActive: true } },
          },
        },
      },
    });
    if (!teacher) throw new NotFoundException('Teacher not found');

    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const studentIds: string[] = Array.from(
      new Set(teacher.groups.flatMap((g) => g.enrollments.map((s) => s.studentId))),
    );

    const payments = await this.prisma.payment.findMany({
      where: {
        organizationId,
        studentId: { in: studentIds },
        status: 'PAID',
        paidAt: { gte: startDate, lte: endDate },
      },
      select: { amount: true },
    });

    const totalCollected = payments.reduce((acc, p) => acc + Number(p.amount), 0);
    const baseShareAmount = Math.round(totalCollected * (sharePct / 100));

    let activeStudentsCount = 0;
    let totalEnrolledCount = 0;
    for (const g of teacher.groups) {
      for (const s of g.enrollments) {
        totalEnrolledCount++;
        if (s.isActive) activeStudentsCount++;
      }
    }

    const retentionRate =
      totalEnrolledCount > 0 ? Math.round((activeStudentsCount / totalEnrolledCount) * 100) : 100;

    const retentionBonusEarned =
      retentionRate >= 85 ? Math.round(baseShareAmount * (bonusPct / 100)) : 0;

    const totalEarnings = baseShareAmount + retentionBonusEarned;

    return {
      teacherId,
      teacherName: `${teacher.user.firstName} ${teacher.user.lastName ?? ''}`.trim(),
      periodYear: year,
      periodMonth: month,
      groupCount: teacher.groups.length,
      groups: teacher.groups.map((g) => ({
        id: g.id,
        name: g.name,
        studentsCount: g.enrollments.length,
      })),
      totalCollectedRevenue: totalCollected,
      revenueSharePercentage: sharePct,
      baseShareAmount,
      retentionRate,
      retentionThreshold: 85,
      retentionBonusPercentage: bonusPct,
      retentionBonusEarned,
      totalEarnings,
      formattedEarnings: new Intl.NumberFormat('uz-UZ').format(totalEarnings) + " so'm",
    };
  }

  async createRevenueShareRun(
    organizationId: string,
    actorId: string,
    params: {
      teacherId: string;
      year: number;
      month: number;
      revenueSharePercentage?: number;
      retentionBonusPercentage?: number;
    },
  ) {
    const calc = await this.calculateRevenueShare(organizationId, params);

    return this.calculateRun(organizationId, actorId, {
      teacherId: calc.teacherId,
      periodYear: calc.periodYear,
      periodMonth: calc.periodMonth,
      salaryType: 'MONTHLY',
      baseAmount: calc.baseShareAmount,
      bonus: calc.retentionBonusEarned,
    });
  }

  // ------------------------------------------------------------------
  // Smart KPI & Dynamic Performance Bonus Engine
  // ------------------------------------------------------------------

  async calculateTeacherSmartKpi(
    organizationId: string,
    params: {
      teacherId: string;
      year: number;
      month: number;
    },
  ) {
    const { teacherId, year, month } = params;

    const teacher = await this.prisma.teacher.findFirst({
      where: { id: teacherId, organizationId },
      include: {
        user: { select: { firstName: true, lastName: true, email: true, phone: true } },
        groups: {
          select: {
            id: true,
            name: true,
            enrollments: {
              select: { studentId: true, isActive: true },
            },
          },
        },
      },
    });
    if (!teacher) throw new NotFoundException('Teacher not found in organization');

    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const groupIds = teacher.groups.map((g) => g.id);

    // 1. Retention KPI
    let totalEnrolledCount = 0;
    let activeStudentsCount = 0;
    for (const g of teacher.groups) {
      for (const enr of g.enrollments) {
        totalEnrolledCount++;
        if (enr.isActive) activeStudentsCount++;
      }
    }
    const retentionRate =
      totalEnrolledCount > 0 ? Math.round((activeStudentsCount / totalEnrolledCount) * 100) : 100;

    // 2. Attendance KPI
    let attendanceRate = 100;
    let attendanceStats = { total: 0, present: 0, late: 0, absent: 0 };
    if (groupIds.length > 0) {
      const attendanceRecords = await this.prisma.attendance.findMany({
        where: {
          organizationId,
          groupId: { in: groupIds },
          date: { gte: startDate, lte: endDate },
        },
        select: { status: true },
      });

      const total = attendanceRecords.length;
      const present = attendanceRecords.filter((a) => a.status === 'PRESENT').length;
      const late = attendanceRecords.filter((a) => a.status === 'LATE').length;
      const absent = attendanceRecords.filter((a) => a.status === 'ABSENT').length;

      attendanceStats = { total, present, late, absent };
      if (total > 0) {
        attendanceRate = Math.round(((present + late * 0.5) / total) * 100);
      }
    }

    // 3. Academic Grade / Exam KPI
    let averageGradeScore = 85;
    let gradeCount = 0;
    if (groupIds.length > 0) {
      const grades = await this.prisma.grade.findMany({
        where: {
          organizationId,
          groupId: { in: groupIds },
          createdAt: { gte: startDate, lte: endDate },
        },
        select: { value: true, maxValue: true },
      });
      if (grades.length > 0) {
        gradeCount = grades.length;
        const totalPct = grades.reduce(
          (sum, g) => sum + (g.value / (g.maxValue || 100)) * 100,
          0,
        );
        averageGradeScore = Math.round(totalPct / grades.length);
      }
    }

    // 4. Conducted Lessons & Volume
    const conductedLessons = await this.prisma.lesson.count({
      where: {
        organizationId,
        teacherId,
        status: 'CONDUCTED',
        date: { gte: startDate, lte: endDate },
      },
    });

    const lessonsForHours = await this.prisma.lesson.findMany({
      where: {
        organizationId,
        teacherId,
        status: 'CONDUCTED',
        date: { gte: startDate, lte: endDate },
      },
      select: { startTime: true, endTime: true },
    });

    let totalMinutes = 0;
    for (const l of lessonsForHours) {
      const [sh, sm] = (l.startTime || '').split(':').map(Number);
      const [eh, em] = (l.endTime || '').split(':').map(Number);
      if ([sh, sm, eh, em].every(Number.isFinite)) {
        totalMinutes += Math.max(0, eh * 60 + em - (sh * 60 + sm));
      }
    }
    const hoursWorked = Math.round((totalMinutes / 60) * 10) / 10;

    // 5. Base Salary Resolution for Bonus Scaling
    const salaryType = (teacher.salaryType || 'MONTHLY') as 'MONTHLY' | 'HOURLY' | 'PER_LESSON';
    let estimatedBase = (teacher as { baseSalary?: unknown }).baseSalary
      ? Number((teacher as { baseSalary?: unknown }).baseSalary)
      : 4_000_000;
    if (salaryType === 'HOURLY' && teacher.hourlyRate) {
      estimatedBase = Number(teacher.hourlyRate) * (hoursWorked || 20);
    } else if (salaryType === 'PER_LESSON' && teacher.lessonRate) {
      estimatedBase = Number(teacher.lessonRate) * (conductedLessons || 12);
    }

    // 6. Dynamic Bonus Pillars
    // Attendance Bonus: >=92% -> +10%, >=85% -> +5%
    let attendanceBonus = 0;
    let attendanceBonusPct = 0;
    if (attendanceRate >= 92) {
      attendanceBonusPct = 10;
      attendanceBonus = Math.round(estimatedBase * 0.10);
    } else if (attendanceRate >= 85) {
      attendanceBonusPct = 5;
      attendanceBonus = Math.round(estimatedBase * 0.05);
    }

    // Retention Bonus: >=95% -> +15%, >=88% -> +10%
    let retentionBonus = 0;
    let retentionBonusPct = 0;
    if (retentionRate >= 95) {
      retentionBonusPct = 15;
      retentionBonus = Math.round(estimatedBase * 0.15);
    } else if (retentionRate >= 88) {
      retentionBonusPct = 10;
      retentionBonus = Math.round(estimatedBase * 0.10);
    }

    // Academic / Exam Bonus: >=88% -> +10%, >=80% -> +5%
    let academicBonus = 0;
    let academicBonusPct = 0;
    if (averageGradeScore >= 88) {
      academicBonusPct = 10;
      academicBonus = Math.round(estimatedBase * 0.10);
    } else if (averageGradeScore >= 80) {
      academicBonusPct = 5;
      academicBonus = Math.round(estimatedBase * 0.05);
    }

    const totalRecommendedBonus = attendanceBonus + retentionBonus + academicBonus;

    // 7. Composite KPI Score (0-100) & Tier
    const compositeScore = Math.min(
      100,
      Math.max(
        0,
        Math.round(attendanceRate * 0.35 + retentionRate * 0.35 + averageGradeScore * 0.30),
      ),
    );

    let tier: 'EXEMPLARY' | 'PROFICIENT' | 'DEVELOPING' | 'NEEDS_IMPROVEMENT';
    let tierLabel: string;
    let badgeColor: string;
    if (compositeScore >= 90) {
      tier = 'EXEMPLARY';
      tierLabel = "A'lo (Exemplary)";
      badgeColor = '#10B981';
    } else if (compositeScore >= 80) {
      tier = 'PROFICIENT';
      tierLabel = 'Yaxshi (Proficient)';
      badgeColor = '#3B82F6';
    } else if (compositeScore >= 70) {
      tier = 'DEVELOPING';
      tierLabel = 'Qoniqarli (Developing)';
      badgeColor = '#F59E0B';
    } else {
      tier = 'NEEDS_IMPROVEMENT';
      tierLabel = 'Rivojlanish talab etiladi';
      badgeColor = '#EF4444';
    }

    const estimatedGross = estimatedBase + totalRecommendedBonus;

    return {
      teacherId,
      teacherName: `${teacher.user.firstName} ${teacher.user.lastName ?? ''}`.trim(),
      email: teacher.user.email,
      salaryType,
      periodYear: year,
      periodMonth: month,
      groupCount: teacher.groups.length,
      groups: teacher.groups.map((g) => ({
        id: g.id,
        name: g.name,
        
        studentsCount: g.enrollments.length,
      })),
      pillars: {
        attendance: {
          rate: attendanceRate,
          threshold: 85,
          stats: attendanceStats,
          bonusPct: attendanceBonusPct,
          bonusEarned: attendanceBonus,
        },
        retention: {
          rate: retentionRate,
          threshold: 88,
          activeStudents: activeStudentsCount,
          totalStudents: totalEnrolledCount,
          bonusPct: retentionBonusPct,
          bonusEarned: retentionBonus,
        },
        academic: {
          averageScore: averageGradeScore,
          threshold: 80,
          gradeCount,
          bonusPct: academicBonusPct,
          bonusEarned: academicBonus,
        },
        discipline: {
          conductedLessons,
          hoursWorked,
        },
      },
      compositeScore,
      tier,
      tierLabel,
      badgeColor,
      estimatedBase,
      totalRecommendedBonus,
      estimatedGross,
      formattedBonus: new Intl.NumberFormat('uz-UZ').format(totalRecommendedBonus) + " so'm",
      formattedGross: new Intl.NumberFormat('uz-UZ').format(estimatedGross) + " so'm",
    };
  }

  async createSmartKpiRun(
    organizationId: string,
    actorId: string,
    params: {
      teacherId: string;
      year: number;
      month: number;
      customBonus?: number;
      notes?: string;
    },
  ) {
    const kpi = await this.calculateTeacherSmartKpi(organizationId, {
      teacherId: params.teacherId,
      year: params.year,
      month: params.month,
    });

    const finalBonus =
      params.customBonus !== undefined ? params.customBonus : kpi.totalRecommendedBonus;

    const autoNotes =
      params.notes ||
      `Smart KPI Auto-Calc (${kpi.tierLabel}): Attendance=${kpi.pillars.attendance.rate}%, Retention=${kpi.pillars.retention.rate}%, Grade=${kpi.pillars.academic.averageScore}%, Score=${kpi.compositeScore}/100`;

    return this.calculateRun(organizationId, actorId, {
      teacherId: kpi.teacherId,
      periodYear: kpi.periodYear,
      periodMonth: kpi.periodMonth,
      salaryType: kpi.salaryType,
      baseAmount: kpi.estimatedBase,
      bonus: finalBonus,
      hoursWorked: kpi.pillars.discipline.hoursWorked,
      lessonsCount: kpi.pillars.discipline.conductedLessons,
    });
  }
}
