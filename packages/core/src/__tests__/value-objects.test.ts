import { describe, it, expect } from 'vitest';
import { FaceEmbedding, SimilarityScore } from '../domain/value-objects';

describe('FaceEmbedding', () => {
  it('creates from number array', () => {
    const emb = new FaceEmbedding([1, 2, 3]);
    expect(emb.getDimension()).toBe(3);
    expect(emb.getData()).toEqual(new Float32Array([1, 2, 3]));
  });

  it('creates from Float32Array', () => {
    const data = new Float32Array([0.1, 0.2]);
    const emb = new FaceEmbedding(data);
    expect(emb.getDimension()).toBe(2);
  });

  it('throws on empty data', () => {
    expect(() => new FaceEmbedding([])).toThrow();
  });

  it('serializes and deserializes correctly', () => {
    const original = new FaceEmbedding([0.5, -0.3, 0.8]);
    const serialized = original.serialize();
    const restored = FaceEmbedding.deserialize(serialized);
    expect(restored.getDimension()).toBe(3);
    expect(Array.from(restored.getData())).toEqual(Array.from(original.getData()));
  });

  it('computes cosine similarity', () => {
    const a = new FaceEmbedding([1, 0, 0]);
    const b = new FaceEmbedding([1, 0, 0]);
    expect(a.cosineSimilarity(b)).toBeCloseTo(1.0);

    const c = new FaceEmbedding([0, 1, 0]);
    expect(a.cosineSimilarity(c)).toBeCloseTo(0.0);
  });

  it('throws on dimension mismatch', () => {
    const a = new FaceEmbedding([1, 2]);
    const b = new FaceEmbedding([1, 2, 3]);
    expect(() => a.cosineSimilarity(b)).toThrow();
  });
});

describe('SimilarityScore', () => {
  it('creates with valid value', () => {
    const score = new SimilarityScore(0.8, 0.6);
    expect(score.value).toBe(0.8);
    expect(score.threshold).toBe(0.6);
  });

  it('determines match correctly', () => {
    expect(new SimilarityScore(0.8, 0.6).isMatch()).toBe(true);
    expect(new SimilarityScore(0.4, 0.6).isMatch()).toBe(false);
  });

  it('detects uncertain zone', () => {
    expect(new SimilarityScore(0.61, 0.6).isUncertain(0.1)).toBe(true);
    expect(new SimilarityScore(0.9, 0.6).isUncertain(0.1)).toBe(false);
  });

  it('categorizes confidence correctly', () => {
    expect(new SimilarityScore(0.85, 0.6).getConfidence()).toBe('HIGH');
    expect(new SimilarityScore(0.7, 0.6).getConfidence()).toBe('MEDIUM');
    expect(new SimilarityScore(0.62, 0.6).getConfidence()).toBe('LOW');
    expect(new SimilarityScore(0.3, 0.6).getConfidence()).toBe('NONE');
  });

  it('rejects out-of-range values', () => {
    expect(() => new SimilarityScore(1.5, 0.6)).toThrow();
    expect(() => new SimilarityScore(-2, 0.6)).toThrow();
  });
});
