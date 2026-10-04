/**
 * M-EDU Student360Page — Apple Design Award Edition
 *
 * Premium craft:
 *  - Hero with gradient avatar + risk tier badge (animated)
 *  - Stats tiles with CountUp (Attendance, Mastery, Quizzes)
 *  - Risk signals panel with tone-aware severity
 *  - Subject mastery list with progress rings + bars
 *  - Custom SVG icons in SF Symbols proportions
 *  - Shimmer skeletons (not pulse)
 *  - Framer Motion spring physics + stagger
 *  - Tone system (blue / green / orange / red / purple / slate)
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { progressApi } from '../lib/api';

/* ============================================================================
 * MOTION TOKENS
 * ========================================================================== */

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  soft:   { type: 'spring', stiffness: 220, damping: 28, mass: 1.0 },
} as const;

const EASE_APPLE = [0.22, 1, 0.36, 1] as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 18, filter: 'blur(8px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: SPRING.smooth },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, x: -10, filter: 'blur(6px)' },
  visible: { opacity: 1, x: 0, filter: 'blur(0px)', transition: SPRING.smooth },
};

/* ============================================================================
 * TYPES
 * ========================================================================== */

type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'slate';
type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

interface SubjectMastery {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  masteredObjectives: number;
  totalObjectives: number;
  masteryPercentage: number;
}

interface Student360Profile {
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

const TONE: Record<Tone, { fg: string; bg: string; glow: string; border: string }> = {
  blue:   { fg: '#007AFF', bg: 'rgba(0,122,255,0.10)',  glow: 'rgba(0,122,255,0.28)',  border: 'rgba(0,122,255,0.22)' },
  green:  { fg: '#34C759', bg: 'rgba(52,199,89,0.10)',   glow: 'rgba(52,199,89,0.28)',   border: 'rgba(52,199,89,0.22)' },
  orange: { fg: '#FF9500', bg: 'rgba(255,149,0,0.10)',   glow: 'rgba(255,149,0,0.28)',   border: 'rgba(255,149,0,0.22)' },
  red:    { fg: '#FF3B30', bg: 'rgba(255,59,48,0.10)',   glow: 'rgba(255,59,48,0.28)',   border: 'rgba(255,59,48,0.22)' },
  purple: { fg: '#AF52DE', bg: 'rgba(175,82,222,0.10)',  glow: 'rgba(175,82,222,0.28)',  border: 'rgba(175,82,222,0.22)' },
  slate:  { fg: '#8E8E93', bg: 'rgba(142,142,147,0.10)', glow: 'rgba(142,142,147,0.28)', border: 'rgba(142,142,147,0.22)' },
};

const RISK_TONE: Record<RiskLevel, Tone> = {
  LOW:      'green',
  MEDIUM:   'blue',
  HIGH:     'orange',
  CRITICAL: 'red',
};

const RISK_LABEL: Record<RiskLevel, string> = {
  LOW:      'Low Risk',
  MEDIUM:   'Medium Risk',
  HIGH:     'High Risk',
  CRITICAL: 'Critical',
};

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
  shield: [
    'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  ],
  shieldAlert: [
    'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    'M12 8v4', 'M12 16h.01',
  ],
  checkCircle: [
    'M22 11.08V12a10 10 0 1 1-5.93-9.14',
    'M22 4 12 14.01l-3-3',
  ],
  alertTriangle: [
    'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
    'M12 9v4', 'M12 17h.01',
  ],
  trendingUp: [
    'M22 7 13.5 15.5 8.5 10.5 2 17',
    'M16 7h6v6',
  ],
  award: [
    'M12 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
    'M8.2 13.9 7 22l5-3 5 3-1.2-8.1',
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
  arrowRight: ['M5 12h14', 'M12 5l7 7-7 7'],
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

function nameHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const AVATAR_PALETTES = [
  ['#007AFF', '#5856D6'],
  ['#AF52DE', '#FF2D55'],
  ['#34C759', '#32ADE6'],
  ['#FF9500', '#FF2D55'],
  ['#5856D6', '#AF52DE'],
  ['#32ADE6', '#007AFF'],
  ['#FF2D55', '#FF9500'],
  ['#30D158', '#34C759'],
];

function avatarGradient(name: string): string {
  const [a, b] = AVATAR_PALETTES[nameHash(name) % AVATAR_PALETTES.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

function masteryTone(pct: number): Tone {
  if (pct >= 80) return 'green';
  if (pct >= 60) return 'blue';
  if (pct >= 40) return 'orange';
  return 'red';
}

/* ============================================================================
 * COUNT UP
 * ========================================================================== */

function CountUp({
  value, duration = 1.1, suffix = '', decimals = 0,
}: { value: number; duration?: number; suffix?: string; decimals?: number }) {
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

  const shown = decimals > 0 ? n.toFixed(decimals) : Math.round(n).toLocaleString();
  return <span className="tabular-nums">{shown}{suffix}</span>;
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

/* ============================================================================
 * HERO AVATAR
 * ========================================================================== */

function HeroAvatar({
  name, riskTone, size = 96,
}: { name: string; riskTone: Tone; size?: number }) {
  const c = TONE[riskTone];
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <motion.div
        className="absolute inset-[-4px] rounded-full p-[3px]"
        animate={{ rotate: 360 }}
        transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
      >
        <span
          className="absolute inset-0 rounded-full"
          style={{
            background: 'conic-gradient(from 0deg, #007AFF, #5856D6, #FF2D55, #FF9500, #34C759, #007AFF)',
          }}
          aria-hidden
        />
      </motion.div>

      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={SPRING.smooth}
        className="relative flex h-full w-full items-center justify-center rounded-full font-bold text-white ring-2 ring-white/70 dark:ring-black/50"
        style={{
          background: avatarGradient(name),
          fontSize: size * 0.32,
          letterSpacing: '0.02em',
          boxShadow: '0 12px 32px -8px rgba(0,0,0,0.3), inset 0 2px 0 rgba(255,255,255,0.4)',
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.45), transparent 55%)' }}
        />
        <span className="relative">{getInitials(name)}</span>
      </motion.div>

      {/* Risk dot */}
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

/* ============================================================================
 * STAT TILE
 * ========================================================================== */

function StatTile({
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
      className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-[#ffffff60] bg-[#ffffff80] p-4 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
      style={{
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), 0 4px 16px -8px rgba(0,0,0,0.06)',
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-3 top-0 h-1/2 rounded-t-2xl"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.35), transparent)' }}
      />

      <div className="relative flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: c.bg,
            color: c.fg,
            border: `1px solid ${c.border}`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5), 0 4px 12px -6px ${c.glow}`,
          }}
        >
          <Icon paths={icon} size={18} strokeWidth={2} />
        </div>
        <div
          className="text-[10.5px] font-bold uppercase tracking-[0.12em]"
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
          <div className="mt-2 text-[11.5px] font-medium text-[#86868B] truncate">
            {footNote}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ============================================================================
 * PROGRESS RING (SVG)
 * ========================================================================== */

function ProgressRing({
  value, size = 60, stroke = 6, tone = 'blue',
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
          className="text-[#00000010] dark:text-[#ffffff10]"
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
        <span className="text-[13px] font-bold tabular-nums" style={{ color: c.fg }}>
          {Math.round(value)}%
        </span>
      </div>
    </div>
  );
}

/* ============================================================================
 * LOADING SKELETON
 * ========================================================================== */

function ProfileSkeleton() {
  return (
    <div className="page-container space-y-5">
      <Shimmer className="h-40 w-full" radius="2rem" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[1, 2, 3].map((i) => <Shimmer key={i} className="h-[120px]" radius="1rem" />)}
      </div>
      <Shimmer className="h-20" radius="1rem" />
      <Shimmer className="h-72" radius="1.5rem" />
    </div>
  );
}

/* ============================================================================
 * MAIN PAGE
 * ========================================================================== */

export default function Student360Page() {
  const { id } = useParams<{ id: string }>();

  const {
    data: profile, isLoading, isError, error, refetch,
  } = useQuery<Student360Profile>({
    queryKey: ['student360', id],
    queryFn: () => progressApi.student360(id!),
    enabled: Boolean(id),
  });

  const handleRetry = useCallback(() => { void refetch(); }, [refetch]);

  /* ---------------------------------------------------------------
     LOADING
  --------------------------------------------------------------- */
  if (isLoading || !profile) {
    if (isError || error) {
      return (
        <div className="page-container space-y-5">
          <div
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
                Profilni yuklab bo'lmadi
              </h3>
              <p className="mt-1 text-[13px] font-medium text-[#86868B]">
                Tarmoqda muammo bo'lishi mumkin
              </p>
            </div>
            <motion.button
              type="button"
              onClick={handleRetry}
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
              Qayta urinish
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
     MAIN
  --------------------------------------------------------------- */
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="page-container space-y-5"
    >
      {/* ============================================================
          HERO
      ============================================================ */}
      <motion.div variants={cardVariants}>
        <div
          className="relative overflow-hidden rounded-3xl border p-6 sm:p-7"
          style={{
            borderColor: 'rgba(255,255,255,0.5)',
            background: 'linear-gradient(145deg, rgba(255,255,255,0.85), rgba(255,255,255,0.65))',
            backdropFilter: 'blur(30px) saturate(1.6)',
            WebkitBackdropFilter: 'blur(30px) saturate(1.6)',
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.9), 0 20px 60px -20px rgba(15,23,42,0.14)',
          }}
        >
          {/* Top sheen */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-6 top-0 h-px"
            style={{
              background:
                'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)',
            }}
          />

          <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:items-start">
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
                  <Icon paths={I.shieldAlert} size={10} strokeWidth={2.5} />
                  {RISK_LABEL[risk.level]} · {risk.score}/100
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#00000008] bg-[#00000004] px-2.5 py-1 text-[11px] font-semibold text-[#86868B] dark:border-[#ffffff10] dark:bg-[#ffffff06]">
                  <Icon paths={I.userCircle} size={10} strokeWidth={2.5} />
                  Student 360
                </span>
              </div>

              <h1 className="mt-2 text-3xl font-bold tracking-tighter text-[#1D1D1F] dark:text-[#F5F5F7] sm:text-4xl">
                {student.name}
              </h1>
              <p className="mt-1 text-[13.5px] font-medium text-[#86868B]">
                Holistic Pedagogical Dashboard — attendance, mastery va risk tahlili
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ============================================================
          STATS
      ============================================================ */}
      <motion.div
        variants={containerVariants}
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
      >
        <StatTile
          label="Attendance"
          value={attendance.rate}
          suffix="%"
          icon={I.calendarCheck}
          tone={attendance.rate >= 85 ? 'green' : attendance.rate >= 70 ? 'blue' : 'orange'}
          footNote={`${attendance.present} present · ${attendance.absent} absent`}
        />
        <StatTile
          label="Curriculum Mastery"
          value={academic.overallMastery}
          suffix="%"
          icon={I.target}
          tone={masteryTone(academic.overallMastery)}
          footNote="Across all enrolled objectives"
        />
        <StatTile
          label="Quizzes & Tests"
          value={academic.quizzes.avgScore}
          suffix="%"
          icon={I.fileText}
          tone={masteryTone(academic.quizzes.avgScore)}
          footNote={`${academic.quizzes.passedAttempts} of ${academic.quizzes.totalAttempts} passed`}
        />
      </motion.div>

      {/* ============================================================
          RISK SIGNALS
      ============================================================ */}
      <AnimatePresence>
        {risk.signals.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -12, filter: 'blur(8px)' }}
            transition={SPRING.smooth}
            className="relative overflow-hidden rounded-2xl border p-5"
            style={{
              borderColor: riskC.border,
              background: riskC.bg,
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.4), 0 12px 32px -16px ${riskC.glow}`,
              backdropFilter: 'blur(20px) saturate(1.5)',
              WebkitBackdropFilter: 'blur(20px) saturate(1.5)',
            }}
          >
            {/* Left accent bar */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-4 left-0 w-[3px] rounded-r-full"
              style={{ background: riskC.fg, boxShadow: `0 0 10px ${riskC.glow}` }}
            />

            <div className="relative flex items-start gap-3 pl-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{
                  background: `${riskC.fg}20`,
                  color: riskC.fg,
                  border: `1px solid ${riskC.border}`,
                }}
              >
                <Icon paths={I.shieldAlert} size={18} strokeWidth={2.2} />
              </div>

              <div className="min-w-0 flex-1">
                <div
                  className="text-[10px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: riskC.fg }}
                >
                  Early Pedagogical Risk Signals
                </div>
                <h3 className="mt-1 text-[15px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {risk.signals.length} signal{risk.signals.length > 1 ? 's' : ''} detected
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
          SUBJECT MASTERY
      ============================================================ */}
      <motion.div variants={cardVariants}>
        <div
          className="overflow-hidden rounded-3xl border"
          style={{
            borderColor: 'rgba(255,255,255,0.5)',
            background: 'rgba(255,255,255,0.75)',
            backdropFilter: 'blur(30px) saturate(1.6)',
            WebkitBackdropFilter: 'blur(30px) saturate(1.6)',
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.9), 0 20px 60px -20px rgba(15,23,42,0.14)',
          }}
        >
          <div className="flex items-center gap-3 border-b border-[#00000008] px-5 py-4 dark:border-[#ffffff08]">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#AF52DE]/10 text-[#AF52DE]">
              <Icon paths={I.book} size={15} strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-[14px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                Objective Mastery by Subject
              </h2>
              <p className="text-[11px] font-medium text-[#86868B]">
                {academic.subjectsMastery?.length || 0} subject{academic.subjectsMastery?.length === 1 ? '' : 's'}
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
              <p className="text-[13.5px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                No objectives tracked yet
              </p>
              <p className="text-[12px] font-medium text-[#86868B]">
                Objective mastery will appear once quizzes are graded
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[#00000008] dark:divide-[#ffffff08]">
              {academic.subjectsMastery.map((sm, idx) => {
                const tone = masteryTone(sm.masteryPercentage);
                const c = TONE[tone];
                return (
                  <motion.li
                    key={sm.subjectId}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ ...SPRING.smooth, delay: idx * 0.05 }}
                    className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[#007AFF]/[0.02]"
                  >
                    {/* Progress ring */}
                    <ProgressRing value={sm.masteryPercentage} tone={tone} size={64} stroke={6} />

                    {/* Subject info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-[14px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                          {sm.subjectName}
                        </p>
                        <span
                          className="rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wider"
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
                      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-[#0000000A] dark:bg-[#ffffff10]">
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

                      <div className="mt-2 flex items-center gap-3 text-[11px] font-medium text-[#86868B]">
                        <span>
                          <span className="font-bold tabular-nums text-[#1D1D1F] dark:text-[#F5F5F7]">
                            {sm.masteredObjectives}
                          </span>
                          {' '}of {sm.totalObjectives} objectives mastered
                        </span>
                      </div>
                    </div>

                    {/* Right side mastery label */}
                    <div className="hidden shrink-0 flex-col items-end sm:flex">
                      <span
                        className="text-[20px] font-bold tabular-nums tracking-tight leading-none"
                        style={{ color: c.fg }}
                      >
                        {sm.masteryPercentage}%
                      </span>
                      <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#86868B]">
                        Mastery
                      </span>
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