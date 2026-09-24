/**
 * Mock Face Detector — FOR TESTING ONLY.
 *
 * This mock is explicitly documented as a test helper.
 * It should NEVER be used in production.
 *
 * In production, this must be replaced with a real implementation
 * using ONNX Runtime, TensorFlow Lite, or a similar ML inference runtime.
 *
 * Architecture requirement:
 * - Implement the FaceEngine interface from @medu/core
 * - Use a real face detection model (e.g., RetinaFace, MTCNN, SCRFD)
 * - Run inference via ONNX Runtime or TFLite
 */

import type { FaceDetectionInput, DetectedFace } from '@medu/core';

export class MockDetector {
  /**
   * Mock detection — always finds a single face at a fixed location.
   * This is ONLY for unit/integration testing.
   */
  async detectFaces(_input: FaceDetectionInput): Promise<DetectedFace[]> {
    return [
      {
        boundingBox: { x: 50, y: 50, width: 200, height: 200 },
        confidence: 0.95,
      },
    ];
  }

  isAvailable(): boolean {
    return true;
  }
}
