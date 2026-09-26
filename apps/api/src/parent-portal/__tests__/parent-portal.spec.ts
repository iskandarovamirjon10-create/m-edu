import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ParentPortalService, ParentContext } from '../parent-portal.service';
import { ParentPortalController } from '../parent-portal.controller';
import { PrismaService } from '../../prisma/prisma.service';

function createMockPrisma() {
  return {
    parentAccount: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    parentStudent: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    attendance: {
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
    grade: {
      findMany: vi.fn(),
    },
    examResult: {
      findMany: vi.fn(),
    },
    invoice: {
      findMany: vi.fn(),
    },
    payment: {
      findMany: vi.fn(),
    },
  };
}

describe('ParentPortalModule Unit Tests', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: ParentPortalService;
  let controller: ParentPortalController;

  const mockCtx: ParentContext = {
    parentId: 'p-1',
    organizationId: 'org-1',
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    prisma = createMockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ParentPortalController],
      providers: [
        ParentPortalService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ParentPortalService>(ParentPortalService);
    controller = module.get<ParentPortalController>(ParentPortalController);
  });

  describe('ParentPortalService', () => {
    describe('listChildren', () => {
      it('returns mapped children list with domain permissions', async () => {
        prisma.parentStudent.findMany.mockResolvedValue([
          {
            studentId: 's-1',
            relationship: 'FATHER',
            canViewGrades: true,
            canViewPayments: true,
            canViewAttendance: true,
            student: {
              id: 's-1',
              balance: 100,
              user: { firstName: 'Ali', lastName: 'Valiyev', avatar: null },
              groups: [],
            },
          },
        ]);

        const result = await service.listChildren(mockCtx);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
          studentId: 's-1',
          relationship: 'FATHER',
          // Added so the Telegram bot can label its child picker without a
          // second query; the field was already selected. See docs/TELEGRAM.md.
          name: 'Ali Valiyev',
          permissions: {
            grades: true,
            payments: true,
            attendance: true,
          },
        });
      });
    });

    describe('getChildAttendance', () => {
      it('throws NotFoundException if student is not linked', async () => {
        prisma.parentStudent.findFirst.mockResolvedValue(null);
        await expect(service.getChildAttendance(mockCtx, 's-unlinked')).rejects.toThrow(
          NotFoundException,
        );
      });

      it('throws NotFoundException if attendance domain is disallowed', async () => {
        prisma.parentStudent.findFirst.mockResolvedValue({
          studentId: 's-1',
          canViewAttendance: false,
        });
        await expect(service.getChildAttendance(mockCtx, 's-1')).rejects.toThrow(
          'Not permitted for this student',
        );
      });

      it('returns attendance records when permitted', async () => {
        prisma.parentStudent.findFirst.mockResolvedValue({
          studentId: 's-1',
          canViewAttendance: true,
        });
        prisma.attendance.findMany.mockResolvedValue([
          { id: 'att-1', date: new Date(), status: 'PRESENT' },
        ]);

        const result = await service.getChildAttendance(mockCtx, 's-1');
        expect(result).toHaveLength(1);
        expect(prisma.attendance.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { organizationId: 'org-1', studentId: 's-1' },
          }),
        );
      });
    });

    describe('getChildAttendanceSummary', () => {
      it('calculates attendance rate properly', async () => {
        prisma.parentStudent.findFirst.mockResolvedValue({
          studentId: 's-1',
          canViewAttendance: true,
        });
        prisma.attendance.groupBy.mockResolvedValue([
          { status: 'PRESENT', _count: 8 },
          { status: 'LATE', _count: 2 },
          { status: 'ABSENT', _count: 2 },
        ]);

        const summary = await service.getChildAttendanceSummary(mockCtx, 's-1');
        expect(summary.total).toBe(12);
        expect(summary.byStatus.PRESENT).toBe(8);
        expect(summary.attendanceRate).toBe(83); // (8 + 2) / 12 = 83.33% -> 83
      });
    });

    describe('getChildGrades', () => {
      it('returns grades and exam results when permitted', async () => {
        prisma.parentStudent.findFirst.mockResolvedValue({
          studentId: 's-1',
          canViewGrades: true,
        });
        prisma.grade.findMany.mockResolvedValue([{ id: 'g-1', value: 95 }]);
        prisma.examResult.findMany.mockResolvedValue([{ id: 'er-1', marksObtained: 90 }]);

        const result = await service.getChildGrades(mockCtx, 's-1');
        expect(result.grades).toHaveLength(1);
        expect(result.examResults).toHaveLength(1);
      });
    });

    describe('getChildInvoices', () => {
      it('calculates outstanding and overdue amounts correctly', async () => {
        prisma.parentStudent.findFirst.mockResolvedValue({
          studentId: 's-1',
          canViewPayments: true,
        });
        const pastDate = new Date(Date.now() - 86400000);
        prisma.invoice.findMany.mockResolvedValue([
          { id: 'inv-1', total: 1000, paidAmount: 400, dueDate: pastDate, status: 'UNPAID' },
        ]);
        prisma.payment.findMany.mockResolvedValue([
          { id: 'pay-1', amount: 400, status: 'PAID' },
        ]);

        const result = await service.getChildInvoices(mockCtx, 's-1');
        expect(result.outstanding).toBe(600);
        expect(result.overdue).toBe(600);
        expect(result.invoices).toHaveLength(1);
        expect(result.payments).toHaveLength(1);
      });
    });

    describe('authenticate', () => {
      const validHash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

      it('authenticates single parent account successfully', async () => {
        const bcrypt = await import('bcryptjs');
        vi.spyOn(bcrypt.default ?? bcrypt, 'compare').mockImplementation(async () => true);

        prisma.parentAccount.findMany.mockResolvedValue([
          {
            id: 'p-1',
            organizationId: 'org-1',
            email: 'parent@example.com',
            firstName: 'Farhod',
            lastName: 'Karimov',
            passwordHash: validHash,
            organization: { id: 'org-1', name: 'Center A' },
          },
        ]);
        prisma.parentAccount.update.mockResolvedValue({});

        const res = await service.authenticate('parent@example.com', 'password123');
        expect(res.id).toBe('p-1');
        expect(res.organizationId).toBe('org-1');
        expect(prisma.parentAccount.update).toHaveBeenCalledWith({
          where: { id: 'p-1' },
          data: { lastLoginAt: expect.any(Date) },
        });
      });

      it('authenticates with explicit organizationId', async () => {
        const bcrypt = await import('bcryptjs');
        vi.spyOn(bcrypt.default ?? bcrypt, 'compare').mockImplementation(async () => true);

        prisma.parentAccount.findFirst.mockResolvedValue({
          id: 'p-2',
          organizationId: 'org-2',
          email: 'parent@example.com',
          firstName: 'Farhod',
          lastName: 'Karimov',
          passwordHash: validHash,
        });
        prisma.parentAccount.update.mockResolvedValue({});

        const res = await service.authenticate('parent@example.com', 'password123', 'org-2');
        expect(res.id).toBe('p-2');
        expect(res.organizationId).toBe('org-2');
        expect(prisma.parentAccount.findFirst).toHaveBeenCalledWith({
          where: { email: 'parent@example.com', organizationId: 'org-2', isActive: true },
          select: expect.any(Object),
        });
      });

      it('rejects unknown parent email', async () => {
        prisma.parentAccount.findMany.mockResolvedValue([]);
        await expect(service.authenticate('nobody@example.com', 'password123')).rejects.toThrow(
          'Invalid parent credentials',
        );
      });

      it('requires organization selection when multiple accounts match password', async () => {
        const bcrypt = await import('bcryptjs');
        vi.spyOn(bcrypt.default ?? bcrypt, 'compare').mockImplementation(async () => true);

        prisma.parentAccount.findMany.mockResolvedValue([
          {
            id: 'p-1',
            organizationId: 'org-1',
            email: 'parent@example.com',
            firstName: 'Farhod',
            lastName: 'Karimov',
            passwordHash: validHash,
            organization: { id: 'org-1', name: 'Center A' },
          },
          {
            id: 'p-2',
            organizationId: 'org-2',
            email: 'parent@example.com',
            firstName: 'Farhod',
            lastName: 'Karimov',
            passwordHash: validHash,
            organization: { id: 'org-2', name: 'Center B' },
          },
        ]);

        try {
          await service.authenticate('parent@example.com', 'password123');
          expect.fail('Should have thrown BadRequestException');
        } catch (err: any) {
          const resp = err.getResponse();
          expect(resp.code).toBe('ORGANIZATION_REQUIRED');
          expect(resp.organizations).toHaveLength(2);
          expect(resp.organizations[0].name).toBe('Center A');
          expect(resp.organizations[1].name).toBe('Center B');
        }
      });
    });
  });

  describe('ParentPortalController', () => {
    it('delegates listChildren with caller context', async () => {
      vi.spyOn(service, 'listChildren').mockResolvedValue([]);
      const result = await controller.listChildren({ sub: 'p-1', organizationId: 'org-1' });
      expect(result).toEqual([]);
      expect(service.listChildren).toHaveBeenCalledWith({ parentId: 'p-1', organizationId: 'org-1' });
    });

    it('delegates childAttendance with caller context and studentId', async () => {
      vi.spyOn(service, 'getChildAttendance').mockResolvedValue([]);
      const result = await controller.childAttendance(
        { sub: 'p-1', organizationId: 'org-1' },
        's-uuid-1',
      );
      expect(result).toEqual([]);
      expect(service.getChildAttendance).toHaveBeenCalledWith(
        { parentId: 'p-1', organizationId: 'org-1' },
        's-uuid-1',
      );
    });
  });
});
