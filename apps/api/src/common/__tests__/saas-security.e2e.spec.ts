import { describe, it, expect } from 'vitest';
import { RolesGuard } from '../../auth/roles.guard';
import {
  ALLOW_ANY_ROLE_KEY,
  ALLOW_SELF_SERVICE_KEY,
  ROLES_KEY,
} from '../../auth/roles.decorator';
import {
  assertTenantOwnership,
  scopeToTenant,
} from '../tenant/tenant-scoping';

/**
 * SaaS Security Adversarial Tests (REAL assertions).
 *
 * These replaced the previous `expect(true).toBe(true)` placeholders which
 * always passed and gave CI false confidence (regression: F-05). They
 * exercise the actual guard/scoping code paths that enforce the advertised
 * SaaS boundaries:
 *   - invite/credential endpoints fail closed for unauthenticated callers
 *   - foreign tenancy cannot be read through tenant-scoped records
 *   - platform-owner (SUPER_ADMIN) superset semantics
 *   - non-owner tenant admins are denied platform-restricted endpoints
 */
describe('SaaS Security Adversarial Tests', () => {
  function runGuard(options: {
    role: string | null;
    routeRoles?: string[];
    allowAnyRole?: boolean;
    allowSelfService?: boolean;
  }): boolean {
    const request = { user: options.role ? { role: options.role } : undefined };
    const reflector = {
      getAllAndOverride: (key: string) => {
        if (key === ROLES_KEY) return options.routeRoles;
        if (key === ALLOW_ANY_ROLE_KEY) return options.allowAnyRole;
        if (key === ALLOW_SELF_SERVICE_KEY) return options.allowSelfService;
        return undefined;
      },
    } as any;
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    } as any;
    return new RolesGuard(reflector).canActivate(context);
  }

  it('no invite / anonymous request -> denied (fail closed)', () => {
    // No authenticated principal on a restricted route must never pass.
    expect(
      runGuard({ role: null, routeRoles: ['ORG_ADMIN', 'MANAGER', 'TEACHER'] }),
    ).toBe(false);
    expect(runGuard({ role: null, allowAnyRole: true })).toBe(false);
    expect(runGuard({ role: null, allowSelfService: true })).toBe(false);
  });

  it('invalid invite / wrong role -> denied', () => {
    // An authenticated TEACHER hitting an admin-only invite endpoint.
    expect(
      runGuard({ role: 'TEACHER', routeRoles: ['ORG_ADMIN', 'MANAGER'] }),
    ).toBe(false);
    // Family accounts are no staff, even on @AllowAnyRole() routes.
    expect(runGuard({ role: 'STUDENT', allowAnyRole: true })).toBe(false);
    expect(runGuard({ role: 'PARENT', allowAnyRole: true })).toBe(false);
  });

  it('cross-tenant read -> denied', () => {
    // scopeToTenant pins the org; assertTenantOwnership rejects foreign rows.
    const scoped = scopeToTenant({ id: 'stu-1' }, 'org-a');
    expect(scoped.organizationId).toBe('org-a');
    expect(() =>
      assertTenantOwnership({ id: 'stu-1', organizationId: 'org-b' }, 'org-a', 'Student'),
    ).toThrow(/Tenant isolation violation/);
    expect(() => assertTenantOwnership(null, 'org-a')).toThrow(/Tenant isolation violation/);
    expect(() => scopeToTenant({}, '')).toThrow(/Tenant scoping violation/);
  });

  it('platform owner (SUPER_ADMIN) -> allowed everywhere', () => {
    expect(runGuard({ role: 'SUPER_ADMIN', routeRoles: ['ORG_ADMIN'] })).toBe(true);
    expect(runGuard({ role: 'SUPER_ADMIN', allowAnyRole: true })).toBe(true);
  });

  it('tenant admin ORG_ADMIN is denied platform-restricted endpoints', () => {
    // Platform endpoints locked to SUPER_ADMIN (e.g. observability): a
    // tenant admin must be denied even though it passes most ORG_ADMIN routes.
    expect(runGuard({ role: 'ORG_ADMIN', routeRoles: ['SUPER_ADMIN'] })).toBe(false);
    expect(runGuard({ role: 'MANAGER', routeRoles: ['SUPER_ADMIN'] })).toBe(false);
  });
});
