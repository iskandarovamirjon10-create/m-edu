/**
 * Regression test: statusColor is called with values that may be undefined
 * (e.g. a recognition result missing a status). It must not throw.
 */
import { describe, it, expect} from'vitest';
import { statusColor} from'../ui';

describe('statusColor', () => {
 it('handles undefined/null without throwing', () => {
 expect(() => statusColor(undefined)).not.toThrow();
 expect(() => statusColor(null)).not.toThrow();
 // Returns the current GlassBadge variant name (the legacy palette used
 //'slate'; the component system was migrated to variant names).
 expect(statusColor(undefined)).toBe('muted');
});

 it('maps known statuses to colors', () => {
 expect(statusColor('IDENTIFIED')).toBe('success');
 expect(statusColor('PAID')).toBe('success');
 expect(statusColor('CANCELLED')).not.toBe('success');
});
});
