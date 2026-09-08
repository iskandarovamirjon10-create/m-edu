import {
  describe,
  expect,
  it,
} from 'vitest';

import { ThrottlerException } from '@nestjs/throttler';

import { OrgRateLimiter } from '../org-rate-limiter';

/**
 * Deterministic fake clock.
 *
 * We intentionally do not use vi.useFakeTimers() here because this limiter
 * accepts an injectable clock and therefore can be tested deterministically
 * without coupling the tests to Vitest timer implementation details.
 */
function makeLimiter(
  retentionMs = 10 * 60_000,
) {
  let clock = 1_000_000;

  const now = () => clock;

  const advance = (ms: number) => {
    if (ms < 0) {
      throw new Error(
        'Test clock cannot move backwards',
      );
    }

    clock += ms;
  };

  const rl = new OrgRateLimiter(
    retentionMs,
    now,
  );

  return {
    rl,
    advance,
    now,
  };
}

describe('OrgRateLimiter', () => {
  describe('basic limiting', () => {
    it('allows calls below the configured limit', () => {
      const { rl } = makeLimiter();

      expect(() =>
        rl.assert(
          'orgA',
          'discover',
          3,
          60_000,
        ),
      ).not.toThrow();

      expect(() =>
        rl.assert(
          'orgA',
          'discover',
          3,
          60_000,
        ),
      ).not.toThrow();

      expect(() =>
        rl.assert(
          'orgA',
          'discover',
          3,
          60_000,
        ),
      ).not.toThrow();
    });

    it('allows exactly the configured number of calls', () => {
      const { rl } = makeLimiter();

      for (let i = 0; i < 5; i++) {
        expect(() =>
          rl.assert(
            'orgA',
            'discover',
            5,
            60_000,
          ),
        ).not.toThrow();
      }
    });

    it('throws HTTP 429 when the limit is exceeded', () => {
      const { rl } = makeLimiter();

      for (let i = 0; i < 3; i++) {
        rl.assert(
          'orgA',
          'discover',
          3,
          60_000,
        );
      }

      expect(() =>
        rl.assert(
          'orgA',
          'discover',
          3,
          60_000,
        ),
      ).toThrow(ThrottlerException);
    });

    it('does not consume an additional slot when a request is rejected', () => {
      const { rl, advance } =
        makeLimiter();

      rl.assert(
        'orgA',
        'discover',
        1,
        60_000,
      );

      expect(() =>
        rl.assert(
          'orgA',
          'discover',
          1,
          60_000,
        ),
      ).toThrow(ThrottlerException);

      /*
       * If the rejected request accidentally consumed a timestamp,
       * the next request could remain blocked even after the original
       * timestamp expires.
       */
      advance(60_001);

      expect(() =>
        rl.assert(
          'orgA',
          'discover',
          1,
          60_000,
        ),
      ).not.toThrow();
    });
  });

  describe('sliding-window behavior', () => {
    it('allows a request after the oldest timestamp leaves the window', () => {
      const { rl, advance } =
        makeLimiter();

      rl.assert(
        'orgA',
        'discover',
        2,
        60_000,
      );

      rl.assert(
        'orgA',
        'discover',
        2,
        60_000,
      );

      advance(59_999);

      expect(() =>
        rl.assert(
          'orgA',
          'discover',
          2,
          60_000,
        ),
      ).toThrow(ThrottlerException);

      advance(2);

      expect(() =>
        rl.assert(
          'orgA',
          'discover',
          2,
          60_000,
        ),
      ).not.toThrow();
    });

    it('removes timestamps outside the active window', () => {
      const { rl, advance } =
        makeLimiter();

      rl.assert(
        'orgA',
        'discover',
        2,
        60_000,
      );

      advance(60_001);

      expect(() =>
        rl.assert(
          'orgA',
          'discover',
          2,
          60_000,
        ),
      ).not.toThrow();

      expect(() =>
        rl.assert(
          'orgA',
          'discover',
          2,
          60_000,
        ),
      ).not.toThrow();
    });

    it('treats the exact window boundary consistently', () => {
      const { rl, advance } =
        makeLimiter();

      rl.assert(
        'orgA',
        'discover',
        1,
        60_000,
      );

      /*
       * The implementation uses t > cutoff.
       * At exactly windowMs, the original timestamp is expired.
       */
      advance(60_000);

      expect(() =>
        rl.assert(
          'orgA',
          'discover',
          1,
          60_000,
        ),
      ).not.toThrow();
    });
  });

  describe('tenant isolation', () => {
    it('isolates organizations', () => {
      const { rl } = makeLimiter();

      rl.assert(
        'orgA',
        'discover',
        2,
        60_000,
      );

      rl.assert(
        'orgA',
        'discover',
        2,
        60_000,
      );

      expect(() =>
        rl.assert(
          'orgA',
          'discover',
          2,
          60_000,
        ),
      ).toThrow(ThrottlerException);

      expect(() =>
        rl.assert(
          'orgB',
          'discover',
          2,
          60_000,
        ),
      ).not.toThrow();
    });

    it('does not allow one organization to affect another operation bucket', () => {
      const { rl } = makeLimiter();

      rl.assert(
        'orgA',
        'discover',
        1,
        60_000,
      );

      expect(() =>
        rl.assert(
          'orgB',
          'discover',
          1,
          60_000,
        ),
      ).not.toThrow();

      expect(() =>
        rl.assert(
          'orgB',
          'test-connection',
          1,
          60_000,
        ),
      ).not.toThrow();
    });
  });

  describe('operation isolation', () => {
    it('keeps different operation keys independent', () => {
      const { rl } = makeLimiter();

      rl.assert(
        'orgA',
        'discover',
        1,
        60_000,
      );

      expect(() =>
        rl.assert(
          'orgA',
          'discover',
          1,
          60_000,
        ),
      ).toThrow(ThrottlerException);

      expect(() =>
        rl.assert(
          'orgA',
          'test-connection',
          1,
          60_000,
        ),
      ).not.toThrow();
    });

    it('supports independent minute and hourly buckets', () => {
      const { rl, advance } =
        makeLimiter();

      for (let i = 0; i < 10; i++) {
        rl.assert(
          'orgA',
          'discover:minute',
          3,
          60_000,
        );

        rl.assert(
          'orgA',
          'discover:hourly',
          10,
          3_600_000,
        );

        advance(60_001);
      }

      expect(() =>
        rl.assert(
          'orgA',
          'discover:hourly',
          10,
          3_600_000,
        ),
      ).toThrow(ThrottlerException);
    });

    it('allows a new minute bucket while preserving the hourly bucket', () => {
      const { rl, advance } =
        makeLimiter();

      rl.assert(
        'orgA',
        'discover:minute',
        1,
        60_000,
      );

      rl.assert(
        'orgA',
        'discover:hourly',
        2,
        3_600_000,
      );

      advance(60_001);

      expect(() =>
        rl.assert(
          'orgA',
          'discover:minute',
          1,
          60_000,
        ),
      ).not.toThrow();

      /*
       * The hourly bucket still contains the original call.
       */
      expect(() =>
        rl.assert(
          'orgA',
          'discover:hourly',
          2,
          3_600_000,
        ),
      ).not.toThrow();

      expect(() =>
        rl.assert(
          'orgA',
          'discover:hourly',
          2,
          3_600_000,
        ),
      ).toThrow(ThrottlerException);
    });
  });

  describe('pruning', () => {
    it('tracks active organizations', () => {
      const { rl } = makeLimiter();

      rl.assert(
        'orgA',
        'discover',
        5,
        60_000,
      );

      expect(rl.size).toBe(1);
    });

    it('removes stale organizations after retention expires', () => {
      const { rl, advance } =
        makeLimiter();

      rl.assert(
        'orgA',
        'discover',
        5,
        60_000,
      );

      expect(rl.size).toBe(1);

      advance(10 * 60_000 + 1);

      rl.prune();

      expect(rl.size).toBe(0);
    });

    it('does not remove active organizations', () => {
      const { rl, advance } =
        makeLimiter();

      rl.assert(
        'orgA',
        'discover',
        5,
        60_000,
      );

      advance(5 * 60_000);

      rl.prune();

      expect(rl.size).toBe(1);
    });

    it('removes expired operation buckets', () => {
      const { rl, advance } =
        makeLimiter();

      rl.assert(
        'orgA',
        'discover',
        5,
        60_000,
      );

      rl.assert(
        'orgA',
        'test-connection',
        5,
        60_000,
      );

      expect(rl.size).toBe(1);

      advance(11 * 60_000);

      rl.prune();

      expect(rl.size).toBe(0);
    });
  });

  describe('clear()', () => {
    it('clears all tracked organizations', () => {
      const { rl } = makeLimiter();

      rl.assert(
        'orgA',
        'discover',
        5,
        60_000,
      );

      rl.assert(
        'orgB',
        'discover',
        5,
        60_000,
      );

      expect(rl.size).toBe(2);

      rl.clear();

      expect(rl.size).toBe(0);
    });

    it('allows requests again after clear()', () => {
      const { rl } = makeLimiter();

      rl.assert(
        'orgA',
        'discover',
        1,
        60_000,
      );

      expect(() =>
        rl.assert(
          'orgA',
          'discover',
          1,
          60_000,
        ),
      ).toThrow(ThrottlerException);

      rl.clear();

      expect(() =>
        rl.assert(
          'orgA',
          'discover',
          1,
          60_000,
        ),
      ).not.toThrow();
    });
  });

  describe('input validation', () => {
    it('rejects an empty organization id', () => {
      const { rl } = makeLimiter();

      expect(() =>
        rl.assert(
          '',
          'discover',
          1,
          60_000,
        ),
      ).toThrow();
    });

    it('rejects an empty operation key', () => {
      const { rl } = makeLimiter();

      expect(() =>
        rl.assert(
          'orgA',
          '',
          1,
          60_000,
        ),
      ).toThrow();
    });

    it('rejects zero limit', () => {
      const { rl } = makeLimiter();

      expect(() =>
        rl.assert(
          'orgA',
          'discover',
          0,
          60_000,
        ),
      ).toThrow();
    });

    it('rejects negative limits', () => {
      const { rl } = makeLimiter();

      expect(() =>
        rl.assert(
          'orgA',
          'discover',
          -1,
          60_000,
        ),
      ).toThrow();
    });

    it('rejects zero windows', () => {
      const { rl } = makeLimiter();

      expect(() =>
        rl.assert(
          'orgA',
          'discover',
          1,
          0,
        ),
      ).toThrow();
    });

    it('rejects negative windows', () => {
      const { rl } = makeLimiter();

      expect(() =>
        rl.assert(
          'orgA',
          'discover',
          1,
          -1,
        ),
      ).toThrow();
    });
  });

  describe('capacity protection', () => {
    it('can be used with many organizations without retaining expired buckets forever', () => {
      const {
        rl,
        advance,
      } = makeLimiter();

      for (let i = 0; i < 300; i++) {
        rl.assert(
          `org-${i}`,
          'discover',
          1,
          60_000,
        );
      }

      /*
       * The implementation has a defensive 256-org cap.
       * Exact eviction behavior is an implementation detail, but the
       * important invariant is that memory does not grow without bound.
       */
      expect(rl.size).toBeLessThanOrEqual(
        256,
      );

      advance(
        11 * 60_000,
      );

      rl.prune();

      expect(rl.size).toBe(0);
    });
  });
});