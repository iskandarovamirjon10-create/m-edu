/**
 * Real Face Embedder — production face embedding using ONNX Runtime.
 *
 * Generates 512-dimensional face embeddings using an ArcFace-compatible ONNX model.
 * The embedding is a normalized vector that uniquely represents a face.
 *
 * Model requirements:
 * - Input: NCHW float32 tensor (112x112 or 128x128 depending on model)
 * - Output: L2-normalized embedding vector (512-dim for ArcFace-R100)
 *
 * IMPORTANT: Enrollment and recognition MUST use the same model and
 * preprocessing pipeline. Mismatched models produce incompatible embeddings.
 */

import type { EmbeddingInput, FaceEmbedding } from '@medu/core';
import { FaceEmbedding as FaceEmbeddingVO } from '@medu/core';
import { createLogger } from '../lib/logger';
import { CANONICAL_112_LANDMARKS, computeSimilarityTransform, warpAffineBilinear } from '../lib/alignment';

const logger = createLogger('RealEmbedder');
import type { InferenceSession } from 'onnxruntime-node';
import * as fs from 'fs';

export interface EmbedderConfig {
  /** Path to the ONNX embedding model */
  modelPath: string;
  /** Input image size for the model (e.g., 112 for ArcFace) */
  inputSize: number;
  /** Embedding dimension (e.g., 512 for ArcFace-R100) */
  embeddingDimension: number;
  /** Whether to L2-normalize the output */
  normalize: boolean;
  /** Pixel mean values for preprocessing (RGB order, matching the SFace tensor) */
  mean: [number, number, number];
  /** Pixel std values for preprocessing */
  std: [number, number, number];
}

const DEFAULT_CONFIG: EmbedderConfig = {
  modelPath: '',
  inputSize: 112,
  embeddingDimension: 128,
  normalize: true,
  // OpenCV SFace contract (FaceRecognizerSFImpl::feature, opencv/modules/objdetect/src/face_recognize.cpp):
  //   blobFromImage(aligned, scale=1, Size(112,112), mean=(0,0,0), swapRB=true, crop=false)
  // i.e. raw BGR values in [0,255] with NO mean/std normalization. The previous
  // ArcFace-style (x - 127.5) / 128 default compressed every face (same AND
  // different person) into a narrow ~0.85+ cosine band, so the 0.6 threshold
  // accepted strangers. Keep [0,0,0]/[1,1,1] as the SFace default; other
  // models can still override mean/std explicitly.
  mean: [0, 0, 0],
  std: [1, 1, 1],
};

export class RealEmbedder {
  private session: InferenceSession | null = null;
  private config: EmbedderConfig;
  private available = false;
  private warmupDone = false;

  constructor(config: Partial<EmbedderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the embedder by loading the ONNX model.
   */
  async initialize(): Promise<void> {
    try {
      const ort = await import('onnxruntime-node');

      if (!this.config.modelPath || !fs.existsSync(this.config.modelPath)) {
        logger.warn(
          `Model not found at: ${this.config.modelPath || '(not configured)'}. ` +
          `Embedder will be unavailable. Set FACE_EMBEDDER_MODEL_PATH to a valid ONNX model.`
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
   * Generate a face embedding from an image and detected face.
   * Uses 5-point facial landmark alignment (canonical 112x112 similarity transform)
   * if landmarks are present; otherwise falls back to bounding-box expansion crop.
   */
  async generateEmbedding(input: EmbeddingInput): Promise<FaceEmbedding> {
    if (!this.available || !this.session) {
      throw new Error('Face embedder is not available. Ensure the ONNX model is configured.');
    }
    const session = this.session;

    const sharp = (await import('sharp')).default;
    const inputSize = this.config.inputSize;
    let alignedData: Uint8Array | Buffer;

    if (input.face.landmarks && input.face.landmarks.length >= 3) {
      // 5-point facial landmark similarity transform alignment
      const { data: rawImgData, info: rawImgInfo } = await sharp(input.imageBuffer)
        .rotate()
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const scale = inputSize / 112;
      const dstPts =
        scale === 1
          ? CANONICAL_112_LANDMARKS
          : CANONICAL_112_LANDMARKS.map(([x, y]) => [x * scale, y * scale] as [number, number]);

      const transform = computeSimilarityTransform(input.face.landmarks, dstPts);
      alignedData = warpAffineBilinear(
        rawImgData,
        rawImgInfo.width,
        rawImgInfo.height,
        transform.invMatrix,
        inputSize
      );
    } else {
      const { boundingBox } = input.face;

      // Oriented dimensions: the detector auto-applies EXIF rotation before
      // producing this bbox, so clamp against the ROTATED size (metadata()
      // itself reports pre-rotation width/height).
      const rawMeta = await sharp(input.imageBuffer).metadata();
      const orientation = rawMeta.orientation ?? 1;
      const swapsAxes = orientation >= 5 && orientation <= 8;
      const orientedW = (swapsAxes ? rawMeta.height : rawMeta.width) || 0;
      const orientedH = (swapsAxes ? rawMeta.width : rawMeta.height) || 0;

      // Crop face region with some margin
      const margin = 0.2;
      const cropX = Math.max(0, Math.round(boundingBox.x - boundingBox.width * margin));
      const cropY = Math.max(0, Math.round(boundingBox.y - boundingBox.height * margin));
      const cropW = Math.round(boundingBox.width * (1 + 2 * margin));
      const cropH = Math.round(boundingBox.height * (1 + 2 * margin));
      const clampedW = Math.max(1, Math.min(cropW, orientedW - cropX));
      const clampedH = Math.max(1, Math.min(cropH, orientedH - cropY));

      // Resize to model input size and convert to float32 tensor.
      // `.rotate()` applies EXIF auto-orientation FIRST so the bounding box
      // (computed by the detector on the oriented image) stays valid.
      const { data } = await sharp(input.imageBuffer)
        .rotate()
        .extract({
          left: cropX,
          top: cropY,
          width: clampedW,
          height: clampedH,
        })
        .resize(inputSize, inputSize, { fit: 'fill' })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      alignedData = data;
    }

    // Convert to NCHW float32 tensor.
    // sharp raw output is already RGB, which is exactly what OpenCV's SFace
    // consumes: FaceRecognizerSF::feature calls
    //   blobFromImage(aligned, scale=1, Size(112,112), mean=(0,0,0), swapRB=true, crop=false)
    // `swapRB=true` turns OpenCV's native BGR imread result into RGB for the
    // network, so the network input is RGB — we must NOT swap to BGR here.
    // Verified against real OpenCV FaceRecognizerSF: feeding RGB raw [0,255]
    // reproduces its cosine scores exactly (F1=0.194, F2=0.590, manager=0.094);
    // feeding BGR or applying (x-127.5)/128 does not.
    const channels = 3;
    const height = inputSize;
    const width = inputSize;
    const tensorData = new Float32Array(channels * height * width);

    for (let c = 0; c < channels; c++) {
      for (let h = 0; h < height; h++) {
        for (let w = 0; w < width; w++) {
          const srcIdx = (h * width + w) * channels + c;
          const pixel = alignedData[srcIdx];
          tensorData[c * height * width + h * width + w] =
            (pixel - this.config.mean[c]) / this.config.std[c];
        }
      }
    }

    const ort = await import('onnxruntime-node');
    const inputTensor = new ort.Tensor('float32', tensorData, [1, channels, height, width]);

    // Run inference
    const inputName = session.inputNames[0];
    const results = await session.run({ [inputName]: inputTensor });

    // Extract embedding from output
    const outputName = session.outputNames[0];
    const output = results[outputName];
    const rawData = output.data;
    // ArcFace-compatible models emit float32 tensors; guard against other
    // tensor dtypes (uint8/int8/string) so we never feed garbage to the L2
    // normalization / distance math below.
    let embeddingData = rawData instanceof Float32Array
      ? rawData
      : new Float32Array(rawData as ArrayLike<number>);

    // DIMENSION CONTRACT: the model output MUST match the configured
    // embedding dimension. Silent padding/truncation used to produce
    // plausible-looking but meaningless vectors — after a model swap or a
    // config typo, recognition silently degraded to "nobody matches" with no
    // error at all (regression: FE-1). Refuse loudly instead.
    if (embeddingData.length !== this.config.embeddingDimension) {
      throw new Error(
        `Embedding dimension mismatch: model produced dim=${embeddingData.length}, ` +
          `config expects dim=${this.config.embeddingDimension}. ` +
          `Refusing to pad/truncate a biometric embedding.`,
      );
    }

    // L2-normalize if configured
    // Zero-norm must reject regardless of the normalize flag: a degenerate
    // embedding vector would otherwise be returned when normalize:false and
    // poison similarity math downstream (re-audit finding #9).
    let norm = 0;
    for (let i = 0; i < embeddingData.length; i++) {
      norm += embeddingData[i] * embeddingData[i];
    }
    norm = Math.sqrt(norm);
    if (norm === 0) {
      throw new Error(
        'Embedding norm is 0 — degenerate/zero embedding; refusing to normalize.',
      );
    }
    if (this.config.normalize) {
      if (norm > 0) {
        for (let i = 0; i < embeddingData.length; i++) {
          embeddingData[i] /= norm;
        }
      }
    }

    return new FaceEmbeddingVO(embeddingData);
  }

  getDimension(): number {
    return this.config.embeddingDimension;
  }

  getModelVersion(): string {
    return `real-embedder-onnx-${this.config.inputSize}d${this.config.embeddingDimension}`;
  }

  isAvailable(): boolean {
    return this.available;
  }
}
