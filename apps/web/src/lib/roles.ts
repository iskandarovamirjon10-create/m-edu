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
