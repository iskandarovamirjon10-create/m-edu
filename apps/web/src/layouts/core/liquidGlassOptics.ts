/**
 * Liquid Glass optics — real refraction, not a frosted blur.
 *
 * HOW REAL LIQUID GLASS DIFFERS FROM GLASSMORPHISM:
 *  · Glassmorphism = `backdrop-filter: blur(20px)` → uniform fog over everything
 *  · Liquid Glass  = `feDisplacementMap` → background pixels physically SHIFT
 *    at the curved edge, zero shift at the flat centre.
 *    You see the background BENT through the glass, like water or thick crystal.
 *
 * Physics:
 *  A glass slab has a convex squircle bezel. A viewing ray enters that curved
 *  surface, bends by Snell's law (n = 1.5168, BK7 crown glass), travels through
 *  the slab and lands on the background plane with a lateral shift. That shift
 *  is ZERO in the flat centre and PEAKS at the rim — this is what makes the
 *  material look like a lens, not frosted glass.
 *
 *  The vector field is rasterised to a PNG at the element's real CSS size and
 *  fed to `<feDisplacementMap>` through `backdrop-filter`. Chromium renders it;
 *  WebKit/Gecko ignore the `url()` token and keep the minimal-blur fallback.
 *
 * Key tuning:
 *  · GLASS_IOR = 1.5168 (BK7 crown glass, same as Apple spec)
 *  · SCALE_MULTIPLIER controls how many CSS-px the edge is displaced.
 *    Default: 3.4 — clearly visible bending at the rim without distorting text.
 *  · blur in backdrop-filter is kept at 2–4 px so the displacement effect
 *    dominates; a heavy blur would hide the refraction completely.
 *
 * References:
 *  · WWDC25 219 "Meet Liquid Glass"
 *  · sohumsuthar/liquid-glass PHYSICS.md (squircle profile, Snell trace)
 *  · LeonardSEO/liquid-glass-react (per-element map, constant bezel width)
 */
import { useEffect, type RefObject } from 'react';

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';
const HOST_ID = 'lgx-lens-defs';
const GLASS_IOR = 1.5168;      // BK7 crown glass (Apple spec)
const PROFILE_STEPS = 257;
const MAX_MAP_EDGE = 768;
const MAX_MAP_PIXELS = 520_000;

/**
 * SCALE_MULTIPLIER: how many CSS-px the edge pixels are displaced per unit
 * of bezel. Raised from 2.008 → 3.6 so the bending is immediately visible.
 * Glassmorphism has zero displacement; real glass should show obvious bending
 * at the rim. Keep < 5 to avoid artefacts on small elements.
 */
const SCALE_MULTIPLIER = 3.6;

function clampTo(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Refraction lens switch:
 * Yoqilgan — Mobile Dock va Drawer kabi markaziy elementlarda haqiqiy
 * optik refraktsiya (Snell burchagi va feDisplacementMap) hosil qilish uchun.
 */
export function supportsBackdropRefraction(): boolean {
  if (typeof navigator === 'undefined') return false;
  return true;
}

/* ══════════════════════════════════════════════════════════════════════════
 * 1 · BEZEL OPTICS
 * ════════════════════════════════════════════════════════════════════════ */

/**
 * Squircle height profile f(x) = (1 − (1−x)^4)^(1/4), x = 0 at the outer rim
 * and x = 1 at the flat interior. For each x the ray is traced through the
 * slab and the lateral shift is stored in a LUT, normalised so the rim is 1.0.
 * `peak` is the physical shift in bezel units.
 */
const bezelOptics = (() => {
  const lut = new Float32Array(PROFILE_STEPS);
  let peak = 0;

  for (let index = 0; index < PROFILE_STEPS; index += 1) {
    const x = index / (PROFILE_STEPS - 1);
    const u = 1 - x;
    const inner = 1 - u ** 4;
    const height = inner ** 0.25;
    const slope = inner <= 0 ? 0 : (u ** 3) * inner ** -0.75;

    const surfaceAngle = Math.atan(slope);
    const refractedAngle = Math.asin(
      Math.min(1, Math.sin(surfaceAngle) / GLASS_IOR),
    );
    const thickness = 0.45 + height;
    const shift = thickness * Math.tan(surfaceAngle - refractedAngle);

    lut[index] = shift;
    if (shift > peak) peak = shift;
  }

  if (peak > 0) {
    for (let index = 0; index < PROFILE_STEPS; index += 1) {
      lut[index] /= peak;
    }
  }

  return { lut, peak: peak || 0.45 };
})();

/** Exact signed distance to a rounded rectangle (negative inside). */
function roundedRectSdf(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): number {
  const qx = Math.abs(x - width / 2) - (width / 2 - radius);
  const qy = Math.abs(y - height / 2) - (height / 2 - radius);
  return (
    Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) +
    Math.min(Math.max(qx, qy), 0) -
    radius
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * 2 · DISPLACEMENT MAP
 * ════════════════════════════════════════════════════════════════════════ */

function createLensMap(
  width: number,
  height: number,
  radius: number,
  bezel: number,
): string | null {
  if (typeof document === 'undefined' || width <= 0 || height <= 0) return null;

  const dpr =
    typeof window === 'undefined' ? 1 : Math.min(2, window.devicePixelRatio || 1);
  const resolution = Math.max(
    0.5,
    Math.min(
      dpr,
      MAX_MAP_EDGE / Math.max(width, height),
      Math.sqrt(MAX_MAP_PIXELS / (width * height)),
    ),
  );

  const mapWidth = Math.max(16, Math.round(width * resolution));
  const mapHeight = Math.max(16, Math.round(height * resolution));
  const mapScale = Math.min(mapWidth / width, mapHeight / height);
  const mapRadius = Math.max(
    0,
    Math.min(radius * mapScale, Math.min(mapWidth, mapHeight) / 2),
  );
  const mapBezel = Math.max(1.5, bezel * mapScale);

  const canvas = document.createElement('canvas');
  canvas.width = mapWidth;
  canvas.height = mapHeight;
  const context = canvas.getContext('2d');
  if (!context) return null;

  const image = context.createImageData(mapWidth, mapHeight);
  const data = image.data;
  const epsilon = Math.max(0.6, mapScale * 0.75);

  for (let y = 0; y < mapHeight; y += 1) {
    for (let x = 0; x < mapWidth; x += 1) {
      const index = (y * mapWidth + x) * 4;
      const px = x + 0.5;
      const py = y + 0.5;
      const insideDistance = -roundedRectSdf(
        px,
        py,
        mapWidth,
        mapHeight,
        mapRadius,
      );

      if (insideDistance <= 0) {
        data[index] = 128;
        data[index + 1] = 128;
        data[index + 2] = 128;
        data[index + 3] = 255;
        continue;
      }

      // 0 at the rim → 1 at the inner edge of the bezel.
      const t = clampTo(insideDistance / mapBezel, 0, 1);
      const magnitude = bezelOptics.lut[Math.round(t * (PROFILE_STEPS - 1))];

      // Gradient of the SDF points outward; the lens samples inward.
      const gx =
        roundedRectSdf(px + epsilon, py, mapWidth, mapHeight, mapRadius) -
        roundedRectSdf(px - epsilon, py, mapWidth, mapHeight, mapRadius);
      const gy =
        roundedRectSdf(px, py + epsilon, mapWidth, mapHeight, mapRadius) -
        roundedRectSdf(px, py - epsilon, mapWidth, mapHeight, mapRadius);
      const length = Math.hypot(gx, gy) || 1;

      data[index] = Math.round(128 - (gx / length) * magnitude * 127);
      data[index + 1] = Math.round(128 - (gy / length) * magnitude * 127);
      data[index + 2] = 128;
      data[index + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);

  try {
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
 * 3 · SVG FILTER (shared per identical geometry)
 * ════════════════════════════════════════════════════════════════════════ */

interface LensAsset {
  id: string;
  key: string;
  refs: number;
  filter: SVGFilterElement;
}

const lensAssets = new Map<string, LensAsset>();
let lensHost: SVGSVGElement | null = null;
let lensDefs: SVGDefsElement | null = null;
let lensSequence = 0;

function ensureLensDefs(): SVGDefsElement {
  if (lensDefs && lensDefs.isConnected) return lensDefs;

  let host = document.getElementById(HOST_ID) as SVGSVGElement | null;
  if (!host) {
    host = document.createElementNS(SVG_NS, 'svg');
    host.setAttribute('id', HOST_ID);
    host.setAttribute('aria-hidden', 'true');
    host.setAttribute('width', '0');
    host.setAttribute('height', '0');
    host.style.cssText =
      'position:fixed;left:0;top:0;width:0;height:0;pointer-events:none;overflow:hidden;z-index:-1;';
    document.body.append(host);
  }

  lensHost = host;
  let defs = host.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS(SVG_NS, 'defs');
    host.append(defs);
  }
  lensDefs = defs as SVGDefsElement;
  return lensDefs;
}

function makePrimitive<K extends keyof SVGElementTagNameMap>(
  name: K,
  attributes: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, name) as SVGElementTagNameMap[K];
  for (const [key, value] of Object.entries(attributes)) {
    node.setAttribute(key, String(value));
  }
  return node;
}

function buildLensFilter(
  id: string,
  width: number,
  height: number,
  dataUrl: string,
  scale: number,
  dispersion: number,
): SVGFilterElement {
  const filter = makePrimitive('filter', {
    id,
    filterUnits: 'userSpaceOnUse',
    x: 0,
    y: 0,
    width,
    height,
    'color-interpolation-filters': 'sRGB',
  });

  const map = makePrimitive('feImage', {
    href: dataUrl,
    x: 0,
    y: 0,
    width,
    height,
    preserveAspectRatio: 'none',
    result: 'lensMap',
  });
  map.setAttributeNS(XLINK_NS, 'xlink:href', dataUrl);
  filter.append(map);

  if (dispersion > 0.4) {
    // Physically exact BK7 fringing is ~1%, invisible at UI scale. Exaggerate
    // it slightly: real channel separation only exists where displacement is
    // non-zero, so the clear centre stays perfectly clean.
    const spread = clampTo(dispersion / 100, 0.002, 0.085);
    const channels = [
      {
        name: 'r',
        scale: scale * (1 - spread),
        matrix: '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0',
      },
      {
        name: 'g',
        scale,
        matrix: '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0',
      },
      {
        name: 'b',
        scale: scale * (1 + spread),
        matrix: '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0',
      },
    ] as const;

    let previous = '';
    channels.forEach((channel, index) => {
      const displacement = makePrimitive('feDisplacementMap', {
        in: 'SourceGraphic',
        in2: 'lensMap',
        scale: channel.scale,
        xChannelSelector: 'R',
        yChannelSelector: 'G',
        result: `displaced-${channel.name}`,
      });

      const isolate = makePrimitive('feColorMatrix', {
        in: `displaced-${channel.name}`,
        type: 'matrix',
        values: channel.matrix,
        result: `channel-${channel.name}`,
      });

      filter.append(displacement, isolate);

      if (index === 0) {
        previous = `channel-${channel.name}`;
        return;
      }

      const blend = makePrimitive('feBlend', {
        in: previous,
        in2: `channel-${channel.name}`,
        mode: 'screen',
        result: index === channels.length - 1 ? 'lensDispersed' : `mix-${index}`,
      });
      filter.append(blend);
      previous = blend.getAttribute('result') ?? previous;
    });

    return filter;
  }

  const displacement = makePrimitive('feDisplacementMap', {
    in: 'SourceGraphic',
    in2: 'lensMap',
    scale,
    xChannelSelector: 'R',
    yChannelSelector: 'G',
  });
  filter.append(displacement);
  return filter;
}

function acquireLensAsset(
  key: string,
  params: {
    width: number;
    height: number;
    radius: number;
    bezel: number;
    refraction: number;
    dispersion: number;
  },
): LensAsset | null {
  const existing = lensAssets.get(key);
  if (existing) {
    existing.refs += 1;
    return existing;
  }

  const dataUrl = createLensMap(
    params.width,
    params.height,
    params.radius,
    params.bezel,
  );
  if (!dataUrl) return null;

  const id = `lgx-lens-${(lensSequence += 1)}`;
  // SCALE_MULTIPLIER × peak converts the normalised 0..255 channel back to
  // CSS pixels. Raised from 2.008 → 3.6 so edge bending is clearly visible.
  const scale = SCALE_MULTIPLIER * bezelOptics.peak * params.bezel * params.refraction;
  const filter = buildLensFilter(
    id,
    params.width,
    params.height,
    dataUrl,
    scale,
    params.dispersion,
  );
  ensureLensDefs().append(filter);

  const asset: LensAsset = { id, key, refs: 1, filter };
  lensAssets.set(key, asset);
  return asset;
}

function releaseLensAsset(key: string): void {
  const asset = lensAssets.get(key);
  if (!asset) return;
  asset.refs -= 1;
  if (asset.refs > 0) return;

  asset.filter.remove();
  lensAssets.delete(key);

  if (lensAssets.size === 0 && lensHost) {
    lensHost.remove();
    lensHost = null;
    lensDefs = null;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
 * 4 · HOOK
 * ════════════════════════════════════════════════════════════════════════ */

export interface LiquidGlassLensOptions {
  enabled?: boolean;
  /** Force a radius in px (otherwise the computed border-radius is used). */
  radius?: number;
  /** Bezel thickness in px. Constant width, like the real material. */
  bezel?: number;
  /** Refraction multiplier. 1 = physically calibrated. */
  refraction?: number;
  /** Chromatic dispersion exaggeration, 0..20. Use on 1–3 hero surfaces. */
  dispersion?: number;
}

function readRadius(el: HTMLElement, width: number, height: number): number {
  try {
    const raw = window.getComputedStyle(el).borderTopLeftRadius || '0px';
    const value = Number.parseFloat(raw);
    if (!Number.isFinite(value)) return Math.min(width, height) / 2;
    if (raw.trim().endsWith('%')) return (Math.min(width, height) * value) / 100;
    return value;
  } catch {
    return Math.min(width, height) / 2;
  }
}

/**
 * Builds (and keeps in sync with the element's size) a per-element lens filter
 * and exposes it as `--lgx-refract-filter`. The hook writes only CSS custom
 * properties and data attributes; there is no per-frame work.
 */
export function useLiquidGlassLens<T extends HTMLElement>(
  ref: RefObject<T | null>,
  options: LiquidGlassLensOptions = {},
): void {
  const {
    enabled = true,
    radius,
    bezel,
    refraction = 1,
    dispersion = 0,
  } = options;

  useEffect(() => {
    const el = ref.current;
    if (
      !el ||
      !enabled ||
      typeof window === 'undefined' ||
      typeof document === 'undefined'
    ) {
      return;
    }
    if (!supportsBackdropRefraction()) return;

    let frame = 0;
    let currentKey: string | null = null;
    let currentFilter: string | null = null;

    const apply = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);
      if (width < 24 || height < 24) return;

      const cssRadius = radius ?? readRadius(el, width, height);
      const resolvedRadius = clampTo(cssRadius, 0, Math.min(width, height) / 2);
      const resolvedBezel = clampTo(
        bezel ?? Math.max(10, Math.min(resolvedRadius * 0.6, 24)),
        4,
        Math.min(width, height) / 2,
      );
      const resolvedRefraction = clampTo(refraction, 0.2, 3);
      const resolvedDispersion = clampTo(dispersion, 0, 20);

      const key = [
        width,
        height,
        Math.round(resolvedRadius),
        Math.round(resolvedBezel),
        resolvedRefraction.toFixed(2),
        resolvedDispersion.toFixed(1),
      ].join('|');

      if (key === currentKey) return;

      const asset = acquireLensAsset(key, {
        width,
        height,
        radius: resolvedRadius,
        bezel: resolvedBezel,
        refraction: resolvedRefraction,
        dispersion: resolvedDispersion,
      });
      if (!asset) return;

      if (currentKey) releaseLensAsset(currentKey);
      currentKey = key;
      currentFilter = asset.id;

      el.style.setProperty('--lgx-refract-filter', `url(#${asset.id})`);
      el.dataset.lgxLens = 'true';
    };

    const schedule = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(apply);
    };

    apply();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(schedule);
      resizeObserver.observe(el);
    }
    window.addEventListener('resize', schedule, { passive: true });

    return () => {
      if (frame) cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', schedule);
      if (currentKey) releaseLensAsset(currentKey);
      if (currentFilter) el.style.removeProperty('--lgx-refract-filter');
      delete el.dataset.lgxLens;
    };
  }, [ref, enabled, radius, bezel, refraction, dispersion]);
}
