/**
 * 3D Head Pose Estimator — Sub-millisecond Landmark-Based Pose Estimation in SO(3).
 *
 * Uses the 5 canonical facial keypoints:
 *   - P0: right eye (subject right, image left)
 *   - P1: left eye  (subject left, image right)
 *   - P2: nose tip
 *   - P3: right mouth corner
 *   - P4: left mouth corner
 *
 * Solves for the 3D rotation matrix R in SO(3) using Weak-Perspective POS / Iterative POSIT
 * coupled with exact 2D Polar Decomposition (Symmetric Orthogonal Procrustes) rather than
 * biased Gram-Schmidt orthogonalization.
 */

import type { Point2D } from '@medu/core';

export interface HeadPose {
  /** Yaw angle in degrees [-180, 180]: negative = turning right, positive = turning left */
  readonly yaw: number;
  /** Pitch angle in degrees [-90, 90]: positive = looking up, negative = looking down */
  readonly pitch: number;
  /** Roll angle in degrees [-180, 180]: in-plane head tilt */
  readonly roll: number;
}

export interface HeadPoseDetails extends HeadPose {
  /** 3x3 proper rotation matrix R in SO(3) (row-major: [r1, r2, r3]) */
  readonly rotationMatrix: readonly [
    readonly [number, number, number],
    readonly [number, number, number],
    readonly [number, number, number]
  ];
  /** Estimated weak-perspective scale (pixels per mm) */
  readonly scale: number;
}

export interface HeadPoseOptions {
  /**
   * Number of POSIT perspective refinement iterations (default: 0 for pure orthographic POS,
   * set to 2–3 when camera focalLength is known for true perspective convergence).
   */
  readonly iterations?: number;
  /** Approximate camera focal length in pixels (used only when iterations > 0, default: 600) */
  readonly focalLength?: number;
}

const NUM_LANDMARKS = 5;
const RAD_TO_DEG = 180 / Math.PI;
const EPSILON = 1e-8;
const GIMBAL_LOCK_THRESHOLD = 0.99999;

/**
 * Canonical 3D anthropometric facial landmarks (in mm, right-handed camera frame:
 * +X right on image, +Y down on image, +Z pointing out from face toward camera).
 */
const MODEL_3D: readonly (readonly [number, number, number])[] = [
  [-38.29, -15.5, -15.0], // P0: right eye
  [+38.29, -15.5, -15.0], // P1: left eye
  [0.0, +5.0, +20.0],     // P2: nose tip
  [-25.0, +38.0, -10.0],  // P3: right mouth corner
  [+25.0, +38.0, -10.0],  // P4: left mouth corner
];

/**
 * Precompute the centered 3D coordinates and the flattened 3x5 Moore-Penrose
 * pseudo-inverse matrix X_PLUS = (X^T * X)^(-1) * X^T at module load time.
 */
const { X_CENTERED_FLAT, X_PLUS_FLAT } = (() => {
  let mx = 0;
  let my = 0;
  let mz = 0;
  for (let i = 0; i < NUM_LANDMARKS; i++) {
    mx += MODEL_3D[i][0];
    my += MODEL_3D[i][1];
    mz += MODEL_3D[i][2];
  }
  mx /= NUM_LANDMARKS;
  my /= NUM_LANDMARKS;
  mz /= NUM_LANDMARKS;

  const xc = new Float64Array(NUM_LANDMARKS * 3);
  for (let i = 0; i < NUM_LANDMARKS; i++) {
    xc[i * 3 + 0] = MODEL_3D[i][0] - mx;
    xc[i * 3 + 1] = MODEL_3D[i][1] - my;
    xc[i * 3 + 2] = MODEL_3D[i][2] - mz;
  }

  // Compute symmetric 3x3 covariance matrix XT_X = X_c^T * X_c
  const xtx = new Float64Array(9);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      let sum = 0;
      for (let k = 0; k < NUM_LANDMARKS; k++) {
        sum += xc[k * 3 + r] * xc[k * 3 + c];
      }
      xtx[r * 3 + c] = sum;
    }
  }

  // Analytical 3x3 matrix inversion via cofactors
  const a = xtx[0], b = xtx[1], c = xtx[2];
  const d = xtx[3], e = xtx[4], f = xtx[5];
  const g = xtx[6], h = xtx[7], i = xtx[8];

  const A = e * i - f * h;
  const B = f * g - d * i;
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;

  if (Math.abs(det) < 1e-10) {
    throw new Error('Singular 3D anthropometric model matrix.');
  }

  const invDet = 1 / det;
  const invXtX = [
    A * invDet, (c * h - b * i) * invDet, (b * f - c * e) * invDet,
    B * invDet, (a * i - c * g) * invDet, (c * d - a * f) * invDet,
    C * invDet, (g * b - a * h) * invDet, (a * e - b * d) * invDet,
  ];

  // X_PLUS (3x5) = invXtX (3x3) * X_c^T (3x5)
  const xPlus = new Float64Array(3 * NUM_LANDMARKS);
  for (let r = 0; r < 3; r++) {
    for (let j = 0; j < NUM_LANDMARKS; j++) {
      xPlus[r * NUM_LANDMARKS + j] =
        invXtX[r * 3 + 0] * xc[j * 3 + 0] +
        invXtX[r * 3 + 1] * xc[j * 3 + 1] +
        invXtX[r * 3 + 2] * xc[j * 3 + 2];
    }
  }

  return { X_CENTERED_FLAT: xc, X_PLUS_FLAT: xPlus };
})();

/**
 * Estimates 3D head pose (yaw, pitch, roll in degrees) from 5 facial landmarks.
 * Zero heap allocations on the hot path for standard orthographic estimation.
 *
 * @param landmarks 5 facial landmarks [rightEye, leftEye, noseTip, rightMouth, leftMouth]
 * @param options Optional POSIT refinement settings
 */
export function estimateHeadPose(
  landmarks: readonly Point2D[],
  options?: HeadPoseOptions
): HeadPose {
  const details = estimateHeadPoseDetailed(landmarks, options);
  return {
    yaw: details.yaw,
    pitch: details.pitch,
    roll: details.roll,
  };
}

/**
 * Full 3D head pose estimation returning Euler angles, the 3x3 SO(3) rotation matrix,
 * and the weak-perspective scale factor.
 */
export function estimateHeadPoseDetailed(
  landmarks: readonly Point2D[],
  options?: HeadPoseOptions
): HeadPoseDetails {
  if (!landmarks || landmarks.length < NUM_LANDMARKS) {
    return IDENTITY_POSE_DETAILS;
  }

  const p0x = landmarks[0].x, p0y = landmarks[0].y;
  const p1x = landmarks[1].x, p1y = landmarks[1].y;
  const p2x = landmarks[2].x, p2y = landmarks[2].y;
  const p3x = landmarks[3].x, p3y = landmarks[3].y;
  const p4x = landmarks[4].x, p4y = landmarks[4].y;

  if (
    !Number.isFinite(p0x + p0y + p1x + p1y + p2x + p2y + p3x + p3y + p4x + p4y)
  ) {
    return IDENTITY_POSE_DETAILS;
  }

  const iterations = options?.iterations ?? 0;
  const focalLength = options?.focalLength ?? 600;

  // Effective 2D coordinates (updated only if POSIT perspective iterations > 0)
  let u0 = p0x, v0 = p0y;
  let u1 = p1x, v1 = p1y;
  let u2 = p2x, v2 = p2y;
  let u3 = p3x, v3 = p3y;
  let u4 = p4x, v4 = p4y;

  // Centroid of 2D points (needed only if POSIT iterations > 0)
  const cx = (p0x + p1x + p2x + p3x + p4x) * 0.2;
  const cy = (p0y + p1y + p2y + p3y + p4y) * 0.2;

  let r10 = 1, r11 = 0, r12 = 0;
  let r20 = 0, r21 = 1, r22 = 0;
  let r30 = 0, r31 = 0, r32 = 1;
  let scale = 0;

  for (let iter = 0; iter <= iterations; iter++) {
    // 1. Compute unnormalized projection rows: a1 = X_PLUS * U, a2 = X_PLUS * V
    // Note: Because rows of X_PLUS sum to 0, subtracting 2D mean is mathematically redundant!
    const a10 =
      X_PLUS_FLAT[0] * u0 + X_PLUS_FLAT[1] * u1 + X_PLUS_FLAT[2] * u2 + X_PLUS_FLAT[3] * u3 + X_PLUS_FLAT[4] * u4;
    const a11 =
      X_PLUS_FLAT[5] * u0 + X_PLUS_FLAT[6] * u1 + X_PLUS_FLAT[7] * u2 + X_PLUS_FLAT[8] * u3 + X_PLUS_FLAT[9] * u4;
    const a12 =
      X_PLUS_FLAT[10] * u0 + X_PLUS_FLAT[11] * u1 + X_PLUS_FLAT[12] * u2 + X_PLUS_FLAT[13] * u3 + X_PLUS_FLAT[14] * u4;

    const a20 =
      X_PLUS_FLAT[0] * v0 + X_PLUS_FLAT[1] * v1 + X_PLUS_FLAT[2] * v2 + X_PLUS_FLAT[3] * v3 + X_PLUS_FLAT[4] * v4;
    const a21 =
      X_PLUS_FLAT[5] * v0 + X_PLUS_FLAT[6] * v1 + X_PLUS_FLAT[7] * v2 + X_PLUS_FLAT[8] * v3 + X_PLUS_FLAT[9] * v4;
    const a22 =
      X_PLUS_FLAT[10] * v0 + X_PLUS_FLAT[11] * v1 + X_PLUS_FLAT[12] * v2 + X_PLUS_FLAT[13] * v3 + X_PLUS_FLAT[14] * v4;

    const s1 = Math.hypot(a10, a11, a12);
    const s2 = Math.hypot(a20, a21, a22);

    if (s1 < EPSILON || s2 < EPSILON) {
      return IDENTITY_POSE_DETAILS;
    }

    scale = 0.5 * (s1 + s2);

    // Normalize initial row estimates
    const invS1 = 1 / s1;
    const invS2 = 1 / s2;
    const n10 = a10 * invS1, n11 = a11 * invS1, n12 = a12 * invS1;
    const n20 = a20 * invS2, n21 = a21 * invS2, n22 = a22 * invS2;

    // 2. Symmetric Orthogonalization (Exact Polar Decomposition on 2x3 stanza)
    // Instead of Gram-Schmidt (which forces all error onto r2), we form the symmetric
    // sum b1 = n1 + n2 and difference b2 = n1 - n2, normalize both, and recover r1, r2.
    let b10 = n10 + n20, b11 = n11 + n21, b12 = n12 + n22;
    let b20 = n10 - n20, b21 = n11 - n21, b22 = n12 - n22;

    const nb1 = Math.hypot(b10, b11, b12);
    const nb2 = Math.hypot(b20, b21, b22);

    if (nb1 < EPSILON || nb2 < EPSILON) {
      return IDENTITY_POSE_DETAILS;
    }

    const invNb1 = Math.SQRT1_2 / nb1;
    const invNb2 = Math.SQRT1_2 / nb2;

    b10 *= invNb1; b11 *= invNb1; b12 *= invNb1;
    b20 *= invNb2; b21 *= invNb2; b22 *= invNb2;

    // Guaranteed mutually orthogonal unit vectors r1 and r2:
    r10 = b10 + b20; r11 = b11 + b21; r12 = b12 + b22;
    r20 = b10 - b20; r21 = b11 - b21; r22 = b12 - b22;

    // 3. Third row r3 = r1 x r2 guarantees det(R) = +1 in SO(3)
    r30 = r11 * r22 - r12 * r21;
    r31 = r12 * r20 - r10 * r22;
    r32 = r10 * r21 - r11 * r20;

    // 4. Optional POSIT depth refinement step
    if (iter < iterations && scale > EPSILON) {
      const invZ0 = scale / focalLength;
      const w0 = 1 - (X_CENTERED_FLAT[0] * r30 + X_CENTERED_FLAT[1] * r31 + X_CENTERED_FLAT[2] * r32) * invZ0;
      const w1 = 1 - (X_CENTERED_FLAT[3] * r30 + X_CENTERED_FLAT[4] * r31 + X_CENTERED_FLAT[5] * r32) * invZ0;
      const w2 = 1 - (X_CENTERED_FLAT[6] * r30 + X_CENTERED_FLAT[7] * r31 + X_CENTERED_FLAT[8] * r32) * invZ0;
      const w3 = 1 - (X_CENTERED_FLAT[9] * r30 + X_CENTERED_FLAT[10] * r31 + X_CENTERED_FLAT[11] * r32) * invZ0;
      const w4 = 1 - (X_CENTERED_FLAT[12] * r30 + X_CENTERED_FLAT[13] * r31 + X_CENTERED_FLAT[14] * r32) * invZ0;

      u0 = (p0x - cx) * w0; v0 = (p0y - cy) * w0;
      u1 = (p1x - cx) * w1; v1 = (p1y - cy) * w1;
      u2 = (p2x - cx) * w2; v2 = (p2y - cy) * w2;
      u3 = (p3x - cx) * w3; v3 = (p3y - cy) * w3;
      u4 = (p4x - cx) * w4; v4 = (p4y - cy) * w4;
    }
  }

  // 5. Extract Euler angles (Pitch-Yaw-Roll decomposition with Gimbal Lock protection)
  const sinPitch = Math.max(-1, Math.min(1, -r22));
  const pitch = Math.asin(sinPitch) * RAD_TO_DEG;

  let yaw: number;
  let roll: number;

  if (Math.abs(sinPitch) < GIMBAL_LOCK_THRESHOLD) {
    yaw = Math.atan2(r12, r32) * RAD_TO_DEG;
    roll = Math.atan2(r20, r21) * RAD_TO_DEG;
  } else {
    // Gimbal lock fallback (pitch ≈ ±90°)
    yaw = Math.atan2(-r30, r10) * RAD_TO_DEG;
    roll = 0;
  }

  return {
    yaw: yaw || 0,     // Normalizes -0 to +0
    pitch: pitch || 0,
    roll: roll || 0,
    scale,
    rotationMatrix: [
      [r10, r11, r12],
      [r20, r21, r22],
      [r30, r31, r32],
    ],
  };
}

const IDENTITY_POSE_DETAILS: HeadPoseDetails = Object.freeze({
  yaw: 0,
  pitch: 0,
  roll: 0,
  scale: 0,
  rotationMatrix: [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ] as const,
});