import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';
import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { TelegramLinkService } from '../telegram-link.service';
import { TelegramService } from '../telegram.service';
import { TelegramAttemptLimiter } from '../telegram-attempt-limiter.service';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TELEGRAM_LINK_TTL_MS } from '../telegram.constants';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/** In-house mock of the Prisma surface the service touches. */
function makePrismaMock() {
  const mock = {
    user: { findFirst: vi.fn(), update: vi.fn() },
    parentAccount: { findFirst: vi.fn(), update: vi.fn() },
    telegramAccount: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    telegramLinkToken: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    telegramLinkLog: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  // Transactions share the same mock object, so `tx.*` === `prisma.*`.
  mock.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(mock));
  return mock;
}

type PrismaMock = ReturnType<typeof makePrismaMock>;

describe('TelegramLinkService', () => {
  let prisma: PrismaMock;
  let audit: { record: ReturnType<typeof vi.fn> };
  let telegram: { getBotUsername: ReturnType<typeof vi.fn>; sendMessage: ReturnType<typeof vi.fn> };
  let limiter: {
    isBlocked: ReturnType<typeof vi.fn>;
    registerFailure: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
  };
  let service: TelegramLinkService;

  const USER_PRINCIPAL = { sub: 'user-1', organizationId: 'org-1', role: 'STUDENT' };
  const PARENT_PRINCIPAL = { sub: 'parent-1', organizationId: 'org-1', role: 'PARENT' };

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = makePrismaMock();
    audit = { record: vi.fn().mockResolvedValue({}) };
    telegram = {
      getBotUsername: vi.fn().mockReturnValue('medu_bot'),
      sendMessage: vi.fn().mockResolvedValue(true),
    };
    limiter = {
      isBlocked: vi.fn().mockResolvedValue(false),
      registerFailure: vi.fn().mockResolvedValue(1),
      clear: vi.fn().mockResolvedValue(undefined),
    };
    service = new TelegramLinkService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
      telegram as unknown as TelegramService,
      limiter as unknown as TelegramAttemptLimiter,
    );
  });

  describe('createLinkToken', () => {
    beforeEach(() => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      prisma.telegramLinkToken.create.mockResolvedValue({});
      prisma.telegramLinkToken.deleteMany.mockResolvedValue({ count: 0 });
    });

    it('issues a 256-bit opaque token and only ever stores its hash', async () => {
      const result = await service.createLinkToken(USER_PRINCIPAL);

      expect(result.token).toMatch(/^[a-f0-9]{64}$/);
      expect(result.deepLink).toBe(`https://t.me/medu_bot?start=${result.token}`);

      const createArgs = prisma.telegramLinkToken.create.mock.calls[0][0] as {
        data: { tokenHash: string };
      };
      expect(createArgs.data.tokenHash).toBe(sha256(result.token));
      // The raw token must never be persisted.
      expect(JSON.stringify(prisma.telegramLinkToken.create.mock.calls)).not.toContain(
        result.token,
      );
    });

    it('sets a short expiry and invalidates previously pending tokens', async () => {
      const before = Date.now();
      const result = await service.createLinkToken(USER_PRINCIPAL);

      const ttl = result.expiresAt.getTime() - before;
      expect(ttl).toBeGreaterThan(TELEGRAM_LINK_TTL_MS - 5_000);
      // Allow a 1ms scheduling skew between `before` and the service's clock read.
      expect(ttl).toBeLessThanOrEqual(TELEGRAM_LINK_TTL_MS + 1);

      expect(prisma.telegramLinkToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', usedAt: null },
      });
    });

    it('audits token creation', async () => {
      await service.createLinkToken(USER_PRINCIPAL);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'TELEGRAM_LINK_CREATED', organizationId: 'org-1' }),
      );
    });

    it('targets the ParentAccount for a PARENT principal (never a User id)', async () => {
      prisma.parentAccount.findFirst.mockResolvedValue({ id: 'parent-1' });
      await service.createLinkToken(PARENT_PRINCIPAL);

      expect(prisma.parentAccount.findFirst).toHaveBeenCalled();
      const createArgs = prisma.telegramLinkToken.create.mock.calls[0][0] as {
        data: { parentAccountId?: string; targetType: string };
      };
      expect(createArgs.data.targetType).toBe('PARENT_ACCOUNT');
      expect(createArgs.data.parentAccountId).toBe('parent-1');
    });

    it('refuses when the principal is inactive', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.createLinkToken(USER_PRINCIPAL)).rejects.toThrow(ForbiddenException);
    });

    it('fails honestly when the bot username is not configured', async () => {
      telegram.getBotUsername.mockReturnValue(null);
      await expect(service.createLinkToken(USER_PRINCIPAL)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('consumeStart', () => {
    const TOKEN = 'a'.repeat(64);
    const HASH = sha256(TOKEN);
    const validRow = {
      id: 'token-1',
      organizationId: 'org-1',
      targetType: 'USER',
      userId: 'user-1',
      parentAccountId: null,
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    };
    const input = {
      token: TOKEN,
      telegramUserId: '9001',
      chatId: '9001',
      username: 'alice',
      firstName: 'Alice',
      lastName: 'A',
      languageCode: 'uz',
    };

    beforeEach(() => {
      prisma.telegramLinkToken.findUnique.mockResolvedValue(validRow);
      prisma.telegramLinkToken.updateMany.mockResolvedValue({ count: 1 });
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      prisma.telegramAccount.findUnique.mockResolvedValue(null);
      prisma.telegramAccount.findMany.mockResolvedValue([]);
      prisma.telegramAccount.create.mockResolvedValue({});
      prisma.user.update.mockResolvedValue({});
      prisma.telegramLinkLog.create.mockResolvedValue({});
    });

    it('rejects a malformed token without touching the database', async () => {
      const result = await service.consumeStart({ ...input, token: 'not-a-token' });

      expect(result).toEqual({ status: 'INVALID_TOKEN' });
      expect(prisma.telegramLinkToken.findUnique).not.toHaveBeenCalled();
      expect(limiter.registerFailure).toHaveBeenCalled();
    });

    it('rejects an unknown token', async () => {
      prisma.telegramLinkToken.findUnique.mockResolvedValue(null);
      const result = await service.consumeStart(input);
      expect(result).toEqual({ status: 'INVALID_TOKEN' });
      expect(prisma.telegramLinkToken.updateMany).not.toHaveBeenCalled();
    });

    it('rejects an expired token', async () => {
      prisma.telegramLinkToken.findUnique.mockResolvedValue({
        ...validRow,
        expiresAt: new Date(Date.now() - 1_000),
      });
      const result = await service.consumeStart(input);
      expect(result).toEqual({ status: 'INVALID_TOKEN' });
      expect(prisma.telegramLinkToken.updateMany).not.toHaveBeenCalled();
    });

    it('rejects an already-used token (replay protection)', async () => {
      prisma.telegramLinkToken.findUnique.mockResolvedValue({
        ...validRow,
        usedAt: new Date(),
      });
      const result = await service.consumeStart(input);
      expect(result).toEqual({ status: 'INVALID_TOKEN' });
      expect(prisma.telegramLinkToken.updateMany).not.toHaveBeenCalled();
    });

    it('loses gracefully when two deliveries race for the same token', async () => {
      // The conditional update matched nothing => another caller already won.
      prisma.telegramLinkToken.updateMany.mockResolvedValue({ count: 0 });
      const result = await service.consumeStart(input);

      expect(result).toEqual({ status: 'INVALID_TOKEN' });
      expect(prisma.telegramAccount.create).not.toHaveBeenCalled();
    });

    it('is rate limited once the chat exceeds the failed-attempt budget', async () => {
      limiter.isBlocked.mockResolvedValue(true);
      const result = await service.consumeStart(input);

      expect(result).toEqual({ status: 'RATE_LIMITED' });
      expect(prisma.telegramLinkToken.findUnique).not.toHaveBeenCalled();
      expect(prisma.telegramLinkToken.updateMany).not.toHaveBeenCalled();
    });

    it('links the identity, mirrors the legacy delivery pointer and audits it', async () => {
      const result = await service.consumeStart(input);

      expect(result).toEqual({
        status: 'LINKED',
        entityType: 'USER',
        organizationId: 'org-1',
        alreadyLinked: false,
      });

      // Atomic single-use claim happened first.
      expect(prisma.telegramLinkToken.updateMany).toHaveBeenCalledWith({
        where: { id: 'token-1', usedAt: null },
        data: { usedAt: expect.any(Date) },
      });

      const createArgs = prisma.telegramAccount.create.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(createArgs.data).toMatchObject({
        organizationId: 'org-1',
        telegramUserId: '9001',
        chatId: '9001',
        status: 'ACTIVE',
        userId: 'user-1',
      });

      // Legacy column mirrors TelegramAccount.chatId for the notification worker.
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { telegramChatId: '9001' },
      });

      // The raw token is never written to the audit log.
      const logArgs = prisma.telegramLinkLog.create.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(logArgs.data.linkToken).toBe(HASH);
      expect(JSON.stringify(logArgs)).not.toContain(TOKEN);

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'TELEGRAM_LINK_CONSUMED' }),
      );
      expect(limiter.clear).toHaveBeenCalled();
    });

    it('refuses to reassign a Telegram identity owned by another principal', async () => {
      prisma.telegramAccount.findUnique.mockResolvedValue({
        id: 'acct-other',
        userId: 'someone-else',
        parentAccountId: null,
        status: 'ACTIVE',
      });

      const result = await service.consumeStart(input);

      expect(result).toEqual({ status: 'IDENTITY_CONFLICT' });
      expect(prisma.telegramAccount.create).not.toHaveBeenCalled();
      expect(prisma.telegramAccount.update).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects the link when the target was deactivated after the token was issued', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      const result = await service.consumeStart(input);
      expect(result).toEqual({ status: 'INVALID_TOKEN' });
      expect(prisma.telegramAccount.create).not.toHaveBeenCalled();
    });
  });

  describe('unlink', () => {
    it('disconnects the account, clears the delivery pointer and cancels pending links', async () => {
      prisma.telegramAccount.findFirst.mockResolvedValue({ id: 'acct-1' });
      prisma.telegramAccount.update.mockResolvedValue({});
      prisma.telegramLinkToken.deleteMany.mockResolvedValue({ count: 0 });
      prisma.user.update.mockResolvedValue({});

      const result = await service.unlink(USER_PRINCIPAL);

      expect(result).toEqual({ disconnected: true });
      expect(prisma.telegramAccount.update).toHaveBeenCalledWith({
        where: { id: 'acct-1' },
        data: { status: 'DISCONNECTED', disconnectedAt: expect.any(Date) },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { telegramChatId: null },
      });
      expect(prisma.telegramLinkToken.deleteMany).toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'TELEGRAM_DISCONNECTED' }),
      );
    });

    it('is a no-op when nothing is linked', async () => {
      prisma.telegramAccount.findFirst.mockResolvedValue(null);
      const result = await service.unlink(USER_PRINCIPAL);
      expect(result).toEqual({ disconnected: false });
      expect(prisma.telegramAccount.update).not.toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    it('reports the linked identity without exposing chat identifiers', async () => {
      prisma.telegramAccount.findFirst.mockResolvedValue({
        status: 'ACTIVE',
        username: 'alice',
        firstName: 'Alice',
        lastName: 'A',
        languageCode: 'uz',
        linkedAt: new Date('2026-01-01'),
        lastSeenAt: null,
        chatId: '9001',
      });
      prisma.telegramLinkToken.findFirst.mockResolvedValue({ expiresAt: new Date('2026-02-01') });

      const status = await service.getStatus(USER_PRINCIPAL);

      expect(status.linked).toBe(true);
      expect(status.username).toBe('alice');
      expect(JSON.stringify(status)).not.toContain('9001');
    });
  });

  describe('sendTestMessage', () => {
    it('sends to the linked chat and touches lastSeenAt', async () => {
      prisma.telegramAccount.findFirst.mockResolvedValue({ id: 'acct-1', chatId: '9001' });
      prisma.telegramAccount.update.mockResolvedValue({});

      const result = await service.sendTestMessage(USER_PRINCIPAL);

      expect(result).toEqual({ sent: true });
      expect(telegram.sendMessage).toHaveBeenCalledWith('9001', expect.any(String));
    });

    it('does not send when nothing is linked', async () => {
      prisma.telegramAccount.findFirst.mockResolvedValue(null);
      const result = await service.sendTestMessage(USER_PRINCIPAL);
      expect(result).toEqual({ sent: false });
      expect(telegram.sendMessage).not.toHaveBeenCalled();
    });
  });
});
