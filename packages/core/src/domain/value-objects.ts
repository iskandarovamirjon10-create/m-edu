/**
 * Value objects for the face recognition domain.
 * These encapsulate business rules and validation at the domain level.
 */

// ============================================================================
// BoundingBox — face location within an image
// ============================================================================

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ============================================================================
// FaceEmbedding — fixed-dimensional vector representation of a face
// ============================================================================

/**
 * FaceEmbedding represents a vector of floating-point numbers
 * that uniquely represents a face.
 *
 * The dimension depends on the ML model used:
 * - FaceNet: 128, 512
 * - ArcFace: 512
 * - VGGFace2: 4096
 *
 * We store this as a Float32Array for efficient computation.
 */
export class FaceEmbedding {
  private readonly data: Float32Array;

  constructor(data: Float32Array | number[]) {
    if (!data || data.length === 0) {
      throw new Error('Face embedding must have at least one dimension');
    }
    this.data = data instanceof Float32Array ? data : new Float32Array(data);
  }

  /** Get the raw embedding data */
  getData(): Float32Array {
    return this.data;
  }

  /** Get embedding dimension */
  getDimension(): number {
    return this.data.length;
  }

  /** Serialize to JSON-storable format */
  serialize(): string {
    // Store length prefix + raw float32 data so we can deserialize correctly
    const lengthBuffer = Buffer.alloc(4);
    lengthBuffer.writeUInt32LE(this.data.length, 0);
    const dataBuffer = Buffer.from(this.data.buffer, this.data.byteOffset, this.data.byteLength);
    return Buffer.concat([lengthBuffer, dataBuffer]).toString('base64');
  }

  /** Deserialize from JSON format */
  static deserialize(base64: string): FaceEmbedding {
    const buffer = Buffer.from(base64, 'base64');
    const length = buffer.readUInt32LE(0);
    const floatBuffer = buffer.slice(4, 4 + length * 4);
    return new FaceEmbedding(new Float32Array(floatBuffer.buffer, floatBuffer.byteOffset, length));
  }

  /** Compute cosine similarity with another embedding */
  cosineSimilarity(other: FaceEmbedding): number {
    if (this.data.length !== other.data.length) {
      throw new Error(
        `Embedding dimension mismatch: ${this.data.length} vs ${other.data.length}`
      );
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < this.data.length; i++) {
      dotProduct += this.data[i] * other.data[i];
      normA += this.data[i] * this.data[i];
      normB += other.data[i] * other.data[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;

    const result = dotProduct / denominator;
    return Math.min(1, Math.max(-1, result));
  }
}

// ============================================================================
// SimilarityScore — typed wrapper for similarity computation results
// ============================================================================

export class SimilarityScore {
  constructor(
    public readonly value: number,
    public readonly threshold: number
  ) {
    if (value < -1 || value > 1) {
      throw new Error(`Similarity score must be between -1 and 1, got ${value}`);
    }
  }

  isMatch(): boolean {
    return this.value >= this.threshold;
  }

  isUncertain(margin: number = 0.1): boolean {
    const distance = Math.abs(this.value - this.threshold);
    return distance < margin;
  }

  getConfidence(): 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' {
    if (this.value >= 0.8) return 'HIGH';
    if (this.value >= 0.7) return 'MEDIUM';
    if (this.value >= this.threshold) return 'LOW';
    return 'NONE';
  }
}

// ============================================================================
// QualityMetrics — face image quality assessment
// ============================================================================

export interface QualityMetrics {
  /** Overall quality score (0-1) */
  overallScore: number;
  /** Sharpness / blur detection */
  sharpness: number;
  /** Brightness level */
  brightness: number;
  /** Face size relative to image */
  faceSizeRatio: number;
  /** Pose angle (yaw, pitch, roll) */
  pose: { yaw: number; pitch: number; roll: number };
  /** Whether the face passes minimum quality threshold */
  passesThreshold: boolean;
  /** Rejection reason if face fails quality or pose */
  rejectionReason?: string;
  /** List of quality issues identified */
  issues?: string[];
}

// ============================================================================
// LivenessResult — outcome of liveness check
// ============================================================================

export interface LivenessResult {
  decision: 'PASS' | 'FAIL' | 'UNCERTAIN' | 'UNAVAILABLE';
  confidence: number;
  /** Provider-specific details (never exposed to client) */
  details?: Record<string, unknown>;
}
