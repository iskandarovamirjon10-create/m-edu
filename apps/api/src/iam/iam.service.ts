import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityEventService, SecurityEventType } from '../common/security/security-event.service';
import { SyncGateway } from '../auth/sync.gateway';
import { hashPassword } from '../auth/auth.config';
import { normalizeUsername, validateUsername } from '../auth/username.utils';
import { normalizeEmail } from '../auth/auth.utils';
import {
  AssignMembershipDto,
  BulkAccountRowDto,
  CreateAccountDto,
  CreateOrganizationDto,
  ResetAccountPasswordDto,
  UpdateAccountDto,
  UpdateOrganizationDto,
} from './iam.dto';
import { Role, UserStatus, MembershipStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as ExcelJS from 'exceljs';

@Injectable()
export class IAMService {
  private readonly logger = new Logger(IAMService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly security: SecurityEventService,
    @Optional() @Inject(forwardRef(() => SyncGateway)) private readonly syncGateway?: SyncGateway,
  ) {}

  // ==========================================================================
  // 1. ORGANIZATION MANAGEMENT (OWNER ONLY)
  // ==========================================================================

  async createOrganization(dto: CreateOrganizationDto, actorId: string) {
    const email = normalizeEmail(dto.email);

    const organization = await this.prisma.organization.create({
      data: {
        name: dto.name.trim(),
        email,
        phone: dto.phone?.trim() || null,
        address: dto.address?.trim() || null,
        timezone: dto.timezone || 'Asia/Tashkent',
        language: dto.language || 'uz',
        currency: dto.currency || 'UZS',
        status: 'ACTIVE',
        isActive: true,
      },
    });

    await this.security.logEvent({
      eventType: SecurityEventType.ORGANIZATION_CREATED,
      organizationId: organization.id,
      userId: actorId,
      resourceType: 'Organization',
      resourceId: organization.id,
      success: true,
      metadata: { name: organization.name, email: organization.email },
    });

    this.logger.log(`Organization "${organization.name}" (${organization.id}) created by ${actorId}`);
    return organization;
  }

  async updateOrganization(id: string, dto: UpdateOrganizationDto, actorId: string) {
    const existing = await this.prisma.organization.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Organization ${id} not found`);
    }

    const data: Prisma.OrganizationUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.email !== undefined) data.email = normalizeEmail(dto.email);
    if (dto.phone !== undefined) data.phone = dto.phone.trim();
    if (dto.address !== undefined) data.address = dto.address.trim();
    if (dto.timezone !== undefined) data.timezone = dto.timezone;
    if (dto.language !== undefined) data.language = dto.language;
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
      data.status = dto.isActive ? 'ACTIVE' : 'SUSPENDED';
    }

    const updated = await this.prisma.organization.update({
      where: { id },
      data,
    });

    return updated;
  }

  async activateOrganization(id: string, actorId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException(`Organization ${id} not found`);

    await this.prisma.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id },
        data: { isActive: true, status: 'ACTIVE' },
      });
      if (tx.subscription) {
        await tx.subscription.updateMany({
          where: { organizationId: id },
          data: { status: 'ACTIVE' },
        });
      }
    });

    await this.security.logEvent({
      eventType: SecurityEventType.ORGANIZATION_ACTIVATED,
      organizationId: id,
      userId: actorId,
      resourceType: 'Organization',
      resourceId: id,
      success: true,
    });

    return { message: 'Organization activated successfully', id };
  }

  async suspendOrganization(id: string, actorId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException(`Organization ${id} not found`);

    await this.prisma.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id },
        data: { isActive: false, status: 'SUSPENDED' },
      });
      if (tx.subscription) {
        await tx.subscription.updateMany({
          where: { organizationId: id },
          data: { status: 'SUSPENDED' },
        });
      }
      // Revoke all active sessions belonging to users of this organization
      await tx.session.updateMany({
        where: { organizationId: id, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'tenant_suspended' },
      });
      if ((tx as any).parentSession) {
        await (tx as any).parentSession.updateMany({
          where: { organizationId: id, revokedAt: null },
          data: { revokedAt: new Date(), revokedReason: 'tenant_suspended' },
        });
      }
    });

    await this.security.logEvent({
      eventType: SecurityEventType.ORGANIZATION_SUSPENDED,
      organizationId: id,
      userId: actorId,
      resourceType: 'Organization',
      resourceId: id,
      success: true,
    });

    return { message: 'Organization suspended and all sessions revoked', id };
  }

  async getOrganizationMemberships(orgId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException(`Organization ${orgId} not found`);

    const memberships = await this.prisma.organizationMembership.findMany({
      where: { organizationId: orgId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            status: true,
            isActive: true,
            lastLoginAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return memberships;
  }

  async getOrganizationStatistics(orgId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException(`Organization ${orgId} not found`);

    const [membershipsCount, studentsCount, teachersCount, activeUsersCount] = await Promise.all([
      this.prisma.organizationMembership.count({ where: { organizationId: orgId } }),
      this.prisma.student.count({ where: { organizationId: orgId } }),
      this.prisma.teacher.count({ where: { organizationId: orgId } }),
      this.prisma.organizationMembership.count({
        where: { organizationId: orgId, status: 'ACTIVE', user: { isActive: true } },
      }),
    ]);

    const roleBreakdown = await this.prisma.organizationMembership.groupBy({
      by: ['role'],
      where: { organizationId: orgId },
      _count: true,
    });

    return {
      organizationId: orgId,
      name: org.name,
      status: org.status,
      isActive: org.isActive,
      totalMembers: membershipsCount,
      activeMembers: activeUsersCount,
      studentsCount,
      teachersCount,
      roleDistribution: roleBreakdown.reduce((acc, r) => {
        acc[r.role] = r._count;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  // ==========================================================================
  // 2. ACCOUNT MANAGEMENT (OWNER ONLY)
  // ==========================================================================

  async createAccount(dto: CreateAccountDto, actorId: string) {
    // 1. Username validation & normalization
    const validation = validateUsername(dto.username);
    if (!validation.valid) {
      throw new BadRequestException(validation.error);
    }
    const normalizedUsername = normalizeUsername(dto.username);

    // 2. Role restriction: PLATFORM_OWNER cannot be created via standard provisioning
    if (dto.role === Role.PLATFORM_OWNER) {
      throw new ForbiddenException('PLATFORM_OWNER accounts can only be established via the bootstrap process');
    }

    // 3. Verify organization exists and is active
    const org = await this.prisma.organization.findUnique({
      where: { id: dto.organizationId },
      select: { id: true, isActive: true, status: true },
    });
    if (!org) {
      throw new NotFoundException(`Target organization ${dto.organizationId} does not exist`);
    }

    // 4. Check global username uniqueness (case-insensitive)
    const existingUser = await this.prisma.user.findFirst({
      where: { username: { equals: normalizedUsername, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existingUser) {
      throw new ConflictException(`Username "${normalizedUsername}" is already taken`);
    }

    // 5. Check email uniqueness if email is provided
    const email = dto.email ? normalizeEmail(dto.email) : `usr-${randomUUID()}@placeholder.local`;
    if (dto.email) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (existingEmail) {
        throw new ConflictException(`Email "${email}" is already registered`);
      }
    }

    // 6. Hash password using secure bcrypt configuration
    const passwordHash = await hashPassword(dto.password);

    // 7. Atomic transaction: create User, OrganizationMembership, PasswordHistory, and role profiles
    const user = await this.prisma.$transaction(async (tx) => {
      // Advisory lock on username to prevent race conditions
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`medu_user_${normalizedUsername}`}))`;

      const recheck = await tx.user.findFirst({
        where: { username: { equals: normalizedUsername, mode: 'insensitive' } },
        select: { id: true },
      });
      if (recheck) {
        throw new ConflictException(`Username "${normalizedUsername}" is already taken`);
      }

      const createdUser = await tx.user.create({
        data: {
          username: normalizedUsername,
          email,
          passwordHash,
          mustChangePassword: dto.mustChangePassword !== false,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          phone: dto.phone?.trim() || null,
          role: dto.role,
          status: dto.status || UserStatus.ACTIVE,
          isActive: (dto.status || UserStatus.ACTIVE) === UserStatus.ACTIVE,
          organizationId: dto.organizationId,
          settings: { create: {} },
        },
      });

      // Create membership
      await tx.organizationMembership.create({
        data: {
          userId: createdUser.id,
          organizationId: dto.organizationId,
          role: dto.role,
          status: (dto.status || UserStatus.ACTIVE) === UserStatus.ACTIVE ? MembershipStatus.ACTIVE : MembershipStatus.SUSPENDED,
        },
      });

      // Record in password history
      await tx.passwordHistory.create({
        data: {
          userId: createdUser.id,
          passwordHash,
        },
      });

      // Role profile creation if STUDENT or TEACHER
      if (dto.role === Role.STUDENT) {
        await tx.student.create({
          data: {
            userId: createdUser.id,
            organizationId: dto.organizationId,
            branchId: dto.branchId || null,
          },
        });
      } else if (dto.role === Role.TEACHER || dto.role === Role.ASSISTANT) {
        await tx.teacher.create({
          data: {
            userId: createdUser.id,
            organizationId: dto.organizationId,
            specializations: [],
          },
        });
      }

      return createdUser;
    });

    // 8. Log audit security event
    await this.security.logEvent({
      eventType: SecurityEventType.ACCOUNT_CREATED,
      organizationId: dto.organizationId,
      userId: actorId,
      resourceType: 'User',
      resourceId: user.id,
      success: true,
      metadata: {
        username: user.username,
        role: dto.role,
        organizationId: dto.organizationId,
        mustChangePassword: user.mustChangePassword,
      },
    });

    this.logger.log(`Account "${user.username}" (${user.id}) provisioned by ${actorId}`);

    return {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email.endsWith('@placeholder.local') ? null : user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
      organizationId: user.organizationId,
      createdAt: user.createdAt,
    };
  }

  async updateAccount(id: string, dto: UpdateAccountDto, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);

    if (user.role === Role.PLATFORM_OWNER && dto.role !== undefined && dto.role !== Role.PLATFORM_OWNER) {
      throw new ForbiddenException('Cannot modify PLATFORM_OWNER global role via account editor');
    }

    const data: Prisma.UserUpdateInput = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) data.lastName = dto.lastName.trim();
    if (dto.phone !== undefined) data.phone = dto.phone.trim() || null;
    if (dto.avatar !== undefined) data.avatar = dto.avatar;
    if (dto.email !== undefined) {
      const email = normalizeEmail(dto.email);
      const existing = await this.prisma.user.findFirst({
        where: { email, id: { not: id } },
      });
      if (existing) throw new ConflictException(`Email "${email}" is already used by another account`);
      data.email = email;
    }
    if (dto.status !== undefined) {
      data.status = dto.status;
      data.isActive = dto.status === UserStatus.ACTIVE;
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        isActive: true,
        updatedAt: true,
      },
    });

    // If status became inactive/suspended, revoke sessions
    if (dto.status !== undefined && dto.status !== UserStatus.ACTIVE) {
      await this.prisma.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'account_status_changed' },
      });
      this.syncGateway?.emitSessionRevoked(id, null, 'account_status_changed');
    }

    return updated;
  }

  async activateAccount(id: string, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { status: UserStatus.ACTIVE, isActive: true },
      });
      await tx.organizationMembership.updateMany({
        where: { userId: id },
        data: { status: MembershipStatus.ACTIVE },
      });
    });

    await this.security.logEvent({
      eventType: SecurityEventType.ACCOUNT_ACTIVATED,
      organizationId: user.organizationId,
      userId: actorId,
      resourceType: 'User',
      resourceId: id,
      success: true,
    });

    return { message: 'Account activated successfully', id };
  }

  async suspendAccount(id: string, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);

    if (user.role === Role.PLATFORM_OWNER) {
      throw new ForbiddenException('Cannot suspend the PLATFORM_OWNER account');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { status: UserStatus.SUSPENDED, isActive: false },
      });
      await tx.organizationMembership.updateMany({
        where: { userId: id },
        data: { status: MembershipStatus.SUSPENDED },
      });
      // Invalidate all active sessions immediately
      await tx.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'account_suspended' },
      });
    });

    this.syncGateway?.emitSessionRevoked(id, null, 'account_suspended');

    await this.security.logEvent({
      eventType: SecurityEventType.ACCOUNT_SUSPENDED,
      organizationId: user.organizationId,
      userId: actorId,
      resourceType: 'User',
      resourceId: id,
      success: true,
    });

    return { message: 'Account suspended and all active sessions revoked', id };
  }

  async resetPassword(id: string, dto: ResetAccountPasswordDto, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);

    const passwordHash = await hashPassword(dto.newPassword);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          passwordHash,
          mustChangePassword: dto.mustChangePassword !== false,
        },
      });

      await tx.passwordHistory.create({
        data: {
          userId: id,
          passwordHash,
        },
      });

      // Revoke all existing sessions immediately
      await tx.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'admin_password_reset' },
      });
    });

    this.syncGateway?.emitSessionRevoked(id, null, 'admin_password_reset');

    await this.security.logEvent({
      eventType: SecurityEventType.PASSWORD_RESET,
      organizationId: user.organizationId,
      userId: actorId,
      resourceType: 'User',
      resourceId: id,
      success: true,
      metadata: { mustChangePassword: dto.mustChangePassword !== false },
    });

    this.logger.log(`Administrative password reset for user ${id} by ${actorId}`);

    return { message: 'Password reset successfully. User must change password on next login.' };
  }

  async assignMembership(userId: string, dto: AssignMembershipDto, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    const org = await this.prisma.organization.findUnique({ where: { id: dto.organizationId } });
    if (!org) throw new NotFoundException(`Organization ${dto.organizationId} not found`);

    if (dto.role === Role.PLATFORM_OWNER) {
      throw new ForbiddenException('Cannot grant PLATFORM_OWNER role via membership assignment');
    }

    const membership = await this.prisma.organizationMembership.upsert({
      where: {
        userId_organizationId: {
          userId,
          organizationId: dto.organizationId,
        },
      },
      update: {
        role: dto.role,
        status: dto.status || MembershipStatus.ACTIVE,
      },
      create: {
        userId,
        organizationId: dto.organizationId,
        role: dto.role,
        status: dto.status || MembershipStatus.ACTIVE,
      },
    });

    await this.security.logEvent({
      eventType: SecurityEventType.MEMBERSHIP_CREATED,
      organizationId: dto.organizationId,
      userId: actorId,
      resourceType: 'OrganizationMembership',
      resourceId: membership.id,
      success: true,
      metadata: { targetUserId: userId, role: dto.role },
    });

    return membership;
  }

  async revokeMembership(userId: string, organizationId: string, actorId: string) {
    const membership = await this.prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
    });
    if (!membership) {
      throw new NotFoundException(`Membership for user ${userId} in org ${organizationId} not found`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.organizationMembership.update({
        where: { id: membership.id },
        data: { status: MembershipStatus.REVOKED },
      });
      // Revoke any active sessions for that user within this organization
      await tx.session.updateMany({
        where: { userId, organizationId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'membership_revoked' },
      });
    });

    this.syncGateway?.emitSessionRevoked(userId, null, 'membership_revoked');

    await this.security.logEvent({
      eventType: SecurityEventType.MEMBERSHIP_REVOKED,
      organizationId,
      userId: actorId,
      resourceType: 'OrganizationMembership',
      resourceId: membership.id,
      success: true,
      metadata: { targetUserId: userId },
    });

    return { message: 'Membership revoked successfully' };
  }

  async getAccount(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        isActive: true,
        mustChangePassword: true,
        organizationId: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        organization: {
          select: { id: true, name: true, status: true },
        },
        memberships: {
          include: {
            organization: {
              select: { id: true, name: true, status: true },
            },
          },
        },
      },
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async getAccountSecurityHistory(userId: string) {
    const events = await this.prisma.securityEvent.findMany({
      where: {
        OR: [{ userId }, { resourceId: userId }],
      },
      orderBy: { timestamp: 'desc' },
      take: 50,
    });
    return events;
  }

  // ==========================================================================
  // 3. BULK PROVISIONING (OWNER ONLY)
  // ==========================================================================

  async previewBulk(records: BulkAccountRowDto[]) {
    if (!Array.isArray(records) || records.length === 0) {
      throw new BadRequestException('Records array must not be empty');
    }

    const orgIds = new Set<string>();
    const seenUsernames = new Set<string>();
    const previewResults: Array<{
      row: number;
      username: string;
      role: string;
      organizationId: string;
      valid: boolean;
      errors: string[];
    }> = [];

    for (const r of records) {
      if (r.organizationId) orgIds.add(r.organizationId);
    }

    // Verify existing organizations
    const existingOrgs = await this.prisma.organization.findMany({
      where: { id: { in: Array.from(orgIds) } },
      select: { id: true, name: true, isActive: true },
    });
    const orgMap = new Map(existingOrgs.map((o) => [o.id, o]));

    // Query existing usernames in DB
    const incomingUsernames = records
      .map((r) => normalizeUsername(r.username))
      .filter((u) => u.length > 0);

    const existingUsers = await this.prisma.user.findMany({
      where: { username: { in: incomingUsernames } },
      select: { username: true },
    });
    const dbUsernames = new Set(existingUsers.map((u) => u.username?.toLowerCase()));

    let validCount = 0;
    let errorCount = 0;

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const errors: string[] = [];
      const rowNum = i + 1;

      // 1. Username
      const normUsername = normalizeUsername(r.username);
      const userVal = validateUsername(normUsername);
      if (!userVal.valid) {
        errors.push(userVal.error || 'Invalid username');
      } else {
        if (seenUsernames.has(normUsername)) {
          errors.push(`Duplicate username "${normUsername}" in bulk batch`);
        }
        if (dbUsernames.has(normUsername)) {
          errors.push(`Username "${normUsername}" already exists in platform`);
        }
        seenUsernames.add(normUsername);
      }

      // 2. Password
      if (!r.password || r.password.length < 8) {
        errors.push('Password must be at least 8 characters long');
      }

      // 3. Name
      if (!r.firstName || !r.firstName.trim()) errors.push('First name is required');
      if (!r.lastName || !r.lastName.trim()) errors.push('Last name is required');

      // 4. Role
      if (!r.role || !Object.values(Role).includes(r.role)) {
        errors.push(`Invalid role "${r.role}"`);
      } else if (r.role === Role.PLATFORM_OWNER) {
        errors.push('Cannot provision PLATFORM_OWNER via bulk import');
      }

      // 5. Organization
      if (!r.organizationId || !orgMap.has(r.organizationId)) {
        errors.push(`Organization ID "${r.organizationId}" does not exist`);
      }

      const isValid = errors.length === 0;
      if (isValid) validCount++;
      else errorCount++;

      previewResults.push({
        row: rowNum,
        username: normUsername || r.username,
        role: r.role,
        organizationId: r.organizationId,
        valid: isValid,
        errors,
      });
    }

    return {
      total: records.length,
      validCount,
      errorCount,
      preview: previewResults,
    };
  }

  async commitBulk(records: BulkAccountRowDto[], actorId: string) {
    const preview = await this.previewBulk(records);
    if (preview.errorCount > 0) {
      throw new BadRequestException(
        `Cannot commit bulk import: ${preview.errorCount} records have validation errors`,
      );
    }

    const results: Array<{ username: string; success: boolean; error?: string }> = [];

    // Use advisory lock and transaction to prevent duplicate account creation under concurrency
    await this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('medu_bulk_provision_commit'))`;

        for (const record of records) {
          const normalizedUsername = normalizeUsername(record.username);
          const email = record.email ? normalizeEmail(record.email) : `bulk-${randomUUID()}@placeholder.local`;
          const passwordHash = await hashPassword(record.password);

          const user = await tx.user.create({
            data: {
              username: normalizedUsername,
              email,
              passwordHash,
              mustChangePassword: true,
              firstName: record.firstName.trim(),
              lastName: record.lastName.trim(),
              phone: record.phone?.trim() || null,
              role: record.role,
              status: UserStatus.ACTIVE,
              isActive: true,
              organizationId: record.organizationId,
              settings: { create: {} },
            },
          });

          await tx.organizationMembership.create({
            data: {
              userId: user.id,
              organizationId: record.organizationId,
              role: record.role,
              status: MembershipStatus.ACTIVE,
            },
          });

          await tx.passwordHistory.create({
            data: {
              userId: user.id,
              passwordHash,
            },
          });

          if (record.role === Role.STUDENT) {
            await tx.student.create({
              data: {
                userId: user.id,
                organizationId: record.organizationId,
                branchId: record.branchId || null,
              },
            });
          } else if (record.role === Role.TEACHER || record.role === Role.ASSISTANT) {
            await tx.teacher.create({
              data: {
                userId: user.id,
                organizationId: record.organizationId,
                specializations: [],
              },
            });
          }

          results.push({ username: normalizedUsername, success: true });
        }
      },
      { timeout: 60000 },
    );

    await this.security.logEvent({
      eventType: SecurityEventType.ACCOUNT_CREATED,
      userId: actorId,
      resourceType: 'BulkProvision',
      success: true,
      metadata: { count: records.length },
    });

    this.logger.log(`Bulk provisioned ${records.length} accounts by ${actorId}`);

    return {
      total: records.length,
      created: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }

  async parseExcelBuffer(buffer: Buffer): Promise<BulkAccountRowDto[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new BadRequestException('Workbook contains no worksheets');
    }

    const records: BulkAccountRowDto[] = [];
    const headerRow = worksheet.getRow(1);
    const headerMap: Record<string, number> = {};

    headerRow.eachCell((cell, colNumber) => {
      const val = String(cell.value || '').trim().toLowerCase();
      headerMap[val] = colNumber;
    });

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip headers

      const getVal = (field: string) => {
        const col = headerMap[field.toLowerCase()];
        if (!col) return '';
        const v = row.getCell(col).value;
        return v ? String(v).trim() : '';
      };

      const username = getVal('username');
      if (!username) return; // skip empty rows

      records.push({
        username,
        password: getVal('password'),
        firstName: getVal('firstname') || getVal('first_name') || getVal('first name'),
        lastName: getVal('lastname') || getVal('last_name') || getVal('last name'),
        email: getVal('email') || undefined,
        phone: getVal('phone') || undefined,
        organizationId: getVal('organizationid') || getVal('organization_id') || getVal('org_id'),
        role: (getVal('role').toUpperCase() as Role) || Role.STUDENT,
        branchId: getVal('branchid') || getVal('branch_id') || undefined,
      });
    });

    return records;
  }

  // ==================== Security Center & Audit Radar ====================

  async getSecurityOverview() {
    const now = new Date();
    const [
      activeSessionsCount,
      totalUsersCount,
      suspendedUsersCount,
      mustChangePasswordCount,
      organizations,
      recentEvents,
    ] = await Promise.all([
      this.prisma.session?.count ? this.prisma.session.count({
        where: { revokedAt: null, expiresAt: { gt: now } },
      }) : 0,
      this.prisma.user?.count ? this.prisma.user.count() : 0,
      this.prisma.user?.count ? this.prisma.user.count({
        where: { OR: [{ status: 'SUSPENDED' }, { isActive: false }] },
      }) : 0,
      this.prisma.user?.count ? this.prisma.user.count({
        where: { mustChangePassword: true },
      }) : 0,
      this.prisma.organization?.groupBy ? this.prisma.organization.groupBy({
        by: ['status'],
        _count: { id: true },
      }) : [],
      this.prisma.securityEvent?.count ? this.prisma.securityEvent.count({
        where: { timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }) : 0,
    ]);

    const activeOrgs = organizations.find((o: any) => o.status === 'ACTIVE')?._count?.id || 0;
    const suspendedOrgs = organizations.find((o: any) => o.status === 'SUSPENDED')?._count?.id || 0;

    return {
      activeSessionsCount,
      totalUsersCount,
      suspendedUsersCount,
      mustChangePasswordCount,
      organizations: {
        total: activeOrgs + suspendedOrgs,
        active: activeOrgs,
        suspended: suspendedOrgs,
      },
      recentEvents24h: recentEvents,
    };
  }

  async getActiveSessions(limit = 50) {
    if (!this.prisma.session?.findMany) return [];
    const now = new Date();
    const sessions = await this.prisma.session.findMany({
      where: { revokedAt: null, expiresAt: { gt: now } },
      orderBy: { lastActiveAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return sessions.map((s) => ({
      id: s.id,
      userId: s.userId,
      username: s.user?.username,
      fullName: `${s.user?.firstName || ''} ${s.user?.lastName || ''}`.trim() || 'Foydalanuvchi',
      role: s.user?.role,
      organizationId: s.organizationId,
      organizationName: s.organization?.name || 'Tashkilot',
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      lastActiveAt: s.lastActiveAt,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
    }));
  }

  async terminateSession(sessionId: string, actorId: string) {
    if (!this.prisma.session) throw new NotFoundException('Session not found');
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Session not found');

    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        revokedAt: new Date(),
        revokedReason: 'terminated_by_platform_owner',
      },
    });

    await this.security.logEvent({
      eventType: SecurityEventType.SESSION_REVOKED,
      organizationId: session.organizationId,
      userId: session.userId,
      resourceType: 'Session',
      resourceId: sessionId,
      success: true,
    });

    return { message: 'Session successfully terminated', id: sessionId };
  }

  async getSecurityEvents(limit = 50) {
    if (!this.prisma.securityEvent?.findMany) {
      return [];
    }
    const events = await this.prisma.securityEvent.findMany({
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
    return events;
  }
}
