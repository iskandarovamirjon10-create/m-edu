import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import {
  resolveModelPath,
  resolveFaceEngineProvider,
  getSharedFaceEngine,
  resetSharedFaceEngineCache,
} from '../face-engine.factory';

describe('FaceEngineFactory', () => {
  beforeEach(() => {
    resetSharedFaceEngineCache();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    resetSharedFaceEngineCache();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('resolveFaceEngineProvider', () => {
    it('fails closed to real-local (never mock) when FACE_ENGINE_PROVIDER is unset', () => {
      expect(resolveFaceEngineProvider({} as NodeJS.ProcessEnv)).toBe('real-local');
    });

    it('reports the configured provider (real-local)', () => {
      expect(
        resolveFaceEngineProvider({ FACE_ENGINE_PROVIDER: 'real-local' } as NodeJS.ProcessEnv),
      ).toBe('real-local');
    });
  });

  describe('resolveModelPath', () => {
    it('returns empty string when given empty, null, or whitespace input', () => {
      expect(resolveModelPath('')).toBe('');
      expect(resolveModelPath(undefined)).toBe('');
      expect(resolveModelPath('   ')).toBe('');
    });

    it('rejects paths with null byte injection', () => {
      expect(resolveModelPath('/models/face.onnx\0.bin')).toBe('');
    });

    it('returns empty string for nonexistent files rather than silently returning raw path', () => {
      const bogus = 'some/non/existent/model.onnx';
      expect(resolveModelPath(bogus)).toBe('');
    });

    it('returns empty string for directories (only regular files accepted)', () => {
      const currentDir = path.resolve('.');
      expect(resolveModelPath(currentDir)).toBe('');
    });

    it('resolves relative path to packages/face-engine/models if model file exists', () => {
      const relPath = 'packages/face-engine/models/face_detection_yunet_2023mar.onnx';
      const resolved = resolveModelPath(relPath);
      if (fs.existsSync(path.resolve(relPath))) {
        expect(resolved).toContain('face_detection_yunet_2023mar.onnx');
        expect(path.isAbsolute(resolved)).toBe(true);
        expect(fs.statSync(resolved).isFile()).toBe(true);
      }
    });

    it('resolves minifasnet case-insensitively to minifasnet_v2.onnx if file exists', () => {
      const resolved = resolveModelPath('MiniFASNetV2.onnx');
      const expectedPath = path.resolve('packages/face-engine/models/minifasnet_v2.onnx');
      if (fs.existsSync(expectedPath)) {
        expect(resolved).toContain('minifasnet_v2.onnx');
        expect(fs.statSync(resolved).isFile()).toBe(true);
      }
    });

    it('handles path traversal safely without returning nonexistent targets', () => {
      expect(resolveModelPath('../../../../../etc/passwd')).toBe('');
      expect(resolveModelPath('..\\..\\..\\windows\\system32\\nonexistent_calc_target.exe')).toBe('');
    });
  });

  describe('getSharedFaceEngine', () => {
    describe('production mock rejection', () => {
      it('fails closed when FACE_ENGINE_PROVIDER=mock in production', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('FACE_ENGINE_PROVIDER', 'mock');

        await expect(getSharedFaceEngine()).rejects.toThrow(
          'FACE_ENGINE_PROVIDER must be configured in production. Mock engines are forbidden.',
        );
      });

      it('fails closed when FACE_ENGINE_PROVIDER=mock-dev in production', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('FACE_ENGINE_PROVIDER', 'mock-dev');

        await expect(getSharedFaceEngine()).rejects.toThrow(
          'FACE_ENGINE_PROVIDER must be configured in production. Mock engines are forbidden.',
        );
      });
    });

    describe('provider validation', () => {
      it('rejects unknown or invalid provider strings immediately', async () => {
        vi.stubEnv('NODE_ENV', 'development');
        vi.stubEnv('FACE_ENGINE_PROVIDER', 'aws-rekognition');

        await expect(getSharedFaceEngine()).rejects.toThrow(
          'Invalid FACE_ENGINE_PROVIDER value: "aws-rekognition". Valid values: "real-local", "mock".',
        );
      });
    });

    describe('real-local model requirements', () => {
      it('rejects real-local when required model paths are missing', async () => {
        vi.stubEnv('NODE_ENV', 'development');
        vi.stubEnv('FACE_ENGINE_PROVIDER', 'real-local');
        vi.stubEnv('FACE_DETECTOR_MODEL_PATH', '/nonexistent/detector.onnx');
        vi.stubEnv('FACE_EMBEDDER_MODEL_PATH', '/nonexistent/embedder.onnx');

        await expect(getSharedFaceEngine()).rejects.toThrow(
          /Real-local engine requires model paths/,
        );
      });

      it('loads the REAL ONNX engine (never mock) when the bundled models are present', async () => {
        const detector = 'packages/face-engine/models/face_detection_yunet_2023mar.onnx';
        const embedder = 'packages/face-engine/models/face_recognition_sface_2021dec.onnx';
        const liveness = 'packages/face-engine/models/minifasnet_v2.onnx';

        // Only meaningful where the bundled models resolve from this cwd.
        if (!resolveModelPath(detector) || !resolveModelPath(embedder) || !resolveModelPath(liveness)) {
          return;
        }

        vi.stubEnv('NODE_ENV', 'development');
        vi.stubEnv('FACE_ENGINE_PROVIDER', 'real-local');
        vi.stubEnv('FACE_DETECTOR_MODEL_PATH', detector);
        vi.stubEnv('FACE_EMBEDDER_MODEL_PATH', embedder);
        vi.stubEnv('FACE_LIVENESS_MODEL_PATH', liveness);

        const engine = await getSharedFaceEngine();

        expect(await engine.isAvailable()).toBe(true);
        expect(engine.getModelVersion().toLowerCase()).not.toContain('mock');
        expect(engine.getModelVersion()).toMatch(/yunet/i);
      }, 60_000);

      it('requires liveness model in production real-local', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('FACE_ENGINE_PROVIDER', 'real-local');
        vi.stubEnv('FACE_DETECTOR_MODEL_PATH', 'packages/face-engine/models/face_detection_yunet_2023mar.onnx');
        vi.stubEnv('FACE_EMBEDDER_MODEL_PATH', 'packages/face-engine/models/face_recognition_sface_2021dec.onnx');
        vi.stubEnv('FACE_LIVENESS_MODEL_PATH', '/nonexistent/liveness.onnx');

        await expect(getSharedFaceEngine()).rejects.toThrow(
          /Production real-local engine requires model paths: FACE_LIVENESS_MODEL_PATH/,
        );
      });
    });

    describe('concurrency and caching', () => {
      it('shares the in-flight initialization promise across concurrent callers', async () => {
        vi.stubEnv('NODE_ENV', 'development');
        vi.stubEnv('FACE_ENGINE_PROVIDER', 'mock');

        const [engine1, engine2, engine3] = await Promise.all([
          getSharedFaceEngine(),
          getSharedFaceEngine(),
          getSharedFaceEngine(),
        ]);

        expect(engine1).toBeDefined();
        expect(engine1).toBe(engine2);
        expect(engine2).toBe(engine3);
      });

      it('reuses the cached engine on subsequent calls', async () => {
        vi.stubEnv('NODE_ENV', 'development');
        vi.stubEnv('FACE_ENGINE_PROVIDER', 'mock');

        const first = await getSharedFaceEngine();
        const second = await getSharedFaceEngine();

        expect(first).toBe(second);
      });

      it('cleans up initPromise on failure so subsequent calls can retry', async () => {
        vi.stubEnv('NODE_ENV', 'development');
        vi.stubEnv('FACE_ENGINE_PROVIDER', 'invalid-provider');

        // First call fails
        await expect(getSharedFaceEngine()).rejects.toThrow(/Invalid FACE_ENGINE_PROVIDER/);

        // Fix configuration and retry
        vi.stubEnv('FACE_ENGINE_PROVIDER', 'mock');
        const retried = await getSharedFaceEngine();

        expect(retried).toBeDefined();
        expect(await retried.isAvailable()).toBe(true);
      });

      it('resetSharedFaceEngineCache clears cached engine safely', async () => {
        vi.stubEnv('NODE_ENV', 'development');
        vi.stubEnv('FACE_ENGINE_PROVIDER', 'mock');

        const first = await getSharedFaceEngine();
        expect(first).toBeDefined();

        resetSharedFaceEngineCache();

        const second = await getSharedFaceEngine();
        expect(second).toBeDefined();
      });
    });
  });
});
