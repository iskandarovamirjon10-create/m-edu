import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { 
  DeviceRepository, 
  DeviceEntity 
} from '@medu/core/src/ports/device-repository.port';
import type { DeviceStatus } from '@medu/contracts';
import type { FaceDevice } from '@prisma/client';

interface DeviceListFilters {
  status?: DeviceStatus;
  search?: string;
  page?: number;
  limit?: number;
}

type FaceDeviceWithCredentials = FaceDevice & {
  credentials?: Array<{ apiKeyHash: string; isActive: boolean }>;
};

@Injectable()
export class PrismaDeviceAdapter implements DeviceRepository {
  constructor(private readonly prisma: PrismaService) {}

  private mapDeviceEntity(row: FaceDeviceWithCredentials): DeviceEntity {
    const activeCredential = row.credentials?.find((c) => c.isActive);
    return {
      id: row.id,
      organizationId: row.organizationId,
      name: row.name,
      apiKeyHash: activeCredential?.apiKeyHash ?? '',
      status: row.status as DeviceStatus,
      lastSeenAt: row.lastSeenAt,
      registeredAt: row.registeredAt,
      revokedAt: row.revokedAt,
      revokedBy: row.revokedBy,
      metadata: row.metadata as Record<string, unknown> | null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async findById(organizationId: string, id: string): Promise<DeviceEntity | null> {
    const row = await this.prisma.faceDevice.findFirst({
      where: { id, organizationId },
      include: {
        credentials: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    return row ? this.mapDeviceEntity(row) : null;
  }

  async findByApiKeyHash(organizationId: string, apiKeyHash: string): Promise<DeviceEntity | null> {
    const row = await this.prisma.faceDevice.findFirst({
      where: { organizationId, credentials: { some: { apiKeyHash, isActive: true } } },
      include: {
        credentials: { where: { apiKeyHash, isActive: true }, take: 1 },
      },
    });
    return row ? this.mapDeviceEntity(row) : null;
  }

  async list(organizationId: string, filters: DeviceListFilters): Promise<{ items: DeviceEntity[]; total: number }> {
    const where: Record<string, unknown> = { organizationId };
    if (filters.status) where.status = filters.status;
    if (filters.search) {
      where.name = { contains: filters.search, mode: 'insensitive' };
    }

    const [rows, total] = await Promise.all([
      this.prisma.faceDevice.findMany({
        where,
        orderBy: { registeredAt: 'desc' },
        include: {
          credentials: {
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        ...(filters.limit && { take: filters.limit }),
        ...(filters.limit && filters.page && { skip: (filters.page - 1) * filters.limit }),
      }),
      this.prisma.faceDevice.count({ where }),
    ]);

    return {
      items: rows.map(r => this.mapDeviceEntity(r)),
      total,
    };
  }

  async create(data: {
    organizationId: string;
    name: string;
    apiKeyHash: string;
    metadata?: Record<string, unknown>;
  }): Promise<DeviceEntity> {
    // The credential hash is what device authentication looks up in
    // findByApiKeyHash, so it MUST be persisted with the device. Both writes
    // share one transaction so a device can never exist without its credential.
    return this.prisma.$transaction(async (tx) => {
      const device = await tx.faceDevice.create({
        data: {
          organizationId: data.organizationId,
          name: data.name,
          status: 'ACTIVE',
          metadata: (data.metadata || {}) as Prisma.InputJsonValue,
        },
      });

      await tx.faceDeviceCredential.create({
        data: {
          organizationId: data.organizationId,
          faceDeviceId: device.id,
          apiKeyHash: data.apiKeyHash,
          isActive: true,
        },
      });

      return this.mapDeviceEntity({
        ...device,
        credentials: [{ apiKeyHash: data.apiKeyHash, isActive: true }],
      });
    });
  }

  async updateStatus(
    organizationId: string,
    id: string,
    status: DeviceStatus,
    metadata?: { revokedBy?: string }
  ): Promise<DeviceEntity> {
    const data: Record<string, unknown> = { status };
    if (status === 'REVOKED') {
      data.revokedAt = new Date();
      if (metadata?.revokedBy) data.revokedBy = metadata.revokedBy;
    }

    const row = await this.prisma.faceDevice.update({
      where: { id, organizationId },
      data,
      include: {
        credentials: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    return this.mapDeviceEntity(row);
  }

  async updateHeartbeat(organizationId: string, id: string): Promise<void> {
    await this.prisma.faceDevice.update({
      where: { id, organizationId },
      data: { lastSeenAt: new Date() },
    });
  }

  async countActive(organizationId: string): Promise<number> {
    return this.prisma.faceDevice.count({
      where: { organizationId, status: 'ACTIVE' },
    });
  }
}
