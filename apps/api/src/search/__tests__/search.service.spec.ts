/**
 * Unit tests for SearchService — universal search across 10 entity types.
 * Tests input validation, entity filtering, scoring, and result merging.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchService } from '../search.service';

function makePrisma() {
  return {
    student: { findMany: vi.fn() },
    teacher: { findMany: vi.fn() },
    group: { findMany: vi.fn() },
    course: { findMany: vi.fn() },
    lead: { findMany: vi.fn() },
    payment: { findMany: vi.fn() },
    employee: { findMany: vi.fn() },
    libraryBook: { findMany: vi.fn() },
    certificate: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
  } as any;
}

describe('SearchService', () => {
  let svc: SearchService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    svc = new SearchService(prisma);
    vi.clearAllMocks();
    // Default all entity searches to empty
    Object.values(prisma).forEach((m: any) => m.findMany.mockResolvedValue([]));
  });

  describe('input validation', () => {
    it('returns empty when query is empty', async () => {
      const r = await svc.search('org-1', { q: '' });
      expect(r.results).toEqual([]);
      expect(r.total).toBe(0);
    });

    it('returns empty when query is shorter than 2 characters', async () => {
      const r = await svc.search('org-1', { q: 'a' });
      expect(r.results).toEqual([]);
    });

    it('trims whitespace from query', async () => {
      const r = await svc.search('org-1', { q: '   ' });
      expect(r.results).toEqual([]);
    });
  });

  describe('scoring (private method via cast)', () => {
    it('returns 100 for exact match', () => {
      expect((svc as any).score('ali', 'ali')).toBe(100);
    });

    it('returns 80 for prefix match', () => {
      expect((svc as any).score('ali', 'alice')).toBe(80);
    });

    it('returns 60 for substring match', () => {
      expect((svc as any).score('lic', 'alice')).toBe(60);
    });

    it('returns 0 for no match', () => {
      expect((svc as any).score('xyz', 'alice')).toBe(0);
    });

    it('is case-insensitive', () => {
      expect((svc as any).score('ALI', 'ali')).toBe(100);
    });

    it('checks all provided fields, returns the highest match', () => {
      // 'Bob' is exact in first field, 'al' is prefix in second
      expect((svc as any).score('Bob', 'Bob', 'alex')).toBe(100);
      expect((svc as any).score('al', 'Bob', 'alex')).toBe(80);
    });

    it('skips empty fields', () => {
      expect((svc as any).score('ali', '', 'alice')).toBe(80);
    });
  });

  describe('limit enforcement', () => {
    it('caps results at the provided limit (max 50)', async () => {
      // Generate 100 students
      prisma.student.findMany.mockResolvedValue(
        Array.from({ length: 100 }, (_, i) => ({
          id: `s${i}`,
          user: { firstName: 'Ali', lastName: 'V', email: 'a@a.com', phone: '1' },
        })) as any,
      );
      const r = await svc.search('org-1', { q: 'ali', limit: 5, types: ['STUDENT'] });
      expect(r.results.length).toBeLessThanOrEqual(5);
    });

    it('defaults to 20 when no limit given', async () => {
      prisma.student.findMany.mockResolvedValue(
        Array.from({ length: 100 }, (_, i) => ({
          id: `s${i}`,
          user: { firstName: 'Ali', lastName: 'V', email: 'a@a.com', phone: '1' },
        })) as any,
      );
      const r = await svc.search('org-1', { q: 'ali', types: ['STUDENT'] });
      expect(r.results.length).toBeLessThanOrEqual(20);
    });
  });

  describe('result format', () => {
    it('includes id, type, title, href, relevanceScore', async () => {
      prisma.student.findMany.mockResolvedValue([
        {
          id: 's1',
          user: { firstName: 'Ali', lastName: 'Vali', email: 'ali@x.com', phone: '123' },
        },
      ] as any);
      const r = await svc.search('org-1', { q: 'ali', types: ['STUDENT'] });
      expect(r.results[0]).toMatchObject({
        id: 's1',
        type: 'STUDENT',
        title: 'Ali Vali',
        href: '/students/s1',
        relevanceScore: expect.any(Number),
      });
    });

    it('sorts by relevance descending', async () => {
      prisma.student.findMany.mockResolvedValue([
        { id: 's1', user: { firstName: 'Bob', lastName: 'M', email: 'b@x.com', phone: '' } },
        { id: 's2', user: { firstName: 'Ali', lastName: 'V', email: 'a@x.com', phone: '' } },
      ] as any);
      const r = await svc.search('org-1', { q: 'ali', types: ['STUDENT'] });
      // 'Ali' exact match (100) should be before 'Bob' (no match, 0)
      expect(r.results[0].id).toBe('s2');
    });
  });

  describe('entity filtering', () => {
    it('only queries the requested types when types filter is set', async () => {
      await svc.search('org-1', { q: 'ali', types: ['STUDENT'] });
      expect(prisma.student.findMany).toHaveBeenCalled();
      expect(prisma.teacher.findMany).not.toHaveBeenCalled();
      expect(prisma.group.findMany).not.toHaveBeenCalled();
    });

    it('aggregates byType counts', async () => {
      prisma.student.findMany.mockResolvedValue([
        { id: 's1', user: { firstName: 'Ali', lastName: 'V', email: 'a@x.com', phone: '' } },
      ] as any);
      prisma.teacher.findMany.mockResolvedValue([
        { id: 't1', user: { firstName: 'Ali', lastName: 'T', email: 't@x.com' }, specializations: [] },
      ] as any);
      const r = await svc.search('org-1', { q: 'ali', types: ['STUDENT', 'TEACHER'] });
      expect(r.byType.STUDENT).toBe(1);
      expect(r.byType.TEACHER).toBe(1);
    });
  });

  describe('error resilience', () => {
    it('continues when one entity type throws (Promise.allSettled)', async () => {
      prisma.student.findMany.mockRejectedValue(new Error('DB error'));
      prisma.teacher.findMany.mockResolvedValue([
        { id: 't1', user: { firstName: 'Ali', lastName: 'T', email: 't@x.com' }, specializations: [] },
      ] as any);

      // Should NOT throw
      const r = await svc.search('org-1', { q: 'ali', types: ['STUDENT', 'TEACHER'] });
      expect(r.byType.STUDENT).toBe(0);
      expect(r.byType.TEACHER).toBe(1);
    });
  });

  describe('tenant isolation', () => {
    it('passes organizationId to the prisma where clause', async () => {
      await svc.search('org-xyz', { q: 'ali', types: ['STUDENT'] });
      const call = prisma.student.findMany.mock.calls[0][0];
      expect(call.where.organizationId).toBe('org-xyz');
    });
  });
});
