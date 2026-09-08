// Audit module shared types

export const AuditActionEnum = [
  'CREATE', 'UPDATE', 'DELETE', 'RESTORE',
  'LOGIN', 'LOGOUT', 'LOGIN_FAILED',
  'EXPORT', 'IMPORT', 'BULK_UPDATE',
  'PAYMENT_RECEIVED', 'ENROLLMENT_CREATED', 'ENROLLMENT_REVOKED',
  'ATTENDANCE_RECORDED', 'GRADE_RECORDED',
  'DOCUMENT_UPLOADED', 'DOCUMENT_DELETED',
  'WORKFLOW_TRIGGERED', 'WORKFLOW_COMPLETED',
  'CUSTOM',
] as const;
export type AuditAction = typeof AuditActionEnum[number];

export const AuditEntityTypeEnum = [
  'STUDENT', 'TEACHER', 'USER', 'GROUP', 'COURSE',
  'PAYMENT', 'EXPENSE', 'LEAD', 'NOTIFICATION',
  'GRADE', 'HOMEWORK', 'ATTENDANCE',
  'FACE_ENROLLMENT', 'FACE_DEVICE', 'FACE_RECOGNITION',
  'CAMERA', 'EMPLOYEE', 'SALARY', 'LEAVE',
  'EXAM', 'EXAM_RESULT', 'CERTIFICATE',
  'INVENTORY_ITEM', 'INVENTORY_TRANSACTION',
  'LIBRARY_BOOK', 'LIBRARY_BORROW',
  'DOCUMENT', 'ROOM', 'BOOKING', 'WORKFLOW',
  'FEATURE_FLAG', 'ORGANIZATION', 'ROLE',
  'OTHER',
] as const;
export type AuditEntityType = typeof AuditEntityTypeEnum[number];

/** Flat DTO for a system audit event — used by list endpoint. */
export interface SystemAuditEventDto {
  id: string;
  organizationId: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string | null;
  entityLabel?: string | null;
  description: string;
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  changedFields?: string[] | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
  actorId?: string | null;
  actorName?: string | null;
  createdAt: Date;
}

/** Query params for the audit list endpoint. */
export interface AuditQuery {
  page?: number;
  limit?: number;
  action?: AuditAction;
  entityType?: AuditEntityType;
  entityId?: string;
  actorId?: string;
  search?: string;
  fromDate?: string;
  toDate?: string;
}
