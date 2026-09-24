import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StudentsController } from '../students.controller';
import { StudentsService } from '../students.service';
import { CreateStudentDto, UpdateStudentDto } from '../../common/dto';
import { StudentQuery } from '../../common/dto/query';

describe('StudentsController', () => {
  let controller: StudentsController;
  let service: {
    findAll: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    assignToGroup: ReturnType<typeof vi.fn>;
    removeFromGroup: ReturnType<typeof vi.fn>;
  };

  const orgId = 'org-uuid-1';

  beforeEach(() => {
    service = {
      findAll: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      assignToGroup: vi.fn(),
      removeFromGroup: vi.fn(),
    };
    controller = new StudentsController(service as unknown as StudentsService);
  });

  it('delegates findAll to service', async () => {
    const query: StudentQuery = { search: 'John', page: '1', limit: '10' };
    const expected = { items: [], total: 0, page: 1, limit: 10, totalPages: 0 };
    service.findAll.mockResolvedValue(expected);

    const result = await controller.findAll(orgId, query);
    expect(result).toBe(expected);
    expect(service.findAll).toHaveBeenCalledWith(orgId, query);
  });

  it('delegates findOne to service', async () => {
    const expected = { id: 's1', organizationId: orgId };
    service.findOne.mockResolvedValue(expected);

    const result = await controller.findOne(orgId, 's1');
    expect(result).toBe(expected);
    expect(service.findOne).toHaveBeenCalledWith(orgId, 's1');
  });

  it('delegates create to service', async () => {
    const dto: CreateStudentDto = { firstName: 'Ali', lastName: 'Valiyev' };
    const expected = { id: 's1', organizationId: orgId };
    service.create.mockResolvedValue(expected);

    const result = await controller.create(orgId, dto);
    expect(result).toBe(expected);
    expect(service.create).toHaveBeenCalledWith(orgId, dto);
  });

  it('delegates update to service', async () => {
    const dto: UpdateStudentDto = { address: 'Tashkent' };
    const expected = { id: 's1', address: 'Tashkent' };
    service.update.mockResolvedValue(expected);

    const result = await controller.update(orgId, 's1', dto);
    expect(result).toBe(expected);
    expect(service.update).toHaveBeenCalledWith(orgId, 's1', dto);
  });

  it('delegates remove to service', async () => {
    const expected = { message: 'Student deleted successfully' };
    service.remove.mockResolvedValue(expected);

    const result = await controller.remove(orgId, 's1');
    expect(result).toBe(expected);
    expect(service.remove).toHaveBeenCalledWith(orgId, 's1');
  });

  it('delegates assignToGroup to service', async () => {
    const expected = { id: 'm1' };
    service.assignToGroup.mockResolvedValue(expected);

    const result = await controller.assignToGroup(orgId, 's1', 'g1');
    expect(result).toBe(expected);
    expect(service.assignToGroup).toHaveBeenCalledWith(orgId, 's1', 'g1');
  });

  it('delegates removeFromGroup to service', async () => {
    const expected = { id: 'm1', isActive: false };
    service.removeFromGroup.mockResolvedValue(expected);

    const result = await controller.removeFromGroup(orgId, 's1', 'g1');
    expect(result).toBe(expected);
    expect(service.removeFromGroup).toHaveBeenCalledWith(orgId, 's1', 'g1');
  });
});
