import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  InternalServerErrorException,
  Logger,
  PayloadTooLargeException,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { createHash, timingSafeEqual } from 'node:crypto';
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
  TELEGRAM_WEBHOOK_MAX_BODY_BYTES,
} from './telegram.constants';

/** Header Telegram sends when the webhook was registered with a secret_token. */
const SECRET_HEADER = 'x-telegram-bot-api-secret-token';

/**
 * Telegram webhook endpoint (POST /api/webhooks/telegram).
 *
 * Transport + hardening only; all behaviour lives in the routers:
 *   - secret token verified in constant time (fail closed when unset),
 *   - oversized bodies rejected,
 *   - `update_id` deduplicated in the database (works across instances),
 *   - messages dispatched to the command router, button presses to the
 *     callback router,
 *   - no internal error, stack trace or identifier is ever returned.
 */
@Controller('webhooks/telegram')
export class TelegramWebhookController {
  private readonly logger = new Logger(TelegramWebhookController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly updates: TelegramUpdateService,
    private readonly links: TelegramLinkService,
    private readonly telegram: TelegramService,
    private readonly commands: TelegramCommandRouter,
    private readonly callbacks: TelegramCallbackRouter,
  ) {}

  @Post()
  @HttpCode(200)
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  async handleWebhook(
    @Body() body: TelegramUpdateDto,
    @Headers(SECRET_HEADER) secretToken?: string,
    @Headers('content-length') contentLength?: string,
  ): Promise<{ status: string; duplicate?: boolean }> {
    this.assertWebhookSecret(secretToken);
    this.assertBodySize(contentLength);

    const updateId = this.parseUpdateId(body.update_id);
    if (updateId === null) {
      throw new BadRequestException('Malformed Telegram update');
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
      // The update is already claimed, so a Telegram retry would be dropped as
      // a duplicate anyway. Log the real cause internally, acknowledge with a
      // generic status.
      this.logger.error(
        JSON.stringify({
          event: 'telegram_webhook_processing_error',
          updateId: updateId.toString(),
          message: err instanceof Error ? err.message : String(err),
        }),
      );
      return { status: 'error' };
    }
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

  /**
   * Constant-time secret comparison.
   *
   * Both sides are SHA-256 hashed first so their lengths match, allowing an
   * unconditional `timingSafeEqual` (a raw compare would have to branch on
   * length first, leaking the secret's length).
   */
  private assertWebhookSecret(secretToken?: string): void {
    const expected = this.config.get<string>('TELEGRAM_WEBHOOK_SECRET');
    if (!expected) {
      this.logger.error(
        JSON.stringify({ event: 'telegram_webhook_rejected', reason: 'secret_not_configured' }),
      );
      throw new InternalServerErrorException('Webhook configuration is incomplete');
    }

    if (!secretToken) {
      this.logger.warn(
        JSON.stringify({ event: 'telegram_webhook_rejected', reason: 'missing_secret' }),
      );
      throw new UnauthorizedException('Missing webhook secret token');
    }

    const provided = createHash('sha256').update(secretToken).digest();
    const expectedDigest = createHash('sha256').update(expected).digest();
    if (!timingSafeEqual(provided, expectedDigest)) {
      this.logger.warn(
        JSON.stringify({ event: 'telegram_webhook_rejected', reason: 'invalid_secret' }),
      );
      throw new UnauthorizedException('Invalid webhook secret token');
    }
  }

  private assertBodySize(contentLength?: string): void {
    if (!contentLength) return;
    const size = Number(contentLength);
    if (Number.isFinite(size) && size > TELEGRAM_WEBHOOK_MAX_BODY_BYTES) {
      this.logger.warn(
        JSON.stringify({ event: 'telegram_webhook_rejected', reason: 'oversized' }),
      );
      throw new PayloadTooLargeException();
    }
  }

  private parseUpdateId(value?: number): bigint | null {
    if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
      return null;
    }
    return BigInt(value);
  }
}
