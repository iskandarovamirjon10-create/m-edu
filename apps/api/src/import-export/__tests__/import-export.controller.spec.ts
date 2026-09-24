import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImportExportController } from '../import-export.controller';
import { ImportExportService } from '../import-export.service';
import { Response } from 'express';

describe('ImportExportController', () => {
  let controller: ImportExportController;
  let service: ImportExportService;

  beforeEach(() => {
    service = {
      listImports: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      startImport: vi.fn().mockResolvedValue({ id: 'imp-1', status: 'PENDING', organizationId: 'org-1' }),
      listExports: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      downloadTemplate: vi.fn().mockResolvedValue(Buffer.from('col1,col2')),
      exportData: vi.fn().mockResolvedValue(Buffer.from('data1,data2')),
    } as unknown as ImportExportService;

    controller = new ImportExportController(service);
  });

  it('should list imports', async () => {
    const result = await controller.listImports('org-1', { page: 1, limit: 10 });
    expect(result).toEqual({ items: [], total: 0 });
    expect(service.listImports).toHaveBeenCalledWith('org-1', { page: 1, limit: 10 });
  });

  it('should start an import job', async () => {
    const result = await controller.startImport('org-1', { entityType: 'STUDENT', mode: 'CREATE' });
    expect(result).toEqual({ id: 'imp-1', status: 'PENDING', organizationId: 'org-1' });
    expect(service.startImport).toHaveBeenCalledWith('org-1', { entityType: 'STUDENT', mode: 'CREATE' }, undefined);
  });

  it('should list exports', async () => {
    const result = await controller.listExports('org-1', { page: 1, limit: 10 });
    expect(result).toEqual({ items: [], total: 0 });
    expect(service.listExports).toHaveBeenCalledWith('org-1', { page: 1, limit: 10 });
  });

  it('should download template', async () => {
    const res = {
      setHeader: vi.fn(),
      send: vi.fn(),
    } as unknown as Response;

    await controller.downloadTemplate('org-1', 'STUDENT', res);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="student_template.csv"');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
    expect(res.send).toHaveBeenCalled();
  });

  it('should export data', async () => {
    const res = {
      setHeader: vi.fn(),
      send: vi.fn(),
    } as unknown as Response;

    await controller.exportData('org-1', 'STUDENT', 'csv', res);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="student_export.csv"');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
    expect(res.send).toHaveBeenCalled();
  });
});
