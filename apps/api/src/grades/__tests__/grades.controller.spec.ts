import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GradesController } from '../grades.controller';
import { GradesService } from '../grades.service';

describe('GradesController', () => {
  let controller: GradesController;
  let service: {
    findAll: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = {
      findAll: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };
    controller = new GradesController(service as unknown as GradesService);
  });

  it('findAll delegates to gradesService.findAll', async () => {
    const mockRes = { items: [], total: 0, page: 1, limit: 10, totalPages: 0 };
    service.findAll.mockResolvedValue(mockRes);

    const result = await controller.findAll('org-1', { page: 1, limit: 10 });

    expect(service.findAll).toHaveBeenCalledWith('org-1', { page: 1, limit: 10 });
    expect(result).toBe(mockRes);
  });

  it('findOne delegates to gradesService.findOne', async () => {
    const mockGrade = { id: 'g-1', value: 90 };
    service.findOne.mockResolvedValue(mockGrade);

    const result = await controller.findOne('org-1', 'g-1');

    expect(service.findOne).toHaveBeenCalledWith('org-1', 'g-1');
    expect(result).toBe(mockGrade);
  });

  it('create delegates to gradesService.create', async () => {
    const dto = { studentId: 's-1', groupId: 'grp-1', value: 95 };
    const mockGrade = { id: 'g-1', ...dto };
    service.create.mockResolvedValue(mockGrade);

    const result = await controller.create('org-1', dto);

    expect(service.create).toHaveBeenCalledWith('org-1', dto);
    expect(result).toBe(mockGrade);
  });

  it('update delegates to gradesService.update', async () => {
    const dto = { value: 98 };
    const mockGrade = { id: 'g-1', value: 98 };
    service.update.mockResolvedValue(mockGrade);

    const result = await controller.update('org-1', 'g-1', dto);

    expect(service.update).toHaveBeenCalledWith('org-1', 'g-1', dto);
    expect(result).toBe(mockGrade);
  });

  it('remove delegates to gradesService.remove', async () => {
    const mockGrade = { id: 'g-1' };
    service.remove.mockResolvedValue(mockGrade);

    const result = await controller.remove('org-1', 'g-1');

    expect(service.remove).toHaveBeenCalledWith('org-1', 'g-1');
    expect(result).toBe(mockGrade);
  });
});
