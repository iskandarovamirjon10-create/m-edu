import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationsService } from '../notifications.service';

import { PrismaService } from '../../prisma/prisma.service';

function createMockPrisma() {
  return {
    notification: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
  };
}

describe('NotificationsService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let svc: NotificationsService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    svc = new NotificationsService(prisma as unknown as PrismaService);
  });

  describe('findAll', () => {
    it('returns the unread counter independent of the isRead filter', async () => {
      prisma.notification.findMany.mockResolvedValue([{ id: 'n1' }]);
      prisma.notification.count
        .mockResolvedValueOnce(5) // total (filtered)
        .mockResolvedValueOnce(2); // unread (always global for the user)
      const result = await svc.findAll('user-1', { isRead: 'true' });
      expect(result.total).toBe(5);
      expect(result.unread).toBe(2);
      // The unread count query must not carry the isRead filter from the page query.
      expect(prisma.notification.count).toHaveBeenLastCalledWith({
        where: { userId: 'user-1', isRead: false },
      });
    });

    it('applies the isRead filter to the list when provided', async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count.mockResolvedValue(0);
      await svc.findAll('user-1', { isRead: 'false' });
      expect(prisma.notification.findMany.mock.calls[0][0].where).toEqual({
        userId: 'user-1',
        isRead: false,
      });
    });

    it('computes totalPages and keeps the user scope', async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count.mockResolvedValue(25);
      const result = await svc.findAll('user-1', { page: '2', limit: '10' });
      expect(result.totalPages).toBe(3);
      expect(prisma.notification.findMany.mock.calls[0][0].where.userId).toBe('user-1');
    });
  });

  describe('markAsRead', () => {
    it('scopes the update to the user and the notification id', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 1 });
      const result = await svc.markAsRead('user-1', 'n-1');
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { id: 'n-1', userId: 'user-1' },
        data: { isRead: true },
      });
      expect(result).toEqual({ success: true, count: 1 });
    });
  });

  describe('markAllAsRead', () => {
    it('updates only the user\u2019s unread notifications', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 3 });
      const result = await svc.markAllAsRead('user-1');
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', isRead: false },
        data: { isRead: true },
      });
      expect(result).toEqual({ success: true, count: 3 });
    });
  });
});
