/**
 * RealFaceEngine — production face recognition engine using ONNX Runtime.
 *
 * This is the main entry point for real face recognition.
 * It composes the real detector, quality assessor, liveness checker,
 * and embedder into a single FaceEngine interface.
 *
 * Usage:
 *   const engine = new RealFaceEngine({
 *     detectorModelPath: '/path/to/detector.onnx',
 *     embedderModelPath: '/path/to/embedder.onnx',
 *     livenessModelPath: '/path/to/liveness.onnx',
 *   });
 *   await engine.initialize();
 *   const faces = await engine.detectFaces({ imageBuffer, format: 'jpeg' });
 */

import type {
  FaceEngine,
  FaceDetectionInput,
  DetectedFace,
  QualityAssessmentInput,
  LivenessCheckInput,
  EmbeddingInput,
  ComparisonInput,
} from '@medu/core';
import type { FaceEmbedding, QualityMetrics, LivenessResult } from '@medu/core';
import { createLogger } from '../lib/logger';

const logger = createLogger('RealFaceEngine');
import { RealDetector } from './real-detector';
import { RealEmbedder } from './real-embedder';
import { RealLivenessChecker } from './real-liveness';
import { QualityAssessor } from './quality-assessor';
import { validateModel, formatValidationReport } from './model-integrity';

export interface RealFaceEngineConfig {
  /** Path to face detection ONNX model */
  detectorModelPath: string;
  /** Path to face embedding ONNX model */
  embedderModelPath: string;
  /** Path to liveness detection ONNX model (optional — returns UNAVAILABLE if empty) */
  livenessModelPath: string;
  /** Detector input size (default: 640 for YuNet) */
  detectorInputSize?: number;
  /** Embedder input size (default: 112 for SFace) */
  embedderInputSize?: number;
  /** Embedding dimension (default: 128 for SFace) */
  embeddingDimension?: number;
  /** Liveness input size (default: 80) */
  livenessInputSize?: number;
  /** Minimum detection confidence (default: 0.5) */
  detectionConfidence?: number;
  /** Liveness pass threshold (default: 0.8) */
  livenessPassThreshold?: number;
}

export class RealFaceEngine implements FaceEngine {
  private detector: RealDetector;
  private embedder: RealEmbedder;
  private liveness: RealLivenessChecker;
  private quality: QualityAssessor;
  private initialized = false;
  private config: RealFaceEngineConfig;

  constructor(config: RealFaceEngineConfig) {
    this.config = config;
    this.detector = new RealDetector({
      modelPath: config.detectorModelPath,
      inputSize: config.detectorInputSize ?? 640,
      confidenceThreshold: config.detectionConfidence ?? 0.5,
    });

    this.embedder = new RealEmbedder({
      modelPath: config.embedderModelPath,
      inputSize: config.embedderInputSize ?? 112,
      embeddingDimension: config.embeddingDimension ?? 128,
    });

    this.liveness = new RealLivenessChecker({
      modelPath: config.livenessModelPath,
      inputSize: config.livenessInputSize ?? 80,
      passThreshold: config.livenessPassThreshold ?? 0.8,
    });

    this.quality = new QualityAssessor();
  }

  /**
   * Initialize all models. Must be called before any inference.
   * Validates model integrity before loading.
   */
  async initialize(): Promise<void> {
    // Step 1: Validate model files exist and are integrity-checked
    const detectorValidation = validateModel('detector', this.config.detectorModelPath, {
      modelFamily: 'YuNet',
      license: 'MIT',
      commercialUse: 'verified',
      // SHA-256 of face_detection_yunet_2023mar.onnx (opencv_zoo); a swapped detector must fail closed.
      sha256: '8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4',
    });

    const embedderValidation = validateModel('embedder', this.config.embedderModelPath, {
      modelFamily: 'SFace',
      license: 'Apache-2.0',
      commercialUse: 'verified',
      // SHA-256 of face_recognition_sface_2021dec.onnx (opencv_zoo) - the embedder decides every match (E1).
      sha256: '0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79',
    });

    const livenessValidation = this.config.livenessModelPath
      ? validateModel('liveness', this.config.livenessModelPath, {
          modelFamily: 'MiniFASNetV2',
          license: 'Apache-2.0',
          commercialUse: 'verified',
          // SHA-256 of minifasnet_v2.onnx (garciafido/minifasnet-v2-anti-spoofing-onnx,
          // bit-equivalent export of minivision 2.7_80x80_MiniFASNetV2.pth)
          sha256: 'd7b3cd9ba8a7ceb13baa8c4720902e27ca3112eff52f926c08804af6b6eecc7b',
        })
      : {
          valid: true,
          component: 'liveness',
          modelPath: '',
          fileExists: false,
          fileSizeBytes: 0,
          checksumValid: null,
          checksumExpected: null,
          checksumActual: null,
          errors: [],
          warnings: ['Liveness model not configured — liveness checks will return UNAVAILABLE'],
        };

    const allValidation = [detectorValidation, embedderValidation, livenessValidation];
    const failures = allValidation.filter(v => !v.valid);
    const warnings = allValidation.flatMap(v => v.warnings);

    if (warnings.length > 0) {
      logger.warn('Model warnings:', warnings.join('; '));
    }

    if (failures.length > 0) {
      const report = formatValidationReport(allValidation);
      logger.error('Model validation failed:\n', report);
      throw new Error(
        `Model validation failed for ${failures.length} component(s): ` +
        failures.map(f => `${f.component}: ${f.errors.join('; ')}`).join('\n')
      );
    }

    // Step 2: Load models via ONNX Runtime
    await Promise.all([
      this.detector.initialize(),
      this.embedder.initialize(),
      this.config.livenessModelPath ? this.liveness.initialize() : Promise.resolve(),
    ]);

    // Step 3: Verify core components loaded successfully (liveness is optional)
    const status = this.getStatus();
    if (!status.overall) {
      const unavailable: string[] = [];
      if (!status.detector) unavailable.push('detector');
      if (!status.embedder) unavailable.push('embedder');
      throw new Error(
        `RealFaceEngine core components failed to load: ${unavailable.join(', ')}. ` +
        `Check model files and ONNX Runtime.`
      );
    }

    if (!status.liveness) {
      /*
       * A configured liveness model that failed to load is a misconfiguration,
       * not a graceful degradation worth continuing through.
       *
       * `status.overall` above only requires detector and embedder, so without
       * this the engine reports itself ready while every recognition answers
       * UNAVAILABLE. The camera worker treats anything != PASS as "not live"
       * and skips the student, so the centre would keep running healthy-looking
       * workers and record ZERO attendance, with no error surfaced anywhere.
       *
       * Absent path (optional liveness in development) still just warns.
       */
      if (this.config.livenessModelPath) {
        throw new Error(
          `Liveness model is configured (${this.config.livenessModelPath}) but failed to load. ` +
            `Refusing to start with a non-functional anti-spoofing gate.`,
        );
      }

      logger.warn('Liveness model not loaded — liveness checks will return UNAVAILABLE');
    }

    // Step 4: Warm up all loaded models
    await Promise.all([
      this.detector.warmup(),
      this.embedder.warmup(),
      this.config.livenessModelPath ? this.liveness.warmup() : Promise.resolve(),
    ]);

    this.initialized = true;
    logger.info('All models validated, loaded, and warmed up');
    logger.info(`Model version: ${this.getModelVersion()}`);
  }

  async detectFaces(input: FaceDetectionInput): Promise<DetectedFace[]> {
    this.ensureInitialized();
    return this.detector.detectFaces(input);
  }

  async assessQuality(input: QualityAssessmentInput): Promise<QualityMetrics> {
    this.ensureInitialized();
    return this.quality.assessQuality(input);
  }

  async checkLiveness(input: LivenessCheckInput): Promise<LivenessResult> {
    this.ensureInitialized();
    return this.liveness.checkLiveness(input);
  }

  async generateEmbedding(input: EmbeddingInput): Promise<FaceEmbedding> {
    this.ensureInitialized();
    return this.embedder.generateEmbedding(input);
  }

  async compareEmbeddings(input: ComparisonInput): Promise<number> {
    await this.ensureInitialized();
    return input.embeddingA.cosineSimilarity(input.embeddingB);
  }

  async isAvailable(): Promise<boolean> {
    return (
      this.initialized &&
      this.detector.isAvailable() &&
      this.embedder.isAvailable()
    );
  }

  getEmbeddingDimension(): number {
    return this.embedder.getDimension();
  }

  getModelVersion(): string {
    return `real-v1.0.0-detector=${this.detector.getModelVersion()}-embedder=${this.embedder.getModelVersion()}-liveness=${this.liveness.getModelVersion()}`;
  }

  /**
   * Get the status of each component.
   */
  getStatus(): {
    detector: boolean;
    embedder: boolean;
    liveness: boolean;
    overall: boolean;
  } {
    const detector = this.detector.isAvailable();
    const embedder = this.embedder.isAvailable();
    const liveness = this.liveness.isAvailable();
    return {
      detector,
      embedder,
      liveness,
      overall: detector && embedder,
    };
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('RealFaceEngine must be initialized before use. Call initialize() first.');
    }
  }
}