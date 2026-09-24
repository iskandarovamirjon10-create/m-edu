import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { AcademicRiskController } from '../academic-risk.controller';
import { AcademicRiskService } from '../academic-risk.service';
import { AcademicRiskQueryDto } from '../dto/academic-risk-query.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';

describe('AcademicRiskController', () => {
  let controller: AcademicRiskController;
  let service: {
    getSummary: ReturnType<typeof vi.fn>;
    findAll: ReturnType<typeof vi.fn>;
  };

  const orgId = 'org-123';

  beforeEach(async () => {
    service = {
      getSummary: vi.fn(),
      findAll: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AcademicRiskController],
      providers: [
        {
          provide: AcademicRiskService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<AcademicRiskController>(AcademicRiskController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getSummary', () => {
    it('delegates to academicRiskService.getSummary with organizationId', async () => {
      const mockSummary = {
        total: 25,
        high: 5,
        medium: 10,
        low: 10,
        avgScore: 42.5,
      };
      service.getSummary.mockResolvedValue(mockSummary);

      const result = await controller.getSummary(orgId);

      expect(service.getSummary).toHaveBeenCalledWith(orgId);
      expect(result).toEqual(mockSummary);
    });

    it('propagates service errors', async () => {
      service.getSummary.mockRejectedValue(new Error('Database connection failed'));

      await expect(controller.getSummary(orgId)).rejects.toThrow('Database connection failed');
    });
  });

  describe('findAll', () => {
    it('delegates to academicRiskService.findAll with organizationId and query dto', async () => {
      const query: AcademicRiskQueryDto = {
        riskLevel: 'HIGH',
        groupId: 'group-1',
        page: 1,
        limit: 20,
      };
      const mockResult = {
        items: [
          {
            studentId: 'student-1',
            studentName: 'Alice Smith',
            groupId: 'group-1',
            groupName: 'Group Alpha',
            riskLevel: 'HIGH' as const,
            riskScore: 78.5,
            factors: [
              {
                factorId: 'attendanceRate',
                name: 'Low Attendance',
                weight: 25,
                score: 80,
              },
            ],
            lastGrade: 45,
            attendanceRate: 50,
            homeworkCompletion: 40,
          },
        ],
        total: 1,
      };
      service.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll(orgId, query);

      expect(service.findAll).toHaveBeenCalledWith(orgId, query);
      expect(result).toEqual(mockResult);
    });

    it('delegates to academicRiskService.findAll with empty query dto', async () => {
      const query: AcademicRiskQueryDto = {};
      const mockResult = {
        items: [],
        total: 0,
      };
      service.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll(orgId, query);

      expect(service.findAll).toHaveBeenCalledWith(orgId, query);
      expect(result).toEqual(mockResult);
    });

    it('propagates service errors', async () => {
      service.findAll.mockRejectedValue(new Error('Failed to retrieve academic risks'));

      await expect(controller.findAll(orgId, {})).rejects.toThrow('Failed to retrieve academic risks');
    });
  });

  describe('Guard verification (structural)', () => {
    it('has UseGuards decorator applied at the class level with JwtAuthGuard and RolesGuard', () => {
      const guards = Reflect.getMetadata('__guards__', AcademicRiskController);
      expect(guards).toBeDefined();
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(RolesGuard);
      expect(guards.length).toBe(2);
    });

    it('has Roles decorator restricting access to authorized roles', () => {
      const roles = Reflect.getMetadata('roles', AcademicRiskController);
      expect(roles).toBeDefined();
      expect(roles).toContain(Role.SUPER_ADMIN);
      expect(roles).toContain(Role.ORG_ADMIN);
      expect(roles).toContain(Role.MANAGER);
      expect(roles).toContain(Role.TEACHER);
      expect(roles).not.toContain(Role.STUDENT);
    });
  });
});
