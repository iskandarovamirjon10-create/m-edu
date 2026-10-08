/**
 * Face Quality Assessor — evaluates face image quality for enrollment/recognition.
 *
 * Quality assessment uses measurable image properties to determine if a face
 * image is suitable for reliable embedding generation and matching.
 *
 * Properties evaluated:
 * - Face size relative to image (too small = unreliable)
 * - Sharpness (blur detection via Laplacian variance)
 * - Brightness (over/under-exposed)
 * - Pose estimation (yaw, pitch, roll from landmarks when available;
 *   NEVER fabricated from the face's screen position)
 *
 * All thresholds are configurable via the centralized recognition config.
 */

import type { QualityAssessmentInput, QualityMetrics } from '@medu/core';
import { estimateHeadPose } from '../lib/pose-estimator';

export interface QualityConfig {
  /** Minimum face size ratio (face area / image area) */
  minFaceSizeRatio: number;
  /** Minimum sharpness score (Laplacian variance) */
  minSharpness: number;
  /** Brightness range [min, max] (0-255 average) */
  brightnessRange: [number, number];
  /** Maximum pose angles in degrees */
  maxPoseYaw: number;
  maxPosePitch: number;
  maxPoseRoll: number;
  /** Overall quality threshold to pass */
  overallThreshold: number;
}

const DEFAULT_CONFIG: QualityConfig = {
  minFaceSizeRatio: 0.05,
  minSharpness: 50,
  brightnessRange: [40, 220],
  maxPoseYaw: 30,
  maxPosePitch: 30,
  maxPoseRoll: 25,
  overallThreshold: 0.4,
};

export class QualityAssessor {
  private config: QualityConfig;

  constructor(config: Partial<QualityConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Assess the quality of a detected face in an image.
   */
  async assessQuality(input: QualityAssessmentInput): Promise<QualityMetrics> {
    const sharp = (await import('sharp')).default;
    const { imageBuffer, face } = input;

    const rawMeta = await sharp(imageBuffer).metadata();
    const orientation = rawMeta.orientation ?? 1;
    const swapsAxes = orientation >= 5 && orientation <= 8;
    const imageWidth = (swapsAxes ? rawMeta.height : rawMeta.width) || 1;
    const imageHeight = (swapsAxes ? rawMeta.width : rawMeta.height) || 1;
    const imageArea = imageWidth * imageHeight;
    const faceArea = face.boundingBox.width * face.boundingBox.height;

    // 1. Face size ratio
    const faceSizeRatio = faceArea / imageArea;

    // 2. Extract face region for quality analysis
    const margin = 0.1;
    const cropX = Math.max(0, Math.round(face.boundingBox.x - face.boundingBox.width * margin));
    const cropY = Math.max(0, Math.round(face.boundingBox.y - face.boundingBox.height * margin));
    const cropW = Math.min(
      Math.round(face.boundingBox.width * (1 + 2 * margin)),
      imageWidth - cropX
    );
    const cropH = Math.min(
      Math.round(face.boundingBox.height * (1 + 2 * margin)),
      imageHeight - cropY
    );

    if (cropW <= 0 || cropH <= 0) {
      return this.createMetrics(
        0,
        0,
        0,
        faceSizeRatio,
        { yaw: 0, pitch: 0, roll: 0 },
        false,
        'INVALID_CROP',
        ['Invalid face crop region']
      );
    }

    const faceBuffer = await sharp(imageBuffer)
      .rotate()
      .extract({ left: cropX, top: cropY, width: cropW, height: cropH })
      .greyscale()
      .raw()
      .toBuffer();

    // 3. Sharpness (Laplacian variance)
    const sharpness = this.computeSharpness(faceBuffer, cropW, cropH);

    // 4. Brightness (average pixel value)
    const brightness = this.computeBrightness(faceBuffer);

    // 5. Pose estimation: landmark-based 3D pose when landmarks exist.
    //    NEVER fabricate angles from face *position* on screen: a perfectly
    //    frontal face at the left edge used to be reported as yaw -30 and a
    //    profile face centred in frame as "frontal" — pseudo-math feeding a
    //    security gate (regression: FE-2). Unknown pose is treated as NEUTRAL
    //    (0.5 score, gate skipped) instead of risking false reject/accept.
    const pose =
      face.landmarks && face.landmarks.length >= 5
        ? estimateHeadPose(face.landmarks)
        : null;
    const neutralPose = { yaw: 0, pitch: 0, roll: 0 };
    const poseForDisplay = pose ?? neutralPose;

    // 6. Compute scores
    const sharpnessScore = Math.min(1, sharpness / 200);
    const brightnessScore = this.brightnessScore(brightness);
    const poseScore = pose ? this.poseScore(pose) : 0.5;
    const sizeScore = Math.min(1, faceSizeRatio / 0.15);

    const overallScore =
      0.25 * sizeScore +
      0.30 * sharpnessScore +
      0.20 * brightnessScore +
      0.25 * poseScore;

    // 7. Check specific issues and constraints
    const issues: string[] = [];
    const yawExceeded = pose ? Math.abs(pose.yaw) > this.config.maxPoseYaw : false;
    const pitchExceeded = pose ? Math.abs(pose.pitch) > this.config.maxPosePitch : false;
    const rollExceeded = pose ? Math.abs(pose.roll) > this.config.maxPoseRoll : false;

    if (yawExceeded) {
      issues.push(`Yaw ${poseForDisplay.yaw.toFixed(1)} exceeds limit +/-${this.config.maxPoseYaw}`);
    }
    if (pitchExceeded) {
      issues.push(`Pitch ${poseForDisplay.pitch.toFixed(1)} exceeds limit +/-${this.config.maxPosePitch}`);
    }
    if (rollExceeded) {
      issues.push(`Roll ${poseForDisplay.roll.toFixed(1)} exceeds limit +/-${this.config.maxPoseRoll}`);
    }
    if (!pose) {
      issues.push('Pose could not be estimated (no landmarks) - neutral pose assumed');
    }
    if (sharpness < this.config.minSharpness) {
      issues.push(`Sharpness ${sharpness.toFixed(1)} below minimum ${this.config.minSharpness}`);
    }
    if (brightness < this.config.brightnessRange[0] || brightness > this.config.brightnessRange[1]) {
      issues.push(`Brightness ${brightness.toFixed(1)} outside range [${this.config.brightnessRange.join(', ')}]`);
    }
    if (faceSizeRatio < this.config.minFaceSizeRatio) {
      issues.push(`Face size ratio ${(faceSizeRatio * 100).toFixed(1)}% below minimum ${(this.config.minFaceSizeRatio * 100).toFixed(1)}%`);
    }

    const poseExceeded = yawExceeded || pitchExceeded || rollExceeded;
    const passesQuality = overallScore >= this.config.overallThreshold && !poseExceeded;
    const rejectionReason = poseExceeded
      ? 'HEAD_POSE_EXCEEDED'
      : !passesQuality
        ? 'QUALITY_BELOW_THRESHOLD'
        : undefined;

    return this.createMetrics(
      overallScore,
      sharpnessScore,
      brightnessScore,
      faceSizeRatio,
      poseForDisplay,
      passesQuality,
      rejectionReason,
      issues
    );
  }

  /**
   * Compute sharpness using Laplacian variance (higher = sharper).
   */
  private computeSharpness(data: Buffer, width: number, height: number): number {
    if (width < 3 || height < 3) return 0;

    let sum = 0;
    let count = 0;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const center = data[y * width + x];
        const top = data[(y - 1) * width + x];
        const bottom = data[(y + 1) * width + x];
        const left = data[y * width + (x - 1)];
        const right = data[y * width + (x + 1)];

        const laplacian = -4 * center + top + bottom + left + right;
        sum += laplacian * laplacian;
        count++;
      }
    }

    return count > 0 ? sum / count : 0;
  }

  /**
   * Compute average brightness.
   */
  private computeBrightness(data: Buffer): number {
    if (data.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
    }
    return sum / data.length;
  }

  /**
   * Compute brightness score (1.0 = optimal, 0.0 = too dark/bright).
   */
  private brightnessScore(brightness: number): number {
    const [min, max] = this.config.brightnessRange;
    const center = (min + max) / 2;
    const range = (max - min) / 2;
    const distance = Math.abs(brightness - center);
    return Math.max(0, 1 - distance / range);
  }

  /**
   * Compute pose score (1.0 = frontal, 0.0 = extreme angle).
   */
  private poseScore(pose: { yaw: number; pitch: number; roll: number }): number {
    const yawScore = Math.max(0, 1 - Math.abs(pose.yaw) / this.config.maxPoseYaw);
    const pitchScore = Math.max(0, 1 - Math.abs(pose.pitch) / this.config.maxPosePitch);
    const rollScore = Math.max(0, 1 - Math.abs(pose.roll) / this.config.maxPoseRoll);
    return (yawScore + pitchScore + rollScore) / 3;
  }

  /**
   * Create QualityMetrics object.
   */
  private createMetrics(
    overallScore: number,
    sharpness: number,
    brightness: number,
    faceSizeRatio: number,
    pose: { yaw: number; pitch: number; roll: number },
    passesThreshold: boolean = overallScore >= this.config.overallThreshold,
    rejectionReason?: string,
    issues: string[] = []
  ): QualityMetrics {
    return {
      overallScore,
      sharpness,
      brightness,
      faceSizeRatio,
      pose,
      passesThreshold,
      rejectionReason,
      issues,
    };
  }
}