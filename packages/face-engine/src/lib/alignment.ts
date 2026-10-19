/**
 * 5-Point Facial Landmark Alignment — Canonical 112x112 Affine Alignment for SFace / ArcFace.
 *
 * Implements the analytical 2D similarity transform (Umeyama / Procrustes without reflection):
 *   [u, v]^T = s * R * [x, y]^T + t
 *
 * Aligns 5 facial keypoints (right eye, left eye, nose tip, right mouth, left mouth)
 * onto canonical 112x112 target coordinates with sub-pixel bilinear interpolation.
 */

import type { Point2D } from '@medu/core';

/** Readonly 2x3 Affine Transformation Matrix */
export type AffineMatrix2x3 = readonly [
  readonly [number, number, number],
  readonly [number, number, number]
];

/** Canonical 112x112 target coordinates standard for InsightFace / ArcFace / SFace */
export const CANONICAL_112_LANDMARKS: readonly [readonly [number, number], ...readonly [number, number][]] = [
  [38.2946, 51.6963], // Right Eye (subject right, image left)
  [73.5318, 51.5014], // Left Eye (subject left, image right)
  [56.0252, 71.7366], // Nose Tip
  [41.5493, 92.3655], // Right Mouth Corner
  [70.7299, 92.2041], // Left Mouth Corner
];

export interface SimilarityTransformResult {
  /** 2x3 forward affine transformation matrix (source -> target) */
  readonly matrix: AffineMatrix2x3;
  /** 2x3 inverse affine transformation matrix (target -> source) */
  readonly invMatrix: AffineMatrix2x3;
  /** Isotropic scale factor */
  readonly scale: number;
  /** In-plane rotation angle in degrees [-180, 180] */
  readonly rotationDeg: number;
}

export type BorderMode = 'constant' | 'replicate';

export interface WarpAffineOptions {
  /** Output width in pixels (default: 112) */
  readonly dstWidth?: number;
  /** Output height in pixels (default: 112) */
  readonly dstHeight?: number;
  /** Number of channels in source buffer, e.g., 3 for RGB/BGR, 4 for RGBA (default: 3) */
  readonly srcChannels?: 3 | 4;
  /** Number of channels in output buffer (default: 3) */
  readonly dstChannels?: 3 | 4;
  /**
   * Border handling strategy (default: 'constant' to match OpenCV/ArcFace standard).
   * - 'constant': fills out-of-bounds pixels with `borderValue` (default 0 / black)
   * - 'replicate': clamps coordinates to the nearest edge pixel
   */
  readonly borderMode?: BorderMode;
  /** Fill value per channel when borderMode is 'constant' (default: 0) */
  readonly borderValue?: number;
  /** Optional pre-allocated output buffer to avoid GC pressure in real-time video pipelines */
  readonly outBuffer?: Uint8Array;
}

const EPSILON = 1e-10;
const RAD_TO_DEG = 180 / Math.PI;

/**
 * Computes the optimal 2D similarity transform (scale, proper rotation, translation)
 * between paired 2D point sets using the closed-form Procrustes / Umeyama method.
 */
export function computeSimilarityTransform(
  srcPts: readonly Point2D[],
  dstPts: readonly (readonly [number, number])[] = CANONICAL_112_LANDMARKS
): SimilarityTransformResult {
  const n = Math.min(srcPts.length, dstPts.length);
  if (n < 3) {
    throw new RangeError(
      `At least 3 point correspondences are required for 2D similarity transform (received ${n}).`
    );
  }

  // 1. Compute centroids (single division at the end for floating-point precision)
  let sumSrcX = 0;
  let sumSrcY = 0;
  let sumDstX = 0;
  let sumDstY = 0;

  for (let i = 0; i < n; i++) {
    const sx = srcPts[i].x;
    const sy = srcPts[i].y;
    const dx = dstPts[i][0];
    const dy = dstPts[i][1];

    if (!Number.isFinite(sx) || !Number.isFinite(sy) || !Number.isFinite(dx) || !Number.isFinite(dy)) {
      throw new TypeError(`Non-finite coordinate detected at landmark index ${i}.`);
    }

    sumSrcX += sx;
    sumSrcY += sy;
    sumDstX += dx;
    sumDstY += dy;
  }

  const invN = 1 / n;
  const srcMeanX = sumSrcX * invN;
  const srcMeanY = sumSrcY * invN;
  const dstMeanX = sumDstX * invN;
  const dstMeanY = sumDstY * invN;

  // 2. Single-pass computation of source variance and cross-covariance terms
  // Note: Division by N is omitted in both srcVar and cross-covariance (a, b)
  // because the 1/N factor cancels out exactly when computing `scale = num / srcVar`.
  let srcVarSum = 0;
  let a = 0; // sum of (dstX * srcX + dstY * srcY)
  let b = 0; // sum of (dstY * srcX - dstX * srcY)

  for (let i = 0; i < n; i++) {
    const srcX = srcPts[i].x - srcMeanX;
    const srcY = srcPts[i].y - srcMeanY;
    const dstX = dstPts[i][0] - dstMeanX;
    const dstY = dstPts[i][1] - dstMeanY;

    srcVarSum += srcX * srcX + srcY * srcY;
    a += dstX * srcX + dstY * srcY;
    b += dstY * srcX - dstX * srcY;
  }

  if (srcVarSum < EPSILON) {
    throw new Error('Degenerate source landmarks: variance is near zero (all points are collinear/identical).');
  }

  const norm = Math.hypot(a, b);
  if (norm < EPSILON) {
    throw new Error('Degenerate landmark configuration: cross-covariance norm is near zero.');
  }

  // 3. Optimal rotation (cos(theta) = a / norm, sin(theta) = b / norm)
  // Using hypot avoids trigonometric overhead of atan2 + sin + cos for the matrix itself
  const cosT = a / norm;
  const sinT = b / norm;
  const theta = Math.atan2(b, a);

  // 4. Optimal isotropic scale: (cosT * a + sinT * b) / srcVarSum === norm / srcVarSum
  const scale = norm / srcVarSum;

  // 5. Forward affine matrix: [u, v]^T = M * [x, y, 1]^T
  const m00 = scale * cosT;
  const m01 = -scale * sinT;
  const m10 = scale * sinT;
  const m11 = scale * cosT;

  const tx = dstMeanX - (m00 * srcMeanX + m01 * srcMeanY);
  const ty = dstMeanY - (m10 * srcMeanX + m11 * srcMeanY);

  // 6. Analytical inverse affine matrix: [x, y]^T = M_inv * [u, v, 1]^T
  const invScale = 1 / scale;
  const invM00 = cosT * invScale;
  const invM01 = sinT * invScale;
  const invM10 = -sinT * invScale;
  const invM11 = cosT * invScale;

  const invTx = -(invM00 * tx + invM01 * ty);
  const invTy = -(invM10 * tx + invM11 * ty);

  return {
    matrix: [
      [m00, m01, tx],
      [m10, m11, ty],
    ],
    invMatrix: [
      [invM00, invM01, invTx],
      [invM10, invM11, invTy],
    ],
    scale,
    rotationDeg: theta * RAD_TO_DEG,
  };
}

/**
 * Warps a source image buffer to a canonical output image using inverse affine mapping
 * and fast bilinear interpolation.
 *
 * @param srcBuffer Interleaved raw pixel buffer (RGB, BGR, or RGBA)
 * @param width Source image width in pixels
 * @param height Source image height in pixels
 * @param invMatrix 2x3 inverse transformation matrix (target -> source)
 * @param dstSizeOrOptions Destination square size (number) or full configuration object
 */
export function warpAffineBilinear(
  srcBuffer: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  invMatrix: AffineMatrix2x3,
  dstSizeOrOptions: number | WarpAffineOptions = 112
): Uint8Array {
  const opts: WarpAffineOptions =
    typeof dstSizeOrOptions === 'number'
      ? { dstWidth: dstSizeOrOptions, dstHeight: dstSizeOrOptions }
      : dstSizeOrOptions;

  const dstW = opts.dstWidth ?? 112;
  const dstH = opts.dstHeight ?? 112;
  const srcC = opts.srcChannels ?? 3;
  const dstC = opts.dstChannels ?? 3;
  const borderMode = opts.borderMode ?? 'constant';
  const borderVal = opts.borderValue ?? 0;

  if (width <= 0 || height <= 0 || !Number.isInteger(width) || !Number.isInteger(height)) {
    throw new RangeError(`Invalid source dimensions: ${width}x${height}.`);
  }
  if (dstW <= 0 || dstH <= 0 || !Number.isInteger(dstW) || !Number.isInteger(dstH)) {
    throw new RangeError(`Invalid destination dimensions: ${dstW}x${dstH}.`);
  }
  if (srcBuffer.length < width * height * srcC) {
    throw new RangeError(
      `Source buffer too small: expected at least ${width * height * srcC} bytes, got ${srcBuffer.length}.`
    );
  }

  const requiredOutLength = dstW * dstH * dstC;
  const dstBuffer = opts.outBuffer ?? new Uint8Array(requiredOutLength);
  if (dstBuffer.length < requiredOutLength) {
    throw new RangeError(
      `Provided outBuffer too small: expected at least ${requiredOutLength} bytes, got ${dstBuffer.length}.`
    );
  }

  const m00 = invMatrix[0][0];
  const m01 = invMatrix[0][1];
  const m02 = invMatrix[0][2];
  const m10 = invMatrix[1][0];
  const m11 = invMatrix[1][1];
  const m12 = invMatrix[1][2];

  const maxX = width - 1;
  const maxY = height - 1;
  const rowStride = width * srcC;
  const isConstantBorder = borderMode === 'constant';

  let dstIdx = 0;

  for (let v = 0; v < dstH; v++) {
    // Hoist row-dependent affine terms outside the inner loop
    const baseSrcX = m01 * v + m02;
    const baseSrcY = m11 * v + m12;

    for (let u = 0; u < dstW; u++, dstIdx += dstC) {
      const srcX = m00 * u + baseSrcX;
      const srcY = m10 * u + baseSrcY;

      // Fast path for exact in-bounds pixels (vast majority of pixels)
      if (srcX >= 0 && srcX < maxX && srcY >= 0 && srcY < maxY) {
        const x0 = srcX | 0; // Fast floor for non-negative numbers
        const y0 = srcY | 0;

        const wx = srcX - x0;
        const wy = srcY - y0;
        const invWx = 1 - wx;
        const invWy = 1 - wy;

        const w00 = invWx * invWy;
        const w01 = wx * invWy;
        const w10 = invWx * wy;
        const w11 = wx * wy;

        const idx00 = y0 * rowStride + x0 * srcC;
        const idx01 = idx00 + srcC;
        const idx10 = idx00 + rowStride;
        const idx11 = idx10 + srcC;

        // Unrolled channel interpolation with fast (+ 0.5 | 0) rounding
        dstBuffer[dstIdx] =
          (w00 * srcBuffer[idx00] +
            w01 * srcBuffer[idx01] +
            w10 * srcBuffer[idx10] +
            w11 * srcBuffer[idx11] +
            0.5) |
          0;
        dstBuffer[dstIdx + 1] =
          (w00 * srcBuffer[idx00 + 1] +
            w01 * srcBuffer[idx01 + 1] +
            w10 * srcBuffer[idx10 + 1] +
            w11 * srcBuffer[idx11 + 1] +
            0.5) |
          0;
        dstBuffer[dstIdx + 2] =
          (w00 * srcBuffer[idx00 + 2] +
            w01 * srcBuffer[idx01 + 2] +
            w10 * srcBuffer[idx10 + 2] +
            w11 * srcBuffer[idx11 + 2] +
            0.5) |
          0;

        if (dstC === 4) {
          dstBuffer[dstIdx + 3] =
            srcC === 4
              ? (w00 * srcBuffer[idx00 + 3] +
                  w01 * srcBuffer[idx01 + 3] +
                  w10 * srcBuffer[idx10 + 3] +
                  w11 * srcBuffer[idx11 + 3] +
                  0.5) |
                0
              : 255;
        }
        continue;
      }

      // Boundary & Out-of-Bounds handling
      if (isConstantBorder && (srcX < -1 || srcX > maxX + 1 || srcY < -1 || srcY > maxY + 1)) {
        // Completely outside the 1px bilinear support region
        dstBuffer[dstIdx] = borderVal;
        dstBuffer[dstIdx + 1] = borderVal;
        dstBuffer[dstIdx + 2] = borderVal;
        if (dstC === 4) dstBuffer[dstIdx + 3] = 255;
        continue;
      }

      // Partial boundary bilinear interpolation (matches OpenCV warpAffine behavior at edges)
      const x0 = Math.floor(srcX);
      const y0 = Math.floor(srcY);
      const x1 = x0 + 1;
      const y1 = y0 + 1;

      const wx = srcX - x0;
      const wy = srcY - y0;
      const w00 = (1 - wx) * (1 - wy);
      const w01 = wx * (1 - wy);
      const w10 = (1 - wx) * wy;
      const w11 = wx * wy;

      for (let c = 0; c < 3; c++) {
        const p00 = samplePixelChannel(srcBuffer, x0, y0, c, width, height, srcC, isConstantBorder, borderVal);
        const p01 = samplePixelChannel(srcBuffer, x1, y0, c, width, height, srcC, isConstantBorder, borderVal);
        const p10 = samplePixelChannel(srcBuffer, x0, y1, c, width, height, srcC, isConstantBorder, borderVal);
        const p11 = samplePixelChannel(srcBuffer, x1, y1, c, width, height, srcC, isConstantBorder, borderVal);

        dstBuffer[dstIdx + c] = (w00 * p00 + w01 * p01 + w10 * p10 + w11 * p11 + 0.5) | 0;
      }

      if (dstC === 4) {
        dstBuffer[dstIdx + 3] = 255;
      }
    }
  }

  return dstBuffer;
}

/**
 * Helper for boundary pixel sampling supporting both constant and replicate border modes.
 */
function samplePixelChannel(
  buf: Uint8Array | Uint8ClampedArray,
  x: number,
  y: number,
  channel: number,
  width: number,
  height: number,
  channels: number,
  isConstantBorder: boolean,
  borderVal: number
): number {
  if (x >= 0 && x < width && y >= 0 && y < height) {
    return buf[(y * width + x) * channels + channel];
  }
  if (isConstantBorder) {
    return borderVal;
  }
  const clampedX = x < 0 ? 0 : x >= width ? width - 1 : x;
  const clampedY = y < 0 ? 0 : y >= height ? height - 1 : y;
  return buf[(clampedY * width + clampedX) * channels + channel];
}