import { Logger } from '@nestjs/common';
import type { FaceEngine } from '@medu/core';

let cachedEngine: FaceEngine | null = null;
let isInitializing = false;

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
    if (provider === 'real-local') {
      const { RealFaceEngine } = await import('@medu/face-engine');
      const detectorModelPath = process.env.DETECTOR_MODEL_PATH || 'models/scrfd_500m_bnkps.onnx';
      const embedderModelPath = process.env.EMBEDDER_MODEL_PATH || 'models/minifasnet.onnx';
      
      const engine = new RealFaceEngine({ detectorModelPath, embedderModelPath, livenessModelPath: embedderModelPath, matchingThreshold: 0.6 });
      await engine.initialize();
      cachedEngine = engine;
    } else if (provider === 'mock') {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('FACE_ENGINE_PROVIDER must be configured in production. Mock engines are forbidden.');
      }
      const { SimpleFaceEngine, MockDetector, MockEmbedder, MockLivenessChecker, MockMatcher } = await import('@medu/core');
      const engine = new SimpleFaceEngine(new MockDetector(), new MockEmbedder(), new MockLivenessChecker(), new MockMatcher());
      cachedEngine = engine as unknown as FaceEngine;
    } else {
      throw new Error(Invalid FACE_ENGINE_PROVIDER value: "".);
    }
    return cachedEngine;
  } finally {
    isInitializing = false;
  }
}
