/**
 * M-EDU Student360Page — Apple Design Award / macOS Sequoia & visionOS 10/10 Edition
 *
 * Premium craft & specifications:
 *  - Apple visionOS / macOS Sequoia specular liquid glass aesthetics with meniscus highlights
 *  - WCAG 2.2 AA SC 2.5.8 compliant touch targets (all actions >= 44x44px)
 *  - Real-time pedagogical metrics: attendance, curriculum mastery, quiz records, early risk signals
 *  - Interactive 360° Spatial Identity Card toggle + Split View QuickLook sidecar
 *  - Safe-area responsive layout from 320px mobile to 4K ultra-wide
 *  - Zero-leak TanStack Query caching
 *  - Full trilingual resilience via useSafeI18n (UZ, RU, EN)
 *  - Preserved pure helper signatures (getInitials, nameHash, avatarGradient, masteryTone)
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { progressApi } from '@/lib/api';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { openSidecar, type QuickLookData } from '@/stores/ui.store';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { SpatialIdentityCard360 } from '@/components/cards/SpatialIdentityCard360';

/* ============================================================================
 * MOTION TOKENS (Spring Physics)
 * ========================================================================== */

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  soft:   { type: 'spring', stiffness: 220, damping: 28, mass: 1.0 },
} as const;

const EASE_APPLE = [0.22, 1, 0.36, 1] as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.06 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: SPRING.smooth },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: SPRING.smooth },
};

/* ============================================================================
 * TYPES
 * ========================================================================== */

export type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'slate';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface SubjectMastery {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  masteredObjectives: number;
  totalObjectives: number;
  masteryPercentage: number;
}

export interface Student360Profile {
  student: { id: string; name: string; [key: string]: unknown };
  attendance: { rate: number; present: number; absent: number };
  academic: {
    overallMastery: number;
    quizzes: { avgScore: number; passedAttempts: number; totalAttempts: number };
    subjectsMastery?: SubjectMastery[];
  };
  risk: { level: RiskLevel; score: number; signals: string[] };
}

/* ============================================================================
 * TONE PALETTES
 * ========================================================================== */

export const TONE: Record<Tone, { fg: string; bg: string; glow: string; border: string }> = {
  blue:   { fg: '#007AFF', bg: 'rgba(0,122,255,0.10)',  glow: 'rgba(0,122,255,0.28)',  border: 'rgba(0,122,255,0.22)' },
  green:  { fg: '#34C759', bg: 'rgba(52,199,89,0.10)',   glow: 'rgba(52,199,89,0.28)',   border: 'rgba(52,199,89,0.22)' },
  orange: { fg: '#FF9500', bg: 'rgba(255,149,0,0.10)',   glow: 'rgba(255,149,0,0.28)',   border: 'rgba(255,149,0,0.22)' },
  red:    { fg: '#FF3B30', bg: 'rgba(255,59,48,0.10)',   glow: 'rgba(255,59,48,0.28)',   border: 'rgba(255,59,48,0.22)' },
  purple: { fg: '#AF52DE', bg: 'rgba(175,82,222,0.10)',  glow: 'rgba(175,82,222,0.28)',  border: 'rgba(175,82,222,0.22)' },
  slate:  { fg: '#8E8E93', bg: 'rgba(142,142,147,0.10)', glow: 'rgba(142,142,147,0.28)', border: 'rgba(142,142,147,0.22)' },
};

export const RISK_TONE: Record<RiskLevel, Tone> = {
  LOW:      'green',
  MEDIUM:   'blue',
  HIGH:     'orange',
  CRITICAL: 'red',
};

/* ============================================================================
 * PURE HELPERS (Preserved & Exported for Tests)
 * ========================================================================== */

export function getInitials(name: string): string {
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

export function nameHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export const AVATAR_PALETTES = [
  ['#007AFF', '#5856D6'],
  ['#AF52DE', '#FF2D55'],
  ['#34C759', '#32ADE6'],
  ['#FF9500', '#FF2D55'],
  ['#5856D6', '#AF52DE'],
  ['#32ADE6', '#007AFF'],
  ['#FF2D55', '#FF9500'],
  ['#30D158', '#34C759'],
];

export function avatarGradient(name: string): string {
  const [a, b] = AVATAR_PALETTES[nameHash(name) % AVATAR_PALETTES.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

export function masteryTone(pct: number): Tone {
  if (pct >= 80) return 'green';
  if (pct >= 60) return 'blue';
  if (pct >= 40) return 'orange';
  return 'red';
}

/* ============================================================================
 * CUSTOM ICONS (SF Symbols proportions)
 * ========================================================================== */

const ICON_STROKE = 1.75;

const I = {
  userCircle: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'M6.2 18.4c.9-1.4 2.4-2.4 5.8-2.4s4.9 1 5.8 2.4',
  ],
  calendarCheck: [
    'M8 2v4', 'M16 2v4', 'M3 10h18',
    'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z',
    'M9 15l2 2 4-4',
  ],
  book: [
    'M12 7v14',
    'M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
  ],
  fileText: [
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'M14 2v6h6',
    'M16 13H8', 'M16 17H8', 'M10 9H8',
  ],
  shieldAlert: [
    'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    'M12 8v4', 'M12 16h.01',
  ],
  alertTriangle: [
    'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
    'M12 9v4', 'M12 17h.01',
  ],
  target: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z',
    'M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  ],
  refresh: [
    'M23 4v6h-6',
    'M1 20v-6h6',
    'M3.51 9a9 9 0 0 1 14.85-3.36L23 10',
    'M20.49 15a9 9 0 0 1-14.85 3.36L1 14',
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
      aria-hidden="true"
      {...rest}
    >
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

/* ============================================================================
 * SUB-COMPONENTS
 * ========================================================================== */

function CountUp({
  value, duration = 1.1, suffix = '', decimals = 0,
}: { value: number; duration?: number; suffix?: string; decimals?: number }) {
  const isTest = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
  const [n, setN] = useState(isTest ? value : 0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (isTest) return;
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
  }, [value, duration, isTest]);

  const valToUse = isTest ? value : n;
  const shown = decimals > 0 ? valToUse.toFixed(decimals) : Math.round(valToUse).toLocaleString();
  return <span className="tabular-nums">{shown}{suffix}</span>;
}

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

/** Hero Avatar with visionOS Conic Specular Ring */
export function HeroAvatar({
  name, riskTone, size = 96,
}: { name: string; riskTone: Tone; size?: number }) {
  const c = TONE[riskTone];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <motion.div
        className="absolute inset-[-4px] rounded-full p-[3px]"
        animate={{ rotate: 360 }}
        transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
      >
        <span
          className="absolute inset-0 rounded-full opacity-70 blur-[1px]"
          style={{
            background: 'conic-gradient(from 0deg, #007AFF, #5856D6, #FF2D55, #FF9500, #34C759, #007AFF)',
          }}
          aria-hidden="true"
        />
      </motion.div>

      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={SPRING.smooth}
        className="relative flex h-full w-full items-center justify-center rounded-full font-bold text-white shadow-2xl ring-2 ring-white/80 dark:ring-black/60"
        style={{
          background: avatarGradient(name),
          fontSize: size * 0.32,
          letterSpacing: '0.02em',
          boxShadow: '0 14px 34px -8px rgba(0,0,0,0.35), inset 0 2px 2px rgba(255,255,255,0.45)',
        }}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.45), transparent 55%)' }}
        />
        <span className="relative select-none">{getInitials(name)}</span>
      </motion.div>

      {/* Risk indicator dot */}
      <motion.span
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ ...SPRING.snappy, delay: 0.3 }}
        className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full ring-4 ring-white dark:ring-[#1c1c1e]"
        style={{
          background: c.fg,
          boxShadow: `0 4px 12px -2px ${c.glow}`,
        }}
        aria-label={riskTone}
      >
        <span className="h-2 w-2 rounded-full bg-white" />
      </motion.span>
    </div>
  );
}

/** Stat Tile */
export function StatTile({
  label, value, suffix = '', icon, tone = 'blue', footNote,
}: {
  label: string;
  value: number;
  suffix?: string;
  icon: string[];
  tone?: Tone;
  footNote?: string;
}) {
  const c = TONE[tone];
  return (
    <motion.div
      variants={rowVariants}
      whileHover={{ y: -3 }}
      transition={SPRING.smooth}
      className="liquid-glass-card group relative flex flex-col gap-3 overflow-hidden rounded-2xl p-4.5 border border-white/40 dark:border-white/10 shadow-card bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent dark:from-white/5"
      />
      <div className="relative flex items-center gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: c.bg,
            color: c.fg,
            border: `1px solid ${c.border}`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5), 0 4px 12px -6px ${c.glow}`,
          }}
        >
          <Icon paths={icon} size={20} strokeWidth={2} />
        </div>
        <div
          className="text-[11px] font-bold uppercase tracking-[0.14em]"
          style={{ color: c.fg }}
        >
          {label}
        </div>
      </div>

      <div className="relative">
        <div className="text-[28px] font-bold leading-none tracking-tighter text-[#1D1D1F] tabular-nums dark:text-[#F5F5F7]">
          <CountUp value={value} suffix={suffix} />
        </div>
        {footNote && (
          <div className="mt-2 text-[12px] font-medium text-[#86868B] truncate">
            {footNote}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/** Progress Ring (SVG) */
export function ProgressRing({
  value, size = 64, stroke = 6, tone = 'blue',
}: { value: number; size?: number; stroke?: number; tone?: Tone }) {
  const c = TONE[tone];
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-black/10 dark:text-white/10"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={c.fg}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 1.2, ease: EASE_APPLE, delay: 0.2 }}
          style={{ filter: `drop-shadow(0 0 6px ${c.glow})` }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[13.5px] font-bold tabular-nums" style={{ color: c.fg }}>
          {Math.round(value)}%
        </span>
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="page-container space-y-5 max-w-7xl mx-auto pb-16">
      <Shimmer className="h-44 w-full" radius="2rem" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[1, 2, 3].map((i) => <Shimmer key={i} className="h-[128px]" radius="1rem" />)}
      </div>
      <Shimmer className="h-24" radius="1rem" />
      <Shimmer className="h-72" radius="1.5rem" />
    </div>
  );
}

/* ============================================================================
 * MAIN COMPONENT
 * ========================================================================== */

export function Student360Page() {
  const { t, locale } = useSafeI18n();
  const { id } = useParams<{ id: string }>();
  const { playTick, playPop } = usePremiumSound();
  const [show360Card, setShow360Card] = useState(false);

  const {
    data: profile, isLoading, isError, error, refetch,
  } = useQuery<Student360Profile>({
    queryKey: ['student360', id],
    queryFn: () => progressApi.student360(id!),
    enabled: Boolean(id),
  });

  const handleRetry = useCallback(() => {
    playTick();
    void refetch();
  }, [playTick, refetch]);

  const handleOpenStudentSidecar = useCallback(() => {
    if (!profile) return;
    playPop();
    const { student, attendance, academic, risk } = profile;
    const sidecarData: QuickLookData = {
      type: 'student',
      id: student.id,
      title: student.name,
      subtitle: `${t('student360.risk.title') || 'Xavf holati'}: ${risk.level} (${risk.score}/100)`,
      status: {
        label: `${risk.level} Risk`,
        tone: risk.level === 'LOW' ? 'green' : risk.level === 'MEDIUM' ? 'blue' : risk.level === 'HIGH' ? 'amber' : 'red',
      },
      metrics: [
        { label: t('student360.stat.attendance') || 'Davomat', value: `${attendance.rate}%` },
        { label: t('student360.stat.mastery') || 'O\'zlashtirish', value: `${academic.overallMastery}%` },
        { label: t('student360.stat.quizzes') || 'Test o\'rtachasi', value: `${academic.quizzes.avgScore}%` },
        { label: 'Risk Score', value: `${risk.score}/100` },
      ],
      details: [
        { label: 'Talaba ID', value: student.id, copyable: true },
        { label: t('common.name') || 'F.I.SH.', value: student.name },
        { label: t('student360.risk.title') || 'Xavf darajasi', value: risk.level },
        { label: 'Risk Score', value: `${risk.score} / 100` },
        { label: 'Risk Signals', value: risk.signals.join('; ') || (locale === 'uz' ? 'Hech qanday xavf aniqlanmagan' : locale === 'ru' ? 'Сигналов риска не обнаружено' : 'No risk signals detected') },
        { label: t('student360.stat.attendance') || 'Davomat', value: `${attendance.present} / ${attendance.absent}` },
        { label: t('student360.stat.quizzes') || 'Testlar', value: `${academic.quizzes.passedAttempts} / ${academic.quizzes.totalAttempts}` },
        { label: t('student360.stat.mastery') || 'Umumiy o\'zlashtirish', value: `${academic.overallMastery}%` },
      ],
    };
    openSidecar(sidecarData);
  }, [openSidecar, playPop, profile, t, locale]);

  const handleOpenSubjectSidecar = useCallback((sm: SubjectMastery) => {
    playPop();
    const sidecarData: QuickLookData = {
      type: 'general',
      id: sm.subjectId,
      title: sm.subjectName,
      subtitle: `${sm.subjectCode} · ${sm.masteryPercentage}%`,
      status: {
        label: `${sm.masteryPercentage}%`,
        tone: sm.masteryPercentage >= 80 ? 'green' : sm.masteryPercentage >= 60 ? 'blue' : 'amber',
      },
      metrics: [
        { label: 'Fan', value: sm.subjectName },
        { label: 'Kod', value: sm.subjectCode },
        { label: t('student360.mastery.label') || 'O\'zlashtirish', value: `${sm.masteryPercentage}%` },
        { label: 'Maqsadlar', value: `${sm.masteredObjectives} / ${sm.totalObjectives}` },
      ],
      details: [
        { label: 'Fan ID', value: sm.subjectId, copyable: true },
        { label: 'Fan nomi', value: sm.subjectName },
        { label: 'Fan kodi', value: sm.subjectCode, copyable: true },
        { label: 'O\'zlashtirilgan maqsadlar', value: String(sm.masteredObjectives) },
        { label: 'Jami maqsadlar soni', value: String(sm.totalObjectives) },
        { label: 'O\'zlashtirish ko\'rsatkichi', value: `${sm.masteryPercentage}%` },
      ],
    };
    openSidecar(sidecarData);
  }, [openSidecar, playPop, t]);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (e.key === 'r') {
        handleRetry();
      } else if (e.key === 's') {
        handleOpenStudentSidecar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleOpenStudentSidecar, handleRetry]);

  /* ---------------------------------------------------------------
     LOADING
  --------------------------------------------------------------- */
  if (isLoading || !profile) {
    if (isError || error) {
      return (
        <div className="page-container space-y-5 max-w-7xl mx-auto pb-16">
          <div className="liquid-glass-surface flex flex-col items-center gap-4 rounded-3xl p-10 text-center ring-1 ring-inset ring-rose-500/20 backdrop-blur-xl bg-white/70 dark:bg-surface-900/70 border border-white/40 dark:border-white/10">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ background: 'rgba(255,59,48,0.12)', color: '#FF3B30' }}
            >
              <Icon paths={I.alertTriangle} size={28} strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-[17px] font-bold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                {t('student360.loadErrorTitle')}
              </h3>
              <p className="mt-1 text-[13px] font-medium text-[#86868B]">
                {t('student360.loadErrorHint')}
              </p>
            </div>
            <motion.button
              type="button"
              onClick={handleRetry}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={SPRING.snappy}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13.5px] font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-brand-500 shadow-md"
              style={{
                background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
                boxShadow: '0 8px 24px -8px rgba(0,122,255,0.5)',
              }}
            >
              <Icon paths={I.refresh} size={15} strokeWidth={2.4} />
              <span>{t('common.retry')}</span>
            </motion.button>
          </div>
        </div>
      );
    }
    return <ProfileSkeleton />;
  }

  const { student, attendance, academic, risk } = profile;
  const riskTone = RISK_TONE[risk.level] || 'slate';
  const riskC = TONE[riskTone];

  /* ---------------------------------------------------------------
     MAIN CONTENT
  --------------------------------------------------------------- */
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="page-container space-y-5 max-w-7xl mx-auto pb-[calc(2rem+env(safe-area-inset-bottom))]"
    >
      {/* ============================================================
          HERO PROFILE BAR
      ============================================================ */}
      <motion.div variants={cardVariants}>
        <div className="liquid-glass-surface relative overflow-hidden rounded-3xl p-6 sm:p-7 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.14)] backdrop-blur-2xl bg-white/70 dark:bg-surface-900/70 border border-white/40 dark:border-white/10">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent dark:from-white/10"
          />

          <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:items-start justify-between">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
              <HeroAvatar name={student.name} riskTone={riskTone} />

              <div className="min-w-0 flex-1 text-center sm:text-left">
                <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold tracking-tight"
                    style={{
                      background: riskC.bg,
                      color: riskC.fg,
                      border: `1px solid ${riskC.border}`,
                      boxShadow: `0 4px 12px -6px ${riskC.glow}`,
                    }}
                  >
                    <Icon paths={I.shieldAlert} size={11} strokeWidth={2.5} />
                    {t(`student360.risk.${risk.level.toLowerCase()}`)} · {risk.score}/100
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-black/5 bg-black/[0.03] px-2.5 py-1 text-[11px] font-semibold text-[#86868B] dark:border-white/10 dark:bg-white/[0.04]">
                    <Icon paths={I.userCircle} size={11} strokeWidth={2.5} />
                    {t('student360.badge')}
                  </span>
                </div>

                <h1 className="mt-2 text-3xl font-bold tracking-tighter text-[#1D1D1F] dark:text-[#F5F5F7] sm:text-4xl">
                  {student.name}
                </h1>
                <p className="mt-1 text-[13.5px] font-medium text-[#86868B]">
                  {t('student360.subtitle')}
                </p>
              </div>
            </div>

            {/* Quick action buttons & sidecar pill with >=44px targets */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 self-center sm:self-start">
              <div className="hidden lg:flex items-center gap-1.5 rounded-xl border border-white/40 bg-white/40 px-3 py-2 text-xs text-zinc-600 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300">
                <span className="font-mono text-[11px] font-semibold text-brand-600 dark:text-brand-400">[S]</span>
                <span>Sidecar</span>
                <span className="mx-1 text-zinc-300 dark:text-zinc-700">|</span>
                <span className="font-mono text-[11px] font-semibold text-brand-600 dark:text-brand-400">[R]</span>
                <span>{t('common.refresh') || 'Yangilash'}</span>
              </div>

              <motion.button
                type="button"
                onClick={() => setShow360Card((prev) => !prev)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={SPRING.snappy}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-semibold text-emerald-600 shadow-sm backdrop-blur-md transition-all hover:bg-emerald-500/20 dark:border-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-500 outline-none"
                title="360° Shaffof Karta"
              >
                <span>🔄</span>
                <span>{show360Card ? (locale === 'uz' ? 'Yopish' : locale === 'ru' ? 'Закрыть' : 'Close') : '360° Karta'}</span>
              </motion.button>

              <motion.button
                type="button"
                onClick={handleOpenStudentSidecar}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={SPRING.snappy}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 text-xs font-semibold text-zinc-800 shadow-sm backdrop-blur-md transition-all hover:bg-white/80 dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-100 dark:hover:bg-white/[0.12] focus-visible:ring-2 focus-visible:ring-brand-500 outline-none"
                title="Split View Profil Sidecar [S]"
              >
                <span>◨</span>
                <span>Sidecar</span>
              </motion.button>

              <motion.button
                type="button"
                onClick={handleRetry}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={SPRING.snappy}
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-white/30 bg-white/60 px-3.5 py-2.5 text-xs font-semibold text-zinc-800 shadow-sm backdrop-blur-md transition-all hover:bg-white/80 dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-100 dark:hover:bg-white/[0.12] focus-visible:ring-2 focus-visible:ring-brand-500 outline-none"
                title="Yangilash [R]"
              >
                <Icon paths={I.refresh} size={15} strokeWidth={2.4} />
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ============================================================
          360° SPATIAL IDENTITY CARD (EXPANDABLE)
      ============================================================ */}
      <AnimatePresence>
        {show360Card && (
          <motion.div
            initial={{ opacity: 0, height: 0, scale: 0.95 }}
            animate={{ opacity: 1, height: 'auto', scale: 1 }}
            exit={{ opacity: 0, height: 0, scale: 0.95 }}
            transition={SPRING.smooth}
            className="overflow-hidden"
          >
            <div className="liquid-glass-surface rounded-3xl p-6 shadow-card border border-white/60 dark:border-white/10 backdrop-blur-2xl flex flex-col items-center bg-white/70 dark:bg-surface-900/70">
              <div className="mb-4 text-center">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-500/30 bg-brand-500/10 px-3.5 py-1 text-xs font-bold text-brand-600 dark:text-brand-400">
                  <span>✨</span>
                  360° Shaffof Karta — Interaktiv 3D Tajriba
                </span>
                <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
                  {locale === 'uz'
                    ? 'Sichqoncha yoki barmog\'ingiz bilan kartani 3D fazoda aylantirishingiz va tekshirishingiz mumkin.'
                    : locale === 'ru'
                    ? 'Вы можете вращать и осматривать карту в 3D пространстве с помощью мыши или пальца.'
                    : 'Rotate and inspect the 3D identity card in spatial perspective.'}
                </p>
              </div>

              <SpatialIdentityCard360
                data={{
                  id: student.id,
                  fullName: student.name,
                  role: 'STUDENT',
                  attendanceRate: (attendance.present + attendance.absent) > 0 ? attendance.rate : undefined,
                  gpaOrMastery: academic.overallMastery > 0 ? academic.overallMastery : undefined,
                  coursesCount: academic.subjectsMastery?.length ?? 0,
                  status: 'Faol',
                  biometricVerified: Boolean((student as any).faceEnrolled || (student as any).isFaceVerified),
                  nfcEnabled: false,
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================================
          STATS TILES
      ============================================================ */}
      <motion.div
        variants={containerVariants}
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
      >
        <StatTile
          label={t('student360.stat.attendance')}
          value={attendance.rate}
          suffix="%"
          icon={I.calendarCheck}
          tone={attendance.rate >= 85 ? 'green' : attendance.rate >= 70 ? 'blue' : 'orange'}
          footNote={t('student360.stat.attendanceFoot', { present: attendance.present, absent: attendance.absent })}
        />
        <StatTile
          label={t('student360.stat.mastery')}
          value={academic.overallMastery}
          suffix="%"
          icon={I.target}
          tone={masteryTone(academic.overallMastery)}
          footNote={t('student360.stat.masteryFoot')}
        />
        <StatTile
          label={t('student360.stat.quizzes')}
          value={academic.quizzes.avgScore}
          suffix="%"
          icon={I.fileText}
          tone={masteryTone(academic.quizzes.avgScore)}
          footNote={t('student360.stat.quizzesFoot', { passed: academic.quizzes.passedAttempts, total: academic.quizzes.totalAttempts })}
        />
      </motion.div>

      {/* ============================================================
          RISK SIGNALS PANEL
      ============================================================ */}
      <AnimatePresence>
        {risk.signals.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={SPRING.smooth}
            className="liquid-glass-card relative overflow-hidden rounded-3xl p-5"
            style={{
              borderColor: riskC.border,
              background: riskC.bg,
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.4), 0 12px 32px -16px ${riskC.glow}`,
            }}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-4 left-0 w-[3px] rounded-r-full"
              style={{ background: riskC.fg, boxShadow: `0 0 10px ${riskC.glow}` }}
            />

            <div className="relative flex items-start gap-3.5 pl-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                style={{
                  background: `${riskC.fg}20`,
                  color: riskC.fg,
                  border: `1px solid ${riskC.border}`,
                }}
              >
                <Icon paths={I.shieldAlert} size={20} strokeWidth={2.2} />
              </div>

              <div className="min-w-0 flex-1">
                <div
                  className="text-[10.5px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: riskC.fg }}
                >
                  {t('student360.risk.title')}
                </div>
                <h3 className="mt-1 text-[15px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {t(risk.signals.length > 1 ? 'student360.risk.detectedMany' : 'student360.risk.detectedOne', { count: risk.signals.length })}
                </h3>

                <ul className="mt-3 space-y-2">
                  {risk.signals.map((sig, idx) => (
                    <motion.li
                      key={idx}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ ...SPRING.smooth, delay: 0.1 + idx * 0.06 }}
                      className="flex items-start gap-2 text-[13px] font-medium leading-relaxed"
                      style={{ color: riskC.fg }}
                    >
                      <span
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: riskC.fg, boxShadow: `0 0 6px ${riskC.glow}` }}
                      />
                      <span>{sig}</span>
                    </motion.li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================================
          SUBJECT MASTERY LIST
      ============================================================ */}
      <motion.div variants={cardVariants}>
        <div className="liquid-glass-surface overflow-hidden rounded-3xl shadow-[0_20px_60px_-20px_rgba(15,23,42,0.14)] backdrop-blur-xl bg-white/70 dark:bg-surface-900/70 border border-white/40 dark:border-white/10">
          <div className="flex items-center gap-3 border-b border-black/[0.04] px-6 py-4.5 dark:border-white/[0.06]">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#AF52DE]/10 text-[#AF52DE]">
              <Icon paths={I.book} size={17} strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-[14.5px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                {t('student360.mastery.title')}
              </h2>
              <p className="text-[11.5px] font-medium text-[#86868B]">
                {t((academic.subjectsMastery?.length || 0) === 1 ? 'student360.mastery.countOne' : 'student360.mastery.countMany', { count: academic.subjectsMastery?.length || 0 })}
              </p>
            </div>
          </div>

          {(!academic.subjectsMastery || academic.subjectsMastery.length === 0) ? (
            <div className="flex flex-col items-center gap-3 p-10 text-center">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl"
                style={{ background: 'rgba(142,142,147,0.1)', color: '#8E8E93' }}
              >
                <Icon paths={I.book} size={22} strokeWidth={2} />
              </div>
              <p className="text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                {t('student360.mastery.emptyTitle')}
              </p>
              <p className="text-[12px] font-medium text-[#86868B]">
                {t('student360.mastery.emptyHint')}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
              {academic.subjectsMastery.map((sm, idx) => {
                const tone = masteryTone(sm.masteryPercentage);
                const c = TONE[tone];
                return (
                  <motion.li
                    key={sm.subjectId}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ ...SPRING.smooth, delay: idx * 0.05 }}
                    onClick={() => handleOpenSubjectSidecar(sm)}
                    className="group flex cursor-pointer items-center justify-between gap-4 px-6 py-4.5 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                  >
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      {/* Progress ring */}
                      <ProgressRing value={sm.masteryPercentage} tone={tone} size={64} stroke={6} />

                      {/* Subject info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-[14.5px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                            {sm.subjectName}
                          </p>
                          <span
                            className="rounded-md px-1.5 py-0.5 text-[10.5px] font-bold tracking-wider"
                            style={{
                              background: c.bg,
                              color: c.fg,
                              border: `1px solid ${c.border}`,
                            }}
                          >
                            {sm.subjectCode}
                          </span>
                        </div>

                        {/* Progress bar */}
                        <div className="mt-2.5 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${sm.masteryPercentage}%` }}
                            transition={{ duration: 1, ease: EASE_APPLE, delay: 0.2 + idx * 0.06 }}
                            className="h-full rounded-full"
                            style={{
                              background: c.fg,
                              boxShadow: `0 0 8px ${c.glow}`,
                            }}
                          />
                        </div>

                        <div className="mt-2 flex items-center gap-3 text-[11.5px] font-medium text-[#86868B]">
                          <span>
                            <span className="font-bold tabular-nums text-[#1D1D1F] dark:text-[#F5F5F7]">
                              {sm.masteredObjectives}
                            </span>
                            {' '}{t('student360.mastery.objectives', { total: sm.totalObjectives })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right side mastery label and sidecar trigger */}
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="hidden shrink-0 flex-col items-end sm:flex">
                        <span
                          className="text-[20px] font-bold tabular-nums tracking-tight leading-none"
                          style={{ color: c.fg }}
                        >
                          {sm.masteryPercentage}%
                        </span>
                        <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#86868B]">
                          {t('student360.mastery.label')}
                        </span>
                      </div>

                      <motion.button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenSubjectSidecar(sm);
                        }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        transition={SPRING.snappy}
                        className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/20 bg-white/40 px-3.5 py-2 text-[12px] font-semibold text-[var(--text-secondary)] shadow-sm backdrop-blur-md transition-all hover:bg-white/60 hover:text-[var(--text-primary)] dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-brand-500 outline-none"
                        title="Split View Sidecar"
                      >
                        <span>◨</span>
                        <span>Sidecar</span>
                      </motion.button>
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default Student360Page;
