'use client';

/**
 * Shared Liquid Glass wiring for dashboard panels.
 *
 * Every dashboard card is the same physical object: a 32 px squircle slab of
 * clear glass with a 16 px bezel, a real per-element refraction map, pointer
 * glint/tilt, and an adaptive tint sampled from whatever sits behind it. The
 * hook keeps that wiring in one place so panels cannot drift apart visually.
 */

import { memo, useRef } from 'react';
import { useLiquidGlassLens } from '@/layouts/core/liquidGlassOptics';
import {
  useAdaptiveGlassTint,
  useLiquidGlassPhysics,
} from '@/layouts/core/useLiquidGlass';

export interface DashboardGlassOptions {
  radius?: number;
  bezel?: number;
  refraction?: number;
  dispersion?: number;
  tilt?: boolean;
  press?: boolean;
  scrollMotion?: boolean;
}

export function useDashboardGlassCard<T extends HTMLElement = HTMLDivElement>(
  options: DashboardGlassOptions = {},
) {
  const {
    radius = 32,
    bezel = 16,
    refraction = 1,
    dispersion = 0,
    tilt = false,
    press = false,
    scrollMotion = false,
  } = options;
  const ref = useRef<T | null>(null);

  useLiquidGlassPhysics(ref, { tilt, press, scrollMotion });

  return ref;
}

/** Optical strata shared by dashboard panels: lightweight hardware-accelerated highlights */
export const DashboardGlassLayers = memo(function DashboardGlassLayers() {
  return (
    <>
      <span aria-hidden="true" className="lgx__layer lgx__depth" />
      <span aria-hidden="true" className="lgx__specular" />
      <span aria-hidden="true" className="lgx__rim" />
    </>
  );
});
