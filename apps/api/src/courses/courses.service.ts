import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parsePagination } from '../lib/pagination';
import { Prisma } from '@prisma/client';
import { CreateCourseDto, UpdateCourseDto } from '../common/dto';
import { CourseQuery } from '../common/dto/query';

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, query: CourseQuery) {
    const { page, limit, skip } = parsePagination(query);
    const where: Prisma.CourseWhereInput = { organizationId };

    if (query.isActive !== undefined) where.isActive = query.isActive === 'true';
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        include: { _count: { select: { groups: { where: { isActive: true } } } } },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.course.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
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
}
