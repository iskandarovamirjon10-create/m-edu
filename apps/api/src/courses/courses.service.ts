import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parsePagination } from '../lib/pagination';
import { Prisma } from '@prisma/client';
import { CreateCourseDto, UpdateCourseDto } from '../common/dto';
import { CourseQuery } from '../common/dto/query';
import { BulkCoursePriceDto, BulkCourseStatusDto } from './dto/courses-bulk.dto';

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, query: CourseQuery) {
    const { page, limit, skip } = parsePagination(query);
    const where: Prisma.CourseWhereInput = { organizationId };

    if (query.isActive !== undefined) where.isActive = query.isActive === 'true';
    if (query.level) where.level = query.level as any;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    let orderBy: Prisma.CourseOrderByWithRelationInput = { createdAt: 'desc' };
    if (query.sortBy === 'name') {
      orderBy = { name: query.sortOrder === 'desc' ? 'desc' : 'asc' };
    } else if (query.sortBy === 'price') {
      orderBy = { price: query.sortOrder === 'desc' ? 'desc' : 'asc' };
    } else if (query.sortBy === 'duration') {
      orderBy = { duration: query.sortOrder === 'desc' ? 'desc' : 'asc' };
    } else if (query.sortBy === 'createdAt') {
      orderBy = { createdAt: query.sortOrder === 'asc' ? 'asc' : 'desc' };
    }

    const [items, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        include: { _count: { select: { groups: { where: { isActive: true } } } } },
        skip,
        take: limit,
        orderBy,
      }),
      this.prisma.course.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / (limit || 1)) };
  }

  async findOne(organizationId: string, id: string) {
    const course = await this.prisma.course.findFirst({
      where: { id, organizationId },
      include: {
        groups: {
          where: { isActive: true },
          include: {
            teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
            _count: { select: { enrollments: { where: { isActive: true } } } },
          },
        },
      },
    });
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  async create(organizationId: string, data: CreateCourseDto) {
    if (data.price < 0) throw new BadRequestException('Price cannot be negative');
    if (data.duration <= 0) throw new BadRequestException('Duration must be positive');

    return this.prisma.course.create({
      data: {
        organizationId,
        name: data.name,
        description: data.description,
        price: data.price,
        duration: data.duration,
        level: data.level,
      },
    });
  }

  async update(organizationId: string, id: string, data: UpdateCourseDto) {
    await this.findOne(organizationId, id);

    const updateData: Prisma.CourseUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.price !== undefined) {
      if (data.price < 0) throw new BadRequestException('Price cannot be negative');
      updateData.price = data.price;
    }
    if (data.duration !== undefined) {
      if (data.duration <= 0) throw new BadRequestException('Duration must be positive');
      updateData.duration = data.duration;
    }
    if (data.level !== undefined) updateData.level = data.level;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    if (Object.keys(updateData).length === 0) return this.findOne(organizationId, id);

    return this.prisma.course.update({ where: { id, organizationId }, data: updateData });
  }

  async remove(organizationId: string, id: string) {
    await this.findOne(organizationId, id);
    return this.prisma.course.update({ where: { id, organizationId }, data: { isActive: false } });
  }

  // ------------------------------------------------------------------
  // Aggregated Stats & Popularity Metrics
  // ------------------------------------------------------------------

  async getStats(organizationId: string) {
    const courses = await this.prisma.course.findMany({
      where: { organizationId },
      include: {
        groups: {
          where: { isActive: true },
          select: {
            id: true,
            _count: { select: { enrollments: { where: { isActive: true } } } },
          },
        },
      },
    });

    const totalCourses = courses.length;
    const activeCourses = courses.filter((c) => c.isActive).length;
    const inactiveCourses = totalCourses - activeCourses;

    let totalActiveGroups = 0;
    let totalEnrolledStudents = 0;
    let sumActivePrice = 0;

    const levelDistribution: Record<string, number> = {
      BEGINNER: 0,
      INTERMEDIATE: 0,
      ADVANCED: 0,
      EXPERT: 0,
    };

    const coursePopularity = courses.map((c) => {
      const activeGroupsCount = c.groups.length;
      const enrolledCount = c.groups.reduce((sum, g) => sum + (g._count?.enrollments ?? 0), 0);
      totalActiveGroups += activeGroupsCount;
      totalEnrolledStudents += enrolledCount;

      if (c.isActive) {
        sumActivePrice += Number(c.price || 0);
      }
      if (c.level && levelDistribution[c.level] !== undefined) {
        levelDistribution[c.level]++;
      }

      return {
        id: c.id,
        name: c.name,
        price: Number(c.price),
        duration: c.duration,
        level: c.level,
        activeGroupsCount,
        enrolledCount,
      };
    });

    const avgTuitionPrice = activeCourses > 0 ? Math.round(sumActivePrice / activeCourses) : 0;
    const popularCourses = coursePopularity
      .sort((a, b) => b.enrolledCount - a.enrolledCount || b.activeGroupsCount - a.activeGroupsCount)
      .slice(0, 5);

    return {
      totalCourses,
      activeCourses,
      inactiveCourses,
      totalActiveGroups,
      totalEnrolledStudents,
      avgTuitionPrice,
      levelDistribution,
      popularCourses,
    };
  }

  // ------------------------------------------------------------------
  // Bulk Operations
  // ------------------------------------------------------------------

  async bulkStatus(organizationId: string, dto: BulkCourseStatusDto) {
    if (!dto.courseIds || dto.courseIds.length === 0) {
      throw new BadRequestException("Kurslar ro'yxati (courseIds) bo'sh bo'lishi mumkin emas");
    }

    const uniqueIds = Array.from(new Set(dto.courseIds));
    const existingCourses = await this.prisma.course.findMany({
      where: { id: { in: uniqueIds }, organizationId },
      select: { id: true },
    });

    if (existingCourses.length !== uniqueIds.length) {
      throw new NotFoundException("Barcha tanlangan kurslar ushbu tashkilotga tegishli emas");
    }

    const result = await this.prisma.course.updateMany({
      where: { id: { in: uniqueIds }, organizationId },
      data: { isActive: dto.isActive },
    });

    return {
      success: true,
      count: result.count,
      isActive: dto.isActive,
      message: `${result.count} ta kurs holati muvaffaqiyatli ${dto.isActive ? 'faollashtirildi' : 'nofaol qilindi'}`,
    };
  }

  async bulkPrice(organizationId: string, dto: BulkCoursePriceDto) {
    if (!dto.courseIds || dto.courseIds.length === 0) {
      throw new BadRequestException("Kurslar ro'yxati (courseIds) bo'sh bo'lishi mumkin emas");
    }

    if ((!dto.mode || dto.mode === 'set') && dto.value < 0) {
      throw new BadRequestException("Kurs narxi manfiy bo'lishi mumkin emas");
    }

    const uniqueIds = Array.from(new Set(dto.courseIds));
    const courses = await this.prisma.course.findMany({
      where: { id: { in: uniqueIds }, organizationId },
      select: { id: true, price: true },
    });

    if (courses.length !== uniqueIds.length) {
      throw new NotFoundException("Barcha tanlangan kurslar ushbu tashkilotga tegishli emas");
    }

    return this.prisma.$transaction(async (tx) => {
      let updatedCount = 0;
      for (const course of courses) {
        let newPrice = Number(course.price);
        if (!dto.mode || dto.mode === 'set') {
          newPrice = dto.value;
        } else if (dto.mode === 'increase_percent') {
          newPrice = Math.round(newPrice * (1 + dto.value / 100));
        } else if (dto.mode === 'decrease_percent') {
          newPrice = Math.max(0, Math.round(newPrice * (1 - dto.value / 100)));
        }
        if (newPrice < 0) {
          throw new BadRequestException("Kurs narxi manfiy bo'lishi mumkin emas");
        }

        await tx.course.update({
          where: { id: course.id, organizationId },
          data: { price: newPrice },
        });
        updatedCount++;
      }

      return {
        success: true,
        count: updatedCount,
        message: `${updatedCount} ta kurs narxi muvaffaqiyatli yangilandi`,
      };
    });
  }
}
