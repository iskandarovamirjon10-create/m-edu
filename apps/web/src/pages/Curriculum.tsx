/**
 * M-EDU Curriculum Page
 *
 * Architecture & Features:
 *  - Apple Glass Liquid Glass aesthetic with specular rim reflections
 *  - Ambient Aurora mesh backdrop (indigo, purple, emerald drift)
 *  - macOS Split-View Detail Sidecar (`openSidecar` with modules & syllabus metrics)
 *  - WCAG 2.2 AA SC 2.5.8 touch targets (>= 44x44px for all interactive elements)
 *  - Keyboard navigation (j/k, x, Enter, c to create)
 *  - Web Audio tactile haptics (playTick, playPop, playSuccess)
 *  - Exported pure domain helpers (computeCurriculumStats, statusTone, etc.)
 *  - Complete trilingual i18n resilience (useSafeI18n with UZ, RU, EN fallbacks)
 */

import React, { useState, useCallback, useMemo, useEffect, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { curriculumApi, subjectsApi } from '@/lib/api';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useListKeyboardNavigation } from '@/hooks/useListKeyboardNavigation';
import { openSidecar, type QuickLookData } from '@/stores/ui.store';
import { GlassModal } from '@/components/ui';
import { AiLessonPlanStudio } from '@/components/ai/AiLessonPlanStudio';

/* ============================================================================
 * MOTION TOKENS (Apple Spring Physics)
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
 * TYPES
 * ========================================================================== */

export interface Subject {
  id: string;
  code: string;
  name: string;
}

export interface Curriculum {
  id: string;
  name: string;
  version: number;
  status: string;
  subject?: { id: string; name: string; code: string } | null;
  _count?: { modules?: number };
}

export interface CurriculumStats {
  total: number;
  published: number;
  drafts: number;
  modules: number;
}

/* ============================================================================
 * TONE PALETTES
 * ========================================================================== */

export type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'slate';

export const TONE: Record<Tone, { fg: string; bg: string; glow: string; border: string }> = {
  blue:   { fg: '#007AFF', bg: 'rgba(0,122,255,0.12)',  glow: 'rgba(0,122,255,0.28)',  border: 'rgba(0,122,255,0.24)' },
  green:  { fg: '#34C759', bg: 'rgba(52,199,89,0.12)',   glow: 'rgba(52,199,89,0.28)',   border: 'rgba(52,199,89,0.24)' },
  orange: { fg: '#FF9500', bg: 'rgba(255,149,0,0.12)',   glow: 'rgba(255,149,0,0.28)',   border: 'rgba(255,149,0,0.24)' },
  red:    { fg: '#FF3B30', bg: 'rgba(255,59,48,0.12)',   glow: 'rgba(255,59,48,0.28)',   border: 'rgba(255,59,48,0.24)' },
  purple: { fg: '#AF52DE', bg: 'rgba(175,82,222,0.12)',  glow: 'rgba(175,82,222,0.28)',  border: 'rgba(175,82,222,0.24)' },
  slate:  { fg: '#8E8E93', bg: 'rgba(142,142,147,0.12)', glow: 'rgba(142,142,147,0.28)', border: 'rgba(142,142,147,0.24)' },
};

/* ============================================================================
 * PURE DOMAIN HELPERS (Exported for Unit Testing)
 * ========================================================================== */

export function codeHash(str: string): number {
  if (!str) return 0;
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export const CURRICULUM_PALETTES: Tone[] = ['blue', 'purple', 'green', 'orange', 'red', 'slate'];

export function curriculumTone(name: string): Tone {
  return CURRICULUM_PALETTES[codeHash(name) % CURRICULUM_PALETTES.length];
}

export function statusTone(status: string): Tone {
  const s = status?.toUpperCase() || '';
  if (s === 'PUBLISHED' || s === 'ACTIVE') return 'green';
  if (s === 'DRAFT') return 'orange';
  if (s === 'ARCHIVED' || s === 'INACTIVE') return 'slate';
  if (s === 'REVIEW') return 'blue';
  return 'purple';
}

export function getInitials(name: string): string {
  if (!name || typeof name !== 'string') return '—';
  return (
    name
      .trim()
      .split(/\s+/)
      .map((p) => p.charAt(0))
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '—'
  );
}

export function computeCurriculumStats(list: Curriculum[]): CurriculumStats {
  const total = list.length;
  const published = list.filter((c) =>
    ['PUBLISHED', 'ACTIVE'].includes(c.status?.toUpperCase() || ''),
  ).length;
  const drafts = list.filter((c) => c.status?.toUpperCase() === 'DRAFT').length;
  const modules = list.reduce((sum, c) => sum + (c._count?.modules || 0), 0);
  return { total, published, drafts, modules };
}

/* ============================================================================
 * CUSTOM SVG ICONS (SVG Icons)
 * ========================================================================== */

const ICON_STROKE = 2.0;

const I: Record<string, string[]> = {
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
  checkCircle: [
    'M22 11.08V12a10 10 0 1 1-5.93-9.14',
    'M22 4 12 14.01l-3-3',
  ],
  pencil: [
    'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
    'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  ],
  tag: [
    'M20.59 13.41 12 22 2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z',
    'M7 7h.01',
  ],
  refresh: [
    'M23 4v6h-6',
    'M1 20v-6h6',
    'M3.51 9a9 9 0 0 1 14.85-3.36L23 10',
    'M20.49 15a9 9 0 0 1-14.85 3.36L1 14',
  ],
  alertTriangle: [
    'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
    'M12 9v4', 'M12 17h.01',
  ],
  sparkles: [
    'M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z',
    'M18.5 3.5v3', 'M20 5h-3',
    'M5.5 18v2.5', 'M6.75 19.25h-2.5',
  ],
  graduationCap: [
    'M22 10 12 5 2 10l10 5 10-5z',
    'M6 12v5c3 3 9 3 12 0v-5',
  ],
  clipboard: [
    'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2',
    'M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z',
  ],
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
 * AMBIENT AURORA BACKDROP (Apple Glass Depth)
 * ========================================================================== */

function AuroraBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-[#04060C] dark:via-[#0A0F1A] dark:to-[#080A14]" />
      <div className="absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-indigo-500/10 blur-[140px] dark:bg-indigo-500/10" />
      <div className="absolute -right-32 top-1/4 h-[520px] w-[520px] rounded-full bg-purple-500/10 blur-[140px] dark:bg-purple-500/10" />
      <div className="absolute -bottom-32 left-1/3 h-[480px] w-[480px] rounded-full bg-blue-500/08 blur-[140px] dark:bg-sky-500/08" />
    </div>
  );
}

/* ============================================================================
 * ANIMATED COUNT UP
 * ========================================================================== */

function CountUp({
  value,
  duration = 0.9,
  suffix = '',
}: {
  value: number;
  duration?: number;
  suffix?: string;
}) {
  const [n, setN] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    let raf: number;
    startRef.current = null;
    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const p = Math.min(1, (ts - startRef.current) / (duration * 1000));
      const eased = 1 - Math.pow(1 - p, 4);
      const safeVal = Number.isFinite(value) ? value : 0;
      setN(safeVal * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <span className="tabular-nums">{Math.round(Number.isFinite(n) ? n : 0).toLocaleString()}{suffix}</span>;
}

/* ============================================================================
 * SHIMMER SKELETON
 * ========================================================================== */

function Shimmer({ className = '', radius = '0.75rem' }: { className?: string; radius?: string }) {
  return (
    <div
      className={`relative overflow-hidden bg-slate-200/60 dark:bg-white/[0.08] ${className}`}
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

function CurriculumSkeleton() {
  return (
    <div className="space-y-5">
      <Shimmer className="h-44 w-full" radius="1.75rem" />
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Shimmer key={i} className="h-[76px]" radius="1.25rem" />
        ))}
      </div>
      <Shimmer className="h-14" radius="1rem" />
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <Shimmer key={i} className="h-24" radius="1.25rem" />
        ))}
      </div>
    </div>
  );
}

/* ============================================================================
 * STAT TILE
 * ========================================================================== */

function StatTile({
  label,
  value,
  icon,
  tone = 'blue',
}: {
  label: string;
  value: number;
  icon: string[];
  tone?: Tone;
}) {
  const c = TONE[tone];
  const { playTick } = usePremiumSound();

  return (
    <motion.div
      variants={rowVariants}
      whileHover={{ y: -2 }}
      onMouseEnter={playTick}
      transition={SPRING.smooth}
      className="liquid-glass-surface group relative flex items-center gap-3.5 overflow-hidden rounded-2xl border border-black/[0.08] dark:border-white/[0.12] bg-white/80 dark:bg-surface-900/80 p-4 shadow-sm backdrop-blur-2xl"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20"
      />

      <div
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-transform group-hover:scale-105"
        style={{
          background: c.bg,
          color: c.fg,
          border: `1px solid ${c.border}`,
          boxShadow: `0 4px 12px -6px ${c.glow}`,
        }}
      >
        <Icon paths={icon} size={20} strokeWidth={2.2} />
      </div>

      <div className="relative min-w-0 flex-1">
        <div className="text-[24px] font-black tracking-tight leading-none text-slate-900 dark:text-slate-100">
          <CountUp value={value} />
        </div>
        <div className="mt-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
          {label}
        </div>
      </div>
    </motion.div>
  );
}

/* ============================================================================
 * CURRICULUM ROW
 * ========================================================================== */

interface CurriculumRowProps {
  curriculum: Curriculum;
  onOpenSidecar: (c: Curriculum) => void;
  isFocused?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

const CurriculumRow = React.forwardRef<HTMLDivElement, CurriculumRowProps>(
  function CurriculumRow(
    {
      curriculum,
      onOpenSidecar,
      isFocused = false,
      isSelected = false,
      onToggleSelect,
    },
    ref,
  ) {
    const { t } = useSafeI18n();
    const { playTick, playPop } = usePremiumSound();
    const tone = curriculumTone(curriculum.name);
    const c = TONE[tone];
    const st = statusTone(curriculum.status);
    const sc = TONE[st];
    const moduleCount = curriculum._count?.modules || 0;
    const statusKey = `curriculum.status.${(curriculum.status || '').toUpperCase()}`;
    const statusLabel = t(statusKey, curriculum.status);

    return (
      <motion.div
        ref={ref}
        layout
        variants={rowVariants}
        whileHover={{ y: -2 }}
        transition={SPRING.snappy}
        onClick={() => {
          playPop();
          onOpenSidecar(curriculum);
        }}
        id={`curriculum-row-${curriculum.id}`}
        className={`liquid-glass-surface group relative flex flex-col gap-3.5 rounded-2xl border border-black/[0.08] dark:border-white/[0.12] bg-white/80 dark:bg-surface-900/80 p-4 shadow-sm backdrop-blur-2xl cursor-pointer transition-colors sm:flex-row sm:items-center ${
          isSelected
            ? 'ring-2 ring-blue-500 bg-blue-500/10'
            : isFocused
              ? 'ring-2 ring-blue-500/60'
              : 'hover:bg-slate-50/70 dark:hover:bg-white/[0.03]'
        }`}
      >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20"
      />

      {/* Left accent bar */}
      <span
        aria-hidden="true"
        className="absolute left-0 top-3.5 bottom-3.5 w-[3.5px] rounded-r-full"
        style={{ background: c.fg, boxShadow: `0 0 10px ${c.glow}` }}
      />

      {/* Row Selection checkbox (>= 44x44px touch target) */}
      {onToggleSelect && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            playTick();
            onToggleSelect();
          }}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0 cursor-pointer"
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => {}}
            className="h-4 w-4 rounded-md accent-blue-600 cursor-pointer"
            aria-label={`Select ${curriculum.name}`}
          />
        </div>
      )}

      {/* Icon tile */}
      <div
        className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
        style={{
          background: `linear-gradient(135deg, ${c.fg} 0%, ${c.fg}DD 100%)`,
          boxShadow: `0 6px 18px -4px ${c.glow}, inset 0 1px 0 rgba(255,255,255,0.4)`,
        }}
      >
        <Icon paths={I.bookOpen} size={22} strokeWidth={2.2} className="relative z-10" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 pl-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-[15px] font-black tracking-tight text-slate-900 dark:text-slate-100">
            {curriculum.name}
          </h3>

          {/* Version badge */}
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold tabular-nums uppercase tracking-wider"
            style={{
              background: c.bg,
              color: c.fg,
              border: `1px solid ${c.border}`,
            }}
          >
            <Icon paths={I.tag} size={9} strokeWidth={2.5} />
            v{curriculum.version}
          </span>

          {/* Status badge */}
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider"
            style={{
              background: sc.bg,
              color: sc.fg,
              border: `1px solid ${sc.border}`,
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: sc.fg, boxShadow: `0 0 6px ${sc.glow}` }}
            />
            {statusLabel}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
          {curriculum.subject ? (
            <span className="inline-flex items-center gap-1.5">
              <Icon paths={I.graduationCap} size={13} strokeWidth={2.2} className="opacity-70" />
              <span className="font-bold text-slate-700 dark:text-slate-300">
                {curriculum.subject.name}
              </span>
              {curriculum.subject.code && (
                <>
                  <span className="opacity-40">·</span>
                  <span className="font-mono text-[11px] font-bold uppercase">{curriculum.subject.code}</span>
                </>
              )}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 italic opacity-70">
              <Icon paths={I.graduationCap} size={13} strokeWidth={2} />
              {t('curriculum.noSubject', 'Fan biriktirilmagan')}
            </span>
          )}

          {/* Modules chip */}
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10.5px] font-bold"
            style={{
              background: 'rgba(0,122,255,0.08)',
              color: '#007AFF',
            }}
          >
            <Icon paths={I.layers} size={10} strokeWidth={2.5} />
            {moduleCount} {t('curriculum.modulesCount', 'ta modul')}
          </span>
        </div>
      </div>

      {/* Right side: Split-View Sidecar Trigger + Initials (>= 44x44px touch targets) */}
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            playPop();
            onOpenSidecar(curriculum);
          }}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-blue-600 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:text-blue-400 dark:hover:bg-white/[0.08] transition-colors"
          title="macOS Split-View Sidecar (Enter / e)"
          aria-label={t('common.sidecar', 'Split-view sidecar')}
        >
          <span className="text-[13px] leading-none">◨</span>
        </button>

        <div
          className="hidden sm:flex h-9 w-9 items-center justify-center rounded-xl text-[12px] font-black text-white shadow-sm"
          style={{
            background: `linear-gradient(135deg, ${c.fg} 0%, ${c.fg}CC 100%)`,
            boxShadow: `0 4px 12px -4px ${c.glow}, inset 0 1px 0 rgba(255,255,255,0.3)`,
          }}
        >
          {getInitials(curriculum.name)}
        </div>
      </div>
    </motion.div>
  );
});

/* ============================================================================
 * MAIN PAGE: CurriculumPage
 * ========================================================================== */

export function CurriculumPage() {
  const { t } = useSafeI18n();
  const queryClient = useQueryClient();
  const { playPop, playTick, playSuccess } = usePremiumSound();

  const [selectedSubject, setSelectedSubject] = useState('');
  const [name, setName] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAiStudioOpen, setIsAiStudioOpen] = useState(false);
  const [formErrors, setFormErrors] = useState<{ name?: string; subject?: string }>({});

  const filterSelectId = useId();
  const formSubjectId = useId();
  const formNameId = useId();

  /* ---------------- Data ---------------- */
  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => subjectsApi.list(),
  });

  const {
    data: curriculums,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['curriculums', selectedSubject],
    queryFn: () =>
      curriculumApi.list(selectedSubject ? { subjectId: selectedSubject } : undefined),
    placeholderData: (prev) => prev,
  });

  const list: Curriculum[] = useMemo(
    () => (Array.isArray(curriculums) ? curriculums : (curriculums as { items?: unknown[] })?.items ?? []),
    [curriculums],
  );

  /* ---------------- Derived Stats ---------------- */
  const stats = useMemo(() => computeCurriculumStats(list), [list]);

  /* ---------------- macOS Split-View Detail Sidecar ---------------- */
  const handleOpenCurriculumSidecar = useCallback(
    (curriculum: Curriculum) => {
      const data: QuickLookData = {
        id: curriculum.id,
        type: 'general',
        title: curriculum.name,
        subtitle: curriculum.subject
          ? `${curriculum.subject.name} (${curriculum.subject.code})`
          : t('curriculum.generalCurriculum', "Umumiy taʼlim rejasi"),
        badge: {
          text: curriculum.status,
          tone: curriculum.status === 'PUBLISHED' || curriculum.status === 'ACTIVE' ? 'emerald' : 'amber',
        },
        avatar: {
          text: getInitials(curriculum.name),
          color: '#6366F1',
        },
        metrics: [
          { label: 'Versiya', value: `v${curriculum.version}` },
          { label: 'Modullar soni', value: String(curriculum._count?.modules || 0) },
          { label: 'Fan', value: curriculum.subject?.name || t('curriculum.unassigned', 'Biriktirilmagan') },
          { label: 'Holati', value: curriculum.status },
        ],
        details: [
          { label: "O‘quv rejasi ID", value: curriculum.id, copyable: true },
          { label: 'Reja nomi', value: curriculum.name },
          { label: 'Fan kodi', value: curriculum.subject?.code || '—' },
          { label: 'Mavjud modullar', value: `${curriculum._count?.modules || 0} ta modul` },
        ],
        primaryAction: {
          label: "O‘quv rejasini tahrirlash",
          onExecute: () => {
            setIsModalOpen(true);
            setName(curriculum.name);
            if (curriculum.subject?.id) setSelectedSubject(curriculum.subject.id);
          },
        },
      };
      openSidecar(data);
    },
    [t],
  );

  /* ---------------- Keyboard Navigation ---------------- */
  const {
    focusedIndex,
    isSelected,
    toggleSelection,
  } = useListKeyboardNavigation<Curriculum>({
    items: list,
    getItemId: (c) => c.id,
    rowIdPrefix: 'curriculum-row-',
    onSelect: (c) => handleOpenCurriculumSidecar(c),
    onQuickLook: (c) => handleOpenCurriculumSidecar(c),
    onEdit: (c) => {
      setIsModalOpen(true);
      setName(c.name);
      if (c.subject?.id) setSelectedSubject(c.subject.id);
    },
  });

  /* ---------------- Keyboard listener for 'c' to create ---------------- */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'c' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        playPop();
        setIsModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playPop]);

  /* ---------------- Mutations ---------------- */
  const createMutation = useMutation({
    mutationFn: (data: { name: string; subjectId: string }) => curriculumApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['curriculums'] });
      setIsModalOpen(false);
      setName('');
      setFormErrors({});
      playSuccess();
    },
  });

  /* ---------------- Handlers ---------------- */
  const validate = useCallback(() => {
    const errors: { name?: string; subject?: string } = {};
    if (!name.trim()) errors.name = t('curriculum.validation.nameRequired', 'Reja nomini kiritish majburiy');
    if (!selectedSubject) errors.subject = t('curriculum.validation.subjectRequired', 'Fanni tanlash majburiy');
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [name, selectedSubject, t]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    createMutation.mutate({ name: name.trim(), subjectId: selectedSubject });
  };

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setName('');
    setFormErrors({});
    playPop();
  }, [playPop]);

  /* ---------------- Loading ---------------- */
  if (isLoading && !list.length) {
    return (
      <div className="relative page-container space-y-6 pb-[max(6rem,env(safe-area-inset-bottom))]">
        <AuroraBackdrop />
        <CurriculumSkeleton />
      </div>
    );
  }

  /* ---------------- Error ---------------- */
  if (isError) {
    return (
      <div className="relative page-container space-y-6 pb-[max(6rem,env(safe-area-inset-bottom))]">
        <AuroraBackdrop />
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING.smooth}
          className="liquid-glass-surface flex flex-col items-center gap-4 rounded-3xl border border-red-500/20 bg-white/80 dark:bg-surface-900/80 p-10 text-center shadow-md backdrop-blur-2xl"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
            <Icon paths={I.alertTriangle} size={28} strokeWidth={2.2} />
          </div>
          <div>
            <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {t('curriculum.loadErrorTitle', "O‘quv rejalarini yuklab bo‘lmadi")}
            </h3>
            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
              {(error as Error)?.message || t('common.error', 'Xatolik yuz berdi')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              playTick();
              void refetch();
            }}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:bg-blue-700 active:scale-95"
          >
            <Icon paths={I.refresh} size={14} strokeWidth={2.4} />
            {t('common.retry', 'Qayta urinish')}
          </button>
        </motion.div>
      </div>
    );
  }

  /* ---------------- Main View ---------------- */
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="relative page-container space-y-6 pb-[max(6rem,env(safe-area-inset-bottom))]"
    >
      <AuroraBackdrop />

      {/* HERO (Apple Liquid Glass Header) */}
      <motion.div variants={cardVariants}>
        <div className="liquid-glass-surface relative overflow-hidden rounded-3xl border border-black/[0.08] dark:border-white/[0.12] bg-white/80 dark:bg-surface-900/80 p-6 sm:p-8 shadow-md backdrop-blur-2xl">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20 z-10"
          />

          <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            {/* Hero icon */}
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg sm:h-20 sm:w-20">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-white/30 to-transparent"
              />
              <Icon paths={I.clipboard} size={32} strokeWidth={2.2} className="relative z-10" />
            </div>

            {/* Text */}
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold tracking-tight"
                  style={{
                    background: TONE.green.bg,
                    color: TONE.green.fg,
                    border: `1px solid ${TONE.green.border}`,
                    boxShadow: `0 4px 12px -6px ${TONE.green.glow}`,
                  }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: TONE.green.fg, boxShadow: `0 0 6px ${TONE.green.glow}` }}
                  />
                  {stats.published} {t('curriculum.badge.published', "Faol o‘quv rejalari")}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-black/5 bg-slate-100/70 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                  <Icon paths={I.layers} size={10} strokeWidth={2.5} />
                  {stats.total} {t('curriculum.badge.total', 'Jami')}
                </span>
                {stats.modules > 0 && (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
                    style={{
                      background: TONE.blue.bg,
                      color: TONE.blue.fg,
                      border: `1px solid ${TONE.blue.border}`,
                    }}
                  >
                    <Icon paths={I.bookOpen} size={10} strokeWidth={2.5} />
                    {stats.modules} {t('curriculum.badge.modules', 'Modullar')}
                  </span>
                )}
              </div>

              <h1 className="mt-2.5 text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">
                {t('curriculum.heroTitle', "O‘quv rejalari va sillabus")}
              </h1>
              <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                {t('curriculum.heroSubtitle', "Fanlar bo‘yicha bosqichma-bosqich o‘quv rejalari, mavzular va dars modullarini boshqaring")}
              </p>
            </div>

            {/* Actions (>= 44x44px touch target) */}
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  playPop();
                  setIsAiStudioOpen(true);
                }}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 px-5 py-2.5 text-xs font-bold shadow-sm transition-all active:scale-95"
              >
                <span className="text-sm">✨</span>
                {t('curriculum.aiLessonStudio', 'AI Dars & Test Generatori')}
              </button>
              <button
                type="button"
                onClick={() => {
                  playPop();
                  setIsModalOpen(true);
                }}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:opacity-95 active:scale-95"
              >
                <Icon paths={I.plus} size={15} strokeWidth={2.5} />
                {t('curriculum.create', 'Yangi reja yaratish')}
                <kbd className="hidden sm:inline rounded-md bg-white/20 px-1.5 py-0.5 text-[10px] font-mono">
                  C
                </kbd>
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* STATS (Liquid Glass Cards) */}
      <motion.div variants={containerVariants} className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        <StatTile
          label={t('curriculum.stat.total', 'Jami rejalar')}
          value={stats.total}
          icon={I.clipboard}
          tone="purple"
        />
        <StatTile
          label={t('curriculum.stat.published', 'Nashr etilgan')}
          value={stats.published}
          icon={I.checkCircle}
          tone="green"
        />
        <StatTile
          label={t('curriculum.stat.drafts', 'Qoralamalar')}
          value={stats.drafts}
          icon={I.pencil}
          tone="orange"
        />
        <StatTile
          label={t('curriculum.stat.modules', 'Jami modullar')}
          value={stats.modules}
          icon={I.layers}
          tone="blue"
        />
      </motion.div>

      {/* FILTER & KEYBOARD BAR */}
      <motion.div variants={cardVariants} className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between">
        <div className="liquid-glass-surface flex min-h-[44px] items-center gap-2 rounded-2xl px-3.5 py-1.5 border border-black/[0.08] dark:border-white/[0.12] bg-white/80 dark:bg-surface-900/80 shadow-sm backdrop-blur-2xl">
          <label htmlFor={filterSelectId} className="text-slate-500 dark:text-slate-400">
            <Icon paths={I.graduationCap} size={16} strokeWidth={2.2} />
          </label>
          <select
            id={filterSelectId}
            value={selectedSubject}
            onChange={(e) => {
              playTick();
              setSelectedSubject(e.target.value);
            }}
            className="bg-transparent text-xs font-bold text-slate-800 outline-none dark:text-slate-200 cursor-pointer min-h-[36px] max-w-full truncate"
            aria-label={t('curriculum.filterAria', "Fan bo‘yicha filtrlash")}
          >
            <option value="">{t('curriculum.allSubjects', 'Barcha fanlar')}</option>
            {subjects?.items?.map((s: any) => (
              <option key={s.id} value={s.id} className="dark:bg-surface-900">
                {s.name} ({s.code})
              </option>
            ))}
          </select>

          {selectedSubject && (
            <button
              type="button"
              onClick={() => {
                playTick();
                setSelectedSubject('');
              }}
              aria-label={t('common.clear', 'Tozalash')}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-xs font-bold text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
            >
              ✕
            </button>
          )}
        </div>

        {/* Keyboard hints pill */}
        <div className="hidden sm:flex items-center gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          <span className="rounded-md border border-black/10 bg-black/5 px-1.5 py-0.5 font-mono text-[10px] dark:border-white/10 dark:bg-white/5">
            J / K
          </span>
          <span>{t('curriculum.hintMove', 'Harakat')}</span>
          <span className="rounded-md border border-black/10 bg-black/5 px-1.5 py-0.5 font-mono text-[10px] dark:border-white/10 dark:bg-white/5">
            ↵ / E
          </span>
          <span>{t('curriculum.hintSidecar', 'Sidecar')}</span>
          <span className="rounded-md border border-black/10 bg-black/5 px-1.5 py-0.5 font-mono text-[10px] dark:border-white/10 dark:bg-white/5">
            X
          </span>
          <span>{t('curriculum.hintSelect', 'Tanlash')}</span>
        </div>
      </motion.div>

      {/* CURRICULUM LIST */}
      <motion.div variants={cardVariants}>
        <div className="liquid-glass-surface relative overflow-hidden rounded-3xl border border-black/[0.08] dark:border-white/[0.12] bg-white/80 dark:bg-surface-900/80 p-5 sm:p-6 shadow-md backdrop-blur-2xl">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20"
          />

          <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
                <Icon paths={I.clipboard} size={16} strokeWidth={2.2} />
              </div>
              <div>
                <h2 className="text-sm font-black tracking-tight text-slate-900 dark:text-slate-100">
                  {t('curriculum.listTitle', "O‘quv rejalari ro‘yxati")}
                </h2>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {list.length} {t('curriculum.countSuffix', 'ta reja mavjud')}
                </p>
              </div>
            </div>
          </div>

          <div>
            {list.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500">
                  <Icon paths={I.clipboard} size={26} strokeWidth={2.2} />
                </div>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {selectedSubject
                    ? t('curriculum.emptyFilteredTitle', "Bu fan bo‘yicha o‘quv reja topilmadi")
                    : t('curriculum.emptyTitle', "Hozircha o‘quv rejalari mavjud emas")}
                </p>
                <p className="max-w-sm text-xs font-medium text-slate-500 dark:text-slate-400">
                  {selectedSubject
                    ? t('curriculum.emptyFilteredHint', "Boshqa fanni tanlang yoki ushbu fan uchun yangi reja yarating")
                    : t('curriculum.emptyHint', "Darslik va kurslar uchun yangi o‘quv dasturini shakllantiring")}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    playPop();
                    setIsModalOpen(true);
                  }}
                  className="min-h-[44px] mt-2 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-indigo-700 active:scale-95"
                >
                  <Icon paths={I.plus} size={14} strokeWidth={2.5} />
                  {t('curriculum.create', 'Yangi reja yaratish')}
                </button>
              </div>
            ) : (
              <motion.div layout className="space-y-3">
                <AnimatePresence initial={false} mode="popLayout">
                  {list.map((c, idx) => (
                    <CurriculumRow
                      key={c.id}
                      curriculum={c}
                      onOpenSidecar={handleOpenCurriculumSidecar}
                      isFocused={focusedIndex === idx}
                      isSelected={isSelected(c.id)}
                      onToggleSelect={() => toggleSelection(c.id)}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>

      {/* CREATE MODAL (WCAG >= 44x44px Touch Targets) */}
      {typeof document !== 'undefined'
        ? createPortal(
            <AnimatePresence>
              {isModalOpen && (
                <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseModal}
              className="fixed inset-0 bg-black/45 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              transition={SPRING.smooth}
              onClick={(e) => e.stopPropagation()}
              className="liquid-glass-surface relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-black/[0.08] dark:border-white/[0.12] bg-white/90 dark:bg-surface-900/90 p-6 shadow-2xl backdrop-blur-3xl dark:text-white"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20"
              />

              {/* Header hint */}
              <div className="flex items-center gap-3 rounded-2xl border border-indigo-500/20 bg-indigo-500/10 p-3 mb-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-500">
                  <Icon paths={I.sparkles} size={18} strokeWidth={2.2} />
                </div>
                <p className="text-xs font-semibold leading-snug">
                  {t('curriculum.createHint', "Yangi o‘quv rejasiga nom bering va uni tegishli fanga biriktiring.")}
                </p>
              </div>

              <form onSubmit={handleCreate} className="space-y-4" noValidate>
                <div>
                  <label
                    htmlFor={formSubjectId}
                    className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                  >
                    {t('curriculum.form.subject', 'Fan')} <span className="text-red-500">*</span>
                  </label>
                  <select
                    id={formSubjectId}
                    required
                    value={selectedSubject}
                    onChange={(e) => {
                      setSelectedSubject(e.target.value);
                      setFormErrors((p) => ({ ...p, subject: undefined }));
                    }}
                    aria-invalid={Boolean(formErrors.subject)}
                    className="min-h-[44px] w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-2 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-surface-800/80 dark:text-white"
                  >
                    <option value="">{t('curriculum.form.chooseSubject', 'Fanni tanlang')}</option>
                    {subjects?.items?.map((s: any) => (
                      <option key={s.id} value={s.id} className="dark:bg-surface-900">
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                  {formErrors.subject && (
                    <p className="mt-1 text-xs font-semibold text-red-500">{formErrors.subject}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor={formNameId}
                    className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                  >
                    {t('curriculum.form.name', 'Reja nomi')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    id={formNameId}
                    type="text"
                    required
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setFormErrors((p) => ({ ...p, name: undefined }));
                    }}
                    placeholder={t('curriculum.form.namePlaceholder', 'Masalan: Ingliz tili B2 Intensive')}
                    aria-invalid={Boolean(formErrors.name)}
                    className="min-h-[44px] w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-2 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-surface-800/80 dark:text-white"
                  />
                  {formErrors.name && (
                    <p className="mt-1 text-xs font-semibold text-red-500">{formErrors.name}</p>
                  )}
                </div>

                <div className="flex justify-end gap-2.5 pt-3">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    disabled={createMutation.isPending}
                    className="min-h-[44px] rounded-xl border border-black/5 bg-slate-100 px-5 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-200 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                  >
                    {t('common.cancel', 'Bekor qilish')}
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-indigo-700 active:scale-95 disabled:opacity-70"
                  >
                    {createMutation.isPending ? (
                      <>
                        <motion.span
                          className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                        />
                        {t('common.saving', 'Saqlanmoqda...')}
                      </>
                    ) : (
                      <>
                        <Icon paths={I.plus} size={14} strokeWidth={2.5} />
                        {t('curriculum.create', 'Yaratish')}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
                </div>
              )}
            </AnimatePresence>,
            document.body
          )
        : null}

      {/* Gemini 3 AI Pedagogical Lesson Studio Modal */}
      <GlassModal
        open={isAiStudioOpen}
        onClose={() => setIsAiStudioOpen(false)}
        size="xl"
        title="Gemini 3 Pedagogik Dars Rejasi & Test Generatori"
      >
        <AiLessonPlanStudio onClose={() => setIsAiStudioOpen(false)} />
      </GlassModal>
    </motion.div>
  );
}

export default CurriculumPage;
