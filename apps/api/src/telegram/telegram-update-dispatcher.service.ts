import { Injectable, Logger } from '@nestjs/common';
import { TelegramUpdateDto } from './dto/telegram-webhook.dto';
import { TelegramLinkService, StartLinkResult } from './telegram-link.service';
import { TelegramUpdateService } from './telegram-update.service';
import { TelegramService } from './telegram.service';
import {
  TelegramCommandRouter,
  TelegramHandlingResult,
} from './telegram-command.router';
import { TelegramCallbackRouter } from './telegram-callback.router';
import { resolveLanguage, t } from './i18n/telegram-i18n';
import {
  TELEGRAM_LINK_MESSAGE_KEYS,
  TELEGRAM_START_COMMAND,
} from './telegram.constants';

@Injectable()
export class TelegramUpdateDispatcherService {
  private readonly logger = new Logger(TelegramUpdateDispatcherService.name);

  constructor(
    private readonly updates: TelegramUpdateService,
    private readonly links: TelegramLinkService,
    private readonly telegram: TelegramService,
    private readonly commands: TelegramCommandRouter,
    private readonly callbacks: TelegramCallbackRouter,
  ) {}

  /**
   * Dispatches any incoming Telegram update (whether received via Webhook or Long-Polling).
   * Ensures deduplication, deep-link authentication, inline callbacks, and command routing.
   */
  async dispatch(body: TelegramUpdateDto): Promise<{ status: string; duplicate?: boolean }> {
    const updateId = this.parseUpdateId(body?.update_id);
    if (updateId === null) {
      return { status: 'malformed' };
    }

    const firstDelivery = await this.updates.claim(updateId);
    if (!firstDelivery) {
      return { status: 'duplicate', duplicate: true };
    }

    try {
      const callbackStatus = await this.handleCallbackQuery(body);
      if (callbackStatus) return callbackStatus;

      return await this.handleMessage(body);
    } catch (err: unknown) {
      this.logger.error(
        JSON.stringify({
          event: 'telegram_update_dispatch_error',
          updateId: updateId.toString(),
          message: err instanceof Error ? err.message : String(err),
        }),
      );
      return { status: 'error' };
    }
  }

  private parseUpdateId(value?: number): bigint | null {
    if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
      return null;
    }
    return BigInt(value);
  }

  /** Inline-keyboard presses. */
  private async handleCallbackQuery(
    body: TelegramUpdateDto,
  ): Promise<{ status: string } | null> {
    const callback = body.callback_query;
    if (!callback) return null;

    const data = callback.data;
    const chatId = this.resolveCallbackChatId(body);
    if (!data || !chatId) return { status: 'ignored' };

    const result = await this.callbacks.handle({
      chatId,
      data,
      telegramLanguageCode: callback.from?.language_code ?? null,
    });

    await this.deliver(chatId, result, callback.id);
    return { status: 'callback' };
  }

  private resolveCallbackChatId(body: TelegramUpdateDto): string | null {
    const callback = body.callback_query;
    if (!callback) return null;
    const chatId = callback.message?.chat?.id;
    if (chatId !== undefined && chatId !== null) return String(chatId);
    // Private chats: the sender id equals the chat id.
    const fromId = callback.from?.id;
    if (fromId !== undefined && fromId !== null) return String(fromId);
    return null;
  }

  /** Text messages: the `/start <token>` link flow, then the command router. */
  private async handleMessage(body: TelegramUpdateDto): Promise<{ status: string }> {
    const message = body.message;
    const text = message?.text?.trim();
    const chatId = message?.chat?.id != null ? String(message.chat.id) : null;

    if (!message || !text || !chatId) {
      return { status: 'ignored' };
    }

    const telegramLanguageCode = message.from?.language_code ?? null;

    // Deep-link linking runs BEFORE context resolution: by definition the chat
    // is not linked yet.
    if (text.startsWith(`${TELEGRAM_START_COMMAND} `)) {
      const token = text.slice(TELEGRAM_START_COMMAND.length).trim();
      const telegramUserId =
        message.from?.id != null ? String(message.from.id) : chatId;

      const result = await this.links.consumeStart({
        token,
        telegramUserId,
        chatId,
        username: message.from?.username ?? null,
        firstName: message.from?.first_name ?? null,
        lastName: message.from?.last_name ?? null,
        languageCode: telegramLanguageCode,
      });

      await this.telegram.sendMessage(
        chatId,
        t(resolveLanguage(null, null, telegramLanguageCode), this.linkMessageKey(result)),
      );
      return { status: result.status };
    }

    const result = await this.commands.route({
      chatId,
      text,
      telegramLanguageCode,
    });
    if (!result.reply) return { status: 'ignored' };

    await this.deliver(chatId, result, undefined);
    return { status: 'command' };
  }

  /** Send a reply (if any) and acknowledge the callback (if any). */
  private async deliver(
    chatId: string,
    result: TelegramHandlingResult,
    callbackQueryId: string | undefined,
  ): Promise<void> {
    if (result.reply) {
      await this.telegram.sendMessageWithMarkup(
        chatId,
        result.reply.text,
        result.reply.keyboard,
      );
    }
    if (callbackQueryId) {
      await this.telegram.answerCallbackQuery(callbackQueryId, result.toast);
    }
  }

  private linkMessageKey(result: StartLinkResult): string {
    switch (result.status) {
      case 'LINKED':
        return TELEGRAM_LINK_MESSAGE_KEYS.LINKED;
      case 'IDENTITY_CONFLICT':
        return TELEGRAM_LINK_MESSAGE_KEYS.IDENTITY_CONFLICT;
      case 'RATE_LIMITED':
        return TELEGRAM_LINK_MESSAGE_KEYS.RATE_LIMITED;
      case 'INVALID_TOKEN':
      default:
        return TELEGRAM_LINK_MESSAGE_KEYS.INVALID_TOKEN;
    }
  }
}
