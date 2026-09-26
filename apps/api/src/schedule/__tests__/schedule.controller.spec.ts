import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ScheduleController } from '../schedule.controller';
import { ScheduleService } from '../schedule.service';
import { CreateScheduleDto, UpdateScheduleDto } from '../../common/dto';
import { DayOfWeek } from '@prisma/client';

describe('ScheduleController', () => {
  let controller: ScheduleController;
  let service: {
    findAll: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };

  const orgId = 'org-1';

  beforeEach(async () => {
    service = {
      findAll: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ScheduleController],
      providers: [
        {
          provide: ScheduleService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<ScheduleController>(ScheduleController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('delegates to scheduleService.findAll', async () => {
      service.findAll.mockResolvedValue({ items: [], total: 0 });
      const user = { id: 'u-1', role: 'ORG_ADMIN', organizationId: 'org-1' };
      const result = await controller.findAll(orgId, { page: 1, limit: 10 }, user);
      expect(result).toEqual({ items: [], total: 0 });
      expect(service.findAll).toHaveBeenCalledWith(orgId, { page: 1, limit: 10 }, user);
    });
  });

  describe('findOne', () => {
    it('delegates to scheduleService.findOne', async () => {
      const mockSchedule = { id: 'sch-1', dayOfWeek: 'MONDAY' };
      service.findOne.mockResolvedValue(mockSchedule);
      const user = { id: 'u-1', role: 'ORG_ADMIN', organizationId: 'org-1' };
      const result = await controller.findOne(orgId, 'sch-1', user);
      expect(result).toEqual(mockSchedule);
      expect(service.findOne).toHaveBeenCalledWith(orgId, 'sch-1', user);
    });
  });

  describe('create', () => {
    it('delegates to scheduleService.create', async () => {
      const dto: CreateScheduleDto = {
        groupId: 'g-1',
        dayOfWeek: DayOfWeek.MONDAY,
        startTime: '09:00',
        endTime: '10:30',
      };
      const created = { id: 'sch-1', ...dto };
      service.create.mockResolvedValue(created);
      const result = await controller.create(orgId, dto);
      expect(result).toEqual(created);
      expect(service.create).toHaveBeenCalledWith(orgId, dto);
    });
  });

  describe('update', () => {
    it('delegates to scheduleService.update', async () => {
      const dto: UpdateScheduleDto = { startTime: '10:00' };
      const updated = { id: 'sch-1', startTime: '10:00' };
      service.update.mockResolvedValue(updated);
      const result = await controller.update(orgId, 'sch-1', dto);
      expect(result).toEqual(updated);
      expect(service.update).toHaveBeenCalledWith(orgId, 'sch-1', dto);
    });
  });

  describe('remove', () => {
    it('delegates to scheduleService.remove', async () => {
      service.remove.mockResolvedValue({ id: 'sch-1', isActive: false });
      const result = await controller.remove(orgId, 'sch-1');
      expect(result).toEqual({ id: 'sch-1', isActive: false });
      expect(service.remove).toHaveBeenCalledWith(orgId, 'sch-1');
    });
  });
});
