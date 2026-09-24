import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObservabilityController } from '../observability.controller';
import { ObservabilityService } from '../observability.service';

describe('ObservabilityController', () => {
  let controller: ObservabilityController;
  let service: ObservabilityService;

  beforeEach(() => {
    service = {
      getHealthCheck: vi.fn().mockResolvedValue({ status: 'ok', uptime: 100 }),
      getSystemMetrics: vi.fn().mockResolvedValue({ uptime: 100, nodeVersion: 'v24' }),
      getQueueHealth: vi.fn().mockResolvedValue([{ name: 'background-jobs', status: 'healthy' }]),
      getIntegrationHealth: vi.fn().mockReturnValue([{ name: 'Telegram Bot', status: 'configured' }]),
      getApiMetrics: vi.fn().mockReturnValue({ totalRequests: 50, errorRate: 0 }),
      getDatabaseMetrics: vi.fn().mockResolvedValue({ activeConnections: 5, totalQueries: 100 }),
    } as unknown as ObservabilityService;

    controller = new ObservabilityController(service);
  });

  it('should get health check', async () => {
    const result = await controller.getHealthCheck();
    expect(result).toHaveProperty('status', 'ok');
    expect(service.getHealthCheck).toHaveBeenCalled();
  });

  it('should get system metrics', async () => {
    const result = await controller.getSystemMetrics();
    expect(result).toHaveProperty('nodeVersion', 'v24');
    expect(service.getSystemMetrics).toHaveBeenCalled();
  });

  it('should get queue health', async () => {
    const result = await controller.getQueueHealth();
    expect(Array.isArray(result)).toBe(true);
    expect(service.getQueueHealth).toHaveBeenCalled();
  });

  it('should get integration health', () => {
    const result = controller.getIntegrationHealth();
    expect(Array.isArray(result)).toBe(true);
    expect(service.getIntegrationHealth).toHaveBeenCalled();
  });

  it('should get api metrics', () => {
    const result = controller.getApiMetrics('1h');
    expect(result).toHaveProperty('totalRequests', 50);
    expect(service.getApiMetrics).toHaveBeenCalledWith('1h');
  });

  it('should get database metrics', async () => {
    const result = await controller.getDatabaseMetrics();
    expect(result).toHaveProperty('activeConnections', 5);
    expect(service.getDatabaseMetrics).toHaveBeenCalled();
  });
});
