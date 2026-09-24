import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ResourcesService } from '../resources.service';
import { ResourcesController } from '../resources.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateResourceDto, UpdateResourceDto, ResourceQueryDto } from '../dto/resource.dto';

function createMockPrisma() {
  return {
    resource: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
  };
}

describe('ResourcesModule Unit Tests', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: ResourcesService;
  let controller: ResourcesController;

  const orgId = 'org-1';

  beforeEach(async () => {
    vi.clearAllMocks();
    prisma = createMockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ResourcesController],
      providers: [
        ResourcesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ResourcesService>(ResourcesService);
    controller = module.get<ResourcesController>(ResourcesController);
  });

  describe('ResourcesService', () => {
    it('findAll returns resources with pagination', async () => {
      const mockResources = [{ id: 'res-1', name: 'Room 101', type: 'ROOM' }];
      prisma.resource.findMany.mockResolvedValue(mockResources);
      prisma.resource.count.mockResolvedValue(1);

      const query: ResourceQueryDto = { isActive: 'true', type: 'ROOM', skip: 0, take: 10 };
      const result = await service.findAll(orgId, query);

      expect(result).toEqual({ items: mockResources, total: 1 });
      expect(prisma.resource.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: orgId, isActive: true, type: 'ROOM' },
          skip: 0,
          take: 10,
        }),
      );
    });

    it('findOne returns a single resource scoped to org', async () => {
      const mockRes = { id: 'res-1', name: 'Room 101' };
      prisma.resource.findFirst.mockResolvedValue(mockRes);

      const result = await service.findOne(orgId, 'res-1');
      expect(result).toEqual(mockRes);
      expect(prisma.resource.findFirst).toHaveBeenCalledWith({
        where: { organizationId: orgId, id: 'res-1' },
      });
    });

    it('create inserts resource with orgId and defaults', async () => {
      const dto: CreateResourceDto = { name: 'Lab 1', capacity: 30 };
      const created = { id: 'res-new', ...dto, type: 'ROOM', isActive: true };
      prisma.resource.create.mockResolvedValue(created);

      const result = await service.create(orgId, dto);
      expect(result).toEqual(created);
      expect(prisma.resource.create).toHaveBeenCalledWith({
        data: {
          organizationId: orgId,
          name: 'Lab 1',
          type: 'ROOM',
          capacity: 30,
          location: undefined,
          description: undefined,
          isActive: true,
          availability: undefined,
        },
      });
    });

    it('update updates resource matching orgId and id', async () => {
      prisma.resource.updateMany.mockResolvedValue({ count: 1 });
      const dto: UpdateResourceDto = { name: 'Lab 1 Updated', capacity: 35 };

      const result = await service.update(orgId, 'res-1', dto);
      expect(result).toEqual({ count: 1 });
      expect(prisma.resource.updateMany).toHaveBeenCalledWith({
        where: { organizationId: orgId, id: 'res-1' },
        data: { name: 'Lab 1 Updated', capacity: 35 },
      });
    });

    it('remove soft-deletes by setting isActive to false', async () => {
      prisma.resource.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.remove(orgId, 'res-1');
      expect(result).toEqual({ count: 1 });
      expect(prisma.resource.updateMany).toHaveBeenCalledWith({
        where: { organizationId: orgId, id: 'res-1' },
        data: { isActive: false },
      });
    });
  });

  describe('ResourcesController', () => {
    it('delegates findAll', async () => {
      vi.spyOn(service, 'findAll').mockResolvedValue({ items: [], total: 0 });
      const result = await controller.findAll(orgId, {});
      expect(result).toEqual({ items: [], total: 0 });
      expect(service.findAll).toHaveBeenCalledWith(orgId, {});
    });

    it('delegates findOne', async () => {
      const mockRes = { id: 'res-1', name: 'Room' };
      vi.spyOn(service, 'findOne').mockResolvedValue(mockRes as never);
      const result = await controller.findOne(orgId, 'res-1');
      expect(result).toEqual(mockRes);
      expect(service.findOne).toHaveBeenCalledWith(orgId, 'res-1');
    });

    it('delegates create', async () => {
      const dto: CreateResourceDto = { name: 'Room' };
      vi.spyOn(service, 'create').mockResolvedValue({ id: 'res-1' } as never);
      const result = await controller.create(orgId, dto);
      expect(result).toEqual({ id: 'res-1' });
      expect(service.create).toHaveBeenCalledWith(orgId, dto);
    });

    it('delegates update', async () => {
      const dto: UpdateResourceDto = { name: 'Room 2' };
      vi.spyOn(service, 'update').mockResolvedValue({ count: 1 } as never);
      const result = await controller.update(orgId, 'res-1', dto);
      expect(result).toEqual({ count: 1 });
      expect(service.update).toHaveBeenCalledWith(orgId, 'res-1', dto);
    });

    it('delegates remove', async () => {
      vi.spyOn(service, 'remove').mockResolvedValue({ count: 1 } as never);
      const result = await controller.remove(orgId, 'res-1');
      expect(result).toEqual({ count: 1 });
      expect(service.remove).toHaveBeenCalledWith(orgId, 'res-1');
    });
  });
});
