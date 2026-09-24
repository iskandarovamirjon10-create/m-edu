/**
 * Regression test: the confidence field may arrive as a categorical string
 * ('HIGH' |'MEDIUM' |'LOW' |'NONE') or a numeric score; the UI previously
 * rendered "NaN%"for strings.
 */
import { describe, it, expect} from'vitest';
import { formatConfidence} from'../FaceRecognition';

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
