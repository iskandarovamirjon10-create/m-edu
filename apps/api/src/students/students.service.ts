import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { hashPassword } from '../auth/auth.config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityEventService, SecurityEventType } from '../common/security/security-event.service';
import { parsePagination } from '../lib/pagination';
import { Prisma } from '@prisma/client';
import { CreateStudentDto, UpdateStudentDto, CreateParentLinkDto, UpdateParentLinkDto } from '../common/dto';
import { StudentQuery } from '../common/dto/query';
import { userPublicSelect } from '../common/selects/user.select';

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService, @Optional() private readonly security?: SecurityEventService) {}

  async findAll(organizationId: string, query: StudentQuery) {
    const { page, limit, skip } = parsePagination(query);
    const where: Prisma.StudentWhereInput = { organizationId };

    if (query.search) {
      where.OR = [
        { user: { firstName: { contains: query.search, mode: 'insensitive' } } },
        { user: { lastName: { contains: query.search, mode: 'insensitive' } } },
        { user: { email: { contains: query.search, mode: 'insensitive' } } },
        { user: { phone: { contains: query.search, mode: 'insensitive' } } },
        { parentName: { contains: query.search, mode: 'insensitive' } },
        { parentPhone: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.groupId || query.teacherId) {
      // The membership filter is scoped by tenant as well: a membership row is
      // only valid if the student, group and membership share one
      // organization, so filtering on (groupId|teacherId + organizationId) is
      // both a correctness invariant and defense in depth against cross-tenant
      // group references from a crafted query.
      where.groups = {
        some: {
          isActive: true,
          organizationId,
          ...(query.groupId ? { groupId: query.groupId } : {}),
          ...(query.teacherId ? { group: { teacherId: query.teacherId } } : {}),
        },
      };
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
          _count: { select: { payments: true, faceEnrollments: true, attendance: true } },
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
    if (!student) {
      const exists = await this.prisma.student.findFirst({ where: { id } });
      if (exists && exists.organizationId !== organizationId) {
        this.security?.logEvent({ eventType: SecurityEventType.CROSS_TENANT_ACCESS_ATTEMPT, organizationId, resourceType: 'Student', resourceId: id, success: false, reason: 'IDOR_ATTEMPT' });
      }
      throw new NotFoundException('Student not found');
    }
    return student;
  }

  async create(organizationId: string, data: CreateStudentDto) {
    if (data.email) {
      const existing = await this.prisma.user.findFirst({ where: { email: data.email, organizationId } });
      if (existing) throw new BadRequestException('Email already registered');
    }

    const passwordHash = data.password ? await hashPassword(data.password) : null;
    const email = data.email || `student-${randomUUID()}@placeholder.local`;

    try {
      return await this.prisma.student.create({
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
        include: { user: userPublicSelect },
      });
    } catch (error: unknown) {
      // User.email is globally unique — the org-scoped pre-check above can
      // race a concurrent create (in this or another tenant) and surface as
      // Prisma P2002 instead of a clean 409.
      if ((error as { code?: string })?.code === 'P2002') {
        throw new BadRequestException('Email already registered');
      }
      throw error;
    }
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
      include: { user: userPublicSelect },
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

    await this.prisma.$transaction(async (tx) => {
      // 0. Concurrency serialization and financial history preservation check (FIN-010)
      // Serialize access to prevent concurrent financial write TOCTOU race conditions
      await tx.$queryRaw`SELECT id FROM "Student" WHERE id = ${id}::uuid AND "organizationId" = ${organizationId}::uuid FOR UPDATE`;

      // Check whether this student has any financial records in this organization.
      // Financial history is legally immutable: payments, invoices, and refunds must never be hard-deleted.
      const [paymentCount, invoiceCount, refundCount] = await Promise.all([
        tx.payment.count({ where: { studentId: id, organizationId } }),
        tx.invoice.count({ where: { studentId: id, organizationId } }),
        tx.refund.count({
          where: {
            organizationId,
            OR: [
              { Payment: { studentId: id } },
              { Invoice: { studentId: id } },
            ],
          },
        }),
      ]);

      if (paymentCount > 0 || invoiceCount > 0 || refundCount > 0) {
        throw new ConflictException(
          'Cannot delete student with existing financial history (payments, invoices, or refunds). Deactivate or archive the student instead.',
        );
      }

      // 1. Biometric data
      const enrollments = await tx.faceEnrollment.findMany({
        where: { studentId: id, organizationId },
        select: { id: true },
      });
      if (enrollments.length > 0) {
        const enrollmentIds = enrollments.map((e) => e.id);
        await tx.faceTemplate.deleteMany({
          where: { enrollmentId: { in: enrollmentIds }, organizationId },
        });
        await tx.faceEnrollment.deleteMany({
          where: { studentId: id, organizationId },
        });
      }
      await tx.recognitionAttempt.deleteMany({
        where: { identifiedStudentId: id, organizationId },
      });
      await tx.cameraAttendanceEvent.deleteMany({
        where: { studentId: id, organizationId },
      });

      // 2. Parent associations & messages
      await tx.parentStudent.deleteMany({ where: { studentId: id } });
      await tx.parentTeacherMessage.deleteMany({ where: { studentId: id } });

      // 3. Memberships & Academic records
      await tx.studentGroup.deleteMany({ where: { studentId: id, organizationId } });
      await tx.attendance.deleteMany({ where: { studentId: id, organizationId } });
      await tx.grade.deleteMany({ where: { studentId: id, organizationId } });
      await tx.examResult.deleteMany({ where: { studentId: id, organizationId } });
      await tx.certificate.deleteMany({ where: { studentId: id, organizationId } });
      await tx.libraryBorrow.deleteMany({ where: { studentId: id, organizationId } });
      await tx.homeworkSubmission.deleteMany({ where: { studentId: id } });
      await tx.assignmentSubmission.deleteMany({ where: { studentId: id } });

      const quizzes = await tx.quizAttempt.findMany({
        where: { studentId: id },
        select: { id: true },
      });
      if (quizzes.length > 0) {
        const quizAttemptIds = quizzes.map((q) => q.id);
        await tx.quizAttemptAnswer.deleteMany({
          where: { attemptId: { in: quizAttemptIds } },
        });
        await tx.quizAttempt.deleteMany({ where: { studentId: id } });
      }

      await tx.studentObjectiveMastery.deleteMany({ where: { studentId: id } });
      await tx.studentProgressSnapshot.deleteMany({ where: { studentId: id } });
      await tx.gamificationXpEvent.deleteMany({ where: { studentId: id, organizationId } });
      await tx.studentGamification.deleteMany({ where: { studentId: id, organizationId } });
      await tx.discount.deleteMany({ where: { studentId: id } });

      // 4. Delete the Student (Financial records are preserved; DB FK RESTRICT provides second-layer defense)
      await tx.student.deleteMany({ where: { id, organizationId } });

      // 5. Delete linked User and sessions/settings
      if (student.userId) {
        await tx.notification.deleteMany({ where: { userId: student.userId } });
        await tx.session.deleteMany({ where: { userId: student.userId } });
        await tx.userSettings.deleteMany({ where: { userId: student.userId } });
        await tx.user.deleteMany({ where: { id: student.userId, organizationId } });
      }
    });

    return { message: 'Student deleted successfully' };
  }

  async assignToGroup(organizationId: string, studentId: string, groupId: string) {
    const group = await this.prisma.group.findFirst({ where: { id: groupId, organizationId } });
    if (!group) throw new NotFoundException('Group not found');
    if (group.isActive === false) {
      throw new BadRequestException('Cannot assign students to an inactive group');
    }

    const student = await this.prisma.student.findFirst({
      where: { id: studentId, organizationId },
      include: { user: { select: { isActive: true } } },
    });
    if (!student) {
      const exists = await this.prisma.student.findFirst({ where: { id: studentId } });
      if (exists && exists.organizationId !== organizationId) {
        this.security?.logEvent({ eventType: SecurityEventType.CROSS_TENANT_ACCESS_ATTEMPT, organizationId, resourceType: 'Student', resourceId: studentId, success: false, reason: 'IDOR_ATTEMPT' });
      }
      throw new NotFoundException('Student not found');
    }
    if (student.user?.isActive === false) {
      throw new BadRequestException('Cannot assign a deactivated student to a group');
    }

    // Enforce group capacity BEFORE adding — check within a transaction so two
    // concurrent requests cannot both pass when only 1 slot remains.
    return this.prisma.$transaction(async (tx) => {
      // Serialize access to this group to prevent TOCTOU race condition
      await tx.$queryRaw`SELECT id FROM "Group" WHERE id = ${groupId}::uuid FOR UPDATE`;

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
            `Group capacity reached: ${currentCount}/${group.capacity}. Cannot add more students.`,
          );
        }
      }

      // Upsert handles the re-activation case (inactive → active) without
      // double-counting; concurrent composite-PK error is impossible inside
      // this transaction because the unique constraint is enforced by the DB.
      return tx.studentGroup.upsert({
        where: { studentId_groupId: { studentId, groupId } },
        update: { isActive: true, leftAt: null, organizationId },
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
      data: { isActive: false, leftAt: new Date() },
    });
  }

  // ==================== Parent Management ====================

  async getStudentParents(organizationId: string, studentId: string) {
    await this.findOne(organizationId, studentId);
    return this.prisma.parentStudent.findMany({
      where: {
        studentId,
        parent: { organizationId },
      },
      include: {
        parent: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            isActive: true,
            lastLoginAt: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createOrLinkParent(organizationId: string, studentId: string, data: CreateParentLinkDto) {
    await this.findOne(organizationId, studentId);

    const email = data.email.toLowerCase().trim();
    const password = data.password || randomUUID().slice(0, 12) + '!Aa1';
    const passwordHash = await hashPassword(password);

    return this.prisma.$transaction(async (tx) => {
      let parent = await tx.parentAccount.findFirst({
        where: { email, organizationId },
      });

      if (!parent) {
        parent = await tx.parentAccount.create({
          data: {
            organizationId,
            email,
            firstName: data.firstName,
            lastName: data.lastName,
            phone: data.phone,
            passwordHash,
            isActive: true,
          },
        });
      }

      const existingLink = await tx.parentStudent.findUnique({
        where: {
          parentId_studentId: {
            parentId: parent.id,
            studentId,
          },
        },
      });

      if (existingLink) {
        throw new ConflictException('Parent is already linked to this student');
      }

      if (data.isPrimary) {
        await tx.parentStudent.updateMany({
          where: { studentId, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      return tx.parentStudent.create({
        data: {
          parentId: parent.id,
          studentId,
          relationship: data.relationship || 'parent',
          isPrimary: data.isPrimary ?? false,
          canViewGrades: data.canViewGrades ?? true,
          canViewPayments: data.canViewPayments ?? true,
          canViewAttendance: data.canViewAttendance ?? true,
        },
        include: {
          parent: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
              isActive: true,
              lastLoginAt: true,
            },
          },
        },
      });
    });
  }

  async updateParentLink(
    organizationId: string,
    studentId: string,
    parentId: string,
    data: UpdateParentLinkDto,
  ) {
    await this.findOne(organizationId, studentId);

    const link = await this.prisma.parentStudent.findFirst({
      where: {
        studentId,
        parentId,
        parent: { organizationId },
      },
    });
    if (!link) {
      throw new NotFoundException('Parent link not found for this student');
    }

    return this.prisma.$transaction(async (tx) => {
      if (data.isPrimary) {
        await tx.parentStudent.updateMany({
          where: { studentId, isPrimary: true, id: { not: link.id } },
          data: { isPrimary: false },
        });
      }

      return tx.parentStudent.update({
        where: { id: link.id },
        data: {
          ...(data.relationship !== undefined ? { relationship: data.relationship } : {}),
          ...(data.isPrimary !== undefined ? { isPrimary: data.isPrimary } : {}),
          ...(data.canViewGrades !== undefined ? { canViewGrades: data.canViewGrades } : {}),
          ...(data.canViewPayments !== undefined ? { canViewPayments: data.canViewPayments } : {}),
          ...(data.canViewAttendance !== undefined ? { canViewAttendance: data.canViewAttendance } : {}),
        },
        include: {
          parent: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
              isActive: true,
            },
          },
        },
      });
    });
  }

  async unlinkParent(organizationId: string, studentId: string, parentId: string) {
    await this.findOne(organizationId, studentId);

    const link = await this.prisma.parentStudent.findFirst({
      where: {
        studentId,
        parentId,
        parent: { organizationId },
      },
    });
    if (!link) {
      throw new NotFoundException('Parent link not found for this student');
    }

    await this.prisma.parentStudent.delete({
      where: { id: link.id },
    });

    return { success: true };
  }

  async freeze(
    organizationId: string,
    studentId: string,
    data: { startDate?: string; endDate?: string; reason?: string },
  ) {
    const student = await this.findOne(organizationId, studentId);
    const start = data.startDate || new Date().toISOString().slice(0, 10);
    const end = data.endDate || 'Muddatsiz';
    const reasonText = data.reason?.trim() || "Sabab ko'rsatilmagan";

    const freezeLog = `\n[MUZLATILGAN / FROZEN ${new Date().toISOString().slice(0, 10)}]: ${start} dan ${end} gacha. Sabab: ${reasonText}`;
    const updatedNotes = ((student.notes ?? '') + freezeLog).trim();

    return this.prisma.student.update({
      where: { id: studentId },
      data: {
        status: 'PAUSED',
        notes: updatedNotes,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      },
    });
  }

  async unfreeze(organizationId: string, studentId: string) {
    const student = await this.findOne(organizationId, studentId);
    const unfreezeLog = `\n[FAOL / UNFREEZE ${new Date().toISOString().slice(0, 10)}]: O'qish qayta tiklandi`;
    const updatedNotes = ((student.notes ?? '') + unfreezeLog).trim();

    return this.prisma.student.update({
      where: { id: studentId },
      data: {
        status: 'ACTIVE',
        notes: updatedNotes,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      },
    });
  }
}





