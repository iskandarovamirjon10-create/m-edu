import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { AttendanceController } from '../attendance.controller';
import { AttendanceService } from '../attendance.service';

describe('AttendanceController', () => {
  let controller: AttendanceController;
  let service: {
    markAttendance: ReturnType<typeof vi.fn>;
    findAll: ReturnType<typeof vi.fn>;
    getAnalytics: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };

  const orgId = 'org-1';

  beforeEach(async () => {
    service = {
      markAttendance: vi.fn(),
      findAll: vi.fn(),
      getAnalytics: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };

    controller = new AttendanceController(service as unknown as AttendanceService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('markAttendance', () => {
    it('delegates to service.markAttendance with organizationId and dto', async () => {
      const dto = {
        groupId: 'g-1',
        date: '2026-09-15',
        records: [
          { studentId: 's-1', status: 'PRESENT' },
          { studentId: 's-2', status: 'ABSENT' },
        ],
      };
      const expected = { created: 2, updated: 0, total: 2 };
      service.markAttendance.mockResolvedValue(expected);

      const result = await controller.markAttendance(orgId, dto as any);

      expect(result).toEqual(expected);
      expect(service.markAttendance).toHaveBeenCalledWith(orgId, dto);
    });

    it('propagates service errors (e.g., group not found)', async () => {
      service.markAttendance.mockRejectedValue(new Error('Group not found'));

      await expect(
        controller.markAttendance(orgId, { groupId: 'bad', date: '2026-09-15', records: [] } as any),
      ).rejects.toThrow('Group not found');
    });
  });

  describe('findAll', () => {
    it('delegates to service.findAll with organizationId and query', async () => {
      const query = { groupId: 'g-1', page: 1, limit: 20 };
      const expected = { items: [], total: 0, page: 1, limit: 20, totalPages: 0 };
      service.findAll.mockResolvedValue(expected);

      const result = await controller.findAll(orgId, query as any);

      expect(result).toEqual(expected);
      expect(service.findAll).toHaveBeenCalledWith(orgId, query);
    });
  });

  describe('getAnalytics', () => {
    it('delegates to service.getAnalytics with organizationId and query', async () => {
      const query = { groupId: 'g-1', dateFrom: '2026-09-01', dateTo: '2026-09-30' };
      const expected = {
        overall: { total: 100, present: 85, rate: 85 },
        byStatus: [],
        byGroup: [],
        daily: [],
      };
      service.getAnalytics.mockResolvedValue(expected);

      const result = await controller.getAnalytics(orgId, query as any);

      expect(result).toEqual(expected);
      expect(service.getAnalytics).toHaveBeenCalledWith(orgId, query);
    });
  });

  describe('update', () => {
    it('delegates to service.update with organizationId, id and dto', async () => {
      const id = '11111111-1111-4111-8111-111111111111';
      const dto = { status: 'LATE', note: 'traffic' };
      const expected = { id, status: 'LATE', note: 'traffic' };
      service.update.mockResolvedValue(expected);

      const result = await controller.update(orgId, id, dto as any);

      expect(result).toEqual(expected);
      expect(service.update).toHaveBeenCalledWith(orgId, id, dto);
    });

    it('propagates service errors (e.g., not found)', async () => {
      service.update.mockRejectedValue(new Error('Attendance record not found'));
      await expect(
        controller.update(orgId, '11111111-1111-4111-8111-111111111111', { status: 'ABSENT' } as any),
      ).rejects.toThrow('Attendance record not found');
    });
  });

  describe('remove', () => {
    it('delegates to service.remove (void) with organizationId and id', async () => {
      const id = '11111111-1111-4111-8111-111111111111';
      const expected = { deleted: true, id };
      service.remove.mockResolvedValue(expected);

      const result = await controller.remove(orgId, id);

      expect(result).toEqual(expected);
      expect(service.remove).toHaveBeenCalledWith(orgId, id);
    });
  });

  describe('Guard verification (structural)', () => {
    it('has UseGuards decorator applied at the class level', () => {
      // Verify the controller class has the correct decorators by checking
      // the metadata that NestJS sets via Reflect.getMetadata
      const guards = Reflect.getMetadata('__guards__', AttendanceController);
      expect(guards).toBeDefined();
      expect(guards.length).toBeGreaterThanOrEqual(2); // JwtAuthGuard + RolesGuard
    });

    it('has Roles decorator restricting access', () => {
      const roles = Reflect.getMetadata('roles', AttendanceController);
      expect(roles).toBeDefined();
      expect(roles).toContain('SUPER_ADMIN');
      expect(roles).toContain('ORG_ADMIN');
      expect(roles).toContain('MANAGER');
      expect(roles).toContain('TEACHER');
      // STUDENT and ASSISTANT must NOT have attendance marking rights
      expect(roles).not.toContain('STUDENT');
      expect(roles).not.toContain('ASSISTANT');
    });
  });
});
