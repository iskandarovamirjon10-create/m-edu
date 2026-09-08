/**
 * CameraService unit tests.
 *
 * Security / correctness contract:
 * - Every database operation is tenant-scoped where applicable.
 * - Camera credentials are encrypted before persistence.
 * - Credential secrets never appear in API responses.
 * - Host validation happens before network/DB side effects.
 * - Camera history prevents unsafe deletion.
 * - DB FK protection remains a final deletion boundary.
 * - Configuration values are strictly validated.
 * - Event history cannot cross tenant boundaries.
 */

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '@prisma/client';

import type { NetworkSecurity } from '@medu/camera-engine';

import { CameraService } from '../camera.service';

type MockFn = ReturnType<typeof vi.fn>;

interface MockedPrisma {
  camera: {
    create: MockFn;
    findFirst: MockFn;
    findMany: MockFn;
    update: MockFn;
    delete: MockFn;
    count: MockFn;
  };

  cameraAttendanceEvent: {
    findMany: MockFn;
    count: MockFn;
  };
}

function makeCamera(
  overrides: Record<string, unknown> = {},
) {
  return {
    id: 'cam-1',
    organizationId: 'org-1',
    name: 'Entrance Camera',
    vendor: 'Generic',
    model: null,
    protocol: 'RTSP',
    host: '10.0.0.5',
    port: 554,
    location: 'Main entrance',
    streamPath: '/live',
    rtspTransport: 'tcp',
    credentialConfigured: false,
    encryptedCredentials: null,
    processingFps: 3,
    enabled: true,
    recognitionEnabled: true,
    attendanceEnabled: true,
    status: 'CONFIGURED',
    lastSeenAt: null,
    lastErrorAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    reconnectCount: 0,
    metadata: null,
    createdAt: new Date(
      '2026-09-01T10:00:00Z',
    ),
    updatedAt: new Date(
      '2026-09-01T10:00:00Z',
    ),
    ...overrides,
  };
}

function makeEvent(
  overrides: Record<string, unknown> = {},
) {
  return {
    id: 'evt-1',
    organizationId: 'org-1',
    cameraId: 'cam-1',
    studentId: 'stu-1',
    groupId: 'grp-1',
    recognizedAt: new Date(
      '2026-09-05T08:00:00Z',
    ),
    confidence: {
      toNumber: () => 0.92,
    },
    faceQuality: {
      toNumber: () => 0.81,
    },
    decision: 'APPROVED',
    attendanceId: 'att-1',
    student: {
      user: {
        firstName: 'Ali',
        lastName: 'Karimov',
      },
    },
    group: {
      id: 'grp-1',
      name: 'Group A',
    },
    camera: {
      id: 'cam-1',
      name: 'Entrance Camera',
    },
    ...overrides,
  };
}

function makePrisma(): MockedPrisma {
  return {
    camera: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },

    cameraAttendanceEvent: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  };
}

function makeNetworkSecurity(): NetworkSecurity {
  return {
    validateHost: vi
      .fn()
      .mockResolvedValue(undefined),
  } as unknown as NetworkSecurity;
}

function makeService() {
  const prisma = makePrisma();
  const networkSecurity =
    makeNetworkSecurity();

  const service = new CameraService(
    prisma as never,
    networkSecurity,
  );

  return {
    service,
    prisma,
    networkSecurity,
  };
}

describe('CameraService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('createCamera()', () => {
    it('validates the host before touching the database', async () => {
      const {
        service,
        prisma,
        networkSecurity,
      } = makeService();

      networkSecurity.validateHost =
        vi.fn().mockRejectedValue(
          new Error('Private IP blocked'),
        );

      await expect(
        service.createCamera(
          'org-1',
          {
            name: 'Cam',
            host: '169.254.169.254',
          },
        ),
      ).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(
        prisma.camera.create,
      ).not.toHaveBeenCalled();
    });

    it('always persists the requesting organization id', async () => {
      const {
        service,
        prisma,
      } = makeService();

      prisma.camera.create.mockResolvedValue(
        makeCamera({
          organizationId: 'org-secure',
        }),
      );

      await service.createCamera(
        'org-secure',
        {
          name: 'Cam',
          host: '10.0.0.5',
        },
      );

      expect(
        prisma.camera.create,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org-secure',
          }),
        }),
      );
    });

    it('applies production defaults correctly', async () => {
      const {
        service,
        prisma,
      } = makeService();

      prisma.camera.create.mockResolvedValue(
        makeCamera(),
      );

      await service.createCamera(
        'org-1',
        {
          name: 'Cam',
          host: '10.0.0.5',
        },
      );

      const data =
        prisma.camera.create.mock.calls[0][0]
          .data;

      expect(data.vendor).toBe('Generic');
      expect(data.protocol).toBe('RTSP');
      expect(data.port).toBe(554);
      expect(data.rtspTransport).toBe('tcp');
      expect(data.processingFps).toBe(3);
      expect(data.enabled).toBe(true);
      expect(data.recognitionEnabled).toBe(true);
      expect(data.attendanceEnabled).toBe(true);
      expect(data.status).toBe('CONFIGURED');
    });

    it('encrypts credentials before persistence', async () => {
      const {
        service,
        prisma,
      } = makeService();

      prisma.camera.create.mockResolvedValue(
        makeCamera({
          credentialConfigured: true,
        }),
      );

      await service.createCamera(
        'org-1',
        {
          name: 'Cam',
          host: '10.0.0.5',
          username: 'admin',
          password: 'super-secret-password',
        },
      );

      const data =
        prisma.camera.create.mock.calls[0][0]
          .data;

      expect(
        data.credentialConfigured,
      ).toBe(true);

      expect(
        data.encryptedCredentials,
      ).toBeDefined();

      expect(
        data.encryptedCredentials,
      ).not.toContain('admin');

      expect(
        data.encryptedCredentials,
      ).not.toContain(
        'super-secret-password',
      );
    });

    it('never returns encrypted credentials', async () => {
      const {
        service,
        prisma,
      } = makeService();

      prisma.camera.create.mockResolvedValue(
        makeCamera({
          credentialConfigured: true,
          encryptedCredentials: 'AES-BLOB',
        }),
      );

      const result =
        await service.createCamera(
          'org-1',
          {
            name: 'Cam',
            host: '10.0.0.5',
          },
        );

      expect(result).not.toHaveProperty(
        'encryptedCredentials',
      );

      expect(result).not.toHaveProperty(
        'password',
      );

      expect(result).not.toHaveProperty(
        'username',
      );
    });
  });

  describe('listCameras()', () => {
    it('tenant-scopes both data and count queries', async () => {
      const {
        service,
        prisma,
      } = makeService();

      prisma.camera.findMany
        .mockResolvedValue([]);

      prisma.camera.count
        .mockResolvedValue(0);

      await service.listCameras(
        'org-secure',
        {},
      );

      expect(
        prisma.camera.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-secure',
          }),
        }),
      );

      expect(
        prisma.camera.count,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-secure',
          }),
        }),
      );
    });

    it('applies status and search filters', async () => {
      const {
        service,
        prisma,
      } = makeService();

      prisma.camera.findMany.mockResolvedValue([
        makeCamera(),
        makeCamera({
          id: 'cam-2',
        }),
      ]);

      prisma.camera.count.mockResolvedValue(2);

      const result =
        await service.listCameras(
          'org-1',
          {
            search: 'entr',
            status: 'CONFIGURED',
            page: 1,
            limit: 10,
          },
        );

      const where =
        prisma.camera.findMany.mock.calls[0][0]
          .where;

      expect(where.organizationId).toBe(
        'org-1',
      );

      expect(where.status).toBe(
        'CONFIGURED',
      );

      expect(
        where.OR,
      ).toBeDefined();

      expect(
        where.OR.length,
      ).toBeGreaterThan(0);

      expect(result.total).toBe(2);
      expect(result.totalPages).toBe(1);
      expect(result.items).toHaveLength(2);
    });

    it('never exposes encrypted credentials in list results', async () => {
      const {
        service,
        prisma,
      } = makeService();

      prisma.camera.findMany.mockResolvedValue([
        makeCamera({
          encryptedCredentials: 'SECRET',
          credentialConfigured: true,
        }),
      ]);

      prisma.camera.count.mockResolvedValue(1);

      const result =
        await service.listCameras(
          'org-1',
          {},
        );

      expect(
        result.items[0],
      ).not.toHaveProperty(
        'encryptedCredentials',
      );
    });
  });

  describe('getCamera()', () => {
    it('queries by both camera id and organization id', async () => {
      const {
        service,
        prisma,
      } = makeService();

      prisma.camera.findFirst.mockResolvedValue(
        makeCamera(),
      );

      await service.getCamera(
        'org-1',
        'cam-1',
      );

      expect(
        prisma.camera.findFirst,
      ).toHaveBeenCalledWith({
        where: {
          id: 'cam-1',
          organizationId: 'org-1',
        },
      });
    });

    it('returns NotFound across tenant boundaries', async () => {
      const {
        service,
        prisma,
      } = makeService();

      prisma.camera.findFirst.mockResolvedValue(
        null,
      );

      await expect(
        service.getCamera(
          'org-attacker',
          'cam-victim',
        ),
      ).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('updateCamera()', () => {
    it('rejects update when camera does not exist in tenant', async () => {
      const {
        service,
        prisma,
      } = makeService();

      prisma.camera.findFirst.mockResolvedValue(
        null,
      );

      await expect(
        service.updateCamera(
          'org-1',
          'cam-1',
          {
            name: 'New',
          },
        ),
      ).rejects.toBeInstanceOf(
        NotFoundException,
      );

      expect(
        prisma.camera.update,
      ).not.toHaveBeenCalled();
    });

    it('validates a changed host before updating', async () => {
      const {
        service,
        prisma,
        networkSecurity,
      } = makeService();

      prisma.camera.findFirst.mockResolvedValue(
        makeCamera(),
      );

      networkSecurity.validateHost =
        vi.fn().mockRejectedValue(
          new Error('Blocked'),
        );

      await expect(
        service.updateCamera(
          'org-1',
          'cam-1',
          {
            host: '169.254.169.254',
          },
        ),
      ).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(
        prisma.camera.update,
      ).not.toHaveBeenCalled();
    });

    it('updates only fields explicitly provided', async () => {
      const {
        service,
        prisma,
      } = makeService();

      prisma.camera.findFirst.mockResolvedValue(
        makeCamera(),
      );

      prisma.camera.update.mockResolvedValue(
        makeCamera({
          name: 'Side Gate',
        }),
      );

      await service.updateCamera(
        'org-1',
        'cam-1',
        {
          name: 'Side Gate',
        },
      );

      const data =
        prisma.camera.update.mock.calls[0][0]
          .data;

      expect(data.name).toBe(
        'Side Gate',
      );

      expect(data.host).toBeUndefined();
      expect(data.port).toBeUndefined();
      expect(data.processingFps).toBeUndefined();
    });

    it('re-encrypts credentials when username and password are supplied', async () => {
      const {
        service,
        prisma,
      } = makeService();

      prisma.camera.findFirst.mockResolvedValue(
        makeCamera(),
      );

      prisma.camera.update.mockResolvedValue(
        makeCamera({
          credentialConfigured: true,
        }),
      );

      await service.updateCamera(
        'org-1',
        'cam-1',
        {
          username: 'root',
          password: 'new-password',
        },
      );

      const data =
        prisma.camera.update.mock.calls[0][0]
          .data;

      expect(
        data.credentialConfigured,
      ).toBe(true);

      expect(
        data.encryptedCredentials,
      ).toBeDefined();

      expect(
        data.encryptedCredentials,
      ).not.toContain(
        'new-password',
      );
    });

    it('never stores plaintext credentials during update', async () => {
      const {
        service,
        prisma,
      } = makeService();

      prisma.camera.findFirst.mockResolvedValue(
        makeCamera(),
      );

      prisma.camera.update.mockResolvedValue(
        makeCamera(),
      );

      await service.updateCamera(
        'org-1',
        'cam-1',
        {
          username: 'admin',
          password: 'secret-value',
        },
      );

      const data =
        prisma.camera.update.mock.calls[0][0]
          .data;

      expect(data.password).toBeUndefined();
      expect(data.username).toBeUndefined();

      expect(
        data.encryptedCredentials,
      ).not.toBe(
        'secret-value',
      );
    });
  });

  describe('enableCamera() / disableCamera()', () => {
    it('disables camera and sets DISABLED status', async () => {
      const {
        service,
        prisma,
      } = makeService();

      prisma.camera.findFirst.mockResolvedValue(
        makeCamera(),
      );

      prisma.camera.update.mockResolvedValue(
        makeCamera({
          enabled: false,
          status: 'DISABLED',
        }),
      );

      const result =
        await service.disableCamera(
          'org-1',
          'cam-1',
        );

      expect(
        prisma.camera.update,
      ).toHaveBeenCalledWith({
        where: {
          id: 'cam-1',
          organizationId: 'org-1',
        },
        data: {
          enabled: false,
          status: 'DISABLED',
        },
      });

      expect(result.enabled).toBe(
        false,
      );
    });

    it('rejects disabling a camera outside the tenant', async () => {
      const {
        service,
        prisma,
      } = makeService();

      prisma.camera.findFirst.mockResolvedValue(
        null,
      );

      await expect(
        service.disableCamera(
          'org-attacker',
          'cam-victim',
        ),
      ).rejects.toBeInstanceOf(
        NotFoundException,
      );

      expect(
        prisma.camera.update,
      ).not.toHaveBeenCalled();
    });

    it('enables a camera without changing unrelated configuration', async () => {
      const {
        service,
        prisma,
      } = makeService();

      prisma.camera.findFirst.mockResolvedValue(
        makeCamera({
          enabled: false,
          status: 'DISABLED',
        }),
      );

      prisma.camera.update.mockResolvedValue(
        makeCamera({
          enabled: true,
          status: 'CONFIGURED',
        }),
      );

      await service.enableCamera(
        'org-1',
        'cam-1',
      );

      expect(
        prisma.camera.update,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'cam-1',
            organizationId: 'org-1',
          },
          data: expect.objectContaining({
            enabled: true,
          }),
        }),
      );
    });
  });

  describe('deleteCamera()', () => {
    it('blocks deletion when recognition history exists', async () => {
      const {
        service,
        prisma,
      } = makeService();

      prisma.camera.findFirst.mockResolvedValue(
        makeCamera(),
      );

      prisma.cameraAttendanceEvent.count
        .mockResolvedValue(3);

      await expect(
        service.deleteCamera(
          'org-1',
          'cam-1',
        ),
      ).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(
        prisma.camera.delete,
      ).not.toHaveBeenCalled();
    });

    it('deletes a camera with no event history', async () => {
      const {
        service,
        prisma,
      } = makeService();

      prisma.camera.findFirst.mockResolvedValue(
        makeCamera(),
      );

      prisma.cameraAttendanceEvent.count
        .mockResolvedValue(0);

      prisma.camera.delete.mockResolvedValue(
        makeCamera(),
      );

      await expect(
        service.deleteCamera(
          'org-1',
          'cam-1',
        ),
      ).resolves.toEqual({
        success: true,
      });

      expect(
        prisma.camera.delete,
      ).toHaveBeenCalledWith({
        where: {
          id: 'cam-1',
          organizationId: 'org-1',
        },
      });
    });

    it('does not delete another tenant camera', async () => {
      const {
        service,
        prisma,
      } = makeService();

      prisma.camera.findFirst.mockResolvedValue(
        null,
      );

      await expect(
        service.deleteCamera(
          'org-attacker',
          'cam-victim',
        ),
      ).rejects.toBeInstanceOf(
        NotFoundException,
      );

      expect(
        prisma.cameraAttendanceEvent.count,
      ).not.toHaveBeenCalled();

      expect(
        prisma.camera.delete,
      ).not.toHaveBeenCalled();
    });

    it('converts a final DB foreign-key conflict to a controlled client error', async () => {
      const {
        service,
        prisma,
      } = makeService();

      prisma.camera.findFirst.mockResolvedValue(
        makeCamera(),
      );

      prisma.cameraAttendanceEvent.count
        .mockResolvedValue(0);

      prisma.camera.delete.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError(
          'Foreign key constraint failed',
          { code: 'P2003', clientVersion: '0.0.0', meta: {} },
        ),
      );

      await expect(
        service.deleteCamera(
          'org-1',
          'cam-1',
        ),
      ).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('getCameraHealth()', () => {
    it('returns serializable health data', async () => {
      const {
        service,
        prisma,
      } = makeService();

      prisma.camera.findFirst.mockResolvedValue(
        makeCamera({
          lastSeenAt: new Date(
            '2026-09-05T09:00:00Z',
          ),
          reconnectCount: 2,
        }),
      );

      const result =
        await service.getCameraHealth(
          'org-1',
          'cam-1',
        );

      expect(result.cameraId).toBe(
        'cam-1',
      );

      expect(
        result.lastSeenAt,
      ).toBe(
        '2026-09-05T09:00:00.000Z',
      );

      expect(
        result.processingFps,
      ).toBe(3);

      expect(
        result.enabled,
      ).toBe(true);
    });
  });

  describe('getCameraEvents()', () => {
    it('requires the camera to belong to the requesting tenant', async () => {
      const {
        service,
        prisma,
      } = makeService();

      prisma.camera.findFirst.mockResolvedValue(
        null,
      );

      await expect(
        service.getCameraEvents(
          'org-attacker',
          'cam-victim',
          {},
        ),
      ).rejects.toBeInstanceOf(
        NotFoundException,
      );

      expect(
        prisma.cameraAttendanceEvent.findMany,
      ).not.toHaveBeenCalled();
    });

    it('tenant-scopes the event query itself', async () => {
      const {
        service,
        prisma,
      } = makeService();

      prisma.camera.findFirst.mockResolvedValue(
        makeCamera(),
      );

      prisma.cameraAttendanceEvent.findMany
        .mockResolvedValue([]);

      prisma.cameraAttendanceEvent.count
        .mockResolvedValue(0);

      await service.getCameraEvents(
        'org-1',
        'cam-1',
        {},
      );

      expect(
        prisma.cameraAttendanceEvent.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-1',
            cameraId: 'cam-1',
          }),
        }),
      );

      expect(
        prisma.cameraAttendanceEvent.count,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-1',
            cameraId: 'cam-1',
          }),
        }),
      );
    });

    it('applies date filters and maps joined data safely', async () => {
      const {
        service,
        prisma,
      } = makeService();

      prisma.camera.findFirst.mockResolvedValue(
        makeCamera(),
      );

      prisma.cameraAttendanceEvent.findMany
        .mockResolvedValue([
          makeEvent(),
        ]);

      prisma.cameraAttendanceEvent.count
        .mockResolvedValue(1);

      const result =
        await service.getCameraEvents(
          'org-1',
          'cam-1',
          {
            dateFrom: '2026-09-01',
            dateTo: '2026-09-30',
          },
        );

      const where =
        prisma.cameraAttendanceEvent
          .findMany
          .mock.calls[0][0]
          .where;

      expect(
        where.organizationId,
      ).toBe('org-1');

      expect(
        where.cameraId,
      ).toBe('cam-1');

      expect(
        where.recognizedAt,
      ).toBeDefined();

      expect(
        where.recognizedAt.gte,
      ).toBeInstanceOf(Date);

      expect(
        where.recognizedAt.lte,
      ).toBeInstanceOf(Date);

      expect(
        result.items[0],
      ).toEqual(
        expect.objectContaining({
          id: 'evt-1',
          cameraName:
            'Entrance Camera',
          studentName:
            'Ali Karimov',
          groupName:
            'Group A',
          decision:
            'APPROVED',
          confidence: 0.92,
          faceQuality: 0.81,
        }),
      );

      expect(
        result.items[0],
      ).not.toHaveProperty(
        'student',
      );

      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });
  });

  describe('updateCameraConfig()', () => {
    it('rejects FPS below minimum', async () => {
      const {
        service,
        prisma,
      } = makeService();

      prisma.camera.findFirst.mockResolvedValue(
        makeCamera(),
      );

      await expect(
        service.updateCameraConfig(
          'org-1',
          'cam-1',
          {
            processingFps: 0.49,
          },
        ),
      ).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(
        prisma.camera.update,
      ).not.toHaveBeenCalled();
    });

    it('rejects FPS above maximum', async () => {
      const {
        service,
        prisma,
      } = makeService();

      prisma.camera.findFirst.mockResolvedValue(
        makeCamera(),
      );

      await expect(
        service.updateCameraConfig(
          'org-1',
          'cam-1',
          {
            processingFps: 30.01,
          },
        ),
      ).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(
        prisma.camera.update,
      ).not.toHaveBeenCalled();
    });

    it('accepts the exact minimum FPS boundary', async () => {
      const {
        service,
        prisma,
      } = makeService();

      prisma.camera.findFirst.mockResolvedValue(
        makeCamera(),
      );

      prisma.camera.update.mockResolvedValue(
        makeCamera({
          processingFps: 0.5,
        }),
      );

      await expect(
        service.updateCameraConfig(
          'org-1',
          'cam-1',
          {
            processingFps: 0.5,
          },
        ),
      ).resolves.toBeDefined();
    });

    it('accepts the exact maximum FPS boundary', async () => {
      const {
        service,
        prisma,
      } = makeService();

      prisma.camera.findFirst.mockResolvedValue(
        makeCamera(),
      );

      prisma.camera.update.mockResolvedValue(
        makeCamera({
          processingFps: 30,
        }),
      );

      await expect(
        service.updateCameraConfig(
          'org-1',
          'cam-1',
          {
            processingFps: 30,
          },
        ),
      ).resolves.toBeDefined();
    });

    it('persists only supplied configuration fields', async () => {
      const {
        service,
        prisma,
      } = makeService();

      prisma.camera.findFirst.mockResolvedValue(
        makeCamera(),
      );

      prisma.camera.update.mockResolvedValue(
        makeCamera({
          processingFps: 10,
          recognitionEnabled: false,
        }),
      );

      await service.updateCameraConfig(
        'org-1',
        'cam-1',
        {
          processingFps: 10,
          recognitionEnabled: false,
        },
      );

      expect(
        prisma.camera.update,
      ).toHaveBeenCalledWith({
        where: {
          id: 'cam-1',
          organizationId: 'org-1',
        },
        data: {
          processingFps: 10,
          recognitionEnabled: false,
        },
      });
    });

    it('rejects configuration changes for another tenant', async () => {
      const {
        service,
        prisma,
      } = makeService();

      prisma.camera.findFirst.mockResolvedValue(
        null,
      );

      await expect(
        service.updateCameraConfig(
          'org-attacker',
          'cam-victim',
          {
            processingFps: 10,
          },
        ),
      ).rejects.toBeInstanceOf(
        NotFoundException,
      );

      expect(
        prisma.camera.update,
      ).not.toHaveBeenCalled();
    });
  });
});