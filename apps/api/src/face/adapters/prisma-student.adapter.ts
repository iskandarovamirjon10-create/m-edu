import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  StudentDirectoryPort,
  StudentInfo,
  StudentGroupMembership,
} from '@medu/core/src/ports/student-directory.port';
import type { Student, User } from '@prisma/client';
import {
  canonicalMembershipWhere,
  INELIGIBLE_STUDENT_STATUSES,
  organizationDayStart,
} from '../../common/student-membership';

/** Identity fields only — never loads auth material such as passwordHash (F-008). */
const FACE_USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  isActive: true,
} as const;

type FaceUserProjection = Pick<User, 'id' | 'firstName' | 'lastName' | 'email' | 'isActive'>;

type StudentWithUser = Student & { user: FaceUserProjection };

@Injectable()
export class PrismaStudentAdapter implements StudentDirectoryPort {
  constructor(private readonly prisma: PrismaService) {}

  private mapStudentInfo(student: StudentWithUser, organizationId: string): StudentInfo {
    return {
      id: student.id,
      organizationId: organizationId,
      firstName: student.user.firstName,
      lastName: student.user.lastName,
      email: student.user.email,
      studentId: student.user.id,
      isActive: student.user.isActive,
    };
  }

  async getStudent(organizationId: string, studentId: string): Promise<StudentInfo | null> {
    const student = await this.prisma.student.findFirst({
      // Tenant invariant is the STUDENT's own `organizationId` (indexed,
      // authoritative). Deriving it from the linked login account instead made
      // this the only path in the pipeline that scoped by a different column
      // than AttendanceDecisionEngine / AttendanceService, so any drift
      // between `Student.organizationId` and `User.organizationId` would
      // resolve a student to the wrong tenant here and nowhere else.
      where: { id: studentId, organizationId },
      include: { user: { select: FACE_USER_SELECT } },
    }) as StudentWithUser | null;

    if (!student || !student.user) return null;
    return this.mapStudentInfo(student, organizationId);
  }

  async isStudentInGroup(organizationId: string, studentId: string, groupId: string): Promise<boolean> {
    /*
     * Uses the SAME canonical rule as AttendanceService.markAttendance and
     * AttendanceDecisionEngine, including the org-local membership window.
     * This predicate previously omitted `joinedAt`/`leftAt`, so the face path
     * accepted students the camera and manual paths rejected (and vice
     * versa) — the source of "Student X is not enrolled in group Y" after a
     * recognition that had already succeeded.
     */
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { timezone: true },
    });

    const count = await this.prisma.studentGroup.count({
      where: canonicalMembershipWhere({
        organizationId,
        studentId,
        groupId,
        dayStart: organizationDayStart(new Date(), organization?.timezone),
      }),
    });
    return count > 0;
  }

  async getStudentGroups(organizationId: string, studentId: string): Promise<StudentGroupMembership[]> {
    const memberships = await this.prisma.studentGroup.findMany({
      where: {
        studentId,
        group: { organizationId },
      },
      include: { group: true },
    });

    return memberships.map(m => ({
      studentId: m.studentId,
      groupId: m.groupId,
      groupName: m.group.name,
      isActive: m.group.isActive ?? true,
    }));
  }

  async isStudentActive(organizationId: string, studentId: string): Promise<boolean> {
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        organizationId,
        // A paused/dropped student is not eligible for recognition-driven
        // attendance even when the linked login account is still enabled.
        status: { notIn: [...INELIGIBLE_STUDENT_STATUSES] },
      },
      include: { user: { select: FACE_USER_SELECT } },
    });

    return !!(student && student.user && student.user.isActive);
  }

  async listStudentsInGroup(organizationId: string, groupId: string): Promise<StudentInfo[]> {
    const memberships = await this.prisma.studentGroup.findMany({
      where: { groupId, group: { organizationId } },
      include: { student: { include: { user: { select: FACE_USER_SELECT } } } },
    });

    return memberships
      .filter(m => m.student && m.student.user)
      .map(m => this.mapStudentInfo(m.student as StudentWithUser, organizationId));
  }
}
