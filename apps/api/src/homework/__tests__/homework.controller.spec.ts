import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HomeworkController } from '../homework.controller';
import { HomeworkService } from '../homework.service';

describe('HomeworkController', () => {
  let controller: HomeworkController;
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
    controller = new HomeworkController(service as unknown as HomeworkService);
  });

  it('findAll delegates to homeworkService.findAll', async () => {
    const mockRes = { items: [], total: 0, page: 1, limit: 10, totalPages: 0 };
    service.findAll.mockResolvedValue(mockRes);

    const result = await controller.findAll('org-1', { page: 1, limit: 10 });

    expect(service.findAll).toHaveBeenCalledWith('org-1', { page: 1, limit: 10 });
    expect(result).toBe(mockRes);
  });

  it('findOne delegates to homeworkService.findOne', async () => {
    const mockHw = { id: 'hw-1', title: 'Homework 1' };
    service.findOne.mockResolvedValue(mockHw);

    const result = await controller.findOne('org-1', 'hw-1');

    expect(service.findOne).toHaveBeenCalledWith('org-1', 'hw-1');
    expect(result).toBe(mockHw);
  });

  it('create delegates to homeworkService.create', async () => {
    const dto = { groupId: 'grp-1', title: 'HW 1' };
    const mockHw = { id: 'hw-1', ...dto };
    service.create.mockResolvedValue(mockHw);

    const result = await controller.create('org-1', dto);

    expect(service.create).toHaveBeenCalledWith('org-1', dto);
    expect(result).toBe(mockHw);
  });

  it('update delegates to homeworkService.update', async () => {
    const dto = { title: 'Updated HW' };
    const mockHw = { id: 'hw-1', title: 'Updated HW' };
    service.update.mockResolvedValue(mockHw);

    const result = await controller.update('org-1', 'hw-1', dto);

    expect(service.update).toHaveBeenCalledWith('org-1', 'hw-1', dto);
    expect(result).toBe(mockHw);
  });

  it('remove delegates to homeworkService.remove', async () => {
    const mockHw = { id: 'hw-1' };
    service.remove.mockResolvedValue(mockHw);

    const result = await controller.remove('org-1', 'hw-1');

    expect(service.remove).toHaveBeenCalledWith('org-1', 'hw-1');
    expect(result).toBe(mockHw);
  });
});
