/**
 * FaceEngine port — the primary abstraction for all computer vision operations.
 *
 * This interface must be implemented by a concrete provider (e.g., ONNX Runtime,
 * TensorFlow Lite, or an external API). Mock implementations exist only for testing.
 *
 * IMPORTANT: No concrete ML model dependencies should be imported here.
 * This is a pure interface boundary.
 */

import type { BoundingBox, FaceEmbedding, QualityMetrics, LivenessResult } from '../domain/value-objects';

// ============================================================================
// Input/Output Types
// ============================================================================

export interface FaceDetectionInput {
  /** Raw image bytes (JPEG/PNG) */
  imageBuffer: Buffer;
  /** Image format */
  format: 'jpeg' | 'png';
}

export interface DetectedFace {
  /** Bounding box of the detected face */
  boundingBox: BoundingBox;
  /** Detection confidence (0-1) */
  confidence: number;
}

export interface QualityAssessmentInput {
  imageBuffer: Buffer;
  face: DetectedFace;
}

export interface LivenessCheckInput {
  imageBuffer: Buffer;
  face: DetectedFace;
}

export interface EmbeddingInput {
  imageBuffer: Buffer;
  face: DetectedFace;
}

export interface ComparisonInput {
  embeddingA: FaceEmbedding;
  embeddingB: FaceEmbedding;
}

// ============================================================================
// FaceEngine Interface
// ============================================================================

export interface FaceEngine {
  /**
   * Detect faces in an image.
   * Returns an empty array if no faces are found.
   * Throws EngineUnavailableError if the engine is not operational.
   */
  detectFaces(input: FaceDetectionInput): Promise<DetectedFace[]>;

  /**
   * Assess the quality of a detected face.
   * Returns quality metrics including sharpness, brightness, pose, etc.
   */
  assessQuality(input: QualityAssessmentInput): Promise<QualityMetrics>;

  /**
   * Perform liveness / presentation-attack detection.
   * Returns a decision: PASS, FAIL, UNCERTAIN, or UNAVAILABLE.
   */
  checkLiveness(input: LivenessCheckInput): Promise<LivenessResult>;

  /**
   * Generate a face embedding (feature vector) from an image.
   * Returns a fixed-dimensional vector that represents the face.
   */
  generateEmbedding(input: EmbeddingInput): Promise<FaceEmbedding>;

  /**
   * Compare two face embeddings and return a similarity score.
   * Returns a value between -1 and 1.
   */
  compareEmbeddings(input: ComparisonInput): Promise<number>;

  /**
   * Check if the engine is operational.
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get the embedding dimension for this engine's model.
   */
  getEmbeddingDimension(): number;

  /**
   * Get the model version string.
   */
  getModelVersion(): string;
}
