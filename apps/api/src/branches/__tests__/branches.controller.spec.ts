import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BranchesController } from '../branches.controller';
import { BranchesService } from '../branches.service';
import { AssignManagerDto, CreateBranchDto, UpdateBranchDto } from '../dto/branch.dto';

describe('BranchesController', () => {
  let controller: BranchesController;
  let service: BranchesService;

  const mockService = {
    findAll: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deactivate: vi.fn(),
    activate: vi.fn(),
    assignManager: vi.fn(),
    getBranchStats: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BranchesController],
      providers: [
        {
          provide: BranchesService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<BranchesController>(BranchesController);
    service = module.get<BranchesService>(BranchesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should call service.findAll with orgId', async () => {
      mockService.findAll.mockResolvedValue([]);
      const result = await controller.findAll('org-1');
      expect(mockService.findAll).toHaveBeenCalledWith('org-1');
      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should call service.findOne with orgId and id', async () => {
      const branch = { id: 'b1', name: 'Main' };
      mockService.findOne.mockResolvedValue(branch);
      const result = await controller.findOne('org-1', 'b1');
      expect(mockService.findOne).toHaveBeenCalledWith('org-1', 'b1');
      expect(result).toBe(branch);
    });
  });

  describe('create', () => {
    it('should call service.create with orgId and dto', async () => {
      const dto: CreateBranchDto = { name: 'New Branch', code: 'NB' };
      const created = { id: 'b1', ...dto };
      mockService.create.mockResolvedValue(created);
      const result = await controller.create('org-1', dto);
      expect(mockService.create).toHaveBeenCalledWith('org-1', dto);
      expect(result).toBe(created);
    });
  });

  describe('update', () => {
    it('should call service.update with orgId, id, and dto', async () => {
      const dto: UpdateBranchDto = { name: 'Renamed' };
      const updated = { id: 'b1', ...dto };
      mockService.update.mockResolvedValue(updated);
      const result = await controller.update('org-1', 'b1', dto);
      expect(mockService.update).toHaveBeenCalledWith('org-1', 'b1', dto);
      expect(result).toBe(updated);
    });
  });

  describe('deactivate', () => {
    it('should call service.deactivate with orgId and id', async () => {
      mockService.deactivate.mockResolvedValue({ id: 'b1', isActive: false });
      const result = await controller.deactivate('org-1', 'b1');
      expect(mockService.deactivate).toHaveBeenCalledWith('org-1', 'b1');
      expect(result).toEqual({ id: 'b1', isActive: false });
    });
  });

  describe('activate', () => {
    it('should call service.activate with orgId and id', async () => {
      mockService.activate.mockResolvedValue({ id: 'b1', isActive: true });
      const result = await controller.activate('org-1', 'b1');
      expect(mockService.activate).toHaveBeenCalledWith('org-1', 'b1');
      expect(result).toEqual({ id: 'b1', isActive: true });
    });
  });

  describe('assignManager', () => {
    it('should call service.assignManager with orgId, id, and managerId', async () => {
      const dto: AssignManagerDto = { managerId: 'u-mgr-1' };
      mockService.assignManager.mockResolvedValue({ id: 'b1', managerId: 'u-mgr-1' });
      const result = await controller.assignManager('org-1', 'b1', dto);
      expect(mockService.assignManager).toHaveBeenCalledWith('org-1', 'b1', 'u-mgr-1');
      expect(result).toEqual({ id: 'b1', managerId: 'u-mgr-1' });
    });
  });

  describe('getStats', () => {
    it('should call service.getBranchStats with orgId and id', async () => {
      const stats = { id: 'b1', name: 'Main', counts: { students: 10 } };
      mockService.getBranchStats.mockResolvedValue(stats);
      const result = await controller.getStats('org-1', 'b1');
      expect(mockService.getBranchStats).toHaveBeenCalledWith('org-1', 'b1');
      expect(result).toBe(stats);
    });
  });
});
