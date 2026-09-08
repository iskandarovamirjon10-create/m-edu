import { z } from 'zod';
import type { EnrollmentStatus, TemplateStatus } from './enums';

// ============================================================================
// Request DTOs
// ============================================================================

export const CreateEnrollmentSchema = z.object({
  studentId: z.string().uuid('Invalid student ID'),
  organizationId: z.string().uuid('Invalid organization ID'),
});
export type CreateEnrollmentDto = z.infer<typeof CreateEnrollmentSchema>;

export const ReenrollStudentSchema = z.object({
  reason: z.string().min(1, 'Reason is required for re-enrollment').max(500),
});
export type ReenrollStudentDto = z.infer<typeof ReenrollStudentSchema>;

export const RevokeEnrollmentSchema = z.object({
  reason: z.string().min(1, 'Reason is required for revocation').max(500),
});
export type RevokeEnrollmentDto = z.infer<typeof RevokeEnrollmentSchema>;

export const EnrollmentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum({
    PENDING: 'PENDING',
    ACTIVE: 'ACTIVE',
    REVOKED: 'REVOKED',
    EXPIRED: 'EXPIRED',
  }).optional(),
  studentId: z.string().uuid().optional(),
  search: z.string().max(200).optional(),
  sortBy: z.enum(['createdAt', 'enrolledAt', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export type EnrollmentQueryDto = z.infer<typeof EnrollmentQuerySchema>;

// ============================================================================
// Response DTOs
// ============================================================================

export interface EnrollmentResponseDto {
  id: string;
  organizationId: string;
  studentId: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    studentId: string | null;
  };
  status: EnrollmentStatus;
  enrolledAt: string;
  activatedAt: string | null;
  revokedAt: string | null;
  revocationReason: string | null;
  templateCount: number;
  activeTemplateCount: number;
  createdAt: string;
}

export interface EnrollmentDetailResponseDto extends EnrollmentResponseDto {
  templates: TemplateSummaryDto[];
  metadata: Record<string, unknown> | null;
}

export interface TemplateSummaryDto {
  id: string;
  version: number;
  status: TemplateStatus;
  modelVersion: string | null;
  qualityScore: number | null;
  enrolledAt: string;
  expiresAt: string | null;
}

export interface EnrollmentListResponseDto {
  items: EnrollmentResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
