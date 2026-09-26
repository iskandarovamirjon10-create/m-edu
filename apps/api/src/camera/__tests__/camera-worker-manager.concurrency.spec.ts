import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CameraWorkerManagerService } from '../camera-worker-manager.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CameraAlertingService } from '../camera-alerting.service';
import { CameraWorkerSession } from '../camera-worker-session';

const sessionStartMock = vi.fn();
const sessionStopMock = vi.fn();

vi.mock('@medu/face-engine', () => ({
  RealFaceEngine: class {
    constructor() {}
    async initialize() {}
  },
}));

vi.mock('@medu/camera-engine', () => ({
  CredentialVault: class {
    constructor() {}
    encryption = { encrypt: vi.fn(), decrypt: vi.fn() };
  },
  NetworkSecurity: class {
    constructor(_opts: unknown) {}
    async validateHost(host: string): Promise<string> {
      return host;
    }
  },
}));

vi.mock('../camera-worker-session', () => ({
  CameraWorkerSession: class {
    constructor() {}
    start = sessionStartMock;
    stop = sessionStopMock;
    on = vi.fn();
  },
}));

describe('CameraWorkerManagerService - Concurrency', () => {
  let service: CameraWorkerManagerService;
  let prisma: any;
  let alerting: any;

  beforeEach(() => {
    sessionStartMock.mockClear();
    sessionStartMock.mockResolvedValue(undefined);

    prisma = {
      camera: {
        findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue({ id: 'cam-123', organizationId: 'org-123', enabled: true, recognitionEnabled: true, host: '10.0.0.1', port: 554, protocol: 'RTSP', streamPath: '/h264', processingFps: 3 }), findUnique: vi.fn().mockResolvedValue({
          id: 'cam-123',
          organizationId: 'org-123',
          enabled: true,
          recognitionEnabled: true,
          host: '10.0.0.1',
          port: 554,
          protocol: 'RTSP',
          streamPath: '/h264',
          processingFps: 3,
        }),
      },
    };
    alerting = {};

    process.env.BIOMETRIC_ENCRYPTION_KEY = '12345678901234567890123456789012';
    service = new CameraWorkerManagerService(prisma as any, alerting as any);
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('P0-1: prevents duplicate workers when startWorker is called concurrently', async () => {
    await service.onModuleInit();

    // Start 10 concurrent requests for the SAME camera
    const promises = Array.from({ length: 10 }).map(() =>
      service.startWorker('org-123', 'cam-123').catch((e) => e)
    );

    const results = await Promise.all(promises);

    // Only one should succeed, others should either throw 409 CONFLICT or return immediately (idempotent)
    // The exact behavior: the first gets the lock and proceeds, others hit `this.lifecycleLocks.has` and throw HttpException.
    const errors = results.filter(r => r instanceof Error);
    const successes = results.filter(r => !(r instanceof Error));

    console.log('RESULTS:', results); expect(sessionStartMock).toHaveBeenCalledTimes(1);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('Camera worker lifecycle operation already in progress');
  });
});
vi.mock('ioredis', () => ({
  default: class {
    status = 'ready';
    set = vi.fn().mockResolvedValue('OK');
    del = vi.fn().mockResolvedValue(1);
    eval = vi.fn().mockResolvedValue(1);
    subscribe = vi.fn().mockResolvedValue(1);
    unsubscribe = vi.fn();
    quit = vi.fn();
    on = vi.fn();
    disconnect = vi.fn();
  },
  Redis: class {
    status = 'ready';
    set = vi.fn().mockResolvedValue('OK');
    del = vi.fn().mockResolvedValue(1);
    eval = vi.fn().mockResolvedValue(1);
    subscribe = vi.fn().mockResolvedValue(1);
    unsubscribe = vi.fn();
    quit = vi.fn();
    on = vi.fn();
    disconnect = vi.fn();
  }
}));
