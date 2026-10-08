import type { Role } from './types';

/**
 * Mirrors `STAFF_ROLES` in `apps/api/src/auth/authorization.policy.ts`.
 *
 * Keep the two lists in sync: every route / nav entry gated with these roles
 * must have the matching `@Roles(...)` on the API controller it calls.
 */
export const STAFF_ROLES: readonly Role[] = [
  'SUPER_ADMIN',
  'ORG_ADMIN',
  'MANAGER',
  'TEACHER',
  'ASSISTANT',
];

/** True for employee accounts — PARENT / STUDENT never pass. */
export function isStaffRole(role: string | null | undefined): boolean {
  return typeof role === 'string' && (STAFF_ROLES as readonly string[]).includes(role);
}

/**
 * Mirrors `PLATFORM_ROLES` in `apps/api/src/auth/authorization.policy.ts`.
 *
 * Platform-wide policy rows (the global access-control configuration) are
 * only writable by these roles — an ORG_ADMIN administers one tenant, not the
 * registration policy of every other tenant.
 */
export const PLATFORM_ROLES: readonly Role[] = ['SUPER_ADMIN', 'PLATFORM_OWNER'];

export function isPlatformRole(role: string | null | undefined): boolean {
  return typeof role === 'string' && (PLATFORM_ROLES as readonly string[]).includes(role);
}
