import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { parsePagination } from '../lib/pagination';
import { Prisma } from '@prisma/client';
import { CreateStudentDto, UpdateStudentDto } from '../common/dto';
import { StudentQuery } from '../common/dto/query';

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, query: StudentQuery) {
    const { page, limit, skip } = parsePagination(query);
    const where: Prisma.StudentWhereInput = { organizationId };

    if (query.search) {
      where.OR = [
        { user: { firstName: { contains: query.search, mode: 'insensitive' } } },
        { user: { lastName: { contains: query.search, mode: 'insensitive' } } },
        { user: { email: { contains: query.search, mode: 'insensitive' } } },
      ];
    }
    if (query.groupId) {
      // The groupId filter is scoped by tenant as well: a membership row is
      // only valid if the student, group and membership share one
      // organization, so filtering on (groupId + organizationId) is both a
      // correctness invariant and defense in depth against cross-tenant
      // group references from a crafted query.
      where.groups = { some: { groupId: query.groupId, isActive: true, organizationId } };
    }
    if (query.isActive !== undefined) {
      where.user = { isActive: query.isActive === 'true' };
    }

    const [items, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, isActive: true } },
          groups: { where: { isActive: true }, include: { group: { select: { id: true, name: true } } } },
          _count: { select: { payments: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.student.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(organizationId: string, id: string) {
    const student = await this.prisma.student.findFirst({
      where: { id, organizationId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, isActive: true } },
        groups: { where: { isActive: true }, include: { group: { select: { id: true, name: true, room: true } } } },
        payments: { orderBy: { createdAt: 'desc' }, take: 10 },
        attendance: { orderBy: { date: 'desc' }, take: 10 },
      },
    });
    if (!student) throw new NotFoundException('Student not found');
    return student;
  }

  async create(organizationId: string, data: CreateStudentDto) {
    if (data.email) {
      const existing = await this.prisma.user.findFirst({ where: { email: data.email } });
      if (existing) throw new BadRequestException('Email already registered');
    }

    const passwordHash = data.password ? await bcrypt.hash(data.password, 10) : null;
    const email = data.email || `student-${randomUUID()}@placeholder.local`;

    return this.prisma.student.create({
      data: {
        organization: { connect: { id: organizationId } },
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        gender: data.gender,
        address: data.address,
        notes: data.notes,
        parentName: data.parentName,
        parentPhone: data.parentPhone,
        parentEmail: data.parentEmail,
        user: {
          create: {
            organization: { connect: { id: organizationId } },
            email,
            passwordHash,
            firstName: data.firstName,
            lastName: data.lastName,
            phone: data.phone,
            role: 'STUDENT',
            settings: { create: {} },
          },
        },
      },
      include: { user: true },
    });
  }

  async update(organizationId: string, id: string, data: UpdateStudentDto) {
    await this.findOne(organizationId, id);

    const studentData: Prisma.StudentUpdateInput = {};
    if (data.dateOfBirth !== undefined) studentData.dateOfBirth = new Date(data.dateOfBirth);
    if (data.gender !== undefined) studentData.gender = data.gender;
    if (data.address !== undefined) studentData.address = data.address;
    if (data.notes !== undefined) studentData.notes = data.notes;
    if (data.parentName !== undefined) studentData.parentName = data.parentName;
    if (data.parentPhone !== undefined) studentData.parentPhone = data.parentPhone;
    if (data.parentEmail !== undefined) studentData.parentEmail = data.parentEmail;

    const userData: Prisma.UserUpdateInput = {};
    if (data.firstName !== undefined) userData.firstName = data.firstName;
    if (data.lastName !== undefined) userData.lastName = data.lastName;
    if (data.phone !== undefined) userData.phone = data.phone;

    if (Object.keys(studentData).length === 0 && Object.keys(userData).length === 0) {
      return this.findOne(organizationId, id);
    }

    return this.prisma.student.update({
      where: { id, organizationId },
      data: {
        ...studentData,
        ...(Object.keys(userData).length > 0 ? { user: { update: userData } } : {}),
      },
      include: { user: true },
    });
  }

  /**
   * Hard-delete a student AND their linked login account.
   *
   * Mirror of the UsersService.delete pattern with FK-aware guards:
   *  - Rejects students that own historical records (payments, attendance,
   *    grades, face enrollments/attempts, camera events) — those rows are
   *    RESTRICT/SET-NULL protected, so deletion would silently destroy or
   *    orphan history. Deactivation is the correct path for those accounts.
   *  - When the student has no history, removes StudentGroup memberships
   *    (cascade), the Student row, and the linked User row in one
   *    transaction so the deleted student cannot log in.
   */
  async remove(organizationId: string, id: string) {
    const student = await this.findOne(organizationId, id);

    const [paymentCount, attendanceCount, gradeCount, enrollmentCount, attemptCount, cameraEventCount] =
      await Promise.all([
        this.prisma.payment.count({ where: { studentId: id, organizationId } }),
        this.prisma.attendance.count({ where: { studentId: id, organizationId } }),
        this.prisma.grade.count({ where: { studentId: id, organizationId } }),
        this.prisma.faceEnrollment.count({ where: { studentId: id, organizationId } }),
        this.prisma.recognitionAttempt.count({ where: { identifiedStudentId: id, organizationId } }),
        this.prisma.cameraAttendanceEvent.count({ where: { studentId: id, organizationId } }),
      ]);

    if (
      paymentCount + attendanceCount + gradeCount + enrollmentCount + attemptCount + cameraEventCount >
      0
    ) {
      throw new BadRequestException(
        'This student has historical records (payments, attendance, grades, or face data) — deactivate the student instead of deleting them',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // StudentGroup memberships cascade on Student delete; remove explicitly
      // for clarity and to keep the transaction deterministic.
      await tx.studentGroup.deleteMany({ where: { studentId: id, organizationId } });
      await tx.student.delete({ where: { id, organizationId } });

      // Remove the linked login account so a deleted student cannot sign in.
      // (FaceAuditEvent.userId is SET NULL automatically.)
      if (student.userId) {
        await tx.notification.deleteMany({ where: { userId: student.userId } });
        await tx.session.deleteMany({ where: { userId: student.userId } });
        await tx.userSettings.deleteMany({ where: { userId: student.userId } });
        await tx.user.delete({ where: { id: student.userId } });
      }
    });

    return { message: 'Student deleted successfully' };
  }

  async assignToGroup(organizationId: string, studentId: string, groupId: string) {
    const group = await this.prisma.group.findFirst({ where: { id: groupId, organizationId } });
    if (!group) throw new NotFoundException('Group not found');

    const student = await this.prisma.student.findFirst({
      where: { id: studentId, organizationId },
    });
    if (!student) throw new NotFoundException('Student not found');

    // Enforce group capacity BEFORE adding — check within a transaction so two
    // concurrent requests cannot both pass when only 1 slot remains.
    return this.prisma.$transaction(async (tx) => {
      // Count active enrollments (including this student if re-activating).
      const currentCount = await tx.studentGroup.count({
        where: { groupId, isActive: true },
      });

      // If the student is already an active member, upsert is safe — they are
      // already counted, capacity is not exceeded.
      const alreadyActive = await tx.studentGroup.findUnique({
        where: { studentId_groupId: { studentId, groupId } },
      });
      if (!alreadyActive || !alreadyActive.isActive) {
        if (group.capacity !== null && currentCount >= group.capacity) {
          throw new BadRequestException(
            `Guruh sig'imiga yetildi: ${currentCount}/${group.capacity}. Yangi talaba qo'sha olmaysiz.`,
          );
        }
      }

      // Upsert handles the re-activation case (inactive → active) without
      // double-counting; concurrent composite-PK error is impossible inside
      // this transaction because the unique constraint is enforced by the DB.
      return tx.studentGroup.upsert({
        where: { studentId_groupId: { studentId, groupId } },
        update: { isActive: true, organizationId },
        create: { organizationId, studentId, groupId, isActive: true },
      });
    });
  }

  async removeFromGroup(organizationId: string, studentId: string, groupId: string) {
    const membership = await this.prisma.studentGroup.findFirst({
      where: { studentId, groupId, organizationId },
    });
    if (!membership) throw new NotFoundException('Membership not found');
    return this.prisma.studentGroup.update({
      where: { studentId_groupId: { studentId, groupId } },
      data: { isActive: false },
    });
  }
}
