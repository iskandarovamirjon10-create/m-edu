import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import {
  UnauthorizedException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramWebhookController } from '../telegram-webhook.controller';
import { TelegramService } from '../telegram.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramUpdateDto } from '../dto/telegram-webhook.dto';
import * as crypto from 'node:crypto';

vi.mock('../../lib/prisma-retry.util', () => ({
  withPrismaRetry: vi.fn(async <T>(fn: () => Promise<T>): Promise<T> => fn()),
}));

describe('TelegramWebhookController', () => {
  let controller: TelegramWebhookController;
  let configService: { get: ReturnType<typeof vi.fn> };
  let telegramService: { sendMessage: ReturnType<typeof vi.fn> };
  let prismaService: { $transaction: ReturnType<typeof vi.fn> };

  let txMock: {
    parentAccount: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    user: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    telegramLinkLog: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
  };

  const WEBHOOK_SECRET = 'secret-telegram-webhook-token-123';
  const CHAT_ID = '987654321';
  const LINK_TOKEN = 'valid-link-token-xyz';

  const computeIdempotencyKey = (token: string, chatId: string): string => {
    return crypto
      .createHash('sha256')
      .update(`telegram-link:${token}:${chatId}`)
      .digest('hex');
  };

  const createUpdateDto = (text?: string, chatId: string | number = CHAT_ID): TelegramUpdateDto => {
    return {
      update_id: 10001,
      message: {
        text,
        chat: { id: chatId },
      },
    };
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    txMock = {
      parentAccount: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      telegramLinkLog: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
    };

    prismaService = {
      $transaction: vi.fn(async (cb: (tx: typeof txMock) => Promise<unknown>) => cb(txMock)),
    };

    telegramService = {
      sendMessage: vi.fn().mockResolvedValue(true),
    };

    configService = {
      get: vi.fn((key: string) => {
        if (key === 'TELEGRAM_WEBHOOK_SECRET') {
          return WEBHOOK_SECRET;
        }
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TelegramWebhookController],
      providers: [
        { provide: PrismaService, useValue: prismaService },
        { provide: TelegramService, useValue: telegramService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    controller = module.get<TelegramWebhookController>(TelegramWebhookController);
  });

  it('should be defined with all injected dependencies', () => {
    expect(controller).toBeDefined();
    expect(configService).toBeDefined();
    expect(telegramService).toBeDefined();
    expect(prismaService).toBeDefined();
  });

  describe('Security & Webhook Secret Token Verification', () => {
    it('throws UnauthorizedException when expected secret is set but header is missing', async () => {
      const body = createUpdateDto('/start ' + LINK_TOKEN);

      await expect(controller.handleWebhook(body)).rejects.toThrow(
        new UnauthorizedException('Missing webhook secret token'),
      );
      expect(configService.get).toHaveBeenCalledWith('TELEGRAM_WEBHOOK_SECRET');
      expect(prismaService.$transaction).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when provided secret token does not match', async () => {
      const body = createUpdateDto('/start ' + LINK_TOKEN);

      await expect(
        controller.handleWebhook(body, 'wrong-secret-token'),
      ).rejects.toThrow(new UnauthorizedException('Invalid webhook secret token'));
      expect(configService.get).toHaveBeenCalledWith('TELEGRAM_WEBHOOK_SECRET');
      expect(prismaService.$transaction).not.toHaveBeenCalled();
    });

    it('proceeds successfully when secret token matches configured TELEGRAM_WEBHOOK_SECRET', async () => {
      const body = createUpdateDto('/start ' + LINK_TOKEN);
      txMock.parentAccount.findUnique.mockResolvedValue({
        id: 'parent-1',
        organizationId: 'org-1',
      });
      txMock.telegramLinkLog.findUnique.mockResolvedValue(null);

      const result = await controller.handleWebhook(body, WEBHOOK_SECRET);

      expect(configService.get).toHaveBeenCalledWith('TELEGRAM_WEBHOOK_SECRET');
      expect(result).toEqual({ status: 'success', entityType: 'parent' });
    });

    it('fails closed (500) when TELEGRAM_WEBHOOK_SECRET is not configured', async () => {
      configService.get.mockReturnValue(undefined);
      const body = createUpdateDto('/start ' + LINK_TOKEN);

      await expect(controller.handleWebhook(body, undefined)).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(configService.get).toHaveBeenCalledWith('TELEGRAM_WEBHOOK_SECRET');
      expect(prismaService.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('Payload Filtering & Unhandled Updates', () => {
    it('returns { status: "ignored" } when update has no message object', async () => {
      const body: TelegramUpdateDto = { update_id: 1 };

      const result = await controller.handleWebhook(body, WEBHOOK_SECRET);

      expect(result).toEqual({ status: 'ignored' });
      expect(prismaService.$transaction).not.toHaveBeenCalled();
    });

    it('returns { status: "ignored" } when message has no text', async () => {
      const body: TelegramUpdateDto = {
        update_id: 1,
        message: {
          chat: { id: CHAT_ID },
        },
      };

      const result = await controller.handleWebhook(body, WEBHOOK_SECRET);

      expect(result).toEqual({ status: 'ignored' });
      expect(prismaService.$transaction).not.toHaveBeenCalled();
    });

    it('returns { status: "ignored" } when message has no chat id', async () => {
      const body: TelegramUpdateDto = {
        update_id: 1,
        message: {
          text: '/start ' + LINK_TOKEN,
          chat: {},
        },
      };

      const result = await controller.handleWebhook(body, WEBHOOK_SECRET);

      expect(result).toEqual({ status: 'ignored' });
      expect(prismaService.$transaction).not.toHaveBeenCalled();
    });

    it('returns { status: "ignored" } when text is not a command starting with /start ', async () => {
      const body = createUpdateDto('Hello bot');

      const result = await controller.handleWebhook(body, WEBHOOK_SECRET);

      expect(result).toEqual({ status: 'ignored' });
      expect(prismaService.$transaction).not.toHaveBeenCalled();
    });

    it('returns { status: "ignored" } when text is /start without a token', async () => {
      const body = createUpdateDto('/start');

      const result = await controller.handleWebhook(body, WEBHOOK_SECRET);

      expect(result).toEqual({ status: 'ignored' });
      expect(prismaService.$transaction).not.toHaveBeenCalled();
    });

    it('returns { status: "ignored" } when text is /start followed only by trailing whitespace', async () => {
      const body = createUpdateDto('/start ');

      const result = await controller.handleWebhook(body, WEBHOOK_SECRET);

      expect(result).toEqual({ status: 'ignored' });
      expect(prismaService.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('Parent Account Linking', () => {
    const parentMock = {
      id: 'parent-uuid-1',
      organizationId: 'org-uuid-1',
      telegramLinkToken: LINK_TOKEN,
    };

    it('successfully links a parent account and sends a Telegram confirmation message', async () => {
      const body = createUpdateDto('/start ' + LINK_TOKEN, CHAT_ID);
      const expectedKey = computeIdempotencyKey(LINK_TOKEN, CHAT_ID);

      txMock.parentAccount.findUnique.mockResolvedValue(parentMock);
      txMock.telegramLinkLog.findUnique.mockResolvedValue(null);

      const result = await controller.handleWebhook(body, WEBHOOK_SECRET);

      expect(prismaService.$transaction).toHaveBeenCalledTimes(1);
      expect(txMock.parentAccount.findUnique).toHaveBeenCalledWith({
        where: { telegramLinkToken: LINK_TOKEN },
      });
      expect(txMock.telegramLinkLog.findUnique).toHaveBeenCalledWith({
        where: { idempotencyKey: expectedKey },
      });
      expect(txMock.parentAccount.update).toHaveBeenCalledWith({
        where: { id: parentMock.id },
        data: {
          telegramChatId: CHAT_ID,
          telegramLinkToken: null,
          telegramLinkExpiresAt: null,
        },
      });
      expect(txMock.telegramLinkLog.create).toHaveBeenCalledWith({
        data: {
          idempotencyKey: expectedKey,
          organizationId: parentMock.organizationId,
          entityType: 'PARENT_ACCOUNT',
          entityId: parentMock.id,
          chatId: CHAT_ID,
          linkToken: LINK_TOKEN,
          status: 'SUCCESS',
        },
      });
      expect(telegramService.sendMessage).toHaveBeenCalledWith(
        CHAT_ID,
        '✅ Your Telegram account has been successfully linked for M-EDU notifications!',
      );
      expect(result).toEqual({ status: 'success', entityType: 'parent' });
    });

    it('handles parent account linking idempotently when already linked', async () => {
      const body = createUpdateDto('/start ' + LINK_TOKEN, CHAT_ID);
      const expectedKey = computeIdempotencyKey(LINK_TOKEN, CHAT_ID);

      txMock.parentAccount.findUnique.mockResolvedValue(parentMock);
      txMock.telegramLinkLog.findUnique.mockResolvedValue({
        id: 'log-1',
        idempotencyKey: expectedKey,
        entityType: 'PARENT_ACCOUNT',
      });

      const result = await controller.handleWebhook(body, WEBHOOK_SECRET);

      // Idempotency is checked before any lookup, so an already-processed
      // update returns early without re-reading the account.
      expect(txMock.telegramLinkLog.findUnique).toHaveBeenCalledWith({
        where: { idempotencyKey: expectedKey },
      });
      expect(txMock.parentAccount.findUnique).not.toHaveBeenCalled();
      expect(txMock.parentAccount.update).not.toHaveBeenCalled();
      expect(txMock.telegramLinkLog.create).not.toHaveBeenCalled();
      expect(telegramService.sendMessage).toHaveBeenCalledWith(
        CHAT_ID,
        '✅ Your Telegram account has been successfully linked for M-EDU notifications!',
      );
      expect(result).toEqual({
        status: 'success',
        alreadyLinked: true,
        entityType: 'parent',
      });
    });

    it('correctly handles numeric chat id by converting it to string', async () => {
      const numericChatId = 123456789;
      const expectedChatIdStr = '123456789';
      const body = createUpdateDto('/start ' + LINK_TOKEN, numericChatId);

      txMock.parentAccount.findUnique.mockResolvedValue(parentMock);
      txMock.telegramLinkLog.findUnique.mockResolvedValue(null);

      const result = await controller.handleWebhook(body, WEBHOOK_SECRET);

      expect(txMock.parentAccount.update).toHaveBeenCalledWith({
        where: { id: parentMock.id },
        data: {
          telegramChatId: expectedChatIdStr,
          telegramLinkToken: null,
          telegramLinkExpiresAt: null,
        },
      });
      expect(telegramService.sendMessage).toHaveBeenCalledWith(
        expectedChatIdStr,
        '✅ Your Telegram account has been successfully linked for M-EDU notifications!',
      );
      expect(result).toEqual({ status: 'success', entityType: 'parent' });
    });
  });

  describe('User Account Linking', () => {
    const userMock = {
      id: 'user-uuid-1',
      organizationId: 'org-uuid-1',
      telegramLinkToken: LINK_TOKEN,
    };

    it('successfully links a user account when parent account is not found', async () => {
      const body = createUpdateDto('/start ' + LINK_TOKEN, CHAT_ID);
      const expectedKey = computeIdempotencyKey(LINK_TOKEN, CHAT_ID);

      txMock.parentAccount.findUnique.mockResolvedValue(null);
      txMock.user.findUnique.mockResolvedValue(userMock);
      txMock.telegramLinkLog.findUnique.mockResolvedValue(null);

      const result = await controller.handleWebhook(body, WEBHOOK_SECRET);

      expect(txMock.parentAccount.findUnique).toHaveBeenCalledWith({
        where: { telegramLinkToken: LINK_TOKEN },
      });
      expect(txMock.user.findUnique).toHaveBeenCalledWith({
        where: { telegramLinkToken: LINK_TOKEN },
      });
      expect(txMock.telegramLinkLog.findUnique).toHaveBeenCalledWith({
        where: { idempotencyKey: expectedKey },
      });
      expect(txMock.user.update).toHaveBeenCalledWith({
        where: { id: userMock.id },
        data: {
          telegramChatId: CHAT_ID,
          telegramLinkToken: null,
          telegramLinkExpiresAt: null,
        },
      });
      expect(txMock.telegramLinkLog.create).toHaveBeenCalledWith({
        data: {
          idempotencyKey: expectedKey,
          organizationId: userMock.organizationId,
          entityType: 'USER',
          entityId: userMock.id,
          chatId: CHAT_ID,
          linkToken: LINK_TOKEN,
          status: 'SUCCESS',
        },
      });
      expect(telegramService.sendMessage).toHaveBeenCalledWith(
        CHAT_ID,
        '✅ Your Telegram account has been successfully linked to your M-EDU portal account!',
      );
      expect(result).toEqual({ status: 'success', entityType: 'user' });
    });

    it('handles user account linking idempotently when already linked', async () => {
      const body = createUpdateDto('/start ' + LINK_TOKEN, CHAT_ID);
      const expectedKey = computeIdempotencyKey(LINK_TOKEN, CHAT_ID);

      txMock.parentAccount.findUnique.mockResolvedValue(null);
      txMock.user.findUnique.mockResolvedValue(userMock);
      txMock.telegramLinkLog.findUnique.mockResolvedValue({
        id: 'log-2',
        idempotencyKey: expectedKey,
      });

      const result = await controller.handleWebhook(body, WEBHOOK_SECRET);

      expect(txMock.user.update).not.toHaveBeenCalled();
      expect(txMock.telegramLinkLog.create).not.toHaveBeenCalled();
      expect(telegramService.sendMessage).toHaveBeenCalledWith(
        CHAT_ID,
        '✅ Your Telegram account has been successfully linked to your M-EDU portal account!',
      );
      expect(result).toEqual({
        status: 'success',
        alreadyLinked: true,
        entityType: 'user',
      });
    });
  });

  describe('Invalid or Expired Token', () => {
    it('sends failure notification and returns { status: "invalid_token" } when token does not match parent or user', async () => {
      const body = createUpdateDto('/start invalid-token-123', CHAT_ID);

      txMock.parentAccount.findUnique.mockResolvedValue(null);
      txMock.user.findUnique.mockResolvedValue(null);

      const result = await controller.handleWebhook(body, WEBHOOK_SECRET);

      expect(txMock.parentAccount.findUnique).toHaveBeenCalledWith({
        where: { telegramLinkToken: 'invalid-token-123' },
      });
      expect(txMock.user.findUnique).toHaveBeenCalledWith({
        where: { telegramLinkToken: 'invalid-token-123' },
      });
      expect(telegramService.sendMessage).toHaveBeenCalledWith(
        CHAT_ID,
        '❌ Invalid or expired linking token.',
      );
      expect(result).toEqual({ status: 'invalid_token' });
    });
  });

  describe('Resilience Against Telegram Notification Errors', () => {
    it('does not fail the webhook request if telegramService.sendMessage throws after successful parent link', async () => {
      const body = createUpdateDto('/start ' + LINK_TOKEN, CHAT_ID);
      txMock.parentAccount.findUnique.mockResolvedValue({
        id: 'parent-1',
        organizationId: 'org-1',
      });
      txMock.telegramLinkLog.findUnique.mockResolvedValue(null);
      telegramService.sendMessage.mockRejectedValue(new Error('Telegram API rate limit'));

      const result = await controller.handleWebhook(body, WEBHOOK_SECRET);

      expect(result).toEqual({ status: 'success', entityType: 'parent' });
    });

    it('does not fail the webhook request if telegramService.sendMessage throws after invalid token notification', async () => {
      const body = createUpdateDto('/start invalid-token', CHAT_ID);
      txMock.parentAccount.findUnique.mockResolvedValue(null);
      txMock.user.findUnique.mockResolvedValue(null);
      telegramService.sendMessage.mockRejectedValue(new Error('Network error'));

      const result = await controller.handleWebhook(body, WEBHOOK_SECRET);

      expect(result).toEqual({ status: 'invalid_token' });
    });
  });

  describe('Database Error Handling & Concurrency', () => {
    it('translates Prisma P2002 unique constraint failure to ConflictException', async () => {
      const body = createUpdateDto('/start ' + LINK_TOKEN, CHAT_ID);
      const p2002Error = Object.assign(new Error('Unique constraint failed'), {
        code: 'P2002',
      });

      txMock.parentAccount.findUnique.mockRejectedValue(p2002Error);

      await expect(
        controller.handleWebhook(body, WEBHOOK_SECRET),
      ).rejects.toThrow(
        new ConflictException('Telegram link was processed concurrently — please retry'),
      );
    });

    it('translates unexpected database failures to InternalServerErrorException', async () => {
      const body = createUpdateDto('/start ' + LINK_TOKEN, CHAT_ID);

      txMock.parentAccount.findUnique.mockRejectedValue(
        new Error('Database connection failure'),
      );

      await expect(
        controller.handleWebhook(body, WEBHOOK_SECRET),
      ).rejects.toThrow(new InternalServerErrorException('Webhook processing failed'));
    });
  });

  describe('Guards & Decorators Verification', () => {
    it('is registered as a controller for path "webhooks/telegram"', () => {
      const path = Reflect.getMetadata('path', TelegramWebhookController);
      expect(path).toBe('webhooks/telegram');
    });

    it('has handleWebhook registered as a POST route handler', () => {
      const method = Reflect.getMetadata('method', TelegramWebhookController.prototype.handleWebhook);
      // NestJS RequestMethod.POST is 1
      expect(method).toBe(1);
    });

    it('does not have UseGuards applied at the class level (public webhook endpoint)', () => {
      const guards = Reflect.getMetadata('__guards__', TelegramWebhookController);
      expect(guards).toBeUndefined();
    });

    it('does not have UseGuards applied at the method level (public webhook endpoint)', () => {
      const guards = Reflect.getMetadata('__guards__', TelegramWebhookController.prototype.handleWebhook);
      expect(guards).toBeUndefined();
    });

    it('does not have Roles decorator applied (public webhook endpoint)', () => {
      const roles = Reflect.getMetadata('roles', TelegramWebhookController);
      expect(roles).toBeUndefined();
    });
  });
});
