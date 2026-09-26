/**
 * Head Pose Estimator — accurate landmark-based 3D head pose estimation.
 *
 * Uses the 5 canonical facial keypoints:
 *   - P0: right eye
 *   - P1: left eye
 *   - P2: nose tip
 *   - P3: right mouth corner
 *   - P4: left mouth corner
 *
 * Solves for the 3D rotation matrix R in SO(3) via closed-form Orthogonal Procrustes /
 * POSIT (Pose from Orthography and Scaling with Iterations) on an anthropometric 3D face model.
 *
 * Completely independent of bounding-box position in the camera frame — guarantees
 * that head pose measures actual head orientation, not screen location.
 */

import type { Point2D } from '@medu/core';

export interface HeadPose {
  /** Yaw angle in degrees: negative = turning right, positive = turning left */
  yaw: number;
  /** Pitch angle in degrees: positive = looking up, negative = looking down */
  pitch: number;
  /** Roll angle in degrees: in-plane head tilt */
  roll: number;
}

// Canonical 3D anthropometric facial landmarks (in mm, centered around the face midline)
// P0: right eye, P1: left eye, P2: nose tip, P3: right mouth, P4: left mouth
const MODEL_3D: readonly [number, number, number][] = [
  [-38.29, -15.5, -15.0], // right eye
  [+38.29, -15.5, -15.0], // left eye
  [0.0, 5.0, +20.0],      // nose tip
  [-25.0, +38.0, -10.0],  // right mouth
  [+25.0, +38.0, -10.0],  // left mouth
];

// Precomputed centered 3D model and its pseudo-inverse
const MEAN_3D: [number, number, number] = [0, 0, 0];
for (const p of MODEL_3D) {
  MEAN_3D[0] += p[0] / 5;
  MEAN_3D[1] += p[1] / 5;
  MEAN_3D[2] += p[2] / 5;
}

const X_CENTERED = MODEL_3D.map((p) => [
  p[0] - MEAN_3D[0],
  p[1] - MEAN_3D[1],
  p[2] - MEAN_3D[2],
]);

function invert3x3(M: number[][]): number[][] {
  const [
    [a, b, c],
    [d, e, f],
    [g, h, i],
  ] = M;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-10) throw new Error('Singular 3x3 matrix in pose solver');
  const invDet = 1 / det;
  return [
    [A * invDet, (c * h - b * i) * invDet, (b * f - c * e) * invDet],
    [B * invDet, (a * i - c * g) * invDet, (c * d - a * f) * invDet],
    [C * invDet, (g * b - a * h) * invDet, (a * e - b * d) * invDet],
  ];
}

const XT_X: number[][] = [
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
];
for (let i = 0; i < 3; i++) {
  for (let j = 0; j < 3; j++) {
    for (let k = 0; k < 5; k++) {
      XT_X[i][j] += X_CENTERED[k][i] * X_CENTERED[k][j];
    }
  }
}

const INV_XT_X = invert3x3(XT_X);

// 3x5 pseudo-inverse matrix: Xplus = (X^T * X)^-1 * X^T
const X_PLUS: number[][] = [
  [0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0],
];
for (let i = 0; i < 3; i++) {
  for (let j = 0; j < 5; j++) {
    for (let k = 0; k < 3; k++) {
      X_PLUS[i][j] += INV_XT_X[i][k] * X_CENTERED[j][k];
    }
  }
}

function crossProduct(a: number[], b: number[]): number[] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function hypot3(v: number[]): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

/**
 * Estimate 3D head pose (yaw, pitch, roll in degrees) from 5 facial landmarks.
 *
 * @param landmarks 5 facial landmarks in pixel coordinates [rightEye, leftEye, nose, rightMouth, leftMouth]
 * @returns HeadPose with yaw, pitch, roll in degrees
 */
export function estimateHeadPose(landmarks: Point2D[]): HeadPose {
  if (!landmarks || landmarks.length < 5) {
    return { yaw: 0, pitch: 0, roll: 0 };
  }

  // Center 2D points
  let meanX = 0;
  let meanY = 0;
  for (let i = 0; i < 5; i++) {
    meanX += landmarks[i].x / 5;
    meanY += landmarks[i].y / 5;
  }

  const Y = [
    [landmarks[0].x - meanX, landmarks[0].y - meanY],
    [landmarks[1].x - meanX, landmarks[1].y - meanY],
    [landmarks[2].x - meanX, landmarks[2].y - meanY],
    [landmarks[3].x - meanX, landmarks[3].y - meanY],
    [landmarks[4].x - meanX, landmarks[4].y - meanY],
  ];

  // A = Xplus * Y (3x2)
  const a1 = [0, 0, 0];
  const a2 = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 5; j++) {
      a1[i] += X_PLUS[i][j] * Y[j][0];
      a2[i] += X_PLUS[i][j] * Y[j][1];
    }
  }

  const s1 = hypot3(a1);
  const s2 = hypot3(a2);
  const r1 = a1.map((v) => v / (s1 || 1));
  let r2 = a2.map((v) => v / (s2 || 1));

  // Gram-Schmidt orthogonalization
  const d = r1[0] * r2[0] + r1[1] * r2[1] + r1[2] * r2[2];
  r2 = [r2[0] - d * r1[0], r2[1] - d * r1[1], r2[2] - d * r1[2]];
  const nr2 = hypot3(r2);
  r2 = r2.map((v) => v / (nr2 || 1));

  const r3 = crossProduct(r1, r2);

  // Rotation matrix rows: r1, r2, r3
  // Pitch (around X axis):
  const pitch = (Math.asin(Math.max(-1, Math.min(1, -r2[2]))) * 180) / Math.PI;
  // Yaw (around Y axis):
  const yaw = (Math.atan2(r1[2], r3[2]) * 180) / Math.PI;
  // Roll (around Z axis):
  const roll = (Math.atan2(r2[0], r2[1]) * 180) / Math.PI;

  return {
    yaw: Number.isFinite(yaw) ? yaw : 0,
    pitch: Number.isFinite(pitch) ? pitch : 0,
    roll: Number.isFinite(roll) ? roll : 0,
  };
}
