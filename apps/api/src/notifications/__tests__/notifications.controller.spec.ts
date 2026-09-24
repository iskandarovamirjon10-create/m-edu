import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationsController } from '../notifications.controller';
import { NotificationsService } from '../notifications.service';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let service: NotificationsService;

  const mockNotification = {
    id: '11111111-1111-1111-1111-111111111111',
    userId: 'user-1',
    title: 'New Grade',
    message: 'You received an A',
    isRead: false,
  };

  beforeEach(() => {
    service = {
      findAll: vi.fn().mockResolvedValue({ items: [mockNotification], total: 1, unreadCount: 1 }),
      markAllAsRead: vi.fn().mockResolvedValue({ count: 1 }),
      markAsRead: vi.fn().mockResolvedValue({ ...mockNotification, isRead: true }),
    } as unknown as NotificationsService;

    controller = new NotificationsController(service);
  });

  it('should find all notifications', async () => {
    const result = await controller.findAll({ user: { sub: 'user-1' } } as never, { page: 1, limit: 10 });
    expect(result.total).toBe(1);
    expect(service.findAll).toHaveBeenCalledWith('user-1', { page: 1, limit: 10 });
  });

  it('should mark all notifications as read', async () => {
    const result = await controller.markAllAsRead({ user: { sub: 'user-1' } } as never);
    expect(result).toEqual({ count: 1 });
    expect(service.markAllAsRead).toHaveBeenCalledWith('user-1');
  });

  it('should mark a single notification as read', async () => {
    const result = await controller.markAsRead({ user: { sub: 'user-1' } } as never, mockNotification.id);
    expect(result.isRead).toBe(true);
    expect(service.markAsRead).toHaveBeenCalledWith('user-1', mockNotification.id);
  });
});
