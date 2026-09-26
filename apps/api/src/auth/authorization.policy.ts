/**
 * Central authorization policy for M-EDU.
 *
 * Single source of truth for "which roles belong to which trust surface".
 * Controllers import these groups instead of re-typing role strings, so the
 * product intent is expressed once and cannot silently drift per endpoint.
 *
 * Trust surfaces
 * --------------
 *  - ADMIN_ROLES   : money, billing, HR/payroll, platform settings.
 *                    Financial or employment data. Never family roles.
 *  - STAFF_ROLES   : everything an employee may read (roster, catalogue,
 *                    schedule, analytics …). Includes teachers/assistants.
 *  - FAMILY_ROLES  : accounts that only ever see their OWN data
 *                    (`PARENT` = ParentAccount login, `STUDENT` = student
 *                    login). These roles are DENIED on every endpoint that is
 *                    merely `@AllowAnyRole()` unless the endpoint explicitly
 *                    opts in with `@AllowSelfService()` / `@Roles(...)`.
 *
 * Rules of engagement for new endpoints
 * -------------------------------------
 *   1. Prefer `@Roles(...ADMIN_ROLES)` / `@Roles(...STAFF_ROLES)` — explicit.
 *   2. `@AllowAnyRole()` means "any STAFF role" (family roles excluded).
 *   3. `@AllowSelfService()` is the ONLY way to admit PARENT/STUDENT without
 *      listing roles, and it must be used exclusively for endpoints that read
 *      or mutate the caller's own account/settings/notifications.
 */

import { Role } from '@prisma/client';

/** Roles that may touch money, billing, payroll and platform configuration. */
export const ADMIN_ROLES: readonly Role[] = [Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.MANAGER];

/** Every internal employee role (no family/self-service accounts). */
export const STAFF_ROLES: readonly Role[] = [
  Role.SUPER_ADMIN,
  Role.ORG_ADMIN,
  Role.MANAGER,
  Role.TEACHER,
  Role.ASSISTANT,
];

/** Accounts restricted to their own data only. */
export const FAMILY_ROLES: readonly Role[] = [Role.PARENT, Role.STUDENT];

/** Teaching + administration (used for read-only rosters the staff needs). */
export const TEACHING_ROLES: readonly Role[] = [Role.TEACHER, Role.ASSISTANT];

const FAMILY_ROLE_SET: ReadonlySet<string> = new Set<string>(FAMILY_ROLES);

/** True when the role belongs to the restricted self-service surface. */
export function isFamilyRole(role: string | undefined | null): boolean {
  return typeof role === 'string' && FAMILY_ROLE_SET.has(role);
}

/**
 * Privileged roles (audit P0-2).
 *
 * Every staff / administrative role. A verified Google email is NOT proof
 * that the holder of a teacher, manager or admin account is the person who
 * controls that Google mailbox, so these roles are NEVER linked to an
 * external identity provider on an email match alone.
 */
export const PRIVILEGED_ROLES: readonly Role[] = STAFF_ROLES;

const PRIVILEGED_ROLE_SET: ReadonlySet<string> = new Set<string>(
  PRIVILEGED_ROLES,
);

/** True when the role must never be auto-linked on an email match. */
export function isPrivilegedRole(role: string | undefined | null): boolean {
  return typeof role === 'string' && PRIVILEGED_ROLE_SET.has(role);
}
