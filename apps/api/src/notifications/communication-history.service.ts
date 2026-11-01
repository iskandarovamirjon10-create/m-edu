import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parsePagination } from '../lib/pagination';
import { Prisma } from '@prisma/client';

export interface HistoryFilters {
  page?: string | number;
  limit?: string | number;
  entityType?: string;
  entityId?: string;
  channel?: string;
  status?: string;
  direction?: string;
  startDate?: string;
  endDate?: string;
}

export interface RecordCommunicationData {
  entityType: string;
  entityId: string;
  channel: string;
  direction?: string;
  subject?: string;
  content: string;
  status?: string;
  failureReason?: string;
  retryCount?: number;
  relatedEntityId?: string;
  relatedEntityType?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class CommunicationHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getHistory(organizationId: string, filters: HistoryFilters): Promise<{ items: any[]; total: number; page: number; limit: number; totalPages: number }> {
    const { page, limit, skip } = parsePagination(filters);

    const where: Prisma.CommunicationHistoryWhereInput = { organizationId };

    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.channel) where.channel = filters.channel;
    if (filters.status) where.status = filters.status;
    if (filters.direction) where.direction = filters.direction;

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
    }

    const [items, total] = await Promise.all([
      this.prisma.communicationHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.communicationHistory.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / (limit || 1)) };
  }

  async getTimeline(organizationId: string, entityType: string, entityId: string): Promise<{ items: any[] }> {
    const items = await this.prisma.communicationHistory.findMany({
      where: { organizationId, entityType, entityId },
      orderBy: { createdAt: 'desc' },
    });

    return { items };
  }

  async getStats(
    organizationId: string,
    dateRange?: { startDate?: string; endDate?: string },
  ) {
    const where: Prisma.CommunicationHistoryWhereInput = { organizationId };

    if (dateRange?.startDate || dateRange?.endDate) {
      where.createdAt = {};
      if (dateRange.startDate) where.createdAt.gte = new Date(dateRange.startDate);
      if (dateRange.endDate) where.createdAt.lte = new Date(dateRange.endDate);
    }

    const [total, byChannel, byStatus] = await Promise.all([
      this.prisma.communicationHistory.count({ where }),
      this.prisma.communicationHistory.groupBy({
        by: ['channel'],
        where,
        _count: { id: true },
      }),
      this.prisma.communicationHistory.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
      }),
    ]);

    const deliveredCount =
      byStatus.find((s) => s.status === 'DELIVERED')?._count.id ?? 0;
    const sentCount =
      byStatus.find((s) => s.status === 'SENT')?._count.id ?? 0;
    const failedCount =
      byStatus.find((s) => s.status === 'FAILED')?._count.id ?? 0;
    const bouncedCount =
      byStatus.find((s) => s.status === 'BOUNCED')?._count.id ?? 0;
    const queuedCount =
      byStatus.find((s) => s.status === 'QUEUED')?._count.id ?? 0;

    const deliveryRate = total > 0 ? ((deliveredCount + sentCount) / total) * 100 : 0;
    const failureRate = total > 0 ? ((failedCount + bouncedCount) / total) * 100 : 0;

    return {
      total,
      deliveredCount,
      sentCount,
      failedCount,
      bouncedCount,
      queuedCount,
      deliveryRate: Math.round(deliveryRate * 100) / 100,
      failureRate: Math.round(failureRate * 100) / 100,
      byChannel: byChannel.map((c) => ({ channel: c.channel, count: c._count.id })),
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count.id })),
    };
  }

  async recordCommunication(organizationId: string, data: RecordCommunicationData) {
    return this.prisma.communicationHistory.create({
      data: {
        organizationId,
        entityType: data.entityType,
        entityId: data.entityId,
        channel: data.channel,
        direction: data.direction ?? 'OUTBOUND',
        subject: data.subject,
        content: data.content,
        status: data.status ?? 'QUEUED',
        failureReason: data.failureReason,
        retryCount: data.retryCount ?? 0,
        relatedEntityId: data.relatedEntityId,
        relatedEntityType: data.relatedEntityType,
        metadata: data.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }
}
