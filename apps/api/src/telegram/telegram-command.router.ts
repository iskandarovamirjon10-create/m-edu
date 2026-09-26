import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  TELEGRAM_COMMANDS,
  TelegramCommandHandler,
  canRun,
} from './commands/command.interface';
import {
  TelegramContext,
  TelegramContextError,
  TelegramContextService,
} from './telegram-context.service';
import { TelegramCallbackService } from './telegram-callback.service';
import { TelegramAttemptLimiter } from './telegram-attempt-limiter.service';
import { TelegramReply } from './ui/telegram-ui.types';
import { buildRequest, errorKeyForContextFailure } from './commands/command-helpers';
import { TelegramLanguage, resolveLanguage, t } from './i18n/telegram-i18n';
import {
  TELEGRAM_COMMAND_MAX_PER_WINDOW,
  TELEGRAM_COMMAND_WINDOW_SECONDS,
  TELEGRAM_MAX_MESSAGE_LENGTH,
} from './telegram.constants';
import { TelegramUserError } from './telegram-errors';

export interface TelegramHandlingResult {
  reply: TelegramReply | null;
  /** Text shown as a transient toast/alert by the client. */
  toast?: string;
}

export interface TelegramRoutingInput {
  chatId: string;
  text: string;
  telegramLanguageCode?: string | null;
}

interface ParsedCommand {
  name: string;
  args: string;
}

/** Commands that render a paginatable list and may be targeted by a PAGE callback. */
export const PAGINATED_COMMANDS = [
  'schedule',
  'attendance',
  'payments',
  'students',
  'teachers',
  'groups',
  'notifications',
] as const;

/**
 * Modular Telegram command router.
 *
 * There is no central switch: handlers are registered through the
 * `TELEGRAM_COMMANDS` provider token and dispatched by name. Adding a command
 * is a new provider, not an edit to this file.
 *
 * Ordering matters and is deliberate:
 *   1. rate limit (before any work),
 *   2. resolve the authenticated context (identity is never taken from text),
 *   3. role check,
 *   4. execute,
 *   5. contain every failure as a localized, non-leaking message.
 */
@Injectable()
export class TelegramCommandRouter {
  private readonly logger = new Logger(TelegramCommandRouter.name);
  private readonly byName = new Map<string, TelegramCommandHandler>();
  private readonly byChildAction = new Map<string, TelegramCommandHandler>();

  constructor(
    @Inject(TELEGRAM_COMMANDS) commands: TelegramCommandHandler[],
    private readonly contextService: TelegramContextService,
    private readonly callbacks: TelegramCallbackService,
    private readonly limiter: TelegramAttemptLimiter,
  ) {
    for (const command of commands) {
      this.byName.set(command.name, command);
      if (command.childActionCode && typeof command.renderForChild === 'function') {
        this.byChildAction.set(command.childActionCode, command);
      }
    }
  }

  /** Handler for a child-action callback code, when one is registered. */
  childCommand(code: string): TelegramCommandHandler | undefined {
    return this.byChildAction.get(code);
  }

  handler(name: string): TelegramCommandHandler | undefined {
    return this.byName.get(name);
  }

  /** Route a text message. Returns `{ reply: null }` for non-commands. */
  async route(input: TelegramRoutingInput): Promise<TelegramHandlingResult> {
    const parsed = this.parse(input.text);
    if (!parsed) return { reply: null };

    const scope = `cmd:${input.chatId}`;
    if (await this.limiter.isBlocked(scope, TELEGRAM_COMMAND_MAX_PER_WINDOW)) {
      this.logger.warn(
        JSON.stringify({ event: 'telegram_command_rate_limited', chatId: input.chatId }),
      );
      const language = resolveLanguage(null, null, input.telegramLanguageCode);
      return { reply: { text: t(language, 'error.rateLimited') } };
    }
    await this.limiter.hit(scope, TELEGRAM_COMMAND_WINDOW_SECONDS);

    return this.executeCommand(parsed.name, input.chatId, {
      args: parsed.args,
      page: 1,
      telegramLanguageCode: input.telegramLanguageCode,
    });
  }

  /**
   * Execute a named command.
   *
   * `options.ctx` lets a caller that already resolved the context (the
   * callback router) reuse it instead of resolving twice; authorization is
   * still re-evaluated here on every call.
   */
  async executeCommand(
    name: string,
    chatId: string,
    options?: {
      ctx?: TelegramContext;
      args?: string;
      page?: number;
      telegramLanguageCode?: string | null;
    },
  ): Promise<TelegramHandlingResult> {
    const fallbackLanguage = resolveLanguage(null, null, options?.telegramLanguageCode);

    let ctx = options?.ctx;
    if (!ctx) {
      try {
        ctx = await this.contextService.resolve(chatId);
      } catch (err: unknown) {
        return this.replyForContextError(err, fallbackLanguage, chatId);
      }
    }

    const language = ctx.language;
    const handler = this.byName.get(name);
    if (!handler) {
      return { reply: { text: t(language, 'error.unsupported') } };
    }

    if (!canRun(handler, ctx.role)) {
      // Denials are observable: an attempt to reach a command outside one's
      // role is a security signal, not a normal path.
      this.logger.warn(
        JSON.stringify({
          event: 'telegram_command_denied',
          chatId,
          command: name,
          role: ctx.role,
          organizationId: ctx.organizationId,
        }),
      );
      return { reply: { text: t(language, 'error.unauthorized') } };
    }

    const request = buildRequest({
      chatId,
      ctx,
      callbacks: this.callbacks,
      args: (options?.args ?? '').slice(0, TELEGRAM_MAX_MESSAGE_LENGTH),
      page: options?.page ?? 1,
      language,
    });

    try {
      return { reply: await handler.handle(request) };
    } catch (err: unknown) {
      return { reply: this.internalErrorReply(err, language, { chatId, command: name }) };
    }
  }

  /** Parse `/name@bot args` into `{ name, args }`; null when not a command. */
  private parse(text: string): ParsedCommand | null {
    const trimmed = (text ?? '').trim();
    if (!trimmed.startsWith('/')) return null;

    const [rawToken, ...rest] = trimmed.split(/\s+/);
    const name = rawToken.slice(1).split('@')[0].toLowerCase();
    if (!/^[a-z0-9_]{1,32}$/.test(name)) return null;

    return { name, args: rest.join(' ').slice(0, TELEGRAM_MAX_MESSAGE_LENGTH) };
  }

  private replyForContextError(
    err: unknown,
    language: TelegramLanguage,
    chatId: string,
  ): TelegramHandlingResult {
    if (err instanceof TelegramContextError) {
      const key = errorKeyForContextFailure(err.code);
      const hint = err.code === 'NOT_LINKED' ? `\n${t(language, 'error.notLinkedHint')}` : '';
      this.logger.log(
        JSON.stringify({ event: 'telegram_command_rejected', chatId, reason: err.code }),
      );
      return { reply: { text: `${t(language, key)}${hint}` } };
    }
    return { reply: this.internalErrorReply(err, language, { chatId, command: 'context' }) };
  }

  private internalErrorReply(
    err: unknown,
    language: TelegramLanguage,
    fields: Record<string, unknown>,
  ): TelegramReply {
    if (err instanceof TelegramUserError) {
      return { text: t(language, err.messageKey) };
    }
    // Internal failures are logged with detail and never echoed to Telegram.
    this.logger.error(
      JSON.stringify({
        event: 'telegram_command_error',
        ...fields,
        message: err instanceof Error ? err.message : String(err),
      }),
    );
    return { text: t(language, 'error.generic') };
  }
}
