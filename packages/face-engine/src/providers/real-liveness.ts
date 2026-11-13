/**
 * Real Liveness Checker — production anti-spoofing using ONNX Runtime.
 *
 * Uses the MiniFASNet-V2 (2.7_80x80) face anti-spoofing model to
 * distinguish real faces from printed-photo and screen-replay attacks.
 *
 * Model semantics (VALIDATED against upstream minivision-ai/Silent-Face-Anti-Spoofing):
 *   - Input : BGR float32, range [0, 255] (NO /255 normalization — upstream
 *             ToTensor() explicitly skips pixel/255), NCHW [1, 3, 80, 80].
 *   - Output: 3 raw logits (NO softmax inside the graph).
 *             Class index 1 == LIVE (per upstream test.py: label==1 -> "Real Face").
 *             Indices 0 and 2 are attack classes (print / replay).
 *   - Preprocessing: crop face bbox scaled by 2.7x centered on the bbox
 *             (matches upstream "2.7_80x80" model), bilinear-resize to 80x80.
 *   - Post-processing: softmax over the 3 logits; liveness score = p[LIVE].
 *
 * IMPORTANT (fail-closed):
 *   - UNAVAILABLE != PASS
 *   - UNCERTAIN  != PASS
 *   - FAIL       != PASS
 * If liveness cannot be determined, recognition must NOT proceed.
 */

import type { LivenessCheckInput, LivenessResult } from '@medu/core';
import { createLogger } from '../lib/logger';

const logger = createLogger('RealLiveness');
import type { InferenceSession } from 'onnxruntime-node';
import * as fs from 'fs';

export interface LivenessConfig {
  /** Path to the ONNX liveness model */
  modelPath: string;
  /** Input image size for the model (MiniFASNet-V2 uses 80) */
  inputSize: number;
  /** Bbox scale margin for the crop (upstream 2.7_80x80 model uses 2.7) */
  margin: number;
  /** Threshold above which liveness is considered PASS */
  passThreshold: number;
  /** Threshold below which liveness is considered FAIL */
  failThreshold: number;
  /** Number of output classes (MiniFASNet-V2 outputs 3 logits) */
  classCount: number;
  /** Index of the LIVE class in the softmax output (upstream: 1) */
  liveClassIndex: number;
  /** Whether to require liveness for enrollment/recognition */
  required: boolean;
}

const DEFAULT_CONFIG: LivenessConfig = {
  modelPath: '',
  inputSize: 80,
  margin: 2.7,
  passThreshold: 0.5,
  failThreshold: 0.2,
  classCount: 3,
  liveClassIndex: 1,
  required: true,
};

/**
 * Compute the crop window for a face bbox scaled by `margin` (upstream
 * CropImage._get_new_box). Returns [left, top, right, bottom] (inclusive),
 * clamped to image bounds.
 */
export function cropBoxForLiveness(
  srcW: number,
  srcH: number,
  box: { x: number; y: number; width: number; height: number },
  margin: number
): [number, number, number, number] {
  // Input validation: zero/negative bbox dimensions would divide-by-zero.
  const x = Number.isFinite(box.x) ? box.x : 0;
  const y = Number.isFinite(box.y) ? box.y : 0;
  const boxW = Math.max(1, Math.round(box.width));
  const boxH = Math.max(1, Math.round(box.height));

  // Image must be at least 1x1 so downstream arithmetic stays finite.
  const safeSrcW = Math.max(1, Math.round(srcW));
  const safeSrcH = Math.max(1, Math.round(srcH));

  // Scale: clamp to a positive floor so newWidth/newHeight stay >= 1.
  const rawScale = Math.min(
    (safeSrcH - 1) / boxH,
    Math.min((safeSrcW - 1) / boxW, margin),
  );
  const scale = Math.max(Number.EPSILON, rawScale);

  const newWidth = boxW * scale;
  const newHeight = boxH * scale;
  const centerX = boxW / 2 + x;
  const centerY = boxH / 2 + y;

  let leftTopX = centerX - newWidth / 2;
  let leftTopY = centerY - newHeight / 2;
  let rightBottomX = centerX + newWidth / 2;
  let rightBottomY = centerY + newHeight / 2;

  if (leftTopX < 0) {
    rightBottomX -= leftTopX;
    leftTopX = 0;
  }
  if (leftTopY < 0) {
    rightBottomY -= leftTopY;
    leftTopY = 0;
  }
  if (rightBottomX > safeSrcW - 1) {
    leftTopX -= rightBottomX - safeSrcW + 1;
    rightBottomX = safeSrcW - 1;
  }
  if (rightBottomY > safeSrcH - 1) {
    leftTopY -= rightBottomY - safeSrcH + 1;
    rightBottomY = safeSrcH - 1;
  }

  // Post-clamp normalization: guarantee width >= 1 and height >= 1 so
  // sharp.extract never receives non-positive dimensions.
  const lx = Math.max(0, Math.min(Math.round(leftTopX), safeSrcW - 1));
  const ty = Math.max(0, Math.min(Math.round(leftTopY), safeSrcH - 1));
  const rx = Math.max(lx, Math.min(Math.round(rightBottomX), safeSrcW - 1));
  const by = Math.max(ty, Math.min(Math.round(rightBottomY), safeSrcH - 1));

  return [lx, ty, rx, by];
}

/**
 * Cache for oriented dimensions to avoid redundant sharp(imageBuffer).metadata()
 * calls across multiple faces in the same frame.
 */
const metadataDimensionsCache = new WeakMap<Buffer, { srcW: number; srcH: number }>();

/**
 * Softmax over an array of logits.
 * Implemented iteratively to avoid call stack overflow on large arrays,
 * with numerical stability via max-subtraction and finite-number guards.
 */
export function softmax(values: ArrayLike<number>): number[] {
  const len = values.length;
  if (len === 0) return [];
  if (len === 1) return [1.0];

  let max = -Infinity;
  for (let i = 0; i < len; i++) {
    const v = values[i];
    if (Number.isFinite(v) && v > max) {
      max = v;
    }
  }

  // Fallback if all values are non-finite or empty
  if (!Number.isFinite(max)) {
    const uniform = 1 / len;
    return new Array(len).fill(uniform);
  }

  const exps = new Float64Array(len);
  let sum = 0;
  for (let i = 0; i < len; i++) {
    const val = values[i];
    const expVal = Number.isFinite(val) ? Math.exp(val - max) : 0;
    exps[i] = expVal;
    sum += expVal;
  }

  if (sum <= 0 || !Number.isFinite(sum)) {
    const uniform = 1 / len;
    return new Array(len).fill(uniform);
  }

  const out = new Array<number>(len);
  for (let i = 0; i < len; i++) {
    out[i] = exps[i] / sum;
  }
  return out;
}

export class RealLivenessChecker {
  private session: InferenceSession | null = null;
  private config: LivenessConfig;
  private available = false;
  private warmupDone = false;

  constructor(config: Partial<LivenessConfig> = {}) {
    const envPass = process.env.FACE_LIVENESS_PASS_THRESHOLD || process.env.FACE_LIVENESS_THRESHOLD;
    const envFail = process.env.FACE_LIVENESS_FAIL_THRESHOLD;
    const parsedPass = envPass ? parseFloat(envPass) : undefined;
    const parsedFail = envFail ? parseFloat(envFail) : undefined;

    this.config = {
      ...DEFAULT_CONFIG,
      ...(parsedPass !== undefined && Number.isFinite(parsedPass) ? { passThreshold: parsedPass } : {}),
      ...(parsedFail !== undefined && Number.isFinite(parsedFail) ? { failThreshold: parsedFail } : {}),
      ...config,
    };
  }

  /**
   * Initialize the liveness model.
   */
  async initialize(): Promise<void> {
    try {
      const ort = await import('onnxruntime-node');

      if (!this.config.modelPath || !fs.existsSync(this.config.modelPath)) {
        logger.warn(
          `Model not found at: ${this.config.modelPath || '(not configured)'}. ` +
          `Liveness detection will be UNAVAILABLE. Set FACE_LIVENESS_MODEL_PATH to a valid ONNX model.`
        );
        this.available = false;
        return;
      }

      const modelBuffer = fs.readFileSync(this.config.modelPath);
      const session = await ort.InferenceSession.create(modelBuffer, {
        executionProviders: ['cpu'],
        graphOptimizationLevel: 'all',
      });
      this.session = session;

      this.available = true;
      logger.info(`Model loaded: ${this.config.modelPath}`);
    } catch (error) {
      logger.error(`Failed to initialize:`, error);
      this.available = false;
    }
  }

  /**
   * Warm up the model.
   */
  async warmup(): Promise<void> {
    if (!this.available || !this.session || this.warmupDone) return;
    const session = this.session;

    try {
      const ort = await import('onnxruntime-node');
      const dummyInput = new ort.Tensor(
        'float32',
        new Float32Array(this.config.inputSize * this.config.inputSize * 3),
        [1, 3, this.config.inputSize, this.config.inputSize]
      );

      const inputName = session.inputNames[0];
      await session.run({ [inputName]: dummyInput });
      this.warmupDone = true;
      logger.info('Warmup complete');
    } catch (error) {
      logger.warn('Warmup failed:', error);
    }
  }

  /**
   * Check liveness for a detected face.
   * Returns PASS, FAIL, UNCERTAIN, or UNAVAILABLE.
   */
  async checkLiveness(input: LivenessCheckInput): Promise<LivenessResult> {
    if (!this.available || !this.session) {
      return {
        decision: 'UNAVAILABLE',
        confidence: 0,
        details: { provider: 'real', reason: 'Model not loaded' },
      };
    }
    const session = this.session;

    const sharp = (await import('sharp')).default;
    const { boundingBox } = input.face;
    // Oriented dimensions: check cache first to avoid re-parsing Sharp metadata
    // if multiple faces are processed for the same input frame.
    let dims = metadataDimensionsCache.get(input.imageBuffer);
    if (!dims) {
      const rawMeta = await sharp(input.imageBuffer).metadata();
      const orientation = rawMeta.orientation ?? 1;
      const swapsAxes = orientation >= 5 && orientation <= 8;
      dims = {
        srcW: (swapsAxes ? rawMeta.height : rawMeta.width) || 0,
        srcH: (swapsAxes ? rawMeta.width : rawMeta.height) || 0,
      };
      if (dims.srcW > 0 && dims.srcH > 0) {
        metadataDimensionsCache.set(input.imageBuffer, dims);
      }
    }
    const { srcW, srcH } = dims;

    if (srcW === 0 || srcH === 0) {
      return {
        decision: 'UNAVAILABLE',
        confidence: 0,
        details: { provider: 'real', reason: 'Cannot read image dimensions' },
      };
    }

    // Crop face with upstream margin (2.7x bbox scale, centered, clamped)
    const [cropX, cropY, cropRight, cropBottom] = cropBoxForLiveness(
      srcW,
      srcH,
      boundingBox,
      this.config.margin
    );

    const { data } = await sharp(input.imageBuffer)
      .rotate()
      .extract({
        left: cropX,
        top: cropY,
        width: cropRight - cropX + 1,
        height: cropBottom - cropY + 1,
      })
      .resize(this.config.inputSize, this.config.inputSize, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Convert to NCHW float32 tensor.
    // sharp raw output is RGB; MiniFASNet expects BGR -> swap R/B.
    // Range [0, 255] (upstream ToTensor does NOT divide by 255).
    const channels = 3;
    const size = this.config.inputSize;
    const tensorData = new Float32Array(channels * size * size);

    for (let c = 0; c < channels; c++) {
      for (let h = 0; h < size; h++) {
        for (let w = 0; w < size; w++) {
          const srcIdx = (h * size + w) * channels + c;
          // map c=0 -> B (raw idx 2), c=1 -> G (raw idx 1), c=2 -> R (raw idx 0)
          const bgrSrcIdx = c === 0 ? srcIdx + 2 : c === 2 ? srcIdx - 2 : srcIdx;
          tensorData[c * size * size + h * size + w] = data[bgrSrcIdx];
        }
      }
    }

    const ort = await import('onnxruntime-node');
    const inputTensor = new ort.Tensor('float32', tensorData, [1, channels, size, size]);

    // Run inference
    const inputName = session.inputNames[0];
    const results = await session.run({ [inputName]: inputTensor });

    // Post-process: softmax over classCount logits; liveness score = p[LIVE].
    const outputName = session.outputNames[0];
    const output = results[outputName];
    const rawLogits = output?.data;

    if (!rawLogits || typeof (rawLogits as ArrayLike<number>).length !== 'number') {
      return {
        decision: 'UNAVAILABLE',
        confidence: 0,
        details: {
          provider: 'real',
          reason: 'Model produced no output tensor',
        },
      };
    }

    // Normalize to Float32Array. onnxruntime-node returns a TypedArray whose
    // dtype varies by model/version (Float32Array, Float64Array, Int32Array,
    // …). Treating a non-Float32 buffer as Float32 silently misreads every
    // element, so validate and convert explicitly — and reject non-finite
    // values before they poison softmax.
    let logits: Float32Array;
    if (rawLogits instanceof Float32Array) {
      // onnxruntime-node returns Float32Array on the common path - run the
      // same finite check here, otherwise NaN/Inf poisons softmax and yields
      // a false UNCERTAIN (E2).
      if (
        rawLogits.length > 0 &&
        Array.from(rawLogits).some((v: number) => !Number.isFinite(v))
      ) {
        return {
          decision: 'UNAVAILABLE',
          confidence: 0,
          details: { provider: 'real', reason: 'Liveness output contains non-finite values' },
        };
      }
      logits = rawLogits;
    } else {
      const values = Array.from(rawLogits as ArrayLike<number>);
      if (
        values.length > 0 &&
        values.some((v: unknown) => typeof v !== 'number' || !Number.isFinite(v))
      ) {
        return {
          decision: 'UNAVAILABLE',
          confidence: 0,
          details: {
            provider: 'real',
            reason: 'Liveness output contains non-finite or non-numeric values',
          },
        };
      }
      logits = new Float32Array(values as number[]);
    }

    // Fail closed if the model does not produce the expected number of classes.
    if (logits.length !== this.config.classCount) {
      return {
        decision: 'UNAVAILABLE',
        confidence: 0,
        details: {
          provider: 'real',
          reason: `Unexpected output size ${logits.length} (expected ${this.config.classCount})`,
        },
      };
    }

    if (this.config.liveClassIndex >= logits.length) {
      return {
        decision: 'UNAVAILABLE',
        confidence: 0,
        details: {
          provider: 'real',
          reason: `liveClassIndex ${this.config.liveClassIndex} out of range`,
        },
      };
    }

    const probabilities = softmax(logits);
    const score = probabilities[this.config.liveClassIndex];

    // Determine decision based on thresholds
    let decision: LivenessResult['decision'];
    if (score >= this.config.passThreshold) {
      decision = 'PASS';
    } else if (score <= this.config.failThreshold) {
      decision = 'FAIL';
    } else {
      decision = 'UNCERTAIN';
    }

    logger.info(
      `Liveness check: score=${score.toFixed(4)}, decision=${decision}, passThresh=${this.config.passThreshold}, failThresh=${this.config.failThreshold}, p=[${probabilities.map((p) => p.toFixed(4)).join(', ')}]`,
    );

    return {
      decision,
      confidence: score,
      details: {
        provider: 'real',
        probabilities,
        liveClassIndex: this.config.liveClassIndex,
        rawScore: score,
        passThreshold: this.config.passThreshold,
        failThreshold: this.config.failThreshold,
      },
    };
  }

  isAvailable(): boolean {
    return this.available;
  }

  getModelVersion(): string {
    return `real-liveness-minifasnet-v2-${this.config.inputSize}`;
  }
}