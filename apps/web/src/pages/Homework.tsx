
export function formatDeadline(deadline: string | null | undefined): string {
  if (!deadline) return '—';
  return formatDate(deadline);
}

export function formatMaxScore(score: number | null | undefined): string {
  return score != null ? String(score) : '—';
}

export function isDeadlinePast(deadline: string | null | undefined): boolean {
  if (!deadline) return false;
  return new Date(deadline) < new Date();
}

export function isDeadlineSoon(deadline: string | null | undefined): boolean {
  if (!deadline) return false;
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diffDays = Math.ceil(
    (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  return diffDays >= 0 && diffDays <= 3;
}

/**
 * ============================================================================
 * M-EDU HomeworkPage — Apple Design Award Edition (macOS Sequoia & Liquid Glass)
 * ============================================================================
 *
 * Senior craft:
 *  - Apple Liquid Glass materials (.liquid-glass-surface, .liquid-glass-card)
 *  - Real-time tunable optics (--liquid-glass-opacity, --liquid-glass-blur)
 *  - macOS Split-View Detail Sidecar (`openSidecar` with deadline urgency & details)
 *  - Superhuman keyboard-first navigation (j/k, x, Enter, c to create)
 *  - Web Audio tactile haptics (playTick, playPop, playSuccess)
 *  - Shimmer skeletons with specular rim reflections
 *  - 100% logic and mutations preserved
 * ============================================================================
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { homeworkApi, groupsApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys.factory';
import {
  GlassField,
  GlassInput,
  GlassTextArea,
  GlassSelect,
  GlassModal,
  GlassErrorState,
  ConfirmDialog,
  useToasts,
} from '@/components/ui';
import { formatDate } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, Homework, Group } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useListKeyboardNavigation } from '@/hooks/useListKeyboardNavigation';
import { openSidecar, type QuickLookData } from '@/stores/ui.store';

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
  exit:   { opacity: 0, x: 20, transition: { duration: 0.22 } },
};

/* ============================================================================
 * CUSTOM ICONS
 * ========================================================================== */

const ICON_STROKE = 1.75;

const I: Record<string, string[]> = {
  homework: [
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'M14 2v6h6',
    'M16 13H8',
    'M16 17H8',
    'M10 9H8',
  ],
  book: [
    'M12 7v14',
    'M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
  ],
  calendar: [
    'M8 2v4', 'M16 2v4', 'M3 10h18',
    'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z',
  ],
  clock: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 6v6l4 2',
  ],
  target: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z',
    'M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  ],
  checkCircle: [
    'M22 11.08V12a10 10 0 1 1-5.93-9.14',
    'M22 4 12 14.01l-3-3',
  ],
  alertCircle: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 8v4', 'M12 16h.01',
  ],
  plus: ['M12 5v14', 'M5 12h14'],
  edit: [
    'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
    'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  ],
  trash: [
    'M3 6h18',
    'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
    'M10 11v6',
    'M14 11v6',
  ],
  sparkles: [
    'M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z',
    'M18.5 3.5v3', 'M20 5h-3',
    'M5.5 18v2.5', 'M6.75 19.25h-2.5',
  ],
  layers: [
    'M12 2 2 7l10 5 10-5-10-5z',
    'M2 17l10 5 10-5',
    'M2 12l10 5 10-5',
  ],
  usersRound: [
    'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M23 21v-2a4 4 0 0 0-3-3.87',
    'M16 3.13a4 4 0 0 1 0 7.75',
  ],
  empty: [
    'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z',
  ],
};

function Icon({
  paths, size = 18, className = '', strokeWidth = ICON_STROKE, ...rest
}: {
  paths: string[]; size?: number; className?: string; strokeWidth?: number;
} & React.SVGProps<SVGSVGElement>) {
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
 * TONE SYSTEM
 * ========================================================================== */

type Tone = 'cyan' | 'blue' | 'indigo' | 'purple' | 'emerald' | 'amber' | 'rose' | 'gray';

interface ToneStyle {
  fg: string;
  bg: string;
  glow: string;
  border: string;
}

const TONES: Record<Tone, ToneStyle> = {
  cyan:    { fg: '#007AFF', bg: 'rgba(0,122,255,0.10)',   glow: 'rgba(0,122,255,0.28)',   border: 'rgba(0,122,255,0.22)' },
  blue:    { fg: '#007AFF', bg: 'rgba(0,122,255,0.10)',   glow: 'rgba(0,122,255,0.28)',   border: 'rgba(0,122,255,0.22)' },
  indigo:  { fg: '#5856D6', bg: 'rgba(88,86,214,0.10)',   glow: 'rgba(88,86,214,0.28)',   border: 'rgba(88,86,214,0.22)' },
  purple:  { fg: '#AF52DE', bg: 'rgba(175,82,222,0.10)',  glow: 'rgba(175,82,222,0.28)',  border: 'rgba(175,82,222,0.22)' },
  emerald: { fg: '#34C759', bg: 'rgba(52,199,89,0.10)',   glow: 'rgba(52,199,89,0.28)',   border: 'rgba(52,199,89,0.22)' },
  amber:   { fg: '#FF9500', bg: 'rgba(255,149,0,0.10)',   glow: 'rgba(255,149,0,0.28)',   border: 'rgba(255,149,0,0.22)' },
  rose:    { fg: '#FF3B30', bg: 'rgba(255,59,48,0.10)',   glow: 'rgba(255,59,48,0.28)',   border: 'rgba(255,59,48,0.22)' },
  gray:    { fg: '#8E8E93', bg: 'rgba(142,142,147,0.10)', glow: 'rgba(142,142,147,0.28)', border: 'rgba(142,142,147,0.22)' },
};

function nameHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const HW_PALETTES = [
  ['#007AFF', '#5856D6'],
  ['#AF52DE', '#FF2D55'],
  ['#34C759', '#32ADE6'],
  ['#FF9500', '#FF2D55'],
  ['#5856D6', '#AF52DE'],
];

function hwGradient(name: string): string {
  const [a, b] = HW_PALETTES[nameHash(name) % HW_PALETTES.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

/* ============================================================================
 * FORM STATE
 * ========================================================================== */

interface HomeworkFormState {
  groupId: string;
  title: string;
  description: string;
  deadline: string;
  maxScore: string;
}

const INITIAL_FORM: HomeworkFormState = {
  groupId: '',
  title: '',
  description: '',
  deadline: '',
  maxScore: '',
};

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

function Shimmer({ className = '', radius = '0.75rem' }: { className?: string; radius?: string }) {
  return (
    <div
      className={`relative overflow-hidden bg-neutral-200/50 dark:bg-white/5 ${className}`}
      style={{ borderRadius: radius }}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
        }}
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

function HomeworkSkeleton() {
  return (
    <div className="space-y-5">
      <Shimmer className="h-40 w-full" radius="1.75rem" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <Shimmer key={i} className="h-[74px]" radius="1.25rem" />)}
      </div>
      <div className="space-y-2.5">
        {[1, 2, 3, 4].map((i) => <Shimmer key={i} className="h-24" radius="1.25rem" />)}
      </div>
    </div>
  );
}

/* ============================================================================
 * KPI TILE (Liquid Glass Substrate)
 * ========================================================================== */

function KpiTile({
  label, value, icon, tone = 'blue',
}: { label: string; value: number; icon: string[]; tone?: Tone }) {
  const c = TONES[tone];
  const { playTick } = usePremiumSound();

  return (
    <motion.div
      variants={rowVariants}
      whileHover={{ y: -2 }}
      onMouseEnter={playTick}
      transition={SPRING.smooth}
      className="liquid-glass-card group relative flex items-center gap-3.5 p-4"
    >
      <div
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
        style={{
          background: c.bg,
          color: c.fg,
          border: `1px solid ${c.border}`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.4), 0 4px 12px -6px ${c.glow}`,
        }}
      >
        <Icon paths={icon} size={20} strokeWidth={2} />
      </div>
      <div className="relative min-w-0 flex-1">
        <div className="text-[24px] font-bold tracking-tight leading-none text-neutral-900 dark:text-white">
          <CountUp value={value} />
        </div>
        <div className="mt-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 truncate">
          {label}
        </div>
      </div>
    </motion.div>
  );
}

/* ============================================================================
 * HOMEWORK ROW (Liquid Glass & macOS Sidecar)
 * ========================================================================== */

function HomeworkRow({
  item,
  onOpenSidecar,
  onEdit,
  onDelete,
  isFocused = false,
  isSelected = false,
  onToggleSelect,
}: {
  item: Homework;
  onOpenSidecar: (h: Homework) => void;
  onEdit: (h: Homework) => void;
  onDelete: (id: string) => void;
  isFocused?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}) {
  const { t } = useI18n();
  const { playTick, playPop } = usePremiumSound();

  const isPast = isDeadlinePast(item.deadline);
  const isSoon = isDeadlineSoon(item.deadline);
  const statusTone: Tone = isPast ? 'rose' : isSoon ? 'amber' : 'emerald';
  const c = TONES[statusTone];
  const statusLabel = isPast
    ? t('homework.status.pastDue')
    : isSoon
    ? t('homework.status.dueSoon')
    : t('homework.status.open');

  return (
    <motion.div
      layout
      variants={rowVariants}
      whileHover={{ y: -2 }}
      transition={SPRING.snappy}
      onClick={() => {
        playPop();
        onOpenSidecar(item);
      }}
      className={`liquid-glass-card group relative flex flex-col gap-3.5 p-4 cursor-pointer sm:flex-row sm:items-center ${
        isSelected
          ? 'ring-2 ring-blue-500 bg-blue-500/10'
          : isFocused
          ? 'ring-2 ring-blue-500/60'
          : ''
      }`}
    >
      {/* Left accent bar */}
      <span
        aria-hidden
        className="absolute left-0 top-3.5 bottom-3.5 w-[3.5px] rounded-r-full"
        style={{ background: c.fg, boxShadow: `0 0 10px ${c.glow}` }}
      />

      {/* Row Selection checkbox */}
      {onToggleSelect && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            playTick();
            onToggleSelect();
          }}
          className="flex items-center pl-1 shrink-0"
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => {}}
            className="h-4 w-4 rounded-md accent-blue-600 cursor-pointer"
            aria-label={`Select ${item.title}`}
          />
        </div>
      )}

      {/* Icon tile */}
      <div
        className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
        style={{
          background: hwGradient(item.title),
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), 0 6px 16px -6px rgba(0,0,0,0.25)',
        }}
      >
        <Icon paths={I.homework} size={22} strokeWidth={2} className="relative z-10" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 pl-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-[15px] font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            {item.title}
          </h3>

          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{
              background: c.bg,
              color: c.fg,
              border: `1px solid ${c.border}`,
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: c.fg, boxShadow: `0 0 6px ${c.glow}` }}
            />
            {statusLabel}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
          {item.group?.name && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold"
              style={{
                background: TONES.purple.bg,
                color: TONES.purple.fg,
                border: `1px solid ${TONES.purple.border}`,
              }}
            >
              <Icon paths={I.usersRound} size={10} strokeWidth={2.4} />
              {item.group.name}
            </span>
          )}

          {item.deadline && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums"
              style={{
                background: c.bg,
                color: c.fg,
                border: `1px solid ${c.border}`,
              }}
            >
              <Icon paths={I.clock} size={10} strokeWidth={2.4} />
              {formatDeadline(item.deadline)}
            </span>
          )}

          {item.maxScore != null && (
            <span className="inline-flex items-center gap-1.5 tabular-nums text-neutral-600 dark:text-neutral-300">
              <Icon paths={I.target} size={12} strokeWidth={2.2} className="opacity-60" />
              {t('homework.form.maxScore')}: <span className="font-bold">{formatMaxScore(item.maxScore)}</span>
            </span>
          )}
        </div>
      </div>

      {/* Action buttons + Split-View Sidecar Trigger */}
      <div className="flex shrink-0 items-center justify-end w-full sm:w-auto gap-1.5 pt-2 sm:pt-0 border-t border-black/[0.04] dark:border-white/[0.04] sm:border-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            playPop();
            onOpenSidecar(item);
          }}
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-black/5 bg-white/70 text-xs font-bold text-neutral-600 transition-all hover:border-black/20 hover:bg-white hover:text-black hover:shadow-xs active:scale-95 dark:border-white/10 dark:bg-white/5 dark:text-neutral-400 dark:hover:border-white/20 dark:hover:bg-white/10 dark:hover:text-white"
          title="macOS Split-View Sidecar (Enter / e)"
          aria-label="Split-View Sidecar"
        >
          ◨
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            playTick();
            onEdit(item);
          }}
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-black/5 bg-white/70 text-blue-600 transition-all hover:border-blue-500/30 hover:bg-blue-50 hover:shadow-xs active:scale-95 dark:border-white/10 dark:bg-white/5 dark:text-blue-400 dark:hover:bg-blue-500/15"
          title={t('common.edit')}
          aria-label={t('common.edit')}
        >
          <Icon paths={I.edit} size={13} strokeWidth={2} />
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            playTick();
            onDelete(item.id);
          }}
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-black/5 bg-white/70 text-red-600 transition-all hover:border-red-500/30 hover:bg-red-50 hover:shadow-xs active:scale-95 dark:border-white/10 dark:bg-white/5 dark:text-red-400 dark:hover:bg-red-500/15"
          title={t('common.delete')}
          aria-label={t('common.delete')}
        >
          <Icon paths={I.trash} size={13} strokeWidth={2} />
        </button>
      </div>
    </motion.div>
  );
}

/* ============================================================================
 * MAIN PAGE
 * ========================================================================== */

export function HomeworkPage() {
  const { t } = useI18n();
  usePageTitle(t('homework.title'));
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();
  const { playPop, playTick, playSuccess } = usePremiumSound();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const [form, setForm] = useState<HomeworkFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof HomeworkFormState, string>>
  >({});

  /* ── Queries ──────────────────────────────────────────────────────── */
  const homework = useQuery({
    queryKey: ['homework'],
    queryFn: () => homeworkApi.list({ limit: 100 }),
    placeholderData: (previousData) => previousData,
  });

  const groups = useQuery({
    queryKey: queryKeys.groups.homework(),
    queryFn: () => groupsApi.list({ limit: 100 }),
    placeholderData: (previousData) => previousData,
    staleTime: 5 * 60 * 1000,
  });

  const data = homework.data as Paginated<Homework> | undefined;
  const homeworkList = useMemo(() => data?.items || [], [data]);
  const groupList = useMemo(
    () => (groups.data as Paginated<Group> | undefined)?.items || [],
    [groups.data],
  );

  /* ── Derived stats ────────────────────────────────────────────────── */
  const stats = useMemo(() => {
    const total = homeworkList.length;
    const open = homeworkList.filter((h) => !isDeadlinePast(h.deadline)).length;
    const dueSoon = homeworkList.filter(
      (h) => isDeadlineSoon(h.deadline) && !isDeadlinePast(h.deadline),
    ).length;
    const pastDue = homeworkList.filter((h) => isDeadlinePast(h.deadline)).length;
    return { total, open, dueSoon, pastDue };
  }, [homeworkList]);

  /* ── macOS Split-View Detail Sidecar ──────────────────────────────── */
  const handleOpenHomeworkSidecar = useCallback((item: Homework) => {
    const isPast = isDeadlinePast(item.deadline);
    const isSoon = isDeadlineSoon(item.deadline);
    const data: QuickLookData = {
      id: item.id,
      type: 'general',
      title: item.title,
      subtitle: item.group?.name ? `Guruh: ${item.group.name}` : 'Umumiy vazifa',
      badge: {
        text: isPast ? 'Muddati o\'tgan' : isSoon ? 'Yaqinlashmoqda' : 'Faol',
        tone: isPast ? 'rose' : isSoon ? 'amber' : 'emerald',
      },
      avatar: {
        text: '📚',
        color: '#007AFF',
      },
      metrics: [
        { label: 'Maks. ball', value: item.maxScore != null ? `${item.maxScore} ball` : 'Belgilanmagan' },
        { label: 'Guruh', value: item.group?.name || '—' },
        { label: 'Topshirish muddati', value: item.deadline ? formatDate(item.deadline) : 'Muddatsiz' },
        { label: 'Tavsif', value: item.description ? 'Kiritilgan' : 'Yo\'q' },
      ],
      details: [
        { label: 'Vazifa ID', value: item.id, copyable: true },
        { label: 'Sarlavha', value: item.title },
        { label: 'Batafsil izoh', value: item.description || 'Qo\'shimcha izoh kiritilmagan' },
        { label: 'Yaratilgan sana', value: formatDate((item as any).createdAt || new Date().toISOString()) },
      ],
      primaryAction: {
        label: 'Vazifani tahrirlash',
        onExecute: () => {
          setEditingId(item.id);
          setForm({
            groupId: item.groupId,
            title: item.title,
            description: item.description || '',
            deadline: item.deadline ? item.deadline.slice(0, 16) : '',
            maxScore: item.maxScore != null ? String(item.maxScore) : '',
          });
          setFormErrors({});
          setModalOpen(true);
        },
      },
    };
    openSidecar(data);
  }, []);

  /* ── Keyboard Navigation ──────────────────────────────────────────── */
  const {
    focusedIndex,
    isSelected,
    toggleSelection,
  } = useListKeyboardNavigation<Homework>({
    items: homeworkList,
    getItemId: (h) => h.id,
    rowIdPrefix: 'homework-row-',
    onSelect: (h) => handleOpenHomeworkSidecar(h),
    onQuickLook: (h) => handleOpenHomeworkSidecar(h),
    onEdit: (h) => {
      setEditingId(h.id);
      setForm({
        groupId: h.groupId,
        title: h.title,
        description: h.description || '',
        deadline: h.deadline ? h.deadline.slice(0, 16) : '',
        maxScore: h.maxScore != null ? String(h.maxScore) : '',
      });
      setFormErrors({});
      setModalOpen(true);
    },
  });

  /* ── Keyboard shortcut for 'c' ────────────────────────────────────── */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'c' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        playPop();
        setEditingId(null);
        setForm(INITIAL_FORM);
        setFormErrors({});
        setModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playPop]);

  /* ── Mutations ────────────────────────────────────────────────────── */
  const save = useMutation({
    mutationFn: () => {
      const payload = {
        groupId: form.groupId,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        deadline: form.deadline ? new Date(form.deadline).toISOString() : undefined,
        maxScore: form.maxScore ? parseFloat(form.maxScore) : undefined,
      };
      return editingId ? homeworkApi.update(editingId, payload) : homeworkApi.create(payload);
    },
    onSuccess: () => {
      push('success', editingId ? t('homework.updateSuccess') : t('homework.createSuccess'));
      setModalOpen(false);
      setEditingId(null);
      setForm(INITIAL_FORM);
      setFormErrors({});
      qc.invalidateQueries({ queryKey: queryKeys.homework.all() });
      playSuccess();
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => homeworkApi.remove(id),
    onSuccess: () => {
      push('success', t('homework.deleteSuccess'));
      qc.invalidateQueries({ queryKey: queryKeys.homework.all() });
      playSuccess();
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  /* ── Validators ───────────────────────────────────────────────────── */
  const validateForm = useCallback((): boolean => {
    const errors: Partial<Record<keyof HomeworkFormState, string>> = {};
    if (!form.title.trim()) errors.title = t('homework.titleRequired');
    if (!form.groupId) errors.groupId = t('common.validation.selectGroup');
    if (form.maxScore && parseFloat(form.maxScore) < 0) {
      errors.maxScore = t('homework.maxScorePositive');
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form, t]);

  /* ── Handlers ─────────────────────────────────────────────────────── */
  const handleFormChange = useCallback(
    (field: keyof HomeworkFormState) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
        setFormErrors((prev) => ({ ...prev, [field]: undefined }));
      },
    [],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!validateForm()) return;
      save.mutate();
    },
    [validateForm, save],
  );

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setEditingId(null);
    setForm(INITIAL_FORM);
    setFormErrors({});
    playPop();
  }, [playPop]);

  const handleOpenModal = useCallback(() => {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setFormErrors({});
    setModalOpen(true);
    playPop();
  }, [playPop]);

  const handleEdit = useCallback((item: Homework) => {
    setEditingId(item.id);
    setForm({
      groupId: item.groupId,
      title: item.title,
      description: item.description || '',
      deadline: item.deadline ? item.deadline.slice(0, 16) : '',
      maxScore: item.maxScore != null ? String(item.maxScore) : '',
    });
    setFormErrors({});
    setModalOpen(true);
    playPop();
  }, [playPop]);

  const handleDelete = useCallback((id: string) => {
    playTick();
    setDeleteTarget(id);
  }, [playTick]);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    remove.mutate(deleteTarget);
    setDeleteTarget(null);
  }, [deleteTarget, remove]);

  const { refetch: refetchHomework } = homework;
  const handleRetry = useCallback(() => {
    playTick();
    void refetchHomework();
  }, [playTick, refetchHomework]);

  /* ── Loading ──────────────────────────────────────────────────────── */
  if (homework.isLoading && !data) {
    return (
      <div className="page-container space-y-5">
        <HomeworkSkeleton />
      </div>
    );
  }

  /* ── Error ────────────────────────────────────────────────────────── */
  if (homework.isError) {
    return (
      <div className="page-container space-y-5">
        <div className="liquid-glass-card p-8">
          <GlassErrorState
            title={t('homework.loadFailed')}
            message={getErrorMessage(homework.error as Error)}
            onRetry={handleRetry}
          />
        </div>
      </div>
    );
  }

  /* ── Render ───────────────────────────────────────────────────────── */
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="page-container space-y-5"
    >
      {toastNode}

      {/* HERO (Apple Liquid Glass Header) */}
      <motion.div variants={cardVariants}>
        <div className="liquid-glass-surface rounded-3xl p-6 sm:p-8">
          <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            {/* Hero icon */}
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-md sm:h-20 sm:w-20">
              <Icon paths={I.homework} size={32} strokeWidth={2} className="relative z-10" />
            </div>

            {/* Text */}
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1 text-[11px] font-bold tracking-tight text-blue-500">
                  <Icon paths={I.sparkles} size={11} strokeWidth={2.5} />
                  {t('homework.title')}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-black/5 bg-neutral-100/70 px-2.5 py-1 text-[11px] font-semibold text-neutral-600 dark:border-white/10 dark:bg-white/5 dark:text-neutral-400">
                  <Icon paths={I.layers} size={11} strokeWidth={2.5} />
                  {stats.total} jami
                </span>
                {stats.dueSoon > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shadow-[0_0_6px_#F59E0B]" />
                    {stats.dueSoon} yaqinlashmoqda
                  </span>
                )}
                {stats.pastDue > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 text-[11px] font-bold text-red-500">
                    {stats.pastDue} muddati o'tgan
                  </span>
                )}
              </div>

              <h1 className="mt-2.5 text-3xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-4xl">
                {t('homework.title')}
              </h1>
              <p className="mt-1 text-sm font-medium text-neutral-500 dark:text-neutral-400">
                {t('homework.pageSubtitle')}
              </p>
            </div>

            {/* Actions */}
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <button
                type="button"
                onClick={handleOpenModal}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-xs font-bold text-white shadow-md transition-all hover:opacity-95 active:scale-95"
              >
                <Icon paths={I.plus} size={15} strokeWidth={2.5} />
                {t('homework.addButton')}
                <kbd className="hidden sm:inline rounded-md bg-white/20 px-1.5 py-0.5 text-[10px] font-mono">
                  C
                </kbd>
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* KPI BAR (Liquid Glass Cards) */}
      {homeworkList.length > 0 && (
        <motion.div
          variants={containerVariants}
          className="grid grid-cols-2 gap-3.5 sm:grid-cols-4"
        >
          <KpiTile label={t('homework.title')} value={stats.total} icon={I.homework} tone="cyan" />
          <KpiTile label={t('homework.status.open')} value={stats.open} icon={I.checkCircle} tone="emerald" />
          <KpiTile label={t('homework.status.dueSoon')} value={stats.dueSoon} icon={I.clock} tone="amber" />
          <KpiTile label={t('homework.status.pastDue')} value={stats.pastDue} icon={I.alertCircle} tone="rose" />
        </motion.div>
      )}

      {/* KEYBOARD SHORTCUTS HINTS */}
      <div className="hidden sm:flex items-center justify-end gap-2 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
        <span className="rounded-md border border-black/10 bg-black/5 px-1.5 py-0.5 font-mono text-[10px] dark:border-white/10 dark:bg-white/5">
          J / K
        </span>
        <span>Harakat</span>
        <span className="rounded-md border border-black/10 bg-black/5 px-1.5 py-0.5 font-mono text-[10px] dark:border-white/10 dark:bg-white/5">
          ↵ / E
        </span>
        <span>Sidecar</span>
        <span className="rounded-md border border-black/10 bg-black/5 px-1.5 py-0.5 font-mono text-[10px] dark:border-white/10 dark:bg-white/5">
          X
        </span>
        <span>Tanlash</span>
      </div>

      {/* HOMEWORK LIST */}
      <motion.div variants={cardVariants}>
        <div className="liquid-glass-card p-4 sm:p-5">
          <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-black/5 dark:border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
                <Icon paths={I.homework} size={16} strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-sm font-bold tracking-tight text-neutral-900 dark:text-white">
                  {t('homework.title')} ro'yxati
                </h2>
                <p className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                  {homeworkList.length} ta vazifa mavjud
                </p>
              </div>
            </div>
          </div>

          <div>
            {homeworkList.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-500">
                  <Icon paths={I.empty} size={26} strokeWidth={1.8} />
                </div>
                <p className="text-sm font-bold text-neutral-900 dark:text-white">
                  {t('homework.empty')}
                </p>
                <p className="max-w-sm text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  {t('homework.emptyMessage')}
                </p>
                <button
                  type="button"
                  onClick={handleOpenModal}
                  className="mt-2 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-blue-700 active:scale-95"
                >
                  <Icon paths={I.plus} size={14} strokeWidth={2.5} />
                  {t('homework.addButton')}
                </button>
              </div>
            ) : (
              <motion.div layout className="space-y-3">
                <AnimatePresence initial={false} mode="popLayout">
                  {homeworkList.map((item, idx) => (
                    <HomeworkRow
                      key={item.id}
                      item={item}
                      onOpenSidecar={handleOpenHomeworkSidecar}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      isFocused={focusedIndex === idx}
                      isSelected={isSelected(item.id)}
                      onToggleSelect={() => toggleSelection(item.id)}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>

      {/* CREATE / EDIT MODAL */}
      <GlassModal
        open={modalOpen}
        onClose={handleCloseModal}
        title={editingId ? t('homework.editModalTitle') : t('homework.modalTitle')}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <GlassField label={t('homework.form.group')} error={formErrors.groupId} required>
            <GlassSelect
              value={form.groupId}
              onChange={handleFormChange('groupId')}
              aria-invalid={Boolean(formErrors.groupId)}
            >
              <option value="">{t('common.choose')}</option>
              {groupList.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </GlassSelect>
          </GlassField>

          <GlassField label={t('homework.form.title')} error={formErrors.title} required>
            <GlassInput
              value={form.title}
              onChange={handleFormChange('title')}
              placeholder={t('homework.form.titlePlaceholder')}
              aria-invalid={Boolean(formErrors.title)}
            />
          </GlassField>

          <GlassField label={t('homework.form.description')} error={formErrors.description}>
            <GlassTextArea
              value={form.description}
              onChange={handleFormChange('description')}
              placeholder={t('homework.form.descPlaceholder')}
              rows={3}
            />
          </GlassField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <GlassField label={t('homework.form.deadline')} error={formErrors.deadline}>
              <GlassInput
                type="datetime-local"
                value={form.deadline}
                onChange={handleFormChange('deadline')}
              />
            </GlassField>

            <GlassField label={t('homework.form.maxScore')} error={formErrors.maxScore}>
              <GlassInput
                type="number"
                min="0"
                step="1"
                value={form.maxScore}
                onChange={handleFormChange('maxScore')}
                placeholder="100"
              />
            </GlassField>
          </div>

          <div className="flex justify-end gap-2.5 pt-3">
            <button
              type="button"
              onClick={handleCloseModal}
              disabled={save.isPending}
              className="rounded-xl border border-black/5 bg-neutral-100 px-4 py-2 text-xs font-bold text-neutral-700 transition-colors hover:bg-neutral-200 dark:border-white/10 dark:bg-white/5 dark:text-neutral-300 dark:hover:bg-white/10"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={save.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-70"
            >
              {save.isPending ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </GlassModal>

      {/* CONFIRM DELETE DIALOG */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={t('homework.deleteConfirmTitle')}
        description={t('homework.deleteConfirmMessage')}
        confirmLabel={t('common.delete')}
        tone="danger"
        loading={remove.isPending}
      />
    </motion.div>
  );
}

export default HomeworkPage;