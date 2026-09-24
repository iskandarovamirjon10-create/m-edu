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
  /** Pixel mean values for preprocessing (BGR order) */
  mean: [number, number, number];
  /** Pixel std values for preprocessing */
  std: [number, number, number];
}

const DEFAULT_CONFIG: EmbedderConfig = {
  modelPath: '',
  inputSize: 112,
  embeddingDimension: 128,
  normalize: true,
  mean: [127.5, 127.5, 127.5],
  std: [128.0, 128.0, 128.0],
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
   * The face bounding box is used to crop and align the face.
   */
  async generateEmbedding(input: EmbeddingInput): Promise<FaceEmbedding> {
    if (!this.available || !this.session) {
      throw new Error('Face embedder is not available. Ensure the ONNX model is configured.');
    }
    const session = this.session;

    const sharp = (await import('sharp')).default;
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
    const { data, info } = await sharp(input.imageBuffer)
      .rotate()
      .extract({
        left: cropX,
        top: cropY,
        width: clampedW,
        height: clampedH,
      })
      .resize(this.config.inputSize, this.config.inputSize, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Convert to NCHW float32 tensor with mean/std normalization.
    // sharp raw output is RGB; SFace (OpenCV-zoo) expects BGR -> swap R/B,
    // matching the detector and liveness preprocessing pipelines.
    const channels = 3;
    const height = info.height;
    const width = info.width;
    const tensorData = new Float32Array(channels * height * width);

    for (let c = 0; c < channels; c++) {
      for (let h = 0; h < height; h++) {
        for (let w = 0; w < width; w++) {
          const srcIdx = (h * width + w) * channels + c;
          const bgrSrcIdx = c === 0 ? srcIdx + 2 : c === 2 ? srcIdx - 2 : srcIdx;
          const pixel = data[bgrSrcIdx];
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

    // Truncate or pad to expected dimension
    if (embeddingData.length > this.config.embeddingDimension) {
      embeddingData = embeddingData.slice(0, this.config.embeddingDimension);
    } else if (embeddingData.length < this.config.embeddingDimension) {
      const padded = new Float32Array(this.config.embeddingDimension);
      padded.set(embeddingData);
      embeddingData = padded;
    }

    // L2-normalize if configured
    if (this.config.normalize) {
      let norm = 0;
      for (let i = 0; i < embeddingData.length; i++) {
        norm += embeddingData[i] * embeddingData[i];
      }
      norm = Math.sqrt(norm);
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
