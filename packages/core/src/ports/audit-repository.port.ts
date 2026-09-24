/**
 * Audit repository port — for logging sensitive operations.
 * Audit records must be immutable once created.
 */

import type { AuditEventType } from '@medu/contracts';

export interface AuditEventEntity {
  id: string;
  organizationId: string;
  userId: string | null;
  type: AuditEventType;
  resourceType: string;
  resourceId: string | null;
  description: string;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface AuditRepository {
  /** Create an audit event (immutable) */
  log(data: {
    organizationId: string;
    userId?: string;
    type: AuditEventType;
    resourceType: string;
    resourceId?: string;
    description: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuditEventEntity>;

  /** Query audit events with filtering */
  query(organizationId: string, filters: {
    type?: AuditEventType;
    resourceType?: string;
    resourceId?: string;
    userId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    page?: number;
    limit?: number;
  }): Promise<{ items: AuditEventEntity[]; total: number }>;
}
