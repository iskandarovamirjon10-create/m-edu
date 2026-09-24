import {
  Controller,
  Post,
  Body,
  Logger,
  Headers,
  UnauthorizedException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from './telegram.service';
import { TelegramUpdateDto } from './dto/telegram-webhook.dto';
import { withPrismaRetry } from '../lib/prisma-retry.util';
import * as crypto from 'node:crypto';

@Controller('webhooks/telegram')
export class TelegramWebhookController {
  private readonly logger = new Logger(TelegramWebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  async handleWebhook(
    @Body() body: TelegramUpdateDto,
    @Headers('x-telegram-bot-api-secret-token') secretToken?: string,
  ) {
    const expectedToken = this.config.get<string>('TELEGRAM_WEBHOOK_SECRET');
    if (!expectedToken) {
      this.logger.error('CRITICAL VULNERABILITY PREVENTED: TELEGRAM_WEBHOOK_SECRET is not set in environment.');
      throw new InternalServerErrorException('Webhook configuration is incomplete');
    }

    if (expectedToken && secretToken) {
      if (
        expectedToken.length !== secretToken.length ||
        !crypto.timingSafeEqual(Buffer.from(secretToken), Buffer.from(expectedToken))
      ) {
        throw new UnauthorizedException('Invalid webhook secret token');
      }
    } else {
      throw new UnauthorizedException('Missing webhook secret token');
    }

    const message = body.message;
    const text = message?.text;
    const chatId =
      message?.chat?.id !== undefined && message?.chat?.id !== null
        ? String(message.chat.id)
        : '';

    if (!message || !text || !chatId) {
      return { status: 'ignored' };
    }

    if (text.startsWith('/start ')) {
      const token = text.split(' ')[1];

      if (!token) {
        return { status: 'ignored' };
      }

      const idempotencyKey = crypto
        .createHash('sha256')
        .update(`telegram-link:${token}:${chatId}`)
        .digest('hex');

      try {
        const result = await withPrismaRetry(async () => {
          return await this.prisma.$transaction(async (tx) => {
            // Check idempotency FIRST to prevent duplicate webhooks from failing
            // after the token has already been consumed and nulled out.
            const existing = await tx.telegramLinkLog.findUnique({
              where: { idempotencyKey },
            });

            if (existing) {
              return { 
                status: 'success', 
                alreadyLinked: true, 
                entityType: existing.entityType === 'PARENT_ACCOUNT' ? 'parent' : 'user' 
              };
            }

            const parent = await tx.parentAccount.findUnique({
              where: { telegramLinkToken: token },
            });

            if (parent) {
              if (parent.telegramLinkExpiresAt && parent.telegramLinkExpiresAt < new Date()) {
                 return { status: 'invalid_token' }; // Expired
              }

              await tx.parentAccount.update({
                where: { id: parent.id },
                data: {
                  telegramChatId: chatId,
                  telegramLinkToken: null,
                  telegramLinkExpiresAt: null,
                },
              });

              await tx.telegramLinkLog.create({
                data: {
                  idempotencyKey,
                  organizationId: parent.organizationId,
                  entityType: 'PARENT_ACCOUNT',
                  entityId: parent.id,
                  chatId,
                  linkToken: token,
                  status: 'SUCCESS',
                },
              });

              this.logger.log(`Linked Telegram chatId ${chatId} to ParentAccount ${parent.id}`);
              return { status: 'success', entityType: 'parent' };
            }

            const user = await tx.user.findUnique({
              where: { telegramLinkToken: token },
            });

            if (user) {
              if (user.telegramLinkExpiresAt && user.telegramLinkExpiresAt < new Date()) {
                 return { status: 'invalid_token' }; // Expired
              }

              await tx.user.update({
                where: { id: user.id },
                data: {
                  telegramChatId: chatId,
                  telegramLinkToken: null,
                  telegramLinkExpiresAt: null,
                },
              });

              await tx.telegramLinkLog.create({
                data: {
                  idempotencyKey,
                  organizationId: user.organizationId,
                  entityType: 'USER',
                  entityId: user.id,
                  chatId,
                  linkToken: token,
                  status: 'SUCCESS',
                },
              });

              this.logger.log(`Linked Telegram chatId ${chatId} to User ${user.id}`);
              return { status: 'success', entityType: 'user' };
            }

            return { status: 'invalid_token' };
          });
        });

        if (result.status === 'success' && result.entityType) {
          const messageText =
            result.entityType === 'parent'
              ? '✅ Your Telegram account has been successfully linked for M-EDU notifications!'
              : '✅ Your Telegram account has been successfully linked to your M-EDU portal account!';

          try {
            await this.telegram.sendMessage(chatId, messageText);
          } catch (err: unknown) {
            this.logger.warn(`Telegram send failed after DB update, but link is committed: ${err instanceof Error ? err.message : String(err)}`);
          }
        }

        if (result.status === 'invalid_token') {
          try {
            await this.telegram.sendMessage(chatId, '❌ Invalid or expired linking token.');
          } catch (err: unknown) {
            this.logger.warn(`Failed to send invalid token message: ${err instanceof Error ? err.message : String(err)}`);
          }
        }

        return result;
      } catch (err: unknown) {
        const prismaCode = (err as { code?: string })?.code;
        if (prismaCode === 'P2002') {
          throw new ConflictException('Telegram link was processed concurrently — please retry');
        }
        this.logger.error('Telegram webhook processing failed', err instanceof Error ? err.stack : String(err));
        throw new InternalServerErrorException('Webhook processing failed');
      }
    }

    return { status: 'ignored' };
  }
}
