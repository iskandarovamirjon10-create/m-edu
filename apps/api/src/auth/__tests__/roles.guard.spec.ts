import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { RolesGuard } from '../roles.guard';
import { ALLOW_ANY_ROLE_KEY, ALLOW_SELF_SERVICE_KEY, ROLES_KEY } from '../roles.decorator';
import { FAMILY_ROLES, STAFF_ROLES } from '../authorization.policy';

/**
 * Authorization matrix for the centralized policy (F-001 / F-020).
 *
 * | decorator            | staff | PARENT | STUDENT |
 * |----------------------|-------|--------|---------|
 * | @Roles(explicit)     | list  | list   | list    |
 * | @AllowSelfService()  | yes   | yes    | yes     |
 * | @AllowAnyRole()      | yes   | NO     | NO      |
 * | (nothing)            | NO    | NO     | NO      |
 */
describe('RolesGuard — authorization matrix', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    reflector = { getAllAndOverride: vi.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  function makeContext(user?: unknown): ExecutionContext {
    return {
      getHandler: () => () => {},
      getClass: () => class {},
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  }

  /** Reflector stub driven by metadata key. */
  function withMetadata(meta: {
    roles?: string[];
    allowAnyRole?: boolean;
    allowSelfService?: boolean;
  }) {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === ROLES_KEY) return meta.roles;
      if (key === ALLOW_ANY_ROLE_KEY) return meta.allowAnyRole;
      if (key === ALLOW_SELF_SERVICE_KEY) return meta.allowSelfService;
      return undefined;
    });
  }

  describe('@AllowAnyRole() = any STAFF role, never family accounts', () => {
    beforeEach(() => withMetadata({ allowAnyRole: true }));

    it.each([...STAFF_ROLES])('allows staff role %s', (role) => {
      expect(guard.canActivate(makeContext({ role }))).toBe(true);
    });

    it.each([...FAMILY_ROLES])('DENIES family role %s', (role) => {
      expect(guard.canActivate(makeContext({ role }))).toBe(false);
    });

    it('allows SUPER_ADMIN (platform bypass)', () => {
      expect(guard.canActivate(makeContext({ role: 'SUPER_ADMIN' }))).toBe(true);
    });

    it('denies an unauthenticated request', () => {
      expect(guard.canActivate(makeContext(undefined))).toBe(false);
    });

    it('denies a principal without a role', () => {
      expect(guard.canActivate(makeContext({ email: 'test@example.com' }))).toBe(false);
    });
  });

  describe('@AllowSelfService() = any authenticated principal', () => {
    beforeEach(() => withMetadata({ allowSelfService: true }));

    it.each([...STAFF_ROLES, ...FAMILY_ROLES])('allows %s', (role) => {
      expect(guard.canActivate(makeContext({ role }))).toBe(true);
    });

    it('denies an unauthenticated request', () => {
      expect(guard.canActivate(makeContext(undefined))).toBe(false);
    });
  });

  describe('@Roles(...) is authoritative', () => {
    it('allows a listed role', () => {
      withMetadata({ roles: ['SUPER_ADMIN', 'ORG_ADMIN'] });
      expect(guard.canActivate(makeContext({ role: 'ORG_ADMIN' }))).toBe(true);
    });

    it('denies an unlisted role', () => {
      withMetadata({ roles: ['SUPER_ADMIN'] });
      expect(guard.canActivate(makeContext({ role: 'TEACHER' }))).toBe(false);
    });

    it('denies a family role that is not listed', () => {
      withMetadata({ roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER'] });
      expect(guard.canActivate(makeContext({ role: 'PARENT' }))).toBe(false);
      expect(guard.canActivate(makeContext({ role: 'STUDENT' }))).toBe(false);
    });

    it('allows PARENT/STUDENT when explicitly listed', () => {
      withMetadata({ roles: ['PARENT'] });
      expect(guard.canActivate(makeContext({ role: 'PARENT' }))).toBe(true);

      withMetadata({ roles: ['STUDENT'] });
      expect(guard.canActivate(makeContext({ role: 'STUDENT' }))).toBe(true);
    });

    it('an explicit role list cannot be widened by a leftover @AllowAnyRole()', () => {
      withMetadata({ roles: ['SUPER_ADMIN', 'ORG_ADMIN'], allowAnyRole: true });
      expect(guard.canActivate(makeContext({ role: 'STUDENT' }))).toBe(false);
      expect(guard.canActivate(makeContext({ role: 'PARENT' }))).toBe(false);
    });

    it('allows SUPER_ADMIN to bypass any required roles', () => {
      withMetadata({ roles: ['ORG_ADMIN', 'MANAGER'] });
      expect(guard.canActivate(makeContext({ role: 'SUPER_ADMIN' }))).toBe(true);
    });
  });

  describe('secure default', () => {
    it('denies when neither @Roles nor an opt-in decorator is declared', () => {
      withMetadata({});
      expect(guard.canActivate(makeContext({ role: 'ORG_ADMIN' }))).toBe(false);
      expect(guard.canActivate(makeContext({ role: 'STUDENT' }))).toBe(false);
    });

    it('denies when nothing is declared but the principal is a platform admin', () => {
      withMetadata({});
      expect(guard.canActivate(makeContext({ role: 'SUPER_ADMIN' }))).toBe(true);
    });
  });
});

