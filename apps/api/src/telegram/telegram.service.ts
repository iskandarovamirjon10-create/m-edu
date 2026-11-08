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

/** Public Telegram Bot API host, used when no override is configured. */
const DEFAULT_TELEGRAM_API_BASE_URL = 'https://api.telegram.org';

/** One entry of the bot's command menu (`setMyCommands`). */
/** Basic bot profile returned by getMe */
export interface TelegramBotInfo {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
  can_join_groups?: boolean;
  can_read_all_group_messages?: boolean;
  supports_inline_queries?: boolean;
}

/** Current webhook configuration returned by getWebhookInfo */
export interface TelegramWebhookInfo {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  ip_address?: string;
  last_error_date?: number;
  last_error_message?: string;
  last_synchronization_error_date?: number;
  max_connections?: number;
  allowed_updates?: string[];
}

export interface TelegramBotCommand {
  command: string;
  description: string;
}

/**
 * Resolve the Bot API host.
 *
 * Accepts an override for self-hosted Bot API servers / egress proxies
 * (`TELEGRAM_API_BASE_URL`). Anything that is not an absolute http(s) URL is
 * rejected in favour of the public API — a malformed value must not silently
 * send the bot token to an unintended host.
 */
export function resolveTelegramApiBaseUrl(raw?: string | null): string {
  const value = (raw ?? '').trim().replace(/\/+$/, '');
  if (!value) return DEFAULT_TELEGRAM_API_BASE_URL;
  if (!/^https?:\/\/[^\s]+$/i.test(value)) return DEFAULT_TELEGRAM_API_BASE_URL;
  return value;
}


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
  private readonly apiBaseUrl: string;
  private readonly isEnabled: boolean;
  private readonly isMock: boolean;

  constructor(private readonly configService?: ConfigService) {
    this.botToken = this.configService?.get<string>('TELEGRAM_BOT_TOKEN') || '';

    const configuredBaseUrl = this.configService?.get<string>('TELEGRAM_API_BASE_URL');
    this.apiBaseUrl = resolveTelegramApiBaseUrl(configuredBaseUrl);
    if (configuredBaseUrl && this.apiBaseUrl === DEFAULT_TELEGRAM_API_BASE_URL && configuredBaseUrl.trim() !== DEFAULT_TELEGRAM_API_BASE_URL) {
      this.logger.warn(
        'TELEGRAM_API_BASE_URL is not a valid http(s) URL — using the public Telegram Bot API instead.',
      );
    }

    const disabledByFlag = this.configService?.get<string>('TELEGRAM_ENABLED') === 'false';
    const nodeEnv = this.configService?.get<string>('NODE_ENV') || process.env.NODE_ENV;
    // DEV MOCK only in a real development shell. `NODE_ENV=test` must never
    // silently turn a missing token into a "working" integration — specs assert
    // that an unconfigured bot fails honestly instead of faking success.
    const isDev = nodeEnv !== 'production' && nodeEnv !== 'test';
    this.isMock = this.configService?.get<string>('TELEGRAM_MOCK') === 'true' || (isDev && (!this.botToken || this.botToken.startsWith('mock')));

    this.isEnabled = (!!this.botToken || this.isMock) && !disabledByFlag;

    if (disabledByFlag) {
      this.logger.warn('TELEGRAM_ENABLED=false — Telegram delivery is disabled by configuration.');
    } else if (this.isMock) {
      this.logger.log('TelegramService initialized in DEV MOCK mode (simulated delivery active).');
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
    const raw = this.configService?.get<string>('TELEGRAM_BOT_USERNAME')?.trim();
    if (raw) return raw.startsWith('@') ? raw.slice(1) : raw;
    if (this.isMock) return 'medu_education_bot';
    return null;
  }

  /**
   * Absolute URL for a Bot API method.
   *
   * The only place the token is ever placed into a URL, and it is never logged
   * from here — every caller logs the method name and status only.
   */
  private endpoint(method: string): string {
    return `${this.apiBaseUrl}/bot${this.botToken}/${method}`;
  }

  /**
   * POST a JSON payload to a Bot API method.
   *
   * Shared by the low-volume control-plane calls below (webhook registration,
   * command menu sync). Never throws, never logs the URL or the payload —
   * both can contain the bot token or the webhook secret.
   */
  private async callControlMethod(
    method: string,
    payload: Record<string, unknown>,
  ): Promise<boolean> {
    if (!this.isEnabled) return false;
    if (this.isMock || this.botToken.startsWith('mock')) {
      this.logger.log(`[TelegramService DEV MOCK] ${method} skipped (simulated mode).`);
      return true;
    }
    try {
      const response = await fetch(this.endpoint(method), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(TELEGRAM_API_TIMEOUT_MS),
      });
      if (!response.ok) {
        this.logger.warn(
          JSON.stringify({ event: 'telegram_control_call_failed', method, status: response.status }),
        );
        return false;
      }
      return true;
    } catch (error: unknown) {
      this.logger.warn(
        JSON.stringify({
          event: 'telegram_control_call_error',
          method,
          message: error instanceof Error ? error.message : String(error),
        }),
      );
      return false;
    }
  }

  /**
   * Register (or re-register) the webhook endpoint with Telegram.
   *
   * Idempotent: Telegram replaces the existing webhook on success, so calling
   * this at every boot keeps the endpoint and its `secret_token` in sync after
   * a secret rotation. `secretToken` becomes the value the webhook controller
   * verifies in constant time.
   */
  async setWebhook(url: string, secretToken?: string): Promise<boolean> {
    const target = url.trim();
    if (!/^https:\/\/[^\s]+$/i.test(target)) {
      this.logger.warn(
        JSON.stringify({ event: 'telegram_webhook_registration_skipped', reason: 'not_https' }),
      );
      return false;
    }
    const ok = await this.callControlMethod('setWebhook', {
      url: target,
      secret_token: secretToken,
      drop_pending_updates: false,
      allowed_updates: ['message', 'callback_query'],
    });
    if (ok) {
      this.logger.log(JSON.stringify({ event: 'telegram_webhook_registered', url: target }));
    }
    return ok;
  }

    /**
   * Delete the registered webhook so Telegram allows getUpdates (Long-Polling).
   */
  async deleteWebhook(dropPendingUpdates = false): Promise<boolean> {
    if (!this.isEnabled) return false;
    const ok = await this.callControlMethod('deleteWebhook', {
      drop_pending_updates: dropPendingUpdates,
    });
    if (ok) {
      this.logger.log(JSON.stringify({ event: 'telegram_webhook_deleted', dropPendingUpdates }));
    }
    return ok;
  }

  /**
   * Generic Bot API caller with JSON response decoding.
   */
  async callApiMethod<T = unknown>(
    method: string,
    payload?: Record<string, unknown>,
    timeoutMs = TELEGRAM_API_TIMEOUT_MS,
  ): Promise<{ ok: boolean; result?: T; description?: string }> {
    if (!this.isEnabled) {
      return { ok: false, description: 'Telegram is not configured' };
    }
    if (this.isMock || this.botToken.startsWith('mock')) {
      if (method === 'getMe') {
        return {
          ok: true,
          result: {
            id: 987654321,
            is_bot: true,
            first_name: 'M-EDU Smart Assistant',
            username: this.getBotUsername() || 'medu_education_bot',
            can_join_groups: true,
            can_read_all_group_messages: false,
            supports_inline_queries: false,
          } as unknown as T,
        };
      }
      if (method === 'getWebhookInfo') {
        return {
          ok: true,
          result: {
            url: '',
            has_custom_certificate: false,
            pending_update_count: 0,
          } as unknown as T,
        };
      }
      if (method === 'getUpdates') {
        return { ok: true, result: [] as unknown as T };
      }
      return { ok: true, result: {} as T };
    }

    try {
      const response = await fetch(this.endpoint(method), {
        method: payload ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json' },
        ...(payload ? { body: JSON.stringify(payload) } : {}),
        signal: AbortSignal.timeout(timeoutMs),
      });

      const data = (await response.json()) as { ok: boolean; result?: T; description?: string };
      return data;
    } catch (error: unknown) {
      this.logger.warn(
        JSON.stringify({
          event: 'telegram_api_call_error',
          method,
          message: error instanceof Error ? error.message : String(error),
        }),
      );
      return { ok: false, description: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Fetch bot profile info from Telegram (getMe).
   */
  async getMe(): Promise<TelegramBotInfo | null> {
    const res = await this.callApiMethod<TelegramBotInfo>('getMe');
    return res.ok && res.result ? res.result : null;
  }

  /**
   * Fetch current webhook status from Telegram (getWebhookInfo).
   */
  async getWebhookInfo(): Promise<TelegramWebhookInfo | null> {
    const res = await this.callApiMethod<TelegramWebhookInfo>('getWebhookInfo');
    return res.ok && res.result ? res.result : null;
  }

  /**
   * Fetch pending updates from Telegram via Long-Polling (getUpdates).
   */
  async getUpdates(
    offset?: number,
    limit = 100,
    timeoutSec = 20,
  ): Promise<any[]> {
    const payload: Record<string, unknown> = {
      limit,
      timeout: timeoutSec,
      allowed_updates: ['message', 'callback_query'],
    };
    if (typeof offset === 'number') {
      payload.offset = offset;
    }
    const fetchTimeoutMs = (timeoutSec + 5) * 1000;
    const res = await this.callApiMethod<any[]>('getUpdates', payload, fetchTimeoutMs);
    return res.ok && Array.isArray(res.result) ? res.result : [];
  }

/**
   * Publish the bot's command menu (Telegram's command autocomplete).
   *
   * `languageCode` is an ISO 639-1 code; omit it to (re)register the DEFAULT
   * list, which Telegram falls back to for languages without their own list.
   * Descriptions come from the centralized i18n catalogue, so uz/ru/en clients
   * see localized text. Failures are non-fatal: `/help` renders the same list
   * from the registry regardless of what Telegram has cached.
   */
  async setMyCommands(
    commands: TelegramBotCommand[],
    languageCode?: string,
  ): Promise<boolean> {
    if (commands.length === 0) return false;
    return this.callControlMethod('setMyCommands', {
      commands,
      scope: { type: 'default' },
      ...(languageCode ? { language_code: languageCode } : {}),
    });
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
      await fetch(this.endpoint('answerCallbackQuery'), {
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

    if (this.isMock || this.botToken.startsWith('mock')) {
      this.logger.log(`[TelegramService DEV MOCK] Delivered message to chat ${chatId}: ${text.slice(0, 100)}...`);
      return { ok: true, retryable: false };
    }

    try {
      const url = this.endpoint('sendMessage');
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
        try {
          const fallbackResp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text,
              ...(options?.replyMarkup ? { reply_markup: options.replyMarkup } : {}),
            }),
            signal: AbortSignal.timeout(TELEGRAM_API_TIMEOUT_MS),
          });
          if (fallbackResp.ok) return { ok: true, retryable: false };
        } catch {}
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

  /**
   * Send a photo (by URL or file_id) with an optional HTML caption and inline keyboard.
   */
  async sendPhoto(
    chatId: string,
    photoUrl: string,
    caption?: string,
    options?: { replyMarkup?: InlineKeyboardMarkup },
  ): Promise<boolean> {
    const result = await this.sendPhotoDetailed(chatId, photoUrl, caption, options);
    return result.ok;
  }

  async sendPhotoDetailed(
    chatId: string,
    photoUrl: string,
    caption?: string,
    options?: { replyMarkup?: InlineKeyboardMarkup },
  ): Promise<TelegramSendResult> {
    if (!this.isEnabled) {
      this.logger.warn('Telegram is disabled. Photo not sent.');
      return { ok: false, errorCategory: 'NOT_CONFIGURED', retryable: false };
    }

    if (this.isMock || this.botToken.startsWith('mock')) {
      this.logger.log(`[TelegramService DEV MOCK] Delivered photo to chat ${chatId}: ${photoUrl}`);
      return { ok: true, retryable: false };
    }

    try {
      const url = this.endpoint('sendPhoto');
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          photo: photoUrl,
          caption: caption || undefined,
          parse_mode: 'HTML',
          ...(options?.replyMarkup ? { reply_markup: options.replyMarkup } : {}),
        }),
        signal: AbortSignal.timeout(TELEGRAM_API_TIMEOUT_MS),
      });

      if (response.ok) return { ok: true, retryable: false };

      const status = response.status;
      if (status === 429) {
        return { ok: false, errorCategory: 'RATE_LIMITED', retryable: true };
      }
      if (status === 403) {
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
        JSON.stringify({ event: 'telegram_send_photo_failed', status, endpoint: 'sendPhoto' }),
      );
      return { ok: false, errorCategory: 'PERMANENT', retryable: false };
    } catch (error: unknown) {
      const isTimeout =
        error instanceof Error &&
        (error.name === 'TimeoutError' || error.name === 'AbortError');
      this.logger.error(
        JSON.stringify({
          event: 'telegram_send_photo_error',
          endpoint: 'sendPhoto',
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
