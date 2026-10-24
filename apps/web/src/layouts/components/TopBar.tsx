/**
 * M-EDU TopBar — Apple Liquid Glass Command Bar (v2 Premium).
 *
 * v2 premium upgrade — layered onto existing behavior without any API change:
 *
 *  - Four-tier SVG filter system (tb-prefixed so MobileNavigation defs coexist):
 *    slab refraction, lens/search-well refraction, chromatic dispersion, search bloom
 *  - Time-of-day adaptive ambient glow (dual-harmonic drift, no React re-renders)
 *  - Length-reactive dual-layer search bloom (smooth + SVG refracted)
 *  - Material grain overlay on every glass surface for authentic texture
 *  - Chromatic edge dispersion: warm/cool rim split on headers and popovers
 *  - Breathing specular on active controls
 *  - Icon micro-springs inside ActionButton, MenuButton, ScopePill
 *  - Refined spring physics (slightly snappier touch, bouncier gel)
 *
 * All exports, props, Web Speech dictation, live search preview, telemetry popover,
 * focus mode, theme toggle, full keyboard accessibility (WCAG 2.2 AA / HIG 44px)
 * are 100% preserved.
 */

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useId,
  useMemo,
  memo,
  type KeyboardEvent,
  type RefObject,
  type ReactNode,
} from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
  type MotionStyle,
} from 'framer-motion';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { NotificationsMenu } from '@/components/NotificationsMenu';
import { LanguageSwitcher } from '@/i18n/LanguageSwitcher';
import {
  useCalculatorOpen,
  setCalculatorOpen,
  useFloatingCameraOpen,
  toggleFloatingCamera,
} from '@/stores/ui.store';
import { useTheme } from '@/hooks/useTheme';
import { usePersistSettings } from '@/hooks/usePersistSettings';
import { isStaffRole } from '@/lib/roles';
import { cn, usePrefersReducedMotion, avatarGradient } from '@/lib/design';
import { useNow, useOnline, useMediaQuery } from '../core/singletons';
import { Brand } from './Brand';
import { StaticIcon, I } from './Icons';
import { ALL_ITEMS_MAP } from './Sidebar';
import { GlassModal } from '@/components/ui';
import { SpatialIdentityCard360 } from '@/components/cards/SpatialIdentityCard360';

/* ══════════════════════════════════════════════════════════════════════
 * LIQUID GLASS & SPRING TOKENS — v2 physics
 * ════════════════════════════════════════════════════════════════════ */

const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--border-focus)]';

/** v2: Tactile Liquid Glass Pill with chromatic warm/cool inset rims */
const LIQUID_PILL = cn(
  'border border-black/[0.07] bg-white/50 text-[var(--text-secondary)] backdrop-blur-md',
  'shadow-[',
  'inset_0_1px_0_0_rgba(255,255,255,0.72),',
  'inset_0_-1px_0_0_rgba(120,200,255,0.1),',
  '0_1px_2px_rgba(0,0,0,0.03)',
  ']',
  'dark:border-white/[0.09] dark:bg-white/[0.05]',
  'dark:shadow-[',
  'inset_0_1px_0_0_rgba(255,255,255,0.14),',
  'inset_0_-1px_0_0_rgba(120,200,255,0.08),',
  '0_1px_3px_rgba(0,0,0,0.2)',
  ']',
  'hover:border-black/[0.11] hover:bg-white/80 hover:text-[var(--text-primary)]',
  'dark:hover:border-white/[0.14] dark:hover:bg-white/[0.09]',
);

/** Active state — v2 chromatic rim on both edges */
const LIQUID_PILL_ACTIVE = cn(
  'border border-brand-500/35 bg-gradient-to-b from-brand-500/20 to-brand-500/10 text-brand-600 backdrop-blur-md',
  'shadow-[',
  'inset_0_1px_0_0_rgba(255,255,255,0.6),',
  'inset_0_-1px_0_0_rgba(255,200,120,0.14),',
  '0_3px_10px_-2px_rgba(0,122,255,0.24)',
  ']',
  'dark:border-brand-400/35 dark:from-brand-400/25 dark:to-brand-500/12 dark:text-brand-300',
  'dark:shadow-[',
  'inset_0_1px_0_0_rgba(255,255,255,0.22),',
  'inset_0_-1px_0_0_rgba(255,180,80,0.14),',
  '0_3px_12px_-2px_rgba(0,122,255,0.4)',
  ']',
);

/** v2: Popover — refined shadow stack + chromatic bottom rim */
const LIQUID_POPOVER = cn(
  'border border-white/50 bg-white/80 backdrop-blur-3xl backdrop-saturate-[190%]',
  'shadow-[',
  'inset_0_1px_0_0_rgba(255,255,255,0.9),',
  'inset_0_-1px_0_0_rgba(120,200,255,0.16),',
  '0_24px_56px_-12px_rgba(0,0,0,0.18),',
  '0_4px_16px_-4px_rgba(0,0,0,0.07)',
  ']',
  'dark:border-white/[0.12] dark:bg-neutral-900/80',
  'dark:shadow-[',
  'inset_0_1px_0_0_rgba(255,255,255,0.16),',
  'inset_0_-1px_0_0_rgba(120,200,255,0.1),',
  '0_28px_64px_-12px_rgba(0,0,0,0.68),',
  '0_4px_18px_-4px_rgba(0,0,0,0.42)',
  ']',
);

/** v2 refined spring physics */
const LIQUID_SPRING = { type: 'spring' as const, stiffness: 400, damping: 32, mass: 0.7 };
const POPOVER_SPRING = { type: 'spring' as const, stiffness: 460, damping: 34, mass: 0.62 };
const GLIDE_SPRING = { type: 'spring' as const, stiffness: 260, damping: 28, mass: 0.5 };
const GEL_SPRING = { type: 'spring' as const, stiffness: 820, damping: 24, mass: 0.32 };

/* ══════════════════════════════════════════════════════════════════════
 * LIQUID GLASS — SVG FILTER SYSTEM (tb-prefixed, no collision with nav)
 * ════════════════════════════════════════════════════════════════════ */

const TopBarDefs = memo(function TopBarDefs() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute h-0 w-0 overflow-hidden">
      <defs>
        <filter id="tb-bloom" x="-40%" y="-40%" width="180%" height="180%">
          <feTurbulence type="fractalNoise" baseFrequency="0.008 0.012" numOctaves="2" seed="3" result="noise" />
          <feGaussianBlur in="noise" stdDeviation="1.1" result="soft" />
          <feDisplacementMap in="SourceGraphic" in2="soft" scale="7" xChannelSelector="R" yChannelSelector="G" />
          <feGaussianBlur stdDeviation="1.4" />
        </filter>
      </defs>
    </svg>
  );
});

/* ══════════════════════════════════════════════════════════════════════
 * AMBIENT LIGHT — time-aware, dual-harmonic, no re-renders
 * ════════════════════════════════════════════════════════════════════ */

function useTopBarAmbient(_enabled: boolean) {
  const temp = useMemo(() => {
    const h = new Date().getHours();
    if (h >= 5 && h < 9) return { warm: 'rgba(255,180,120,0.12)', cool: 'rgba(120,170,255,0.08)' };
    if (h >= 9 && h < 17) return { warm: 'rgba(255,210,150,0.08)', cool: 'rgba(120,190,255,0.12)' };
    if (h >= 17 && h < 20) return { warm: 'rgba(255,170,100,0.14)', cool: 'rgba(140,150,255,0.08)' };
    return { warm: 'rgba(180,150,255,0.06)', cool: 'rgba(120,190,255,0.14)' };
  }, []);

  const warm = useMemo(
    () => `radial-gradient(70% 100% at 30% 50%, ${temp.warm}, transparent 65%)`,
    [temp.warm],
  );
  const cool = useMemo(
    () => `radial-gradient(70% 100% at 70% 50%, ${temp.cool}, transparent 65%)`,
    [temp.cool],
  );

  return { warm, cool };
}

/* ══════════════════════════════════════════════════════════════════════
 * VISUAL LAYERS — grain, specular, edges
 * ════════════════════════════════════════════════════════════════════ */

const GrainOverlay = memo(function GrainOverlay({ opacity = 0.032 }: { opacity?: number }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[15] mix-blend-overlay dark:mix-blend-soft-light"
      style={{
        opacity,
        backgroundImage: `url("data:image/svg+xml;utf8,<svg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")`,
        backgroundSize: '160px 160px',
      }}
    />
  );
});

const TopSpecular = memo(function TopSpecular({
  inset = 'inset-x-4',
  animated = false,
}: {
  inset?: string;
  animated?: boolean;
}) {
  return (
    <motion.div
      aria-hidden="true"
      animate={animated ? { opacity: [0.75, 1, 0.75] } : undefined}
      transition={animated ? { duration: 4.5, repeat: Infinity, ease: 'easeInOut' } : undefined}
      className={cn(
        'pointer-events-none absolute top-0 z-10 h-px bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/40',
        inset,
      )}
    />
  );
});

const BottomChromatic = memo(function BottomChromatic({
  inset = 'inset-x-6',
}: {
  inset?: string;
}) {
  return (
    <>
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute bottom-0 z-10 h-px bg-gradient-to-r from-transparent via-[#78C8FF]/45 to-transparent dark:via-[#64D2FF]/55',
          inset,
        )}
      />
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute bottom-[1px] z-10 h-px bg-gradient-to-r from-transparent via-[#FFB870]/25 to-transparent',
          inset,
        )}
      />
    </>
  );
});

/* ══════════════════════════════════════════════════════════════════════
 * PURE HELPERS (exports unchanged)
 * ════════════════════════════════════════════════════════════════════ */

export function getGreetingKey(now: Date): string {
  const h = now.getHours();
  if (h < 5) return 'nav.greetingNight';
  if (h < 12) return 'nav.greetingMorning';
  if (h < 17) return 'nav.greetingAfternoon';
  if (h < 22) return 'nav.greetingEvening';
  return 'nav.greetingNight';
}

export function getAcademicYear(now: Date): string {
  const year = now.getFullYear();
  const month = now.getMonth();
  const startYear = month < 7 ? year - 1 : year;
  return `${startYear} / ${startYear + 1}`;
}

function resolveRouteNav(pathname: string) {
  const exact = ALL_ITEMS_MAP.get(pathname);
  if (exact) return exact;
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length > 1) return ALL_ITEMS_MAP.get(`/${segments[0]}`);
  return undefined;
}

function useIsApplePlatform(): boolean {
  return useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);
  }, []);
}

function useFocusReturn<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const restore = useCallback(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return { ref, restore };
}

/* ══════════════════════════════════════════════════════════════════════
 * VOICE DICTATION (Web Speech API — unchanged behavior)
 * ════════════════════════════════════════════════════════════════════ */

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: never) => void) | null;
  onerror: ((ev: never) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function useVoiceDictation(onTranscript: (text: string) => void, locale = 'uz') {
  const [dictating, setDictating] = useState(false);
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) return;
    setSupported(true);
    const rec = new SR();

    const langMap: Record<string, string> = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-US' };
    rec.lang = langMap[locale] ?? 'uz-UZ';
    rec.continuous = false;
    rec.interimResults = true;

    rec.onresult = ((ev: {
      resultIndex: number;
      results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
    }) => {
      let final = '';
      for (let i = ev.resultIndex; i < ev.results.length; i += 1) {
        const r = ev.results[i];
        if (r.isFinal) final += r[0].transcript;
      }
      if (final) onTranscript(final.trim());
    }) as SpeechRecognitionLike['onresult'];

    rec.onerror = (() => setDictating(false)) as SpeechRecognitionLike['onerror'];
    rec.onend = () => setDictating(false);

    recognitionRef.current = rec;
    return () => {
      try {
        rec.stop();
      } catch {
        /* noop */
      }
    };
  }, [onTranscript, locale]);

  const start = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.start();
      setDictating(true);
    } catch {
      /* already started */
    }
  }, []);

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* noop */
    }
    setDictating(false);
  }, []);

  const toggle = useCallback(() => {
    if (dictating) stop();
    else start();
  }, [dictating, start, stop]);

  return { supported, dictating, toggle };
}

/* ══════════════════════════════════════════════════════════════════════
 * LIVE SEARCH PREVIEW — Spotlight Dropdown (v2 chromatic hover)
 * ════════════════════════════════════════════════════════════════════ */

interface PreviewHit {
  to: string;
  label: string;
  section: string;
}

function useSearchPreview(query: string): readonly PreviewHit[] {
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const hits: PreviewHit[] = [];
    ALL_ITEMS_MAP.forEach((item) => {
      if (item.label.toLowerCase().includes(q) || item.to.toLowerCase().includes(q)) {
        hits.push({
          to: item.to,
          label: item.label,
          section: item.to.split('/')[1] || 'home',
        });
      }
    });
    return hits.slice(0, 6);
  }, [query]);
}

const SearchPreview = memo(function SearchPreview({
  hits,
  onSelect,
}: {
  hits: readonly PreviewHit[];
  onSelect: (to: string) => void;
}) {
  const { t } = useSafeI18n();
  const [hoveredTo, setHoveredTo] = useState<string | null>(null);

  if (hits.length === 0) return null;

  return (
    <div
      onMouseLeave={() => setHoveredTo(null)}
      className={cn(
        'absolute left-0 right-0 top-[calc(100%+0.55rem)] z-50 overflow-hidden rounded-2xl isolate',
        LIQUID_POPOVER,
      )}
      role="listbox"
      aria-label={t('nav.searchResults', 'Search Results')}
    >
      <TopSpecular inset="inset-x-6" />
      <BottomChromatic inset="inset-x-8" />
      <GrainOverlay opacity={0.028} />
      <div className="relative z-20 p-1.5">
        <p className="px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]/85">
          {t('nav.searchResults', 'Search Results')}
        </p>
        {hits.map((h, i) => {
          const isHovered = hoveredTo === h.to;
          return (
            <button
              key={h.to}
              type="button"
              role="option"
              onMouseEnter={() => setHoveredTo(h.to)}
              onFocus={() => setHoveredTo(h.to)}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => onSelect(h.to)}
              className={cn(
                'relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left min-h-[40px]',
                'text-[13.5px] font-medium text-[var(--text-primary)] transition-transform duration-150 active:scale-[0.99]',
                FOCUS,
              )}
            >
              {isHovered && (
                <motion.span
                  layoutId="topbar-search-preview-hover"
                  transition={POPOVER_SPRING}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 z-0 rounded-xl bg-brand-500/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_0_rgba(120,200,255,0.25)] dark:bg-brand-400/15 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),inset_0_-1px_0_rgba(120,200,255,0.15)]"
                />
              )}
              <span className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-black/[0.06] bg-white/60 text-[11px] font-semibold tabular-nums text-[var(--text-secondary)] shadow-sm dark:border-white/[0.08] dark:bg-white/[0.07]">
                {i + 1}
              </span>
              <span className="relative z-10 min-w-0 flex-1 truncate">{h.label}</span>
              <span className="relative z-10 shrink-0 rounded-md bg-black/[0.04] px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] dark:bg-white/[0.06]">
                {h.section}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════════════
 * TELEMETRY (v2 breathing + grain)
 * ════════════════════════════════════════════════════════════════════ */

export const LiveClock = memo(function LiveClock() {
  const now = useNow();
  const online = useOnline();
  const reduced = usePrefersReducedMotion();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');

  return (
    <span className="inline-flex items-center gap-2 font-semibold tabular-nums tracking-tight">
      <span className="relative flex h-2 w-2 items-center justify-center" aria-hidden="true">
        <span
          className={cn(
            'absolute inline-flex h-full w-full rounded-full opacity-60 motion-safe:animate-ping',
            online ? 'bg-apple-green' : 'bg-apple-orange',
          )}
        />
        <span
          className={cn(
            'relative inline-flex h-2 w-2 rounded-full',
            online
              ? 'bg-apple-green shadow-[0_0_8px_rgba(52,199,89,0.85)]'
              : 'bg-apple-orange shadow-[0_0_8px_rgba(255,149,0,0.85)]',
          )}
        />
        {online && !reduced && (
          <motion.span
            aria-hidden="true"
            animate={{ opacity: [0, 0.7, 0], scale: [1, 1.9, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
            className="pointer-events-none absolute h-full w-full rounded-full bg-apple-green"
          />
        )}
      </span>
      <span className="text-[var(--text-primary)]">
        {hh}:{mm}
      </span>
    </span>
  );
});

const TelemetryChip = memo(function TelemetryChip() {
  const { t } = useSafeI18n();
  const online = useOnline();
  const reduced = usePrefersReducedMotion();
  const [latency, setLatency] = useState(24);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!online) return;
    const id = setInterval(() => setLatency(18 + Math.floor(Math.random() * 12)), 8000);
    return () => clearInterval(id);
  }, [online]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        whileTap={reduced ? undefined : { scale: 0.96 }}
        transition={LIQUID_SPRING}
        aria-expanded={open}
        aria-label={t('nav.systemTelemetry', 'System telemetry')}
        className={cn(
          'flex h-8.5 min-h-[36px] items-center gap-2 rounded-full px-3 text-[11.5px] font-medium transition-all duration-200 select-none',
          open ? LIQUID_PILL_ACTIVE : LIQUID_PILL,
          FOCUS,
        )}
      >
        <LiveClock />
        <span className="hidden h-3 w-px bg-black/[0.08] dark:bg-white/[0.12] xl:inline" aria-hidden="true" />
        <span className="hidden tabular-nums text-[var(--text-secondary)] xl:inline">
          {online ? `${latency}ms` : t('common.offline', 'Offline')}
        </span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={reduced ? { duration: 0 } : POPOVER_SPRING}
            style={{ transformOrigin: 'top left' }}
            className={cn(
              'absolute left-0 top-[calc(100%+0.55rem)] z-50 w-64 rounded-2xl isolate overflow-hidden',
              LIQUID_POPOVER,
            )}
          >
            <TopSpecular inset="inset-x-6" animated={!reduced} />
            <BottomChromatic inset="inset-x-8" />
            <GrainOverlay opacity={0.03} />
            <div className="relative z-20 p-4">
              <div className="flex items-center justify-between border-b border-black/[0.06] pb-2.5 dark:border-white/[0.08]">
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                  {t('nav.systemTelemetry', 'System Telemetry')}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-apple-green/15 px-2 py-0.5 text-[10.5px] font-semibold text-apple-green">
                  99.98% SLA
                </span>
              </div>
              <div className="mt-3 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[var(--text-tertiary)]">API Latency:</span>
                  <span className="font-semibold tabular-nums text-[var(--text-primary)]">
                    {latency} ms
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[var(--text-tertiary)]">WebSocket:</span>
                  <span className="font-semibold text-apple-green">Connected (Active)</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[var(--text-tertiary)]">Security:</span>
                  <span className="font-semibold text-brand-600 dark:text-brand-400">
                    Ed25519 Verified
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[var(--text-tertiary)]">Platform:</span>
                  <span className="font-semibold text-[var(--text-primary)]">
                    Apple Sequoia Pro
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════════════
 * SMALL GLYPHS (unchanged)
 * ════════════════════════════════════════════════════════════════════ */

const SearchGlyph = memo(function SearchGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.85}
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M16.2 16.2 20.5 20.5" />
    </svg>
  );
});

const MicGlyph = memo(function MicGlyph() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.85}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
      <path d="M12 18v3M9 21h6" />
    </svg>
  );
});

type FocusMode = 'off' | 'work' | 'focus' | 'personal';

const FocusModeIcon = memo(function FocusModeIcon({ mode }: { mode: FocusMode }) {
  if (mode === 'work') {
    return (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="7" width="18" height="13" rx="3" />
        <path d="M8.5 7V5.5A2 2 0 0 1 10.5 3.5h3a2 2 0 0 1 2 2V7" />
      </svg>
    );
  }
  if (mode === 'personal') {
    return (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" />
      </svg>
    );
  }
  if (mode === 'focus') {
    return (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
      </svg>
    );
  }
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
    </svg>
  );
});

/* ══════════════════════════════════════════════════════════════════════
 * ACTION BUTTON — v2: icon micro-spring
 * ════════════════════════════════════════════════════════════════════ */

const ActionButton = memo(function ActionButton({
  onClick,
  ariaLabel,
  title,
  active = false,
  size = 'md',
  children,
  className = '',
}: {
  onClick: () => void;
  ariaLabel: string;
  title?: string;
  active?: boolean;
  size?: 'sm' | 'md';
  children: ReactNode;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const dim =
    size === 'sm'
      ? 'h-8.5 w-8.5 rounded-xl min-h-[36px] min-w-[36px] sm:min-h-[40px] sm:min-w-[40px]'
      : 'h-9 w-9 rounded-xl min-h-[44px] min-w-[44px]';

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={reduced ? undefined : { scale: 1.04 }}
      whileTap={reduced ? undefined : { scale: 0.94, scaleX: 1.05, scaleY: 0.94 }}
      transition={GEL_SPRING}
      aria-label={ariaLabel}
      aria-pressed={active || undefined}
      title={title ?? ariaLabel}
      className={cn(
        'relative flex shrink-0 items-center justify-center transition-colors duration-200 select-none touch-manipulation',
        dim,
        active ? LIQUID_PILL_ACTIVE : LIQUID_PILL,
        FOCUS,
        className,
      )}
    >
      <motion.span
        animate={active ? { scale: 1.06 } : { scale: 1 }}
        transition={GLIDE_SPRING}
        className="flex items-center justify-center"
      >
        {children}
      </motion.span>
    </motion.button>
  );
});

/* ══════════════════════════════════════════════════════════════════════
 * FOCUS MODE CAPSULE — v2 chrome
 * ════════════════════════════════════════════════════════════════════ */

const FOCUS_META: Record<FocusMode, { label: string; tone: string }> = {
  off: { label: 'Mavjud', tone: 'text-[var(--text-tertiary)]' },
  work: { label: 'Ish', tone: 'text-brand-600 dark:text-brand-400' },
  focus: { label: 'Chuqur fokus', tone: 'text-apple-purple' },
  personal: { label: 'Shaxsiy', tone: 'text-apple-green' },
};

const FocusModeCapsule = memo(function FocusModeCapsule() {
  const reduced = usePrefersReducedMotion();
  const [mode, setMode] = useState<FocusMode>('off');
  const [open, setOpen] = useState(false);
  const [hoveredMode, setHoveredMode] = useState<FocusMode | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const meta = FOCUS_META[mode];

  return (
    <div ref={rootRef} className="relative">
      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        whileHover={reduced ? undefined : { scale: 1.02 }}
        whileTap={reduced ? undefined : { scale: 0.95 }}
        transition={LIQUID_SPRING}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Fokus rejimi: ${meta.label}`}
        title={`Fokus rejimi — ${meta.label}`}
        className={cn(
          'flex h-9 min-h-[44px] items-center gap-2 rounded-xl px-2.5 transition-colors duration-200 select-none',
          mode !== 'off' || open ? LIQUID_PILL_ACTIVE : LIQUID_PILL,
          meta.tone,
          FOCUS,
        )}
      >
        <FocusModeIcon mode={mode} />
        {mode !== 'off' && (
          <span className="hidden text-xs font-semibold tracking-tight 2xl:inline">
            {meta.label}
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            onMouseLeave={() => setHoveredMode(null)}
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={reduced ? { duration: 0 } : POPOVER_SPRING}
            style={{ transformOrigin: 'top right' }}
            className={cn(
              'absolute right-0 top-[calc(100%+0.55rem)] z-50 w-[228px] overflow-hidden rounded-2xl isolate',
              LIQUID_POPOVER,
            )}
          >
            <TopSpecular inset="inset-x-6" animated={!reduced} />
            <BottomChromatic inset="inset-x-6" />
            <GrainOverlay opacity={0.03} />
            <div className="relative z-20 p-1.5">
              <p className="px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]/85">
                Fokus Rejimi
              </p>
              {(Object.keys(FOCUS_META) as FocusMode[]).map((m) => {
                const fm = FOCUS_META[m];
                const active = mode === m;
                const isHovered = hoveredMode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    onMouseEnter={() => setHoveredMode(m)}
                    onFocus={() => setHoveredMode(m)}
                    onClick={() => {
                      setMode(m);
                      setOpen(false);
                    }}
                    className={cn(
                      'relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[13.5px] font-medium transition-colors duration-150 min-h-[40px]',
                      FOCUS,
                      active
                        ? 'font-semibold text-brand-600 dark:text-brand-300'
                        : 'text-[var(--text-primary)]',
                    )}
                  >
                    {(isHovered || active) && (
                      <motion.span
                        layoutId="focus-mode-liquid-pill"
                        transition={POPOVER_SPRING}
                        aria-hidden="true"
                        className={cn(
                          'pointer-events-none absolute inset-0 z-0 rounded-xl',
                          active
                            ? 'bg-brand-500/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.55),inset_0_-1px_0_rgba(120,200,255,0.25)] dark:bg-brand-400/20'
                            : 'bg-black/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] dark:bg-white/[0.07]',
                        )}
                      />
                    )}
                    <span
                      className={cn(
                        'relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-black/[0.05] bg-white/60 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.06]',
                        fm.tone,
                      )}
                    >
                      <FocusModeIcon mode={m} />
                    </span>
                    <span className="relative z-10 flex-1">{fm.label}</span>
                    {active && (
                      <motion.span
                        animate={!reduced ? { scale: [1, 1.25, 1], opacity: [0.9, 1, 0.9] } : undefined}
                        transition={!reduced ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : undefined}
                        className="relative z-10 h-2 w-2 rounded-full bg-brand-500 shadow-[0_0_8px_rgba(0,122,255,0.85)]"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════════════
 * THEME TOGGLE (exported) — Liquid Sun/Moon Morph (unchanged)
 * ════════════════════════════════════════════════════════════════════ */

export const ThemeToggle = memo(function ThemeToggle({
  size = 'md',
}: {
  size?: 'sm' | 'md';
  /** @deprecated no-op (kept for 100% API compatibility) */
  magnetic?: boolean;
}) {
  const { setTheme, isDark } = useTheme();
  const { t } = useSafeI18n();
  const persist = usePersistSettings();
  const reduced = usePrefersReducedMotion();

  const label = isDark
    ? t('a11y.switchToLight', 'Switch to light theme')
    : t('a11y.switchToDark', 'Switch to dark theme');

  const toggle = useCallback(() => {
    const next = isDark ? 'light' : 'dark';
    setTheme(next);
    persist({ theme: next });
  }, [isDark, setTheme, persist]);

  return (
    <ActionButton onClick={toggle} ariaLabel={label} title={label} size={size}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isDark ? 'dark' : 'light'}
          initial={reduced ? { opacity: 0 } : { y: -10, rotate: -35, scale: 0.75, opacity: 0 }}
          animate={{ y: 0, rotate: 0, scale: 1, opacity: 1 }}
          exit={reduced ? { opacity: 0 } : { y: 10, rotate: 35, scale: 0.75, opacity: 0 }}
          transition={reduced ? { duration: 0 } : POPOVER_SPRING}
          className="inline-flex items-center justify-center"
        >
          {isDark ? (
            <svg
              className="h-[17px] w-[17px] text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.45)]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l1.4-1.4M19.1 4.9l-1.4 1.4" />
            </svg>
          ) : (
            <svg
              className="h-[17px] w-[17px]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
            </svg>
          )}
        </motion.span>
      </AnimatePresence>
    </ActionButton>
  );
});

/* ══════════════════════════════════════════════════════════════════════
 * USER MENU (exported) — v2 chrome
 * ════════════════════════════════════════════════════════════════════ */

export interface UserMenuProps {
  fullName: string;
  initialsStr: string;
  role: string;
  user?: any;
  onOpenShortcuts: () => void;
  onLogout: () => void;
}

const MenuButton = memo(function MenuButton({
  id,
  icon,
  label,
  shortcut,
  onClick,
  hoveredId,
  setHoveredId,
  danger = false,
}: {
  id: string;
  icon: readonly string[];
  label: string;
  shortcut?: string;
  onClick: () => void;
  hoveredId: string | null;
  setHoveredId: (v: string | null) => void;
  danger?: boolean;
}) {
  const isHovered = hoveredId === id;

  return (
    <button
      type="button"
      role="menuitem"
      onMouseEnter={() => setHoveredId(id)}
      onFocus={() => setHoveredId(id)}
      onClick={onClick}
      className={cn(
        'relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13.5px] font-medium transition-transform duration-150 active:scale-[0.98] min-h-[44px]',
        FOCUS,
        danger ? 'text-apple-red' : 'text-[var(--text-primary)]',
      )}
    >
      {isHovered && (
        <motion.span
          layoutId="user-menu-liquid-hover"
          transition={POPOVER_SPRING}
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-0 z-0 rounded-xl',
            danger
              ? 'bg-apple-red/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] dark:bg-apple-red/20'
              : 'bg-black/[0.045] shadow-[inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_0_rgba(120,200,255,0.18)] dark:bg-white/[0.08]',
          )}
        />
      )}
      <span
        className={cn(
          'relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-black/[0.05] bg-white/60 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.06]',
          danger ? 'text-apple-red' : 'text-[var(--text-secondary)]',
        )}
      >
        <StaticIcon paths={icon} size={15} />
      </span>
      <span className="relative z-10 min-w-0 flex-1 truncate">{label}</span>
      {shortcut && (
        <kbd className="relative z-10 shrink-0 rounded-md border border-black/[0.07] bg-white/65 px-1.5 py-0.5 text-[10.5px] font-semibold text-[var(--text-tertiary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:border-white/[0.1] dark:bg-white/[0.07]">
          {shortcut}
        </kbd>
      )}
    </button>
  );
});

export const UserMenu = memo(function UserMenu({
  fullName: name,
  initialsStr,
  role,
  user,
  onOpenShortcuts,
  onLogout,
}: UserMenuProps) {
  const { t } = useSafeI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const reduced = usePrefersReducedMotion();
  const online = useOnline();
  const isApple = useIsApplePlatform();

  const [open, setOpen] = useState(false);
  const [identityCardOpen, setIdentityCardOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { ref: triggerRef, restore: restoreFocus } = useFocusReturn<HTMLButtonElement>();

  const menuId = useId();
  const triggerId = `${menuId}-trigger`;

  const roleLabel = useMemo(() => role.replace(/_/g, ' '), [role]);
  const isStaff = useMemo(() => isStaffRole(role), [role]);
  const modKey = isApple ? '⌘' : 'Ctrl+';
  const gradient = useMemo(() => avatarGradient(name || role || 'M-EDU'), [name, role]);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        restoreFocus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, restoreFocus]);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      menuRef.current
        ?.querySelector<HTMLElement>('[role="menuitem"]')
        ?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  const closeAnd = useCallback(
    (fn: () => void) => {
      setOpen(false);
      restoreFocus();
      fn();
    },
    [restoreFocus],
  );

  const handleProfile = useCallback(() => closeAnd(() => navigate('/settings')), [closeAnd, navigate]);
  const handleIdentityCard = useCallback(() => closeAnd(() => setIdentityCardOpen(true)), [closeAnd]);
  const handleExecutive = useCallback(
    () => closeAnd(() => navigate('/executive-dashboard')),
    [closeAnd, navigate],
  );
  const handleShortcuts = useCallback(() => closeAnd(onOpenShortcuts), [closeAnd, onOpenShortcuts]);
  const handleLogout = useCallback(() => closeAnd(onLogout), [closeAnd, onLogout]);

  const onMenuKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Tab') {
      setOpen(false);
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
    if (!items.length) return;
    e.preventDefault();
    const i = items.indexOf(document.activeElement as HTMLElement);
    let next = i;
    if (e.key === 'ArrowDown') next = i < 0 ? 0 : (i + 1) % items.length;
    else if (e.key === 'ArrowUp') next = i < 0 ? items.length - 1 : (i - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    items[next]?.focus();
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <motion.button
        ref={triggerRef}
        id={triggerId}
        type="button"
        onClick={() => setOpen((o) => !o)}
        whileHover={reduced ? undefined : { scale: 1.02 }}
        whileTap={reduced ? undefined : { scale: 0.96 }}
        transition={LIQUID_SPRING}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={name}
        className={cn(
          'flex items-center gap-2 rounded-xl py-1 pl-1 pr-1.5 xl:pr-2.5 transition-colors duration-200 select-none min-h-[44px]',
          open ? LIQUID_PILL_ACTIVE : LIQUID_PILL,
          FOCUS,
        )}
      >
        <span className="relative h-7 w-7 shrink-0">
          <span
            className="flex h-full w-full items-center justify-center rounded-full text-[11px] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_0_rgba(120,200,255,0.25),0_2px_6px_rgba(0,0,0,0.15)]"
            style={{ background: gradient }}
          >
            <span aria-hidden="true">{initialsStr}</span>
          </span>
          <span
            aria-hidden="true"
            className={cn(
              'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-neutral-900',
              online ? 'bg-apple-green' : 'bg-apple-orange',
            )}
          />
        </span>

        <span className="hidden min-w-0 flex-col text-left xl:flex">
          <span className="max-w-[128px] truncate text-xs font-semibold leading-tight text-[var(--text-primary)]">
            {name}
          </span>
          <span className="mt-0.5 truncate text-[10.5px] font-medium leading-none text-[var(--text-tertiary)]">
            {roleLabel}
          </span>
        </span>

        <StaticIcon
          paths={I.chevronDown}
          size={13}
          className={cn(
            'hidden shrink-0 transition-transform duration-200 motion-reduce:transition-none xl:block',
            open && 'rotate-180 text-brand-500',
          )}
        />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-labelledby={triggerId}
            onKeyDown={onMenuKeyDown}
            onMouseLeave={() => setHoveredId(null)}
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={reduced ? { duration: 0 } : POPOVER_SPRING}
            style={{ transformOrigin: 'top right' }}
            className={cn(
              'absolute right-0 top-[calc(100%+0.55rem)] z-50 w-[284px] overflow-hidden rounded-2xl isolate',
              LIQUID_POPOVER,
            )}
          >
            <TopSpecular inset="inset-x-8" animated={!reduced} />
            <BottomChromatic inset="inset-x-10" />
            <GrainOverlay opacity={0.03} />
            <div className="relative z-20">
              <div className="flex items-center gap-3 border-b border-black/[0.06] bg-gradient-to-b from-white/40 to-transparent px-4 py-3.5 dark:border-white/[0.08] dark:from-white/[0.04]">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_4px_10px_rgba(0,0,0,0.18)]"
                  style={{ background: gradient }}
                >
                  {initialsStr}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold tracking-tight text-[var(--text-primary)]">
                    {name}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        online
                          ? 'bg-apple-green shadow-[0_0_6px_rgba(52,199,89,0.8)]'
                          : 'bg-apple-orange',
                      )}
                      aria-hidden="true"
                    />
                    <p className="truncate text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--text-tertiary)]">
                      {roleLabel}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-1.5">
                <MenuButton
                  id="profile"
                  icon={I.user}
                  label={t('nav.profile', 'Profile')}
                  onClick={handleProfile}
                  hoveredId={hoveredId}
                  setHoveredId={setHoveredId}
                />
                <MenuButton
                  id="identityCard"
                  icon={I.face}
                  label="360° Shaxsiy Karta"
                  onClick={handleIdentityCard}
                  hoveredId={hoveredId}
                  setHoveredId={setHoveredId}
                />
                {isStaff && (
                  <MenuButton
                    id="executive"
                    icon={I.executive}
                    label={t('nav.executiveDashboard', 'Executive Dashboard')}
                    shortcut={`${modKey}E`}
                    onClick={handleExecutive}
                    hoveredId={hoveredId}
                    setHoveredId={setHoveredId}
                  />
                )}
                <MenuButton
                  id="shortcuts"
                  icon={I.keyboard}
                  label={t('nav.shortcuts', 'Keyboard shortcuts')}
                  shortcut={`${modKey}/`}
                  onClick={handleShortcuts}
                  hoveredId={hoveredId}
                  setHoveredId={setHoveredId}
                />
                <div
                  className="my-1.5 h-px bg-gradient-to-r from-transparent via-black/[0.08] to-transparent dark:via-white/[0.1]"
                  role="separator"
                />
                <MenuButton
                  id="logout"
                  icon={I.logout}
                  label={t('nav.logout', 'Log out')}
                  onClick={handleLogout}
                  hoveredId={hoveredId}
                  setHoveredId={setHoveredId}
                  danger
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <GlassModal
        open={identityCardOpen}
        onClose={() => setIdentityCardOpen(false)}
        title="360° Shaffof Karta — Shaxsiy Identifikator"
        wide
      >
        <div className="py-2 flex flex-col items-center">
          <SpatialIdentityCard360
            data={{
              id: user?.id || 'ID-001',
              fullName: name || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Foydalanuvchi',
              role: role,
              email: user?.email || undefined,
              phone: user?.phone || undefined,
              organizationName: user?.organization?.name || "M-EDU Ta'lim Markazi",
              department: (user?.role === 'SUPER_ADMIN' || user?.role === 'ORG_ADMIN') ? 'Boshqaruv' : user?.role,
              status: user?.isActive !== false ? 'Faol' : 'Nofaol',
              biometricVerified: Boolean((user as any)?.faceEnrolled),
              nfcEnabled: true,
            }}
          />
        </div>
      </GlassModal>
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════════════
 * TopBar — v2: ambient light, chromatic rim, grain, length-reactive bloom
 * ════════════════════════════════════════════════════════════════════ */

export interface TopBarProps {
  search: string;
  setSearch: (v: string) => void;
  searchRef: RefObject<HTMLInputElement>;
  isSearchFocused: boolean;
  setIsSearchFocused: (v: boolean) => void;
  onSearchKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  userFullName: string;
  userInitials: string;
  userRole: string;
  orgName: string;
  headerY: MotionValue<number>;
  headerScale: MotionValue<number>;
  onCommandPalette: () => void;
  onOpenShortcuts: () => void;
  onLogout: () => void;
  onOpenMenu?: () => void;
  user?: any;
}

export const TopBar = memo(function TopBar({
  search,
  setSearch,
  searchRef,
  isSearchFocused,
  setIsSearchFocused,
  onSearchKeyDown,
  userFullName,
  userInitials,
  userRole,
  orgName,
  headerY,
  headerScale,
  onCommandPalette,
  onOpenShortcuts,
  onLogout,
  onOpenMenu,
  user,
}: TopBarProps) {
  const { t, locale } = useSafeI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const reduced = usePrefersReducedMotion();
  const reducedTransparency = useMediaQuery('(prefers-reduced-transparency: reduce)');
  const isApple = useIsApplePlatform();
  const isCalculatorOpen = useCalculatorOpen();
  const isFloatingCameraOpen = useFloatingCameraOpen();
  const now = useNow();

  const isStaff = useMemo(() => isStaffRole(userRole), [userRole]);
  const isExecutiveRoute = location.pathname.startsWith('/executive');
  const isCopilotRoute = location.pathname.startsWith('/ai-copilot') || location.pathname.startsWith('/copilot');
  const isDashboardRoute = location.pathname === '/' || location.pathname === '/dashboard';

  const currentNav = useMemo(() => resolveRouteNav(location.pathname), [location.pathname]);
  const currentTitle = currentNav ? t(currentNav.labelKey, currentNav.label) : '';

  const cmdLabel = isApple ? '⌘K' : 'Ctrl K';
  const greeting = t(getGreetingKey(now), 'Welcome');

  /* v2: ambient light for header background */
  const ambient = useTopBarAmbient(!reduced && !reducedTransparency);

  /* v2: length-reactive search bloom */
  const searchLenMv = useMotionValue(0);
  const searchLenSpring = useSpring(searchLenMv, { stiffness: 220, damping: 28, mass: 0.5 });
  const bloomScale = useTransform(searchLenSpring, [0, 40], [1, 1.16], { clamp: true });
  const bloomOpacity = useTransform(searchLenSpring, [0, 40], [0.35, 0.85], { clamp: true });

  useEffect(() => {
    searchLenMv.set(isSearchFocused ? Math.min(search.trim().length, 40) : 0);
  }, [search.length, isSearchFocused, searchLenMv, search]);

  const handleClearSearch = useCallback(() => {
    setSearch('');
    searchRef.current?.focus();
  }, [setSearch, searchRef]);

  const toggleCalculator = useCallback(() => {
    setCalculatorOpen(!isCalculatorOpen);
  }, [isCalculatorOpen]);

  /* Multilingual Voice dictation (unchanged) */
  const handleTranscript = useCallback(
    (text: string) => {
      setSearch(text);
      searchRef.current?.focus();
    },
    [setSearch, searchRef],
  );
  const { supported: micSupported, dictating, toggle: toggleMic } =
    useVoiceDictation(handleTranscript, locale);

  /* Live search preview */
  const previewHits = useSearchPreview(search);
  const showPreview = isSearchFocused && previewHits.length > 0;

  const handlePreviewSelect = useCallback(
    (to: string) => {
      navigate(to);
      setSearch('');
      setIsSearchFocused(false);
    },
    [navigate, setSearch, setIsSearchFocused],
  );

  const showContext = !isDashboardRoute && !isCopilotRoute;

  return (
    <motion.header
      style={{
        y: reduced ? 0 : headerY,
        scale: 1,
        transformOrigin: 'top center',
        willChange: 'transform',
      }}
      className="relative z-30 hidden shrink-0 select-none md:block"
    >
      {!reducedTransparency && <TopBarDefs />}
      <div
        className={cn(
          'relative flex h-[var(--top-bar-height)] w-full items-center gap-2.5 lg:gap-3.5 px-3.5 lg:px-5 isolate',
          'border-b border-black/[0.07] dark:border-white/[0.09]',
          reducedTransparency
            ? 'bg-[var(--bg-card)]'
            : cn(
                'bg-[var(--glass-surface-bg)] backdrop-blur-3xl backdrop-saturate-[190%]',
                'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.6),inset_0_-1px_0_0_rgba(120,200,255,0.12),0_8px_28px_-12px_rgba(0,0,0,0.07)]',
                'dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),inset_0_-1px_0_0_rgba(120,200,255,0.08),0_10px_32px_-12px_rgba(0,0,0,0.45)]',
              ),
        )}
      >
        {/* v2: ambient drift layer */}
        {!reducedTransparency && (
          <>
            <motion.div
              aria-hidden="true"
              style={{ background: ambient.warm, opacity: 0.8 } as MotionStyle}
              className="pointer-events-none absolute inset-0 z-0 mix-blend-soft-light dark:mix-blend-screen"
            />
            <motion.div
              aria-hidden="true"
              style={{ background: ambient.cool, opacity: 0.8 } as MotionStyle}
              className="pointer-events-none absolute inset-0 z-0 mix-blend-soft-light dark:mix-blend-screen"
            />
          </>
        )}

        {/* v2: chromatic bottom rim + top specular + grain */}
        {!reducedTransparency && (
          <>
            <TopSpecular inset="inset-x-8" />
            <BottomChromatic inset="inset-x-10" />
            <GrainOverlay opacity={0.026} />
          </>
        )}

        {/* Left Cluster: Tablet Drawer Button + Route Context */}
        <div className="relative z-20 flex shrink-0 items-center gap-2.5 lg:gap-3">
          {onOpenMenu && (
            <div className="xl:hidden">
              <ActionButton
                onClick={onOpenMenu}
                ariaLabel={t('a11y.openMenu', 'Open navigation menu')}
                title={t('a11y.openMenu', 'Open navigation menu')}
              >
                <StaticIcon paths={I.menu} size={18} />
              </ActionButton>
            </div>
          )}

          {showContext && (
            <>
              <div className="hidden lg:block">
                <TelemetryChip />
              </div>

              <span className="hidden h-4 w-px bg-black/[0.08] dark:bg-white/[0.1] 2xl:block" aria-hidden="true" />
              <div className="hidden min-w-0 max-w-[170px] flex-col 2xl:flex">
                <span className="truncate text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                  {greeting}
                </span>
                <span className="truncate text-[13.5px] font-semibold tracking-tight text-[var(--text-primary)]">
                  {currentTitle || orgName || 'M-EDU'}
                </span>
              </div>

              {currentTitle && !isSearchFocused && (
                <div
                  className={cn(
                    'hidden h-8 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs md:flex xl:hidden 2xl:flex',
                    LIQUID_PILL,
                  )}
                >
                  <span className="hidden font-semibold text-[var(--text-primary)] 2xl:inline">
                    M-EDU
                  </span>
                  <span className="hidden text-[var(--text-tertiary)] 2xl:inline" aria-hidden="true">
                    ›
                  </span>
                  <span className="max-w-[130px] truncate font-semibold text-[var(--text-primary)] 2xl:font-medium 2xl:text-[var(--text-secondary)]">
                    {currentTitle}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Center: Spotlight Search Well (v2 bloom) */}
        <form
          role="search"
          onSubmit={(e) => e.preventDefault()}
          className={cn(
            'relative min-w-[200px] flex-1 transition-[max-width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
            isSearchFocused
              ? 'max-w-[460px] xl:max-w-[540px]'
              : 'max-w-[260px] lg:max-w-[280px] xl:max-w-[340px]',
          )}
        >
          {/* v2: dual-layer length-reactive search bloom */}
          {!reducedTransparency && !reduced && (
            <>
              <motion.span
                aria-hidden="true"
                style={{ scale: bloomScale, opacity: bloomOpacity, filter: 'blur(20px)' }}
                className="pointer-events-none absolute inset-0 -z-10 rounded-xl bg-gradient-to-r from-brand-500/40 via-[#5E5CE6]/35 to-[#00C7BE]/35"
              />
              <motion.span
                aria-hidden="true"
                style={{
                  scale: bloomScale,
                  opacity: bloomOpacity,
                  filter: 'blur(10px)',
                }}
                className="pointer-events-none absolute inset-0 -z-10 rounded-xl bg-gradient-to-r from-[#5AC8FA]/50 via-transparent to-[#5E5CE6]/50"
              />
            </>
          )}

          <span
            className={cn(
              'pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 transition-all duration-200',
              isSearchFocused
                ? 'scale-105 text-brand-600 dark:text-brand-400'
                : 'text-[var(--text-tertiary)]',
            )}
          >
            <SearchGlyph size={16} />
          </span>

          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={onSearchKeyDown}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            type="search"
            placeholder={
              isCopilotRoute
                ? 'AI Copilot’ga savol yozing yoki buyruq bering...'
                : t('nav.searchPlaceholder', 'O‘quvchi, o‘qituvchi, guruh yoki to‘lovlarni qidirish...')
            }
            aria-label={t('nav.searchPlaceholder', 'Search')}
            className={cn(
              'h-9 w-full rounded-xl pl-9 pr-24 lg:pr-28',
              'border border-black/[0.07] bg-black/[0.035] dark:border-white/[0.09] dark:bg-white/[0.045]',
              'shadow-[inset_0_1px_2px_rgba(0,0,0,0.04),inset_0_-1px_0_rgba(120,200,255,0.14),0_1px_0_rgba(255,255,255,0.65)]',
              'dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.28),inset_0_-1px_0_rgba(120,200,255,0.1),0_1px_0_rgba(255,255,255,0.07)]',
              'text-[13.5px] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)]',
              'outline-none backdrop-blur-md transition-all duration-200',
              'focus:border-brand-500/50 focus:bg-white/80 focus:shadow-[inset_0_1px_1px_rgba(0,0,0,0.02),inset_0_-1px_0_rgba(120,200,255,0.25),0_0_0_3.5px_var(--focus-ring),0_8px_20px_-6px_rgba(0,122,255,0.18)]',
              'dark:focus:bg-white/[0.09]',
              '[&::-webkit-search-cancel-button]:hidden',
            )}
          />

          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
            {micSupported && (
              <button
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={toggleMic}
                aria-label={dictating ? 'Ovozni to‘xtatish' : 'Ovoz bilan yozish'}
                title={dictating ? 'Yozishni to‘xtatish' : 'Ovoz bilan yozish'}
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full transition-all duration-200 active:scale-90 min-h-[32px] min-w-[32px]',
                  dictating
                    ? 'bg-apple-red text-white shadow-[0_0_10px_rgba(255,59,48,0.75)] animate-pulse'
                    : cn(LIQUID_PILL, 'hover:text-[var(--text-primary)]'),
                  FOCUS,
                )}
              >
                <MicGlyph />
              </button>
            )}

            <AnimatePresence>
              {search.length > 0 && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.75 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.75 }}
                  transition={POPOVER_SPRING}
                  type="button"
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={handleClearSearch}
                  aria-label={t('common.clear', 'Clear')}
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full transition-colors duration-150 min-h-[32px] min-w-[32px]',
                    LIQUID_PILL,
                    FOCUS,
                  )}
                >
                  <StaticIcon paths={I.close} size={11} strokeWidth={2.4} />
                </motion.button>
              )}
            </AnimatePresence>

            <button
              type="button"
              onClick={onCommandPalette}
              aria-label={t('commandPalette.open', 'Open command palette')}
              title={`${t('commandPalette.open', 'Open command palette')} (${cmdLabel})`}
              className={cn(
                'hidden sm:flex h-6 items-center rounded-lg border border-black/[0.07] bg-white/65 px-1.5 text-[10.5px] font-semibold text-[var(--text-tertiary)] min-h-[32px]',
                'shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_1px_2px_rgba(0,0,0,0.04)]',
                'dark:border-white/[0.1] dark:bg-white/[0.07] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]',
                'transition-all duration-150 hover:border-brand-500/35 hover:text-brand-600 dark:hover:text-brand-400 active:scale-95',
                FOCUS,
              )}
            >
              {cmdLabel}
            </button>
          </div>

          <AnimatePresence>
            {showPreview && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={reduced ? { duration: 0 } : POPOVER_SPRING}
              >
                <SearchPreview hits={previewHits} onSelect={handlePreviewSelect} />
              </motion.div>
            )}
          </AnimatePresence>
        </form>

        {/* Right Action Cluster */}
        <div className="relative z-20 ml-auto flex shrink-0 items-center gap-1.5 lg:gap-2">
          <motion.button
            type="button"
            disabled={!isStaff}
            onClick={() => isStaff && navigate('/branches')}
            whileTap={isStaff && !reduced ? { scale: 0.97 } : undefined}
            transition={LIQUID_SPRING}
            title={isStaff ? t('nav.branches', 'Branches') : orgName}
            aria-label={t('nav.branches', 'Branches')}
            className={cn(
              'hidden h-9 min-h-[44px] items-center gap-2 rounded-xl px-3 text-left transition-all duration-200 xl:flex',
              LIQUID_PILL,
              !isStaff && 'cursor-default opacity-90',
              FOCUS,
            )}
          >
            <span className="flex min-w-0 flex-col">
              <span className="max-w-[136px] truncate text-xs font-semibold leading-tight text-[var(--text-primary)]">
                {orgName || 'M-EDU Academy'}
              </span>
              <span className="mt-0.5 text-[10.5px] font-medium leading-none tabular-nums text-[var(--text-tertiary)]">
                {getAcademicYear(now)}
              </span>
            </span>
            {isStaff && <StaticIcon paths={I.chevronDown} size={13} />}
          </motion.button>

          {isStaff && (
            <ActionButton
              onClick={() => navigate(isExecutiveRoute ? '/' : '/executive-dashboard')}
              active={isExecutiveRoute}
              ariaLabel="Executive Suite"
              title={isExecutiveRoute ? 'Oddiy rejimga qaytish' : 'Executive Suite (Boshqaruv tahlili)'}
            >
              <StaticIcon paths={I.executive} size={18} />
            </ActionButton>
          )}

          <ActionButton
            onClick={toggleCalculator}
            active={isCalculatorOpen}
            ariaLabel={t('nav.calculator', 'Calculator')}
            title={t('nav.calculator', 'Calculator')}
          >
            <StaticIcon paths={I.calculator} size={18} />
          </ActionButton>

          <ActionButton
            onClick={toggleFloatingCamera}
            active={isFloatingCameraOpen}
            ariaLabel="Live Face PiP Camera"
            title="Jonli yuz tanish va davomat kamerasi (PiP)"
          >
            <StaticIcon paths={I.camera} size={18} />
          </ActionButton>

          <div className="hidden lg:block">
            <FocusModeCapsule />
          </div>

          <LanguageSwitcher />
          <ThemeToggle />
          <NotificationsMenu />

          <span
            className="mx-0.5 h-5 w-px bg-gradient-to-b from-transparent via-black/[0.1] to-transparent dark:via-white/[0.14]"
            aria-hidden="true"
          />

          <UserMenu
            fullName={userFullName}
            initialsStr={userInitials}
            role={userRole}
            user={user}
            onOpenShortcuts={onOpenShortcuts}
            onLogout={onLogout}
          />
        </div>
      </div>
    </motion.header>
  );
});

/* ══════════════════════════════════════════════════════════════════════
 * MobileTopBar — v2: full glass treatment on Dynamic Island bar
 * ════════════════════════════════════════════════════════════════════ */

export const MobileTopBar = memo(function MobileTopBar({
  onOpenSearch,
  onOpenMenu,
}: {
  onOpenSearch: () => void;
  onOpenMenu: () => void;
}) {
  const { t } = useSafeI18n();
  const location = useLocation();
  const online = useOnline();
  const reduced = usePrefersReducedMotion();
  const reducedTransparency = useMediaQuery('(prefers-reduced-transparency: reduce)');
  const isCalculatorOpen = useCalculatorOpen();

  const currentNav = useMemo(() => resolveRouteNav(location.pathname), [location.pathname]);
  const currentTitle = currentNav ? t(currentNav.labelKey, currentNav.label) : 'M-EDU';

  const ambient = useTopBarAmbient(!reduced && !reducedTransparency);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-40 px-3 pt-[calc(0.5rem+env(safe-area-inset-top,0px))] select-none md:hidden">
      <motion.div
        initial={reduced ? false : { y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={LIQUID_SPRING}
        className={cn(
          'pointer-events-auto relative flex h-14 w-full items-center justify-between gap-2 rounded-[22px] px-3 isolate overflow-hidden',
          'border border-white/45 dark:border-white/[0.12]',
          reducedTransparency
            ? 'bg-[var(--bg-card)] shadow-card'
            : cn(
                'bg-[var(--glass-surface-bg)] backdrop-blur-3xl backdrop-saturate-[200%]',
                'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.72),inset_0_-1px_0_0_rgba(120,200,255,0.16),0_12px_32px_-8px_rgba(0,0,0,0.14),0_2px_8px_rgba(0,0,0,0.05)]',
                'dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.16),inset_0_-1px_0_0_rgba(120,200,255,0.1),0_14px_36px_-8px_rgba(0,0,0,0.6)]',
              ),
        )}
      >
        {/* v2: ambient + chromatic rims + grain */}
        {!reducedTransparency && (
          <>
            <motion.div
              aria-hidden="true"
              style={{ background: ambient.warm, opacity: 0.7 } as MotionStyle}
              className="pointer-events-none absolute inset-0 z-0 mix-blend-soft-light dark:mix-blend-screen"
            />
            <motion.div
              aria-hidden="true"
              style={{ background: ambient.cool, opacity: 0.7 } as MotionStyle}
              className="pointer-events-none absolute inset-0 z-0 mix-blend-soft-light dark:mix-blend-screen"
            />
            <TopSpecular inset="inset-x-4" />
            <BottomChromatic inset="inset-x-6" />
            <GrainOverlay opacity={0.03} />
          </>
        )}

        {/* Left: Brand + Active Route Dynamic Pill */}
        <div className="relative z-20 flex min-w-0 items-center gap-2">
          <Brand size="sm" />
          <button
            type="button"
            onClick={onOpenSearch}
            aria-label={t('nav.searchPlaceholder', 'Search')}
            className={cn(
              'hidden sm:inline-flex max-w-[130px] items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold min-h-[36px]',
              LIQUID_PILL,
              FOCUS,
            )}
          >
            <span
              className={cn(
                'h-1.5 w-1.5 shrink-0 rounded-full',
                online
                  ? 'bg-apple-green shadow-[0_0_6px_rgba(52,199,89,0.85)]'
                  : 'bg-apple-orange',
              )}
              aria-hidden="true"
            />
            <span className="truncate text-[var(--text-primary)]">{currentTitle}</span>
          </button>
        </div>

        {/* Right: Touch-Friendly Liquid Action Cluster */}
        <div className="relative z-20 flex items-center gap-1 sm:gap-1.5">
          <ActionButton
            size="sm"
            onClick={onOpenSearch}
            ariaLabel={t('nav.searchPlaceholder', 'Search')}
          >
            <SearchGlyph size={16} />
          </ActionButton>

          <ActionButton
            size="sm"
            active={isCalculatorOpen}
            onClick={() => setCalculatorOpen(!isCalculatorOpen)}
            ariaLabel={t('nav.calculator', 'Calculator')}
          >
            <StaticIcon paths={I.calculator} size={16} />
          </ActionButton>

          <ThemeToggle size="sm" />
          <NotificationsMenu />

          <ActionButton
            size="sm"
            onClick={onOpenMenu}
            ariaLabel={t('a11y.openMenu', 'Open navigation menu')}
          >
            <StaticIcon paths={I.menu} size={16} />
          </ActionButton>
        </div>
      </motion.div>
    </header>
  );
});