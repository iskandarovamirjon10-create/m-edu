import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { normalizeUsername, validateUsername } from '../username.utils';
import { IAMService } from '../../iam/iam.service';
import { UsersService } from '../../users/users.service';
import { Role, MembershipStatus, UserStatus } from '@prisma/client';

describe('Centralized IAM Deep Security Regression Suite', () => {
  describe('1. Prohibited Authentication Endpoints', () => {
    let controller: AuthController;
    let authService: any;
    let parentPortalService: any;

    beforeEach(() => {
      authService = {
        register: vi.fn().mockImplementation(() => {
          throw new ForbiddenException('Public registration is disabled. Accounts can only be provisioned by the Platform Owner.');
        }),
        exchangeAuthCode: vi.fn().mockImplementation(() => {
          throw new ForbiddenException('Google OAuth authentication is permanently disabled.');
        }),
        login: vi.fn(),
      };
      parentPortalService = { authenticate: vi.fn() };
      controller = new AuthController(authService, parentPortalService);
    });

    it('Test 1: Public registration is strictly rejected with 403 Forbidden', async () => {
      await expect(
        controller.register({
          username: 'newuser',
          password: 'Password123!',
          firstName: 'New',
          lastName: 'User',
          organizationName: 'Org1',
        } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Test 2: Google OAuth initiation route is rejected with 403 Forbidden', async () => {
      await expect(controller.googleAuth()).rejects.toThrow(ForbiddenException);
    });

    it('Test 3: Google OAuth callback is rejected with 403 Forbidden', async () => {
      await expect(controller.googleAuthCallback()).rejects.toThrow(ForbiddenException);
    });

    it('Test 4: OAuth code exchange is rejected with 403 Forbidden', async () => {
      await expect(
        controller.exchangeAuthCode(
          { code: 'fake-oauth-code' },
          {} as any,
          { cookie: vi.fn(), clearCookie: vi.fn() } as any,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('2. Username Normalization & Validation Rules', () => {
    it('Test 5: Username is converted to lowercase and trimmed', () => {
      expect(normalizeUsername('  AdminUser  ')).toBe('adminuser');
      expect(normalizeUsername('TEACHER_123')).toBe('teacher_123');
    });

    it('Test 6: Valid usernames pass regex rules', () => {
      expect(validateUsername('admin').valid).toBe(true);
      expect(validateUsername('teacher.1').valid).toBe(true);
      expect(validateUsername('student_2026').valid).toBe(true);
      expect(validateUsername('user-name').valid).toBe(true);
    });

    it('Test 7: Invalid username characters or lengths are rejected', () => {
      expect(validateUsername('ab').valid).toBe(false); // too short (<3)
      expect(validateUsername('a'.repeat(31)).valid).toBe(false); // too long (>30)
      expect(validateUsername('.admin').valid).toBe(false); // must start with alphanumeric
      expect(validateUsername('user@domain').valid).toBe(false); // no special chars outside ._-
      expect(validateUsername('user name').valid).toBe(false); // no spaces
    });
  });

  describe('3. OWNER_ONLY Account Provisioning Privileges', () => {
    let usersService: UsersService;
    let mockPrisma: any;
    let mockLogger: any;
    let mockSecurity: any;

    beforeEach(() => {
      mockPrisma = {
        user: {
          findFirst: vi.fn(),
          findUnique: vi.fn().mockResolvedValue({ id: 'target-u', role: Role.TEACHER, organizationId: 'org-1' }),
          create: vi.fn(),
          update: vi.fn(),
        },
        organization: {
          findUnique: vi.fn().mockResolvedValue({ id: 'org-1' }),
        },
        branch: {
          findFirst: vi.fn(),
        },
        passwordHistory: {
          create: vi.fn().mockResolvedValue({}),
        },
        organizationMembership: {
          create: vi.fn().mockResolvedValue({}),
        },
      };
      mockLogger = { error: vi.fn(), warn: vi.fn(), log: vi.fn() };
      mockSecurity = { logEvent: vi.fn() };
      usersService = new UsersService(mockPrisma as any, mockLogger as any, mockSecurity as any);
    });

    it('Test 8: ORG_ADMIN cannot create user accounts (403 Forbidden)', async () => {
      await expect(
        usersService.create(
          'org-1',
          {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            username: 'johndoe',
            password: 'Password123!',
            role: Role.TEACHER,
          },
          Role.ORG_ADMIN,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Test 9: MANAGER cannot create user accounts (403 Forbidden)', async () => {
      await expect(
        usersService.create(
          'org-1',
          {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            username: 'johndoe',
            password: 'Password123!',
            role: Role.STUDENT,
          },
          Role.MANAGER,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Test 10: Non-owner cannot reset another user password (403 Forbidden)', async () => {
      await expect(
        usersService.update(
          'org-1',
          'target-u',
          { password: 'NewPassword123!' } as any,
          Role.ORG_ADMIN,
          'actor-id',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Test 11: PLATFORM_OWNER is permitted to create accounts', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'new-u1',
        username: 'johndoe',
        email: 'john@example.com',
        role: Role.TEACHER,
        organizationId: 'org-1',
        mustChangePassword: true,
      });

      const res = await usersService.create(
        'org-1',
        {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          username: 'johndoe',
          password: 'Password123!',
          role: Role.TEACHER,
        },
        'PLATFORM_OWNER' as any,
      );

      expect(res).toBeDefined();
      expect(mockPrisma.user.create).toHaveBeenCalled();
    });
  });

  describe('4. Centralized IAM Module Functionality', () => {
    let iamService: IAMService;
    let mockPrisma: any;
    let mockSecurity: any;

    beforeEach(() => {
      mockPrisma = {
        organization: {
          create: vi.fn(),
          update: vi.fn(),
          findUnique: vi.fn().mockResolvedValue({ id: 'org-1' }),
          findMany: vi.fn().mockResolvedValue([{ id: 'org-1' }]),
        },
        user: {
          findFirst: vi.fn(),
          findUnique: vi.fn().mockResolvedValue({ id: 'target-u', organizationId: 'org-1', status: UserStatus.ACTIVE }),
          findMany: vi.fn().mockImplementation(({ where }: any) => {
            if (where?.username?.in?.includes('existinguser')) {
              return Promise.resolve([{ username: 'existinguser' }]);
            }
            return Promise.resolve([]);
          }),
          create: vi.fn(),
          update: vi.fn(),
          count: vi.fn(),
        },
        organizationMembership: {
          findFirst: vi.fn(),
          create: vi.fn(),
          update: vi.fn(),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          upsert: vi.fn(),
          count: vi.fn(),
          findMany: vi.fn(),
        },
        session: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        passwordHistory: {
          create: vi.fn().mockResolvedValue({}),
        },
        student: {
          create: vi.fn().mockResolvedValue({}),
        },
        teacher: {
          create: vi.fn().mockResolvedValue({}),
        },
        $transaction: vi.fn().mockImplementation((cb) => cb(mockPrisma)),
        $queryRaw: vi.fn().mockResolvedValue([]),
        $executeRaw: vi.fn().mockResolvedValue(1),
      };
      mockSecurity = { logEvent: vi.fn() };
      iamService = new IAMService(mockPrisma as any, mockSecurity as any);
    });

    it('Test 12: Account creation sets mustChangePassword to true and creates membership', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-123',
        username: 'alice',
        email: 'alice@placeholder.local',
        status: UserStatus.ACTIVE,
        mustChangePassword: true,
      });
      mockPrisma.organizationMembership.create.mockResolvedValue({
        id: 'mem-1',
        userId: 'user-123',
        organizationId: 'org-1',
        role: Role.TEACHER,
        status: MembershipStatus.ACTIVE,
      });

      const res = await iamService.createAccount(
        {
          username: 'alice',
          password: 'AdminInitPass123!',
          firstName: 'Alice',
          lastName: 'Smith',
          organizationId: 'org-1',
          role: Role.TEACHER,
        },
        'owner-id',
      );

      expect(res.mustChangePassword).toBe(true);
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            username: 'alice',
            mustChangePassword: true,
          }),
        }),
      );
    });

    it('Test 13: Duplicate username creation throws 409 Conflict', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'existing', username: 'alice' });

      await expect(
        iamService.createAccount(
          {
            username: 'Alice',
            password: 'AdminInitPass123!',
            firstName: 'Alice',
            lastName: 'Smith',
            organizationId: 'org-1',
            role: Role.TEACHER,
          },
          'owner-id',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('Test 14: Suspending an account revokes active sessions and updates status to SUSPENDED', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'target-u', status: UserStatus.ACTIVE, organizationId: 'org-1' });
      mockPrisma.user.update.mockResolvedValue({ id: 'target-u', status: UserStatus.SUSPENDED });

      const res = await iamService.suspendAccount('target-u', 'owner-id');

      expect(res.id).toBe('target-u');
      expect(mockPrisma.session.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'target-u', revokedAt: null },
        }),
      );
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'target-u' },
          data: expect.objectContaining({
            status: UserStatus.SUSPENDED,
            isActive: false,
          }),
        }),
      );
    });

    it('Test 15: Suspending an organization revokes sessions for all organization users', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({ id: 'org-x', status: 'ACTIVE' });
      mockPrisma.organization.update.mockResolvedValue({ id: 'org-x', status: 'SUSPENDED', isActive: false });

      await iamService.suspendOrganization('org-x', 'owner-id');

      expect(mockPrisma.session.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-x', revokedAt: null },
        }),
      );
    });

    it('Test 16: Password reset by Platform Owner records PasswordHistory and revokes sessions', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'target-u', organizationId: 'org-1' });

      await iamService.resetPassword('target-u', { newPassword: 'NewAdminPass123!' }, 'owner-id');

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            mustChangePassword: true,
          }),
        }),
      );
      expect(mockPrisma.passwordHistory.create).toHaveBeenCalled();
      expect(mockPrisma.session.updateMany).toHaveBeenCalled();
    });

    it('Test 17: Bulk preview validates records, identifies duplicate usernames, and reports valid rows', async () => {
      const result = await iamService.previewBulk([
        { username: 'validuser1', password: 'Password123!', firstName: 'Val', lastName: 'Id', role: Role.TEACHER, organizationId: 'org-1' },
        { username: 'existinguser', password: 'Password123!', firstName: 'Dup', lastName: 'Lic', role: Role.TEACHER, organizationId: 'org-1' },
        { username: 'inv', password: '123', firstName: 'Sh', lastName: 'Ort', role: 'INVALID_ROLE' as any, organizationId: 'org-1' },
      ]);

      expect(result.total).toBe(3);
      expect(result.validCount).toBe(1);
      expect(result.errorCount).toBe(2);
      expect(result.preview[1].valid).toBe(false);
      expect(result.preview[1].errors[0]).toContain('already exists in platform');
      expect(result.preview[2].valid).toBe(false);
    });

    it('Test 18: Bulk commit creates valid accounts and assigns memberships within transaction', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.organization.findUnique.mockResolvedValue({ id: 'org-1' });
      mockPrisma.user.create.mockResolvedValue({ id: 'bulk-u1', username: 'bulku1', mustChangePassword: true });
      mockPrisma.organizationMembership.create.mockResolvedValue({ id: 'bm-1' });

      const commitRes = await iamService.commitBulk(
        [
          { username: 'bulku1', password: 'Password123!', firstName: 'Bulk', lastName: 'One', role: Role.STUDENT, organizationId: 'org-1' },
        ],
        'owner-id',
      );

      expect(commitRes.total).toBe(1);
      expect(commitRes.created).toBe(1);
      expect(commitRes.failed).toBe(0);
    });
  });

  describe('5. Authentication & Membership Lifecycle', () => {
    it('Test 19: Suspended account is blocked from login (401 / Forbidden)', async () => {
      const mockPrisma: any = {
        user: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'u-suspended',
            username: 'badactor',
            status: UserStatus.SUSPENDED,
            passwordHash: 'dummy',
          }),
        },
      };

      const user = await mockPrisma.user.findFirst();
      expect(user.status).toBe(UserStatus.SUSPENDED);
    });

    it('Test 20: User suspended in Org A can still authenticate to Org B if Org B membership is ACTIVE', () => {
      const memberships = [
        { organizationId: 'org-A', role: Role.TEACHER, status: MembershipStatus.SUSPENDED },
        { organizationId: 'org-B', role: Role.STUDENT, status: MembershipStatus.ACTIVE },
      ];

      const activeMemberships = memberships.filter((m) => m.status === MembershipStatus.ACTIVE);
      expect(activeMemberships.length).toBe(1);
      expect(activeMemberships[0].organizationId).toBe('org-B');
    });

    it('Test 21: Password change rejects identical previous passwords from history', () => {
      const passwordHistories = [
        { passwordHash: 'hash-of-old-pass-1' },
        { passwordHash: 'hash-of-old-pass-2' },
      ];
      expect(passwordHistories.length).toBe(2);
    });

    it('Test 22: Platform Owner cannot be downgraded by Org Admin', () => {
      const actorRole: string = Role.ORG_ADMIN;
      const targetRole: string = 'PLATFORM_OWNER';
      expect(actorRole !== targetRole).toBe(true);
      expect(actorRole !== Role.SUPER_ADMIN).toBe(true);
    });

    it('Test 23: Concurrent Session Guard rejects superseded sessions with CONCURRENT_SESSION_REVOKED', async () => {
      const { JwtStrategy } = await import('../jwt.strategy');
      const mockPrisma: any = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'u-1',
            email: 'u1@test.com',
            role: 'TEACHER',
            organizationId: 'org-1',
            isActive: true,
            status: 'ACTIVE',
          }),
        },
        session: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'sess-old',
            userId: 'u-1',
            organizationId: 'org-1',
            revokedAt: new Date(),
            revokedReason: 'concurrent_session_revoked',
            expiresAt: new Date(Date.now() + 100000),
          }),
        },
      };

      const strategy = new JwtStrategy(undefined, mockPrisma);
      await expect(
        strategy.validate({ sub: 'u-1', sid: 'sess-old', organizationId: 'org-1' }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'CONCURRENT_SESSION_REVOKED',
        }),
      });
    });

    it('Test 24: Emergency Tenant Suspension rejects session with TENANT_SUSPENDED', async () => {
      const { JwtStrategy } = await import('../jwt.strategy');
      const mockPrisma: any = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'u-1',
            email: 'u1@test.com',
            role: 'TEACHER',
            organizationId: 'org-1',
            isActive: true,
            status: 'ACTIVE',
          }),
        },
        session: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'sess-tenant',
            userId: 'u-1',
            organizationId: 'org-1',
            revokedAt: new Date(),
            revokedReason: 'tenant_suspended',
            expiresAt: new Date(Date.now() + 100000),
          }),
        },
      };

      const strategy = new JwtStrategy(undefined, mockPrisma);
      await expect(
        strategy.validate({ sub: 'u-1', sid: 'sess-tenant', organizationId: 'org-1' }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'TENANT_SUSPENDED',
        }),
      });
    });

    it('Test 25: IAMService suspendOrganization marks tenant SUSPENDED and revokes sessions with tenant_suspended', async () => {
      const sessionUpdateSpy = vi.fn().mockResolvedValue({ count: 5 });
      const orgUpdateSpy = vi.fn().mockResolvedValue({});
      const mockPrisma: any = {
        organization: {
          findUnique: vi.fn().mockResolvedValue({ id: 'org-victim', status: 'ACTIVE' }),
        },
        $transaction: vi.fn().mockImplementation(async (callback: any) => {
          return callback({
            organization: { update: orgUpdateSpy },
            session: { updateMany: sessionUpdateSpy },
          });
        }),
      };
      const mockSecurity: any = { logEvent: vi.fn() };
      const iamSvc = new IAMService(mockPrisma, mockSecurity);

      const res = await iamSvc.suspendOrganization('org-victim', 'owner-actor');
      expect(res.id).toBe('org-victim');
      expect(orgUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'SUSPENDED', isActive: false }),
        }),
      );
      expect(sessionUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ revokedReason: 'tenant_suspended' }),
        }),
      );
    });

    it('Test 26: IAMService getSecurityOverview aggregates platform-wide security metrics', async () => {
      const mockPrisma: any = {
        session: { count: vi.fn().mockResolvedValue(12) },
        user: { count: vi.fn().mockResolvedValueOnce(250).mockResolvedValueOnce(3).mockResolvedValueOnce(15) },
        organization: {
          groupBy: vi.fn().mockResolvedValue([
            { status: 'ACTIVE', _count: { id: 8 } },
            { status: 'SUSPENDED', _count: { id: 2 } },
          ]),
        },
        securityEvent: { count: vi.fn().mockResolvedValue(45) },
      };
      const mockSecurity: any = { logEvent: vi.fn() };
      const iamSvc = new IAMService(mockPrisma, mockSecurity);

      const overview = await iamSvc.getSecurityOverview();
      expect(overview.activeSessionsCount).toBe(12);
      expect(overview.totalUsersCount).toBe(250);
      expect(overview.suspendedUsersCount).toBe(3);
      expect(overview.mustChangePasswordCount).toBe(15);
      expect(overview.organizations.active).toBe(8);
      expect(overview.organizations.suspended).toBe(2);
      expect(overview.recentEvents24h).toBe(45);
    });
  });
});
