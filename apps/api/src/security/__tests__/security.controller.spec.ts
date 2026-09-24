import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { SecurityController } from '../security.controller';
import { SecurityService, SecuritySummary } from '../security.service';

describe('SecurityController', () => {
  let controller: SecurityController;
  let service: {
    getSummary: ReturnType<typeof vi.fn>;
    findAlerts: ReturnType<typeof vi.fn>;
    resolve: ReturnType<typeof vi.fn>;
  };

  const orgId = 'org-1';
  const userId = 'user-1';

  beforeEach(async () => {
    service = {
      getSummary: vi.fn(),
      findAlerts: vi.fn(),
      resolve: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SecurityController],
      providers: [
        {
          provide: SecurityService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<SecurityController>(SecurityController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getSummary', () => {
    it('delegates to securityService.getSummary', async () => {
      const mockSummary: SecuritySummary = {
        total: 0,
        bySeverity: {},
        byStatus: {},
        byType: {},
        riskScore: 0,
        detectedThisWeek: 0,
        resolvedThisWeek: 0,
      };
      service.getSummary.mockResolvedValue(mockSummary);

      const result = await controller.getSummary(orgId);
      expect(result).toEqual(mockSummary);
      expect(service.getSummary).toHaveBeenCalledWith(orgId);
    });
  });

  describe('findAlerts', () => {
    it('delegates to securityService.findAlerts', async () => {
      service.findAlerts.mockResolvedValue({ items: [], total: 0 });

      const result = await controller.findAlerts(orgId, { severity: 'HIGH' });
      expect(result).toEqual({ items: [], total: 0 });
      expect(service.findAlerts).toHaveBeenCalledWith(orgId, { severity: 'HIGH' });
    });
  });

  describe('resolve', () => {
    it('delegates to securityService.resolve', async () => {
      service.resolve.mockResolvedValue({ ok: true });

      const result = await controller.resolve(orgId, userId, 'alert-1', { note: 'checked' });
      expect(result).toEqual({ ok: true });
      expect(service.resolve).toHaveBeenCalledWith(orgId, 'alert-1', userId, 'checked');
    });
  });
});
