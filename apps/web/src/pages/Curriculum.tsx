/**
 * ============================================================================
 * M-EDU CurriculumPage — Apple Design Award Edition (macOS Sequoia & Liquid Glass)
 * ============================================================================
 *
 * Senior craft:
 *  - Apple Liquid Glass materials (.liquid-glass-surface, .liquid-glass-card)
 *  - Real-time tunable optics (--liquid-glass-opacity, --liquid-glass-blur)
 *  - macOS Split-View Detail Sidecar (`openSidecar` with modules & syllabus metrics)
 *  - Superhuman keyboard-first navigation (j/k, x, Enter, c to create)
 *  - Web Audio tactile haptics (playTick, playPop, playSuccess)
 *  - Shimmer skeletons with sub-pixel specular rim reflections
 *  - macOS segmented subject filter pills
 * ============================================================================
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { curriculumApi, subjectsApi } from '@/lib/api';
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
 * TYPES
 * ========================================================================== */

export interface Subject {
  id: string;
  code: string;
  name: string;
}

interface Curriculum {
  id: string;
  name: string;
  version: number;
  status: string;
  subject?: { id: string; name: string; code: string } | null;
  _count?: { modules?: number };
}

/* ============================================================================
 * TONE PALETTES
 * ========================================================================== */

type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'slate';

const TONE: Record<Tone, { fg: string; bg: string; glow: string; border: string }> = {
  blue:   { fg: '#007AFF', bg: 'rgba(0,122,255,0.10)',  glow: 'rgba(0,122,255,0.28)',  border: 'rgba(0,122,255,0.22)' },
  green:  { fg: '#34C759', bg: 'rgba(52,199,89,0.10)',   glow: 'rgba(52,199,89,0.28)',   border: 'rgba(52,199,89,0.22)' },
  orange: { fg: '#FF9500', bg: 'rgba(255,149,0,0.10)',   glow: 'rgba(255,149,0,0.28)',   border: 'rgba(255,149,0,0.22)' },
  red:    { fg: '#FF3B30', bg: 'rgba(255,59,48,0.10)',   glow: 'rgba(255,59,48,0.28)',   border: 'rgba(255,59,48,0.22)' },
  purple: { fg: '#AF52DE', bg: 'rgba(175,82,222,0.10)',  glow: 'rgba(175,82,222,0.28)',  border: 'rgba(175,82,222,0.22)' },
  slate:  { fg: '#8E8E93', bg: 'rgba(142,142,147,0.10)', glow: 'rgba(142,142,147,0.28)', border: 'rgba(142,142,147,0.22)' },
};

function statusTone(status: string): Tone {
  const s = status?.toUpperCase() || '';
  if (s === 'PUBLISHED' || s === 'ACTIVE') return 'green';
  if (s === 'DRAFT') return 'orange';
  if (s === 'ARCHIVED' || s === 'INACTIVE') return 'slate';
  if (s === 'REVIEW') return 'blue';
  return 'purple';
}

/* ============================================================================
 * CUSTOM ICONS (SF Symbols proportions)
 * ========================================================================== */

const ICON_STROKE = 1.75;

const I = {
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
  fileText: [
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'M14 2v6h6',
    'M16 13H8', 'M16 17H8', 'M10 9H8',
  ],
  pencil: [
    'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
    'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  ],
  archive: [
    'M21 8v13H3V8',
    'M1 3h22v5H1z',
    'M10 12h4',
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
  hash: [
    'M4 9h16', 'M4 15h16',
    'M10 3 8 21', 'M16 3l-2 18',
  ],
  clipboard: [
    'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2',
    'M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z',
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
 * HELPERS
 * ========================================================================== */

function codeHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const CURRICULUM_PALETTES: Tone[] = ['blue', 'purple', 'green', 'orange', 'red', 'slate'];

function curriculumTone(name: string): Tone {
  return CURRICULUM_PALETTES[codeHash(name) % CURRICULUM_PALETTES.length];
}

function getInitials(name: string): string {
  return (name
    .split(/\s+/)
    .map((p) => p.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || '—');
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

function CurriculumSkeleton() {
  return (
    <div className="space-y-5">
      <Shimmer className="h-40 w-full" radius="1.75rem" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <Shimmer key={i} className="h-[74px]" radius="1.25rem" />)}
      </div>
      <Shimmer className="h-14" radius="1rem" />
      <div className="space-y-2.5">
        {[1, 2, 3, 4].map((i) => <Shimmer key={i} className="h-24" radius="1.25rem" />)}
      </div>
    </div>
  );
}

/* ============================================================================
 * STAT TILE (Liquid Glass Substrate)
 * ========================================================================== */

function StatTile({
  label, value, icon, tone = 'blue',
}: { label: string; value: number; icon: string[]; tone?: Tone }) {
  const c = TONE[tone];
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
 * CURRICULUM ROW
 * ========================================================================== */

function CurriculumRow({
  curriculum,
  onOpenSidecar,
  isFocused = false,
  isSelected = false,
  onToggleSelect,
}: {
  curriculum: Curriculum;
  onOpenSidecar: (c: Curriculum) => void;
  isFocused?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}) {
  const { t } = useI18n();
  const { playTick, playPop } = usePremiumSound();
  const tone = curriculumTone(curriculum.name);
  const c = TONE[tone];
  const st = statusTone(curriculum.status);
  const sc = TONE[st];
  const moduleCount = curriculum._count?.modules || 0;
  const statusKey = `curriculum.status.${(curriculum.status || '').toUpperCase()}`;
  const statusLabel = t(statusKey);
  const statusText = statusLabel === statusKey ? curriculum.status : statusLabel;

  return (
    <motion.div
      layout
      variants={rowVariants}
      whileHover={{ y: -2 }}
      transition={SPRING.snappy}
      onClick={() => {
        playPop();
        onOpenSidecar(curriculum);
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
        <Icon paths={I.bookOpen} size={22} strokeWidth={2} className="relative z-10" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 pl-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-[15px] font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
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
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
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
            {statusText}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
          {curriculum.subject ? (
            <span className="inline-flex items-center gap-1.5">
              <Icon paths={I.graduationCap} size={13} strokeWidth={2} className="opacity-70" />
              <span className="font-semibold text-neutral-700 dark:text-neutral-300">
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
              {t('curriculum.noSubject')}
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
            {t(moduleCount === 1 ? 'curriculum.moduleOne' : 'curriculum.moduleMany', { count: moduleCount })}
          </span>
        </div>
      </div>

      {/* Right side: Split-View Sidecar Trigger + Initials */}
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            playPop();
            onOpenSidecar(curriculum);
          }}
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-black/5 bg-white/70 text-xs font-bold text-neutral-600 transition-all hover:border-black/20 hover:bg-white hover:text-black hover:shadow-xs active:scale-95 dark:border-white/10 dark:bg-white/5 dark:text-neutral-400 dark:hover:border-white/20 dark:hover:bg-white/10 dark:hover:text-white"
          title="macOS Split-View Sidecar (Enter / e)"
          aria-label="Split-View Sidecar"
        >
          ◨
        </button>

        <div
          className="hidden sm:flex h-9 w-9 items-center justify-center rounded-xl text-[12px] font-bold text-white shadow-xs"
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
}

/* ============================================================================
 * MAIN PAGE
 * ========================================================================== */

export default function CurriculumPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { playPop, playTick, playSuccess } = usePremiumSound();

  const [selectedSubject, setSelectedSubject] = useState('');
  const [name, setName] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formErrors, setFormErrors] = useState<{ name?: string; subject?: string }>({});

  /* ---------------- Data ---------------- */
  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => subjectsApi.list(),
  });

  const {
    data: curriculums, isLoading, isError, error, refetch,
  } = useQuery({
    queryKey: ['curriculums', selectedSubject],
    queryFn: () =>
      curriculumApi.list(selectedSubject ? { subjectId: selectedSubject } : undefined),
    placeholderData: (prev) => prev,
  });

  const list: Curriculum[] = useMemo(
    () => (Array.isArray(curriculums) ? curriculums : (curriculums as any)?.items ?? []),
    [curriculums],
  );

  /* ---------------- Derived Stats ---------------- */
  const stats = useMemo(() => {
    const total = list.length;
    const published = list.filter((c) =>
      ['PUBLISHED', 'ACTIVE'].includes(c.status?.toUpperCase() || ''),
    ).length;
    const drafts = list.filter((c) => c.status?.toUpperCase() === 'DRAFT').length;
    const modules = list.reduce((sum, c) => sum + (c._count?.modules || 0), 0);
    return { total, published, drafts, modules };
  }, [list]);

  /* ---------------- macOS Split-View Detail Sidecar ---------------- */
  const handleOpenCurriculumSidecar = useCallback((curriculum: Curriculum) => {
    const data: QuickLookData = {
      id: curriculum.id,
      type: 'general',
      title: curriculum.name,
      subtitle: curriculum.subject
        ? `${curriculum.subject.name} (${curriculum.subject.code})`
        : 'Umumiy ta\'lim rejasi',
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
        { label: 'Fan', value: curriculum.subject?.name || 'Biriktirilmagan' },
        { label: 'Holati', value: curriculum.status },
      ],
      details: [
        { label: 'O\'quv rejasi ID', value: curriculum.id, copyable: true },
        { label: 'Reja nomi', value: curriculum.name },
        { label: 'Fan kodi', value: curriculum.subject?.code || '—' },
        { label: 'Mavjud modullar', value: `${curriculum._count?.modules || 0} ta modul` },
      ],
      primaryAction: {
        label: 'O\'quv rejasini tahrirlash',
        onExecute: () => {
          setIsModalOpen(true);
          setName(curriculum.name);
          if (curriculum.subject?.id) setSelectedSubject(curriculum.subject.id);
        },
      },
    };
    openSidecar(data);
  }, []);

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
    if (!name.trim()) errors.name = t('curriculum.validation.nameRequired');
    if (!selectedSubject) errors.subject = t('curriculum.validation.subjectRequired');
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
      <div className="page-container space-y-5">
        <CurriculumSkeleton />
      </div>
    );
  }

  /* ---------------- Error ---------------- */
  if (isError) {
    return (
      <div className="page-container space-y-5">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING.smooth}
          className="liquid-glass-card flex flex-col items-center gap-4 p-10 text-center border-red-500/20"
        >
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-500"
          >
            <Icon paths={I.alertTriangle} size={28} strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-lg font-bold tracking-tight text-neutral-900 dark:text-white">
              {t('curriculum.loadErrorTitle')}
            </h3>
            <p className="mt-1 text-sm font-medium text-neutral-500 dark:text-neutral-400">
              {(error as Error)?.message || t('common.error')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              playTick();
              void refetch();
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:bg-blue-700 active:scale-95"
          >
            <Icon paths={I.refresh} size={14} strokeWidth={2.4} />
            {t('common.retry')}
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
      className="page-container space-y-5"
    >
      {/* HERO (Apple Liquid Glass Header) */}
      <motion.div variants={cardVariants}>
        <div className="liquid-glass-surface rounded-3xl p-6 sm:p-8">
          <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            {/* Hero icon */}
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md sm:h-20 sm:w-20">
              <Icon paths={I.clipboard} size={32} strokeWidth={2} className="relative z-10" />
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
                  {t('curriculum.badge.published', { count: stats.published })}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-black/5 bg-neutral-100/70 px-2.5 py-1 text-[11px] font-semibold text-neutral-600 dark:border-white/10 dark:bg-white/5 dark:text-neutral-400">
                  <Icon paths={I.layers} size={10} strokeWidth={2.5} />
                  {t('curriculum.badge.total', { count: stats.total })}
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
                    {t('curriculum.badge.modules', { count: stats.modules })}
                  </span>
                )}
              </div>

              <h1 className="mt-2.5 text-3xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-4xl">
                {t('curriculum.heroTitle')}
              </h1>
              <p className="mt-1 text-sm font-medium text-neutral-500 dark:text-neutral-400">
                {t('curriculum.heroSubtitle')}
              </p>
            </div>

            {/* Actions */}
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  playPop();
                  setIsModalOpen(true);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-xs font-bold text-white shadow-md transition-all hover:opacity-95 active:scale-95"
              >
                <Icon paths={I.plus} size={15} strokeWidth={2.5} />
                {t('curriculum.create')}
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
        <StatTile label={t('curriculum.stat.total')} value={stats.total} icon={I.clipboard} tone="purple" />
        <StatTile label={t('curriculum.stat.published')} value={stats.published} icon={I.checkCircle} tone="green" />
        <StatTile label={t('curriculum.stat.drafts')} value={stats.drafts} icon={I.pencil} tone="orange" />
        <StatTile label={t('curriculum.stat.modules')} value={stats.modules} icon={I.layers} tone="blue" />
      </motion.div>

      {/* FILTER & KEYBOARD BAR */}
      <motion.div variants={cardVariants} className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between">
        <div className="liquid-glass-surface flex items-center gap-2 rounded-2xl px-3 py-2 border border-black/5 dark:border-white/10">
          <span className="text-neutral-500">
            <Icon paths={I.graduationCap} size={16} strokeWidth={2.2} />
          </span>
          <select
            value={selectedSubject}
            onChange={(e) => {
              playTick();
              setSelectedSubject(e.target.value);
            }}
            className="bg-transparent text-xs font-bold text-neutral-800 outline-none dark:text-neutral-200 cursor-pointer"
            aria-label={t('curriculum.filterAria')}
          >
            <option value="">{t('curriculum.allSubjects')}</option>
            {subjects?.items?.map((s: any) => (
              <option key={s.id} value={s.id} className="dark:bg-zinc-900">
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
              className="ml-2 text-[11px] font-bold text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
            >
              ✕
            </button>
          )}
        </div>

        {/* Keyboard hints pill */}
        <div className="hidden sm:flex items-center gap-2 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
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
      </motion.div>

      {/* CURRICULUM LIST */}
      <motion.div variants={cardVariants}>
        <div className="liquid-glass-card p-4 sm:p-5">
          <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-black/5 dark:border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
                <Icon paths={I.clipboard} size={16} strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-sm font-bold tracking-tight text-neutral-900 dark:text-white">
                  {t('curriculum.listTitle')}
                </h2>
                <p className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                  {t(list.length === 1 ? 'curriculum.countOne' : 'curriculum.countMany', { count: list.length })}
                </p>
              </div>
            </div>
          </div>

          <div>
            {list.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500">
                  <Icon paths={I.clipboard} size={26} strokeWidth={2} />
                </div>
                <p className="text-sm font-bold text-neutral-900 dark:text-white">
                  {selectedSubject ? t('curriculum.emptyFilteredTitle') : t('curriculum.emptyTitle')}
                </p>
                <p className="max-w-sm text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  {selectedSubject
                    ? t('curriculum.emptyFilteredHint')
                    : t('curriculum.emptyHint')}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    playPop();
                    setIsModalOpen(true);
                  }}
                  className="mt-2 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-indigo-700 active:scale-95"
                >
                  <Icon paths={I.plus} size={14} strokeWidth={2.5} />
                  {t('curriculum.create')}
                </button>
              </div>
            ) : (
              <motion.div layout className="space-y-2.5">
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

      {/* CREATE MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
              className="liquid-glass-surface relative z-10 w-full max-w-md overflow-hidden rounded-3xl p-6 shadow-2xl dark:text-white"
            >
              {/* Header hint */}
              <div className="flex items-center gap-3 rounded-2xl border border-indigo-500/20 bg-indigo-500/10 p-3 mb-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-500">
                  <Icon paths={I.sparkles} size={18} strokeWidth={2} />
                </div>
                <p className="text-xs font-semibold leading-snug">
                  {t('curriculum.createHint')}
                </p>
              </div>

              <form onSubmit={handleCreate} className="space-y-4" noValidate>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    {t('curriculum.form.subject')} <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={selectedSubject}
                    onChange={(e) => {
                      setSelectedSubject(e.target.value);
                      setFormErrors((p) => ({ ...p, subject: undefined }));
                    }}
                    aria-invalid={Boolean(formErrors.subject)}
                    className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-2.5 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
                  >
                    <option value="">{t('curriculum.form.chooseSubject')}</option>
                    {subjects?.items?.map((s: any) => (
                      <option key={s.id} value={s.id} className="dark:bg-zinc-900">
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                  {formErrors.subject && (
                    <p className="mt-1 text-xs font-medium text-red-500">{formErrors.subject}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    {t('curriculum.form.name')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setFormErrors((p) => ({ ...p, name: undefined }));
                    }}
                    placeholder={t('curriculum.form.namePlaceholder')}
                    aria-invalid={Boolean(formErrors.name)}
                    className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-2.5 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
                  />
                  {formErrors.name && (
                    <p className="mt-1 text-xs font-medium text-red-500">{formErrors.name}</p>
                  )}
                </div>

                <div className="flex justify-end gap-2.5 pt-3">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    disabled={createMutation.isPending}
                    className="rounded-xl border border-black/5 bg-neutral-100 px-4 py-2 text-xs font-bold text-neutral-700 transition-colors hover:bg-neutral-200 dark:border-white/10 dark:bg-white/5 dark:text-neutral-300 dark:hover:bg-white/10"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-indigo-700 active:scale-95 disabled:opacity-70"
                  >
                    {createMutation.isPending ? (
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
                        <Icon paths={I.plus} size={14} strokeWidth={2.5} />
                        {t('curriculum.create')}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}