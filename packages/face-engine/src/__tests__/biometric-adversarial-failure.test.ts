/**
 * Biometric Adversarial & Edge Case Failure Test Suite
 *
 * Explicitly tests:
 * 1. Missing model files
 * 2. Invalid / corrupted model files
 * 3. ONNX initialization errors
 * 4. Invalid input images (empty, corrupt, malformed)
 * 5. Detection failure (blank frames, noise)
 * 6. Recognition failure handling
 * 7. Liveness failure handling
 * 8. Production fail-closed enforcement
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { RealDetector } from '../providers/real-detector';
import { RealEmbedder } from '../providers/real-embedder';
import { RealLivenessChecker } from '../providers/real-liveness';
import { RealFaceEngine } from '../providers/real-face-engine';
import { validateModel } from '../providers/model-integrity';

const MODELS_DIR = path.join(__dirname, '..', '..', 'models');
const DETECTOR_PATH = path.join(MODELS_DIR, 'face_detection_yunet_2023mar.onnx');
const EMBEDDER_PATH = path.join(MODELS_DIR, 'face_recognition_sface_2021dec.onnx');
const LIVENESS_PATH = path.join(MODELS_DIR, 'minifasnet_v2.onnx');

describe('Biometric Adversarial & Edge Case Failure Verification', () => {
  let tempDir: string;
  let corruptModelPath: string;
  let emptyModelPath: string;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biometric-test-'));
    corruptModelPath = path.join(tempDir, 'corrupt_model.onnx');
    emptyModelPath = path.join(tempDir, 'empty_model.onnx');

    // Create a corrupted fake model file (random non-protobuf bytes)
    fs.writeFileSync(corruptModelPath, Buffer.from('NOT_A_VALID_ONNX_MODEL_HEADER_JUST_GARBAGE_BYTES'));
    // Create an empty 0-byte file
    fs.writeFileSync(emptyModelPath, Buffer.alloc(0));
  });

  afterAll(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  describe('1. Missing Model Files', () => {
    it('validateModel flags nonexistent file as missing', () => {
      const nonExistentPath = path.join(tempDir, 'does_not_exist.onnx');
      const result = validateModel('detector', nonExistentPath, {});
      expect(result.valid).toBe(false);
      expect(result.fileExists).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Cannot read');
    });

    it('RealDetector reports unavailable if model path does not exist', async () => {
      const detector = new RealDetector({
        modelPath: path.join(tempDir, 'nonexistent_detector.onnx'),
        inputSize: 640,
      });
      await detector.initialize();
      expect(detector.isAvailable()).toBe(false);
    });

    it('RealEmbedder reports unavailable if model path does not exist', async () => {
      const embedder = new RealEmbedder({
        modelPath: path.join(tempDir, 'nonexistent_embedder.onnx'),
      });
      await embedder.initialize();
      expect(embedder.isAvailable()).toBe(false);
    });

    it('RealLivenessChecker reports unavailable if model path does not exist', async () => {
      const liveness = new RealLivenessChecker({
        modelPath: path.join(tempDir, 'nonexistent_liveness.onnx'),
      });
      await liveness.initialize();
      expect(liveness.isAvailable()).toBe(false);
    });
  });

  describe('2. Invalid & Corrupted Model Files', () => {
    it('validateModel flags 0-byte empty file as invalid', () => {
      const result = validateModel('detector', emptyModelPath, {});
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('empty'))).toBe(true);
    });

    it('validateModel rejects corrupted model with checksum mismatch', () => {
      const result = validateModel('detector', corruptModelPath, {
        sha256: '8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4',
      });
      expect(result.valid).toBe(false);
      expect(result.checksumValid).toBe(false);
      expect(result.errors.some(e => e.includes('checksum mismatch'))).toBe(true);
    });
  });

  describe('3. ONNX Initialization Errors', () => {
    it('RealDetector rejects initialization when ONNX graph cannot be parsed', async () => {
      const detector = new RealDetector({
        modelPath: corruptModelPath,
        inputSize: 640,
      });
      await expect(detector.initialize()).rejects.toThrow();
      expect(detector.isAvailable()).toBe(false);
    });

    it('RealEmbedder reports unavailable on corrupt model file (protobuf error caught)', async () => {
      const embedder = new RealEmbedder({
        modelPath: corruptModelPath,
      });
      await embedder.initialize();
      expect(embedder.isAvailable()).toBe(false);
    });

    it('RealLivenessChecker reports unavailable on corrupt model file (protobuf error caught)', async () => {
      const liveness = new RealLivenessChecker({
        modelPath: corruptModelPath,
      });
      await liveness.initialize();
      expect(liveness.isAvailable()).toBe(false);
    });
  });

  describe('4. Invalid Input Images', () => {
    let detector: RealDetector;

    beforeAll(async () => {
      detector = new RealDetector({
        modelPath: DETECTOR_PATH,
        inputSize: 640,
      });
      await detector.initialize();
    });

    it('handles empty buffer gracefully by throwing or rejecting safely without crashing', async () => {
      const emptyBuffer = Buffer.alloc(0);
      await expect(
        detector.detectFaces({ imageBuffer: emptyBuffer, format: 'jpeg' }),
      ).rejects.toThrow();
    });

    it('handles truncated / malformed image buffer safely', async () => {
      const corruptedJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
      await expect(
        detector.detectFaces({ imageBuffer: corruptedJpeg, format: 'jpeg' }),
      ).rejects.toThrow();
    });

    it('handles random noise bytes without unhandled crash', async () => {
      const randomBytes = Buffer.from('RAW_RANDOM_NOISE_NON_IMAGE_BYTES_FOR_SECURITY_TESTING');
      await expect(
        detector.detectFaces({ imageBuffer: randomBytes, format: 'png' }),
      ).rejects.toThrow();
    });
  });

  describe('5. Detection Failure on Non-Face Images', () => {
    let detector: RealDetector;

    beforeAll(async () => {
      detector = new RealDetector({
        modelPath: DETECTOR_PATH,
        inputSize: 640,
        confidenceThreshold: 0.6,
      });
      await detector.initialize();
    });

    it('returns empty array [] on uniform blank image (no hallucinated faces)', async () => {
      const sharp = (await import('sharp')).default;
      // Plain black 640x480 image
      const blankImage = await sharp({
        create: {
          width: 640,
          height: 480,
          channels: 3,
          background: { r: 0, g: 0, b: 0 },
        },
      }).jpeg().toBuffer();

      const faces = await detector.detectFaces({ imageBuffer: blankImage, format: 'jpeg' });
      expect(Array.isArray(faces)).toBe(true);
      expect(faces.length).toBe(0);
    });

    it('returns empty array [] on solid white image', async () => {
      const sharp = (await import('sharp')).default;
      const whiteImage = await sharp({
        create: {
          width: 640,
          height: 480,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      }).jpeg().toBuffer();

      const faces = await detector.detectFaces({ imageBuffer: whiteImage, format: 'jpeg' });
      expect(faces.length).toBe(0);
    });
  });

  describe('6. Recognition & Embedding Failure Handling', () => {
    let embedder: RealEmbedder;

    beforeAll(async () => {
      embedder = new RealEmbedder({
        modelPath: EMBEDDER_PATH,
      });
      await embedder.initialize();
    });

    it('embedder produces normalized vector when given valid face crop', async () => {
      const sharp = (await import('sharp')).default;
      const faceCrop = await sharp({
        create: {
          width: 112,
          height: 112,
          channels: 3,
          background: { r: 200, g: 150, b: 120 },
        },
      }).jpeg().toBuffer();

      const embedding = await embedder.generateEmbedding({
        imageBuffer: faceCrop,
        format: 'jpeg',
        face: {
          boundingBox: { x: 0, y: 0, width: 112, height: 112 },
          confidence: 0.95,
        },
      });

      expect(embedding.getDimension()).toBeGreaterThan(0);
      const data = embedding.getData();
      expect(data.length).toBe(embedding.getDimension());
      // Check Euclidean norm is approximately 1.0 (normalized)
      const norm = Math.sqrt(data.reduce((sum, v) => sum + v * v, 0));
      expect(norm).toBeGreaterThan(0.95);
      expect(norm).toBeLessThan(1.05);
    });

    it('embedder rejects unprocessable/corrupted image safely', async () => {
      const corruptData = Buffer.from('CORRUPT_NOT_AN_IMAGE');
      await expect(
        embedder.generateEmbedding({
          imageBuffer: corruptData,
          format: 'jpeg',
          face: {
            boundingBox: { x: 0, y: 0, width: 10, height: 10 },
            confidence: 0.9,
          },
        }),
      ).rejects.toThrow();
    });
  });

  describe('7. Liveness Failure & Spoof Rejection', () => {
    let liveness: RealLivenessChecker;

    beforeAll(async () => {
      liveness = new RealLivenessChecker({
        modelPath: LIVENESS_PATH,
        passThreshold: 0.85,
        failThreshold: 0.30,
      });
      await liveness.initialize();
    });

    it('rejects uniform noise / synthetic pattern with non-PASS decision', async () => {
      const sharp = (await import('sharp')).default;
      const syntheticNoise = await sharp({
        create: {
          width: 200,
          height: 200,
          channels: 3,
          background: { r: 100, g: 100, b: 100 },
        },
      }).jpeg().toBuffer();

      const result = await liveness.checkLiveness({
        imageBuffer: syntheticNoise,
        format: 'jpeg',
        face: {
          boundingBox: { x: 20, y: 20, width: 160, height: 160 },
          confidence: 0.9,
        },
      });

      expect(result).toHaveProperty('decision');
      expect(result).toHaveProperty('confidence');
      // Synthetic uniform gray box is NOT a real live human face
      expect(result.decision).not.toBe('PASS');
    });
  });

  describe('8. Production Fail-Closed Behavior', () => {
    it('RealFaceEngine fails closed if liveness model path is invalid/corrupt', async () => {
      const engine = new RealFaceEngine({
        detectorModelPath: DETECTOR_PATH,
        embedderModelPath: EMBEDDER_PATH,
        livenessModelPath: corruptModelPath,
      });

      // Must fail initialization rather than silently proceeding without liveness in production
      await expect(engine.initialize()).rejects.toThrow();
    });

    it('RealFaceEngine fails closed if detector model path is missing', async () => {
      const engine = new RealFaceEngine({
        detectorModelPath: path.join(tempDir, 'missing_det.onnx'),
        embedderModelPath: EMBEDDER_PATH,
        livenessModelPath: LIVENESS_PATH,
      });

      await expect(engine.initialize()).rejects.toThrow();
    });

    it('RealFaceEngine fails closed if embedder model path is missing', async () => {
      const engine = new RealFaceEngine({
        detectorModelPath: DETECTOR_PATH,
        embedderModelPath: path.join(tempDir, 'missing_emb.onnx'),
        livenessModelPath: LIVENESS_PATH,
      });

      await expect(engine.initialize()).rejects.toThrow();
    });
  });
});
