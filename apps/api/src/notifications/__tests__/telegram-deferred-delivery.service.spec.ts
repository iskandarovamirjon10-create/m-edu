import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TelegramDeferredDeliveryService } from '../telegram-deferred-delivery.service';

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'nd-1',
    organizationId: 'org-1',
    eventType: 'ATTENDANCE_MARKED_ABSENT',
    entityType: 'Attendance',
    entityId: 'att-1',
    channel: 'TELEGRAM',
    principalType: 'PARENT_ACCOUNT',
    principalId: 'p-1',
    telegramAccountId: 'acct-1',
    status: 'PROCESSING',
    failureCategory: null,
    attempts: 1,
    title: 'Attendance alert',
    body: 'Absent today.',
    deferredUntil: new Date('2026-06-02T02:00:00Z'),
    createdAt: new Date('2026-06-01T22:00:00Z'),
    ...overrides,
  };
}

/** The deferral target instant; every claim below is recent relative to it. */
const NOW = new Date('2026-06-02T02:00:00Z');

describe('TelegramDeferredDeliveryService (quiet-hours sweep)', () => {
  let deliveries: any;
  let telegram: any;
  let targets: any;
  let service: TelegramDeferredDeliveryService;

  beforeEach(() => {
    deliveries = {
      recoverStaleProcessing: vi.fn().mockResolvedValue(0),
      claimDueDeferred: vi.fn().mockResolvedValue([]),
      markSent: vi.fn(),
      markFailed: vi.fn(),
      markSkipped: vi.fn(),
      markDeferred: vi.fn(),
    };
    telegram = {
      isConfigured: vi.fn().mockReturnValue(true),
      sendMessageDetailed: vi.fn().mockResolvedValue({ ok: true, retryable: false }),
    };
    targets = {
      resolveActiveTarget: vi.fn().mockResolvedValue({
        accountId: 'acct-1',
        organizationId: 'org-1',
        chatId: 'chat-1',
        languageCode: 'en',
        userId: null,
        parentAccountId: 'p-1',
      }),
      applyFailure: vi.fn().mockResolvedValue('PERMANENT'),
    };

    service = new TelegramDeferredDeliveryService(deliveries, telegram, targets);
  });

  it('does nothing when Telegram is not configured', async () => {
    telegram.isConfigured.mockReturnValue(false);
    const result = await service.runOnce();
    expect(result).toEqual({ delivered: 0, failed: 0, requeued: 0 });
    expect(deliveries.claimDueDeferred).not.toHaveBeenCalled();
  });

  it('re-delivers a due deferred notification after the quiet window', async () => {
    deliveries.claimDueDeferred.mockResolvedValue([row()]);

    const result = await service.runOnce(NOW);

    expect(result.delivered).toBe(1);
    expect(telegram.sendMessageDetailed).toHaveBeenCalledWith(
      'chat-1',
      expect.stringContaining('Attendance alert'),
    );
    expect(deliveries.markSent).toHaveBeenCalledWith('nd-1', 'acct-1');
  });

  it('skips (never retries) when the account became inactive while waiting', async () => {
    deliveries.claimDueDeferred.mockResolvedValue([row()]);
    targets.resolveActiveTarget.mockResolvedValue(null);

    const result = await service.runOnce(NOW);

    expect(result.delivered).toBe(0);
    expect(deliveries.markSkipped).toHaveBeenCalledWith('nd-1', 'NOT_ACTIVE');
    expect(telegram.sendMessageDetailed).not.toHaveBeenCalled();
  });

  it('re-defers with backoff on a transient provider failure', async () => {
    deliveries.claimDueDeferred.mockResolvedValue([row({ attempts: 2 })]);
    telegram.sendMessageDetailed.mockResolvedValue({
      ok: false,
      errorCategory: 'TIMEOUT',
      retryable: true,
    });
    targets.applyFailure.mockResolvedValue('TIMEOUT');

    const result = await service.runOnce(NOW);

    expect(result.requeued).toBe(1);
    expect(deliveries.markDeferred).toHaveBeenCalledWith(
      'nd-1',
      new Date(NOW.getTime() + 4 * 60_000),
      expect.objectContaining({ title: 'Attendance alert' }),
    );
    expect(deliveries.markFailed).not.toHaveBeenCalled();
  });

  it('stops retrying after the attempt budget and records FAILED', async () => {
    deliveries.claimDueDeferred.mockResolvedValue([row({ attempts: 6 })]);
    telegram.sendMessageDetailed.mockResolvedValue({
      ok: false,
      errorCategory: 'TIMEOUT',
      retryable: true,
    });
    targets.applyFailure.mockResolvedValue('TIMEOUT');

    const result = await service.runOnce(NOW);

    expect(result.failed).toBe(1);
    expect(deliveries.markFailed).toHaveBeenCalledWith('nd-1', 'TIMEOUT', 'acct-1');
    expect(deliveries.markDeferred).not.toHaveBeenCalled();
  });

  it('records a permanent failure and lets the account be marked blocked', async () => {
    deliveries.claimDueDeferred.mockResolvedValue([row()]);
    telegram.sendMessageDetailed.mockResolvedValue({
      ok: false,
      errorCategory: 'BLOCKED_USER',
      retryable: false,
    });
    targets.applyFailure.mockResolvedValue('BLOCKED_USER');

    const result = await service.runOnce(NOW);

    expect(result.failed).toBe(1);
    expect(targets.applyFailure).toHaveBeenCalled();
    expect(deliveries.markFailed).toHaveBeenCalledWith('nd-1', 'BLOCKED_USER', 'acct-1');
  });

  it('never sends a notification whose deferral went stale (day-old backlog)', async () => {
    deliveries.claimDueDeferred.mockResolvedValue([
      row({ createdAt: new Date('2026-05-20T22:00:00Z') }),
    ]);

    const result = await service.runOnce(new Date('2026-06-02T02:00:00Z'));

    expect(result.delivered).toBe(0);
    expect(telegram.sendMessageDetailed).not.toHaveBeenCalled();
    expect(deliveries.markSkipped).toHaveBeenCalledWith('nd-1', 'STALE_DEFERRAL');
  });

  it('recovers abandoned claims before claiming work (crash safety)', async () => {
    await service.runOnce();
    expect(deliveries.recoverStaleProcessing).toHaveBeenCalled();
  });

  it('does not run two sweeps concurrently in one process', async () => {
    let release: (() => void) | undefined;
    deliveries.claimDueDeferred.mockImplementation(
      () => new Promise((resolve) => {
        release = () => resolve([]);
      }),
    );

    const first = service.sweep();
    await service.sweep(); // must return immediately (running guard)
    release?.();
    await first;

    expect(deliveries.claimDueDeferred).toHaveBeenCalledTimes(1);
  });
});
