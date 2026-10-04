/**
 * Data Import and Export job domain models.
 */

import type { AuditEntityType } from './audit';

export type JobStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type ImportExportFormat = 'CSV' | 'XLSX' | 'JSON' | 'PDF';

export interface ImportJob {
  id: string;
  organizationId: string;
  entityType: AuditEntityType;
  format: ImportExportFormat;
  fileName: string;
  status: JobStatus;
  totalRows?: number;
  processedRows?: number;
  successRows?: number;
  failedRows?: number;
  errors?: { row: number; field?: string; message: string }[];
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  createdBy: string;
}

export interface ExportJob {
  id: string;
  organizationId: string;
  entityType: AuditEntityType;
  format: ImportExportFormat;
  fileName?: string;
  downloadUrl?: string;
  status: JobStatus;
  rowCount?: number;
  filters?: Record<string, unknown>;
  startedAt?: string;
  completedAt?: string;
  expiresAt?: string;
  createdAt: string;
  createdBy: string;
}
