import { describe, it, expect, beforeAll } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import sharp from 'sharp';
import { RealFaceEngine } from '../providers/real-face-engine';
import { RealDetector } from '../providers/real-detector';
import { RealEmbedder } from '../providers/real-embedder';
import { RealLivenessChecker } from '../providers/real-liveness';
import { QualityAssessor } from '../providers/quality-assessor';
import { estimateHeadPose } from '../lib/pose-estimator';
import { computeSimilarityTransform, CANONICAL_112_LANDMARKS } from '../lib/alignment';
import { RecognitionDecisionPolicy, DEFAULT_FACE_RECOGNITION_CONFIG } from '@medu/core';

describe('Phase 1 Verification: Hardened Face ID Pipeline', () => {
  const modelsDir = path.resolve(__dirname, '../../models');
  const assetsDir = path.resolve(__dirname, '../../test-assets');

  const yunetPath = path.join(modelsDir, 'face_detection_yunet_2023mar.onnx');
  const sfacePath = path.join(modelsDir, 'face_recognition_sface_2021dec.onnx');
  const livenessPath = path.join(modelsDir, 'minifasnet_v2.onnx');

  const imageT1Path = path.join(assetsDir, 'image_T1.jpg');
  const imageF1Path = path.join(assetsDir, 'image_F1.jpg');
  const imageF2Path = path.join(assetsDir, 'image_F2.jpg');

  let engine: RealFaceEngine;
  let detector: RealDetector;
  let embedder: RealEmbedder;
  let liveness: RealLivenessChecker;
  let qualityAssessor: QualityAssessor;

  beforeAll(async () => {
    engine = new RealFaceEngine({
      detectorModelPath: yunetPath,
      embedderModelPath: sfacePath,
      livenessModelPath: livenessPath,
      detectorConfidenceThreshold: 0.6,
      embedderNormalize: true,
      livenessThreshold: 0.5,
      requireLiveness: true,
    });
    await engine.initialize();

    detector = new RealDetector({ modelPath: yunetPath, confidenceThreshold: 0.6 });
    await detector.initialize();

    embedder = new RealEmbedder({ modelPath: sfacePath, normalize: true });
    await embedder.initialize();

    liveness = new RealLivenessChecker({ modelPath: livenessPath });
    await liveness.initialize();

    qualityAssessor = new QualityAssessor({
      maxPoseYaw: 30,
      maxPosePitch: 30,
      maxPoseRoll: 25,
      overallThreshold: 0.4,
    });
  });

  describe('1. Real 5-Point Face Alignment & Invariance', () => {
    it('detects 5 landmarks on genuine face image_T1', async () => {
      const buffer = fs.readFileSync(imageT1Path);
      const faces = await detector.detectFaces({ imageBuffer: buffer, format: 'jpeg' });
      expect(faces.length).toBeGreaterThan(0);

      const face = faces[0];
      expect(face.landmarks).toBeDefined();
      expect(face.landmarks?.length).toBe(5);

      const [rightEye, leftEye, nose, rightMouth, leftMouth] = face.landmarks!;
      // Left eye is to the right of right eye in image coordinates
      expect(leftEye.x).toBeGreaterThan(rightEye.x);
      // Nose is below eyes
      expect(nose.y).toBeGreaterThan(rightEye.y);
      // Mouth is below nose
      expect(rightMouth.y).toBeGreaterThan(nose.y);
      expect(leftMouth.y).toBeGreaterThan(nose.y);
    });

    it('computes valid Umeyama similarity transform matrix', () => {
      const srcLandmarks = [
        { x: 100, y: 120 },
        { x: 180, y: 120 },
        { x: 140, y: 160 },
        { x: 110, y: 200 },
        { x: 170, y: 200 },
      ];

      const transform = computeSimilarityTransform(srcLandmarks, CANONICAL_112_LANDMARKS);
      expect(transform.matrix).toBeDefined();
      expect(transform.matrix.length).toBe(2);
      expect(transform.matrix[0].length).toBe(3);
      expect(transform.scale).toBeGreaterThan(0);
      expect(Number.isFinite(transform.rotationDeg)).toBe(true);
    });

    it('achieves high cosine similarity (>0.85) between upright face and 25° tilted face via alignment', async () => {
      const uprightBuf = fs.readFileSync(imageT1Path);
      // Normalize EXIF orientation first, then rotate 25 degrees
      const normalizedBuf = await sharp(uprightBuf).rotate().toBuffer();
      const tiltedBuf = await sharp(normalizedBuf).rotate(25).toBuffer();

      const uprightFaces = await detector.detectFaces({ imageBuffer: normalizedBuf, format: 'jpeg' });
      const tiltedFaces = await detector.detectFaces({ imageBuffer: tiltedBuf, format: 'jpeg' });

      expect(uprightFaces.length).toBeGreaterThan(0);
      expect(tiltedFaces.length).toBeGreaterThan(0);

      const embUpright = await embedder.generateEmbedding({
        imageBuffer: normalizedBuf,
        face: uprightFaces[0],
      });
      const embTilted = await embedder.generateEmbedding({
        imageBuffer: tiltedBuf,
        face: tiltedFaces[0],
      });

      const sim = embUpright.cosineSimilarity(embTilted);
      expect(sim).toBeGreaterThanOrEqual(0.85);
    });
  });

  describe('2. Landmark-based 3D Head Pose Estimation', () => {
    it('estimates near-frontal pose for upright image_T1 face', async () => {
      const buffer = fs.readFileSync(imageT1Path);
      const faces = await detector.detectFaces({ imageBuffer: buffer, format: 'jpeg' });
      expect(faces.length).toBeGreaterThan(0);

      const pose = estimateHeadPose(faces[0].landmarks!);
      expect(Math.abs(pose.yaw)).toBeLessThan(30);
      expect(Math.abs(pose.pitch)).toBeLessThan(30);
      expect(Math.abs(pose.roll)).toBeLessThan(20);
    });

    it('rejects face with HEAD_POSE_EXCEEDED when roll angle exceeds configured limit', async () => {
      const buffer = fs.readFileSync(imageT1Path);
      const faces = await detector.detectFaces({ imageBuffer: buffer, format: 'jpeg' });
      const face = faces[0];

      // Strict assessor with max roll = 5°
      const strictAssessor = new QualityAssessor({
        maxPoseRoll: 5,
        maxPoseYaw: 30,
        maxPosePitch: 20,
      });

      // Synthetic tilted face landmarks
      const tiltedFace = {
        ...face,
        landmarks: [
          { x: 100, y: 100 },
          { x: 170, y: 150 }, // strong tilt
          { x: 120, y: 160 },
          { x: 90, y: 200 },
          { x: 150, y: 230 },
        ],
      };

      const metrics = await strictAssessor.assessQuality({
        imageBuffer: buffer,
        face: tiltedFace,
      });

      expect(metrics.passesThreshold).toBe(false);
      expect(metrics.rejectionReason).toBe('HEAD_POSE_EXCEEDED');
      expect(metrics.issues?.some((i) => i.includes('Roll') || i.includes('limit'))).toBe(true);
    });
  });

  describe('3. Top-1 vs Top-2 Ambiguity Margin Protection', () => {
    const policy = new RecognitionDecisionPolicy({
      ...DEFAULT_FACE_RECOGNITION_CONFIG,
      matching: {
        ...DEFAULT_FACE_RECOGNITION_CONFIG.matching,
        similarityThreshold: 0.6,
        minAmbiguityMargin: 0.05,
      },
    });

    it('rejects ambiguous match when ambiguity margin < 0.05', () => {
      const decision = policy.decide(
        {
          qualityScore: 0.85,
          livenessDecision: 'PASS',
          livenessConfidence: 0.95,
          similarityScore: 0.74,
          bestMatchFound: true,
          ambiguityMargin: 0.02, // top1: 0.74, top2: 0.72 -> margin 0.02 < 0.05
        },
        'student-1'
      );

      expect(decision.outcome).toBe('UNCERTAIN');
      if (decision.outcome === 'UNCERTAIN') {
        expect(decision.reason).toBe('AMBIGUOUS_MATCH');
        expect(decision.message).toContain('margin between top candidates');
      }
    });

    it('identifies student when ambiguity margin >= 0.05 and similarity passes threshold', () => {
      const decision = policy.decide(
        {
          qualityScore: 0.85,
          livenessDecision: 'PASS',
          livenessConfidence: 0.95,
          similarityScore: 0.82,
          bestMatchFound: true,
          ambiguityMargin: 0.18, // top1: 0.82, top2: 0.64 -> margin 0.18 >= 0.05
        },
        'student-1'
      );

      expect(decision.outcome).toBe('IDENTIFIED');
      if (decision.outcome === 'IDENTIFIED') {
        expect(decision.studentId).toBe('student-1');
        expect(decision.confidence).toBe('HIGH');
      }
    });
  });

  describe('4. Fail-Closed Liveness & Security', () => {
    it('passes genuine live face image_T1', async () => {
      const buffer = fs.readFileSync(imageT1Path);
      const faces = await detector.detectFaces({ imageBuffer: buffer, format: 'jpeg' });
      const result = await liveness.checkLiveness({ imageBuffer: buffer, face: faces[0] });

      expect(result.decision).toBe('PASS');
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('rejects printed paper attack image_F1', async () => {
      const buffer = fs.readFileSync(imageF1Path);
      const faces = await detector.detectFaces({ imageBuffer: buffer, format: 'jpeg' });
      expect(faces.length).toBeGreaterThan(0);

      const result = await liveness.checkLiveness({ imageBuffer: buffer, face: faces[0] });
      expect(result.decision).toBe('FAIL');
    });

    it('rejects screen replay attack image_F2', async () => {
      const buffer = fs.readFileSync(imageF2Path);
      const faces = await detector.detectFaces({ imageBuffer: buffer, format: 'jpeg' });
      expect(faces.length).toBeGreaterThan(0);

      const result = await liveness.checkLiveness({ imageBuffer: buffer, face: faces[0] });
      expect(result.decision).toBe('FAIL');
    });
  });

  describe('5. Full End-to-End Pipeline Performance Benchmark', () => {
    it('completes detection + quality + liveness + alignment + embedding efficiently', async () => {
      const buffer = fs.readFileSync(imageT1Path);

      // Warm up first
      const warmupFaces = await detector.detectFaces({ imageBuffer: buffer, format: 'jpeg' });
      await embedder.generateEmbedding({ imageBuffer: buffer, face: warmupFaces[0] });

      const start = performance.now();
      const faces = await detector.detectFaces({ imageBuffer: buffer, format: 'jpeg' });
      expect(faces.length).toBe(1);

      const quality = await qualityAssessor.assessQuality({ imageBuffer: buffer, face: faces[0] });
      expect(quality.passesThreshold).toBe(true);

      const live = await liveness.checkLiveness({ imageBuffer: buffer, face: faces[0] });
      expect(live.decision).toBe('PASS');

      const emb = await embedder.generateEmbedding({ imageBuffer: buffer, face: faces[0] });
      expect(emb.getDimension()).toBe(128);

      const elapsed = performance.now() - start;
      // Pipeline completes within 1500ms even under heavy parallel multi-process test runner contention
      expect(elapsed).toBeLessThan(1500);
    });
  });
});
