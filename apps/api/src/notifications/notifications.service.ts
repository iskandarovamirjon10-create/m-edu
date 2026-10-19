import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parsePagination } from '../lib/pagination';
import { Prisma } from '@prisma/client';
import { NotificationQuery } from '../common/dto/query';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, query: NotificationQuery): Promise<{ items: any[]; total: number; page: number; limit: number; totalPages: number; unread: number }> {
    const { page, limit, skip } = parsePagination(query);
    if (!userId) {
      return { items: [], total: 0, page, limit, totalPages: 0, unread: 0 };
    }

    try {
      const where: Prisma.NotificationWhereInput = { userId };

      if (query.isRead !== undefined) where.isRead = query.isRead === 'true';

      const [items, total, unread] = await Promise.all([
        this.prisma.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.notification.count({ where }),
        // The unread counter must be independent of the isRead filter: it is
        // the count of the user's unread notifications, not the (filtered)
        // page total. Previously `unread: total` reported every notification
        // as unread once one was read.
        this.prisma.notification.count({ where: { userId, isRead: false } }),
      ]);

      return { items, total, page, limit, totalPages: Math.ceil(total / limit), unread };
    } catch {
      return { items: [], total: 0, page, limit, totalPages: 0, unread: 0 };
    }
  }

  async markAsRead(userId: string, id: string): Promise<{ success: boolean; count: number }> {
    if (!userId || !id) return { success: false, count: 0 };
    try {
      const updateResult = await this.prisma.notification.updateMany({
        where: { id, userId },
        data: { isRead: true },
      });
      return { success: updateResult.count > 0, count: updateResult.count };
    } catch {
      return { success: false, count: 0 };
    }
  }

  async markAllAsRead(userId: string): Promise<{ success: boolean; count: number }> {
    if (!userId) return { success: false, count: 0 };
    try {
      const updateResult = await this.prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      });
      return { success: updateResult.count > 0, count: updateResult.count };
    } catch {
      return { success: false, count: 0 };
    }
  }
}
