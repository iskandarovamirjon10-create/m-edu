import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  CreateResourceDto,
  ResourceQueryDto,
  UpdateResourceDto,
} from './dto/resource.dto';

@Injectable()
export class ResourcesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(orgId: string, query: ResourceQueryDto) {
    const where: Prisma.ResourceWhereInput = { organizationId: orgId };
    if (query.isActive !== undefined) where.isActive = query.isActive === 'true';
    if (query.type) where.type = query.type;
    const [items, total] = await Promise.all([
      this.prisma.resource.findMany({
        where,
        skip: query.skip ? Number(query.skip) : 0,
        take: query.take ? Number(query.take) : 20,
      }),
      this.prisma.resource.count({ where }),
    ]);
    return { items, total };
  }

  async findOne(orgId: string, id: string) {
    return this.prisma.resource.findFirst({
      where: { organizationId: orgId, id },
    });
  }

  async create(orgId: string, dto: CreateResourceDto) {
    return this.prisma.resource.create({
      data: {
        organizationId: orgId,
        name: dto.name,
        type: dto.type ?? 'ROOM',
        capacity: dto.capacity,
        location: dto.location,
        description: dto.description,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
        availability: dto.availability as Prisma.InputJsonValue,
      },
    });
  }

  async update(orgId: string, id: string, dto: UpdateResourceDto) {
    return this.prisma.resource.updateMany({
      where: { organizationId: orgId, id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.capacity !== undefined && { capacity: dto.capacity }),
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.availability !== undefined && { availability: dto.availability as Prisma.InputJsonValue }),
      },
    });
  }

  async remove(orgId: string, id: string) {
    return this.prisma.resource.updateMany({
      where: { organizationId: orgId, id },
      data: { isActive: false },
    });
  }
}
