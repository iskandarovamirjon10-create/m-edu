import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFolderDto, CreateMaterialDto } from './material.dto';
import { parsePagination } from '../lib/pagination';

export interface MaterialQuery {
  page?: string | number;
  limit?: string | number;
  subjectId?: string;
  topicId?: string;
  folderId?: string;
  type?: string;
  search?: string;
}

@Injectable()
export class LearningMaterialsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, query: MaterialQuery, userRole?: string) {
    const { page, limit, skip } = parsePagination(query);
    const where: any = { organizationId };

    if (query.subjectId) where.subjectId = query.subjectId;
    if (query.topicId) where.topicId = query.topicId;
    if (query.folderId) where.folderId = query.folderId;
    if (query.type) where.type = query.type;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    // Role-based visibility
    if (userRole === 'STUDENT' || userRole === 'PARENT') {
      where.visibility = { in: ['ALL', 'STUDENTS_AND_PARENTS'] };
    }

    const [items, total] = await Promise.all([
      this.prisma.material.findMany({
        where,
        include: {
          Subject: { select: { id: true, name: true, code: true } },
          MaterialFolder: { select: { id: true, name: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.material.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / (limit || 1)) };
  }

  async findOne(organizationId: string, id: string, userRole?: string) {
    const material = await this.prisma.material.findFirst({
      where: { id, organizationId },
      include: {
        Subject: { select: { id: true, name: true, code: true } },
        MaterialFolder: true,
      },
    });

    if (!material) throw new NotFoundException('Learning material not found');

    if ((userRole === 'STUDENT' || userRole === 'PARENT') && material.visibility === 'TEACHERS_ONLY') {
      throw new NotFoundException('Learning material not found');
    }

    return material;
  }

  async create(organizationId: string, dto: CreateMaterialDto) {
    if (dto.subjectId) {
      const subject = await this.prisma.subject.findFirst({ where: { id: dto.subjectId, organizationId } });
      if (!subject) throw new NotFoundException('Subject not found');
    }

    if (dto.folderId) {
      const folder = await this.prisma.materialFolder.findFirst({ where: { id: dto.folderId, organizationId } });
      if (!folder) throw new NotFoundException('Folder not found');
    }

    return this.prisma.material.create({
      data: {
        id: crypto.randomUUID(),
        organizationId,
        title: dto.title.trim(),
        description: dto.description?.trim(),
        type: dto.type,
        fileUrl: dto.fileUrl.trim(),
        fileSize: dto.fileSize ?? 0,
        mimeType: dto.mimeType,
        visibility: dto.visibility ?? 'ALL',
        folderId: dto.folderId,
        subjectId: dto.subjectId,
        updatedAt: new Date(),
      },
      include: {
        Subject: { select: { id: true, name: true } },
        MaterialFolder: { select: { id: true, name: true } },
      },
    });
  }

  async getFolders(organizationId: string, parentId?: string) {
    return this.prisma.materialFolder.findMany({
      where: {
        organizationId,
        parentId: parentId ?? null,
      },
      include: {
        _count: { select: { other_MaterialFolder: true, Material: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createFolder(organizationId: string, dto: CreateFolderDto) {
    if (dto.parentId) {
      const parent = await this.prisma.materialFolder.findFirst({
        where: { id: dto.parentId, organizationId },
      });
      if (!parent) throw new NotFoundException('Parent folder not found');
    }

    return this.prisma.materialFolder.create({
      data: {
        id: crypto.randomUUID(),
        organizationId,
        name: dto.name.trim(),
        parentId: dto.parentId,
        updatedAt: new Date(),
      },
    });
  }
}
