import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateFeatureFlagDto,
  UpdateFeatureFlagDto,
} from './dto/feature-flag.dto';

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

  async create(orgId: string, dto: CreateFeatureFlagDto) {
    const key = dto.key?.trim();
    if (!key) {
      throw new BadRequestException('Flag key is required');
    }
    if (!dto.name?.trim()) {
      throw new BadRequestException('Flag name is required');
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
        // Seed rollout with the creating org only (empty array = every org,
        // which would leak platform-wide flags from a single-tenant admin).
        rolloutOrganizations: [orgId],
        rolloutPercentage: dto.rolloutPercentage ?? null,
      },
    });
  }

  async update(orgId: string, key: string, dto: UpdateFeatureFlagDto) {
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
    const data: Prisma.FeatureFlagUpdateInput = {};
    if (dto.enabled !== undefined) data.enabled = dto.enabled;
    if (dto.value !== undefined) data.value = dto.value as Prisma.InputJsonValue;
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.description !== undefined) data.description = dto.description.trim();
    if (dto.rolloutPercentage !== undefined) data.rolloutPercentage = dto.rolloutPercentage;

    return this.prisma.featureFlag.update({
      where: { key },
      data,
    });
  }
}

