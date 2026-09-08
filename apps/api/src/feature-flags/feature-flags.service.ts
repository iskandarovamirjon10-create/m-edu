import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FeatureFlagsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(orgId: string) {
    // FeatureFlag has no organizationId column — filter by rolloutOrganizations
    const [items, total] = await Promise.all([
      this.prisma.featureFlag.findMany({
        where: {
          OR: [
            { rolloutOrganizations: { has: orgId } },
            { rolloutOrganizations: { equals: [] } },
          ],
        },
      }),
      this.prisma.featureFlag.count({
        where: {
          OR: [
            { rolloutOrganizations: { has: orgId } },
            { rolloutOrganizations: { equals: [] } },
          ],
        },
      }),
    ]);
    return { items, total };
  }

  async create(dto: {
    key: string;
    name: string;
    description?: string;
    type?: string;
    enabled?: boolean;
    value?: unknown;
    rolloutPercentage?: number;
  }) {
    const key = dto.key?.trim();
    if (!key) {
      throw new NotFoundException('Flag key is required');
    }
    if (!dto.name?.trim()) {
      throw new NotFoundException('Flag name is required');
    }

    const existing = await this.prisma.featureFlag.findUnique({ where: { key } });
    if (existing) {
      throw new ConflictException(`A flag with key "${key}" already exists`);
    }

    return this.prisma.featureFlag.create({
      data: {
        key,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        type: dto.type || 'BOOLEAN',
        enabled: dto.enabled ?? false,
        value: (dto.value as never) ?? undefined,
        // Empty rolloutOrganizations = visible to every organization
        rolloutOrganizations: [],
        rolloutPercentage: dto.rolloutPercentage ?? null,
      },
    });
  }

  async update(orgId: string, key: string, dto: any) {
    // Verify flag applies to this org
    const flag = await this.prisma.featureFlag.findUnique({ where: { key } });
    if (!flag) {
      throw new NotFoundException(`Feature flag "${key}" was not found`);
    }
    const applies =
      flag.rolloutOrganizations.includes(orgId) || flag.rolloutOrganizations.length === 0;
    if (!applies) {
      throw new ForbiddenException('This feature flag does not apply to your organization');
    }
    return this.prisma.featureFlag.update({
      where: { key },
      data: {
        enabled: dto.enabled !== undefined ? dto.enabled : flag.enabled,
        value: dto.value !== undefined ? dto.value : flag.value,
      },
    });
  }
}
