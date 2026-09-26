import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationPreferenceService, NOTIFICATION_CATEGORIES } from '../notification-preference.service';

import { PrismaService } from '../../prisma/prisma.service';

function createMockPrisma() {
  return {
    notificationPreference: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
  };
}

describe('NotificationPreferenceService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let svc: NotificationPreferenceService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    svc = new NotificationPreferenceService(prisma as unknown as PrismaService);
  });

  describe('getPreferences', () => {
    it('returns all categories with defaults when no preferences exist', async () => {
      prisma.notificationPreference.findMany.mockResolvedValue([]);
      const result = await svc.getPreferences('user-1');
      expect(result).toHaveLength(NOTIFICATION_CATEGORIES.length);
      expect(result[0]).toEqual({
        category: 'ATTENDANCE',
        label: 'Attendance',
        emailEnabled: true,
        smsEnabled: false,
        pushEnabled: true,
        inAppEnabled: true,
        telegramEnabled: true,
      });
    });

    it('merges existing preferences with defaults', async () => {
      prisma.notificationPreference.findMany.mockResolvedValue([
        { category: 'PAYMENT', emailEnabled: false, smsEnabled: true, pushEnabled: false, inAppEnabled: true },
      ]);
      const result = await svc.getPreferences('user-1');
      const payment = result.find(r => r.category === 'PAYMENT');
      expect(payment).toEqual({
        category: 'PAYMENT',
        label: 'Payments',
        emailEnabled: false,
        smsEnabled: true,
        pushEnabled: false,
        inAppEnabled: true,
        telegramEnabled: true,
      });
    });
  });

  describe('updatePreference', () => {
    it('upserts a preference for the given category', async () => {
      prisma.notificationPreference.upsert.mockResolvedValue({ category: 'DEBT' });
      const result = await svc.updatePreference('user-1', 'DEBT', { emailEnabled: false });
      expect(prisma.notificationPreference.upsert).toHaveBeenCalledWith({
        where: { userId_category: { userId: 'user-1', category: 'DEBT' } },
        update: { emailEnabled: false },
        create: { userId: 'user-1', category: 'DEBT', emailEnabled: false },
      });
      expect(result.category).toBe('DEBT');
    });
  });

  describe('bulkUpdatePreferences', () => {
    it('updates multiple preferences sequentially', async () => {
      prisma.notificationPreference.upsert
        .mockResolvedValueOnce({ category: 'ATTENDANCE' })
        .mockResolvedValueOnce({ category: 'SYSTEM' });
      const result = await svc.bulkUpdatePreferences('user-1', [
        { category: 'ATTENDANCE', pushEnabled: false },
        { category: 'SYSTEM', emailEnabled: true },
      ]);
      expect(result).toHaveLength(2);
      expect(prisma.notificationPreference.upsert).toHaveBeenCalledTimes(2);
    });
  });

  describe('getCategories', () => {
    it('returns the static category list', async () => {
      const result = await svc.getCategories();
      expect(result).toEqual(NOTIFICATION_CATEGORIES);
      expect(result.length).toBe(8);
    });
  });
});
