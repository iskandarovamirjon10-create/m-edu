/**
 * Document management and digital vault domain models.
 */

import type { AuditEntityType } from './audit';

export type DocumentCategory =
  | 'CONTRACT'
  | 'ID'
  | 'CERTIFICATE'
  | 'REPORT'
  | 'INVOICE'
  | 'POLICY'
  | 'CURRICULUM'
  | 'MEDIA'
  | 'OTHER';

export interface DocumentVersion {
  id: string;
  version: number;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  uploadedAt: string;
  note?: string;
}

export interface Document {
  id: string;
  organizationId: string;
  title: string;
  description?: string;
  category: DocumentCategory;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  version: number;
  tags?: string[];
  /** Link to a related entity (e.g. studentId, employeeId, contractId). */
  relatedEntityType?: AuditEntityType;
  relatedEntityId?: string;
  uploadedBy: string;
  uploadedAt: string;
  expiresAt?: string;
  versions?: DocumentVersion[];
}
