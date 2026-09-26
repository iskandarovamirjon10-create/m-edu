/**
 * Regression: a CONFIGURED liveness model that fails to load must abort engine
 * initialization instead of degrading to UNAVAILABLE.
 *
 * Why this matters in production: `RealFaceEngine.getStatus()` computes
 * `overall` from detector && embedder only. Before this guard, a liveness model
 * that passed file/hash validation but whose ONNX session could not be created
 * (corrupt graph, unsupported opset, missing native onnxruntime binding — a real
 * risk on the musl-based api image) only produced a warning. The engine then
 * reported itself ready, the camera workers stayed RUNNING, and
 * `checkLiveness()` answered UNAVAILABLE for every frame.
 *
 * The worker gate is `if (liveness.decision !== 'PASS') continue;`, so that
 * combination is a silent total outage: a centre with healthy-looking workers
 * and zero attendance records.
 *
 * The liveness model is mocked as "validates on disk, will not load" so the
 * real model file and its pinned SHA-256 are still exercised.
 */

import { describe, it, expect, vi } from 'vitest';
import * as path from 'path';

vi.mock('../providers/real-liveness', () => ({
  RealLivenessChecker: class {
    /** Mirrors a load failure: initialize() swallows it and stays unavailable. */
    async initialize(): Promise<void> {}
    async warmup(): Promise<void> {}
    isAvailable(): boolean {
      return false;
    }
    getModelVersion(): string {
      return 'unavailable-liveness-stub';
    }
  },
}));

import { RealFaceEngine } from '../providers/real-face-engine';

const MODELS_DIR = path.join(__dirname, '..', '..', 'models');
const DETECTOR_PATH = path.join(MODELS_DIR, 'face_detection_yunet_2023mar.onnx');
const EMBEDDER_PATH = path.join(MODELS_DIR, 'face_recognition_sface_2021dec.onnx');
const LIVENESS_PATH = path.join(MODELS_DIR, 'minifasnet_v2.onnx');

describe('RealFaceEngine — liveness is fail-closed', () => {
  it('refuses to initialize when a configured liveness model fails to load', async () => {
    const engine = new RealFaceEngine({
      detectorModelPath: DETECTOR_PATH,
      embedderModelPath: EMBEDDER_PATH,
      livenessModelPath: LIVENESS_PATH,
    });

    await expect(engine.initialize()).rejects.toThrow(/anti-spoofing gate/);
  });

  it('still starts when liveness is genuinely not configured (optional in development)', async () => {
    const engine = new RealFaceEngine({
      detectorModelPath: DETECTOR_PATH,
      embedderModelPath: EMBEDDER_PATH,
      livenessModelPath: '',
    });

    await expect(engine.initialize()).resolves.toBeUndefined();
    await expect(engine.isAvailable()).resolves.toBe(true);
  });
});
