import { z } from 'zod';

// ============================================================================
// Request DTOs
// ============================================================================

export const AuditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  type: z.string().optional(),
  search: z.string().max(120).optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});
export type AuditQueryDto = z.infer<typeof AuditQuerySchema>;

// ============================================================================
// Response DTOs
// ============================================================================

export interface AuditEventResponseDto {
  id: string;
  organizationId: string;
  userId: string | null;
  user: { id: string; firstName: string; lastName: string; email: string } | null;
  type: string;
  resourceType: string;
  resourceId: string | null;
  description: string;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface AuditListResponseDto {
  items: AuditEventResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
