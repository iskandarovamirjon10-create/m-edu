import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import { FaceEngine, FaceEmbedding } from '@medu/core';

const logger = new Logger('FaceEngineFactory');

let cachedEngine: FaceEngine | null = null;
let cachedProvider: string | null = null;
let initPromise: Promise<FaceEngine> | null = null;

/**
 * Resolve the configured face engine provider.
 *
 * Fail closed: an UNSET variable resolves to `real-local`, never `mock`.
 * Previously the default was `mock`, so forgetting the variable silently
 * enabled fabricated detections/liveness and random embeddings — the exact
 * production-blocking bug this module exists to prevent. Startup config
 * validation (`config.validate.ts`) also requires FACE_ENGINE_PROVIDER.
 *
 * Pure and exported so the provider resolution that FaceService reports
 * through `getEngineStatus()` can be unit-tested independently of any ONNX
 * model being present.
 */
export function resolveFaceEngineProvider(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return env.FACE_ENGINE_PROVIDER || 'real-local';
}

/** Test-only: safely reset the process-wide engine cache and initialization state. */
export function resetSharedFaceEngineCache(): void {
  cachedEngine = null;
  cachedProvider = null;
  initPromise = null;
}

/**
 * Harden model-path resolution:
 * - resolve only trusted/local filesystem paths
 * - prevent null byte injections and path traversal surprises
 * - verify files exist and are regular files
 * - avoid silently returning a nonexistent path (returns '' when not found)
 */
export function resolveModelPath(modelPath?: string): string {
  if (!modelPath || typeof modelPath !== 'string' || !modelPath.trim()) {
    return '';
  }

  if (modelPath.includes('\0')) {
    return '';
  }

  const trimmed = modelPath.trim();

  const isRegularFile = (p: string): boolean => {
    try {
      const stat = fs.statSync(p);
      return stat.isFile() && stat.size > 0;
    } catch {
      return false;
    }
  };

  if (path.isAbsolute(trimmed)) {
    const normalized = path.normalize(trimmed);
    return isRegularFile(normalized) ? normalized : '';
  }

  const clean = trimmed.replace(/^[./\\]+/, '');
  const basename = path.basename(trimmed);

  const candidates: string[] = [
    path.resolve(process.cwd(), trimmed),
    path.resolve(process.cwd(), clean),
    path.resolve(process.cwd(), '..', clean),
    path.resolve(process.cwd(), '..', '..', clean),
    path.resolve('/app', clean),
    path.resolve('/app/packages/face-engine/models', basename),
    path.resolve(__dirname, '..', '..', '..', 'packages', 'face-engine', 'models', basename),
    path.resolve(__dirname, '..', '..', clean),
  ];

  const lowerBasename = basename.toLowerCase();
  if (lowerBasename.includes('minifasnet')) {
    candidates.push(
      path.resolve('/app/packages/face-engine/models/minifasnet_v2.onnx'),
      path.resolve(process.cwd(), 'packages/face-engine/models/minifasnet_v2.onnx'),
      path.resolve(process.cwd(), '../packages/face-engine/models/minifasnet_v2.onnx'),
      path.resolve(__dirname, '..', '..', '..', 'packages', 'face-engine', 'models', 'minifasnet_v2.onnx'),
    );
  }

  for (const candidate of candidates) {
    const normalized = path.normalize(candidate);
    if (isRegularFile(normalized)) {
      return normalized;
    }
  }

  return '';
}

/**
 * Concurrency-safe factory for the shared FaceEngine singleton.
 *
 * Rules:
 * - Uses a shared initialization Promise; concurrent callers share in-flight promise.
 * - If initialization fails, all concurrent callers receive the same error and initPromise resets so retries work.
 * - Never allows "mock" or "mock-dev" in production.
 * - Validates FACE_ENGINE_PROVIDER strictly ("real-local" or "mock").
 * - Verifies regular model files exist before instantiating RealFaceEngine.
 * - Never caches a failed or partially initialized engine.
 */
export async function getSharedFaceEngine(): Promise<FaceEngine> {
  const provider = resolveFaceEngineProvider();

  if (cachedEngine && cachedProvider === provider) {
    return cachedEngine;
  }

  if (initPromise) {
    return initPromise;
  }

  const createPromise = (async () => {
    try {
      if (process.env.NODE_ENV === 'production') {
        if (provider === 'mock' || provider === 'mock-dev') {
          throw new Error('FACE_ENGINE_PROVIDER must be configured in production. Mock engines are forbidden.');
        }
      }

      if (provider !== 'real-local' && provider !== 'mock') {
        throw new Error(
          `Invalid FACE_ENGINE_PROVIDER value: "${provider}". Valid values: "real-local", "mock".`,
        );
      }

      if (provider === 'real-local') {
        const { RealFaceEngine } = await import('@medu/face-engine');
        const defaultDetector = 'packages/face-engine/models/face_detection_yunet_2023mar.onnx';
        const defaultEmbedder = 'packages/face-engine/models/face_recognition_sface_2021dec.onnx';
        const defaultLiveness = 'packages/face-engine/models/minifasnet_v2.onnx';

        const detectorModelPath = resolveModelPath(process.env.FACE_DETECTOR_MODEL_PATH || defaultDetector);
        const embedderModelPath = resolveModelPath(process.env.FACE_EMBEDDER_MODEL_PATH || defaultEmbedder);
        const livenessModelPath = resolveModelPath(process.env.FACE_LIVENESS_MODEL_PATH || defaultLiveness);

        const missing: string[] = [];
        if (!detectorModelPath) missing.push('FACE_DETECTOR_MODEL_PATH');
        if (!embedderModelPath) missing.push('FACE_EMBEDDER_MODEL_PATH');
        if (process.env.NODE_ENV === 'production' && !livenessModelPath) {
          missing.push('FACE_LIVENESS_MODEL_PATH');
        }

        if (missing.length > 0) {
          const list = missing.join(', ');
          logger.warn(`Missing required face model paths: ${list}`);
          if (process.env.NODE_ENV === 'production') {
            throw new Error(`Production real-local engine requires model paths: ${list}`);
          }
          throw new Error(`Real-local engine requires model paths: ${list}`);
        }

        const passThreshold = process.env.FACE_LIVENESS_PASS_THRESHOLD
          ? parseFloat(process.env.FACE_LIVENESS_PASS_THRESHOLD)
          : (process.env.FACE_LIVENESS_THRESHOLD ? parseFloat(process.env.FACE_LIVENESS_THRESHOLD) : 0.5);
        const failThreshold = process.env.FACE_LIVENESS_FAIL_THRESHOLD
          ? parseFloat(process.env.FACE_LIVENESS_FAIL_THRESHOLD)
          : 0.2;

        const engine = new RealFaceEngine({
          detectorModelPath,
          embedderModelPath,
          livenessModelPath: livenessModelPath || '',
          embeddingDimension: 128,
          livenessPassThreshold: Number.isFinite(passThreshold) ? passThreshold : 0.5,
          livenessFailThreshold: Number.isFinite(failThreshold) ? failThreshold : 0.2,
        });

        await engine.initialize();
        cachedEngine = engine;
        cachedProvider = provider;
        return engine;
      }

      // Mock engine (non-production only)
      if (process.env.NODE_ENV === 'production') {
        throw new Error('FACE_ENGINE_PROVIDER must be configured in production. Mock engines are forbidden.');
      }

      const rand = (min: number, max: number) => +(min + Math.random() * (max - min)).toFixed(4);
      const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

      const mockEngine: FaceEngine = {
        detectFaces: async () => {
          await delay(rand(80, 250));
          return [{
            boundingBox: { x: rand(30, 70), y: rand(20, 60), width: rand(180, 240), height: rand(180, 240) },
            confidence: rand(0.92, 0.99),
          }];
        },
        assessQuality: async () => {
          await delay(rand(30, 100));
          return {
            overallScore: rand(0.82, 0.97),
            sharpness: rand(0.80, 0.96),
            brightness: rand(0.75, 0.95),
            faceSizeRatio: rand(0.35, 0.65),
            pose: { yaw: rand(-8, 8), pitch: rand(-5, 5), roll: rand(-3, 3) },
            passesThreshold: true,
            issues: [],
          };
        },
        checkLiveness: async () => {
          await delay(rand(60, 180));
          const confidence = rand(0.90, 0.99);
          return { decision: 'PASS' as const, confidence, score: confidence, isSpoof: false };
        },
        generateEmbedding: async () => {
          await delay(rand(50, 150));
          const vector = new Float32Array(128);
          for (let i = 0; i < 128; i++) vector[i] = (Math.random() - 0.5) * 2;
          const norm = Math.sqrt(vector.reduce((s, v) => s + v * v, 0));
          if (norm > 0) for (let i = 0; i < 128; i++) vector[i] /= norm;
          return new FaceEmbedding(vector);
        },
        compareEmbeddings: async (input) => {
          await delay(rand(20, 60));
          if (input?.embeddingA && input?.embeddingB) {
            try {
              const cos = input.embeddingA.cosineSimilarity(input.embeddingB);
              if (Number.isFinite(cos) && cos > 0.5) return cos;
            } catch {
              // fallback
            }
          }
          return rand(0.91, 0.98);
        },
        isAvailable: async () => true,
        getEmbeddingDimension: () => 128,
        getModelVersion: () => 'demo-v1.2',
      };

      cachedEngine = mockEngine;
      cachedProvider = provider;
      return mockEngine;
    } catch (err) {
      cachedEngine = null;
      cachedProvider = null;
      throw err;
    }
  })();

  initPromise = createPromise;

  createPromise
    .catch(() => {})
    .finally(() => {
      if (initPromise === createPromise) {
        initPromise = null;
      }
    });

  return createPromise;
}
