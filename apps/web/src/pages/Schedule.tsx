/**
 * M-EDU SchedulePage — v19 "Temporal Canvas · Weekly Atelier"
 *
 * 🎯 v18 → v19 Complete Visual Rearchitecture:
 *  ✅ Weekly Grid View — Real 7-column timetable (not a list). Default mode.
 *  ✅ Three View Modes — Grid ⇄ List ⇄ Heatmap (Utilization) via segmented toggle.
 *  ✅ Split-Pane Layout — Sticky left filter rail + right canvas pane.
 *  ✅ Aurora Backdrop — Fixed atmospheric gradient + breathing orbs + grid.
 *  ✅ Floating Command Bar — Sticky pill: breadcrumb · view toggle · Add CTA.
 *  ✅ Horizontal Stat Pills — Compact single-row strip (not tiles).
 *  ✅ Day-Wise Column Stack — Each day is a self-contained vertical column.
 *  ✅ Editorial Numbered Entries — List view uses ghost-numerals.
 *  ✅ Preserved — All queries, mutations, i18n, filters, modal, confirm, pagination.
 */

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { scheduleApi, groupsApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys.factory';
import {
  GlassPageHeader,
  GlassErrorState,
  GlassModal,
  GlassSelect,
  GlassInput,
  GlassButton,
  ConfirmDialog,
  useToast,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, Schedule, Group, DayOfWeek } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';
import { usePrefersReducedMotion } from '@/layouts/core/singletons';
import { useListKeyboardNavigation } from '@/hooks/useListKeyboardNavigation';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { openSidecar, type QuickLookData } from '@/stores/ui.store';

/* ══════════════════════════════════════════════════════════════════════════
 * MOTION TOKENS
 * ════════════════════════════════════════════════════════════════════════ */

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  soft:   { type: 'spring', stiffness: 220, damping: 28, mass: 1.0 },
} as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.06 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: SPRING.smooth },
};

/* ══════════════════════════════════════════════════════════════════════════
 * ICONS
 * ════════════════════════════════════════════════════════════════════════ */

const ICON_STROKE = 1.75;

const I: Record<string, string[]> = {
  calendar: [
    'M8 2v4', 'M16 2v4', 'M3 10h18',
    'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z',
  ],
  calendarCheck: [
    'M8 2v4', 'M16 2v4', 'M3 10h18',
    'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z',
    'M9 15l2 2 4-4',
  ],
  clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'],
  usersRound: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M22 21v-2a4 4 0 0 0-3-3.9',
    'M16 3.1a4 4 0 0 1 0 7.8',
  ],
  door: ['M3 21h18', 'M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16', 'M14 12h.01'],
  plus: ['M12 5v14', 'M5 12h14'],
  edit: [
    'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
    'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  ],
  trash: [
    'M3 6h18', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6',
    'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
    'M10 11v6', 'M14 11v6',
  ],
  sparkles: [
    'M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z',
    'M18.5 3.5v3', 'M20 5h-3',
    'M5.5 18v2.5', 'M6.75 19.25h-2.5',
  ],
  arrowLeft: ['M19 12H5', 'M12 19l-7-7 7-7'],
  arrowRight: ['M5 12h14', 'M12 5l7 7-7 7'],
  book: [
    'M12 7v14',
    'M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
  ],
  empty: [
    'M20 7h-9', 'M14 17H5',
    'M19 19v-2a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v2',
    'M10 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  ],
  check: ['M20 6 9 17l-5-5'],
  grid: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M14 14h7v7h-7z', 'M3 14h7v7H3z'],
  list: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'],
  flame: ['M12 2s4 5 4 9a4 4 0 0 1-8 0c0-2 2-4 2-4s-1 3 0 4 3-1 3-3c0-3-1-6-1-6z', 'M12 22a6 6 0 0 0 6-6c0-3-2-5-2-5'],
  chevronLeft: ['M15 18l-6-6 6-6'],
  chevronRight: ['M9 18l6-6-6-6'],
};

function Icon({
  paths,
  size = 18,
  className = '',
  strokeWidth = ICON_STROKE,
  ...rest
}: {
  paths: string[];
  size?: number;
  className?: string;
  strokeWidth?: number;
} & React.SVGProps<SVGSVGElement>) {
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
      aria-hidden
      {...rest}
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * TONES
 * ════════════════════════════════════════════════════════════════════════ */

type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple';

const TONES: Record<Tone, { fg: string; bg: string; glow: string; border: string }> = {
  blue:   { fg: '#2563EB', bg: 'rgba(37,99,235,0.10)',  glow: 'rgba(37,99,235,0.28)',  border: 'rgba(37,99,235,0.20)'  },
  green:  { fg: '#10B981', bg: 'rgba(16,185,129,0.10)', glow: 'rgba(16,185,129,0.28)', border: 'rgba(16,185,129,0.20)' },
  orange: { fg: '#F59E0B', bg: 'rgba(245,158,11,0.10)', glow: 'rgba(245,158,11,0.28)', border: 'rgba(245,158,11,0.20)' },
  red:    { fg: '#EF4444', bg: 'rgba(239,68,68,0.10)',  glow: 'rgba(239,68,68,0.28)',  border: 'rgba(239,68,68,0.20)'  },
  purple: { fg: '#6366F1', bg: 'rgba(99,102,241,0.10)', glow: 'rgba(99,102,241,0.28)', border: 'rgba(99,102,241,0.20)' },
};

const DAY_TONES: Record<DayOfWeek, Tone> = {
  MONDAY: 'blue',
  TUESDAY: 'purple',
  WEDNESDAY: 'green',
  THURSDAY: 'orange',
  FRIDAY: 'red',
  SATURDAY: 'blue',
  SUNDAY: 'purple',
};

const DAYS: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

function formatDay(d: DayOfWeek): string {
  return `schedule.day.${d}`;
}

/* ══════════════════════════════════════════════════════════════════════════
 * TYPES & CONSTANTS
 * ════════════════════════════════════════════════════════════════════════ */

type ViewMode = 'grid' | 'list' | 'heatmap';

interface ScheduleFilters {
  page: number;
  limit: number;
  groupId?: string;
  dayOfWeek?: string;
}

interface ScheduleFormState {
  groupId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  room: string;
}

const INITIAL_FORM: ScheduleFormState = {
  groupId: '',
  dayOfWeek: 'MONDAY',
  startTime: '09:00',
  endTime: '10:00',
  room: '',
};

function durationMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}

/* ══════════════════════════════════════════════════════════════════════════
 * AURORA BACKDROP
 * ════════════════════════════════════════════════════════════════════════ */

function AuroraBackdrop() {
  const reduced = usePrefersReducedMotion();
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-[#04060C] dark:via-[#0A0F1A] dark:to-[#080A14]" />
      <div className="absolute -left-40 -top-40 h-[580px] w-[580px] rounded-full bg-blue-400/10 blur-[140px] dark:bg-sky-500/10" />
      <div className="absolute -right-32 top-1/3 h-[520px] w-[520px] rounded-full bg-violet-400/10 blur-[140px] dark:bg-violet-500/10" />
      <div className="absolute -bottom-32 left-1/3 h-[460px] w-[460px] rounded-full bg-emerald-400/08 blur-[140px] dark:bg-emerald-500/08" />
      {!reduced && (
        <motion.div
          animate={{ scale: [1, 1.06, 1], opacity: [0.55, 0.85, 0.55] }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute left-1/2 top-1/2 h-[700px] w-[1000px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-blue-500/[0.03] via-violet-500/[0.02] to-emerald-500/[0.03] blur-[160px]"
        />
      )}
      <div
        className="absolute inset-0 opacity-[0.015] dark:opacity-[0.022]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(15,23,42,0.85) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.85) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * STAT PILL — compact horizontal metric
 * ════════════════════════════════════════════════════════════════════════ */

function StatPill({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number | string;
  icon: string[];
  tone: Tone;
}) {
  const c = TONES[tone];
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={SPRING.snappy}
      className="liquid-glass-card relative flex items-center gap-2.5 overflow-hidden rounded-2xl px-3.5 py-2.5 transition-all duration-200"
      style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 2px 8px -4px rgba(15,23,42,0.06)' }}
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ background: c.bg, color: c.fg }}
      >
        <Icon paths={icon} size={14} strokeWidth={2.2} />
      </div>
      <div className="min-w-0">
        <div className="text-[18px] font-black leading-none tabular-nums tracking-tight text-[var(--text-primary)]">
          {value}
        </div>
        <div className="mt-0.5 truncate text-[9.5px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">
          {label}
        </div>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * GRID VIEW — 7-column weekly timetable
 * ════════════════════════════════════════════════════════════════════════ */

function GridView({
  entries,
  onEdit,
  onDelete,
  onSidecar,
  deletePending,
  deleteTarget,
  t,
}: {
  entries: Schedule[];
  onEdit: (s: Schedule) => void;
  onDelete: (id: string) => void;
  onSidecar: (s: Schedule) => void;
  deletePending: boolean;
  deleteTarget: string | null;
  t: (k: string, vars?: Record<string, string | number>) => string;
}) {
  // Group entries by day
  const byDay = useMemo(() => {
    const map = new Map<DayOfWeek, Schedule[]>();
    DAYS.forEach((d) => map.set(d, []));
    entries.forEach((e) => {
      const arr = map.get(e.dayOfWeek) || [];
      arr.push(e);
      map.set(e.dayOfWeek, arr);
    });
    // Sort each day's entries by start time
    map.forEach((arr) => arr.sort((a, b) => a.startTime.localeCompare(b.startTime)));
    return map;
  }, [entries]);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7">
      {DAYS.map((day) => {
        const dayEntries = byDay.get(day) || [];
        const tone = DAY_TONES[day];
        const c = TONES[tone];
        const dayLabel = t(formatDay(day));
        const short = dayLabel.length > 3 ? dayLabel.slice(0, 3) : dayLabel;
        const dayIdx = DAYS.indexOf(day) + 1;

        return (
          <motion.div
            key={day}
            variants={cardVariants}
            className="liquid-glass-surface relative flex min-h-[280px] flex-col overflow-hidden rounded-2xl transition-all"
          >
            {/* Column header */}
            <div
              className="relative flex items-center justify-between px-3 py-2.5"
              style={{
                background: `linear-gradient(180deg, ${c.bg} 0%, transparent 100%)`,
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-md text-[9.5px] font-black tabular-nums"
                  style={{ background: c.fg, color: '#fff' }}
                >
                  {String(dayIdx).padStart(2, '0')}
                </span>
                <div>
                  <p
                    className="text-[11px] font-black uppercase tracking-[0.1em]"
                    style={{ color: c.fg }}
                  >
                    {short}
                  </p>
                  <p className="text-[9px] font-semibold text-[var(--text-muted)] tabular-nums">
                    {dayEntries.length} {dayEntries.length === 1 ? 'slot' : 'slots'}
                  </p>
                </div>
              </div>
            </div>

            {/* Entries stack */}
            <div className="flex-1 space-y-1.5 p-2">
              {dayEntries.length === 0 ? (
                <div className="flex h-full min-h-[180px] items-center justify-center text-[10.5px] font-medium italic text-[var(--text-muted)] opacity-50">
                  —
                </div>
              ) : (
                dayEntries.map((s) => {
                  const gName = (s as Schedule & { group?: { name?: string } }).group?.name ?? '—';
                  const isDeleting = deletePending && deleteTarget === s.id;
                  const mins = durationMinutes(s.startTime, s.endTime);

                  return (
                    <motion.div
                      key={s.id}
                      whileHover={{ y: -1 }}
                      transition={SPRING.snappy}
                      className="group relative overflow-hidden rounded-xl border border-slate-200/70 bg-white/85 p-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] backdrop-blur-sm transition-shadow hover:shadow-md dark:border-white/[0.08] dark:bg-white/[0.05]"
                    >
                      <span
                        aria-hidden
                        className="absolute inset-y-0 left-0 w-1"
                        style={{ background: c.fg }}
                      />

                      {/* Time */}
                      <div className="flex items-center gap-1 text-[10.5px] font-black tabular-nums" style={{ color: c.fg }}>
                        <Icon paths={I.clock} size={9} strokeWidth={2.5} />
                        <span>{s.startTime}</span>
                        <span className="opacity-40">–</span>
                        <span>{s.endTime}</span>
                      </div>

                      {/* Group */}
                      <p className="mt-1 truncate text-[11.5px] font-bold text-[var(--text-primary)]">
                        {gName}
                      </p>

                      {/* Room + duration */}
                      <div className="mt-1 flex items-center justify-between gap-1">
                        {s.room && (
                          <span className="inline-flex items-center gap-0.5 rounded text-[9px] font-bold text-[var(--text-muted)]">
                            <Icon paths={I.door} size={8} strokeWidth={2.4} />
                            {s.room}
                          </span>
                        )}
                        {mins > 0 && (
                          <span className="text-[8.5px] font-bold uppercase tracking-wider text-[var(--text-muted)] tabular-nums">
                            {Math.floor(mins / 60) > 0 && `${Math.floor(mins / 60)}h`}
                            {mins % 60 > 0 && ` ${mins % 60}m`}
                          </span>
                        )}
                      </div>

                      {/* Hover actions */}
                      <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => onSidecar(s)}
                          className="flex h-5 w-5 items-center justify-center rounded-lg bg-white/95 text-slate-700 shadow-sm hover:bg-white dark:bg-surface-800 dark:text-slate-200"
                          aria-label="Split-view sidecar"
                          title="Split-view sidecar (Enter)"
                        >
                          <span className="text-[10px] leading-none">◨</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onEdit(s)}
                          className="flex h-5 w-5 items-center justify-center rounded-lg bg-white/95 text-[#007AFF] shadow-sm hover:bg-white dark:bg-surface-800 dark:text-[#0A84FF]"
                          aria-label={t('common.edit')}
                        >
                          <Icon paths={I.edit} size={9} strokeWidth={2.2} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(s.id)}
                          disabled={isDeleting}
                          className="flex h-5 w-5 items-center justify-center rounded-lg bg-white/95 text-[#FF3B30] shadow-sm hover:bg-white disabled:opacity-50 dark:bg-surface-800"
                          aria-label={t('schedule.remove')}
                        >
                          <Icon paths={I.trash} size={9} strokeWidth={2.2} />
                        </button>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * LIST VIEW — editorial numbered rows
 * ════════════════════════════════════════════════════════════════════════ */

function ListView({
  entries,
  onEdit,
  onDelete,
  onSidecar,
  deletePending,
  deleteTarget,
  t,
}: {
  entries: Schedule[];
  onEdit: (s: Schedule) => void;
  onDelete: (id: string) => void;
  onSidecar: (s: Schedule) => void;
  deletePending: boolean;
  deleteTarget: string | null;
  t: (k: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <div className="divide-y divide-slate-200/70 dark:divide-white/[0.06]">
      {entries.map((s, idx) => {
        const tone = DAY_TONES[s.dayOfWeek];
        const c = TONES[tone];
        const gName = (s as Schedule & { group?: { name?: string } }).group?.name ?? '—';
        const isDeleting = deletePending && deleteTarget === s.id;
        const mins = durationMinutes(s.startTime, s.endTime);
        const dayLabel = t(formatDay(s.dayOfWeek));

        return (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...SPRING.smooth, delay: idx * 0.03 }}
            className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-slate-50/60 dark:hover:bg-white/[0.03]"
          >
            {/* Ghost numeral */}
            <span
              className="hidden w-8 shrink-0 text-[22px] font-black leading-none tabular-nums tracking-[-0.02em] text-slate-900/[0.08] sm:block dark:text-white/[0.08]"
              style={{ fontFeatureSettings: '"tnum"' }}
            >
              {String(idx + 1).padStart(2, '0')}
            </span>

            {/* Day badge */}
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[11px] font-black uppercase"
              style={{
                background: c.bg,
                color: c.fg,
                border: `1px solid ${c.border}`,
              }}
            >
              {dayLabel.slice(0, 3)}
            </div>

            {/* Main content */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[13px] font-bold tracking-tight text-[var(--text-primary)]">
                  {gName}
                </p>
                {s.room && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider"
                    style={{ background: c.bg, color: c.fg }}
                  >
                    <Icon paths={I.door} size={8} strokeWidth={2.5} />
                    {s.room}
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-2 text-[11.5px]">
                <span
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-black tabular-nums"
                  style={{ background: c.bg, color: c.fg }}
                >
                  <Icon paths={I.clock} size={9} strokeWidth={2.5} />
                  {s.startTime} <span className="opacity-40">→</span> {s.endTime}
                </span>
                {mins > 0 && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] tabular-nums">
                    {Math.floor(mins / 60) > 0 && `${Math.floor(mins / 60)}h `}
                    {mins % 60 > 0 && `${mins % 60}m`}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex shrink-0 gap-1.5 opacity-100 sm:opacity-60 sm:group-hover:opacity-100 transition-opacity">
              <motion.button
                type="button"
                onClick={() => onSidecar(s)}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                transition={SPRING.snappy}
                aria-label="Split-view sidecar"
                title="Split-View Sidecar (Enter / Space)"
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ background: 'rgba(99,102,241,0.10)', color: '#6366F1', border: '1px solid rgba(99,102,241,0.20)' }}
              >
                <span className="text-[12px] leading-none">◨</span>
              </motion.button>
              <motion.button
                type="button"
                onClick={() => onEdit(s)}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                transition={SPRING.snappy}
                aria-label={t('common.edit')}
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ background: 'rgba(37,99,235,0.10)', color: '#2563EB', border: '1px solid rgba(37,99,235,0.20)' }}
              >
                <Icon paths={I.edit} size={13} strokeWidth={2} />
              </motion.button>
              <motion.button
                type="button"
                onClick={() => onDelete(s.id)}
                disabled={isDeleting}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                transition={SPRING.snappy}
                aria-label={t('schedule.remove')}
                className="flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-50"
                style={{ background: 'rgba(239,68,68,0.10)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.20)' }}
              >
                {isDeleting ? (
                  <motion.span
                    className="h-3 w-3 rounded-full border-2 border-current/30 border-t-current"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                  />
                ) : (
                  <Icon paths={I.trash} size={13} strokeWidth={2} />
                )}
              </motion.button>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * HEATMAP VIEW — room utilization
 * ════════════════════════════════════════════════════════════════════════ */

type UtilizationData = {
  utilizationPercentage: number;
  totalAvailableSlots: number;
  occupiedSlots: number;
  deadHoursCount: number;
  rooms: Array<{
    name: string;
    capacity: number;
    utilization: number;
    occupiedSlots: number;
    totalSlots: number;
    isDeadHourProne: boolean;
    dayBreakdown: Record<string, number>;
  }>;
  recommendations: string[];
};

function HeatmapView({
  data,
  isLoading,
}: {
  data: UtilizationData | undefined;
  isLoading: boolean;
}) {
  if (isLoading || !data) {
    return (
      <div className="flex h-48 items-center justify-center rounded-2xl border border-slate-200/70 bg-white/50 dark:border-white/[0.06] dark:bg-white/[0.03]">
        <motion.span
          className="inline-block h-6 w-6 rounded-full border-2 border-[#2563EB]/30 border-t-[#2563EB]"
          animate={{ rotate: 360 }}
          transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Hero summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
            <Icon paths={I.flame} size={11} strokeWidth={2.5} />
            Umumiy bandlik
          </div>
          <p className="mt-2 text-[32px] font-black leading-none tabular-nums text-emerald-600 dark:text-emerald-400">
            {data.utilizationPercentage}%
          </p>
          <p className="mt-1 text-[11px] font-medium text-[var(--text-muted)] tabular-nums">
            {data.occupiedSlots} / {data.totalAvailableSlots} slot band
          </p>
        </div>
        <div className="rounded-2xl border border-red-500/25 bg-red-500/[0.06] p-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-red-700 dark:text-red-300">
            <Icon paths={I.clock} size={11} strokeWidth={2.5} />
            Dead Hours
          </div>
          <p className="mt-2 text-[32px] font-black leading-none tabular-nums text-red-600 dark:text-red-400">
            {data.deadHoursCount}
          </p>
          <p className="mt-1 text-[11px] font-medium text-[var(--text-muted)]">
            ta xona risk ostida
          </p>
        </div>
      </div>

      {/* Room cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.rooms.map((r, i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 backdrop-blur-sm dark:border-white/[0.08] dark:bg-white/[0.03]"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500/12 text-indigo-600 dark:text-indigo-400">
                  <Icon paths={I.door} size={13} strokeWidth={2.2} />
                </span>
                <span className="truncate text-[13px] font-bold text-[var(--text-primary)]">
                  {r.name}
                </span>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black tabular-nums ${
                  r.isDeadHourProne
                    ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                    : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {r.utilization}%
              </span>
            </div>

            <div className="mt-2 flex justify-between text-[10px] font-semibold text-[var(--text-muted)]">
              <span>Sig'im: {r.capacity}</span>
              <span className="tabular-nums">
                {r.occupiedSlots}/{r.totalSlots} slot
              </span>
            </div>

            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/[0.06]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${r.utilization}%` }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className={`h-full rounded-full ${
                  r.utilization > 60
                    ? 'bg-emerald-500'
                    : r.utilization >= 35
                      ? 'bg-amber-500'
                      : 'bg-red-500'
                }`}
              />
            </div>

            <div className="mt-2.5 flex flex-wrap gap-1">
              {Object.entries(r.dayBreakdown || {}).map(([day, count]) => (
                <span
                  key={day}
                  className={`rounded px-1.5 py-0.5 text-[9px] font-bold tabular-nums ${
                    (count as number) > 0
                      ? 'bg-indigo-500/12 text-indigo-700 dark:text-indigo-300'
                      : 'bg-slate-500/[0.06] text-[var(--text-muted)]'
                  }`}
                >
                  {day.slice(0, 3)}
                </span>
              ))}
            </div>

            {r.isDeadHourProne && (
              <p className="mt-2 text-[10px] font-medium text-red-500">
                ⚠️ Kam bandlik: vaqtlarni to'ldirish tavsiya etiladi
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Recommendations */}
      {data.recommendations && data.recommendations.length > 0 && (
        <div className="rounded-2xl border border-sky-500/25 bg-sky-500/[0.05] p-4">
          <h3 className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.1em] text-sky-700 dark:text-sky-300">
            <Icon paths={I.sparkles} size={12} strokeWidth={2.5} />
            Avtomatik tavsiyalar
          </h3>
          <ul className="mt-2 space-y-1">
            {data.recommendations.map((rec, idx) => (
              <li
                key={idx}
                className="flex items-start gap-1.5 text-[11.5px] font-medium leading-snug text-sky-900/80 dark:text-sky-200/80"
              >
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-sky-500" />
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * SHIMMER + SKELETON
 * ════════════════════════════════════════════════════════════════════════ */

function Shimmer({ className = '', radius = '0.75rem' }: { className?: string; radius?: string }) {
  return (
    <div
      className={`skeleton-shimmer relative overflow-hidden border border-white/60 dark:border-white/[0.06] ${className}`}
      style={{ borderRadius: radius }}
    />
  );
}

function ScheduleSkeleton() {
  return (
    <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
      <div className="space-y-3">
        <Shimmer className="h-32 w-full" radius="1rem" />
        <Shimmer className="h-44 w-full" radius="1rem" />
      </div>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Shimmer key={i} className="h-14" radius="0.75rem" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Shimmer key={i} className="h-[280px]" radius="1rem" />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * MAIN PAGE
 * ════════════════════════════════════════════════════════════════════════ */

export function SchedulePage() {
  const { t } = useI18n();
  usePageTitle(t('nav.schedule'));
  const { push, toastNode } = useToast();
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [groupFilter, setGroupFilter] = useState('');
  const [dayFilter, setDayFilter] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [modalOpen, setModalOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<Schedule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const { playPop, playTick } = usePremiumSound();

  const utilizationQ = useQuery({
    queryKey: ['schedule-room-utilization'],
    queryFn: () => scheduleApi.getRoomUtilization() as Promise<UtilizationData>,
    enabled: viewMode === 'heatmap',
  });

  const [form, setForm] = useState<ScheduleFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ScheduleFormState, string>>>({});

  const params = useMemo<ScheduleFilters>(
    () => ({
      page,
      limit: viewMode === 'grid' ? 200 : 20, // More entries in grid view
      groupId: groupFilter || undefined,
      dayOfWeek: dayFilter || undefined,
    }),
    [page, groupFilter, dayFilter, viewMode],
  );

  const scheduleQ = useQuery({
    queryKey: ['schedule', params],
    queryFn: () => scheduleApi.list(params),
    placeholderData: (prev) => prev,
  });

  const data = scheduleQ.data as Paginated<Schedule> | undefined;
  const isLoading = scheduleQ.isLoading;
  const error = scheduleQ.error;

  const groupsQ = useQuery({
    queryKey: queryKeys.groups.selectors(),
    queryFn: () => groupsApi.list({ limit: 200 }),
    staleTime: 5 * 60 * 1000,
  });

  /* ── Mutations ─────────────────────────────────────────────── */
  const createMut = useMutation({
    mutationFn: (d: ScheduleFormState) =>
      scheduleApi.create({
        groupId: d.groupId,
        dayOfWeek: d.dayOfWeek,
        startTime: d.startTime,
        endTime: d.endTime,
        room: d.room || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule'] });
      qc.invalidateQueries({ queryKey: queryKeys.groups.all() });
      qc.invalidateQueries({ queryKey: queryKeys.groups.details() });
      push('success', t('schedule.created'));
      closeModal();
    },
    onError: (e: unknown) => push('error', getErrorMessage(e)),
  });

  const updateMut = useMutation({
    mutationFn: (d: ScheduleFormState & { id: string }) =>
      scheduleApi.update(d.id, {
        dayOfWeek: d.dayOfWeek,
        startTime: d.startTime,
        endTime: d.endTime,
        room: d.room || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule'] });
      qc.invalidateQueries({ queryKey: queryKeys.groups.all() });
      qc.invalidateQueries({ queryKey: queryKeys.groups.details() });
      push('success', t('schedule.updated'));
      closeModal();
    },
    onError: (e: unknown) => push('error', getErrorMessage(e)),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => scheduleApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule'] });
      qc.invalidateQueries({ queryKey: queryKeys.groups.all() });
      qc.invalidateQueries({ queryKey: queryKeys.groups.details() });
      push('success', t('schedule.removed'));
      setDeleteTarget(null);
    },
    onError: (e: unknown) => push('error', getErrorMessage(e)),
  });

  /* ── Handlers ──────────────────────────────────────────────── */
  const openCreate = useCallback(() => {
    setEditEntry(null);
    setForm(INITIAL_FORM);
    setFormErrors({});
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((s: Schedule) => {
    setEditEntry(s);
    setForm({
      groupId: s.groupId,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      room: s.room ?? '',
    });
    setFormErrors({});
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditEntry(null);
  }, []);

  const handleDelete = useCallback((id: string) => {
    setDeleteTarget(id);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteMut.mutate(deleteTarget);
  }, [deleteTarget, deleteMut]);

  const handleOpenScheduleSidecar = useCallback((s: Schedule) => {
    const gName = (s as Schedule & { group?: { name?: string } }).group?.name ?? 'Dars sloti';
    const dayLabel = t(formatDay(s.dayOfWeek));
    const mins = durationMinutes(s.startTime, s.endTime);
    const sidecarData: QuickLookData = {
      id: s.id,
      type: 'group',
      title: gName,
      subtitle: `${dayLabel} · ${s.startTime} → ${s.endTime}${s.room ? ` · Xona: ${s.room}` : ''}`,
      badge: {
        text: dayLabel,
        tone: 'blue',
      },
      avatar: {
        text: gName.slice(0, 2).toUpperCase(),
        color: '#2563EB',
      },
      metrics: [
        { label: 'Boshlanish', value: s.startTime },
        { label: 'Tugash', value: s.endTime },
        { label: 'Davomiyligi', value: mins > 0 ? `${mins} daqiqa` : '—' },
        { label: 'Xona', value: s.room || 'Belgilanmagan' },
      ],
      details: [
        { label: 'Slot ID', value: s.id, copyable: true },
        { label: 'Guruh ID', value: s.groupId, copyable: true },
        { label: 'Hafta kuni', value: dayLabel },
        { label: 'Xona', value: s.room || 'Biriktirilmagan' },
      ],
      primaryAction: {
        label: 'Slotni tahrirlash',
        onExecute: () => openEdit(s),
      },
      secondaryAction: {
        label: 'Slotni o\'chirish',
        onExecute: () => handleDelete(s.id),
      },
    };
    openSidecar(sidecarData);
  }, [t, openEdit, handleDelete]);

  /* Keyboard shortcut 'c' to create */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'c' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        playPop();
        openCreate();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openCreate, playPop]);

  const validate = (): boolean => {
    const errs: Partial<Record<keyof ScheduleFormState, string>> = {};
    if (!form.groupId) errs.groupId = t('common.required');
    if (!form.startTime) errs.startTime = t('common.required');
    if (!form.endTime) errs.endTime = t('common.required');
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (editEntry) {
      updateMut.mutate({ ...form, id: editEntry.id });
    } else {
      createMut.mutate(form);
    }
  };

  const items = data?.items ?? [];
  const groups = (groupsQ.data as { items: Group[] } | undefined)?.items ?? [];

  useListKeyboardNavigation<Schedule>({
    items,
    getItemId: (s) => s.id,
    rowIdPrefix: 'schedule-row-',
    onSelect: (s) => { playTick(); handleOpenScheduleSidecar(s); },
    onQuickLook: (s) => { playTick(); handleOpenScheduleSidecar(s); },
    onEdit: (s) => openEdit(s),
    onDelete: (sList) => { if (sList && sList[0]) handleDelete(sList[0].id); },
  });

  const stats = useMemo(() => {
    const uniqueGroups = new Set(items.map((s) => s.groupId)).size;
    const uniqueDays = new Set(items.map((s) => s.dayOfWeek)).size;
    const uniqueRooms = new Set(items.map((s) => s.room).filter(Boolean)).size;
    return {
      total: data?.total ?? 0,
      uniqueGroups,
      uniqueDays,
      uniqueRooms,
    };
  }, [items, data?.total]);

  /* ── Loading ───────────────────────────────────────────────── */
  if (isLoading && !data) {
    return (
      <div className="page-container mx-auto max-w-7xl pb-12">
        <AuroraBackdrop />
        <div className="mb-6 h-16" />
        <ScheduleSkeleton />
      </div>
    );
  }

  /* ── Error ─────────────────────────────────────────────────── */
  if (error && !data) {
    return (
      <div className="page-container mx-auto max-w-3xl space-y-5 pb-12">
        <AuroraBackdrop />
        <GlassPageHeader title={t('nav.schedule')} subtitle={t('nav.schedule')} />
        <div className="rounded-2xl border border-black/[0.06] bg-white/80 p-8 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card">
          <GlassErrorState message={getErrorMessage(error)} />
        </div>
      </div>
    );
  }

  /* ── Main Render ───────────────────────────────────────────── */
  return (
    <div className="page-container relative z-10 mx-auto max-w-7xl pb-12">
      <AuroraBackdrop />
      {toastNode}

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-5"
      >
        {/* ═══ FLOATING COMMAND BAR ═══ */}
        <motion.div variants={cardVariants} className="sticky top-4 z-30 mt-4">
          <div
            className="liquid-glass-surface flex flex-wrap items-center gap-3 rounded-2xl px-3 py-2.5"
            style={{
              boxShadow:
                '0 8px 28px -10px rgba(15,23,42,0.15), 0 1px 0 rgba(255,255,255,0.95) inset',
            }}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#2563EB] to-[#6366F1] text-white shadow-[0_4px_14px_-4px_rgba(37,99,235,0.5)]">
              <Icon paths={I.calendarCheck} size={16} strokeWidth={2.2} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                <span>M-EDU</span>
                <span className="opacity-50">/</span>
                <span className="text-[#2563EB] dark:text-[#38BDF8]">Schedule</span>
              </div>
              <h1 className="truncate text-[15px] font-extrabold leading-tight tracking-tight text-[var(--text-primary)]">
                {t('nav.schedule')}
              </h1>
            </div>

            {/* View toggle */}
            <div className="inline-flex items-center rounded-xl border border-slate-200/80 bg-slate-100/70 p-0.5 dark:border-white/[0.08] dark:bg-white/[0.04]">
              {([
                { id: 'grid', icon: I.grid, label: 'Grid' },
                { id: 'list', icon: I.list, label: 'List' },
                { id: 'heatmap', icon: I.flame, label: 'Heat' },
              ] as const).map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setViewMode(v.id)}
                  aria-label={v.label}
                  title={v.label}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-all ${
                    viewMode === v.id
                      ? 'bg-white text-[var(--text-primary)] shadow-sm dark:bg-white/[0.14]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Icon paths={v.icon} size={12} strokeWidth={2.2} />
                  <span className="hidden sm:inline">{v.label}</span>
                </button>
              ))}
            </div>

            <GlassButton variant="primary" size="sm" onClick={openCreate}>
              <span className="inline-flex items-center gap-1.5">
                <Icon paths={I.plus} size={13} strokeWidth={2.5} />
                <span className="hidden sm:inline">{t('schedule.addEntry')}</span>
              </span>
            </GlassButton>
          </div>
        </motion.div>

        {/* ═══ STAT PILLS ═══ */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <StatPill label={t('schedule.col.time')} value={stats.total} icon={I.calendarCheck} tone="blue" />
          <StatPill label={t('groups.title')} value={stats.uniqueGroups} icon={I.usersRound} tone="green" />
          <StatPill label={t('schedule.dayOfWeek')} value={stats.uniqueDays} icon={I.calendar} tone="orange" />
          <StatPill label={t('groups.col.room')} value={stats.uniqueRooms} icon={I.door} tone="purple" />
        </div>

        {/* ═══ SPLIT PANE ═══ */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[240px_1fr]">
          {/* ── LEFT RAIL ── */}
          <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
            <div className="space-y-3">
              {/* Day filter */}
              <div
                className="rounded-2xl border border-black/[0.06] bg-white/80 p-3 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card"
              >
                <p className="px-1 pb-2 text-[9.5px] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  {t('schedule.dayOfWeek')}
                </p>
                <div className="space-y-0.5">
                  <button
                    type="button"
                    onClick={() => { setDayFilter(''); setPage(1); }}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] font-semibold transition-colors ${
                      dayFilter === ''
                        ? 'bg-[#2563EB]/10 text-[#2563EB] dark:text-[#38BDF8]'
                        : 'text-[var(--text-secondary)] hover:bg-slate-100/60 dark:hover:bg-white/[0.04]'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${dayFilter === '' ? 'bg-[#2563EB] dark:bg-[#38BDF8]' : 'bg-slate-300'}`} />
                    {t('schedule.allDays')}
                  </button>
                  {DAYS.map((d) => {
                    const active = dayFilter === d;
                    const c = TONES[DAY_TONES[d]];
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => { setDayFilter(d); setPage(1); }}
                        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] font-semibold transition-colors ${
                          active
                            ? 'shadow-sm'
                            : 'text-[var(--text-secondary)] hover:bg-slate-100/60 dark:hover:bg-white/[0.04]'
                        }`}
                        style={active ? { background: c.bg, color: c.fg } : undefined}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: active ? c.fg : '#CBD5E1' }}
                        />
                        {t(formatDay(d))}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Group filter */}
              <div
                className="rounded-2xl border border-black/[0.06] bg-white/80 p-3 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card"
              >
                <p className="px-1 pb-2 text-[9.5px] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  {t('exams.form.group')}
                </p>
                <GlassSelect
                  value={groupFilter}
                  onChange={(e) => { setGroupFilter(e.target.value); setPage(1); }}
                  options={[
                    { value: '', label: t('students.allGroups') },
                    ...groups.map((g) => ({ value: g.id, label: g.name })),
                  ]}
                  placeholder={t('students.allGroups')}
                />
              </div>

              {/* Reset filters */}
              {(dayFilter || groupFilter) && (
                <button
                  type="button"
                  onClick={() => { setDayFilter(''); setGroupFilter(''); setPage(1); }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-blue-500/25 bg-blue-500/[0.06] px-3 py-2 text-[11.5px] font-bold text-[#2563EB] transition-colors hover:bg-blue-500/[0.12] dark:text-[#38BDF8]"
                >
                  <Icon paths={I.chevronLeft} size={11} strokeWidth={2.5} />
                  {t('common.clear') || 'Tozalash'}
                </button>
              )}
            </div>
          </aside>

          {/* ── RIGHT CANVAS ── */}
          <div className="min-w-0 space-y-4">
            {/* Mobile filters */}
            <div className="lg:hidden">
              <div
                className="rounded-2xl border border-black/[0.06] bg-white/80 p-3 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card"
              >
                <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                  <button
                    type="button"
                    onClick={() => { setDayFilter(''); setPage(1); }}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors ${
                      dayFilter === ''
                        ? 'bg-[#2563EB] text-white'
                        : 'bg-slate-100 text-[var(--text-secondary)] dark:bg-white/[0.06]'
                    }`}
                  >
                    {t('schedule.allDays')}
                  </button>
                  {DAYS.map((d) => {
                    const active = dayFilter === d;
                    const c = TONES[DAY_TONES[d]];
                    const dayLabel = t(formatDay(d));
                    const short = dayLabel.length > 3 ? dayLabel.slice(0, 3) : dayLabel;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => { setDayFilter(d); setPage(1); }}
                        className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors ${
                          active
                            ? ''
                            : 'bg-slate-100 text-[var(--text-secondary)] dark:bg-white/[0.06]'
                        }`}
                        style={active ? { background: c.fg, color: '#fff' } : undefined}
                      >
                        {short}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2">
                  <GlassSelect
                    value={groupFilter}
                    onChange={(e) => { setGroupFilter(e.target.value); setPage(1); }}
                    options={[
                      { value: '', label: t('students.allGroups') },
                      ...groups.map((g) => ({ value: g.id, label: g.name })),
                    ]}
                    placeholder={t('students.allGroups')}
                  />
                </div>
              </div>
            </div>

            {/* Content switch */}
            <AnimatePresence mode="wait">
              {viewMode === 'heatmap' ? (
                <motion.div
                  key="heatmap"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={SPRING.smooth}
                >
                  <HeatmapView data={utilizationQ.data} isLoading={utilizationQ.isLoading} />
                </motion.div>
              ) : items.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={SPRING.smooth}
                >
                  <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300/80 bg-white/60 p-12 text-center backdrop-blur-xl dark:border-white/[0.10] dark:bg-white/[0.03]">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2563EB]/10 text-[#2563EB] shadow-[0_8px_24px_-12px_rgba(37,99,235,0.4)]">
                      <Icon paths={I.empty} size={26} strokeWidth={1.8} />
                    </div>
                    <p className="mt-4 text-[15px] font-bold text-[var(--text-primary)]">
                      {t('schedule.empty')}
                    </p>
                    <p className="mt-1 max-w-sm text-[12.5px] font-medium text-[var(--text-muted)]">
                      {t('schedule.emptyHint')}
                    </p>
                    <div className="mt-5">
                      <GlassButton variant="primary" size="sm" onClick={openCreate}>
                        <span className="inline-flex items-center gap-2">
                          <Icon paths={I.plus} size={14} strokeWidth={2.5} />
                          {t('schedule.addEntry')}
                        </span>
                      </GlassButton>
                    </div>
                  </div>
                </motion.div>
              ) : viewMode === 'grid' ? (
                <motion.div
                  key="grid"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={SPRING.smooth}
                >
                  <GridView
                    entries={items}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                    onSidecar={handleOpenScheduleSidecar}
                    deletePending={deleteMut.isPending}
                    deleteTarget={deleteTarget}
                    t={t}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="list"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={SPRING.smooth}
                  className="liquid-glass-surface overflow-hidden rounded-2xl"
                  style={{
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 8px 24px -12px rgba(15,23,42,0.10)',
                  }}
                >
                  <ListView
                    entries={items}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                    onSidecar={handleOpenScheduleSidecar}
                    deletePending={deleteMut.isPending}
                    deleteTarget={deleteTarget}
                    t={t}
                  />

                  {/* Pagination */}
                  {data && data.totalPages > 1 && (
                    <div className="border-t border-slate-200/70 p-3 dark:border-white/[0.06]">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page === 1}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/80 bg-white/80 text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] disabled:opacity-40 dark:border-white/[0.08] dark:bg-white/[0.05]"
                          aria-label={t('common.prevPage')}
                        >
                          <Icon paths={I.chevronLeft} size={13} strokeWidth={2.2} />
                        </button>
                        <span className="px-3 text-[11.5px] font-bold text-[var(--text-secondary)] tabular-nums">
                          {page} / {data.totalPages}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                          disabled={page === data.totalPages}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/80 bg-white/80 text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] disabled:opacity-40 dark:border-white/[0.08] dark:bg-white/[0.05]"
                          aria-label={t('common.nextPage')}
                        >
                          <Icon paths={I.chevronRight} size={13} strokeWidth={2.2} />
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* ═══ DELETE CONFIRM ═══ */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        description={t('schedule.removeConfirm')}
        loading={deleteMut.isPending}
      />

      {/* ═══ CREATE / EDIT MODAL ═══ */}
      <GlassModal
        open={modalOpen}
        onClose={closeModal}
        title={editEntry ? t('schedule.editTitle') : t('schedule.newTitle')}
        wide
        footer={
          <>
            <GlassButton variant="secondary" size="sm" onClick={closeModal}>
              {t('common.cancel')}
            </GlassButton>
            <GlassButton
              variant="primary"
              size="sm"
              type="submit"
              form="schedule-form"
              disabled={createMut.isPending || updateMut.isPending}
            >
              <span className="inline-flex items-center gap-2">
                {createMut.isPending || updateMut.isPending ? (
                  <>
                    <motion.span
                      className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                    />
                    {t('common.saving')}
                  </>
                ) : (
                  <>
                    <Icon paths={I.check} size={14} strokeWidth={2.5} />
                    {editEntry ? t('common.save') : t('common.create')}
                  </>
                )}
              </span>
            </GlassButton>
          </>
        }
      >
        <form id="schedule-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-[#2563EB]/20 bg-[#2563EB]/[0.05] px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#2563EB]/15 text-[#2563EB] dark:text-[#38BDF8]">
              <Icon paths={I.sparkles} size={17} strokeWidth={2} />
            </div>
            <p className="text-[12px] font-medium leading-snug text-[var(--text-secondary)]">
              {editEntry
                ? 'Kun, vaqt yoki xonani o\'zgartiring.'
                : 'Guruh uchun yangi haftalik dars slotini yarating.'}
            </p>
          </div>

          <GlassSelect
            label={t('exams.form.group')}
            value={form.groupId}
            onChange={(e) => setForm((f) => ({ ...f, groupId: e.target.value }))}
            options={[
              { value: '', label: t('schedule.selectGroup') },
              ...groups.map((g) => ({ value: g.id, label: g.name })),
            ]}
            placeholder={t('schedule.selectGroup')}
            error={formErrors.groupId}
          />

          <div>
            <p className="mb-2 text-[10.5px] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
              {t('schedule.dayOfWeek')}
            </p>
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
              {DAYS.map((d) => {
                const active = form.dayOfWeek === d;
                const c = TONES[DAY_TONES[d]];
                const dayLabel = t(formatDay(d));
                const short = dayLabel.length > 3 ? dayLabel.slice(0, 3) : dayLabel;
                const idx = DAYS.indexOf(d) + 1;
                return (
                  <motion.button
                    key={d}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, dayOfWeek: d }))}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    transition={SPRING.snappy}
                    className="relative flex flex-col items-center gap-0.5 rounded-xl border px-1 py-2.5 text-[11px] font-bold tracking-tight outline-none transition-colors"
                    style={{
                      borderColor: active ? c.border : 'rgba(0,0,0,0.06)',
                      background: active ? c.bg : 'transparent',
                      color: active ? c.fg : '#64748B',
                      boxShadow: active ? `inset 0 1px 0 rgba(255,255,255,0.6), 0 6px 14px -8px ${c.glow}` : 'none',
                    }}
                  >
                    <span className="tabular-nums text-[9px] opacity-60">
                      {String(idx).padStart(2, '0')}
                    </span>
                    <span className="uppercase">{short}</span>
                    <AnimatePresence>
                      {active && (
                        <motion.span
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={SPRING.snappy}
                          className="absolute right-1 top-1 flex h-3 w-3 items-center justify-center rounded-full"
                          style={{ background: c.fg, color: '#fff' }}
                        >
                          <Icon paths={I.check} size={7} strokeWidth={3.5} />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <GlassInput
              label={t('schedule.startTime')}
              type="time"
              value={form.startTime}
              onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
              error={formErrors.startTime}
            />
            <GlassInput
              label={t('schedule.endTime')}
              type="time"
              value={form.endTime}
              onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
              error={formErrors.endTime}
            />
          </div>

          <GlassInput
            label={t('groups.form.room')}
            value={form.room}
            onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))}
            placeholder={t('schedule.roomPlaceholder')}
            error={formErrors.room}
          />
        </form>
      </GlassModal>
    </div>
  );
}