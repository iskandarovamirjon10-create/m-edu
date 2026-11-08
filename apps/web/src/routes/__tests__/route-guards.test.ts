import { describe, it, expect } from 'vitest';
import { routeConfig, type RouteConfig } from '../index';
import { ADMIN_ROLES, STAFF_ROLES } from '@/lib/roles';
import { sanitizeReturnTo } from '../guards';

function flattenRoutes(routes: RouteConfig[], prefix = ''): { path: string; roles?: readonly string[] }[] {
  const result: { path: string; roles?: readonly string[] }[] = [];
  for (const route of routes) {
    const fullPath = route.index
      ? prefix || '/'
      : `${prefix}/${route.path || ''}`.replace(/\/+/g, '/');

    if (route.path || route.index) {
      result.push({ path: fullPath, roles: route.roles });
    }
    if (route.children) {
      result.push(...flattenRoutes(route.children, fullPath));
    }
  }
  return result;
}

describe('Route RBAC Security (M-EDU-TEN-001)', () => {
  const allRoutes = flattenRoutes(routeConfig);
  const routeMap = new Map(allRoutes.map((r) => [r.path, r]));

  const adminOnlyPaths = [
    '/payments',
    '/invoices',
    '/reports',
    '/expenses',
    '/leads',
    '/teachers',
    '/students/new',
    '/students/:id/edit',
    '/groups/new',
    '/groups/:id/edit',
    '/cameras',
    '/users',
    '/audit',
    '/audit-timeline',
    '/inventory',
    '/early-warning',
    '/academic-risk',
    '/communication-history',
    '/resources',
  ];

  const staffOnlyPaths = [
    '/students',
    '/students/:id',
    '/students/:id/360',
    '/subjects',
    '/curriculum',
    '/assessment',
    '/courses',
    '/courses/:id',
    '/attendance',
    '/face',
    '/face/enroll',
    '/exams',
    '/certificates',
    '/certificates/:id',
  ];

  it.each(adminOnlyPaths)('requires ADMIN_ROLES for %s', (path) => {
    const route = routeMap.get(path);
    expect(route).toBeDefined();
    expect(route?.roles).toBeDefined();
    expect(route?.roles).toEqual(ADMIN_ROLES);
  });

  it.each(staffOnlyPaths)('requires STAFF_ROLES for %s', (path) => {
    const route = routeMap.get(path);
    expect(route).toBeDefined();
    expect(route?.roles).toBeDefined();
    expect(route?.roles).toEqual(STAFF_ROLES);
  });

  it('restricts parent-portal to PARENT and ADMIN_ROLES', () => {
    const route = routeMap.get('/parent-portal');
    expect(route).toBeDefined();
    expect(route?.roles).toEqual(['PARENT', ...ADMIN_ROLES]);
  });

  describe('sanitizeReturnTo (DEP-03 Open Redirect Protection)', () => {
    it('accepts safe internal paths', () => {
      expect(sanitizeReturnTo('/dashboard')).toBe('/dashboard');
      expect(sanitizeReturnTo('/students/123')).toBe('/students/123');
    });

    it('rejects protocol-relative and external domains', () => {
      expect(sanitizeReturnTo('//evil.com')).toBe('/');
      expect(sanitizeReturnTo('https://evil.com')).toBe('/');
      expect(sanitizeReturnTo('javascript:alert(1)')).toBe('/');
    });

    it('rejects backslash vectors (GHSA-wrjc-x8rr-h8h6)', () => {
      expect(sanitizeReturnTo('\\\\evil.com')).toBe('/');
      expect(sanitizeReturnTo('/\\evil.com')).toBe('/');
      expect(sanitizeReturnTo('/safe\\path')).toBe('/');
    });

    it('rejects CRLF injection', () => {
      expect(sanitizeReturnTo('/dashboard\r\nSet-Cookie:bad')).toBe('/');
    });
  });
});
