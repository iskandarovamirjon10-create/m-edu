import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue } from 'bullmq';
import * as crypto from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { SmsService } from '../sms.service';
import { TelegramService } from '../../telegram/telegram.service';
import {
  TelegramDeliveryService,
  TelegramDeliveryTarget,
  isTransientFailure,
} from '../../telegram/telegram-delivery.service';
import { escapeHtml } from '../../telegram/ui/format';
import {
  NotificationDeliveryService,
  telegramDeliveryDedupKey,
} from '../notification-delivery.service';
import { TelegramNotificationPolicyService } from '../telegram-notification-policy.service';
import { EmailService } from '../email.service';
import {
  ChannelDeliveryResult,
  NOTIFICATION_EVENTS_QUEUE,
  NOTIFICATION_EVENTS_DLQ,
  NotificationEventPayload,
} from './notification.events';

// @ts-ignore – @nestjs/bullmq is ESM-only; resolved at runtime via monorepo hoisting
const { InjectQueue, OnWorkerEvent, Processor, WorkerHost } = require('@nestjs/bullmq');

/**
 * Event types that trigger a direct parent SMS in addition to the in-app
 * notification and the Telegram fallback chain.
 */
const PARENT_SMS_EVENTS = new Set<NotificationEventPayload['type']>([
  'ATTENDANCE_MARKED_PRESENT',
  'ATTENDANCE_MARKED_ABSENT',
  'ATTENDANCE_MARKED_LATE',
  'PAYMENT_RECORDED',
  'PAYMENT_OVERDUE',
]);

import type Redis from 'ioredis';

@Injectable()
@Processor(NOTIFICATION_EVENTS_QUEUE, { concurrency: 5 })
export class NotificationEventProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationEventProcessor.name);
  private redis: Redis | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
    private readonly telegram: TelegramService,
    // Separate DLQ queue — never the source queue (prevents infinite loop).
    @InjectQueue(NOTIFICATION_EVENTS_DLQ) private readonly deadLetterQueue: Queue,
    // Telegram delivery is addressed through `TelegramAccount` (lifecycle
    // aware), tracked per attempt, and gated by the server-side policy.
    private readonly telegramDelivery: TelegramDeliveryService,
    private readonly deliveries: NotificationDeliveryService,
    private readonly telegramPolicy: TelegramNotificationPolicyService,
    @Optional() private readonly config?: ConfigService,
    @Optional() private readonly email?: EmailService,
  ) {
    super();
  }

  private async getRedis(): Promise<Redis | null> {
    if (this.redis !== null && this.redis !== undefined) return this.redis;
    try {
      const mod = await import('ioredis');
      const RedisCtor = mod.default;
      const url = process.env.REDIS_URL || 'redis://localhost:6379';
      const client = new (RedisCtor as unknown as {
        new (url: string, opts: Record<string, unknown>): Redis;
      })(url, {
        lazyConnect: false,
        maxRetriesPerRequest: 1,
        connectTimeout: 3000,
      });
      client.on('error', () => {});
      this.redis = client;
    } catch {
      this.redis = null;
    }
    return this.redis;
  }

  async process(job: Job<NotificationEventPayload>): Promise<{ deliveries: ChannelDeliveryResult[] }> {
    const event = job.data;
    const redis = await this.getRedis();
    const idempKey = `notif_idemp:${job.id}`;

    if (redis) {
      const state = await redis.get(idempKey);
      if (state === 'DELIVERED') {
        const cached = await redis.get(`${idempKey}:result`);
        if (cached) {
          try {
            return JSON.parse(cached);
          } catch {
            return { deliveries: [] };
          }
        }
        return { deliveries: [] };
      }
      if (state === 'DELIVERING_EXTERNAL') {
        // Previous attempt crashed during external delivery. To prevent duplicate
        // external messages, we skip the external phase entirely.
        this.logger.warn(`Skipping external delivery for job ${job.id} due to previous crash during delivery phase.`);
        return { deliveries: [{ channel: 'SKIPPED_PREVENT_DUPLICATE' as any, ok: false, error: 'Previous attempt crashed during external delivery' }] };
      }

      // Acquire lock for internal processing phase
      const acquired = await redis.set(idempKey, 'PROCESSING_INTERNAL', 'EX', 86400, 'NX');
      if (!acquired && state === 'PROCESSING_INTERNAL') {
        // A retry after a crash during internal processing. It is safe to proceed since
        // in-app delivery is deduplicated natively via Prisma transaction.
      }
    }

    const { title, body } = this.render(event);
    const deliveries: ChannelDeliveryResult[] = [];

    // 1. IN_APP notifications
    const inAppResult = await this.deliverInApp(event, title, body);
    deliveries.push(inAppResult);

    // Now transitioning to external delivery phase
    if (redis) {
      await redis.set(idempKey, 'DELIVERING_EXTERNAL', 'EX', 86400);
    }

    // 2. Smart Omnichannel Cascade Delivery for Parents:
    // Priority 1: Telegram (Free, instant, saves center SMS costs)
    // Priority 2: SMS via Eskiz/PlayMobile (Failover if Telegram unavailable/blocked)
    // Priority 3: Email via SMTP (Failover if SMS provider fails / out of credits)
    //
    // Deduplicates per parent to prevent dual-billing / duplicate messages.
    const resolvedParents = await this.resolveParents(event);
    const parentPhonesDirect = PARENT_SMS_EVENTS.has(event.type)
      ? await this.resolveParentPhones(event)
      : [];

    type UnifiedParentTarget = {
      id: string;
      phone?: string | null;
      email?: string | null;
      isVirtual?: boolean;
    };

    const coveredPhones = new Set<string>();
    const unifiedTargets: UnifiedParentTarget[] = [];

    for (const p of resolvedParents) {
      unifiedTargets.push({
        id: p.id,
        phone: p.phone,
        email: p.email,
        isVirtual: false,
      });
      if (p.phone) coveredPhones.add(p.phone);
    }

    // Add legacy/direct student parent phones that are not yet covered by a registered ParentAccount
    for (const directPhone of parentPhonesDirect) {
      if (!coveredPhones.has(directPhone)) {
        coveredPhones.add(directPhone);
        unifiedTargets.push({
          id: `virtual-phone-${directPhone}`,
          phone: directPhone,
          email: null,
          isVirtual: true,
        });
      }
    }

    // Additional legacy fallback if no parents were resolved and not in PARENT_SMS_EVENTS, but event has parentPhone
    if (unifiedTargets.length === 0 && event.data.parentPhone) {
      unifiedTargets.push({
        id: `virtual-phone-${event.data.parentPhone}`,
        phone: event.data.parentPhone,
        email: null,
        isVirtual: true,
      });
    }

    const realParentTargets = unifiedTargets.filter((t) => !t.isVirtual);
    const targets = await this.telegramDelivery.resolveActiveTargetsForPrincipals(
      event.organizationId,
      realParentTargets.map((parent) => ({
        type: 'PARENT_ACCOUNT' as const,
        parentAccountId: parent.id,
      })),
    );

    for (const targetItem of unifiedTargets) {
      const activeTelegram = !targetItem.isVirtual ? targets.get(targetItem.id) ?? null : null;
      let handled = false;

      // ── Step 1: Telegram (Primary, instant, free for center) ──
      if (activeTelegram) {
        const telegramHandled = await this.deliverParentTelegram({
          event,
          eventId: String(job.id ?? ''),
          title,
          body,
          target: activeTelegram,
          deliveries,
        });
        if (telegramHandled) {
          handled = true;
        }
      }

      // ── Step 2: SMS (Failover if Telegram not handled/available) ──
      let smsFailed = false;
      let smsErrorMessage: string | undefined;

      if (!handled && targetItem.phone) {
        try {
          const isDirectEvent = PARENT_SMS_EVENTS.has(event.type);
          const smsResult = typeof this.sms.sendSmsDetailed === 'function'
            ? await (isDirectEvent
                ? this.sms.sendSmsDetailed(targetItem.phone, `${title}: ${body}`, event.organizationId)
                : this.sms.sendSmsDetailed(targetItem.phone, `${title}: ${body}`))
            : {
                ok: await (isDirectEvent
                  ? this.sms.sendSms(targetItem.phone, `${title}: ${body}`, event.organizationId)
                  : this.sms.sendSms(targetItem.phone, `${title}: ${body}`)),
              };

          if (smsResult.ok) {
            deliveries.push({ channel: 'SMS', ok: true });
            handled = true;
          } else {
            smsFailed = true;
            smsErrorMessage =
              (smsResult as any).errorMessage ||
              (smsResult as any).failureCategory ||
              'provider rejected';
            deliveries.push({ channel: 'SMS', ok: false, error: smsErrorMessage });
          }
        } catch (e: any) {
          smsFailed = true;
          smsErrorMessage = e?.message || String(e || 'unknown SMS error');
          deliveries.push({ channel: 'SMS', ok: false, error: smsErrorMessage });
          if (e?.message === 'IMPLEMENTED - RUNTIME CREDENTIALS UNVERIFIED') {
            throw e;
          }
          this.logger.error(
            `Parent SMS failed for event ${event.type}/${event.entityId} to ${targetItem.phone}: ${smsErrorMessage}`,
          );
        }
      }

      // ── Step 3: Email (Smart Failover if Telegram & SMS both failed/unavailable) ──
      if (!handled && targetItem.email) {
        try {
          const emailResult = await this.deliverParentEmail({
            event,
            to: targetItem.email,
            title,
            body,
            failoverReason: smsFailed ? `SMS uzatilmadi: ${smsErrorMessage}` : 'Telegram/SMS ulanmagan',
          });
          deliveries.push({
            channel: 'EMAIL',
            ok: emailResult.success,
            error: emailResult.success ? undefined : emailResult.error,
          });
          if (emailResult.success) {
            handled = true;
            this.logger.log(
              `Smart Failover to Email succeeded for parent ${targetItem.id} (${targetItem.email})`,
            );
          }
        } catch (emailErr: any) {
          deliveries.push({
            channel: 'EMAIL',
            ok: false,
            error: emailErr?.message || String(emailErr),
          });
        }
      }
    }

    const result = { deliveries };

    if (redis) {
      await redis.set(idempKey, 'DELIVERED', 'EX', 86400 * 7);
      await redis.set(`${idempKey}:result`, JSON.stringify(result), 'EX', 86400 * 7);
    }

    this.logger.log(
      `notification_processed type=${event.type} entity=${event.entityId} deliveries=${deliveries.map((d) => `${d.channel}:${d.ok ? 'ok' : 'fail'}`).join(',')}`,
    );
    return result;
  }

  /**
   * Deliver ONE event to ONE parent's Telegram account.
   *
   * Returns true when the Telegram channel has "handled" the notification for
   * the moment — either sent, or deferred for a bounded retry (quiet hours or
   * a transient provider failure). In both deferred cases the SMS fallback is
   * deliberately skipped, because a retry is already scheduled and a second
   * channel would double-notify the parent.
   *
   * Returns false when Telegram is unavailable for a policy/relationship
   * reason (no ACTIVE account, channel/category disabled, permanent failure),
   * which is exactly when the existing SMS fallback should take over.
   *
   * Never throws: a Telegram problem must not fail the business transaction
   * that produced the notification, and must not re-run the SMS phase.
   */
  private async deliverParentTelegram(params: {
    event: NotificationEventPayload;
    eventId: string;
    title: string;
    body: string;
    target: TelegramDeliveryTarget;
    deliveries: ChannelDeliveryResult[];
  }): Promise<boolean> {
    const { event, eventId, title, body, target, deliveries } = params;
    const principalId = target.parentAccountId;
    if (!principalId) return false;

    try {
      const decision = await this.telegramPolicy.evaluate({
        organizationId: event.organizationId,
        principalType: 'PARENT_ACCOUNT',
        principalId,
        eventType: event.type,
      });

      const tracked = await this.deliveries.ensureTracked({
        organizationId: event.organizationId,
        eventId,
        eventType: event.type,
        entityType: event.entityType,
        entityId: event.entityId,
        channel: 'TELEGRAM',
        principalType: 'PARENT_ACCOUNT',
        principalId,
        telegramAccountId: target.accountId,
        dedupKey: telegramDeliveryDedupKey({
          principalType: 'PARENT_ACCOUNT',
          principalId,
          eventType: event.type,
          entityId: event.entityId,
          occurredAt: event.occurredAt,
        }),
        title,
        body,
      });

      // An earlier attempt for this (event, principal, day) already landed.
      if (tracked.alreadySent) {
        deliveries.push({ channel: 'TELEGRAM', ok: true });
        return true;
      }

      if (!decision.enabled) {
        await this.deliveries.markSkipped(tracked.id, decision.reason);
        return false;
      }

      if (decision.quietHoursActive && decision.deferredUntil) {
        // NOT dropped: scheduled for the end of the quiet window.
        await this.deliveries.markDeferred(tracked.id, decision.deferredUntil, {
          title,
          body,
        });
        deliveries.push({ channel: 'TELEGRAM', ok: false, error: 'DEFERRED_QUIET_HOURS' });
        return true;
      }

      // Escape user-derived content before HTML-mode interpolation: names and
      // statuses are untrusted input and must never forge the message layout.
      const text = `<b>${escapeHtml(title)}</b>\n\n${escapeHtml(body)}`;
      const configuredWebApp = this.config?.get<string>('TELEGRAM_WEBAPP_URL');
      const configuredFrontend = this.config?.get<string>('FRONTEND_URL');
      const rawUrl = configuredWebApp || (configuredFrontend ? `${configuredFrontend.replace(/\/+$/, '')}/tg-app` : undefined);
      const webAppUrl = rawUrl && /^https:\/\//i.test(rawUrl) ? rawUrl : undefined;

      const replyMarkup = webAppUrl
        ? { inline_keyboard: [[{ text: '📱 M-EDU WebApp ilovasi', web_app: { url: webAppUrl } }]] }
        : undefined;

      const result = await this.telegram.sendMessageDetailed(target.chatId, text, { replyMarkup });
      if (result.ok) {
        await this.deliveries.markSent(tracked.id, target.accountId);
        deliveries.push({ channel: 'TELEGRAM', ok: true });
        return true;
      }

      // Permanent (403/400) failures mark the account so NOTHING is ever sent
      // to that chat again; transient failures keep a bounded backoff retry.
      const category = await this.telegramDelivery.applyFailure(target, result);
      if (isTransientFailure(category)) {
        const backoffMs = 2 * 60 * 1000;
        await this.deliveries.markDeferred(tracked.id, new Date(Date.now() + backoffMs), {
          title,
          body,
        });
        deliveries.push({ channel: 'TELEGRAM', ok: false, error: category });
        return true;
      }

      await this.deliveries.markFailed(tracked.id, category, target.accountId);
      deliveries.push({ channel: 'TELEGRAM', ok: false, error: category });
      return false;
    } catch (err: unknown) {
      this.logger.error(
        JSON.stringify({
          event: 'notification_telegram_delivery_error',
          eventType: event.type,
          entityId: event.entityId,
          message: err instanceof Error ? err.message : String(err),
        }),
      );
      deliveries.push({ channel: 'TELEGRAM', ok: false, error: 'internal error' });
      return false;
    }
  }

  /**
   * Deliver ONE event to ONE parent's Email address as part of the
   * Smart Omnichannel Failover Cascade (when Telegram & SMS were unsuccessful).
   */
  private async deliverParentEmail(params: {
    event: NotificationEventPayload;
    to: string;
    title: string;
    body: string;
    failoverReason?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const { event, to, title, body, failoverReason } = params;
    if (!this.email) {
      return { success: false, error: 'EmailService not available' };
    }

    try {
      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0;">
          <div style="border-bottom: 2px solid #6366f1; padding-bottom: 12px; margin-bottom: 16px;">
            <h2 style="color: #1e293b; margin: 0; font-size: 20px;">${escapeHtml(title)}</h2>
            ${failoverReason ? `<span style="font-size: 11px; background: #fef3c7; color: #b45309; padding: 2px 8px; border-radius: 4px; display: inline-block; margin-top: 6px;">Zaxira aloqa kanali (${escapeHtml(failoverReason)})</span>` : ''}
          </div>
          <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">${escapeHtml(body)}</p>
          <div style="border-top: 1px solid #f1f5f9; padding-top: 16px; margin-top: 24px; font-size: 12px; color: #94a3b8; text-align: center;">
            <p style="margin: 0;">Ushbu bildirishnoma <b>M-EDU Ta'lim Platformasi</b> orqali yuborildi.</p>
          </div>
        </div>
      `.trim();

      const result = await this.email.sendRawEmail({
        to,
        subject: `[M-EDU] ${title}`,
        html,
        text: `${title}\n\n${body}`,
        organizationId: event.organizationId,
      });

      return result;
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private render(event: NotificationEventPayload): { title: string; body: string } {
    const name = event.data.studentName ?? '';
    switch (event.type) {
      case 'ATTENDANCE_MARKED_PRESENT':
        return {
          title: 'Farzandingiz darsda',
          body: `${name} yuzni tanish orqali darsga muvaffaqiyatli yetib keldi.`,
        };
      case 'ATTENDANCE_MARKED_ABSENT':
        return {
          title: 'Attendance alert',
          body: `${name} was marked ABSENT on ${event.data.date ?? event.occurredAt.slice(0, 10)}.`,
        };
      case 'ATTENDANCE_MARKED_LATE':
        return {
          title: 'Attendance notice',
          body: `${name} arrived LATE on ${event.data.date ?? event.occurredAt.slice(0, 10)}.`,
        };
      case 'PAYMENT_RECORDED':
        return {
          title: 'Payment received',
          body: `Payment of ${event.data.amount ?? ''} recorded for ${name}.`,
        };
      case 'PAYMENT_OVERDUE':
        return {
          title: 'Payment overdue',
          body: `Payment for ${name} is overdue (${event.data.date ?? event.occurredAt.slice(0, 10)}).`,
        };
      case 'INVOICE_ISSUED':
        return {
          title: 'New invoice',
          body: `Invoice ${event.entityId} was issued for ${name}.`,
        };
      case 'LEAD_CONVERTED':
        return {
          title: 'Lead converted',
          body: `Lead converted to student ${name}.`,
        };
      case 'LESSON_CANCELLED':
        return {
          title: 'Lesson cancelled',
          body: `Lesson on ${event.data.date ?? ''} was cancelled.`,
        };
      case 'FOLLOWUP_DUE':
        return {
          title: 'Follow-up scheduled',
          body: `Automated follow-up for ${event.data.leadName ?? 'lead'} (${event.data.ruleName ?? 'rule'}).`,
        };
      default:
        return { title: 'Notification', body: `Event ${event.type} for ${event.entityType} ${event.entityId}` };
    }
  }

  private async resolveRecipients(event: NotificationEventPayload): Promise<string[]> {
    const userIds = new Set<string>();

    // Tenant-scoped: an in-app row is keyed by userId, so a payload carrying a
    // foreign user id would otherwise deliver another organization's content.
    if (event.data.userId) {
      const owner = await this.prisma.user.findFirst({
        where: { id: event.data.userId, organizationId: event.organizationId },
        select: { id: true },
      });
      if (owner) userIds.add(owner.id);
    }

    // In-app notifications for the student themselves, if applicable
    if (event.data.studentId) {
      const student = await this.prisma.student.findFirst({
        where: { id: event.data.studentId, organizationId: event.organizationId },
        select: { userId: true },
      });
      if (student?.userId) {
        userIds.add(student.userId);
      }
    }

    return Array.from(userIds);
  }

  private async resolveParents(event: NotificationEventPayload) {
    if (event.data.studentId) {
      const parents = await this.prisma.parentStudent.findMany({
        // Always tenant-scoped: a student id is only ever resolved inside the
        // event's own organization, so a mis-scoped payload can never surface
        // another tenant's parents (and their Telegram chats / phone numbers).
        where: {
          studentId: event.data.studentId,
          student: { organizationId: event.organizationId },
          parent: { organizationId: event.organizationId, isActive: true },
        },
        select: { parent: true },
      });
      return parents.map(p => p.parent);
    }
    return [];
  }

  /**
   * Phone numbers to SMS for this event, resolved from TWO sources:
   *   1. ParentStudent links (ParentAccount.phone), and
   *   2. the Student row's legacy parentPhone field (many centers only store
   *      the parent number there).
   * Returns a de-duplicated list of normalized numbers.
   */
  private async resolveParentPhones(event: NotificationEventPayload): Promise<string[]> {
    const phones = new Set<string>();

    if (event.data.parentPhone) {
      phones.add(event.data.parentPhone);
    }

    if (event.data.studentId) {
      const links = await this.prisma.parentStudent.findMany({
        where: {
          studentId: event.data.studentId,
          student: { organizationId: event.organizationId },
          parent: { organizationId: event.organizationId, isActive: true },
        },
        select: { parent: { select: { phone: true } } },
      });
      for (const link of links) {
        if (link.parent.phone) phones.add(link.parent.phone);
      }

      if (phones.size === 0) {
        const student = await this.prisma.student.findFirst({
          where: {
            id: event.data.studentId,
            organizationId: event.organizationId,
          },
          select: { parentPhone: true },
        });
        if (student?.parentPhone) phones.add(student.parentPhone);
      }
    }

    return Array.from(phones);
  }

  private async deliverInApp(
    event: NotificationEventPayload,
    title: string,
    body: string,
  ): Promise<ChannelDeliveryResult> {
    const userIds = await this.resolveRecipients(event);
    if (userIds.length === 0) {
      return { channel: 'IN_APP', ok: false, error: 'no recipient users resolved' };
    }

    await this.prisma.$transaction(async (tx) => {
      for (const userId of userIds) {
        const dedupKey = crypto
          .createHash('sha256')
          .update(`${userId}:${event.type}:${event.entityId}:${event.occurredAt.slice(0, 10)}`)
          .digest('hex');

        // Authoritative dedup: only INSERT. If the row already exists the
        // event was already delivered for this (user, type, entity, day) —
        // skip creating a second Notification. The previous upsert with
        // `update: {}` still "succeeded" on the update path and then fell
        // through to notification.create, so every retry duplicated the
        // notification; only a P2002 race on the create path was filtered.
        let inserted = false;
        try {
          await tx.notificationDedup.create({
            data: {
              organizationId: event.organizationId,
              entityType: event.entityType,
              entityId: event.entityId,
              eventType: event.type,
              dedupKey,
            },
          });
          inserted = true;
        } catch (err: unknown) {
          const code = (err as { code?: string })?.code;
          if (code === 'P2002') {
            inserted = false;
          } else {
            throw err;
          }
        }

        if (!inserted) {
          continue;
        }

        await tx.notification.create({
          data: {
            organizationId: event.organizationId,
            userId,
            title,
            message: body,
            type: 'info',
          },
        });
      }
    });

    return { channel: 'IN_APP', ok: true };
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<NotificationEventPayload> | undefined, error: Error) {
    if (!job) return;
    this.logger.error(
      `[NotificationWorker] job ${job.id} (${job.name}) failed after ${job.attemptsMade} attempts: ${error.message}`,
    );
    if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
      await this.deadLetterQueue
        .add('notification-dead-letter', job.data, { removeOnComplete: 50 })
        .catch(() => undefined);
    }
  }
}
