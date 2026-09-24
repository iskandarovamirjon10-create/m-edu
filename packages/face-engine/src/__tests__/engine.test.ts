import { describe, it, expect } from 'vitest';
import { MockDetector } from '../mock-detector';
import { MockEmbedder } from '../mock-embedder';
import { MockLivenessChecker } from '../mock-liveness';
import { MockMatcher } from '../mock-matcher';
import { FaceEmbedding } from '@medu/core';

const dummyImage = Buffer.from('test-image');

describe('MockDetector', () => {
  const detector = new MockDetector();

  it('detects at least one face', async () => {
    const faces = await detector.detectFaces({ imageBuffer: dummyImage, format: 'jpeg' });
    expect(faces.length).toBeGreaterThanOrEqual(1);
  });

  it('returns valid bounding box', async () => {
    const faces = await detector.detectFaces({ imageBuffer: dummyImage, format: 'jpeg' });
    expect(faces[0].boundingBox).toHaveProperty('x');
    expect(faces[0].boundingBox).toHaveProperty('width');
    expect(faces[0].confidence).toBeGreaterThan(0);
  });

  it('is available', () => {
    expect(detector.isAvailable()).toBe(true);
  });
});

describe('MockEmbedder', () => {
  const embedder = new MockEmbedder();

  it('generates embedding with correct dimension', async () => {
    const emb = await embedder.generateEmbedding({ imageBuffer: dummyImage, face: { boundingBox: { x: 0, y: 0, width: 100, height: 100 }, confidence: 0.9 } });
    expect(emb.getDimension()).toBe(512);
  });

  it('returns consistent model version', () => {
    expect(embedder.getModelVersion()).toBe('mock-v1.0.0');
  });
});

describe('MockLivenessChecker', () => {
  const checker = new MockLivenessChecker();

  it('always passes (mock)', async () => {
    const result = await checker.checkLiveness({ imageBuffer: dummyImage, face: { boundingBox: { x: 0, y: 0, width: 100, height: 100 }, confidence: 0.9 } });
    expect(result.decision).toBe('PASS');
  });
});

describe('MockMatcher', () => {
  const matcher = new MockMatcher();

  it('returns similarity score between -1 and 1', async () => {
    const a = new FaceEmbedding([1, 0, 0]);
    const b = new FaceEmbedding([0, 1, 0]);
    const score = await matcher.compareEmbeddings({ embeddingA: a, embeddingB: b });
    expect(score).toBeGreaterThanOrEqual(-1);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('returns 1.0 for identical embeddings', async () => {
    const a = new FaceEmbedding([1, 0, 0]);
    const score = await matcher.compareEmbeddings({ embeddingA: a, embeddingB: a });
    expect(score).toBeCloseTo(1.0);
  });
});
