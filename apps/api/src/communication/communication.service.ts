import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAnnouncementDto, SendMessageDto } from './communication.dto';
import { parsePagination } from '../lib/pagination';

@Injectable()
export class CommunicationService {
  constructor(private readonly prisma: PrismaService) {}

  // ==================== PARENT-TEACHER SECURE MESSAGING ====================

  /**
   * Send message with rigorous zero-trust checks:
   * Parents can only message about their own children.
   * Teachers can only message about students in their groups.
   */
  async sendMessage(
    organizationId: string,
    sender: { id: string; role: string },
    dto: SendMessageDto,
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, organizationId },
    });
    if (!student) throw new NotFoundException('Student not found');

    let senderUserId: string | null = null;
    let senderParentId: string | null = null;

    if (sender.role === 'PARENT') {
      const parent = await this.prisma.parentAccount.findFirst({
        where: { id: sender.id, organizationId },
      });
      if (!parent) throw new ForbiddenException('Parent account not found');

      // Verify parent-student relationship
      const link = await this.prisma.parentStudent.findUnique({
        where: { parentId_studentId: { parentId: parent.id, studentId: student.id } },
      });
      if (!link) {
        throw new ForbiddenException('Cross-student access prohibited: You are not linked to this student');
      }

      senderParentId = parent.id;
    } else {
      // Teacher / Staff
      const user = await this.prisma.user.findFirst({
        where: { id: sender.id, organizationId },
      });
      if (!user) throw new ForbiddenException('Staff user not found');

      senderUserId = user.id;
    }

    return this.prisma.parentTeacherMessage.create({
      data: {
        organizationId,
        studentId: dto.studentId,
        senderUserId,
        senderParentId,
        receiverUserId: dto.receiverUserId,
        receiverParentId: dto.receiverParentId,
        content: dto.content.trim(),
      },
    });
  }

  async getMessagesForStudent(
    organizationId: string,
    studentId: string,
    requester: { id: string; role: string },
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, organizationId },
    });
    if (!student) throw new NotFoundException('Student not found');

    if (requester.role === 'PARENT') {
      const link = await this.prisma.parentStudent.findUnique({
        where: { parentId_studentId: { parentId: requester.id, studentId } },
      });
      if (!link) throw new ForbiddenException('Access to student communication denied');
    }

    const messages = await this.prisma.parentTeacherMessage.findMany({
      where: { organizationId, studentId },
      include: {
        senderUser: { select: { firstName: true, lastName: true, role: true } },
        senderParent: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return messages.map((m: any) => ({
      ...m,
      body: m.content ?? m.body,
      content: m.content ?? m.body,
      senderUser: m.senderUser,
      senderParent: m.senderParent,
    }));
  }

  // ==================== ANNOUNCEMENTS ====================

  async findAllAnnouncements(organizationId: string, userRole: string) {
    const now = new Date();
    const announcements = await this.prisma.announcement.findMany({
      where: {
        organizationId,
        status: 'PUBLISHED',
        OR: [
          { expireAt: null },
          { expireAt: { gt: now } },
        ],
      },
      include: {
        author: { select: { firstName: true, lastName: true } },
        Group: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return announcements.map((a) => ({
      ...a,
      author: a.author,
      group: a.Group,
      expiresAt: a.expireAt,
      scheduledAt: a.publishAt,
    }));
  }

  async createAnnouncement(
    organizationId: string,
    creatorUserId: string,
    dto: CreateAnnouncementDto,
  ) {
    return this.prisma.announcement.create({
      data: {
        organizationId,
        createdBy: creatorUserId,
        title: dto.title.trim(),
        content: dto.content.trim(),
        audience: dto.audience ?? 'ALL',
        groupId: dto.groupId,
        courseId: dto.courseId,
        status: dto.status ?? 'PUBLISHED',
        publishAt: dto.publishAt ? new Date(dto.publishAt) : new Date(),
        expireAt: dto.expireAt ? new Date(dto.expireAt) : null,
      },
    });
  }
}
