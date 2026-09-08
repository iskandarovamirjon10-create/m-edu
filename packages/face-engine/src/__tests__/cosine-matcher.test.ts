import { describe, it, expect } from 'vitest';
import { FaceEmbedding } from '@medu/core';

describe('Cosine Similarity Matcher (mathematical validation)', () => {
  describe('identical vectors', () => {
    it('cosine(a, a) ≈ 1.0', () => {
      const a = new FaceEmbedding([1, 0, 0, 0, 0]);
      const similarity = a.cosineSimilarity(a);
      expect(similarity).toBeCloseTo(1.0, 5);
    });

    it('cosine with itself after normalization', () => {
      const data = new Float32Array(512);
      for (let i = 0; i < 512; i++) data[i] = Math.sin(i) * 0.1;
      const a = new FaceEmbedding(data);
      const similarity = a.cosineSimilarity(a);
      expect(similarity).toBeCloseTo(1.0, 5);
    });
  });

  describe('orthogonal vectors', () => {
    it('cosine([1,0], [0,1]) = 0', () => {
      const a = new FaceEmbedding([1, 0]);
      const b = new FaceEmbedding([0, 1]);
      const similarity = a.cosineSimilarity(b);
      expect(similarity).toBeCloseTo(0.0, 5);
    });

    it('cosine with orthogonal high-dim vectors', () => {
      const aData = new Float32Array(512);
      const bData = new Float32Array(512);
      // Make them orthogonal: a = [1,1,0,0,...], b = [0,0,1,1,...]
      aData[0] = 1; aData[1] = 1;
      bData[2] = 1; bData[3] = 1;
      const a = new FaceEmbedding(aData);
      const b = new FaceEmbedding(bData);
      const similarity = a.cosineSimilarity(b);
      expect(similarity).toBeCloseTo(0.0, 5);
    });
  });

  describe('opposite vectors', () => {
    it('cosine([1,0], [-1,0]) = -1', () => {
      const a = new FaceEmbedding([1, 0]);
      const b = new FaceEmbedding([-1, 0]);
      const similarity = a.cosineSimilarity(b);
      expect(similarity).toBeCloseTo(-1.0, 5);
    });
  });

  describe('similar vs dissimilar', () => {
    it('similar embeddings have higher similarity', () => {
      const a = new FaceEmbedding([0.1, 0.2, 0.3, 0.4, 0.5]);
      const bSimilar = new FaceEmbedding([0.11, 0.21, 0.29, 0.41, 0.49]);
      const bDissimilar = new FaceEmbedding([0.5, 0.4, 0.3, 0.2, 0.1]);

      const simSimilar = a.cosineSimilarity(bSimilar);
      const simDissimilar = a.cosineSimilarity(bDissimilar);

      expect(simSimilar).toBeGreaterThan(simDissimilar);
    });
  });

  describe('range validation', () => {
    it('similarity is always in [-1, 1]', () => {
      for (let trial = 0; trial < 100; trial++) {
        const dim = 512;
        const aData = new Float32Array(dim);
        const bData = new Float32Array(dim);
        for (let i = 0; i < dim; i++) {
          aData[i] = Math.random() * 2 - 1;
          bData[i] = Math.random() * 2 - 1;
        }
        const a = new FaceEmbedding(aData);
        const b = new FaceEmbedding(bData);
        const similarity = a.cosineSimilarity(b);
        expect(similarity).toBeGreaterThanOrEqual(-1.001);
        expect(similarity).toBeLessThanOrEqual(1.001);
      }
    });
  });

  describe('zero vector handling', () => {
    it('handles zero vectors gracefully', () => {
      const a = new FaceEmbedding([0, 0, 0]);
      const b = new FaceEmbedding([1, 0, 0]);
      // Should not throw, result may be 0 or NaN depending on implementation
      expect(() => a.cosineSimilarity(b)).not.toThrow();
    });
  });

  describe('consistency', () => {
    it('cosine(a, b) == cosine(b, a) (symmetry)', () => {
      const a = new FaceEmbedding([0.1, 0.3, 0.5, 0.7, 0.9]);
      const b = new FaceEmbedding([0.2, 0.4, 0.6, 0.8, 1.0]);
      const simAB = a.cosineSimilarity(b);
      const simBA = b.cosineSimilarity(a);
      expect(simAB).toBeCloseTo(simBA, 5);
    });
  });
});
