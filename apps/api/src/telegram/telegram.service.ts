import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InlineKeyboardMarkup } from './ui/telegram-ui.types';

/**
 * Outcome of a Telegram Bot API `sendMessage` call, classified for the caller.
 *
 * `retryable` distinguishes transient transport failures (timeout, 5xx, 429)
 * from permanent ones (blocked user, invalid chat) so the notification
 * pipeline does not hammer Telegram forever on a permanently-undeliverable
 * chat. The notification worker keeps its existing boolean contract; this
 * richer result is available to new callers.
 */
export interface TelegramSendResult {
  ok: boolean;
  errorCategory?:
    | 'NETWORK_ERROR'
    | 'TIMEOUT'
    | 'RATE_LIMITED'
    | 'TELEGRAM_SERVER_ERROR'
    | 'BLOCKED_USER'
    | 'INVALID_CHAT'
    | 'UNAUTHORIZED'
    | 'NOT_CONFIGURED'
    | 'PERMANENT';
  retryable: boolean;
}

/** Bot API request timeout — a hung Telegram call must not hang an API request. */
const TELEGRAM_API_TIMEOUT_MS = 10_000;

/**
 * Telegram Bot API provider adapter.
 *
 * This is the ONLY place that talks to the Telegram HTTP API. Business
 * services never call Telegram directly; they either call this adapter or, for
 * domain notifications, emit an event onto the notification queue (see
 * notifications/events). That keeps Telegram swappable and keeps domain logic
 * channel-agnostic.
 *
 * The bot token is read from configuration only. It is never logged, never
 * embedded in a response and never persisted.
 */
@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly botToken: string;
  private readonly isEnabled: boolean;

  constructor(private readonly configService: ConfigService) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN') || '';

    // TELEGRAM_ENABLED is a kill switch, not an opt-in: only the literal
    // string 'false' disables the integration. This keeps a configured token
    // working for existing deployments while still letting an operator shut
    // Telegram off during an incident. (An undefined value must not silently
    // disable delivery that is otherwise configured.)
    const disabledByFlag = this.configService.get<string>('TELEGRAM_ENABLED') === 'false';
    this.isEnabled = !!this.botToken && !disabledByFlag;

    if (disabledByFlag) {
      this.logger.warn('TELEGRAM_ENABLED=false — Telegram delivery is disabled by configuration.');
    } else if (!this.isEnabled) {
      this.logger.warn(
        'TELEGRAM_BOT_TOKEN is not configured. Telegram notifications will be disabled.',
      );
    }
  }

  isConfigured(): boolean {
    return this.isEnabled;
  }

  /**
   * Bot `@username` without the leading `@`, used to build `t.me` deep links.
   * Returns null when it is not configured (deep links then cannot be built).
   */
  getBotUsername(): string | null {
    const raw = this.configService.get<string>('TELEGRAM_BOT_USERNAME')?.trim();
    if (!raw) return null;
    return raw.startsWith('@') ? raw.slice(1) : raw;
  }

  /**
   * Send a message to a chat.
   *
   * Never throws: transport failures are logged (without the message body) and
   * reported as a classified result. Keeping this non-throwing preserves the
   * contract the notification worker relies on — a Telegram outage must never
   * fail the business transaction that produced the notification.
   */
  async sendMessage(chatId: string, text: string): Promise<boolean> {
    const result = await this.sendMessageDetailed(chatId, text);
    return result.ok;
  }

  /**
   * Send with an optional inline keyboard. Same non-throwing contract.
   */
  async sendMessageWithMarkup(
    chatId: string,
    text: string,
    replyMarkup?: InlineKeyboardMarkup,
  ): Promise<boolean> {
    const result = await this.sendMessageDetailed(chatId, text, { replyMarkup });
    return result.ok;
  }

  /**
   * Acknowledge a callback query so Telegram stops showing the loading state.
   * Best-effort: failure is logged and ignored (the reply itself still lands).
   */
  async answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
    if (!this.isEnabled) return;
    try {
      await fetch(`https://api.telegram.org/bot${this.botToken}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
        signal: AbortSignal.timeout(TELEGRAM_API_TIMEOUT_MS),
      });
    } catch (error: unknown) {
      this.logger.warn(
        JSON.stringify({
          event: 'telegram_answer_callback_failed',
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  async sendMessageDetailed(
    chatId: string,
    text: string,
    options?: { replyMarkup?: InlineKeyboardMarkup },
  ): Promise<TelegramSendResult> {
    if (!this.isEnabled) {
      this.logger.warn('Telegram is disabled. Message not sent.');
      return { ok: false, errorCategory: 'NOT_CONFIGURED', retryable: false };
    }

    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
          ...(options?.replyMarkup ? { reply_markup: options.replyMarkup } : {}),
        }),
        signal: AbortSignal.timeout(TELEGRAM_API_TIMEOUT_MS),
      });

      if (response.ok) return { ok: true, retryable: false };

      // Telegram returns a JSON body with `description`; we classify by HTTP
      // status and never echo the raw body into logs verbatim (it can contain
      // the chat id and message text).
      const status = response.status;
      if (status === 429) {
        return { ok: false, errorCategory: 'RATE_LIMITED', retryable: true };
      }
      if (status === 403) {
        // "bot was blocked by the user" / "user is deactivated".
        return { ok: false, errorCategory: 'BLOCKED_USER', retryable: false };
      }
      if (status === 400) {
        return { ok: false, errorCategory: 'INVALID_CHAT', retryable: false };
      }
      if (status === 401) {
        return { ok: false, errorCategory: 'UNAUTHORIZED', retryable: false };
      }
      if (status >= 500) {
        return { ok: false, errorCategory: 'TELEGRAM_SERVER_ERROR', retryable: true };
      }

      this.logger.error(
        JSON.stringify({ event: 'telegram_send_failed', status, endpoint: 'sendMessage' }),
      );
      return { ok: false, errorCategory: 'PERMANENT', retryable: false };
    } catch (error: unknown) {
      const isTimeout =
        error instanceof Error &&
        (error.name === 'TimeoutError' || error.name === 'AbortError');
      this.logger.error(
        JSON.stringify({
          event: 'telegram_send_error',
          endpoint: 'sendMessage',
          errorCategory: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : String(error),
        }),
      );
      return {
        ok: false,
        errorCategory: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
        retryable: true,
      };
    }
  }
}
