import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TelegramPollingService } from '../telegram-polling.service';
import { TelegramService } from '../telegram.service';
import { TelegramUpdateDispatcherService } from '../telegram-update-dispatcher.service';

describe('TelegramPollingService', () => {
  let pollingService: TelegramPollingService;
  let telegram: {
    isConfigured: ReturnType<typeof vi.fn>;
    deleteWebhook: ReturnType<typeof vi.fn>;
    getUpdates: ReturnType<typeof vi.fn>;
  };
  let dispatcher: {
    dispatch: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    telegram = {
      isConfigured: vi.fn().mockReturnValue(true),
      deleteWebhook: vi.fn().mockResolvedValue(true),
      getUpdates: vi.fn().mockResolvedValue([]),
    };
    dispatcher = {
      dispatch: vi.fn().mockResolvedValue({ status: 'ok' }),
    };

    pollingService = new TelegramPollingService(
      telegram as unknown as TelegramService,
      dispatcher as unknown as TelegramUpdateDispatcherService,
    );
  });

  afterEach(() => {
    pollingService.stopPolling();
  });

  it('starts polling by deleting active webhook and tracking running status', async () => {
    expect(pollingService.isPolling()).toBe(false);
    const started = await pollingService.startPolling();
    expect(started).toBe(true);
    expect(pollingService.isPolling()).toBe(true);
    expect(telegram.deleteWebhook).toHaveBeenCalledWith(false);

    pollingService.stopPolling();
    expect(pollingService.isPolling()).toBe(false);
  });

  it('refuses to start polling if telegram is not configured', async () => {
    telegram.isConfigured.mockReturnValue(false);
    const started = await pollingService.startPolling();
    expect(started).toBe(false);
    expect(pollingService.isPolling()).toBe(false);
    expect(telegram.deleteWebhook).not.toHaveBeenCalled();
  });

  it('dispatches polled updates and increments update offset', async () => {
    const mockUpdates = [
      { update_id: 101, message: { text: 'salom', chat: { id: 1 } } },
      { update_id: 102, message: { text: '/help', chat: { id: 1 } } },
    ];
    telegram.getUpdates
      .mockResolvedValueOnce(mockUpdates)
      .mockResolvedValue([]);

    await pollingService.startPolling();

    // Allow event loop ticks for polling loop
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(dispatcher.dispatch).toHaveBeenCalledWith(mockUpdates[0]);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(mockUpdates[1]);

    const status = pollingService.getStatus();
    expect(status.currentOffset).toBe(103);

    pollingService.stopPolling();
  });

  it('provides live polling health status', () => {
    const status = pollingService.getStatus();
    expect(status.isPolling).toBe(false);
    expect(status.currentOffset).toBe(0);
    expect(status.errorCount).toBe(0);
  });
});
