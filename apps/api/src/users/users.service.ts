import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { parsePagination } from '../lib/pagination';
import { Prisma } from '@prisma/client';
import { CreateUserDto, UpdateUserDto, UpdateUserSettingsDto } from '../common/dto';
import { UserQuery } from '../common/dto/query';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, query: UserQuery) {
    const { page, limit, skip } = parsePagination(query);
    const where: Prisma.UserWhereInput = { organizationId };

    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.role) where.role = query.role as Prisma.UserWhereInput['role'];
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

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(organizationId: string, id: string) {
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
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(organizationId: string, data: CreateUserDto, actorRole?: string) {
    // Only a platform SUPER_ADMIN may mint another SUPER_ADMIN — an ORG_ADMIN
    // must not be able to grant the role that bypasses all permission checks.
    if (data.role === 'SUPER_ADMIN' && actorRole !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only a SUPER_ADMIN can assign the SUPER_ADMIN role');
    }
    // ORG_ADMINs create MANAGER-and-below accounts only; admin accounts are
    // the tenant trust anchor and are minted exclusively by SUPER_ADMIN.
    if (data.role === 'ORG_ADMIN' && actorRole !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only a SUPER_ADMIN can grant the ORG_ADMIN role');
    }

    const existing = await this.prisma.user.findFirst({ where: { email: data.email } });
    if (existing) throw new BadRequestException('Email already registered');

    const passwordHash = data.password ? await bcrypt.hash(data.password, 10) : null;

    return this.prisma.user.create({
      data: {
        organizationId,
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        role: data.role,
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
  }

  async update(
    organizationId: string,
    id: string,
    data: UpdateUserDto,
    actorRole?: string,
    actorUserId?: string,
  ) {
    const target = await this.findOne(organizationId, id);

    // Privilege-escalation guards:
    // 1. Only a SUPER_ADMIN may assign the SUPER_ADMIN role.
    if (data.role === 'SUPER_ADMIN' && actorRole !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only a SUPER_ADMIN can assign the SUPER_ADMIN role');
    }
    // 2. An ORG_ADMIN must not manage (demote/deactivate) another admin or a
    //    SUPER_ADMIN account — admin accounts are the tenant's trust anchor.
    if (
      actorRole === 'ORG_ADMIN' &&
      (target.role === 'ORG_ADMIN' || target.role === 'SUPER_ADMIN') &&
      (data.role !== undefined || data.isActive !== undefined)
    ) {
      throw new ForbiddenException('ORG_ADMIN cannot change the role or status of an admin account');
    }
    // 3. An ORG_ADMIN may not promote a user to ORG_ADMIN either (same reason);
    //    only SUPER_ADMIN decides who is an administrator.
    if (
      actorRole === 'ORG_ADMIN' &&
      data.role === 'ORG_ADMIN'
    ) {
      throw new ForbiddenException('Only a SUPER_ADMIN can grant the ORG_ADMIN role');
    }

    // 4. No user may change their OWN role or account status. Without this, a
    //    SUPER_ADMIN could demote or deactivate themselves and permanently
    //    lock the platform out of admin control (only the seed can mint a
    //    SUPER_ADMIN today).
    if (
      actorUserId === id &&
      (data.role !== undefined || data.isActive !== undefined)
    ) {
      throw new ForbiddenException('You cannot change your own role or account status');
    }
    // 5. The LAST active SUPER_ADMIN must not be demoted or deactivated — that
    //    would leave the platform with no bootstrap path to admin control.
    if (
      target.role === 'SUPER_ADMIN' &&
      target.isActive &&
      (data.role !== undefined || data.isActive !== undefined) &&
      (data.role !== 'SUPER_ADMIN' || data.isActive === false)
    ) {
      const activeSuperAdmins = await this.prisma.user.count({
        where: { role: 'SUPER_ADMIN', isActive: true },
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

    if (Object.keys(updateData).length === 0) return this.findOne(organizationId, id);

    return this.prisma.user.update({ where: { id, organizationId }, data: updateData });
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    currentSessionId?: string | null,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (!user.passwordHash) {
      throw new BadRequestException('This account uses Google Sign-In and has no password');
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash },
      });
      // Revoke every other session — a password change must invalidate
      // tokens issued before the change (stolen-token mitigation). The
      // current session (where the user just proved possession of the old
      // password) is kept for a smooth UX.
      await tx.session.updateMany({
        where: {
          userId,
          revokedAt: null,
          ...(currentSessionId ? { id: { not: currentSessionId } } : {}),
        },
        data: { revokedAt: new Date(), revokedReason: 'password_changed' },
      });
    });
    return { message: 'Password changed successfully' };
  }

  async updateSettings(
    organizationId: string,
    id: string,
    data: UpdateUserSettingsDto,
    actorUserId?: string,
    actorRole?: string,
  ) {
    // IDOR guard: users may only change their OWN settings; org admins may
    // change settings for any user inside their tenant.
    if (actorUserId !== id && actorRole !== 'ORG_ADMIN' && actorRole !== 'SUPER_ADMIN') {
      throw new ForbiddenException('You can only update your own settings');
    }
    await this.findOne(organizationId, id);
    const existing = await this.prisma.userSettings.findUnique({ where: { userId: id } });
    if (!existing) {
      return this.prisma.userSettings.create({ data: { userId: id, ...data } });
    }
    return this.prisma.userSettings.update({ where: { userId: id }, data });
  }

  /**
   * Permanently delete a user account.
   *
   * Only safe for accounts WITHOUT a Student/Teacher profile (those rows are
   * RESTRICT-ed by FKs and carry historical records — deactivate instead).
   * Guard rails: no self-deletion, ORG_ADMINs cannot delete admin accounts,
   * the last active SUPER_ADMIN is protected. Audit events are preserved
   * (FaceAuditEvent.userId is SET NULL on delete).
   */
  async remove(organizationId: string, id: string, actorUserId?: string, actorRole?: string) {
    const target = await this.findOne(organizationId, id);

    if (actorUserId === id) {
      throw new BadRequestException('You cannot delete your own account');
    }
    if (actorRole === 'ORG_ADMIN' && (target.role === 'ORG_ADMIN' || target.role === 'SUPER_ADMIN')) {
      throw new ForbiddenException('ORG_ADMIN cannot delete an admin account');
    }
    if (target.role === 'SUPER_ADMIN' && target.isActive) {
      const activeSuperAdmins = await this.prisma.user.count({
        where: { role: 'SUPER_ADMIN', isActive: true },
      });
      if (activeSuperAdmins <= 1) {
        throw new ForbiddenException('Cannot delete the last active SUPER_ADMIN');
      }
    }

    const [student, teacher] = await Promise.all([
      this.prisma.student.findUnique({ where: { userId: id } }),
      this.prisma.teacher.findUnique({ where: { userId: id } }),
    ]);
    if (student || teacher) {
      throw new BadRequestException(
        'This account has a Student/Teacher profile with historical records — deactivate the account instead of deleting it',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // RESTRICT FKs must be cleared before the User row can go.
      await tx.notification.deleteMany({ where: { userId: id } });
      await tx.session.deleteMany({ where: { userId: id } });
      await tx.userSettings.deleteMany({ where: { userId: id } });
      // FaceAuditEvent.userId is SET NULL — the audit trail survives.
      await tx.user.delete({ where: { id, organizationId } });
    });

    return { message: 'User deleted successfully' };
  }
}

