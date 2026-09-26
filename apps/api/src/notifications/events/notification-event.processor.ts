import { Injectable, Logger } from '@nestjs/common';
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
  ) {
    super();
  }

  private async getRedis(): Promise<Redis | null> {
    if (this.redis !== null && this.redis !== undefined) return this.redis;
    try {
      const mod = await import('ioredis');
      const RedisCtor = mod.default;
      const host = process.env.REDIS_HOST || 'localhost';
      const port = Number(process.env.REDIS_PORT) || 6379;
      const client = new (RedisCtor as unknown as {
        new (opts: Record<string, unknown>): Redis;
      })({
        host,
        port,
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
        return cached ? JSON.parse(cached) : { deliveries: [] };
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

    // 2. Parent SMS via the real provider (Eskiz/PlayMobile).
    //
    // Attendance (absent/late) and payment events go straight to SMS as the
    // primary parent channel: Uzbek parents overwhelmingly interact via SMS,
    // Telegram is a bonus and email is effectively unused. The processor
    // passes the org id so the SmsService can audit-delivery into SMSLog.
    if (PARENT_SMS_EVENTS.has(event.type)) {
      const smsTargets = await this.resolveParentPhones(event);
      for (const phone of smsTargets) {
        try {
          const ok = await this.sms.sendSms(phone, `${title}: ${body}`, event.organizationId);
          deliveries.push({ channel: 'SMS', ok, error: ok ? undefined : 'provider rejected' });
        } catch (e) {
          deliveries.push({ channel: 'SMS', ok: false, error: e.message });
          this.logger.error(
            `Parent SMS failed for event ${event.type}/${event.entityId} to ${phone}: ${e.message}`,
          );
        }
      }
    }

    // 3. Parent notifications.
    //
    // `TelegramAccount` (status = ACTIVE, same organization) is the ONLY
    // authoritative Telegram delivery identity. The legacy
    // `ParentAccount.telegramChatId` column is deliberately NOT read here: a
    // stale pointer (set before a disconnect/block) must never route a
    // message, and a non-ACTIVE account must never receive one. The column is
    // still dual-written by the linking flow for the compatibility window.
    const parents = await this.resolveParents(event);
    const targets = await this.telegramDelivery.resolveActiveTargetsForPrincipals(
      event.organizationId,
      parents.map((parent) => ({
        type: 'PARENT_ACCOUNT' as const,
        parentAccountId: parent.id,
      })),
    );

    for (const parent of parents) {
      const target = targets.get(parent.id) ?? null;
      let telegramHandled = false; // sent OR deferred for a later retry

      if (target) {
        telegramHandled = await this.deliverParentTelegram({
          event,
          eventId: String(job.id ?? ''),
          title,
          body,
          target,
          deliveries,
        });
      }

      // Preserve the existing fallback chain: SMS when Telegram was not
      // delivered. A DEFERRED delivery is not "not delivered" — it will be
      // retried — so it deliberately does not trigger the SMS fallback (nor
      // does an explicit user opt-out, which is what the setting means).
      if (!telegramHandled && parent.phone) {
        try {
          const smsOk = await this.sms.sendSms(parent.phone, `${title}: ${body}`);
          deliveries.push({ channel: 'SMS', ok: smsOk, error: smsOk ? undefined : 'SMS provider rejected' });
        } catch (e) {
          deliveries.push({ channel: 'SMS', ok: false, error: e.message });
        }
      }
    }

    // Handle legacy fallback if no parents were resolved but event has parentPhone
    if (parents.length === 0 && event.data.parentPhone) {
      try {
        const smsOk = await this.sms.sendSms(event.data.parentPhone, `${title}: ${body}`);
        deliveries.push({ channel: 'SMS', ok: smsOk, error: smsOk ? undefined : 'provider rejected' });
      } catch (e) {
        deliveries.push({ channel: 'SMS', ok: false, error: e.message });
        if (e.message !== 'IMPLEMENTED - RUNTIME CREDENTIALS UNVERIFIED') {
          throw e;
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
      const result = await this.telegram.sendMessageDetailed(target.chatId, text);
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

  private render(event: NotificationEventPayload): { title: string; body: string } {
    const name = event.data.studentName ?? '';
    switch (event.type) {
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
