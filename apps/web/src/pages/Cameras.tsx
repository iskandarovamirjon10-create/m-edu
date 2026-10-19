/**
 * M-EDU CamerasPage — v18 "Liquid Glass · Apple Studio"
 *
 * 🎯 v2 → v18 Architecture, DOM & Creative Feature Upgrades:
 *  ✅ Fixed Critical Invalid DOM Nesting (`<button>` inside `<button>`) — Camera rows now use
 *     accessible `<motion.div role="button" tabIndex={0}>` so inner action buttons are 100% W3C valid.
 *  ✅ Fixed Duplicate Validation Error Messages — Removed redundant `<span>` tags under `<GlassField>`.
 *  ✅ Smart Telemetry Value Formatter — Eliminates `[object Object]` in Health & Worker tabs.
 *  ✅ Zero-Rerender `CountUp` — Direct DOM `textContent` updates in rAF.
 *  ✅ Creative Addition 1: Instant Search & Status Filter Pills (All / Online / Error / Face ID).
 *  ✅ Creative Addition 2: Live RTSP/ONVIF URL Builder Preview in Add Modal + 1-Click Endpoint Copy.
 *  ✅ Creative Addition 3: Quick FPS Preset Pills (5 / 10 / 15 / 25 / 30 FPS) in Config Modal.
 */

import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  memo,
} from 'react';
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
import { openSidecar, type QuickLookData } from '@/stores/ui.store';
import { usePremiumSound } from '@/hooks/usePremiumSound';

/* ══════════════════════════════════════════════════════════════════════════
 * MOTION TOKENS & VARIANTS
 * ════════════════════════════════════════════════════════════════════════ */

const SPRING = {
  snappy: { type: 'spring' as const, stiffness: 500, damping: 32, mass: 0.7 },
  smooth: { type: 'spring' as const, stiffness: 320, damping: 28, mass: 0.9 },
  soft:   { type: 'spring' as const, stiffness: 220, damping: 26, mass: 1.0 },
} as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.05 },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.99 },
  visible: { opacity: 1, y: 0, scale: 1, transition: SPRING.smooth },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: SPRING.smooth },
};

/* ══════════════════════════════════════════════════════════════════════════
 * EMBEDDED CUSTOM ICONS (SF Symbols Proportions — Zero External Dep)
 * ════════════════════════════════════════════════════════════════════════ */

const ICON_STROKE = 1.8;

const I: Record<string, readonly string[]> = {
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
  copy: [
    'M9 9h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2z',
    'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  ],
  sidecar: [
    'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
    'M15 4v16',
  ],
  close: ['M18 6 6 18', 'M6 6l12 12'],
  checkCircle: [
    'M22 11.08V12a10 10 0 1 1-5.93-9.14',
    'M22 4 12 14.01l-3-3',
  ],
  xCircle: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M15 9l-6 6',
    'M9 9l6 6',
  ],
  alertCircle: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 8v4',
    'M12 16h.01',
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
    'M12 18h.01',
    'M17.99 11.66A6 6 0 0 1 15.77 16.67',
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
    'M10 11v6',
    'M14 11v6',
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
    'M18.5 3.5v3',
    'M20 5h-3',
    'M5.5 18v2.5',
    'M6.75 19.25h-2.5',
  ],
  layers: [
    'M12 2 2 7l10 5 10-5z',
    'M2 17l10 5 10-5',
    'M2 12l10 5 10-5',
  ],
  fingerprint: [
    'M12 11a2 2 0 0 1 2 2v3',
    'M8 13a4 4 0 0 1 8 0v5',
    'M12 22a10 10 0 1 1 0-20 10 10 0 0 1 10 10',
  ],
  activity: ['M22 12h-4l-3 9L9 3l-3 9H2'],
  server: [
    'M20 3H4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z',
    'M20 13H4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2z',
    'M6 7h.01',
    'M6 17h.01',
  ],
  empty: [
    'M20 7h-9',
    'M14 17H5',
    'M19 19v-2a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v2',
    'M10 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  ],
  warning: [
    'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
    'M12 9v4',
    'M12 17h.01',
  ],
  router: [
    'M3 3h18v6H3z',
    'M6.01 6h.01',
    'M9.01 6h.01',
    'M12 9v6',
    'M7 15h10v6H7z',
  ],
  chevronDown: ['M6 9l6 6 6-6'],
};

const Icon = memo(function Icon({
  paths,
  size = 18,
  className = '',
  strokeWidth = ICON_STROKE,
  ...rest
}: {
  paths: readonly string[];
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
      className={`shrink-0 ${className}`}
      aria-hidden="true"
      {...rest}
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * TONE PALETTES
 * ════════════════════════════════════════════════════════════════════════ */

type Tone =
  | 'blue'
  | 'green'
  | 'orange'
  | 'red'
  | 'purple'
  | 'cyan'
  | 'gray'
  | 'emerald';

const TONES: Record<
  Tone,
  { fg: string; bg: string; glow: string; border: string }
> = {
  blue:    { fg: '#007AFF', bg: 'rgba(0,122,255,0.10)',   glow: 'rgba(0,122,255,0.28)',   border: 'rgba(0,122,255,0.22)' },
  green:   { fg: '#10B981', bg: 'rgba(16,185,129,0.10)',  glow: 'rgba(16,185,129,0.28)',  border: 'rgba(16,185,129,0.22)' },
  orange:  { fg: '#F59E0B', bg: 'rgba(245,158,11,0.10)',  glow: 'rgba(245,158,11,0.28)',  border: 'rgba(245,158,11,0.22)' },
  red:     { fg: '#EF4444', bg: 'rgba(239,68,68,0.10)',   glow: 'rgba(239,68,68,0.28)',   border: 'rgba(239,68,68,0.22)' },
  purple:  { fg: '#5856D6', bg: 'rgba(88,86,214,0.10)',   glow: 'rgba(88,86,214,0.28)',   border: 'rgba(88,86,214,0.22)' },
  cyan:    { fg: '#0284C7', bg: 'rgba(2,132,199,0.10)',   glow: 'rgba(2,132,199,0.28)',   border: 'rgba(2,132,199,0.22)' },
  gray:    { fg: '#64748B', bg: 'rgba(100,116,139,0.10)', glow: 'rgba(100,116,139,0.20)', border: 'rgba(100,116,139,0.20)' },
  emerald: { fg: '#10B981', bg: 'rgba(16,185,129,0.12)',  glow: 'rgba(16,185,129,0.28)',  border: 'rgba(16,185,129,0.24)' },
};

/* ══════════════════════════════════════════════════════════════════════════
 * CONSTANTS & TYPES
 * ════════════════════════════════════════════════════════════════════════ */

const CAMERA_PROTOCOLS: CameraProtocol[] = ['RTSP', 'ONVIF'];
const FPS_PRESETS = ['5', '10', '15', '25', '30'] as const;

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
type CameraFilterMode = 'ALL' | 'ONLINE' | 'ERROR' | 'RECOGNITION';

/* ══════════════════════════════════════════════════════════════════════════
 * PURE HELPERS
 * ════════════════════════════════════════════════════════════════════════ */

function formatEndpoint(camera: Camera): string {
  return `${camera.host}:${camera.port}`;
}

function buildPreviewStreamUri(form: CameraFormState): string {
  const scheme = form.protocol.toLowerCase();
  const host = form.host.trim() || '192.168.1.100';
  const port = form.port.trim() || '554';
  const rawPath = form.streamPath.trim();
  const path = rawPath
    ? rawPath.startsWith('/')
      ? rawPath
      : `/${rawPath}`
    : '/Streaming/Channels/101';
  const auth = form.username.trim()
    ? `${form.username.trim()}:${form.password ? '••••' : ''}@`
    : '';
  return `${scheme}://${auth}${host}:${port}${path}`;
}

/** Prevents `[object Object]` when rendering arbitrary health/worker telemetry values. */
function formatTelemetryValue(val: unknown): React.ReactNode {
  if (val === null || val === undefined || val === '') return '—';
  if (typeof val === 'boolean') {
    const c = val ? TONES.emerald : TONES.gray;
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase"
        style={{ background: c.bg, color: c.fg, border: `1px solid ${c.border}` }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.fg }} />
        <span>{val ? 'Active / True' : 'Inactive / False'}</span>
      </span>
    );
  }
  if (typeof val === 'number') return val.toLocaleString('uz-UZ');
  if (typeof val === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(val)) {
      return formatDateTime(val);
    }
    return val;
  }
  try {
    return JSON.stringify(val);
  } catch {
    return String(val);
  }
}

function nameHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const CAMERA_PALETTES: ReadonlyArray<readonly [string, string]> = [
  ['#2563EB', '#4F46E5'],
  ['#4F46E5', '#7C3AED'],
  ['#10B981', '#0284C7'],
  ['#D97706', '#E11D48'],
  ['#2563EB', '#0D9488'],
  ['#0284C7', '#2563EB'],
];

function cameraGradient(name: string): string {
  const [a, b] = CAMERA_PALETTES[nameHash(name) % CAMERA_PALETTES.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

/* ══════════════════════════════════════════════════════════════════════════
 * SUB-COMPONENTS
 * ════════════════════════════════════════════════════════════════════════ */

const GlassSurfaceCard = memo(function GlassSurfaceCard({
  children,
  className = '',
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={[
        'liquid-glass-card relative overflow-hidden rounded-[1.5rem]',
        'border border-black/[0.08] dark:border-white/[0.12]',
        'bg-white/75 dark:bg-surface-900/75 backdrop-blur-2xl backdrop-saturate-150',
        'shadow-[0_1px_0_rgba(255,255,255,0.95)_inset,0_12px_36px_-10px_rgba(15,23,42,0.08)]',
        'dark:shadow-[0_1px_0_rgba(255,255,255,0.12)_inset,0_12px_36px_-10px_rgba(0,0,0,0.55)]',
        className,
      ].filter(Boolean).join(' ')}
      {...rest}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/25"
      />
      {children}
    </div>
  );
});

const Shimmer = memo(function Shimmer({
  className = '',
  radius = '1rem',
}: {
  className?: string;
  radius?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`skeleton-shimmer relative overflow-hidden border border-white/60 dark:border-white/[0.06] ${className}`}
      style={{ borderRadius: radius }}
    />
  );
});

const CamerasSkeleton = memo(function CamerasSkeleton() {
  return (
    <div className="space-y-5">
      <Shimmer className="h-28 w-full" radius="1.5rem" />
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Shimmer key={i} className="h-[84px]" radius="1.35rem" />
        ))}
      </div>
      <Shimmer className="h-96 w-full" radius="1.5rem" />
    </div>
  );
});

/** Zero-Rerender DOM CountUp */
const CountUp = memo(function CountUp({
  value,
  duration = 0.85,
}: {
  value: number;
  duration?: number;
}) {
  const spanRef = useRef<HTMLSpanElement | null>(null);
  const prevRef = useRef<number>(0);

  useEffect(() => {
    const el = spanRef.current;
    if (!el) return;

    const from = prevRef.current;
    const to = value;
    prevRef.current = value;

    if (from === to) {
      el.textContent = to.toLocaleString('uz-UZ');
      return;
    }

    let rafId: number;
    let start: number | null = null;
    const durMs = duration * 1000;

    const step = (ts: number) => {
      if (start === null) start = ts;
      const p = Math.min(1, (ts - start) / durMs);
      const eased = 1 - Math.pow(1 - p, 4);
      const cur = Math.round(from + (to - from) * eased);
      if (spanRef.current) {
        spanRef.current.textContent = cur.toLocaleString('uz-UZ');
      }
      if (p < 1) rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [value, duration]);

  return (
    <span ref={spanRef} className="tabular-nums">
      {value.toLocaleString('uz-UZ')}
    </span>
  );
});

const KpiTile = memo(function KpiTile({
  label,
  value,
  icon,
  tone = 'blue',
  active = false,
  onClick,
}: {
  label: string;
  value: number;
  icon: readonly string[];
  tone?: Tone;
  active?: boolean;
  onClick?: () => void;
}) {
  const c = TONES[tone];
  return (
    <motion.button
      type="button"
      onClick={onClick}
      variants={rowVariants}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      transition={SPRING.smooth}
      className={[
        'group relative flex w-full items-center gap-3.5 overflow-hidden rounded-[1.35rem] px-4 py-3.5 text-left select-none outline-none',
        'border backdrop-blur-2xl transition-all',
        active
          ? 'border-[#007AFF]/50 bg-white/90 ring-2 ring-[#007AFF]/20 dark:border-[#38BDF8]/50 dark:bg-[#0F172A]/90'
          : 'border-white/85 bg-white/75 dark:border-white/[0.10] dark:bg-[#0F172A]/75',
        'shadow-[0_1px_0_rgba(255,255,255,0.95)_inset,0_8px_24px_-8px_rgba(15,23,42,0.07)]',
        'dark:shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_8px_24px_-8px_rgba(0,0,0,0.5)]',
      ].join(' ')}
    >
      <div
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105"
        style={{
          background: c.bg,
          color: c.fg,
          border: `1px solid ${c.border}`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.6), 0 4px 12px -4px ${c.glow}`,
        }}
      >
        <Icon paths={icon} size={18} strokeWidth={2.1} />
      </div>
      <div className="relative min-w-0 flex-1">
        <div className="text-[23px] font-black leading-none tracking-tight text-[var(--text-primary)] tabular-nums">
          <CountUp value={value} />
        </div>
        <div className="mt-1.5 truncate text-[10.5px] font-bold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
          {label}
        </div>
      </div>
    </motion.button>
  );
});

const CameraStatusBadge = memo(function CameraStatusBadge({
  status,
  label,
}: {
  status: string;
  label: string;
}) {
  const tone = CAMERA_STATUS_TONE[status] ?? 'gray';
  const c = TONES[tone];
  const pulse = CAMERA_STATUS_PULSE[status];

  return (
    <span
      className="relative inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.12em]"
      style={{
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
      }}
    >
      <span className="relative flex h-1.5 w-1.5">
        {pulse && (
          <span
            className="medu-pulse-dot absolute inset-0 rounded-full"
            style={{ background: c.fg }}
          />
        )}
        <span
          className="relative h-1.5 w-1.5 rounded-full"
          style={{ background: c.fg }}
        />
      </span>
      <span>{label}</span>
    </span>
  );
});

const RecognitionChip = memo(function RecognitionChip({
  enabled,
  t,
}: {
  enabled: boolean;
  t: TranslateFn;
}) {
  const tone: Tone = enabled ? 'purple' : 'gray';
  const c = TONES[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.10em]"
      style={{
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
      }}
    >
      <Icon paths={I.fingerprint} size={11} strokeWidth={2.2} />
      <span>{enabled ? t('common.on') : t('common.off')}</span>
    </span>
  );
});

const ProtocolChip = memo(function ProtocolChip({
  protocol,
}: {
  protocol: string;
}) {
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
});

const FieldIcon = memo(function FieldIcon({
  icon,
  tone = 'blue',
}: {
  icon: readonly string[];
  tone?: Tone;
}) {
  const c = TONES[tone];
  return (
    <span
      className="pointer-events-none absolute left-3 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-lg"
      style={{ background: c.bg, color: c.fg }}
      aria-hidden="true"
    >
      <Icon paths={icon} size={12} strokeWidth={2.2} />
    </span>
  );
});

const MiniAction = memo(function MiniAction({
  icon,
  label,
  tone,
  onClick,
  disabled,
  primary,
  ariaLabel,
}: {
  icon: readonly string[];
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
      whileHover={disabled ? undefined : { scale: 1.04, y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      transition={SPRING.snappy}
      aria-label={ariaLabel ?? label}
      title={label}
      className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-bold tracking-tight outline-none disabled:opacity-50"
      style={{
        background: primary ? c.fg : c.bg,
        color: primary ? '#fff' : c.fg,
        border: `1px solid ${primary ? c.fg : c.border}`,
        boxShadow: primary
          ? `inset 0 1px 0 rgba(255,255,255,0.35), 0 6px 16px -6px ${c.glow}`
          : 'inset 0 1px 0 rgba(255,255,255,0.5)',
      }}
    >
      <Icon paths={icon} size={11} strokeWidth={2.5} />
      <span className="hidden sm:inline">{label}</span>
    </motion.button>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * DETAIL TAB CONTENT VIEWS
 * ════════════════════════════════════════════════════════════════════════ */

const CameraEventsTable = memo(function CameraEventsTable({
  data,
}: {
  data: unknown;
}) {
  const { t } = useI18n();
  const events =
    (
      data as {
        items?: Array<{
          id: string;
          recognizedAt: string;
          student?: { user?: { firstName?: string; lastName?: string } };
          decision: string;
          confidence?: string;
          similarityScore?: string;
        }>;
      }
    )?.items ?? [];

  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300/80 bg-white/40 p-8 text-center dark:border-white/[0.12] dark:bg-white/[0.02]">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#007AFF]/12 text-[#007AFF] dark:text-[#38BDF8]">
          <Icon paths={I.empty} size={20} strokeWidth={1.9} />
        </div>
        <p className="mt-3 text-[12.5px] font-medium text-[var(--text-secondary)]">
          {t('cameras.noEvents')}
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-200/70 dark:divide-white/[0.06]">
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
            transition={{ ...SPRING.smooth, delay: idx * 0.025 }}
            className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-white/60 dark:hover:bg-white/[0.03]"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#007AFF]/12 text-[#007AFF] dark:text-[#38BDF8]">
              <Icon paths={I.activity} size={14} strokeWidth={2.2} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold tracking-tight text-[var(--text-primary)]">
                {name}
              </p>
              <p className="mt-0.5 text-[11px] font-medium tabular-nums text-[var(--text-secondary)]">
                {formatDateTime(e.recognizedAt)}
              </p>
            </div>
            <span
              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.10em]"
              style={{
                background: c.bg,
                color: c.fg,
                border: `1px solid ${c.border}`,
              }}
            >
              {e.decision}
            </span>
            <div className="flex gap-2.5 text-[11px] font-semibold tabular-nums text-[var(--text-secondary)]">
              <span>
                <span className="font-bold uppercase tracking-wider opacity-65">
                  C:{' '}
                </span>
                {e.confidence ?? '—'}
              </span>
              <span>
                <span className="font-bold uppercase tracking-wider opacity-65">
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
});

const CameraTelemetryGrid = memo(function CameraTelemetryGrid({
  data,
  emptyLabel,
}: {
  data: unknown;
  emptyLabel: string;
}) {
  const record = data as Record<string, unknown> | null;
  if (!record || Object.keys(record).length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300/80 bg-white/40 p-8 text-center dark:border-white/[0.12] dark:bg-white/[0.02]">
        <p className="text-[12.5px] font-medium text-[var(--text-secondary)]">
          {emptyLabel}
        </p>
      </div>
    );
  }
  const entries = Object.entries(record);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {entries.map(([key, val], idx) => (
        <motion.div
          key={key}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING.smooth, delay: idx * 0.03 }}
          className="relative overflow-hidden rounded-2xl border border-white/85 bg-white/75 p-3.5 shadow-[0_1px_0_#FFF_inset] backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.04]"
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
            {key.replace(/([A-Z])/g, ' $1').trim()}
          </p>
          <div className="mt-1.5 break-all text-[13px] font-bold tabular-nums text-[var(--text-primary)]">
            {formatTelemetryValue(val)}
          </div>
        </motion.div>
      ))}
    </div>
  );
});

const CameraDetailTabs = memo(function CameraDetailTabs({
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
  const tabs: { key: TabKey; labelKey: string; icon: readonly string[]; tone: Tone }[] = [
    { key: 'events', labelKey: 'cameras.tabEvents', icon: I.activity, tone: 'blue' },
    { key: 'health', labelKey: 'cameras.tabHealth', icon: I.radar,    tone: 'emerald' },
    { key: 'worker', labelKey: 'cameras.tabWorker', icon: I.server,   tone: 'purple' },
  ];

  return (
    <div>
      <div
        role="tablist"
        aria-label={t('cameras.title')}
        className="inline-flex items-center gap-1 rounded-2xl border border-white/85 bg-white/70 p-1 shadow-[0_1px_0_#FFF_inset] backdrop-blur-xl dark:border-white/[0.10] dark:bg-white/[0.04]"
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
              className="relative overflow-hidden rounded-xl px-3.5 py-2 text-[12px] font-bold tracking-tight outline-none transition-colors"
              style={{
                color: active ? c.fg : 'var(--text-secondary)',
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
                <Icon paths={tb.icon} size={13} strokeWidth={2.3} />
                <span>{t(tb.labelKey)}</span>
              </span>
            </motion.button>
          );
        })}
      </div>

      <div className="mt-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={SPRING.smooth}
          >
            {tab === 'events' &&
              (events.isLoading ? (
                <GlassPageLoader label={t('cameras.loadingEvents')} />
              ) : events.isError ? (
                <GlassErrorState
                  message={getErrorMessage(events.error as Error)}
                />
              ) : (
                <CameraEventsTable data={events.data} />
              ))}

            {tab === 'health' &&
              (health.isLoading ? (
                <GlassPageLoader label={t('cameras.loadingHealth')} />
              ) : health.isError ? (
                <GlassErrorState
                  message={getErrorMessage(health.error as Error)}
                />
              ) : (
                <CameraTelemetryGrid
                  data={health.data}
                  emptyLabel={t('cameras.noHealth')}
                />
              ))}

            {tab === 'worker' &&
              (workerStatus.isLoading ? (
                <GlassPageLoader label={t('cameras.loadingWorker')} />
              ) : workerStatus.isError ? (
                <GlassErrorState
                  message={getErrorMessage(workerStatus.error as Error)}
                />
              ) : (
                <CameraTelemetryGrid
                  data={workerStatus.data}
                  emptyLabel={t('cameras.noWorker')}
                />
              ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * MAIN CAMERAS PAGE
 * ════════════════════════════════════════════════════════════════════════ */

export function CamerasPage() {
  const { t } = useI18n();
  usePageTitle(t('cameras.title'));
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();
  const { playTick, playPop } = usePremiumSound();

  /* ── Modal / Selection / Filter State ─────────────────────────────── */
  const [modalOpen, setModalOpen] = useState(false);
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Camera | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<CameraFilterMode>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [configForm, setConfigForm] = useState({
    fps: '10',
    recognitionEnabled: 'true',
    attendanceEnabled: 'true',
  });

  const [form, setForm] = useState<CameraFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof CameraFormState, string>>
  >({});
  const [discoverSubnet, setDiscoverSubnet] = useState('');

  /* ── Cameras Query ────────────────────────────────────────────────── */
  const cameras = useQuery({
    queryKey: queryKeys.cameras.all(),
    queryFn: () => camerasApi.list({ limit: 100 }),
    placeholderData: (previousData) => previousData,
  });

  const data = cameras.data as { items?: Camera[] } | undefined;
  const list = useMemo(() => data?.items ?? [], [data]);

  /* ── Derived Stats & Filtered List ────────────────────────────────── */
  const stats = useMemo(() => {
    const total = list.length;
    const online = list.filter((c) => c.status === 'ONLINE').length;
    const errors = list.filter((c) => c.status === 'ERROR').length;
    const recognition = list.filter((c) => c.recognitionEnabled).length;
    return { total, online, errors, recognition };
  }, [list]);

  const filteredList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return list.filter((c) => {
      if (filterMode === 'ONLINE' && c.status !== 'ONLINE') return false;
      if (filterMode === 'ERROR' && c.status !== 'ERROR') return false;
      if (filterMode === 'RECOGNITION' && !c.recognitionEnabled) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.host.toLowerCase().includes(q) ||
        String(c.port).includes(q) ||
        (c.location && c.location.toLowerCase().includes(q))
      );
    });
  }, [list, filterMode, searchQuery]);

  /* ── Mutations ────────────────────────────────────────────────────── */
  const create = useMutation({
    mutationFn: () =>
      camerasApi.create({
        name: form.name.trim(),
        host: form.host.trim(),
        port: parseInt(form.port, 10) || 554,
        protocol: form.protocol,
        streamPath: form.streamPath.trim() || undefined,
        location: form.location.trim() || undefined,
        username: form.username.trim() || undefined,
        password: form.password || undefined,
      }),
    onSuccess: () => {
      push('success', t('cameras.addedToast'));
      setModalOpen(false);
      setForm(INITIAL_FORM);
      setFormErrors({});
      void qc.invalidateQueries({ queryKey: queryKeys.cameras.all() });
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      enabled ? camerasApi.enable(id) : camerasApi.disable(id),
    onSuccess: () => {
      push('success', t('cameras.updatedToast'));
      void qc.invalidateQueries({ queryKey: queryKeys.cameras.all() });
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const startWorker = useMutation({
    mutationFn: (id: string) => camerasApi.startWorker(id),
    onSuccess: () => {
      push('success', t('cameras.workerStartedToast'));
      void qc.invalidateQueries({ queryKey: queryKeys.cameras.all() });
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const discover = useMutation({
    mutationFn: () =>
      camerasApi.discover(
        discoverSubnet.trim() ? { subnet: discoverSubnet.trim() } : {},
      ),
    onSuccess: () => {
      push('success', t('cameras.discoveryToast'));
      void qc.invalidateQueries({ queryKey: queryKeys.cameras.all() });
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const discovered = useMemo(
    () => (discover.data ?? []) as DiscoveredCamera[],
    [discover.data],
  );

  /* ── Validation & Handlers ────────────────────────────────────────── */
  const validateForm = useCallback((): boolean => {
    const errors: Partial<Record<keyof CameraFormState, string>> = {};
    if (!form.name.trim()) errors.name = t('cameras.validation.nameRequired');
    if (!form.host.trim()) errors.host = t('cameras.validation.hostRequired');
    const portNum = parseInt(form.port, 10);
    if (form.port && (Number.isNaN(portNum) || portNum < 1 || portNum > 65535)) {
      errors.port = t('cameras.validation.portRange');
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form, t]);

  const handleFormChange = useCallback(
    (field: keyof CameraFormState) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
        setFormErrors((prev) =>
          prev[field] ? { ...prev, [field]: undefined } : prev,
        );
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

  const handleCopyEndpoint = useCallback(
    (e: React.MouseEvent, camera: Camera) => {
      e.stopPropagation();
      const endpoint = `${camera.protocol.toLowerCase()}://${camera.host}:${camera.port}${
        camera.streamPath || ''
      }`;
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        void navigator.clipboard.writeText(endpoint);
        setCopiedId(camera.id);
        push('success', `${endpoint} nusxalandi`);
        setTimeout(() => setCopiedId(null), 1800);
      }
    },
    [push],
  );

  const { refetch: refetchCameras } = cameras;
  const handleRetry = useCallback(() => {
    void refetchCameras();
  }, [refetchCameras]);

  /* ── Detail Queries & Worker Controls ─────────────────────────────── */
  const selectedCamera = useMemo(
    () => list.find((c) => c.id === selectedCameraId) ?? null,
    [list, selectedCameraId],
  );

  const cameraEvents = useQuery({
    queryKey: queryKeys.cameras.events(selectedCameraId),
    queryFn: () => camerasApi.events(selectedCameraId!, { limit: 50 }),
    enabled: Boolean(selectedCameraId),
  });

  const cameraHealth = useQuery({
    queryKey: queryKeys.cameras.health(selectedCameraId),
    queryFn: () => camerasApi.health(selectedCameraId!),
    enabled: Boolean(selectedCameraId),
  });

  const cameraWorkerStatus = useQuery({
    queryKey: queryKeys.cameras.worker(selectedCameraId),
    queryFn: () => camerasApi.workerStatus(selectedCameraId!),
    enabled: Boolean(selectedCameraId),
    refetchInterval: 5000,
  });

  const stopWorker = useMutation({
    mutationFn: (id: string) => camerasApi.stopWorker(id),
    onSuccess: () => {
      push('success', t('cameras.workerStoppedToast'));
      void qc.invalidateQueries({ queryKey: queryKeys.cameras.all() });
      void qc.invalidateQueries({ queryKey: queryKeys.cameras.workersAll() });
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const restartWorker = useMutation({
    mutationFn: (id: string) => camerasApi.restartWorker(id),
    onSuccess: () => {
      push('success', t('cameras.workerRestartedToast'));
      void qc.invalidateQueries({ queryKey: queryKeys.cameras.all() });
      void qc.invalidateQueries({ queryKey: queryKeys.cameras.workersAll() });
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const deleteCamera = useMutation({
    mutationFn: (id: string) => camerasApi.remove(id),
    onSuccess: () => {
      push('success', t('cameras.deletedToast'));
      setDeleteTarget(null);
      setSelectedCameraId(null);
      void qc.invalidateQueries({ queryKey: queryKeys.cameras.all() });
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
      setDeleteTarget(null);
    },
  });

  const testConnection = useMutation({
    mutationFn: (d: { host: string; port: number }) =>
      camerasApi.testConnection(d),
    onSuccess: () => push('success', t('cameras.connectionToast')),
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const updateConfig = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      camerasApi.config(id, data),
    onSuccess: () => {
      push('success', t('cameras.configUpdatedToast'));
      setConfigModalOpen(false);
      void qc.invalidateQueries({ queryKey: queryKeys.cameras.all() });
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const handleOpenCameraSidecar = useCallback((cam: Camera) => {
    playPop();
    const sidecarData: QuickLookData = {
      type: 'general',
      id: cam.id,
      title: cam.name,
      subtitle: `${cam.protocol} · ${cam.location || 'Bino hududi'}`,
      status: {
        label: cam.status,
        tone: cam.status === 'ONLINE' ? 'green' : cam.status === 'ERROR' ? 'red' : 'neutral',
      },
      metrics: [
        { label: 'Protokol', value: cam.protocol },
        { label: 'Holati', value: cam.status },
        { label: 'Face ID', value: cam.recognitionEnabled ? 'Yoqilgan' : 'O\'chirilgan' },
        { label: 'Davomat', value: cam.attendanceEnabled ? 'Faol' : 'Nofaol' },
      ],
      details: [
        { label: 'Kamera ID', value: cam.id, copyable: true },
        { label: 'Nomi', value: cam.name },
        { label: 'Protokol', value: cam.protocol },
        { label: 'Host & Port', value: `${cam.host}:${cam.port}`, copyable: true },
        { label: 'Stream Path', value: cam.streamPath || '—', copyable: Boolean(cam.streamPath) },
        { label: 'Joylashuv', value: cam.location || '—' },
        { label: 'Faollik', value: cam.enabled ? 'Faol' : 'O\'chirilgan' },
      ],
      primaryAction: {
        label: t('cameras.configure') || 'Sozlash',
        onExecute: () => {
          setSelectedCameraId(cam.id);
          setConfigForm({
            fps: '10',
            recognitionEnabled: cam.recognitionEnabled ? 'true' : 'false',
            attendanceEnabled: cam.attendanceEnabled ? 'true' : 'false',
          });
          setConfigModalOpen(true);
        },
      },
    };
    openSidecar(sidecarData);
  }, [playPop, t]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        playTick();
        setModalOpen(true);
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        playTick();
        void cameras.refetch();
      } else if (e.key === '1') {
        playTick();
        setFilterMode('ALL');
      } else if (e.key === '2') {
        playTick();
        setFilterMode('ONLINE');
      } else if (e.key === '3') {
        playTick();
        setFilterMode('ERROR');
      } else if (e.key === '4') {
        playTick();
        setFilterMode('RECOGNITION');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cameras, playTick]);

  /* ── 1. Loading State ─────────────────────────────────────────────── */
  if (cameras.isLoading && !data) {
    return (
      <div className="page-container space-y-5">
        <CamerasSkeleton />
      </div>
    );
  }

  /* ── 2. Error State ───────────────────────────────────────────────── */
  if (cameras.isError && !data) {
    return (
      <div className="page-container space-y-5">
        <GlassSurfaceCard className="p-10">
          <GlassErrorState
            title={t('cameras.loadError')}
            message={getErrorMessage(cameras.error as Error)}
            onRetry={handleRetry}
          />
        </GlassSurfaceCard>
      </div>
    );
  }

  /* ── 3. Main Render ───────────────────────────────────────────────── */
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="page-container relative z-10 space-y-5 pb-10"
    >
      {toastNode}

      {/* ═══ 1 · HERO HEADER CARD ═══ */}
      <motion.div variants={cardVariants}>
        <GlassSurfaceCard className="p-6 sm:p-7">
          <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, rotate: -6 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={SPRING.smooth}
              className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-white"
              style={{
                background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
                boxShadow:
                  '0 12px 28px -8px rgba(0,122,255,0.48), inset 0 1.5px 0 rgba(255,255,255,0.48)',
              }}
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-2xl bg-[linear-gradient(180deg,rgba(255,255,255,0.42)_0%,transparent_55%)]"
              />
              <Icon paths={I.video} size={28} strokeWidth={2} className="relative z-10" />
            </motion.div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#007AFF]/12 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#007AFF] dark:text-[#38BDF8]">
                  <Icon paths={I.sparkles} size={11} strokeWidth={2.4} />
                  <span>{t('cameras.surveillance')}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/12 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-400">
                  <span className="medu-pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span>
                    {stats.online} {t('cameras.status.ONLINE')}
                  </span>
                </span>
                {stats.errors > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/12 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-red-600 dark:text-red-400">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                    <span>
                      {stats.errors} {t('cameras.status.ERROR')}
                    </span>
                  </span>
                )}
              </div>

              <h1 className="mt-2 text-2xl font-black tracking-tight text-[var(--text-primary)] sm:text-3xl">
                {t('cameras.title')}
              </h1>
              <p className="mt-1 text-[13.5px] font-medium text-[var(--text-secondary)]">
                {t('cameras.subtitle')}
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5 sm:self-center">
              <GlassButton
                type="button"
                variant="secondary"
                onClick={() => setDiscoverOpen(true)}
              >
                <span className="inline-flex items-center gap-2">
                  <Icon paths={I.radar} size={15} strokeWidth={2} />
                  <span>{t('cameras.discover')}</span>
                </span>
              </GlassButton>

              <GlassButton
                type="button"
                variant="primary"
                onClick={() => setModalOpen(true)}
              >
                <span className="inline-flex items-center gap-2">
                  <Icon paths={I.plus} size={15} strokeWidth={2.5} />
                  <span>{t('cameras.add')}</span>
                </span>
              </GlassButton>
            </div>
          </div>
        </GlassSurfaceCard>
      </motion.div>

      {/* ═══ 2 · INTERACTIVE KPI FILTER BAR ═══ */}
      {list.length > 0 && (
        <motion.div
          variants={containerVariants}
          className="grid grid-cols-2 gap-3.5 sm:grid-cols-4"
        >
          <KpiTile
            label={t('cameras.title')}
            value={stats.total}
            icon={I.video}
            tone="blue"
            active={filterMode === 'ALL'}
            onClick={() => setFilterMode('ALL')}
          />
          <KpiTile
            label={t('cameras.status.ONLINE')}
            value={stats.online}
            icon={I.checkCircle}
            tone="emerald"
            active={filterMode === 'ONLINE'}
            onClick={() =>
              setFilterMode((m) => (m === 'ONLINE' ? 'ALL' : 'ONLINE'))
            }
          />
          <KpiTile
            label={t('cameras.status.ERROR')}
            value={stats.errors}
            icon={I.alertCircle}
            tone="red"
            active={filterMode === 'ERROR'}
            onClick={() =>
              setFilterMode((m) => (m === 'ERROR' ? 'ALL' : 'ERROR'))
            }
          />
          <KpiTile
            label={t('cameras.recognition')}
            value={stats.recognition}
            icon={I.fingerprint}
            tone="purple"
            active={filterMode === 'RECOGNITION'}
            onClick={() =>
              setFilterMode((m) =>
                m === 'RECOGNITION' ? 'ALL' : 'RECOGNITION',
              )
            }
          />
        </motion.div>
      )}

      {/* ═══ 3 · CAMERAS DIRECTORY CARD + SEARCH BAR ═══ */}
      <motion.div variants={cardVariants}>
        <GlassSurfaceCard>
          {/* Creative Feature: Instant Camera Search & Filter Strip */}
          {list.length > 0 && (
            <div className="flex flex-col gap-3 border-b border-slate-200/70 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between dark:border-white/[0.08]">
              <div className="relative flex-1 sm:max-w-xs">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]">
                  <Icon paths={I.search} size={14} strokeWidth={2.2} />
                </span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Kamera nomi, IP yoki joylashuv..."
                  aria-label="Kamerani izlash"
                  className="w-full rounded-full border border-white/80 bg-white/65 py-1.5 pl-9 pr-8 text-[12.5px] font-medium text-[var(--text-primary)] placeholder:text-slate-400 outline-none transition-all focus:border-[#007AFF]/45 focus:bg-white dark:border-white/10 dark:bg-white/[0.05] dark:focus:bg-[#0F172A] [&::-webkit-search-cancel-button]:hidden"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Qidiruvni tozalash"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    <Icon paths={I.close} size={12} strokeWidth={2.3} />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                {(
                  [
                    { id: 'ALL', label: `Barchasi (${stats.total})` },
                    { id: 'ONLINE', label: `Online (${stats.online})` },
                    { id: 'ERROR', label: `Xatolik (${stats.errors})` },
                    { id: 'RECOGNITION', label: `Face ID (${stats.recognition})` },
                  ] as const
                ).map((pill) => (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setFilterMode(pill.id)}
                    className={[
                      'rounded-full px-3 py-1 transition-all',
                      filterMode === pill.id
                        ? 'bg-[#007AFF] text-white shadow-sm'
                        : 'border border-white/80 bg-white/60 text-[var(--text-secondary)] hover:text-[var(--text-primary)] dark:border-white/10 dark:bg-white/[0.04]',
                    ].join(' ')}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {list.length === 0 ? (
            <div className="relative p-10">
              <div className="flex flex-col items-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#007AFF]/12 text-[#007AFF] dark:text-[#38BDF8]">
                  <Icon paths={I.empty} size={26} strokeWidth={1.8} />
                </div>
                <p className="mt-4 text-[15px] font-bold tracking-tight text-[var(--text-primary)]">
                  {t('cameras.empty')}
                </p>
                <p className="mt-1 max-w-sm text-[12.5px] font-medium text-[var(--text-secondary)]">
                  {t('cameras.emptyHint')}
                </p>
                <div className="mt-5 flex gap-2.5">
                  <GlassButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setDiscoverOpen(true)}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Icon paths={I.radar} size={14} strokeWidth={2} />
                      <span>{t('cameras.discover')}</span>
                    </span>
                  </GlassButton>
                  <GlassButton
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => setModalOpen(true)}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Icon paths={I.plus} size={14} strokeWidth={2.5} />
                      <span>{t('cameras.add')}</span>
                    </span>
                  </GlassButton>
                </div>
              </div>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-[13.5px] font-bold text-[var(--text-primary)]">
                Filtr bo'yicha kamera topilmadi
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setFilterMode('ALL');
                }}
                className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#007AFF]/12 px-3 py-1 text-xs font-bold text-[#007AFF] dark:text-[#38BDF8]"
              >
                Filtrlarni tozalash
              </button>
            </div>
          ) : (
            <div className="relative divide-y divide-slate-200/70 dark:divide-white/[0.06]">
              {filteredList.map((camera, idx) => {
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
                  /* 🔧 CRITICAL FIX: `<motion.div role="button">` instead of `<motion.button>`
                     to prevent invalid nested `<button>` inside `<button>` DOM error! */
                  <motion.div
                    key={camera.id}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setSelectedCameraId(isSelected ? null : camera.id)
                    }
                    onKeyDown={(e: React.KeyboardEvent) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedCameraId(isSelected ? null : camera.id);
                      }
                    }}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ ...SPRING.smooth, delay: idx * 0.025 }}
                    aria-label={t('cameras.viewAria', { name: camera.name })}
                    aria-expanded={isSelected}
                    className={[
                      'group relative flex w-full cursor-pointer flex-wrap items-center gap-3.5 px-5 py-3.5 text-left transition-colors outline-none',
                      isSelected
                        ? 'bg-[#007AFF]/[0.06] dark:bg-[#007AFF]/[0.10]'
                        : 'hover:bg-white/60 dark:hover:bg-white/[0.03]',
                      'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#007AFF]/60',
                    ].join(' ')}
                  >
                    {/* Left Active Indicator */}
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none absolute left-1 top-2.5 bottom-2.5 w-[3.5px] rounded-full bg-gradient-to-b from-[#007AFF] to-[#5856D6] transition-opacity ${
                        isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'
                      }`}
                    />

                    {/* Gradient Camera Tile */}
                    <div
                      className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white"
                      style={{
                        background: gradient,
                        boxShadow:
                          'inset 0 1px 0 rgba(255,255,255,0.45), 0 6px 16px -6px rgba(15,23,42,0.25)',
                      }}
                    >
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 rounded-2xl bg-[linear-gradient(180deg,rgba(255,255,255,0.42)_0%,transparent_55%)]"
                      />
                      <Icon
                        paths={I.camera}
                        size={18}
                        strokeWidth={2}
                        className="relative z-10"
                      />
                    </div>

                    {/* Name + Endpoint + 1-Click Copy */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[14px] font-bold tracking-tight text-[var(--text-primary)]">
                          {camera.name}
                        </p>
                        {camera.location && (
                          <span className="hidden rounded-full bg-slate-200/70 px-2 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)] sm:inline-block dark:bg-white/[0.06]">
                            {camera.location}
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-medium text-[var(--text-secondary)]">
                        <button
                          type="button"
                          onClick={(e) => handleCopyEndpoint(e, camera)}
                          title="RTSP/ONVIF manzilni nusxalash"
                          className="inline-flex items-center gap-1 rounded-md border border-white/80 bg-white/75 px-1.5 py-0.5 font-mono font-semibold text-[var(--text-primary)] shadow-sm transition-colors hover:border-[#007AFF]/40 hover:text-[#007AFF] dark:border-white/10 dark:bg-white/[0.06] dark:hover:text-[#38BDF8]"
                        >
                          <Icon
                            paths={copiedId === camera.id ? I.check : I.router}
                            size={10}
                            strokeWidth={2.2}
                            className="opacity-75"
                          />
                          <span>{formatEndpoint(camera)}</span>
                        </button>
                        <ProtocolChip protocol={camera.protocol} />
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Icon
                            paths={I.clock}
                            size={10}
                            strokeWidth={2.2}
                            className="opacity-60"
                          />
                          <span>{formatDateTime(camera.lastSeenAt)}</span>
                        </span>
                      </div>
                    </div>

                    {/* Status + Recognition Badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      <CameraStatusBadge
                        status={camera.status}
                        label={statusLabel}
                      />
                      <RecognitionChip
                        enabled={camera.recognitionEnabled}
                        t={t}
                      />
                    </div>

                    {/* Quick Actions (Valid sibling `<button>` elements inside `<div role="button">`) */}
                    <div
                      className="flex items-center gap-1.5"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      {camera.status === 'CONFIGURED' && (
                        <MiniAction
                          icon={I.play}
                          label={
                            isWorkerPending
                              ? t('cameras.starting')
                              : t('cameras.startWorker')
                          }
                          tone="emerald"
                          onClick={() => handleStartWorker(camera.id)}
                          disabled={isWorkerPending}
                          ariaLabel={t('cameras.startWorkerAria', {
                            name: camera.name,
                          })}
                        />
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
                          camera.enabled
                            ? t('common.disable')
                            : t('common.enable')
                        }
                      />

                      <motion.button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenCameraSidecar(camera);
                        }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="inline-flex items-center gap-1 rounded-xl border border-white/70 bg-white/60 px-2.5 py-1 text-[11px] font-bold text-[var(--text-secondary)] shadow-sm hover:border-[#007AFF]/40 hover:bg-[#007AFF]/10 hover:text-[#007AFF] dark:border-white/10 dark:bg-white/[0.06] dark:hover:text-[#38BDF8]"
                        title="macOS Split-View Sidecar (◨)"
                        aria-label="Split-view sidecar"
                      >
                        <Icon paths={I.sidecar} size={11} strokeWidth={2.4} />
                        <span className="hidden xl:inline">Sidecar</span>
                      </motion.button>

                      <span className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)]">
                        <motion.span
                          animate={{ rotate: isSelected ? 180 : 0 }}
                          transition={SPRING.smooth}
                        >
                          <Icon
                            paths={I.chevronDown}
                            size={14}
                            strokeWidth={2.4}
                          />
                        </motion.span>
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </GlassSurfaceCard>
      </motion.div>

      {/* ═══ 4 · EXPANDABLE CAMERA DETAIL TELEMETRY PANEL ═══ */}
      <AnimatePresence>
        {selectedCamera && (
          <motion.div
            key={selectedCamera.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={SPRING.smooth}
          >
            <GlassSurfaceCard className="p-5 sm:p-6">
              <div className="relative space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <div
                      className="relative flex h-12 w-12 items-center justify-center rounded-2xl text-white"
                      style={{
                        background: cameraGradient(selectedCamera.name),
                        boxShadow:
                          'inset 0 1px 0 rgba(255,255,255,0.45), 0 6px 16px -6px rgba(15,23,42,0.25)',
                      }}
                    >
                      <Icon
                        paths={I.camera}
                        size={20}
                        strokeWidth={2}
                        className="relative z-10"
                      />
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-[16px] font-bold tracking-tight text-[var(--text-primary)]">
                        {selectedCamera.name}
                      </h2>
                      <p className="mt-0.5 inline-flex items-center gap-1.5 font-mono text-[11.5px] font-semibold text-[var(--text-secondary)]">
                        <Icon
                          paths={I.router}
                          size={11}
                          strokeWidth={2}
                          className="opacity-65"
                        />
                        <span>
                          {selectedCamera.host}:{selectedCamera.port} ·{' '}
                          {selectedCamera.protocol}
                        </span>
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
                          ariaLabel={t('cameras.restartWorkerAria', {
                            name: selectedCamera.name,
                          })}
                        />
                        <MiniAction
                          icon={I.stop}
                          label={t('cameras.stopWorker')}
                          tone="red"
                          onClick={() => stopWorker.mutate(selectedCamera.id)}
                          disabled={stopWorker.isPending}
                          ariaLabel={t('cameras.stopWorkerAria', {
                            name: selectedCamera.name,
                          })}
                        />
                      </>
                    )}

                    {(selectedCamera.status === 'CONFIGURED' ||
                      selectedCamera.status === 'ERROR') && (
                      <MiniAction
                        icon={I.play}
                        label={t('cameras.startWorkerTitle')}
                        tone="emerald"
                        primary
                        onClick={() => startWorker.mutate(selectedCamera.id)}
                        disabled={startWorker.isPending}
                        ariaLabel={t('cameras.startWorkerAria', {
                          name: selectedCamera.name,
                        })}
                      />
                    )}

                    <MiniAction
                      icon={I.settings}
                      label={t('cameras.configure')}
                      tone="purple"
                      onClick={() => {
                        setConfigForm({
                          fps: String(
                            (selectedCamera as Camera & { fps?: number }).fps ||
                              10,
                          ),
                          recognitionEnabled: String(
                            selectedCamera.recognitionEnabled,
                          ),
                          attendanceEnabled: String(
                            selectedCamera.attendanceEnabled,
                          ),
                        });
                        setConfigModalOpen(true);
                      }}
                      ariaLabel={t('cameras.configureAria', {
                        name: selectedCamera.name,
                      })}
                    />

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
                      ariaLabel={t('cameras.testConnectionAria', {
                        name: selectedCamera.name,
                      })}
                    />

                    <MiniAction
                      icon={I.trash}
                      label={t('common.delete')}
                      tone="red"
                      onClick={() => setDeleteTarget(selectedCamera)}
                      disabled={deleteCamera.isPending}
                      ariaLabel={t('cameras.deleteAria', {
                        name: selectedCamera.name,
                      })}
                    />
                  </div>
                </div>

                <CameraDetailTabs
                  events={cameraEvents}
                  health={cameraHealth}
                  workerStatus={cameraWorkerStatus}
                />
              </div>
            </GlassSurfaceCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ 5 · ADD CAMERA MODAL + LIVE STREAM URI PREVIEW ═══ */}
      <GlassModal
        open={modalOpen}
        onClose={handleCloseModal}
        title={t('cameras.add')}
        wide
      >
        <form className="space-y-5" onSubmit={handleSubmit} noValidate>
          <div className="flex items-center gap-3 rounded-2xl border border-[#007AFF]/25 bg-[#007AFF]/[0.06] px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#007AFF]/15 text-[#007AFF] dark:text-[#38BDF8]">
              <Icon paths={I.sparkles} size={18} strokeWidth={2} />
            </div>
            <p className="text-[12px] font-medium leading-snug text-[var(--text-primary)]">
              {t('cameras.registerDesc')}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Fixed: No duplicate error `<span>` below `<GlassField>` */}
            <GlassField
              label={t('cameras.form.name')}
              required
              error={formErrors.name}
            >
              <div className="relative">
                <FieldIcon icon={I.video} tone="blue" />
                <GlassInput
                  value={form.name}
                  onChange={handleFormChange('name')}
                  required
                  aria-invalid={Boolean(formErrors.name)}
                  placeholder={t('cameras.form.namePlaceholder')}
                  className="pl-11"
                />
              </div>
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

            <GlassField
              label={t('cameras.form.host')}
              required
              error={formErrors.host}
            >
              <div className="relative">
                <FieldIcon icon={I.router} tone="green" />
                <GlassInput
                  value={form.host}
                  onChange={handleFormChange('host')}
                  placeholder="192.168.1.100"
                  required
                  aria-invalid={Boolean(formErrors.host)}
                  className="pl-11"
                />
              </div>
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
                  className="pl-11"
                />
              </div>
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

          {/* Creative Addition: Live Synthesized RTSP/ONVIF Endpoint Preview */}
          <div className="rounded-2xl border border-slate-200/80 bg-slate-900/[0.03] px-4 py-3 dark:border-white/[0.08] dark:bg-white/[0.03]">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
              Oqim manzili ko'rinishi (Live URI Preview)
            </p>
            <p className="mt-1 truncate font-mono text-[12px] font-semibold text-[#007AFF] dark:text-[#38BDF8]">
              {buildPreviewStreamUri(form)}
            </p>
          </div>

          <div className="flex justify-end gap-2.5 border-t border-slate-200/70 pt-4 dark:border-white/[0.08]">
            <GlassButton
              type="button"
              variant="secondary"
              onClick={handleCloseModal}
              disabled={create.isPending}
            >
              {t('common.cancel')}
            </GlassButton>
            <GlassButton
              type="submit"
              variant="primary"
              disabled={create.isPending}
            >
              <span className="inline-flex items-center gap-2">
                <Icon paths={I.plus} size={14} strokeWidth={2.5} />
                <span>
                  {create.isPending ? t('common.saving') : t('cameras.add')}
                </span>
              </span>
            </GlassButton>
          </div>
        </form>
      </GlassModal>

      {/* ═══ 6 · DISCOVER CAMERAS MODAL ═══ */}
      <GlassModal
        open={discoverOpen}
        onClose={handleCloseDiscover}
        title={t('cameras.discoverTitle')}
        wide
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl border border-sky-500/25 bg-sky-500/[0.06] px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400">
              <Icon paths={I.radar} size={18} strokeWidth={2} />
            </div>
            <p className="text-[12px] font-medium leading-snug text-[var(--text-primary)]">
              {t('cameras.discoverHint')}
            </p>
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row">
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
            <GlassButton
              type="button"
              variant="primary"
              onClick={() => discover.mutate()}
              disabled={discover.isPending}
            >
              <span className="inline-flex items-center gap-2">
                <Icon paths={I.search} size={14} strokeWidth={2.5} />
                <span>
                  {discover.isPending
                    ? t('cameras.scanning')
                    : t('cameras.scan')}
                </span>
              </span>
            </GlassButton>
          </div>

          {discover.isError && (
            <div
              className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400"
              role="alert"
            >
              <Icon paths={I.warning} size={16} strokeWidth={2.2} />
              <span className="font-medium">
                {getErrorMessage(discover.error as Error)}
              </span>
            </div>
          )}

          {discovered.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200/70 dark:border-white/[0.08]">
              <div className="divide-y divide-slate-200/70 dark:divide-white/[0.08]">
                {discovered.map((camera, index) => (
                  <motion.div
                    key={`${camera.host}-${camera.port}-${index}`}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ ...SPRING.smooth, delay: index * 0.03 }}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/12 text-sky-600 dark:text-sky-400">
                      <Icon paths={I.camera} size={14} strokeWidth={2.2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[13px] font-bold tracking-tight text-[var(--text-primary)]">
                        {camera.host}:{camera.port}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <ProtocolChip protocol={camera.protocol} />
                        {camera.name && (
                          <span className="truncate text-[11px] font-medium text-[var(--text-secondary)]">
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
                      onClick={() => handleUseDiscovered(camera)}
                    />
                  </motion.div>
                ))}
              </div>
            </div>
          ) : discover.isSuccess ? (
            <div className="rounded-2xl border border-dashed border-slate-300/80 p-8 text-center dark:border-white/[0.12]">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/12 text-sky-600 dark:text-sky-400">
                <Icon paths={I.radar} size={20} strokeWidth={1.9} />
              </div>
              <p className="mt-3 text-[12.5px] font-medium text-[var(--text-secondary)]">
                {t('cameras.noCamerasFound')}
              </p>
            </div>
          ) : null}
        </div>
      </GlassModal>

      {/* ═══ 7 · CONFIG MODAL + FPS QUICK PRESET PILLS ═══ */}
      <GlassModal
        open={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
        title={t('cameras.configTitle')}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl border border-[#5856D6]/25 bg-[#5856D6]/[0.06] px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#5856D6]/15 text-[#5856D6] dark:text-[#818CF8]">
              <Icon paths={I.settings} size={18} strokeWidth={2} />
            </div>
            <p className="text-[12px] font-medium leading-snug text-[var(--text-primary)]">
              {t('cameras.configDesc')}
            </p>
          </div>

          <GlassField label={t('cameras.configFps')}>
            <div className="space-y-2">
              <div className="relative">
                <FieldIcon icon={I.activity} tone="blue" />
                <GlassInput
                  type="number"
                  min={1}
                  max={30}
                  value={configForm.fps}
                  onChange={(e) =>
                    setConfigForm((f) => ({ ...f, fps: e.target.value }))
                  }
                  className="pl-11"
                />
              </div>
              {/* Creative Feature: Instant FPS Preset Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                {FPS_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() =>
                      setConfigForm((f) => ({ ...f, fps: preset }))
                    }
                    className={[
                      'rounded-full px-2.5 py-0.5 text-[10.5px] font-bold transition-all',
                      configForm.fps === preset
                        ? 'bg-[#007AFF] text-white shadow-sm'
                        : 'border border-white/80 bg-white/60 text-[var(--text-secondary)] hover:text-[var(--text-primary)] dark:border-white/10 dark:bg-white/[0.05]',
                    ].join(' ')}
                  >
                    {preset} FPS
                  </button>
                ))}
              </div>
            </div>
          </GlassField>

          <GlassField label={t('cameras.configRecognition')}>
            <div className="relative">
              <FieldIcon icon={I.fingerprint} tone="purple" />
              <GlassSelect
                value={configForm.recognitionEnabled}
                onChange={(e) =>
                  setConfigForm((f) => ({
                    ...f,
                    recognitionEnabled: e.target.value,
                  }))
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
                  setConfigForm((f) => ({
                    ...f,
                    attendanceEnabled: e.target.value,
                  }))
                }
                className="pl-11"
              >
                <option value="true">{t('common.enable')}</option>
                <option value="false">{t('common.disable')}</option>
              </GlassSelect>
            </div>
          </GlassField>

          <div className="flex justify-end gap-2.5 border-t border-slate-200/70 pt-4 dark:border-white/[0.08]">
            <GlassButton
              type="button"
              onClick={() => setConfigModalOpen(false)}
              variant="secondary"
              disabled={updateConfig.isPending}
            >
              {t('common.cancel')}
            </GlassButton>
            <GlassButton
              type="button"
              onClick={() => {
                if (selectedCameraId) {
                  updateConfig.mutate({
                    id: selectedCameraId,
                    data: {
                      fps: parseInt(configForm.fps, 10) || 10,
                      recognitionEnabled:
                        configForm.recognitionEnabled === 'true',
                      attendanceEnabled:
                        configForm.attendanceEnabled === 'true',
                    },
                  });
                }
              }}
              disabled={updateConfig.isPending}
              variant="primary"
            >
              <span className="inline-flex items-center gap-2">
                <Icon paths={I.check} size={14} strokeWidth={2.5} />
                <span>
                  {updateConfig.isPending
                    ? t('common.saving')
                    : t('common.save')}
                </span>
              </span>
            </GlassButton>
          </div>
        </div>
      </GlassModal>

      {/* ═══ 8 · DELETE CONFIRMATION DIALOG ═══ */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => {
          if (!deleteCamera.isPending) setDeleteTarget(null);
        }}
        onConfirm={() => {
          if (!deleteTarget || deleteCamera.isPending) return;
          deleteCamera.mutate(deleteTarget.id);
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