import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApiKeyDto, RotateApiKeyDto, API_KEY_SCOPES } from './dto/api-key.dto';
import { randomBytes } from 'crypto';
import { hashPassword } from '../auth/auth.config';

const KEY_PREFIX = 'medu';

const API_KEY_SELECT = {
  id: true,
  name: true,
  keyPrefix: true,
  scopes: true,
  isActive: true,
  lastUsedAt: true,
  expiresAt: true,
  rateLimit: true,
  usageCount: true,
  createdBy: true,
  createdAt: true,
};

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(organizationId: string, dto: CreateApiKeyDto, userId: string) {
    this.validateScopes(dto.scopes);

    const rawKey = `${KEY_PREFIX}_${randomBytes(24).toString('hex')}`;
    const keyHash = await hashPassword(rawKey);
    const keyPrefix = rawKey.substring(0, 11);

    const apiKey = await this.prisma.apiKey.create({
      data: {
        organizationId,
        name: dto.name,
        keyHash,
        keyPrefix,
        scopes: dto.scopes,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        rateLimit: dto.rateLimit ?? 1000,
        createdBy: userId,
      },
      select: API_KEY_SELECT,
    });

    return { ...apiKey, key: rawKey };
  }

  async list(organizationId: string) {
    return this.prisma.apiKey.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      select: API_KEY_SELECT,
      take: 100,
    });
  }

  async revoke(organizationId: string, keyId: string) {
    const key = await this.prisma.apiKey.findFirst({
      where: { id: keyId, organizationId },
    });
    if (!key) throw new NotFoundException('API key not found');

    return this.prisma.apiKey.update({
      where: { id: keyId },
      data: { isActive: false },
      select: API_KEY_SELECT,
    });
  }

  async rotate(organizationId: string, keyId: string, dto: RotateApiKeyDto, userId: string) {
    const oldKey = await this.prisma.apiKey.findFirst({
      where: { id: keyId, organizationId },
    });
    if (!oldKey) throw new NotFoundException('API key not found');

    await this.prisma.apiKey.update({
      where: { id: keyId },
      data: { isActive: false },
    });

    return this.generate(organizationId, {
      name: dto.name || oldKey.name,
      scopes: dto.scopes || oldKey.scopes,
      expiresAt: dto.expiresAt || oldKey.expiresAt?.toISOString(),
      rateLimit: dto.rateLimit || oldKey.rateLimit,
    }, userId);
  }

  async findCandidatesByKeyPrefix(keyPrefix: string) {
    return this.prisma.apiKey.findMany({
      where: { keyPrefix, isActive: true },
    });
  }

  async incrementUsage(keyId: string) {
    await this.prisma.apiKey.update({
      where: { id: keyId },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });
  }

  async getUsageStats(organizationId: string, keyId?: string) {
    if (keyId) {
      const key = await this.prisma.apiKey.findFirst({
        where: { id: keyId, organizationId },
        select: API_KEY_SELECT,
      });
      if (!key) throw new NotFoundException('API key not found');
      return key;
    }

    const keys = await this.prisma.apiKey.findMany({
      where: { organizationId },
      select: API_KEY_SELECT,
      orderBy: { usageCount: 'desc' },
      take: 100,
    });

    const totalUsage = keys.reduce((sum, k) => sum + k.usageCount, 0);
    const activeCount = keys.filter(k => k.isActive).length;

    return { keys, totalUsage, activeCount, totalCount: keys.length };
  }

  async getScopes() {
    return API_KEY_SCOPES;
  }

  private validateScopes(scopes: string[]) {
    const invalid = scopes.filter(s => !(API_KEY_SCOPES as readonly string[]).includes(s));
    if (invalid.length > 0) {
      throw new BadRequestException(`Invalid scopes: ${invalid.join(', ')}`);
    }
  }
}
