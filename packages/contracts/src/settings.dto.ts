import { z } from 'zod';

// ============================================================================
// Request DTOs
// ============================================================================

export const UpdateSettingsSchema = z.object({
  minQualityScore: z.number().min(0).max(1).optional(),
  livenessRequired: z.boolean().optional(),
  livenessThreshold: z.number().min(0).max(1).optional(),
  similarityThreshold: z.number().min(0).max(1).optional(),
  minConfidence: z.number().min(0).max(1).optional(),
  maxCandidateCount: z.number().int().min(1).max(50).optional(),
  duplicateWindowMinutes: z.number().int().min(1).max(1440).optional(),
  maxConcurrentSessions: z.number().int().min(1).max(100).optional(),
  sessionTimeoutMinutes: z.number().int().min(1).max(480).optional(),
  defaultRetentionDays: z.number().int().min(1).max(3650).optional(),
});
export type UpdateSettingsDto = z.infer<typeof UpdateSettingsSchema>;

// ============================================================================
// Response DTOs
// ============================================================================

export interface SettingsResponseDto {
  organizationId: string;
  minQualityScore: number;
  livenessRequired: boolean;
  livenessThreshold: number;
  similarityThreshold: number;
  minConfidence: number;
  maxCandidateCount: number;
  duplicateWindowMinutes: number;
  maxConcurrentSessions: number;
  sessionTimeoutMinutes: number;
  defaultRetentionDays: number;
  updatedAt: string;
}
