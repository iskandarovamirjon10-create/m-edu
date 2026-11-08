import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parsePagination } from '../lib/pagination';
import { Prisma } from '@prisma/client';
import { CreateHomeworkDto, UpdateHomeworkDto } from '../common/dto';
import { HomeworkQuery } from '../common/dto/query';

@Injectable()
export class HomeworkService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, query: HomeworkQuery, currentUser?: { id?: string; role?: string; sub?: string }) {
    const { page, limit, skip } = parsePagination(query);
    const where: Prisma.HomeworkWhereInput = { organizationId };

    if (query.groupId) where.groupId = query.groupId;

    // Object-level authorization for teachers, students, and parents
    if (currentUser?.role === 'TEACHER' || currentUser?.role === 'ASSISTANT') {
      const teacher = await this.prisma.teacher.findFirst({
        where: { userId: currentUser.id || currentUser.sub, organizationId },
        select: { id: true },
      });
      const teacherId = teacher?.id || '00000000-0000-0000-0000-000000000000';
      where.group = { teacherId };
    } else if (currentUser?.role === 'STUDENT') {
      where.group = {
        enrollments: {
          some: {
            student: { userId: currentUser.id || currentUser.sub },
            isActive: true,
          },
        },
      };
    } else if (currentUser?.role === 'PARENT') {
      where.group = {
        enrollments: {
          some: {
            student: {
              parentStudents: {
                some: { parentId: currentUser.id || currentUser.sub },
              },
            },
            isActive: true,
          },
        },
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.homework.findMany({
        where,
        include: { group: { select: { id: true, name: true, teacherId: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.homework.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / (limit || 1)) };
  }

  async findOne(organizationId: string, id: string, currentUser?: { id?: string; role?: string; sub?: string }) {
    const homework = await this.prisma.homework.findFirst({
      where: { id, organizationId },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            teacherId: true,
            enrollments: {
              select: {
                studentId: true,
                student: {
                  select: {
                    userId: true,
                    parentStudents: { select: { parentId: true } },
                  },
                },
                isActive: true,
              },
            },
          },
        },
      },
    });
    if (!homework) throw new NotFoundException('Homework not found');

    const group = (homework as any).group;
    if (currentUser?.role === 'TEACHER' || currentUser?.role === 'ASSISTANT') {
      const teacher = await this.prisma.teacher.findFirst({
        where: { userId: currentUser.id || currentUser.sub, organizationId },
        select: { id: true },
      });
      if (!teacher || group?.teacherId !== teacher.id) {
        throw new ForbiddenException('Siz faqat o‘zingiz biriktirilgan guruhlar vazifalarini ko‘ra olasiz');
      }
    } else if (currentUser?.role === 'STUDENT') {
      const userId = currentUser.id || currentUser.sub;
      const isEnrolled = group?.enrollments?.some(
        (e: any) => e.isActive && e.student?.userId === userId,
      );
      if (!isEnrolled) {
        throw new ForbiddenException('Siz faqat o‘z guruhlaringiz vazifalarini ko‘ra olasiz');
      }
    } else if (currentUser?.role === 'PARENT') {
      const parentId = currentUser.id || currentUser.sub;
      const isChildEnrolled = group?.enrollments?.some(
        (e: any) => e.isActive && e.student?.parentStudents?.some((ps: any) => ps.parentId === parentId),
      );
      if (!isChildEnrolled) {
        throw new ForbiddenException('Siz faqat o‘z farzandingiz guruhlari vazifalarini ko‘ra olasiz');
      }
    }

    return homework;
  }

  async create(organizationId: string, data: CreateHomeworkDto, currentUser?: { id?: string; role?: string; sub?: string }) {
    const group = await this.prisma.group.findFirst({
      where: { id: data.groupId, organizationId },
    });
    if (!group) throw new NotFoundException('Group not found');

    // Object-level authorization: Teachers can only assign homework to their assigned groups
    if (currentUser?.role === 'TEACHER' || currentUser?.role === 'ASSISTANT') {
      const teacher = await this.prisma.teacher.findFirst({
        where: { userId: currentUser.id || currentUser.sub, organizationId },
        select: { id: true },
      });
      if (!teacher || group.teacherId !== teacher.id) {
        throw new ForbiddenException('Siz faqat o‘zingiz biriktirilgan guruhlar uchun vazifa yarata olasiz');
      }
    }

    return this.prisma.homework.create({
      data: {
        organizationId,
        groupId: data.groupId,
        title: data.title,
        description: data.description,
        deadline: data.deadline ? new Date(data.deadline) : null,
        maxScore: data.maxScore,
      },
    });
  }

  async update(organizationId: string, id: string, data: UpdateHomeworkDto, currentUser?: { id?: string; role?: string; sub?: string }) {
    await this.findOne(organizationId, id, currentUser);

    const updateData: Prisma.HomeworkUpdateInput = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.deadline !== undefined) updateData.deadline = new Date(data.deadline);
    if (data.maxScore !== undefined) updateData.maxScore = data.maxScore;

    if (Object.keys(updateData).length === 0) return this.findOne(organizationId, id, currentUser);

    if (typeof this.prisma.homework.updateMany === 'function') {
      await this.prisma.homework.updateMany({ where: { id, organizationId }, data: updateData });
      return this.findOne(organizationId, id, currentUser);
    }
    return this.prisma.homework.update({ where: { id, organizationId } as any, data: updateData });
  }

  async remove(organizationId: string, id: string) {
    const homework = await this.findOne(organizationId, id);
    if (typeof this.prisma.$transaction === 'function') {
      await this.prisma.$transaction(async (tx) => {
        if (tx.homeworkSubmission?.deleteMany) {
          await tx.homeworkSubmission.deleteMany({ where: { homeworkId: id } });
        }
        if (typeof tx.homework.delete === 'function') {
          await tx.homework.delete({ where: { id, organizationId } as any });
        } else {
          await tx.homework.deleteMany({ where: { id, organizationId } });
        }
      });
    } else {
      await this.prisma.homework.delete({ where: { id, organizationId } as any });
    }
    return homework;
  }
}
