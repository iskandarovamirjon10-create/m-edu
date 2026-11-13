/**
 * useLiquidGlass — runtime optics for the Liquid Glass material.
 *
 * Three independent capabilities:
 *   · useLiquidGlassDefs   — injects the shared SVG refraction filter once.
 *   · useLiquidGlassPhysics — pointer / press / scroll / gyroscope → CSS vars.
 *   · useAdaptiveGlassTint  — samples the colour actually behind the glass and
 *                             derives a desaturated tint, ink and contrast.
 *
 * Everything is event driven and writes CSS custom properties directly, so no
 * React re-render happens per pointer move or per orientation sample. All
 * listeners are passive and removed on unmount.
 */
import { useEffect, type RefObject } from 'react';

const SVG_NS = 'http://www.w3.org/2000/svg';
const FILTER_ID = 'lgx-refraction';
const MAP_ID = 'lgx-refraction-map';

/* ══════════════════════════════════════════════════════════════════════════
 * 1 · REFRACTION FILTER (single instance per document)
 * ════════════════════════════════════════════════════════════════════════ */

/**
 * Edge normal map for a rounded slab. Neutral grey = no displacement; the
 * rim ramps toward pure R/G so the backdrop is sampled from inside the edge,
 * which is what makes a thick glass bevel look like it is pulling the
 * background inward. `preserveAspectRatio="none"` stretches it to any size.
 */
const REFRACTION_MAP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" preserveAspectRatio="none">
<defs>
<linearGradient id="l" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="rgb(255,128,128)"/><stop offset="1" stop-color="rgb(128,128,128)"/></linearGradient>
<linearGradient id="r" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="rgb(128,128,128)"/><stop offset="1" stop-color="rgb(0,128,128)"/></linearGradient>
<linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgb(128,255,128)"/><stop offset="1" stop-color="rgb(128,128,128)"/></linearGradient>
<linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgb(128,128,128)"/><stop offset="1" stop-color="rgb(128,0,128)"/></linearGradient>
<radialGradient id="tl" cx="0" cy="0" r="1"><stop offset="0" stop-color="rgb(255,255,128)"/><stop offset="1" stop-color="rgb(128,128,128)"/></radialGradient>
<radialGradient id="tr" cx="1" cy="0" r="1"><stop offset="0" stop-color="rgb(0,255,128)"/><stop offset="1" stop-color="rgb(128,128,128)"/></radialGradient>
<radialGradient id="bl" cx="0" cy="1" r="1"><stop offset="0" stop-color="rgb(255,0,128)"/><stop offset="1" stop-color="rgb(128,128,128)"/></radialGradient>
<radialGradient id="br" cx="1" cy="1" r="1"><stop offset="0" stop-color="rgb(0,0,128)"/><stop offset="1" stop-color="rgb(128,128,128)"/></radialGradient>
</defs>
<rect width="200" height="200" fill="rgb(128,128,128)"/>
<rect x="0" y="0" width="26" height="200" fill="url(#l)"/>
<rect x="174" y="0" width="26" height="200" fill="url(#r)"/>
<rect x="0" y="0" width="200" height="26" fill="url(#t)"/>
<rect x="0" y="174" width="200" height="26" fill="url(#b)"/>
<rect x="0" y="0" width="34" height="34" fill="url(#tl)"/>
<rect x="166" y="0" width="34" height="34" fill="url(#tr)"/>
<rect x="0" y="166" width="34" height="34" fill="url(#bl)"/>
<rect x="166" y="166" width="34" height="34" fill="url(#br)"/>
</svg>`;

let defsRefCount = 0;
let defsElement: SVGSVGElement | null = null;

function buildDefs(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('id', MAP_ID);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.cssText =
    'position:fixed;left:0;top:0;width:0;height:0;pointer-events:none;overflow:hidden;z-index:-1;';

  const defs = document.createElementNS(SVG_NS, 'defs');
  const filter = document.createElementNS(SVG_NS, 'filter');
  filter.setAttribute('id', FILTER_ID);
  filter.setAttribute('x', '-12%');
  filter.setAttribute('y', '-12%');
  filter.setAttribute('width', '124%');
  filter.setAttribute('height', '124%');
  filter.setAttribute('color-interpolation-filters', 'sRGB');

  const image = document.createElementNS(SVG_NS, 'feImage');
  image.setAttribute(
    'href',
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(REFRACTION_MAP_SVG)}`,
  );
  image.setAttribute('x', '0');
  image.setAttribute('y', '0');
  image.setAttribute('width', '100%');
  image.setAttribute('height', '100%');
  image.setAttribute('preserveAspectRatio', 'none');
  image.setAttribute('result', 'edgeMap');

  const soften = document.createElementNS(SVG_NS, 'feGaussianBlur');
  soften.setAttribute('in', 'edgeMap');
  soften.setAttribute('stdDeviation', '0.9');
  soften.setAttribute('result', 'edgeMapSoft');

  const displacement = document.createElementNS(SVG_NS, 'feDisplacementMap');
  displacement.setAttribute('in', 'SourceGraphic');
  displacement.setAttribute('in2', 'edgeMapSoft');
  displacement.setAttribute('scale', '14');
  displacement.setAttribute('xChannelSelector', 'R');
  displacement.setAttribute('yChannelSelector', 'G');

  filter.append(image, soften, displacement);
  defs.append(filter);
  svg.append(defs);
  return svg;
}

/**
 * Genuine backdrop refraction is currently Chromium-only. WebKit and Gecko
 * accept the `url()` token in `backdrop-filter` but do not render it, so we
 * gate the CSS attribute on an engine check instead of letting it fail loudly.
 */
export function supportsBackdropRefraction(): boolean {
  return false;
}

export function useLiquidGlassDefs(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;
    defsRefCount += 1;
    if (!defsElement) {
      const existing = document.getElementById(MAP_ID) as SVGSVGElement | null;
      if (existing) {
        defsElement = existing;
      } else {
        defsElement = buildDefs();
        document.body.append(defsElement);
      }
    }
    return () => {
      defsRefCount = Math.max(0, defsRefCount - 1);
      if (defsRefCount === 0 && defsElement) {
        defsElement.remove();
        defsElement = null;
      }
    };
  }, [enabled]);
}

/* ══════════════════════════════════════════════════════════════════════════
 * 2 · PHYSICS — pointer, press, scroll and gyroscope
 * ════════════════════════════════════════════════════════════════════════ */

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

type PermissionCapableOrientation = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

let gyroPermission: 'unknown' | 'pending' | 'granted' | 'denied' = 'unknown';

function readScrollTop(target: HTMLElement | Window): number {
  return target instanceof HTMLElement
    ? target.scrollTop
    : window.scrollY || document.documentElement.scrollTop;
}

export interface LiquidGlassPhysicsOptions {
  /** Master switch (reduced transparency / low power). */
  enabled?: boolean;
  /** Pointer parallax + gyroscope rotation of the surface itself. */
  tilt?: boolean;
  /** Press deformation and touch ripple. */
  press?: boolean;
  /** Listen to the gyroscope (coarse pointers only). */
  gyro?: boolean;
  /** Maximum tilt in degrees. */
  maxTilt?: number;
  /** Scroll host that drives `--lgx-motion`. Defaults to the window. */
  scrollRef?: RefObject<HTMLElement | null>;
  /** Attach the scroll listener (only surfaces that want dispersion need it). */
  scrollMotion?: boolean;
}

export function useLiquidGlassPhysics<T extends HTMLElement>(
  ref: RefObject<T | null>,
  options: LiquidGlassPhysicsOptions = {},
): void {
  const {
    enabled = true,
    tilt = true,
    press = true,
    gyro = false,
    maxTilt = 3.2,
    scrollRef,
    scrollMotion = false,
  } = options;

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled || typeof window === 'undefined') return;

    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    const cleanups: Array<() => void> = [];
    let pointerRaf = 0;
    let scrollTimer = 0;

    const writeGlint = (nx: number, ny: number) => {
      el.style.setProperty('--lgx-nx', nx.toFixed(3));
      el.style.setProperty('--lgx-ny', ny.toFixed(3));
      el.style.setProperty('--lgx-glint-x', `${(50 + nx * 34).toFixed(1)}%`);
      el.style.setProperty('--lgx-glint-y', `${(8 + ny * 22).toFixed(1)}%`);
      if (tilt && !reduceMotion) {
        el.style.setProperty('--lgx-tilt-x', `${(-ny * maxTilt).toFixed(2)}deg`);
        el.style.setProperty('--lgx-tilt-y', `${(nx * maxTilt).toFixed(2)}deg`);
      }
    };

    /* ── Pointer: glint follows the cursor / stylus ── */
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      if (pointerRaf) return;
      pointerRaf = requestAnimationFrame(() => {
        pointerRaf = 0;
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        const nx = clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
        const ny = clamp(((event.clientY - rect.top) / rect.height) * 2 - 1, -1, 1);
        writeGlint(nx, ny);
      });
    };

    /* ── Press: gel deformation + one physical ripple ── */
    const releasePress = () => {
      delete el.dataset.lgxPress;
      el.style.setProperty('--lgx-press', '0');
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!press) return;
      const rect = el.getBoundingClientRect();
      const x = clamp(event.clientX - rect.left, 0, rect.width);
      const y = clamp(event.clientY - rect.top, 0, rect.height);
      el.style.setProperty('--lgx-ripple-x', `${x.toFixed(1)}px`);
      el.style.setProperty('--lgx-ripple-y', `${y.toFixed(1)}px`);
      el.style.setProperty('--lgx-press', '1');
      el.dataset.lgxPress = 'true';

      const ripple = el.querySelector<HTMLElement>('.lgx__ripple');
      if (ripple && !reduceMotion) {
        ripple.getAnimations().forEach((animation) => animation.cancel());
        ripple.animate(
          [
            { transform: 'scale(0.18)', opacity: 0.5 },
            { transform: 'scale(1.9)', opacity: 0 },
          ],
          { duration: 620, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
        );
      }
    };

    if (finePointer) {
      el.addEventListener('pointermove', onPointerMove, { passive: true });
      cleanups.push(() => el.removeEventListener('pointermove', onPointerMove));
    }

    if (press) {
      el.addEventListener('pointerdown', onPointerDown, { passive: true });
      window.addEventListener('pointerup', releasePress, { passive: true });
      window.addEventListener('pointercancel', releasePress, { passive: true });
      cleanups.push(() => {
        el.removeEventListener('pointerdown', onPointerDown);
        window.removeEventListener('pointerup', releasePress);
        window.removeEventListener('pointercancel', releasePress);
      });
    }

    /* ── Scroll: motion drives dispersion, then settles back to zero ── */
    if (scrollMotion) {
      const scrollTarget: HTMLElement | Window = scrollRef?.current ?? window;
      let lastScrollTop = readScrollTop(scrollTarget);
      let lastScrollTime = performance.now();

      const onScroll = () => {
        const now = performance.now();
        const top = readScrollTop(scrollTarget);
        const dt = Math.max(8, now - lastScrollTime) / 1000;
        const velocity = clamp(Math.abs(top - lastScrollTop) / (1500 * dt), 0, 1);
        lastScrollTop = top;
        lastScrollTime = now;

        el.dataset.lgxScrolling = 'true';
        el.style.setProperty('--lgx-motion', velocity.toFixed(3));
        window.clearTimeout(scrollTimer);
        scrollTimer = window.setTimeout(() => {
          delete el.dataset.lgxScrolling;
          el.style.setProperty('--lgx-motion', '0');
        }, 180);
      };

      scrollTarget.addEventListener('scroll', onScroll, { passive: true });
      cleanups.push(() => {
        scrollTarget.removeEventListener('scroll', onScroll);
        window.clearTimeout(scrollTimer);
      });
    }

    /* ── Gyroscope: the device itself becomes the light source ── */
    if (gyro && !finePointer && !reduceMotion) {
      let baseline: { beta: number; gamma: number } | null = null;
      let attached = false;
      let cancelled = false;

      const onOrientation = (event: DeviceOrientationEvent) => {
        if (event.beta == null || event.gamma == null) return;
        if (!baseline) baseline = { beta: event.beta, gamma: event.gamma };
        const nx = clamp((event.gamma - baseline.gamma) / 26, -1, 1);
        const ny = clamp((event.beta - baseline.beta) / 26, -1, 1);
        writeGlint(nx, ny);
      };

      const attach = () => {
        if (attached || cancelled) return;
        window.addEventListener('deviceorientation', onOrientation, true);
        attached = true;
      };

      const onOrientationChange = () => {
        baseline = null;
      };
      window.addEventListener('orientationchange', onOrientationChange);

      const requestGyro = () => {
        const ctor = (
          window as unknown as { DeviceOrientationEvent?: PermissionCapableOrientation }
        ).DeviceOrientationEvent;
        if (!ctor) return;
        if (gyroPermission === 'granted') {
          attach();
          return;
        }
        if (gyroPermission === 'denied' || gyroPermission === 'pending') return;

        if (typeof ctor.requestPermission === 'function') {
          gyroPermission = 'pending';
          ctor
            .requestPermission()
            .then((result) => {
              gyroPermission = result === 'granted' ? 'granted' : 'denied';
              if (gyroPermission === 'granted') attach();
            })
            .catch(() => {
              gyroPermission = 'denied';
            });
        } else {
          gyroPermission = 'granted';
          attach();
        }
      };

      if (gyroPermission === 'granted') attach();
      else document.addEventListener('pointerdown', requestGyro, { once: true, passive: true });

      cleanups.push(() => {
        cancelled = true;
        document.removeEventListener('pointerdown', requestGyro);
        window.removeEventListener('orientationchange', onOrientationChange);
        if (attached) window.removeEventListener('deviceorientation', onOrientation, true);
      });
    }

    return () => {
      if (pointerRaf) cancelAnimationFrame(pointerRaf);
      for (const cleanup of cleanups) cleanup();
    };
  }, [ref, enabled, tilt, press, gyro, maxTilt, scrollRef, scrollMotion]);
}

/* ══════════════════════════════════════════════════════════════════════════
 * 3 · ADAPTIVE TINT — read the backdrop, derive glass colour + contrast
 * ════════════════════════════════════════════════════════════════════════ */

type Rgb = [number, number, number];

/** Fast pure-string CSS colour parser without canvas getImageData GPU stalls. */
function toRgb(input: string): Rgb | null {
  const value = input.trim();
  if (!value || value === 'transparent' || value === 'none') return null;

  const match = value.match(
    /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)/i,
  );
  if (match) {
    if (match[4] !== undefined) {
      const alpha = match[4].endsWith('%')
        ? Number.parseFloat(match[4]) / 100
        : Number.parseFloat(match[4]);
      if (alpha < 0.12) return null;
    }
    return [Number(match[1]), Number(match[2]), Number(match[3])];
  }

  if (value.startsWith('#')) {
    let hex = value.slice(1);
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    if (hex.length === 6) {
      const n = parseInt(hex, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
  }

  return null;
}

function relativeLuminance([r, g, b]: Rgb): number {
  const channel = (value: number) => {
    const v = value / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * Fast, non-blocking backdrop color derivation.
 * Walks upward to find the container/body background without triggering
 * layout-thrashing `elementsFromPoint` or synchronous canvas `getImageData` GPU stalls.
 */
function readBackdropColour(el: HTMLElement): Rgb | null {
  try {
    let parent: HTMLElement | null = el.parentElement;
    while (parent && parent !== document.documentElement) {
      const bg = window.getComputedStyle(parent).backgroundColor;
      const parsed = toRgb(bg);
      if (parsed) return parsed;
      parent = parent.parentElement;
    }
    const bodyBg = window.getComputedStyle(document.body).backgroundColor;
    return toRgb(bodyBg) || [255, 255, 255];
  } catch {
    return [255, 255, 255];
  }
}

export interface AdaptiveGlassTintOptions {
  enabled?: boolean;
  /** Ink triplet used by controls that sit directly on the glass. */
  ink?: boolean;
}

/* One scroll / resize / theme listener and one timer for every glass surface. */
const tintSubscribers = new Set<() => void>();
let tintTimer = 0;
let tintObserver: MutationObserver | null = null;
let tintGlobalsAttached = false;
let scrollEndTimer = 0;

function scheduleTintSample(): void {
  if (tintTimer || typeof window === 'undefined') return;
  tintTimer = window.setTimeout(() => {
    tintTimer = 0;
    for (const sample of tintSubscribers) sample();
  }, 250);
}

function handleGlobalScroll(): void {
  if (typeof document === 'undefined') return;
  if (!document.body.classList.contains('is-scrolling')) {
    document.body.classList.add('is-scrolling');
  }
  window.clearTimeout(scrollEndTimer);
  scrollEndTimer = window.setTimeout(() => {
    document.body.classList.remove('is-scrolling');
    // Only re-sample tints once the user has completely stopped scrolling
    scheduleTintSample();
  }, 150);
}

function onTintVisibility(): void {
  if (!document.hidden) scheduleTintSample();
}

function attachTintGlobals(): void {
  if (tintGlobalsAttached || typeof window === 'undefined') return;
  tintGlobalsAttached = true;
  // Use scroll handler only to toggle .is-scrolling flag and debounce tint calculation until scroll stops!
  window.addEventListener('scroll', handleGlobalScroll, { passive: true, capture: true });
  window.addEventListener('resize', scheduleTintSample, { passive: true });
  document.addEventListener('visibilitychange', onTintVisibility);
  if (typeof MutationObserver !== 'undefined') {
    tintObserver = new MutationObserver(scheduleTintSample);
    tintObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme', 'style'],
    });
  }
}

function detachTintGlobals(): void {
  if (!tintGlobalsAttached) return;
  tintGlobalsAttached = false;
  window.removeEventListener('scroll', handleGlobalScroll, true);
  window.removeEventListener('resize', scheduleTintSample);
  document.removeEventListener('visibilitychange', onTintVisibility);
  tintObserver?.disconnect();
  tintObserver = null;
  if (tintTimer) {
    window.clearTimeout(tintTimer);
    tintTimer = 0;
  }
  if (scrollEndTimer) {
    window.clearTimeout(scrollEndTimer);
    scrollEndTimer = 0;
  }
}

export function useAdaptiveGlassTint<T extends HTMLElement>(
  ref: RefObject<T | null>,
  options: AdaptiveGlassTintOptions = {},
): void {
  const { enabled = true, ink = true } = options;

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled || typeof window === 'undefined') return;

    const sample = () => {
      if (!el.isConnected) return;
      if (typeof document !== 'undefined' && document.body.classList.contains('is-scrolling')) return;
      const bounds = el.getBoundingClientRect();
      if (bounds.bottom < 0 || bounds.top > window.innerHeight) return;

      const colour = readBackdropColour(el);
      if (!colour) return;

      const [r, g, b] = colour;
      const luminance = relativeLuminance(colour);

      // The scrim is neutral white with only 6% of the backdrop hue. Colour
      // must come from what is behind the glass, never from a decorative
      // blue/purple wash. Dark grounds get more alpha, which is what lifts a
      // black desktop to a visible panel instead of swallowing it.
      const neutral = (channel: number) => Math.round(255 * 0.94 + channel * 0.06);
      el.style.setProperty(
        '--lgx-tint',
        `${neutral(r)} ${neutral(g)} ${neutral(b)}`,
      );
      el.style.setProperty('--lgx-tint-a', (0.1 + (1 - luminance) * 0.13).toFixed(3));
      el.style.setProperty('--lgx-bright', (0.99 + (1 - luminance) * 0.05).toFixed(3));
      el.style.setProperty('--lgx-contrast', '1.04');
      el.style.setProperty('--lgx-lum', luminance.toFixed(3));

      if (ink) {
        el.style.setProperty(
          '--lgx-ink',
          luminance > 0.45 ? '16 18 22' : '255 255 255',
        );
      }
      el.dataset.lgxScheme = luminance > 0.45 ? 'light' : 'dark';
    };

    tintSubscribers.add(sample);
    if (tintSubscribers.size === 1) attachTintGlobals();
    scheduleTintSample();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(scheduleTintSample);
      resizeObserver.observe(el);
    }

    return () => {
      tintSubscribers.delete(sample);
      resizeObserver?.disconnect();
      if (tintSubscribers.size === 0) detachTintGlobals();
    };
  }, [ref, enabled, ink]);
}
