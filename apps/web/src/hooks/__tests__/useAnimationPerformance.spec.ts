// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnimationPerformance } from '../useAnimationPerformance';

vi.mock('../../lib/design', () => ({
  usePrefersReducedMotion: vi.fn(() => false),
}));

import { usePrefersReducedMotion } from '../../lib/design';

describe('useAnimationPerformance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (usePrefersReducedMotion as any).mockReturnValue(false);
  });

  it('returns default high performance state when reduced motion is disabled', () => {
    const { result } = renderHook(() => useAnimationPerformance());

    expect(result.current.reducedMotion).toBe(false);
    expect(result.current.tier).toBe('high');
    expect(result.current.isSmooth).toBe(true);
    expect(result.current.durationMultiplier).toBe(1.0);
    expect(result.current.shouldSimplifyOptics).toBe(false);
  });

  it('respects prefers-reduced-motion and returns zero duration multiplier', () => {
    (usePrefersReducedMotion as any).mockReturnValue(true);

    const { result } = renderHook(() => useAnimationPerformance());

    expect(result.current.reducedMotion).toBe(true);
    expect(result.current.tier).toBe('low');
    expect(result.current.durationMultiplier).toBe(0);
    expect(result.current.shouldSimplifyOptics).toBe(true);
  });

  it('samples frames and updates FPS under active sampling', () => {
    let frameCallback: ((time: number) => void) | null = null;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      frameCallback = cb;
      return 1;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);

    const { result } = renderHook(() =>
      useAnimationPerformance({ activeSampling: true, sampleCount: 2 }),
    );

    expect(window.requestAnimationFrame).toHaveBeenCalled();

    // Simulate 60fps frames (16.6ms intervals)
    act(() => {
      if (frameCallback) frameCallback(1000);
      if (frameCallback) frameCallback(1016.6);
      if (frameCallback) frameCallback(1033.3);
    });

    expect(result.current.fps).toBeGreaterThanOrEqual(58);
  });
});
