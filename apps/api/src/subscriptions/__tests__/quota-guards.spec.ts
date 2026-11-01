import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuotaGuard } from '../guards/quota.guard';
import { EntitlementGuard } from '../guards/entitlement.guard';
import { ForbiddenException } from '@nestjs/common';

describe('QuotaGuard & EntitlementGuard — Subscription Enforcement', () => {
  let quotaGuard: QuotaGuard;
  let entitlementGuard: EntitlementGuard;
  let reflector: any;
  let subscriptionsService: any;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: vi.fn(),
    };
    subscriptionsService = {
      checkQuota: vi.fn(),
      checkEntitlement: vi.fn(),
    };

    quotaGuard = new QuotaGuard(reflector, subscriptionsService);
    entitlementGuard = new EntitlementGuard(reflector, subscriptionsService);
  });

  describe('QuotaGuard', () => {
    function makeContext(user: any, headers = {}) {
      return {
        getHandler: vi.fn(),
        getClass: vi.fn(),
        switchToHttp: () => ({
          getRequest: () => ({ user, headers }),
        }),
      } as any;
    }

    it('passes through if no quota metadata is attached to the route', async () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);
      const allowed = await quotaGuard.canActivate(makeContext({ organizationId: 'org-1' }));
      expect(allowed).toBe(true);
      expect(subscriptionsService.checkQuota).not.toHaveBeenCalled();
    });

    it('allows PLATFORM_OWNER to bypass quota checks', async () => {
      reflector.getAllAndOverride.mockReturnValue('students');
      const allowed = await quotaGuard.canActivate(makeContext({ role: 'PLATFORM_OWNER', organizationId: 'org-1' }));
      expect(allowed).toBe(true);
      expect(subscriptionsService.checkQuota).not.toHaveBeenCalled();
    });

    it('calls subscriptionsService.checkQuota for tenant users and respects result', async () => {
      reflector.getAllAndOverride.mockReturnValue('students');
      subscriptionsService.checkQuota.mockResolvedValue({ allowed: true });

      const allowed = await quotaGuard.canActivate(makeContext({ role: 'ORG_ADMIN', organizationId: 'org-1' }));
      expect(allowed).toBe(true);
      expect(subscriptionsService.checkQuota).toHaveBeenCalledWith('org-1', 'students');
    });

    it('propagates ForbiddenException when quota is exhausted', async () => {
      reflector.getAllAndOverride.mockReturnValue('students');
      subscriptionsService.checkQuota.mockRejectedValue(new ForbiddenException('Quota exceeded'));

      await expect(
        quotaGuard.canActivate(makeContext({ role: 'ORG_ADMIN', organizationId: 'org-1' })),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('EntitlementGuard', () => {
    function makeContext(user: any) {
      return {
        getHandler: vi.fn(),
        getClass: vi.fn(),
        switchToHttp: () => ({
          getRequest: () => ({ user, headers: {} }),
        }),
      } as any;
    }

    it('allows access when organization is entitled to the feature', async () => {
      reflector.getAllAndOverride.mockReturnValue('hasFaceId');
      subscriptionsService.checkEntitlement.mockResolvedValue(true);

      const allowed = await entitlementGuard.canActivate(makeContext({ role: 'ORG_ADMIN', organizationId: 'org-1' }));
      expect(allowed).toBe(true);
      expect(subscriptionsService.checkEntitlement).toHaveBeenCalledWith('org-1', 'hasFaceId');
    });

    it('blocks access when feature is not included in current plan tier', async () => {
      reflector.getAllAndOverride.mockReturnValue('hasFaceId');
      subscriptionsService.checkEntitlement.mockRejectedValue(new ForbiddenException('Requires PRO'));

      await expect(
        entitlementGuard.canActivate(makeContext({ role: 'ORG_ADMIN', organizationId: 'org-1' })),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
