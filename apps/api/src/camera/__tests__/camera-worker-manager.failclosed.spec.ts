import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

vi.mock('@medu/face-engine', () => ({
  RealFaceEngine: class {
    constructor(_config: unknown) {}

    async initialize(): Promise<void> {
      throw new Error('model file corrupted');
    }
  },
}));

vi.mock('@medu/camera-engine', () => ({
  CredentialVault: class {
    constructor(_key: string) {}
  },
}));

import { CameraWorkerManagerService } from '../camera-worker-manager.service';

type MockFn = ReturnType<typeof vi.fn>;

interface PrismaMock {
  camera: {
    findMany: MockFn;
  };
}

function createPrismaMock(): PrismaMock {
  return {
    camera: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
}

function createManager(): CameraWorkerManagerService {
  return new CameraWorkerManagerService(
    createPrismaMock(),
  );
}

describe('CameraWorkerManagerService — fail-closed face engine policy', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('production', () => {
    it('fails application startup when the face engine cannot initialize', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv(
        'BIOMETRIC_ENCRYPTION_KEY',
        'x'.repeat(40),
      );
      vi.stubEnv('FACE_DETECTOR_MODEL_PATH', '/models/detector.bin');
      vi.stubEnv('FACE_EMBEDDER_MODEL_PATH', '/models/embedder.bin');
      vi.stubEnv('FACE_LIVENESS_MODEL_PATH', '/models/liveness.bin');

      const manager = createManager();

      await expect(
        manager.onModuleInit(),
      ).rejects.toThrow(
        'Face engine initialization failed in production',
      );
    });

    it('does not silently continue with a broken face engine', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv(
        'BIOMETRIC_ENCRYPTION_KEY',
        'x'.repeat(40),
      );
      vi.stubEnv('FACE_DETECTOR_MODEL_PATH', '/models/detector.bin');
      vi.stubEnv('FACE_EMBEDDER_MODEL_PATH', '/models/embedder.bin');
      vi.stubEnv('FACE_LIVENESS_MODEL_PATH', '/models/liveness.bin');

      const manager = createManager();

      await expect(
        manager.onModuleInit(),
      ).rejects.toThrow();

      /*
       * Production must never reach normal worker startup
       * when biometric initialization failed.
       */
    });
  });

  describe('development', () => {
    it('continues startup but logs a warning', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv(
        'BIOMETRIC_ENCRYPTION_KEY',
        'x'.repeat(40),
      );

      const manager = createManager();

      const logger = (
        manager as unknown as {
          logger: {
            warn: MockFn;
          };
        }
      ).logger;

      const warnSpy = vi
        .spyOn(logger, 'warn')
        .mockImplementation(() => undefined);

      await expect(
        manager.onModuleInit(),
      ).resolves.toBeUndefined();

      expect(warnSpy).toHaveBeenCalledTimes(1);

      expect(warnSpy).toHaveBeenCalledWith(
        'Face engine initialization failed in development',
        expect.anything(),
      );
    });

    it('does not throw the original model initialization error', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv(
        'BIOMETRIC_ENCRYPTION_KEY',
        'x'.repeat(40),
      );

      const manager = createManager();

      await expect(
        manager.onModuleInit(),
      ).resolves.toBeUndefined();
    });
  });

  describe('environment isolation', () => {
    it('does not accidentally inherit production configuration', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv(
        'BIOMETRIC_ENCRYPTION_KEY',
        'x'.repeat(40),
      );

      const manager = createManager();

      await expect(
        manager.onModuleInit(),
      ).resolves.toBeUndefined();
    });
  });
});