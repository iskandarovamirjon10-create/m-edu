'use client';

/**
 * ============================================================================
 * M-EDU Dynamic Wallpaper & Shader Substrate — macOS Sequoia Edition
 * ============================================================================
 *
 * Premium ambient-light wallpaper substrate inspired by macOS Sequoia.
 *
 * ✨ Features
 *   • 4 curated palettes with full light / dark support:
 *       1. Sequoia Dawn  — warm amber, rose & obsidian indigo
 *       2. Sonoma Sky    — Pacific azure, turquoise & vapor blue
 *       3. Ventura Gold  — California golden-hour radiance
 *       4. Obsidian      — OLED graphite with subtle specular mesh
 *   • Synchronized with app theme (`isDark` from `useTheme`)
 *   • Pointer parallax with rAF-lerped easing (disabled on coarse pointers
 *     and `prefers-reduced-motion`)
 *   • Ambient "breathing" pulsation on the light blobs
 *   • Ultra-fine procedural grain overlay (SVG feTurbulence)
 *   • Cross-tab synchronization via `useSyncExternalStore`
 *   • SSR-safe (stable server snapshot, no hydration mismatch)
 *   • Storage-safe (defensive try/catch around `localStorage`)
 *   • Smooth color transitions via CSS `@property` registered custom props
 *   • GPU-accelerated: single compositor layer per blob, `contain: strict`,
 *     `will-change: transform` and `backface-visibility: hidden`
 *
 * 🎛  Public API
 *   DynamicWallpaper            — the drop-in React component
 *   WALLPAPER_THEMES            — palette metadata (for theme pickers)
 *   WALLPAPER_THEME_LIST        — ordered theme IDs
 *   WALLPAPER_STORAGE_KEY       — localStorage key
 *   WALLPAPER_CHANGE_EVENT      — CustomEvent name
 *   setWallpaperTheme(theme)    — imperative setter
 *   getWallpaperTheme()         — imperative getter
 *   useWallpaperTheme()         — reactive `[theme, setTheme]` hook
 *   WallpaperTheme              — union type of theme IDs
 * ============================================================================
 */

import {
  memo,
  useInsertionEffect,
  useRef,
  useSyncExternalStore,
  type CSSProperties,
  type RefObject,
} from 'react';
import { useTheme } from '@/hooks/useTheme';

/* ═══════════════════════════════════════════════════════════════════════
 * 1. Public constants
 * ═══════════════════════════════════════════════════════════════════════ */

export const WALLPAPER_STORAGE_KEY = 'm-edu.wallpaper-theme' as const;
export const WALLPAPER_CHANGE_EVENT = 'm-edu-wallpaper-changed' as const;
const WALLPAPER_STYLE_ID = 'm-edu-wallpaper-styles';

/* ═══════════════════════════════════════════════════════════════════════
 * 2. Types
 * ═══════════════════════════════════════════════════════════════════════ */

interface PaletteVariant {
  readonly bgFrom: string;
  readonly bgVia: string;
  readonly bgTo: string;
  readonly blob1: string;
  readonly blob2: string;
  readonly blob3: string;
  readonly glow: string;
}

interface WallpaperPalette {
  readonly name: string;
  readonly description: string;
  readonly light: PaletteVariant;
  readonly dark: PaletteVariant;
}

/* ═══════════════════════════════════════════════════════════════════════
 * 3. Palette catalogue
 * ═══════════════════════════════════════════════════════════════════════ */

export const WALLPAPER_THEMES = {
  sequoia: {
    name: 'Sequoia Dawn',
    description: 'Warm amber, rose & obsidian indigo',
    light: {
      bgFrom: 'rgba(254, 243, 199, 0.35)',
      bgVia: 'rgba(255, 228, 230, 0.25)',
      bgTo: 'rgba(224, 242, 254, 0.20)',
      blob1: 'rgba(245, 158, 11, 0.22)',
      blob2: 'rgba(244, 63, 94, 0.14)',
      blob3: 'rgba(129, 140, 248, 0.16)',
      glow: 'rgba(251, 191, 36, 0.28)',
    },
    dark: {
      bgFrom: 'rgba(69, 26, 3, 0.55)',
      bgVia: 'rgba(15, 23, 42, 0.85)',
      bgTo: 'rgba(2, 6, 23, 0.95)',
      blob1: 'rgba(251, 191, 36, 0.28)',
      blob2: 'rgba(244, 63, 94, 0.22)',
      blob3: 'rgba(129, 140, 248, 0.24)',
      glow: 'rgba(251, 191, 36, 0.20)',
    },
  },
  sonoma: {
    name: 'Sonoma Sky',
    description: 'Pacific azure, turquoise & vapor blue',
    light: {
      bgFrom: 'rgba(207, 250, 254, 0.35)',
      bgVia: 'rgba(224, 242, 254, 0.28)',
      bgTo: 'rgba(238, 242, 255, 0.30)',
      blob1: 'rgba(6, 182, 212, 0.18)',
      blob2: 'rgba(56, 189, 248, 0.16)',
      blob3: 'rgba(99, 102, 241, 0.14)',
      glow: 'rgba(56, 189, 248, 0.22)',
    },
    dark: {
      bgFrom: 'rgba(8, 47, 73, 0.75)',
      bgVia: 'rgba(30, 58, 138, 0.65)',
      bgTo: 'rgba(2, 6, 23, 0.95)',
      blob1: 'rgba(34, 211, 238, 0.32)',
      blob2: 'rgba(56, 189, 248, 0.26)',
      blob3: 'rgba(99, 102, 241, 0.28)',
      glow: 'rgba(34, 211, 238, 0.18)',
    },
  },
  ventura: {
    name: 'Ventura Gold',
    description: 'Warm California golden-hour radiance',
    light: {
      bgFrom: 'rgba(254, 215, 170, 0.35)',
      bgVia: 'rgba(253, 230, 138, 0.28)',
      bgTo: 'rgba(255, 237, 213, 0.30)',
      blob1: 'rgba(251, 146, 60, 0.22)',
      blob2: 'rgba(245, 158, 11, 0.18)',
      blob3: 'rgba(234, 88, 12, 0.16)',
      glow: 'rgba(251, 146, 60, 0.26)',
    },
    dark: {
      bgFrom: 'rgba(67, 20, 7, 0.70)',
      bgVia: 'rgba(69, 26, 3, 0.60)',
      bgTo: 'rgba(2, 6, 23, 0.95)',
      blob1: 'rgba(251, 146, 60, 0.32)',
      blob2: 'rgba(245, 158, 11, 0.28)',
      blob3: 'rgba(234, 88, 12, 0.24)',
      glow: 'rgba(251, 146, 60, 0.20)',
    },
  },
  aurora: {
    name: 'Northern Solstice',
    description: 'Arctic cyan, aurora emerald & cosmic indigo',
    light: {
      bgFrom: 'rgba(204, 251, 241, 0.40)',
      bgVia: 'rgba(207, 250, 254, 0.32)',
      bgTo: 'rgba(224, 231, 255, 0.28)',
      blob1: 'rgba(16, 185, 129, 0.22)',
      blob2: 'rgba(6, 182, 212, 0.20)',
      blob3: 'rgba(99, 102, 241, 0.16)',
      glow: 'rgba(52, 211, 153, 0.28)',
    },
    dark: {
      bgFrom: 'rgba(6, 78, 59, 0.70)',
      bgVia: 'rgba(8, 47, 73, 0.75)',
      bgTo: 'rgba(2, 6, 23, 0.95)',
      blob1: 'rgba(52, 211, 153, 0.30)',
      blob2: 'rgba(34, 211, 238, 0.26)',
      blob3: 'rgba(129, 140, 248, 0.24)',
      glow: 'rgba(52, 211, 153, 0.22)',
    },
  },
  sunset: {
    name: 'Yosemite Twilight',
    description: 'Sunset magenta, alpine lavender & starry sapphire',
    light: {
      bgFrom: 'rgba(253, 230, 138, 0.35)',
      bgVia: 'rgba(252, 231, 243, 0.32)',
      bgTo: 'rgba(224, 231, 255, 0.30)',
      blob1: 'rgba(236, 72, 153, 0.20)',
      blob2: 'rgba(168, 85, 247, 0.18)',
      blob3: 'rgba(59, 130, 246, 0.16)',
      glow: 'rgba(244, 114, 182, 0.26)',
    },
    dark: {
      bgFrom: 'rgba(88, 28, 135, 0.70)',
      bgVia: 'rgba(30, 27, 75, 0.85)',
      bgTo: 'rgba(2, 6, 23, 0.95)',
      blob1: 'rgba(236, 72, 153, 0.28)',
      blob2: 'rgba(168, 85, 247, 0.26)',
      blob3: 'rgba(96, 165, 250, 0.24)',
      glow: 'rgba(216, 180, 254, 0.22)',
    },
  },
  obsidian: {
    name: 'Obsidian Studio',
    description: 'OLED graphite with subtle specular mesh',
    light: {
      bgFrom: 'rgba(244, 244, 245, 0.50)',
      bgVia: 'rgba(250, 250, 250, 0.60)',
      bgTo: 'rgba(255, 255, 255, 0.70)',
      blob1: 'rgba(0, 0, 0, 0.04)',
      blob2: 'rgba(139, 92, 246, 0.08)',
      blob3: 'rgba(168, 85, 247, 0.06)',
      glow: 'rgba(99, 102, 241, 0.10)',
    },
    dark: {
      bgFrom: 'rgba(0, 0, 0, 0.95)',
      bgVia: 'rgba(9, 9, 11, 0.95)',
      bgTo: 'rgba(0, 0, 0, 1.00)',
      blob1: 'rgba(255, 255, 255, 0.06)',
      blob2: 'rgba(139, 92, 246, 0.12)',
      blob3: 'rgba(168, 85, 247, 0.10)',
      glow: 'rgba(139, 92, 246, 0.14)',
    },
  },
} as const satisfies Record<string, WallpaperPalette>;

export type WallpaperTheme = keyof typeof WALLPAPER_THEMES;

export const WALLPAPER_THEME_LIST = Object.keys(WALLPAPER_THEMES) as WallpaperTheme[];

const DEFAULT_THEME: WallpaperTheme = 'sequoia';

function isWallpaperTheme(value: unknown): value is WallpaperTheme {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(WALLPAPER_THEMES, value);
}

/* ═══════════════════════════════════════════════════════════════════════
 * 4. Store (read / subscribe / write) — SSR + cross-tab safe
 * ═══════════════════════════════════════════════════════════════════════ */

function readWallpaperTheme(): WallpaperTheme {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const stored = window.localStorage.getItem(WALLPAPER_STORAGE_KEY);
    return isWallpaperTheme(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function subscribeWallpaperTheme(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handleStorage = (event: StorageEvent) => {
    if (event.key === WALLPAPER_STORAGE_KEY || event.key === null) onChange();
  };
  const handleCustom = () => onChange();
  window.addEventListener('storage', handleStorage);
  window.addEventListener(WALLPAPER_CHANGE_EVENT, handleCustom);
  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(WALLPAPER_CHANGE_EVENT, handleCustom);
  };
}

const getServerSnapshot = (): WallpaperTheme => DEFAULT_THEME;

export function getWallpaperTheme(): WallpaperTheme {
  return readWallpaperTheme();
}

export function setWallpaperTheme(theme: WallpaperTheme): void {
  if (typeof window === 'undefined' || !isWallpaperTheme(theme)) return;
  try {
    window.localStorage.setItem(WALLPAPER_STORAGE_KEY, theme);
  } catch {
    /* storage unavailable — event still notifies the current tab */
  }
  window.dispatchEvent(
    new CustomEvent<WallpaperTheme>(WALLPAPER_CHANGE_EVENT, { detail: theme }),
  );
}

export function useWallpaperTheme(): readonly [
  WallpaperTheme,
  (theme: WallpaperTheme) => void,
] {
  const theme = useSyncExternalStore(
    subscribeWallpaperTheme,
    readWallpaperTheme,
    getServerSnapshot,
  );
  return [theme, setWallpaperTheme] as const;
}

/* ═══════════════════════════════════════════════════════════════════════
 * 5. Pointer parallax (rAF-lerped, disabled for reduced-motion / coarse)
 * ═══════════════════════════════════════════════════════════════════════ */

function usePointerParallax(_ref: RefObject<HTMLElement | null>): void {
  // Parallax disabled: keeps GPU composited layers stable at 120 FPS without backdrop-filter recompositing
}

/* ═══════════════════════════════════════════════════════════════════════
 * 6. Injected stylesheet (keyframes + @property registrations)
 * ═══════════════════════════════════════════════════════════════════════ */

const WALLPAPER_CSS = `
@property --m-edu-bg-from { syntax: '<color>'; inherits: true; initial-value: transparent; }
@property --m-edu-bg-via  { syntax: '<color>'; inherits: true; initial-value: transparent; }
@property --m-edu-bg-to   { syntax: '<color>'; inherits: true; initial-value: transparent; }
@property --m-edu-b1      { syntax: '<color>'; inherits: true; initial-value: transparent; }
@property --m-edu-b2      { syntax: '<color>'; inherits: true; initial-value: transparent; }
@property --m-edu-b3      { syntax: '<color>'; inherits: true; initial-value: transparent; }
@property --m-edu-glow    { syntax: '<color>'; inherits: true; initial-value: transparent; }

.m-edu-wallpaper {
  --px: 0;
  --py: 0;
  background:
    radial-gradient(120% 80% at 50% -10%, var(--m-edu-glow) 0%, transparent 55%),
    linear-gradient(
      to top right,
      var(--m-edu-bg-from),
      var(--m-edu-bg-via),
      var(--m-edu-bg-to)
    );
  transition:
    --m-edu-bg-from 1.2s cubic-bezier(0.22, 1, 0.36, 1),
    --m-edu-bg-via  1.2s cubic-bezier(0.22, 1, 0.36, 1),
    --m-edu-bg-to   1.2s cubic-bezier(0.22, 1, 0.36, 1),
    --m-edu-b1      1.2s cubic-bezier(0.22, 1, 0.36, 1),
    --m-edu-b2      1.2s cubic-bezier(0.22, 1, 0.36, 1),
    --m-edu-b3      1.2s cubic-bezier(0.22, 1, 0.36, 1),
    --m-edu-glow    1.2s cubic-bezier(0.22, 1, 0.36, 1);
}

.m-edu-blob {
  position: absolute;
  border-radius: 9999px;
  filter: blur(40px);
  contain: strict;
  will-change: transform;
  transform: translate3d(0, 0, 0);
  backface-visibility: hidden;
}

.m-edu-blob-1 {
  background: radial-gradient(circle, var(--m-edu-b1) 0%, transparent 70%);
  animation: m-edu-breathe-1 18s ease-in-out infinite;
}
.m-edu-blob-2 {
  background: radial-gradient(circle, var(--m-edu-b2) 0%, transparent 70%);
  animation: m-edu-breathe-2 22s ease-in-out infinite;
}
.m-edu-blob-3 {
  background: radial-gradient(circle, var(--m-edu-b3) 0%, transparent 70%);
  animation: m-edu-breathe-3 26s ease-in-out infinite;
}

@keyframes m-edu-breathe-1 {
  0%, 100% {
    transform: translate3d(
      calc(var(--px) * -22px),
      calc(var(--py) * -22px),
      0
    ) scale(1);
  }
  50% {
    transform: translate3d(
      calc(var(--px) * -22px + 18px),
      calc(var(--py) * -22px + 12px),
      0
    ) scale(1.07);
  }
}
@keyframes m-edu-breathe-2 {
  0%, 100% {
    transform: translate3d(
      calc(var(--px) * -32px),
      calc(var(--py) * -32px),
      0
    ) scale(1);
  }
  50% {
    transform: translate3d(
      calc(var(--px) * -32px - 22px),
      calc(var(--py) * -32px + 16px),
      0
    ) scale(1.06);
  }
}
@keyframes m-edu-breathe-3 {
  0%, 100% {
    transform: translate3d(
      calc(var(--px) * -14px),
      calc(var(--py) * -14px),
      0
    ) scale(1);
  }
  50% {
    transform: translate3d(
      calc(var(--px) * -14px + 14px),
      calc(var(--py) * -14px - 18px),
      0
    ) scale(1.08);
  }
}

.m-edu-grain {
  display: none;
}


@media (max-width: 1024px) {
  .m-edu-blob {
    display: none !important;
  }
  .m-edu-grain {
    display: none !important;
  }
  .m-edu-wallpaper {
    background:
      radial-gradient(120% 70% at 50% -10%, var(--m-edu-glow) 0%, transparent 60%),
      radial-gradient(80% 50% at 10% 20%, var(--m-edu-b1) 0%, transparent 55%),
      radial-gradient(80% 50% at 90% 80%, var(--m-edu-b3) 0%, transparent 55%),
      linear-gradient(
        to top right,
        var(--m-edu-bg-from),
        var(--m-edu-bg-via),
        var(--m-edu-bg-to)
      ) !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  .m-edu-blob-1,
  .m-edu-blob-2,
  .m-edu-blob-3 {
    animation: none !important;
    transform: none !important;
  }
  .m-edu-wallpaper {
    transition-duration: 0s !important;
  }
}
`;

/* ═══════════════════════════════════════════════════════════════════════
 * 7. Component
 * ═══════════════════════════════════════════════════════════════════════ */

export const DynamicWallpaper = memo(function DynamicWallpaper() {
  const { isDark } = useTheme();
  const [theme] = useWallpaperTheme();
  const rootRef = useRef<HTMLDivElement>(null);

  usePointerParallax(rootRef);

  const palette = WALLPAPER_THEMES[theme];
  const active = isDark ? palette.dark : palette.light;

  const style = {
    '--m-edu-bg-from': active.bgFrom,
    '--m-edu-bg-via': active.bgVia,
    '--m-edu-bg-to': active.bgTo,
    '--m-edu-b1': active.blob1,
    '--m-edu-b2': active.blob2,
    '--m-edu-b3': active.blob3,
    '--m-edu-glow': active.glow,
  } as CSSProperties;

  useInsertionEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.getElementById(WALLPAPER_STYLE_ID)) return;
    const tag = document.createElement('style');
    tag.id = WALLPAPER_STYLE_ID;
    tag.textContent = WALLPAPER_CSS;
    document.head.appendChild(tag);
  }, []);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      data-wallpaper-theme={theme}
      data-wallpaper-mode={isDark ? 'dark' : 'light'}
      className="m-edu-wallpaper pointer-events-none fixed inset-0 -z-10 overflow-hidden select-none [contain:strict]"
      style={style}
    >
      {/* Ambient light blobs (parallax + breathing) */}
      <div className="m-edu-blob m-edu-blob-1 -top-32 -left-32 h-[560px] w-[560px]" />
      <div className="m-edu-blob m-edu-blob-2 top-1/4 -right-24 h-[660px] w-[660px]" />
      <div className="m-edu-blob m-edu-blob-3 -bottom-36 left-1/3 h-[620px] w-[620px]" />

      {/* Specular grain overlay for that premium "shader" feel */}
      <div className="m-edu-grain absolute inset-0" />
    </div>
  );
});

export default DynamicWallpaper;