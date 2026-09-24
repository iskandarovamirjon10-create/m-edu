import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardController } from '../dashboard.controller';
import { DashboardService } from '../dashboard.service';

describe('DashboardController', () => {
  let controller: DashboardController;
  let service: {
    getStats: ReturnType<typeof vi.fn>;
  };

  const orgId = '11111111-1111-4111-8111-111111111111';

  beforeEach(() => {
    service = {
      getStats: vi.fn().mockResolvedValue({ totalStudents: 10 }),
    };
    controller = new DashboardController(service as unknown as DashboardService);
  });

  it('delegates getStats to DashboardService', async () => {
    const result = await controller.getStats(orgId);

    expect(service.getStats).toHaveBeenCalledWith(orgId);
    expect(result).toEqual({ totalStudents: 10 });
  });
});
