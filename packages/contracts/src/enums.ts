/**
 * Shared enums for the Face Recognition Platform.
 * These mirror Prisma schema enums and are used across all packages.
 */

// ============================================================================
// Domain Enums
// ============================================================================

export const EnrollmentStatus = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  REVOKED: 'REVOKED',
  EXPIRED: 'EXPIRED',
} as const;
export type EnrollmentStatus = (typeof EnrollmentStatus)[keyof typeof EnrollmentStatus];

export const TemplateStatus = {
  ACTIVE: 'ACTIVE',
  REVOKED: 'REVOKED',
  EXPIRED: 'EXPIRED',
  CORRUPTED: 'CORRUPTED',
} as const;
export type TemplateStatus = (typeof TemplateStatus)[keyof typeof TemplateStatus];

export const RecognitionSessionStatus = {
  STARTED: 'STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  FINISHED: 'FINISHED',
  CANCELLED: 'CANCELLED',
  ERROR: 'ERROR',
} as const;
export type RecognitionSessionStatus = (typeof RecognitionSessionStatus)[keyof typeof RecognitionSessionStatus];

export const RecognitionAttemptStatus = {
  DETECTED: 'DETECTED',
  QUALITY_PASSED: 'QUALITY_PASSED',
  QUALITY_FAILED: 'QUALITY_FAILED',
  LIVENESS_PASSED: 'LIVENESS_PASSED',
  LIVENESS_FAILED: 'LIVENESS_FAILED',
  LIVENESS_UNCERTAIN: 'LIVENESS_UNCERTAIN',
  LIVENESS_UNAVAILABLE: 'LIVENESS_UNAVAILABLE',
  EMBEDDING_GENERATED: 'EMBEDDING_GENERATED',
  MATCH_FOUND: 'MATCH_FOUND',
  MATCH_NOT_FOUND: 'MATCH_NOT_FOUND',
  MATCH_UNCERTAIN: 'MATCH_UNCERTAIN',
  IDENTIFIED: 'IDENTIFIED',
  UNIDENTIFIED: 'UNIDENTIFIED',
  ERROR: 'ERROR',
} as const;
export type RecognitionAttemptStatus = (typeof RecognitionAttemptStatus)[keyof typeof RecognitionAttemptStatus];

export const AttendanceDecision = {
  RECORDED: 'RECORDED',
  DUPLICATE_PREVENTED: 'DUPLICATE_PREVENTED',
  STUDENT_NOT_IN_GROUP: 'STUDENT_NOT_IN_GROUP',
  LESSON_INVALID: 'LESSON_INVALID',
  STUDENT_INACTIVE: 'STUDENT_INACTIVE',
  REJECTED: 'REJECTED',
  /**
   * Audit P0-1 — the recognition identified a student, but the organization
   * schedule gate refused attendance. Attendance is never written.
   */
  OUT_OF_SCHEDULE: 'OUT_OF_SCHEDULE',
  /**
   * The student was identified but the session has no group context
   * (no groupId chosen when the session was started), so attendance CANNOT
   * be attributed. Explicitly returned instead of silently skipping
   * attendance — a silent skip looks identical to "recorded" in observability.
   */
  NO_GROUP_CONTEXT: 'NO_GROUP_CONTEXT',
} as const;
export type AttendanceDecision = (typeof AttendanceDecision)[keyof typeof AttendanceDecision];

export const DeviceStatus = {
  REGISTERED: 'REGISTERED',
  ACTIVE: 'ACTIVE',
  REVOKED: 'REVOKED',
  SUSPENDED: 'SUSPENDED',
} as const;
export type DeviceStatus = (typeof DeviceStatus)[keyof typeof DeviceStatus];

export const AuditEventType = {
  FACE_ENROLLMENT_CREATED: 'FACE_ENROLLMENT_CREATED',
  FACE_ENROLLMENT_REENROLLED: 'FACE_ENROLLMENT_REENROLLED',
  FACE_ENROLLMENT_REVOKED: 'FACE_ENROLLMENT_REVOKED',
  FACE_RECOGNITION_ATTEMPTED: 'FACE_RECOGNITION_ATTEMPTED',
  FACE_RECOGNITION_CONFIRMED: 'FACE_RECOGNITION_CONFIRMED',
  FACE_RECOGNITION_REJECTED: 'FACE_RECOGNITION_REJECTED',
  LIVENESS_FAILED: 'LIVENESS_FAILED',
  DEVICE_REGISTERED: 'DEVICE_REGISTERED',
  DEVICE_ACTIVATED: 'DEVICE_ACTIVATED',
  DEVICE_REVOKED: 'DEVICE_REVOKED',
  DEVICE_SUSPENDED: 'DEVICE_SUSPENDED',
  DEVICE_HEARTBEAT: 'DEVICE_HEARTBEAT',
  BIOMETRIC_ACCESS_DENIED: 'BIOMETRIC_ACCESS_DENIED',
  TEMPLATE_ENCRYPTED: 'TEMPLATE_ENCRYPTED',
  TEMPLATE_DECRYPTED: 'TEMPLATE_DECRYPTED',
  TEMPLATE_DELETED: 'TEMPLATE_DELETED',
  TEMPLATE_CORRUPTED: 'TEMPLATE_CORRUPTED',
  RETENTION_POLICY_APPLIED: 'RETENTION_POLICY_APPLIED',
  SETTINGS_UPDATED: 'SETTINGS_UPDATED',
  POTENTIAL_DUPLICATE_FACE: 'POTENTIAL_DUPLICATE_FACE',
} as const;
export type AuditEventType = (typeof AuditEventType)[keyof typeof AuditEventType];

export const ConsentStatus = {
  GRANTED: 'GRANTED',
  REVOKED: 'REVOKED',
  PENDING: 'PENDING',
} as const;
export type ConsentStatus = (typeof ConsentStatus)[keyof typeof ConsentStatus];

export const RetentionPolicyAction = {
  DELETE: 'DELETE',
  ANONYMIZE: 'ANONYMIZE',
  ARCHIVE: 'ARCHIVE',
  NONE: 'NONE',
} as const;
export type RetentionPolicyAction = (typeof RetentionPolicyAction)[keyof typeof RetentionPolicyAction];

// ============================================================================
// Liveness Enums
// ============================================================================

export const LivenessDecision = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  UNCERTAIN: 'UNCERTAIN',
  UNAVAILABLE: 'UNAVAILABLE',
} as const;
export type LivenessDecision = (typeof LivenessDecision)[keyof typeof LivenessDecision];

// ============================================================================
// RBAC Permissions
// ============================================================================

export const Permissions = {
  FACE_VIEW: 'face.view',
  FACE_ENROLL: 'face.enroll',
  FACE_REENROLL: 'face.reenroll',
  FACE_REVOKE: 'face.revoke',
  FACE_RECOGNIZE: 'face.recognize',
  FACE_ATTENDANCE: 'face.attendance',
  FACE_DEVICE_MANAGE: 'face.device.manage',
  FACE_AUDIT_VIEW: 'face.audit.view',
  FACE_SETTINGS_MANAGE: 'face.settings.manage',
  FACE_ANALYTICS_VIEW: 'face.analytics.view',
  // Camera module permissions (required by apps/api camera controller)
  CAMERA_MANAGE: 'camera.manage',
  CAMERA_VIEW: 'camera.view',
} as const;
export type Permission = (typeof Permissions)[keyof typeof Permissions];

export const RolePermissions: Record<string, Permission[]> = {
  SUPER_ADMIN: Object.values(Permissions),
  ORG_ADMIN: [
    Permissions.FACE_VIEW,
    Permissions.FACE_ENROLL,
    Permissions.FACE_REENROLL,
    Permissions.FACE_REVOKE,
    Permissions.FACE_RECOGNIZE,
    Permissions.FACE_ATTENDANCE,
    Permissions.FACE_DEVICE_MANAGE,
    Permissions.FACE_AUDIT_VIEW,
    Permissions.FACE_SETTINGS_MANAGE,
    Permissions.FACE_ANALYTICS_VIEW,
    Permissions.CAMERA_MANAGE,
    Permissions.CAMERA_VIEW,
  ],
  MANAGER: [
    Permissions.FACE_VIEW,
    Permissions.FACE_ENROLL,
    Permissions.FACE_REENROLL,
    Permissions.FACE_RECOGNIZE,
    Permissions.FACE_ATTENDANCE,
    Permissions.FACE_AUDIT_VIEW,
    Permissions.FACE_ANALYTICS_VIEW,
    Permissions.CAMERA_VIEW,
  ],
  TEACHER: [
    Permissions.FACE_VIEW,
    Permissions.FACE_RECOGNIZE,
    Permissions.FACE_ATTENDANCE,
  ],
  ASSISTANT: [
    Permissions.FACE_VIEW,
    Permissions.FACE_RECOGNIZE,
  ],
};

/**
 * Safe, prototype-key-proof lookup into RolePermissions.
 *
 * Prefer this over `RolePermissions[role] ?? []`: `role === 'constructor'` /
 * `'toString'` would otherwise resolve a Function from the prototype chain
 * and crash callers (`.includes(...) is not a function`) on a malformed or
 * poisoned JWT claim.
 */
export function rolePermissionsForRole(role: string): Permission[] {
  return (
    typeof role === 'string' &&
    Object.prototype.hasOwnProperty.call(RolePermissions, role)
      ? RolePermissions[role]
      : []
  );
}
