import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TelegramAdminController } from '../telegram-admin.controller';
import { TelegramObservabilityService } from '../telegram-observability.service';
import { TelegramService } from '../telegram.service';
import { TelegramPollingService } from '../telegram-polling.service';
import { TelegramBootstrapService } from '../telegram-bootstrap.service';
import { ConfigService } from '@nestjs/config';

describe('TelegramAdminController', () => {
  let controller: TelegramAdminController;
  let observability: { overview: ReturnType<typeof vi.fn> };
  let telegram: {
    isConfigured: ReturnType<typeof vi.fn>;
    getMe: ReturnType<typeof vi.fn>;
    getWebhookInfo: ReturnType<typeof vi.fn>;
    getBotUsername: ReturnType<typeof vi.fn>;
  };
  let config: { get: ReturnType<typeof vi.fn> };
  let polling: {
    isPolling: ReturnType<typeof vi.fn>;
    getStatus: ReturnType<typeof vi.fn>;
    startPolling: ReturnType<typeof vi.fn>;
    stopPolling: ReturnType<typeof vi.fn>;
  };
  let bootstrap: { registerWebhook: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    observability = { overview: vi.fn().mockResolvedValue({ accounts: 5 }) };
    telegram = {
      isConfigured: vi.fn().mockReturnValue(true),
      getMe: vi.fn().mockResolvedValue({
        id: 12345,
        is_bot: true,
        first_name: 'Medu Bot',
        username: 'medu_bot',
      }),
      getWebhookInfo: vi.fn().mockResolvedValue({
        url: 'https://example.com/api/webhooks/telegram',
        pending_update_count: 0,
      }),
      getBotUsername: vi.fn().mockReturnValue('medu_bot'),
    };
    config = {
      get: vi.fn().mockImplementation((k: string) => {
        if (k === 'TELEGRAM_WEBHOOK_URL') return 'https://example.com/api/webhooks/telegram';
        return undefined;
      }),
    };
    polling = {
      isPolling: vi.fn().mockReturnValue(false),
      getStatus: vi.fn().mockReturnValue({ isPolling: false, currentOffset: 0, errorCount: 0 }),
      startPolling: vi.fn().mockResolvedValue(true),
      stopPolling: vi.fn(),
    };
    bootstrap = {
      registerWebhook: vi.fn().mockResolvedValue(true),
    };

    controller = new TelegramAdminController(
      observability as unknown as TelegramObservabilityService,
      telegram as unknown as TelegramService,
      config as unknown as ConfigService,
      polling as unknown as TelegramPollingService,
      bootstrap as unknown as TelegramBootstrapService,
    );
  });

  it('overview delegates to observability service', async () => {
    const user = { organizationId: 'org-1', role: 'ORG_ADMIN' } as any;
    const res = await controller.overview(user);
    expect(res).toEqual({ accounts: 5 });
    expect(observability.overview).toHaveBeenCalledWith({
      organizationId: 'org-1',
      role: 'ORG_ADMIN',
    });
  });

  it('getBotInfo returns live bot profile', async () => {
    const res = await controller.getBotInfo();
    expect(res.configured).toBe(true);
    expect(res.username).toBe('medu_bot');
    expect(res.bot?.id).toBe(12345);
    expect(res.isPolling).toBe(false);
  });

  it('getWebhookInfo returns mode and webhook parameters', async () => {
    const res = await controller.getWebhookInfo();
    expect(res.configured).toBe(true);
    expect(res.mode).toBe('WEBHOOK');
    expect(res.webhook?.url).toBe('https://example.com/api/webhooks/telegram');
  });

  it('toggleMode switches to Long-Polling', async () => {
    const res = await controller.toggleMode({ mode: 'POLLING' });
    expect(res.success).toBe(true);
    expect(res.mode).toBe('POLLING');
    expect(polling.startPolling).toHaveBeenCalled();
  });

  it('toggleMode switches to Webhook', async () => {
    const res = await controller.toggleMode({ mode: 'WEBHOOK' });
    expect(res.success).toBe(true);
    expect(res.mode).toBe('WEBHOOK');
    expect(polling.stopPolling).toHaveBeenCalled();
    expect(bootstrap.registerWebhook).toHaveBeenCalled();
  });

  it('ping measures latency to Telegram Bot API', async () => {
    const res = await controller.ping();
    expect(res.ok).toBe(true);
    expect(typeof res.pingMs).toBe('number');
    expect(res.bot?.username).toBe('medu_bot');
  });
});
