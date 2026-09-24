import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SystemHealthController } from '../system-health.controller';
import { SystemHealthService, SystemSummary } from '../system-health.service';

describe('SystemHealthController', () => {
  let controller: SystemHealthController;
  let service: {
    getSummary: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = {
      getSummary: vi.fn(),
    };
    controller = new SystemHealthController(service as unknown as SystemHealthService);
  });

  it('getSummary returns system summary from service', async () => {
    const mockSummary: SystemSummary = {
      uptime: 1234,
      components: [
        { name: 'database', status: 'UP', latencyMs: 2, lastChecked: new Date().toISOString() },
      ],
    };
    service.getSummary.mockResolvedValue(mockSummary);

    const result = await controller.getSummary();
    expect(result).toBe(mockSummary);
    expect(service.getSummary).toHaveBeenCalledOnce();
  });

  it('getComponents returns only components array from summary', async () => {
    const mockComponents = [
      { name: 'database' as const, status: 'UP' as const, latencyMs: 2, lastChecked: new Date().toISOString() },
      { name: 'prisma' as const, status: 'UP' as const, latencyMs: 3, lastChecked: new Date().toISOString() },
    ];
    service.getSummary.mockResolvedValue({
      uptime: 500,
      components: mockComponents,
    });

    const result = await controller.getComponents();
    expect(result).toEqual(mockComponents);
    expect(service.getSummary).toHaveBeenCalledOnce();
  });
});
