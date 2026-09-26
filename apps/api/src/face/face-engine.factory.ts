import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import type { FaceEngine } from '@medu/core';

let cachedEngine: FaceEngine | null = null;
let isInitializing = false;

/** Test-only: clear the process-wide engine cache so env/provider checks re-run. */
export function resetSharedFaceEngineCache(): void {
  cachedEngine = null;
  isInitializing = false;
}

export function resolveModelPath(modelPath?: string): string {
  if (!modelPath) return '';
  try {
    if (path.isAbsolute(modelPath) && fs.existsSync(modelPath)) {
      return modelPath;
    }

    const clean = modelPath.replace(/^[./\\]+/, '');
    const basename = path.basename(modelPath);

    const candidates = [
      modelPath,
      path.resolve(process.cwd(), modelPath),
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
      if (fs.existsSync(candidate)) {
        return path.resolve(candidate);
      }
    }
  } catch {
    // Ignore filesystem scan errors
  }

  return modelPath;
}

export async function getSharedFaceEngine(): Promise<FaceEngine> {
  if (cachedEngine) return cachedEngine;
  if (isInitializing) {
    while (isInitializing) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return cachedEngine!;
  }
  isInitializing = true;
  try {
    const provider = process.env.FACE_ENGINE_PROVIDER || 'mock';
    // "mock-dev" is a legacy alias for "mock". It shipped in .env.example for a
    // long time, so existing development environments still carry it; rejecting
    // it would leave them without a face engine (and, before this, unable to boot).
    if (provider === 'real-local') {
      const { RealFaceEngine } = await import('@medu/face-engine');
      const missing: string[] = [];
      const detectorModelPath = resolveModelPath(process.env.FACE_DETECTOR_MODEL_PATH || '');
      const embedderModelPath = resolveModelPath(process.env.FACE_EMBEDDER_MODEL_PATH || '');
      const livenessModelPath = resolveModelPath(process.env.FACE_LIVENESS_MODEL_PATH || '');
      if (!detectorModelPath) missing.push('FACE_DETECTOR_MODEL_PATH');
      if (!embedderModelPath) missing.push('FACE_EMBEDDER_MODEL_PATH');
      if (process.env.NODE_ENV === 'production' && !livenessModelPath) {
        missing.push('FACE_LIVENESS_MODEL_PATH');
      }
      if (missing.length > 0) {
        const list = missing.join(', ');
        if (process.env.NODE_ENV === 'production') {
          throw new Error(`Production real-local engine requires model paths: ${list}`);
        }
        // eslint-disable-next-line no-console
        console.warn(`[face-engine.factory] Missing model paths: ${list}`);
      }
      const engine = new RealFaceEngine({
        detectorModelPath,
        embedderModelPath,
        livenessModelPath,
        embeddingDimension: 128,
      });
      await engine.initialize();
      cachedEngine = engine;
    } else if (provider === 'mock' || provider === 'mock-dev') {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('FACE_ENGINE_PROVIDER must be configured in production. Mock engines are forbidden.');
      }
      
      cachedEngine = {
        detectFaces: async () => [{ boundingBox: { x: 0, y: 0, width: 100, height: 100 }, confidence: 0.99 }],
        assessQuality: async () => ({ overallScore: 0.9, sharpness: 0.9, brightness: 0.9, pose: { yaw: 0, pitch: 0, roll: 0 }, issues: [] }),
        checkLiveness: async () => ({ decision: 'PASS' as any, score: 0.99, isSpoof: false }),
        extractEmbedding: async () => ({ version: '1', vector: new Float32Array(128) }),
        compareEmbeddings: async () => ({ similarity: 0.9, matches: true }),
        initialize: async () => {},
        isReady: () => true,
        generateEmbedding: async () => ({ version: '1', vector: new Float32Array(128) }),
        isAvailable: () => true,
        getEmbeddingDimension: () => 128,
        getModelVersion: () => 'mock'
      } as unknown as FaceEngine;

    } else {
      throw new Error(
        `Invalid FACE_ENGINE_PROVIDER value: "${provider}". Valid values: "real-local", "mock".`,
      );
    }
    return cachedEngine;
  } finally {
    isInitializing = false;
  }
}

