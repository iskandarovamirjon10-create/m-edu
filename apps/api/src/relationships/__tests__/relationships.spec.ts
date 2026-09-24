import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { RelationshipsService } from '../relationships.service';
import { RelationshipsController } from '../relationships.controller';
import { PrismaService } from '../../prisma/prisma.service';

function createMockPrisma() {
  return {
    student: { findFirst: vi.fn() },
    teacher: { findFirst: vi.fn(), findMany: vi.fn() },
    group: { findFirst: vi.fn(), findMany: vi.fn() },
    course: { findFirst: vi.fn(), findMany: vi.fn() },
    lead: { findFirst: vi.fn() },
    payment: { findFirst: vi.fn(), findMany: vi.fn() },
    employee: { findFirst: vi.fn() },
    studentGroup: { findMany: vi.fn() },
    attendance: { findMany: vi.fn() },
  };
}

describe('RelationshipsModule Unit Tests', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: RelationshipsService;
  let controller: RelationshipsController;

  const orgId = 'org-1';

  beforeEach(async () => {
    vi.clearAllMocks();
    prisma = createMockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RelationshipsController],
      providers: [
        RelationshipsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<RelationshipsService>(RelationshipsService);
    controller = module.get<RelationshipsController>(RelationshipsController);
  });

  describe('RelationshipsService', () => {
    it('throws error when root student is not found', async () => {
      prisma.student.findFirst.mockResolvedValue(null);
      await expect(service.getGraph(orgId, 'STUDENT', 's-missing')).rejects.toThrow(
        'Student not found: s-missing',
      );
    });

    it('builds student graph with enrollments, payments and attendance', async () => {
      prisma.student.findFirst.mockResolvedValue({
        id: 's-1',
        user: { firstName: 'Ali', lastName: 'Valiyev' },
      });
      prisma.studentGroup.findMany.mockResolvedValue([
        { group: { id: 'g-1', name: 'Math Group' } },
      ]);
      prisma.payment.findMany.mockResolvedValue([
        { id: 'p-1', amount: 500, status: 'PAID' },
      ]);
      prisma.attendance.findMany.mockResolvedValue([
        { id: 'att-1', date: new Date('2026-09-01'), status: 'PRESENT' },
      ]);

      const graph = await service.getGraph(orgId, 'STUDENT', 's-1', 2);
      expect(graph.rootId).toBe('s-1');
      expect(graph.rootType).toBe('STUDENT');
      expect(graph.nodes.length).toBe(4);
      expect(graph.edges.length).toBe(3);
    });

    it('builds teacher graph with groups and courses', async () => {
      prisma.teacher.findFirst.mockResolvedValue({
        id: 't-1',
        user: { firstName: 'Olim', lastName: 'Ustoz' },
      });
      prisma.group.findMany.mockResolvedValue([
        { id: 'g-1', name: 'Physics A', courseId: 'c-1' },
      ]);
      prisma.course.findMany.mockResolvedValue([
        { id: 'c-1', name: 'Physics' },
      ]);

      const graph = await service.getGraph(orgId, 'TEACHER', 't-1', 2);
      expect(graph.rootId).toBe('t-1');
      expect(graph.nodes.some((n) => n.type === 'GROUP')).toBe(true);
      expect(graph.nodes.some((n) => n.type === 'COURSE')).toBe(true);
    });
  });

  describe('RelationshipsController', () => {
    it('delegates getGraph with parsed depth', async () => {
      const mockResult = { nodes: [], edges: [], rootType: 'STUDENT', rootId: 's-1' };
      vi.spyOn(service, 'getGraph').mockResolvedValue(mockResult);

      const result = await controller.getGraph(orgId, 'STUDENT', 's-1', '3');
      expect(result).toEqual(mockResult);
      expect(service.getGraph).toHaveBeenCalledWith(orgId, 'STUDENT', 's-1', 3);
    });

    it('clamps depth between 1 and 5', async () => {
      vi.spyOn(service, 'getGraph').mockResolvedValue({ nodes: [], edges: [], rootType: 'STUDENT', rootId: 's-1' });

      await controller.getGraph(orgId, 'STUDENT', 's-1', '10');
      expect(service.getGraph).toHaveBeenCalledWith(orgId, 'STUDENT', 's-1', 5);

      await controller.getGraph(orgId, 'STUDENT', 's-1', '0');
      expect(service.getGraph).toHaveBeenCalledWith(orgId, 'STUDENT', 's-1', 1);
    });
  });
});
