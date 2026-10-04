/**
 * System audit, timeline, and compliance logging domain models.
 * Canonical biometric AuditEventType is imported directly from `@medu/contracts`.
 */

import { AuditEventType } from '@medu/contracts';

export { AuditEventType };

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'RESTORE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'LOGIN_FAILED'
  | 'EXPORT'
  | 'IMPORT'
  | 'BULK_UPDATE'
  | 'PAYMENT_RECEIVED'
  | 'ENROLLMENT_CREATED'
  | 'ENROLLMENT_REVOKED'
  | 'ATTENDANCE_RECORDED'
  | 'GRADE_RECORDED'
  | 'DOCUMENT_UPLOADED'
  | 'DOCUMENT_DELETED'
  | 'WORKFLOW_TRIGGERED'
  | 'WORKFLOW_COMPLETED'
  | 'CUSTOM';

export type AuditEntityType =
  | 'STUDENT'
  | 'TEACHER'
  | 'USER'
  | 'GROUP'
  | 'COURSE'
  | 'PAYMENT'
  | 'EXPENSE'
  | 'LEAD'
  | 'NOTIFICATION'
  | 'GRADE'
  | 'HOMEWORK'
  | 'ATTENDANCE'
  | 'FACE_ENROLLMENT'
  | 'FACE_DEVICE'
  | 'FACE_RECOGNITION'
  | 'CAMERA'
  | 'EMPLOYEE'
  | 'SALARY'
  | 'LEAVE'
  | 'EXAM'
  | 'EXAM_RESULT'
  | 'CERTIFICATE'
  | 'INVENTORY_ITEM'
  | 'INVENTORY_TRANSACTION'
  | 'LIBRARY_BOOK'
  | 'LIBRARY_BORROW'
  | 'DOCUMENT'
  | 'ROOM'
  | 'BOOKING'
  | 'WORKFLOW'
  | 'FEATURE_FLAG'
  | 'ORGANIZATION'
  | 'ROLE'
  | 'OTHER';

export interface SystemAuditEvent {
  id: string;
  organizationId: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string | null;
  /** Optional human-readable entity label (e.g. student name). */
  entityLabel?: string | null;
  description: string;
  /** Serialized before/after JSON snapshot for diffing. */
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  changedFields?: string[] | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
  actorId?: string | null;
  actorName?: string | null;
  createdAt: string;
}

export interface AuditTimelineFilters {
  page: number;
  limit: number;
  action?: AuditAction;
  entityType?: AuditEntityType;
  entityId?: string;
  actorId?: string;
  search?: string;
  fromDate?: string;
  toDate?: string;
}

export interface ChangeHistoryEntry {
  id: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
  changedAt: string;
  changedBy?: string | null;
}
