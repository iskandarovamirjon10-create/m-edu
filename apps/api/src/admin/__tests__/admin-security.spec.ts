import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminController } from '../admin.controller';
import { AdminService } from '../admin.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('AdminController & AdminService — Security & Platform Isolation', () => {
  let controller: AdminController;
  let service: AdminService;
  let prisma: any;
  let emailService: any;

  beforeEach(() => {
    prisma = {
      accessRequest: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      invitation: {
        create: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      session: {
        updateMany: vi.fn(),
      },
      $transaction: vi.fn((callbacks) => {
        if (Array.isArray(callbacks)) {
          return Promise.all(callbacks);
        }
        return callbacks(prisma);
      }),
    };

    emailService = {
      sendRawEmail: vi.fn().mockResolvedValue(undefined),
    };

    service = new AdminService(prisma, emailService);
    controller = new AdminController(service);
  });

  describe('Tenant isolation on updateUserStatus', () => {
    it('DENIES tenant admin from suspending a user belonging to another organization', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'victim-id',
        organizationId: 'other-org',
        role: 'TEACHER',
      });

      const caller = {
        sub: 'caller-id',
        organizationId: 'my-org',
        role: 'SUPER_ADMIN',
      };

      await expect(
        service.updateUserStatus('victim-id', 'SUSPENDED', caller),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('DENIES tenant admin from suspending a Super Admin or Platform Owner', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'target-id',
        organizationId: 'my-org',
        role: 'SUPER_ADMIN',
      });

      const caller = {
        sub: 'caller-id',
        organizationId: 'my-org',
        role: 'ORG_ADMIN',
      };

      await expect(
        service.updateUserStatus('target-id', 'SUSPENDED', caller),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('ALLOWS tenant admin to suspend a regular user within their OWN organization', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'student-user-id',
        organizationId: 'my-org',
        role: 'STUDENT',
      });

      const caller = {
        sub: 'caller-id',
        organizationId: 'my-org',
        role: 'SUPER_ADMIN',
      };

      const result = await service.updateUserStatus('student-user-id', 'SUSPENDED', caller);
      expect(result.message).toContain('successfully SUSPENDED');
      expect(prisma.session.updateMany).toHaveBeenCalledWith({
        where: { userId: 'student-user-id' },
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      });
    });

    it('ALLOWS PLATFORM_OWNER to suspend any user across any organization', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'target-id',
        organizationId: 'other-org',
        role: 'TEACHER',
      });

      const caller = {
        sub: 'platform-root',
        organizationId: 'platform-org',
        role: 'PLATFORM_OWNER',
      };

      const result = await service.updateUserStatus('target-id', 'SUSPENDED', caller);
      expect(result.message).toContain('successfully SUSPENDED');
    });
  });

  describe('Access requests approval safety', () => {
    it('throws NotFoundException when request does not exist', async () => {
      prisma.accessRequest.findUnique.mockResolvedValue(null);

      await expect(
        service.approveAccessRequest('req-1', 'org-1', 'TEACHER', 'reviewer-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('successfully approves a pending request and dispatches invitation email', async () => {
      prisma.accessRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        email: 'applicant@school.uz',
        status: 'PENDING',
      });
      prisma.invitation.create.mockResolvedValue({ id: 'inv-1' });

      const res = await service.approveAccessRequest('req-1', 'org-1', 'TEACHER', 'reviewer-1');
      expect(res.message).toBe('Access request approved');
      expect(emailService.sendRawEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'applicant@school.uz',
          organizationId: 'org-1',
        }),
      );
    });
  });
});
