import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { isWithinQuietHours, nextQuietHoursEnd, parseClock } from './quiet-hours';

/**
 * Notification event type -> the preference CATEGORY it belongs to.
 *
 * Keeps the worker's event vocabulary mapped onto the already-existing
 * `NOTIFICATION_CATEGORIES` used by the web preferences UI, so Telegram
 * preferences are the SAME preferences users see in the app — not a second
 * notification system.
 */
export function categoryForEvent(eventType: string): string {
  switch (eventType) {
    case 'ATTENDANCE_MARKED_ABSENT':
    case 'ATTENDANCE_MARKED_LATE':
      return 'ATTENDANCE';
    case 'PAYMENT_OVERDUE':
      return 'DEBT';
    case 'PAYMENT_RECORDED':
    case 'PAYMENT_REMINDER':
    case 'INVOICE_ISSUED':
      return 'PAYMENT';
    case 'LESSON_CANCELLED':
      return 'ACADEMIC';
    case 'LEAD_CONVERTED':
    case 'FOLLOWUP_DUE':
      return 'CRM';
    default:
      return 'SYSTEM';
  }
}

export type TelegramPolicyReason =
  | 'OK'
  | 'CHANNEL_DISABLED'
  | 'CATEGORY_DISABLED'
  | 'QUIET_HOURS';

export interface TelegramPolicyDecision {
  /** Channel + category allow delivery (quiet hours are evaluated separately). */
  enabled: boolean;
  /** True when `now` is inside the principal's quiet-hours window. */
  quietHoursActive: boolean;
  /** When set, delivery must be re-scheduled for this instant. */
  deferredUntil: Date | null;
  reason: TelegramPolicyReason;
  /** False for principals that have no settings model (ParentAccount). */
  settingsAvailable: boolean;
  /** IANA timezone actually used for the quiet-hours evaluation. */
  timeZone: string;
}

export interface TelegramNotificationSettings {
  settingsAvailable: boolean;
  telegramEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  timeZone: string;
}

/**
 * Server-side Telegram delivery policy.
 *
 * The server — never Telegram — decides whether a principal receives Telegram
 * notifications and whether now falls inside their quiet hours:
 *
 *   user override (`UserSettings.telegramNotifications`, quiet-hours columns)
 *     > per-category preference (`NotificationPreference.telegramEnabled`)
 *     > organization default (`Organization.settings.telegramNotifications`)
 *
 * A principal with no settings model (`ParentAccount`) inherits the
 * organization default and has NO quiet hours — an explicit, documented
 * limitation rather than invented persistence.
 */
@Injectable()
export class TelegramNotificationPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Decide whether a Telegram delivery may happen now, and when to defer to if
   * it is quiet hours.
   */
  async evaluate(params: {
    organizationId: string;
    principalType: 'USER' | 'PARENT_ACCOUNT';
    principalId: string;
    eventType: string;
    now?: Date;
  }): Promise<TelegramPolicyDecision> {
    const now = params.now ?? new Date();
    const category = categoryForEvent(params.eventType);

    if (params.principalType === 'PARENT_ACCOUNT') {
      const orgDefault = await this.orgDefaultEnabled(params.organizationId);
      return {
        enabled: orgDefault,
        quietHoursActive: false,
        deferredUntil: null,
        reason: orgDefault ? 'OK' : 'CATEGORY_DISABLED',
        settingsAvailable: false,
        timeZone: 'UTC',
      };
    }

    const user = await this.prisma.user.findFirst({
      where: { id: params.principalId, organizationId: params.organizationId },
      select: {
        settings: {
          select: {
            telegramNotifications: true,
            quietHoursEnabled: true,
            quietHoursStart: true,
            quietHoursEnd: true,
            timezone: true,
          },
        },
        organization: { select: { timezone: true } },
      },
    });
    // Unknown principal => fail closed (never deliver to an unresolvable id).
    if (!user) {
      return {
        enabled: false,
        quietHoursActive: false,
        deferredUntil: null,
        reason: 'CHANNEL_DISABLED',
        settingsAvailable: false,
        timeZone: 'UTC',
      };
    }

    const channelEnabled =
      user.settings?.telegramNotifications ?? (await this.orgDefaultEnabled(params.organizationId));
    const timeZone = user.settings?.timezone ?? user.organization?.timezone ?? 'UTC';

    const decision: TelegramPolicyDecision = {
      enabled: channelEnabled,
      quietHoursActive: false,
      deferredUntil: null,
      reason: channelEnabled ? 'OK' : 'CHANNEL_DISABLED',
      settingsAvailable: true,
      timeZone,
    };
    if (!channelEnabled) return decision;

    const categoryPref = await this.prisma.notificationPreference.findUnique({
      where: { userId_category: { userId: params.principalId, category } },
      select: { telegramEnabled: true },
    });
    if (categoryPref && categoryPref.telegramEnabled === false) {
      return { ...decision, enabled: false, reason: 'CATEGORY_DISABLED' };
    }

    if (user.settings?.quietHoursEnabled) {
      const inQuietHours = isWithinQuietHours(
        now,
        user.settings.quietHoursStart,
        user.settings.quietHoursEnd,
        timeZone,
      );
      if (inQuietHours) {
        return {
          ...decision,
          quietHoursActive: true,
          deferredUntil: nextQuietHoursEnd(
            now,
            user.settings.quietHoursStart,
            user.settings.quietHoursEnd,
            timeZone,
          ),
          reason: 'QUIET_HOURS',
        };
      }
    }

    return decision;
  }

  /** Read the display model behind the bot's `/settings` screen. */
  async describe(params: {
    organizationId: string;
    principalType: 'USER' | 'PARENT_ACCOUNT';
    principalId: string;
  }): Promise<TelegramNotificationSettings> {
    if (params.principalType === 'PARENT_ACCOUNT') {
      return {
        settingsAvailable: false,
        telegramEnabled: await this.orgDefaultEnabled(params.organizationId),
        quietHoursEnabled: false,
        quietHoursStart: null,
        quietHoursEnd: null,
        timeZone: 'UTC',
      };
    }

    const user = await this.prisma.user.findFirst({
      where: { id: params.principalId, organizationId: params.organizationId },
      select: {
        settings: {
          select: {
            telegramNotifications: true,
            quietHoursEnabled: true,
            quietHoursStart: true,
            quietHoursEnd: true,
            timezone: true,
          },
        },
        organization: { select: { timezone: true } },
      },
    });

    return {
      settingsAvailable: true,
      telegramEnabled:
        user?.settings?.telegramNotifications ??
        (await this.orgDefaultEnabled(params.organizationId)),
      quietHoursEnabled: user?.settings?.quietHoursEnabled ?? false,
      quietHoursStart: user?.settings?.quietHoursStart ?? null,
      quietHoursEnd: user?.settings?.quietHoursEnd ?? null,
      timeZone: user?.settings?.timezone ?? user?.organization?.timezone ?? 'UTC',
    };
  }

  /** Validate a `HH:mm` pair before persisting it (defence against bad input). */
  isValidQuietWindow(start?: string | null, end?: string | null): boolean {
    if (!start && !end) return true;
    return parseClock(start) !== null && parseClock(end) !== null;
  }

  /**
   * Organization-level default read from the existing `Organization.settings`
   * JSON blob. Absent/!boolean => enabled (the channel is opt-out, not opt-in).
   */
  private async orgDefaultEnabled(organizationId: string): Promise<boolean> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });
    const settings = (org?.settings ?? null) as Record<string, unknown> | null;
    const value = settings?.['telegramNotifications'];
    return typeof value === 'boolean' ? value : true;
  }
}
