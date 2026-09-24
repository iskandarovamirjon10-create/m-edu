import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeatureFlagsController } from '../feature-flags.controller';
import { FeatureFlagsService } from '../feature-flags.service';

describe('FeatureFlagsController', () => {
  let controller: FeatureFlagsController;
  let service: {
    findAll: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = {
      findAll: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    };
    controller = new FeatureFlagsController(service as unknown as FeatureFlagsService);
  });

  describe('findAll', () => {
    it('calls service.findAll with orgId', async () => {
      service.findAll.mockResolvedValue({ items: [], total: 0 });
      const res = await controller.findAll('org-1');
      expect(service.findAll).toHaveBeenCalledWith('org-1');
      expect(res.total).toBe(0);
    });
  });

  describe('create', () => {
    it('calls service.create with orgId and dto', async () => {
      service.create.mockResolvedValue({ key: 'flag-1' });
      const dto = { key: 'flag-1', name: 'Flag 1' };
      const res = await controller.create('org-1', dto);
      expect(service.create).toHaveBeenCalledWith('org-1', dto);
      expect(res.key).toBe('flag-1');
    });
  });

  describe('update', () => {
    it('calls service.update with orgId, key, and dto', async () => {
      service.update.mockResolvedValue({ key: 'flag-1', enabled: true });
      const dto = { enabled: true };
      const res = await controller.update('org-1', 'flag-1', dto);
      expect(service.update).toHaveBeenCalledWith('org-1', 'flag-1', dto);
      expect(res.enabled).toBe(true);
    });
  });
});
