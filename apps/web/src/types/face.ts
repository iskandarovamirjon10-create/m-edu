/**
 * Face Recognition and Biometrics domain models.
 * Canonical status enums are imported directly from `@medu/contracts`.
 */

import type { User } from './auth';
import type { Student } from './students';
import {
  EnrollmentStatus,
  TemplateStatus,
  RecognitionSessionStatus,
  RecognitionAttemptStatus,
  LivenessDecision,
  ConsentStatus,
  RetentionPolicyAction,
  Permissions,
  RolePermissions,
} from '@medu/contracts';
import type { Permission } from '@medu/contracts';

export {
  EnrollmentStatus,
  TemplateStatus,
  RecognitionSessionStatus,
  RecognitionAttemptStatus,
  LivenessDecision,
  ConsentStatus,
  RetentionPolicyAction,
  Permissions,
  RolePermissions,
};
export type { Permission };

/** Backward-compatibility alias for canonical EnrollmentStatus */
export type FaceEnrollmentStatus = EnrollmentStatus;

export interface FaceTemplate {
  id: string;
  templateHash: string;
  version: number;
  status: string;
  modelVersion?: string | null;
  qualityScore?: string | null;
  enrolledAt: string;
}

export interface FaceEnrollment {
  id: string;
  /** POST /face/enrollments returns { enrollmentId, status } — kept alongside id for compatibility. */
  enrollmentId?: string;
  organizationId: string;
  studentId: string;
  status: EnrollmentStatus;
  enrolledAt: string;
  activatedAt?: string | null;
  revokedAt?: string | null;
  /**
   * Backend GET /face/enrollments returns a flattened student summary
   * (id/firstName/lastName/studentId/isActive) — NOT the nested
   * `student.user` shape. Kept optional for compatibility.
   */
  student?: {
    id: string;
    firstName: string;
    lastName: string;
    studentId?: string | null;
    isActive?: boolean;
  };
  /** Backend returns templates under `templates` (or `faceTemplates`). */
  templates?: FaceTemplate[];
  faceTemplates?: FaceTemplate[];
}

export interface RecognitionSession {
  id: string;
  /** POST /face/sessions returns { sessionId, status } — kept alongside id for compatibility. */
  sessionId?: string;
  organizationId: string;
  groupId?: string | null;
  status: string;
  startedAt: string;
  endedAt?: string | null;
}

export interface RecognitionAttempt {
  id: string;
  organizationId: string;
  sessionId: string;
  identifiedStudentId?: string | null;
  status: string;
  confidence?: string | null;
  qualityScore?: string | null;
  livenessResult?: string | null;
  similarityScore?: string | null;
  occurredAt: string;
  student?: Student | null;
}

export interface FaceDevice {
  id: string;
  organizationId: string;
  name: string;
  status: string;
  lastSeenAt?: string | null;
  registeredAt: string;
}

export interface FaceAuditEvent {
  id: string;
  organizationId: string;
  type: string;
  resourceType: string;
  resourceId?: string | null;
  description: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  user?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email'> | null;
}

/** Backend GET /face/engine-status payload */
export interface FaceEngineStatus {
  provider: string;
  isReal: boolean;
}
