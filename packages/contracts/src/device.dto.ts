import { z } from 'zod';
import type { DeviceStatus } from './enums';

// ============================================================================
// Request DTOs
// ============================================================================

export const RegisterDeviceSchema = z.object({
  name: z.string().min(1).max(200),
  metadata: z.record(z.unknown()).optional(),
});
export type RegisterDeviceDto = z.infer<typeof RegisterDeviceSchema>;

export const DeviceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum({
    REGISTERED: 'REGISTERED',
    ACTIVE: 'ACTIVE',
    REVOKED: 'REVOKED',
    SUSPENDED: 'SUSPENDED',
  }).optional(),
  search: z.string().max(200).optional(),
});
export type DeviceQueryDto = z.infer<typeof DeviceQuerySchema>;

// ============================================================================
// Response DTOs
// ============================================================================

export interface DeviceResponseDto {
  id: string;
  organizationId: string;
  name: string;
  status: DeviceStatus;
  lastSeenAt: string | null;
  registeredAt: string;
  revokedAt: string | null;
  metadata: Record<string, unknown> | null;
  sessionCount: number;
  createdAt: string;
}

export interface DeviceDetailResponseDto extends DeviceResponseDto {
  recentSessions: Array<{
    id: string;
    status: string;
    startedAt: string;
    attemptCount: number;
  }>;
}

export interface DeviceRegistrationResponseDto {
  device: DeviceResponseDto;
  /** One-time API key — show only at registration time */
  apiKey: string;
}

export interface DeviceListResponseDto {
  items: DeviceResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
