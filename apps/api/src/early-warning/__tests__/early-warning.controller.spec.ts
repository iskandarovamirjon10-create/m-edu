import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EarlyWarningController } from '../early-warning.controller';
import { EarlyWarningService } from '../early-warning.service';

describe('EarlyWarningController', () => {
  let controller: EarlyWarningController;
  let service: {
    getSummary: ReturnType<typeof vi.fn>;
    findAll: ReturnType<typeof vi.fn>;
    runScan: ReturnType<typeof vi.fn>;
    resolve: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = {
      getSummary: vi.fn(),
      findAll: vi.fn(),
      runScan: vi.fn(),
      resolve: vi.fn(),
    };
    controller = new EarlyWarningController(service as unknown as EarlyWarningService);
  });

  describe('getSummary', () => {
    it('calls service.getSummary with orgId', async () => {
      service.getSummary.mockResolvedValue({ total: 5, open: 5, critical: 2, high: 1 });
      const res = await controller.getSummary('org-1');
      expect(service.getSummary).toHaveBeenCalledWith('org-1');
      expect(res.total).toBe(5);
    });
  });

  describe('findAll', () => {
    it('calls service.findAll with orgId and query', async () => {
      service.findAll.mockResolvedValue({ items: [], total: 0 });
      const res = await controller.findAll('org-1', { page: 1, limit: 10, severity: 'HIGH' });
      expect(service.findAll).toHaveBeenCalledWith('org-1', {
        page: 1,
        limit: 10,
        severity: 'HIGH',
      });
      expect(res.total).toBe(0);
    });
  });

  describe('runScan', () => {
    it('calls service.runScan with orgId', async () => {
      service.runScan.mockResolvedValue({ created: 3, scanned: 3, fixed: 0 });
      const res = await controller.runScan('org-1');
      expect(service.runScan).toHaveBeenCalledWith('org-1');
      expect(res.created).toBe(3);
    });
  });

  describe('resolve', () => {
    it('calls service.resolve with orgId, id, userId, note', async () => {
      service.resolve.mockResolvedValue({ ok: true });
      const res = await controller.resolve('org-1', 'user-1', 'ew-123', { note: 'Done' });
      expect(service.resolve).toHaveBeenCalledWith('org-1', 'ew-123', 'user-1', 'Done');
      expect(res).toEqual({ ok: true });
    });
  });
});
