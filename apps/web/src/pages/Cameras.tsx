/**
 * M-EDU CamerasPage — Apple Design Award Edition
 *
 * Premium craft:
 *  - Hero header with gradient camera tile + live chips + dual CTA
 *  - Animated KPI bar (Total, Online, Errors, Recognition) with count-up
 *  - Premium camera rows: squircle gradient icon + endpoint mono chip + status badge
 *  - Expandable detail panel with premium tabs (Events / Health / Worker)
 *  - Premium empty/loading/error states
 *  - Shimmer skeletons (not pulse)
 *  - Custom SVG icons in SF Symbols proportions
 *  - Framer Motion spring physics + staggered blur-in
 *  - Full i18n + a11y preserved
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { camerasApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys.factory';
import {
  GlassPageLoader,
  GlassErrorState,
  GlassField,
  GlassInput,
  GlassSelect,
  GlassModal,
  GlassButton,
  ConfirmDialog,
  useToasts,
} from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Camera, CameraProtocol } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';
import type { TranslateFn } from '@/i18n/I18nProvider';

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
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: SPRING.smooth },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0, transition: SPRING.smooth },
};

/* ============================================================================
 * CUSTOM ICONS (SF Symbols proportions)
 * ========================================================================== */

const ICON_STROKE = 1.75;

const I: Record<string, string[]> = {
  camera: [
    'M23 7 16 12 23 17V7z',
    'M14 5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z',
  ],
  video: [
    'M15 10l4.55-2.28A1 1 0 0 1 21 8.62v6.76a1 1 0 0 1-1.45.9L15 14',
    'M3 6h12v12H3z',
  ],
  radio: [
    'M4.93 4.93a10 10 0 0 0 0 14.14',
    'M19.07 19.07a10 10 0 0 0 0-14.14',
    'M7.76 7.76a6 6 0 0 0 0 8.49',
    'M16.24 16.24a6 6 0 0 0 0-8.49',
    'M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
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
  plus: ['M12 5v14', 'M5 12h14'],
  search: [
    'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
    'M21 21l-4.35-4.35',
  ],
  radar: [
    'M19.07 4.93A10 10 0 0 0 6.99 3.34',
    'M4 6h.01',
    'M2.29 9.62A10 10 0 1 0 21.31 8.35',
    'M16.24 7.76A6 6 0 1 0 8.23 16.67',
    'M12 18h.01', 'M17.99 11.66A6 6 0 0 1 15.77 16.67',
    'M12 12 4 4',
  ],
  play: ['M6 4l14 8-14 8z'],
  stop: ['M6 6h12v12H6z'],
  refresh: [
    'M23 4v6h-6',
    'M1 20v-6h6',
    'M3.51 9a9 9 0 0 1 14.85-3.36L23 10',
    'M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
  ],
  settings: [
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  ],
  trash: [
    'M3 6h18',
    'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6',
    'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
    'M10 11v6', 'M14 11v6',
  ],
  plug: [
    'M9 2v6',
    'M15 2v6',
    'M6 8h12v4a6 6 0 0 1-6 6 6 6 0 0 1-6-6z',
    'M12 18v4',
  ],
  shield: [
    'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    'M9 12l2 2 4-4',
  ],
  sparkles: [
    'M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z',
    'M18.5 3.5v3', 'M20 5h-3',
    'M5.5 18v2.5', 'M6.75 19.25h-2.5',
  ],
  layers: [
    'M12 2 2 7l10 5 10-5z',
    'M2 17l10 5 10-5',
    'M2 12l10 5 10-5',
  ],
  fingerprint: [
    'M12 11a2 2 0 0 1 2 2v3', 'M8 13a4 4 0 0 1 8 0v5',
    'M12 22a10 10 0 1 1 0-20 10 10 0 0 1 10 10',
  ],
  activity: [
    'M22 12h-4l-3 9L9 3l-3 9H2',
  ],
  server: [
    'M20 3H4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z',
    'M20 13H4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2z',
    'M6 7h.01', 'M6 17h.01',
  ],
  empty: [
    'M20 7h-9', 'M14 17H5',
    'M19 19v-2a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v2',
    'M10 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  ],
  warning: [
    'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
    'M12 9v4', 'M12 17h.01',
  ],
  router: [
    'M3 3h18v6H3z',
    'M6.01 6h.01', 'M9.01 6h.01',
    'M12 9v6',
    'M7 15h10v6H7z',
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

type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan' | 'gray' | 'emerald';

const TONES: Record<Tone, { fg: string; bg: string; glow: string; border: string }> = {
  blue:    { fg: '#007AFF', bg: 'rgba(0,122,255,0.10)', glow: 'rgba(0,122,255,0.28)', border: 'rgba(0,122,255,0.20)' },
  green:   { fg: '#34C759', bg: 'rgba(52,199,89,0.10)',  glow: 'rgba(52,199,89,0.28)',  border: 'rgba(52,199,89,0.20)' },
  orange:  { fg: '#FF9500', bg: 'rgba(255,149,0,0.10)',  glow: 'rgba(255,149,0,0.28)',  border: 'rgba(255,149,0,0.20)' },
  red:     { fg: '#FF3B30', bg: 'rgba(255,59,48,0.10)',  glow: 'rgba(255,59,48,0.28)',  border: 'rgba(255,59,48,0.20)' },
  purple:  { fg: '#AF52DE', bg: 'rgba(175,82,222,0.10)', glow: 'rgba(175,82,222,0.28)', border: 'rgba(175,82,222,0.20)' },
  cyan:    { fg: '#32ADE6', bg: 'rgba(50,173,230,0.10)', glow: 'rgba(50,173,230,0.28)', border: 'rgba(50,173,230,0.20)' },
  gray:    { fg: '#86868B', bg: 'rgba(134,134,139,0.10)', glow: 'rgba(134,134,139,0.22)', border: 'rgba(134,134,139,0.20)' },
  emerald: { fg: '#10B981', bg: 'rgba(16,185,129,0.10)', glow: 'rgba(16,185,129,0.28)', border: 'rgba(16,185,129,0.20)' },
};

/* ============================================================================
 * CONSTANTS
 * ========================================================================== */

const CAMERA_PROTOCOLS: CameraProtocol[] = ['RTSP', 'ONVIF'];

const CAMERA_STATUS_LABEL_KEYS: Record<string, string> = {
  CONFIGURED: 'cameras.status.CONFIGURED',
  CONNECTING: 'cameras.status.CONNECTING',
  ONLINE: 'cameras.status.ONLINE',
  ERROR: 'cameras.status.ERROR',
  DISABLED: 'cameras.status.DISABLED',
  RECONNECTING: 'cameras.status.RECONNECTING',
};

const CAMERA_STATUS_TONE: Record<string, Tone> = {
  CONFIGURED: 'blue',
  CONNECTING: 'cyan',
  ONLINE: 'emerald',
  ERROR: 'red',
  DISABLED: 'gray',
  RECONNECTING: 'orange',
};

const CAMERA_STATUS_PULSE: Record<string, boolean> = {
  ONLINE: true,
  RECONNECTING: true,
  CONNECTING: true,
};

interface CameraFormState {
  name: string;
  host: string;
  port: string;
  protocol: CameraProtocol;
  streamPath: string;
  location: string;
  username: string;
  password: string;
}

interface DiscoveredCamera {
  host: string;
  port: number;
  protocol: CameraProtocol;
  name?: string;
}

const INITIAL_FORM: CameraFormState = {
  name: '',
  host: '',
  port: '554',
  protocol: 'RTSP',
  streamPath: '',
  location: '',
  username: '',
  password: '',
};

type TabKey = 'events' | 'health' | 'worker';

/* ============================================================================
 * HELPERS
 * ========================================================================== */

function formatEndpoint(camera: Camera): string {
  return `${camera.host}:${camera.port}`;
}

function nameHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const CAMERA_PALETTES = [
  ['#007AFF', '#5856D6'],
  ['#AF52DE', '#FF2D55'],
  ['#34C759', '#32ADE6'],
  ['#FF9500', '#FF2D55'],
  ['#5856D6', '#AF52DE'],
  ['#32ADE6', '#007AFF'],
];

function cameraGradient(name: string): string {
  const [a, b] = CAMERA_PALETTES[nameHash(name) % CAMERA_PALETTES.length];
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

function CamerasSkeleton() {
  return (
    <div className="space-y-5">
      <Shimmer className="h-28 w-full" radius="1.75rem" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <Shimmer key={i} className="h-[88px]" radius="1rem" />)}
      </div>
      <Shimmer className="h-96 w-full" radius="1.75rem" />
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

/** Premium KPI tile */
function KpiTile({
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
          <CountUp value={value} />
        </div>
        <div className="mt-1.5 truncate text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#86868B]">
          {label}
        </div>
      </div>
    </motion.div>
  );
}

/** Premium camera status badge with pulse */
function CameraStatusBadge({ status, label }: { status: string; label: string }) {
  const tone = CAMERA_STATUS_TONE[status] ?? 'gray';
  const c = TONES[tone];
  const pulse = CAMERA_STATUS_PULSE[status];
  return (
    <span
      className="relative inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.12em]"
      style={{
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
      }}
    >
      <span className="relative flex h-1.5 w-1.5">
        {pulse && (
          <motion.span
            className="absolute inset-0 rounded-full"
            style={{ background: c.fg, opacity: 0.6 }}
            animate={{ scale: [1, 2.4, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        <span className="relative h-1.5 w-1.5 rounded-full" style={{ background: c.fg }} />
      </span>
      {label}
    </span>
  );
}

/** Premium recognition chip */
function RecognitionChip({ enabled, t }: { enabled: boolean; t: TranslateFn }) {
  const tone: Tone = enabled ? 'purple' : 'gray';
  const c = TONES[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.10em]"
      style={{
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
      }}
    >
      <Icon paths={I.fingerprint} size={10} strokeWidth={2.2} />
      {enabled ? t('common.on') : t('common.off')}
    </span>
  );
}

/** Protocol chip */
function ProtocolChip({ protocol }: { protocol: string }) {
  const tone: Tone = protocol === 'RTSP' ? 'cyan' : 'purple';
  const c = TONES[tone];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider"
      style={{
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
      }}
    >
      {protocol}
    </span>
  );
}

/** Squircle leading icon for inputs */
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
      <Icon paths={icon} size={11} strokeWidth={2.6} />
      <span className="hidden sm:inline">{label}</span>
    </motion.button>
  );
}

/* ============================================================================
 * TAB CONTENT
 * ========================================================================== */

function CameraEventsTable({ data }: { data: unknown }) {
  const { t } = useI18n();
  const events =
    (data as {
      items?: Array<{
        id: string;
        recognizedAt: string;
        student?: { user?: { firstName?: string; lastName?: string } };
        decision: string;
        confidence?: string;
        similarityScore?: string;
      }>;
    })?.items ?? [];

  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#00000015] p-8 text-center dark:border-[#ffffff15]">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#007AFF]/10 text-[#007AFF]">
          <Icon paths={I.empty} size={20} strokeWidth={1.9} />
        </div>
        <p className="mt-3 text-[12.5px] font-medium text-[#86868B]">
          {t('cameras.noEvents')}
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-[#00000008] dark:divide-[#ffffff08]">
      {events.map((e, idx) => {
        const name =
          [e.student?.user?.firstName, e.student?.user?.lastName]
            .filter(Boolean)
            .join(' ') || '—';
        const decisionTone: Tone =
          e.decision === 'ATTENDANCE_RECORDED'
            ? 'emerald'
            : e.decision === 'BLOCKED'
              ? 'red'
              : 'gray';
        const c = TONES[decisionTone];
        return (
          <motion.div
            key={e.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...SPRING.smooth, delay: idx * 0.03 }}
            className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-[#007AFF]/[0.03]"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#007AFF]/10 text-[#007AFF]">
              <Icon paths={I.activity} size={14} strokeWidth={2.2} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                {name}
              </p>
              <p className="mt-0.5 text-[11px] font-medium tabular-nums text-[#86868B]">
                {formatDateTime(e.recognizedAt)}
              </p>
            </div>
            <span
              className="inline-flex items-center rounded-lg px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.10em]"
              style={{ background: c.bg, color: c.fg, border: `1px solid ${c.border}` }}
            >
              {e.decision}
            </span>
            <div className="flex gap-2 text-[11px] tabular-nums text-[#86868B]">
              <span>
                <span className="font-bold uppercase tracking-wider text-[#86868B]/70">
                  C:{' '}
                </span>
                {e.confidence ?? '—'}
              </span>
              <span>
                <span className="font-bold uppercase tracking-wider text-[#86868B]/70">
                  S:{' '}
                </span>
                {e.similarityScore ?? '—'}
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function CameraHealthDisplay({ data }: { data: unknown }) {
  const { t } = useI18n();
  const h = data as Record<string, unknown> | null;
  if (!h) {
    return (
      <div className="rounded-2xl border border-dashed border-[#00000015] p-8 text-center dark:border-[#ffffff15]">
        <p className="text-[12.5px] font-medium text-[#86868B]">{t('cameras.noHealth')}</p>
      </div>
    );
  }
  const entries = Object.entries(h);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {entries.map(([key, val], idx) => (
        <motion.div
          key={key}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING.smooth, delay: idx * 0.04 }}
          className="relative overflow-hidden rounded-2xl border border-[#ffffff60] bg-[#ffffff80] p-3 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
          style={{
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)',
          }}
        >
          <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#86868B]">
            {key.replace(/([A-Z])/g, ' $1').trim()}
          </p>
          <p className="mt-1 text-[13px] font-semibold tabular-nums text-[#1D1D1F] dark:text-[#F5F5F7]">
            {String(val ?? '—')}
          </p>
        </motion.div>
      ))}
    </div>
  );
}

function CameraWorkerDisplay({ data }: { data: unknown }) {
  const { t } = useI18n();
  const w = data as Record<string, unknown> | null;
  if (!w) {
    return (
      <div className="rounded-2xl border border-dashed border-[#00000015] p-8 text-center dark:border-[#ffffff15]">
        <p className="text-[12.5px] font-medium text-[#86868B]">{t('cameras.noWorker')}</p>
      </div>
    );
  }
  const entries = Object.entries(w);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {entries.map(([key, val], idx) => (
        <motion.div
          key={key}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING.smooth, delay: idx * 0.04 }}
          className="relative overflow-hidden rounded-2xl border border-[#ffffff60] bg-[#ffffff80] p-3 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
          style={{
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)',
          }}
        >
          <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#86868B]">
            {key.replace(/([A-Z])/g, ' $1').trim()}
          </p>
          <p className="mt-1 text-[13px] font-semibold tabular-nums text-[#1D1D1F] dark:text-[#F5F5F7]">
            {String(val ?? '—')}
          </p>
        </motion.div>
      ))}
    </div>
  );
}

/* ============================================================================
 * CAMERA DETAIL TABS
 * ========================================================================== */

function CameraDetailTabs({
  events,
  health,
  workerStatus,
}: {
  events: ReturnType<typeof useQuery>;
  health: ReturnType<typeof useQuery>;
  workerStatus: ReturnType<typeof useQuery>;
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState<TabKey>('events');
  const tabs: { key: TabKey; labelKey: string; icon: string[]; tone: Tone }[] = [
    { key: 'events', labelKey: 'cameras.tabEvents', icon: I.activity, tone: 'blue' },
    { key: 'health', labelKey: 'cameras.tabHealth', icon: I.radar, tone: 'emerald' },
    { key: 'worker', labelKey: 'cameras.tabWorker', icon: I.server, tone: 'purple' },
  ];

  return (
    <div>
      {/* Premium segmented tabs */}
      <div
        role="tablist"
        aria-label={t('cameras.title')}
        className="inline-flex items-center gap-1 rounded-2xl border border-[#ffffff60] bg-[#ffffff80] p-1 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
        style={{
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)',
        }}
      >
        {tabs.map((tb) => {
          const active = tab === tb.key;
          const c = TONES[tb.tone];
          return (
            <motion.button
              key={tb.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(tb.key)}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.97 }}
              transition={SPRING.snappy}
              className="relative overflow-hidden rounded-xl px-3.5 py-2 text-[12.5px] font-bold tracking-tight outline-none transition-colors"
              style={{
                color: active ? c.fg : '#86868B',
              }}
              
              >
              {active && (
                <motion.span
                  layoutId="camera-tab-active"
                  className="absolute inset-0 rounded-xl"
                  style={{
                    background: c.bg,
                    border: `1px solid ${c.border}`,
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.6), 0 6px 16px -8px ${c.glow}`,
                  }}
                  transition={SPRING.smooth}
                />
              )}
              <span className="relative inline-flex items-center gap-1.5">
                <Icon paths={tb.icon} size={13} strokeWidth={2.4} />
                {t(tb.labelKey)}
              </span>
            </motion.button>
          );
        })}
      </div>

      <div className="mt-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={SPRING.smooth}
          >
            {tab === 'events' && (
              <>
                {events.isLoading ? (
                  <GlassPageLoader label={t('cameras.loadingEvents')} />
                ) : events.isError ? (
                  <GlassErrorState message={getErrorMessage(events.error as Error)} />
                ) : (
                  <CameraEventsTable data={events.data} />
                )}
              </>
            )}
            {tab === 'health' && (
              <>
                {health.isLoading ? (
                  <GlassPageLoader label={t('cameras.loadingHealth')} />
                ) : health.isError ? (
                  <GlassErrorState message={getErrorMessage(health.error as Error)} />
                ) : (
                  <CameraHealthDisplay data={health.data} />
                )}
              </>
            )}
            {tab === 'worker' && (
              <>
                {workerStatus.isLoading ? (
                  <GlassPageLoader label={t('cameras.loadingWorker')} />
                ) : workerStatus.isError ? (
                  <GlassErrorState message={getErrorMessage(workerStatus.error as Error)} />
                ) : (
                  <CameraWorkerDisplay data={workerStatus.data} />
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ============================================================================
 * MAIN PAGE
 * ========================================================================== */

export function CamerasPage() {
  const { t } = useI18n();
  usePageTitle(t('cameras.title'));
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();

  /* ── Modal / selection state ──────────────────────────────────────── */
  const [modalOpen, setModalOpen] = useState(false);
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Camera | null>(null);
  const [configForm, setConfigForm] = useState({
    fps: '10',
    recognitionEnabled: 'true',
    attendanceEnabled: 'true',
  });

  /* ── Form state ───────────────────────────────────────────────────── */
  const [form, setForm] = useState<CameraFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CameraFormState, string>>>({});
  const [discoverSubnet, setDiscoverSubnet] = useState('');

  /* ── Cameras query ────────────────────────────────────────────────── */
  const cameras = useQuery({
    queryKey: queryKeys.cameras.all(),
    queryFn: () => camerasApi.list({ limit: 100 }),
    placeholderData: (previousData) => previousData,
  });

  const data = cameras.data as { items?: Camera[] } | undefined;
  const list = useMemo(() => data?.items || [], [data]);

  /* ── Derived stats ────────────────────────────────────────────────── */
  const stats = useMemo(() => {
    const total = list.length;
    const online = list.filter((c) => c.status === 'ONLINE').length;
    const errors = list.filter((c) => c.status === 'ERROR').length;
    const recognition = list.filter((c) => c.recognitionEnabled).length;
    return { total, online, errors, recognition };
  }, [list]);

  /* ── Create camera mutation ───────────────────────────────────────── */
  const create = useMutation({
    mutationFn: () =>
      camerasApi.create({
        name: form.name,
        host: form.host,
        port: parseInt(form.port, 10) || 554,
        protocol: form.protocol,
        streamPath: form.streamPath || undefined,
        location: form.location || undefined,
        username: form.username || undefined,
        password: form.password || undefined,
      }),
    onSuccess: () => {
      push('success', t('cameras.addedToast'));
      setModalOpen(false);
      setForm(INITIAL_FORM);
      setFormErrors({});
      qc.invalidateQueries({ queryKey: queryKeys.cameras.all() });
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  /* ── Toggle camera mutation ───────────────────────────────────────── */
  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      enabled ? camerasApi.enable(id) : camerasApi.disable(id),
    onSuccess: () => {
      push('success', t('cameras.updatedToast'));
      qc.invalidateQueries({ queryKey: queryKeys.cameras.all() });
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  /* ── Start worker mutation ────────────────────────────────────────── */
  const startWorker = useMutation({
    mutationFn: (id: string) => camerasApi.startWorker(id),
    onSuccess: () => {
      push('success', t('cameras.workerStartedToast'));
      qc.invalidateQueries({ queryKey: queryKeys.cameras.all() });
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  /* ── Discover cameras mutation ────────────────────────────────────── */
  const discover = useMutation({
    mutationFn: () => camerasApi.discover(discoverSubnet ? { subnet: discoverSubnet } : {}),
    onSuccess: () => {
      push('success', t('cameras.discoveryToast'));
      qc.invalidateQueries({ queryKey: queryKeys.cameras.all() });
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const discovered = useMemo(
    () => (discover.data || []) as DiscoveredCamera[],
    [discover.data],
  );

  /* ── Validators ───────────────────────────────────────────────────── */
  const validateForm = useCallback((): boolean => {
    const errors: Partial<Record<keyof CameraFormState, string>> = {};
    if (!form.name.trim()) errors.name = t('cameras.validation.nameRequired');
    if (!form.host.trim()) errors.host = t('cameras.validation.hostRequired');
    if (form.port && (parseInt(form.port, 10) < 1 || parseInt(form.port, 10) > 65535)) {
      errors.port = t('cameras.validation.portRange');
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form, t]);

  /* ── Form handlers ────────────────────────────────────────────────── */
  const handleFormChange = useCallback(
    (field: keyof CameraFormState) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
        setFormErrors((prev) => ({ ...prev, [field]: undefined }));
      },
    [],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!validateForm()) return;
      create.mutate();
    },
    [validateForm, create],
  );

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setForm(INITIAL_FORM);
    setFormErrors({});
  }, []);

  const handleCloseDiscover = useCallback(() => {
    setDiscoverOpen(false);
    setDiscoverSubnet('');
  }, []);

  const handleUseDiscovered = useCallback((camera: DiscoveredCamera) => {
    setForm((prev) => ({
      ...prev,
      host: camera.host,
      port: String(camera.port),
      protocol: camera.protocol,
      name: camera.name || prev.name,
    }));
    setDiscoverOpen(false);
    setModalOpen(true);
  }, []);

  const handleToggleCamera = useCallback(
    (camera: Camera) => {
      toggle.mutate({ id: camera.id, enabled: !camera.enabled });
    },
    [toggle],
  );

  const handleStartWorker = useCallback(
    (cameraId: string) => {
      startWorker.mutate(cameraId);
    },
    [startWorker],
  );

  const { refetch: refetchCameras } = cameras;
  const handleRetry = useCallback(() => {
    void refetchCameras();
  }, [refetchCameras]);

  /* ── Detail queries ───────────────────────────────────────────────── */
  const selectedCamera = useMemo(
    () => list.find((c) => c.id === selectedCameraId) || null,
    [list, selectedCameraId],
  );

  const cameraEvents = useQuery({
    queryKey: queryKeys.cameras.events(selectedCameraId),
    queryFn: () => camerasApi.events(selectedCameraId!, { limit: 50 }),
    enabled: !!selectedCameraId,
  });

  const cameraHealth = useQuery({
    queryKey: queryKeys.cameras.health(selectedCameraId),
    queryFn: () => camerasApi.health(selectedCameraId!),
    enabled: !!selectedCameraId,
  });

  const cameraWorkerStatus = useQuery({
    queryKey: queryKeys.cameras.worker(selectedCameraId),
    queryFn: () => camerasApi.workerStatus(selectedCameraId!),
    enabled: !!selectedCameraId,
    refetchInterval: 5000,
  });

  /* ── Worker control mutations ─────────────────────────────────────── */
  const stopWorker = useMutation({
    mutationFn: (id: string) => camerasApi.stopWorker(id),
    onSuccess: () => {
      push('success', t('cameras.workerStoppedToast'));
      qc.invalidateQueries({ queryKey: queryKeys.cameras.all() });
      qc.invalidateQueries({ queryKey: queryKeys.cameras.workersAll() });
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const restartWorker = useMutation({
    mutationFn: (id: string) => camerasApi.restartWorker(id),
    onSuccess: () => {
      push('success', t('cameras.workerRestartedToast'));
      qc.invalidateQueries({ queryKey: queryKeys.cameras.all() });
      qc.invalidateQueries({ queryKey: queryKeys.cameras.workersAll() });
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const deleteCamera = useMutation({
    mutationFn: (id: string) => camerasApi.remove(id),
    onSuccess: () => {
      push('success', t('cameras.deletedToast'));
      setSelectedCameraId(null);
      qc.invalidateQueries({ queryKey: queryKeys.cameras.all() });
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const testConnection = useMutation({
    mutationFn: (d: { host: string; port: number }) => camerasApi.testConnection(d),
    onSuccess: () => push('success', t('cameras.connectionToast')),
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const updateConfig = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      camerasApi.config(id, data),
    onSuccess: () => {
      push('success', t('cameras.configUpdatedToast'));
      setConfigModalOpen(false);
      qc.invalidateQueries({ queryKey: queryKeys.cameras.all() });
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  /* ── Loading ──────────────────────────────────────────────────────── */
  if (cameras.isLoading && !data) {
    return (
      <div className="page-container space-y-5">
        <div className="h-28 rounded-3xl border border-[#ffffff60] bg-[#ffffff80] backdrop-blur-2xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]" />
        <CamerasSkeleton />
      </div>
    );
  }

  /* ── Error ────────────────────────────────────────────────────────── */
  if (cameras.isError) {
    return (
      <div className="page-container space-y-5">
        <div className="glass-card p-8">
          <GlassErrorState
            title={t('cameras.loadError')}
            message={getErrorMessage(cameras.error as Error)}
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
            {/* Gradient camera tile */}
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
              <Icon paths={I.video} size={28} strokeWidth={2} className="relative" />
            </motion.div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#007AFF]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#007AFF]">
                  <Icon paths={I.sparkles} size={11} strokeWidth={2.5} />
                  {t('cameras.surveillance')}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#34C759]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#34C759]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#34C759]" />
                  {stats.online} {t('cameras.status.ONLINE')}
                </span>
                {stats.errors > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FF3B30]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#FF3B30]">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FF3B30]" />
                    {stats.errors} {t('cameras.status.ERROR')}
                  </span>
                )}
              </div>

              <h1 className="mt-2 text-3xl font-bold tracking-tighter text-[#1D1D1F] dark:text-[#F5F5F7] sm:text-4xl">
                {t('cameras.title')}
              </h1>
              <p className="mt-1 text-[13.5px] font-medium text-[#86868B]">
                {t('cameras.subtitle')}
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <GlassButton
                  type="button"
                  variant="secondary"
                  onClick={() => setDiscoverOpen(true)}
                  
                  
                  >
                  <span className="inline-flex items-center gap-2">
                    <Icon paths={I.radar} size={15} strokeWidth={2} />
                    {t('cameras.discover')}
                  </span>
                </GlassButton>
              </motion.div>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <GlassButton
                  type="button"
                  variant="primary"
                  onClick={() => setModalOpen(true)}
                  
                  
                  >
                  <span className="inline-flex items-center gap-2">
                    <Icon paths={I.plus} size={15} strokeWidth={2.5} />
                    {t('cameras.add')}
                  </span>
                </GlassButton>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ============================================================
          KPI STATS
      ============================================================ */}
      {list.length > 0 && (
        <motion.div
          variants={containerVariants}
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          <KpiTile label={t('cameras.title')} value={stats.total} icon={I.video} tone="blue" />
          <KpiTile label={t('cameras.status.ONLINE')} value={stats.online} icon={I.checkCircle} tone="emerald" />
          <KpiTile label={t('cameras.status.ERROR')} value={stats.errors} icon={I.alertCircle} tone="red" />
          <KpiTile label={t('cameras.recognition')} value={stats.recognition} icon={I.fingerprint} tone="purple" />
        </motion.div>
      )}

      {/* ============================================================
          CAMERAS LIST
      ============================================================ */}
      <motion.div
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

        {list.length === 0 ? (
          <div className="relative p-10">
            <div className="flex flex-col items-center text-center">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#007AFF]/10 text-[#007AFF]"
                style={{
                  boxShadow:
                    'inset 0 1px 0 rgba(255,255,255,0.5), 0 8px 24px -12px rgba(0,122,255,0.4)',
                }}
              >
                <Icon paths={I.empty} size={26} strokeWidth={1.8} />
              </div>
              <p className="mt-4 text-[15px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                {t('cameras.empty')}
              </p>
              <p className="mt-1 max-w-sm text-[12.5px] font-medium text-[#86868B]">
                {t('cameras.emptyHint')}
              </p>
              <div className="mt-5 flex gap-2">
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <GlassButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setDiscoverOpen(true)}
                    
                    
                    >
                    <span className="inline-flex items-center gap-2">
                      <Icon paths={I.radar} size={14} strokeWidth={2} />
                      {t('cameras.discover')}
                    </span>
                  </GlassButton>
                </motion.div>
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <GlassButton
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => setModalOpen(true)}
                    
                    
                    >
                    <span className="inline-flex items-center gap-2">
                      <Icon paths={I.plus} size={14} strokeWidth={2.5} />
                      {t('cameras.add')}
                    </span>
                  </GlassButton>
                </motion.div>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative divide-y divide-[#00000008] dark:divide-[#ffffff08]">
            {list.map((camera, idx) => {
              const isSelected = selectedCameraId === camera.id;
              const isTogglePending =
                toggle.isPending && toggle.variables?.id === camera.id;
              const isWorkerPending =
                startWorker.isPending && startWorker.variables === camera.id;
              const statusLabel = CAMERA_STATUS_LABEL_KEYS[camera.status]
                ? t(CAMERA_STATUS_LABEL_KEYS[camera.status])
                : camera.status;
              const gradient = cameraGradient(camera.name);

              return (
                <motion.button
                  key={camera.id}
                  type="button"
                  onClick={() =>
                    setSelectedCameraId(isSelected ? null : camera.id)
                  }
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ ...SPRING.smooth, delay: idx * 0.03 }}
                  aria-label={t('cameras.viewAria', { name: camera.name })}
                  aria-expanded={isSelected}
                  className="group flex w-full flex-wrap items-center gap-3 px-5 py-3.5 text-left transition-colors"
                  style={{
                    background: isSelected
                      ? 'rgba(0,122,255,0.04)'
                      : undefined,
                  }}
                  
                  
                  >
                  {/* Gradient camera tile */}
                  <div
                    className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white"
                    style={{
                      background: gradient,
                      boxShadow:
                        'inset 0 1px 0 rgba(255,255,255,0.35), 0 6px 16px -6px rgba(0,0,0,0.25)',
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
                    <Icon paths={I.camera} size={18} strokeWidth={2} className="relative" />
                  </div>

                  {/* Name + endpoint */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                      {camera.name}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-medium text-[#86868B]">
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#00000006] px-1.5 py-0.5 font-mono tabular-nums dark:bg-[#ffffff08]">
                        <Icon paths={I.router} size={10} strokeWidth={2.2} className="opacity-70" />
                        {formatEndpoint(camera)}
                      </span>
                      <ProtocolChip protocol={camera.protocol} />
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Icon paths={I.clock} size={10} strokeWidth={2.2} className="opacity-60" />
                        {formatDateTime(camera.lastSeenAt)}
                      </span>
                    </div>
                  </div>

                  {/* Status + recognition */}
                  <div className="flex flex-wrap items-center gap-2">
                    <CameraStatusBadge status={camera.status} label={statusLabel} />
                    <RecognitionChip enabled={camera.recognitionEnabled} t={t} />
                  </div>

                  {/* Quick actions */}
                  <div
                    className="flex gap-1.5"
                    onClick={(e) => e.stopPropagation()}
                    
                    
                    >
                    {camera.status === 'CONFIGURED' && (
                      <MiniAction
                        icon={I.play}
                        label={isWorkerPending ? t('cameras.starting') : t('cameras.startWorker')}
                        tone="emerald"
                        onClick={() => handleStartWorker(camera.id)}
                        disabled={isWorkerPending}
                        ariaLabel={t('cameras.startWorkerAria', { name: camera.name })} />
                    )}
                    <MiniAction
                      icon={camera.enabled ? I.xCircle : I.checkCircle}
                      label={
                        isTogglePending
                          ? t('common.saving')
                          : camera.enabled
                            ? t('common.disable')
                            : t('common.enable')
                      }
                      tone={camera.enabled ? 'orange' : 'green'}
                      onClick={() => handleToggleCamera(camera)}
                      disabled={isTogglePending}
                      ariaLabel={
                        camera.enabled ? t('common.disable') : t('common.enable')
                      } />
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg text-[#86868B]">
                      <motion.span
                        animate={{ rotate: isSelected ? 180 : 0 }}
                        transition={SPRING.smooth}
                      >
                        <Icon
                          paths={['M6 9l6 6 6-6']}
                          size={14}
                          strokeWidth={2.4}
                        />
                      </motion.span>
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* ============================================================
          DETAIL PANEL
      ============================================================ */}
      <AnimatePresence>
        {selectedCamera && (
          <motion.div
            key={selectedCamera.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={SPRING.smooth}
            className="relative overflow-hidden rounded-3xl border border-[#ffffff60] bg-[#ffffff80] p-5 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
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
            <div className="relative space-y-4">
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="relative flex h-12 w-12 items-center justify-center rounded-2xl text-white"
                    style={{
                      background: cameraGradient(selectedCamera.name),
                      boxShadow:
                        'inset 0 1px 0 rgba(255,255,255,0.35), 0 6px 16px -6px rgba(0,0,0,0.25)',
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
                    <Icon paths={I.camera} size={20} strokeWidth={2} className="relative" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-[16px] font-bold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                      {selectedCamera.name}
                    </h2>
                    <p className="mt-0.5 inline-flex items-center gap-1.5 font-mono text-[11.5px] font-medium text-[#86868B]">
                      <Icon paths={I.router} size={11} strokeWidth={2} className="opacity-60" />
                      {selectedCamera.host}:{selectedCamera.port} · {selectedCamera.protocol}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {selectedCamera.status === 'ONLINE' && (
                    <>
                      <MiniAction
                        icon={I.refresh}
                        label={t('cameras.restartWorker')}
                        tone="blue"
                        onClick={() => restartWorker.mutate(selectedCamera.id)}
                        disabled={restartWorker.isPending}
                        ariaLabel={t('cameras.restartWorkerAria', { name: selectedCamera.name })} />
                      <MiniAction
                        icon={I.stop}
                        label={t('cameras.stopWorker')}
                        tone="red"
                        onClick={() => stopWorker.mutate(selectedCamera.id)}
                        disabled={stopWorker.isPending}
                        ariaLabel={t('cameras.stopWorkerAria', { name: selectedCamera.name })} />
                    </>
                  )}
                  {(selectedCamera.status === 'CONFIGURED' || selectedCamera.status === 'ERROR') && (
                    <MiniAction
                      icon={I.play}
                      label={t('cameras.startWorkerTitle')}
                      tone="emerald"
                      primary
                      onClick={() => startWorker.mutate(selectedCamera.id)}
                      disabled={startWorker.isPending}
                      ariaLabel={t('cameras.startWorkerAria', { name: selectedCamera.name })} />
                  )}
                  <MiniAction
                    icon={I.settings}
                    label={t('cameras.configure')}
                    tone="purple"
                    onClick={() => {
                      setConfigForm({
                        fps: String((selectedCamera as Camera & { fps?: number }).fps || 10),
                        recognitionEnabled: String(selectedCamera.recognitionEnabled),
                        attendanceEnabled: String(selectedCamera.attendanceEnabled),
                      });
                      setConfigModalOpen(true);
                    }}
                    ariaLabel={t('cameras.configureAria', { name: selectedCamera.name })} />
                  <MiniAction
                    icon={I.plug}
                    label={t('cameras.testConnection')}
                    tone="cyan"
                    onClick={() =>
                      testConnection.mutate({
                        host: selectedCamera.host,
                        port: selectedCamera.port,
                      })
                    }
                    disabled={testConnection.isPending}
                    ariaLabel={t('cameras.testConnectionAria', { name: selectedCamera.name })} />
                  <MiniAction
                    icon={I.trash}
                    label={t('common.delete')}
                    tone="red"
                    onClick={() => setDeleteTarget(selectedCamera)}
                    disabled={deleteCamera.isPending}
                    ariaLabel={t('cameras.deleteAria', { name: selectedCamera.name })} />
                </div>
              </div>

              {/* Tabs */}
              <CameraDetailTabs
                events={cameraEvents}
                health={cameraHealth}
                workerStatus={cameraWorkerStatus}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================================
          ADD CAMERA MODAL
      ============================================================ */}
      <GlassModal
        open={modalOpen}
        onClose={handleCloseModal}
        title={t('cameras.add')}
        wide
      >
        <form className="space-y-5" onSubmit={handleSubmit} noValidate>
          <div className="flex items-center gap-3 rounded-2xl border border-[#007AFF33] bg-[#007AFF]/[0.06] px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#007AFF]/15 text-[#007AFF]">
              <Icon paths={I.sparkles} size={18} strokeWidth={2} />
            </div>
            <p className="text-[12px] font-medium leading-snug text-[#1D1D1F] dark:text-[#F5F5F7]">
              {t('cameras.registerDesc')}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <GlassField label={t('cameras.form.name')} required error={formErrors.name}>
              <div className="relative">
                <FieldIcon icon={I.video} tone="blue" />
                <GlassInput
                  value={form.name}
                  onChange={handleFormChange('name')}
                  required
                  aria-invalid={Boolean(formErrors.name)}
                  aria-describedby={formErrors.name ? 'name-error' : undefined}
                  placeholder={t('cameras.form.namePlaceholder')}
                  className="pl-11"
                />
              </div>
              {formErrors.name && (
                <span
                  id="name-error"
                  className="mt-1 text-sm"
                  style={{ color: 'var(--state-error)' }}
                >
                  {formErrors.name}
                </span>
              )}
            </GlassField>

            <GlassField label={t('cameras.form.protocol')}>
              <div className="relative">
                <FieldIcon icon={I.radio} tone="purple" />
                <GlassSelect
                  value={form.protocol}
                  onChange={handleFormChange('protocol')}
                  aria-label={t('cameras.form.protocol')}
                  className="pl-11"
                >
                  {CAMERA_PROTOCOLS.map((protocol) => (
                    <option key={protocol} value={protocol}>
                      {protocol}
                    </option>
                  ))}
                </GlassSelect>
              </div>
            </GlassField>

            <GlassField label={t('cameras.form.host')} required error={formErrors.host}>
              <div className="relative">
                <FieldIcon icon={I.router} tone="green" />
                <GlassInput
                  value={form.host}
                  onChange={handleFormChange('host')}
                  placeholder="192.168.1.100"
                  required
                  aria-invalid={Boolean(formErrors.host)}
                  aria-describedby={formErrors.host ? 'host-error' : undefined}
                  className="pl-11"
                />
              </div>
              {formErrors.host && (
                <span
                  id="host-error"
                  className="mt-1 text-sm"
                  style={{ color: 'var(--state-error)' }}
                >
                  {formErrors.host}
                </span>
              )}
            </GlassField>

            <GlassField label={t('cameras.form.port')} error={formErrors.port}>
              <div className="relative">
                <FieldIcon icon={I.plug} tone="orange" />
                <GlassInput
                  type="number"
                  value={form.port}
                  onChange={handleFormChange('port')}
                  min={1}
                  max={65535}
                  aria-invalid={Boolean(formErrors.port)}
                  aria-describedby={formErrors.port ? 'port-error' : undefined}
                  className="pl-11"
                />
              </div>
              {formErrors.port && (
                <span
                  id="port-error"
                  className="mt-1 text-sm"
                  style={{ color: 'var(--state-error)' }}
                >
                  {formErrors.port}
                </span>
              )}
            </GlassField>

            <GlassField label={t('cameras.form.streamPath')}>
              <div className="relative">
                <FieldIcon icon={I.layers} tone="cyan" />
                <GlassInput
                  value={form.streamPath}
                  onChange={handleFormChange('streamPath')}
                  placeholder="/Streaming/Channels/101"
                  className="pl-11"
                />
              </div>
            </GlassField>

            <GlassField label={t('cameras.form.location')}>
              <div className="relative">
                <FieldIcon icon={I.fingerprint} tone="purple" />
                <GlassInput
                  value={form.location}
                  onChange={handleFormChange('location')}
                  placeholder={t('cameras.form.locationPlaceholder')}
                  className="pl-11"
                />
              </div>
            </GlassField>

            <GlassField
              label={t('common.username')}
              hint={t('cameras.form.credentialsHint')}
            >
              <div className="relative">
                <FieldIcon icon={I.shield} tone="emerald" />
                <GlassInput
                  value={form.username}
                  onChange={handleFormChange('username')}
                  autoComplete="off"
                  className="pl-11"
                />
              </div>
            </GlassField>

            <GlassField label={t('common.password')}>
              <div className="relative">
                <FieldIcon icon={I.shield} tone="red" />
                <GlassInput
                  type="password"
                  value={form.password}
                  onChange={handleFormChange('password')}
                  autoComplete="new-password"
                  className="pl-11"
                />
              </div>
            </GlassField>
          </div>

          <div className="flex justify-end gap-2 border-t border-[#00000008] pt-4 dark:border-[#ffffff08]">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton
                type="button"
                variant="secondary"
                onClick={handleCloseModal}
                disabled={create.isPending}
                
                
                >
                {t('common.cancel')}
              </GlassButton>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton type="submit" variant="primary" disabled={create.isPending}>
                <span className="inline-flex items-center gap-2">
                  {create.isPending ? (
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
                      {t('cameras.add')}
                    </>
                  )}
                </span>
              </GlassButton>
            </motion.div>
          </div>
        </form>
      </GlassModal>

      {/* ============================================================
          DISCOVER MODAL
      ============================================================ */}
      <GlassModal
        open={discoverOpen}
        onClose={handleCloseDiscover}
        title={t('cameras.discoverTitle')}
        wide
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl border border-[#32ADE633] bg-[#32ADE6]/[0.06] px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#32ADE6]/15 text-[#32ADE6]">
              <Icon paths={I.radar} size={18} strokeWidth={2} />
            </div>
            <p className="text-[12px] font-medium leading-snug text-[#1D1D1F] dark:text-[#F5F5F7]">
              {t('cameras.discoverHint')}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <FieldIcon icon={I.router} tone="cyan" />
              <GlassInput
                value={discoverSubnet}
                onChange={(e) => setDiscoverSubnet(e.target.value)}
                placeholder={t('cameras.subnetPlaceholder')}
                aria-label={t('cameras.subnetAria')}
                className="pl-11"
              />
            </div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton
                type="button"
                variant="primary"
                onClick={() => discover.mutate()}
                disabled={discover.isPending}
                
                
                >
                <span className="inline-flex items-center gap-2">
                  {discover.isPending ? (
                    <>
                      <motion.span
                        className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                      />
                      {t('cameras.scanning')}
                    </>
                  ) : (
                    <>
                      <Icon paths={I.search} size={14} strokeWidth={2.5} />
                      {t('cameras.scan')}
                    </>
                  )}
                </span>
              </GlassButton>
            </motion.div>
          </div>

          {discover.isError && (
            <div
              className="flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm"
              style={{
                borderColor: 'rgba(255,59,48,0.3)',
                background: 'rgba(255,59,48,0.06)',
                color: '#FF3B30',
              }}
              role="alert"
            >
              <Icon paths={I.warning} size={16} strokeWidth={2.2} />
              <span className="font-medium">
                {getErrorMessage(discover.error as Error)}
              </span>
            </div>
          )}

          {discovered.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-[#00000008] dark:border-[#ffffff08]">
              <div className="divide-y divide-[#00000008] dark:divide-[#ffffff08]">
                {discovered.map((camera, index) => (
                  <motion.div
                    key={`${camera.host}-${camera.port}-${index}`}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ ...SPRING.smooth, delay: index * 0.04 }}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#32ADE6]/10 text-[#32ADE6]">
                      <Icon paths={I.camera} size={14} strokeWidth={2.2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[13px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                        {camera.host}:{camera.port}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <ProtocolChip protocol={camera.protocol} />
                        {camera.name && (
                          <span className="truncate text-[11px] font-medium text-[#86868B]">
                            {camera.name}
                          </span>
                        )}
                      </div>
                    </div>
                    <MiniAction
                      icon={I.plus}
                      label={t('cameras.use')}
                      tone="emerald"
                      primary
                      onClick={() => handleUseDiscovered(camera)} />
                  </motion.div>
                ))}
              </div>
            </div>
          ) : discover.isSuccess ? (
            <div className="rounded-2xl border border-dashed border-[#00000015] p-8 text-center dark:border-[#ffffff15]">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#32ADE6]/10 text-[#32ADE6]">
                <Icon paths={I.radar} size={20} strokeWidth={1.9} />
              </div>
              <p className="mt-3 text-[12.5px] font-medium text-[#86868B]">
                {t('cameras.noCamerasFound')}
              </p>
            </div>
          ) : null}
        </div>
      </GlassModal>

      {/* ============================================================
          CONFIG MODAL
      ============================================================ */}
      <GlassModal
        open={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
        title={t('cameras.configTitle')}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl border border-[#AF52DE33] bg-[#AF52DE]/[0.06] px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#AF52DE]/15 text-[#AF52DE]">
              <Icon paths={I.settings} size={18} strokeWidth={2} />
            </div>
            <p className="text-[12px] font-medium leading-snug text-[#1D1D1F] dark:text-[#F5F5F7]">
              {t('cameras.configDesc')}
            </p>
          </div>

          <GlassField label={t('cameras.configFps')}>
            <div className="relative">
              <FieldIcon icon={I.activity} tone="blue" />
              <GlassInput
                type="number"
                min={1}
                max={30}
                value={configForm.fps}
                onChange={(e) => setConfigForm((f) => ({ ...f, fps: e.target.value }))}
                className="pl-11"
              />
            </div>
          </GlassField>

          <GlassField label={t('cameras.configRecognition')}>
            <div className="relative">
              <FieldIcon icon={I.fingerprint} tone="purple" />
              <GlassSelect
                value={configForm.recognitionEnabled}
                onChange={(e) =>
                  setConfigForm((f) => ({ ...f, recognitionEnabled: e.target.value }))
                }
                className="pl-11"
              >
                <option value="true">{t('common.enable')}</option>
                <option value="false">{t('common.disable')}</option>
              </GlassSelect>
            </div>
          </GlassField>

          <GlassField label={t('cameras.configAttendance')}>
            <div className="relative">
              <FieldIcon icon={I.checkCircle} tone="emerald" />
              <GlassSelect
                value={configForm.attendanceEnabled}
                onChange={(e) =>
                  setConfigForm((f) => ({ ...f, attendanceEnabled: e.target.value }))
                }
                className="pl-11"
              >
                <option value="true">{t('common.enable')}</option>
                <option value="false">{t('common.disable')}</option>
              </GlassSelect>
            </div>
          </GlassField>

          <div className="flex justify-end gap-2 border-t border-[#00000008] pt-4 dark:border-[#ffffff08]">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton
                onClick={() => setConfigModalOpen(false)}
                variant="secondary"
                
                
                >
                {t('common.cancel')}
              </GlassButton>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton
                onClick={() => {
                  if (selectedCameraId) {
                    updateConfig.mutate({
                      id: selectedCameraId,
                      data: {
                        fps: parseInt(configForm.fps) || 10,
                        recognitionEnabled: configForm.recognitionEnabled === 'true',
                        attendanceEnabled: configForm.attendanceEnabled === 'true',
                      },
                    });
                  }
                }}
                disabled={updateConfig.isPending}
                variant="primary"
                
                
                >
                <span className="inline-flex items-center gap-2">
                  {updateConfig.isPending ? (
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
                      {t('common.save')}
                    </>
                  )}
                </span>
              </GlassButton>
            </motion.div>
          </div>
        </div>
      </GlassModal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteCamera.mutate(deleteTarget.id);
          setDeleteTarget(null);
        }}
        description={
          deleteTarget
            ? t('cameras.deleteConfirm', { name: deleteTarget.name })
            : ''
        }
        loading={deleteCamera.isPending}
      />
    </motion.div>
  );
}