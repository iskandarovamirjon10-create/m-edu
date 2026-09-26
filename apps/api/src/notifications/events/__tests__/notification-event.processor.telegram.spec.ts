import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Job, Queue } from 'bullmq';
import { NotificationEventProcessor } from '../notification-event.processor';
import { NotificationEventPayload } from '../notification.events';

/**
 * The notification processor's Telegram path after the legacy-pointer
 * migration: `TelegramAccount` (ACTIVE, same org) is authoritative, the legacy
 * `ParentAccount.telegramChatId` mirror is never read, quiet hours defer
 * instead of dropping, transient failures retry, and permanent failures mark
 * the account.
 */
describe('NotificationEventProcessor — Telegram delivery (lifecycle aware)', () => {
  let processor: NotificationEventProcessor;
  let prisma: any;
  let sms: any;
  let telegram: any;
  let dlq: any;
  let telegramDelivery: any;
  let deliveries: any;
  let policy: any;

  const PARENT = { id: 'p-1', phone: '+998900000000', telegramChatId: '9999-legacy' };

  beforeEach(() => {
    prisma = {
      $transaction: vi.fn(async (cb: any) => cb(prisma)),
      notificationDedup: { create: vi.fn().mockResolvedValue({ id: 'd-1' }) },
      notification: { create: vi.fn() },
      user: { findFirst: vi.fn().mockResolvedValue(null) },
      student: { findFirst: vi.fn().mockResolvedValue(null) },
      parentStudent: { findMany: vi.fn().mockResolvedValue([{ parent: PARENT }]) },
    };
    sms = { sendSms: vi.fn().mockResolvedValue(true) };
    telegram = { sendMessageDetailed: vi.fn().mockResolvedValue({ ok: true, retryable: false }) };
    dlq = { add: vi.fn() };

    telegramDelivery = {
      resolveActiveTargetsForPrincipals: vi.fn().mockResolvedValue(new Map()),
      applyFailure: vi.fn().mockResolvedValue('PERMANENT'),
    };
    deliveries = {
      ensureTracked: vi.fn().mockResolvedValue({ id: 'nd-1', alreadySent: false, attempts: 1 }),
      markSent: vi.fn(),
      markFailed: vi.fn(),
      markSkipped: vi.fn(),
      markDeferred: vi.fn(),
    };
    policy = {
      evaluate: vi.fn().mockResolvedValue({
        enabled: true,
        quietHoursActive: false,
        deferredUntil: null,
        reason: 'OK',
        settingsAvailable: false,
        timeZone: 'UTC',
      }),
    };

    processor = new NotificationEventProcessor(
      prisma,
      sms,
      telegram,
      dlq as unknown as Queue,
      telegramDelivery,
      deliveries,
      policy,
    );
    // Bypass the Redis idempotency layer; the DB dedup path is covered elsewhere.
    // @ts-ignore test seam
    processor.getRedis = vi.fn().mockResolvedValue(null);
  });

  function job(payload: Partial<NotificationEventPayload> = {}): Job<NotificationEventPayload> {
    return {
      id: 'job-1',
      data: {
        organizationId: 'org-1',
        type: 'LESSON_CANCELLED',
        occurredAt: new Date().toISOString(),
        entityType: 'Lesson',
        entityId: 'l-1',
        data: { studentId: 's-1', studentName: 'Test Student' },
        ...payload,
      },
    } as unknown as Job<NotificationEventPayload>;
  }

  function withActiveTarget(chatId = 'chat-1') {
    telegramDelivery.resolveActiveTargetsForPrincipals.mockResolvedValue(
      new Map([
        [
          'p-1',
          {
            accountId: 'acct-1',
            organizationId: 'org-1',
            chatId,
            languageCode: 'en',
            userId: null,
            parentAccountId: 'p-1',
          },
        ],
      ]),
    );
  }

  it('delivers to the ACTIVE TelegramAccount and records the delivery', async () => {
    withActiveTarget();
    await processor.process(job());

    expect(telegram.sendMessageDetailed).toHaveBeenCalledTimes(1);
    expect(telegram.sendMessageDetailed.mock.calls[0][0]).toBe('chat-1');
    expect(deliveries.markSent).toHaveBeenCalledWith('nd-1', 'acct-1');
    expect(sms.sendSms).not.toHaveBeenCalled();
  });

  it('ignores a stale legacy ParentAccount.telegramChatId when no ACTIVE account exists', async () => {
    // targets map empty => account disconnected/blocked/absent
    await processor.process(job());

    expect(telegram.sendMessageDetailed).not.toHaveBeenCalled();
    // Existing SMS fallback behaviour is preserved.
    expect(sms.sendSms).toHaveBeenCalledWith(PARENT.phone, expect.any(String));
  });

  it('resolves the target FROM TelegramAccount, never from the legacy column', async () => {
    withActiveTarget('chat-from-account');
    await processor.process(job());

    const resolvedArgs = telegramDelivery.resolveActiveTargetsForPrincipals.mock.calls[0];
    expect(resolvedArgs[0]).toBe('org-1');
    expect(resolvedArgs[1]).toEqual([{ type: 'PARENT_ACCOUNT', parentAccountId: 'p-1' }]);
    expect(telegram.sendMessageDetailed.mock.calls[0][0]).toBe('chat-from-account');
  });

  it('skips Telegram (and falls back to SMS) when the channel is disabled by policy', async () => {
    withActiveTarget();
    policy.evaluate.mockResolvedValue({
      enabled: false,
      quietHoursActive: false,
      deferredUntil: null,
      reason: 'CHANNEL_DISABLED',
      settingsAvailable: true,
      timeZone: 'UTC',
    });

    await processor.process(job());

    expect(deliveries.markSkipped).toHaveBeenCalledWith('nd-1', 'CHANNEL_DISABLED');
    expect(telegram.sendMessageDetailed).not.toHaveBeenCalled();
    expect(sms.sendSms).toHaveBeenCalledWith(PARENT.phone, expect.any(String));
  });

  it('DEFERS during quiet hours instead of dropping, and does not double-send SMS', async () => {
    withActiveTarget();
    const deferredUntil = new Date(Date.now() + 60 * 60 * 1000);
    policy.evaluate.mockResolvedValue({
      enabled: true,
      quietHoursActive: true,
      deferredUntil,
      reason: 'QUIET_HOURS',
      settingsAvailable: true,
      timeZone: 'UTC',
    });

    const result = await processor.process(job());

    expect(deliveries.markDeferred).toHaveBeenCalledWith('nd-1', deferredUntil, {
      title: expect.any(String),
      body: expect.any(String),
    });
    expect(telegram.sendMessageDetailed).not.toHaveBeenCalled();
    expect(sms.sendSms).not.toHaveBeenCalled();
    expect(result.deliveries.some((d) => d.error === 'DEFERRED_QUIET_HOURS')).toBe(true);
  });

  it('re-defers a TRANSIENT failure for retry and does NOT mark the account', async () => {
    withActiveTarget();
    telegram.sendMessageDetailed.mockResolvedValue({
      ok: false,
      errorCategory: 'TIMEOUT',
      retryable: true,
    });
    telegramDelivery.applyFailure.mockResolvedValue('TIMEOUT');

    await processor.process(job());

    expect(telegramDelivery.applyFailure).toHaveBeenCalled();
    expect(deliveries.markDeferred).toHaveBeenCalled();
    expect(deliveries.markFailed).not.toHaveBeenCalled();
    expect(sms.sendSms).not.toHaveBeenCalled();
  });

  it('records a PERMANENT failure, blocks the account and falls back to SMS', async () => {
    withActiveTarget();
    telegram.sendMessageDetailed.mockResolvedValue({
      ok: false,
      errorCategory: 'BLOCKED_USER',
      retryable: false,
    });
    telegramDelivery.applyFailure.mockResolvedValue('BLOCKED_USER');

    await processor.process(job());

    expect(telegramDelivery.applyFailure).toHaveBeenCalled();
    expect(deliveries.markFailed).toHaveBeenCalledWith('nd-1', 'BLOCKED_USER', 'acct-1');
    expect(deliveries.markDeferred).not.toHaveBeenCalled();
    expect(sms.sendSms).toHaveBeenCalledWith(PARENT.phone, expect.any(String));
  });

  it('does not re-send when a previous attempt for the same event already succeeded', async () => {
    withActiveTarget();
    deliveries.ensureTracked.mockResolvedValue({ id: 'nd-1', alreadySent: true, attempts: 2 });

    await processor.process(job());

    expect(telegram.sendMessageDetailed).not.toHaveBeenCalled();
    expect(deliveries.markSent).not.toHaveBeenCalled();
    expect(sms.sendSms).not.toHaveBeenCalled();
  });

  it('escapes user-derived content before HTML-mode interpolation', async () => {
    withActiveTarget();
    await processor.process(
      job({
        // Attendance renders the student name into the Telegram message.
        type: 'ATTENDANCE_MARKED_ABSENT',
        data: { studentId: 's-1', studentName: 'A&B <b>evil</b>' },
      }),
    );

    const sentText: string = telegram.sendMessageDetailed.mock.calls[0][1];
    expect(sentText).toContain('A&amp;B &lt;b&gt;evil&lt;/b&gt;');
    expect(sentText).not.toContain('<b>evil</b>');
  });

  it('contains Telegram errors without failing the notification job', async () => {
    withActiveTarget();
    telegram.sendMessageDetailed.mockRejectedValue(new Error('socket exploded'));

    await expect(processor.process(job())).resolves.toBeDefined();
    expect(sms.sendSms).toHaveBeenCalled();
  });
});
