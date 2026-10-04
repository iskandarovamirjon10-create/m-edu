/**
 * M-EDU FaceRecognitionPage — Apple Design Award Edition
 *
 * Premium craft:
 *  - Hero header with gradient face-scan tile + engine status chip + session state
 *  - Animated KPI bar (Engine, Session, Attempts, Mode) with tone-aware chips
 *  - Premium engine panel with squircle icon + status indicator
 *  - Premium webcam panel with squircle frame + simulation badge
 *  - Premium result card with tone-aware status + expandable raw JSON
 *  - Premium history list with gradient avatars + status badges
 *  - Custom SVG icons in SF Symbols proportions
 *  - Ambient gradient orbs + Framer Motion spring physics
 *  - Full i18n + English fallback + a11y preserved
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { faceApi, groupsApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys.factory';
import {
  GlassErrorState,
  useToasts,
  GlassField,
  GlassSelect,
  GlassButton,
} from '@/components/ui';
import { WebcamCapture } from '@/components/WebcamCapture';
import { formatDateTime } from '@/lib/format';
import { friendlyFaceError } from '@/lib/faceErrors';
import { getErrorMessage } from '@/lib/errorMessages';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';
import { translate } from '@/i18n';
import type {
  Paginated,
  RecognitionAttempt,
  RecognitionSession,
  Group,
  FaceEngineStatus,
} from '@/lib/types';
import { useAttendanceSocket } from '@/hooks/useAttendanceSocket';

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
 * ENGLISH FALLBACK (preserved from original)
 * ========================================================================== */

const FACE_RECOGNITION_EN_FALLBACK: Record<string, string> = {
  'faceRecognition.startSession': 'Start recognition session',
  'faceRecognition.starting': 'Starting…',
  'faceRecognition.sessionActive': 'Session active',
  'faceRecognition.finishSession': 'Finish session',
  'faceRecognition.finishing': 'Finishing…',
};

function useT(): (key: string, vars?: Record<string, string | number>) => string {
  try {
    const { t } = useI18n();
    return t;
  } catch {
    return (key: string, vars?: Record<string, string | number>) => {
      const viaEn = translate('en', key, vars);
      if (viaEn !== key) return viaEn;
      const template = FACE_RECOGNITION_EN_FALLBACK[key];
      if (!template) return key;
      if (!vars) return template;
      return template.replace(/\{(\w+)\}/g, (match, name: string) =>
        name in vars ? String(vars[name]) : match,
      );
    };
  }
}

/* ============================================================================
 * CUSTOM ICONS (SF Symbols proportions)
 * ========================================================================== */

const ICON_STROKE = 1.75;

const I: Record<string, string[]> = {
  scan: [
    'M9 3H5a2 2 0 0 0-2 2v4',
    'M15 3h4a2 2 0 0 1 2 2v4',
    'M21 15v4a2 2 0 0 1-2 2h-4',
    'M9 21H5a2 2 0 0 1-2-2v-4',
    'M9.5 10v.5',
    'M14.5 10v.5',
    'M9 15a4 4 0 0 0 6 0',
  ],
  face: [
    'M9 3H5a2 2 0 0 0-2 2v4',
    'M15 3h4a2 2 0 0 1 2 2v4',
    'M21 15v4a2 2 0 0 1-2 2h-4',
    'M9 21H5a2 2 0 0 1-2-2v-4',
    'M9.5 10v.5',
    'M14.5 10v.5',
    'M9 15a4 4 0 0 0 6 0',
  ],
  camera: [
    'M23 7 16 12 23 17V7z',
    'M14 5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z',
  ],
  sparkles: [
    'M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z',
    'M18.5 3.5v3', 'M20 5h-3',
    'M5.5 18v2.5', 'M6.75 19.25h-2.5',
  ],
  check: ['M20 6 9 17l-5-5'],
  checkCircle: [
    'M22 11.08V12a10 10 0 1 1-5.93-9.14',
    'M22 4 12 14.01l-3-3',
  ],
  xCircle: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M15 9l-6 6', 'M9 9l6 6',
  ],
  alertCircle: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 8v4', 'M12 16h.01',
  ],
  clock: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 6v6l4 2',
  ],
  play: ['M6 4l14 8-14 8z'],
  stop: ['M6 6h12v12H6z'],
  refresh: [
    'M23 4v6h-6',
    'M1 20v-6h6',
    'M3.51 9a9 9 0 0 1 14.85-3.36L23 10',
    'M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
  ],
  warning: [
    'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
    'M12 9v4', 'M12 17h.01',
  ],
  shield: [
    'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    'M9 12l2 2 4-4',
  ],
  fingerprint: [
    'M12 11a2 2 0 0 1 2 2v3', 'M8 13a4 4 0 0 1 8 0v5',
    'M12 22a10 10 0 1 1 0-20 10 10 0 0 1 10 10',
  ],
  activity: ['M22 12h-4l-3 9L9 3l-3 9H2'],
  users: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M22 21v-2a4 4 0 0 0-3-3.9',
    'M16 3.1a4 4 0 0 1 0 7.8',
  ],
  user: [
    'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M20 21v-1a8 8 0 0 0-16 0v1',
  ],
  book: [
    'M12 7v14',
    'M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
  ],
  empty: [
    'M20 7h-9', 'M14 17H5',
    'M19 19v-2a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v2',
    'M10 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  ],
  layers: [
    'M12 2 2 7l10 5 10-5z',
    'M2 17l10 5 10-5',
    'M2 12l10 5 10-5',
  ],
  chevronDown: ['M6 9l6 6 6-6'],
  dot: ['M12 12h.01'],
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

/* ============================================================================
 * TONES
 * ========================================================================== */

type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan' | 'gray' | 'emerald' | 'amber';

const TONES: Record<Tone, { fg: string; bg: string; glow: string; border: string }> = {
  blue:    { fg: '#007AFF', bg: 'rgba(0,122,255,0.10)', glow: 'rgba(0,122,255,0.28)', border: 'rgba(0,122,255,0.20)' },
  green:   { fg: '#34C759', bg: 'rgba(52,199,89,0.10)',  glow: 'rgba(52,199,89,0.28)',  border: 'rgba(52,199,89,0.20)' },
  orange:  { fg: '#FF9500', bg: 'rgba(255,149,0,0.10)',  glow: 'rgba(255,149,0,0.28)',  border: 'rgba(255,149,0,0.20)' },
  red:     { fg: '#FF3B30', bg: 'rgba(255,59,48,0.10)',  glow: 'rgba(255,59,48,0.28)',  border: 'rgba(255,59,48,0.20)' },
  purple:  { fg: '#AF52DE', bg: 'rgba(175,82,222,0.10)', glow: 'rgba(175,82,222,0.28)', border: 'rgba(175,82,222,0.20)' },
  cyan:    { fg: '#32ADE6', bg: 'rgba(50,173,230,0.10)', glow: 'rgba(50,173,230,0.28)', border: 'rgba(50,173,230,0.20)' },
  gray:    { fg: '#86868B', bg: 'rgba(134,134,139,0.10)', glow: 'rgba(134,134,139,0.22)', border: 'rgba(134,134,139,0.20)' },
  emerald: { fg: '#10B981', bg: 'rgba(16,185,129,0.10)', glow: 'rgba(16,185,129,0.28)', border: 'rgba(16,185,129,0.20)' },
  amber:   { fg: '#F59E0B', bg: 'rgba(245,158,11,0.10)', glow: 'rgba(245,158,11,0.28)', border: 'rgba(245,158,11,0.20)' },
};

/* ============================================================================
 * TYPES + CONSTANTS
 * ========================================================================== */

interface RecognitionFormState {
  sessionId: string;
  groupId: string;
}

interface RecognitionResult {
  student?: {
    firstName?: string;
    lastName?: string;
    user?: {
      firstName?: string;
      lastName?: string;
    };
  };
  status: string;
  confidence?: number | string;
  livenessResult?: string;
}

const INITIAL_FORM: RecognitionFormState = {
  sessionId: '',
  groupId: '',
};

/* ============================================================================
 * HELPERS (preserved from original)
 * ========================================================================== */

function formatStudentName(
  student:
    | {
        user?: { firstName?: string; lastName?: string };
        firstName?: string;
        lastName?: string;
      }
    | null
    | undefined,
): string {
  if (!student) return '—';
  if (student.firstName) {
    return [student.firstName, student.lastName].filter(Boolean).join(' ') || '—';
  }
  if (student.user) {
    return [student.user.firstName, student.user.lastName].filter(Boolean).join(' ') || '—';
  }
  return '—';
}

export function formatConfidence(
  confidence: string | number | null | undefined,
): string {
  if (!confidence && confidence !== 0) return '—';
  if (typeof confidence === 'string') {
    if (['HIGH', 'MEDIUM', 'LOW', 'NONE'].includes(confidence)) return confidence;
    const numeric = parseFloat(confidence);
    if (!Number.isNaN(numeric)) return `${(numeric * 100).toFixed(0)}%`;
    return confidence;
  }
  return `${(confidence * 100).toFixed(0)}%`;
}

function formatLivenessResult(result: string | null | undefined): string {
  if (!result) return '—';
  return result
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function truncateSessionId(id: string, maxLength = 10): string {
  return id.length > maxLength ? `${id.slice(0, maxLength)}…` : id;
}

function formatRecognitionResult(result: unknown): RecognitionResult | null {
  if (!result || typeof result !== 'object') return null;
  return result as RecognitionResult;
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

/* ============================================================================
 * PREMIUM SUB-COMPONENTS
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
          background:
            'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.65) 50%, transparent 100%)',
        }}
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

function CountUp({
  value,
  duration = 1.1,
}: {
  value: number;
  duration?: number;
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
      setN(value * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <span className="tabular-nums">{Math.round(n).toLocaleString('uz-UZ')}</span>;
}

/** Ambient gradient orbs — theme-aware */
function AmbientOrbs() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <motion.div
        className="absolute -left-[8%] top-[6%] h-[44%] w-[40%] rounded-full"
        style={{
          background:
            'radial-gradient(closest-side, rgba(0,122,255,0.14), transparent 70%)',
          filter: 'blur(70px)',
        }}
        animate={{ x: [0, 24, 0], y: [0, 18, 0], opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-[10%] -right-[8%] h-[46%] w-[42%] rounded-full"
        style={{
          background:
            'radial-gradient(closest-side, rgba(175,82,222,0.12), transparent 70%)',
          filter: 'blur(80px)',
        }}
        animate={{ x: [0, -28, 0], y: [0, -22, 0], opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

/** Premium KPI tile */
function KpiTile({
  label,
  value,
  icon,
  tone = 'blue',
  stringValue,
  secondary,
}: {
  label: string;
  value?: number;
  icon: string[];
  tone?: Tone;
  stringValue?: string;
  secondary?: string;
}) {
  const c = TONES[tone];
  return (
    <motion.div
      variants={rowVariants}
      whileHover={{ y: -3 }}
      transition={SPRING.smooth}
      className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-[#ffffff60] bg-[#ffffff80] px-4 py-3.5 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
      style={{
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.6), 0 4px 16px -8px rgba(0,0,0,0.06)',
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
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-xl"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.4), transparent)' }}
        />
        <Icon paths={icon} size={18} strokeWidth={2} className="relative" />
      </div>
      <div className="relative min-w-0 flex-1">
        <div className="text-[22px] font-bold tracking-tighter leading-none text-[#1D1D1F] dark:text-[#F5F5F7]">
          {typeof value === 'number' ? <CountUp value={value} /> : stringValue}
        </div>
        <div className="mt-1.5 truncate text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#86868B]">
          {label}
        </div>
        {secondary && (
          <div className="mt-0.5 truncate text-[10.5px] font-semibold tracking-tight text-[#86868B]/80">
            {secondary}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/** Premium engine status pill */
function EngineStatusPill({
  isReal,
  provider,
  loading,
}: {
  isReal: boolean;
  provider?: string;
  loading?: boolean;
}) {
  const tone: Tone = isReal ? 'emerald' : 'amber';
  const c = TONES[tone];
  return (
    <span
      className="relative inline-flex items-center gap-2 rounded-xl px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.12em]"
      style={{
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
      }}
    >
      <span className="relative flex h-1.5 w-1.5">
        {!loading && (
          <motion.span
            className="absolute inset-0 rounded-full"
            style={{ background: c.fg, opacity: 0.6 }}
            animate={{ scale: [1, 2.4, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        <span
          className="relative h-1.5 w-1.5 rounded-full"
          style={{ background: c.fg }}
        />
      </span>
      {provider ?? '—'}
    </span>
  );
}

/** Session status pill */
function SessionStatusPill({ sessionId }: { sessionId: string }) {
  const c = TONES.emerald;
  return (
    <span
      className="relative inline-flex items-center gap-2 rounded-xl px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.12em]"
      style={{
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
      }}
      title={sessionId}
    >
      <span className="relative flex h-1.5 w-1.5">
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{ background: c.fg, opacity: 0.6 }}
          animate={{ scale: [1, 2.4, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
        />
        <span className="relative h-1.5 w-1.5 rounded-full" style={{ background: c.fg }} />
      </span>
      <span className="font-mono normal-case tracking-normal">
        {truncateSessionId(sessionId)}
      </span>
    </span>
  );
}

/** Result status badge */
function RecognitionStatusBadge({ status }: { status: string }) {
  const tone: Tone =
    status === 'RECOGNIZED' || status === 'ATTENDANCE_RECORDED'
      ? 'emerald'
      : status === 'UNKNOWN' || status === 'SPOOF_DETECTED' || status === 'BLOCKED'
        ? 'red'
        : status === 'LOW_CONFIDENCE'
          ? 'amber'
          : 'gray';
  const c = TONES[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.10em]"
      style={{
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.fg }} />
      {status}
    </span>
  );
}

/** Squircle leading icon */
function FieldIcon({ icon, tone = 'blue' }: { icon: string[]; tone?: Tone }) {
  const c = TONES[tone];
  return (
    <span
      className="pointer-events-none absolute left-3 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-lg"
      style={{ background: c.bg, color: c.fg }}
      aria-hidden
    >
      <Icon paths={icon} size={12} strokeWidth={2.2} />
    </span>
  );
}

/** Mini tone-aware action button */
function MiniAction({
  icon,
  label,
  tone,
  onClick,
  disabled,
  primary,
  ariaLabel,
}: {
  icon: string[];
  label: string;
  tone: Tone;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  ariaLabel?: string;
}) {
  const c = TONES[tone];
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: 1.04, y: -1 }}
      whileTap={{ scale: 0.96 }}
      transition={SPRING.snappy}
      aria-label={ariaLabel}
      title={label}
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold tracking-tight outline-none disabled:opacity-50"
      style={{
        background: primary ? c.fg : c.bg,
        color: primary ? '#fff' : c.fg,
        border: `1px solid ${primary ? c.fg : c.border}`,
        boxShadow: primary
          ? `inset 0 1px 0 rgba(255,255,255,0.35), 0 6px 16px -6px ${c.glow}`
          : `inset 0 1px 0 rgba(255,255,255,0.4)`,
      }}
    >
      <Icon paths={icon} size={12} strokeWidth={2.6} />
      <span>{label}</span>
    </motion.button>
  );
}

/* ============================================================================
 * MAIN PAGE
 * ========================================================================== */

export function FaceRecognitionPage() {
  const t = useT();
  usePageTitle(t('faceRecognition.title'));

  const { push, toastNode } = useToasts();
  const queryClient = useQueryClient();
  useAttendanceSocket();

  const [form, setForm] = useState<RecognitionFormState>(INITIAL_FORM);
  const [result, setResult] = useState<unknown>(null);
  const [rawExpanded, setRawExpanded] = useState(false);

  /* ── Queries ──────────────────────────────────────────────────────── */
  const engine = useQuery({
    queryKey: queryKeys.face.engine(),
    queryFn: faceApi.engineStatus,
    placeholderData: (previousData) => previousData,
  });

  const groups = useQuery({
    queryKey: queryKeys.groups.selectors(),
    queryFn: () => groupsApi.list({ limit: 100 }),
    placeholderData: (previousData) => previousData,
    staleTime: 5 * 60 * 1000,
  });

  const history = useQuery({
    queryKey: queryKeys.face.history(),
    queryFn: () => faceApi.recognitionHistory({ limit: 20 }),
    placeholderData: (previousData) => previousData,
  });

  const groupList = useMemo(
    () => (groups.data as Paginated<Group> | undefined)?.items || [],
    [groups.data],
  );

  const activeGroups = useMemo(
    () => groupList.filter((group) => group.isActive),
    [groupList],
  );

  const engineStatus = engine.data as FaceEngineStatus | undefined;
  const historyData = history.data as Paginated<RecognitionAttempt> | undefined;

  const historyList = useMemo(() => historyData?.items || [], [historyData]);

  /* ── Mutations ────────────────────────────────────────────────────── */
  const startSession = useMutation({
    mutationFn: () => faceApi.startSession({ groupId: form.groupId || undefined }),
    onSuccess: (response) => {
      const session = response as RecognitionSession;
      setForm((previous) => ({
        ...previous,
        sessionId: session.sessionId ?? session.id,
      }));
      setResult(null);
      push('success', t('faceRecognition.sessionStarted'));
    },
    onError: (error: Error) => {
      push('error', friendlyFaceError(error));
    },
  });

  const submit = useMutation({
    mutationFn: (base64: string) => faceApi.submitAttempt(form.sessionId, base64),
    onSuccess: (response) => {
      setResult(response);
      push('success', t('faceRecognition.attemptProcessed'));
      queryClient.invalidateQueries({ queryKey: queryKeys.face.history() });
      queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all() });
      queryClient.invalidateQueries({ queryKey: ['attendance-analytics'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
    },
    onError: (error: Error) => {
      push('error', friendlyFaceError(error));
    },
  });

  const finish = useMutation({
    mutationFn: () => faceApi.finishSession(form.sessionId, 'operator_finished'),
    onSuccess: () => {
      push('success', t('faceRecognition.sessionFinished'));
      setForm((previous) => ({ ...previous, sessionId: '' }));
      setResult(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.face.history() });
      queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all() });
      queryClient.invalidateQueries({ queryKey: ['attendance-analytics'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
    },
    onError: (error: Error) => {
      push('error', friendlyFaceError(error));
    },
  });

  /* ── Handlers ─────────────────────────────────────────────────────── */
  const handleGroupChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      setForm((previous) => ({ ...previous, groupId: event.target.value }));
    },
    [],
  );

  const handleStartSession = useCallback(() => {
    startSession.mutate();
  }, [startSession]);

  const handleFinishSession = useCallback(() => {
    finish.mutate();
  }, [finish]);

  const handleCapture = useCallback(
    (base64: string) => {
      if (!form.sessionId) {
        push('error', t('faceRecognition.noSession'));
        return;
      }
      submit.mutate(base64);
    },
    [form.sessionId, push, submit, t],
  );

  const handleRetryHistory = useCallback(() => {
    void history.refetch();
  }, [history]);

  const handleRetryEngine = useCallback(() => {
    void engine.refetch();
  }, [engine]);

  const isSessionActive = Boolean(form.sessionId);
  const isMockEngine = engineStatus ? !engineStatus.isReal : false;
  const recognitionResult = formatRecognitionResult(result);

  /* ── Derived stats ────────────────────────────────────────────────── */
  const stats = useMemo(() => {
    const total = historyList.length;
    const recognized = historyList.filter(
      (a) => a.status === 'RECOGNIZED' || a.status === 'ATTENDANCE_RECORDED',
    ).length;
    const unknown = historyList.filter(
      (a) => a.status === 'UNKNOWN' || a.status === 'SPOOF_DETECTED',
    ).length;
    return { total, recognized, unknown };
  }, [historyList]);

  /* ── Render ───────────────────────────────────────────────────────── */
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="relative page-container space-y-5 pb-8"
    >
      <AmbientOrbs />
      {toastNode}

      {/* ============================================================
          HERO HEADER
      ============================================================ */}
      <motion.div variants={cardVariants}>
        <div
          className="relative overflow-hidden rounded-3xl border border-[#ffffff60] bg-[#ffffff80] p-6 backdrop-blur-2xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80] sm:p-7"
          style={{
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.7), 0 10px 30px -18px rgba(0,0,0,0.12)',
          }}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-24"
            style={{
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)',
            }}
          />
          <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, rotate: -6 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={SPRING.smooth}
              className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-white"
              style={{
                background: 'linear-gradient(135deg, #007AFF 0%, #AF52DE 100%)',
                boxShadow:
                  '0 12px 28px -10px rgba(0,122,255,0.55), inset 0 2px 0 rgba(255,255,255,0.35)',
              }}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-2xl"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(255,255,255,0.45), transparent 55%)',
                }}
              />
              <Icon paths={I.scan} size={28} strokeWidth={2} className="relative" />
            </motion.div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#007AFF]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#007AFF]">
                  <Icon paths={I.sparkles} size={11} strokeWidth={2.5} />
                  Recognition
                </span>
                {engineStatus && (
                  <EngineStatusPill
                    isReal={engineStatus.isReal}
                    provider={engineStatus.provider || t('common.unknown')}
                    loading={engine.isFetching}
                  />
                )}
                {isSessionActive && <SessionStatusPill sessionId={form.sessionId} />}
              </div>

              <h1 className="mt-2 text-3xl font-bold tracking-tighter text-[#1D1D1F] dark:text-[#F5F5F7] sm:text-4xl">
                {t('faceRecognition.title')}
              </h1>
              <p className="mt-1 text-[13.5px] font-medium text-[#86868B]">
                {t('faceRecognition.subtitle')}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ============================================================
          KPI BAR
      ============================================================ */}
      <motion.div
        variants={containerVariants}
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        <KpiTile
          label={t('faceRecognition.engineLabel')}
          stringValue={
            engine.isLoading && !engineStatus
              ? '…'
              : engineStatus?.isReal
                ? 'Real'
                : 'Mock'
          }
          icon={I.activity}
          tone={engineStatus?.isReal ? 'emerald' : 'amber'}
          secondary={engineStatus?.provider}
        />
        <KpiTile
          label={t('faceRecognition.sessionActive')}
          stringValue={isSessionActive ? 'Active' : 'Idle'}
          icon={isSessionActive ? I.play : I.stop}
          tone={isSessionActive ? 'blue' : 'gray'}
        />
        <KpiTile
          label={t('faceRecognition.historyTitle')}
          value={stats.total}
          icon={I.layers}
          tone="purple"
        />
        <KpiTile
          label={t('faceRecognition.confidence')}
          value={stats.recognized}
          icon={I.checkCircle}
          tone="emerald"
          secondary={`${stats.unknown} unknown`}
        />
      </motion.div>

      {/* ============================================================
          ENGINE + SESSION CONTROL PANEL
      ============================================================ */}
      <motion.div variants={cardVariants}>
        <div
          className="relative overflow-hidden rounded-3xl border border-[#ffffff60] bg-[#ffffff80] p-5 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
          style={{
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.7), 0 10px 30px -18px rgba(0,0,0,0.12)',
          }}
          aria-label={t('faceRecognition.engineLabel')}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-16"
            style={{
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)',
            }}
          />

          <div className="relative flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
                style={{
                  background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
                  boxShadow:
                    'inset 0 1px 0 rgba(255,255,255,0.35), 0 6px 16px -6px rgba(0,122,255,0.5)',
                }}
              >
                <Icon paths={I.sparkles} size={18} strokeWidth={2} />
              </div>

              <div className="min-w-0">
                <h2 className="text-[14px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {t('faceRecognition.engineLabel')}
                </h2>
                <p className="mt-0.5 max-w-xl text-[12px] font-medium leading-5 text-[#86868B]">
                  {isSessionActive
                    ? t('faceRecognition.sessionActive')
                    : t('faceRecognition.startFirst')}
                </p>
              </div>
            </div>

            {isSessionActive ? (
              <div className="flex flex-col gap-3 rounded-2xl border border-[#34C75933] bg-[#34C759]/[0.06] p-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 items-center gap-2">
                  <SessionStatusPill sessionId={form.sessionId} />
                </div>
                <MiniAction
                  icon={I.stop}
                  label={
                    finish.isPending
                      ? t('faceRecognition.finishing')
                      : t('faceRecognition.finishSession')
                  }
                  tone="red"
                  onClick={handleFinishSession}
                  disabled={finish.isPending}
                  ariaLabel={t('faceRecognition.finishSession')}
                />
              </div>
            ) : (
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end">
                <GlassField label={t('faceRecognition.groupOptional')}>
                  <div className="relative sm:min-w-52">
                    <FieldIcon icon={I.users} tone="purple" />
                    <GlassSelect
                      value={form.groupId}
                      onChange={handleGroupChange}
                      aria-label={t('faceRecognition.groupSelectAria')}
                      disabled={startSession.isPending}
                      className="pl-11"
                    >
                      <option value="">{t('faceRecognition.anyGroup')}</option>
                      {activeGroups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                    </GlassSelect>
                  </div>
                </GlassField>

                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={SPRING.snappy}
                >
                  <GlassButton
                    type="button"
                    variant="primary"
                    onClick={handleStartSession}
                    disabled={startSession.isPending}
                    aria-busy={startSession.isPending}
                  >
                    <span className="inline-flex items-center gap-2">
                      {startSession.isPending ? (
                        <>
                          <motion.span
                            className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                          />
                          {t('faceRecognition.starting')}
                        </>
                      ) : (
                        <>
                          <Icon paths={I.play} size={14} strokeWidth={2.4} />
                          {t('faceRecognition.startSession')}
                        </>
                      )}
                    </span>
                  </GlassButton>
                </motion.div>
              </div>
            )}
          </div>

          {isMockEngine && (
            <div
              className="relative mt-5 flex items-start gap-2.5 rounded-2xl border border-[#F59E0B33] bg-[#F59E0B]/[0.08] px-4 py-3 text-[12px] font-medium leading-5 text-[#B45309] dark:text-[#FCD34D]"
              role="note"
            >
              <Icon paths={I.warning} size={14} strokeWidth={2.2} className="mt-0.5 shrink-0" />
              <span>{t('faceRecognition.mockNotice')}</span>
            </div>
          )}

          {startSession.isError && (
            <div
              className="relative mt-4 flex items-start gap-2.5 rounded-2xl border border-[#FF3B3033] bg-[#FF3B30]/[0.06] px-4 py-3 text-[12.5px] font-medium leading-5 text-[#FF3B30]"
              role="alert"
            >
              <Icon paths={I.xCircle} size={14} strokeWidth={2.2} className="mt-0.5 shrink-0" />
              <span>{friendlyFaceError(startSession.error as Error)}</span>
            </div>
          )}

          {engine.isError && (
            <div className="relative mt-4 flex items-center gap-3">
              <span className="text-[12px] font-medium text-[#FF3B30]">
                {t('faceRecognition.engineRetry')}
              </span>
              <MiniAction
                icon={I.refresh}
                label={t('faceRecognition.engineRetry')}
                tone="red"
                onClick={handleRetryEngine}
              />
            </div>
          )}
        </div>
      </motion.div>

      {/* ============================================================
          WEBCAM + HISTORY GRID
      ============================================================ */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,.92fr)]">
        {/* WEBCAM PANEL */}
        <motion.section
          variants={cardVariants}
          className="relative overflow-hidden rounded-3xl border border-[#ffffff60] bg-[#ffffff80] backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
          style={{
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.7), 0 10px 30px -18px rgba(0,0,0,0.12)',
          }}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-16"
            style={{
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)',
            }}
          />

          <div className="relative flex items-center justify-between gap-3 border-b border-[#00000008] px-5 py-4 dark:border-[#ffffff08]">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#007AFF]/10 text-[#007AFF]">
                <Icon paths={I.camera} size={16} strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-[13.5px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {isSessionActive
                    ? t('faceRecognition.submitCapture')
                    : t('faceRecognition.startFirst')}
                </h2>
                <p className="mt-0.5 text-[11px] font-medium text-[#86868B]">
                  {isSessionActive
                    ? t('faceRecognition.recognizeFace')
                    : t('faceRecognition.captureHint')}
                </p>
              </div>
            </div>
            {isSessionActive && (
              <span className="relative inline-flex items-center gap-1.5 rounded-xl bg-[#34C759]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#34C759]">
                <span className="relative flex h-1.5 w-1.5">
                  <motion.span
                    className="absolute inset-0 rounded-full bg-[#34C759]"
                    animate={{ scale: [1, 2.4, 1], opacity: [0.6, 0, 0.6] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                  />
                  <span className="relative h-1.5 w-1.5 rounded-full bg-[#34C759]" />
                </span>
                Live
              </span>
            )}
          </div>

          <div className="relative p-5">
            {isSessionActive ? (
              <div
                className="relative overflow-hidden rounded-2xl border border-[#00000008] bg-[#00000003] dark:border-[#ffffff08] dark:bg-[#ffffff04]"
              >
                <WebcamCapture
                  onCapture={handleCapture}
                  busy={submit.isPending}
                  label={t('faceRecognition.recognizeFace')}
                />
                {isMockEngine && (
                  <div className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-[#F59E0B] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-md">
                    <Icon paths={I.warning} size={10} strokeWidth={2.4} />
                    Simulation
                  </div>
                )}
              </div>
            ) : (
              <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-[#00000015] bg-[#00000002] px-6 text-center dark:border-[#ffffff15] dark:bg-[#ffffff04]">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#007AFF]/10 text-[#007AFF]">
                  <Icon paths={I.camera} size={22} strokeWidth={1.9} />
                </div>
                <p className="max-w-sm text-[12.5px] font-medium leading-6 text-[#86868B]">
                  {t('faceRecognition.captureHint')}
                </p>
              </div>
            )}

            {submit.isError && (
              <div
                className="mt-4 flex items-start gap-2.5 rounded-2xl border border-[#FF3B3033] bg-[#FF3B30]/[0.06] px-4 py-3 text-[12.5px] font-medium leading-5 text-[#FF3B30]"
                role="alert"
              >
                <Icon paths={I.xCircle} size={14} strokeWidth={2.2} className="mt-0.5 shrink-0" />
                <span>{friendlyFaceError(submit.error as Error)}</span>
              </div>
            )}

            {recognitionResult && (
              <motion.div
                initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={SPRING.smooth}
                className="mt-5 rounded-2xl border border-[#00000008] bg-[#00000002] p-4 dark:border-[#ffffff08] dark:bg-[#ffffff04]"
                role="status"
                aria-live="polite"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
                    {t('faceRecognition.resultTitle')}
                  </h3>
                  <RecognitionStatusBadge status={recognitionResult.status} />
                </div>

                <div className="divide-y divide-[#00000008] dark:divide-[#ffffff08]">
                  <ResultRow
                    icon={I.user}
                    label={t('faceRecognition.student')}
                    value={formatStudentName(recognitionResult.student)}
                  />
                  <ResultRow
                    icon={I.shield}
                    label={t('common.status')}
                    value={
                      <RecognitionStatusBadge status={recognitionResult.status} />
                    }
                  />
                  <ResultRow
                    icon={I.activity}
                    label={t('faceRecognition.confidence')}
                    value={
                      <span className="font-bold tabular-nums text-[#1D1D1F] dark:text-[#F5F5F7]">
                        {formatConfidence(recognitionResult.confidence)}
                      </span>
                    }
                  />
                  <ResultRow
                    icon={I.fingerprint}
                    label={t('faceRecognition.liveness')}
                    value={formatLivenessResult(recognitionResult.livenessResult)}
                  />
                </div>

                <div className="mt-4 border-t border-[#00000008] pt-3 dark:border-[#ffffff08]">
                  <button
                    type="button"
                    onClick={() => setRawExpanded((v) => !v)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1 text-left text-[11.5px] font-semibold text-[#86868B] outline-none transition-colors hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]"
                    aria-expanded={rawExpanded}
                  >
                    <span>{t('faceRecognition.viewRaw')}</span>
                    <motion.span
                      animate={{ rotate: rawExpanded ? 180 : 0 }}
                      transition={SPRING.snappy}
                    >
                      <Icon paths={I.chevronDown} size={14} strokeWidth={2.4} />
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {rawExpanded && (
                      <motion.pre
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={SPRING.smooth}
                        className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-[#00000004] p-3 font-mono text-[11px] leading-relaxed text-[#1D1D1F] dark:bg-[#ffffff04] dark:text-[#F5F5F7]"
                      >
                        {JSON.stringify(result, null, 2)}
                      </motion.pre>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </div>
        </motion.section>

        {/* HISTORY PANEL */}
        <motion.section
          variants={cardVariants}
          className="relative min-w-0 overflow-hidden rounded-3xl border border-[#ffffff60] bg-[#ffffff80] backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
          style={{
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.7), 0 10px 30px -18px rgba(0,0,0,0.12)',
          }}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-16"
            style={{
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)',
            }}
          />

          <div className="relative flex items-center justify-between gap-3 border-b border-[#00000008] px-5 py-4 dark:border-[#ffffff08]">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#AF52DE]/10 text-[#AF52DE]">
                <Icon paths={I.layers} size={16} strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-[13.5px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {t('faceRecognition.historyTitle')}
                </h2>
                <p className="mt-0.5 text-[11px] font-medium text-[#86868B]">
                  {historyList.length > 0
                    ? `${historyList.length} records`
                    : '—'}
                </p>
              </div>
            </div>

            {history.isFetching && !history.isLoading && (
              <motion.span
                className="h-3.5 w-3.5 rounded-full border-2 border-[#007AFF]/30 border-t-[#007AFF]"
                animate={{ rotate: 360 }}
                transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
              />
            )}
          </div>

          {history.isLoading && !historyData ? (
            <div className="p-5 space-y-2.5">
              {[1, 2, 3, 4].map((i) => (
                <Shimmer key={i} className="h-16" radius="1rem" />
              ))}
            </div>
          ) : history.isError ? (
            <div className="p-8">
              <GlassErrorState
                title={t('faceRecognition.historyError')}
                message={getErrorMessage(history.error as Error)}
                onRetry={handleRetryHistory}
              />
            </div>
          ) : historyList.length === 0 ? (
            <div className="p-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#AF52DE]/10 text-[#AF52DE]">
                <Icon paths={I.empty} size={22} strokeWidth={1.8} />
              </div>
              <p className="mt-3 text-[13.5px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                {t('faceRecognition.emptyHistory')}
              </p>
              <p className="mx-auto mt-1 max-w-sm text-[12px] font-medium text-[#86868B]">
                {t('faceRecognition.emptyHistoryHint')}
              </p>
            </div>
          ) : (
            <div className="relative divide-y divide-[#00000008] dark:divide-[#ffffff08]">
              {historyList.slice(0, 15).map((attempt, idx) => {
                const name = formatStudentName(attempt.student);
                const initials = getInitials(name);
                const gradient = avatarGradient(name);
                return (
                  <motion.div
                    key={attempt.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ ...SPRING.smooth, delay: idx * 0.03 }}
                    className="flex flex-wrap items-center gap-3 px-5 py-3 transition-colors hover:bg-[#AF52DE]/[0.03]"
                  >
                    <div
                      className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ring-2 ring-white/50 dark:ring-black/30"
                      style={{
                        background: gradient,
                        boxShadow:
                          'inset 0 1px 0 rgba(255,255,255,0.35), 0 4px 12px -4px rgba(0,0,0,0.25)',
                      }}
                    >
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-0 rounded-full"
                        style={{
                          background:
                            'linear-gradient(180deg, rgba(255,255,255,0.4), transparent 55%)',
                        }}
                      />
                      <span className="relative">{initials}</span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                        {name}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-medium tabular-nums text-[#86868B]">
                        <span className="inline-flex items-center gap-1">
                          <Icon paths={I.clock} size={10} strokeWidth={2.2} className="opacity-60" />
                          {formatDateTime(attempt.occurredAt)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Icon paths={I.activity} size={10} strokeWidth={2.2} className="opacity-60" />
                          {formatConfidence(attempt.confidence)}
                        </span>
                      </div>
                    </div>

                    <RecognitionStatusBadge status={attempt.status} />
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.section>
      </div>
    </motion.div>
  );
}

/* ============================================================================
 * RESULT ROW
 * ========================================================================== */

function ResultRow({
  icon,
  label,
  value,
}: {
  icon: string[];
  label: string;
  value: React.ReactNode;
}) {
  const c = TONES.blue;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-2.5">
      <span className="inline-flex items-center gap-2 text-[12px] font-medium text-[#86868B]">
        <span
          className="flex h-6 w-6 items-center justify-center rounded-lg"
          style={{ background: c.bg, color: c.fg }}
        >
          <Icon paths={icon} size={11} strokeWidth={2.2} />
        </span>
        {label}
      </span>
      <span className="text-right text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
        {value}
      </span>
    </div>
  );
}