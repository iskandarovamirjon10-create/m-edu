/**
 * Data Quality Center domain models.
 */

import type { AuditEntityType } from './audit';

export type DataQualitySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type DataQualityCategory =
  | 'MISSING_FIELD'
  | 'INVALID_FORMAT'
  | 'DUPLICATE'
  | 'INCONSISTENT'
  | 'STALE'
  | 'ORPHAN'
  | 'OTHER';

export interface DataQualityIssue {
  id: string;
  organizationId: string;
  entityType: AuditEntityType;
  entityId: string;
  category: DataQualityCategory;
  severity: DataQualitySeverity;
  field?: string | null;
  message: string;
  /** Rule identifier that detected this. */
  ruleId: string;
  detectedAt: string;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  resolutionNote?: string | null;
}

export interface DataQualitySummary {
  total: number;
  bySeverity: Record<DataQualitySeverity, number>;
  byCategory: Record<DataQualityCategory, number>;
  resolvedThisWeek: number;
  detectedToday: number;
  trend: { date: string; count: number }[];
}

export interface DataQualityRule {
  id: string;
  name: string;
  description: string;
  entityType: AuditEntityType;
  field?: string;
  category: DataQualityCategory;
  severity: DataQualitySeverity;
  enabled: boolean;
  lastRunAt?: string;
  lastRunIssues?: number;
}
