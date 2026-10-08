import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '../auth.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { JwtService } from '@nestjs/jwt';
import { ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

function createMockPrisma() {
  return {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn(),
      count: vi.fn(),
    },
    organization: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    session: {
      create: vi.fn().mockResolvedValue({
        id: 'session-mock',
        userId: 'u1',
        organizationId: 'org-1',
        expiresAt: new Date(),
      }),
      findUnique: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn(),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      count: vi.fn().mockResolvedValue(1),
      findMany: vi.fn().mockResolvedValue([]),
    },
    accessWhitelist: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
    },
    accessControlConfig: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    $transaction: vi.fn((fn: (tx: any) => any) =>
      fn({
        $executeRaw: vi.fn().mockResolvedValue(undefined),
        user: {
          create: vi.fn().mockResolvedValue({
            id: 'u-created',
            email: 'applicant@example.com',
            firstName: 'Ali',
            lastName: 'Valiyev',
            role: 'ORG_ADMIN',
            status: 'PENDING',
            isActive: false,
            organizationId: 'org-new',
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
          count: vi.fn().mockResolvedValue(1),
          update: vi.fn(),
        },
        organization: {
          create: vi.fn().mockResolvedValue({ id: 'org-new', name: 'EduCenter' }),
        },
      }),
    ),
  };
}

const mockJwt = {
  sign: vi.fn((payload: Record<string, unknown>) => `signed.${payload.sub}.token`),
  decode: vi.fn(() => null),
} as unknown as JwtService;

describe('Access Control & Whitelist (AuthService)', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let svc: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    svc = new AuthService(prisma as unknown as PrismaService, mockJwt);
  });

  describe('Login with PENDING status', () => {
    it('throws ForbiddenException when user status is PENDING', async () => {
      const passwordHash = await bcrypt.hash('secret123', 4);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-pending',
        email: 'pending@example.com',
        passwordHash,
        isActive: false,
        status: 'PENDING',
        firstName: 'Pending',
        lastName: 'Person',
        role: 'ORG_ADMIN',
        organizationId: 'org-1',
        organization: { id: 'org-1' },
      });

      await expect(svc.login('pending@example.com', 'secret123')).rejects.toThrow(
        ForbiddenException,
      );
      await expect(svc.login('pending@example.com', 'secret123')).rejects.toThrow(
        /pending administrator approval/i,
      );
    });
  });

  describe('isEmailWhitelisted', () => {
    it('returns true if email exists in AccessWhitelist', async () => {
      prisma.accessWhitelist.findUnique.mockResolvedValue({
        id: 'wl-1',
        email: 'allowed@example.com',
        organizationId: 'org-1',
      });

      const whitelisted = await svc.isEmailWhitelisted('allowed@example.com');
      expect(whitelisted).toBe(true);
      expect(prisma.accessWhitelist.findUnique).toHaveBeenCalledWith({
        where: {
          email: 'allowed@example.com',
        },
      });
    });

    it('returns false if email does not exist in AccessWhitelist', async () => {
      prisma.accessWhitelist.findUnique.mockResolvedValue(null);

      const whitelisted = await svc.isEmailWhitelisted('stranger@example.com');
      expect(whitelisted).toBe(false);
    });
  });

  describe('Registration access enforcement', () => {
    it('flags unwhitelisted users as PENDING when requireApproval is active', async () => {
      prisma.user.count.mockResolvedValue(5);
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.accessWhitelist.findUnique.mockResolvedValue(null);
      prisma.accessControlConfig.findUnique.mockResolvedValue({
        id: 'global',
        inviteOnly: true,
        requireApproval: true,
      });

      const res = await svc.register({
        email: 'applicant@example.com',
        password: 'Password123!',
        firstName: 'Ali',
        lastName: 'Valiyev',
        organizationName: 'EduCenter',
      });

      expect(res.pendingApproval).toBe(true);
      expect(res.message).toMatch(/pending administrator approval/i);
      expect(res.accessToken).toBeFalsy();
    });

    it('blocks registration when inviteOnly is true and requireApproval is false', async () => {
      prisma.user.count.mockResolvedValue(5);
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.accessWhitelist.findUnique.mockResolvedValue(null);
      prisma.accessControlConfig.findUnique.mockResolvedValue({
        id: 'global',
        inviteOnly: true,
        requireApproval: false,
      });

      await expect(
        svc.register({
          email: 'blocked@example.com',
          password: 'Password123!',
          firstName: 'Ali',
          lastName: 'Valiyev',
          organizationName: 'EduCenter',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Whitelist administration', () => {
    it('allows admin to add an email to the whitelist', async () => {
      prisma.accessWhitelist.findUnique.mockResolvedValue(null);
      prisma.accessWhitelist.create.mockResolvedValue({
        id: 'wl-new',
        email: 'teacher@school.uz',
        note: 'Math teacher',
        role: 'ORG_ADMIN',
        addedBy: 'admin-1',
        organizationId: null,
        createdAt: new Date(),
      });

      const item = await svc.addToWhitelist({
        email: 'TEACHER@School.uz',
        note: 'Math teacher',
        role: 'ORG_ADMIN',
        addedBy: 'admin-1',
        organizationId: null,
      });

      expect(prisma.accessWhitelist.create).toHaveBeenCalledWith({
        data: {
          email: 'teacher@school.uz',
          note: 'Math teacher',
          role: 'ORG_ADMIN',
          addedBy: 'admin-1',
          organizationId: null,
        },
      });
      expect(item.id).toBe('wl-new');
    });

    it('allows admin to approve a pending user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-pending-1',
        email: 'pending@school.uz',
        status: 'PENDING',
        isActive: false,
        organizationId: 'org-1',
      });
      prisma.user.update.mockResolvedValue({
        id: 'user-pending-1',
        status: 'ACTIVE',
        isActive: true,
      });

      const updated = await svc.approveUser('user-pending-1', 'admin-1', 'ORG_ADMIN', 'org-1');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-pending-1' },
        data: {
          status: 'ACTIVE',
          isActive: true,
        },
      });
      expect(updated.success).toBe(true);
    });

    it('prevents org admin from approving a user belonging to another organization', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-other-org',
        email: 'other@other.uz',
        status: 'PENDING',
        organizationId: 'org-99',
      });

      await expect(
        svc.approveUser('user-other-org', 'admin-1', 'ORG_ADMIN', 'org-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows admin to remove an email from whitelist', async () => {
      prisma.accessWhitelist.findUnique.mockResolvedValue({
        id: 'wl-to-delete',
        email: 'del@school.uz',
        organizationId: 'org-1',
      });
      prisma.accessWhitelist.delete.mockResolvedValue({ id: 'wl-to-delete' });

      const res = await svc.removeFromWhitelist('wl-to-delete', 'admin-1', 'ORG_ADMIN', 'org-1');
      expect(prisma.accessWhitelist.delete).toHaveBeenCalledWith({
        where: { id: 'wl-to-delete' },
      });
      expect(res.success).toBe(true);
    });

    it('allows admin to update access control configuration', async () => {
      prisma.accessControlConfig.upsert.mockResolvedValue({
        id: 'global',
        inviteOnly: true,
        requireApproval: true,
      });

      const res = await svc.updateAccessControlConfig(
        { inviteOnly: true, requireApproval: true },
        'admin-1',
        'SUPER_ADMIN',
        null,
      );

      expect(prisma.accessControlConfig.upsert).toHaveBeenCalledWith({
        where: { id: 'global' },
        create: {
          id: 'global',
          inviteOnly: true,
          requireApproval: true,
          updatedBy: 'admin-1',
        },
        update: {
          inviteOnly: true,
          requireApproval: true,
          updatedBy: 'admin-1',
        },
      });
      expect(res.inviteOnly).toBe(true);
      expect(res.requireApproval).toBe(true);
    });
  });
});
