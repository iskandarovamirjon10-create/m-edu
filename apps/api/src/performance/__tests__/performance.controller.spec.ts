import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { PerformanceController } from '../performance.controller';
import { PerformanceService } from '../performance.service';

describe('PerformanceController', () => {
  let controller: PerformanceController;
  let service: {
    runPerformanceAudit: ReturnType<typeof vi.fn>;
    getSlowEndpoints: ReturnType<typeof vi.fn>;
    getCacheStats: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      runPerformanceAudit: vi.fn(),
      getSlowEndpoints: vi.fn(),
      getCacheStats: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PerformanceController],
      providers: [
        {
          provide: PerformanceService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<PerformanceController>(PerformanceController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('runAudit', () => {
    it('delegates to performanceService.runPerformanceAudit', async () => {
      const mockAudit = { summary: { totalIssues: 0 } };
      service.runPerformanceAudit.mockResolvedValue(mockAudit);
      const result = await controller.runAudit();
      expect(result).toEqual(mockAudit);
      expect(service.runPerformanceAudit).toHaveBeenCalled();
    });
  });

  describe('getSlowEndpoints', () => {
    it('delegates to performanceService.getSlowEndpoints', () => {
      service.getSlowEndpoints.mockReturnValue([]);
      const result = controller.getSlowEndpoints();
      expect(result).toEqual([]);
      expect(service.getSlowEndpoints).toHaveBeenCalled();
    });
  });

  describe('getCacheStats', () => {
    it('delegates to performanceService.getCacheStats', () => {
      const mockStats = { hits: 10, misses: 2 };
      service.getCacheStats.mockReturnValue(mockStats);
      const result = controller.getCacheStats();
      expect(result).toEqual(mockStats);
      expect(service.getCacheStats).toHaveBeenCalled();
    });
  });
});
