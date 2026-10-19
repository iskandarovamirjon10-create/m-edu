/**
 * Unit tests for DocumentsService — deterministic, rule-based, no AI.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentsService } from '../documents.service';
import type { PrismaService } from '../../prisma/prisma.service';

function makePrisma() {
  return {
    document: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      delete: vi.fn(),
    },
    documentVersion: {
      create: vi.fn(),
    },
    student: {
      findUnique: vi.fn(),
    },
    parentStudent: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        documentVersion: { create: vi.fn() },
        document: { update: vi.fn(), findFirst: vi.fn() },
      };
      return fn(tx);
    }),
  };
}

describe('DocumentsService', () => {
  let svc: DocumentsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    svc = new DocumentsService(prisma as unknown as PrismaService);
    vi.clearAllMocks();
  });

  describe('findAll — tenant isolation', () => {
    it('always filters by organizationId', async () => {
      prisma.document.findMany.mockResolvedValue([]);
      prisma.document.count.mockResolvedValue(0);
      await svc.findAll({ organizationId: 'org-xyz', role: 'ORG_ADMIN', sub: 'u-1' }, {});
      const where = prisma.document.findMany.mock.calls[0][0].where;
      expect(where.organizationId).toBe('org-xyz');
    });
  });

  describe('findAll — filter mapping', () => {
    it('maps category', async () => {
      prisma.document.findMany.mockResolvedValue([]);
      prisma.document.count.mockResolvedValue(0);
      await svc.findAll({ organizationId: 'org-1', role: 'ORG_ADMIN', sub: 'u-1' }, { category: 'CONTRACT' });
      expect(prisma.document.findMany.mock.calls[0][0].where.category).toBe('CONTRACT');
    });

    it('maps search to OR on title/description', async () => {
      prisma.document.findMany.mockResolvedValue([]);
      prisma.document.count.mockResolvedValue(0);
      await svc.findAll({ organizationId: 'org-1', role: 'ORG_ADMIN', sub: 'u-1' }, { search: 'contract' });
      const or = prisma.document.findMany.mock.calls[0][0].where.OR;
      expect(or).toHaveLength(2);
    });

    it('maps tags with hasSome', async () => {
      prisma.document.findMany.mockResolvedValue([]);
      prisma.document.count.mockResolvedValue(0);
      await svc.findAll({ organizationId: 'org-1', role: 'ORG_ADMIN', sub: 'u-1' }, { tags: ['contract', 'final'] });
      const tags = prisma.document.findMany.mock.calls[0][0].where.tags;
      expect(tags).toHaveProperty('hasSome');
    });

    it('maps relatedEntity fields', async () => {
      prisma.document.findMany.mockResolvedValue([]);
      prisma.document.count.mockResolvedValue(0);
      await svc.findAll({ organizationId: 'org-1', role: 'ORG_ADMIN', sub: 'u-1' }, { relatedEntityType: 'STUDENT', relatedEntityId: 's1' });
      const where = prisma.document.findMany.mock.calls[0][0].where;
      expect(where.relatedEntityType).toBe('STUDENT');
      expect(where.relatedEntityId).toBe('s1');
    });

    it('orders by uploadedAt desc', async () => {
      prisma.document.findMany.mockResolvedValue([]);
      prisma.document.count.mockResolvedValue(0);
      await svc.findAll({ organizationId: 'org-1', role: 'ORG_ADMIN', sub: 'u-1' }, {});
      expect(prisma.document.findMany.mock.calls[0][0].orderBy).toEqual({ uploadedAt: 'desc' });
    });

    it('returns pagination meta', async () => {
      prisma.document.findMany.mockResolvedValue([]);
      prisma.document.count.mockResolvedValue(45);
      const r = await svc.findAll({ organizationId: 'org-1', role: 'ORG_ADMIN', sub: 'u-1' }, { page: 3, limit: 10 });
      expect(r.page).toBe(3);
      expect(r.limit).toBe(10);
      expect(r.total).toBe(45);
      expect(r.totalPages).toBe(5);
    });

    it('resolves Student.id from userId for student role (M-EDU-TEN-002)', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 'student-uuid-456' });
      prisma.document.findMany.mockResolvedValue([]);
      prisma.document.count.mockResolvedValue(0);

      await svc.findAll({ organizationId: 'org-1', role: 'STUDENT', sub: 'user-uuid-123' }, {});

      expect(prisma.student.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-uuid-123' },
        select: { id: true },
      });

      const where = prisma.document.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual([
        { relatedEntityId: { in: ['student-uuid-456', 'user-uuid-123'] }, relatedEntityType: 'STUDENT' },
        { category: 'PUBLIC' },
      ]);
    });

    it('falls back to user.sub if student record does not exist (M-EDU-TEN-002)', async () => {
      prisma.student.findUnique.mockResolvedValue(null);
      prisma.document.findMany.mockResolvedValue([]);
      prisma.document.count.mockResolvedValue(0);

      await svc.findAll({ organizationId: 'org-1', role: 'STUDENT', sub: 'user-uuid-123' }, {});

      const where = prisma.document.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual([
        { relatedEntityId: { in: ['user-uuid-123'] }, relatedEntityType: 'STUDENT' },
        { category: 'PUBLIC' },
      ]);
    });

    it('resolves children for parent role (M-EDU-TEN-002)', async () => {
      prisma.parentStudent.findMany.mockResolvedValue([{ studentId: 'student-1' }, { studentId: 'student-2' }]);
      prisma.document.findMany.mockResolvedValue([]);
      prisma.document.count.mockResolvedValue(0);

      await svc.findAll({ organizationId: 'org-1', role: 'PARENT', sub: 'parent-sub' }, {});

      const where = prisma.document.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual([
        { relatedEntityId: { in: ['student-1', 'student-2'] }, relatedEntityType: 'STUDENT' },
        { category: 'PUBLIC' },
      ]);
    });
  });

  describe('findOne', () => {
    it('returns document with organization filter', async () => {
      prisma.document.findFirst.mockResolvedValue({ id: 'd1', title: 'Contract' });
      const r = await svc.findOne({ organizationId: 'org-1', role: 'ORG_ADMIN', sub: 'u-1' }, 'd1');
      expect(r?.id).toBe('d1');
      expect(prisma.document.findFirst).toHaveBeenCalledWith({
        where: { id: 'd1', organizationId: 'org-1' },
        include: {
          versions: {
            orderBy: { version: 'desc' },
          },
        },
      });
    });

    it('resolves Student.id from userId for student role in findOne (M-EDU-TEN-002)', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 'student-uuid-456' });
      prisma.document.findFirst.mockResolvedValue({ id: 'd1', title: 'Cert' });

      await svc.findOne({ organizationId: 'org-1', role: 'STUDENT', sub: 'user-uuid-123' }, 'd1');

      const where = prisma.document.findFirst.mock.calls[0][0].where;
      expect(where.id).toBe('d1');
      expect(where.organizationId).toBe('org-1');
      expect(where.OR).toEqual([
        { relatedEntityId: { in: ['student-uuid-456', 'user-uuid-123'] }, relatedEntityType: 'STUDENT' },
        { category: 'PUBLIC' },
      ]);
    });
  });

  describe('create', () => {
    it('injects organizationId and default mime/size', async () => {
      prisma.document.create.mockResolvedValue({ id: 'd1' });
      await svc.create('org-1', {
        title: 'New doc',
        fileUrl: 'https://example.com/doc.pdf',
        category: 'FORM',
        uploadedBy: 'u-1',
      });
      const data = prisma.document.create.mock.calls[0][0].data;
      expect(data.organizationId).toBe('org-1');
      expect(data.title).toBe('New doc');
      expect(data.uploadedBy).toBe('u-1');
      expect(data.fileSize).toBe(0);
      expect(data.mimeType).toBe('application/octet-stream');
    });
  });

  describe('update', () => {
    it('updates scoped by organizationId and sets updatedAt', async () => {
      prisma.document.updateMany.mockResolvedValue({ count: 1 });
      prisma.document.findFirst.mockResolvedValue({ id: 'd1', title: 'Updated' });
      const r = await svc.update('org-1', 'd1', { title: 'Updated' });
      const args = prisma.document.updateMany.mock.calls[0][0];
      expect(args.data.title).toBe('Updated');
      expect(args.data.updatedAt).toBeInstanceOf(Date);
      expect(args.where.id).toBe('d1');
      expect(args.where.organizationId).toBe('org-1');
      expect(r).toEqual({ id: 'd1', title: 'Updated' });
    });

    it('returns null when the document does not exist (count 0)', async () => {
      prisma.document.updateMany.mockResolvedValue({ count: 0 });
      const r = await svc.update('org-1', 'missing', { title: 'X' });
      expect(r).toBeNull();
      expect(prisma.document.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('deletes by id after verifying tenant ownership', async () => {
      prisma.document.findFirst.mockResolvedValue({ id: 'd1', organizationId: 'org-1' });
      prisma.document.deleteMany.mockResolvedValue({ count: 1 });
      const r = await svc.delete('org-1', 'd1');
      expect(prisma.document.findFirst).toHaveBeenCalledWith({
        where: { id: 'd1', organizationId: 'org-1' },
      });
      expect(prisma.document.deleteMany).toHaveBeenCalledWith({
        where: { id: 'd1', organizationId: 'org-1' },
      });
      expect(r).toEqual({ id: 'd1', organizationId: 'org-1' });
    });

    it('returns null when document does not exist in organization', async () => {
      prisma.document.findFirst.mockResolvedValue(null);
      const r = await svc.delete('org-1', 'missing');
      expect(r).toBeNull();
      expect(prisma.document.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('uploadVersion', () => {
    it('bumps version in transaction', async () => {
      prisma.document.findFirst.mockResolvedValue({ id: 'd1', version: 2, fileUrl: 'old.pdf' });
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          documentVersion: { create: vi.fn(async () => ({ id: 'v3', version: 3 })) },
          document: { update: vi.fn(async () => ({ id: 'd1', version: 3 })) },
        };
        return fn(tx);
      });

      const version = await svc.uploadVersion('org-1', 'd1', {
        fileUrl: 'new.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        uploadedBy: 'u-1',
        note: 'v3',
      });

      expect(prisma.document.findFirst).toHaveBeenCalledWith({
        where: { id: 'd1', organizationId: 'org-1' },
      });
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(version).toBeDefined();
    });

    it('returns null when document not found', async () => {
      prisma.document.findFirst.mockResolvedValue(null);
      const r = await svc.uploadVersion('org-1', 'nope', {
        fileUrl: 'f.pdf',
        fileSize: 1,
        mimeType: 'pdf',
        uploadedBy: 'u',
        note: '',
      });
      expect(r).toBeNull();
    });
  });
});
