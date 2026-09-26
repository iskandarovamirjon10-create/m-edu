import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import type { JwtService } from '@nestjs/jwt';
import { PASSWORD_RESET_GENERIC_MESSAGE } from '../auth.config';

type Mailer = { sendPasswordResetEmail(to: string, url: string): Promise<void> };

const USER_ID = '11111111-1111-1111-1111-111111111111';

function createPrisma() {
  const tx = {
    passwordResetToken: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ id: USER_ID, isActive: true }),
      update: vi.fn().mockResolvedValue({}),
    },
    session: {
      updateMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
    parentPasswordResetToken: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    parentAccount: {
      findUnique: vi.fn().mockResolvedValue({ id: 'parent-1', email: 'parent@example.com', isActive: true }),
      findMany: vi.fn().mockResolvedValue([{ id: 'parent-1' }]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    parentSession: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };

  const prisma = {
    passwordResetToken: {
      findUnique: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    session: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    parentPasswordResetToken: {
      findUnique: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    parentAccount: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    authorizationCode: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    parentSession: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: vi.fn(async (fn: (c: typeof tx) => Promise<unknown>) => fn(tx)),
  };

  return { prisma, tx };
}

describe('password reset', () => {
  let prisma: ReturnType<typeof createPrisma>['prisma'];
  let tx: ReturnType<typeof createPrisma>['tx'];
  let svc: AuthService;
  let originalSmtpHost: string | undefined;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    originalSmtpHost = process.env.SMTP_HOST;

    const mocks = createPrisma();
    prisma = mocks.prisma;
    tx = mocks.tx;
    svc = new AuthService(prisma as never, { sign: vi.fn(), decode: vi.fn() } as unknown as JwtService);

    // bcrypt at a trivial cost so the spec stays fast (and stays deterministic
    // under fake timers).
    const bcryptModule = await import('bcryptjs');
    vi.spyOn(bcryptModule.default, 'hash').mockImplementation(
      async () => '$2a$10$fakefakefakefakefakefake',
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    if (originalSmtpHost === undefined) delete process.env.SMTP_HOST;
    else process.env.SMTP_HOST = originalSmtpHost;
  });

  describe('resetPassword — consume exactly once', () => {
    const liveToken = () => ({
      id: 'reset-1',
      userId: USER_ID,
      usedAt: null,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    it('claims the token with a guarded conditional update and requires count === 1', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(liveToken());

      await svc.resetPassword('raw-token', 'NewPassword123!');

      expect(tx.passwordResetToken.updateMany).toHaveBeenCalledTimes(1);
      const claim = tx.passwordResetToken.updateMany.mock.calls[0][0];
      expect(claim.where).toMatchObject({
        id: 'reset-1',
        tokenHash: expect.any(String),
        usedAt: null,
      });
      expect(claim.where.expiresAt).toHaveProperty('gt');
      expect(claim.data).toEqual({ usedAt: expect.any(Date) });
    });

    it('performs the password update and session revocation in the SAME transaction', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(liveToken());

      await svc.resetPassword('raw-token', 'NewPassword123!');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.user.update).toHaveBeenCalledTimes(1);
      expect(tx.user.update.mock.calls[0][0]).toMatchObject({
        where: { id: USER_ID },
        data: { passwordHash: expect.any(String) },
      });
      expect(tx.session.updateMany).toHaveBeenCalledTimes(1);
      expect(tx.session.updateMany.mock.calls[0][0]).toMatchObject({
        where: { userId: USER_ID, revokedAt: null },
        data: { revokedAt: expect.any(Date), revokedReason: 'password_reset' },
      });
      // Everything ran on the transaction client, never on the root prisma.
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.session.updateMany).not.toHaveBeenCalled();
    });

    it('rejects the loser of a concurrent claim (count !== 1) without touching the password', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(liveToken());
      tx.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(svc.resetPassword('raw-token', 'NewPassword123!')).rejects.toThrow(
        BadRequestException,
      );

      expect(tx.user.update).not.toHaveBeenCalled();
      expect(tx.session.updateMany).not.toHaveBeenCalled();
    });

    // Factories: the fixtures must be built AT CALL TIME, because this suite
    // runs with a frozen clock while the spec module is collected with the
    // real one.
    it.each([
      ['unknown token', () => null],
      [
        'already-used token',
        () => ({
          id: 'reset-1',
          userId: USER_ID,
          usedAt: new Date(Date.now()),
          expiresAt: new Date(Date.now() + 60_000),
        }),
      ],
      [
        'expired token',
        () => ({
          id: 'reset-1',
          userId: USER_ID,
          usedAt: null,
          expiresAt: new Date(Date.now() - 1),
        }),
      ],
    ])('rejects an %s before opening a transaction', async (_label, build) => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(build());

      await expect(svc.resetPassword('raw-token', 'NewPassword123!')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(tx.user.update).not.toHaveBeenCalled();
    });

    it('fails closed when the token owner no longer exists', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(liveToken());
      tx.user.findUnique.mockResolvedValue(null);

      await expect(svc.resetPassword('raw-token', 'NewPassword123!')).rejects.toThrow(
        BadRequestException,
      );
      expect(tx.user.update).not.toHaveBeenCalled();
      expect(tx.session.updateMany).not.toHaveBeenCalled();
    });

    it('fails closed when the token owner is deactivated', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(liveToken());
      tx.user.findUnique.mockResolvedValue({ id: USER_ID, isActive: false });

      await expect(svc.resetPassword('raw-token', 'NewPassword123!')).rejects.toThrow(
        BadRequestException,
      );
      expect(tx.user.update).not.toHaveBeenCalled();
    });
  });

  describe('forgotPassword — an undelivered token is never redeemable', () => {
    const existingUser = {
      id: USER_ID,
      email: 'reset.me@example.com',
      passwordHash: '$2a$10$existing',
    };

    const lastCreatedHash = () =>
      prisma.passwordResetToken.create.mock.calls.at(-1)![0].data.tokenHash as string;

    it('returns the generic message and creates a hashed token', async () => {
      prisma.user.findFirst.mockResolvedValue(existingUser);
      vi.stubEnv('SMTP_HOST', 'smtp.example.test');
      vi.spyOn(svc as unknown as Mailer, 'sendPasswordResetEmail').mockResolvedValue(undefined);

      const result = await svc.forgotPassword(existingUser.email);

      expect(result.message).toBe(PASSWORD_RESET_GENERIC_MESSAGE);
      expect(prisma.passwordResetToken.create).toHaveBeenCalledTimes(1);
      const created = prisma.passwordResetToken.create.mock.calls[0][0].data;
      expect(created.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(created.userId).toBe(USER_ID);
    });

    it('invalidates the token atomically when SMTP delivery fails', async () => {
      prisma.user.findFirst.mockResolvedValue(existingUser);
      vi.stubEnv('SMTP_HOST', 'smtp.example.test');
      vi.spyOn(svc as unknown as Mailer, 'sendPasswordResetEmail').mockRejectedValue(
        new Error('SMTP down'),
      );

      const result = await svc.forgotPassword(existingUser.email);

      // Caller still learns nothing about the failure (anti-enumeration).
      expect(result.message).toBe(PASSWORD_RESET_GENERIC_MESSAGE);

      expect(prisma.passwordResetToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: lastCreatedHash(), usedAt: null },
        data: { usedAt: expect.any(Date) },
      });
    });

    it('invalidates the token when no SMTP transport is configured', async () => {
      prisma.user.findFirst.mockResolvedValue(existingUser);

      const result = await svc.forgotPassword(existingUser.email);

      expect(result.message).toBe(PASSWORD_RESET_GENERIC_MESSAGE);
      expect(prisma.passwordResetToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: lastCreatedHash(), usedAt: null },
        data: { usedAt: expect.any(Date) },
      });
    });

    it('returns the identical generic message for an unknown account', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      const pending = svc.forgotPassword('nobody@example.com');
      await vi.advanceTimersByTimeAsync(300);
      const result = await pending;

      expect(result.message).toBe(PASSWORD_RESET_GENERIC_MESSAGE);
      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    });

    it('burns previous unused tokens before issuing a new one', async () => {
      prisma.user.findFirst.mockResolvedValue(existingUser);
      vi.stubEnv('SMTP_HOST', 'smtp.example.test');
      vi.spyOn(svc as unknown as Mailer, 'sendPasswordResetEmail').mockResolvedValue(undefined);

      await svc.forgotPassword(existingUser.email);

      expect(prisma.passwordResetToken.updateMany).toHaveBeenNthCalledWith(1, {
        where: { userId: USER_ID, usedAt: null },
        data: { usedAt: expect.any(Date) },
      });
    });

    it('supports forgotPassword for parent accounts', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.parentAccount.findMany.mockResolvedValue([
        { id: 'parent-1', email: 'parent@example.com', passwordHash: '$2a$10$existingHash' },
      ]);
      vi.stubEnv('SMTP_HOST', 'smtp.example.test');
      vi.spyOn(svc as unknown as Mailer, 'sendPasswordResetEmail').mockResolvedValue(undefined);

      const result = await svc.forgotPassword('parent@example.com');

      expect(result.message).toBe(PASSWORD_RESET_GENERIC_MESSAGE);
      expect(prisma.parentPasswordResetToken.create).toHaveBeenCalledWith({
        data: {
          parentId: 'parent-1',
          tokenHash: expect.any(String),
          expiresAt: expect.any(Date),
        },
      });
    });

    it('resets password for parent account and revokes parent sessions', async () => {
      const RAW_TOKEN = 'parent-valid-token-32-chars-long-abc';

      prisma.passwordResetToken.findUnique.mockResolvedValue(null);
      prisma.parentPasswordResetToken.findUnique.mockResolvedValue({
        id: 'tok-p1',
        parentId: 'parent-1',
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });

      const res = await svc.resetPassword(RAW_TOKEN, 'NewSecretPassword123!');
      expect(res.message).toContain('Password has been reset successfully');
      expect(tx.parentPasswordResetToken.updateMany).toHaveBeenCalled();
      expect(tx.parentAccount.updateMany).toHaveBeenCalled();
      expect(tx.parentSession.updateMany).toHaveBeenCalledWith({
        where: { parentId: { in: ['parent-1'] }, revokedAt: null },
        data: { revokedAt: expect.any(Date), revokedReason: 'password_reset' },
      });
    });
  });
});
