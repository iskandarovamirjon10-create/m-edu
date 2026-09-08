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
 * - Pose estimation (yaw, pitch, roll from landmarks if available)
 *
 * All thresholds are configurable via the centralized recognition config.
 */

import type { QualityAssessmentInput, QualityMetrics } from '@medu/core';

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
  maxPosePitch: 20,
  maxPoseRoll: 15,
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

    const metadata = await sharp(imageBuffer).metadata();
    const imageArea = (metadata.width || 1) * (metadata.height || 1);
    const faceArea = face.boundingBox.width * face.boundingBox.height;

    // 1. Face size ratio
    const faceSizeRatio = faceArea / imageArea;

    // 2. Extract face region for quality analysis
    const margin = 0.1;
    const cropX = Math.max(0, Math.round(face.boundingBox.x - face.boundingBox.width * margin));
    const cropY = Math.max(0, Math.round(face.boundingBox.y - face.boundingBox.height * margin));
    const cropW = Math.min(
      Math.round(face.boundingBox.width * (1 + 2 * margin)),
      (metadata.width || 0) - cropX
    );
    const cropH = Math.min(
      Math.round(face.boundingBox.height * (1 + 2 * margin)),
      (metadata.height || 0) - cropY
    );

    if (cropW <= 0 || cropH <= 0) {
      return this.createMetrics(0, 0, 0, faceSizeRatio, { yaw: 0, pitch: 0, roll: 0 });
    }

    const faceBuffer = await sharp(imageBuffer)
      .extract({ left: cropX, top: cropY, width: cropW, height: cropH })
      .greyscale()
      .raw()
      .toBuffer();

    // 3. Sharpness (Laplacian variance)
    const sharpness = this.computeSharpness(faceBuffer, cropW, cropH);

    // 4. Brightness (average pixel value)
    const brightness = this.computeBrightness(faceBuffer);

    // 5. Pose estimation (simplified — based on face position in image)
    const pose = this.estimatePose(face.boundingBox, metadata.width || 1, metadata.height || 1);

    // 6. Compute overall score
    const sharpnessScore = Math.min(1, sharpness / 200);
    const brightnessScore = this.brightnessScore(brightness);
    const poseScore = this.poseScore(pose);
    const sizeScore = Math.min(1, faceSizeRatio / 0.15);

    const overallScore =
      0.25 * sizeScore +
      0.30 * sharpnessScore +
      0.20 * brightnessScore +
      0.25 * poseScore;

    return this.createMetrics(overallScore, sharpnessScore, brightnessScore, faceSizeRatio, pose);
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
   * Estimate pose from face bounding box position.
   */
  private estimatePose(
    box: { x: number; y: number; width: number; height: number },
    imageWidth: number,
    imageHeight: number
  ): { yaw: number; pitch: number; roll: number } {
    // Simplified pose estimation based on face position
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    const yaw = ((centerX / imageWidth) - 0.5) * 60; // -30 to +30 degrees
    const pitch = ((centerY / imageHeight) - 0.5) * 40; // -20 to +20 degrees
    const roll = 0; // Cannot estimate roll without landmarks

    return { yaw, pitch, roll };
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
    pose: { yaw: number; pitch: number; roll: number }
  ): QualityMetrics {
    return {
      overallScore,
      sharpness,
      brightness,
      faceSizeRatio,
      pose,
      passesThreshold: overallScore >= this.config.overallThreshold,
    };
  }
}
