/**
 * Face engine types — shared type definitions for engine implementations.
 */

export interface EngineConfig {
  /** Path to ONNX/TFLite model files */
  modelPath: string;
  /** Device to run inference on */
  device: 'cpu' | 'cuda' | 'gpu';
  /** Maximum batch size for embedding generation */
  maxBatchSize: number;
  /** Inference timeout in milliseconds */
  timeoutMs: number;
}

export interface EngineCapabilities {
  detection: boolean;
  qualityAssessment: boolean;
  livenessDetection: boolean;
  embedding: boolean;
  matching: boolean;
}
