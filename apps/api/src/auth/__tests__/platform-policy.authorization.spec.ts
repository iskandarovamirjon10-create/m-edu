import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';

import { AuthService } from '../auth.service';
import { AuthController } from '../auth.controller';
import type { PrismaService } from '../../prisma/prisma.service';
import type { SecurityEventService } from '../../common/security/security-event.service';

/**
 * Regression suite for the platform/tenant privilege boundary.
 *
 * Two production bugs pinned here:
 *
 *  1. `POST /auth/whitelist/settings` mutated the SINGLE `id: 'global'`
 *     access-control row while allowing `ORG_ADMIN` — tenant A could flip
 *     tenant B's registration policy.
 *  2. `DELETE /auth/whitelist/:id` was called WITHOUT the caller's
 *     (role, organizationId), so the ownership check compared against
 *     `undefined` and every ORG_ADMIN could delete any tenant's entry.
 */
describe('Platform policy authorization', () => {
  let prisma: any;
  let security: { logEvent: ReturnType<typeof vi.fn> };
  let svc: AuthService;

  const jwt = {
    sign: vi.fn((p: any) => `signed.${p.sub}`),
    decode: vi.fn(() => null),
  } as unknown as JwtService;

  beforeEach(() => {
    vi.clearAllMocks();
    security = { logEvent: vi.fn().mockResolvedValue(undefined) };
    prisma = {
      accessWhitelist: { findUnique: vi.fn(), delete: vi.fn() },
      accessControlConfig: {
        findUnique: vi.fn(),
        upsert: vi.fn().mockResolvedValue({ id: 'global', inviteOnly: true, requireApproval: true }),
      },
    };
    svc = new AuthService(
      prisma as unknown as PrismaService,
      jwt,
      security as unknown as SecurityEventService,
    );
  });

  describe('removeFromWhitelist', () => {
    it('DENIES an org admin deleting an entry owned by another organization', async () => {
      prisma.accessWhitelist.findUnique.mockResolvedValue({
        id: 'wl-1',
        email: 'x@b.uz',
        organizationId: 'org-2',
      });

      await expect(
        svc.removeFromWhitelist('wl-1', 'admin-a', 'ORG_ADMIN', 'org-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(prisma.accessWhitelist.delete).not.toHaveBeenCalled();
      expect(security.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'CROSS_TENANT_ACCESS_ATTEMPT',
          success: false,
        }),
      );
    });

    it('DENIES when the caller has no organization scope (fail-closed)', async () => {
      prisma.accessWhitelist.findUnique.mockResolvedValue({
        id: 'wl-1',
        email: 'x@b.uz',
        organizationId: 'org-2',
      });

      await expect(
        svc.removeFromWhitelist('wl-1', 'admin-a', 'ORG_ADMIN', undefined),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(prisma.accessWhitelist.delete).not.toHaveBeenCalled();
    });

    it('DENIES an org admin deleting a tenant-less (global) entry', async () => {
      prisma.accessWhitelist.findUnique.mockResolvedValue({
        id: 'wl-global',
        email: 'global@b.uz',
        organizationId: null,
      });

      await expect(
        svc.removeFromWhitelist('wl-global', 'admin-a', 'ORG_ADMIN', 'org-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('ALLOWS a platform role to delete a tenant-less (global) entry', async () => {
      prisma.accessWhitelist.findUnique.mockResolvedValue({
        id: 'wl-global',
        email: 'global@b.uz',
        organizationId: null,
      });
      prisma.accessWhitelist.delete.mockResolvedValue({ id: 'wl-global' });

      const res = await svc.removeFromWhitelist(
        'wl-global',
        'owner-1',
        'PLATFORM_OWNER',
        'org-1',
      );

      expect(res.success).toBe(true);
      expect(prisma.accessWhitelist.delete).toHaveBeenCalledWith({
        where: { id: 'wl-global' },
      });
    });

    it('ALLOWS an org admin to delete an entry of their OWN organization', async () => {
      prisma.accessWhitelist.findUnique.mockResolvedValue({
        id: 'wl-mine',
        email: 'mine@b.uz',
        organizationId: 'org-1',
      });
      prisma.accessWhitelist.delete.mockResolvedValue({ id: 'wl-mine' });

      const res = await svc.removeFromWhitelist(
        'wl-mine',
        'admin-a',
        'ORG_ADMIN',
        'org-1',
      );

      expect(res.success).toBe(true);
    });
  });

  describe('updateAccessControlConfig (global `id: global` row)', () => {
    const payload = { inviteOnly: true, requireApproval: true };

    it('DENIES an ORG_ADMIN — the row is shared by every tenant', async () => {
      await expect(
        svc.updateAccessControlConfig(payload, 'admin-a', 'ORG_ADMIN', 'org-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(prisma.accessControlConfig.upsert).not.toHaveBeenCalled();
      expect(security.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'UNAUTHORIZED_RESOURCE_ACCESS',
          resourceType: 'AccessControlConfig',
          success: false,
        }),
      );
    });

    it('DENIES a caller whose role was not supplied (fail-closed)', async () => {
      await expect(
        svc.updateAccessControlConfig(payload, 'admin-a', undefined, 'org-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(prisma.accessControlConfig.upsert).not.toHaveBeenCalled();
    });

    it('ALLOWS SUPER_ADMIN', async () => {
      const res = await svc.updateAccessControlConfig(
        payload,
        'root',
        'SUPER_ADMIN',
        'org-1',
      );

      expect(prisma.accessControlConfig.upsert).toHaveBeenCalledTimes(1);
      expect(res.inviteOnly).toBe(true);
    });

    it('ALLOWS PLATFORM_OWNER', async () => {
      await expect(
        svc.updateAccessControlConfig(payload, 'owner', 'PLATFORM_OWNER'),
      ).resolves.toBeDefined();
      expect(prisma.accessControlConfig.upsert).toHaveBeenCalledTimes(1);
    });
  });

  describe('AuthController wiring', () => {
    function makeController() {
      const authService = {
        removeFromWhitelist: vi.fn().mockResolvedValue({ success: true }),
        updateAccessControlConfig: vi.fn().mockResolvedValue({}),
      };
      const controller = new AuthController(
        authService as never,
        {} as never,
      );
      return { controller, authService };
    }

    const orgAdminReq = {
      user: { sub: 'admin-a', role: 'ORG_ADMIN', organizationId: 'org-1' },
    };

    it('passes the caller identity into removeFromWhitelist', async () => {
      const { controller, authService } = makeController();

      await controller.removeFromWhitelist('wl-1', orgAdminReq as never);

      expect(authService.removeFromWhitelist).toHaveBeenCalledWith(
        'wl-1',
        'admin-a',
        'ORG_ADMIN',
        'org-1',
      );
    });

    it('passes the caller role into updateAccessControlSettings', async () => {
      const { controller, authService } = makeController();

      await controller.updateAccessControlSettings(
        { inviteOnly: true, requireApproval: true },
        orgAdminReq as never,
      );

      expect(authService.updateAccessControlConfig).toHaveBeenCalledWith(
        expect.objectContaining({ inviteOnly: true }),
        'admin-a',
        'ORG_ADMIN',
        'org-1',
      );
    });

    it('exposes the global settings route ONLY to platform roles', () => {
      const handler = Reflect.getMetadata(
        'roles',
        AuthController.prototype.updateAccessControlSettings,
      ) as string[] | undefined;

      expect(handler).toEqual(
        expect.arrayContaining(['SUPER_ADMIN', 'PLATFORM_OWNER']),
      );
      expect(handler).not.toContain('ORG_ADMIN');
    });
  });
});
