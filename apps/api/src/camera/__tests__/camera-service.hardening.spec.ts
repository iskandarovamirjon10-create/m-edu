import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';

const discoverMock = vi.fn();
const testConnectionMock = vi.fn();

vi.mock('@medu/camera-engine', () => ({
  CredentialVault: class {
    constructor(_key: string) {}

    async encrypt(): Promise<string> {
      return 'enc';
    }

    async decrypt(): Promise<null> {
      return null;
    }
  },

  NetworkSecurity: class {
    private readonly allowPrivateIps: boolean;
    private readonly allowLoopback: boolean;

    constructor(opts: {
      allowPrivateIps: boolean;
      allowLoopback: boolean;
    }) {
      this.allowPrivateIps = opts.allowPrivateIps;
      this.allowLoopback = opts.allowLoopback;
    }

    async validateHost(host: string): Promise<void> {
      const ip = host.trim();

      if (ip === '127.0.0.1' || ip === '::1') {
        if (!this.allowLoopback) {
          throw new Error(`Loopback address not allowed: ${ip}`);
        }
      }

      if (
        /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip) ||
        ip === '169.254.0.1'
      ) {
        if (!this.allowPrivateIps) {
          throw new Error(`Private network address not allowed: ${ip}`);
        }
      }
    }
  },

  OnvifProvider: class {
    constructor(_networkSecurity: unknown) {}

    async discover(timeoutMs: number, subnet?: string) {
      discoverMock(timeoutMs, subnet);
      return [];
    }

    async testConnection(params: unknown) {
      testConnectionMock(params);

      return {
        success: true,
        latencyMs: 5,
        message: 'ok',
        errorCode: null,
      };
    }
  },

  RtspProvider: class {
    constructor(_networkSecurity: unknown) {}

    async testConnection(params: unknown) {
      testConnectionMock(params);

      return {
        success: true,
        latencyMs: 5,
        message: 'ok',
        errorCode: null,
      };
    }
  },
}));

import { Prisma } from '@prisma/client';
import { NetworkSecurity } from '@medu/camera-engine';
import { CameraService } from '../camera.service';

type MockFn = ReturnType<typeof vi.fn>;

interface PrismaCameraMock {
  create: MockFn;
  findMany: MockFn;
  findFirst: MockFn;
  count: MockFn;
  update: MockFn;
  delete: MockFn;
}

interface PrismaMock {
  camera: PrismaCameraMock;
  cameraAttendanceEvent: {
    count: MockFn;
  };
}

function createPrismaMock(): PrismaMock {
  return {
    camera: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn(),
      delete: vi.fn(),
    },

    cameraAttendanceEvent: {
      count: vi.fn().mockResolvedValue(0),
    },
  };
}

function createNetworkSecurity(strict = false): NetworkSecurity {
  return new NetworkSecurity({
    allowPrivateIps: !strict,
    allowLoopback: !strict,
  });
}

function createService(
  prisma = createPrismaMock(),
  strict = false,
): CameraService {
  return new CameraService(
    prisma,
    createNetworkSecurity(strict),
  );
}

describe('CameraService — SSRF and tenant rate-limit hardening', () => {
  let service: CameraService;

  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('BIOMETRIC_ENCRYPTION_KEY', 'x'.repeat(40));
    vi.stubEnv('CAMERA_ENCRYPTION_KEY', '');

    discoverMock.mockReset();
    testConnectionMock.mockReset();

    service = createService();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('discoverCameras() — SSRF protection', () => {
    it('rejects loopback addresses before provider invocation', async () => {
      const strictService = createService(
        createPrismaMock(),
        true,
      );

      await expect(
        strictService.discoverCameras('org-A', {
          timeoutMs: 1000,
          subnet: '127.0.0.1',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(discoverMock).not.toHaveBeenCalled();
    });

    it('rejects IPv6 loopback before provider invocation', async () => {
      const strictService = createService(
        createPrismaMock(),
        true,
      );

      await expect(
        strictService.discoverCameras('org-A', {
          timeoutMs: 1000,
          subnet: '::1',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(discoverMock).not.toHaveBeenCalled();
    });

    it('rejects RFC1918 private address in strict mode', async () => {
      const strictService = createService(
        createPrismaMock(),
        true,
      );

      await expect(
        strictService.discoverCameras('org-A', {
          timeoutMs: 1000,
          subnet: '192.168.1.1',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(discoverMock).not.toHaveBeenCalled();
    });

    it('rejects 10/8 private address in strict mode', async () => {
      const strictService = createService(
        createPrismaMock(),
        true,
      );

      await expect(
        strictService.discoverCameras('org-A', {
          timeoutMs: 1000,
          subnet: '10.0.0.1',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(discoverMock).not.toHaveBeenCalled();
    });

    it('rejects 172.16/12 private address in strict mode', async () => {
      const strictService = createService(
        createPrismaMock(),
        true,
      );

      await expect(
        strictService.discoverCameras('org-A', {
          timeoutMs: 1000,
          subnet: '172.16.0.1',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(discoverMock).not.toHaveBeenCalled();
    });

    it('rejects link-local metadata address in strict mode', async () => {
      const strictService = createService(
        createPrismaMock(),
        true,
      );

      await expect(
        strictService.discoverCameras('org-A', {
          timeoutMs: 1000,
          subnet: '169.254.0.1',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(discoverMock).not.toHaveBeenCalled();
    });

    it('allows public address and forwards it unchanged', async () => {
      await service.discoverCameras('org-A', {
        timeoutMs: 1000,
        subnet: '8.8.8.8',
      });

      expect(discoverMock).toHaveBeenCalledTimes(1);
      expect(discoverMock).toHaveBeenCalledWith(
        1000,
        '8.8.8.8',
      );
    });

    it('does not silently execute provider discovery after SSRF rejection', async () => {
      const strictService = createService(
        createPrismaMock(),
        true,
      );

      await expect(
        strictService.discoverCameras('org-A', {
          timeoutMs: 1000,
          subnet: '127.0.0.1',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(discoverMock).not.toHaveBeenCalled();
    });
  });

  describe('discoverCameras() — organization rate limiting', () => {
    it('allows exactly three discovery calls within the minute', async () => {
      await service.discoverCameras('org-A', {
        timeoutMs: 100,
      });

      await service.discoverCameras('org-A', {
        timeoutMs: 100,
      });

      await service.discoverCameras('org-A', {
        timeoutMs: 100,
      });

      expect(discoverMock).toHaveBeenCalledTimes(3);
    });

    it('rejects the fourth discovery call with HTTP 429', async () => {
      for (let i = 0; i < 3; i++) {
        await service.discoverCameras('org-A', {
          timeoutMs: 100,
        });
      }

      await expect(
        service.discoverCameras('org-A', {
          timeoutMs: 100,
        }),
      ).rejects.toBeInstanceOf(ThrottlerException);

      expect(discoverMock).toHaveBeenCalledTimes(3);
    });

    it('rate-limits per organization, not globally', async () => {
      for (let i = 0; i < 3; i++) {
        await service.discoverCameras('org-A', {
          timeoutMs: 100,
        });
      }

      await expect(
        service.discoverCameras('org-A', {
          timeoutMs: 100,
        }),
      ).rejects.toBeInstanceOf(ThrottlerException);

      await expect(
        service.discoverCameras('org-B', {
          timeoutMs: 100,
        }),
      ).resolves.toEqual([]);

      expect(discoverMock).toHaveBeenCalledTimes(4);
    });

    it('uses an independent bucket from connection testing', async () => {
      for (let i = 0; i < 3; i++) {
        await service.discoverCameras('org-A', {
          timeoutMs: 100,
        });
      }

      await expect(
        service.testCameraConnection('org-A', {
          host: '8.8.8.8',
          port: 554,
          protocol: 'RTSP',
        }),
      ).resolves.toBeDefined();

      expect(testConnectionMock).toHaveBeenCalledTimes(1);
    });

    it('does not invoke provider after rate limit is exhausted', async () => {
      for (let i = 0; i < 3; i++) {
        await service.discoverCameras('org-A', {
          timeoutMs: 100,
        });
      }

      discoverMock.mockClear();

      await expect(
        service.discoverCameras('org-A', {
          timeoutMs: 100,
        }),
      ).rejects.toBeInstanceOf(ThrottlerException);

      expect(discoverMock).not.toHaveBeenCalled();
    });
  });

  describe('testCameraConnection() — organization rate limiting', () => {
    const params = {
      host: '8.8.8.8',
      port: 554,
      protocol: 'RTSP',
    };

    it('allows exactly ten connection tests per minute', async () => {
      for (let i = 0; i < 10; i++) {
        await service.testCameraConnection('org-A', params);
      }

      expect(testConnectionMock).toHaveBeenCalledTimes(10);
    });

    it('rejects the eleventh connection test with HTTP 429', async () => {
      for (let i = 0; i < 10; i++) {
        await service.testCameraConnection('org-A', params);
      }

      await expect(
        service.testCameraConnection('org-A', params),
      ).rejects.toBeInstanceOf(ThrottlerException);

      expect(testConnectionMock).toHaveBeenCalledTimes(10);
    });

    it('does not block another organization', async () => {
      for (let i = 0; i < 10; i++) {
        await service.testCameraConnection('org-A', params);
      }

      await expect(
        service.testCameraConnection('org-B', params),
      ).resolves.toBeDefined();

      expect(testConnectionMock).toHaveBeenCalledTimes(11);
    });

    it('does not invoke the provider when rate limited', async () => {
      for (let i = 0; i < 10; i++) {
        await service.testCameraConnection('org-A', params);
      }

      testConnectionMock.mockClear();

      await expect(
        service.testCameraConnection('org-A', params),
      ).rejects.toBeInstanceOf(ThrottlerException);

      expect(testConnectionMock).not.toHaveBeenCalled();
    });
  });
});

describe('CameraService — deleteCamera() integrity', () => {
  it('rejects deletion when recognition events exist', async () => {
    const prisma = createPrismaMock();

    prisma.camera.findFirst.mockResolvedValue({
      id: 'cam-1',
      organizationId: 'org-A',
    });

    prisma.cameraAttendanceEvent.count.mockResolvedValue(3);

    const service = createService(prisma);

    await expect(
      service.deleteCamera('org-A', 'cam-1'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(
      prisma.cameraAttendanceEvent.count,
    ).toHaveBeenCalledWith({
      where: {
        cameraId: 'cam-1',
        organizationId: 'org-A',
      },
    });

    expect(prisma.camera.delete).not.toHaveBeenCalled();
  });

  it('deletes camera when no recognition events exist', async () => {
    const prisma = createPrismaMock();

    prisma.camera.findFirst.mockResolvedValue({
      id: 'cam-1',
      organizationId: 'org-A',
    });

    prisma.cameraAttendanceEvent.count.mockResolvedValue(0);

    prisma.camera.delete.mockResolvedValue({
      id: 'cam-1',
    });

    const service = createService(prisma);

    const result = await service.deleteCamera(
      'org-A',
      'cam-1',
    );

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
      }),
    );

    expect(prisma.camera.delete).toHaveBeenCalledWith({
      where: {
        id: 'cam-1',
        organizationId: 'org-A',
      },
    });
  });

  it('does not delete another organization camera', async () => {
    const prisma = createPrismaMock();

    prisma.camera.findFirst.mockResolvedValue(null);

    const service = createService(prisma);

    await expect(
      service.deleteCamera('org-B', 'cam-1'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.cameraAttendanceEvent.count).not.toHaveBeenCalled();
    expect(prisma.camera.delete).not.toHaveBeenCalled();
  });

  it('does not delete when the DB reports a foreign-key conflict', async () => {
    const prisma = createPrismaMock();

    prisma.camera.findFirst.mockResolvedValue({
      id: 'cam-1',
      organizationId: 'org-A',
    });

    prisma.cameraAttendanceEvent.count.mockResolvedValue(0);

    prisma.camera.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        'Foreign key constraint failed',
        { code: 'P2003', clientVersion: '0.0.0', meta: {} },
      ),
    );

    const service = createService(prisma);

    await expect(
      service.deleteCamera('org-A', 'cam-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});