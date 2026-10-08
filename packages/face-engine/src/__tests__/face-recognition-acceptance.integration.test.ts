/**
 * Face recognition ACCEPTANCE tests — REAL ONNX engine only.
 *
 * No mock engine is used anywhere in this file. Every embedding, detection and
 * liveness decision below comes from the real YuNet + SFace + MiniFASNet models
 * in `packages/face-engine/models`.
 *
 * Fixtures (see test-assets/PROVENANCE.md):
 *   - image_T1.jpg : the enrolled person ("Amirjon") — genuine live face
 *   - image_U1.jpg : a DIFFERENT person (the "sister") — not enrolled
 *   - image_F1.jpg : printed-photo attack of the SAME person (liveness reject)
 *   - generated wall / background images: must yield ZERO faces
 *
 * The accepted/policy thresholds are the application defaults — this file does
 * NOT lower a threshold to force a pass.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import sharp from 'sharp';

import { RealFaceEngine } from '../providers/real-face-engine';
import { FaceEmbedding, RecognitionDecisionPolicy, DEFAULT_FACE_RECOGNITION_CONFIG } from '@medu/core';

const MODELS = path.join(__dirname, '..', '..', 'models');
const ASSETS = path.join(__dirname, '..', '..', 'test-assets');

const DETECTOR = path.join(MODELS, 'face_detection_yunet_2023mar.onnx');
const EMBEDDER = path.join(MODELS, 'face_recognition_sface_2021dec.onnx');
const LIVENESS = path.join(MODELS, 'minifasnet_v2.onnx');

const ENROLLED_ID = 'amirjon';

type FrameOutcome = {
  status: 'NO_FACE' | 'IDENTIFIED' | 'UNCERTAIN' | 'REJECTED';
  studentId: string | null;
  similarity: number | null;
};

describe('Face recognition acceptance (real ONNX engine)', () => {
  let engine: RealFaceEngine;
  let policy: RecognitionDecisionPolicy;

  let t1: Buffer;
  let u1: Buffer;
  let f1: Buffer;
  let wall: Buffer;

  let enrolled: FaceEmbedding;

  const threshold = DEFAULT_FACE_RECOGNITION_CONFIG.matching.similarityThreshold;

  beforeAll(async () => {
    engine = new RealFaceEngine({
      detectorModelPath: DETECTOR,
      embedderModelPath: EMBEDDER,
      livenessModelPath: LIVENESS,
      embeddingDimension: 128,
    });
    await engine.initialize();

    policy = new RecognitionDecisionPolicy(DEFAULT_FACE_RECOGNITION_CONFIG);

    t1 = fs.readFileSync(path.join(ASSETS, 'image_T1.jpg'));
    u1 = fs.readFileSync(path.join(ASSETS, 'image_U1.jpg'));
    f1 = fs.readFileSync(path.join(ASSETS, 'image_F1.jpg'));

    // A plain background ("wall"): no face at all.
    wall = await sharp({
      create: { width: 640, height: 480, channels: 3, background: { r: 185, g: 185, b: 185 } },
    })
      .jpeg()
      .toBuffer();

    const faces = await engine.detectFaces({ imageBuffer: t1, format: 'jpeg' });
    enrolled = await engine.generateEmbedding({ imageBuffer: t1, face: faces[0] });
  }, 120_000);

  async function embeddingOf(buffer: Buffer): Promise<FaceEmbedding> {
    const faces = await engine.detectFaces({ imageBuffer: buffer, format: 'jpeg' });
    expect(faces.length).toBeGreaterThan(0);
    return engine.generateEmbedding({ imageBuffer: buffer, face: faces[0] });
  }

  async function matchProbe(probe: FaceEmbedding): Promise<number> {
    return engine.compareEmbeddings({ embeddingA: probe, embeddingB: enrolled });
  }

  /**
   * Full single-frame pipeline used by the recognition service:
   * detect → (quality) → liveness → embed → match → decide.
   */
  async function recognizeFrame(buffer: Buffer): Promise<FrameOutcome> {
    const faces = await engine.detectFaces({ imageBuffer: buffer, format: 'jpeg' });
    if (faces.length === 0) {
      return { status: 'NO_FACE', studentId: null, similarity: null };
    }

    const quality = await engine.assessQuality({ imageBuffer: buffer, face: faces[0] });
    const liveness = await engine.checkLiveness({ imageBuffer: buffer, face: faces[0] });

    const probe = await engine.generateEmbedding({ imageBuffer: buffer, face: faces[0] });
    const similarity = await matchProbe(probe);

    const decision = policy.decide(
      {
        qualityScore: quality.overallScore,
        livenessDecision: liveness.decision,
        livenessConfidence: liveness.confidence,
        similarityScore: similarity,
        bestMatchFound: true,
        ambiguityMargin: null,
      },
      ENROLLED_ID,
    );

    return {
      status: decision.outcome,
      studentId: decision.outcome === 'IDENTIFIED' ? decision.studentId : null,
      similarity,
    };
  }

  // -------------------------------------------------------------------------
  // TEST 10 — real ONNX engine initialisation
  // -------------------------------------------------------------------------
  describe('Real ONNX engine initialization', () => {
    it('loads YuNet, SFace and MiniFASNet (not a mock)', () => {
      const status = engine.getStatus();
      expect(status.detector).toBe(true);
      expect(status.embedder).toBe(true);
      expect(status.liveness).toBe(true);
      expect(status.overall).toBe(true);
    });

    it('reports a real model version and a 128-d SFace embedding', () => {
      const version = engine.getModelVersion();
      expect(version).toMatch(/yunet/i);
      expect(version).toMatch(/sface|embedder/i);
      expect(version).toMatch(/minifasnet/i);
      expect(version.toLowerCase()).not.toContain('mock');
      expect(engine.getEmbeddingDimension()).toBe(128);
    });
  });

  // -------------------------------------------------------------------------
  // TEST 1 + enrollment/recognition preprocessing consistency
  // -------------------------------------------------------------------------
  describe('Enrolled person', () => {
    it('produces a deterministic embedding (enrollment == recognition pipeline)', async () => {
      const again = await embeddingOf(t1);
      const cosine = enrolled.cosineSimilarity(again);
      expect(cosine).toBeGreaterThan(0.999);
    });

    it('own face -> IDENTIFIED as the enrolled student', async () => {
      const result = await recognizeFrame(t1);
      expect(result.status).toBe('IDENTIFIED');
      expect(result.studentId).toBe(ENROLLED_ID);
      expect(result.similarity).not.toBeNull();
      expect(result.similarity!).toBeGreaterThanOrEqual(threshold);
    });
  });

  // -------------------------------------------------------------------------
  // TEST 2, 4, 6 — a different person is UNKNOWN, even with one template
  // -------------------------------------------------------------------------
  describe('Different person is rejected', () => {
    it('a different person -> similarity below threshold -> UNKNOWN', async () => {
      const probe = await embeddingOf(u1);
      const similarity = await matchProbe(probe);

      expect(Number.isFinite(similarity)).toBe(true);
      expect(similarity).toBeLessThan(threshold);

      const result = await recognizeFrame(u1);
      expect(result.status).not.toBe('IDENTIFIED');
      expect(result.studentId).toBeNull();
    });

    it('never auto-selects the only enrolled student for an unknown face', async () => {
      // Gallery has exactly ONE template; a system with a "students.length===1"
      // fallback would return that student. It must not.
      const probe = await embeddingOf(u1);
      const similarity = await matchProbe(probe);

      const decision = policy.decide(
        {
          qualityScore: 1,
          livenessDecision: 'PASS',
          livenessConfidence: 1,
          similarityScore: similarity,
          bestMatchFound: true,
          ambiguityMargin: null,
        },
        ENROLLED_ID,
      );

      expect(decision.outcome).not.toBe('IDENTIFIED');
    });
  });

  // -------------------------------------------------------------------------
  // TEST 3 — wall / background has no face
  // -------------------------------------------------------------------------
  describe('No face in the frame', () => {
    it('a wall / plain background -> 0 detected faces -> NO_FACE (never the enrolled student)', async () => {
      const faces = await engine.detectFaces({ imageBuffer: wall, format: 'jpeg' });
      expect(faces).toEqual([]);

      const result = await recognizeFrame(wall);
      expect(result.status).toBe('NO_FACE');
      expect(result.studentId).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // TEST 5, 6 — no previous-identity leakage across frames
  // -------------------------------------------------------------------------
  describe('Sequential frames do not leak the previous identity', () => {
    it('T1 -> wall -> U1 -> T1 keeps each frame independent', async () => {
      const frame1 = await recognizeFrame(t1);
      const frame2 = await recognizeFrame(wall);
      const frame3 = await recognizeFrame(u1);
      const frame4 = await recognizeFrame(t1);

      expect(frame1).toMatchObject({ status: 'IDENTIFIED', studentId: ENROLLED_ID });

      // Wall: NO_FACE, and definitely not the previous frame's identity.
      expect(frame2.status).toBe('NO_FACE');
      expect(frame2.studentId).toBeNull();

      // Different person: NOT the previous frame's identity.
      expect(frame3.status).not.toBe('IDENTIFIED');
      expect(frame3.studentId).toBeNull();

      // The real person still matches on a later frame.
      expect(frame4).toMatchObject({ status: 'IDENTIFIED', studentId: ENROLLED_ID });
    });
  });

  // -------------------------------------------------------------------------
  // TEST 9 — liveness
  // -------------------------------------------------------------------------
  describe('Liveness (MiniFASNet)', () => {
    it('passes a genuine live face and rejects a presentation attack', async () => {
      const t1Face = (await engine.detectFaces({ imageBuffer: t1, format: 'jpeg' }))[0];
      const live = await engine.checkLiveness({ imageBuffer: t1, face: t1Face });
      expect(live.decision).toBe('PASS');

      const f1Faces = await engine.detectFaces({ imageBuffer: f1, format: 'jpeg' });
      expect(f1Faces.length).toBeGreaterThan(0);
      const spoof = await engine.checkLiveness({ imageBuffer: f1, face: f1Faces[0] });
      expect(spoof.decision).toBe('FAIL');
    });

    it('a liveness failure is REJECTED even when the similarity would match', () => {
      const decision = policy.decide(
        {
          qualityScore: 1,
          livenessDecision: 'FAIL',
          livenessConfidence: 0,
          similarityScore: 0.99, // would otherwise identify
          bestMatchFound: true,
          ambiguityMargin: null,
        },
        ENROLLED_ID,
      );

      expect(decision.outcome).toBe('REJECTED');
      if (decision.outcome === 'REJECTED') {
        expect(decision.reason).toBe('LIVENESS_FAILED');
      }
    });
  });

  // -------------------------------------------------------------------------
  // TEST 7, 8 — invalid data fails closed
  // -------------------------------------------------------------------------
  describe('Invalid data is rejected', () => {
    it('an empty embedding cannot be constructed', () => {
      expect(() => new FaceEmbedding(new Float32Array(0))).toThrow();
    });

    it('a dimension mismatch is rejected by comparison', async () => {
      const wrong = new FaceEmbedding(new Float32Array(64).fill(0.1));
      await expect(
        engine.compareEmbeddings({ embeddingA: enrolled, embeddingB: wrong }),
      ).rejects.toThrow(/dimension/i);
    });

    it('a zero vector similarity fails the match gate', () => {
      const zero = new FaceEmbedding(new Float32Array(128));
      const similarity = zero.cosineSimilarity(enrolled);
      expect(similarity).toBe(0);

      const decision = policy.decide(
        {
          qualityScore: 1,
          livenessDecision: 'PASS',
          livenessConfidence: 1,
          similarityScore: similarity,
          bestMatchFound: true,
          ambiguityMargin: null,
        },
        ENROLLED_ID,
      );
      expect(decision.outcome).not.toBe('IDENTIFIED');
    });

    it('a NaN similarity is rejected (never identified)', () => {
      const decision = policy.decide(
        {
          qualityScore: 1,
          livenessDecision: 'PASS',
          livenessConfidence: 1,
          similarityScore: Number.NaN,
          bestMatchFound: true,
          ambiguityMargin: null,
        },
        ENROLLED_ID,
      );

      expect(decision.outcome).toBe('REJECTED');
      if (decision.outcome === 'REJECTED') {
        expect(decision.reason).toBe('SIMILARITY_INVALID');
      }
    });

    it('NaN entries in an embedding never produce an accepted match', async () => {
      const nan = new FaceEmbedding(new Float32Array(128).fill(Number.NaN));
      const similarity = await engine.compareEmbeddings({ embeddingA: nan, embeddingB: enrolled });
      expect(Number.isFinite(similarity)).toBe(false);

      const decision = policy.decide(
        {
          qualityScore: 1,
          livenessDecision: 'PASS',
          livenessConfidence: 1,
          similarityScore: similarity,
          bestMatchFound: true,
          ambiguityMargin: null,
        },
        ENROLLED_ID,
      );
      expect(decision.outcome).not.toBe('IDENTIFIED');
    });
  });
});
