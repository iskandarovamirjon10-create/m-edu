import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ParentPortalController } from '../parent-portal.controller';
import { ParentPortalService, ParentContext } from '../parent-portal.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { ROLES_KEY } from '../../auth/roles.decorator';

describe('ParentPortalController', () => {
  let controller: ParentPortalController;
  let service: {
    listChildren: ReturnType<typeof vi.fn>;
    getChildAttendance: ReturnType<typeof vi.fn>;
    getChildAttendanceSummary: ReturnType<typeof vi.fn>;
    getChildGrades: ReturnType<typeof vi.fn>;
    getChildSchedule: ReturnType<typeof vi.fn>;
    getChildInvoices: ReturnType<typeof vi.fn>;
  };

  const mockUser = {
    sub: 'parent-uuid-1',
    organizationId: 'org-uuid-1',
  };

  const expectedCtx: ParentContext = {
    parentId: 'parent-uuid-1',
    organizationId: 'org-uuid-1',
  };

  const studentId = 'student-uuid-123';

  beforeEach(async () => {
    service = {
      listChildren: vi.fn(),
      getChildAttendance: vi.fn(),
      getChildAttendanceSummary: vi.fn(),
      getChildGrades: vi.fn(),
      getChildSchedule: vi.fn(),
      getChildInvoices: vi.fn(),
    };

    controller = new ParentPortalController(service as unknown as ParentPortalService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('listChildren', () => {
    it('delegates to parentPortal.listChildren with resolved context', async () => {
      const mockChildren = [
        {
          studentId: 's-1',
          relationship: 'FATHER',
          permissions: {
            grades: true,
            payments: true,
            attendance: true,
          },
          student: {
            id: 's-1',
            balance: 150,
            user: { firstName: 'Ali', lastName: 'Valiyev', avatar: null },
            groups: [],
          },
        },
      ];
      service.listChildren.mockResolvedValue(mockChildren);

      const result = await controller.listChildren(mockUser);

      expect(service.listChildren).toHaveBeenCalledWith(expectedCtx);
      expect(result).toEqual(mockChildren);
    });

    it('propagates service errors', async () => {
      service.listChildren.mockRejectedValue(new UnauthorizedException('Unauthorized access'));

      await expect(controller.listChildren(mockUser)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(service.listChildren).toHaveBeenCalledWith(expectedCtx);
    });
  });

  describe('childAttendance', () => {
    it('delegates to parentPortal.getChildAttendance with resolved context and studentId', async () => {
      const mockAttendance = [
        { id: 'att-1', date: new Date('2026-09-15'), status: 'PRESENT' },
        { id: 'att-2', date: new Date('2026-09-16'), status: 'LATE' },
      ];
      service.getChildAttendance.mockResolvedValue(mockAttendance);

      const result = await controller.childAttendance(mockUser, studentId);

      expect(service.getChildAttendance).toHaveBeenCalledWith(expectedCtx, studentId);
      expect(result).toEqual(mockAttendance);
    });

    it('propagates NotFoundException when student is not linked or not found', async () => {
      service.getChildAttendance.mockRejectedValue(
        new NotFoundException('Child not found or not linked to this parent'),
      );

      await expect(controller.childAttendance(mockUser, studentId)).rejects.toThrow(
        NotFoundException,
      );
      expect(service.getChildAttendance).toHaveBeenCalledWith(expectedCtx, studentId);
    });
  });

  describe('childAttendanceSummary', () => {
    it('delegates to parentPortal.getChildAttendanceSummary with resolved context and studentId', async () => {
      const mockSummary = {
        total: 10,
        byStatus: { PRESENT: 8, LATE: 1, ABSENT: 1 },
        attendanceRate: 90,
      };
      service.getChildAttendanceSummary.mockResolvedValue(mockSummary);

      const result = await controller.childAttendanceSummary(mockUser, studentId);

      expect(service.getChildAttendanceSummary).toHaveBeenCalledWith(expectedCtx, studentId);
      expect(result).toEqual(mockSummary);
    });

    it('propagates service errors', async () => {
      service.getChildAttendanceSummary.mockRejectedValue(
        new NotFoundException('Attendance records not accessible'),
      );

      await expect(controller.childAttendanceSummary(mockUser, studentId)).rejects.toThrow(
        NotFoundException,
      );
      expect(service.getChildAttendanceSummary).toHaveBeenCalledWith(expectedCtx, studentId);
    });
  });

  describe('childGrades', () => {
    it('delegates to parentPortal.getChildGrades with resolved context and studentId', async () => {
      const mockGrades = {
        grades: [{ id: 'g-1', value: 95, lessonId: 'l-1' }],
        examResults: [{ id: 'er-1', marksObtained: 92, totalMarks: 100 }],
      };
      service.getChildGrades.mockResolvedValue(mockGrades);

      const result = await controller.childGrades(mockUser, studentId);

      expect(service.getChildGrades).toHaveBeenCalledWith(expectedCtx, studentId);
      expect(result).toEqual(mockGrades);
    });

    it('propagates service errors', async () => {
      service.getChildGrades.mockRejectedValue(
        new NotFoundException('Grades domain not permitted'),
      );

      await expect(controller.childGrades(mockUser, studentId)).rejects.toThrow(
        NotFoundException,
      );
      expect(service.getChildGrades).toHaveBeenCalledWith(expectedCtx, studentId);
    });
  });

  describe('childSchedule', () => {
    it('delegates to parentPortal.getChildSchedule with resolved context and studentId', async () => {
      const mockSchedule = [
        {
          id: 'sch-1',
          dayOfWeek: 'MONDAY',
          startTime: '09:00',
          endTime: '10:30',
          room: 'Room 101',
          group: { id: 'grp-1', name: 'Math Advanced' },
        },
      ];
      service.getChildSchedule.mockResolvedValue(mockSchedule);

      const result = await controller.childSchedule(mockUser, studentId);

      expect(service.getChildSchedule).toHaveBeenCalledWith(expectedCtx, studentId);
      expect(result).toEqual(mockSchedule);
    });

    it('propagates service errors', async () => {
      service.getChildSchedule.mockRejectedValue(
        new NotFoundException('Schedule domain not permitted'),
      );

      await expect(controller.childSchedule(mockUser, studentId)).rejects.toThrow(
        NotFoundException,
      );
      expect(service.getChildSchedule).toHaveBeenCalledWith(expectedCtx, studentId);
    });
  });

  describe('childInvoices', () => {
    it('delegates to parentPortal.getChildInvoices with resolved context and studentId', async () => {
      const mockInvoices = {
        balance: -200,
        outstanding: 500,
        overdue: 200,
        invoices: [{ id: 'inv-1', total: 1000, paidAmount: 500, status: 'PARTIAL' }],
        payments: [{ id: 'pay-1', amount: 500, status: 'PAID' }],
      };
      service.getChildInvoices.mockResolvedValue(mockInvoices);

      const result = await controller.childInvoices(mockUser, studentId);

      expect(service.getChildInvoices).toHaveBeenCalledWith(expectedCtx, studentId);
      expect(result).toEqual(mockInvoices);
    });

    it('propagates service errors', async () => {
      service.getChildInvoices.mockRejectedValue(
        new NotFoundException('Payment domain not permitted'),
      );

      await expect(controller.childInvoices(mockUser, studentId)).rejects.toThrow(
        NotFoundException,
      );
      expect(service.getChildInvoices).toHaveBeenCalledWith(expectedCtx, studentId);
    });
  });

  describe('Guards and Decorators verification', () => {
    it('has UseGuards applied at the class level with JwtAuthGuard and RolesGuard', () => {
      const guards = Reflect.getMetadata('__guards__', ParentPortalController);
      expect(guards).toBeDefined();
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(RolesGuard);
    });

    it('applies Roles("PARENT") decorator on all route handlers', () => {
      const routeHandlers = [
        ParentPortalController.prototype.listChildren,
        ParentPortalController.prototype.childAttendance,
        ParentPortalController.prototype.childAttendanceSummary,
        ParentPortalController.prototype.childGrades,
        ParentPortalController.prototype.childSchedule,
        ParentPortalController.prototype.childInvoices,
      ];

      for (const handler of routeHandlers) {
        const roles = Reflect.getMetadata(ROLES_KEY, handler);
        expect(roles).toEqual(['PARENT']);
      }
    });
  });
});
