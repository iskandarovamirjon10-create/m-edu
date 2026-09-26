import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TelegramDeliveryService,
  isPermanentRelationshipFailure,
  isTransientFailure,
} from '../telegram-delivery.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';

function makePrisma() {
  const tx = {
    telegramAccount: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    user: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    parentAccount: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };
  return {
    telegramAccount: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(async (cb: (client: typeof tx) => Promise<unknown>) => cb(tx)),
    __tx: tx,
  };
}

describe('TelegramDeliveryService — target resolution', () => {
  it('only ever resolves ACTIVE accounts, scoped to the organization', async () => {
    const prisma = makePrisma();
    prisma.telegramAccount.findFirst.mockResolvedValue({
      id: 'acct-1',
      organizationId: 'org-1',
      chatId: 'chat-1',
      languageCode: 'uz',
      userId: null,
      parentAccountId: 'p-1',
    });
    const service = new TelegramDeliveryService(prisma as unknown as PrismaService, {} as AuditService);

    const target = await service.resolveActiveTarget('org-1', {
      type: 'PARENT_ACCOUNT',
      parentAccountId: 'p-1',
    });

    expect(target?.chatId).toBe('chat-1');
    expect(prisma.telegramAccount.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: 'org-1',
          status: 'ACTIVE',
          parentAccountId: 'p-1',
        },
      }),
    );
  });

  it('returns null when no ACTIVE account exists (disconnected/blocked/suspended)', async () => {
    const prisma = makePrisma();
    prisma.telegramAccount.findFirst.mockResolvedValue(null);
    const service = new TelegramDeliveryService(prisma as unknown as PrismaService, {} as AuditService);

    await expect(
      service.resolveActiveTarget('org-1', { type: 'USER', userId: 'u-1' }),
    ).resolves.toBeNull();
  });

  it('batch resolution drops a row whose organization does not match (fail closed)', async () => {
    const prisma = makePrisma();
    prisma.telegramAccount.findMany.mockResolvedValue([
      {
        id: 'acct-other-tenant',
        organizationId: 'org-2',
        chatId: 'chat-x',
        languageCode: null,
        userId: 'u-1',
        parentAccountId: null,
      },
    ]);
    const service = new TelegramDeliveryService(prisma as unknown as PrismaService, {} as AuditService);

    const map = await service.resolveActiveTargetsForPrincipals('org-1', [
      { type: 'USER', userId: 'u-1' },
    ]);

    expect(map.size).toBe(0);
  });

  it('batch resolution keys by principal id and keeps tenant scope in the query', async () => {
    const prisma = makePrisma();
    prisma.telegramAccount.findMany.mockResolvedValue([
      {
        id: 'acct-1',
        organizationId: 'org-1',
        chatId: 'chat-1',
        languageCode: 'ru',
        userId: null,
        parentAccountId: 'p-1',
      },
      {
        id: 'acct-2',
        organizationId: 'org-1',
        chatId: 'chat-2',
        languageCode: 'en',
        userId: null,
        parentAccountId: 'p-2',
      },
    ]);
    const service = new TelegramDeliveryService(prisma as unknown as PrismaService, {} as AuditService);

    const map = await service.resolveActiveTargetsForPrincipals('org-1', [
      { type: 'PARENT_ACCOUNT', parentAccountId: 'p-1' },
      { type: 'PARENT_ACCOUNT', parentAccountId: 'p-2' },
    ]);

    expect(map.size).toBe(2);
    expect(map.get('p-2')?.chatId).toBe('chat-2');
    expect(prisma.telegramAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org-1', status: 'ACTIVE' }),
      }),
    );
  });
});

describe('TelegramDeliveryService — permanent failure handling', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let audit: { record: ReturnType<typeof vi.fn> };
  let service: TelegramDeliveryService;

  beforeEach(() => {
    prisma = makePrisma();
    audit = { record: vi.fn().mockResolvedValue({}) };
    service = new TelegramDeliveryService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
    );
  });

  it('marks an ACTIVE account BLOCKED, clears the legacy pointer and audits', async () => {
    prisma.telegramAccount.findUnique.mockResolvedValue({
      id: 'acct-1',
      organizationId: 'org-1',
      chatId: 'chat-1',
      status: 'ACTIVE',
      userId: null,
      parentAccountId: 'p-1',
    });

    const transitioned = await service.markUndeliverable('acct-1', 'BLOCKED_USER', 'bot blocked by user');

    expect(transitioned).toBe(true);
    // Guarded transition: only an ACTIVE row may go BLOCKED (race safety).
    expect(prisma.__tx.telegramAccount.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'acct-1', status: 'ACTIVE' },
        data: expect.objectContaining({ status: 'BLOCKED' }),
      }),
    );
    // Legacy mirror cleared only when it still points at THIS chat.
    expect(prisma.__tx.parentAccount.updateMany).toHaveBeenCalledWith({
      where: { id: 'p-1', telegramChatId: 'chat-1' },
      data: { telegramChatId: null },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        action: 'TELEGRAM_ACCOUNT_BLOCKED',
        resourceId: 'acct-1',
      }),
    );
  });

  it('is a no-op when the account is no longer ACTIVE (re-link already restored it)', async () => {
    prisma.telegramAccount.findUnique.mockResolvedValue({
      id: 'acct-1',
      organizationId: 'org-1',
      chatId: 'chat-1',
      status: 'DISCONNECTED',
      userId: 'u-1',
      parentAccountId: null,
    });

    await expect(
      service.markUndeliverable('acct-1', 'BLOCKED_USER', 'reason'),
    ).resolves.toBe(false);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('does not audit or mutate when another worker won the race', async () => {
    prisma.telegramAccount.findUnique.mockResolvedValue({
      id: 'acct-1',
      organizationId: 'org-1',
      chatId: 'chat-1',
      status: 'ACTIVE',
      userId: 'u-1',
      parentAccountId: null,
    });
    prisma.__tx.telegramAccount.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.markUndeliverable('acct-1', 'BLOCKED_USER', 'reason'),
    ).resolves.toBe(false);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('marks the account for a BLOCKED_USER / INVALID_CHAT result', async () => {
    prisma.telegramAccount.findUnique.mockResolvedValue({
      id: 'acct-1',
      organizationId: 'org-1',
      chatId: 'chat-1',
      status: 'ACTIVE',
      userId: 'u-1',
      parentAccountId: null,
    });
    const target = {
      accountId: 'acct-1',
      organizationId: 'org-1',
      chatId: 'chat-1',
      languageCode: null,
      userId: 'u-1',
      parentAccountId: null,
    };

    const blocked = await service.applyFailure(target, {
      ok: false,
      errorCategory: 'BLOCKED_USER',
      retryable: false,
    });
    expect(blocked).toBe('BLOCKED_USER');
    expect(prisma.__tx.telegramAccount.updateMany).toHaveBeenCalledTimes(1);

    prisma.__tx.telegramAccount.updateMany.mockClear();
    const invalid = await service.applyFailure(target, {
      ok: false,
      errorCategory: 'INVALID_CHAT',
      retryable: false,
    });
    expect(invalid).toBe('INVALID_CHAT');
    expect(prisma.__tx.telegramAccount.updateMany).toHaveBeenCalledTimes(1);
  });

  it('does NOT block an account for transient or configuration failures', async () => {
    const target = {
      accountId: 'acct-1',
      organizationId: 'org-1',
      chatId: 'chat-1',
      languageCode: null,
      userId: 'u-1',
      parentAccountId: null,
    };

    for (const category of ['TIMEOUT', 'NETWORK_ERROR', 'RATE_LIMITED', 'TELEGRAM_SERVER_ERROR']) {
      const result = await service.applyFailure(target, {
        ok: false,
        errorCategory: category as never,
        retryable: true,
      });
      expect(result).toBe(category);
    }
    // A wrong/absent bot token is an operator problem affecting every account —
    // blocking accounts for it would destroy working links.
    await service.applyFailure(target, {
      ok: false,
      errorCategory: 'UNAUTHORIZED',
      retryable: false,
    });
    await service.applyFailure(target, {
      ok: false,
      errorCategory: 'NOT_CONFIGURED',
      retryable: false,
    });

    expect(prisma.telegramAccount.findUnique).not.toHaveBeenCalled();
    expect(prisma.__tx.telegramAccount.updateMany).not.toHaveBeenCalled();
  });
});

describe('TelegramDeliveryService — failure classification', () => {
  it('classifies permanent relationship vs transient vs configuration failures', () => {
    expect(isPermanentRelationshipFailure('BLOCKED_USER')).toBe(true);
    expect(isPermanentRelationshipFailure('INVALID_CHAT')).toBe(true);
    expect(isPermanentRelationshipFailure('UNAUTHORIZED')).toBe(false);
    expect(isPermanentRelationshipFailure('NOT_CONFIGURED')).toBe(false);
    expect(isPermanentRelationshipFailure('TIMEOUT')).toBe(false);

    expect(isTransientFailure('TIMEOUT')).toBe(true);
    expect(isTransientFailure('NETWORK_ERROR')).toBe(true);
    expect(isTransientFailure('RATE_LIMITED')).toBe(true);
    expect(isTransientFailure('TELEGRAM_SERVER_ERROR')).toBe(true);
    expect(isTransientFailure('BLOCKED_USER')).toBe(false);
  });
});
