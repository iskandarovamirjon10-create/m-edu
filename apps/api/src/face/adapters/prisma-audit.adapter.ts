import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { 
  AuditRepository, 
  AuditEventEntity 
} from '@medu/core/src/ports/audit-repository.port';
import type { AuditEventType } from '@medu/contracts';
import type { FaceAuditEvent } from '@prisma/client';
import { startOfDay, endOfDayInclusive } from '../../common/date-range';

interface AuditQueryFilters {
  type?: AuditEventType;
  resourceType?: string;
  resourceId?: string;
  userId?: string;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
}

@Injectable()
export class PrismaAuditAdapter implements AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  private mapAuditEntity(row: FaceAuditEvent): AuditEventEntity {
    return {
      id: row.id,
      organizationId: row.organizationId,
      userId: row.userId,
      type: row.type as AuditEventType,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      description: row.description,
      metadata: row.metadata as Record<string, unknown> | null,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      createdAt: row.createdAt,
    };
  }

  async log(data: {
    organizationId: string;
    userId?: string;
    type: AuditEventType;
    resourceType: string;
    resourceId?: string;
    description: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuditEventEntity> {
    const row = await this.prisma.faceAuditEvent.create({
      data: {
        organizationId: data.organizationId,
        userId: data.userId,
        type: data.type,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        description: data.description,
        metadata: (data.metadata || {}) as Prisma.InputJsonValue,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
    return this.mapAuditEntity(row);
  }

  async record(data: {
    organizationId: string;
    userId?: string;
    type: string;
    resourceType: string;
    resourceId?: string;
    data?: Record<string, unknown>;
  }): Promise<AuditEventEntity> {
    return this.log({
      organizationId: data.organizationId,
      userId: data.userId,
      type: data.type as AuditEventType,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      description:
        `${data.type} on ${data.resourceType}` +
        (data.resourceId ? `:${data.resourceId}` : ''),
      metadata: data.data,
    });
  }

  async query(organizationId: string, filters: AuditQueryFilters): Promise<{ items: AuditEventEntity[]; total: number }> {
    const where: Record<string, unknown> = { organizationId };
    if (filters.type) where.type = filters.type;
    if (filters.resourceType) where.resourceType = filters.resourceType;
    if (filters.resourceId) where.resourceId = filters.resourceId;
    if (filters.userId) where.userId = filters.userId;
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) (where.createdAt as Record<string, Date>).gte = startOfDay(filters.dateFrom);
      if (filters.dateTo) (where.createdAt as Record<string, Date>).lte = endOfDayInclusive(filters.dateTo);
    }
    // Search filter: case-insensitive substring match on the description
    // column. The previous adapter silently dropped this filter — users
    // believed their search was being applied when in fact all matching
    // events were returned.
    if (filters.search && filters.search.trim().length > 0) {
      where.description = { contains: filters.search.trim(), mode: 'insensitive' };
    }

    const [rows, total] = await Promise.all([
      this.prisma.faceAuditEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...(filters.limit && { take: filters.limit }),
        ...(filters.limit && filters.page && { skip: (filters.page - 1) * filters.limit }),
      }),
      this.prisma.faceAuditEvent.count({ where }),
    ]);

    return {
      items: rows.map(r => this.mapAuditEntity(r)),
      total,
    };
  }
}