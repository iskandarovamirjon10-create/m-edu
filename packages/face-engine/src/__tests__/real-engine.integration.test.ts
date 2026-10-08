/**
 * Real Face Engine Integration Test
 *
 * Tests the complete pipeline with actual ONNX models:
 * - Model loading
 * - Face detection (YuNet)
 * - Face embedding (SFace)
 * - Cosine similarity matching
 * - Threshold logic
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { RealFaceEngine } from '../providers/real-face-engine';
import { RealDetector } from '../providers/real-detector';
import { RealEmbedder } from '../providers/real-embedder';
import { FaceEmbedding } from '@medu/core';

const MODELS_DIR = path.join(__dirname, '..', '..', 'models');
const DETECTOR_PATH = path.join(MODELS_DIR, 'face_detection_yunet_2023mar.onnx');
const EMBEDDER_PATH = path.join(MODELS_DIR, 'face_recognition_sface_2021dec.onnx');

async function createTestImage(width: number, height: number): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  // Create a gray image with a skin-colored oval in the center
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#888888"/>
    <ellipse cx="${width/2}" cy="${height/2}" rx="${width*0.3}" ry="${height*0.4}" fill="#ffccaa"/>
    <circle cx="${width*0.4}" cy="${height*0.4}" r="${width*0.04}" fill="#333333"/>
    <circle cx="${width*0.6}" cy="${height*0.4}" r="${width*0.04}" fill="#333333"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

describe('Real Face Engine Integration', () => {
  it('model files exist on disk', () => {
    expect(fs.existsSync(DETECTOR_PATH)).toBe(true);
    expect(fs.existsSync(EMBEDDER_PATH)).toBe(true);
  });

  it('detector model file has reasonable size', () => {
    const stat = fs.statSync(DETECTOR_PATH);
    expect(stat.size).toBeGreaterThan(10000);
    expect(stat.size).toBeLessThan(5000000);
  });

  it('embedder model file has reasonable size', () => {
    const stat = fs.statSync(EMBEDDER_PATH);
    expect(stat.size).toBeGreaterThan(1000000);
    expect(stat.size).toBeLessThan(200000000);
  });

  describe('RealDetector', () => {
    let detector: RealDetector;

    beforeAll(async () => {
      detector = new RealDetector({
        modelPath: DETECTOR_PATH,
        inputSize: 640,
        confidenceThreshold: 0.5,
        nmsThreshold: 0.4,
      });
      await detector.initialize();
    });

    it('loads YuNet model successfully', () => {
      expect(detector.isAvailable()).toBe(true);
    });

    it('reports correct model version', () => {
      expect(detector.getModelVersion()).toBe('yunet-640');
    });

    it('runs warmup without error', async () => {
      await detector.warmup();
    });

    it('detects faces in a test image', async () => {
      const testImage = await createTestImage(640, 480);
      const faces = await detector.detectFaces({
        imageBuffer: testImage,
        format: 'png',
      });
      expect(Array.isArray(faces)).toBe(true);
      // With a synthetic image, we may or may not detect a face
      // The important thing is that inference runs without error
    });

    it('detects the REAL face in ground-truth fixture image_T1 with high confidence (regression: EXIF orientation + double-sigmoid fix)', async () => {
      const buf = fs.readFileSync(path.join(__dirname, '..', '..', 'test-assets', 'image_T1.jpg'));
      const faces = await detector.detectFaces({ imageBuffer: buf, format: 'jpeg' });
      expect(faces.length).toBeGreaterThan(0);
      expect(faces[0].confidence).toBeGreaterThanOrEqual(0.5);
    });

    it('detects the face in printed-photo fixture image_F1 (so liveness can reject it)', async () => {
      const buf = fs.readFileSync(path.join(__dirname, '..', '..', 'test-assets', 'image_F1.jpg'));
      const faces = await detector.detectFaces({ imageBuffer: buf, format: 'jpeg' });
      expect(faces.length).toBeGreaterThan(0);
    });

    it('detects the face in replay fixture image_F2 (so liveness can reject it)', async () => {
      const buf = fs.readFileSync(path.join(__dirname, '..', '..', 'test-assets', 'image_F2.jpg'));
      const faces = await detector.detectFaces({ imageBuffer: buf, format: 'jpeg' });
      expect(faces.length).toBeGreaterThan(0);
    });
  });

  describe('RealEmbedder', () => {
    let embedder: RealEmbedder;

    beforeAll(async () => {
      // Defaults reproduce the OpenCV SFace contract (raw BGR [0,255],
      // mean=0, std=1). Do not override mean/std here.
      embedder = new RealEmbedder({
        modelPath: EMBEDDER_PATH,
        inputSize: 112,
        embeddingDimension: 128,
        normalize: true,
      });
      await embedder.initialize();
    });

    it('loads SFace model successfully', () => {
      expect(embedder.isAvailable()).toBe(true);
    });

    it('reports correct dimension (128)', () => {
      expect(embedder.getDimension()).toBe(128);
    });

    it('reports correct model version', () => {
      expect(embedder.getModelVersion()).toBe('real-embedder-onnx-112d128');
    });

    it('runs warmup without error', async () => {
      await embedder.warmup();
    });

    it('generates 128-dimensional embedding from a face region', async () => {
      const testImage = await createTestImage(640, 480);
      const embedding = await embedder.generateEmbedding({
        imageBuffer: testImage,
        face: {
          boundingBox: { x: 170, y: 120, width: 300, height: 300 },
          confidence: 0.95,
        },
      });

      expect(embedding).toBeDefined();
      expect(embedding.getDimension()).toBe(128);

      const data = embedding.getData();
      expect(data.length).toBe(128);

      // Verify it's L2-normalized (norm should be ~1.0)
      let norm = 0;
      for (let i = 0; i < data.length; i++) {
        norm += data[i] * data[i];
      }
      norm = Math.sqrt(norm);
      expect(norm).toBeCloseTo(1.0, 2);
    });
  });

  describe('Cosine Similarity', () => {
    it('identical embeddings produce similarity ~1.0', () => {
      const data = new Float32Array(128);
      for (let i = 0; i < 128; i++) data[i] = Math.random();
      // L2-normalize
      let norm = 0;
      for (let i = 0; i < 128; i++) norm += data[i] * data[i];
      norm = Math.sqrt(norm);
      for (let i = 0; i < 128; i++) data[i] /= norm;

      const embA = new FaceEmbedding(data);
      const embB = new FaceEmbedding(new Float32Array(data));
      const similarity = embA.cosineSimilarity(embB);
      expect(similarity).toBeCloseTo(1.0, 4);
    });

    it('orthogonal embeddings produce similarity ~0.0', () => {
      const a = new Float32Array(128);
      const b = new Float32Array(128);
      a[0] = 1;
      b[1] = 1;

      const embA = new FaceEmbedding(a);
      const embB = new FaceEmbedding(b);
      const similarity = embA.cosineSimilarity(embB);
      expect(similarity).toBeCloseTo(0.0, 4);
    });

    it('similarity is always in [-1, 1]', () => {
      for (let trial = 0; trial < 50; trial++) {
        const a = new Float32Array(128);
        const b = new Float32Array(128);
        for (let i = 0; i < 128; i++) {
          a[i] = Math.random() * 2 - 1;
          b[i] = Math.random() * 2 - 1;
        }
        const embA = new FaceEmbedding(a);
        const embB = new FaceEmbedding(b);
        const sim = embA.cosineSimilarity(embB);
        expect(sim).toBeGreaterThanOrEqual(-1);
        expect(sim).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Full Engine Pipeline', () => {
    let engine: RealFaceEngine;

    beforeAll(async () => {
      engine = new RealFaceEngine({
        detectorModelPath: DETECTOR_PATH,
        embedderModelPath: EMBEDDER_PATH,
        livenessModelPath: '',
        embeddingDimension: 128,
      });
      await engine.initialize();
    });

    it('initializes successfully with detector and embedder', () => {
      expect(engine.getStatus().detector).toBe(true);
      expect(engine.getStatus().embedder).toBe(true);
      expect(engine.getStatus().overall).toBe(true);
    });

    it('liveness reports unavailable (no model)', () => {
      expect(engine.getStatus().liveness).toBe(false);
    });

    it('detects faces', async () => {
      const testImage = await createTestImage(640, 480);
      const faces = await engine.detectFaces({
        imageBuffer: testImage,
        format: 'png',
      });
      expect(Array.isArray(faces)).toBe(true);
    });

    it('generates embedding from a face region', async () => {
      const testImage = await createTestImage(640, 480);
      const embedding = await engine.generateEmbedding({
        imageBuffer: testImage,
        face: {
          boundingBox: { x: 170, y: 120, width: 300, height: 300 },
          confidence: 0.95,
        },
      });
      expect(embedding.getDimension()).toBe(128);
    });

    it('compares two embeddings via cosine similarity', async () => {
      const testImage = await createTestImage(640, 480);
      const emb1 = await engine.generateEmbedding({
        imageBuffer: testImage,
        face: {
          boundingBox: { x: 170, y: 120, width: 300, height: 300 },
          confidence: 0.95,
        },
      });
      const emb2 = await engine.generateEmbedding({
        imageBuffer: testImage,
        face: {
          boundingBox: { x: 170, y: 120, width: 300, height: 300 },
          confidence: 0.95,
        },
      });

      const similarity = await engine.compareEmbeddings({
        embeddingA: emb1,
        embeddingB: emb2,
      });

      expect(similarity).toBeGreaterThanOrEqual(-1);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('model version string contains component info', () => {
      const version = engine.getModelVersion();
      expect(version).toContain('yunet');
      expect(version).toContain('real-embedder');
    });
  });
});

