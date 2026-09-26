/**
 * 5-Point Facial Landmark Alignment — canonical 112x112 affine alignment for SFace/ArcFace.
 *
 * Implements the standard Umeyama 2D similarity transform:
 *   [u, v]^T = s * R * [x, y]^T + t
 * which aligns 5 facial keypoints:
 *   - right eye
 *   - left eye
 *   - nose tip
 *   - right mouth corner
 *   - left mouth corner
 * onto canonical 112x112 target coordinates.
 *
 * This normalizes scale, in-plane rotation (roll), and translation, ensuring
 * that SFace feature extraction is invariant to head tilt and position.
 */

import type { Point2D } from '@medu/core';

export const CANONICAL_112_LANDMARKS: readonly [number, number][] = [
  [38.2946, 51.6963], // Right Eye (subject right, image left)
  [73.5318, 51.5014], // Left Eye (subject left, image right)
  [56.0252, 71.7366], // Nose Tip
  [41.5493, 92.3655], // Right Mouth Corner
  [70.7299, 92.2041], // Left Mouth Corner
];

export interface SimilarityTransformResult {
  /** 2x3 affine transformation matrix from source to target */
  matrix: [
    [number, number, number],
    [number, number, number]
  ];
  /** 2x3 inverse transformation matrix from target to source */
  invMatrix: [
    [number, number, number],
    [number, number, number]
  ];
  /** Scale factor */
  scale: number;
  /** In-plane rotation in degrees */
  rotationDeg: number;
}

/**
 * Compute the optimal 2D similarity transform (scale, rotation, translation)
 * using the closed-form Umeyama least-squares algorithm.
 */
export function computeSimilarityTransform(
  srcPts: Point2D[],
  dstPts: readonly [number, number][] = CANONICAL_112_LANDMARKS
): SimilarityTransformResult {
  const n = srcPts.length;
  if (n < 3) {
    throw new Error(`At least 3 point correspondences required for similarity transform (got ${n})`);
  }

  let srcMeanX = 0;
  let srcMeanY = 0;
  let dstMeanX = 0;
  let dstMeanY = 0;

  for (let i = 0; i < n; i++) {
    srcMeanX += srcPts[i].x / n;
    srcMeanY += srcPts[i].y / n;
    dstMeanX += dstPts[i][0] / n;
    dstMeanY += dstPts[i][1] / n;
  }

  let srcVar = 0;
  for (let i = 0; i < n; i++) {
    const dx = srcPts[i].x - srcMeanX;
    const dy = srcPts[i].y - srcMeanY;
    srcVar += (dx * dx + dy * dy) / n;
  }

  // Cross-covariance matrix elements
  let sxx = 0;
  let sxy = 0;
  let syx = 0;
  let syy = 0;

  for (let i = 0; i < n; i++) {
    const srcX = srcPts[i].x - srcMeanX;
    const srcY = srcPts[i].y - srcMeanY;
    const dstX = dstPts[i][0] - dstMeanX;
    const dstY = dstPts[i][1] - dstMeanY;

    sxx += (dstX * srcX) / n;
    sxy += (dstX * srcY) / n;
    syx += (dstY * srcX) / n;
    syy += (dstY * srcY) / n;
  }

  // Rotation angle theta maximizing trace(R * Sigma^T):
  // tr(R * Sigma^T) = cos(theta)*(sxx + syy) + sin(theta)*(syx - sxy)
  const a = sxx + syy;
  const b = syx - sxy;
  const theta = Math.atan2(b, a);

  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);

  // Optimal isotropic scale s
  const scale = (cosT * a + sinT * b) / (srcVar || 1e-6);

  // Forward affine matrix: [u, v]^T = M * [x, y, 1]^T
  const m00 = scale * cosT;
  const m01 = -scale * sinT;
  const m10 = scale * sinT;
  const m11 = scale * cosT;

  const tx = dstMeanX - (m00 * srcMeanX + m01 * srcMeanY);
  const ty = dstMeanY - (m10 * srcMeanX + m11 * srcMeanY);

  // Inverse affine matrix: [x, y]^T = M_inv * [u, v, 1]^T
  const invScale = 1 / (scale || 1e-6);
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
    rotationDeg: (theta * 180) / Math.PI,
  };
}

/**
 * Warp a source RGB/BGR image buffer to a canonical 112x112 output image
 * using inverse affine mapping and bilinear interpolation.
 *
 * @param srcBuffer Interleaved 3-channel (RGB or BGR) raw pixel buffer
 * @param width Source image width
 * @param height Source image height
 * @param invMatrix 2x3 inverse transformation matrix
 * @param dstSize Destination square size (default: 112)
 * @returns Interleaved 3-channel Uint8Array of size dstSize * dstSize * 3
 */
export function warpAffineBilinear(
  srcBuffer: Uint8Array | Buffer,
  width: number,
  height: number,
  invMatrix: [
    [number, number, number],
    [number, number, number]
  ],
  dstSize = 112
): Uint8Array {
  const dstW = dstSize;
  const dstH = dstSize;
  const dstBuffer = new Uint8Array(dstW * dstH * 3);

  const m00 = invMatrix[0][0];
  const m01 = invMatrix[0][1];
  const m02 = invMatrix[0][2];
  const m10 = invMatrix[1][0];
  const m11 = invMatrix[1][1];
  const m12 = invMatrix[1][2];

  for (let v = 0; v < dstH; v++) {
    for (let u = 0; u < dstW; u++) {
      const srcX = m00 * u + m01 * v + m02;
      const srcY = m10 * u + m11 * v + m12;

      const dstIdx = (v * dstW + u) * 3;

      if (srcX < 0 || srcX >= width - 1 || srcY < 0 || srcY >= height - 1) {
        // Clamp to nearest edge pixel
        const clampedX = Math.max(0, Math.min(width - 1, Math.round(srcX)));
        const clampedY = Math.max(0, Math.min(height - 1, Math.round(srcY)));
        const srcIdx = (clampedY * width + clampedX) * 3;
        dstBuffer[dstIdx + 0] = srcBuffer[srcIdx + 0];
        dstBuffer[dstIdx + 1] = srcBuffer[srcIdx + 1];
        dstBuffer[dstIdx + 2] = srcBuffer[srcIdx + 2];
        continue;
      }

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

      const idx00 = (y0 * width + x0) * 3;
      const idx01 = (y0 * width + x1) * 3;
      const idx10 = (y1 * width + x0) * 3;
      const idx11 = (y1 * width + x1) * 3;

      for (let c = 0; c < 3; c++) {
        const val =
          w00 * srcBuffer[idx00 + c] +
          w01 * srcBuffer[idx01 + c] +
          w10 * srcBuffer[idx10 + c] +
          w11 * srcBuffer[idx11 + c];
        dstBuffer[dstIdx + c] = Math.round(val);
      }
    }
  }

  return dstBuffer;
}
