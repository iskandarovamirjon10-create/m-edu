import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createHash, randomBytes } from 'crypto';
import { CreatePlatformInvitationDto } from './platform.dto';
import { SecurityEventService, SecurityEventType } from '../common/security/security-event.service';

@Injectable()
export class PlatformService {
  constructor(private readonly prisma: PrismaService, private readonly security: SecurityEventService) {}

  async getStatistics() {
    const [orgCount, userCount, studentCount, activeOrgs] = await Promise.all([
      this.prisma.organization.count(),
      this.prisma.user.count(),
      this.prisma.student.count(),
      // "Active" = the tenant still has a live account. The previous query
      // was a byte-for-byte duplicate of `orgCount`, so the dashboard always
      // reported the same number under two different labels.
      this.prisma.organization.count({
        where: { users: { some: { isActive: true } } },
      }),
    ]);

    return { orgCount, userCount, studentCount, activeOrgs };
  }

  async getOrganizations() {
    return this.prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        _count: {
          select: { users: true, students: true }
        }
      }
    });
  }

  async createInvitation(creatorId: string, dto: CreatePlatformInvitationDto) {
    /*
     * 128 bits of entropy. The previous `randomBytes(4)` produced 8 hex
     * characters (16^8 ≈ 4.3 billion combinations) for a code that grants
     * platform sign-up — brute-forceable against an endpoint that only
     * rate-limits per tracker key.
     *
     * Only the SHA-256 of the code is stored, so the raw value is returned
     * exactly once and never leaves this response.
     */
    const rawCode = 'M-EDU-' + randomBytes(16).toString('hex').toUpperCase();
    const codeHash = createHash('sha256').update(rawCode).digest('hex');

    const invite = await this.prisma.platformInvitation.create({
      data: {
        codeHash,
        maxUses: dto.maxUses,
        expiresAt: this.resolveInvitationExpiry(dto.expiresAt),
        metadata: dto.metadata || {},
        createdBy: creatorId,
      }
    });

    await this.security.logEvent({
      eventType: SecurityEventType.INVITE_CREATED,
      userId: creatorId,
      resourceType: 'PlatformInvitation',
      resourceId: invite.id,
      success: true,
    });

    // We return the RAW code only once
    return {
      id: invite.id,
      code: rawCode,
      expiresAt: invite.expiresAt,
      maxUses: invite.maxUses
    };
  }

  /**
   * An invitation must actually expire: `@IsDateString()` alone accepts
   * "1970-01-01" (a code that can never be redeemed) and "9999-12-31"
   * (a platform access code that effectively never expires).
   */
  private resolveInvitationExpiry(expiresAt: string): Date {
    const expires = new Date(expiresAt);
    const now = new Date();
    const MAX_TTL_MS = 365 * 24 * 60 * 60 * 1000;

    if (Number.isNaN(expires.getTime()) || expires <= now) {
      throw new BadRequestException('expiresAt must be a future date');
    }
    if (expires.getTime() - now.getTime() > MAX_TTL_MS) {
      throw new BadRequestException('expiresAt must be within 365 days');
    }

    return expires;
  }
}
