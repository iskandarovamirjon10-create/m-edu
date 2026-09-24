import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parsePagination } from '../lib/pagination';
import { Prisma } from '@prisma/client';
import { AuditQuery, SystemAuditEventDto, AuditAction, AuditEntityType } from './audit.types';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List audit events for an organization.
   * Maps the existing `AuditLog` model to a richer `SystemAuditEventDto` shape.
   */
  async findAll(organizationId: string, query: AuditQuery) {
    const { page, limit, skip } = parsePagination(query, { limit: 20, maxLimit: 100 });

    const where: Prisma.AuditLogWhereInput = { organizationId };

    if (query.action) where.action = query.action;
    if (query.entityType) where.resource = query.entityType;
    if (query.entityId) where.resourceId = query.entityId;
    if (query.actorId) where.userId = query.actorId;
    if (query.search) {
      where.OR = [
        { resource: { contains: query.search, mode: 'insensitive' } },
        { path: { contains: query.search, mode: 'insensitive' } },
        { method: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.fromDate || query.toDate) {
      where.timestamp = {};
      if (query.fromDate) where.timestamp.gte = new Date(query.fromDate);
      if (query.toDate) where.timestamp.lte = new Date(query.toDate);
    }

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          organization: { select: { id: true, name: true } },
        },
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    // Hydrate actor names in a single follow-up query
    const actorIds = Array.from(new Set(rows.map(r => r.userId).filter((id): id is string => !!id)));
    const actors = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : [];
    const actorMap = new Map(actors.map(a => [a.id, a]));

    const items: SystemAuditEventDto[] = rows.map(row => {
      const actor = row.userId ? actorMap.get(row.userId) : null;
      const changes = (row.changes as Record<string, { old: unknown; new: unknown }> | null) ?? null;
      const changedFields = changes ? Object.keys(changes) : null;
      const previousValue = changes
        ? Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v?.old]))
        : null;
      const newValue = changes
        ? Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v?.new]))
        : null;

      return {
        id: row.id,
        organizationId: row.organizationId,
        action: this.mapAction(row.action),
        entityType: (row.resource as AuditEntityType) || 'OTHER',
        entityId: row.resourceId ?? null,
        entityLabel: null,
        description: this.buildDescription(row.action, row.resource, row.path, row.statusCode),
        previousValue,
        newValue,
        changedFields,
        ipAddress: row.ipAddress ?? null,
        userAgent: row.userAgent ?? null,
        metadata: {
          method: row.method,
          path: row.path,
          statusCode: row.statusCode,
        },
        actorId: row.userId ?? null,
        actorName: actor ? `${actor.firstName} ${actor.lastName}`.trim() || actor.email : null,
        createdAt: row.timestamp,
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

  async findOne(organizationId: string, id: string): Promise<SystemAuditEventDto> {
    const row = await this.prisma.auditLog.findFirst({
      where: { id, organizationId },
    });
    if (!row) throw new NotFoundException('Audit event not found');

    let actor: { firstName: string; lastName: string; email: string } | null = null;
    if (row.userId) {
      const u = await this.prisma.user.findUnique({
        where: { id: row.userId },
        select: { firstName: true, lastName: true, email: true },
      });
      actor = u;
    }

    const changes = (row.changes as Record<string, { old: unknown; new: unknown }> | null) ?? null;

    return {
      id: row.id,
      organizationId: row.organizationId,
      action: this.mapAction(row.action),
      entityType: (row.resource as AuditEntityType) || 'OTHER',
      entityId: row.resourceId ?? null,
      entityLabel: null,
      description: this.buildDescription(row.action, row.resource, row.path, row.statusCode),
      previousValue: changes ? Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v?.old])) : null,
      newValue: changes ? Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v?.new])) : null,
      changedFields: changes ? Object.keys(changes) : null,
      ipAddress: row.ipAddress ?? null,
      userAgent: row.userAgent ?? null,
      metadata: { method: row.method, path: row.path, statusCode: row.statusCode },
      actorId: row.userId ?? null,
      actorName: actor ? `${actor.firstName} ${actor.lastName}`.trim() || actor.email : null,
      createdAt: row.timestamp,
    };
  }

  /**
   * Get change history for a specific entity — used for "What changed?" views.
   */
  async getEntityHistory(organizationId: string, entityType: string, entityId: string) {
    const rows = await this.prisma.auditLog.findMany({
      where: {
        organizationId,
        resource: entityType,
        resourceId: entityId,
      },
      orderBy: { timestamp: 'desc' },
      take: 200,
    });

    return rows.map(row => ({
      id: row.id,
      action: this.mapAction(row.action),
      changes: row.changes,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      userId: row.userId,
      timestamp: row.timestamp,
    }));
  }

  /** Record an audit event — used by services to log changes. */
  async record(params: {
    organizationId: string;
    userId?: string | null;
    action: string;
    resource: string;
    resourceId?: string | null;
    changes?: Record<string, { old: unknown; new: unknown }> | null;
    ipAddress?: string;
    userAgent?: string;
    method?: string;
    path?: string;
    statusCode?: number;
  }) {
    return this.prisma.auditLog.create({
      data: {
        organizationId: params.organizationId,
        userId: params.userId ?? null,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId ?? null,
        changes: (params.changes as unknown as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
        method: params.method ?? null,
        path: params.path ?? null,
        statusCode: params.statusCode ?? null,
      },
    });
  }

  private mapAction(raw: string): AuditAction {
    const upper = (raw || '').toUpperCase();
    if (upper.includes('CREATE') || upper === 'POST') return 'CREATE';
    if (upper.includes('UPDATE') || upper === 'PUT' || upper === 'PATCH') return 'UPDATE';
    if (upper.includes('DELETE') || upper === 'DELETE') return 'DELETE';
    if (upper.includes('LOGIN')) return 'LOGIN';
    if (upper.includes('LOGOUT')) return 'LOGOUT';
    if (upper.includes('EXPORT')) return 'EXPORT';
    if (upper.includes('IMPORT')) return 'IMPORT';
    return 'CUSTOM';
  }

  private buildDescription(action: string, resource: string, path?: string | null, statusCode?: number | null): string {
    const friendlyResource = resource.toLowerCase().replace(/_/g, ' ');
    const verb = (action || '').toLowerCase();
    if (path) {
      return `${verb} ${friendlyResource} (${path}) → ${statusCode ?? '?'}`;
    }
    return `${verb} ${friendlyResource}`;
  }
}
