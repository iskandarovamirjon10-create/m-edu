import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DataQualityQueryDto } from './dto/data-quality.dto';

export interface QualityRule {
  id: string;
  name: string;
  description: string;
  entityType: string;
  field?: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  check: (prisma: PrismaService, orgId: string) => Promise<QualityIssue[]>;
}

export interface QualityIssue {
  entityType: string;
  entityId: string;
  field?: string;
  message: string;
  ruleId: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

@Injectable()
export class DataQualityService {
  private rules: QualityRule[] = [
    {
      id: 'student-missing-email',
      name: 'Students without email',
      description: 'Students must have a valid email address',
      entityType: 'STUDENT',
      severity: 'HIGH',
      check: async (prisma, orgId) => {
        const students = await prisma.student.findMany({
          where: { organizationId: orgId, user: { email: { startsWith: 'invalid_' } } },
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        });
        return students.map(s => ({
          entityType: 'STUDENT',
          entityId: s.id,
          field: 'email',
          message: `Student "${s.user?.firstName} ${s.user?.lastName}" is missing an email address`,
          ruleId: 'student-missing-email',
          severity: 'HIGH' as const,
        }));
      },
    },
    {
      id: 'student-missing-phone',
      name: 'Students without phone',
      description: 'Students should have at least one contact phone',
      entityType: 'STUDENT',
      severity: 'MEDIUM',
      check: async (prisma, orgId) => {
        const students = await prisma.student.findMany({
          where: {
            organizationId: orgId,
            OR: [
              { user: { phone: null } },
              { parentPhone: null },
            ],
          },
          include: { user: { select: { firstName: true, lastName: true } } },
        });
        return students.map(s => ({
          entityType: 'STUDENT',
          entityId: s.id,
          field: 'phone',
          message: `Student "${s.user?.firstName} ${s.user?.lastName}" has no phone or parent phone`,
          ruleId: 'student-missing-phone',
          severity: 'MEDIUM' as const,
        }));
      },
    },
    {
      id: 'student-missing-dob',
      name: 'Students without date of birth',
      description: 'Students should have a date of birth on file',
      entityType: 'STUDENT',
      severity: 'MEDIUM',
      check: async (prisma, orgId) => {
        const students = await prisma.student.findMany({
          where: { organizationId: orgId, dateOfBirth: null },
          include: { user: { select: { firstName: true, lastName: true } } },
        });
        return students.map(s => ({
          entityType: 'STUDENT',
          entityId: s.id,
          field: 'dateOfBirth',
          message: `Student "${s.user?.firstName} ${s.user?.lastName}" is missing date of birth`,
          ruleId: 'student-missing-dob',
          severity: 'MEDIUM' as const,
        }));
      },
    },
    {
      id: 'lead-stale',
      name: 'Stale leads not contacted',
      description: 'Leads in NEW or CONTACTED stage with no activity in 14 days',
      entityType: 'LEAD',
      severity: 'LOW',
      check: async (prisma, orgId) => {
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
        const leads = await prisma.lead.findMany({
          where: {
            organizationId: orgId,
            stage: { in: ['NEW', 'CONTACTED'] },
            updatedAt: { lt: fourteenDaysAgo },
          },
        });
        return leads.map(l => ({
          entityType: 'LEAD',
          entityId: l.id,
          message: `Lead "${l.firstName} ${l.lastName ?? ''}" has had no activity for over 14 days`,
          ruleId: 'lead-stale',
          severity: 'LOW' as const,
        }));
      },
    },
    {
      id: 'payment-overdue-unpaid',
      name: 'Overdue unpaid payments',
      description: 'Payments past due date with PENDING status',
      entityType: 'PAYMENT',
      severity: 'CRITICAL',
      check: async (prisma, orgId) => {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const payments = await prisma.payment.findMany({
          where: {
            organizationId: orgId,
            status: 'PENDING',
            dueDate: { lt: today },
          },
          include: { student: { include: { user: { select: { firstName: true, lastName: true } } } } },
        });
        return payments.map(p => ({
          entityType: 'PAYMENT',
          entityId: p.id,
          message: `Payment of ${p.amount} for ${p.student?.user?.firstName} ${p.student?.user?.lastName} is overdue`,
          ruleId: 'payment-overdue-unpaid',
          severity: 'CRITICAL' as const,
        }));
      },
    },
    {
      id: 'group-empty',
      name: 'Groups with no students',
      description: 'Active groups with no active enrollments',
      entityType: 'GROUP',
      severity: 'MEDIUM',
      check: async (prisma, orgId) => {
        const groups = await prisma.group.findMany({
          where: { organizationId: orgId, isActive: true },
          include: {
            _count: { select: { enrollments: { where: { isActive: true } } } },
          },
        });
        return groups
          .filter(g => g._count.enrollments === 0)
          .map(g => ({
            entityType: 'GROUP',
            entityId: g.id,
            message: `Group "${g.name}" is active but has no enrolled students`,
            ruleId: 'group-empty',
            severity: 'MEDIUM' as const,
          }));
      },
    },
    {
      id: 'teacher-no-groups',
      name: 'Teachers with no assigned groups',
      description: 'Active teachers not assigned to any active group',
      entityType: 'TEACHER',
      severity: 'LOW',
      check: async (prisma, orgId) => {
        const teachers = await prisma.teacher.findMany({
          where: {
            organizationId: orgId,
            groups: { every: { isActive: false } },
          },
          include: { user: { select: { firstName: true, lastName: true } } },
        });
        return teachers.map(t => ({
          entityType: 'TEACHER',
          entityId: t.id,
          message: `Teacher "${t.user?.firstName} ${t.user?.lastName}" has no active group assignments`,
          ruleId: 'teacher-no-groups',
          severity: 'LOW' as const,
        }));
      },
    },
    {
      id: 'library-book-unavailable',
      name: 'Books with zero availability',
      description: 'Library books where available quantity is 0 despite positive total quantity',
      entityType: 'LIBRARY_BOOK',
      severity: 'LOW',
      check: async (prisma, orgId) => {
        const books = await prisma.libraryBook.findMany({
          where: {
            organizationId: orgId,
            quantity: { gt: 0 },
            available: 0,
          },
        });
        return books.map(b => ({
          entityType: 'LIBRARY_BOOK',
          entityId: b.id,
          message: `Book "${b.title}" has quantity ${b.quantity} but 0 available (all borrowed?)`,
          ruleId: 'library-book-unavailable',
          severity: 'LOW' as const,
        }));
      },
    },
  ];

  constructor(private readonly prisma: PrismaService) {}

  async getSummary(organizationId: string) {
    const [total, bySeverity, byCategory, resolvedThisWeek, detectedToday] = await Promise.all([
      this.prisma.dataQualityIssue.count({ where: { organizationId, resolvedAt: null } }),
      this.getCountBySeverity(organizationId),
      this.getCountByCategory(organizationId),
      this.getResolvedThisWeek(organizationId),
      this.getDetectedToday(organizationId),
    ]);

    return { total, bySeverity, byCategory, resolvedThisWeek, detectedToday };
  }

  async runAllChecks(organizationId: string) {
    const allIssues: QualityIssue[] = [];

    for (const rule of this.rules) {
      try {
        const issues = await rule.check(this.prisma, organizationId);
        allIssues.push(...issues);

        // Upsert each issue into the DB (avoid duplicates)
        // Bulk upsert using transaction to fix N+1 queries
        if (issues.length > 0) {
          const ops = issues.map((issue) => 
            this.prisma.dataQualityIssue.upsert({
              where: { id: `${issue.ruleId}-${issue.entityId}` },
              create: {
                id: `${issue.ruleId}-${issue.entityId}`,
                organizationId,
                entityType: issue.entityType,
                entityId: issue.entityId,
                category: 'OTHER',
                severity: issue.severity,
                field: issue.field ?? null,
                message: issue.message,
                ruleId: issue.ruleId,
                detectedAt: new Date(),
              },
              update: {
                message: issue.message,
                severity: issue.severity,
                resolvedAt: null,
                resolvedBy: null,
                resolutionNote: null,
              },
            })
          );
          await this.prisma.$transaction(ops);
        }
      } catch (error) {
        console.error(`Data quality check failed for rule ${rule.id}:`, error);
      }
    }

    return { issues: allIssues, total: allIssues.length };
  }

  async getIssues(organizationId: string, query: DataQualityQueryDto = {}) {
    const where: Prisma.DataQualityIssueWhereInput = { organizationId };
    if (query.severity) where.severity = query.severity;
    if (query.entityType) where.entityType = query.entityType;
    if (query.resolved === 'true') where.resolvedAt = { not: null };
    if (query.resolved === 'false') where.resolvedAt = null;

    return this.prisma.dataQualityIssue.findMany({
      where,
      orderBy: { detectedAt: 'desc' },
      take: Math.min(100, Math.max(1, Number(query.limit) || 50)),
    });
  }

  async resolveIssue(organizationId: string, id: string, resolvedBy: string, note?: string) {
    return this.prisma.dataQualityIssue.updateMany({
      where: { id, organizationId },
      data: {
        resolvedAt: new Date(),
        resolvedBy,
        resolutionNote: note ?? null,
      },
    });
  }

  private async getCountBySeverity(orgId: string) {
    const rows = await this.prisma.dataQualityIssue.groupBy({
      by: ['severity'],
      where: { organizationId: orgId, resolvedAt: null },
      _count: true,
    });
    return Object.fromEntries(rows.map(r => [r.severity, r._count]));
  }

  private async getCountByCategory(orgId: string) {
    const rows = await this.prisma.dataQualityIssue.groupBy({
      by: ['category'],
      where: { organizationId: orgId, resolvedAt: null },
      _count: true,
    });
    return Object.fromEntries(rows.map(r => [r.category, r._count]));
  }

  private async getResolvedThisWeek(orgId: string) {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return this.prisma.dataQualityIssue.count({
      where: { organizationId: orgId, resolvedAt: { gte: weekAgo } },
    });
  }

  private async getDetectedToday(orgId: string) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return this.prisma.dataQualityIssue.count({
      where: { organizationId: orgId, detectedAt: { gte: today } },
    });
  }
}

