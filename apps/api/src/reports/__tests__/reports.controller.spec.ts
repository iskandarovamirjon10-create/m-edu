import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ReportsController } from '../reports.controller';
import { ReportBuilderService } from '../report-builder.service';
import {
  ExportReportDto,
  RunReportParamsDto,
  SaveReportDefinitionDto,
} from '../dto/report.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { ROLES_KEY } from '../../auth/roles.decorator';
import { Role } from '@prisma/client';
import { Response } from 'express';

describe('ReportsController', () => {
  let controller: ReportsController;
  let service: {
    listDesigns: ReturnType<typeof vi.fn>;
    getDesign: ReturnType<typeof vi.fn>;
    run: ReturnType<typeof vi.fn>;
    saveDefinition: ReturnType<typeof vi.fn>;
    listDefinitions: ReturnType<typeof vi.fn>;
    runSaved: ReturnType<typeof vi.fn>;
    deleteDefinition: ReturnType<typeof vi.fn>;
    exportResult: ReturnType<typeof vi.fn>;
  };

  const orgId = 'org-123';
  const userId = 'user-456';

  const createMockResponse = () => {
    const res: Partial<Response> = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    res.setHeader = vi.fn().mockReturnValue(res);
    res.send = vi.fn().mockReturnValue(res);
    return res as unknown as Response;
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    service = {
      listDesigns: vi.fn(),
      getDesign: vi.fn(),
      run: vi.fn(),
      saveDefinition: vi.fn(),
      listDefinitions: vi.fn(),
      runSaved: vi.fn(),
      deleteDefinition: vi.fn(),
      exportResult: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        {
          provide: ReportBuilderService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<ReportsController>(ReportsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('listDesigns', () => {
    it('delegates to service.listDesigns and returns the result', () => {
      const mockDesigns = [
        { type: 'STUDENTS', columns: [{ key: 'name', label: 'Student' }] },
        { type: 'TEACHERS', columns: [{ key: 'name', label: 'Teacher' }] },
      ];
      service.listDesigns.mockReturnValue(mockDesigns);

      const result = controller.listDesigns();

      expect(service.listDesigns).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockDesigns);
    });

    it('propagates errors thrown by service.listDesigns', () => {
      service.listDesigns.mockImplementation(() => {
        throw new Error('Service error');
      });

      expect(() => controller.listDesigns()).toThrow('Service error');
    });
  });

  describe('getDesign', () => {
    it('delegates to service.getDesign with type param', () => {
      const mockDesign = {
        type: 'STUDENTS',
        columns: [{ key: 'name', label: 'Student' }],
      };
      service.getDesign.mockReturnValue(mockDesign);

      const result = controller.getDesign('STUDENTS');

      expect(service.getDesign).toHaveBeenCalledWith('STUDENTS');
      expect(result).toEqual(mockDesign);
    });

    it('propagates errors thrown by service.getDesign', () => {
      service.getDesign.mockImplementation(() => {
        throw new Error('Unknown report design');
      });

      expect(() => controller.getDesign('INVALID_TYPE')).toThrow('Unknown report design');
    });
  });

  describe('run', () => {
    it('delegates to service.run with organizationId and params', async () => {
      const params: RunReportParamsDto = {
        type: 'STUDENTS',
        page: 1,
        pageSize: 20,
      };
      const mockResult = {
        status: 'READY',
        type: 'STUDENTS',
        columns: [],
        selectedColumns: [],
        rows: [{ id: 's-1', name: 'John Doe' }],
        totalRows: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
        generatedAt: '2026-09-20T10:00:00.000Z',
      };
      service.run.mockResolvedValue(mockResult);

      const result = await controller.run(orgId, params);

      expect(service.run).toHaveBeenCalledWith(orgId, params);
      expect(result).toEqual(mockResult);
    });

    it('propagates error when service.run rejects', async () => {
      service.run.mockRejectedValue(new Error('Database query failed'));

      await expect(
        controller.run(orgId, { type: 'STUDENTS' }),
      ).rejects.toThrow('Database query failed');
    });
  });

  describe('saveDefinition', () => {
    it('delegates to service.saveDefinition with organizationId, userId, and body', async () => {
      const body: SaveReportDefinitionDto = {
        name: 'Weekly Student Report',
        type: 'STUDENTS',
        parameters: { type: 'STUDENTS' },
      };
      const mockSaved = {
        id: 'def-1',
        organizationId: orgId,
        createdBy: userId,
        name: 'Weekly Student Report',
      };
      service.saveDefinition.mockResolvedValue(mockSaved);

      const result = await controller.saveDefinition(orgId, userId, body);

      expect(service.saveDefinition).toHaveBeenCalledWith(orgId, userId, body);
      expect(result).toEqual(mockSaved);
    });

    it('propagates error when service.saveDefinition rejects', async () => {
      service.saveDefinition.mockRejectedValue(new Error('Failed to save definition'));

      await expect(
        controller.saveDefinition(orgId, userId, {
          name: 'Invalid Report',
          type: 'STUDENTS',
          parameters: { type: 'STUDENTS' },
        }),
      ).rejects.toThrow('Failed to save definition');
    });
  });

  describe('listDefinitions', () => {
    it('delegates to service.listDefinitions with organizationId', async () => {
      const mockDefinitions = [
        { id: 'def-1', name: 'Report 1' },
        { id: 'def-2', name: 'Report 2' },
      ];
      service.listDefinitions.mockResolvedValue(mockDefinitions);

      const result = await controller.listDefinitions(orgId);

      expect(service.listDefinitions).toHaveBeenCalledWith(orgId);
      expect(result).toEqual(mockDefinitions);
    });

    it('propagates error when service.listDefinitions rejects', async () => {
      service.listDefinitions.mockRejectedValue(new Error('Error listing definitions'));

      await expect(controller.listDefinitions(orgId)).rejects.toThrow(
        'Error listing definitions',
      );
    });
  });

  describe('runSaved', () => {
    it('delegates to service.runSaved with organizationId and report definition id', async () => {
      const defId = '11111111-1111-4111-8111-111111111111';
      const mockResult = {
        status: 'READY',
        type: 'PAYMENTS',
        rows: [],
        totalRows: 0,
      };
      service.runSaved.mockResolvedValue(mockResult);

      const result = await controller.runSaved(orgId, defId);

      expect(service.runSaved).toHaveBeenCalledWith(orgId, defId);
      expect(result).toEqual(mockResult);
    });

    it('propagates error when service.runSaved rejects', async () => {
      service.runSaved.mockRejectedValue(new Error('Saved report not found'));

      await expect(controller.runSaved(orgId, 'missing-id')).rejects.toThrow(
        'Saved report not found',
      );
    });
  });

  describe('deleteDefinition', () => {
    it('delegates to service.deleteDefinition with organizationId and id', async () => {
      const defId = '11111111-1111-4111-8111-111111111111';
      const mockDeleteResult = { success: true, count: 1 };
      service.deleteDefinition.mockResolvedValue(mockDeleteResult);

      const result = await controller.deleteDefinition(orgId, defId);

      expect(service.deleteDefinition).toHaveBeenCalledWith(orgId, defId);
      expect(result).toEqual(mockDeleteResult);
    });

    it('propagates error when service.deleteDefinition rejects', async () => {
      service.deleteDefinition.mockRejectedValue(new Error('Deletion failed'));

      await expect(controller.deleteDefinition(orgId, 'missing-id')).rejects.toThrow(
        'Deletion failed',
      );
    });
  });

  describe('exportReport', () => {
    it('returns 400 when format is unsupported', async () => {
      const res = createMockResponse();
      const body: ExportReportDto = {
        params: { type: 'STUDENTS' },
        format: 'xml' as any,
      };

      await controller.exportReport(orgId, body, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        statusCode: 400,
        message: 'Unsupported format: xml',
      });
      expect(service.exportResult).not.toHaveBeenCalled();
    });

    it('defaults format to csv when format is not specified', async () => {
      const res = createMockResponse();
      const body: ExportReportDto = {
        params: { type: 'STUDENTS' },
      };
      const mockExport = {
        buffer: Buffer.from('csv,content'),
        contentType: 'text/csv',
        extension: 'csv',
      };
      service.exportResult.mockResolvedValue(mockExport);

      await controller.exportReport(orgId, body, res);

      expect(service.exportResult).toHaveBeenCalledWith(orgId, body.params, 'csv');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="report_STUDENTS.csv"',
      );
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(res.send).toHaveBeenCalledWith(mockExport.buffer);
    });

    it('exports report with xlsx format', async () => {
      const res = createMockResponse();
      const body: ExportReportDto = {
        params: { type: 'TEACHERS' },
        format: 'xlsx',
      };
      const mockExport = {
        buffer: Buffer.from('xlsx-binary-data'),
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        extension: 'xlsx',
      };
      service.exportResult.mockResolvedValue(mockExport);

      await controller.exportReport(orgId, body, res);

      expect(service.exportResult).toHaveBeenCalledWith(orgId, body.params, 'xlsx');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="report_TEACHERS.xlsx"',
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(res.send).toHaveBeenCalledWith(mockExport.buffer);
    });

    it('exports report with pdf format', async () => {
      const res = createMockResponse();
      const body: ExportReportDto = {
        params: { type: 'ATTENDANCE' },
        format: 'pdf',
      };
      const mockExport = {
        buffer: Buffer.from('pdf-binary-data'),
        contentType: 'application/pdf',
        extension: 'pdf',
      };
      service.exportResult.mockResolvedValue(mockExport);

      await controller.exportReport(orgId, body, res);

      expect(service.exportResult).toHaveBeenCalledWith(orgId, body.params, 'pdf');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="report_ATTENDANCE.pdf"',
      );
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(res.send).toHaveBeenCalledWith(mockExport.buffer);
    });

    it('propagates error when service.exportResult rejects', async () => {
      const res = createMockResponse();
      const body: ExportReportDto = {
        params: { type: 'STUDENTS' },
        format: 'csv',
      };
      service.exportResult.mockRejectedValue(new Error('Export service failure'));

      await expect(controller.exportReport(orgId, body, res)).rejects.toThrow(
        'Export service failure',
      );
    });
  });

  describe('Security and Guard Metadata Verification', () => {
    it('has JwtAuthGuard and RolesGuard applied at controller class level', () => {
      const guards = Reflect.getMetadata('__guards__', ReportsController);
      expect(guards).toBeDefined();
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(RolesGuard);
    });

    const expectedRoles = [Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.MANAGER];

    it.each([
      ['listDesigns', ReportsController.prototype.listDesigns],
      ['getDesign', ReportsController.prototype.getDesign],
      ['run', ReportsController.prototype.run],
      ['saveDefinition', ReportsController.prototype.saveDefinition],
      ['listDefinitions', ReportsController.prototype.listDefinitions],
      ['runSaved', ReportsController.prototype.runSaved],
      ['deleteDefinition', ReportsController.prototype.deleteDefinition],
      ['exportReport', ReportsController.prototype.exportReport],
    ])('endpoint %s has @Roles decorator with SUPER_ADMIN, ORG_ADMIN, and MANAGER', (_name, handler) => {
      const roles = Reflect.getMetadata(ROLES_KEY, handler);
      expect(roles).toBeDefined();
      expect(roles).toEqual(expectedRoles);
      expect(roles).not.toContain(Role.STUDENT);
      expect(roles).not.toContain(Role.TEACHER);
    });
  });
});
