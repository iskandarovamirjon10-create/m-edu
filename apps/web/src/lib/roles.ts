import type { Role } from './types';

/**
 * Roles with administrative / management authority over the tenant.
 * Access to money, billing, HR/payroll, analytics, cameras, settings, audit.
 */
export const ADMIN_ROLES: readonly Role[] = [
  'SUPER_ADMIN',
  'ORG_ADMIN',
  'ADMIN',
  'MANAGER',
  'PLATFORM_OWNER',
];

/** Roles focused on classroom teaching, attendance, grading and homework. */
export const TEACHER_ROLES: readonly Role[] = ['TEACHER', 'ASSISTANT'];

/** Enrolled learners accessing their personal education schedule and records. */
export const STUDENT_ROLES: readonly Role[] = ['STUDENT'];

/** Family guardians monitoring their children's attendance, grades and invoices. */
export const PARENT_ROLES: readonly Role[] = ['PARENT'];

/**
 * Mirrors `STAFF_ROLES` in `apps/api/src/auth/authorization.policy.ts`.
 * Keep in sync: every employee role (excluding family roles).
 */
export const STAFF_ROLES: readonly Role[] = [
  'SUPER_ADMIN',
  'ORG_ADMIN',
  'ADMIN',
  'MANAGER',
  'TEACHER',
  'ASSISTANT',
  'PLATFORM_OWNER',
];

/** True for employee accounts — PARENT / STUDENT never pass. */
export function isStaffRole(role: string | null | undefined): boolean {
  return typeof role === 'string' && (STAFF_ROLES as readonly string[]).includes(role);
}

/** True for administrative roles with financial/system access. */
export function isAdminRole(role: string | null | undefined): boolean {
  return typeof role === 'string' && (ADMIN_ROLES as readonly string[]).includes(role);
}

/** True for classroom teachers and assistants. */
export function isTeacherRole(role: string | null | undefined): boolean {
  return typeof role === 'string' && (TEACHER_ROLES as readonly string[]).includes(role);
}

/** True for enrolled student accounts. */
export function isStudentRole(role: string | null | undefined): boolean {
  return typeof role === 'string' && (STUDENT_ROLES as readonly string[]).includes(role);
}

/** True for parent/guardian accounts. */
export function isParentRole(role: string | null | undefined): boolean {
  return typeof role === 'string' && (PARENT_ROLES as readonly string[]).includes(role);
}

/**
 * Mirrors `PLATFORM_ROLES` in `apps/api/src/auth/authorization.policy.ts`.
 */
export const PLATFORM_ROLES: readonly Role[] = ['PLATFORM_OWNER'];

export function isPlatformRole(role: string | null | undefined): boolean {
  return typeof role === 'string' && (PLATFORM_ROLES as readonly string[]).includes(role);
}

/** Returns the dedicated home landing route for a specific user role. */
export function getRoleDefaultLandingPath(role: string | null | undefined): string {
  const normalized = (role ?? '').toUpperCase();
  if (normalized === 'TEACHER' || normalized === 'ASSISTANT') {
    return '/teacher-cockpit';
  }
  if (normalized === 'PARENT') {
    return '/parent-portal';
  }
  if (normalized === 'STUDENT') {
    return '/schedule';
  }
  return '/';
}

