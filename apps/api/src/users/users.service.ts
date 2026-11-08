import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Logger, forwardRef, Inject, Optional } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { hashPassword } from '../auth/auth.config';
import { normalizeUsername } from '../auth/username.utils';
import { PrismaService } from '../prisma/prisma.service';
import { parsePagination } from '../lib/pagination';
import { Prisma, Role } from '@prisma/client';
import { CreateUserDto, UpdateUserDto, UpdateUserSettingsDto } from '../common/dto';
import { CLOCK_PATTERN } from '../notifications/quiet-hours';
import { UserQuery } from '../common/dto/query';
import { SyncGateway } from '../auth/sync.gateway';

/**
 * Service for managing user accounts and RBAC access across multi-tenant environments.
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(forwardRef(() => SyncGateway)) private readonly syncGateway?: SyncGateway,
  ) {}

  /**
   * List all users within an organization with pagination and filters.
   */
  async findAll(organizationId: string, query: UserQuery) {
    if (!organizationId || typeof organizationId !== 'string' || !organizationId.trim()) {
      throw new BadRequestException('Organization context is required');
    }
    const { page, limit, skip } = parsePagination(query);
    const where: Prisma.UserWhereInput = { organizationId };

    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.role) where.role = query.role as Role;
    if (query.isActive !== undefined) where.isActive = query.isActive === 'true';

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / (limit || 1)) };
  }

  /**
   * Retrieves a single user profile including basic settings.
   */
  async findOne(organizationId: string, id: string) {
    if (!organizationId || typeof organizationId !== 'string' || !organizationId.trim()) {
      throw new BadRequestException('Organization context is required');
    }
    if (!id || typeof id !== 'string' || !id.trim()) {
      throw new BadRequestException('User ID is required');
    }
    const user = await this.prisma.user.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        role: true,
        isActive: true,
        provider: true,
        lastLoginAt: true,
        createdAt: true,
        settings: true,
      },
    });
    
    if (!user) {
      this.logger.warn(`User ${id} not found in org ${organizationId}`);
      throw new NotFoundException('User not found');
    }
    return user;
  }

  /**
   * Creates a new user with proper RBAC permission checks.
   */
  async create(organizationId: string, data: CreateUserDto, actorRole?: string) {
    if (actorRole !== 'PLATFORM_OWNER' && actorRole !== Role.PLATFORM_OWNER) {
      throw new ForbiddenException('Only the Platform Owner can provision user accounts');
    }
    if (!organizationId || typeof organizationId !== 'string' || !organizationId.trim()) {
      throw new BadRequestException('Organization context is required');
    }

    // Only a platform SUPER_ADMIN may mint another SUPER_ADMIN
    if (data.role === Role.SUPER_ADMIN && (actorRole as string) !== Role.SUPER_ADMIN && (actorRole as string) !== 'PLATFORM_OWNER') {
      this.logger.error(`Attempt to mint SUPER_ADMIN by role ${actorRole}`);
      throw new ForbiddenException('Only a SUPER_ADMIN can assign the SUPER_ADMIN role');
    }
    
    // Only a SUPER_ADMIN may mint an ORG_ADMIN
    if (data.role === Role.ORG_ADMIN && (actorRole as string) !== Role.SUPER_ADMIN && (actorRole as string) !== 'PLATFORM_OWNER') {
      this.logger.warn(`Unauthorized attempt to mint ORG_ADMIN by role ${actorRole}`);
      throw new ForbiddenException('Only a SUPER_ADMIN can grant the ORG_ADMIN role');
    }

    if (this.prisma.organization?.findUnique) {
      const org = await this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true },
      });
      if (!org) {
        throw new NotFoundException('Organization not found');
      }
    }

    const existing = await this.prisma.user.findFirst({ where: { email: data.email } });
    if (existing) throw new BadRequestException('Email already registered');

    const passwordHash = data.password ? await hashPassword(data.password) : null;

    try {
      const normUsername = normalizeUsername((data as any).username || data.email.split('@')[0]);
      const user = await this.prisma.user.create({
        data: {
          organizationId,
          username: normUsername,
          mustChangePassword: true,
          email: data.email,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          role: data.role,
          // Account-model opt-in for passwordless Google sign-in (P0-2).
          // Defaults to false: an administrator must opt in explicitly.
          googleLinkAllowed: data.googleLinkAllowed ?? false,
          settings: { create: {} },
        },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
      },
    });
      if (this.prisma.organizationMembership?.create) {
        await this.prisma.organizationMembership.create({
          data: {
            userId: user.id,
            organizationId,
            role: data.role,
            status: 'ACTIVE',
          },
        });
      }
      if (passwordHash && this.prisma.passwordHistory?.create) {
        await this.prisma.passwordHistory.create({
          data: {
            userId: user.id,
            passwordHash,
          },
        });
      }
      this.logger.log(`User created: ${user.id} with role ${user.role}`);
      return user;
    } catch (error: unknown) {
      if ((error as { code?: string })?.code === 'P2002') {
        throw new BadRequestException('Username or email is already taken');
      }
      throw error;
    }
  }

  /**
   * Safely update a user profile. Enforces strict hierarchy protections.
   */
  async update(
    organizationId: string,
    id: string,
    data: UpdateUserDto,
    actorRole?: string,
    actorUserId?: string,
  ) {
    if ((data as any).password && actorRole !== 'PLATFORM_OWNER' && actorRole !== Role.PLATFORM_OWNER) {
      throw new ForbiddenException('Organization administrator cannot reset another user password');
    }
    const target = await this.findOne(organizationId, id);

    // 1. Only a SUPER_ADMIN may assign the SUPER_ADMIN role.
    if (data.role === Role.SUPER_ADMIN && actorRole !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only a SUPER_ADMIN can assign the SUPER_ADMIN role');
    }
    // 2. ORG_ADMIN must not manage another admin
    if (
      actorRole === Role.ORG_ADMIN &&
      (target.role === Role.ORG_ADMIN || target.role === Role.SUPER_ADMIN) &&
      (data.role !== undefined || data.isActive !== undefined)
    ) {
      throw new ForbiddenException('ORG_ADMIN cannot change the role or status of an admin account');
    }
    // 3. ORG_ADMIN may not promote someone to ORG_ADMIN
    if (actorRole === Role.ORG_ADMIN && data.role === Role.ORG_ADMIN) {
      throw new ForbiddenException('Only a SUPER_ADMIN can grant the ORG_ADMIN role');
    }
    // 4. No user may change their OWN role or status
    if (actorUserId === id && (data.role !== undefined || data.isActive !== undefined)) {
      throw new ForbiddenException('You cannot change your own role or account status');
    }
    
    // 5. Protect the last SUPER_ADMIN
    if (
      target.role === Role.SUPER_ADMIN &&
      target.isActive &&
      (data.role !== undefined || data.isActive !== undefined) &&
      (data.role !== Role.SUPER_ADMIN || data.isActive === false)
    ) {
      const activeSuperAdmins = await this.prisma.user.count({
        where: { role: Role.SUPER_ADMIN, isActive: true },
      });
      if (activeSuperAdmins <= 1) {
        throw new ForbiddenException('Cannot demote or deactivate the last active SUPER_ADMIN');
      }
    }

    const updateData: Prisma.UserUpdateInput = {};
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.googleLinkAllowed !== undefined) updateData.googleLinkAllowed = data.googleLinkAllowed;

    if (Object.keys(updateData).length === 0) return this.findOne(organizationId, id);

    const updated = await this.prisma.user.update({ 
      where: { id, organizationId }, 
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      }
    });
    this.logger.log(`User ${id} updated by ${actorUserId}`);
    return updated;
  }

  /**
   * Allows a user to change their own password, invalidating old sessions.
   */
  async changePassword(
    organizationId: string,
    userId: string,
    currentPassword: string,
    newPassword: string,
    currentSessionId?: string | null,
  ) {
    if (!organizationId || typeof organizationId !== 'string' || !organizationId.trim()) {
      throw new BadRequestException('Organization context is required');
    }
    const user = await this.prisma.user.findFirst({ where: { id: userId, organizationId } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.passwordHash) {
      throw new BadRequestException('This account uses Google Sign-In and has no password');
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    const passwordHash = await hashPassword(newPassword);
    
    await this.prisma.$transaction(async (tx) => {
      await tx.user.updateMany({
        where: { id: userId, organizationId },
        data: { passwordHash },
      });
      await tx.session.updateMany({
        where: {
          userId,
          revokedAt: null,
          ...(currentSessionId ? { id: { not: currentSessionId } } : {}),
        },
        data: { revokedAt: new Date(), revokedReason: 'password_changed' },
      });
      if ((tx as any).auditLog?.create) {
        await (tx as any).auditLog.create({
          data: {
            organizationId,
            userId,
            action: 'UPDATE',
            resource: 'User',
            resourceId: userId,
            changes: { password: { old: '***', new: '***' } },
          },
        });
      }
    });
    this.logger.log(`Password changed for user ${userId}`);
    this.syncGateway?.emitSessionRevoked(userId, null, 'password_changed', currentSessionId || undefined);
    return { message: 'Password changed successfully' };
  }

  /**
   * Update internal user preferences/settings safely.
   */
  async updateSettings(
    organizationId: string,
    id: string,
    data: UpdateUserSettingsDto,
    actorUserId?: string,
    actorRole?: string,
  ) {
    if (actorUserId !== id && actorRole !== Role.ORG_ADMIN && actorRole !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('You can only update your own settings');
    }
    
    if (data.quietHoursStart !== undefined && data.quietHoursStart !== null) {
      if (!CLOCK_PATTERN.test(data.quietHoursStart.trim())) {
        throw new BadRequestException('quietHoursStart must be in valid 24-hour HH:mm format (00:00 to 23:59)');
      }
    }
    if (data.quietHoursEnd !== undefined && data.quietHoursEnd !== null) {
      if (!CLOCK_PATTERN.test(data.quietHoursEnd.trim())) {
        throw new BadRequestException('quietHoursEnd must be in valid 24-hour HH:mm format (00:00 to 23:59)');
      }
    }

    // FIX: EXPLICIT organization check to prevent IDOR!
    const target = await this.findOne(organizationId, id);

    const existing = await this.prisma.userSettings.findUnique({ where: { userId: target.id } });
    if (!existing) {
      return this.prisma.userSettings.create({ data: { userId: target.id, ...data } }).then(async (updated) => {
        this.syncGateway?.emitUserSync(target.id, { type: 'SETTINGS_UPDATED', payload: updated });
        return updated;
      });
    }
    return this.prisma.userSettings.update({ where: { userId: target.id }, data }).then(async (updated) => {
      this.syncGateway?.emitUserSync(target.id, { type: 'SETTINGS_UPDATED', payload: updated });
      return updated;
    });
  }

  /**
   * Permanently delete a user account safely (RESTRICT FKs, Audit trail persistence).
   */
  async remove(organizationId: string, id: string, actorUserId?: string, actorRole?: string) {
    const target = await this.findOne(organizationId, id);

    if (actorUserId === id) throw new BadRequestException('You cannot delete your own account');
    
    if (actorRole === Role.ORG_ADMIN && (target.role === Role.ORG_ADMIN || target.role === Role.SUPER_ADMIN)) {
      throw new ForbiddenException('ORG_ADMIN cannot delete an admin account');
    }
    
    if (target.role === Role.SUPER_ADMIN && target.isActive) {
      const activeSuperAdmins = await this.prisma.user.count({
        where: { role: Role.SUPER_ADMIN, isActive: true },
      });
      if (activeSuperAdmins <= 1) throw new ForbiddenException('Cannot delete the last active SUPER_ADMIN');
    }

    const [student, teacher, employee] = await Promise.all([
      this.prisma.student?.findUnique ? this.prisma.student.findUnique({ where: { userId: id } }) : null,
      this.prisma.teacher?.findUnique ? this.prisma.teacher.findUnique({ where: { userId: id } }) : null,
      this.prisma.employee?.findUnique ? this.prisma.employee.findUnique({ where: { userId: id } }) : null,
    ]);
    
    if (student || teacher || employee) {
      throw new BadRequestException('This account has a linked profile (Student/Teacher/Employee) with historical records — deactivate the account instead of deleting it');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.notification.deleteMany({ where: { userId: id } });
        await tx.session.deleteMany({ where: { userId: id } });
        await tx.userSettings.deleteMany({ where: { userId: id } });
        await tx.user.delete({ where: { id, organizationId } });
      });
      this.logger.log(`User ${id} deleted by ${actorUserId}`);
      return { message: 'User deleted successfully' };
    } catch (e: unknown) {
      if (e instanceof BadRequestException || e instanceof ForbiddenException || e instanceof NotFoundException) {
        throw e;
      }
      this.logger.error(`Failed to delete user ${id}`, e instanceof Error ? e.stack : String(e));
      throw new BadRequestException('Cannot delete user due to system constraints.');
    }
  }
}

