/**
 * Notification domain models.
 */

import type { AuditEntityType } from './audit';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export type NotificationSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';

export type NotificationCategory =
  | 'ATTENDANCE'
  | 'PAYMENT'
  | 'GRADE'
  | 'EXAM'
  | 'ENROLLMENT'
  | 'WORKFLOW'
  | 'SYSTEM'
  | 'SECURITY'
  | 'MESSAGE'
  | 'OTHER';

export interface NotificationExpanded {
  id: string;
  userId: string;
  title: string;
  message: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  type: string;
  isRead: boolean;
  readAt?: string | null;
  /** Link to navigate to when clicked. */
  href?: string | null;
  /** Related entity for grouping. */
  entityType?: AuditEntityType;
  entityId?: string;
  createdAt: string;
}
