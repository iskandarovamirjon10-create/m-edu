import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CameraAlertingService } from '../camera-alerting.service';

describe('CameraAlertingService (FIX-4)', () => {
  let service: CameraAlertingService;
  const mockPrisma = {
    user: {
      findMany: vi.fn(),
    },
    notification: {
      createMany: vi.fn(),
    },
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CameraAlertingService(mockPrisma);
    service.onModuleInit();
  });

  it('sends offline alert when first failure occurs', async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'u1' }]);
    mockPrisma.notification.createMany.mockResolvedValue({ count: 1 });

    const r = await service.sendOfflineAlert({
      cameraId: 'cam-1',
      organizationId: 'org-1',
      error: 'stream down',
      cameraName: 'Hall A',
    });

    expect(r.alerted).toBe(true);
    expect(r.suppressed).toBe(false);
    expect(mockPrisma.notification.createMany).toHaveBeenCalledTimes(1);
  });

  it('suppresses duplicate offline alerts within 15 minutes', async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'u1' }]);
    mockPrisma.notification.createMany.mockResolvedValue({ count: 1 });

    await service.sendOfflineAlert({
      cameraId: 'cam-1',
      organizationId: 'org-1',
      error: 'down',
    });

    const r = await service.sendOfflineAlert({
      cameraId: 'cam-1',
      organizationId: 'org-1',
      error: 'down again',
    });

    expect(r.suppressed).toBe(true);
    expect(r.alerted).toBe(false);
    expect(mockPrisma.notification.createMany).toHaveBeenCalledTimes(1);
  });

  it('re-arms after recovered alert clears debounce', async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'u1' }]);
    mockPrisma.notification.createMany.mockResolvedValue({ count: 1 });

    await service.sendOfflineAlert({
      cameraId: 'cam-1',
      organizationId: 'org-1',
      error: 'down',
    });
    await service.sendRecoveredAlert({
      cameraId: 'cam-1',
      organizationId: 'org-1',
    });

    const r = await service.sendOfflineAlert({
      cameraId: 'cam-1',
      organizationId: 'org-1',
      error: 'down again',
    });

    expect(r.alerted).toBe(true);
    expect(mockPrisma.notification.createMany).toHaveBeenCalledTimes(2);
  });

  it('writes frozen-frame alert with separate key', async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'u1' }]);
    mockPrisma.notification.createMany.mockResolvedValue({ count: 1 });

    const r = await service.sendFrozenAlert({
      cameraId: 'cam-1',
      organizationId: 'org-1',
    });
    expect(r.alerted).toBe(true);
  });
});
