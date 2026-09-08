import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parsePagination } from '../lib/pagination';

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, query: any) {
    const { page, limit, skip } = parsePagination(query);
    const where: any = { organizationId };

    if (query.category) where.category = query.category;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
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

  async findOne(organizationId: string, id: string) {
    return this.prisma.document.findFirst({
      where: { id, organizationId },
    });
  }

  async create(organizationId: string, data: any) {
    return this.prisma.document.create({
      data: {
        ...data,
        organizationId,
      },
    });
  }

  async update(organizationId: string, id: string, data: any) {
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
    return this.prisma.document.delete({ where: { id, organizationId } });
  }

  async uploadVersion(organizationId: string, documentId: string, data: any) {
    const doc = await this.prisma.document.findFirst({ where: { id: documentId, organizationId } });
    if (!doc) return null;

    return this.prisma.$transaction(async (tx) => {
      const version = await tx.documentVersion.create({
        data: {
          documentId,
          version: doc.version + 1,
          fileUrl: data.fileUrl,
          fileSize: data.fileSize,
          mimeType: data.mimeType,
          uploadedBy: data.uploadedBy,
          note: data.note,
        },
      });
      await tx.document.update({
        where: { id: documentId },
        data: {
          version: doc.version + 1,
          fileUrl: data.fileUrl,
          fileSize: data.fileSize,
          mimeType: data.mimeType,
          updatedAt: new Date(),
        },
      });
      return version;
    });
  }
}
