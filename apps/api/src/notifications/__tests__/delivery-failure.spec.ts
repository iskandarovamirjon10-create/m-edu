import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TelegramService } from '../../telegram/telegram.service';
import { SmsService } from '../sms.service';

function makeConfig(env: Record<string, string> = {}) {
  return {
    get: (key: string, defaultValue?: string) => env[key] ?? defaultValue,
  } as never;
}

function makePrisma() {
  return {
    sMSLog: { create: vi.fn().mockResolvedValue({}) },
  } as unknown as import('../../prisma/prisma.service').PrismaService;
}

describe('TelegramService (fetch-based) failure handling', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is not configured without TELEGRAM_BOT_TOKEN and refuses to send (no fake success)', async () => {
    const svc = new TelegramService(makeConfig({}));
    expect(svc.isConfigured()).toBe(false);
    const ok = await svc.sendMessage('chat-1', 'hello');
    expect(ok).toBe(false);
  });

  it('returns true when the Telegram API accepts the message', async () => {
    const svc = new TelegramService(makeConfig({ TELEGRAM_BOT_TOKEN: 'token-abc' }));
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    const ok = await svc.sendMessage('chat-1', 'hello');
    expect(ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('api.telegram.org/bottoken-abc/sendMessage');
    expect(JSON.parse(init.body)).toMatchObject({ chat_id: 'chat-1', text: 'hello' });
  });

  it('returns false (does not throw) when the Telegram API returns an error', async () => {
    const svc = new TelegramService(makeConfig({ TELEGRAM_BOT_TOKEN: 'token-abc' }));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 400, statusText: 'Bad Request', text: async () => 'chat not found' }),
    );
    const ok = await svc.sendMessage('chat-1', 'hello');
    expect(ok).toBe(false);
  });

  it('returns false (does not throw) when the network itself fails', async () => {
    const svc = new TelegramService(makeConfig({ TELEGRAM_BOT_TOKEN: 'token-abc' }));
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    const ok = await svc.sendMessage('chat-1', 'hello');
    expect(ok).toBe(false);
  });
});

describe('SmsService (Eskiz adapter) failure handling', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is not configured with the STUB provider and reports FAILED — never mock success', async () => {
    const prisma = makePrisma();
    const svc = new SmsService(makeConfig({}), prisma);
    expect(svc.isConfigured()).toBe(false);

    const ok = await svc.sendSms('+998901234567', 'test', 'org-1');
    expect(ok).toBe(false);
    expect(prisma.sMSLog.create).toHaveBeenCalledTimes(1);
    const log = prisma.sMSLog.create.mock.calls[0][0].data;
    expect(log.status).toBe('FAILED');
    expect(log.errorMessage).toContain('not configured');
  });

  it('marks FAILED after exhausting retries when the provider keeps failing', async () => {
    vi.useFakeTimers();
    try {
      const prisma = makePrisma();
      const svc = new SmsService(
        makeConfig({ SMS_PROVIDER: 'Eskiz', SMS_API_KEY: 'k', ESKIZ_EMAIL: 'e', ESKIZ_PASSWORD: 'p' }),
        prisma,
      );
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Eskiz down')));

      const resultPromise = svc.sendSms('+998901234567', 'test', 'org-1');
      await vi.runAllTimersAsync();
      const ok = await resultPromise;

      expect(ok).toBe(false);
      // 3 attempts were made, then a FAILED log was written.
      expect(fetch).toHaveBeenCalledTimes(3);
      expect(prisma.sMSLog.create).toHaveBeenCalledTimes(1);
      expect(prisma.sMSLog.create.mock.calls[0][0].data.status).toBe('FAILED');
    } finally {
      vi.useRealTimers();
    }
  });

  it('records DELIVERED with provider externalId on success', async () => {
    const prisma = makePrisma();
    const svc = new SmsService(
      makeConfig({ SMS_PROVIDER: 'Eskiz', SMS_API_KEY: 'k', ESKIZ_EMAIL: 'e', ESKIZ_PASSWORD: 'p' }),
      prisma,
    );
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { token: 'jwt' } }) }) // auth
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'eskiz-msg-1' }) }); // send
    vi.stubGlobal('fetch', fetchMock);

    const ok = await svc.sendSms('+998 90 123 45 67', 'test', 'org-1');
    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain('notify.eskiz.uz/api/message/sms/send');
    const log = prisma.sMSLog.create.mock.calls[0][0].data;
    expect(log.status).toBe('DELIVERED');
    expect(log.externalId).toBe('eskiz-msg-1');
  });

  it('normalizes the recipient phone number for the Eskiz API', async () => {
    const prisma = makePrisma();
    const svc = new SmsService(
      makeConfig({ SMS_PROVIDER: 'Eskiz', SMS_API_KEY: 'k', ESKIZ_EMAIL: 'e', ESKIZ_PASSWORD: 'p' }),
      prisma,
    );
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { token: 'jwt' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'x' }) });
    vi.stubGlobal('fetch', fetchMock);

    await svc.sendSms('+998 90 123 45 67', 'test');
    const body = fetchMock.mock.calls[1][1].body as string;
    expect(body).toContain("\"mobile_phone\":\"998901234567\"");
  });
});
