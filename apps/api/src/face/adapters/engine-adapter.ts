import { Injectable } from '@nestjs/common';
import { FaceEmbedding } from '@medu/core';
import type { 
  FaceEngine, 
  FaceDetectionInput, 
  DetectedFace, 
  QualityAssessmentInput, 
  LivenessCheckInput, 
  EmbeddingInput, 
  ComparisonInput 
} from '@medu/core';
import type { LivenessResult, QualityMetrics } from '@medu/core';

export interface IDetector {
  detectFaces(input: FaceDetectionInput): Promise<DetectedFace[]>;
}

export interface IEmbedder {
  generateEmbedding(input: EmbeddingInput): Promise<FaceEmbedding>;
  getDimension?(): number;
  getModelVersion?(): string;
}

export interface ILiveness {
  checkLiveness(input: LivenessCheckInput): Promise<LivenessResult>;
}

export interface IMatcher {
  compareEmbeddings(input: ComparisonInput): Promise<number>;
}

@Injectable()
export class SimpleFaceEngine implements FaceEngine {
  constructor(
    private readonly detector: IDetector,
    private readonly embedder: IEmbedder,
    private readonly liveness: ILiveness,
    private readonly matcher: IMatcher
  ) {}

  async detectFaces(input: FaceDetectionInput): Promise<DetectedFace[]> {
    const faces = await this.detector.detectFaces(input);
    return faces;
  }

  async assessQuality(_input: QualityAssessmentInput): Promise<QualityMetrics> {
    // Mock implementation or generic assessment for dev mode
    return {
      sharpness: 0.95,
      brightness: 0.9,
      pose: { pitch: 0, yaw: 0, roll: 0 },
      overallScore: 0.95,
      faceSizeRatio: 0.9,
      passesThreshold: true,
    };
  }

  async checkLiveness(input: LivenessCheckInput): Promise<LivenessResult> {
    return this.liveness.checkLiveness(input);
  }

  async generateEmbedding(input: EmbeddingInput): Promise<FaceEmbedding> {
    return this.embedder.generateEmbedding(input);
  }

  async compareEmbeddings(input: ComparisonInput): Promise<number> {
    return this.matcher.compareEmbeddings(input);
  }

  async isAvailable(): Promise<boolean> {
    return true; // Simple/Mock engine is always available
  }

  getEmbeddingDimension(): number {
    return this.embedder.getDimension ? this.embedder.getDimension() : 128;
  }

  getModelVersion(): string {
    return this.embedder.getModelVersion ? this.embedder.getModelVersion() : 'mock-v1';
  }
}