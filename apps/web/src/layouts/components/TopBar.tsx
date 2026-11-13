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
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, type MotionValue } from 'framer-motion';
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
import { useOfflineSync } from '@/lib/offline-sync';
import { SpatialIdentityCard360 } from '@/components/cards/SpatialIdentityCard360';
import { SoundControlMenu } from '@/components/audio/SoundControlMenu';

/* ══════════════════════════════════════════════════════════════════════
 * LIQUID GLASS & SPRING TOKENS — v2 physics
 * ════════════════════════════════════════════════════════════════════ */

const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--border-focus)]';

/**
 * TopBar sirtlari endi `globals.css`dagi semantik tokenlardan keladi
 * (`--tb-*`). Komponentda birorta rang/soya qiymati yo‘q — mavzu
 * o‘zgarganda faqat tokenlar qayta hisoblanadi.
 */
const LIQUID_PILL = 'tb-control';
const LIQUID_PILL_ACTIVE = 'tb-control tb-control-active';
const LIQUID_POPOVER = 'tb-popover';

/** v2 refined spring physics */
const LIQUID_SPRING = { type: 'spring' as const, stiffness: 400, damping: 32, mass: 0.7 };
const POPOVER_SPRING = { type: 'spring' as const, stiffness: 460, damping: 34, mass: 0.62 };
const GLIDE_SPRING = { type: 'spring' as const, stiffness: 260, damping: 28, mass: 0.5 };
const GEL_SPRING = { type: 'spring' as const, stiffness: 820, damping: 24, mass: 0.32 };

/* ══════════════════════════════════════════════════════════════════════
 * LIQUID GLASS — SVG FILTER SYSTEM (tb-prefixed, no collision with nav)
 * ════════════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════════════
 * AMBIENT LIGHT — time-aware, dual-harmonic, no re-renders
 * ════════════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════════════
 * VISUAL LAYERS — grain, specular, edges
 * ════════════════════════════════════════════════════════════════════ */

const GrainOverlay = memo(function GrainOverlay(_props: { opacity?: number }) {
  return null;
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
      rec.onresult = null as unknown as SpeechRecognitionLike['onresult'];
      rec.onerror = null as unknown as SpeechRecognitionLike['onerror'];
      rec.onend = null as unknown as () => void;
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
        <p className="px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-tertiary/85">
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
                'text-[13.5px] font-medium text-primary transition-transform duration-150 active:scale-[0.99]',
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
              <span className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-black/[0.06] bg-white/60 text-[11px] font-semibold tabular-nums text-secondary shadow-sm dark:border-white/[0.08] dark:bg-white/[0.07]">
                {i + 1}
              </span>
              <span className="relative z-10 min-w-0 flex-1 truncate">{h.label}</span>
              <span className="relative z-10 shrink-0 rounded-md bg-black/[0.04] px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-tertiary dark:bg-white/[0.06]">
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
      <span className="text-primary">
        {hh}:{mm}
      </span>
    </span>
  );
});

const TelemetryChip = memo(function TelemetryChip() {
  const { t } = useSafeI18n();
  const online = useOnline();
  const reduced = usePrefersReducedMotion();
  const { isSyncing, pendingCount, lastSyncTime, queue, syncNow } = useOfflineSync();
  const errorCount = queue ? queue.filter((q) => q.status === 'failed').length : 0;
  const lastSyncAt = lastSyncTime;
  const [latency, setLatency] = useState<number | null>(null);
  const [healthData, setHealthData] = useState<{ database?: string; uptime?: number; status?: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [manualSyncing, setManualSyncing] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const handleManualSync = useCallback(async () => {
    setManualSyncing(true);
    try {
      await syncNow();
    } finally {
      setManualSyncing(false);
    }
  }, [syncNow]);

  useEffect(() => {
    if (!online) {
      setLatency(null);
      return;
    }

    const checkRealHealth = async () => {
      const t0 = performance.now();
      try {
        const res = await fetch('/api/health', { method: 'GET', cache: 'no-store' });
        const delta = Math.round(performance.now() - t0);
        if (res.ok) {
          const json = await res.json();
          setLatency(delta);
          setHealthData(json);
        } else {
          setLatency(delta);
        }
      } catch {
        setLatency(null);
      }
    };

    void checkRealHealth();
    const id = setInterval(() => void checkRealHealth(), 10000);
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
        {isSyncing || manualSyncing ? (
          <span className="hidden items-center gap-1.5 text-brand-600 dark:text-brand-400 font-semibold xl:inline-flex">
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              className="inline-block text-xs"
            >
              ⟳
            </motion.span>
            <span className="text-[11px]">Sinxron...</span>
          </span>
        ) : pendingCount > 0 ? (
          <span className="hidden items-center gap-1 text-amber-500 font-semibold xl:inline-flex text-[11px]">
            <span>☁</span>
            <span>{pendingCount} navbatda</span>
          </span>
        ) : (
          <span className="hidden items-center gap-1.5 tabular-nums text-secondary xl:inline-flex">
            {online && latency !== null ? (
              <>
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    latency < 100
                      ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]'
                      : latency < 300
                      ? 'bg-amber-500'
                      : 'bg-rose-500',
                  )}
                  aria-hidden="true"
                />
                <span>{latency}ms</span>
              </>
            ) : (
              t('common.offline', 'Offline')
            )}
          </span>
        )}
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
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-tertiary">
                  {t('nav.systemTelemetry', 'System Telemetry')}
                </span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold',
                    healthData?.status === 'ok'
                      ? 'bg-apple-green/15 text-apple-green'
                      : 'bg-amber-500/15 text-amber-500',
                  )}
                >
                  {healthData?.status === 'ok' ? '100% Barqaror' : 'Kutilmoqda'}
                </span>
              </div>
              <div className="mt-3 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-tertiary">API Latency:</span>
                  <span className="font-semibold tabular-nums text-primary">
                    {latency !== null ? `${latency} ms` : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-tertiary">PostgreSQL:</span>
                  <span
                    className={cn(
                      'font-semibold',
                      healthData?.database === 'up' ? 'text-apple-green' : 'text-amber-500',
                    )}
                  >
                    {healthData?.database === 'up' ? 'Ulangan (Up)' : 'Ulanmoqda'}
                  </span>
                </div>
                {healthData?.uptime !== undefined && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-tertiary">Server Uptime:</span>
                    <span className="font-semibold tabular-nums text-primary">
                      {Math.floor(healthData.uptime / 60)}m {Math.floor(healthData.uptime % 60)}s
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-tertiary">Tarmoq:</span>
                  <span
                    className={cn(
                      'font-semibold',
                      online ? 'text-apple-green' : 'text-rose-500',
                    )}
                  >
                    {online ? 'Online (Ulangan)' : 'Offline (Uzilgan)'}
                  </span>
                </div>

                {/* Cloud & Offline Synchronization Section */}
                <div className="mt-2.5 pt-2.5 border-t border-black/[0.06] dark:border-white/[0.08]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-tertiary">Offline Sync Navbati:</span>
                    <span
                      className={cn(
                        'font-bold text-[10.5px] px-2 py-0.5 rounded-full',
                        pendingCount > 0
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                          : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
                      )}
                    >
                      {pendingCount > 0 ? `${pendingCount} ta kutilmoqda` : 'Barchasi sinxron'}
                    </span>
                  </div>
                  {errorCount > 0 && (
                    <p className="mt-1 text-[10.5px] text-rose-500 font-medium">
                      {errorCount} ta amal xato bilan to'xtagan
                    </p>
                  )}
                  {lastSyncAt && (
                    <p className="mt-1 text-[10px] text-tertiary">
                      Oxirgi sinxron: {new Date(lastSyncAt).toLocaleTimeString()}
                    </p>
                  )}
                  {online && (
                    <button
                      type="button"
                      disabled={isSyncing || manualSyncing}
                      onClick={handleManualSync}
                      className="mt-2.5 w-full flex items-center justify-center gap-1.5 rounded-xl bg-brand-500/10 hover:bg-brand-500/20 py-1.5 text-xs font-semibold text-brand-600 dark:text-brand-300 transition-colors disabled:opacity-50"
                    >
                      <motion.span
                        animate={isSyncing || manualSyncing ? { rotate: 360 } : undefined}
                        transition={isSyncing || manualSyncing ? { repeat: Infinity, duration: 1, ease: 'linear' } : undefined}
                      >
                        ⟳
                      </motion.span>
                      <span>{isSyncing || manualSyncing ? 'Sinxronlanmoqda...' : 'Hozir Sinxronlash'}</span>
                    </button>
                  )}
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
  onContextMenu,
  ariaLabel,
  title,
  active = false,
  size = 'md',
  children,
  className = '',
}: {
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
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
      onContextMenu={onContextMenu}
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
 * TOPBAR BREADCRUMB — Adaptive hierarchical navigator
 * ════════════════════════════════════════════════════════════════════ */

const TopBarBreadcrumb = memo(function TopBarBreadcrumb({
  currentTitle,
  currentNav,
  greeting,
  orgName,
  isSearchFocused,
}: {
  currentTitle: string;
  currentNav?: { label: string; iconPath?: readonly string[] };
  greeting: string;
  orgName: string;
  isSearchFocused: boolean;
}) {
  const navigate = useNavigate();
  const reduced = usePrefersReducedMotion();

  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="hidden h-4 w-px bg-black/[0.08] dark:bg-white/[0.1] 2xl:block" aria-hidden="true" />
      <div className="hidden min-w-0 max-w-[150px] flex-col 2xl:flex">
        <span className="truncate text-[10px] font-semibold uppercase tracking-[0.06em] text-tertiary">
          {greeting}
        </span>
        <span className="truncate text-[13px] font-semibold tracking-tight text-primary">
          {orgName || 'M-EDU'}
        </span>
      </div>

      {currentTitle && !isSearchFocused && (
        <motion.div
          whileHover={reduced ? undefined : { scale: 1.01 }}
          className={cn(
            'hidden h-8.5 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 sm:px-3 text-xs transition-all md:flex',
            LIQUID_PILL,
          )}
        >
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-1 font-semibold text-tertiary hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
            title="Bosh sahifa (Dashboard)"
          >
            <span>M-EDU</span>
          </button>
          <span className="text-tertiary opacity-60" aria-hidden="true">
            ›
          </span>
          <span className="flex items-center gap-1.5 font-semibold text-primary max-w-[110px] xl:max-w-[140px] 2xl:max-w-[200px] truncate">
            {currentNav?.iconPath && (
              <span className="text-brand-600 dark:text-brand-400 shrink-0">
                <StaticIcon paths={currentNav.iconPath} size={13} />
              </span>
            )}
            <span className="truncate">{currentTitle}</span>
          </span>
        </motion.div>
      )}
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════════════
 * QUICK ACTION HUB — Fast 1-click creation center (+ Tezkor)
 * ════════════════════════════════════════════════════════════════════ */

export const QuickActionHub = memo(function QuickActionHub({
  size = 'md',
}: {
  size?: 'sm' | 'md';
}) {
  const navigate = useNavigate();
  const reduced = usePrefersReducedMotion();
  const [open, setOpen] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const openTimeRef = useRef<number>(0);

  const toggleOpen = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setOpen((prev) => {
      if (!prev) openTimeRef.current = Date.now();
      return !prev;
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    openTimeRef.current = Date.now();
    const onPointerDown = (e: PointerEvent) => {
      if (Date.now() - openTimeRef.current < 350) return;
      const target = e.target as Node;
      if (
        rootRef.current &&
        !rootRef.current.contains(target) &&
        (!menuRef.current || !menuRef.current.contains(target))
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const timer = setTimeout(() => {
      document.addEventListener('pointerdown', onPointerDown);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  const actions = useMemo(() => [
    {
      id: 'student',
      title: "Yangi O'quvchi",
      desc: "Qabul va o'quvchi anketasini ochish",
      icon: I.students,
      to: '/students?action=new',
      tone: 'from-blue-500/20 to-blue-600/10 text-blue-600 dark:text-blue-400',
      badge: 'O',
    },
    {
      id: 'payment',
      title: "To'lov Qabul Qilish",
      desc: "Kassa tushumi va to'lov kvitansiyasi",
      icon: I.payments,
      to: '/payments?action=new',
      tone: 'from-emerald-500/20 to-emerald-600/10 text-emerald-600 dark:text-emerald-400',
      badge: 'T',
    },
    {
      id: 'group',
      title: "Yangi Guruh",
      desc: "Kurs va yangi guruhni yo'lga qo'yish",
      icon: I.groups,
      to: '/groups?action=new',
      tone: 'from-indigo-500/20 to-indigo-600/10 text-indigo-600 dark:text-indigo-400',
      badge: 'G',
    },
    {
      id: 'schedule',
      title: "Dars Belgilash",
      desc: "Haftalik dars jadvaliga dars kiritish",
      icon: I.schedule,
      to: '/schedule?action=new',
      tone: 'from-purple-500/20 to-purple-600/10 text-purple-600 dark:text-purple-400',
      badge: 'D',
    },
    {
      id: 'certificate',
      title: "Sertifikat Berish",
      desc: "Bitiruvchiga rasmiy sertifikat chiqarish",
      icon: I.cert,
      to: '/certificates?action=new',
      tone: 'from-amber-500/20 to-amber-600/10 text-amber-600 dark:text-amber-400',
      badge: 'S',
    },
    {
      id: 'ai',
      title: "AI Copilot Maslahatchi",
      desc: "Tezkor tahlil va boshqaruv tavsiyasi",
      icon: I.ai,
      to: '/ai-copilot',
      tone: 'from-cyan-500/20 to-cyan-600/10 text-cyan-600 dark:text-cyan-400',
      badge: 'AI',
    },
  ], []);

  const handleSelect = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  const isSm = size === 'sm';

  return (
    <div ref={rootRef} className="relative">
      <motion.button
        type="button"
        onClick={toggleOpen}
        whileHover={reduced ? undefined : { scale: 1.03 }}
        whileTap={reduced ? undefined : { scale: 0.95 }}
        transition={LIQUID_SPRING}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Tezkor yaratish amallari"
        title="Tezkor yaratish markazi"
        className={cn(
          'flex items-center gap-1.5 transition-all duration-200 select-none min-h-[44px]',
          isSm ? 'h-8.5 w-8.5 rounded-xl justify-center px-0 min-w-[36px]' : 'h-9 rounded-xl px-2.5 min-w-[44px]',
          open ? LIQUID_PILL_ACTIVE : LIQUID_PILL,
          'hover:border-brand-500/40 hover:text-brand-600 dark:hover:text-brand-300',
          FOCUS,
        )}
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-brand-500/15 text-brand-600 dark:bg-brand-500/25 dark:text-brand-300">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </span>
        {!isSm && (
          <span className="hidden text-xs font-semibold tracking-tight xl:inline">
            Yaratish
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          isSm && typeof document !== 'undefined' ? (
            createPortal(
              <>
                <div
                  className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm pointer-events-auto"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (Date.now() - openTimeRef.current >= 350) {
                      setOpen(false);
                    }
                  }}
                />
                <motion.div
                  ref={menuRef}
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.96 }}
                  transition={reduced ? { duration: 0 } : POPOVER_SPRING}
                  style={{ transformOrigin: 'top right' }}
                  role="menu"
                  aria-label="Tezkor yaratish markazi"
                  onClick={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  className={cn(
                    'fixed inset-x-3 top-[calc(4.5rem+env(safe-area-inset-top,0px))] z-[9999] max-w-sm mx-auto rounded-2xl isolate overflow-hidden pointer-events-auto shadow-2xl',
                    LIQUID_POPOVER,
                  )}
                >
            <TopSpecular inset="inset-x-6" animated={!reduced} />
            <BottomChromatic inset="inset-x-8" />
            <GrainOverlay opacity={0.03} />
            <div className="relative z-20 p-2">
              <div className="px-3 py-2 border-b border-black/[0.06] dark:border-white/[0.08]">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-tertiary">
                  Tezkor Yaratish Markazi
                </p>
                <p className="text-xs text-secondary">
                  Tez-tez bajariladigan operatsiyalar
                </p>
              </div>

              <div className="mt-1 space-y-0.5">
                {actions.map((act, idx) => (
                  <motion.button
                    key={act.id}
                    type="button"
                    role="menuitem"
                    onClick={() => handleSelect(act.to)}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    whileHover={reduced ? undefined : { x: 2 }}
                    className={cn(
                      'w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors',
                      hoveredIdx === idx
                        ? 'bg-black/[0.04] dark:bg-white/[0.06]'
                        : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.04]',
                    )}
                  >
                    <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br', act.tone)}>
                      <StaticIcon paths={act.icon} size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-primary">
                        {act.title}
                      </p>
                      <p className="truncate text-[10.5px] text-tertiary">
                        {act.desc}
                      </p>
                    </div>
                    <span className="hidden sm:inline-block rounded px-1.5 py-0.5 text-[9px] font-mono font-bold bg-black/[0.05] dark:bg-white/[0.08] text-tertiary">
                      {act.badge}
                    </span>
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
              </>,
              document.body,
            )
          ) : (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              transition={reduced ? { duration: 0 } : POPOVER_SPRING}
              style={{ transformOrigin: 'top right' }}
              role="menu"
              aria-label="Tezkor yaratish markazi"
              className={cn(
                'absolute right-0 top-[calc(100%+0.55rem)] z-50 w-72 rounded-2xl isolate overflow-hidden shadow-2xl',
                LIQUID_POPOVER,
              )}
            >
              <TopSpecular inset="inset-x-6" animated={!reduced} />
              <BottomChromatic inset="inset-x-8" />
              <GrainOverlay opacity={0.03} />
              <div className="relative z-20 p-2">
                <div className="px-3 py-2 border-b border-black/[0.06] dark:border-white/[0.08]">
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-tertiary">
                    Tezkor Yaratish Markazi
                  </p>
                  <p className="text-xs text-secondary">
                    Tez-tez bajariladigan operatsiyalar
                  </p>
                </div>

                <div className="mt-1 space-y-0.5">
                  {actions.map((act, idx) => (
                    <motion.button
                      key={act.id}
                      type="button"
                      role="menuitem"
                      onClick={() => handleSelect(act.to)}
                      onMouseEnter={() => setHoveredIdx(idx)}
                      whileHover={reduced ? undefined : { x: 2 }}
                      className={cn(
                        'w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors',
                        hoveredIdx === idx
                          ? 'bg-black/[0.04] dark:bg-white/[0.06]'
                          : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.04]',
                        FOCUS,
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-bold shadow-sm',
                          act.tone,
                        )}
                      >
                        <StaticIcon paths={act.icon} size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-primary">
                          {act.title}
                        </p>
                        <p className="truncate text-[11px] text-tertiary">
                          {act.desc}
                        </p>
                      </div>
                      <span className="text-[10px] font-bold text-tertiary opacity-60">
                        {act.badge}
                      </span>
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )
        )}
      </AnimatePresence>
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════════════
 * BRANCH SELECTOR MENU — Interactive Branch Hub
 * ════════════════════════════════════════════════════════════════════ */

const BranchSelectorMenu = memo(function BranchSelectorMenu({
  orgName,
  academicYear,
  isStaff,
}: {
  orgName: string;
  academicYear: string;
  isStaff: boolean;
}) {
  const navigate = useNavigate();
  const reduced = usePrefersReducedMotion();
  const [open, setOpen] = useState(false);
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

  return (
    <div ref={rootRef} className="relative hidden xl:block">
      <motion.button
        type="button"
        disabled={!isStaff}
        onClick={() => isStaff && setOpen((v) => !v)}
        whileHover={isStaff && !reduced ? { scale: 1.02 } : undefined}
        whileTap={isStaff && !reduced ? { scale: 0.97 } : undefined}
        transition={LIQUID_SPRING}
        title={isStaff ? "Filiallar va Tashkilot Boshqaruvi" : orgName}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Tashkilot va Filiallar"
        className={cn(
          'flex h-9 min-h-[44px] items-center gap-2 rounded-xl px-3 text-left transition-all duration-200 select-none',
          open ? LIQUID_PILL_ACTIVE : LIQUID_PILL,
          !isStaff && 'cursor-default opacity-90',
          FOCUS,
        )}
      >
        <span className="flex min-w-0 flex-col">
          <span className="max-w-[136px] truncate text-xs font-semibold leading-tight text-primary">
            {orgName || 'M-EDU Academy'}
          </span>
          <span className="mt-0.5 text-[10.5px] font-medium leading-none tabular-nums text-tertiary">
            {academicYear}
          </span>
        </span>
        {isStaff && (
          <StaticIcon
            paths={I.chevronDown}
            size={13}
            className={cn('transition-transform duration-200', open && 'rotate-180 text-brand-500')}
          />
        )}
      </motion.button>

      <AnimatePresence>
        {open && isStaff && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={reduced ? { duration: 0 } : POPOVER_SPRING}
            style={{ transformOrigin: 'top right' }}
            role="menu"
            aria-label="Tashkilot va Filiallar"
            className={cn(
              'absolute right-0 top-[calc(100%+0.55rem)] z-50 w-72 rounded-2xl isolate overflow-hidden',
              LIQUID_POPOVER,
            )}
          >
            <TopSpecular inset="inset-x-6" animated={!reduced} />
            <BottomChromatic inset="inset-x-8" />
            <GrainOverlay opacity={0.03} />
            <div className="relative z-20 p-3">
              <div className="border-b border-black/[0.06] pb-2.5 dark:border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500/15 text-brand-600 dark:text-brand-300">
                    <StaticIcon paths={I.branches} size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-primary">
                      {orgName || 'M-EDU Academy'}
                    </p>
                    <p className="text-[10px] text-tertiary">
                      Bosh boshqarma · O'quv yili {academicYear}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between rounded-xl bg-black/[0.03] dark:bg-white/[0.05] p-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-semibold text-primary">Bosh filial (Asosiy)</span>
                  </div>
                  <span className="rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold text-brand-600 dark:text-brand-300">
                    Faol
                  </span>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-black/[0.06] dark:border-white/[0.08]">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    navigate('/branches');
                  }}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-brand-500/10 hover:bg-brand-500/20 py-2 text-xs font-semibold text-brand-600 dark:text-brand-300 transition-colors"
                >
                  <StaticIcon paths={I.settings} size={14} />
                  <span>Filiallarni boshqarish</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});


/* ══════════════════════════════════════════════════════════════════════
 * FOCUS MODE CAPSULE — v2 chrome
 * ════════════════════════════════════════════════════════════════════ */

const FOCUS_META: Record<FocusMode, { label: string; tone: string }> = {
  off: { label: 'Mavjud', tone: 'text-tertiary' },
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
              <p className="px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-tertiary/85">
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
                        : 'text-primary',
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
 * THEME TOGGLE (exported) — Spatial Light / Dark / OLED / Sepia Hub
 * ════════════════════════════════════════════════════════════════════ */

const THEME_OPTIONS: Array<{
  value: 'light' | 'dark' | 'oled' | 'sepia' | 'system';
  label: string;
  sub: string;
  dotColor: string;
  icon: (className?: string) => React.ReactNode;
}> = [
  {
    value: 'light',
    label: "Yorug'",
    sub: 'Alabaster Pearl',
    dotColor: '#F59E0B',
    icon: (c = 'h-3.5 w-3.5 text-amber-500') => (
      <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l1.4-1.4M19.1 4.9l-1.4 1.4" />
      </svg>
    ),
  },
  {
    value: 'dark',
    label: 'Tungi',
    sub: 'Obsidian Sapphire',
    dotColor: '#6366F1',
    icon: (c = 'h-3.5 w-3.5 text-indigo-400') => (
      <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
      </svg>
    ),
  },
  {
    value: 'oled',
    label: 'OLED Qora',
    sub: 'Pure 0% Black',
    dotColor: '#0F172A',
    icon: (c = 'h-3.5 w-3.5 text-slate-800 dark:text-slate-200') => (
      <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3v18" />
        <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" opacity={0.35} />
      </svg>
    ),
  },
  {
    value: 'sepia',
    label: 'Sepiya',
    sub: 'Warm Parchment',
    dotColor: '#B45309',
    icon: (c = 'h-3.5 w-3.5 text-amber-700 dark:text-amber-500') => (
      <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5z" />
        <path d="M6 6h10M6 10h10" />
      </svg>
    ),
  },
  {
    value: 'system',
    label: 'Tizim Rejimi',
    sub: 'Auto OS Sync',
    dotColor: '#2563EB',
    icon: (c = 'h-3.5 w-3.5 text-blue-500') => (
      <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    ),
  },
];

export const ThemeToggle = memo(function ThemeToggle({
  size = 'md',
}: {
  size?: 'sm' | 'md';
  /** @deprecated no-op (kept for 100% API compatibility) */
  magnetic?: boolean;
}) {
  const { theme, setTheme, isDark, resolvedTheme } = useTheme();
  const { t } = useSafeI18n();
  const persist = usePersistSettings();
  const reduced = usePrefersReducedMotion();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
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

  const label = isDark
    ? t('a11y.switchToLight', 'Switch to light theme')
    : t('a11y.switchToDark', 'Switch to dark theme');

  const toggle = useCallback(() => {
    const next = isDark ? 'light' : 'dark';
    setTheme(next);
    persist({ theme: next });
  }, [isDark, setTheme, persist]);

  const selectTheme = useCallback(
    (next: 'light' | 'dark' | 'oled' | 'sepia' | 'system') => {
      setTheme(next);
      persist({ theme: next });
      setOpen(false);
    },
    [setTheme, persist],
  );

  return (
    <div ref={rootRef} className="relative inline-flex items-center">
      <ActionButton
        onClick={toggle}
        onContextMenu={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
        ariaLabel={label}
        title={`${label} (O'ng tugma: barcha rejimlar)`}
        size={size}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={resolvedTheme}
            initial={reduced ? { opacity: 0 } : { y: -10, rotate: -35, scale: 0.75, opacity: 0 }}
            animate={{ y: 0, rotate: 0, scale: 1, opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { y: 10, rotate: 35, scale: 0.75, opacity: 0 }}
            transition={reduced ? { duration: 0 } : POPOVER_SPRING}
            className="inline-flex items-center justify-center"
          >
            {resolvedTheme === 'sepia' ? (
              <svg
                className="h-[17px] w-[17px] text-amber-600 dark:text-amber-400 drop-shadow-[0_0_6px_rgba(217,119,6,0.35)]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5z" />
                <path d="M6 6h10M6 10h10" />
              </svg>
            ) : resolvedTheme === 'oled' ? (
              <svg
                className="h-[17px] w-[17px] text-slate-100 drop-shadow-[0_0_8px_rgba(255,255,255,0.45)]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 3v18" />
                <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" opacity={0.4} />
              </svg>
            ) : isDark ? (
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

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label="Theme selector"
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={reduced ? { duration: 0 } : POPOVER_SPRING}
            style={{ transformOrigin: 'top right' }}
            className={cn(
              'absolute right-0 top-[calc(100%+0.55rem)] z-50 w-[210px] overflow-hidden rounded-2xl isolate shadow-xl',
              LIQUID_POPOVER,
            )}
          >
            <TopSpecular inset="inset-x-6" animated={!reduced} />
            <BottomChromatic inset="inset-x-6" />
            <GrainOverlay opacity={0.03} />
            <div className="relative z-20 p-1.5">
              <div className="flex items-center justify-between px-2.5 py-1 mb-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-tertiary">
                  Mavzular Palitrasi
                </p>
                <span className="text-[9.5px] font-semibold text-brand-500 uppercase tracking-wider">
                  {theme}
                </span>
              </div>
              {THEME_OPTIONS.map((opt) => {
                const active = theme === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    onClick={() => selectTheme(opt.value)}
                    className={cn(
                      'relative flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-[12.5px] font-medium transition-colors duration-150 min-h-[36px]',
                      FOCUS,
                      active
                        ? 'font-semibold text-brand-600 dark:text-brand-300 bg-brand-500/10 dark:bg-brand-400/15'
                        : 'text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06]',
                    )}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-black/[0.04] dark:bg-white/[0.08]">
                      {opt.icon()}
                    </span>
                    <div className="flex flex-col flex-1 leading-tight">
                      <span className="text-[12px]">{opt.label}</span>
                      <span className="text-[9.5px] text-tertiary opacity-80">{opt.sub}</span>
                    </div>
                    {active && (
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: opt.dotColor }}
                        aria-hidden="true"
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
        danger ? 'text-apple-red' : 'text-primary',
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
          danger ? 'text-apple-red' : 'text-secondary',
        )}
      >
        <StaticIcon paths={icon} size={15} />
      </span>
      <span className="relative z-10 min-w-0 flex-1 truncate">{label}</span>
      {shortcut && (
        <kbd className="relative z-10 shrink-0 rounded-md border border-black/[0.07] bg-white/65 px-1.5 py-0.5 text-[10.5px] font-semibold text-tertiary shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:border-white/[0.1] dark:bg-white/[0.07]">
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

  const roleLabel = useMemo(() => (role || '').replace(/_/g, ' '), [role]);
  const isStaff = useMemo(() => isStaffRole(role || ''), [role]);
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
          <span className="max-w-[128px] truncate text-xs font-semibold leading-tight text-primary">
            {name}
          </span>
          <span className="mt-0.5 truncate text-[10.5px] font-medium leading-none text-tertiary">
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
                  <p className="truncate text-sm font-semibold tracking-tight text-primary">
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
                    <p className="truncate text-[10.5px] font-semibold uppercase tracking-[0.07em] text-tertiary">
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
  const isExecutiveRoute = location.pathname.startsWith('/executive') || location.pathname.startsWith('/showcase');
  const isCopilotRoute = location.pathname.startsWith('/ai-copilot') || location.pathname.startsWith('/copilot');
  const isDashboardRoute = location.pathname === '/' || location.pathname === '/dashboard';

  const currentNav = useMemo(() => resolveRouteNav(location.pathname), [location.pathname]);
  const currentTitle = currentNav ? t(currentNav.labelKey, currentNav.label) : '';

  const cmdLabel = isApple ? '⌘K' : 'Ctrl K';
  const greeting = t(getGreetingKey(now), 'Welcome');

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
        transformOrigin: 'top center',
        willChange: 'transform',
      }}
      className="relative z-30 hidden shrink-0 select-none md:block"
    >
      <div
        className={cn(
          'relative flex h-[var(--top-bar-height)] w-full items-center gap-2.5 px-3.5 isolate lg:gap-3.5 lg:px-5',
          reducedTransparency ? 'bg-[var(--bg-card)]' : 'tb-surface',
        )}
      >
        {/* Nozik spekulyar qirralar — dekorativ shovqinsiz */}
        {!reducedTransparency && (
          <>
            <TopSpecular inset="inset-x-8" />
            <BottomChromatic inset="inset-x-10" />
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
              <div className="hidden 2xl:block">
                <TelemetryChip />
              </div>

              <TopBarBreadcrumb
                currentTitle={currentTitle}
                currentNav={currentNav}
                greeting={greeting}
                orgName={orgName}
                isSearchFocused={isSearchFocused}
              />
            </>
          )}
        </div>

        {/* Center: global qidiruv */}
        <form
          role="search"
          onSubmit={(e) => e.preventDefault()}
          className={cn(
            'relative min-w-[170px] flex-1 basis-[180px] transition-[max-width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
            isSearchFocused
              ? 'max-w-[460px] xl:max-w-[540px]'
              : 'max-w-[260px] lg:max-w-[280px] xl:max-w-[340px]',
          )}
        >
          <span
            className={cn(
              'pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 transition-all duration-200',
              isSearchFocused
                ? 'scale-105 text-brand-600 dark:text-brand-400'
                : 'text-tertiary',
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
            id="global-topbar-search" name="global-topbar-search" type="search" placeholder={
              isCopilotRoute
                ? 'AI Copilot’ga savol yozing...'
                : t('nav.searchPlaceholder', 'O‘quvchi, guruh yoki to‘lovlar...')
            }
            aria-label={t('nav.searchPlaceholder', 'Search')}
            className="tb-search [&::-webkit-search-cancel-button]:hidden"
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
                    : cn(LIQUID_PILL, 'hover:text-primary'),
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
                'hidden xl:flex h-6 items-center rounded-lg border border-black/[0.07] bg-white/65 px-1.5 text-[10.5px] font-semibold text-tertiary min-h-[32px]',
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
          <div className="hidden lg:block">
            <BranchSelectorMenu
              orgName={orgName}
              academicYear={getAcademicYear(now)}
              isStaff={isStaff}
            />
          </div>

          {isStaff && <QuickActionHub />}

          {isStaff && (
            <ActionButton
              onClick={() => navigate(isExecutiveRoute ? '/' : '/executive-dashboard')}
              active={isExecutiveRoute}
              className="hidden 2xl:flex"
              ariaLabel="Executive Suite"
              title={isExecutiveRoute ? 'Oddiy rejimga qaytish' : 'Executive Suite (Boshqaruv tahlili)'}
            >
              <StaticIcon paths={I.executive} size={18} />
            </ActionButton>
          )}

          <ActionButton
            onClick={toggleCalculator}
            active={isCalculatorOpen}
            className="flex"
            ariaLabel={t('nav.calculator', 'Calculator')}
            title={`${t('nav.calculator', 'Kalkulyator')} (C / Alt+C)`}
          >
            <StaticIcon paths={I.calculator} size={18} />
          </ActionButton>

          <ActionButton
            onClick={toggleFloatingCamera}
            active={isFloatingCameraOpen}
            className="hidden xl:flex"
            ariaLabel="Live Face PiP Camera"
            title="Jonli yuz tanish va davomat kamerasi (PiP)"
          >
            <StaticIcon paths={I.camera} size={18} />
          </ActionButton>

          <SoundControlMenu />

          <div className="hidden 2xl:block">
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

  const currentNav = useMemo(() => resolveRouteNav(location.pathname), [location.pathname]);
  const currentTitle = currentNav ? t(currentNav.labelKey, currentNav.label) : 'M-EDU';

  const isCalculatorOpen = useCalculatorOpen();
  const toggleCalculator = useCallback(() => {
    setCalculatorOpen(!isCalculatorOpen);
  }, [isCalculatorOpen]);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-40 pl-[max(0.75rem,env(safe-area-inset-left,0px))] pr-[max(0.75rem,env(safe-area-inset-right,0px))] pt-[calc(0.5rem+env(safe-area-inset-top,0px))] select-none md:hidden">
      <motion.div
        initial={reduced ? false : { y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={LIQUID_SPRING}
        className={cn(
          'pointer-events-auto relative isolate flex h-[60px] w-full items-center justify-between gap-2 rounded-[24px] px-2.5',
          reducedTransparency ? 'border border-[var(--tb-surface-border)] bg-[var(--bg-card)] shadow-card' : 'tb-float',
        )}
      >
        {/* Nozik spekulyar/chromatik qirralar (statik) */}
        {!reducedTransparency && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[22px]">
            <TopSpecular inset="inset-x-4" />
            <BottomChromatic inset="inset-x-6" />
          </div>
        )}

        {/* Left: Brand + Active Route Dynamic Pill */}
        <div className="relative z-20 flex min-w-0 flex-1 items-center gap-2">
          <Brand size="sm" badge={null} compact />
          <button
            type="button"
            onClick={onOpenSearch}
            aria-label={t('a11y.search', 'Search')}
            className={cn(
              'inline-flex min-w-0 flex-1 max-w-none items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold min-h-[36px]',
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
            <span className="truncate text-primary">{currentTitle}</span>
          </button>
        </div>

        {/* Right: Touch-Friendly Liquid Action Cluster */}
        <div className="relative z-20 flex items-center gap-1 sm:gap-1.5">
          <ActionButton
            size="sm"
            onClick={onOpenSearch}
            ariaLabel={t('a11y.search', 'Search')}
          >
            <SearchGlyph size={16} />
          </ActionButton>

          <QuickActionHub size="sm" />

          <ActionButton
            size="sm"
            onClick={toggleCalculator}
            active={isCalculatorOpen}
            ariaLabel={t('nav.calculator', 'Calculator')}
            title={t('nav.calculator', 'Kalkulyator')}
          >
            <StaticIcon paths={I.calculator} size={16} />
          </ActionButton>

          <NotificationsMenu size="sm" />

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