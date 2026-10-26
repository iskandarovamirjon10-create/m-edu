/**
 * M-EDU NotificationsCenterPage — 
 *
 * Module Features:
 *  - Hero header with animated unread indicator + conic ring
 *  - Stats bar (Total, Unread, Sources)
 *  - Segmented filter (All / Unread / by kind)
 *  - Premium notification rows with tone-aware icons
 *  - Custom SVG icons in SVG Icons
 *  - Shimmer skeleton (not pulse)
 *  - Framer Motion spring physics + stagger
 *  - Tone-aware colors throughout
 */

import { useState, useMemo, useCallback, useEffect, useRef, type SVGProps } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  GlassPageHeader,
  GlassCard,
  GlassBadge,
  GlassEmptyState,
  GlassErrorState,
  GlassButton,
} from '@/components/ui';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useToast } from '@/components/ui/GlassToast';
import { notificationsApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys.factory';
import { getErrorMessage } from '@/lib/errorMessages';
import { useSafeI18n, type TranslateFn } from '@/i18n/I18nProvider';

function AuroraMesh() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="absolute -top-[10%] -left-[10%] h-[560px] w-[560px] rounded-full bg-gradient-to-br from-blue-500/12 via-indigo-500/8 to-transparent blur-[130px] dark:from-blue-600/14 dark:via-indigo-600/10" />
      <div className="absolute top-[25%] -right-[10%] h-[520px] w-[520px] rounded-full bg-gradient-to-bl from-purple-500/12 via-pink-500/8 to-transparent blur-[130px] dark:from-purple-600/14 dark:via-pink-600/10" />
      <div className="absolute -bottom-[15%] left-[25%] h-[480px] w-[480px] rounded-full bg-gradient-to-tr from-amber-500/10 via-orange-500/6 to-transparent blur-[120px] dark:from-amber-600/12" />
    </div>
  );
}

/* ============================================================================
 * MOTION TOKENS
 * ========================================================================== */

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  soft:   { type: 'spring', stiffness: 220, damping: 28, mass: 1.0 },
} as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.06 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: SPRING.smooth },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0, transition: SPRING.smooth },
  exit:   { opacity: 0, x: 20, transition: { duration: 0.2 } },
};

/* ============================================================================
 * TYPES
 * ========================================================================== */

type AppKind = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';

interface AppNotification {
  id: string;
  kind: AppKind;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

// Raw Prisma row returned by GET /notifications: `type` (e.g. "info") and
// `isRead` — not the page's `kind`/`read` view model.
interface RawNotification {
  id?: string;
  type?: string | null;
  title?: string | null;
  message?: string | null;
  link?: string | null;
  isRead?: boolean;
  createdAt?: string;
}

interface NotificationsListResponse {
  items: RawNotification[];
  unread?: number;
}

const APP_KINDS: AppKind[] = ['INFO', 'SUCCESS', 'WARNING', 'ERROR'];

/** Normalize a backend notification row into the page's view model. */
function mapNotification(raw: RawNotification): AppNotification {
  const upper = String(raw?.type ?? '').toUpperCase();
  return {
    id: String(raw?.id ?? ''),
    kind: APP_KINDS.includes(upper as AppKind) ? (upper as AppKind) : 'INFO',
    title: raw?.title ?? '',
    message: raw?.message ?? '',
    link: raw?.link ?? undefined,
    read: Boolean(raw?.isRead),
    createdAt: raw?.createdAt ?? '',
  };
}

type FilterKey = 'ALL' | 'UNREAD' | AppNotification['kind'];

/* ============================================================================
 * CUSTOM ICONS (SVG Icons)
 * ========================================================================== */

const ICON_STROKE = 1.75;

const I = {
  bell: [
    'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9',
    'M13.73 21a2 2 0 0 1-3.46 0',
  ],
  info: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 16v-4',
    'M12 8h.01',
  ],
  checkCircle: [
    'M22 11.08V12a10 10 0 1 1-5.93-9.14',
    'M22 4 12 14.01l-3-3',
  ],
  alertTriangle: [
    'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
    'M12 9v4',
    'M12 17h.01',
  ],
  alertCircle: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 8v4',
    'M12 16h.01',
  ],
  check: ['M20 6 9 17l-5-5'],
  checkCheck: ['M18 6 7 17l-5-5', 'M22 10l-7.5 7.5L13 16'],
  externalLink: [
    'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6',
    'M15 3h6v6',
    'M10 14 21 3',
  ],
  inbox: [
    'M22 12h-6l-2 3h-4l-2-3H2',
    'M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z',
  ],
  sparkles: [
    'M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z',
    'M18.5 3.5v3', 'M20 5h-3',
    'M5.5 18v2.5', 'M6.75 19.25h-2.5',
  ],
  filter: [
    'M22 3H2l8 9.46V19l4 2v-8.54L22 3z',
  ],
  layers: [
    'M12 2 2 7l10 5 10-5-10-5z',
    'M2 17l10 5 10-5',
    'M2 12l10 5 10-5',
  ],
  clock: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 6v6l4 2',
  ],
  trash: [
    'M3 6h18',
    'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6',
    'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  ],
  workflow: [
    'M3 3h6v6H3z',
    'M15 3h6v6h-6z',
    'M3 15h6v6H3z',
    'M15 15h6v6h-6z',
    'M9 6h6',
    'M9 18h6',
    'M6 9v6',
    'M18 9v6',
  ],
  shieldAlert: [
    'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    'M12 8v4',
    'M12 16h.01',
  ],
  database: [
    'M12 8c4.97 0 9-1.34 9-3s-4.03-3-9-3-9 1.34-9 3 4.03 3 9 3z',
    'M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5',
    'M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3',
  ],
  fileText: [
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'M14 2v6h6',
    'M16 13H8',
    'M16 17H8',
    'M10 9H8',
  ],
  settings: [
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  ],
};

function Icon({
  paths, size = 18, className = '', strokeWidth = ICON_STROKE, ...rest
}: {
  paths: string[]; size?: number; className?: string; strokeWidth?: number;
} & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden {...rest}
    >
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

/* ============================================================================
 * TONE PALETTES
 * ========================================================================== */

type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'slate';

const TONE: Record<Tone, { fg: string; bg: string; glow: string; ring: string }> = {
  blue:   { fg: '#2563EB', bg: 'rgba(37,99,235,0.10)',  glow: 'rgba(37,99,235,0.28)',  ring: 'rgba(37,99,235,0.22)' },
  green:  { fg: '#10B981', bg: 'rgba(16,185,129,0.10)',   glow: 'rgba(16,185,129,0.28)',   ring: 'rgba(16,185,129,0.22)' },
  orange: { fg: '#F59E0B', bg: 'rgba(245,158,11,0.10)',   glow: 'rgba(245,158,11,0.28)',   ring: 'rgba(245,158,11,0.22)' },
  red:    { fg: '#EF4444', bg: 'rgba(239,68,68,0.10)',   glow: 'rgba(239,68,68,0.28)',   ring: 'rgba(239,68,68,0.22)' },
  purple: { fg: '#6366F1', bg: 'rgba(99,102,241,0.10)',  glow: 'rgba(99,102,241,0.28)',  ring: 'rgba(99,102,241,0.22)' },
  slate:  { fg: '#8E8E93', bg: 'rgba(142,142,147,0.10)', glow: 'rgba(142,142,147,0.28)', ring: 'rgba(142,142,147,0.22)' },
};

const KIND_TONE: Record<AppNotification['kind'], Tone> = {
  INFO:    'blue',
  SUCCESS: 'green',
  WARNING: 'orange',
  ERROR:   'red',
};

const KIND_ICON: Record<AppNotification['kind'], string[]> = {
  INFO:    I.info,
  SUCCESS: I.checkCircle,
  WARNING: I.alertTriangle,
  ERROR:   I.alertCircle,
};

const KIND_BADGE_COLOR: Record<AppNotification['kind'], 'muted' | 'success' | 'warning' | 'error'> = {
  INFO:    'muted',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR:   'error',
};

// Defensive accessors: an unexpected/unknown kind must never crash the UI.
function toneForKind(kind: string): Tone {
  return KIND_TONE[kind as AppNotification['kind']] ?? 'slate';
}

function iconForKind(kind: string): string[] {
  return KIND_ICON[kind as AppNotification['kind']] ?? I.info;
}

function badgeColorForKind(kind: string): 'muted' | 'success' | 'warning' | 'error' {
  return KIND_BADGE_COLOR[kind as AppNotification['kind']] ?? 'muted';
}

/* ============================================================================
 * HELPERS
 * ========================================================================== */

function formatRelativeTime(iso: string, t: TranslateFn): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return t('notifications.justNow');
  if (mins < 60) return t('notifications.minutesAgo', { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('notifications.hoursAgo', { n: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t('notifications.daysAgo', { n: days });
  return d.toLocaleDateString();
}

function formatFullTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

/* ============================================================================
 * COUNT UP
 * ========================================================================== */

function CountUp({
  value, duration = 0.9, suffix = '',
}: { value: number; duration?: number; suffix?: string }) {
  const [n, setN] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    let raf: number;
    startRef.current = null;
    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const p = Math.min(1, (ts - startRef.current) / (duration * 1000));
      const eased = 1 - Math.pow(1 - p, 4);
      setN(value * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <span className="tabular-nums">{Math.round(n).toLocaleString()}{suffix}</span>;
}

/* ============================================================================
 * SHIMMER
 * ========================================================================== */

function Shimmer({ className = '', radius = '0.75rem' }: { className?: string; radius?: string }) {
  return (
    <div
      className={`relative overflow-hidden bg-[#E5E5EA]/60 dark:bg-[#2C2C2E]/60 ${className}`}
      style={{ borderRadius: radius }}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.65) 50%, transparent 100%)',
        }}
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

function NotificationsSkeleton() {
  return (
    <div className="space-y-5">
      <Shimmer className="h-32 w-full" radius="2rem" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <Shimmer key={i} className="h-[68px]" radius="1rem" />)}
      </div>
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => <Shimmer key={i} className="h-20" radius="1rem" />)}
      </div>
    </div>
  );
}

/* ============================================================================
 * HERO SECTION
 * ========================================================================== */

function NotificationsHero({ unread, total, t }: { unread: number; total: number; t: (k: string) => string }) {
  const hasUnread = unread > 0;

  return (
    <GlassCard className="overflow-hidden p-6 sm:p-7" interactive>
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        {/* Hero bell icon */}
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10 sm:h-20 sm:w-20">
          <Icon paths={I.bell} size={32} strokeWidth={2} className="relative z-10" />

          {/* Unread badge */}
          <AnimatePresence>
            {hasUnread && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ ...SPRING.snappy, delay: 0.2 }}
                className="absolute -right-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-bold text-white ring-2 ring-white shadow-sm dark:ring-[#121623]"
              >
                {unread > 99 ? '99+' : unread}
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Text */}
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <GlassBadge color={hasUnread ? 'error' : 'success'}>
              <span className="inline-flex items-center gap-1">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: hasUnread ? '#EF4444' : '#10B981' }}
                />
                {hasUnread ? (t('notifications.actionNeeded') || 'Action needed') : (t('notifications.allCaughtUp') || 'All caught up')}
              </span>
            </GlassBadge>
            {total > 0 && (
              <GlassBadge color="muted">
                <span className="inline-flex items-center gap-1">
                  <Icon paths={I.layers} size={10} strokeWidth={2.5} />
                  {total} {t('notifications.total') || 'total'}
                </span>
              </GlassBadge>
            )}
          </div>

          <h1 className="mt-2 text-3xl font-bold tracking-tighter text-[#1D1D1F] dark:text-[#F5F5F7] sm:text-4xl">
            {t('notifications.title')}
          </h1>
        </div>
      </div>
    </GlassCard>
  );
}

/* ============================================================================
 * STAT TILE
 * ========================================================================== */

function StatTile({
  label, value, icon, tone = 'blue',
}: {
  label: string;
  value: number | string;
  icon: string[];
  tone?: Tone;
}) {
  const c = TONE[tone];

  return (
    <motion.div
      variants={rowVariants}
      whileHover={{ y: -3 }}
      transition={SPRING.smooth}
      className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 px-4 py-3 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card"
      style={{
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), 0 4px 16px -8px rgba(0,0,0,0.06)',
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-3 top-0 h-1/2 rounded-t-2xl"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.35), transparent)' }}
      />
      <div
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{
          background: c.bg,
          color: c.fg,
          border: `1px solid ${c.fg}22`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5), 0 4px 12px -6px ${c.glow}`,
        }}
      >
        <Icon paths={icon} size={18} strokeWidth={2} className="relative" />
      </div>
      <div className="relative min-w-0 flex-1">
        <div className="text-[22px] font-bold tracking-tighter leading-none text-[#1D1D1F] dark:text-[#F5F5F7]">
          {typeof value === 'number' ? <CountUp value={value} /> : value}
        </div>
        <div className="mt-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#64748B] truncate">
          {label}
        </div>
      </div>
    </motion.div>
  );
}

/* ============================================================================
 * SEGMENTED FILTER
 * ========================================================================== */

function SegmentedFilter({
  value, onChange, options, counts,
}: {
  value: FilterKey;
  onChange: (v: FilterKey) => void;
  options: { key: FilterKey; label: string; icon: string[]; tone: Tone }[];
  counts: Record<FilterKey, number>;
}) {
  return (
    <div
      className="inline-flex flex-wrap gap-1 rounded-2xl border border-black/[0.04] bg-black/[0.04] p-1 backdrop-blur-xl dark:border-white/[0.06] dark:bg-white/[0.06]"
      style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)' }}
    >
      {options.map((opt) => {
        const active = value === opt.key;
        const c = TONE[opt.tone];
        const count = counts[opt.key] ?? 0;

        return (
          <motion.button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={SPRING.snappy}
            className="relative flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] font-semibold outline-none transition-colors"
            style={{
              color: active ? c.fg : '#64748B',
              background: active ? c.bg : 'transparent',
              boxShadow: active ? `inset 0 1px 0 rgba(255,255,255,0.5), 0 2px 8px -4px ${c.glow}` : undefined,
            }}
          >
            <Icon paths={opt.icon} size={12} strokeWidth={2.2} />
            <span className="tracking-tight">{opt.label}</span>
            {count > 0 && (
              <span
                className="ml-0.5 rounded-full px-1.5 py-0.5 text-[9.5px] font-bold tabular-nums"
                style={{
                  background: active ? `${c.fg}25` : 'rgba(142,142,147,0.15)',
                  color: active ? c.fg : '#64748B',
                }}
              >
                {count}
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

/* ============================================================================
 * SOURCES CARD
 * ========================================================================== */

const SOURCE_ITEMS: { icon: string[]; tone: Tone; titleKey: string; descKey: string }[] = [
  { icon: I.workflow,     tone: 'blue',   titleKey: 'notifications.sourceWorkflow',     descKey: 'notifications.sourceWorkflowDesc' },
  { icon: I.shieldAlert,  tone: 'orange', titleKey: 'notifications.sourceEarlyWarning', descKey: 'notifications.sourceEarlyWarningDesc' },
  { icon: I.database,     tone: 'purple', titleKey: 'notifications.sourceDataQuality',  descKey: 'notifications.sourceDataQualityDesc' },
  { icon: I.fileText,     tone: 'green',  titleKey: 'notifications.sourceAudit',        descKey: 'notifications.sourceAuditDesc' },
  { icon: I.settings,     tone: 'slate',  titleKey: 'notifications.sourceSystem',       descKey: 'notifications.sourceSystemDesc' },
];

function SourcesCard({ t }: { t: (k: string) => string }) {
  const [open, setOpen] = useState(false);

  return (
    <GlassCard className="overflow-hidden p-0" interactive>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 border-b border-black/[0.06] px-5 py-4 text-left outline-none dark:border-white/[0.08]"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#6366F1]/10 text-[#6366F1]">
          <Icon paths={I.sparkles} size={15} strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
            {t('notifications.sourcesTitle')}
          </h3>
          <p className="text-[11px] font-medium text-[#64748B]">
            {t('notifications.sourcesSubtitle') || 'Where these notifications come from'}
          </p>
        </div>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={SPRING.snappy}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#00000005] text-[#64748B] dark:bg-[#ffffff08]"
        >
          <Icon paths={['M6 9l6 6 6-6']} size={14} strokeWidth={2.2} />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={SPRING.smooth}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-2">
              {SOURCE_ITEMS.map((src, idx) => {
                const c = TONE[src.tone];
                return (
                  <motion.div
                    key={src.titleKey}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...SPRING.smooth, delay: idx * 0.04 }}
                    className="flex items-start gap-2.5 rounded-xl border border-black/[0.04] bg-black/[0.02] px-3 py-2.5 dark:border-white/[0.06] dark:bg-white/[0.04]"
                  >
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: c.bg, color: c.fg }}
                    >
                      <Icon paths={src.icon} size={13} strokeWidth={2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                        {t(src.titleKey)}
                      </p>
                      <p className="mt-0.5 text-[11px] font-medium leading-snug text-[#64748B]">
                        {t(src.descKey)}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}

/* ============================================================================
 * NOTIFICATION ROW
 * ========================================================================== */

function NotificationRow({
  n, onMarkRead, isMarkingRead, t,
}: {
  n: AppNotification;
  onMarkRead: (id: string) => void;
  isMarkingRead: boolean;
  t: TranslateFn;
}) {
  const tone = toneForKind(n.kind);
  const c = TONE[tone];
  const icon = iconForKind(n.kind);

  return (
    <motion.li
      layout
      variants={rowVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={[
        'group relative flex items-start gap-3 px-4 py-4 transition-colors',
        !n.read ? 'bg-[#2563EB]/[0.03] dark:bg-[#2563EB]/[0.06]' : '',
      ].join(' ')}
    >
      {/* Unread left accent bar */}
      <AnimatePresence>
        {!n.read && (
          <motion.span
            initial={{ opacity: 0, scaleY: 0.3 }}
            animate={{ opacity: 1, scaleY: 1 }}
            exit={{ opacity: 0, scaleY: 0.3 }}
            transition={SPRING.snappy}
            className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full"
            style={{ background: c.fg, boxShadow: `0 0 8px ${c.glow}` }}
          />
        )}
      </AnimatePresence>

      {/* Icon */}
      <div
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{
          background: c.bg,
          color: c.fg,
          border: `1px solid ${c.fg}22`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5), 0 4px 12px -6px ${c.glow}`,
        }}
      >
        <Icon paths={icon} size={16} strokeWidth={2.2} />
        {!n.read && (
          <span
            className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-[#131622]"
            style={{ background: c.fg }}
          />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <GlassBadge color={badgeColorForKind(n.kind)}>{n.kind}</GlassBadge>
          {!n.read && (
            <span
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: c.fg }}
            >
              {t('notifications.new') || 'New'}
            </span>
          )}
        </div>

        <h4 className="mt-1.5 text-[14px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
          {n.title}
        </h4>
        <p className="mt-0.5 text-[12.5px] font-medium leading-snug text-[#64748B]">
          {n.message}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] font-medium text-[#64748B]">
          <span className="inline-flex items-center gap-1" title={formatFullTime(n.createdAt)}>
            <Icon paths={I.clock} size={11} strokeWidth={2} className="opacity-70" />
            {formatRelativeTime(n.createdAt, t)}
          </span>
          {n.link && (
            <>
              <span className="opacity-40">·</span>
              <a
                href={n.link}
                className="inline-flex items-center gap-1 font-semibold text-[#2563EB] hover:underline"
              >
                {t('notifications.open')}
                <Icon paths={I.externalLink} size={11} strokeWidth={2.2} />
              </a>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 flex-col items-end gap-2">
        {!n.read && (
          <motion.button
            type="button"
            onClick={() => onMarkRead(n.id)}
            disabled={isMarkingRead}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            transition={SPRING.snappy}
            aria-label={t('notifications.markRead')}
            title={t('notifications.markRead')}
            className="flex h-8 w-8 items-center justify-center rounded-lg outline-none disabled:opacity-50"
            style={{
              background: 'rgba(37,99,235,0.10)',
              color: '#2563EB',
              border: '1px solid rgba(37,99,235,0.22)',
            }}
          >
            {isMarkingRead ? (
              <motion.span
                className="h-3.5 w-3.5 rounded-full border-2 border-current/30 border-t-current"
                animate={{ rotate: 360 }}
                transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
              />
            ) : (
              <Icon paths={I.check} size={14} strokeWidth={2.5} />
            )}
          </motion.button>
        )}
      </div>
    </motion.li>
  );
}

/* ============================================================================
 * MAIN PAGE
 * ========================================================================== */

export function NotificationsCenterPage() {
  const { t } = useSafeI18n();
  usePageTitle(t('notifications.title'));
  const queryClient = useQueryClient();
  const { push } = useToast();

  const [filter, setFilter] = useState<FilterKey>('ALL');

  const listQuery = useQuery({
    queryKey: queryKeys.notifications.all(),
    queryFn: () => notificationsApi.list() as Promise<NotificationsListResponse>,
    placeholderData: (prev) => prev,
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      push('success', t('notifications.allReadToast'));
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() });
    },
    onError: (e) => push('error', getErrorMessage(e)),
  });

  const markOneMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() });
    },
    onError: (e) => push('error', getErrorMessage(e)),
  });

  const items = useMemo<AppNotification[]>(() => {
    const raw = (listQuery.data as NotificationsListResponse | undefined)?.items;
    return Array.isArray(raw) ? raw.map(mapNotification) : [];
  }, [listQuery.data]);
  const unread = (listQuery.data as NotificationsListResponse | undefined)?.unread ?? 0;

  const counts = useMemo<Record<FilterKey, number>>(() => {
    const base: Record<FilterKey, number> = {
      ALL: items.length,
      UNREAD: items.filter((n) => !n.read).length,
      INFO: 0, SUCCESS: 0, WARNING: 0, ERROR: 0,
    };
    for (const n of items) {
      if (base[n.kind] !== undefined) base[n.kind] += 1;
    }
    return base;
  }, [items]);

  const filtered = useMemo(() => {
    if (filter === 'ALL') return items;
    if (filter === 'UNREAD') return items.filter((n) => !n.read);
    return items.filter((n) => n.kind === filter);
  }, [items, filter]);

  const filterOptions = useMemo(
    () => [
      { key: 'ALL' as FilterKey,     label: t('common.all'),         icon: I.layers,        tone: 'blue' as Tone },
      { key: 'UNREAD' as FilterKey,  label: t('notifications.unread'), icon: I.bell,        tone: 'orange' as Tone },
      { key: 'INFO' as FilterKey,    label: 'Info',                  icon: I.info,          tone: 'blue' as Tone },
      { key: 'SUCCESS' as FilterKey, label: 'Success',               icon: I.checkCircle,   tone: 'green' as Tone },
      { key: 'WARNING' as FilterKey, label: 'Warning',               icon: I.alertTriangle, tone: 'orange' as Tone },
      { key: 'ERROR' as FilterKey,   label: 'Error',                 icon: I.alertCircle,   tone: 'red' as Tone },
    ],
    [t],
  );

  const handleMarkOne = useCallback(
    (id: string) => markOneMutation.mutate(id),
    [markOneMutation],
  );

  /* ---------------------------------------------------------------
     LOADING
  --------------------------------------------------------------- */
  if (listQuery.isLoading && items.length === 0) {
    return (
      <div style={{ display: 'contents' }}>
        <div className="orb orb-cyan-1" />
        <div className="orb orb-indigo-1" />
        <div className="page-container space-y-5">
          <GlassPageHeader title={t('notifications.title')} subtitle={t('notifications.subtitle')} />
          <NotificationsSkeleton />
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------
     MAIN
  --------------------------------------------------------------- */
  return (
    <div className="relative min-h-screen pb-[max(6rem,env(safe-area-inset-bottom))]">
      <AuroraMesh />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="page-container space-y-5"
      >
        <GlassPageHeader
          title={t('notifications.title')}
          subtitle={t('notifications.subtitle')}
        />

        {/* HERO */}
        <motion.div variants={cardVariants}>
          <NotificationsHero unread={unread} total={items.length} t={t} />
        </motion.div>

        {/* STATS */}
        <motion.div variants={containerVariants} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label={t('notifications.statTotal')} value={items.length} icon={I.layers} tone="blue" />
          <StatTile label={t('notifications.statUnread')} value={unread} icon={I.bell} tone={unread > 0 ? 'orange' : 'slate'} />
          <StatTile label={t('notifications.statSuccess')} value={counts.SUCCESS} icon={I.checkCircle} tone="green" />
          <StatTile label={t('notifications.statErrors')} value={counts.ERROR + counts.WARNING} icon={I.alertTriangle} tone={(counts.ERROR + counts.WARNING) > 0 ? 'red' : 'slate'} />
        </motion.div>

        {/* TOOLBAR: filter + mark all */}
        <motion.div variants={cardVariants} className="flex flex-wrap items-center justify-between gap-3">
          <SegmentedFilter
            value={filter}
            onChange={setFilter}
            options={filterOptions}
            counts={counts}
          />

          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <GlassButton
              size="sm"
              variant="primary"
              onClick={() => markAllMutation.mutate()}
              disabled={unread === 0 || markAllMutation.isPending}
            >
              <span className="inline-flex items-center gap-2">
                {markAllMutation.isPending ? (
                  <motion.span
                    className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                  />
                ) : (
                  <Icon paths={I.checkCheck} size={14} strokeWidth={2.4} />
                )}
                {t('notifications.markAllRead')}
              </span>
            </GlassButton>
          </motion.div>
        </motion.div>

        {/* SOURCES */}
        <motion.div variants={cardVariants}>
          <SourcesCard t={t} />
        </motion.div>

        {/* LIST */}
        <motion.div variants={cardVariants}>
          <GlassCard className="overflow-hidden p-0" interactive>
            <div className="flex items-center gap-3 border-b border-black/[0.06] px-5 py-4 dark:border-white/[0.08]">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#2563EB]/10 text-[#2563EB]">
                <Icon paths={I.inbox} size={15} strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-[14px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {t('notifications.title')}
                </h2>
                <p className="text-[11px] font-medium text-[#64748B]">
                  {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
                </p>
              </div>
              {unread > 0 && (
                <GlassBadge color="error">
                  <CountUp value={unread} /> {t('notifications.unread')}
                </GlassBadge>
              )}
            </div>

            {listQuery.isError ? (
              <div className="p-8">
                <GlassErrorState
                  title={t('notifications.loadError')}
                  message={getErrorMessage(listQuery.error)}
                  onRetry={() => listQuery.refetch()}
                />
              </div>
            ) : items.length === 0 ? (
              <div className="p-8">
                <GlassEmptyState
                  title={t('notifications.empty')}
                  message={t('notifications.emptyHint')}
                />
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8">
                <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center dark:border-[#ffffff15]">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2563EB]/10 text-[#2563EB]">
                    <Icon paths={I.filter} size={20} strokeWidth={2} />
                  </div>
                  <p className="mt-3 text-[13.5px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {t('notifications.noMatch')}
                  </p>
                  <p className="mx-auto mt-1 max-w-sm text-[12px] font-medium text-[#64748B]">
                    {t('notifications.noMatchHint')}
                  </p>
                  <div className="mt-4 flex justify-center">
                    <GlassButton type="button" variant="secondary" size="sm" onClick={() => setFilter('ALL')}>
                      {t('common.clearFilter')}
                    </GlassButton>
                  </div>
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-slate-200/80 dark:divide-slate-800 dark:divide-[#ffffff08]">
                <AnimatePresence initial={false} mode="popLayout">
                  {filtered.map((n) => (
                    <NotificationRow
                      key={n.id}
                      n={n}
                      onMarkRead={handleMarkOne}
                      isMarkingRead={markOneMutation.isPending && markOneMutation.variables === n.id}
                      t={t}
                    />
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </GlassCard>
        </motion.div>
      </motion.div>
    </div>
  );
}
