/**
 * Unit tests for SearchService — universal search across 10 entity types.
 * Tests input validation, entity filtering, scoring, and result merging.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchService } from '../search.service';
import { PrismaService } from '../../prisma/prisma.service';

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
  };
}

describe('SearchService', () => {
  let svc: SearchService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    svc = new SearchService(prisma as unknown as PrismaService);
    vi.clearAllMocks();
    // Default all entity searches to empty
    Object.values(prisma).forEach((m) => m.findMany.mockResolvedValue([]));
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

  describe('scoring (private method via helper call)', () => {
    const scoreHelper = (target: SearchService, q: string, ...fields: (string | null | undefined)[]) => {
      return (target as unknown as { score: (q: string, ...f: (string | null | undefined)[]) => number }).score(q, ...fields);
    };

    it('returns 100 for exact match', () => {
      expect(scoreHelper(svc, 'ali', 'ali')).toBe(100);
    });

    it('returns 80 for prefix match', () => {
      expect(scoreHelper(svc, 'ali', 'alice')).toBe(80);
    });

    it('returns 60 for substring match', () => {
      expect(scoreHelper(svc, 'lic', 'alice')).toBe(60);
    });

    it('returns 0 for no match', () => {
      expect(scoreHelper(svc, 'xyz', 'alice')).toBe(0);
    });

    it('is case-insensitive', () => {
      expect(scoreHelper(svc, 'ALI', 'ali')).toBe(100);
    });

    it('checks all provided fields, returns the highest match', () => {
      expect(scoreHelper(svc, 'Bob', 'Bob', 'alex')).toBe(100);
      expect(scoreHelper(svc, 'al', 'Bob', 'alex')).toBe(80);
    });

    it('skips empty fields', () => {
      expect(scoreHelper(svc, 'ali', '', 'alice')).toBe(80);
    });
  });

  describe('limit enforcement', () => {
    it('caps results at the provided limit (max 50)', async () => {
      prisma.student.findMany.mockResolvedValue(
        Array.from({ length: 100 }, (_, i) => ({
          id: `s${i}`,
          user: { firstName: 'Ali', lastName: 'V', email: 'a@a.com', phone: '1' },
        })),
      );
      const r = await svc.search('org-1', { q: 'ali', limit: 5, types: ['STUDENT'] });
      expect(r.results.length).toBeLessThanOrEqual(5);
    });

    it('defaults to 20 when no limit given', async () => {
      prisma.student.findMany.mockResolvedValue(
        Array.from({ length: 100 }, (_, i) => ({
          id: `s${i}`,
          user: { firstName: 'Ali', lastName: 'V', email: 'a@a.com', phone: '1' },
        })),
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
      ]);
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
      ]);
      const r = await svc.search('org-1', { q: 'ali', types: ['STUDENT'] });
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
      ]);
      prisma.teacher.findMany.mockResolvedValue([
        { id: 't1', user: { firstName: 'Ali', lastName: 'T', email: 't@x.com' }, specializations: [] },
      ]);
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
      ]);

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
