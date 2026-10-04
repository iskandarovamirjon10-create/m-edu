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
  ATTENDANCE_READ: 'attendance:read',
  ATTENDANCE_WRITE: 'attendance:write',
  SCHEDULE_READ: 'schedule:read',
  SCHEDULE_WRITE: 'schedule:write',
  LESSONS_READ: 'lessons:read',
  PAYMENTS_READ: 'payments:read',
  PAYMENTS_WRITE: 'payments:write',
  DASHBOARD_READ: 'dashboard:read',
  REPORTS_READ: 'reports:read',
} as const;
export type AiPermission = (typeof AiPermission)[keyof typeof AiPermission];

const ALL_AI_PERMISSIONS = Object.values(AiPermission);

const READ_ONLY_AI_PERMISSIONS: AiPermission[] = [
  AiPermission.STUDENTS_READ,
  AiPermission.TEACHERS_READ,
  AiPermission.ATTENDANCE_READ,
  AiPermission.SCHEDULE_READ,
  AiPermission.LESSONS_READ,
  AiPermission.PAYMENTS_READ,
  AiPermission.DASHBOARD_READ,
  AiPermission.REPORTS_READ,
];

/** Role → AI permissions. Unknown/absent roles get nothing. */
export const AiRolePermissions: Record<string, AiPermission[]> = {
  SUPER_ADMIN: ALL_AI_PERMISSIONS,
  ORG_ADMIN: ALL_AI_PERMISSIONS,
  MANAGER: [
    ...READ_ONLY_AI_PERMISSIONS,
    AiPermission.ATTENDANCE_WRITE,
    AiPermission.SCHEDULE_WRITE,
    AiPermission.STUDENTS_WRITE,
  ],
  TEACHER: [
    AiPermission.STUDENTS_READ,
    AiPermission.ATTENDANCE_READ,
    AiPermission.ATTENDANCE_WRITE,
    AiPermission.SCHEDULE_READ,
    AiPermission.LESSONS_READ,
  ],
  ASSISTANT: [AiPermission.STUDENTS_READ, AiPermission.ATTENDANCE_READ],
  STUDENT: [],
  PARENT: [],
};

export function aiPermissionsForRole(role: string): AiPermission[] {
  return AiRolePermissions[role] ?? [];
}

export function hasAiPermission(permissions: readonly string[], required: string): boolean {
  return permissions.includes(required);
}
