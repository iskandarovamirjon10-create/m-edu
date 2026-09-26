import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

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
    constructor(..._args: unknown[]) {}

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

/**
 * The coordination clients are the only ioredis consumers in this service.
 * `instances[0]` is the primary (lock) client, `[1]` the pub client and `[2]`
 * the subscriber — the order `initializeRedis` creates them in.
 */
const redisMock = vi.hoisted(() => {
  class MockRedisClient {
    static instances: MockRedisClient[] = [];

    status = 'ready';

    on = vi.fn((_event: string, _handler: unknown) => this);

    set = vi.fn(async () => 'OK' as string | null);

    get = vi.fn(async () => null as string | null);

    eval = vi.fn(async () => 1 as number | string);

    expire = vi.fn(async () => 1);

    del = vi.fn(async () => 1);

    publish = vi.fn(async () => 0);

    subscribe = vi.fn(async () => undefined);

    disconnect = vi.fn();

    constructor() {
      MockRedisClient.instances.push(this);
    }
  }

  return { MockRedisClient };
});

vi.mock('ioredis', () => ({
  default: redisMock.MockRedisClient,
  Redis: redisMock.MockRedisClient,
}));

import { CameraWorkerManagerService } from '../camera-worker-manager.service';
import type { PrismaService } from '../../prisma/prisma.service';

type MockRedisClient = InstanceType<typeof redisMock.MockRedisClient>;

interface LockInternals {
  redis: MockRedisClient | null;
  replicaId: string;
  acquireCameraLock(cameraId: string): Promise<boolean>;
  renewCameraLock(cameraId: string): Promise<boolean>;
  releaseCameraLock(cameraId: string): Promise<void>;
}

function internals(manager: CameraWorkerManagerService): LockInternals {
  return manager as unknown as LockInternals;
}

function createPrismaMock() {
  return {
    camera: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn(),
    },
  };
}

function makeCamera(id: string, organizationId: string) {
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

describe('CameraWorkerManagerService — distributed camera lock', () => {
  let manager: CameraWorkerManagerService;
  let prisma: ReturnType<typeof createPrismaMock>;
  let client: MockRedisClient;

  beforeEach(async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('BIOMETRIC_ENCRYPTION_KEY', 'x'.repeat(40));

    redisMock.MockRedisClient.instances.length = 0;

    prisma = createPrismaMock();
    manager = new CameraWorkerManagerService(
      prisma as unknown as PrismaService,
    );

    // Full init: `startWorker` needs the credential vault built by
    // `onModuleInit`, and Redis coordination is initialised in the same path.
    await manager.onModuleInit();

    client = redisMock.MockRedisClient.instances[0];
  });

  afterEach(async () => {
    await manager.onModuleDestroy();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('skips the lock entirely while Redis is not ready', async () => {
    client.status = 'connecting';

    await expect(
      internals(manager).acquireCameraLock('cam-1'),
    ).resolves.toBe(true);

    // Nothing may be queued while the connection is down: a buffered command
    // is what used to stall worker start-up (and hang the test process).
    expect(client.set).not.toHaveBeenCalled();
  });

  it('takes ownership with SET key replicaId EX 10 NX', async () => {
    const { replicaId } = internals(manager);

    await expect(
      internals(manager).acquireCameraLock('cam-1'),
    ).resolves.toBe(true);

    expect(client.set).toHaveBeenCalledWith(
      'camera:cam-1:lock',
      replicaId,
      'EX',
      10,
      'NX',
    );
  });

  it('treats a lock it already owns as acquired (idempotent re-start)', async () => {
    const { replicaId } = internals(manager);

    client.set.mockResolvedValueOnce(null);
    client.get.mockResolvedValueOnce(replicaId);

    await expect(
      internals(manager).acquireCameraLock('cam-1'),
    ).resolves.toBe(true);
  });

  it('refuses a camera owned by another replica', async () => {
    client.set.mockResolvedValueOnce(null);
    client.get.mockResolvedValueOnce('another-replica');

    await expect(
      internals(manager).acquireCameraLock('cam-1'),
    ).resolves.toBe(false);
  });

  it('degrades to running the worker when Redis rejects the acquire', async () => {
    client.set.mockRejectedValueOnce(
      new Error("Stream isn't writeable and enableOfflineQueue options is false"),
    );

    await expect(
      internals(manager).acquireCameraLock('cam-1'),
    ).resolves.toBe(true);
  });

  it('renews only while this replica still owns the lock', async () => {
    const { replicaId } = internals(manager);

    await expect(
      internals(manager).renewCameraLock('cam-1'),
    ).resolves.toBe(true);

    const [script, , key, owner] = client.eval.mock.calls[0] as [
      string,
      number,
      string,
      string,
    ];

    expect(script).toContain('GET');
    expect(script).toContain('EXPIRE');
    expect(script).toContain('ARGV[1]');
    expect(key).toBe('camera:cam-1:lock');
    expect(owner).toBe(replicaId);

    // An unconditional EXPIRE would extend a peer replica's lock.
    expect(client.expire).not.toHaveBeenCalled();
  });

  it('reports a lost lock when the Lua compare says another replica owns it', async () => {
    client.eval.mockResolvedValueOnce(0);

    await expect(
      internals(manager).renewCameraLock('cam-1'),
    ).resolves.toBe(false);
  });

  it('releases with compare-and-del, never a blind DEL', async () => {
    const { replicaId } = internals(manager);

    await internals(manager).releaseCameraLock('cam-1');

    const [script, , key, owner] = client.eval.mock.calls[0] as [
      string,
      number,
      string,
      string,
    ];

    expect(script).toContain('GET');
    expect(script).toContain('DEL');
    expect(script).toContain('ARGV[1]');
    expect(key).toBe('camera:cam-1:lock');
    expect(owner).toBe(replicaId);

    expect(client.del).not.toHaveBeenCalled();
  });

  it('does not delete a lock that belongs to another replica', async () => {
    client.eval.mockResolvedValueOnce(0);

    await internals(manager).releaseCameraLock('cam-1');

    expect(client.del).not.toHaveBeenCalled();
  });

  it('releases the lock when the worker fails to start, so it can be retried', async () => {
    const { replicaId } = internals(manager);

    sessionStartMock.mockRejectedValueOnce(new Error('ffmpeg failed to start'));

    prisma.camera.findFirst.mockImplementation(
      (args: { where: { id: string; organizationId: string } }) =>
        Promise.resolve(makeCamera(args.where.id, args.where.organizationId)),
    );

    await expect(
      manager.startWorker('org-a', 'cam-1'),
    ).rejects.toThrow('ffmpeg failed to start');

    expect(client.eval).toHaveBeenCalledWith(
      expect.stringContaining('DEL'),
      1,
      'camera:cam-1:lock',
      replicaId,
    );
  });
});
