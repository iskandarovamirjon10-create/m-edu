import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { 
  StudentDirectoryPort, 
  StudentInfo, 
  StudentGroupMembership 
} from '@medu/core/src/ports/student-directory.port';
import type { Student, User } from '@prisma/client';

type StudentWithUser = Student & { user: User };

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
      where: { id: studentId, user: { organizationId } },
      include: { user: true },
    }) as StudentWithUser | null;
    
    if (!student || !student.user) return null;
    return this.mapStudentInfo(student, organizationId);
  }

  async isStudentInGroup(organizationId: string, studentId: string, groupId: string): Promise<boolean> {
    const count = await this.prisma.studentGroup.count({
      where: {
        studentId,
        groupId,
        group: { organizationId },
      },
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
      where: { id: studentId, user: { organizationId } },
      include: { user: true },
    });
    
    return !!(student && student.user && student.user.isActive);
  }

  async listStudentsInGroup(organizationId: string, groupId: string): Promise<StudentInfo[]> {
    const memberships = await this.prisma.studentGroup.findMany({
      where: { groupId, group: { organizationId } },
      include: { student: { include: { user: true } } },
    });
    
    return memberships
      .filter(m => m.student && m.student.user)
      .map(m => this.mapStudentInfo(m.student as StudentWithUser, organizationId));
  }
}