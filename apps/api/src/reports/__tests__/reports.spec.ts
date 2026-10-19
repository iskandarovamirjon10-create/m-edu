import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReportBuilderService } from '../report-builder.service';
import { ReportsController } from '../reports.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { FinancialBrainService } from '../../analytics/financial-brain.service';
import { Response } from 'express';

function createMockPrisma() {
  return {
    student: { findMany: vi.fn(), count: vi.fn() },
    teacher: { findMany: vi.fn(), count: vi.fn() },
    group: { findMany: vi.fn(), count: vi.fn() },
    attendance: { findMany: vi.fn(), count: vi.fn() },
    payment: { findMany: vi.fn(), count: vi.fn() },
    report: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
    },
  };
}

describe('ReportsModule Unit Tests', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let financialBrain: { getFinancialOverview: ReturnType<typeof vi.fn> };
  let service: ReportBuilderService;
  let controller: ReportsController;

  const orgId = 'org-1';
  const userId = 'user-1';

  beforeEach(async () => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    financialBrain = {
      getFinancialOverview: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        ReportBuilderService,
        { provide: PrismaService, useValue: prisma },
        { provide: FinancialBrainService, useValue: financialBrain },
      ],
    }).compile();

    service = new ReportBuilderService(prisma as unknown as PrismaService, financialBrain as unknown as FinancialBrainService);
    controller = new ReportsController(service);
  });

  describe('ReportBuilderService', () => {
    it('lists available report designs with columns', () => {
      const designs = service.listDesigns();
      expect(Array.isArray(designs)).toBe(true);
      expect(designs.length).toBeGreaterThan(0);
      expect(designs.some((d) => d.type === 'STUDENTS')).toBe(true);
    });

    it('gets a specific design', () => {
      const design = service.getDesign('STUDENTS');
      expect(design.type).toBe('STUDENTS');
      expect(design.columns.length).toBeGreaterThan(0);
    });

    it('throws BadRequestException on unknown design type', () => {
      expect(() => service.getDesign('UNKNOWN_TYPE')).toThrow(BadRequestException);
    });

    it('runs students report with valid data', async () => {
      prisma.student.findMany.mockResolvedValue([
        {
          id: 's-1',
          isActive: true,
          createdAt: new Date('2026-01-01'),
          user: { firstName: 'Ali', lastName: 'Valiyev', email: 'ali@test.uz', phone: '+998' },
        },
      ]);

      const result = await service.run(orgId, { type: 'STUDENTS', page: 1, pageSize: 20 });
      expect(result.type).toBe('STUDENTS');
      expect(result.totalRows).toBe(1);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe('Ali Valiyev');
      expect(result.rows[0].email).toBe('ali@test.uz');
    });

    it('saves a report definition with tenant isolation', async () => {
      const mockSaved = { id: 'def-1', name: 'My Report' };
      prisma.report.create.mockResolvedValue(mockSaved);

      const result = await service.saveDefinition(orgId, userId, {
        name: 'My Report',
        type: 'STUDENTS',
        parameters: { type: 'STUDENTS' },
      });
      expect(result).toEqual(mockSaved);
      expect(prisma.report.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: orgId,
            createdBy: userId,
            name: 'My Report',
          }),
        }),
      );
    });

    it('throws NotFoundException when running nonexistent saved report', async () => {
      prisma.report.findFirst.mockResolvedValue(null);
      await expect(service.runSaved(orgId, 'def-missing')).rejects.toThrow(NotFoundException);
    });

    it('CSV export neutralizes formula injection (CWE-1236)', async () => {
      prisma.student.findMany.mockResolvedValue([
        {
          id: 's-1',
          isActive: true,
          createdAt: new Date('2026-01-01'),
          user: {
            firstName: '=cmd|calc',
            lastName: 'Doe',
            email: '+HYPERLINK("http://evil","x")',
            phone: '@SUM(A1)',
          },
        },
      ]);
      prisma.student.count.mockResolvedValue(1);

      const out = await service.exportResult(
        orgId,
        {
          type: 'STUDENTS',
          page: 1,
          pageSize: 200,
        } as never,
        'csv',
      );

      const csv = out.buffer.toString('utf-8');
      // Dangerous leading characters must be prefixed with a single quote.
      expect(csv).toContain("'=cmd|calc");
      expect(csv).toContain("'+HYPERLINK");
      expect(csv).toContain("'@SUM(A1)");
      // And must not appear as a raw formula cell (quote-only is the guard).
      expect(csv).not.toMatch(/(^|,)=/);
      expect(csv).not.toMatch(/(^|,)\+/);
      expect(csv).not.toMatch(/(^|,)@/);
    });
  });

  describe('ReportsController', () => {
    it('delegates listDesigns', () => {
      const result = controller.listDesigns();
      expect(result.length).toBeGreaterThan(0);
    });

    it('delegates run', async () => {
      const mockResult = {
        status: 'READY',
        type: 'STUDENTS',
        columns: [],
        selectedColumns: [],
        rows: [],
        totalRows: 0,
        page: 1,
        pageSize: 20,
        totalPages: 1,
        generatedAt: new Date().toISOString(),
      };
      vi.spyOn(service, 'run').mockResolvedValue(mockResult as never);

      const result = await controller.run(orgId, { type: 'STUDENTS' });
      expect(result).toEqual(mockResult);
      expect(service.run).toHaveBeenCalledWith(orgId, { type: 'STUDENTS' });
    });

    it('exports report with csv formatting', async () => {
      const mockExport = { buffer: Buffer.from('test'), contentType: 'text/csv', extension: 'csv' };
      vi.spyOn(service, 'exportResult').mockResolvedValue(mockExport);

      const res = {
        setHeader: vi.fn(),
        send: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await controller.exportReport(orgId, { params: { type: 'STUDENTS' }, format: 'csv' }, res);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(res.send).toHaveBeenCalledWith(mockExport.buffer);
    });
  });
});
