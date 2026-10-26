/**
 * M-EDU Early Warning Page
 * Automated early warning rules, student risk alerts, and preventive interventions.
 */

import {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  type SVGProps,
} from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useToast } from '@/components/ui/GlassToast';
import request from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessages';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { usePrefersReducedMotion, cn } from '@/lib/design';
import { openSidecar } from '@/stores/ui.store';

/* ============================================================================
 * MOTION TOKENS ( Physics)
 * ========================================================================== */

const SPRING_PHYSICS = {
  snappy: { type: 'spring' as const, stiffness: 420, damping: 32, mass: 0.8 },
  smooth: { type: 'spring' as const, stiffness: 320, damping: 30, mass: 0.9 },
  gentle: { type: 'spring' as const, stiffness: 220, damping: 28, mass: 1.0 },
};

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.05 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
  },
};

/* ============================================================================
 * TYPES & INTERFACES
 * ========================================================================== */

export interface EarlyWarning {
  id: string;
  rule: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  entityType: string;
  entityId: string;
  detectedAt: string;
  resolved: boolean;
}

export interface EarlyWarningSummary {
  open: number;
  critical: number;
  high: number;
  resolvedThisWeek: number;
  total: number;
}

export type SeverityFilter = 'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/* ============================================================================
 * PURE EXPORTED HELPERS (Zero Dependencies, Fully Testable)
 * ========================================================================== */

export function getSeverityStyle(severity: EarlyWarning['severity']): {
  label: string;
  badgeStyle: string;
  dotStyle: string;
  glow: string;
} {
  switch (severity) {
    case 'CRITICAL':
      return {
        label: 'Critical',
        badgeStyle: 'bg-rose-500/10 text-rose-600 ring-rose-500/30 dark:text-rose-400',
        dotStyle: 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.8)]',
        glow: 'rgba(244,63,94,0.3)',
      };
    case 'HIGH':
      return {
        label: 'High',
        badgeStyle: 'bg-amber-500/10 text-amber-600 ring-amber-500/30 dark:text-amber-400',
        dotStyle: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]',
        glow: 'rgba(245,158,11,0.3)',
      };
    case 'MEDIUM':
      return {
        label: 'Medium',
        badgeStyle: 'bg-blue-500/10 text-blue-600 ring-blue-500/30 dark:text-blue-400',
        dotStyle: 'bg-blue-500',
        glow: 'rgba(59,130,246,0.3)',
      };
    case 'LOW':
    default:
      return {
        label: 'Low',
        badgeStyle: 'bg-neutral-500/10 text-neutral-600 ring-neutral-500/30 dark:text-neutral-400',
        dotStyle: 'bg-neutral-400',
        glow: 'rgba(115,115,115,0.2)',
      };
  }
}

export function formatWarningDate(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

/* ============================================================================
 * SVG ICONS
 * ========================================================================== */

const ICONS = {
  warningTriangle: [
    'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z',
    'M12 9v4',
    'M12 17h.01',
  ],
  radar: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z',
    'M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    'M12 2v2',
  ],
  scan: [
    'M21.5 2v6h-6',
    'M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67',
  ],
  checkCircle: [
    'M22 11.08V12a10 10 0 1 1-5.93-9.14',
    'M22 4 12 14.01l-3-3',
  ],
  shieldAlert: [
    'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    'M12 8v4',
    'M12 16h.01',
  ],
  sparkles: [
    'M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z',
    'M18.5 3.5v3',
    'M20 5h-3',
    'M5.5 18v2.5',
    'M6.75 19.25h-2.5',
  ],
  search: [
    'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  ],
  eye: [
    'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z',
    'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  ],
};

function Icon({
  paths,
  size = 18,
  className = '',
  strokeWidth = 1.8,
  ...rest
}: {
  paths: string[];
  size?: number;
  className?: string;
  strokeWidth?: number;
} & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

/* ============================================================================
 * AURORA MESH BACKGROUND (Atmospheric Canvas)
 * ========================================================================== */

function AuroraMesh() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className="absolute -left-[10%] -top-[15%] h-[560px] w-[560px] rounded-full bg-gradient-to-br from-amber-500/12 via-orange-500/8 to-transparent blur-[120px] dark:from-amber-600/16 dark:via-orange-600/10" />
      <div className="absolute -right-[10%] top-[30%] h-[520px] w-[520px] rounded-full bg-gradient-to-bl from-rose-500/12 via-red-500/8 to-transparent blur-[120px] dark:from-rose-600/16 dark:via-red-600/10" />
      <div className="absolute bottom-[-15%] left-[25%] h-[480px] w-[480px] rounded-full bg-gradient-to-tr from-purple-500/10 via-indigo-500/6 to-transparent blur-[110px] dark:from-purple-600/14" />
    </div>
  );
}

/* ============================================================================
 * COUNT UP COMPONENT
 * ========================================================================== */

function CountUp({
  value,
  duration = 0.85,
  suffix = '',
}: {
  value: number;
  duration?: number;
  suffix?: string;
}) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef<number | null>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      return;
    }
    let raf: number;
    startRef.current = null;
    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const progress = Math.min(1, (ts - startRef.current) / (duration * 1000));
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplay(value * eased);
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduced]);

  return (
    <span className="tabular-nums font-semibold">
      {Math.round(display).toLocaleString()}
      {suffix}
    </span>
  );
}

/* ============================================================================
 * SHIMMER SKELETON
 * ========================================================================== */

function EarlyWarningSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true">
      <div className="h-36 w-full rounded-3xl bg-neutral-200/60 dark:bg-white/[0.04]" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-24 rounded-2xl bg-neutral-200/60 dark:bg-white/[0.04]"
          />
        ))}
      </div>
      <div className="h-28 rounded-2xl bg-neutral-200/60 dark:bg-white/[0.04]" />
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-20 rounded-2xl bg-neutral-200/60 dark:bg-white/[0.04]"
          />
        ))}
      </div>
    </div>
  );
}

/* ============================================================================
 * MAIN COMPONENT
 * ========================================================================== */

export function EarlyWarningPage() {
  const { t } = useSafeI18n();
  usePageTitle(t('earlyWarning.title') || 'Early Warning Radar');

  const queryClient = useQueryClient();
  const { push } = useToast();
  const reduced = usePrefersReducedMotion();
  const { playTick, playPop, playSuccess } = usePremiumSound();

  const [activeFilter, setActiveFilter] = useState<SeverityFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);

  /* ── Queries ── */
  const summaryQuery = useQuery({
    queryKey: ['early-warning-summary'],
    queryFn: () => request('/early-warning/summary') as Promise<EarlyWarningSummary>,
  });

  const warningsQuery = useQuery({
    queryKey: ['early-warnings'],
    queryFn: () => request('/early-warning') as Promise<{ items: EarlyWarning[]; total: number }>,
  });

  const warnings: EarlyWarning[] = warningsQuery.data?.items ?? [];
  const summary = summaryQuery.data;

  /* ── Filtered Warnings ── */
  const filteredWarnings = useMemo(() => {
    let list = warnings;
    if (activeFilter !== 'ALL') {
      list = list.filter((w) => w.severity === activeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (w) =>
          w.title.toLowerCase().includes(q) ||
          w.description.toLowerCase().includes(q) ||
          w.rule.toLowerCase().includes(q) ||
          w.entityType.toLowerCase().includes(q)
      );
    }
    return list;
  }, [warnings, activeFilter, searchQuery]);

  /* ── Mutations ── */
  const resolveMutation = useMutation({
    mutationFn: (id: string) =>
      request(`/early-warning/${id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    onSuccess: () => {
      playSuccess();
      push('success', t('earlyWarning.resolved') || 'Warning resolved');
      queryClient.invalidateQueries({ queryKey: ['early-warnings'] });
      queryClient.invalidateQueries({ queryKey: ['early-warning-summary'] });
    },
    onError: (e) => push('error', getErrorMessage(e)),
  });

  const scanMutation = useMutation({
    mutationFn: () =>
      request('/early-warning/scan', { method: 'POST' }) as Promise<{ created?: number }>,
    onSuccess: (data) => {
      playSuccess();
      push(
        'success',
        t('earlyWarning.scanComplete', { n: data?.created ?? 0 }) ||
          `Scan complete: ${data?.created ?? 0} warnings generated`
      );
      queryClient.invalidateQueries({ queryKey: ['early-warnings'] });
      queryClient.invalidateQueries({ queryKey: ['early-warning-summary'] });
    },
    onError: (e) => push('error', getErrorMessage(e)),
  });

  /* ── Open Sidecar Detail Inspector ── */
  const handleInspectWarning = useCallback(
    (w: EarlyWarning) => {
      playPop();
      const sev = getSeverityStyle(w.severity);
      const toneMap: Record<EarlyWarning['severity'], 'rose' | 'amber' | 'blue' | 'slate'> = {
        CRITICAL: 'rose',
        HIGH: 'amber',
        MEDIUM: 'blue',
        LOW: 'slate',
      };

      openSidecar({
        id: w.id,
        type: 'general',
        title: w.title,
        subtitle: `${w.rule} • Entity: ${w.entityType}`,
        badge: {
          text: sev.label,
          tone: toneMap[w.severity] || 'amber',
        },
        avatar: {
          text: w.rule.slice(0, 2).toUpperCase(),
          color:
            w.severity === 'CRITICAL'
              ? '#F43F5E'
              : w.severity === 'HIGH'
              ? '#F59E0B'
              : '#3B82F6',
        },
        metrics: [
          {
            label: 'Severity',
            value: w.severity,
          },
          {
            label: 'Target Resource',
            value: w.entityType,
          },
        ],
        details: [
          {
            label: 'Rule Name',
            value: w.rule,
          },
          {
            label: 'Description',
            value: w.description,
          },
          {
            label: 'Entity Target',
            value: `${w.entityType} (${w.entityId})`,
            copyable: true,
          },
          {
            label: 'Detected At',
            value: formatWarningDate(w.detectedAt),
          },
          {
            label: 'Status',
            value: w.resolved ? 'Resolved' : 'Active Warning',
          },
        ],
        actions: !w.resolved
          ? [
              {
                label: t('earlyWarning.markResolved') || 'Mark Resolved',
                variant: 'primary',
                onClick: () => resolveMutation.mutate(w.id),
              },
            ]
          : undefined,
      });
    },
    [t, playPop, resolveMutation]
  );

  /* ── Keyboard Shortcuts (J / K, S to scan, Enter to inspect) ── */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl?.tagName === 'INPUT' ||
        activeEl?.tagName === 'TEXTAREA' ||
        activeEl?.tagName === 'SELECT';

      if (isInput) return;

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        playTick();
        setFocusedIndex((prev) => (prev + 1 < filteredWarnings.length ? prev + 1 : 0));
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        playTick();
        setFocusedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filteredWarnings.length - 1));
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        playPop();
        scanMutation.mutate();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredWarnings[focusedIndex]) {
          handleInspectWarning(filteredWarnings[focusedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredWarnings, focusedIndex, handleInspectWarning, playTick, playPop, scanMutation]);

  /* ── Loading & Error States ── */
  if (warningsQuery.isLoading && !warnings.length) {
    return (
      <div className="relative min-h-screen px-4 py-8 sm:px-6 lg:px-8">
        <AuroraMesh />
        <div className="mx-auto max-w-7xl">
          <EarlyWarningSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen px-4 py-6 sm:px-6 lg:px-8 pb-[max(6rem,env(safe-area-inset-bottom))]">
      <AuroraMesh />

      <motion.div
        variants={containerVariants}
        initial={reduced ? false : 'hidden'}
        animate="visible"
        className="mx-auto max-w-7xl space-y-6"
      >
        {/* ====================================================================
         * 1. HERO HEADER
         * ================================================================== */}
        <motion.div
          variants={itemVariants}
          className="liquid-glass-surface relative overflow-hidden rounded-3xl p-6 sm:p-8"
        >
          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-600/15 text-amber-600 shadow-inner ring-1 ring-amber-500/30 dark:bg-amber-500/20 dark:text-amber-400">
                <Icon paths={ICONS.warningTriangle} size={28} strokeWidth={2} />
              </div>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-600 ring-1 ring-rose-500/25 dark:text-rose-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                    {summary?.open ?? warnings.length} {t('earlyWarning.open') || 'Active Warnings'}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-neutral-500/10 px-2.5 py-0.5 text-xs font-semibold text-neutral-600 ring-1 ring-neutral-500/20 dark:text-neutral-300">
                    {summary?.resolvedThisWeek ?? 0} Resolved This Week
                  </span>
                </div>

                <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900 dark:text-white sm:text-3xl">
                  {t('earlyWarning.title') || 'Early Warning Radar'}
                </h1>
                <p className="max-w-2xl text-sm font-medium text-neutral-500 dark:text-neutral-400">
                  {t('earlyWarning.subtitle') ||
                    'Real-time automated sentinel detection for attendance drops, payment delays, overdue leads, and schedule bottlenecks.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  playPop();
                  scanMutation.mutate();
                }}
                disabled={scanMutation.isPending}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-700 active:scale-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
              >
                <Icon
                  paths={ICONS.scan}
                  size={18}
                  strokeWidth={2.4}
                  className={scanMutation.isPending ? 'animate-spin' : ''}
                />
                <span>
                  {scanMutation.isPending
                    ? t('anomaly.loading') || 'Scanning…'
                    : t('earlyWarning.runScan') || 'Run System Scan'}
                </span>
                <kbd className="hidden rounded bg-indigo-800/60 px-1.5 py-0.5 text-[10px] font-mono sm:inline-block">
                  S
                </kbd>
              </button>
            </div>
          </div>
        </motion.div>

        {/* ====================================================================
         * 2. INTERACTIVE COUNT-UP KPI TILES
         * ================================================================== */}
        <motion.div
          variants={itemVariants}
          className="grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-4"
        >
          {/* Open Warnings Tile */}
          <button
            type="button"
            onClick={() => {
              playTick();
              setActiveFilter('ALL');
            }}
            className={cn(
              'liquid-glass-card group flex min-h-[44px] flex-col justify-between p-4 text-left transition-all',
              activeFilter === 'ALL' && 'ring-2 ring-indigo-500/40 bg-indigo-500/5'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                {t('earlyWarning.open') || 'Open'}
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Icon paths={ICONS.warningTriangle} size={16} />
              </div>
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
              <CountUp value={summary?.open ?? warnings.length} />
            </div>
          </button>

          {/* Critical Tile */}
          <button
            type="button"
            onClick={() => {
              playTick();
              setActiveFilter('CRITICAL');
            }}
            className={cn(
              'liquid-glass-card group flex min-h-[44px] flex-col justify-between p-4 text-left transition-all',
              activeFilter === 'CRITICAL' && 'ring-2 ring-rose-500/50 bg-rose-500/5'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                {t('earlyWarning.critical') || 'Critical'}
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <Icon paths={ICONS.shieldAlert} size={16} />
              </div>
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight text-rose-500">
              <CountUp value={summary?.critical ?? 0} />
            </div>
          </button>

          {/* High Severity Tile */}
          <button
            type="button"
            onClick={() => {
              playTick();
              setActiveFilter('HIGH');
            }}
            className={cn(
              'liquid-glass-card group flex min-h-[44px] flex-col justify-between p-4 text-left transition-all',
              activeFilter === 'HIGH' && 'ring-2 ring-amber-500/50 bg-amber-500/5'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                {t('anomaly.highSeverity') || 'High'}
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Icon paths={ICONS.warningTriangle} size={16} />
              </div>
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight text-amber-500">
              <CountUp value={summary?.high ?? 0} />
            </div>
          </button>

          {/* Resolved This Week Tile */}
          <div className="liquid-glass-card flex min-h-[44px] flex-col justify-between p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                {t('earlyWarning.resolvedThisWeek') || 'Resolved'}
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Icon paths={ICONS.checkCircle} size={16} />
              </div>
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight text-emerald-500">
              <CountUp value={summary?.resolvedThisWeek ?? 0} />
            </div>
          </div>

          {/* Total Detected Tile */}
          <div className="liquid-glass-card col-span-2 sm:col-span-1 flex min-h-[44px] flex-col justify-between p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                {t('earlyWarning.totalDetected') || 'Total'}
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Icon paths={ICONS.sparkles} size={16} />
              </div>
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
              <CountUp value={summary?.total ?? warnings.length} />
            </div>
          </div>
        </motion.div>

        {/* ====================================================================
         * 3. RULE DEFINITIONS CARD
         * ================================================================== */}
        <motion.div variants={itemVariants} className="liquid-glass-card p-5 sm:p-6">
          <div className="flex items-center gap-2 pb-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Icon paths={ICONS.radar} size={15} />
            </div>
            <h3 className="text-sm font-bold tracking-tight text-neutral-900 dark:text-white">
              {t('earlyWarning.rulesTitle') || 'Operational Sentinel Rules'}
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-black/[0.06] bg-white/40 p-3 dark:border-white/[0.06] dark:bg-white/[0.02]">
              <strong className="text-xs font-bold text-neutral-900 dark:text-white">
                {t('earlyWarning.rule.paymentOverdue') || 'Overdue Tuition'}
              </strong>
              <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-400">
                {t('earlyWarning.rule.paymentOverdueDesc') || 'Invoice grace period exceeded by 5+ business days.'}
              </p>
            </div>
            <div className="rounded-xl border border-black/[0.06] bg-white/40 p-3 dark:border-white/[0.06] dark:bg-white/[0.02]">
              <strong className="text-xs font-bold text-neutral-900 dark:text-white">
                {t('earlyWarning.rule.attendance') || 'Chronic Absence'}
              </strong>
              <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-400">
                {t('earlyWarning.rule.attendanceDesc') || '3 consecutive unexcused absences detected.'}
              </p>
            </div>
            <div className="rounded-xl border border-black/[0.06] bg-white/40 p-3 dark:border-white/[0.06] dark:bg-white/[0.02]">
              <strong className="text-xs font-bold text-neutral-900 dark:text-white">
                {t('earlyWarning.rule.leadStale') || 'Stale Pipeline Lead'}
              </strong>
              <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-400">
                {t('earlyWarning.rule.leadStaleDesc') || 'High intent lead with zero follow-up for 48 hours.'}
              </p>
            </div>
            <div className="rounded-xl border border-black/[0.06] bg-white/40 p-3 dark:border-white/[0.06] dark:bg-white/[0.02]">
              <strong className="text-xs font-bold text-neutral-900 dark:text-white">
                {t('earlyWarning.rule.gradeDrop') || 'Rapid Grade Decline'}
              </strong>
              <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-400">
                {t('earlyWarning.rule.gradeDropDesc') || 'Student average dropped by 20% in rolling 14 days.'}
              </p>
            </div>
            <div className="rounded-xl border border-black/[0.06] bg-white/40 p-3 dark:border-white/[0.06] dark:bg-white/[0.02]">
              <strong className="text-xs font-bold text-neutral-900 dark:text-white">
                {t('earlyWarning.rule.scheduleConflict') || 'Facility Double-Booking'}
              </strong>
              <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-400">
                {t('earlyWarning.rule.scheduleConflictDesc') || 'Room or teacher overlap in published timetable.'}
              </p>
            </div>
          </div>
        </motion.div>

        {/* ====================================================================
         * 4. CONTROL BAR (Segmented Control + Search)
         * ================================================================== */}
        <motion.div
          variants={itemVariants}
          className="liquid-glass-card flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"
        >
          {/* Segmented Filter Control */}
          <div
            className="flex items-center rounded-2xl bg-neutral-200/50 p-1 dark:bg-white/[0.05]"
            role="tablist"
          >
            {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as SeverityFilter[]).map((level) => {
              const isActive = activeFilter === level;
              return (
                <button
                  key={level}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => {
                    playTick();
                    setActiveFilter(level);
                    setFocusedIndex(0);
                  }}
                  className={cn(
                    'relative flex min-h-[44px] items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all',
                    isActive
                      ? 'text-neutral-900 dark:text-white'
                      : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeEarlyWarningPill"
                      className="absolute inset-0 rounded-xl bg-white shadow-sm dark:bg-neutral-800"
                      transition={SPRING_PHYSICS.snappy}
                    />
                  )}
                  <span className="relative z-10">
                    {level === 'ALL' ? t('common.all') || 'All' : level}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px] flex-1 sm:max-w-xs">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-neutral-400">
              <Icon paths={ICONS.search} size={16} />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setFocusedIndex(0);
              }}
              placeholder={`${t('common.search') || 'Search warnings'}...`}
              className="min-h-[44px] w-full rounded-xl border border-black/[0.08] bg-white/60 pl-9 pr-3 text-xs font-medium text-neutral-900 outline-none transition-all placeholder:text-neutral-400 focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
            />
          </div>
        </motion.div>

        {/* ====================================================================
         * 5. WARNINGS FEED LIST
         * ================================================================== */}
        <motion.div variants={itemVariants} className="liquid-glass-card overflow-hidden">
          <AnimatePresence mode="wait">
            {filteredWarnings.length === 0 ? (
              <motion.div
                key="empty-warnings"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center p-12 text-center"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/25">
                  <Icon paths={ICONS.checkCircle} size={24} />
                </div>
                <h3 className="mt-4 text-base font-bold text-neutral-800 dark:text-neutral-200">
                  {t('earlyWarning.emptyTitle') || 'Zero Operational Warnings'}
                </h3>
                <p className="mt-1 max-w-sm text-xs text-neutral-500 dark:text-neutral-400">
                  {t('earlyWarning.emptyMessage') || 'All institutional systems, attendances, and billing are operating within normal parameters.'}
                </p>
              </motion.div>
            ) : (
              <div
                key="warnings-list"
                className="divide-y divide-black/[0.04] dark:divide-white/[0.04]"
              >
                {filteredWarnings.map((w, idx) => {
                  const isFocused = focusedIndex === idx;
                  const sev = getSeverityStyle(w.severity);

                  return (
                    <motion.div
                      key={w.id}
                      onClick={() => handleInspectWarning(w)}
                      className={cn(
                        'group flex min-h-[44px] cursor-pointer flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]',
                        isFocused && 'bg-amber-500/[0.06] dark:bg-amber-500/[0.1]'
                      )}
                    >
                      <div className="flex items-start gap-4">
                        <span
                          className={cn(
                            'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1 mt-0.5',
                            sev.badgeStyle
                          )}
                        >
                          <span className={cn('h-2 w-2 rounded-full', sev.dotStyle)} />
                          {sev.label}
                        </span>

                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-neutral-900 dark:text-white">
                            {w.title}
                          </h4>
                          <p className="mt-1 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
                            {w.description}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-neutral-400">
                            <span className="rounded bg-neutral-200/60 px-1.5 py-0.5 font-mono text-neutral-700 dark:bg-white/[0.06] dark:text-neutral-300">
                              {w.rule}
                            </span>
                            <span>•</span>
                            <span>{w.entityType}</span>
                            <span>•</span>
                            <span>{formatWarningDate(w.detectedAt)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        {!w.resolved && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              playTick();
                              resolveMutation.mutate(w.id);
                            }}
                            disabled={resolveMutation.isPending}
                            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-black/[0.08] bg-white/60 px-4 py-2 text-xs font-semibold text-neutral-700 transition-all hover:bg-white active:scale-95 disabled:opacity-50 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-neutral-300"
                          >
                            <Icon paths={ICONS.checkCircle} size={14} />
                            <span>{t('earlyWarning.markResolved') || 'Resolve'}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInspectWarning(w);
                          }}
                          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-neutral-400 hover:text-amber-600 hover:bg-amber-500/10 transition-colors"
                          title="Inspect warning details"
                        >
                          <Icon paths={ICONS.eye} size={16} />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default EarlyWarningPage;
