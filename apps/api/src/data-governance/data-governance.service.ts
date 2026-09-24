import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parsePagination } from '../lib/pagination';
import { Prisma } from '@prisma/client';
import { ExportLogQueryDto, AccessAuditQueryDto } from './dto/data-governance.dto';

const SENSITIVE_RESOURCES = [
  'STUDENT', 'PAYMENT', 'EMPLOYEE', 'SALARY', 'LEAVE',
  'INVOICE', 'EXPENSE', 'FACE_ENROLLMENT', 'FACE_TEMPLATE',
  'PARENT_ACCOUNT', 'PARENT_STUDENT',
];

@Injectable()
export class DataGovernanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getRetentionPolicies(organizationId: string) {
    return this.prisma.dataRetentionPolicy.findMany({
      where: { organizationId },
      orderBy: { dataType: 'asc' },
    });
  }

  async upsertRetentionPolicy(
    organizationId: string,
    dataType: string,
    retentionDays: number,
    archivalDays: number | null | undefined,
    deleteAfterDays: number | null | undefined,
    isActive: boolean,
  ) {
    return this.prisma.dataRetentionPolicy.upsert({
      where: {
        organizationId_dataType: { organizationId, dataType },
      },
      create: {
        organizationId,
        entityType: dataType,
        dataType,
        retentionDays,
        archivalDays: archivalDays ?? null,
        deleteAfterDays: deleteAfterDays ?? null,
        isActive,
      },
      update: {
        retentionDays,
        archivalDays: archivalDays ?? null,
        deleteAfterDays: deleteAfterDays ?? null,
        isActive,
      },
    });
  }

  async getExportLog(organizationId: string, query: ExportLogQueryDto) {
    const { page, limit, skip } = parsePagination(query, { limit: 20, maxLimit: 100 });

    const where: Prisma.DataExportLogWhereInput = { organizationId };

    if (query.exportType) where.exportType = query.exportType;
    if (query.status) where.status = query.status;
    if (query.userId) where.userId = query.userId;
    if (query.fromDate || query.toDate) {
      where.createdAt = {};
      if (query.fromDate) where.createdAt.gte = new Date(query.fromDate);
      if (query.toDate) where.createdAt.lte = new Date(query.toDate);
    }

    const [items, total] = await Promise.all([
      this.prisma.dataExportLog.findMany({
        where,
        
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.dataExportLog.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async logExport(
    organizationId: string,
    userId: string,
    exportType: string,
    format: string,
    recordCount: number,
    ipAddress: string | null | undefined,
    purpose: string | null | undefined,
  ) {
    return this.prisma.dataExportLog.create({
      data: {
        organizationId,
        userId,
        entityType: exportType,
        exportType,
        format,
        recordCount,
        ipAddress: ipAddress ?? null,
        purpose: purpose ?? null,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
  }

  async getExportStats(organizationId: string) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [totalExports, byType, recentCount, lastExport] = await Promise.all([
      this.prisma.dataExportLog.count({ where: { organizationId } }),
      this.prisma.dataExportLog.groupBy({
        by: ['exportType'],
        where: { organizationId },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      this.prisma.dataExportLog.count({
        where: { organizationId, createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.dataExportLog.findFirst({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, exportType: true, format: true, recordCount: true },
      }),
    ]);

    return {
      totalExports,
      last30Days: recentCount,
      byType: byType.map((r) => ({ type: r.exportType, count: r._count.id })),
      lastExport,
    };
  }

  async getDataAccessAudit(organizationId: string, query: AccessAuditQueryDto) {
    const { page, limit, skip } = parsePagination(query, { limit: 20, maxLimit: 100 });

    const where: Prisma.AuditLogWhereInput = {
      organizationId,
      resource: { in: SENSITIVE_RESOURCES },
    };

    if (query.entityType) where.resource = query.entityType;
    if (query.action) where.action = query.action;
    if (query.userId) where.userId = query.userId;
    if (query.fromDate || query.toDate) {
      where.timestamp = {};
      if (query.fromDate) where.timestamp.gte = new Date(query.fromDate);
      if (query.toDate) where.timestamp.lte = new Date(query.toDate);
    }

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const actorIds = Array.from(new Set(rows.map((r) => r.userId).filter((id): id is string => !!id)));
    const actors = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : [];
    const actorMap = new Map(actors.map((a) => [a.id, a]));

    const items = rows.map((row) => {
      const actor = row.userId ? actorMap.get(row.userId) : null;
      return {
        id: row.id,
        action: row.action,
        resource: row.resource,
        resourceId: row.resourceId,
        userId: row.userId,
        userName: actor ? `${actor.firstName} ${actor.lastName}`.trim() || actor.email : null,
        ipAddress: row.ipAddress,
        timestamp: row.timestamp,
      };
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async executeRetentionCheck(organizationId: string) {
    const policies = await this.prisma.dataRetentionPolicy.findMany({
      where: { organizationId, isActive: true },
    });

    const now = new Date();
    const results: Array<{
      dataType: string;
      policyId: string;
      archivalCandidates: number;
      deletionCandidates: number;
      oldestRecord: Date | null;
    }> = [];

    for (const policy of policies) {
      let oldestRecord: Date | null = null;
      let archivalCandidates = 0;
      let deletionCandidates = 0;

      if (policy.dataType === 'STUDENT_RECORDS') {
        oldestRecord = (await this.prisma.student.findFirst({
          where: { organizationId },
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true },
        }))?.createdAt ?? null;

        if (policy.archivalDays) {
          const archivalCutoff = new Date(now.getTime() - policy.archivalDays * 24 * 60 * 60 * 1000);
          archivalCandidates = await this.prisma.student.count({
            where: { organizationId, createdAt: { lt: archivalCutoff } },
          });
        }
        if (policy.deleteAfterDays) {
          const deleteCutoff = new Date(now.getTime() - policy.deleteAfterDays * 24 * 60 * 60 * 1000);
          deletionCandidates = await this.prisma.student.count({
            where: { organizationId, createdAt: { lt: deleteCutoff } },
          });
        }
      } else if (policy.dataType === 'PAYMENT_RECORDS') {
        oldestRecord = (await this.prisma.payment.findFirst({
          where: { organizationId },
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true },
        }))?.createdAt ?? null;

        if (policy.archivalDays) {
          const archivalCutoff = new Date(now.getTime() - policy.archivalDays * 24 * 60 * 60 * 1000);
          archivalCandidates = await this.prisma.payment.count({
            where: { organizationId, createdAt: { lt: archivalCutoff } },
          });
        }
        if (policy.deleteAfterDays) {
          const deleteCutoff = new Date(now.getTime() - policy.deleteAfterDays * 24 * 60 * 60 * 1000);
          deletionCandidates = await this.prisma.payment.count({
            where: { organizationId, createdAt: { lt: deleteCutoff } },
          });
        }
      } else if (policy.dataType === 'AUDIT_LOGS') {
        oldestRecord = (await this.prisma.auditLog.findFirst({
          where: { organizationId },
          orderBy: { timestamp: 'asc' },
          select: { timestamp: true },
        }))?.timestamp ?? null;

        if (policy.archivalDays) {
          const archivalCutoff = new Date(now.getTime() - policy.archivalDays * 24 * 60 * 60 * 1000);
          archivalCandidates = await this.prisma.auditLog.count({
            where: { organizationId, timestamp: { lt: archivalCutoff } },
          });
        }
        if (policy.deleteAfterDays) {
          const deleteCutoff = new Date(now.getTime() - policy.deleteAfterDays * 24 * 60 * 60 * 1000);
          deletionCandidates = await this.prisma.auditLog.count({
            where: { organizationId, timestamp: { lt: deleteCutoff } },
          });
        }
      } else if (policy.dataType === 'FINANCIAL_REPORTS') {
        oldestRecord = (await this.prisma.expense.findFirst({
          where: { organizationId },
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true },
        }))?.createdAt ?? null;

        if (policy.archivalDays) {
          const archivalCutoff = new Date(now.getTime() - policy.archivalDays * 24 * 60 * 60 * 1000);
          archivalCandidates = await this.prisma.expense.count({
            where: { organizationId, createdAt: { lt: archivalCutoff } },
          });
        }
      } else if (policy.dataType === 'CRM_DATA') {
        oldestRecord = (await this.prisma.lead.findFirst({
          where: { organizationId },
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true },
        }))?.createdAt ?? null;

        if (policy.archivalDays) {
          const archivalCutoff = new Date(now.getTime() - policy.archivalDays * 24 * 60 * 60 * 1000);
          archivalCandidates = await this.prisma.lead.count({
            where: { organizationId, createdAt: { lt: archivalCutoff } },
          });
        }
      }

      results.push({
        dataType: policy.dataType ?? policy.entityType,
        policyId: policy.id,
        archivalCandidates,
        deletionCandidates,
        oldestRecord,
      });
    }

    await this.prisma.dataRetentionPolicy.updateMany({
      where: { organizationId, isActive: true },
      data: { lastRunAt: now },
    });

    return { checkedAt: now, policiesChecked: policies.length, results };
  }
}
