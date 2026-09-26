import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TelegramNotificationPolicyService,
  categoryForEvent,
} from '../telegram-notification-policy.service';
import { PrismaService } from '../../prisma/prisma.service';

function makePrisma() {
  return {
    user: { findFirst: vi.fn() },
    notificationPreference: { findUnique: vi.fn().mockResolvedValue(null) },
    organization: { findUnique: vi.fn().mockResolvedValue({ settings: null }) },
  };
}

describe('categoryForEvent', () => {
  it('maps every event type onto an existing preference category', () => {
    expect(categoryForEvent('ATTENDANCE_MARKED_ABSENT')).toBe('ATTENDANCE');
    expect(categoryForEvent('ATTENDANCE_MARKED_LATE')).toBe('ATTENDANCE');
    expect(categoryForEvent('PAYMENT_OVERDUE')).toBe('DEBT');
    expect(categoryForEvent('PAYMENT_RECORDED')).toBe('PAYMENT');
    expect(categoryForEvent('INVOICE_ISSUED')).toBe('PAYMENT');
    expect(categoryForEvent('LESSON_CANCELLED')).toBe('ACADEMIC');
    expect(categoryForEvent('FOLLOWUP_DUE')).toBe('CRM');
    expect(categoryForEvent('SOMETHING_NEW')).toBe('SYSTEM');
  });
});

describe('TelegramNotificationPolicyService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: TelegramNotificationPolicyService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new TelegramNotificationPolicyService(prisma as unknown as PrismaService);
  });

  const userWith = (settings: Record<string, unknown> | null) => ({
    settings,
    organization: { timezone: 'Asia/Tashkent' },
  });

  it('delivers when the user has no settings row and the org default is on', async () => {
    prisma.user.findFirst.mockResolvedValue(userWith(null));
    const decision = await service.evaluate({
      organizationId: 'org-1',
      principalType: 'USER',
      principalId: 'u-1',
      eventType: 'ATTENDANCE_MARKED_ABSENT',
    });
    expect(decision.enabled).toBe(true);
    expect(decision.reason).toBe('OK');
  });

  it('honours an explicit per-user channel opt-out', async () => {
    prisma.user.findFirst.mockResolvedValue(userWith({ telegramNotifications: false }));
    const decision = await service.evaluate({
      organizationId: 'org-1',
      principalType: 'USER',
      principalId: 'u-1',
      eventType: 'ATTENDANCE_MARKED_ABSENT',
    });
    expect(decision.enabled).toBe(false);
    expect(decision.reason).toBe('CHANNEL_DISABLED');
  });

  it('honours the organization default when the user has no explicit override', async () => {
    prisma.organization.findUnique.mockResolvedValue({
      settings: { telegramNotifications: false },
    });
    prisma.user.findFirst.mockResolvedValue(userWith({}));
    const decision = await service.evaluate({
      organizationId: 'org-1',
      principalType: 'USER',
      principalId: 'u-1',
      eventType: 'ATTENDANCE_MARKED_ABSENT',
    });
    expect(decision.enabled).toBe(false);
    expect(decision.reason).toBe('CHANNEL_DISABLED');
  });

  it('honours a per-category Telegram opt-out', async () => {
    prisma.user.findFirst.mockResolvedValue(userWith({}));
    prisma.notificationPreference.findUnique.mockResolvedValue({ telegramEnabled: false });

    const decision = await service.evaluate({
      organizationId: 'org-1',
      principalType: 'USER',
      principalId: 'u-1',
      eventType: 'PAYMENT_OVERDUE',
    });

    expect(decision.enabled).toBe(false);
    expect(decision.reason).toBe('CATEGORY_DISABLED');
    expect(prisma.notificationPreference.findUnique).toHaveBeenCalledWith({
      where: { userId_category: { userId: 'u-1', category: 'DEBT' } },
      select: { telegramEnabled: true },
    });
  });

  it('defers (never drops) inside quiet hours, using the user timezone', async () => {
    prisma.user.findFirst.mockResolvedValue(
      userWith({
        timezone: 'Asia/Tashkent',
        quietHoursEnabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
      }),
    );
    // 19:00Z == 00:00 in Tashkent.
    const decision = await service.evaluate({
      organizationId: 'org-1',
      principalType: 'USER',
      principalId: 'u-1',
      eventType: 'ATTENDANCE_MARKED_ABSENT',
      now: new Date('2026-06-01T19:00:00Z'),
    });

    expect(decision.enabled).toBe(true);
    expect(decision.quietHoursActive).toBe(true);
    expect(decision.reason).toBe('QUIET_HOURS');
    expect(decision.timeZone).toBe('Asia/Tashkent');
    expect(decision.deferredUntil?.toISOString()).toBe('2026-06-02T02:00:00.000Z');
  });

  it('does not defer when quiet hours are disabled or outside the window', async () => {
    prisma.user.findFirst.mockResolvedValue(
      userWith({
        quietHoursEnabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
        timezone: 'UTC',
      }),
    );
    const decision = await service.evaluate({
      organizationId: 'org-1',
      principalType: 'USER',
      principalId: 'u-1',
      eventType: 'ATTENDANCE_MARKED_ABSENT',
      now: new Date('2026-06-01T12:00:00Z'),
    });
    expect(decision.quietHoursActive).toBe(false);
    expect(decision.deferredUntil).toBeNull();
  });

  it('fails closed for an unresolvable principal', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    const decision = await service.evaluate({
      organizationId: 'org-1',
      principalType: 'USER',
      principalId: 'ghost',
      eventType: 'ATTENDANCE_MARKED_ABSENT',
    });
    expect(decision.enabled).toBe(false);
    expect(decision.settingsAvailable).toBe(false);
  });

  it('treats ParentAccount as having no settings model (documented limitation)', async () => {
    const decision = await service.evaluate({
      organizationId: 'org-1',
      principalType: 'PARENT_ACCOUNT',
      principalId: 'p-1',
      eventType: 'ATTENDANCE_MARKED_ABSENT',
    });
    expect(decision.enabled).toBe(true);
    expect(decision.settingsAvailable).toBe(false);
    expect(decision.quietHoursActive).toBe(false);
    // No settings lookup for a parent — there is no model to read.
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it('describes the settings screen model for a user', async () => {
    prisma.user.findFirst.mockResolvedValue(
      userWith({
        telegramNotifications: true,
        quietHoursEnabled: true,
        quietHoursStart: '21:00',
        quietHoursEnd: '06:30',
        timezone: 'Asia/Tashkent',
      }),
    );
    const described = await service.describe({
      organizationId: 'org-1',
      principalType: 'USER',
      principalId: 'u-1',
    });
    expect(described).toEqual({
      settingsAvailable: true,
      telegramEnabled: true,
      quietHoursEnabled: true,
      quietHoursStart: '21:00',
      quietHoursEnd: '06:30',
      timeZone: 'Asia/Tashkent',
    });
  });

  it('validates quiet-hour input before persisting', () => {
    expect(service.isValidQuietWindow(null, null)).toBe(true);
    expect(service.isValidQuietWindow('22:00', '07:00')).toBe(true);
    expect(service.isValidQuietWindow('22:00', 'bogus')).toBe(false);
    expect(service.isValidQuietWindow('nope', null)).toBe(false);
  });
});
