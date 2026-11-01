import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GroupsController } from '../groups.controller';
import { GroupsService } from '../groups.service';

describe('GroupsController', () => {
  let controller: GroupsController;
  let service: {
    findAll: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    getStats: ReturnType<typeof vi.fn>;
    bulkStatus: ReturnType<typeof vi.fn>;
    bulkTeacher: ReturnType<typeof vi.fn>;
    bulkRoom: ReturnType<typeof vi.fn>;
    getGroupCapacityAndOccupancy: ReturnType<typeof vi.fn>;
    graduateAndPromote: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = {
      findAll: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      getStats: vi.fn(),
      bulkStatus: vi.fn(),
      bulkTeacher: vi.fn(),
      bulkRoom: vi.fn(),
      getGroupCapacityAndOccupancy: vi.fn(),
      graduateAndPromote: vi.fn(),
    };
    controller = new GroupsController(service as unknown as GroupsService);
  });

  it('findAll delegates to groupsService.findAll', async () => {
    const mockRes = { items: [], total: 0, page: 1, limit: 10, totalPages: 0 };
    service.findAll.mockResolvedValue(mockRes);

    const result = await controller.findAll('org-1', { page: 1, limit: 10 });

    expect(service.findAll).toHaveBeenCalledWith('org-1', { page: 1, limit: 10 });
    expect(result).toBe(mockRes);
  });

  it('getStats delegates to groupsService.getStats', async () => {
    const mockStats = { totalGroups: 5, activeGroups: 4, averageOccupancyPercent: 85 };
    service.getStats.mockResolvedValue(mockStats);

    const result = await controller.getStats('org-1');

    expect(service.getStats).toHaveBeenCalledWith('org-1');
    expect(result).toBe(mockStats);
  });

  it('bulkStatus delegates to groupsService.bulkStatus', async () => {
    const dto = { groupIds: ['g1', 'g2'], isActive: true };
    const mockRes = { success: true, count: 2 };
    service.bulkStatus.mockResolvedValue(mockRes);

    const result = await controller.bulkStatus('org-1', dto);

    expect(service.bulkStatus).toHaveBeenCalledWith('org-1', dto);
    expect(result).toBe(mockRes);
  });

  it('bulkTeacher delegates to groupsService.bulkTeacher', async () => {
    const dto = { groupIds: ['g1', 'g2'], teacherId: 't-1' };
    const mockRes = { success: true, count: 2 };
    service.bulkTeacher.mockResolvedValue(mockRes);

    const result = await controller.bulkTeacher('org-1', dto);

    expect(service.bulkTeacher).toHaveBeenCalledWith('org-1', dto);
    expect(result).toBe(mockRes);
  });

  it('bulkRoom delegates to groupsService.bulkRoom', async () => {
    const dto = { groupIds: ['g1', 'g2'], room: 'Room 303' };
    const mockRes = { success: true, count: 2 };
    service.bulkRoom.mockResolvedValue(mockRes);

    const result = await controller.bulkRoom('org-1', dto);

    expect(service.bulkRoom).toHaveBeenCalledWith('org-1', dto);
    expect(result).toBe(mockRes);
  });

  it('findOne delegates to groupsService.findOne', async () => {
    const mockGroup = { id: 'grp-1', name: 'Group 1' };
    service.findOne.mockResolvedValue(mockGroup);

    const result = await controller.findOne('org-1', 'grp-1');

    expect(service.findOne).toHaveBeenCalledWith('org-1', 'grp-1');
    expect(result).toBe(mockGroup);
  });

  it('create delegates to groupsService.create', async () => {
    const dto = { name: 'Group A', courseId: 'course-1' };
    const mockGroup = { id: 'grp-1', ...dto };
    service.create.mockResolvedValue(mockGroup);

    const result = await controller.create('org-1', dto);

    expect(service.create).toHaveBeenCalledWith('org-1', dto);
    expect(result).toBe(mockGroup);
  });

  it('update delegates to groupsService.update', async () => {
    const dto = { name: 'Group A+' };
    const mockGroup = { id: 'grp-1', name: 'Group A+' };
    service.update.mockResolvedValue(mockGroup);

    const result = await controller.update('org-1', 'grp-1', dto);

    expect(service.update).toHaveBeenCalledWith('org-1', 'grp-1', dto);
    expect(result).toBe(mockGroup);
  });

  it('remove delegates to groupsService.remove', async () => {
    const mockGroup = { id: 'grp-1', isActive: false };
    service.remove.mockResolvedValue(mockGroup);

    const result = await controller.remove('org-1', 'grp-1');

    expect(service.remove).toHaveBeenCalledWith('org-1', 'grp-1');
    expect(result).toBe(mockGroup);
  });
});
