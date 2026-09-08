/**
 * Enrollment repository port — data access abstraction for face enrollments.
 * All queries are scoped by organizationId for tenant isolation.
 */

import type { EnrollmentStatus, TemplateStatus } from '@medu/contracts';

// ============================================================================
// Internal Entity Types
// ============================================================================

export interface EnrollmentEntity {
  id: string;
  organizationId: string;
  studentId: string;
  status: EnrollmentStatus;
  enrolledBy: string | null;
  enrolledAt: Date;
  activatedAt: Date | null;
  revokedAt: Date | null;
  revokedBy: string | null;
  revocationReason: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateEntity {
  id: string;
  organizationId: string;
  enrollmentId: string;
  studentId: string;
  templateData: string; // Encrypted
  templateHash: string;
  version: number;
  status: TemplateStatus;
  modelVersion: string | null;
  qualityScore: number | null;
  enrolledAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EnrollmentWithTemplates extends EnrollmentEntity {
  templates: TemplateEntity[];
  student: {
    id: string;
    firstName: string;
    lastName: string;
    studentId: string | null;
    isActive: boolean;
  };
}

// ============================================================================
// Repository Interface
// ============================================================================

export interface EnrollmentRepository {
  /** Find enrollment by ID, scoped to organization */
  findById(organizationId: string, id: string): Promise<EnrollmentWithTemplates | null>;

  /** Find enrollment by student ID, scoped to organization */
  findByStudentId(organizationId: string, studentId: string): Promise<EnrollmentEntity | null>;

  /** Find active enrollment by student ID */
  findActiveByStudentId(organizationId: string, studentId: string): Promise<EnrollmentWithTemplates | null>;

  /** List enrollments with filtering and pagination */
  list(organizationId: string, filters: {
    status?: EnrollmentStatus;
    studentId?: string;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ items: EnrollmentWithTemplates[]; total: number }>;

  /** Create a new enrollment */
  create(data: {
    organizationId: string;
    studentId: string;
    enrolledBy?: string;
  }): Promise<EnrollmentEntity>;

  /** Update enrollment status */
  updateStatus(
    organizationId: string,
    id: string,
    status: EnrollmentStatus,
    metadata?: {
      activatedAt?: Date;
      revokedAt?: Date;
      revokedBy?: string;
      revocationReason?: string;
    }
  ): Promise<EnrollmentEntity>;

  /** Add a template to an enrollment */
  addTemplate(data: {
    organizationId: string;
    enrollmentId: string;
    studentId: string;
    templateData: string;
    templateHash: string;
    version: number;
    modelVersion?: string;
    qualityScore?: number;
    expiresAt?: Date;
  }): Promise<TemplateEntity>;

  /** Find all active templates for a student (used in recognition) */
  findActiveTemplatesByStudentId(
    organizationId: string,
    studentId: string
  ): Promise<TemplateEntity[]>;

  /** Find all active templates for matching (org-scoped) */
  findAllActiveTemplates(organizationId: string): Promise<Array<TemplateEntity & { student: { id: string; firstName: string; lastName: string } }>>;

  /**
   * Stream active templates in bounded batches using cursor-based pagination.
   * Memory-safe alternative to findAllActiveTemplates for large organizations.
   * Each yielded array is a batch of up to `batchSize` templates.
   *
   * @param organizationId - Tenant scope
   * @param batchSize    - Maximum templates per batch (default 500). Tune to match
   *                       embedding comparison throughput; 500 is a safe default for
   *                       128-dim float32 embeddings (~256 KB per batch).
   * @yields batches of templates with student projection
   */
  streamActiveTemplates(
    organizationId: string,
    batchSize?: number,
  ): AsyncGenerator<Array<TemplateEntity & { student: { id: string; firstName: string; lastName: string } }>>;

  /** Revoke all templates for an enrollment */
  revokeTemplates(organizationId: string, enrollmentId: string): Promise<void>;

  /** Count active enrollments */
  countActive(organizationId: string): Promise<number>;

  /** Count total enrollments */
  countTotal(organizationId: string): Promise<number>;
}
