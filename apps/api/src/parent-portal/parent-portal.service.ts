import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { computeAttendanceRate } from '../common/attendance-rate.js';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Parent Portal service (37-Phase Report §17/§28 gap #16).
 *
 * Authorization model:
 *  - ParentAccount authenticates independently (email + passwordHash).
 *  - Every query is double-scoped: organizationId AND the verified
 *    ParentStudent link. A parent can only ever read rows that are joined
 *    through their own ParentStudent rows — no student id guessing, no
 *    existence leaks (foreign ids are reported as NotFound).
 *  - The per-child visibility flags (canViewGrades / canViewPayments /
 *    canViewAttendance) gate each data domain individually.
 */

export interface ParentContext {
  parentId: string;
  organizationId: string;
}

/**
 * A fixed, valid bcrypt hash used only to burn the same CPU time as a real
 * comparison when the account does not exist (account-enumeration resistance).
 */
const DUMMY_PASSWORD_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

/** Result of the child-scope check: the link row itself (with flags). */
export type ChildLink = {
  studentId: string;
  relationship: string;
  canViewGrades: boolean;
  canViewPayments: boolean;
  canViewAttendance: boolean;
};

@Injectable()
export class ParentPortalService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Authenticate a parent by email + password, with optional organizationId.
   *
   * If organizationId is provided, authenticate against that specific center.
   * If organizationId is omitted:
   *  - If 1 account exists, authenticate against it.
   *  - If multiple accounts exist for this email across centers: verify the password
   *    against all accounts. If exactly 1 matches, log into that center.
   *    If multiple match, prompt tenant disambiguation with code: 'ORGANIZATION_REQUIRED'.
   */
  async authenticate(
    email: string,
    password: string,
    organizationId?: string,
  ): Promise<{
    id: string;
    organizationId: string;
    email: string;
    firstName: string;
    lastName: string;
  }> {
    const bcrypt = (await import('bcryptjs')).default ?? (await import('bcryptjs'));
    const normalizedEmail = email.toLowerCase().trim();

    if (organizationId) {
      const parent = await this.prisma.parentAccount.findFirst({
        where: { email: normalizedEmail, organizationId, isActive: true },
        select: {
          id: true,
          organizationId: true,
          email: true,
          firstName: true,
          lastName: true,
          passwordHash: true,
        },
      });

      if (!parent) {
        await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
        throw new UnauthorizedException('Invalid parent credentials');
      }
      if (!(await bcrypt.compare(password, parent.passwordHash))) {
        throw new UnauthorizedException('Invalid parent credentials');
      }

      await this.prisma.parentAccount.update({
        where: { id: parent.id },
        data: { lastLoginAt: new Date() },
      });

      return {
        id: parent.id,
        organizationId: parent.organizationId,
        email: parent.email,
        firstName: parent.firstName,
        lastName: parent.lastName,
      };
    }

    const accounts = await this.prisma.parentAccount.findMany({
      where: { email: normalizedEmail, isActive: true },
      select: {
        id: true,
        organizationId: true,
        email: true,
        firstName: true,
        lastName: true,
        passwordHash: true,
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (accounts.length === 0) {
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      throw new UnauthorizedException('Invalid parent credentials');
    }

    if (accounts.length === 1) {
      const parent = accounts[0];
      if (!(await bcrypt.compare(password, parent.passwordHash))) {
        throw new UnauthorizedException('Invalid parent credentials');
      }

      await this.prisma.parentAccount.update({
        where: { id: parent.id },
        data: { lastLoginAt: new Date() },
      });

      return {
        id: parent.id,
        organizationId: parent.organizationId,
        email: parent.email,
        firstName: parent.firstName,
        lastName: parent.lastName,
      };
    }

    // Multiple accounts found for this email across different organizations.
    // Check which accounts match the password.
    const matchingAccounts: typeof accounts = [];
    for (const acc of accounts) {
      if (await bcrypt.compare(password, acc.passwordHash)) {
        matchingAccounts.push(acc);
      }
    }

    if (matchingAccounts.length === 0) {
      throw new UnauthorizedException('Invalid parent credentials');
    }

    if (matchingAccounts.length === 1) {
      const parent = matchingAccounts[0];
      await this.prisma.parentAccount.update({
        where: { id: parent.id },
        data: { lastLoginAt: new Date() },
      });

      return {
        id: parent.id,
        organizationId: parent.organizationId,
        email: parent.email,
        firstName: parent.firstName,
        lastName: parent.lastName,
      };
    }

    // Multiple accounts matched the password -> require organization selection
    throw new BadRequestException({
      statusCode: 400,
      error: 'Bad Request',
      code: 'ORGANIZATION_REQUIRED',
      message: 'Multiple organizations found for this account. Please specify your organization ID.',
      organizations: matchingAccounts.map((a) => ({
        id: a.organizationId,
        name: a.organization.name,
      })),
    });
  }

  /** List all verified children with per-domain visibility flags. */
  async listChildren(ctx: ParentContext) {
    const links = await this.prisma.parentStudent.findMany({
      where: { parent: { id: ctx.parentId, organizationId: ctx.organizationId } },
      // Deterministic order: consumers (the Telegram bot) address a child by
      // its position in this list, so the order must be stable across calls.
      orderBy: { studentId: 'asc' },
      select: {
        studentId: true,
        relationship: true,
        canViewGrades: true,
        canViewPayments: true,
        canViewAttendance: true,
        student: {
          select: {
            id: true,
            balance: true,
            user: { select: { firstName: true, lastName: true, avatar: true } },
            groups: {
              where: { isActive: true },
              select: { group: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });
    return links.map((link) => ({
      studentId: link.studentId,
      relationship: link.relationship,
      name:
        `${link.student.user.firstName ?? ''} ${link.student.user.lastName ?? ''}`.trim() ||
        '—',
      permissions: {
        grades: link.canViewGrades,
        payments: link.canViewPayments,
        attendance: link.canViewAttendance,
      },
    }));
  }

  /**
   * Weekly schedule for a verified child.
   *
   * Schedule is not a separately-flagged domain, so it is gated by the
   * child's attendance visibility flag (academic data the parent already
   * sees) — never by anything the caller supplies.
   */
  async getChildSchedule(ctx: ParentContext, studentId: string) {
    await this.requireLink(ctx, studentId, 'canViewAttendance');

    const enrollments = await this.prisma.studentGroup.findMany({
      where: { studentId, isActive: true, organizationId: ctx.organizationId },
      select: { groupId: true },
    });
    const groupIds = enrollments.map((e) => e.groupId);
    if (groupIds.length === 0) return [];

    return this.prisma.schedule.findMany({
      where: { groupId: { in: groupIds }, isActive: true },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      take: 50,
      select: {
        id: true,
        dayOfWeek: true,
        startTime: true,
        endTime: true,
        room: true,
        group: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Resolve and enforce the parent→child link. Throws NotFound (no leak)
   * when the child is not linked to this parent, or when the requested
   * data domain is not permitted for that child.
   */
  private async requireLink(
    ctx: ParentContext,
    studentId: string,
    domain: 'canViewGrades' | 'canViewPayments' | 'canViewAttendance',
  ): Promise<ChildLink> {
    const link = await this.prisma.parentStudent.findFirst({
      where: {
        studentId,
        parent: { id: ctx.parentId, organizationId: ctx.organizationId },
      },
      select: {
        studentId: true,
        relationship: true,
        canViewGrades: true,
        canViewPayments: true,
        canViewAttendance: true,
      },
    });
    if (!link) throw new NotFoundException('Student not linked to this parent account');
    if (!link[domain]) throw new NotFoundException('Not permitted for this student');
    return link;
  }

  /** Attendance history for a verified child (attendance flag respected). */
  async getChildAttendance(ctx: ParentContext, studentId: string) {
    await this.requireLink(ctx, studentId, 'canViewAttendance');
    return this.prisma.attendance.findMany({
      where: { organizationId: ctx.organizationId, studentId },
      orderBy: { date: 'desc' },
      take: 90,
      select: {
        id: true,
        date: true,
        status: true,
        note: true,
        group: { select: { id: true, name: true } },
        lesson: { select: { id: true, date: true, startTime: true, topic: true } },
      },
    });
  }

  /** Attendance summary for a verified child. */
  async getChildAttendanceSummary(ctx: ParentContext, studentId: string) {
    await this.requireLink(ctx, studentId, 'canViewAttendance');
    const rows = await this.prisma.attendance.groupBy({
      by: ['status'],
      where: { organizationId: ctx.organizationId, studentId },
      _count: true,
    });
    const byStatus: Record<string, number> = {};
    let total = 0;
    for (const row of rows) {
      byStatus[row.status] = row._count;
      total += row._count;
    }
    const present = (byStatus.PRESENT ?? 0) + (byStatus.LATE ?? 0);
    return {
      total,
      byStatus,
      attendanceRate: total > 0 ? Math.round((present / total) * 100) : null,
    };
  }

  /** Grades for a verified child (grades flag respected). */
  async getChildGrades(ctx: ParentContext, studentId: string) {
    await this.requireLink(ctx, studentId, 'canViewGrades');
    const [grades, examResults] = await Promise.all([
      this.prisma.grade.findMany({
        where: { organizationId: ctx.organizationId, studentId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          value: true,
          maxValue: true,
          label: true,
          notes: true,
          createdAt: true,
          group: { select: { id: true, name: true } },
        },
      }),
      this.prisma.examResult.findMany({
        where: { organizationId: ctx.organizationId, studentId },
        orderBy: { exam: { examDate: 'desc' } },
        take: 20,
        select: {
          id: true,
          marksObtained: true,
          isPassed: true,
          exam: {
            select: { id: true, title: true, subject: true, examDate: true, examType: true },
          },
        },
      }),
    ]);
    return { grades, examResults };
  }

  /** Invoices + balance for a verified child (payments flag respected). */
  async getChildInvoices(ctx: ParentContext, studentId: string) {
    await this.requireLink(ctx, studentId, 'canViewPayments');
    const invoices = await this.prisma.invoice.findMany({
      where: {
        organizationId: ctx.organizationId,
        studentId,
        status: { notIn: ['DRAFT', 'CANCELLED'] },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        number: true,
        status: true,
        total: true,
        paidAmount: true,
        refundedAmount: true,
        dueDate: true,
        issueDate: true,
      },
    });
    const payments = await this.prisma.payment.findMany({
      where: {
        organizationId: ctx.organizationId,
        studentId,
        status: { in: ['PAID', 'PARTIALLY_PAID'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        amount: true,
        status: true,
        method: true,
        receiptNumber: true,
        paidAt: true,
      },
    });
    let outstanding = 0;
    let overdue = 0;
    const now = new Date();
    for (const inv of invoices) {
      const remaining =
        Number(inv.total) - Number(inv.paidAmount ?? 0) + Number(inv.refundedAmount ?? 0);
      if (remaining > 0) {
        outstanding += remaining;
        if (inv.dueDate && inv.dueDate < now && inv.status !== 'PAID') overdue += remaining;
      }
    }
    return { invoices, payments, outstanding, overdue };
  }
}

