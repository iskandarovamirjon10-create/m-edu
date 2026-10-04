/**
 * M-EDU CurriculumPage — Apple Design Award Edition
 *
 * Premium craft:
 *  - Hero with animated book icon + status chips
 *  - Stats bar (Total, Published, Drafts, Modules) with CountUp
 *  - Subject filter as segmented pills
 *  - Premium curriculum rows with version badges + module chips
 *  - Custom SVG icons in SF Symbols proportions
 *  - Shimmer skeletons (not pulse)
 *  - Tone-aware status colors
 *  - Framer Motion spring physics + stagger
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { curriculumApi, subjectsApi } from '../lib/api';

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
  hidden: { opacity: 0, y: 16, filter: 'blur(8px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: SPRING.smooth },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, x: -10, filter: 'blur(6px)' },
  visible: { opacity: 1, x: 0, filter: 'blur(0px)', transition: SPRING.smooth },
  exit:   { opacity: 0, x: 20, filter: 'blur(6px)', transition: { duration: 0.22 } },
};

/* ============================================================================
 * REDUCED MOTION
 * ========================================================================== */

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

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
  return (
    name
      .split(/\s+/)
      .map((p) => p.charAt(0))
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '—'
  );
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

function CurriculumSkeleton() {
  return (
    <div className="space-y-5">
      <Shimmer className="h-40 w-full" radius="2rem" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <Shimmer key={i} className="h-[68px]" radius="1rem" />)}
      </div>
      <Shimmer className="h-16" radius="1rem" />
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => <Shimmer key={i} className="h-20" radius="1rem" />)}
      </div>
    </div>
  );
}

/* ============================================================================
 * STAT TILE
 * ========================================================================== */

function StatTile({
  label, value, icon, tone = 'blue',
}: { label: string; value: number; icon: string[]; tone?: Tone }) {
  const c = TONE[tone];

  return (
    <motion.div
      variants={rowVariants}
      whileHover={{ y: -3 }}
      transition={SPRING.smooth}
      className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-[#ffffff60] bg-[#ffffff80] px-4 py-3 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
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
          border: `1px solid ${c.border}`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5), 0 4px 12px -6px ${c.glow}`,
        }}
      >
        <Icon paths={icon} size={18} strokeWidth={2} />
      </div>
      <div className="relative min-w-0 flex-1">
        <div className="text-[22px] font-bold tracking-tighter leading-none text-[#1D1D1F] dark:text-[#F5F5F7]">
          <CountUp value={value} />
        </div>
        <div className="mt-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#86868B] truncate">
          {label}
        </div>
      </div>
    </motion.div>
  );
}

/* ============================================================================
 * CURRICULUM ROW
 * ========================================================================== */

function CurriculumRow({ curriculum }: { curriculum: Curriculum }) {
  const tone = curriculumTone(curriculum.name);
  const c = TONE[tone];
  const st = statusTone(curriculum.status);
  const sc = TONE[st];
  const moduleCount = curriculum._count?.modules || 0;

  return (
    <motion.div
      layout
      variants={rowVariants}
      whileHover={{ y: -2 }}
      transition={SPRING.snappy}
      className="group relative flex flex-col gap-3 rounded-2xl border border-[#00000008] bg-[#00000002] p-4 transition-all hover:border-[#007AFF]/25 hover:bg-[#007AFF]/[0.02] dark:border-[#ffffff08] dark:bg-[#ffffff04] sm:flex-row sm:items-center"
    >
      {/* Left accent bar */}
      <span
        aria-hidden
        className="absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full"
        style={{ background: c.fg, boxShadow: `0 0 8px ${c.glow}` }}
      />

      {/* Icon tile */}
      <div
        className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white"
        style={{
          background: `linear-gradient(135deg, ${c.fg} 0%, ${c.fg}CC 100%)`,
          boxShadow: `0 6px 16px -6px ${c.glow}, inset 0 1px 0 rgba(255,255,255,0.35)`,
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.4), transparent 55%)' }}
        />
        <Icon paths={I.bookOpen} size={20} strokeWidth={2} className="relative" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 pl-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-[14.5px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
            {curriculum.name}
          </h3>

          {/* Version badge */}
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums uppercase tracking-wider"
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
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
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
            {curriculum.status}
          </span>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] font-medium text-[#86868B]">
          {curriculum.subject ? (
            <span className="inline-flex items-center gap-1">
              <Icon paths={I.graduationCap} size={11} strokeWidth={2} className="opacity-70" />
              {curriculum.subject.name}
              {curriculum.subject.code && (
                <>
                  <span className="opacity-40">·</span>
                  <span className="font-bold tracking-wider">{curriculum.subject.code}</span>
                </>
              )}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 italic opacity-70">
              <Icon paths={I.graduationCap} size={11} strokeWidth={2} />
              No subject linked
            </span>
          )}

          {/* Modules chip */}
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{
              background: 'rgba(0,122,255,0.08)',
              color: '#007AFF',
            }}
          >
            <Icon paths={I.layers} size={9} strokeWidth={2.5} />
            {moduleCount} {moduleCount === 1 ? 'module' : 'modules'}
          </span>
        </div>
      </div>

      {/* Right side: initials */}
      <div className="hidden shrink-0 flex-col items-end sm:flex">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl text-[12px] font-bold text-white"
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
  const queryClient = useQueryClient();
  const reduced = usePrefersReducedMotion();

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

  /* ---------------- Derived ---------------- */
  const stats = useMemo(() => {
    const total = list.length;
    const published = list.filter((c) =>
      ['PUBLISHED', 'ACTIVE'].includes(c.status?.toUpperCase() || ''),
    ).length;
    const drafts = list.filter((c) => c.status?.toUpperCase() === 'DRAFT').length;
    const modules = list.reduce((sum, c) => sum + (c._count?.modules || 0), 0);
    return { total, published, drafts, modules };
  }, [list]);

  /* ---------------- Mutations ---------------- */
  const createMutation = useMutation({
    mutationFn: (data: { name: string; subjectId: string }) => curriculumApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['curriculums'] });
      setIsModalOpen(false);
      setName('');
      setFormErrors({});
    },
  });

  /* ---------------- Handlers ---------------- */
  const validate = useCallback(() => {
    const errors: { name?: string; subject?: string } = {};
    if (!name.trim()) errors.name = 'Name is required';
    if (!selectedSubject) errors.subject = 'Please select a subject';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [name, selectedSubject]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    createMutation.mutate({ name: name.trim(), subjectId: selectedSubject });
  };

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setName('');
    setFormErrors({});
  }, []);

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
          className="flex flex-col items-center gap-4 rounded-3xl border p-10 text-center"
          style={{
            borderColor: 'rgba(255,59,48,0.2)',
            background: 'rgba(255,59,48,0.04)',
          }}
        >
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: 'rgba(255,59,48,0.12)', color: '#FF3B30' }}
          >
            <Icon paths={I.alertTriangle} size={26} strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-[17px] font-bold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
              Failed to load curriculums
            </h3>
            <p className="mt-1 text-[13px] font-medium text-[#86868B]">
              {(error as Error)?.message || 'Something went wrong'}
            </p>
          </div>
          <motion.button
            type="button"
            onClick={() => void refetch()}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={SPRING.snappy}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white outline-none"
            style={{
              background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
              boxShadow: '0 8px 24px -8px rgba(0,122,255,0.5)',
            }}
          >
            <Icon paths={I.refresh} size={14} strokeWidth={2.4} />
            Try again
          </motion.button>
        </motion.div>
      </div>
    );
  }

  /* ---------------- Main ---------------- */
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="page-container space-y-5"
    >
      {/* HERO */}
      <motion.div variants={cardVariants}>
        <div
          className="relative overflow-hidden rounded-3xl border p-6 sm:p-7"
          style={{
            borderColor: 'rgba(255,255,255,0.5)',
            background: 'linear-gradient(145deg, rgba(255,255,255,0.85), rgba(255,255,255,0.65))',
            backdropFilter: 'blur(30px) saturate(1.6)',
            WebkitBackdropFilter: 'blur(30px) saturate(1.6)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 20px 60px -20px rgba(15,23,42,0.14)',
          }}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-6 top-0 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)' }}
          />

          <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            {/* Animated icon */}
            <div className="relative" style={{ width: 88, height: 88 }}>
              <motion.div
                className="absolute inset-[-4px] rounded-full p-[3px]"
                animate={reduced ? {} : { rotate: 360 }}
                transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
              >
                <span
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: 'conic-gradient(from 0deg, #AF52DE, #5856D6, #007AFF, #34C759, #FF9500, #AF52DE)',
                  }}
                  aria-hidden
                />
              </motion.div>

              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={SPRING.smooth}
                className="relative flex h-full w-full items-center justify-center rounded-full text-white ring-2 ring-white/70 dark:ring-black/50"
                style={{
                  background: 'linear-gradient(135deg, #AF52DE 0%, #5856D6 100%)',
                  boxShadow: '0 12px 32px -8px rgba(175,82,222,0.5), inset 0 2px 0 rgba(255,255,255,0.4)',
                }}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-full"
                  style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.45), transparent 55%)' }}
                />
                <Icon paths={I.clipboard} size={34} strokeWidth={2} className="relative" />
              </motion.div>
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
                  {stats.published} Published
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#00000008] bg-[#00000004] px-2.5 py-1 text-[11px] font-semibold text-[#86868B] dark:border-[#ffffff10] dark:bg-[#ffffff06]">
                  <Icon paths={I.layers} size={10} strokeWidth={2.5} />
                  {stats.total} Total
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
                    {stats.modules} Modules
                  </span>
                )}
              </div>

              <h1 className="mt-2 text-3xl font-bold tracking-tighter text-[#1D1D1F] dark:text-[#F5F5F7] sm:text-4xl">
                Syllabus Studio
              </h1>
              <p className="mt-1 text-[13.5px] font-medium text-[#86868B]">
                Design curriculums, version them, and structure learning modules
              </p>
            </div>

            {/* Actions */}
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white outline-none"
                  style={{
                    background: 'linear-gradient(135deg, #AF52DE 0%, #5856D6 100%)',
                    boxShadow: '0 8px 24px -8px rgba(175,82,222,0.5), inset 0 1px 0 rgba(255,255,255,0.3)',
                  }}
                >
                  <Icon paths={I.plus} size={15} strokeWidth={2.5} />
                  Create Curriculum
                </button>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* STATS */}
      <motion.div variants={containerVariants} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Total Curriculums" value={stats.total} icon={I.clipboard} tone="purple" />
        <StatTile label="Published" value={stats.published} icon={I.checkCircle} tone="green" />
        <StatTile label="Drafts" value={stats.drafts} icon={I.pencil} tone="orange" />
        <StatTile label="Total Modules" value={stats.modules} icon={I.layers} tone="blue" />
      </motion.div>

      {/* FILTER */}
      <motion.div variants={cardVariants} className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div
          className="flex items-center gap-2 rounded-2xl border border-[#ffffff60] bg-[#ffffff80] px-3 py-2 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
          style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)' }}
        >
          <span className="text-[#86868B]">
            <Icon paths={I.graduationCap} size={14} strokeWidth={2.2} />
          </span>
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="bg-transparent text-[13px] font-semibold text-[#1D1D1F] outline-none dark:text-[#F5F5F7]"
            aria-label="Filter by subject"
          >
            <option value="">All Subjects</option>
            {subjects?.items?.map((s: any) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
        </div>

        {selectedSubject && (
          <motion.button
            type="button"
            onClick={() => setSelectedSubject('')}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={SPRING.snappy}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#00000010] bg-[#00000004] px-3 py-2 text-[12px] font-semibold text-[#86868B] outline-none transition-colors hover:bg-[#00000008] hover:text-[#1D1D1F] dark:border-[#ffffff10] dark:bg-[#ffffff06] dark:hover:text-[#F5F5F7]"
          >
            Clear filter
          </motion.button>
        )}
      </motion.div>

      {/* LIST */}
      <motion.div variants={cardVariants}>
        <div
          className="overflow-hidden rounded-3xl border"
          style={{
            borderColor: 'rgba(255,255,255,0.5)',
            background: 'rgba(255,255,255,0.75)',
            backdropFilter: 'blur(30px) saturate(1.6)',
            WebkitBackdropFilter: 'blur(30px) saturate(1.6)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 20px 60px -20px rgba(15,23,42,0.14)',
          }}
        >
          <div className="flex items-center gap-3 border-b border-[#00000008] px-5 py-4 dark:border-[#ffffff08]">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#AF52DE]/10 text-[#AF52DE]">
              <Icon paths={I.clipboard} size={15} strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-[14px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                Curriculums
              </h2>
              <p className="text-[11px] font-medium text-[#86868B]">
                {list.length} {list.length === 1 ? 'curriculum' : 'curriculums'}
              </p>
            </div>
          </div>

          <div className="p-3">
            {list.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#AF52DE]/10 text-[#AF52DE]">
                  <Icon paths={I.clipboard} size={26} strokeWidth={2} />
                </div>
                <p className="text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {selectedSubject ? 'No curriculums for this subject' : 'No curriculums yet'}
                </p>
                <p className="max-w-sm text-[12px] font-medium text-[#86868B]">
                  {selectedSubject
                    ? 'Try a different subject or create the first curriculum for this one'
                    : 'Create your first curriculum to start structuring learning modules'}
                </p>
                <motion.button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  transition={SPRING.snappy}
                  className="mt-2 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[12.5px] font-semibold text-white outline-none"
                  style={{
                    background: 'linear-gradient(135deg, #AF52DE 0%, #5856D6 100%)',
                    boxShadow: '0 8px 24px -8px rgba(175,82,222,0.5)',
                  }}
                >
                  <Icon paths={I.plus} size={13} strokeWidth={2.5} />
                  Create Curriculum
                </motion.button>
              </div>
            ) : (
              <motion.div layout className="space-y-2">
                <AnimatePresence initial={false} mode="popLayout">
                  {list.map((c) => (
                    <CurriculumRow key={c.id} curriculum={c} />
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[200] grid place-items-center p-4"
            style={{
              background: 'rgba(15,23,42,0.5)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
            onClick={handleCloseModal}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 20 }}
              transition={SPRING.smooth}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md overflow-hidden rounded-3xl border p-6"
              style={{
                borderColor: 'rgba(255,255,255,0.6)',
                background: 'rgba(255,255,255,0.95)',
                backdropFilter: 'blur(40px) saturate(1.8)',
                WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,1), 0 32px 80px -20px rgba(15,23,42,0.35)',
              }}
              role="dialog"
              aria-modal="true"
              aria-label="Create curriculum"
            >
              {/* Top sheen */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-6 top-0 h-px"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)' }}
              />

              {/* Header hint */}
              <div className="flex items-center gap-3 rounded-2xl border border-[#AF52DE33] bg-[#AF52DE]/[0.06] px-4 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#AF52DE]/15 text-[#AF52DE]">
                  <Icon paths={I.sparkles} size={18} strokeWidth={2} />
                </div>
                <p className="text-[12px] font-medium leading-snug text-[#1D1D1F] dark:text-[#F5F5F7]">
                  Create a new curriculum. You can add modules and version it later.
                </p>
              </div>

              <form onSubmit={handleCreate} className="mt-5 space-y-4" noValidate>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
                    Subject <span className="text-[#FF3B30]">*</span>
                  </label>
                  <select
                    required
                    value={selectedSubject}
                    onChange={(e) => {
                      setSelectedSubject(e.target.value);
                      setFormErrors((p) => ({ ...p, subject: undefined }));
                    }}
                    aria-invalid={Boolean(formErrors.subject)}
                    className="w-full rounded-xl border bg-white/80 px-3.5 py-2.5 text-[13.5px] font-medium text-[#1D1D1F] outline-none transition-all focus:border-[#AF52DE]/40 focus:shadow-[0_0_0_4px_rgba(175,82,222,0.1)] dark:bg-[#1c1c1e80] dark:text-[#F5F5F7]"
                    style={{
                      borderColor: formErrors.subject ? '#FF3B30' : 'rgba(0,0,0,0.10)',
                    }}
                  >
                    <option value="">— Choose a subject —</option>
                    {subjects?.items?.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                  {formErrors.subject && (
                    <p className="mt-1 text-[11.5px] font-medium text-[#FF3B30]">{formErrors.subject}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
                    Curriculum Name <span className="text-[#FF3B30]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setFormErrors((p) => ({ ...p, name: undefined }));
                    }}
                    placeholder="e.g. Cambridge Primary Year 4"
                    aria-invalid={Boolean(formErrors.name)}
                    className="w-full rounded-xl border bg-white/80 px-3.5 py-2.5 text-[13.5px] font-medium text-[#1D1D1F] outline-none transition-all placeholder:text-[#86868B] focus:border-[#AF52DE]/40 focus:shadow-[0_0_0_4px_rgba(175,82,222,0.1)] dark:bg-[#1c1c1e80] dark:text-[#F5F5F7]"
                    style={{
                      borderColor: formErrors.name ? '#FF3B30' : 'rgba(0,0,0,0.10)',
                    }}
                  />
                  {formErrors.name && (
                    <p className="mt-1 text-[11.5px] font-medium text-[#FF3B30]">{formErrors.name}</p>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <motion.button
                    type="button"
                    onClick={handleCloseModal}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={SPRING.snappy}
                    disabled={createMutation.isPending}
                    className="rounded-xl border border-[#00000010] bg-[#00000004] px-4 py-2.5 text-[13px] font-semibold text-[#1D1D1F] outline-none transition-colors hover:bg-[#00000008] disabled:opacity-50 dark:border-[#ffffff10] dark:bg-[#ffffff06] dark:text-[#F5F5F7]"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={SPRING.snappy}
                    disabled={createMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white outline-none disabled:opacity-70"
                    style={{
                      background: 'linear-gradient(135deg, #AF52DE 0%, #5856D6 100%)',
                      boxShadow: '0 8px 24px -8px rgba(175,82,222,0.5), inset 0 1px 0 rgba(255,255,255,0.3)',
                    }}
                  >
                    {createMutation.isPending ? (
                      <>
                        <motion.span
                          className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                        />
                        Saving…
                      </>
                    ) : (
                      <>
                        <Icon paths={I.plus} size={14} strokeWidth={2.5} />
                        Create Curriculum
                      </>
                    )}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}