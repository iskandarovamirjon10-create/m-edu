/**
 * @fileoverview Enterprise-Grade YuNet Face Detection Engine (ONNX Runtime).
 *
 * Architectural Highlights:
 * - Zero-Leak Native Memory Management: Deterministic disposal of all ONNX C++ tensors.
 * - Pre-Allocated Memory Pool: Ring-buffer / Object-pool for Float32Arrays & NMS buffers (Zero GC thrashing).
 * - Concurrency & Backpressure Control: Built-in Async Semaphore + Single-Flight initialization lock.
 * - 1D Planar Channel Transposition: Cache-friendly RGB-to-BGR NCHW conversion without inner branching.
 * - Exact OpenCV YuNet Geometry: Anchor grid without the erroneous +0.5 offset, logit clamping, and corner-accurate bbox clipping.
 * - Flat-Array SoA (Structure of Arrays) NMS: Allocation-free Non-Maximum Suppression using typed arrays.
 * - Full Observability: Sub-millisecond telemetry per pipeline stage (preprocess, inference, decode, total).
 */

import type { FaceDetectionInput, DetectedFace, BoundingBox, Point2D } from '@medu/core';
import type { InferenceSession, Tensor } from 'onnxruntime-node';
import type sharp from 'sharp';
import * as fs from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { createLogger } from '../lib/logger';

const logger = createLogger('RealDetector');

// ============================================================================
// 1. TYPES, INTERFACES & CUSTOM ERRORS
// ============================================================================

export type ExecutionProvider = 'cpu' | 'cuda' | 'coreml' | 'tensorrt' | 'dml';

export interface DetectorConfig {
  /** Absolute or relative path to the YuNet .onnx model file */
  readonly modelPath: string;
  /** Model canvas resolution. MUST be a positive multiple of 32 (e.g., 320, 640) */
  readonly inputSize: number;
  /** Minimum confidence score (cls * obj) in range (0, 1) */
  readonly confidenceThreshold: number;
  /** IoU threshold for Non-Maximum Suppression in range (0, 1) */
  readonly nmsThreshold: number;
  /** Maximum candidates retained before NMS to guarantee bounded O(K^2) latency */
  readonly topKPreNms: number;
  /** Maximum final detections returned per frame */
  readonly maxDetections: number;
  /** Maximum concurrent inferences allowed (backpressure / memory protection) */
  readonly maxConcurrency: number;
  /** Maximum waiting queue size before shedding load */
  readonly maxQueueSize: number;
  /** Maximum allowed source image pixels (anti-decompression bomb) */
  readonly maxImagePixels: number;
  /** ONNX Runtime execution providers in priority order */
  readonly executionProviders: readonly ExecutionProvider[];
  /** ONNX intra-op thread count (0 = let ORT decide) */
  readonly intraOpNumThreads: number;
  /** Whether to use standard OpenCV YuNet anchor center (0.0) or legacy (0.5) */
  readonly anchorCenterOffset: 0 | 0.5;
}

export interface DetectionTelemetry {
  readonly preprocessMs: number;
  readonly inferenceMs: number;
  readonly postprocessMs: number;
  readonly totalMs: number;
  readonly candidateCount: number;
  readonly retainedCount: number;
}

export interface DetectionResult {
  readonly faces: DetectedFace[];
  readonly telemetry: DetectionTelemetry;
}

export class DetectorError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'CONFIG_INVALID'
      | 'NOT_INITIALIZED'
      | 'MODEL_LOAD_FAILED'
      | 'INVALID_IMAGE'
      | 'QUEUE_OVERFLOW'
      | 'INFERENCE_FAILED'
      | 'DISPOSED',
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'DetectorError';
    Error.captureStackTrace?.(this, DetectorError);
  }
}

// ============================================================================
// 2. CONSTANTS & DEFAULTS
// ============================================================================

const YUNET_STRIDES = [8, 16, 32] as const;
const NUM_CHANNELS = 3;
const NUM_LANDMARKS = 5;
const LANDMARK_COORDS = NUM_LANDMARKS * 2;
/** Clamp regression scale logits to prevent Math.exp() overflow to Infinity */
const MAX_SCALE_LOGIT = 10.0;
const MIN_SCALE_LOGIT = -10.0;

const DEFAULT_CONFIG: DetectorConfig = Object.freeze({
  modelPath: '',
  inputSize: 640,
  confidenceThreshold: 0.5,
  nmsThreshold: 0.4,
  topKPreNms: 256,
  maxDetections: 100,
  maxConcurrency: 4,
  maxQueueSize: 64,
  maxImagePixels: 64_000_000, // 64 Megapixels ceiling
  executionProviders: ['cpu' as const],
  intraOpNumThreads: 0,
  anchorCenterOffset: 0, // Official OpenCV YuNet uses 0.0
});

// ============================================================================
// 3. CONCURRENCY SEMAPHORE & WORKSPACE MEMORY POOL
// ============================================================================

/**
 * Pre-allocated execution slot containing reusable TypedArrays.
 * Eliminates ~5MB Float32Array allocations and GC pauses per frame.
 */
interface ExecutionWorkspace {
  readonly id: number;
  /** NCHW tensor buffer: [1, 3, inputSize, inputSize] */
  readonly tensorBuffer: Float32Array;
  /** Structure-of-Arrays (SoA) candidate buffers for zero-allocation decoding & NMS */
  readonly candX1: Float32Array;
  readonly candY1: Float32Array;
  readonly candX2: Float32Array;
  readonly candY2: Float32Array;
  readonly candArea: Float32Array;
  readonly candScore: Float32Array;
  readonly candLandmarks: Float32Array; // length = maxAnchors * 10
  readonly sortIndices: Uint32Array;
  readonly suppressedMask: Uint8Array;
}

/**
 * Bounded Async Resource Pool & Concurrency Semaphore.
 * Manages backpressure and hands out pre-allocated memory workspaces to active workers.
 */
class WorkspacePool {
  private readonly available: ExecutionWorkspace[] = [];
  private readonly waitQueue: Array<{
    resolve: (ws: ExecutionWorkspace) => void;
    reject: (err: Error) => void;
  }> = [];
  private disposed = false;

  constructor(poolSize: number, private readonly maxQueueSize: number, inputSize: number) {
    // Total anchors across strides 8, 16, 32 for square inputSize:
    // (S/8)^2 + (S/16)^2 + (S/32)^2. For 640x640 -> 6400 + 1600 + 400 = 8400.
    const totalAnchors = YUNET_STRIDES.reduce(
      (acc, s) => acc + Math.floor(inputSize / s) * Math.floor(inputSize / s),
      0
    );
    const tensorLength = NUM_CHANNELS * inputSize * inputSize;

    for (let i = 0; i < poolSize; i++) {
      this.available.push({
        id: i,
        tensorBuffer: new Float32Array(tensorLength),
        candX1: new Float32Array(totalAnchors),
        candY1: new Float32Array(totalAnchors),
        candX2: new Float32Array(totalAnchors),
        candY2: new Float32Array(totalAnchors),
        candArea: new Float32Array(totalAnchors),
        candScore: new Float32Array(totalAnchors),
        candLandmarks: new Float32Array(totalAnchors * LANDMARK_COORDS),
        sortIndices: new Uint32Array(totalAnchors),
        suppressedMask: new Uint8Array(totalAnchors),
      });
    }
  }

  public acquire(): Promise<ExecutionWorkspace> {
    if (this.disposed) {
      return Promise.reject(new DetectorError('Detector has been disposed', 'DISPOSED'));
    }

    const ws = this.available.pop();
    if (ws !== undefined) {
      return Promise.resolve(ws);
    }

    if (this.waitQueue.length >= this.maxQueueSize) {
      return Promise.reject(
        new DetectorError(
          `Detector backpressure limit reached (${this.maxQueueSize} queued requests)`,
          'QUEUE_OVERFLOW'
        )
      );
    }

    return new Promise<ExecutionWorkspace>((resolve, reject) => {
      this.waitQueue.push({ resolve, reject });
    });
  }

  public release(ws: ExecutionWorkspace): void {
    if (this.disposed) return;

    const next = this.waitQueue.shift();
    if (next !== undefined) {
      next.resolve(ws);
    } else {
      this.available.push(ws);
    }
  }

  public dispose(): void {
    this.disposed = true;
    const err = new DetectorError('Detector is shutting down', 'DISPOSED');
    while (this.waitQueue.length > 0) {
      this.waitQueue.shift()?.reject(err);
    }
    this.available.length = 0;
  }
}

// ============================================================================
// 4. CORE DETECTOR IMPLEMENTATION
// ============================================================================

export class RealDetector {
  private readonly config: DetectorConfig;
  private readonly pool: WorkspacePool;

  private ortModule: typeof import('onnxruntime-node') | null = null;
  private sharpModule: typeof sharp | null = null;
  private session: InferenceSession | null = null;
  private inputName = '';
  private outputNames: readonly string[] = [];

  private initPromise: Promise<void> | null = null;
  private warmupPromise: Promise<void> | null = null;
  private available = false;
  private warmupDone = false;
  private disposed = false;

  /** Precomputed anchor grids per stride: [cx0, cy0, cx1, cy1, ...] */
  private readonly anchorGrids = new Map<number, Float32Array>();

  constructor(userConfig: Partial<DetectorConfig> = {}) {
    this.config = Object.freeze({ ...DEFAULT_CONFIG, ...userConfig });
    this.validateConfig(this.config);
    this.precomputeAnchorGrids();
    this.pool = new WorkspacePool(
      this.config.maxConcurrency,
      this.config.maxQueueSize,
      this.config.inputSize
    );
  }

  // --------------------------------------------------------------------------
  // Initialization & Lifecycle (Single-Flight & Memory-Safe)
  // --------------------------------------------------------------------------

  private validateConfig(cfg: DetectorConfig): void {
    if (!Number.isInteger(cfg.inputSize) || cfg.inputSize < 64 || cfg.inputSize % 32 !== 0) {
      throw new DetectorError(
        `Invalid inputSize (${cfg.inputSize}). Must be an integer multiple of 32 >= 64.`,
        'CONFIG_INVALID'
      );
    }
    if (cfg.confidenceThreshold <= 0 || cfg.confidenceThreshold >= 1) {
      throw new DetectorError(
        `Invalid confidenceThreshold (${cfg.confidenceThreshold}). Must be in (0, 1).`,
        'CONFIG_INVALID'
      );
    }
    if (cfg.nmsThreshold <= 0 || cfg.nmsThreshold >= 1) {
      throw new DetectorError(
        `Invalid nmsThreshold (${cfg.nmsThreshold}). Must be in (0, 1).`,
        'CONFIG_INVALID'
      );
    }
    if (cfg.maxConcurrency < 1) {
      throw new DetectorError('maxConcurrency must be >= 1', 'CONFIG_INVALID');
    }
  }

  /**
   * Precomputes anchor center coordinates (cx, cy) once at startup
   * to avoid integer division and modulo inside the hot decoding loop.
   */
  private precomputeAnchorGrids(): void {
    const size = this.config.inputSize;
    const offset = this.config.anchorCenterOffset;

    for (const stride of YUNET_STRIDES) {
      const feat = Math.floor(size / stride);
      const grid = new Float32Array(feat * feat * 2);
      let ptr = 0;
      for (let row = 0; row < feat; row++) {
        const cy = (row + offset) * stride;
        for (let col = 0; col < feat; col++) {
          grid[ptr++] = (col + offset) * stride;
          grid[ptr++] = cy;
        }
      }
      this.anchorGrids.set(stride, grid);
    }
  }

  /**
   * Thread-safe, idempotent initialization. Concurrent calls share the same Promise.
   */
  public async initialize(): Promise<void> {
    if (this.disposed) {
      throw new DetectorError('Cannot initialize a disposed RealDetector', 'DISPOSED');
    }
    if (this.available && this.session) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.performInitialize().finally(() => {
      this.initPromise = null;
    });

    return this.initPromise;
  }

  private async performInitialize(): Promise<void> {
    if (!this.config.modelPath) {
      logger.warn('Model path is empty. Detector will remain unavailable.');
      this.available = false;
      return;
    }

    try {
      await fs.access(this.config.modelPath);
    } catch {
      logger.warn(`YuNet model file not found at: ${this.config.modelPath}`);
      this.available = false;
      return;
    }

    try {
      const [ort, sharpMod] = await Promise.all([
        import('onnxruntime-node'),
        import('sharp'),
      ]);

      this.ortModule = ort;
      this.sharpModule = (sharpMod.default ?? sharpMod) as unknown as typeof sharp;

      const sessionOptions: InferenceSession.SessionOptions = {
        executionProviders: [...this.config.executionProviders],
        graphOptimizationLevel: 'all',
        enableCpuMemArena: true,
        enableMemPattern: true,
        ...(this.config.intraOpNumThreads > 0
          ? { intraOpNumThreads: this.config.intraOpNumThreads }
          : {}),
      };

      // Pass file path directly to ONNX Runtime C++ core instead of fs.readFileSync buffer
      // to avoid duplicating the model weight buffer in V8 Heap.
      const session = await ort.InferenceSession.create(this.config.modelPath, sessionOptions);

      this.validateModelOutputs(session.outputNames);

      this.session = session;
      this.inputName = session.inputNames[0];
      this.outputNames = Object.freeze([...session.outputNames]);
      this.available = true;

      logger.info(
        `YuNet initialized [path=${this.config.modelPath}, size=${this.config.inputSize}, providers=${this.config.executionProviders.join(',')}]`
      );
    } catch (error) {
      this.available = false;
      logger.error('Failed to initialize YuNet ONNX session:', error);
      throw new DetectorError('ONNX session initialization failed', 'MODEL_LOAD_FAILED', error);
    }
  }

  private validateModelOutputs(outputNames: readonly string[]): void {
    const outputSet = new Set(outputNames);
    for (const stride of YUNET_STRIDES) {
      for (const prefix of ['cls', 'obj', 'bbox', 'kps']) {
        const expected = `${prefix}_${stride}`;
        if (!outputSet.has(expected)) {
          throw new DetectorError(
            `Incompatible ONNX model: missing expected YuNet head "${expected}". Found: [${outputNames.join(', ')}]`,
            'MODEL_LOAD_FAILED'
          );
        }
      }
    }
  }

  /**
   * Idempotent warmup pass that triggers ONNX kernel compilation and memory arena allocation.
   */
  public async warmup(): Promise<void> {
    if (!this.available || !this.session || this.warmupDone || this.disposed) return;
    if (this.warmupPromise) return this.warmupPromise;

    this.warmupPromise = (async () => {
      const ws = await this.pool.acquire();
      let inputTensor: Tensor | null = null;
      let outputs: InferenceSession.OnnxValueMapType | null = null;

      try {
        ws.tensorBuffer.fill(0);
        inputTensor = new this.ortModule!.Tensor('float32', ws.tensorBuffer, [
          1,
          NUM_CHANNELS,
          this.config.inputSize,
          this.config.inputSize,
        ]);
        outputs = await this.session!.run({ [this.inputName]: inputTensor });
        this.warmupDone = true;
        logger.info('YuNet warmup inference complete');
      } catch (error) {
        logger.warn('YuNet warmup failed:', error);
      } finally {
        this.disposeTensor(inputTensor);
        this.disposeOutputMap(outputs);
        this.pool.release(ws);
        this.warmupPromise = null;
      }
    })();

    return this.warmupPromise;
  }

  // --------------------------------------------------------------------------
  // Public Detection API
  // --------------------------------------------------------------------------

  /**
   * Drop-in compatible method returning `DetectedFace[]`.
   */
  public async detectFaces(input: FaceDetectionInput): Promise<DetectedFace[]> {
    const { faces } = await this.detectFacesWithTelemetry(input);
    return faces;
  }

  /**
   * Extended Senior API returning both detected faces and stage-by-stage latency telemetry.
   */
  public async detectFacesWithTelemetry(input: FaceDetectionInput): Promise<DetectionResult> {
    if (this.disposed) {
      throw new DetectorError('RealDetector has been disposed', 'DISPOSED');
    }
    if (!this.available || !this.session || !this.ortModule || !this.sharpModule) {
      throw new DetectorError(
        'Face detector is not available. Call initialize() and ensure the ONNX model exists.',
        'NOT_INITIALIZED'
      );
    }
    if (!input?.imageBuffer || input.imageBuffer.byteLength === 0) {
      throw new DetectorError('Invalid input: imageBuffer is empty or missing', 'INVALID_IMAGE');
    }

    const t0 = performance.now();
    const ws = await this.pool.acquire();

    let inputTensor: Tensor | null = null;
    let results: InferenceSession.OnnxValueMapType | null = null;

    try {
      // 1. Preprocess: EXIF auto-orient, Letterbox resize, RGB->BGR Planar NCHW
      const tPreStart = performance.now();
      const letterbox = await this.preprocessImage(input.imageBuffer, ws.tensorBuffer);
      const preprocessMs = performance.now() - tPreStart;

      // 2. ONNX Runtime Inference
      const tInfStart = performance.now();
      inputTensor = new this.ortModule.Tensor('float32', ws.tensorBuffer, [
        1,
        NUM_CHANNELS,
        this.config.inputSize,
        this.config.inputSize,
      ]);
      results = await this.session.run({ [this.inputName]: inputTensor });
      const inferenceMs = performance.now() - tInfStart;

      // 3. Postprocess: Multi-stride decode, Top-K selection, SoA NMS, Coordinate un-letterboxing
      const tPostStart = performance.now();
      const { faces, candidateCount } = this.decodeAndPostprocess(results, ws, letterbox);
      const postprocessMs = performance.now() - tPostStart;

      return {
        faces,
        telemetry: {
          preprocessMs,
          inferenceMs,
          postprocessMs,
          totalMs: performance.now() - t0,
          candidateCount,
          retainedCount: faces.length,
        },
      };
    } catch (error) {
      if (error instanceof DetectorError) throw error;
      throw new DetectorError('Face detection pipeline failed', 'INFERENCE_FAILED', error);
    } finally {
      // Deterministic cleanup of native C++ ONNX tensors to prevent memory leaks
      this.disposeTensor(inputTensor);
      this.disposeOutputMap(results);
      this.pool.release(ws);
    }
  }

  // --------------------------------------------------------------------------
  // Stage 1: Image Preprocessing & 1D Planar Transposition
  // --------------------------------------------------------------------------

  private async preprocessImage(
    imageBuffer: Buffer | Uint8Array,
    targetTensorBuffer: Float32Array
  ): Promise<{
    origWidth: number;
    origHeight: number;
    scale: number;
    padX: number;
    padY: number;
  }> {
    const sharp = this.sharpModule!;
    const inputSize = this.config.inputSize;

    // Single Sharp instance with anti-decompression-bomb limit
    const pipeline = sharp(imageBuffer, {
      limitInputPixels: this.config.maxImagePixels,
      failOn: 'error',
    });

    let meta: import('sharp').Metadata;
    try {
      meta = await pipeline.metadata();
    } catch (err) {
      throw new DetectorError('Failed to read image metadata or corrupt image buffer', 'INVALID_IMAGE', err);
    }

    const orientation = meta.orientation ?? 1;
    const swapsAxes = orientation >= 5 && orientation <= 8;
    const origWidth = (swapsAxes ? meta.height : meta.width) ?? 0;
    const origHeight = (swapsAxes ? meta.width : meta.height) ?? 0;

    if (origWidth <= 0 || origHeight <= 0) {
      throw new DetectorError('Invalid image: dimensions could not be resolved', 'INVALID_IMAGE');
    }

    // Compute aspect-preserving letterbox parameters
    const scale = Math.min(inputSize / origWidth, inputSize / origHeight);
    const scaledW = Math.min(inputSize, Math.max(1, Math.round(origWidth * scale)));
    const scaledH = Math.min(inputSize, Math.max(1, Math.round(origHeight * scale)));
    const padX = Math.floor((inputSize - scaledW) / 2);
    const padY = Math.floor((inputSize - scaledH) / 2);

    const { data, info } = await pipeline
      .rotate() // Apply EXIF orientation first
      .toColorspace('srgb') // Guarantee 3-channel RGB even for Grayscale/CMYK inputs
      .removeAlpha() // Strip alpha channel if present
      .resize(scaledW, scaledH, {
        fit: 'fill',
        kernel: 'lanczos3',
        fastShrinkOnLoad: true,
      })
      .extend({
        top: padY,
        bottom: inputSize - scaledH - padY,
        left: padX,
        right: inputSize - scaledW - padX,
        background: { r: 0, g: 0, b: 0 },
      })
      .raw()
      .toBuffer({ resolveWithObject: true });

    if (info.width !== inputSize || info.height !== inputSize || info.channels !== 3) {
      throw new DetectorError(
        `Unexpected preprocessed buffer shape: ${info.width}x${info.height}x${info.channels}`,
        'INVALID_IMAGE'
      );
    }

    // Fast 1D Planar Transposition: Interleaved RGB [H, W, 3] -> Planar BGR [3, H, W]
    // Zero inner branching, single pass over pixels, sequential writes per plane.
    const planeSize = inputSize * inputSize;
    const bOffset = 0;
    const gOffset = planeSize;
    const rOffset = planeSize * 2;

    for (let pixelIdx = 0, byteIdx = 0; pixelIdx < planeSize; pixelIdx++, byteIdx += 3) {
      targetTensorBuffer[bOffset + pixelIdx] = data[byteIdx + 2]; // Blue
      targetTensorBuffer[gOffset + pixelIdx] = data[byteIdx + 1]; // Green
      targetTensorBuffer[rOffset + pixelIdx] = data[byteIdx];     // Red
    }

    return { origWidth, origHeight, scale, padX, padY };
  }

  // --------------------------------------------------------------------------
  // Stage 2: Multi-Stride Decoding, SoA NMS & Coordinate Un-Letterboxing
  // --------------------------------------------------------------------------

  private decodeAndPostprocess(
    results: InferenceSession.OnnxValueMapType,
    ws: ExecutionWorkspace,
    letterbox: { origWidth: number; origHeight: number; scale: number; padX: number; padY: number }
  ): { faces: DetectedFace[]; candidateCount: number } {
    const threshold = this.config.confidenceThreshold;
    const {
      candX1,
      candY1,
      candX2,
      candY2,
      candArea,
      candScore,
      candLandmarks,
      sortIndices,
      suppressedMask,
    } = ws;

    let count = 0;

    for (const stride of YUNET_STRIDES) {
      const clsData = results[`cls_${stride}`]?.data as Float32Array | undefined;
      const objData = results[`obj_${stride}`]?.data as Float32Array | undefined;
      const bboxData = results[`bbox_${stride}`]?.data as Float32Array | undefined;
      const kpsData = results[`kps_${stride}`]?.data as Float32Array | undefined;
      const grid = this.anchorGrids.get(stride);

      if (!clsData || !objData || !bboxData || !grid) continue;

      const numAnchors = clsData.length;

      for (let i = 0; i < numAnchors; i++) {
        // YuNet exports sigmoid in-graph; score is the direct product of cls and obj
        const score = clsData[i] * objData[i];
        if (!(score >= threshold)) continue; // Handles NaN safely as well

        const gridOffset = i * 2;
        const cx = grid[gridOffset];
        const cy = grid[gridOffset + 1];

        const bboxOffset = i * 4;
        const dx = bboxData[bboxOffset];
        const dy = bboxData[bboxOffset + 1];
        // Clamp dw/dh logits to prevent Math.exp overflow to Infinity on corrupted inputs
        const dw = Math.min(MAX_SCALE_LOGIT, Math.max(MIN_SCALE_LOGIT, bboxData[bboxOffset + 2]));
        const dh = Math.min(MAX_SCALE_LOGIT, Math.max(MIN_SCALE_LOGIT, bboxData[bboxOffset + 3]));

        const boxCenterX = cx + dx * stride;
        const boxCenterY = cy + dy * stride;
        const halfW = (Math.exp(dw) * stride) * 0.5;
        const halfH = (Math.exp(dh) * stride) * 0.5;

        const x1 = boxCenterX - halfW;
        const y1 = boxCenterY - halfH;
        const x2 = boxCenterX + halfW;
        const y2 = boxCenterY + halfH;

        candX1[count] = x1;
        candY1[count] = y1;
        candX2[count] = x2;
        candY2[count] = y2;
        candArea[count] = (x2 - x1) * (y2 - y1);
        candScore[count] = score;

        const dstKpsOffset = count * LANDMARK_COORDS;
        if (kpsData) {
          const srcKpsOffset = i * LANDMARK_COORDS;
          for (let k = 0; k < LANDMARK_COORDS; k += 2) {
            candLandmarks[dstKpsOffset + k] = cx + kpsData[srcKpsOffset + k] * stride;
            candLandmarks[dstKpsOffset + k + 1] = cy + kpsData[srcKpsOffset + k + 1] * stride;
          }
        }

        sortIndices[count] = count;
        count++;
      }
    }

    if (count === 0) {
      return { faces: [], candidateCount: 0 };
    }

    // Sort candidate indices by descending score using a view over active candidates
    const activeIndices = sortIndices.subarray(0, count);
    activeIndices.sort((a, b) => candScore[b] - candScore[a]);

    // Cap pre-NMS candidates to bound quadratic NMS complexity
    const nmsCount = Math.min(count, this.config.topKPreNms);
    suppressedMask.fill(0, 0, nmsCount);

    const iouThreshold = this.config.nmsThreshold;
    const maxDetections = this.config.maxDetections;
    const { origWidth, origHeight, scale, padX, padY } = letterbox;
    const invScale = 1.0 / scale;

    const faces: DetectedFace[] = [];

    for (let i = 0; i < nmsCount; i++) {
      if (suppressedMask[i] === 1) continue;

      const idxA = activeIndices[i];
      const ax1 = candX1[idxA];
      const ay1 = candY1[idxA];
      const ax2 = candX2[idxA];
      const ay2 = candY2[idxA];
      const areaA = candArea[idxA];

      // Convert corners from letterboxed canvas space back to original oriented image space
      // Clamping BOTH corners to [0, origDim] before computing width/height prevents box shifting!
      const origX1 = Math.min(origWidth, Math.max(0, Math.round((ax1 - padX) * invScale)));
      const origY1 = Math.min(origHeight, Math.max(0, Math.round((ay1 - padY) * invScale)));
      const origX2 = Math.min(origWidth, Math.max(0, Math.round((ax2 - padX) * invScale)));
      const origY2 = Math.min(origHeight, Math.max(0, Math.round((ay2 - padY) * invScale)));

      const boxWidth = origX2 - origX1;
      const boxHeight = origY2 - origY1;

      // Skip degenerate boxes that collapsed entirely into the letterbox padding
      if (boxWidth >= 1 && boxHeight >= 1) {
        const boundingBox: BoundingBox = {
          x: origX1,
          y: origY1,
          width: boxWidth,
          height: boxHeight,
        };

        const kpsBase = idxA * LANDMARK_COORDS;
        const landmarks: Point2D[] = new Array(NUM_LANDMARKS);
        for (let k = 0; k < NUM_LANDMARKS; k++) {
          const rawLx = candLandmarks[kpsBase + k * 2];
          const rawLy = candLandmarks[kpsBase + k * 2 + 1];
          landmarks[k] = {
            x: Math.min(origWidth, Math.max(0, Math.round((rawLx - padX) * invScale))),
            y: Math.min(origHeight, Math.max(0, Math.round((rawLy - padY) * invScale))),
          };
        }

        faces.push({
          boundingBox,
          confidence: candScore[idxA],
          landmarks,
        });

        if (faces.length >= maxDetections) break;
      }

      // Suppress overlapping lower-scoring boxes
      for (let j = i + 1; j < nmsCount; j++) {
        if (suppressedMask[j] === 1) continue;

        const idxB = activeIndices[j];
        const interX1 = ax1 > candX1[idxB] ? ax1 : candX1[idxB];
        const interY1 = ay1 > candY1[idxB] ? ay1 : candY1[idxB];
        const interX2 = ax2 < candX2[idxB] ? ax2 : candX2[idxB];
        const interY2 = ay2 < candY2[idxB] ? ay2 : candY2[idxB];

        const interW = interX2 - interX1;
        const interH = interY2 - interY1;

        if (interW > 0 && interH > 0) {
          const interArea = interW * interH;
          const unionArea = areaA + candArea[idxB] - interArea;
          if (unionArea > 0 && interArea / unionArea > iouThreshold) {
            suppressedMask[j] = 1;
          }
        }
      }
    }

    return { faces, candidateCount: count };
  }

  // --------------------------------------------------------------------------
  // Native Memory Cleanup & Disposal
  // --------------------------------------------------------------------------

  private disposeTensor(tensor: Tensor | null | undefined): void {
    if (!tensor) return;
    try {
      if (typeof (tensor as { dispose?: () => void }).dispose === 'function') {
        (tensor as { dispose: () => void }).dispose();
      }
    } catch (err) {
      logger.debug?.('Failed to dispose input tensor:', err);
    }
  }

  private disposeOutputMap(outputs: InferenceSession.OnnxValueMapType | null | undefined): void {
    if (!outputs) return;
    for (const key of Object.keys(outputs)) {
      this.disposeTensor(outputs[key]);
    }
  }

  public isAvailable(): boolean {
    return this.available && !this.disposed;
  }

  public getModelVersion(): string {
    return `yunet-${this.config.inputSize}`;
  }

  public getOutputNames(): readonly string[] {
    return this.outputNames;
  }

  /**
   * Gracefully releases the ONNX C++ InferenceSession and rejects queued tasks.
   */
  public async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.available = false;
    this.warmupDone = false;

    this.pool.dispose();

    if (this.session) {
      try {
        const releasable = this.session as unknown as { release?: () => Promise<void> };
        if (typeof releasable.release === 'function') {
          await releasable.release();
        }
      } catch (error) {
        logger.warn('Error releasing ONNX session during dispose:', error);
      } finally {
        this.session = null;
      }
    }
  }

  /**
   * Support for TypeScript 5.2+ `await using detector = new RealDetector(...)`
   */
  public async [Symbol.asyncDispose](): Promise<void> {
    await this.dispose();
  }
}