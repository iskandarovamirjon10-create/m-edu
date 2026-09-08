/**
 * Mock Liveness Checker — FOR TESTING ONLY.
 *
 * Always returns PASS. This should NEVER be used in production.
 *
 * In production, replace with:
 * - Silent Face Anti-Spoofing
 * - Challenge-Response liveness
 * - 3D depth analysis
 */

import type { LivenessCheckInput, LivenessResult } from '@medu/core';

export class MockLivenessChecker {
  async checkLiveness(_input: LivenessCheckInput): Promise<LivenessResult> {
    return {
      decision: 'PASS',
      confidence: 0.95,
      details: { provider: 'mock' },
    };
  }

  isAvailable(): boolean {
    return true;
  }
}
