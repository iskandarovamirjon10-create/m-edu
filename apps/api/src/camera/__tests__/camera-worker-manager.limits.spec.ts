import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  HttpException,
  HttpStatus,
} from '@nestjs/common';

const sessionStartMock = vi.fn();
const sessionStopMock = vi.fn();

vi.mock('@medu/face-engine', () => ({
  RealFaceEngine: class {
    constructor(_config: unknown) {}

    async initialize(): Promise<void> {}
  },
}));

vi.mock('@medu/camera-engine', () => ({
  CredentialVault: class {
    constructor(_key: string) {}
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
    constructor(
      _config: unknown,
      _engine: unknown,
      _attendance: unknown,
      _prisma: unknown,
      _encryption: unknown,
    ) {}

    async start(): Promise<void> {
      await sessionStartMock();
    }

    async stop(): Promise<void> {
      sessionStopMock();
    }

    getHealth() {
      return {
        status: 'ok',
        cameraId: 'mock',
      };
    }

    on(_event: string, _handler: unknown): this {
      return this;
    }

    emit(_event: string, _data?: unknown): boolean {
      return true;
    }
  },
}));

vi.mock('../attendance-decision.engine', () => ({
  AttendanceDecisionEngine: class {
    constructor(_prisma: unknown) {}
  },
}));

import { CameraWorkerManagerService } from '../camera-worker-manager.service';

type MockFn = ReturnType<typeof vi.fn>;

interface CameraRecord {
  id: string;
  organizationId: string;
  name: string;
  host: string;
  port: number;
  protocol: string;
  streamPath: string;
  rtspTransport: string;
  encryptedCredentials: string | null;
  processingFps: number;
  location: string;
  credentialConfigured: boolean;
  enabled: boolean;
  recognitionEnabled: boolean;
  attendanceEnabled: boolean;
}

interface PrismaMock {
  camera: {
    findMany: MockFn;
    findFirst: MockFn;
    updateMany: MockFn;
  };
}

function makeCamera(
  id: string,
  organizationId: string,
): CameraRecord {
  return {
    id,
    organizationId,
    name: `cam-${id}`,
    host: '192.168.1.10',
    port: 554,
    protocol: 'RTSP',
    streamPath: '/stream',
    rtspTransport: 'tcp',
    encryptedCredentials: null,
    processingFps: 3,
    location: 'test',
    credentialConfigured: false,
    enabled: true,
    recognitionEnabled: true,
    attendanceEnabled: true,
  };
}

function createPrismaMock(): PrismaMock {
  return {
    camera: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
}

async function createManager(
  prisma: PrismaMock,
  env: Record<string, string> = {},
): Promise<CameraWorkerManagerService> {
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv(
    'BIOMETRIC_ENCRYPTION_KEY',
    'x'.repeat(40),
  );

  for (const [key, value] of Object.entries(env)) {
    vi.stubEnv(key, value);
  }

  const manager = new CameraWorkerManagerService(prisma);

  await manager.onModuleInit();

  return manager;
}

describe('CameraWorkerManagerService — worker capacity', () => {
  let manager: CameraWorkerManagerService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = createPrismaMock();

    sessionStartMock.mockReset();
    sessionStopMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('rejects the 4th worker in the same organization with HTTP 429', async () => {
    manager = await createManager(prisma, {
      MAX_CAMERA_WORKERS: '10',
      MAX_CAMERA_WORKERS_PER_ORG: '3',
    });

    const organizationId = 'org-a';

    prisma.camera.findFirst.mockImplementation(
      (args: { where: { id: string; organizationId: string } }) =>
        Promise.resolve(
          makeCamera(
            args.where.id,
            args.where.organizationId,
          ),
        ),
    );

    for (let i = 0; i < 3; i++) {
      await manager.startWorker(
        organizationId,
        `cam-${i}`,
      );
    }

    await expect(
      manager.startWorker(
        organizationId,
        'cam-3',
      ),
    ).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
      message:
        'Maximum concurrent camera workers (3) reached for this organization',
    });

    expect(sessionStartMock).toHaveBeenCalledTimes(3);
  });

  it('isolates per-organization worker limits', async () => {
    manager = await createManager(prisma, {
      MAX_CAMERA_WORKERS: '10',
      MAX_CAMERA_WORKERS_PER_ORG: '3',
    });

    prisma.camera.findFirst.mockImplementation(
      (args: { where: { id: string; organizationId: string } }) =>
        Promise.resolve(
          makeCamera(
            args.where.id,
            args.where.organizationId,
          ),
        ),
    );

    for (let i = 0; i < 3; i++) {
      await manager.startWorker(
        'org-a',
        `a-cam-${i}`,
      );
    }

    await expect(
      manager.startWorker(
        'org-b',
        'b-cam-0',
      ),
    ).resolves.toBeUndefined();

    await expect(
      manager.startWorker(
        'org-a',
        'a-cam-3',
      ),
    ).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });

    expect(sessionStartMock).toHaveBeenCalledTimes(4);
  });

  it('enforces the global worker cap across organizations', async () => {
    manager = await createManager(prisma, {
      MAX_CAMERA_WORKERS: '2',
      MAX_CAMERA_WORKERS_PER_ORG: '10',
    });

    prisma.camera.findFirst.mockImplementation(
      (args: { where: { id: string; organizationId: string } }) =>
        Promise.resolve(
          makeCamera(
            args.where.id,
            args.where.organizationId,
          ),
        ),
    );

    await manager.startWorker(
      'org-a',
      'a-cam-0',
    );

    await manager.startWorker(
      'org-b',
      'b-cam-0',
    );

    await expect(
      manager.startWorker(
        'org-a',
        'a-cam-1',
      ),
    ).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
      message:
        'Maximum concurrent camera workers (2) reached globally',
    });

    expect(sessionStartMock).toHaveBeenCalledTimes(2);
  });

  it('frees the organization slot when a worker stops', async () => {
    manager = await createManager(prisma, {
      MAX_CAMERA_WORKERS: '10',
      MAX_CAMERA_WORKERS_PER_ORG: '1',
    });

    prisma.camera.findFirst.mockImplementation(
      (args: { where: { id: string; organizationId: string } }) =>
        Promise.resolve(
          makeCamera(
            args.where.id,
            args.where.organizationId,
          ),
        ),
    );

    await manager.startWorker(
      'org-a',
      'cam-0',
    );

    await expect(
      manager.startWorker(
        'org-a',
        'cam-1',
      ),
    ).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });

    await manager.stopWorker(
      'org-a',
      'cam-0',
    );

    await expect(
      manager.startWorker(
        'org-a',
        'cam-1',
      ),
    ).resolves.toBeUndefined();

    expect(sessionStartMock).toHaveBeenCalledTimes(2);
    expect(sessionStopMock).toHaveBeenCalledTimes(1);
  });

  it('rejects a camera belonging to another organization', async () => {
    manager = await createManager(prisma);

    prisma.camera.findFirst.mockResolvedValue(null);

    await expect(
      manager.startWorker(
        'org-a',
        'cam-other-org',
      ),
    ).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
    });

    expect(sessionStartMock).not.toHaveBeenCalled();
  });

  it('does not create duplicate workers for the same camera', async () => {
    manager = await createManager(prisma, {
      MAX_CAMERA_WORKERS: '10',
      MAX_CAMERA_WORKERS_PER_ORG: '10',
    });

    prisma.camera.findFirst.mockImplementation(
      (args: { where: { id: string; organizationId: string } }) =>
        Promise.resolve(
          makeCamera(
            args.where.id,
            args.where.organizationId,
          ),
        ),
    );

    await manager.startWorker(
      'org-a',
      'cam-1',
    );

    await manager.startWorker(
      'org-a',
      'cam-1',
    );

    expect(sessionStartMock).toHaveBeenCalledTimes(1);
  });

  it('does not allow a duplicate worker to consume capacity', async () => {
    manager = await createManager(prisma, {
      MAX_CAMERA_WORKERS: '1',
      MAX_CAMERA_WORKERS_PER_ORG: '1',
    });

    prisma.camera.findFirst.mockImplementation(
      (args: { where: { id: string; organizationId: string } }) =>
        Promise.resolve(
          makeCamera(
            args.where.id,
            args.where.organizationId,
          ),
        ),
    );

    await manager.startWorker(
      'org-a',
      'cam-1',
    );

    await manager.startWorker(
      'org-a',
      'cam-1',
    );

    expect(sessionStartMock).toHaveBeenCalledTimes(1);

    await expect(
      manager.startWorker(
        'org-a',
        'cam-2',
      ),
    ).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
  });

  it('checks tenant ownership through organizationId', async () => {
    manager = await createManager(prisma);

    prisma.camera.findFirst.mockResolvedValue(null);

    await expect(
      manager.startWorker(
        'org-attacker',
        'cam-victim',
      ),
    ).rejects.toBeInstanceOf(HttpException);

    expect(
      prisma.camera.findFirst,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'cam-victim',
          organizationId: 'org-attacker',
        }),
      }),
    );
  });
});

describe('CameraWorkerManagerService — lifecycle', () => {
  let manager: CameraWorkerManagerService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = createPrismaMock();

    sessionStartMock.mockReset();
    sessionStopMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('stops every active worker during module destruction', async () => {
    manager = await createManager(prisma, {
      MAX_CAMERA_WORKERS: '10',
      MAX_CAMERA_WORKERS_PER_ORG: '10',
    });

    prisma.camera.findFirst.mockImplementation(
      (args: { where: { id: string; organizationId: string } }) =>
        Promise.resolve(
          makeCamera(
            args.where.id,
            args.where.organizationId,
          ),
        ),
    );

    await manager.startWorker(
      'org-a',
      'cam-1',
    );

    await manager.startWorker(
      'org-a',
      'cam-2',
    );

    expect(sessionStartMock).toHaveBeenCalledTimes(2);

    await manager.onModuleDestroy();

    expect(sessionStopMock).toHaveBeenCalledTimes(2);

    expect(
      manager.getWorkerState('cam-1'),
    ).toBeNull();

    expect(
      manager.getWorkerState('cam-2'),
    ).toBeNull();
  });

  it('is idempotent when shutdown is called twice', async () => {
    manager = await createManager(prisma, {
      MAX_CAMERA_WORKERS: '10',
      MAX_CAMERA_WORKERS_PER_ORG: '10',
    });

    prisma.camera.findFirst.mockImplementation(
      (args: { where: { id: string; organizationId: string } }) =>
        Promise.resolve(
          makeCamera(
            args.where.id,
            args.where.organizationId,
          ),
        ),
    );

    await manager.startWorker(
      'org-a',
      'cam-1',
    );

    await manager.onModuleDestroy();
    await manager.onModuleDestroy();

    expect(sessionStopMock).toHaveBeenCalledTimes(1);
    expect(
      manager.getWorkerState('cam-1'),
    ).toBeNull();
  });

  it('does not leave worker state after explicit stop', async () => {
    manager = await createManager(prisma);

    prisma.camera.findFirst.mockImplementation(
      (args: { where: { id: string; organizationId: string } }) =>
        Promise.resolve(
          makeCamera(
            args.where.id,
            args.where.organizationId,
          ),
        ),
    );

    await manager.startWorker(
      'org-a',
      'cam-1',
    );

    await manager.stopWorker(
      'org-a',
      'cam-1',
    );

    expect(
      manager.getWorkerState('cam-1'),
    ).toBeNull();

    expect(
      sessionStopMock,
    ).toHaveBeenCalledTimes(1);
  });
});

describe('CameraWorkerManagerService — startup failure handling', () => {
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = createPrismaMock();

    sessionStartMock.mockReset();
    sessionStopMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('does not consume worker capacity when session startup fails', async () => {
    sessionStartMock.mockRejectedValueOnce(
      new Error('ffmpeg failed to start'),
    );

    const manager = await createManager(prisma, {
      MAX_CAMERA_WORKERS: '10',
      MAX_CAMERA_WORKERS_PER_ORG: '1',
    });

    prisma.camera.findFirst.mockImplementation(
      (args: { where: { id: string; organizationId: string } }) =>
        Promise.resolve(
          makeCamera(
            args.where.id,
            args.where.organizationId,
          ),
        ),
    );

    await expect(
      manager.startWorker(
        'org-a',
        'cam-1',
      ),
    ).rejects.toThrow(
      'ffmpeg failed to start',
    );

    /*
     * If the failed worker leaked its slot, this second
     * start would incorrectly receive HTTP 429.
     */
    await expect(
      manager.startWorker(
        'org-a',
        'cam-2',
      ),
    ).resolves.toBeUndefined();

    expect(sessionStartMock).toHaveBeenCalledTimes(2);
  });
});