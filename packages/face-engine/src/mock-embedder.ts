/**
 * Mock Embedding Generator — FOR TESTING ONLY.
 *
 * Generates random embeddings for testing the pipeline.
 * This should NEVER be used in production.
 *
 * In production, replace with:
 * - ArcFace (512-dim)
 * - FaceNet (128/512-dim)
 * - VGGFace2 (4096-dim)
 */

import { FaceEmbedding } from '@medu/core';
import type { EmbeddingInput } from '@medu/core';
import { randomBytes } from 'crypto';

const EMBEDDING_DIMENSION = 512;

export class MockEmbedder {
  /**
   * Mock embedding — generates a random vector.
   * For real deployment, use a proper ML model.
   */
  async generateEmbedding(_input: EmbeddingInput): Promise<FaceEmbedding> {
    const data = new Float32Array(EMBEDDING_DIMENSION);
    for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
      data[i] = (randomBytes(4).readFloatLE(0));
    }
    // Normalize
    const norm = Math.sqrt(data.reduce((sum, v) => sum + v * v, 0));
    for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
      data[i] /= norm;
    }
    return new FaceEmbedding(data);
  }

  getDimension(): number {
    return EMBEDDING_DIMENSION;
  }

  getModelVersion(): string {
    return 'mock-v1.0.0';
  }
}
