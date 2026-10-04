/**
 * Early Warning System domain models.
 */

import type { AuditEntityType } from './audit';

export type WarningSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export type WarningCategory =
  | 'ATTENDANCE_DROP'
  | 'GRADE_DROP'
  | 'PAYMENT_OVERDUE'
  | 'INACTIVITY'
  | 'ENROLLMENT_EXPIRY'
  | 'EXAM_AT_RISK'
  | 'TEACHER_OVERLOAD'
  | 'RESOURCE_CONFLICT'
  | 'INVENTORY_LOW'
  | 'CERTIFICATE_EXPIRY'
  | 'CUSTOM';

export interface EarlyWarning {
  id: string;
  organizationId: string;
  category: WarningCategory;
  severity: WarningSeverity;
  title: string;
  message: string;
  /** Entity involved. */
  entityType: AuditEntityType;
  entityId: string;
  entityLabel?: string;
  /** Underlying metric value that triggered the warning. */
  metric?: { name: string; value: number; threshold: number };
  acknowledged: boolean;
  acknowledgedBy?: string | null;
  acknowledgedAt?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
}

export interface EarlyWarningSummary {
  open: number;
  critical: number;
  high: number;
  resolvedThisWeek: number;
  byRule: Record<string, number>;
  total: number;
}
