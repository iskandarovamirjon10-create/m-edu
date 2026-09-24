import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { ResourcesController } from '../resources.controller';
import { ResourcesService } from '../resources.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import {
  CreateResourceDto,
  ResourceQueryDto,
  UpdateResourceDto,
} from '../dto/resource.dto';

describe('ResourcesController', () => {
  let controller: ResourcesController;
  let service: {
    findAll: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };

  const orgId = '11111111-1111-4111-8111-111111111111';
  const resourceId = '22222222-2222-4222-8222-222222222222';

  beforeEach(async () => {
    service = {
      findAll: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ResourcesController],
      providers: [
        {
          provide: ResourcesService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<ResourcesController>(ResourcesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('delegates to resourcesService.findAll with orgId and query', async () => {
      const query: ResourceQueryDto = {
        type: 'ROOM',
        isActive: 'true',
        skip: 0,
        take: 10,
      };
      const expected = {
        items: [
          {
            id: resourceId,
            organizationId: orgId,
            name: 'Conference Room A',
            type: 'ROOM',
            capacity: 20,
            location: 'Building 1, Floor 2',
            description: 'Main conference room',
            isActive: true,
            availability: null,
          },
        ],
        total: 1,
      };
      service.findAll.mockResolvedValue(expected);

      const result = await controller.findAll(orgId, query);

      expect(service.findAll).toHaveBeenCalledWith(orgId, query);
      expect(result).toEqual(expected);
    });

    it('propagates service errors when findAll fails', async () => {
      service.findAll.mockRejectedValue(new Error('Database query failed'));

      await expect(controller.findAll(orgId, {})).rejects.toThrow(
        'Database query failed',
      );
      expect(service.findAll).toHaveBeenCalledWith(orgId, {});
    });
  });

  describe('findOne', () => {
    it('delegates to resourcesService.findOne with orgId and resource id', async () => {
      const expected = {
        id: resourceId,
        organizationId: orgId,
        name: 'Projector 1',
        type: 'EQUIPMENT',
        capacity: 1,
        location: 'Storage B',
        description: 'HD Projector',
        isActive: true,
        availability: null,
      };
      service.findOne.mockResolvedValue(expected);

      const result = await controller.findOne(orgId, resourceId);

      expect(service.findOne).toHaveBeenCalledWith(orgId, resourceId);
      expect(result).toEqual(expected);
    });

    it('propagates service errors when findOne fails', async () => {
      service.findOne.mockRejectedValue(new Error('Resource not found'));

      await expect(controller.findOne(orgId, resourceId)).rejects.toThrow(
        'Resource not found',
      );
      expect(service.findOne).toHaveBeenCalledWith(orgId, resourceId);
    });
  });

  describe('create', () => {
    it('delegates to resourcesService.create with orgId and dto', async () => {
      const dto: CreateResourceDto = {
        name: 'Chemistry Lab',
        type: 'LAB',
        capacity: 30,
        location: 'Science Wing, Room 101',
        description: 'Chemistry laboratory with fume hoods',
        isActive: true,
      };
      const expected = {
        id: resourceId,
        organizationId: orgId,
        ...dto,
      };
      service.create.mockResolvedValue(expected);

      const result = await controller.create(orgId, dto);

      expect(service.create).toHaveBeenCalledWith(orgId, dto);
      expect(result).toEqual(expected);
    });

    it('propagates service errors when create fails', async () => {
      const dto: CreateResourceDto = { name: 'Invalid Lab' };
      service.create.mockRejectedValue(new Error('Duplicate resource name'));

      await expect(controller.create(orgId, dto)).rejects.toThrow(
        'Duplicate resource name',
      );
      expect(service.create).toHaveBeenCalledWith(orgId, dto);
    });
  });

  describe('update', () => {
    it('delegates to resourcesService.update with orgId, id, and dto', async () => {
      const dto: UpdateResourceDto = {
        name: 'Updated Chemistry Lab',
        capacity: 35,
      };
      const expected = { count: 1 };
      service.update.mockResolvedValue(expected);

      const result = await controller.update(orgId, resourceId, dto);

      expect(service.update).toHaveBeenCalledWith(orgId, resourceId, dto);
      expect(result).toEqual(expected);
    });

    it('propagates service errors when update fails', async () => {
      const dto: UpdateResourceDto = { name: 'Fail Update' };
      service.update.mockRejectedValue(new Error('Update failed'));

      await expect(controller.update(orgId, resourceId, dto)).rejects.toThrow(
        'Update failed',
      );
      expect(service.update).toHaveBeenCalledWith(orgId, resourceId, dto);
    });
  });

  describe('remove', () => {
    it('delegates to resourcesService.remove with orgId and id', async () => {
      const expected = { count: 1 };
      service.remove.mockResolvedValue(expected);

      const result = await controller.remove(orgId, resourceId);

      expect(service.remove).toHaveBeenCalledWith(orgId, resourceId);
      expect(result).toEqual(expected);
    });

    it('propagates service errors when remove fails', async () => {
      service.remove.mockRejectedValue(new Error('Deletion failed'));

      await expect(controller.remove(orgId, resourceId)).rejects.toThrow(
        'Deletion failed',
      );
      expect(service.remove).toHaveBeenCalledWith(orgId, resourceId);
    });
  });

  describe('Guard and decorator verification (structural)', () => {
    it('has UseGuards decorator applied at the class level with JwtAuthGuard and RolesGuard', () => {
      const guards = Reflect.getMetadata('__guards__', ResourcesController);
      expect(guards).toBeDefined();
      expect(guards).toEqual([JwtAuthGuard, RolesGuard]);
    });

    it('has Roles decorator restricting access to SUPER_ADMIN, ORG_ADMIN, and MANAGER', () => {
      const roles = Reflect.getMetadata('roles', ResourcesController);
      expect(roles).toBeDefined();
      expect(roles).toContain(Role.SUPER_ADMIN);
      expect(roles).toContain(Role.ORG_ADMIN);
      expect(roles).toContain(Role.MANAGER);
      expect(roles).not.toContain(Role.TEACHER);
      expect(roles).not.toContain(Role.STUDENT);
    });
  });
});
