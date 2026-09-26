import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TelegramContextError,
  TelegramContextService,
} from '../telegram-context.service';
import { PrismaService } from '../../prisma/prisma.service';

function makePrisma() {
  return {
    telegramAccount: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    user: { findUnique: vi.fn() },
    parentAccount: { findUnique: vi.fn() },
  };
}

type PrismaMock = ReturnType<typeof makePrisma>;

const activeAccount = {
  id: 'acct-1',
  organizationId: 'org-1',
  status: 'ACTIVE',
  username: 'ali_bot',
  languageCode: 'uz',
  userId: 'user-1',
  parentAccountId: null,
};

describe('TelegramContextService', () => {
  let prisma: PrismaMock;
  let service: TelegramContextService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new TelegramContextService(prisma as unknown as PrismaService);
  });

  const userRow = (over: Record<string, unknown> = {}) => ({
    id: 'user-1',
    firstName: 'Ali',
    lastName: 'Valiyev',
    email: 'ali@example.com',
    role: 'STUDENT',
    organizationId: 'org-1',
    isActive: true,
    student: { id: 'student-1', balance: 100 },
    teacher: null,
    settings: { language: 'ru' },
    organization: { language: 'en' },
    ...over,
  });

  describe('identity resolution', () => {
    it('resolves an ACTIVE user link to role, permissions and flags', async () => {
      prisma.telegramAccount.findUnique.mockResolvedValue(activeAccount);
      prisma.user.findUnique.mockResolvedValue(
        userRow({ role: 'TEACHER', student: null, teacher: { id: 'teacher-1' } }),
      );

      const ctx = await service.resolve('9001');

      expect(ctx.kind).toBe('USER');
      expect(ctx.principalId).toBe('user-1');
      expect(ctx.organizationId).toBe('org-1');
      expect(ctx.role).toBe('TEACHER');
      expect(ctx.isTeaching).toBe(true);
      expect(ctx.isStaff).toBe(true);
      expect(ctx.isFamily).toBe(false);
      expect(ctx.teacherId).toBe('teacher-1');
      expect(ctx.permissions.length).toBeGreaterThan(0);
    });

    it('resolves a student to their own student id', async () => {
      prisma.telegramAccount.findUnique.mockResolvedValue(activeAccount);
      prisma.user.findUnique.mockResolvedValue(userRow());

      const ctx = await service.resolve('9001');
      expect(ctx.isStudent).toBe(true);
      expect(ctx.studentId).toBe('student-1');
      expect(ctx.teacherId).toBeNull();
    });

    it('resolves a ParentAccount link with no staff capabilities', async () => {
      prisma.telegramAccount.findUnique.mockResolvedValue({
        ...activeAccount,
        userId: null,
        parentAccountId: 'parent-1',
      });
      prisma.parentAccount.findUnique.mockResolvedValue({
        id: 'parent-1',
        firstName: 'Olim',
        lastName: 'Karimov',
        email: 'olim@example.com',
        organizationId: 'org-1',
        isActive: true,
        organization: { language: 'ru' },
      });

      const ctx = await service.resolve('9001');
      expect(ctx.kind).toBe('PARENT_ACCOUNT');
      expect(ctx.role).toBe('PARENT');
      expect(ctx.isParent).toBe(true);
      expect(ctx.isStaff).toBe(false);
      expect(ctx.isAdmin).toBe(false);
      expect(ctx.parentId).toBe('parent-1');
      expect(ctx.language).toBe('ru');
    });

    it('treats a row with no principal as unlinked', async () => {
      prisma.telegramAccount.findUnique.mockResolvedValue({
        ...activeAccount,
        userId: null,
        parentAccountId: null,
      });
      await expect(service.resolve('9001')).rejects.toMatchObject({ code: 'NOT_LINKED' });
    });

    it('rejects an unknown chat', async () => {
      prisma.telegramAccount.findUnique.mockResolvedValue(null);
      await expect(service.resolve('404')).rejects.toBeInstanceOf(TelegramContextError);
    });
  });

  describe('lifecycle enforcement', () => {
    for (const status of ['DISCONNECTED', 'BLOCKED', 'SUSPENDED'] as const) {
      it(`denies commands for a ${status} link without loading the principal`, async () => {
        prisma.telegramAccount.findUnique.mockResolvedValue({ ...activeAccount, status });
        await expect(service.resolve('9001')).rejects.toMatchObject({ code: status });
        expect(prisma.user.findUnique).not.toHaveBeenCalled();
      });
    }
  });

  describe('authorization integrity', () => {
    it('denies when the principal is deactivated', async () => {
      prisma.telegramAccount.findUnique.mockResolvedValue(activeAccount);
      prisma.user.findUnique.mockResolvedValue(userRow({ isActive: false }));
      await expect(service.resolve('9001')).rejects.toMatchObject({ code: 'INACTIVE' });
    });

    it('denies when the principal moved to another organization', async () => {
      prisma.telegramAccount.findUnique.mockResolvedValue(activeAccount);
      prisma.user.findUnique.mockResolvedValue(userRow({ organizationId: 'org-2' }));
      await expect(service.resolve('9001')).rejects.toMatchObject({ code: 'TENANT_MISMATCH' });
    });

    it('re-reads the role on every call so a downgrade takes effect immediately', async () => {
      prisma.telegramAccount.findUnique.mockResolvedValue(activeAccount);
      prisma.user.findUnique.mockResolvedValueOnce(userRow({ role: 'ORG_ADMIN' }));
      const first = await service.resolve('9001');
      expect(first.isAdmin).toBe(true);

      // Same Telegram link, role downgraded in M-EDU.
      prisma.user.findUnique.mockResolvedValueOnce(userRow({ role: 'STUDENT' }));
      const second = await service.resolve('9001');
      expect(second.isAdmin).toBe(false);
      expect(second.isStudent).toBe(true);
    });
  });

  describe('language resolution', () => {
    it('prefers the M-EDU user preference', async () => {
      prisma.telegramAccount.findUnique.mockResolvedValue(activeAccount);
      prisma.user.findUnique.mockResolvedValue(userRow({ settings: { language: 'ru' } }));
      expect((await service.resolve('9001')).language).toBe('ru');
    });

    it('falls back to the organization language', async () => {
      prisma.telegramAccount.findUnique.mockResolvedValue(activeAccount);
      prisma.user.findUnique.mockResolvedValue(
        userRow({ settings: null, organization: { language: 'uz' } }),
      );
      expect((await service.resolve('9001')).language).toBe('uz');
    });

    it('falls back to the Telegram locale last', async () => {
      prisma.telegramAccount.findUnique.mockResolvedValue({
        ...activeAccount,
        languageCode: 'ru',
      });
      prisma.user.findUnique.mockResolvedValue(
        userRow({ settings: null, organization: null }),
      );
      expect((await service.resolve('9001')).language).toBe('ru');
    });
  });

  it('never uses Telegram-supplied identity: only the chat id is a lookup key', async () => {
    prisma.telegramAccount.findUnique.mockResolvedValue(activeAccount);
    prisma.user.findUnique.mockResolvedValue(userRow());
    await service.resolve('9001');
    expect(prisma.telegramAccount.findUnique).toHaveBeenCalledWith({
      where: { chatId: '9001' },
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' } }),
    );
  });
});
