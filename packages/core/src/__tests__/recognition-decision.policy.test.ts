import { describe, it, expect } from 'vitest';
import {
  RecognitionDecisionPolicy,
  DEFAULT_FACE_RECOGNITION_CONFIG,
} from '../application/recognition-decision.policy';

describe('RecognitionDecisionPolicy', () => {
  const policy = new RecognitionDecisionPolicy(DEFAULT_FACE_RECOGNITION_CONFIG);

  describe('quality gate', () => {
    it('rejects when quality score is below threshold', () => {
      const result = policy.decide({
        qualityScore: 0.1,
        livenessDecision: 'PASS',
        similarityScore: 0.9,
        bestMatchFound: true,
      });
      expect(result.outcome).toBe('REJECTED');
      expect(result).toHaveProperty('reason', 'QUALITY_TOO_LOW');
    });

    it('passes quality check with high score', () => {
      const result = policy.decide({
        qualityScore: 0.8,
        livenessDecision: 'PASS',
        similarityScore: 0.9,
        bestMatchFound: true,
      }, 'test-student');
      expect(result.outcome).not.toBe('REJECTED');
    });
  });

  describe('liveness gate', () => {
    it('rejects when liveness fails', () => {
      const result = policy.decide({
        qualityScore: 0.8,
        livenessDecision: 'FAIL',
        similarityScore: 0.9,
        bestMatchFound: true,
      });
      expect(result.outcome).toBe('REJECTED');
      expect(result).toHaveProperty('reason', 'LIVENESS_FAILED');
    });

    it('rejects when liveness is unavailable and required', () => {
      const result = policy.decide({
        qualityScore: 0.8,
        livenessDecision: 'UNAVAILABLE',
        similarityScore: 0.9,
        bestMatchFound: true,
      });
      expect(result.outcome).toBe('REJECTED');
      expect(result).toHaveProperty('reason', 'LIVENESS_UNAVAILABLE');
    });

    it('returns uncertain when liveness is uncertain and not accepted', () => {
      const result = policy.decide({
        qualityScore: 0.8,
        livenessDecision: 'UNCERTAIN',
        similarityScore: 0.9,
        bestMatchFound: true,
      });
      expect(result.outcome).toBe('UNCERTAIN');
    });
  });

  describe('matching gate', () => {
    it('rejects when no match found', () => {
      const result = policy.decide({
        qualityScore: 0.8,
        livenessDecision: 'PASS',
        similarityScore: null,
        bestMatchFound: false,
      });
      expect(result.outcome).toBe('REJECTED');
      expect(result).toHaveProperty('reason', 'NO_MATCH_FOUND');
    });

    it('rejects when similarity is below threshold', () => {
      const result = policy.decide({
        qualityScore: 0.8,
        livenessDecision: 'PASS',
        similarityScore: 0.3,
        bestMatchFound: true,
      });
      expect(result.outcome).toBe('REJECTED');
      expect(result).toHaveProperty('reason', 'SIMILARITY_TOO_LOW');
    });

    it('returns uncertain when similarity is near threshold from above (e.g. 0.63 with threshold 0.60, margin 0.05)', () => {
      const result = policy.decide({
        qualityScore: 0.8,
        livenessDecision: 'PASS',
        similarityScore: 0.63,
        bestMatchFound: true,
      });
      expect(result.outcome).toBe('UNCERTAIN');
      expect(result).toHaveProperty('reason', 'SIMILARITY_UNCERTAIN');
    });

    it('returns uncertain when similarity is near threshold from below (e.g. 0.58 with threshold 0.60, margin 0.05)', () => {
      const result = policy.decide({
        qualityScore: 0.8,
        livenessDecision: 'PASS',
        similarityScore: 0.58,
        bestMatchFound: true,
      });
      expect(result.outcome).toBe('UNCERTAIN');
      expect(result).toHaveProperty('reason', 'SIMILARITY_UNCERTAIN');
    });

    it('identifies with HIGH confidence when similarity >= 0.8', () => {
      const result = policy.decide({
        qualityScore: 0.8,
        livenessDecision: 'PASS',
        similarityScore: 0.9,
        bestMatchFound: true,
      }, 'student-123');
      expect(result.outcome).toBe('IDENTIFIED');
      expect(result).toHaveProperty('confidence', 'HIGH');
      expect(result).toHaveProperty('studentId', 'student-123');
    });

    it('identifies with MEDIUM confidence when similarity 0.7-0.8', () => {
      const result = policy.decide({
        qualityScore: 0.8,
        livenessDecision: 'PASS',
        similarityScore: 0.7,
        bestMatchFound: true,
      }, 'student-456');
      expect(result.outcome).toBe('IDENTIFIED');
      expect(result).toHaveProperty('confidence', 'MEDIUM');
    });

    it('identifies with LOW confidence when similarity is at the threshold', () => {
      const result = policy.decide({
        qualityScore: 0.8,
        livenessDecision: 'PASS',
        similarityScore: 0.66,
        bestMatchFound: true,
      }, 'student-789');
      expect(result.outcome).toBe('IDENTIFIED');
      expect(result).toHaveProperty('confidence', 'LOW');
    });

    it('rejects a PASS whose liveness confidence is below the policy threshold', () => {
      const strict = new RecognitionDecisionPolicy({
        ...DEFAULT_FACE_RECOGNITION_CONFIG,
        livenessPolicy: {
          ...DEFAULT_FACE_RECOGNITION_CONFIG.livenessPolicy,
          threshold: 0.9,
        },
      });
      const result = strict.decide({
        qualityScore: 0.8,
        livenessDecision: 'PASS',
        livenessConfidence: 0.85,
        similarityScore: 0.9,
        bestMatchFound: true,
      }, 'student-1');
      expect(result.outcome).toBe('REJECTED');
      expect(result).toHaveProperty('reason', 'LIVENESS_BELOW_THRESHOLD');
    });
  });

  describe('configuration', () => {
    it('returns the current config', () => {
      const config = policy.getConfig();
      expect(config.qualityThreshold).toBe(0.4);
      expect(config.livenessPolicy.required).toBe(true);
      expect(config.matching.similarityThreshold).toBe(0.6);
    });

    it('can be created with custom config', () => {
      const custom = new RecognitionDecisionPolicy({
        ...DEFAULT_FACE_RECOGNITION_CONFIG,
        qualityThreshold: 0.5,
      });
      expect(custom.getConfig().qualityThreshold).toBe(0.5);
    });
  });

  describe('invalid numeric guards (fail closed)', () => {
    it('rejects a non-finite similarity score instead of sailing past every threshold', () => {
      // NaN < threshold is false, so without this guard a broken matcher
      // result would reach IDENTIFIED.
      const result = policy.decide({
        qualityScore: 0.8,
        livenessDecision: 'PASS',
        similarityScore: Number.NaN,
        bestMatchFound: true,
      }, 'student-nan');
      expect(result.outcome).toBe('REJECTED');
      expect(result).toHaveProperty('reason', 'SIMILARITY_INVALID');
    });

    it('rejects a non-finite ambiguity margin as ambiguous', () => {
      const result = policy.decide({
        qualityScore: 0.8,
        livenessDecision: 'PASS',
        similarityScore: 0.9,
        bestMatchFound: true,
        ambiguityMargin: Number.NaN,
      }, 'student-margin');
      expect(result.outcome).toBe('UNCERTAIN');
      expect(result).toHaveProperty('reason', 'AMBIGUOUS_MATCH');
    });

    it('rejects a top-1/top-2 margin below the configured minimum', () => {
      const result = policy.decide({
        qualityScore: 0.8,
        livenessDecision: 'PASS',
        similarityScore: 0.9,
        bestMatchFound: true,
        ambiguityMargin: 0.01,
      }, 'student-tight');
      expect(result.outcome).toBe('UNCERTAIN');
      expect(result).toHaveProperty('reason', 'AMBIGUOUS_MATCH');
    });
  });
});
