import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ResourcesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(orgId: string, query: any) {
    const where: any = { organizationId: orgId };
    if (query.isActive !== undefined) where.isActive = query.isActive === 'true';
    if (query.type) where.type = query.type;
    const [items, total] = await Promise.all([
      this.prisma.resource.findMany({
        where,
        skip: query.skip ? parseInt(query.skip, 10) : 0,
        take: query.take ? parseInt(query.take, 10) : 20,
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

  async create(orgId: string, dto: any) {
    return this.prisma.resource.create({
      data: {
        organizationId: orgId,
        name: dto.name,
        type: dto.type ?? 'ROOM',
        capacity: dto.capacity,
        location: dto.location,
        description: dto.description,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
        availability: dto.availability,
      },
    });
  }

  async update(orgId: string, id: string, dto: any) {
    return this.prisma.resource.updateMany({
      where: { organizationId: orgId, id },
      data: dto,
    });
  }

  async remove(orgId: string, id: string) {
    return this.prisma.resource.updateMany({
      where: { organizationId: orgId, id },
      data: { isActive: false },
    });
  }
}
