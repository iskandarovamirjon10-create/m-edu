/**
 * Regression test: the confidence field may arrive as a categorical string
 * ('HIGH' |'MEDIUM' |'LOW' |'NONE') or a numeric score; the UI previously
 * rendered "NaN%"for strings.
 */
import { describe, it, expect} from'vitest';
import { formatConfidence, resolveRecognitionOutcome } from'../FaceRecognition';

describe('formatConfidence', () => {
 it('renders categorical strings as-is', () => {
 expect(formatConfidence('HIGH')).toBe('HIGH');
 expect(formatConfidence('MEDIUM')).toBe('MEDIUM');
 expect(formatConfidence('NONE')).toBe('NONE');
});

 it('renders numeric scores as percentages', () => {
 expect(formatConfidence(0.85)).toBe('85%');
 expect(formatConfidence('0.92')).toBe('92%');
});

 it('renders null/undefined/0 as placeholder', () => {
 expect(formatConfidence(null)).toBe('—');
 expect(formatConfidence(undefined)).toBe('—');
});
});

/**
 * Regression: the API returns RecognitionAttemptStatus (IDENTIFIED,
 * UNIDENTIFIED, MATCH_NOT_FOUND, …). The page used to test RECOGNIZED /
 * UNKNOWN, which never matched, so the success and unknown branches were dead.
 * It also checked the success branch BEFORE accessDenied/duplicate, so a
 * refused or duplicate attempt could be reported as a successful match.
 */
describe('resolveRecognitionOutcome', () => {
 it('classifies a bare IDENTIFIED attempt as SUCCESS', () => {
 expect(resolveRecognitionOutcome({ status: 'IDENTIFIED' } as never)).toBe('SUCCESS');
});

 it('an entry-gate refusal wins over a bare IDENTIFIED', () => {
 expect(
 resolveRecognitionOutcome({ status: 'IDENTIFIED', accessDenied: true, accessReason: 'OUT_OF_SCHEDULE' } as never),
 ).toBe('DENIED');
 expect(
 resolveRecognitionOutcome({ status: 'IDENTIFIED', accessDenied: true, accessReason: 'INSUFFICIENT_FUNDS' } as never),
 ).toBe('DENIED');
});

 it('duplicate prevention wins over a bare IDENTIFIED', () => {
 expect(
 resolveRecognitionOutcome({ status: 'IDENTIFIED', attendanceDecision: 'DUPLICATE_PREVENTED' } as never),
 ).toBe('DUPLICATE');
});

 it('classifies non-identified attempt statuses as UNKNOWN', () => {
 for (const status of [
 'UNIDENTIFIED',
 'MATCH_NOT_FOUND',
 'MATCH_UNCERTAIN',
 'QUALITY_FAILED',
 'LIVENESS_FAILED',
 'LIVENESS_UNCERTAIN',
 'LIVENESS_UNAVAILABLE',
 'ERROR',
 ]) {
 expect(resolveRecognitionOutcome({ status } as never)).toBe('UNKNOWN');
}
});

 it('returns NEUTRAL for null/missing or in-progress statuses', () => {
 expect(resolveRecognitionOutcome(null)).toBe('NEUTRAL');
 expect(resolveRecognitionOutcome({ status: 'DETECTED' } as never)).toBe('NEUTRAL');
});
});
