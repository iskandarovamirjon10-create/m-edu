import { Injectable } from '@nestjs/common';
import type { RequestUser } from '../auth/types';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { parsePagination } from '../lib/pagination';
import {
  CreateDocumentDto,
  UpdateDocumentDto,
  UploadDocumentVersionDto,
  DocumentQueryDto,
} from './dto/document.dto';

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: RequestUser, query: DocumentQueryDto) {
    const { page, limit, skip } = parsePagination(query);
    const where: Prisma.DocumentWhereInput = { organizationId: user.organizationId };

    if (user.role === 'STUDENT') {
      where.OR = [
        { relatedEntityId: user.sub, relatedEntityType: 'STUDENT' },
        { category: 'PUBLIC' }
      ];
    } else if (user.role === 'PARENT') {
      const children = await this.prisma.parentStudent.findMany({
        where: { parentId: user.sub },
        select: { studentId: true }
      });
      const childrenIds = children.map(c => c.studentId);
      where.OR = [
        { relatedEntityId: { in: childrenIds }, relatedEntityType: 'STUDENT' },
        { category: 'PUBLIC' }
      ];
    }

    if (query.category) where.category = query.category;
    if (query.search) {
      const searchOR: Prisma.DocumentWhereInput[] = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: searchOR }];
        delete where.OR;
      } else {
        where.OR = searchOR;
      }
    }
    if (query.tags) {
      where.tags = { hasSome: Array.isArray(query.tags) ? query.tags : [query.tags] };
    }
    if (query.relatedEntityType) where.relatedEntityType = query.relatedEntityType;
    if (query.relatedEntityId) where.relatedEntityId = query.relatedEntityId;

    const [items, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        orderBy: { uploadedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.document.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(user: RequestUser, id: string) {
    const where: Prisma.DocumentWhereInput = { id, organizationId: user.organizationId };
    
    if (user.role === 'STUDENT') {
      where.OR = [
        { relatedEntityId: user.sub, relatedEntityType: 'STUDENT' },
        { category: 'PUBLIC' }
      ];
    } else if (user.role === 'PARENT') {
      const children = await this.prisma.parentStudent.findMany({
        where: { parentId: user.sub },
        select: { studentId: true }
      });
      const childrenIds = children.map(c => c.studentId);
      where.OR = [
        { relatedEntityId: { in: childrenIds }, relatedEntityType: 'STUDENT' },
        { category: 'PUBLIC' }
      ];
    }

    return this.prisma.document.findFirst({
      where,
      include: {
        versions: {
          orderBy: { version: 'desc' },
        },
      },
    });
  }

  async create(organizationId: string, data: CreateDocumentDto & { uploadedBy: string }) {
    return this.prisma.document.create({
      data: {
        ...data,
        fileSize: data.fileSize ?? 0,
        mimeType: data.mimeType ?? 'application/octet-stream',
        organizationId,
      },
    });
  }

  async update(organizationId: string, id: string, data: UpdateDocumentDto) {
    // updateMany (not update) so a non-existent / cross-tenant id returns
    // count 0 instead of throwing a Prisma P2025 — the controller maps it to 404.
    const result = await this.prisma.document.updateMany({
      where: { id, organizationId },
      data: { ...data, updatedAt: new Date() },
    });
    if (result.count === 0) return null;
    return this.prisma.document.findFirst({ where: { id, organizationId } });
  }

  async delete(organizationId: string, id: string) {
    const doc = await this.prisma.document.findFirst({ where: { id, organizationId } });
    if (!doc) return null;
    await this.prisma.document.deleteMany({ where: { id, organizationId } });
    return doc;
  }

  async uploadVersion(
    organizationId: string,
    documentId: string,
    data: UploadDocumentVersionDto & { uploadedBy: string },
  ) {
    const doc = await this.prisma.document.findFirst({ where: { id: documentId, organizationId } });
    if (!doc) return null;

    const fileSize = data.fileSize ?? 0;
    const mimeType = data.mimeType ?? 'application/octet-stream';

    return this.prisma.$transaction(async (tx) => {
      const updatedDoc = await tx.document.update({
        where: { id: documentId },
        data: {
          version: { increment: 1 },
          fileUrl: data.fileUrl,
          fileSize,
          mimeType,
          updatedAt: new Date(),
        },
      });

      const version = await tx.documentVersion.create({
        data: {
          documentId,
          version: updatedDoc.version,
          fileUrl: data.fileUrl,
          fileSize,
          mimeType,
          uploadedBy: data.uploadedBy,
          note: data.note,
        },
      });

      return version;
    });
  }
}

