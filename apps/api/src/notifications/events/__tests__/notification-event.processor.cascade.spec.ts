import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Job, Queue } from 'bullmq';
import { NotificationEventProcessor } from '../notification-event.processor';
import { NotificationEventPayload } from '../notification.events';

describe('NotificationEventProcessor — Smart Omnichannel Failover Cascade', () => {
  let processor: NotificationEventProcessor;
  let prisma: any;
  let sms: any;
  let telegram: any;
  let dlq: any;
  let telegramDelivery: any;
  let deliveries: any;
  let policy: any;
  let email: any;

  const PARENT = {
    id: 'p-100',
    phone: '+998901112233',
    email: 'parent@example.com',
    isActive: true,
  };

  beforeEach(() => {
    prisma = {
      $transaction: vi.fn(async (cb: any) => cb(prisma)),
      notificationDedup: { create: vi.fn().mockResolvedValue({ id: 'dedup-cascade-1' }) },
      notification: { create: vi.fn() },
      user: { findFirst: vi.fn().mockResolvedValue(null) },
      student: { findFirst: vi.fn().mockResolvedValue(null) },
      parentStudent: { findMany: vi.fn().mockResolvedValue([{ parent: PARENT }]) },
    };

    sms = {
      sendSms: vi.fn().mockResolvedValue(true),
      sendSmsDetailed: vi.fn().mockResolvedValue({ ok: true, externalId: 'sms-ext-100' }),
    };

    telegram = {
      sendMessageDetailed: vi.fn().mockResolvedValue({ ok: true, retryable: false }),
    };

    dlq = { add: vi.fn() };

    telegramDelivery = {
      resolveActiveTargetsForPrincipals: vi.fn().mockResolvedValue(new Map()),
      applyFailure: vi.fn().mockResolvedValue('PERMANENT'),
    };

    deliveries = {
      ensureTracked: vi.fn().mockResolvedValue({ id: 'nd-cascade-1', alreadySent: false, attempts: 1 }),
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
        timeZone: 'Asia/Tashkent',
      }),
    };

    email = {
      sendRawEmail: vi.fn().mockResolvedValue({ success: true }),
    };

    processor = new NotificationEventProcessor(
      prisma,
      sms,
      telegram,
      dlq as unknown as Queue,
      telegramDelivery,
      deliveries,
      policy,
      undefined,
      email,
    );

    // Bypass Redis in tests
    // @ts-ignore
    processor.getRedis = vi.fn().mockResolvedValue(null);
  });

  function createTestJob(payload: Partial<NotificationEventPayload> = {}): Job<NotificationEventPayload> {
    return {
      id: 'job-cascade-1',
      data: {
        organizationId: 'org-test-1',
        type: 'ATTENDANCE_MARKED_ABSENT',
        occurredAt: new Date().toISOString(),
        entityType: 'Attendance',
        entityId: 'att-99',
        data: { studentId: 's-100', studentName: 'Aziz Rahimov', date: '2026-11-06' },
        ...payload,
      },
    } as unknown as Job<NotificationEventPayload>;
  }

  it('Cascade Step 1 (Telegram Success): Sends to Telegram and suppresses SMS & Email (zero SMS cost)', async () => {
    // Configure active Telegram target
    telegramDelivery.resolveActiveTargetsForPrincipals.mockResolvedValue(
      new Map([
        [
          'p-100',
          {
            accountId: 'tg-acct-100',
            organizationId: 'org-test-1',
            chatId: 'chat-aziz-father',
            parentAccountId: 'p-100',
          },
        ],
      ]),
    );

    const result = await processor.process(createTestJob());

    // 1. Telegram sent successfully
    expect(telegram.sendMessageDetailed).toHaveBeenCalledTimes(1);
    expect(telegram.sendMessageDetailed).toHaveBeenCalledWith('chat-aziz-father', expect.any(String), expect.any(Object));
    expect(deliveries.markSent).toHaveBeenCalledWith('nd-cascade-1', 'tg-acct-100');

    // 2. Cost-saving: SMS & Email were NOT dispatched
    expect(sms.sendSmsDetailed).not.toHaveBeenCalled();
    expect(sms.sendSms).not.toHaveBeenCalled();
    expect(email.sendRawEmail).not.toHaveBeenCalled();

    // 3. Deliveries reflect Telegram delivery
    expect(result.deliveries.some((d) => d.channel === 'TELEGRAM' && d.ok)).toBe(true);
  });

  it('Cascade Step 2 (Telegram unavailable -> SMS fallback): Sends SMS when parent has no active Telegram', async () => {
    // No active Telegram targets
    telegramDelivery.resolveActiveTargetsForPrincipals.mockResolvedValue(new Map());

    const result = await processor.process(createTestJob());

    // 1. Telegram was not called
    expect(telegram.sendMessageDetailed).not.toHaveBeenCalled();

    // 2. Cascade stepped down to SMS
    expect(sms.sendSmsDetailed).toHaveBeenCalledTimes(1);
    expect(sms.sendSmsDetailed).toHaveBeenCalledWith(PARENT.phone, expect.any(String), 'org-test-1');

    // 3. Email was NOT dispatched because SMS succeeded
    expect(email.sendRawEmail).not.toHaveBeenCalled();

    // 4. Deliveries record
    expect(result.deliveries.some((d) => d.channel === 'SMS' && d.ok)).toBe(true);
  });

  it('Cascade Step 3 (SMS provider out of balance -> Email Smart Failover): Fails over to Email when Eskiz credit is 0', async () => {
    // No active Telegram
    telegramDelivery.resolveActiveTargetsForPrincipals.mockResolvedValue(new Map());

    // SMS provider returns insufficient credits (Eskiz balance 0)
    sms.sendSmsDetailed.mockResolvedValue({
      ok: false,
      failureCategory: 'INSUFFICIENT_CREDITS',
      errorMessage: 'Eskiz API error: 402 - Hisobda mablag yetarli emas',
    });

    const result = await processor.process(createTestJob());

    // 1. Telegram was not called
    expect(telegram.sendMessageDetailed).not.toHaveBeenCalled();

    // 2. SMS was attempted and failed
    expect(sms.sendSmsDetailed).toHaveBeenCalledTimes(1);

    // 3. Smart Failover: email was dispatched with failover reason
    expect(email.sendRawEmail).toHaveBeenCalledTimes(1);
    expect(email.sendRawEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: PARENT.email,
        subject: expect.stringContaining('Attendance alert'),
        html: expect.stringContaining('Zaxira aloqa kanali'),
        organizationId: 'org-test-1',
      }),
    );

    // 4. Deliveries contains SMS failure AND Email success
    expect(result.deliveries.some((d) => d.channel === 'SMS' && !d.ok)).toBe(true);
    expect(result.deliveries.some((d) => d.channel === 'EMAIL' && d.ok)).toBe(true);
  });

  it('Cascade Step 3b (Telegram BLOCKED + SMS Network down -> Email Smart Failover)', async () => {
    // Telegram returns permanent BLOCKED_USER
    telegramDelivery.resolveActiveTargetsForPrincipals.mockResolvedValue(
      new Map([
        [
          'p-100',
          {
            accountId: 'tg-acct-100',
            organizationId: 'org-test-1',
            chatId: 'chat-blocked',
            parentAccountId: 'p-100',
          },
        ],
      ]),
    );
    telegram.sendMessageDetailed.mockResolvedValue({
      ok: false,
      errorCategory: 'BLOCKED_USER',
      retryable: false,
    });
    telegramDelivery.applyFailure.mockResolvedValue('BLOCKED_USER');

    // SMS throws network exception (e.g. timeout / connection refused)
    sms.sendSmsDetailed.mockRejectedValue(new Error('ECONNREFUSED to sms provider'));

    const result = await processor.process(createTestJob());

    // 1. Telegram failed
    expect(telegram.sendMessageDetailed).toHaveBeenCalledTimes(1);
    expect(deliveries.markFailed).toHaveBeenCalledWith('nd-cascade-1', 'BLOCKED_USER', 'tg-acct-100');

    // 2. SMS failed
    expect(sms.sendSmsDetailed).toHaveBeenCalledTimes(1);

    // 3. Smart Failover to Email succeeded!
    expect(email.sendRawEmail).toHaveBeenCalledTimes(1);
    expect(email.sendRawEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: PARENT.email,
      }),
    );

    expect(result.deliveries.some((d) => d.channel === 'TELEGRAM' && !d.ok)).toBe(true);
    expect(result.deliveries.some((d) => d.channel === 'SMS' && !d.ok)).toBe(true);
    expect(result.deliveries.some((d) => d.channel === 'EMAIL' && d.ok)).toBe(true);
  });
});
