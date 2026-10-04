import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger } from '@nestjs/common';
import { TelegramService, resolveTelegramApiBaseUrl } from '../telegram.service';
import type { ConfigService } from '@nestjs/config';

/**
 * The Bot API adapter's control plane: configurable API host, webhook
 * registration and command-menu publication.
 *
 * Security assertions in this file pin two rules: the URL is derived from
 * configuration only (never from user input), and neither the bot token nor
 * the webhook secret is ever written to the logs.
 */

const TOKEN = '8123456789:AAHdeadbeefdeadbeefdeadbeefdeadbeef';
const SECRET = 'super-secret-webhook-token-0123456789';
const DEFAULT_HOST = 'https://api.telegram.org';

function makeConfig(env: Record<string, string | undefined>) {
  return {
    get: (key: string) => env[key],
  } as unknown as ConfigService;
}

function makeService(env: Record<string, string | undefined> = {}) {
  return new TelegramService(makeConfig({ TELEGRAM_BOT_TOKEN: TOKEN, ...env }));
}

describe('resolveTelegramApiBaseUrl', () => {
  it('defaults to the public Telegram Bot API', () => {
    expect(resolveTelegramApiBaseUrl()).toBe(DEFAULT_HOST);
    expect(resolveTelegramApiBaseUrl('')).toBe(DEFAULT_HOST);
    expect(resolveTelegramApiBaseUrl('   ')).toBe(DEFAULT_HOST);
  });

  it('accepts an http(s) override and strips a trailing slash', () => {
    expect(resolveTelegramApiBaseUrl('https://tg.internal.example/')).toBe(
      'https://tg.internal.example',
    );
    expect(resolveTelegramApiBaseUrl('http://localhost:8081')).toBe('http://localhost:8081');
  });

  it('ignores anything that is not an absolute http(s) URL', () => {
    expect(resolveTelegramApiBaseUrl('api.telegram.org')).toBe(DEFAULT_HOST);
    expect(resolveTelegramApiBaseUrl('ftp://telegram.example')).toBe(DEFAULT_HOST);
    expect(resolveTelegramApiBaseUrl('https://has space.example')).toBe(DEFAULT_HOST);
  });
});

describe('TelegramService — sendMessage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('routes messages through the configured API host', async () => {
    const service = makeService({ TELEGRAM_API_BASE_URL: 'https://tg.internal.example' });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    const ok = await service.sendMessage('42', 'hello');

    expect(ok).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://tg.internal.example/bot${TOKEN}/sendMessage`,
    );
  });

  it('falls back to the public host when the override is invalid', async () => {
    const service = makeService({ TELEGRAM_API_BASE_URL: 'not-a-url' });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    await service.sendMessage('42', 'hello');

    expect(fetchMock.mock.calls[0][0]).toBe(`${DEFAULT_HOST}/bot${TOKEN}/sendMessage`);
  });
});

describe('TelegramService — setWebhook', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('registers the endpoint with the secret token and explicit update types', async () => {
    const service = makeService();
    const ok = await service.setWebhook('https://api.example.com/api/webhooks/telegram', SECRET);

    expect(ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${DEFAULT_HOST}/bot${TOKEN}/setWebhook`);
    expect(JSON.parse(init.body)).toMatchObject({
      url: 'https://api.example.com/api/webhooks/telegram',
      secret_token: SECRET,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: false,
    });
  });

  it('refuses a non-https endpoint without calling Telegram', async () => {
    const service = makeService();
    const ok = await service.setWebhook('http://insecure.example.com/hook', SECRET);

    expect(ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns false when Telegram rejects the registration', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 400, statusText: 'Bad Request' });
    const service = makeService();
    await expect(service.setWebhook('https://api.example.com/hook', SECRET)).resolves.toBe(false);
  });

  it('returns false (never throws) when the network fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const service = makeService();
    await expect(service.setWebhook('https://api.example.com/hook', SECRET)).resolves.toBe(false);
  });

  it('does nothing when Telegram delivery is disabled', async () => {
    const service = makeService({ TELEGRAM_ENABLED: 'false' });
    await expect(service.setWebhook('https://api.example.com/hook', SECRET)).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('simulates success in mock mode without touching the network', async () => {
    const service = makeService({ TELEGRAM_MOCK: 'true' });
    await expect(service.setWebhook('https://api.example.com/hook', SECRET)).resolves.toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('TelegramService — setMyCommands', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const COMMANDS = [{ command: 'start', description: 'Open M-EDU' }];

  it('registers the default list without a language code', async () => {
    const service = makeService();
    await expect(service.setMyCommands(COMMANDS)).resolves.toBe(true);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${DEFAULT_HOST}/bot${TOKEN}/setMyCommands`);
    expect(JSON.parse(init.body)).toEqual({
      commands: COMMANDS,
      scope: { type: 'default' },
    });
  });

  it('registers a localized list with an explicit language code', async () => {
    const service = makeService();
    await expect(service.setMyCommands(COMMANDS, 'uz')).resolves.toBe(true);

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      commands: COMMANDS,
      scope: { type: 'default' },
      language_code: 'uz',
    });
  });

  it('does not call Telegram for an empty list', async () => {
    const service = makeService();
    await expect(service.setMyCommands([])).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('TelegramService — logging hygiene', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('never writes the bot token or the webhook secret to the logs', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn');
    const log = vi.spyOn(Logger.prototype, 'log');
    const error = vi.spyOn(Logger.prototype, 'error');

    const service = makeService({ TELEGRAM_API_BASE_URL: 'https://tg.internal.example' });
    await service.sendMessage('42', 'hello');
    await service.setWebhook('https://api.example.com/api/webhooks/telegram', SECRET);
    await service.setMyCommands([{ command: 'start', description: 'Open M-EDU' }], 'ru');
    await service.sendMessageDetailed('42', 'boom', undefined);

    const logged = JSON.stringify([
      ...warn.mock.calls,
      ...log.mock.calls,
      ...error.mock.calls,
    ]);
    expect(logged).not.toContain(TOKEN);
    expect(logged).not.toContain(SECRET);
  });

  it('exposes only the public bot username, never token-derived data', () => {
    const service = makeService({ TELEGRAM_MOCK: 'true' });
    expect(service.getBotUsername()).toBe('medu_education_bot');
    expect(typeof service.isConfigured()).toBe('boolean');
  });
});
