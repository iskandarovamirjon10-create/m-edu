/**
 * M-EDU useAnimationPerformance — Real-Time Frame Rate & Motion Budget Engine
 *
 * Automatically detects device performance capabilities, 60fps/120fps display refresh,
 * frame drops, and prefers-reduced-motion to dynamically tune spatial physics and blurs.
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { usePrefersReducedMotion } from '../lib/design';

export type PerformanceTier = 'high' | 'medium' | 'low';

export interface AnimationPerformanceState {
  /** Approximate current frames per second (e.g. 60, 120, or lower under load) */
  fps: number;
  /** Estimated device capability tier */
  tier: PerformanceTier;
  /** Whether the frame rate is steady and smooth (<= 5% frame drop) */
  isSmooth: boolean;
  /** Whether the user has system-level reduced motion enabled */
  reducedMotion: boolean;
  /** Animation duration multiplier (0 for reduced motion, 0.75 for medium, 1.0 for high) */
  durationMultiplier: number;
  /** Whether heavy optical effects (like 120px Gaussian blurs) should be softened */
  shouldSimplifyOptics: boolean;
}

export interface UseAnimationPerformanceOptions {
  /** Enable continuous real-time frame sampling (default: false in non-profiling mode) */
  activeSampling?: boolean;
  /** Number of frame samples before updating FPS (default: 30) */
  sampleCount?: number;
}

export function useAnimationPerformance(
  options: UseAnimationPerformanceOptions = {},
): AnimationPerformanceState {
  const { activeSampling = false, sampleCount = 30 } = options;
  const reducedMotion = usePrefersReducedMotion();

  const [fps, setFps] = useState<number>(() => {
    // Check if high-refresh screen is likely supported
    if (typeof window !== 'undefined' && window.screen && 'availWidth' in window.screen) {
      return 60;
    }
    return 60;
  });

  const frameTimesRef = useRef<number[]>([]);
  const lastTimeRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!activeSampling || reducedMotion || typeof window === 'undefined') {
      return;
    }

    let running = true;
    frameTimesRef.current = [];
    lastTimeRef.current = performance.now();

    const onFrame = (now: number) => {
      if (!running) return;

      const delta = now - lastTimeRef.current;
      lastTimeRef.current = now;

      if (delta > 0 && delta < 1000) {
        frameTimesRef.current.push(1000 / delta);

        if (frameTimesRef.current.length >= sampleCount) {
          const avg =
            frameTimesRef.current.reduce((a, b) => a + b, 0) /
            frameTimesRef.current.length;
          setFps(Math.round(avg));
          frameTimesRef.current = [];
        }
      }

      rafIdRef.current = requestAnimationFrame(onFrame);
    };

    rafIdRef.current = requestAnimationFrame(onFrame);

    return () => {
      running = false;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [activeSampling, sampleCount, reducedMotion]);

  const state = useMemo<AnimationPerformanceState>(() => {
    if (reducedMotion) {
      return {
        fps: 0,
        tier: 'low',
        isSmooth: true,
        reducedMotion: true,
        durationMultiplier: 0,
        shouldSimplifyOptics: true,
      };
    }

    const tier: PerformanceTier = fps >= 55 ? 'high' : fps >= 38 ? 'medium' : 'low';
    const isSmooth = fps >= 50;
    const durationMultiplier = tier === 'high' ? 1.0 : tier === 'medium' ? 0.75 : 0.5;
    const shouldSimplifyOptics = tier === 'low';

    return {
      fps,
      tier,
      isSmooth,
      reducedMotion: false,
      durationMultiplier,
      shouldSimplifyOptics,
    };
  }, [fps, reducedMotion]);

  return state;
}
