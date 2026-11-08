import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCalendarEventDto } from './calendar.dto';

export interface CalendarEventQuery {
  start?: string;
  end?: string;
  groupId?: string;
  teacherId?: string;
  type?: string;
}

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    organizationId: string,
    query: CalendarEventQuery,
    requester?: { id: string; role: string },
  ) {
    const where: any = { organizationId };

    if (query.teacherId) where.teacherId = query.teacherId;

    if (query.start || query.end) {
      where.AND = where.AND || [];
      if (query.start) where.AND.push({ endDate: { gte: new Date(query.start) } });
      if (query.end) where.AND.push({ startDate: { lte: new Date(query.end) } });
    }

    // Security: confidential staff or admin events must NEVER be returned to parents or students
    const CONFIDENTIAL_STAFF_EVENT_TYPES = ['TEACHER_MEETING', 'MEETING'];

    if (requester?.role === 'STUDENT') {
      if (query.type && CONFIDENTIAL_STAFF_EVENT_TYPES.includes(query.type)) {
        return [];
      }
      where.type = query.type ? query.type : { notIn: CONFIDENTIAL_STAFF_EVENT_TYPES };

      const student = await this.prisma.student.findUnique({
        where: { userId: requester.id },
      });
      if (!student || student.organizationId !== organizationId) {
        return [];
      }
      const enrollments = await this.prisma.studentGroup.findMany({
        where: { studentId: student.id, isActive: true },
        select: { groupId: true },
      });
      const allowedGroupIds = enrollments.map((e) => e.groupId);

      if (query.groupId) {
        if (!allowedGroupIds.includes(query.groupId)) {
          return [];
        }
        where.groupId = query.groupId;
      } else {
        where.AND = where.AND || [];
        where.AND.push({
          OR: [{ groupId: null }, { groupId: { in: allowedGroupIds } }],
        });
      }
    } else if (requester?.role === 'PARENT') {
      if (query.type && CONFIDENTIAL_STAFF_EVENT_TYPES.includes(query.type)) {
        return [];
      }
      where.type = query.type ? query.type : { notIn: CONFIDENTIAL_STAFF_EVENT_TYPES };

      const children = await this.prisma.parentStudent.findMany({
        where: { parentId: requester.id },
        select: { studentId: true },
      });
      const enrollments = await this.prisma.studentGroup.findMany({
        where: {
          studentId: { in: children.map((c) => c.studentId) },
          isActive: true,
        },
        select: { groupId: true },
      });
      const allowedGroupIds = enrollments.map((e) => e.groupId);

      if (query.groupId) {
        if (!allowedGroupIds.includes(query.groupId)) {
          return [];
        }
        where.groupId = query.groupId;
      } else {
        where.AND = where.AND || [];
        where.AND.push({
          OR: [{ groupId: null }, { groupId: { in: allowedGroupIds } }],
        });
      }
    } else {
      if (query.groupId) where.groupId = query.groupId;
      if (query.type) where.type = query.type;
    }

    const events = await this.prisma.calendarEvent.findMany({
      where,
      include: {
        Group: { select: { id: true, name: true } },
        Teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
        User: { select: { firstName: true, lastName: true } },
      },
      orderBy: { startDate: 'asc' },
      take: 200,
    });

    return events.map((e) => ({
      ...e,
      group: e.Group,
      teacher: e.Teacher ? { ...e.Teacher, user: e.Teacher.user } : null,
      creator: e.User,
      location: e.room,
    }));
  }

  async create(organizationId: string, creatorUserId: string, dto: CreateCalendarEventDto) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (startDate >= endDate) {
      throw new BadRequestException('Event start date/time must be strictly before end date/time');
    }

    // Conflict detection for Location booking
    if (dto.room) {
      const locationConflict = await this.prisma.calendarEvent.findFirst({
        where: {
          organizationId,
          room: dto.room.trim(),
          startDate: { lt: endDate },
          endDate: { gt: startDate },
        },
      });
      if (locationConflict) {
        throw new BadRequestException(`Location "${dto.room}" is already booked for another event: "${locationConflict.title}"`);
      }
    }

    // Conflict detection for Teacher double booking
    if (dto.teacherId) {
      const teacherConflict = await this.prisma.calendarEvent.findFirst({
        where: {
          organizationId,
          teacherId: dto.teacherId,
          startDate: { lt: endDate },
          endDate: { gt: startDate },
        },
      });
      if (teacherConflict) {
        throw new BadRequestException(`Assigned Teacher is already booked for another event: "${teacherConflict.title}"`);
      }
    }

    return this.prisma.calendarEvent.create({
      data: {
        organizationId,
        createdBy: creatorUserId,
        title: dto.title.trim(),
        description: dto.description?.trim(),
        type: (dto.type ?? 'EVENT') as any,
        startDate,
        endDate,
        isAllDay: dto.isAllDay ?? false,
        groupId: dto.groupId,
        teacherId: dto.teacherId,
        room: dto.room?.trim(),
      },
    });
  }
}
