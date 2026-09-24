import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, dto: CreateBranchDto) {
    if (dto.code) {
      const existing = await this.prisma.branch.findUnique({
        where: { organizationId_code: { organizationId, code: dto.code } },
      });
      if (existing) {
        throw new ConflictException('Branch code already exists in this organization');
      }
    }
    return this.prisma.branch.create({
      data: { organizationId, ...dto },
    });
  }

  async findAll(organizationId: string) {
    return this.prisma.branch.findMany({
      where: { organizationId },
      include: {
        manager: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        _count: {
          select: { students: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(organizationId: string, id: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id, organizationId },
      include: {
        manager: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        _count: {
          select: { students: true },
        },
      },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  async update(organizationId: string, id: string, dto: UpdateBranchDto) {
    await this.findOne(organizationId, id);
    if (dto.code) {
      const existing = await this.prisma.branch.findFirst({
        where: {
          organizationId,
          code: dto.code || undefined,
          id: { not: id },
        },
      });
      if (existing) {
        throw new ConflictException('Branch code already exists in this organization');
      }
    }
    return this.prisma.branch.update({
      where: { id },
      data: dto,
    });
  }

  async deactivate(organizationId: string, id: string) {
    await this.findOne(organizationId, id);
    return this.prisma.branch.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async activate(organizationId: string, id: string) {
    await this.findOne(organizationId, id);
    return this.prisma.branch.update({
      where: { id },
      data: { isActive: true },
    });
  }

  async assignManager(organizationId: string, id: string, managerId: string) {
    await this.findOne(organizationId, id);
    const user = await this.prisma.user.findFirst({
      where: { id: managerId, organizationId },
    });
    if (!user) throw new NotFoundException('User not found in this organization');
    return this.prisma.branch.update({
      where: { id },
      data: { managerId },
    });
  }

  async getBranchStats(organizationId: string, id: string) {
    const branch = await this.findOne(organizationId, id);
    return {
      id: branch.id,
      name: branch.name,
      counts: branch._count,
    };
  }
}
