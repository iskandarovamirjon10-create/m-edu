/**
 * Device repository port — data access for recognition devices.
 */

import type { DeviceStatus } from '@medu/contracts';

export interface DeviceEntity {
  id: string;
  organizationId: string;
  name: string;
  apiKeyHash: string;
  status: DeviceStatus;
  lastSeenAt: Date | null;
  registeredAt: Date;
  revokedAt: Date | null;
  revokedBy: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeviceRepository {
  /** Find device by ID */
  findById(organizationId: string, id: string): Promise<DeviceEntity | null>;

  /** Find device by API key hash */
  findByApiKeyHash(organizationId: string, apiKeyHash: string): Promise<DeviceEntity | null>;

  /** List devices with filtering */
  list(organizationId: string, filters: {
    status?: DeviceStatus;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: DeviceEntity[]; total: number }>;

  /** Register a new device */
  create(data: {
    organizationId: string;
    name: string;
    apiKeyHash: string;
    metadata?: Record<string, unknown>;
  }): Promise<DeviceEntity>;

  /** Update device status */
  updateStatus(
    organizationId: string,
    id: string,
    status: DeviceStatus,
    metadata?: { revokedBy?: string }
  ): Promise<DeviceEntity>;

  /** Update last seen timestamp */
  updateHeartbeat(organizationId: string, id: string): Promise<void>;

  /** Count active devices */
  countActive(organizationId: string): Promise<number>;
}
