import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { 
  EnrollmentRepository, 
  EnrollmentEntity, 
  EnrollmentWithTemplates, 
  TemplateEntity 
} from '@medu/core/src/ports/enrollment-repository.port';
import type { EnrollmentStatus, TemplateStatus } from '@medu/contracts';
import type { FaceEnrollment, FaceTemplate, Student, User } from '@prisma/client';

type EnrollmentWithRelations = FaceEnrollment & {
  faceTemplates: FaceTemplate[];
  student: (Student & { user: User }) | null;
};

type TemplateWithStudent = FaceTemplate & {
  student: (Student & { user: User }) | null;
};

interface EnrollmentListFilters {
  status?: EnrollmentStatus;
  studentId?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Allowlist of columns that may be used in ORDER BY. Without this, a
// caller-controlled `sortBy` flows into Prisma's orderBy key, which can
// surface a 500 on invalid field names today and leaves a footgun for the
// day nested relation sorting is enabled.
const ALLOWED_ENROLLMENT_SORT_FIELDS = new Set([
  'createdAt',
  'updatedAt',
  'enrolledAt',
  'activatedAt',
  'revokedAt',
  'status',
]);

const ALLOWED_SORT_ORDERS = new Set(['asc', 'desc']);

@Injectable()
export class PrismaEnrollmentAdapter implements EnrollmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  private mapEnrollmentEntity(row: FaceEnrollment, exposeSensitive = false): EnrollmentEntity {
    return {
      id: row.id,
      organizationId: row.organizationId,
      studentId: row.studentId,
      status: row.status as EnrollmentStatus,
      // Only expose revocation metadata to callers with REVOKE permission.
      // For list/detail responses below REVOKE, these fields are masked.
      enrolledBy: exposeSensitive ? row.enrolledBy : null,
      enrolledAt: row.enrolledAt,
      activatedAt: row.activatedAt,
      revokedAt: row.revokedAt,
      revokedBy: exposeSensitive ? row.revokedBy : null,
      revocationReason: exposeSensitive ? (row.revocationReason as string | null) : null,
      metadata: row.metadata as Record<string, unknown> | null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapTemplateEntity(row: FaceTemplate): TemplateEntity {
    return {
      id: row.id,
      organizationId: row.organizationId,
      enrollmentId: row.enrollmentId,
      studentId: row.studentId,
      templateData: row.templateData,
      templateHash: row.templateHash,
      version: row.version,
      status: row.status as TemplateStatus,
      modelVersion: row.modelVersion,
      qualityScore: row.qualityScore ? Number(row.qualityScore) : null,
      enrolledAt: row.enrolledAt,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
      metadata: row.metadata as Record<string, unknown> | null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapEnrollmentWithTemplates(row: EnrollmentWithRelations): EnrollmentWithTemplates {
    const base = this.mapEnrollmentEntity(row);
    return {
      ...base,
      templates: (row.faceTemplates || []).map((t) => this.mapTemplateEntity(t)),
      student: {
        id: row.student?.id || '',
        firstName: row.student?.user?.firstName || '',
        lastName: row.student?.user?.lastName || '',
        studentId: row.student?.user?.id || null,
        isActive: row.student?.user?.isActive ?? false,
      },
    };
  }

  async findById(organizationId: string, id: string): Promise<EnrollmentWithTemplates | null> {
    const row = await this.prisma.faceEnrollment.findFirst({
      where: { id, organizationId },
      include: {
        faceTemplates: true,
        student: { include: { user: true } },
      },
    });
    return row ? this.mapEnrollmentWithTemplates(row) : null;
  }

  async findByStudentId(organizationId: string, studentId: string): Promise<EnrollmentEntity | null> {
    const row = await this.prisma.faceEnrollment.findFirst({
      where: { organizationId, studentId },
      orderBy: { createdAt: 'desc' },
    });
    return row ? this.mapEnrollmentEntity(row) : null;
  }

  async findActiveByStudentId(organizationId: string, studentId: string): Promise<EnrollmentWithTemplates | null> {
    const row = await this.prisma.faceEnrollment.findFirst({
      where: { organizationId, studentId, status: 'ACTIVE' },
      include: {
        faceTemplates: {
          where: { status: 'ACTIVE' },
          orderBy: { version: 'desc' },
        },
        student: { include: { user: true } },
      },
    });
    return row ? this.mapEnrollmentWithTemplates(row) : null;
  }

  async list(organizationId: string, filters: EnrollmentListFilters): Promise<{ items: EnrollmentWithTemplates[]; total: number }> {
    const where: Record<string, unknown> = { organizationId };
    if (filters.status) where.status = filters.status;
    if (filters.studentId) where.studentId = filters.studentId;

    // Apply the search filter if provided (case-insensitive match on student
    // firstName + lastName). Silently dropping this was a compliance risk:
    // users believed they were narrowing results but received everything.
    if (filters.search?.trim()) {
      const term = filters.search.trim();
      where.student = {
        user: {
          OR: [
            { firstName: { contains: term, mode: 'insensitive' } },
            { lastName: { contains: term, mode: 'insensitive' } },
          ],
        },
      };
    }

    const sortBy = ALLOWED_ENROLLMENT_SORT_FIELDS.has(filters.sortBy ?? '') ? filters.sortBy! : 'createdAt';
    const sortOrder = ALLOWED_SORT_ORDERS.has(filters.sortOrder ?? '') ? filters.sortOrder! : 'desc';

    const page = Math.max((filters.page ?? 1), 1);
    const limit = Math.min(Math.max((filters.limit ?? 10), 1), 100);

    const [rows, total] = await Promise.all([
      this.prisma.faceEnrollment.findMany({
        where,
        include: {
          faceTemplates: true,
          student: { include: { user: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.faceEnrollment.count({ where }),
    ]);

    return {
      items: rows.map(r => this.mapEnrollmentWithTemplates(r)),
      total,
    };
  }

  async create(data: { organizationId: string; studentId: string; enrolledBy?: string }): Promise<EnrollmentEntity> {
    try {
      const row = await this.prisma.faceEnrollment.create({
        data: {
          organizationId: data.organizationId,
          studentId: data.studentId,
          enrolledBy: data.enrolledBy,
          status: 'PENDING',
        },
      });
      return this.mapEnrollmentEntity(row);
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
        throw new ConflictException('An active or pending enrollment already exists for this student.');
      }
      throw error;
    }
  }

  async updateStatus(
    organizationId: string,
    id: string,
    status: EnrollmentStatus,
    metadata?: {
      activatedAt?: Date;
      revokedAt?: Date;
      revokedBy?: string;
      revocationReason?: string;
    }
  ): Promise<EnrollmentEntity> {
    const data: Record<string, unknown> = { status };
    if (metadata?.activatedAt) data.activatedAt = metadata.activatedAt;
    if (metadata?.revokedAt) data.revokedAt = metadata.revokedAt;
    if (metadata?.revokedBy) data.revokedBy = metadata.revokedBy;
    if (metadata?.revocationReason) data.revocationReason = metadata.revocationReason;

    const row = await this.prisma.faceEnrollment.update({
      where: { id, organizationId },
      data,
    });
    return this.mapEnrollmentEntity(row);
  }

  async addTemplate(data: {
    organizationId: string;
    enrollmentId: string;
    studentId: string;
    templateData: string;
    templateHash: string;
    version: number;
    modelVersion?: string;
    qualityScore?: number;
    expiresAt?: Date;
  }): Promise<TemplateEntity> {
    const row = await this.prisma.faceTemplate.create({
      data: {
        organizationId: data.organizationId,
        enrollmentId: data.enrollmentId,
        studentId: data.studentId,
        templateData: data.templateData,
        templateHash: data.templateHash,
        version: data.version,
        status: 'ACTIVE',
        modelVersion: data.modelVersion,
        qualityScore: data.qualityScore,
        expiresAt: data.expiresAt ?? null,
      },
    });
    return this.mapTemplateEntity(row);
  }

  async findActiveTemplatesByStudentId(organizationId: string, studentId: string): Promise<TemplateEntity[]> {
    const rows = await this.prisma.faceTemplate.findMany({
      where: { organizationId, studentId, status: 'ACTIVE' },
      orderBy: { version: 'desc' },
    });
    return rows.map(r => this.mapTemplateEntity(r));
  }

  async *streamActiveTemplates(
    organizationId: string,
    batchSize = 500,
  ): AsyncGenerator<Array<TemplateEntity & { student: { id: string; firstName: string; lastName: string } }>> {
    if (batchSize < 1 || batchSize > 2000) {
      throw new Error('batchSize must be between 1 and 2000');
    }
    const cursorField = 'id';
    let lastId: string | null = null;

    while (true) {
      const where: Record<string, unknown> = { organizationId, status: 'ACTIVE' };
      if (lastId) {
        where[cursorField] = { gt: lastId };
      }

      const rows = await this.prisma.faceTemplate.findMany({
        where,
        take: batchSize,
        orderBy: { [cursorField]: 'asc' },
        include: {
          student: { include: { user: true } },
        },
      });

      if (rows.length === 0) {
        break;
      }

      yield rows.map((r: TemplateWithStudent) => {
        const template = this.mapTemplateEntity(r);
        return {
          ...template,
          student: {
            id: r.student?.id || '',
            firstName: r.student?.user?.firstName || '',
            lastName: r.student?.user?.lastName || '',
          },
        };
      });

      lastId = rows[rows.length - 1].id;

      if (rows.length < batchSize) {
        break;
      }
    }
  }

  async findAllActiveTemplates(organizationId: string): Promise<Array<TemplateEntity & { student: { id: string; firstName: string; lastName: string } }>> {
    // Deprecated: bounded streaming is required for memory safety. This
    // method delegates to the bounded generator with a 500-item cap and
    // materialises only the first batch to keep the contract intact.
    const batchSize = 500;
    const batches: Array<TemplateEntity & { student: { id: string; firstName: string; lastName: string } }> = [];
    const stream = this.streamActiveTemplates(organizationId, batchSize);
    for await (const batch of stream) {
      batches.push(...batch);
    }
    return batches;
  }

  async revokeTemplates(organizationId: string, enrollmentId: string): Promise<void> {
    await this.prisma.faceTemplate.updateMany({
      where: { organizationId, enrollmentId, status: 'ACTIVE' },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });
  }

  async countActive(organizationId: string): Promise<number> {
    return this.prisma.faceEnrollment.count({
      where: { organizationId, status: 'ACTIVE' },
    });
  }

  async countTotal(organizationId: string): Promise<number> {
    return this.prisma.faceEnrollment.count({
      where: { organizationId },
    });
  }
}