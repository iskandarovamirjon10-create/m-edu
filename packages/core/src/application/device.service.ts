/**
 * Device application service — manages recognition device lifecycle.
 */

import type { DeviceRepository } from '../ports/device-repository.port';
import type { AuthorizationPort } from '../ports/authorization.port';
import type { AuditRepository } from '../ports/audit-repository.port';
import type { EncryptionPort } from '../ports/encryption.port';
import type { TenantContext } from '../ports/tenant-context.port';
import { DeviceNotFoundError, DeviceRevokedError } from '../domain/errors';
import { DeviceStatus, Permissions } from '@medu/contracts';
import { randomBytes } from 'crypto';

export class DeviceService {
  constructor(
    private readonly deviceRepo: DeviceRepository,
    private readonly authorization: AuthorizationPort,
    private readonly audit: AuditRepository,
    private readonly encryption: EncryptionPort
  ) {}

  /**
   * Register a new device.
   * Returns the device info AND a one-time API key.
   */
  async register(
    tenant: TenantContext,
    data: { name: string; metadata?: Record<string, unknown> }
  ): Promise<{ deviceId: string; apiKey: string; name: string; status: string }> {
    await this.authorization.requirePermission(Permissions.FACE_DEVICE_MANAGE, tenant.role);

    // Generate a secure API key
    const apiKey = `fp_${randomBytes(32).toString('hex')}`;
    const apiKeyHash = await this.encryption.hash(apiKey);

    const device = await this.deviceRepo.create({
      organizationId: tenant.organizationId,
      name: data.name,
      apiKeyHash,
      metadata: data.metadata,
    });

    await this.audit.log({
      organizationId: tenant.organizationId,
      userId: tenant.userId,
      type: 'DEVICE_REGISTERED',
      resourceType: 'Device',
      resourceId: device.id,
      description: `Device registered: ${data.name}`,
      metadata: { deviceName: data.name },
    });

    return {
      deviceId: device.id,
      apiKey, // Only returned at registration time
      name: device.name,
      status: device.status,
    };
  }

  /**
   * Validate a device by API key.
   * Used by device authentication middleware.
   */
  async validateDevice(
    organizationId: string,
    apiKey: string
  ): Promise<{ deviceId: string; status: string }> {
    const apiKeyHash = await this.encryption.hash(apiKey);
    const device = await this.deviceRepo.findByApiKeyHash(organizationId, apiKeyHash);

    if (!device) {
      return { deviceId: '', status: 'NOT_FOUND' };
    }

    if (device.status === 'REVOKED') {
      throw new DeviceRevokedError(device.id);
    }

    if (device.status === 'SUSPENDED') {
      throw new DeviceRevokedError(device.id);
    }

    // Update heartbeat
    await this.deviceRepo.updateHeartbeat(organizationId, device.id);

    return { deviceId: device.id, status: device.status };
  }

  /**
   * Revoke a device.
   */
  async revoke(
    tenant: TenantContext,
    deviceId: string
  ): Promise<void> {
    await this.authorization.requirePermission(Permissions.FACE_DEVICE_MANAGE, tenant.role);

    const device = await this.deviceRepo.findById(tenant.organizationId, deviceId);
    if (!device) throw new DeviceNotFoundError(deviceId);

    await this.deviceRepo.updateStatus(tenant.organizationId, deviceId, 'REVOKED', {
      revokedBy: tenant.userId,
    });

    await this.audit.log({
      organizationId: tenant.organizationId,
      userId: tenant.userId,
      type: 'DEVICE_REVOKED',
      resourceType: 'Device',
      resourceId: deviceId,
      description: `Device revoked: ${device.name}`,
    });
  }

  /**
   * Record a device heartbeat.
   */
  async heartbeat(
    organizationId: string,
    deviceId: string
  ): Promise<void> {
    const device = await this.deviceRepo.findById(organizationId, deviceId);
    if (!device) throw new DeviceNotFoundError(deviceId);

    if (device.status === 'REVOKED') throw new DeviceRevokedError(deviceId);

    await this.deviceRepo.updateHeartbeat(organizationId, deviceId);

    await this.audit.log({
      organizationId,
      type: 'DEVICE_HEARTBEAT',
      resourceType: 'Device',
      resourceId: deviceId,
      description: 'Device heartbeat received',
    });
  }

  /**
   * List devices for an organization.
   */
  async list(
    tenant: TenantContext,
    filters: {
      status?: DeviceStatus;
      search?: string;
      page?: number;
      limit?: number;
    }
  ) {
    await this.authorization.requirePermission(Permissions.FACE_DEVICE_MANAGE, tenant.role);
    return this.deviceRepo.list(tenant.organizationId, filters);
  }

  /**
   * Get device details.
   */
  async getDevice(
    tenant: TenantContext,
    deviceId: string
  ) {
    await this.authorization.requirePermission(Permissions.FACE_DEVICE_MANAGE, tenant.role);
    const device = await this.deviceRepo.findById(tenant.organizationId, deviceId);
    if (!device) throw new DeviceNotFoundError(deviceId);
    return device;
  }
}
