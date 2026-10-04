import { describe, it, expect, vi } from 'vitest';
import { TelegramBootstrapService } from '../telegram-bootstrap.service';
import { TelegramService } from '../telegram.service';
import { ConfigService } from '@nestjs/config';
import { TELEGRAM_LANGUAGES, t } from '../i18n/telegram-i18n';
import type { TelegramCommandHandler } from '../commands/command.interface';

/**
 * Bot initialization at boot: command menu publication and webhook
 * registration. The properties that matter here are that nothing is ever
 * registered while tests run, that only universally runnable commands are
 * advertised, and that the webhook secret is passed through so the
 * controller's fail-closed check can actually succeed.
 */

const WEBHOOK_URL = 'https://api.example.com/api/webhooks/telegram';
const WEBHOOK_SECRET = 'test-webhook-secret-0123456789abcdef';

function stubHandler(
  name: string,
  roles: readonly string[] | 'ALL' = 'ALL',
  descriptionKey?: string,
): TelegramCommandHandler {
  return {
    name,
    roles,
    descriptionKey: descriptionKey ?? `${name}.desc`,
    handle: vi.fn(async () => ({ text: 'ok' })),
  } as TelegramCommandHandler;
}

function makeService(
  options: {
    env?: Record<string, string | undefined>;
    configured?: boolean;
    commands?: TelegramCommandHandler[];
  } = {},
) {
  const telegram = {
    isConfigured: vi.fn(() => options.configured ?? true),
    setMyCommands: vi.fn(
      async (
        _commands: Array<{ command: string; description: string }>,
        _languageCode?: string,
      ): Promise<boolean> => true,
    ),
    setWebhook: vi.fn(async (_url: string, _secret?: string): Promise<boolean> => true),
  };
  const config = {
    get: (key: string) => options.env?.[key],
  } as unknown as ConfigService;
  const commands = options.commands ?? [
    stubHandler('start'),
    stubHandler('help'),
    stubHandler('settings'),
    // Role-restricted: must never be advertised to everyone.
    stubHandler('payments', ['ORG_ADMIN', 'STUDENT']),
    stubHandler('students', ['ORG_ADMIN']),
  ];
  const service = new TelegramBootstrapService(
    config,
    telegram as unknown as TelegramService,
    commands,
  );
  return { service, telegram };
}

/** Environment of a real API process (no test flags). */
const RUN_ENV = { NODE_ENV: 'development' };

describe('TelegramBootstrapService — never runs during tests', () => {
  it('registers nothing under Vitest', async () => {
    const { service, telegram } = makeService({ env: { VITEST: 'true', NODE_ENV: 'test' } });
    await service.onModuleInit();
    expect(telegram.setMyCommands).not.toHaveBeenCalled();
    expect(telegram.setWebhook).not.toHaveBeenCalled();
  });

  it('registers nothing when NODE_ENV is test even without the Vitest flag', async () => {
    const { service, telegram } = makeService({ env: { NODE_ENV: 'test' } });
    await service.onModuleInit();
    expect(telegram.setMyCommands).not.toHaveBeenCalled();
    expect(telegram.setWebhook).not.toHaveBeenCalled();
  });

  it('registers nothing when the bot is not configured (no token / disabled)', async () => {
    const { service, telegram } = makeService({ env: RUN_ENV, configured: false });
    await service.onModuleInit();
    expect(telegram.setMyCommands).not.toHaveBeenCalled();
    expect(telegram.setWebhook).not.toHaveBeenCalled();
  });
});

describe('TelegramBootstrapService — command menu', () => {
  it('publishes an English default list containing only universally runnable commands', async () => {
    const { service, telegram } = makeService({ env: RUN_ENV });
    await service.onModuleInit();

    expect(telegram.setMyCommands).toHaveBeenCalled();
    const [commands, languageCode] = telegram.setMyCommands.mock.calls[0];
    expect(languageCode).toBeUndefined();
    // Sorted by name, roles === 'ALL' only.
    expect(commands.map((c) => c.command)).toEqual(['help', 'settings', 'start']);
    expect(commands[0]).toEqual({ command: 'help', description: 'help.desc' });
  });

  it('never advertises a role-restricted command', async () => {
    const { service, telegram } = makeService({ env: RUN_ENV });
    await service.onModuleInit();

    const names = telegram.setMyCommands.mock.calls.flatMap((call) =>
      call[0].map((entry) => entry.command),
    );
    expect(names).not.toContain('payments');
    expect(names).not.toContain('students');
  });

  it('registers localized lists for ru and uz, and no separate en list', async () => {
    const { service, telegram } = makeService({ env: RUN_ENV });
    await service.onModuleInit();

    const languageCodes = telegram.setMyCommands.mock.calls
      .slice(1)
      .map((call) => call[1]);
    // TELEGRAM_LANGUAGES is ['uz', 'ru', 'en'] — the default list covers en.
    expect(languageCodes).toEqual(['uz', 'ru']);
    expect(languageCodes).not.toContain('en');
    expect(TELEGRAM_LANGUAGES).toEqual(['uz', 'ru', 'en']);
  });

  it('uses the centralized catalogue for the descriptions of shipped commands', async () => {
    const { service, telegram } = makeService({
      env: RUN_ENV,
      commands: [
        stubHandler('copilot', 'ALL', 'copilot.description'),
        stubHandler('unlink', 'ALL', 'unlink.title'),
        stubHandler('language', 'ALL', 'language.title'),
        stubHandler('menu', 'ALL', 'menu.title'),
      ],
    });
    await service.onModuleInit();

    const [commands] = telegram.setMyCommands.mock.calls[0];
    const byName = Object.fromEntries(commands.map((c) => [c.command, c.description]));
    expect(byName.copilot).toBe(t('en', 'copilot.description'));
    expect(byName.menu).toBe(t('en', 'menu.title'));

    for (const language of TELEGRAM_LANGUAGES) {
      expect(t(language, 'copilot.description')).toBeTruthy();
      expect(t(language, 'unlink.title')).toBeTruthy();
      expect(t(language, 'language.title')).toBeTruthy();
    }
  });
});

describe('TelegramBootstrapService — webhook registration', () => {
  it('registers the webhook with the configured URL and secret', async () => {
    const { service, telegram } = makeService({
      env: {
        ...RUN_ENV,
        TELEGRAM_WEBHOOK_URL: WEBHOOK_URL,
        TELEGRAM_WEBHOOK_SECRET: WEBHOOK_SECRET,
      },
    });
    await service.onModuleInit();

    expect(telegram.setWebhook).toHaveBeenCalledWith(WEBHOOK_URL, WEBHOOK_SECRET);
  });

  it('does not call Telegram when no webhook URL is configured', async () => {
    const { service, telegram } = makeService({ env: RUN_ENV });
    await service.onModuleInit();
    expect(telegram.setWebhook).not.toHaveBeenCalled();
  });

  it('refuses to register a webhook without a secret (the controller would reject every update)', async () => {
    const { service, telegram } = makeService({
      env: { ...RUN_ENV, TELEGRAM_WEBHOOK_URL: WEBHOOK_URL },
    });
    await service.onModuleInit();
    expect(telegram.setWebhook).not.toHaveBeenCalled();
  });

  it('treats a blank URL as unconfigured', async () => {
    const { service, telegram } = makeService({
      env: { ...RUN_ENV, TELEGRAM_WEBHOOK_URL: '   ', TELEGRAM_WEBHOOK_SECRET: WEBHOOK_SECRET },
    });
    await service.onModuleInit();
    expect(telegram.setWebhook).not.toHaveBeenCalled();
  });
});

describe('TelegramBootstrapService — resilience', () => {
  const webhookEnv = {
    ...RUN_ENV,
    TELEGRAM_WEBHOOK_URL: WEBHOOK_URL,
    TELEGRAM_WEBHOOK_SECRET: WEBHOOK_SECRET,
  };

  it('never lets a Telegram failure break the API boot', async () => {
    const { service, telegram } = makeService({ env: webhookEnv });
    telegram.setMyCommands.mockImplementationOnce(async () => {
      throw new Error('telegram down');
    });
    await expect(service.onModuleInit()).resolves.toBeUndefined();
  });

  it('still registers the webhook when the command menu call fails', async () => {
    const { service, telegram } = makeService({ env: webhookEnv });
    telegram.setMyCommands.mockImplementationOnce(async () => {
      throw new Error('boom');
    });
    await service.onModuleInit();
    expect(telegram.setWebhook).toHaveBeenCalledWith(WEBHOOK_URL, WEBHOOK_SECRET);
  });

  it('reports a rejected registration without throwing', async () => {
    const { service, telegram } = makeService({ env: webhookEnv });
    telegram.setWebhook.mockResolvedValueOnce(false);
    await expect(service.onModuleInit()).resolves.toBeUndefined();
  });
});
