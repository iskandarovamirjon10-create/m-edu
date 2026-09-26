import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BadRequestException,
  InternalServerErrorException,
  PayloadTooLargeException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramWebhookController } from '../telegram-webhook.controller';
import { TelegramLinkService } from '../telegram-link.service';
import { TelegramUpdateService } from '../telegram-update.service';
import { TelegramService } from '../telegram.service';
import { TelegramCommandRouter } from '../telegram-command.router';
import { TelegramCallbackRouter } from '../telegram-callback.router';
import { TelegramUpdateDto } from '../dto/telegram-webhook.dto';
import { resolveLanguage, t } from '../i18n/telegram-i18n';

const WEBHOOK_SECRET = 's'.repeat(40);
const CHAT_ID = 9001;
const en = resolveLanguage(null, null, 'en');

describe('TelegramWebhookController', () => {
  let controller: TelegramWebhookController;
  let config: { get: ReturnType<typeof vi.fn> };
  let updates: { claim: ReturnType<typeof vi.fn> };
  let links: { consumeStart: ReturnType<typeof vi.fn> };
  let telegram: {
    sendMessage: ReturnType<typeof vi.fn>;
    sendMessageWithMarkup: ReturnType<typeof vi.fn>;
    answerCallbackQuery: ReturnType<typeof vi.fn>;
  };
  let commands: { route: ReturnType<typeof vi.fn> };
  let callbacksRouter: { handle: ReturnType<typeof vi.fn> };

  const messageUpdate = (text?: string, updateId = 10001): TelegramUpdateDto => ({
    update_id: updateId,
    message: {
      text,
      chat: { id: CHAT_ID },
      from: { id: CHAT_ID, language_code: 'en' },
    },
  });

  const callbackUpdate = (data: string, updateId = 20001): TelegramUpdateDto => ({
    update_id: updateId,
    callback_query: {
      id: 'cb-1',
      data,
      from: { id: CHAT_ID, language_code: 'en' },
      message: { chat: { id: CHAT_ID } },
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    config = { get: vi.fn().mockReturnValue(WEBHOOK_SECRET) };
    updates = { claim: vi.fn().mockResolvedValue(true) };
    links = {
      consumeStart: vi.fn().mockResolvedValue({
        status: 'LINKED',
        entityType: 'USER',
        organizationId: 'org-1',
        alreadyLinked: false,
      }),
    };
    telegram = {
      sendMessage: vi.fn().mockResolvedValue(true),
      sendMessageWithMarkup: vi.fn().mockResolvedValue(true),
      answerCallbackQuery: vi.fn().mockResolvedValue(undefined),
    };
    commands = { route: vi.fn().mockResolvedValue({ reply: null }) };
    callbacksRouter = { handle: vi.fn().mockResolvedValue({ reply: null }) };

    controller = new TelegramWebhookController(
      config as unknown as ConfigService,
      updates as unknown as TelegramUpdateService,
      links as unknown as TelegramLinkService,
      telegram as unknown as TelegramService,
      commands as unknown as TelegramCommandRouter,
      callbacksRouter as unknown as TelegramCallbackRouter,
    );
  });

  describe('webhook secret authentication', () => {
    it('fails closed with 500 when the secret is not configured', async () => {
      config.get.mockReturnValue(undefined);
      await expect(controller.handleWebhook(messageUpdate('/menu'), undefined)).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(updates.claim).not.toHaveBeenCalled();
    });

    it('rejects a missing secret token', async () => {
      await expect(controller.handleWebhook(messageUpdate('/menu'), undefined)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(commands.route).not.toHaveBeenCalled();
    });

    it('rejects a wrong secret token', async () => {
      await expect(controller.handleWebhook(messageUpdate('/menu'), 'nope')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('accepts a correct secret', async () => {
      const result = await controller.handleWebhook(messageUpdate('/menu'), WEBHOOK_SECRET);
      expect(result).toEqual({ status: 'ignored' });
      expect(commands.route).toHaveBeenCalled();
    });
  });

  describe('payload hardening', () => {
    it('rejects a payload without update_id', async () => {
      await expect(controller.handleWebhook({}, WEBHOOK_SECRET)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects an oversized body', async () => {
      await expect(
        controller.handleWebhook(messageUpdate('/menu'), WEBHOOK_SECRET, String(10 * 1024 * 1024)),
      ).rejects.toThrow(PayloadTooLargeException);
    });

    it('ignores updates with no usable message', async () => {
      const result = await controller.handleWebhook({ update_id: 5 }, WEBHOOK_SECRET);
      expect(result).toEqual({ status: 'ignored' });
      expect(commands.route).not.toHaveBeenCalled();
    });
  });

  describe('update idempotency', () => {
    it('processes a first delivery', async () => {
      await controller.handleWebhook(messageUpdate('/menu'), WEBHOOK_SECRET);
      expect(updates.claim).toHaveBeenCalledWith(10001n);
      expect(commands.route).toHaveBeenCalledTimes(1);
    });

    it('acknowledges a duplicate without side effects', async () => {
      updates.claim.mockResolvedValue(false);
      const result = await controller.handleWebhook(messageUpdate('/menu'), WEBHOOK_SECRET);
      expect(result).toEqual({ status: 'duplicate', duplicate: true });
      expect(commands.route).not.toHaveBeenCalled();
      expect(callbacksRouter.handle).not.toHaveBeenCalled();
    });
  });

  describe('/start deep-link flow', () => {
    it('links and replies in the localized catalogue phrasing', async () => {
      const token = 'a'.repeat(64);
      const result = await controller.handleWebhook(
        messageUpdate(`/start ${token}`),
        WEBHOOK_SECRET,
      );

      expect(links.consumeStart).toHaveBeenCalledWith(
        expect.objectContaining({ token, chatId: '9001', telegramUserId: '9001' }),
      );
      expect(telegram.sendMessage).toHaveBeenCalledWith('9001', t(en, 'start.linked'));
      expect(result).toEqual({ status: 'LINKED' });
    });

    it('routes a bare /start to the command router (does not link)', async () => {
      await controller.handleWebhook(messageUpdate('/start'), WEBHOOK_SECRET);
      expect(links.consumeStart).not.toHaveBeenCalled();
      expect(commands.route).toHaveBeenCalledWith(
        expect.objectContaining({ text: '/start', chatId: '9001' }),
      );
    });

    it('reports an invalid token without leaking detail', async () => {
      links.consumeStart.mockResolvedValue({ status: 'INVALID_TOKEN' });
      await controller.handleWebhook(messageUpdate(`/start ${'b'.repeat(64)}`), WEBHOOK_SECRET);
      expect(telegram.sendMessage).toHaveBeenCalledWith('9001', t(en, 'start.invalidToken'));
    });

    it('reports an identity conflict', async () => {
      links.consumeStart.mockResolvedValue({ status: 'IDENTITY_CONFLICT' });
      await controller.handleWebhook(messageUpdate(`/start ${'b'.repeat(64)}`), WEBHOOK_SECRET);
      expect(telegram.sendMessage).toHaveBeenCalledWith('9001', t(en, 'start.conflict'));
    });
  });

  describe('command routing', () => {
    it('sends the router reply with its keyboard', async () => {
      commands.route.mockResolvedValue({
        reply: { text: 'menu text', keyboard: { inline_keyboard: [] } },
      });
      const result = await controller.handleWebhook(messageUpdate('/menu'), WEBHOOK_SECRET);

      expect(telegram.sendMessageWithMarkup).toHaveBeenCalledWith('9001', 'menu text', {
        inline_keyboard: [],
      });
      expect(result).toEqual({ status: 'command' });
    });

    it('ignores non-command text', async () => {
      const result = await controller.handleWebhook(messageUpdate('hello'), WEBHOOK_SECRET);
      expect(result).toEqual({ status: 'ignored' });
      expect(telegram.sendMessageWithMarkup).not.toHaveBeenCalled();
    });
  });

  describe('callback routing', () => {
    it('dispatches button presses to the callback router and answers the query', async () => {
      callbacksRouter.handle.mockResolvedValue({
        reply: { text: 'child menu' },
        toast: 'ok',
      });

      const result = await controller.handleWebhook(callbackUpdate('cs~1'), WEBHOOK_SECRET);

      expect(callbacksRouter.handle).toHaveBeenCalledWith(
        expect.objectContaining({ chatId: '9001', data: 'cs~1' }),
      );
      expect(telegram.sendMessageWithMarkup).toHaveBeenCalledWith('9001', 'child menu', undefined);
      expect(telegram.answerCallbackQuery).toHaveBeenCalledWith('cb-1', 'ok');
      expect(result).toEqual({ status: 'callback' });
    });

    it('falls back to the sender id when the callback carries no chat', async () => {
      await controller.handleWebhook(
        {
          update_id: 3,
          callback_query: { id: 'cb', data: 'mm', from: { id: 42 } },
        },
        WEBHOOK_SECRET,
      );
      expect(callbacksRouter.handle).toHaveBeenCalledWith(
        expect.objectContaining({ chatId: '42', data: 'mm' }),
      );
    });

    it('ignores a callback with no data', async () => {
      const result = await controller.handleWebhook(
        { update_id: 4, callback_query: { id: 'cb', from: { id: 42 } } },
        WEBHOOK_SECRET,
      );
      expect(result).toEqual({ status: 'ignored' });
      expect(callbacksRouter.handle).not.toHaveBeenCalled();
    });
  });

  describe('error containment', () => {
    it('never throws after an update is claimed', async () => {
      commands.route.mockRejectedValue(new Error('prisma exploded'));
      const result = await controller.handleWebhook(messageUpdate('/menu'), WEBHOOK_SECRET);
      expect(result).toEqual({ status: 'error' });
    });

    it('contains callback router failures too', async () => {
      callbacksRouter.handle.mockRejectedValue(new Error('redis down'));
      const result = await controller.handleWebhook(callbackUpdate('mm'), WEBHOOK_SECRET);
      expect(result).toEqual({ status: 'error' });
    });
  });

  describe('routing metadata', () => {
    it('is a public POST controller at webhooks/telegram', () => {
      expect(Reflect.getMetadata('path', TelegramWebhookController)).toBe('webhooks/telegram');
      expect(Reflect.getMetadata('method', TelegramWebhookController.prototype.handleWebhook)).toBe(1);
      expect(Reflect.getMetadata('__guards__', TelegramWebhookController)).toBeUndefined();
    });
  });
});
