/**
 * Recognition Decision Policy — centralized configuration for all recognition thresholds.
 *
 * IMPORTANT: Threshold values MUST be calibrated against:
 * - The specific ML model being used
 * - Camera hardware and lighting conditions
 * - Environmental factors
 * - Security requirements
 *
 * The default values below are starting points and require calibration.
 */


// ============================================================================
// Configuration Interface
// ============================================================================

export interface FaceRecognitionConfig {
  /** Minimum face quality score for enrollment/recognition (0-1) */
  qualityThreshold: number;

  /** Liveness policy */
  livenessPolicy: {
    /** Whether liveness is required for recognition */
    required: boolean;
    /** Minimum liveness confidence (0-1) */
    threshold: number;
    /** Whether to accept UNCERTAIN results */
    acceptUncertain: boolean;
    /** Whether to allow recognition when liveness model is unavailable (default: false when required) */
    allowUnavailable: boolean;
  };

  /** Similarity matching */
  matching: {
    /** Minimum similarity score for a match (0-1) */
    similarityThreshold: number;
    /** Minimum confidence for a positive identification (0-1) */
    minConfidence: number;
    /** Maximum number of candidates to compare against */
    maxCandidates: number;
    /** Margin around threshold to consider a match uncertain */
    uncertainMargin: number;
    /** Minimum margin between top-1 and top-2 candidate similarity to avoid ambiguous match */
    minAmbiguityMargin: number;
  };

  /** Duplicate prevention */
  duplicatePrevention: {
    /** Time window in minutes to prevent duplicate attendance */
    windowMinutes: number;
  };

  /** Session limits */
  sessions: {
    /** Maximum concurrent recognition sessions per organization */
    maxConcurrent: number;
    /** Session timeout in minutes */
    timeoutMinutes: number;
  };
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_FACE_RECOGNITION_CONFIG: FaceRecognitionConfig = {
  // Must match QualityAssessor.overallThreshold (0.4) — a single effective
  // quality gate, not two divergent numbers.
  qualityThreshold: 0.4,
  livenessPolicy: {
    required: true,
    threshold: 0.5,
    acceptUncertain: false,
    allowUnavailable: false,
  },
  matching: {
    similarityThreshold: 0.6,
    minConfidence: 0.5,
    maxCandidates: 5,
    uncertainMargin: 0.05,
    minAmbiguityMargin: 0.05,
  },
  duplicatePrevention: {
    windowMinutes: 5,
  },
  sessions: {
    maxConcurrent: 10,
    timeoutMinutes: 60,
  },
};

// ============================================================================
// Decision Policy
// ============================================================================

export interface RecognitionInput {
  qualityScore: number;
  livenessDecision: 'PASS' | 'FAIL' | 'UNCERTAIN' | 'UNAVAILABLE';
  /** Liveness confidence in 0..1 (present when the engine supplies it). */
  livenessConfidence?: number;
  similarityScore: number | null;
  bestMatchFound: boolean;
  /** Margin between top-1 and top-2 candidate similarity (top1 - top2) */
  ambiguityMargin?: number | null;
}

export type RecognitionDecision =
  | { outcome: 'IDENTIFIED'; confidence: 'HIGH' | 'MEDIUM' | 'LOW'; studentId: string; message: string }
  | { outcome: 'UNCERTAIN'; reason: string; message: string }
  | { outcome: 'REJECTED'; reason: string; message: string };

export class RecognitionDecisionPolicy {
  constructor(private readonly config: FaceRecognitionConfig) {}

  /**
   * Make a recognition decision based on pipeline results.
   * This is the centralized decision point — no scattered magic numbers.
   */
  decide(input: RecognitionInput, matchedStudentId?: string): RecognitionDecision {
    // Step 1: Quality gate
    if (input.qualityScore < this.config.qualityThreshold) {
      return {
        outcome: 'REJECTED',
        reason: 'QUALITY_TOO_LOW',
        message: `Face quality ${input.qualityScore.toFixed(3)} is below threshold ${this.config.qualityThreshold}`,
      };
    }

    // Step 2: Liveness gate
    if (this.config.livenessPolicy.required) {
      if (input.livenessDecision === 'FAIL') {
        return {
          outcome: 'REJECTED',
          reason: 'LIVENESS_FAILED',
          message: 'Liveness check failed — possible presentation attack',
        };
      }

      if (input.livenessDecision === 'UNAVAILABLE') {
        if (this.config.livenessPolicy.allowUnavailable) {
          console.warn('[RecognitionDecisionPolicy] Liveness model unavailable — allowing recognition without liveness check');
        } else {
          return {
            outcome: 'REJECTED',
            reason: 'LIVENESS_UNAVAILABLE',
            message: 'Liveness check unavailable and is required by policy',
          };
        }
      }

      // A PASS whose confidence is below the configured policy threshold is
      // not good enough — the engine's own pass band and this threshold must
      // both hold (previously livenessPolicy.threshold was never read).
      if (
        input.livenessDecision === 'PASS' &&
        typeof input.livenessConfidence === 'number' &&
        input.livenessConfidence < this.config.livenessPolicy.threshold
      ) {
        return {
          outcome: 'REJECTED',
          reason: 'LIVENESS_BELOW_THRESHOLD',
          message: `Liveness confidence ${input.livenessConfidence.toFixed(3)} is below policy threshold ${this.config.livenessPolicy.threshold}`,
        };
      }

      if (input.livenessDecision === 'UNCERTAIN' && !this.config.livenessPolicy.acceptUncertain) {
        return {
          outcome: 'UNCERTAIN',
          reason: 'LIVENESS_UNCERTAIN',
          message: 'Liveness check returned uncertain result',
        };
      }
    }

    // Step 3: Match gate
    if (!input.bestMatchFound || input.similarityScore === null) {
      return {
        outcome: 'REJECTED',
        reason: 'NO_MATCH_FOUND',
        message: 'No matching face template found in the database',
      };
    }

    // Step 3b: Invalid score — fail closed. For NaN every comparison below is
    // false (NaN < threshold is false, NaN < margin is false), which would
    // let a broken matcher result sail all the way to IDENTIFIED.
    if (!Number.isFinite(input.similarityScore)) {
      return {
        outcome: 'REJECTED',
        reason: 'SIMILARITY_INVALID',
        message: 'Similarity score is not a finite number',
      };
    }

    // Step 4: Similarity threshold
    if (input.similarityScore < this.config.matching.similarityThreshold) {
      return {
        outcome: 'REJECTED',
        reason: 'SIMILARITY_TOO_LOW',
        message: `Similarity score ${input.similarityScore.toFixed(3)} is below threshold ${this.config.matching.similarityThreshold}`,
      };
    }

    // Step 5: Uncertain zone
    const distanceFromThreshold = Math.abs(input.similarityScore - this.config.matching.similarityThreshold);
    if (distanceFromThreshold < this.config.matching.uncertainMargin) {
      return {
        outcome: 'UNCERTAIN',
        reason: 'SIMILARITY_UNCERTAIN',
        message: `Similarity score ${input.similarityScore.toFixed(3)} is near the threshold`,
      };
    }

    // Step 5b: Top-1 vs Top-2 Ambiguity check
    const minMargin = this.config.matching.minAmbiguityMargin ?? 0.05;
    if (
      typeof input.ambiguityMargin === 'number' &&
      (!Number.isFinite(input.ambiguityMargin) ||
        input.ambiguityMargin < minMargin)
    ) {
      return {
        outcome: 'UNCERTAIN',
        reason: 'AMBIGUOUS_MATCH',
        message: `Match is ambiguous: margin between top candidates (${input.ambiguityMargin.toFixed(3)}) is below required ${minMargin.toFixed(3)}`,
      };
    }

    // Step 6: Confidence categorization
    // Bands must match SimilarityScore.getConfidence() in value-objects.ts
    // (HIGH >= 0.8, MEDIUM >= 0.7) — one taxonomy, not two.
    let confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    if (input.similarityScore >= 0.8) {
      confidence = 'HIGH';
    } else if (input.similarityScore >= 0.7) {
      confidence = 'MEDIUM';
    } else {
      confidence = 'LOW';
    }

    // Step 7: Final identification
    if (!matchedStudentId) {
      return {
        outcome: 'REJECTED',
        reason: 'NO_STUDENT_ID',
        message: 'Match found but student could not be identified',
      };
    }

    return {
      outcome: 'IDENTIFIED',
      confidence,
      studentId: matchedStudentId,
      message: `Student identified with ${confidence.toLowerCase()} confidence`,
    };
  }

  /** Get the current configuration (for settings display) */
  getConfig(): FaceRecognitionConfig {
    // Deep-clone the nested policy objects so a caller cannot mutate the
    // live policy through the returned config (K7).
    return {
      ...this.config,
      matching: { ...this.config.matching },
      livenessPolicy: { ...this.config.livenessPolicy },
      sessions: { ...this.config.sessions },
      duplicatePrevention: { ...this.config.duplicatePrevention },
    };
  }
}
