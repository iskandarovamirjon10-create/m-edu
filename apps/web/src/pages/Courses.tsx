/**
 * M-EDU CoursesPage — Apple Modern Interface Specular Edition
 *
 * Module Features:
 *  - Unified Hero atelier with specular meniscus highlights & inline KPI stats
 *  - Stat ribbon (Total, Active, Avg Tuition, Levels) with CountUp ease-out
 *  - Dual View Atelier: Apple Gallery Mode (Cards) <-> High-Density Specular Table Mode
 *  - Segmented level & status filters with smooth horizontal mobile scrolling
 *  - WCAG 2.2 AA compliant touch targets (all buttons, actions, checkboxes >= 44x44px)
 *  - Trilingual resilience with useSafeI18n (UZ, RU, EN)
 *  - macOS Split-View QuickLook Sidecar integration
 *  - Bulk Action Island for batch toggling & CSV export
 *  - Zero-leak React Query caching & optimistic-ready mutations
 */

import { useState, useCallback, useMemo, useEffect, useRef, forwardRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  GlassCard,
  GlassErrorState,
  GlassEmptyState,
  GlassModal,
  GlassField,
  GlassInput,
  GlassTextArea,
  GlassButton,
  useToasts,
  ConfirmDialog,
  FloatingActionIsland,
} from '@/components/ui';
import { AuroraMesh } from '@/components/ui/AuroraMesh';
import { useListKeyboardNavigation } from '@/hooks/useListKeyboardNavigation';
import { openSidecar, type QuickLookData } from '@/stores/ui.store';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { coursesApi } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, Course, CourseLevel } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { queryKeys } from '@/lib/query-keys.factory';
import {
  CourseSyllabusDrawer,
  CourseAiSyllabusModal,
  BulkCourseActionsModals,
} from '@/components/courses';

/* ============================================================================
 * MOTION TOKENS (Spring Physics)
 * ========================================================================== */

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  soft:   { type: 'spring', stiffness: 220, damping: 28, mass: 1.0 },
} as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: SPRING.smooth },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, x: -6 },
  visible: { opacity: 1, x: 0, transition: SPRING.smooth },
};

/* ============================================================================
 * TYPES & CONSTANTS
 * ========================================================================== */

const COURSE_LEVELS: CourseLevel[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];

type LevelFilter = 'ALL' | 'ACTIVE' | CourseLevel;
type ViewMode = 'gallery' | 'table';

interface CourseFormState {
  name: string;
  description: string;
  price: string;
  duration: string;
  level: CourseLevel | '';
}

const INITIAL_FORM: CourseFormState = {
  name: '',
  description: '',
  price: '',
  duration: '',
  level: '',
};

/* ============================================================================
 * ICONS (SVG Icons)
 * ========================================================================== */

const ICON_STROKE = 1.85;

const I = {
  book: [
    'M12 7v14',
    'M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
  ],
  bookOpen: [
    'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z',
    'M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z',
  ],
  layers: [
    'M12 2 2 7l10 5 10-5-10-5z',
    'M2 17l10 5 10-5',
    'M2 12l10 5 10-5',
  ],
  plus: ['M12 5v14', 'M5 12h14'],
  edit: [
    'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
    'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  ],
  trash: [
    'M3 6h18',
    'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6',
    'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
    'M10 11v6', 'M14 11v6',
  ],
  search: [
    'M21 21l-4.35-4.35',
    'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
  ],
  clock: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 6v6l4 2',
  ],
  creditCard: [
    'M21 6H3a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z',
    'M1 10h22',
    'M6 15h2',
  ],
  sparkles: [
    'M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z',
    'M18.5 3.5v3', 'M20 5h-3',
    'M5.5 18v2.5', 'M6.75 19.25h-2.5',
  ],
  award: [
    'M12 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
    'M8.2 13.9 7 22l5-3 5 3-1.2-8.1',
  ],
  checkCircle: [
    'M22 11.08V12a10 10 0 1 1-5.93-9.14',
    'M22 4 12 14.01l-3-3',
  ],
  check: ['M20 6 9 17l-5-5'],
  x: ['M18 6 6 18', 'M6 6l12 12'],
  zap: ['M13 2 3 14h9l-1 8 10-12h-9l1-8z'],
  trendingUp: [
    'M22 7 13.5 15.5 8.5 10.5 2 17',
    'M16 7h6v6',
  ],
  graduationCap: [
    'M22 10 12 5 2 10l10 5 10-5z',
    'M6 12v5c3 3 9 3 12 0v-5',
  ],
  grid: [
    'M3 3h7v7H3z',
    'M14 3h7v7h-7z',
    'M14 14h7v7h-7z',
    'M3 14h7v7H3z',
  ],
  list: [
    'M8 6h13',
    'M8 12h13',
    'M8 18h13',
    'M3 6h.01',
    'M3 12h.01',
    'M3 18h.01',
  ],
};

function Icon({
  paths, size = 18, className = '', strokeWidth = ICON_STROKE, ...rest
}: {
  paths: string[]; size?: number; className?: string; strokeWidth?: number;
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
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

/* ============================================================================
 * TONE PALETTES
 * ========================================================================== */

type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'slate';

const TONE: Record<Tone, { fg: string; bg: string; glow: string }> = {
  blue:   { fg: '#007AFF', bg: 'rgba(0,122,255,0.10)',  glow: 'rgba(0,122,255,0.28)' },
  green:  { fg: '#34C759', bg: 'rgba(52,199,89,0.10)',   glow: 'rgba(52,199,89,0.28)' },
  orange: { fg: '#FF9500', bg: 'rgba(255,149,0,0.10)',  glow: 'rgba(255,149,0,0.28)' },
  red:    { fg: '#FF3B30', bg: 'rgba(255,59,48,0.10)',   glow: 'rgba(255,59,48,0.28)' },
  purple: { fg: '#AF52DE', bg: 'rgba(175,82,222,0.10)', glow: 'rgba(175,82,222,0.28)' },
  slate:  { fg: '#8E8E93', bg: 'rgba(142,142,147,0.10)', glow: 'rgba(142,142,147,0.28)' },
};

const LEVEL_TONE: Record<CourseLevel, Tone> = {
  BEGINNER:     'green',
  INTERMEDIATE: 'blue',
  ADVANCED:     'orange',
  EXPERT:       'purple',
};

/* ============================================================================
 * EXPORTED PURE HELPERS (Tested by pageFormatters.test.ts)
 * ========================================================================== */

export function formatCourseLevel(level: string | null | undefined): string {
  if (!level) return '—';
  return level
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function formatDuration(months: number): string {
  return `${months} ${months === 1 ? 'month' : 'months'}`;
}

export function getCourseStatusBadge(isActive: boolean): { variant: 'success' | 'muted'; label: string } {
  return isActive
    ? { variant: 'success', label: 'Active' }
    : { variant: 'muted', label: 'Inactive' };
}

function getInitials(name?: string): string {
  return ((name || '')
    .split(/\s+/)
    .map((p) => p.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || '—');
}

function nameHash(str?: string): number {
  const s = str || '';
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const COURSE_PALETTES = [
  ['#007AFF', '#5856D6'],
  ['#5856D6', '#AF52DE'],
  ['#34C759', '#007AFF'],
  ['#FF9500', '#FF3B30'],
  ['#AF52DE', '#FF2D55'],
  ['#32ADE6', '#007AFF'],
  ['#FF2D55', '#FF9500'],
  ['#30D158', '#34C759'],
];

function courseGradient(name?: string): string {
  const palette =
    COURSE_PALETTES[Math.abs(nameHash(name || '')) % COURSE_PALETTES.length] ||
    COURSE_PALETTES[0];
  const [a, b] = palette;
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

/* ============================================================================
 * COUNT-UP & SHIMMER SKELETON
 * ========================================================================== */

function CountUp({
  value, duration = 0.9, suffix = '', prefix = '', decimals = 0,
}: {
  value: number; duration?: number; suffix?: string; prefix?: string; decimals?: number;
}) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const [n, setN] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    let raf: number;
    startRef.current = null;
    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const p = Math.min(1, (ts - startRef.current) / (duration * 1000));
      const eased = 1 - Math.pow(1 - p, 4);
      setN(safeValue * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [safeValue, duration]);

  const valToUse = Number.isFinite(n) ? n : 0;
  const shown = decimals > 0 ? valToUse.toFixed(decimals) : Math.round(valToUse).toLocaleString();
  return <span className="tabular-nums">{prefix}{shown}{suffix}</span>;
}

function Shimmer({ className = '', radius = '1rem' }: { className?: string; radius?: string }) {
  return (
    <div
      className={`relative overflow-hidden bg-black/[0.04] dark:bg-white/[0.04] ${className}`}
      style={{ borderRadius: radius }}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.45) 50%, transparent 100%)',
        }}
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

function CoursesSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <Shimmer className="h-44 w-full" radius="1.75rem" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <Shimmer key={i} className="h-20" radius="1.25rem" />)}
      </div>
      <Shimmer className="h-14 w-full" radius="1.25rem" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => <Shimmer key={i} className="h-48" radius="1.5rem" />)}
      </div>
    </div>
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
      whileHover={{ y: -2 }}
      transition={SPRING.smooth}
      className="group relative flex items-center gap-3.5 overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 px-4 py-3.5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-sm hover:shadow-md transition-all"
    >
      <div
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
        style={{
          background: c.bg,
          color: c.fg,
          border: `1px solid ${c.fg}28`,
        }}
      >
        <Icon paths={icon} size={20} strokeWidth={2.2} className="relative" />
      </div>
      <div className="relative min-w-0 flex-1">
        <div className="text-[20px] font-bold tracking-tight text-[var(--text-primary)] font-display">
          {typeof value === 'number' ? <CountUp value={value} /> : value}
        </div>
        <div className="mt-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)] truncate">
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
  value: LevelFilter;
  onChange: (v: LevelFilter) => void;
  options: { key: LevelFilter; label: string; icon: string[]; tone: Tone }[];
  counts: Record<LevelFilter, number>;
}) {
  return (
    <div className="flex items-center overflow-x-auto no-scrollbar py-0.5 max-w-full">
      <div className="inline-flex shrink-0 items-center gap-1 rounded-2xl border border-black/[0.06] bg-black/[0.04] p-1.5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.06]">
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
              className={`relative flex min-h-[44px] items-center gap-2 rounded-xl px-3.5 py-2 text-[12.5px] font-semibold outline-none transition-all ${
                active
                  ? 'bg-white text-[var(--text-primary)] shadow-sm dark:bg-surface-800'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
              style={{
                color: active ? c.fg : undefined,
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.currentTarget.click();
                }
              }}
            >
              <Icon paths={opt.icon} size={14} strokeWidth={2.2} />
              <span className="tracking-tight whitespace-nowrap">{opt.label}</span>
              {count > 0 && (
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums"
                  style={{
                    background: active ? `${c.fg}22` : 'rgba(142,142,147,0.18)',
                    color: active ? c.fg : 'inherit',
                  }}
                >
                  {count}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================================
 * COURSE CARD (Gallery Mode)
 * ========================================================================== */

const CourseCard = forwardRef<HTMLDivElement, {
  course: Course;
  onEdit: (c: Course) => void;
  onDelete: (id: string) => void;
  isSelected?: boolean;
  isFocused?: boolean;
  onToggleSelect?: () => void;
  onOpenSidecar?: () => void;
  onOpenSyllabus?: () => void;
  onOpenAiArchitect?: () => void;
}>(function CourseCard({
  course, onEdit, onDelete, isSelected, isFocused, onToggleSelect, onOpenSidecar, onOpenSyllabus, onOpenAiArchitect,
}, ref) {
  const { t } = useSafeI18n();
  const level = course.level as CourseLevel | null | undefined;
  const normalizedLevel = (level || '').toUpperCase() as CourseLevel;
  const tone: Tone = LEVEL_TONE[normalizedLevel] || 'slate';
  const c = TONE[tone] || TONE.slate;

  return (
    <motion.div
      ref={ref}
      id={`course-row-${course.id}`}
      layout
      variants={cardVariants}
      whileHover={{ y: -3 }}
      transition={SPRING.snappy}
      onClick={onOpenSidecar}
      className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-4.5 transition-all cursor-pointer backdrop-blur-xl ${
        isSelected
          ? 'border-[#007AFF] bg-brand-500/[0.08] ring-1 ring-[#007AFF]/40 shadow-md'
          : isFocused
          ? 'border-[#007AFF]/70 bg-brand-500/[0.05] ring-1 ring-[#007AFF]/30'
          : 'border-black/[0.06] bg-white/80 dark:border-white/[0.08] dark:bg-surface-900/80 hover:border-black/[0.14] dark:hover:border-white/[0.16] shadow-sm hover:shadow-card'
      }`}
    >
      {/* Top row: Checkbox, Squircle Icon, and Level & Status */}
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Selection Checkbox with 44x44px touch area */}
            {onToggleSelect && (
              <div
                className="flex h-11 w-11 -ml-2 -mt-2 shrink-0 items-center justify-center cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelect();
                }}
              >
                <div
                  className={`flex h-5 w-5 items-center justify-center rounded-md border transition-all ${
                    isSelected
                      ? 'border-[#007AFF] bg-[#007AFF] text-white shadow-sm'
                      : 'border-black/25 dark:border-white/25 bg-white/70 dark:bg-surface-800/70 hover:border-black/50 dark:hover:border-white/50'
                  }`}
                  aria-label={`${course.name} kursini tanlash (Select ${course.name})`}
                >
                  {isSelected && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </div>
              </div>
            )}

            {/* Squircle Avatar */}
            <div
              className="relative flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl font-bold text-white shadow-[0_6px_16px_rgba(0,0,0,0.12)] ring-1 ring-white/20"
              style={{ background: courseGradient(course.name) }}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-2xl"
                style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.4), transparent 55%)' }}
              />
              <span className="relative text-[14px] font-bold tracking-tight font-display">
                {getInitials(course.name)}
              </span>
            </div>
          </div>

          {/* Status Badge */}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold tabular-nums border ${
              course.isActive
                ? 'bg-[#34C759]/12 text-[#28A745] dark:text-[#34C759] border-[#34C759]/25'
                : 'bg-black/[0.04] dark:bg-white/[0.06] text-[var(--text-tertiary)] border-black/[0.05] dark:border-white/[0.06]'
            }`}
          >
            {course.isActive && <span className="h-1.5 w-1.5 rounded-full bg-[#34C759] animate-pulse" />}
            {course.isActive ? t('common.active') : t('common.inactive')}
          </span>
        </div>

        {/* Course Title and Description */}
        <div className="mt-3.5">
          <h3 className="text-[15px] font-bold tracking-tight text-[var(--text-primary)] group-hover:text-[#007AFF] transition-colors line-clamp-1">
            {course.name}
          </h3>
          <p className="mt-1 line-clamp-2 text-[12.5px] font-normal leading-relaxed text-[var(--text-secondary)] min-h-[36px]">
            {course.description || t('courses.sidecar.noDescription')}
          </p>
        </div>

        {/* Metadata Chips: Level, Duration, Monthly Price */}
        <div className="mt-3.5 flex flex-wrap items-center gap-2 text-[11.5px] font-medium text-[var(--text-tertiary)]">
          {course.level && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              style={{
                background: c.bg,
                color: c.fg,
                border: `1px solid ${c.fg}33`,
              }}
            >
              <Icon paths={I.award} size={10} strokeWidth={2.5} />
              {t(`courses.level.${course.level}`, formatCourseLevel(course.level as CourseLevel))}
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.03] dark:bg-white/[0.05] px-2.5 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
            <Icon paths={I.clock} size={11} strokeWidth={2} className="opacity-70" />
            {course.duration} {course.duration === 1 ? t('courses.unit.month') : t('courses.unit.months')}
          </span>
        </div>
      </div>

      {/* Bottom Footer: Price & Accessible Action Buttons */}
      <div
        className="mt-4 flex items-center justify-between border-t border-black/[0.05] dark:border-white/[0.05] pt-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-tertiary)]">
            {t('courses.form.priceLabel')}
          </span>
          <span className="text-[14.5px] font-bold tabular-nums text-[#34C759] dark:text-[#30D158]">
            {formatCurrency(course.price)}
          </span>
        </div>

        {/* Actions with WCAG >= 44x44px Hitboxes */}
        <div className="flex items-center gap-1">
          <motion.button
            type="button"
            onClick={() => onOpenSyllabus?.()}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={SPRING.snappy}
            aria-label="Kurs rejasi va guruhlar (Curriculum & groups)"
            title="Kurs rejasi va guruhlar"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.03] dark:bg-white/[0.06] text-[var(--text-secondary)] hover:text-[#007AFF] hover:border-brand-500/40 transition-colors text-xs font-bold"
          >
            <Icon paths={I.bookOpen} size={15} strokeWidth={2} />
          </motion.button>
          <motion.button
            type="button"
            onClick={() => onOpenAiArchitect?.()}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={SPRING.snappy}
            aria-label="AI kurs meʼmori (AI Course Architect)"
            title="AI kurs meʼmori"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.03] dark:bg-white/[0.06] text-brand-600 dark:text-brand-400 hover:text-brand-500 hover:border-brand-500/40 transition-colors"
          >
            <Icon paths={I.sparkles} size={15} strokeWidth={2} />
          </motion.button>
          <motion.button
            type="button"
            onClick={() => onOpenSidecar?.()}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={SPRING.snappy}
            aria-label={t('courses.sidecar.dossier')}
            title={t('courses.sidecar.toggleAria')}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.03] dark:bg-white/[0.06] text-[var(--text-secondary)] hover:text-[#007AFF] hover:border-brand-500/40 transition-colors text-xs font-bold"
          >
            <span>◨</span>
          </motion.button>

          <motion.button
            type="button"
            onClick={() => onEdit(course)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={SPRING.snappy}
            aria-label={t('common.edit')}
            title={t('courses.editCourse')}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.03] dark:bg-white/[0.06] text-[var(--text-secondary)] hover:text-[#007AFF] hover:border-[#007AFF]/30 transition-colors"
          >
            <Icon paths={I.edit} size={15} strokeWidth={2} />
          </motion.button>

          <motion.button
            type="button"
            onClick={() => onDelete(course.id)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={SPRING.snappy}
            aria-label={t('common.delete')}
            title={t('courses.deleteCourse')}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#FF3B30]/20 bg-[#FF3B30]/10 text-[#FF3B30] hover:bg-[#FF3B30]/20 transition-colors"
          >
            <Icon paths={I.trash} size={15} strokeWidth={2} />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
});

/* ============================================================================
 * COURSE TABLE ROW (Table Mode)
 * ========================================================================== */

const CourseTableRow = forwardRef<HTMLDivElement, {
  course: Course;
  onEdit: (c: Course) => void;
  onDelete: (id: string) => void;
  isSelected?: boolean;
  isFocused?: boolean;
  onToggleSelect?: () => void;
  onOpenSidecar?: () => void;
  onOpenSyllabus?: () => void;
  onOpenAiArchitect?: () => void;
}>(function CourseTableRow({
  course, onEdit, onDelete, isSelected, isFocused, onToggleSelect, onOpenSidecar, onOpenSyllabus, onOpenAiArchitect,
}, ref) {
  const { t } = useSafeI18n();
  const level = course.level as CourseLevel | null | undefined;
  const normalizedLevel = (level || '').toUpperCase() as CourseLevel;
  const tone: Tone = LEVEL_TONE[normalizedLevel] || 'slate';
  const c = TONE[tone] || TONE.slate;

  return (
    <motion.div
      ref={ref}
      id={`course-row-${course.id}`}
      layout
      variants={rowVariants}
      whileHover={{ y: -1 }}
      transition={SPRING.snappy}
      onClick={onOpenSidecar}
      className={`group relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border p-3.5 transition-all cursor-pointer backdrop-blur-xl ${
        isSelected
          ? 'border-[#007AFF] bg-brand-500/[0.08] ring-1 ring-[#007AFF]/30'
          : isFocused
          ? 'border-[#007AFF]/60 bg-brand-500/[0.05] ring-1 ring-[#007AFF]/30'
          : 'border-black/[0.06] bg-white/80 dark:border-white/[0.08] dark:bg-surface-900/80 hover:border-black/[0.12] dark:hover:border-white/[0.15] hover:shadow-sm'
      }`}
    >
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        {/* Checkbox with 44x44px tap zone */}
        {onToggleSelect && (
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center cursor-pointer -ml-2"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect();
            }}
          >
            <div
              className={`flex h-5 w-5 items-center justify-center rounded-md border transition-all ${
                isSelected
                  ? 'border-[#007AFF] bg-[#007AFF] text-white'
                  : 'border-black/25 dark:border-white/25 bg-white/50 dark:bg-surface-800/50'
              }`}
              aria-label={t('courses.selectRowAria', { name: course.name })}
            >
              {isSelected && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </div>
          </div>
        )}

        {/* Avatar Squircle */}
        <div
          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-bold text-white shadow-sm ring-1 ring-white/20"
          style={{ background: courseGradient(course.name) }}
        >
          <span className="relative text-[12px] font-bold tracking-tight font-display">
            {getInitials(course.name)}
          </span>
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-[14px] font-bold tracking-tight text-[var(--text-primary)] group-hover:text-[#007AFF] transition-colors">
              {course.name}
            </h3>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums border ${
                course.isActive
                  ? 'bg-[#34C759]/10 text-[#28A745] dark:text-[#34C759] border-[#34C759]/20'
                  : 'bg-black/[0.04] dark:bg-white/[0.06] text-[var(--text-tertiary)] border-black/[0.04] dark:border-white/[0.06]'
              }`}
            >
              {course.isActive && <span className="h-1.5 w-1.5 rounded-full bg-[#34C759] animate-pulse" />}
              {course.isActive ? t('common.active') : t('common.inactive')}
            </span>
          </div>
          {course.description && (
            <p className="mt-0.5 line-clamp-1 text-[12px] font-normal text-[var(--text-secondary)]">
              {course.description}
            </p>
          )}
        </div>
      </div>

      {/* Middle Specs */}
      <div className="flex flex-wrap items-center gap-3 sm:gap-5 text-[12px] font-medium text-[var(--text-tertiary)] pl-14 sm:pl-0">
        {course.level && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{
              background: c.bg,
              color: c.fg,
              border: `1px solid ${c.fg}33`,
            }}
          >
            <Icon paths={I.award} size={10} strokeWidth={2.5} />
            {t(`courses.level.${course.level}`, formatCourseLevel(course.level as CourseLevel))}
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-[11.5px] text-[var(--text-secondary)]">
          <Icon paths={I.clock} size={12} strokeWidth={2} className="opacity-70" />
          {course.duration} {course.duration === 1 ? t('courses.unit.month') : t('courses.unit.months')}
        </span>
        <span className="font-bold tabular-nums text-[#34C759] dark:text-[#30D158]">
          {formatCurrency(course.price)}
        </span>
      </div>

      {/* Actions (44x44px touch targets) */}
      <div
        className="flex shrink-0 items-center justify-end gap-1 pt-1.5 sm:pt-0 border-t border-black/[0.04] dark:border-white/[0.04] sm:border-0"
        onClick={(e) => e.stopPropagation()}
      >
        <motion.button
          type="button"
          onClick={() => onOpenSyllabus?.()}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={SPRING.snappy}
          aria-label="Kurs rejasi va guruhlar (Curriculum & groups)"
          title="Kurs rejasi va guruhlar"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.03] dark:bg-white/[0.06] text-[var(--text-secondary)] hover:text-[#007AFF] hover:border-brand-500/40 transition-colors text-xs font-bold"
        >
          <Icon paths={I.bookOpen} size={15} strokeWidth={2} />
        </motion.button>
        <motion.button
          type="button"
          onClick={() => onOpenAiArchitect?.()}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={SPRING.snappy}
          aria-label="AI kurs meʼmori (AI Course Architect)"
          title="AI kurs meʼmori"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.03] dark:bg-white/[0.06] text-brand-600 dark:text-brand-400 hover:text-brand-500 hover:border-brand-500/40 transition-colors"
        >
          <Icon paths={I.sparkles} size={15} strokeWidth={2} />
        </motion.button>
        <motion.button
          type="button"
          onClick={() => onOpenSidecar?.()}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={SPRING.snappy}
          aria-label={t('courses.sidecar.dossier')}
          title={t('courses.sidecar.toggleAria')}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.03] dark:bg-white/[0.06] text-[var(--text-secondary)] hover:text-[#007AFF] hover:border-brand-500/40 transition-colors text-xs font-bold"
        >
          <span>◨</span>
        </motion.button>

        <motion.button
          type="button"
          onClick={() => onEdit(course)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={SPRING.snappy}
          aria-label={t('common.edit')}
          title={t('courses.editCourse')}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.03] dark:bg-white/[0.06] text-[var(--text-secondary)] hover:text-[#007AFF] hover:border-[#007AFF]/30 transition-colors"
        >
          <Icon paths={I.edit} size={14} strokeWidth={2} />
        </motion.button>

        <motion.button
          type="button"
          onClick={() => onDelete(course.id)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={SPRING.snappy}
          aria-label={t('common.delete')}
          title={t('courses.deleteCourse')}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#FF3B30]/20 bg-[#FF3B30]/10 text-[#FF3B30] hover:bg-[#FF3B30]/20 transition-colors"
        >
          <Icon paths={I.trash} size={14} strokeWidth={2} />
        </motion.button>
      </div>
    </motion.div>
  );
});

/* ============================================================================
 * MAIN COURSES PAGE COMPONENT
 * ========================================================================== */

export function CoursesPage() {
  const { t } = useSafeI18n();
  usePageTitle(t('courses.title'));
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [syllabusDrawerCourse, setSyllabusDrawerCourse] = useState<Course | null>(null);
  const [aiModalCourse, setAiModalCourse] = useState<Course | null>(null);
  const [bulkModal, setBulkModal] = useState<'status' | 'price' | null>(null);

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem('medu_courses_view_mode');
      return saved === 'table' ? 'table' : 'gallery';
    } catch {
      return 'gallery';
    }
  });

  const handleSetViewMode = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem('medu_courses_view_mode', mode);
    } catch {
      // noop
    }
  }, []);

  // Filter + search
  const [searchParams] = useSearchParams();
  const [filter, setFilter] = useState<LevelFilter>('ALL');
  const [search, setSearch] = useState(() => searchParams.get('search') || searchParams.get('q') || '');

  // Form state
  const [form, setForm] = useState<CourseFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CourseFormState, string>>>({});

  const courses = useQuery({
    queryKey: queryKeys.courses.all(),
    queryFn: () => coursesApi.list({ limit: 100 }),
    placeholderData: (previousData) => previousData,
  });

  const data = courses.data as Paginated<Course> | undefined;
  const courseList = useMemo(() => data?.items || [], [data]);

  /* ── Stats Ribbon ─────────────────────────────────────────────────── */
  const stats = useMemo(() => {
    const total = courseList.length;
    const active = courseList.filter((c) => c.isActive).length;
    const totalPrice = courseList.reduce((sum, c) => sum + (Number(c.price) || 0), 0);
    const avgPrice = total > 0 ? totalPrice / total : 0;
    const levels = new Set(courseList.map((c) => c.level).filter(Boolean)).size;
    return { total, active, avgPrice, levels };
  }, [courseList]);

  /* ── Filter Counts & Filtering ─────────────────────────────────────── */
  const counts = useMemo<Record<LevelFilter, number>>(() => {
    const base: Record<LevelFilter, number> = {
      ALL: courseList.length,
      ACTIVE: courseList.filter((c) => c.isActive).length,
      BEGINNER: 0, INTERMEDIATE: 0, ADVANCED: 0, EXPERT: 0,
    };
    for (const c of courseList) {
      if (c.level && c.level in base) base[c.level as CourseLevel]++;
    }
    return base;
  }, [courseList]);

  const filtered = useMemo(() => {
    let list = courseList;
    if (filter === 'ACTIVE') list = list.filter((c) => c.isActive);
    else if (filter !== 'ALL') list = list.filter((c) => c.level === filter);

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          (c.name || '').toLowerCase().includes(q) ||
          (c.description || '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [courseList, filter, search]);

  const filterOptions = useMemo(
    () => [
      { key: 'ALL' as LevelFilter,          label: t('courses.filter.all'),    icon: I.layers,        tone: 'blue'   as Tone },
      { key: 'ACTIVE' as LevelFilter,       label: t('courses.filter.active'), icon: I.checkCircle,   tone: 'green'  as Tone },
      { key: 'BEGINNER' as LevelFilter,     label: t('courses.level.BEGINNER'), icon: I.graduationCap, tone: 'green'  as Tone },
      { key: 'INTERMEDIATE' as LevelFilter, label: t('courses.level.INTERMEDIATE'), icon: I.book,     tone: 'blue'   as Tone },
      { key: 'ADVANCED' as LevelFilter,     label: t('courses.level.ADVANCED'), icon: I.zap,          tone: 'orange' as Tone },
      { key: 'EXPERT' as LevelFilter,       label: t('courses.level.EXPERT'),   icon: I.award,        tone: 'purple' as Tone },
    ],
    [t],
  );

  /* ── Mutations ────────────────────────────────────────────────────── */
  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        price: parseFloat(form.price) || 0,
        duration: parseInt(form.duration, 10) || 1,
        level: (form.level as CourseLevel) || undefined,
      };
      return editingId ? coursesApi.update(editingId, payload) : coursesApi.create(payload);
    },
    onSuccess: () => {
      push('success', editingId ? t('courses.updated') : t('courses.createSuccess'));
      setModalOpen(false);
      setEditingId(null);
      setForm(INITIAL_FORM);
      setFormErrors({});
      qc.invalidateQueries({ queryKey: queryKeys.courses.all() });
      qc.invalidateQueries({ queryKey: queryKeys.courses.selectors() });
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => coursesApi.remove(id),
    onSuccess: () => {
      push('success', t('courses.deleted'));
      qc.invalidateQueries({ queryKey: queryKeys.courses.all() });
      qc.invalidateQueries({ queryKey: queryKeys.courses.selectors() });
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  /* ── Form Handlers ────────────────────────────────────────────────── */
  const validateForm = useCallback((): boolean => {
    const errors: Partial<Record<keyof CourseFormState, string>> = {};
    if (!form.name.trim()) errors.name = t('courses.validation.nameRequired');
    if (!form.price || parseFloat(form.price) < 0) errors.price = t('courses.validation.priceInvalid');
    if (!form.duration || parseInt(form.duration, 10) < 1) errors.duration = t('courses.validation.durationMin');
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form, t]);

  const handleFormChange = useCallback(
    (field: keyof CourseFormState) =>
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
  }, []);

  const { refetch: refetchCourses } = courses;
  const handleRetry = useCallback(() => { void refetchCourses(); }, [refetchCourses]);

  const handleOpenModal = useCallback(() => {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setFormErrors({});
    setModalOpen(true);
  }, []);

  const handleEdit = useCallback((course: Course) => {
    setEditingId(course.id);
    setForm({
      name: course.name,
      description: course.description || '',
      price: String(course.price),
      duration: String(course.duration),
      level: (course.level as CourseLevel) || '',
    });
    setFormErrors({});
    setModalOpen(true);
  }, []);

  const handleDelete = useCallback((id: string) => setDeleteTarget(id), []);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    remove.mutate(deleteTarget);
    setDeleteTarget(null);
  }, [deleteTarget, remove]);

  const sound = usePremiumSound();

  /* ── Sidecar QuickLook Dossier ────────────────────────────────────── */
  const handleOpenCourseSidecar = useCallback((course: Course) => {
    sound.playPop();
    const data: QuickLookData = {
      id: course.id,
      type: 'general',
      title: course.name,
      subtitle: t('courses.sidecar.subtitle', { duration: course.duration }),
      badge: {
        text: course.isActive ? t('common.active') : t('common.inactive'),
        tone: course.isActive ? 'emerald' : 'slate',
      },
      avatar: {
        text: getInitials(course.name),
        color: '#007AFF',
      },
      metrics: [
        {
          label: t('courses.sidecar.monthlyPrice'),
          value: formatCurrency(course.price),
          subtext: t('courses.sidecar.standardTuition'),
        },
        {
          label: t('courses.col.duration'),
          value: `${course.duration} ${course.duration === 1 ? t('courses.unit.month') : t('courses.unit.months')}`,
          subtext: t('courses.sidecar.curriculumDuration'),
        },
        {
          label: t('courses.col.level'),
          value: course.level ? t(`courses.level.${course.level}`, formatCourseLevel(course.level as CourseLevel)) : t('courses.sidecar.generalLevel'),
        },
      ],
      details: [
        { label: t('courses.form.name'), value: course.name, copyable: true },
        { label: t('courses.form.priceLabel'), value: formatCurrency(course.price) },
        { label: t('courses.col.duration'), value: `${course.duration} ${course.duration === 1 ? t('courses.unit.month') : t('courses.unit.months')}` },
        { label: t('courses.col.level'), value: course.level ? t(`courses.level.${course.level}`, formatCourseLevel(course.level as CourseLevel)) : t('courses.sidecar.generalLevel') },
        { label: t('courses.form.description'), value: course.description || t('courses.sidecar.noDescription') },
      ],
      primaryAction: {
        label: t('courses.sidecar.editAction'),
        onExecute: () => handleEdit(course),
      },
    };
    openSidecar(data);
  }, [sound, handleEdit, t]);

  /* ── Keyboard Navigation ──────────────────────────────────── */
  const {
    focusedIndex,
    selectedIds,
    selectedCount,
    isSelected,
    toggleSelection,
    clearSelection,
  } = useListKeyboardNavigation<Course>({
    items: filtered,
    getItemId: (c) => c.id,
    rowIdPrefix: 'course-row-',
    onSelect: (c) => handleOpenCourseSidecar(c),
    onQuickLook: (c) => handleOpenCourseSidecar(c),
    onEdit: (c) => handleEdit(c),
  });

  /* ── Bulk Actions ─────────────────────────────────────────────────── */
  const handleExportSelectedCoursesCSV = () => {
    const selectedRows = filtered.filter((c) => selectedIds.has(c.id));
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      ['ID,Name,Price,Duration,Level,IsActive']
        .concat(
          selectedRows.map(
            (c) =>
              `"${c.id}","${(c.name || '').replace(/"/g, '""')}","${c.price}","${c.duration}","${c.level || ''}","${c.isActive ? 'Active' : 'Inactive'}"`
          )
        )
        .join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `courses_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    clearSelection();
    push('success', t('courses.batch.exportedCsv', { count: selectedRows.length }));
  };

  /* ───────────────────────────────────────────────────────────────
     LOADING STATE
  ─────────────────────────────────────────────────────────────── */
  if (courses.isLoading && !data) {
    return (
      <div style={{ display: 'contents' }}>
        <div className="page-container space-y-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <CoursesSkeleton />
        </div>
      </div>
    );
  }

  /* ───────────────────────────────────────────────────────────────
     ERROR STATE
  ─────────────────────────────────────────────────────────────── */
  if (courses.isError) {
    return (
      <div style={{ display: 'contents' }}>
        <div className="page-container space-y-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <GlassCard className="p-8">
            <GlassErrorState
              title={t('courses.loadFailed')}
              message={getErrorMessage(courses.error as Error)}
              onRetry={handleRetry}
            />
          </GlassCard>
        </div>
      </div>
    );
  }

  /* ───────────────────────────────────────────────────────────────
     MAIN VIEW
  ─────────────────────────────────────────────────────────────── */
  return (
    <div style={{ display: 'contents' }}>
      <AuroraMesh variant="corporate" opacity={0.65} />
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="page-container space-y-5 pb-[max(2rem,env(safe-area-inset-bottom))]"
      >
        {/* HERO HEADER (Unified Header + Stats + Action) */}
        <motion.div variants={cardVariants}>
          <div className="relative overflow-hidden rounded-3xl border border-black/[0.08] bg-white/80 p-5 sm:p-6 backdrop-blur-2xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card">
            {/* Subtle specular sheen */}
            <div
              aria-hidden
              className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-gradient-to-br from-[#007AFF]/15 to-transparent blur-3xl"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -right-20 -bottom-20 h-56 w-56 rounded-full bg-gradient-to-tl from-[#5856D6]/15 to-transparent blur-3xl"
            />

            <div className="relative z-10 flex flex-col items-center gap-5 sm:flex-row sm:items-center">
              {/* Apple Squircle Icon */}
              <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#007AFF] via-[#5856D6] to-[#AF52DE] text-white shadow-[0_10px_25px_rgba(0,122,255,0.30)] ring-1 ring-white/25 sm:h-18 sm:w-18">
                <Icon paths={I.graduationCap} size={30} strokeWidth={2.2} className="relative z-10" />
              </div>

              {/* Title & Metadata */}
              <div className="min-w-0 flex-1 text-center sm:text-left">
                <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#34C759]/12 px-2.5 py-0.5 text-[11px] font-semibold text-[#28A745] dark:text-[#34C759] border border-[#34C759]/25 tabular-nums">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#34C759] animate-pulse" />
                    {stats.active} {t('courses.kpi.active')}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--text-secondary)] border border-black/[0.05] dark:border-white/[0.06] tabular-nums">
                    <Icon paths={I.layers} size={11} strokeWidth={2.2} />
                    {stats.total} {t('courses.kpi.total')}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#AF52DE]/12 px-2.5 py-0.5 text-[11px] font-semibold text-[#AF52DE] border border-[#AF52DE]/25 tabular-nums">
                    <Icon paths={I.award} size={11} strokeWidth={2.2} />
                    {stats.levels} {t('courses.kpi.levels')}
                  </span>
                </div>

                <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl font-display">
                  {t('courses.title')}
                </h1>
                <p className="mt-0.5 text-[13.5px] font-normal text-[var(--text-secondary)]">
                  {t('courses.pageSubtitle')}
                </p>
              </div>

              {/* Add Course Action Button with >= 44x44px target */}
              <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={SPRING.snappy}>
                  <GlassButton
                    type="button"
                    variant="primary"
                    onClick={handleOpenModal}
                    className="min-h-[44px] px-5 text-[13.5px] font-semibold shadow-sm"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Icon paths={I.plus} size={16} strokeWidth={2.5} />
                      {t('courses.add')}
                    </span>
                  </GlassButton>
                </motion.div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* STATS RIBBON */}
        <motion.div variants={containerVariants} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label={t('courses.kpi.total')} value={stats.total} icon={I.bookOpen} tone="blue" />
          <StatTile label={t('courses.kpi.active')} value={stats.active} icon={I.checkCircle} tone="green" />
          <StatTile
            label={t('courses.stats.avgPrice')}
            value={formatCurrency(stats.avgPrice)}
            icon={I.trendingUp}
            tone="orange"
          />
          <StatTile label={t('courses.stats.levels')} value={stats.levels} icon={I.award} tone="purple" />
        </motion.div>

        {/* TOOLBAR: Filter by Level + Search + View Switcher */}
        <motion.div variants={cardVariants} className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <SegmentedFilter
            value={filter}
            onChange={setFilter}
            options={filterOptions}
            counts={counts}
          />

          <div className="flex items-center gap-2.5">
            {/* Search Input */}
            <div className="relative min-w-0 flex-1 sm:w-72 sm:flex-initial">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B]">
                <Icon paths={I.search} size={15} strokeWidth={2.2} />
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('courses.searchPlaceholder')}
                className="input-base min-h-[44px] w-full pl-10 pr-10 text-[13px] rounded-2xl"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-1 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center text-[#64748B] hover:text-[var(--text-primary)]"
                  aria-label={t('courses.clearSearch')}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-black/[0.05] dark:bg-white/[0.08]">
                    <Icon paths={I.x} size={12} strokeWidth={2.5} />
                  </span>
                </button>
              )}
            </div>

            {/* View Mode Switcher (Gallery vs Table) */}
            <div className="inline-flex shrink-0 items-center rounded-2xl border border-black/[0.06] bg-black/[0.04] p-1 dark:border-white/[0.08] dark:bg-white/[0.06]">
              <button
                type="button"
                onClick={() => handleSetViewMode('gallery')}
                className={`flex h-11 w-11 items-center justify-center rounded-xl transition-all ${
                  viewMode === 'gallery'
                    ? 'bg-white text-[#007AFF] shadow-sm dark:bg-surface-800'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                title={t('courses.view.gallery')}
                aria-label={t('courses.view.gallery')}
              >
                <Icon paths={I.grid} size={16} strokeWidth={2.2} />
              </button>
              <button
                type="button"
                onClick={() => handleSetViewMode('table')}
                className={`flex h-11 w-11 items-center justify-center rounded-xl transition-all ${
                  viewMode === 'table'
                    ? 'bg-white text-[#007AFF] shadow-sm dark:bg-surface-800'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                title={t('courses.view.table')}
                aria-label={t('courses.view.table')}
              >
                <Icon paths={I.list} size={16} strokeWidth={2.2} />
              </button>
            </div>
          </div>
        </motion.div>

        {/* CONTENT CATALOG (Gallery or Table) */}
        <motion.div variants={cardVariants}>
          {courseList.length === 0 ? (
            <GlassCard className="p-8">
              <GlassEmptyState
                title={t('courses.empty')}
                message={t('courses.emptyMessage')}
              />
            </GlassCard>
          ) : filtered.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700 bg-white/40 dark:bg-surface-900/40 backdrop-blur-xl">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#007AFF]/10 text-[#007AFF]">
                <Icon paths={I.search} size={24} strokeWidth={2} />
              </div>
              <p className="mt-3.5 text-[15px] font-bold text-[var(--text-primary)]">
                {t('courses.noMatch')}
              </p>
              <p className="mx-auto mt-1 max-w-sm text-[12.5px] font-medium text-[var(--text-secondary)]">
                {t('courses.clearSearchHint')}
              </p>
              <div className="mt-5 flex justify-center gap-2">
                {search && (
                  <GlassButton
                    type="button"
                    variant="secondary"
                    onClick={() => setSearch('')}
                    className="min-h-[44px]"
                  >
                    {t('courses.clearSearch')}
                  </GlassButton>
                )}
                <GlassButton
                  type="button"
                  variant="primary"
                  onClick={() => { setFilter('ALL'); setSearch(''); }}
                  className="min-h-[44px]"
                >
                  {t('courses.showAll')}
                </GlassButton>
              </div>
            </div>
          ) : viewMode === 'gallery' ? (
            /* GALLERY VIEW (Apple Specular Cards) */
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <AnimatePresence initial={false} mode="popLayout">
                {filtered.map((course, idx) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    isSelected={isSelected(course.id)}
                    isFocused={focusedIndex === idx}
                    onToggleSelect={() => toggleSelection(course.id)}
                    onOpenSidecar={() => handleOpenCourseSidecar(course)}
                    onOpenSyllabus={() => setSyllabusDrawerCourse(course)}
                    onOpenAiArchitect={() => setAiModalCourse(course)}
                  />
                ))}
              </AnimatePresence>
            </div>
          ) : (
            /* TABLE VIEW (Dense Specular Grid) */
            <div className="overflow-hidden rounded-3xl border border-black/[0.06] bg-white/80 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card">
              <div className="flex items-center justify-between border-b border-black/[0.05] dark:border-white/[0.05] px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
                    <Icon paths={I.bookOpen} size={16} strokeWidth={2.2} />
                  </div>
                  <div>
                    <h2 className="text-[14px] font-bold tracking-tight text-[var(--text-primary)]">
                      {t('courses.title')}
                    </h2>
                    <p className="text-[11.5px] font-medium text-[var(--text-tertiary)]">
                      {filtered.length} {filtered.length === 1 ? t('courses.countOne') : t('courses.countMany')}
                    </p>
                  </div>
                </div>
                {search && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.04] dark:bg-white/[0.06] px-3 py-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                    <Icon paths={I.search} size={11} strokeWidth={2.5} />
                    {filtered.length}
                  </span>
                )}
              </div>

              <div className="space-y-2 p-3">
                <AnimatePresence initial={false} mode="popLayout">
                  {filtered.map((course, idx) => (
                    <CourseTableRow
                      key={course.id}
                      course={course}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      isSelected={isSelected(course.id)}
                      isFocused={focusedIndex === idx}
                      onToggleSelect={() => toggleSelection(course.id)}
                      onOpenSidecar={() => handleOpenCourseSidecar(course)}
                      onOpenSyllabus={() => setSyllabusDrawerCourse(course)}
                      onOpenAiArchitect={() => setAiModalCourse(course)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}
        </motion.div>

        {/* ADD / EDIT MODAL */}
        <GlassModal
          open={modalOpen}
          onClose={handleCloseModal}
          title={editingId ? t('courses.editTitle') : t('courses.add')}
          wide
        >
          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            {/* Header hint callout */}
            <div className="flex items-center gap-3 rounded-2xl border border-[#007AFF]/20 bg-[#007AFF]/[0.06] px-4 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#007AFF]/15 text-[#007AFF]">
                <Icon paths={I.sparkles} size={18} strokeWidth={2} />
              </div>
              <p className="text-[12.5px] font-medium leading-snug text-[var(--text-primary)]">
                {editingId
                  ? t('courses.modalHintEdit')
                  : t('courses.modalHintCreate')}
              </p>
            </div>

            {/* Section: Basic info */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Icon paths={I.bookOpen} size={14} strokeWidth={2} className="text-[var(--text-tertiary)]" />
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                  {t('courses.basicInfo')}
                </p>
              </div>

              <GlassField label={t('courses.form.name')} required error={formErrors.name}>
                <GlassInput
                  value={form.name}
                  onChange={handleFormChange('name')}
                  required
                  aria-invalid={Boolean(formErrors.name)}
                  placeholder={t('courses.namePlaceholder')}
                  className="min-h-[44px]"
                />
              </GlassField>

              <GlassField label={t('courses.form.description')}>
                <GlassTextArea
                  rows={3}
                  value={form.description}
                  onChange={handleFormChange('description')}
                  placeholder={t('courses.descriptionPlaceholder')}
                />
              </GlassField>
            </div>

            {/* Section: Pricing & duration */}
            <div className="space-y-3 border-t border-black/[0.06] dark:border-white/[0.08] pt-4">
              <div className="flex items-center gap-2">
                <Icon paths={I.creditCard} size={14} strokeWidth={2} className="text-[var(--text-tertiary)]" />
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                  {t('courses.pricingAndDuration')}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <GlassField label={t('courses.form.price')} required error={formErrors.price}>
                  <GlassInput
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.price}
                    onChange={handleFormChange('price')}
                    required
                    aria-invalid={Boolean(formErrors.price)}
                    placeholder="299.99"
                    className="min-h-[44px]"
                  />
                </GlassField>
                <GlassField label={t('courses.form.durationLabel')} required error={formErrors.duration}>
                  <GlassInput
                    type="number"
                    min="1"
                    value={form.duration}
                    onChange={handleFormChange('duration')}
                    required
                    aria-invalid={Boolean(formErrors.duration)}
                    placeholder="6"
                    className="min-h-[44px]"
                  />
                </GlassField>
              </div>
            </div>

            {/* Section: Level */}
            <div className="space-y-3 border-t border-black/[0.06] dark:border-white/[0.08] pt-4">
              <div className="flex items-center gap-2">
                <Icon paths={I.award} size={14} strokeWidth={2} className="text-[var(--text-tertiary)]" />
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                  {t('courses.level')}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {COURSE_LEVELS.map((level) => {
                  const active = form.level === level;
                  const c = TONE[LEVEL_TONE[level]];
                  return (
                    <motion.button
                      key={level}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, level }))}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      transition={SPRING.snappy}
                      className="flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-2xl border px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider outline-none"
                      style={{
                        background: active ? c.bg : 'transparent',
                        borderColor: active ? `${c.fg}55` : 'rgba(0,0,0,0.08)',
                        color: active ? c.fg : 'var(--text-secondary)',
                        boxShadow: active
                          ? `inset 0 1px 0 rgba(255,255,255,0.5), 0 4px 12px -6px ${c.glow}`
                          : undefined,
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <Icon paths={I.award} size={15} strokeWidth={2.2} />
                      {t(`courses.level.${level}`, formatCourseLevel(level))}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex justify-end gap-2 border-t border-black/[0.06] dark:border-white/[0.08] pt-4">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <GlassButton
                  type="button"
                  variant="secondary"
                  onClick={handleCloseModal}
                  disabled={save.isPending}
                  className="min-h-[44px] px-4"
                >
                  {t('common.cancel')}
                </GlassButton>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <GlassButton
                  type="submit"
                  variant="primary"
                  disabled={save.isPending}
                  className="min-h-[44px] px-5"
                >
                  {save.isPending ? (
                    <span className="inline-flex items-center gap-2">
                      <motion.span
                        className="inline-block h-4 w-4 rounded-full border-2 border-white/40 border-t-white"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                      />
                      {t('common.saving')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <Icon
                        paths={editingId ? I.check : I.plus}
                        size={15}
                        strokeWidth={2.5}
                      />
                      {editingId ? t('courses.form.update') : t('courses.form.create')}
                    </span>
                  )}
                </GlassButton>
              </motion.div>
            </div>
          </form>
        </GlassModal>

        {/* DELETE CONFIRM DIALOG */}
        <ConfirmDialog
          open={deleteTarget !== null}
          onClose={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
          description={t('courses.deleteConfirm')}
          loading={remove.isPending}
        />

        {/* FLOATING ACTION ISLAND (Bulk Course Operations) */}
        <FloatingActionIsland
          selectedCount={selectedCount}
          onClear={clearSelection}
          actions={[
            {
              label: "Holatni o‘zgartirish (Toggle status)",
              icon: '🔄',
              onClick: () => setBulkModal('status'),
              variant: 'primary',
              shortcutBadge: 't',
            },
            {
              label: "Narxlarni yangilash (Update prices)",
              icon: '💰',
              onClick: () => setBulkModal('price'),
              shortcutBadge: 'p',
            },
            {
              label: t('courses.batch.exportCsv'),
              icon: '📊',
              onClick: handleExportSelectedCoursesCSV,
              shortcutBadge: 'e',
            },
          ]}
        />

        <CourseSyllabusDrawer
          course={syllabusDrawerCourse}
          isOpen={Boolean(syllabusDrawerCourse)}
          onClose={() => setSyllabusDrawerCourse(null)}
          onEdit={(c) => {
            setSyllabusDrawerCourse(null);
            handleEdit(c);
          }}
          onOpenAiArchitect={(c) => {
            setSyllabusDrawerCourse(null);
            setAiModalCourse(c);
          }}
        />

        <CourseAiSyllabusModal
          course={aiModalCourse}
          isOpen={Boolean(aiModalCourse)}
          onClose={() => setAiModalCourse(null)}
        />

        <BulkCourseActionsModals
          selectedIds={Array.from(selectedIds)}
          isOpen={Boolean(bulkModal)}
          activeModal={bulkModal}
          onClose={() => setBulkModal(null)}
          onSuccess={() => {
            clearSelection();
            qc.invalidateQueries({ queryKey: queryKeys.courses.all() });
          }}
        />

        {toastNode}
      </motion.div>
    </div>
  );
}
