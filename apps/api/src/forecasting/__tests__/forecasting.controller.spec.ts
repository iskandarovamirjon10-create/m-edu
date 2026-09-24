import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForecastingController } from '../forecasting.controller';
import { ForecastingService } from '../forecasting.service';

describe('ForecastingController', () => {
  let controller: ForecastingController;
  let service: {
    getSummary: ReturnType<typeof vi.fn>;
    findAll: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = {
      getSummary: vi.fn(),
      findAll: vi.fn(),
    };
    controller = new ForecastingController(service as unknown as ForecastingService);
  });

  describe('getSummary', () => {
    it('delegates to forecastingService.getSummary with organizationId', async () => {
      const mockSummary = {
        series: [],
        projectedRevenue: 10000,
        projectedEnrollments: 50,
      };
      service.getSummary.mockResolvedValue(mockSummary);

      const result = await controller.getSummary('org-123');

      expect(service.getSummary).toHaveBeenCalledWith('org-123');
      expect(result).toBe(mockSummary);
    });
  });

  describe('findAll', () => {
    it('delegates to forecastingService.findAll with organizationId and query params', async () => {
      const mockResult = { items: [] };
      service.findAll.mockResolvedValue(mockResult);

      const query = { metric: 'revenue' as const, method: 'LINEAR' as const };
      const result = await controller.findAll('org-123', query);

      expect(service.findAll).toHaveBeenCalledWith('org-123', query);
      expect(result).toBe(mockResult);
    });
  });
});
