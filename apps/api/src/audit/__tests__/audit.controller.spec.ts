import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditController } from '../audit.controller';
import type { AuditService } from '../audit.service';
import type { AuditQueryDto } from '../audit.dto';

describe('AuditController', () => {
  let controller: AuditController;
  let service: {
    findAll: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    getEntityHistory: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = {
      findAll: vi.fn(),
      findOne: vi.fn(),
      getEntityHistory: vi.fn(),
    };
    controller = new AuditController(service as unknown as AuditService);
  });

  describe('findAll', () => {
    it('delegates to auditService.findAll with organizationId and query', async () => {
      const mockResult = {
        items: [],
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      };
      service.findAll.mockResolvedValue(mockResult);

      const query: AuditQueryDto = { page: 1, limit: 20 };
      const res = await controller.findAll({ user: { organizationId: 'org-123' } } as never, query);

      expect(service.findAll).toHaveBeenCalledWith('org-123', query);
      expect(res).toEqual(mockResult);
    });
  });

  describe('findOne', () => {
    it('delegates to auditService.findOne with organizationId and id', async () => {
      const mockItem = { id: 'audit-1', organizationId: 'org-123' };
      service.findOne.mockResolvedValue(mockItem);

      const res = await controller.findOne({ user: { organizationId: 'org-123' } } as never, 'audit-1');

      expect(service.findOne).toHaveBeenCalledWith('org-123', 'audit-1');
      expect(res).toEqual(mockItem);
    });
  });

  describe('getEntityHistory', () => {
    it('delegates to auditService.getEntityHistory with organizationId, entityType and entityId', async () => {
      const mockHistory = [{ id: 'h-1' }];
      service.getEntityHistory.mockResolvedValue(mockHistory);

      const res = await controller.getEntityHistory({ user: { organizationId: 'org-123' } } as never, 'STUDENT', 's-1');

      expect(service.getEntityHistory).toHaveBeenCalledWith('org-123', 'STUDENT', 's-1');
      expect(res).toEqual(mockHistory);
    });
  });
});
