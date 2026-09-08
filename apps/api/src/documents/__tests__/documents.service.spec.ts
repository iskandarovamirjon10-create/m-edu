/**
 * Unit tests for DocumentsService — deterministic, rule-based, no AI.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentsService } from '../documents.service';

function makePrisma() {
  return {
    document: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      // Service intentionally uses updateMany (scoped by id + organizationId)
      // so cross-tenant/non-existent ids return count 0 instead of P2025.
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    documentVersion: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (fn: any) => {
      const tx = {
        documentVersion: { create: vi.fn() },
        document: { update: vi.fn(), findFirst: vi.fn() },
      };
      return fn(tx);
    }),
  } as any;
}

describe('DocumentsService', () => {
  let svc: DocumentsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    svc = new DocumentsService(prisma);
    vi.clearAllMocks();
  });

  describe('findAll — tenant isolation', () => {
    it('always filters by organizationId', async () => {
      prisma.document.findMany.mockResolvedValue([]);
      prisma.document.count.mockResolvedValue(0);
      await svc.findAll('org-xyz', {});
      const where = prisma.document.findMany.mock.calls[0][0].where;
      expect(where.organizationId).toBe('org-xyz');
    });
  });

  describe('findAll — filter mapping', () => {
    it('maps category', async () => {
      prisma.document.findMany.mockResolvedValue([]);
      prisma.document.count.mockResolvedValue(0);
      await svc.findAll('org-1', { category: 'CONTRACT' });
      expect(prisma.document.findMany.mock.calls[0][0].where.category).toBe('CONTRACT');
    });

    it('maps search to OR on title/description', async () => {
      prisma.document.findMany.mockResolvedValue([]);
      prisma.document.count.mockResolvedValue(0);
      await svc.findAll('org-1', { search: 'contract' });
      const or = prisma.document.findMany.mock.calls[0][0].where.OR;
      expect(or).toHaveLength(2);
    });

    it('maps tags with hasSome', async () => {
      prisma.document.findMany.mockResolvedValue([]);
      prisma.document.count.mockResolvedValue(0);
      await svc.findAll('org-1', { tags: ['contract', 'final'] });
      const tags = prisma.document.findMany.mock.calls[0][0].where.tags;
      expect(tags).toHaveProperty('hasSome');
    });

    it('maps relatedEntity fields', async () => {
      prisma.document.findMany.mockResolvedValue([]);
      prisma.document.count.mockResolvedValue(0);
      await svc.findAll('org-1', { relatedEntityType: 'STUDENT', relatedEntityId: 's1' });
      const where = prisma.document.findMany.mock.calls[0][0].where;
      expect(where.relatedEntityType).toBe('STUDENT');
      expect(where.relatedEntityId).toBe('s1');
    });

    it('orders by uploadedAt desc', async () => {
      prisma.document.findMany.mockResolvedValue([]);
      prisma.document.count.mockResolvedValue(0);
      await svc.findAll('org-1', {});
      expect(prisma.document.findMany.mock.calls[0][0].orderBy).toEqual({ uploadedAt: 'desc' });
    });

    it('returns pagination meta', async () => {
      prisma.document.findMany.mockResolvedValue([]);
      prisma.document.count.mockResolvedValue(45);
      const r = await svc.findAll('org-1', { page: '3', limit: '10' });
      expect(r.page).toBe(3);
      expect(r.limit).toBe(10);
      expect(r.total).toBe(45);
      expect(r.totalPages).toBe(5);
    });
  });

  describe('findOne', () => {
    it('returns document with organization filter', async () => {
      prisma.document.findFirst.mockResolvedValue({ id: 'd1', title: 'Contract' });
      const r = await svc.findOne('org-1', 'd1');
      expect(r?.id).toBe('d1');
      expect(prisma.document.findFirst).toHaveBeenCalledWith({
        where: { id: 'd1', organizationId: 'org-1' },
      });
    });
  });

  describe('create', () => {
    it('injects organizationId', async () => {
      prisma.document.create.mockResolvedValue({ id: 'd1' });
      await svc.create('org-1', { title: 'New doc', category: 'FORM' });
      const data = prisma.document.create.mock.calls[0][0].data;
      expect(data.organizationId).toBe('org-1');
      expect(data.title).toBe('New doc');
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
      // tenant isolation via where — a cross-tenant id must not match
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
    it('filters by id and organizationId', async () => {
      prisma.document.delete.mockResolvedValue({ id: 'd1' });
      await svc.delete('org-1', 'd1');
      expect(prisma.document.delete).toHaveBeenCalledWith({
        where: { id: 'd1', organizationId: 'org-1' },
      });
    });
  });

  describe('uploadVersion', () => {
    it('bumps version in transaction', async () => {
      prisma.document.findFirst.mockResolvedValue({ id: 'd1', version: 2, fileUrl: 'old.pdf' });
      // Mock $transaction to call the inner function with a tx-style object
      let capturedTx: any;
      prisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          documentVersion: { create: vi.fn(async () => ({ id: 'v3', version: 3 })) },
          document: { update: vi.fn(async () => ({ id: 'd1', version: 3 })) },
        };
        capturedTx = tx;
        return fn(tx);
      });

      const v = await svc.uploadVersion('org-1', 'd1', {
        fileUrl: 'new.pdf', fileSize: 1024, mimeType: 'application/pdf', uploadedBy: 'u-1', note: 'v3',
      });

      expect(prisma.document.findFirst).toHaveBeenCalledWith({
        where: { id: 'd1', organizationId: 'org-1' },
      });
      // Transaction executed — check it was called
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('returns null when document not found', async () => {
      prisma.document.findFirst.mockResolvedValue(null);
      const r = await svc.uploadVersion('org-1', 'nope', { fileUrl: 'f.pdf', fileSize: 1, mimeType: 'pdf', uploadedBy: 'u', note: '' });
      expect(r).toBeNull();
    });
  });
});
