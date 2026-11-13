/**
 * ============================================================================
 * DashboardHeader v3.1 — Apple Executive Command Center (Hyper-Refractive Liquid Glass)
 * ============================================================================
 */

import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { RefreshCw, FileText, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/design';
import { useSafeI18n } from '@/i18n/I18nProvider';
import type { DashboardStats } from '@/lib/types';
import { ExecutiveBriefingModal } from '@/components/dashboard/ExecutiveBriefingModal';
import { useLiquidGlassLens } from '@/layouts/core/liquidGlassOptics';
import { DashboardGlassLayers, useDashboardGlassCard } from './DashboardGlass';

export interface DashboardHeaderProps {
  userName?: string;
  orgName?: string;
  stats?: DashboardStats;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const EMPTY_STATS: Readonly<DashboardStats> = Object.freeze({}) as DashboardStats;

const DATE_FORMATTER = new Intl.DateTimeFormat('uz-UZ', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
});

const TIME_FORMATTER = new Intl.DateTimeFormat('uz-UZ', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function resolveTranslation(
  t: (key: string) => string,
  key: string,
  fallback: string
): string {
  try {
    const translated = t(key);
    return !translated || translated === key ? fallback : translated;
  } catch {
    return fallback;
  }
}

function getGreetingConfig(hour: number) {
  if (hour >= 5 && hour < 11) return { key: 'dashboard.goodMorning', fallback: 'Xayrli tong' };
  if (hour >= 11 && hour < 17) return { key: 'dashboard.goodAfternoon', fallback: 'Xayrli kun' };
  if (hour >= 17 && hour < 22) return { key: 'dashboard.goodEvening', fallback: 'Xayrli oqshom' };
  return { key: 'dashboard.goodNight', fallback: 'Xayrli tun' };
}

/* ────────────────────────────────────────────────────────────────────────── *
 *  LIVE CLOCK — adaptive pill (mobile → desktop)
 * ────────────────────────────────────────────────────────────────────────── */

const LiveClock = memo(function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  const pillRef = useRef<HTMLDivElement | null>(null);
  useLiquidGlassLens(pillRef, { radius: 12, bezel: 8, refraction: 1.1 });

  useEffect(() => {
    let timeoutId: number | null = null;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      setNow(new Date());
      timeoutId = window.setTimeout(tick, 1000 - (Date.now() % 1000));
    };
    const start = () => {
      if (cancelled || timeoutId !== null) return;
      tick();
    };
    const stop = () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') start();
      else stop();
    };

    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const formattedDate = DATE_FORMATTER.format(now);
  const formattedTime = TIME_FORMATTER.format(now);

  return (
    <div
      ref={pillRef}
      className={cn(
        'lgx lgx--clear order-2 inline-flex h-10 flex-1 shrink-0 items-center gap-1.5 rounded-xl px-2.5 sm:order-1 sm:flex-none sm:gap-2 sm:px-3',
      )}
    >
      <span aria-hidden="true" className="lgx__rim" />
      {/* Live status dot */}
      <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full rounded-full bg-[#34C759] motion-safe:animate-[livePulse_2.4s_ease-in-out_infinite]" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#34C759]" />
      </span>

      <span className="hidden text-[11px] font-bold uppercase tracking-[0.08em] text-[#34C759] sm:inline dark:text-[#30D158]">
        Live
      </span>

      <span
        className="hidden h-3 w-px bg-black/10 sm:block dark:bg-white/15"
        aria-hidden="true"
      />

      <time
        dateTime={now.toISOString()}
        aria-label={`Hozirgi vaqt: ${formattedTime}, ${formattedDate}`}
        className="whitespace-nowrap text-[12.5px] sm:text-[13px] font-bold tabular-nums tracking-tight text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,#F5F5F7)]"
      >
        {formattedTime}
      </time>

      <span className="hidden whitespace-nowrap text-[12px] font-semibold text-[var(--text-secondary,#86868B)] lg:inline">
        · {formattedDate}
      </span>
    </div>
  );
});

/* ────────────────────────────────────────────────────────────────────────── *
 *  HEADER
 * ────────────────────────────────────────────────────────────────────────── */

export const DashboardHeader = memo(function DashboardHeader({
  userName,
  orgName = 'M-EDU',
  stats,
  onRefresh,
  isRefreshing = false,
}: DashboardHeaderProps) {
  const { t } = useSafeI18n();
  const [isBriefingOpen, setIsBriefingOpen] = useState(false);
  const [currentHour, setCurrentHour] = useState(() => new Date().getHours());
  const headerRef = useDashboardGlassCard<HTMLElement>({ dispersion: 5 });

  useEffect(() => {
    const sync = () => {
      const h = new Date().getHours();
      setCurrentHour((prev) => (prev !== h ? h : prev));
    };
    const id = window.setInterval(sync, 60_000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') sync();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;
        e.preventDefault();
        setIsBriefingOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const greeting = useMemo(() => getGreetingConfig(currentHour), [currentHour]);
  const openBriefing = useCallback(() => setIsBriefingOpen(true), []);
  const closeBriefing = useCallback(() => setIsBriefingOpen(false), []);

  const isMac =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  const modKey = isMac ? '⌘' : 'Ctrl';

  const greetingText = resolveTranslation(t, greeting.key, greeting.fallback);
  const displayUser =
    userName?.trim() || resolveTranslation(t, 'dashboard.defaultUser', 'Ustoz');
  const badgeSubtitle = resolveTranslation(t, 'dashboard.orgSubtitle', 'Ta\'lim boshqaruvi');
  const subtitleText = resolveTranslation(
    t,
    'dashboard.headerSubtitle',
    'Bugungi ta\'lim jarayonlari, real vaqt davomati va asosiy moliyaviy ko\'rsatkichlar tahlili.'
  );
  const briefingLabel = resolveTranslation(t, 'dashboard.briefing', 'Tahliliy Hisobot');
  const refreshLabel = resolveTranslation(t, 'common.refresh', 'Yangilash');

  const orgInitial = (orgName.charAt(0) || 'M').toUpperCase();

  return (
    <header
      ref={headerRef}
      className={cn(
        'lgx lgx--clear relative isolate overflow-hidden rounded-[2rem] p-4 sm:p-6 lg:p-7.5',
      )}
    >
      <DashboardGlassLayers />

      {/* ── Neutral volume: light pools in the slab, not a colour wash ── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.34),transparent_70%)] blur-3xl dark:bg-[radial-gradient(circle,rgba(255,255,255,0.10),transparent_70%)]" />
        <div className="absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.20),transparent_70%)] blur-3xl dark:bg-[radial-gradient(circle,rgba(255,255,255,0.06),transparent_70%)]" />
      </div>

      <div className="relative flex flex-col gap-4 sm:gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
        {/* ══ Left Column: Identity · Greeting · Subtitle ═══════════ */}
        <div className="min-w-0 flex-1 space-y-3 sm:space-y-4">
          {/* Identity badge */}
          <div
            className="motion-safe:animate-[headerFadeUp_420ms_cubic-bezier(0.22,1,0.36,1)_both] inline-flex max-w-full items-center gap-2 sm:gap-2.5 rounded-full border border-black/[0.06] bg-white/70 py-1.5 pl-1.5 pr-3.5 backdrop-blur-2xl dark:border-white/[0.1] dark:bg-white/[0.07]"
            style={{ animationDelay: '0ms' }}
          >
            <span
              aria-hidden="true"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0A84FF] to-[#5E5CE6] text-[11px] font-bold text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.5),0_2px_6px_rgba(0,102,255,0.4)]"
            >
              {orgInitial}
            </span>
            <span className="truncate text-[12px] font-semibold tracking-tight text-[var(--text-secondary,#515154)] dark:text-[var(--text-secondary,#A1A1A6)]">
              <strong className="font-bold text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,#F5F5F7)]">
                {orgName}
              </strong>
              <span className="mx-1.5 opacity-40" aria-hidden="true">
                ·
              </span>
              <span className="opacity-80">{badgeSubtitle}</span>
            </span>
          </div>

          {/* Greeting */}
          <h1
            className="motion-safe:animate-[headerFadeUp_420ms_cubic-bezier(0.22,1,0.36,1)_both] truncate text-[26px] sm:text-[32px] lg:text-[34px] font-bold leading-[1.1] tracking-[-0.035em] text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,#F5F5F7)]"
            style={{ animationDelay: '80ms' }}
          >
            <span key={greeting.key} className="motion-safe:animate-[greetingFade_400ms_ease-out]">
              {greetingText}
            </span>
            ,{' '}
            <span className="bg-gradient-to-br from-[#0A84FF] to-[#5E5CE6] bg-clip-text text-transparent dark:from-[#409CFF] dark:to-[#9B8AFF]">
              {displayUser}
            </span>
            <span className="ml-0.5" aria-hidden="true">
              !
            </span>
          </h1>

          {/* Subtitle */}
          <p
            className="motion-safe:animate-[headerFadeUp_420ms_cubic-bezier(0.22,1,0.36,1)_both] line-clamp-2 max-w-2xl text-[13px] sm:text-[14px] leading-relaxed text-balance text-[var(--text-secondary,#515154)] sm:line-clamp-none dark:text-[var(--text-secondary,#A1A1A6)]"
            style={{ animationDelay: '140ms' }}
          >
            {subtitleText}
          </p>
        </div>

        {/* ══ Right Column: Action Bar ══════════════════════════════ */}
        <div
          className="action-bar motion-safe:animate-[headerFadeUp_420ms_cubic-bezier(0.22,1,0.36,1)_both] w-full gap-2 lg:w-auto lg:flex-nowrap lg:shrink-0"
          style={{ animationDelay: '200ms' }}
        >
          <LiveClock />

          {/* Primary — Executive Briefing */}
          <motion.button
            type="button"
            onClick={openBriefing}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            aria-keyshortcuts="Meta+K Control+K"
            data-action="primary"
            className={cn(
              'group relative order-1 inline-flex h-10 min-w-0 basis-full flex-1 items-center justify-center gap-1.5 overflow-hidden rounded-xl px-3 sm:order-2 sm:basis-auto sm:px-4 lg:flex-initial',
              'text-[13px] font-semibold text-white',
              'bg-[var(--primary)]',
              'shadow-[var(--shadow-brand)]',
              'transition-[background-color,box-shadow] duration-200 ease-out',
              'hover:bg-[var(--primary-hover)] active:bg-[var(--primary-active)]',
              'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(10,132,255,0.5)] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#1C1C1E]'
            )}
          >
            {/* Hover sheen sweep */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full motion-reduce:hidden"
            />

            <FileText
              className="relative h-4 w-4 shrink-0"
              strokeWidth={2.4}
              aria-hidden="true"
            />
            <span className="relative truncate">{briefingLabel}</span>
            <Sparkles
              className="relative hidden h-3.5 w-3.5 shrink-0 text-white/90 transition-opacity duration-200 group-hover:opacity-100 sm:inline"
              strokeWidth={2.2}
              aria-hidden="true"
            />
            <kbd className="relative ml-1 hidden items-center gap-0.5 rounded-md bg-white/25 px-1.5 py-0.5 text-[10.5px] font-bold tracking-tight text-white lg:inline-flex">
              {modKey}K
            </kbd>
          </motion.button>

          {/* Refresh */}
          {onRefresh && (
            <motion.button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.93 }}
              aria-label={refreshLabel}
              aria-busy={isRefreshing}
              title={refreshLabel}
              data-action="utility"
              className={cn(
                'group order-3 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                'border border-white/60 bg-white/75 text-[var(--text-secondary,#515154)]',
                'shadow-[inset_0_1.5px_1.5px_rgba(255,255,255,0.9),0_4px_16px_-4px_rgba(0,0,0,0.06)]',
                'hover:bg-white hover:text-[var(--text-primary,#1D1D1F)]',
                'dark:border-white/[0.15] dark:bg-white/[0.06] dark:text-[var(--text-secondary,#A1A1A6)]',
                'dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)] dark:hover:bg-white/[0.12] dark:hover:text-white',
                'transition-[background-color,color] duration-200 ease-out',
                'disabled:pointer-events-none disabled:opacity-45',
                'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(10,132,255,0.5)] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#1C1C1E]'
              )}
            >
              <RefreshCw
                className={cn(
                  'h-4 w-4 transition-transform duration-300 motion-reduce:transition-none',
                  isRefreshing
                    ? 'animate-spin text-[var(--primary,#007AFF)]'
                    : 'group-hover:rotate-90'
                )}
                strokeWidth={2.2}
                aria-hidden="true"
              />
            </motion.button>
          )}
        </div>
      </div>

      <ExecutiveBriefingModal
        isOpen={isBriefingOpen}
        onClose={closeBriefing}
        stats={stats || EMPTY_STATS}
        userName={userName}
        orgName={orgName}
      />

      {/* Scoped keyframes */}
      <style>{`
        @keyframes headerFadeUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes greetingFade {
          from { opacity: 0; transform: translateY(-2px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.55; transform: scale(1.25); }
        }
      `}</style>
    </header>
  );
});

export default DashboardHeader;