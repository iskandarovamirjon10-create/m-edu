import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TeachersController } from '../teachers.controller';
import { TeachersService } from '../teachers.service';
import { CreateTeacherDto, UpdateTeacherDto } from '../../common/dto';
import { TeacherQuery } from '../../common/dto/query';

describe('TeachersController', () => {
  let controller: TeachersController;
  let service: {
    findAll: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };

  const orgId = 'org-uuid-1';

  beforeEach(() => {
    service = {
      findAll: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };
    controller = new TeachersController(service as unknown as TeachersService);
  });

  it('findAll calls service.findAll', async () => {
    const query: TeacherQuery = { search: 'Nodir', page: '1', limit: '10' };
    const expected = { items: [], total: 0, page: 1, limit: 10, totalPages: 0 };
    service.findAll.mockResolvedValue(expected);

    const result = await controller.findAll(orgId, query);
    expect(result).toBe(expected);
    expect(service.findAll).toHaveBeenCalledWith(orgId, query);
  });

  it('findOne calls service.findOne', async () => {
    const expected = { id: 't1', organizationId: orgId };
    service.findOne.mockResolvedValue(expected);

    const result = await controller.findOne(orgId, 't1');
    expect(result).toBe(expected);
    expect(service.findOne).toHaveBeenCalledWith(orgId, 't1');
  });

  it('create calls service.create', async () => {
    const dto: CreateTeacherDto = { firstName: 'Nodir', lastName: 'Karimov' };
    const expected = { id: 't1', organizationId: orgId };
    service.create.mockResolvedValue(expected);

    const result = await controller.create(orgId, dto);
    expect(result).toBe(expected);
    expect(service.create).toHaveBeenCalledWith(orgId, dto);
  });

  it('update calls service.update', async () => {
    const dto: UpdateTeacherDto = { bio: 'Math' };
    const expected = { id: 't1', bio: 'Math' };
    service.update.mockResolvedValue(expected);

    const result = await controller.update(orgId, 't1', dto);
    expect(result).toBe(expected);
    expect(service.update).toHaveBeenCalledWith(orgId, 't1', dto);
  });

  it('remove calls service.remove', async () => {
    const expected = { message: 'Teacher deleted successfully' };
    service.remove.mockResolvedValue(expected);

    const result = await controller.remove(orgId, 't1');
    expect(result).toBe(expected);
    expect(service.remove).toHaveBeenCalledWith(orgId, 't1');
  });
});
