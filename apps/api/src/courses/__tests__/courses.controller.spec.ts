import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CoursesController } from '../courses.controller';
import { CoursesService } from '../courses.service';
import { CreateCourseDto, UpdateCourseDto } from '../../common/dto';
import { CourseQuery } from '../../common/dto/query';

describe('CoursesController', () => {
  let controller: CoursesController;
  let service: {
    findAll: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };

  const orgId = '11111111-1111-4111-8111-111111111111';
  const courseId = '22222222-2222-4222-8222-222222222222';

  beforeEach(() => {
    service = {
      findAll: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };
    controller = new CoursesController(service as unknown as CoursesService);
  });

  it('delegates findAll to CoursesService', async () => {
    const query: CourseQuery = { search: 'math' };
    service.findAll.mockResolvedValue({ items: [], total: 0 });

    const result = await controller.findAll(orgId, query);

    expect(service.findAll).toHaveBeenCalledWith(orgId, query);
    expect(result).toEqual({ items: [], total: 0 });
  });

  it('delegates findOne to CoursesService', async () => {
    service.findOne.mockResolvedValue({ id: courseId });

    const result = await controller.findOne(orgId, courseId);

    expect(service.findOne).toHaveBeenCalledWith(orgId, courseId);
    expect(result).toEqual({ id: courseId });
  });

  it('delegates create to CoursesService', async () => {
    const dto: CreateCourseDto = {
      name: 'Physics',
      price: 200,
      duration: 10,
    };
    service.create.mockResolvedValue({ id: courseId, ...dto });

    const result = await controller.create(orgId, dto);

    expect(service.create).toHaveBeenCalledWith(orgId, dto);
    expect(result).toEqual({ id: courseId, ...dto });
  });

  it('delegates update to CoursesService', async () => {
    const dto: UpdateCourseDto = { price: 250 };
    service.update.mockResolvedValue({ id: courseId, price: 250 });

    const result = await controller.update(orgId, courseId, dto);

    expect(service.update).toHaveBeenCalledWith(orgId, courseId, dto);
    expect(result).toEqual({ id: courseId, price: 250 });
  });

  it('delegates remove to CoursesService', async () => {
    service.remove.mockResolvedValue({ id: courseId, isActive: false });

    const result = await controller.remove(orgId, courseId);

    expect(service.remove).toHaveBeenCalledWith(orgId, courseId);
    expect(result).toEqual({ id: courseId, isActive: false });
  });
});
