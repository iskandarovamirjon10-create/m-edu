import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  InternalServerErrorException,
  Logger,
  Optional,
  PayloadTooLargeException,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { createHash, timingSafeEqual } from 'node:crypto';
import { TelegramUpdateDto } from './dto/telegram-webhook.dto';
import { TelegramLinkService } from './telegram-link.service';
import { TelegramUpdateService } from './telegram-update.service';
import { TelegramService } from './telegram.service';
import { TelegramCommandRouter } from './telegram-command.router';
import { TelegramCallbackRouter } from './telegram-callback.router';
import { TelegramUpdateDispatcherService } from './telegram-update-dispatcher.service';
import { TELEGRAM_WEBHOOK_MAX_BODY_BYTES } from './telegram.constants';
import { AllowPublic } from '../auth/public.decorator';

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
@AllowPublic()
@Controller('webhooks/telegram')
export class TelegramWebhookController {
  private readonly logger = new Logger(TelegramWebhookController.name);
  private readonly dispatcher: TelegramUpdateDispatcherService;

  constructor(
    private readonly config: ConfigService,
    private readonly updates: TelegramUpdateService,
    private readonly links: TelegramLinkService,
    private readonly telegram: TelegramService,
    private readonly commands: TelegramCommandRouter,
    private readonly callbacks: TelegramCallbackRouter,
    @Optional() dispatcher?: TelegramUpdateDispatcherService,
  ) {
    this.dispatcher =
      dispatcher ||
      new TelegramUpdateDispatcherService(
        this.updates,
        this.links,
        this.telegram,
        this.commands,
        this.callbacks,
      );
  }

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

    const updateId = this.parseUpdateId(body?.update_id);
    if (updateId === null) {
      throw new BadRequestException('Malformed Telegram update');
    }

    return this.dispatcher.dispatch(body);
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
