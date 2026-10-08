/**
 * Real Face Detector — production face detection using ONNX Runtime.
 *
 * Implements YuNet face detection model decoding.
 * YuNet outputs 12 detection heads across 3 strides (8, 16, 32):
 *   - cls_{s}: [1, A, 1] classification score
 *   - obj_{s}: [1, A, 1] objectness score
 *   - bbox_{s}: [1, A, 4] bounding box regression (dx, dy, dw, dh)
 *   - kps_{s}: [1, A, 10] 5 landmarks (x, y) pairs
 *
 * Decoded per face: [x, y, w, h, 10 landmark coords, score] (15 values)
 *
 * Input: BGR image 0-255 (NO normalization), NCHW float32 [1,3,640,640]
 *
 * License: MIT (YuNet model from OpenCV Zoo)
 */

import type { FaceDetectionInput, DetectedFace, BoundingBox, Point2D } from '@medu/core';
import { createLogger } from '../lib/logger';

const logger = createLogger('RealDetector');
import type { InferenceSession } from 'onnxruntime-node';
import * as fs from 'fs';

export interface DetectorConfig {
  modelPath: string;
  inputSize: number;
  confidenceThreshold: number;
  nmsThreshold: number;
}

const DEFAULT_CONFIG: DetectorConfig = {
  modelPath: '',
  inputSize: 640,
  confidenceThreshold: 0.5,
  nmsThreshold: 0.4,
};

const YUNET_STRIDES = [8, 16, 32];

/**
 * Hard ceiling on decoded candidates handed to NMS.
 *
 * NMS is O(n^2) over the candidate list. A noisy or adversarial frame can
 * push a large number of anchors above the confidence threshold, and without
 * a cap a single frame could monopolise the CPU for the worker's whole frame
 * budget. Decoded candidates are score-sorted inside `nms` anyway, so
 * keeping the highest-scoring window costs nothing operationally.
 */
const MAX_PRE_NMS_CANDIDATES = 256;

export class RealDetector {
  private session: InferenceSession | null = null;
  private config: DetectorConfig;
  private available = false;
  private warmupDone = false;
  private outputNames: string[] = [];

  constructor(config: Partial<DetectorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async initialize(): Promise<void> {
    try {
      const ort = await import('onnxruntime-node');

      if (!this.config.modelPath || !fs.existsSync(this.config.modelPath)) {
        logger.warn(
          `Model not found at: ${this.config.modelPath || '(not configured)'}. ` +
          `Detector will be unavailable.`
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

      this.outputNames = [...session.outputNames];
      this.available = true;
      logger.info(`YuNet model loaded: ${this.config.modelPath}`);
      logger.info(`Outputs: ${this.outputNames.join(', ')}`);
    } catch (error) {
      logger.error(`Failed to initialize:`, error);
      this.available = false;
    }
  }

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
   * Detect faces in an image using YuNet.
   * Returns bounding boxes with confidence scores and 5-landmark keypoints.
   */
  async detectFaces(input: FaceDetectionInput): Promise<DetectedFace[]> {
    if (!this.available || !this.session) {
      throw new Error('Face detector is not available. Ensure the ONNX model is configured.');
    }
    const session = this.session;

    const sharp = (await import('sharp')).default;
    const inputSize = this.config.inputSize;

    // Get original image dimensions for coordinate scaling.
    // Use ORIENTED dimensions: the tensor below is EXIF-rotated, so boxes
    // decoded in rotated space must be scaled against the rotated size.
    const originalMeta = await sharp(input.imageBuffer).metadata();
    const orientation = originalMeta.orientation ?? 1;
    const swapsAxes = orientation >= 5 && orientation <= 8;
    const origWidth = (swapsAxes ? originalMeta.height : originalMeta.width) || 0;
    const origHeight = (swapsAxes ? originalMeta.width : originalMeta.height) || 0;

    if (origWidth === 0 || origHeight === 0) {
      throw new Error('Invalid image: could not read dimensions');
    }

    // Letterbox resize: preserve the source aspect ratio and pad to the model
    // canvas. The previous `fit: 'fill'` stretched a 640x480 (or any
    // non-square) frame into a 640x640 square, distorting every face and
    // shifting YuNet's landmarks — which then degraded the SFace embedding.
    // OpenCV's FaceDetectorYN likewise runs at the source resolution
    // (padded to a multiple of 32) instead of stretching.
    const scale = Math.min(inputSize / origWidth, inputSize / origHeight);
    const scaledW = Math.max(1, Math.round(origWidth * scale));
    const scaledH = Math.max(1, Math.round(origHeight * scale));
    const padX = Math.floor((inputSize - scaledW) / 2);
    const padY = Math.floor((inputSize - scaledH) / 2);

    const { data, info } = await sharp(input.imageBuffer)
      // Auto-apply EXIF orientation — photos from phones/webcams are often
      // stored rotated (orientation=6 etc.); skipping this rotates the face
      // sideways and destroys detection.
      .rotate()
      .resize(scaledW, scaledH, { fit: 'fill' })
      .extend({
        top: padY,
        bottom: inputSize - scaledH - padY,
        left: padX,
        right: inputSize - scaledW - padX,
        background: { r: 0, g: 0, b: 0 },
      })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const channels = 3;
    const height = info.height;
    const width = info.width;

    // NCHW layout, raw 0-255 values (YuNet does NOT expect [0,1] normalization).
    // sharp raw output is RGB; YuNet expects BGR -> swap R/B (validated: BGR
    // yields higher detection scores than RGB on ground-truth faces).
    const tensorData = new Float32Array(channels * height * width);

    for (let c = 0; c < channels; c++) {
      for (let h = 0; h < height; h++) {
        for (let w = 0; w < width; w++) {
          const srcIdx = (h * width + w) * channels + c;
          const bgrSrcIdx = c === 0 ? srcIdx + 2 : c === 2 ? srcIdx - 2 : srcIdx;
          tensorData[c * height * width + h * width + w] = data[bgrSrcIdx];
        }
      }
    }

    const ort = await import('onnxruntime-node');
    const inputTensor = new ort.Tensor('float32', tensorData, [1, channels, height, width]);

    // Run inference
    const inputName = session.inputNames[0];
    const results = await session.run({ [inputName]: inputTensor });

    // Decode YuNet output
    const rawFaces = this.decodeYuNetOutput(results, inputSize, inputSize);

    // Map canvas coordinates (letterboxed) back to the oriented source image.
    const toOrigX = (v: number) => (v - padX) / scale;
    const toOrigY = (v: number) => (v - padY) / scale;

    const faces: DetectedFace[] = [];
    for (const raw of rawFaces) {
      if (raw.score < this.config.confidenceThreshold) continue;

      const box: BoundingBox = {
        x: Math.max(0, Math.round(toOrigX(raw.x))),
        y: Math.max(0, Math.round(toOrigY(raw.y))),
        width: Math.max(1, Math.round(raw.w / scale)),
        height: Math.max(1, Math.round(raw.h / scale)),
      };

      let landmarks: Point2D[] | undefined;
      if (raw.landmarks && raw.landmarks.length === 10) {
        landmarks = [
          { x: Math.round(toOrigX(raw.landmarks[0])), y: Math.round(toOrigY(raw.landmarks[1])) },
          { x: Math.round(toOrigX(raw.landmarks[2])), y: Math.round(toOrigY(raw.landmarks[3])) },
          { x: Math.round(toOrigX(raw.landmarks[4])), y: Math.round(toOrigY(raw.landmarks[5])) },
          { x: Math.round(toOrigX(raw.landmarks[6])), y: Math.round(toOrigY(raw.landmarks[7])) },
          { x: Math.round(toOrigX(raw.landmarks[8])), y: Math.round(toOrigY(raw.landmarks[9])) },
        ];
      }

      faces.push({ boundingBox: box, confidence: raw.score, landmarks });
    }

    return faces;
  }

  /**
   * Decode YuNet multi-head output into face detections.
   *
   * YuNet outputs 12 tensors across 3 strides:
   *   cls_8, obj_8, bbox_8, kps_8    (stride 8, feature map 80x80)
   *   cls_16, obj_16, bbox_16, kps_16 (stride 16, feature map 40x40)
   *   cls_32, obj_32, bbox_32, kps_32 (stride 32, feature map 20x20)
   *
   * Each position has:
   *   - cls: sigmoid classification score
   *   - obj: sigmoid objectness score
   *   - bbox: (dx, dy, dw, dh) regression relative to anchor center
   *   - kps: (x1,y1,...,x5,y5) 5 landmark offsets relative to anchor center
   */
  private decodeYuNetOutput(
    results: Record<string, { data: unknown }>,
    inputHeight: number,
    inputWidth: number
  ): Array<{ x: number; y: number; w: number; h: number; score: number; landmarks: number[] }> {
    const faces: Array<{ x: number; y: number; w: number; h: number; score: number; landmarks: number[] }> = [];

    for (const stride of YUNET_STRIDES) {
      const clsTensor = results[`cls_${stride}`];
      const objTensor = results[`obj_${stride}`];
      const bboxTensor = results[`bbox_${stride}`];
      const kpsTensor = results[`kps_${stride}`];

      if (!clsTensor || !objTensor || !bboxTensor) continue;

      const clsData = clsTensor.data as Float32Array;
      const objData = objTensor.data as Float32Array;
      const bboxData = bboxTensor.data as Float32Array;
      const kpsData = kpsTensor ? (kpsTensor.data as Float32Array) : null;

      const featH = Math.floor(inputHeight / stride);
      const featW = Math.floor(inputWidth / stride);
      const numAnchors = featH * featW;

      for (let i = 0; i < numAnchors; i++) {
        const clsScore = clsData[i];
        const objScore = objData[i];
        // NOTE: this YuNet export already applies sigmoid to cls/obj in-graph
        // (outputs are bounded probabilities in [0,1], verified empirically:
        // a clear frontal face yields ~0.88 with the raw product but only
        // ~0.45 when sigmoid is applied again). Applying sigmoid twice
        // compresses every score below the 0.5 threshold and makes real
        // detection fail. Keep the raw product.
        const score = clsScore * objScore;

        if (score < this.config.confidenceThreshold) continue;

        const row = Math.floor(i / featW);
        const col = i % featW;

        // Anchor center in input coordinates
        const cx = (col + 0.5) * stride;
        const cy = (row + 0.5) * stride;

        // Decode bbox
        const dx = bboxData[i * 4 + 0];
        const dy = bboxData[i * 4 + 1];
        const dw = bboxData[i * 4 + 2];
        const dh = bboxData[i * 4 + 3];

        const x = cx + dx * stride;
        const y = cy + dy * stride;
        const w = Math.exp(dw) * stride;
        const h = Math.exp(dh) * stride;

        // Decode 5 landmarks (right eye, left eye, nose, right mouth, left mouth)
        const landmarks: number[] = [];
        if (kpsData) {
          for (let k = 0; k < 10; k += 2) {
            const kx = cx + kpsData[i * 10 + k] * stride;
            const ky = cy + kpsData[i * 10 + k + 1] * stride;
            landmarks.push(kx, ky);
          }
        }

        faces.push({
          x: x - w / 2,
          y: y - h / 2,
          w,
          h,
          score,
          landmarks,
        });
      }
    }

    // Cap the candidate list before the quadratic pass (see the constant above).
    if (faces.length > MAX_PRE_NMS_CANDIDATES) {
      faces.sort((a, b) => b.score - a.score);
      faces.length = MAX_PRE_NMS_CANDIDATES;
    }

    // Apply NMS
    return this.nms(faces, this.config.nmsThreshold);
  }

  /**
   * Non-Maximum Suppression to remove overlapping detections.
   */
  private nms(
    faces: Array<{ x: number; y: number; w: number; h: number; score: number; landmarks: number[] }>,
    iouThreshold: number
  ): Array<{ x: number; y: number; w: number; h: number; score: number; landmarks: number[] }> {
    if (faces.length === 0) return [];

    // Sort by score descending
    faces.sort((a, b) => b.score - a.score);

    const kept: typeof faces = [];
    const suppressed = new Set<number>();

    for (let i = 0; i < faces.length; i++) {
      if (suppressed.has(i)) continue;
      kept.push(faces[i]);

      for (let j = i + 1; j < faces.length; j++) {
        if (suppressed.has(j)) continue;
        if (this.computeIoU(faces[i], faces[j]) > iouThreshold) {
          suppressed.add(j);
        }
      }
    }

    return kept;
  }

  /**
   * Compute Intersection over Union (IoU) between two bounding boxes.
   */
  private computeIoU(
    a: { x: number; y: number; w: number; h: number },
    b: { x: number; y: number; w: number; h: number }
  ): number {
    const x1 = Math.max(a.x, b.x);
    const y1 = Math.max(a.y, b.y);
    const x2 = Math.min(a.x + a.w, b.x + b.w);
    const y2 = Math.min(a.y + a.h, b.y + b.h);

    const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    const areaA = a.w * a.h;
    const areaB = b.w * b.h;
    const union = areaA + areaB - intersection;

    return union > 0 ? intersection / union : 0;
  }

  isAvailable(): boolean {
    return this.available;
  }

  getModelVersion(): string {
    return `yunet-${this.config.inputSize}`;
  }
}
