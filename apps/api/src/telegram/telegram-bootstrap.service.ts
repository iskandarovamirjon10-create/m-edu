import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramService } from './telegram.service';
import {
  TELEGRAM_COMMANDS,
  TelegramCommandHandler,
} from './commands/command.interface';
import { TELEGRAM_LANGUAGES, TelegramLanguage, t } from './i18n/telegram-i18n';

/**
 * Bot initialization performed once the API has booted:
 *
 *   1. publishes the command menu (`setMyCommands`) so Telegram's autocomplete
 *      matches the commands the bot actually implements — descriptions are
 *      taken from the centralized i18n catalogue, one list per supported
 *      language plus an English default list;
 *   2. registers the webhook (`setWebhook`) when `TELEGRAM_WEBHOOK_URL` is
 *      configured, passing the same `TELEGRAM_WEBHOOK_SECRET` the controller
 *      verifies, so a secret rotation is applied by simply restarting.
 *
 * Both calls are idempotent and best-effort: a Telegram outage at boot must
 * never prevent the API from serving M-EDU. No secret, token or payload is
 * ever written to the logs.
 *
 * Under Vitest (and any `NODE_ENV=test` run) nothing is registered, so tests
 * and e2e boots can never reach the live Telegram API.
 */
@Injectable()
export class TelegramBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(TelegramBootstrapService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly telegram: TelegramService,
    @Inject(TELEGRAM_COMMANDS) private readonly commands: TelegramCommandHandler[],
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.isTestRun()) return;
    if (!this.telegram.isConfigured()) return;

    // Each phase is independent: a command-menu failure must not skip webhook
    // registration, and neither may ever fail the API boot.
    await this.runPhase('command_menu_sync', () => this.syncCommandMenu());
    await this.runPhase('webhook_registration', () => this.registerWebhook());
  }

  private async runPhase(event: string, phase: () => Promise<void>): Promise<void> {
    try {
      await phase();
    } catch (error: unknown) {
      // Non-fatal: the webhook route and every command still work.
      this.logger.warn(
        JSON.stringify({
          event: 'telegram_bootstrap_failed',
          phase: event,
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  /** Read through ConfigService so the guard is unit-testable and env-driven. */
  private isTestRun(): boolean {
    const vitest = this.config.get<string>('VITEST');
    const nodeEnv = this.config.get<string>('NODE_ENV');
    return Boolean(vitest) || nodeEnv === 'test';
  }

  /**
   * Only commands EVERY linked principal may run are advertised: a menu entry
   * that would be denied for some roles is worse than no entry at all.
   * `/help` remains the authoritative, role-filtered list.
   */
  private advertisedCommands(): TelegramCommandHandler[] {
    return this.commands
      .filter((command) => command.roles === 'ALL')
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  private commandList(language: TelegramLanguage) {
    return this.advertisedCommands().map((command) => ({
      command: command.name,
      description: t(language, command.descriptionKey).slice(0, 256),
    }));
  }

  private async syncCommandMenu(): Promise<void> {
    // The default list doubles as the fallback for languages without their own
    // list (including English), so it is registered without a `language_code`.
    const ok = await this.telegram.setMyCommands(this.commandList('en'));
    if (!ok) return;

    for (const language of TELEGRAM_LANGUAGES) {
      if (language === 'en') continue;
      await this.telegram.setMyCommands(this.commandList(language), language);
    }
    this.logger.log(
      JSON.stringify({
        event: 'telegram_commands_registered',
        count: this.advertisedCommands().length,
        languages: [...TELEGRAM_LANGUAGES],
      }),
    );
  }

  private async registerWebhook(): Promise<void> {
    const url = this.config.get<string>('TELEGRAM_WEBHOOK_URL')?.trim();
    if (!url) {
      // Without a registered webhook Telegram has nowhere to deliver updates:
      // every message (including /start) is silently dropped on Telegram's
      // side. Make that state loud at boot — it is the #1 cause of "bot never
      // replies" in local/dev environments.
      this.logger.warn(
        JSON.stringify({
          event: 'telegram_webhook_registration_skipped',
          reason: 'TELEGRAM_WEBHOOK_URL_not_set',
          hint: 'Set TELEGRAM_WEBHOOK_URL to the public HTTPS endpoint of /api/webhooks/telegram and restart.',
        }),
      );
      return;
    }

    const secret = this.config.get<string>('TELEGRAM_WEBHOOK_SECRET');
    if (!secret) {
      // Registering without a secret would make the controller reject every
      // update (fail closed). Refuse to register instead of half-configuring.
      this.logger.warn(
        JSON.stringify({
          event: 'telegram_webhook_registration_skipped',
          reason: 'secret_not_configured',
        }),
      );
      return;
    }

    const ok = await this.telegram.setWebhook(url, secret);
    if (!ok) {
      this.logger.warn(
        JSON.stringify({
          event: 'telegram_webhook_registration_failed',
          reason: 'telegram_rejected_or_unreachable',
        }),
      );
    }
  }
}
