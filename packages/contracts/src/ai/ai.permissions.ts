/**
 * Canonical AI permission catalog.
 *
 * The legacy Copilot guessed permissions from string suffixes
 * (`students:read`.endsWith(':read')). That heuristic is replaced by this
 * explicit catalog, shared by the backend policy engine and the tests.
 */

export const AiPermission = {
  STUDENTS_READ: 'students:read',
  STUDENTS_WRITE: 'students:write',
  TEACHERS_READ: 'teachers:read',
  TEACHERS_WRITE: 'teachers:write',
  GROUPS_READ: 'groups:read',
  GROUPS_WRITE: 'groups:write',
  COURSES_READ: 'courses:read',
  COURSES_WRITE: 'courses:write',
  ATTENDANCE_READ: 'attendance:read',
  ATTENDANCE_WRITE: 'attendance:write',
  SCHEDULE_READ: 'schedule:read',
  SCHEDULE_WRITE: 'schedule:write',
  LESSONS_READ: 'lessons:read',
  PAYMENTS_READ: 'payments:read',
  PAYMENTS_WRITE: 'payments:write',
  DASHBOARD_READ: 'dashboard:read',
  REPORTS_READ: 'reports:read',
  NOTIFICATIONS_READ: 'notifications:read',
  NOTIFICATIONS_WRITE: 'notifications:write',
  LEADS_READ: 'leads:read',
  LEADS_WRITE: 'leads:write',
  FINANCE_READ: 'finance:read',
  FINANCE_WRITE: 'finance:write',
  BIOMETRICS_READ: 'biometrics:read',
  INVENTORY_READ: 'inventory:read',
  EXAMS_READ: 'exams:read',
  EXAMS_WRITE: 'exams:write',
} as const;
export type AiPermission = (typeof AiPermission)[keyof typeof AiPermission];

const ALL_AI_PERMISSIONS = Object.values(AiPermission);

const READ_ONLY_AI_PERMISSIONS: AiPermission[] = [
  AiPermission.STUDENTS_READ,
  AiPermission.TEACHERS_READ,
  AiPermission.GROUPS_READ,
  AiPermission.COURSES_READ,
  AiPermission.ATTENDANCE_READ,
  AiPermission.SCHEDULE_READ,
  AiPermission.LESSONS_READ,
  AiPermission.PAYMENTS_READ,
  AiPermission.DASHBOARD_READ,
  AiPermission.REPORTS_READ,
  AiPermission.NOTIFICATIONS_READ,
  AiPermission.LEADS_READ,
  AiPermission.FINANCE_READ,
  AiPermission.BIOMETRICS_READ,
  AiPermission.INVENTORY_READ,
  AiPermission.EXAMS_READ,
];

/** Role → AI permissions. Unknown/absent roles get nothing. */
export const AiRolePermissions: Record<string, AiPermission[]> = {
  SUPER_ADMIN: ALL_AI_PERMISSIONS,
  ORG_ADMIN: ALL_AI_PERMISSIONS,
  // Legacy alias kept for callers that still emit `ADMIN` (older JWTs/tests).
  ADMIN: ALL_AI_PERMISSIONS,
  MANAGER: [
    ...READ_ONLY_AI_PERMISSIONS,
    AiPermission.ATTENDANCE_WRITE,
    AiPermission.SCHEDULE_WRITE,
    AiPermission.STUDENTS_WRITE,
    AiPermission.TEACHERS_WRITE,
    AiPermission.GROUPS_WRITE,
    AiPermission.COURSES_WRITE,
    AiPermission.NOTIFICATIONS_WRITE,
    AiPermission.LEADS_WRITE,
    AiPermission.FINANCE_WRITE,
    AiPermission.EXAMS_WRITE,
  ],
  // Finance staff read money but must not change rosters or the catalogue.
  ACCOUNTANT: [
    AiPermission.STUDENTS_READ,
    AiPermission.GROUPS_READ,
    AiPermission.PAYMENTS_READ,
    AiPermission.PAYMENTS_WRITE,
    AiPermission.FINANCE_READ,
    AiPermission.FINANCE_WRITE,
    AiPermission.DASHBOARD_READ,
    AiPermission.REPORTS_READ,
    AiPermission.INVENTORY_READ,
  ],
  TEACHER: [
    AiPermission.STUDENTS_READ,
    AiPermission.ATTENDANCE_READ,
    AiPermission.ATTENDANCE_WRITE,
    AiPermission.SCHEDULE_READ,
    AiPermission.LESSONS_READ,
    AiPermission.EXAMS_READ,
    AiPermission.EXAMS_WRITE,
  ],
  ASSISTANT: [AiPermission.STUDENTS_READ, AiPermission.ATTENDANCE_READ],
  STUDENT: [],
  PARENT: [],
};

export function aiPermissionsForRole(role: string): AiPermission[] {
  // Prototype-key safety: `AiRolePermissions['constructor']` / `['toString']`
  // resolve to a Function via the prototype chain and would break callers
  // that iterate/includes over the result.
  return (
    typeof role === 'string' &&
    Object.prototype.hasOwnProperty.call(AiRolePermissions, role)
      ? AiRolePermissions[role]
      : []
  );
}

export function hasAiPermission(permissions: readonly string[], required: string): boolean {
  return permissions.includes(required);
}
