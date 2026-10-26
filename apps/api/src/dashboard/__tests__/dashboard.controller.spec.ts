import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { DashboardController } from '../dashboard.controller';
import { DashboardService } from '../dashboard.service';

describe('DashboardController', () => {
  let controller: DashboardController;
  let service: {
    getStats: ReturnType<typeof vi.fn>;
    getMonthlyRevenue: ReturnType<typeof vi.fn>;
  };

  const orgId = '11111111-1111-4111-8111-111111111111';

  beforeEach(() => {
    service = {
      getStats: vi.fn().mockResolvedValue({ totalStudents: 10 }),
      getMonthlyRevenue: vi.fn().mockResolvedValue([{ month: 'Jan', total: 1000 }]),
    };
    controller = new DashboardController(service as unknown as DashboardService);
  });

  it('delegates getStats to DashboardService with token orgId', async () => {
    const result = await controller.getStats(orgId);

    expect(service.getStats).toHaveBeenCalledWith(orgId);
    expect(result).toEqual({ totalStudents: 10 });
  });

  it('delegates getStats to DashboardService with queryOrgId fallback when token orgId is empty', async () => {
    const result = await controller.getStats('', orgId);

    expect(service.getStats).toHaveBeenCalledWith(orgId);
    expect(result).toEqual({ totalStudents: 10 });
  });

  it('throws BadRequestException in getStats when organizationId is missing', () => {
    expect(() => controller.getStats('', '')).toThrow(BadRequestException);
  });

  it('delegates getRevenue to DashboardService with period and orgId', async () => {
    const result = await controller.getRevenue(orgId, '30D');

    expect(service.getMonthlyRevenue).toHaveBeenCalledWith(orgId, '30D');
    expect(result).toEqual([{ month: 'Jan', total: 1000 }]);
  });

  it('throws BadRequestException in getRevenue when organizationId is missing', () => {
    expect(() => controller.getRevenue('', '30D')).toThrow(BadRequestException);
  });
});
