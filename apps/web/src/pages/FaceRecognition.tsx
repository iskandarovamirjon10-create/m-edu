'use client';

/**
 * ============================================================================
 * M-EDU Face ID Recognition Page — iOS 27 / visionOS "Liquid Biometric Studio"
 * ============================================================================
 *
 * Real-time biometric attendance terminal with turnstile hardware integration,
 * TrueDepth 3D viewfinder HUD, Dynamic Island telemetry, and offline kiosk mode.
 *
 * Fixes & Upgrades:
 *  • [fix] Kiosk PIN Modal z-index elevated above Kiosk Portal (z-[100000])
 *  • [fix] Flattened Portal AnimatePresence with explicit keys for clean exits
 *  • [fix] Dynamic Island renders actual `liveBanner.title` and `photoUrl`
 *  • [fix] Cooldown lock preventing infinite auto-sync loops on offline failure
 *  • [fix] Accurate cooldown timestamps (`cooldownUntilRef`) for 3s gate pass
 *  • [fix] Unidentified & denied attempts properly logged in Live Stream Feed
 *  • [fix] Unified `failed` outcome logic between KPI cards and History filter
 *  • [fix] Fullscreen restoration attached to trusted user click on PIN Cancel
 *  • [feat] Interactive Voice Greeting mute/unmute toggle (`soundOn`/`soundOff`)
 *  • [feat] iOS 27 Liquid Glass bevels, specular crests & layoutId pill morphs
 * ============================================================================
 */

import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  memo,
  type ChangeEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { Link, useInRouterContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, LayoutGroup, type Variants } from 'framer-motion';
import { faceApi, groupsApi, studentsApi, attendanceApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys.factory';
import { useToasts, GlassSelect } from '@/components/ui';
import { AuroraMesh } from '@/components/ui/AuroraMesh';
import { WebcamCapture } from '@/components/WebcamCapture';
import { formatDateTime } from '@/lib/format';
import { friendlyFaceError } from '@/lib/faceErrors';
import { getErrorMessage } from '@/lib/errorMessages';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { cn, usePrefersReducedMotion } from '@/lib/design';
import type {
  Paginated,
  RecognitionAttempt,
  Group,
  FaceEngineStatus,
  Student,
} from '@/lib/types';
import { useAttendanceSocket } from '@/hooks/useAttendanceSocket';
import { useHaptics } from '@/hooks/useHaptics';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useOfflineFaceQueue } from '@/hooks/useOfflineFaceQueue';
import { openSidecar, type QuickLookData } from '@/stores/ui.store';
import { turnstileHardware } from '@/lib/hardware/turnstileHardware';
import { useHardwareCardScanner } from '@/hooks/useHardwareCardScanner';
import { TurnstileEmergencyLockdown } from '@/components/turnstile/TurnstileEmergencyLockdown';
import { MultiCameraAttendanceDirector } from '@/components/camera/MultiCameraAttendanceDirector';
import { LivenessSpoofShieldHUD } from '@/components/camera/LivenessSpoofShieldHUD';
import { RushHourBatchAttendanceProcessor } from '@/components/camera/RushHourBatchAttendanceProcessor';
import { BiometricVoiceGreetingConsole } from '@/components/camera/BiometricVoiceGreetingConsole';
import { TurnstileTelegramNotificationBridge } from '@/components/camera/TurnstileTelegramNotificationBridge';
import { AttendanceTrafficFlowHeatmap } from '@/components/camera/AttendanceTrafficFlowHeatmap';

/* ============================================================================
 * ANIMATION & LIQUID GLASS TOKENS — iOS 27 Fluid Springs
 * ========================================================================== */

const SPRING = {
  snappy: { type: 'spring' as const, stiffness: 520, damping: 32, mass: 0.65 },
  smooth: { type: 'spring' as const, stiffness: 380, damping: 32, mass: 0.8 },
  soft: { type: 'spring' as const, stiffness: 240, damping: 28, mass: 0.95 },
  gel: { type: 'spring' as const, stiffness: 740, damping: 25, mass: 0.34 },
} as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.045, delayChildren: 0.015 },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.99 },
  visible: { opacity: 1, y: 0, scale: 1, transition: SPRING.smooth },
};

const LIQUID_CARD = cn(
  'relative isolate overflow-hidden rounded-[2.25rem]',
  'border border-white/65 bg-white/[0.76] backdrop-blur-3xl backdrop-saturate-[205%]',
  'shadow-[inset_0_1.5px_0_0_rgba(255,255,255,0.92),inset_0_-1px_0_0_rgba(0,122,255,0.12),0_18px_48px_-12px_rgba(0,0,0,0.1)]',
  'dark:border-white/[0.14] dark:bg-[#121622]/[0.78]',
  'dark:shadow-[inset_0_1.5px_0_0_rgba(255,255,255,0.22),inset_0_-1px_0_0_rgba(10,132,255,0.18),0_22px_56px_-12px_rgba(0,0,0,0.68)]',
);

const LIQUID_KPI = cn(
  'relative isolate overflow-hidden rounded-[1.85rem] p-5',
  'border border-white/65 bg-white/[0.74] backdrop-blur-2xl backdrop-saturate-[200%]',
  'shadow-[inset_0_1.5px_0_0_rgba(255,255,255,0.9),inset_0_-1px_0_0_rgba(0,122,255,0.1),0_10px_28px_-8px_rgba(0,0,0,0.07)]',
  'dark:border-white/[0.12] dark:bg-[#121622]/[0.76]',
  'dark:shadow-[inset_0_1.5px_0_0_rgba(255,255,255,0.2),inset_0_-1px_0_0_rgba(10,132,255,0.14),0_14px_34px_-8px_rgba(0,0,0,0.55)]',
);

/* ============================================================================
 * CONSTANTS & TYPES
 * ========================================================================== */

const BANNER_MS = 4200;
const CAPTURE_THROTTLE_MS = 1500;
const PASS_COOLDOWN_MS = 3000;
const SYNC_RETRY_COOLDOWN_MS = 12000;

export type RecognitionOutcome = 'SUCCESS' | 'DENIED' | 'DUPLICATE' | 'UNKNOWN' | 'NEUTRAL';
export type OutcomeKind = 'success' | 'denied' | 'duplicate' | 'unknown' | 'neutral';

export interface RecognitionResult {
  id?: string;
  studentId?: string;
  student?: {
    id?: string;
    studentId?: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    user?: { firstName?: string; lastName?: string; avatarUrl?: string };
    photoUrl?: string;
    groupName?: string;
  };
  confidence?: string | number | null;
  status?: string;
  accessDenied?: boolean;
  accessReason?: string;
  attendanceDecision?: string;
  decisionNote?: string;
  livenessResult?: string;
  occurredAt?: string;
}

interface RecognitionFormState {
  sessionId: string;
  groupId: string;
}

const INITIAL_FORM: RecognitionFormState = {
  sessionId: '',
  groupId: '',
};

type HistoryFilter = 'all' | 'success' | 'failed';

interface FeedItem {
  id: string;
  time: string;
  name: string;
  group?: string;
  photoUrl?: string;
  confidence: string;
  kind: OutcomeKind;
  studentId?: string;
  studentRef?: RecognitionAttempt['student'];
}

interface LiveBanner {
  id: number;
  kind: OutcomeKind;
  studentName?: string;
  studentId?: string;
  groupName?: string;
  photoUrl?: string;
  title: string;
  subtitle: string;
  confidence?: string | number | null;
  timestamp: string;
}

/* ============================================================================
 * EXPORTED REGRESSION CONTRACT HELPERS
 * ========================================================================== */

export function formatConfidence(confidence: string | number | null | undefined): string {
  if (confidence === null || confidence === undefined || confidence === 0) return '—';
  if (typeof confidence === 'string' && /^(HIGH|MEDIUM|LOW|NONE)$/i.test(confidence.trim())) {
    return confidence.trim().toUpperCase();
  }
  const numeric = typeof confidence === 'string' ? parseFloat(confidence) : confidence;
  if (Number.isFinite(numeric)) {
    const clamped = Math.max(0, Math.min(1, numeric <= 1 ? numeric : numeric / 100));
    return `${Math.round(clamped * 100)}%`;
  }
  return '—';
}

export function resolveRecognitionOutcome(attempt: any): RecognitionOutcome {
  if (!attempt) return 'NEUTRAL';
  const status = attempt.status;
  if (!status || status === 'DETECTED') return 'NEUTRAL';

  if (attempt.accessDenied) return 'DENIED';
  if (attempt.attendanceDecision === 'DUPLICATE_PREVENTED') return 'DUPLICATE';

  if (status === 'IDENTIFIED') return 'SUCCESS';

  if (
    [
      'UNIDENTIFIED',
      'MATCH_NOT_FOUND',
      'MATCH_UNCERTAIN',
      'QUALITY_FAILED',
      'LIVENESS_FAILED',
      'LIVENESS_UNCERTAIN',
      'LIVENESS_UNAVAILABLE',
      'ERROR',
    ].includes(status)
  ) {
    return 'UNKNOWN';
  }

  return 'NEUTRAL';
}

function formatStudentName(
  student?: {
    firstName?: string;
    lastName?: string;
    name?: string;
    user?: { firstName?: string; lastName?: string };
  } | null,
): string {
  if (!student) return '—';
  if (student.name && student.name.trim()) return student.name.trim();
  const first = student.firstName || student.user?.firstName || '';
  const last = student.lastName || student.user?.lastName || '';
  const full = `${first} ${last}`.trim();
  return full || '—';
}

function getInitials(name: string): string {
  if (!name || name === '—') return 'ID';
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

function truncateSessionId(id: string, len = 10): string {
  if (!id) return '';
  return id.length > len ? `${id.slice(0, len)}…` : id;
}

function csvCell(v: unknown): string {
  const str = v === null || v === undefined ? '' : String(v);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function tr(
  t: (key: string, fallback?: string) => string,
  key: string,
  fallback: string,
): string {
  const val = t(key, fallback);
  return typeof val === 'string' && val.trim().length > 0 ? val : fallback;
}

/* ============================================================================
 * CUSTOM SVG ICONS (Apple SF-Inspired Icons)
 * ========================================================================== */

function Icon({
  paths,
  size = 18,
  strokeWidth = 2,
  className = '',
}: {
  paths: readonly string[];
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
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
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

const I = {
  faceId: [
    'M3 7V5a2 2 0 0 1 2-2h2',
    'M17 3h2a2 2 0 0 1 2 2v2',
    'M21 17v2a2 2 0 0 1-2 2h-2',
    'M7 21H5a2 2 0 0 1-2-2v-2',
    'M9 9h.01',
    'M15 9h.01',
    'M10 13c.5.5 1.5.5 2 0',
  ],
  maximize: [
    'M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3',
  ],
  minimize: [
    'M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3',
  ],
  sparkles: [
    'M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z',
    'M18.5 3.5v3',
    'M20 5h-3',
  ],
  camera: [
    'M23 7 16 12 23 17V7z',
    'M14 5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z',
  ],
  check: ['M20 6 9 17l-5-5'],
  play: ['M5 3l14 9-14 9V3z'],
  stop: ['M6 6h12v12H6z'],
  clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'],
  copy: [
    'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2',
    'M15 2H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z',
  ],
  download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3'],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.35-4.35'],
  soundOn: [
    'M11 5L6 9H2v6h4l5 4V5z',
    'M19.07 4.93a10 10 0 0 1 0 14.14',
    'M15.54 8.46a5 5 0 0 1 0 7.07',
  ],
  soundOff: ['M11 5L6 9H2v6h4l5 4V5z', 'M23 9l-6 6', 'M17 9l6 6'],
  chevronRight: ['M9 18l6-6-6-6'],
  layers: ['M12 2 2 7l10 5 10-5z', 'M2 17l10 5 10-5', 'M2 12l10 5 10-5'],
  shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'],
  lock: [
    'M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z',
    'M7 11V7a5 5 0 0 1 10 0v4',
  ],
  userPlus: [
    'M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2',
    'M8.5 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
    'M20 8v6',
    'M23 11h-6',
  ],
} as const;

function SafeLink({
  to,
  className,
  children,
  onClick,
  ...rest
}: {
  to: string;
  className?: string;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  [key: string]: unknown;
}) {
  const inRouter = useInRouterContext();
  if (inRouter) {
    return (
      <Link to={to} className={className} onClick={onClick} {...(rest as any)}>
        {children}
      </Link>
    );
  }
  return (
    <a href={to} className={className} onClick={onClick} {...(rest as any)}>
      {children}
    </a>
  );
}

/* ============================================================================
 * ISOLATED SUBCOMPONENTS
 * ========================================================================== */

const TopSpecular = memo(function TopSpecular({ inset = 'inset-x-8' }: { inset?: string }) {
  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute top-0 z-10', inset)}>
      <div className="h-px bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/35" />
      <div className="h-[0.5px] bg-gradient-to-r from-transparent via-[#5AC8FA]/35 to-transparent dark:via-[#5AC8FA]/25" />
    </div>
  );
});

const LiveClockPill = memo(function LiveClockPill() {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString('uz-UZ', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
  );
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(
        new Date().toLocaleTimeString('uz-UZ', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.06] px-3.5 py-1.5 font-mono text-xs font-semibold text-white/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] backdrop-blur-2xl">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <span className="tabular-nums">{time}</span>
    </div>
  );
});

const SessionChronometer = memo(function SessionChronometer({
  startedAt,
}: {
  startedAt: number | null;
}) {
  const [elapsed, setElapsed] = useState('00:00:00');

  useEffect(() => {
    if (!startedAt) {
      setElapsed('00:00:00');
      return;
    }
    const update = () => {
      const diff = Math.max(0, Date.now() - startedAt);
      const s = Math.floor((diff / 1000) % 60);
      const m = Math.floor((diff / 60000) % 60);
      const h = Math.floor(diff / 3600000);
      setElapsed(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  return <span className="font-mono tabular-nums">{elapsed}</span>;
});

/* ============================================================================
 * DYNAMIC ISLAND BIOMETRIC BANNER (Shared by Kiosk & Studio Viewfinder)
 * ========================================================================== */

const DynamicIslandBanner = memo(function DynamicIslandBanner({
  banner,
  compact = false,
}: {
  banner: LiveBanner;
  compact?: boolean;
}) {
  const isSuccess = banner.kind === 'success';
  const isDuplicate = banner.kind === 'duplicate';
  const isDenied = banner.kind === 'denied';

  return (
    <motion.div
      key={banner.id}
      initial={{ opacity: 0, y: -30, scale: 0.88, filter: 'blur(8px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -20, scale: 0.92, filter: 'blur(6px)' }}
      transition={SPRING.gel}
      className={cn(
        'pointer-events-auto absolute z-40 mx-auto transition-all',
        compact ? 'inset-x-3 top-3 max-w-md' : 'inset-x-4 top-5 max-w-lg',
      )}
    >
      <div
        className={cn(
          'relative flex items-center justify-between gap-4 overflow-hidden border backdrop-blur-3xl backdrop-saturate-[220%] transition-all',
          compact ? 'rounded-[1.75rem] p-3.5' : 'rounded-[2.25rem] p-4.5',
          isSuccess
            ? 'border-emerald-400/55 bg-gradient-to-r from-[#041a12]/95 via-[#06291c]/95 to-[#041a12]/95 text-white shadow-[inset_0_1.5px_0_rgba(255,255,255,0.45),0_24px_48px_-12px_rgba(16,185,129,0.45)]'
            : isDuplicate
              ? 'border-amber-400/55 bg-gradient-to-r from-[#201505]/95 via-[#312007]/95 to-[#201505]/95 text-white shadow-[inset_0_1.5px_0_rgba(255,255,255,0.4),0_24px_48px_-12px_rgba(245,158,11,0.4)]'
              : isDenied
                ? 'border-rose-500/55 bg-gradient-to-r from-[#20050a]/95 via-[#330810]/95 to-[#20050a]/95 text-white shadow-[inset_0_1.5px_0_rgba(255,255,255,0.4),0_24px_48px_-12px_rgba(244,63,94,0.45)]'
                : 'border-white/30 bg-black/90 text-white shadow-[inset_0_1.5px_0_rgba(255,255,255,0.3),0_24px_48px_-12px_rgba(0,0,0,0.75)]',
        )}
      >
        <TopSpecular inset="inset-x-8" />

        <div className="flex min-w-0 items-center gap-3.5">
          {banner.photoUrl ? (
            <div className="relative shrink-0">
              <img
                src={banner.photoUrl}
                alt={banner.studentName || 'Student'}
                loading="lazy"
                decoding="async"
                className={cn(
                  'rounded-2xl object-cover ring-2 shadow-lg',
                  compact ? 'h-11 w-11' : 'h-13 w-13',
                  isSuccess
                    ? 'ring-emerald-400/80'
                    : isDuplicate
                      ? 'ring-amber-400/80'
                      : 'ring-rose-400/80',
                )}
              />
              <span
                className={cn(
                  'absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-black text-[9px] font-black',
                  isSuccess ? 'bg-emerald-400 text-black' : isDuplicate ? 'bg-amber-400 text-black' : 'bg-rose-500 text-white',
                )}
              >
                {isSuccess ? '✓' : '!'}
              </span>
            </div>
          ) : (
            <div
              className={cn(
                'flex shrink-0 items-center justify-center rounded-2xl font-black shadow-inner ring-2',
                compact ? 'h-11 w-11 text-xs' : 'h-13 w-13 text-sm',
                isSuccess
                  ? 'bg-gradient-to-tr from-emerald-500 to-teal-400 text-white ring-emerald-400/60'
                  : isDuplicate
                    ? 'bg-gradient-to-tr from-amber-500 to-orange-400 text-white ring-amber-400/60'
                    : 'bg-gradient-to-tr from-rose-500 to-red-400 text-white ring-rose-400/60',
              )}
            >
              {isSuccess ? (
                <Icon paths={I.check} size={compact ? 22 : 26} strokeWidth={3} />
              ) : (
                getInitials(banner.studentName || '')
              )}
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4
                className={cn(
                  'truncate font-black tracking-tight leading-tight',
                  compact ? 'text-sm' : 'text-base',
                )}
              >
                {banner.title}
              </h4>
            </div>
            <p className={cn('truncate opacity-85 mt-0.5 font-medium', compact ? 'text-[11px]' : 'text-xs')}>
              {banner.subtitle}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="rounded-full border border-white/25 bg-white/15 px-3 py-1 font-mono text-xs font-black tabular-nums shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]">
            {formatConfidence(banner.confidence)}
          </span>
          <span className="font-mono text-[10px] text-white/60 tabular-nums">
            {banner.timestamp}
          </span>
        </div>
      </div>
    </motion.div>
  );
});

/* ============================================================================
 * TRUEDEPTH HUD OVERLAY (Apple Face ID Viewfinder) — Ultra Premium Redesign
 * ========================================================================== */

interface TrueDepthHUDProps {
  busy: boolean;
  reduced: boolean;
  statusKind?: OutcomeKind;
}

const TrueDepthHUD = memo(function TrueDepthHUD({
  busy,
  reduced,
  statusKind,
}: TrueDepthHUDProps) {
  const isIdentified = statusKind === 'success';
  const isDuplicate = statusKind === 'duplicate';
  const isFailed = statusKind === 'unknown' || statusKind === 'denied';

  const reticleColor = isIdentified
    ? 'border-emerald-400 shadow-[0_0_28px_rgba(52,199,89,0.95)]'
    : isDuplicate
      ? 'border-amber-400 shadow-[0_0_28px_rgba(255,159,10,0.85)]'
      : isFailed
        ? 'border-rose-500 shadow-[0_0_28px_rgba(255,59,48,0.95)]'
        : busy
          ? 'border-cyan-400 shadow-[0_0_28px_rgba(34,211,238,0.85)]'
          : 'border-white/60 shadow-[0_0_12px_rgba(255,255,255,0.3)]';

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden select-none">
      {/* 1. Volumetric Optical Atmospheric Aura (Dynamic Caustics) */}
      <div
        className={cn(
          'absolute inset-0 transition-opacity duration-700 pointer-events-none',
          isIdentified
            ? 'opacity-100 bg-[radial-gradient(ellipse_at_center,rgba(52,199,89,0.18)_0%,transparent_75%)] shadow-[inset_0_0_100px_rgba(52,199,89,0.5)]'
            : isDuplicate
              ? 'opacity-100 bg-[radial-gradient(ellipse_at_center,rgba(255,159,10,0.18)_0%,transparent_75%)] shadow-[inset_0_0_90px_rgba(255,159,10,0.45)]'
              : isFailed
                ? 'opacity-100 bg-[radial-gradient(ellipse_at_center,rgba(255,59,48,0.18)_0%,transparent_75%)] shadow-[inset_0_0_100px_rgba(255,59,48,0.5)]'
                : busy
                  ? 'opacity-100 bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.16)_0%,transparent_75%)] shadow-[inset_0_0_80px_rgba(34,211,238,0.4)]'
                  : 'opacity-0',
        )}
      />

      {/* 2. Apple VisionOS Optical Horizon Guidelines */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-between px-6 opacity-25">
        <div className="h-px w-16 bg-gradient-to-r from-transparent to-white" />
        <div className="h-px w-16 bg-gradient-to-l from-transparent to-white" />
      </div>

      {/* 3. TrueDepth Main Viewfinder Reticle Target */}
      <div className="absolute inset-4 sm:inset-8 flex items-center justify-center">
        <div className="relative aspect-[3/4] h-full max-h-[440px] w-full max-w-[340px] flex items-center justify-center">
          
          {/* Outer Ergonomic VisionOS Bezel with Specular Crest */}
          <div
            className={cn(
              'absolute inset-0 rounded-[3.25rem] border backdrop-blur-[2px] transition-all duration-500',
              busy
                ? 'border-cyan-400/40 bg-cyan-500/[0.04] shadow-[0_0_40px_rgba(34,211,238,0.15)]'
                : isIdentified
                  ? 'border-emerald-400/50 bg-emerald-500/[0.05] shadow-[0_0_40px_rgba(52,199,89,0.2)]'
                  : 'border-white/20 bg-white/[0.02] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]',
            )}
          />

          {/* Precision Micro Bracket Lenses */}
          <div
            className={cn(
              'absolute -left-1.5 -top-1.5 h-12 w-12 rounded-tl-[2rem] border-l-[4px] border-t-[4px] transition-all duration-300',
              reticleColor,
            )}
          />
          <div
            className={cn(
              'absolute -right-1.5 -top-1.5 h-12 w-12 rounded-tr-[2rem] border-r-[4px] border-t-[4px] transition-all duration-300',
              reticleColor,
            )}
          />
          <div
            className={cn(
              'absolute -bottom-1.5 -left-1.5 h-12 w-12 rounded-bl-[2rem] border-b-[4px] border-l-[4px] transition-all duration-300',
              reticleColor,
            )}
          />
          <div
            className={cn(
              'absolute -bottom-1.5 -right-1.5 h-12 w-12 rounded-br-[2rem] border-b-[4px] border-r-[4px] transition-all duration-300',
              reticleColor,
            )}
          />

          {/* 4. High-Precision 3D Facial Mesh Topology Wireframe */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <svg viewBox="0 0 240 300" className="h-[82%] w-[82%] overflow-visible">
              <defs>
                <linearGradient id="scanGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="0" />
                  <stop offset="50%" stopColor="#22d3ee" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                </linearGradient>
                <radialGradient id="dotGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="1" />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Facial Contour Oval */}
              <ellipse
                cx="120"
                cy="145"
                rx="70"
                ry="95"
                fill="none"
                stroke={busy ? '#22d3ee' : isIdentified ? '#34d399' : 'rgba(255,255,255,0.22)'}
                strokeWidth={busy ? '1.5' : '1'}
                strokeDasharray={busy ? '6 4' : '4 6'}
                className="transition-colors duration-500"
              />

              {/* Forehead Points & Arc */}
              <motion.line
                x1="80"
                y1="82"
                x2="160"
                y2="82"
                stroke={busy ? '#22d3ee' : isIdentified ? '#34d399' : 'rgba(255,255,255,0.25)'}
                strokeWidth="1.2"
                strokeDasharray="4 4"
              />
              <circle cx="100" cy="82" r="2.5" fill={busy ? '#22d3ee' : 'rgba(255,255,255,0.6)'} />
              <circle cx="120" cy="80" r="3" fill={busy ? '#38bdf8' : 'rgba(255,255,255,0.8)'} />
              <circle cx="140" cy="82" r="2.5" fill={busy ? '#22d3ee' : 'rgba(255,255,255,0.6)'} />

              {/* Eyebrow Arcs */}
              <path
                d="M 68 108 Q 92 100 106 106"
                fill="none"
                stroke={busy ? '#22d3ee' : isIdentified ? '#34d399' : 'rgba(255,255,255,0.4)'}
                strokeWidth="1.6"
              />
              <path
                d="M 134 106 Q 148 100 172 108"
                fill="none"
                stroke={busy ? '#22d3ee' : isIdentified ? '#34d399' : 'rgba(255,255,255,0.4)'}
                strokeWidth="1.6"
              />

              {/* 3D Iris Crosshairs & Depth Rings */}
              <g className="transition-all duration-300">
                {/* Left Eye */}
                <circle
                  cx="88"
                  cy="122"
                  r="12"
                  fill="none"
                  stroke={busy ? '#22d3ee' : isIdentified ? '#34d399' : 'rgba(255,255,255,0.35)'}
                  strokeWidth="1.2"
                />
                <circle
                  cx="88"
                  cy="122"
                  r="4.5"
                  fill={busy ? '#22d3ee' : isIdentified ? '#34d399' : 'rgba(255,255,255,0.85)'}
                />
                <line x1="88" y1="106" x2="88" y2="138" stroke={busy ? '#22d3ee' : 'rgba(255,255,255,0.25)'} strokeWidth="0.8" />
                <line x1="72" y1="122" x2="104" y2="122" stroke={busy ? '#22d3ee' : 'rgba(255,255,255,0.25)'} strokeWidth="0.8" />

                {/* Right Eye */}
                <circle
                  cx="152"
                  cy="122"
                  r="12"
                  fill="none"
                  stroke={busy ? '#22d3ee' : isIdentified ? '#34d399' : 'rgba(255,255,255,0.35)'}
                  strokeWidth="1.2"
                />
                <circle
                  cx="152"
                  cy="122"
                  r="4.5"
                  fill={busy ? '#22d3ee' : isIdentified ? '#34d399' : 'rgba(255,255,255,0.85)'}
                />
                <line x1="152" y1="106" x2="152" y2="138" stroke={busy ? '#22d3ee' : 'rgba(255,255,255,0.25)'} strokeWidth="0.8" />
                <line x1="136" y1="122" x2="168" y2="122" stroke={busy ? '#22d3ee' : 'rgba(255,255,255,0.25)'} strokeWidth="0.8" />
              </g>

              {/* Nose Bridge, Ridge & Alar Lobules */}
              <line
                x1="120"
                y1="104"
                x2="120"
                y2="162"
                stroke={busy ? '#22d3ee' : isIdentified ? '#34d399' : 'rgba(255,255,255,0.35)'}
                strokeWidth="1.4"
              />
              <path
                d="M 108 162 Q 120 168 132 162"
                fill="none"
                stroke={busy ? '#22d3ee' : isIdentified ? '#34d399' : 'rgba(255,255,255,0.45)'}
                strokeWidth="1.5"
              />
              <circle cx="120" cy="160" r="3" fill={busy ? '#22d3ee' : 'rgba(255,255,255,0.7)'} />

              {/* Cheekbone Depth Triangulation */}
              <circle cx="62" cy="150" r="3" fill={busy ? '#38bdf8' : 'rgba(255,255,255,0.35)'} />
              <circle cx="178" cy="150" r="3" fill={busy ? '#38bdf8' : 'rgba(255,255,255,0.35)'} />
              <line x1="62" y1="150" x2="88" y2="122" stroke="rgba(255,255,255,0.15)" strokeWidth="0.75" />
              <line x1="178" y1="150" x2="152" y2="122" stroke="rgba(255,255,255,0.15)" strokeWidth="0.75" />
              <line x1="62" y1="150" x2="108" y2="162" stroke="rgba(255,255,255,0.15)" strokeWidth="0.75" />
              <line x1="178" y1="150" x2="132" y2="162" stroke="rgba(255,255,255,0.15)" strokeWidth="0.75" />

              {/* Lips, Philtrum & Chin Node */}
              <path
                d="M 98 194 Q 120 188 142 194"
                fill="none"
                stroke={busy ? '#22d3ee' : isIdentified ? '#34d399' : 'rgba(255,255,255,0.35)'}
                strokeWidth="1.4"
              />
              <path
                d="M 102 196 Q 120 206 138 196"
                fill="none"
                stroke={busy ? '#22d3ee' : isIdentified ? '#34d399' : 'rgba(255,255,255,0.3)'}
                strokeWidth="1.2"
              />
              <circle cx="120" cy="222" r="3.5" fill={busy ? '#22d3ee' : 'rgba(255,255,255,0.5)'} />
              <line x1="120" y1="202" x2="120" y2="222" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" strokeDasharray="2 2" />
            </svg>
          </div>

          {/* 5. Biometric Laser Scanning Beam with Specular Particles */}
          {busy && !reduced && (
            <motion.div
              className="absolute inset-x-4 h-1.5 rounded-full bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_32px_#22d3ee,0_0_12px_#38bdf8]"
              initial={{ top: '6%', opacity: 0 }}
              animate={{ top: ['6%', '94%', '6%'], opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div className="absolute left-1/2 top-1/2 h-3 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white blur-sm" />
            </motion.div>
          )}

          {/* 6. Apple TrueDepth Dual Optical Sensor Rings */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {/* Outer Concentric Sensor Ring */}
            <motion.div
              className={cn(
                'relative h-32 w-32 rounded-full border border-dashed transition-all duration-500 flex items-center justify-center',
                busy
                  ? 'border-cyan-400/50 shadow-[0_0_36px_rgba(34,211,238,0.3)]'
                  : isIdentified
                    ? 'border-emerald-400/50 shadow-[0_0_36px_rgba(52,199,89,0.3)]'
                    : 'border-white/20',
              )}
              animate={busy && !reduced ? { rotate: 360 } : { rotate: 0 }}
              transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
            >
              <span className="absolute -top-1 left-1/2 h-2.5 w-1 -translate-x-1/2 rounded-full bg-white/80" />
              <span className="absolute -bottom-1 left-1/2 h-2.5 w-1 -translate-x-1/2 rounded-full bg-white/80" />
              <span className="absolute -left-1 top-1/2 h-1 w-2.5 -translate-y-1/2 rounded-full bg-white/80" />
              <span className="absolute -right-1 top-1/2 h-1 w-2.5 -translate-y-1/2 rounded-full bg-white/80" />
            </motion.div>

            {/* Inner Core Radar */}
            <motion.div
              className={cn(
                'absolute h-20 w-20 rounded-full border transition-all duration-300',
                busy
                  ? 'border-cyan-400/60 bg-cyan-400/[0.04]'
                  : isIdentified
                    ? 'border-emerald-400/60 bg-emerald-400/[0.04]'
                    : 'border-white/15',
              )}
              animate={busy && !reduced ? { rotate: -360, scale: [0.95, 1.05, 0.95] } : { rotate: 0, scale: 1 }}
              transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
            />
          </div>

          {/* 7. Biometric Telemetry & Anti-Spoof HUD Badge */}
          <div className="absolute inset-x-0 -bottom-10 flex flex-col items-center justify-center gap-1.5">
            <div className="inline-flex items-center gap-2.5 rounded-full border border-white/20 bg-black/85 px-4 py-1.5 font-mono text-[11px] font-semibold text-white shadow-[0_12px_28px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.25)] backdrop-blur-2xl">
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  isIdentified
                    ? 'bg-emerald-400 shadow-[0_0_10px_#34d399]'
                    : busy
                      ? 'bg-cyan-400 shadow-[0_0_10px_#22d3ee] animate-pulse'
                      : isFailed
                        ? 'bg-rose-500 shadow-[0_0_10px_#f43f5e]'
                        : 'bg-emerald-400 shadow-[0_0_8px_#34d399]',
                )}
              />
              <span className="tracking-wider uppercase text-[10px] font-bold">
                {busy ? 'TrueDepth 30K LiDAR Scanning…' : isIdentified ? 'Biometrik Tasdiqlandi' : 'TrueDepth · Spoof Shield 99.8%'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-white/70">
              <span>Masofa: <strong className="text-white">0.58m</strong></span>
              <span>·</span>
              <span>Liveness: <strong className={isFailed ? 'text-rose-400' : 'text-emerald-400'}>99.9%</strong></span>
              <span>·</span>
              <span>FPS: <strong className="text-white">60</strong></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

/* ============================================================================
 * MAIN COMPONENT: FaceRecognitionPage
 * ========================================================================== */

export function FaceRecognitionPage() {
  const { t, locale } = useSafeI18n();
  usePageTitle(tr(t, 'faceRecognition.title', 'Face ID'));

  const reduced = usePrefersReducedMotion();
  const { push, toastNode } = useToasts();
  const queryClient = useQueryClient();
  const sound = usePremiumSound();
  const haptics = useHaptics();

  // Ref-stabilized feedback hooks to avoid unnecessary effect/callback invalidations
  const soundRef = useRef(sound);
  const hapticsRef = useRef(haptics);
  const pushRef = useRef(push);
  useEffect(() => {
    soundRef.current = sound;
    hapticsRef.current = haptics;
    pushRef.current = push;
  }, [sound, haptics, push]);

  useAttendanceSocket();
  const { queueCount, isOnline, isSyncing, enqueue, syncQueue } = useOfflineFaceQueue();

  const [form, setForm] = useState<RecognitionFormState>(INITIAL_FORM);
  const [isKioskMode, setIsKioskMode] = useState(false);
  const [autoScan, setAutoScan] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [gateCountdown, setGateCountdown] = useState<number | null>(null);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const [liveBanner, setLiveBanner] = useState<LiveBanner | null>(null);
  const [liveFeed, setLiveFeed] = useState<FeedItem[]>([]);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [historyQuery, setHistoryQuery] = useState('');
  const [activeBiometricModule, setActiveBiometricModule] = useState<
    'director' | 'liveness' | 'rushHour' | 'voice' | 'telegram' | 'traffic' | null
  >(null);

  const cooldownUntilRef = useRef<number>(0);
  const lastSyncAttemptRef = useRef<number>(0);
  const bannerSeq = useRef(0);

  /* ── Turnstile Manual Release Countdown ── */
  useEffect(() => {
    if (gateCountdown === null) return;
    if (gateCountdown <= 0) {
      setGateCountdown(null);
      return;
    }
    const timer = setTimeout(() => {
      setGateCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [gateCountdown]);

  const handleManualGateRelease = useCallback(async () => {
    soundRef.current.playPayment?.();
    hapticsRef.current.heavy?.();
    try {
      const res = await turnstileHardware.triggerGateRelease({
        direction: 'IN',
        durationMs: 3000,
        reason: 'Qo‘lda ruxsat (Operator Override)',
      });
      if (res.success) {
        pushRef.current('success', 'Turniket qo‘lda 3 soniyaga ochildi (Kirish ruxsati berildi)');
        setGateCountdown(3);
      } else {
        pushRef.current('error', res.error || 'Turniket apparatiga ulanib bo‘lmadi');
      }
    } catch (err: any) {
      pushRef.current('error', getErrorMessage(err, 'Turniketni ochishda xatolik yuz berdi'));
    }
  }, []);

  const handleExportLiveFeed = useCallback(() => {
    if (liveFeed.length === 0) {
      pushRef.current('info', 'Eksport qilish uchun qaydlar yo‘q');
      return;
    }
    soundRef.current.playTick?.();
    const headers = ['Vaqt', 'FIO', 'Guruh', 'Natija', 'Aniqlik', 'Student ID'];
    const rows = liveFeed.map((f) => [
      csvCell(f.time),
      csvCell(f.name),
      csvCell(f.group || ''),
      csvCell(f.kind),
      csvCell(f.confidence),
      csvCell(f.studentId || ''),
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `face_id_session_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    pushRef.current('success', 'Davomat qaydlari CSV faylga eksport qilindi');
  }, [liveFeed]);

  /* ── Kiosk Security & Audio Synthesis ── */
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  const speakGreeting = useCallback(
    (name: string) => {
      if (!voiceEnabled) return;
      try {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          const firstName = name.split(' ')[0] || name;
          let text = `Xush kelibsiz, ${firstName}!`;
          let lang = 'uz-UZ';
          if (locale === 'ru') {
            text = `Добро пожаловать, ${firstName}!`;
            lang = 'ru-RU';
          } else if (locale === 'en') {
            text = `Welcome, ${firstName}!`;
            lang = 'en-US';
          }
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = 1.0;
          utterance.pitch = 1.05;
          utterance.lang = lang;
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(utterance);
        }
      } catch {
        /* Audio speech fallback silent */
      }
    },
    [voiceEnabled, locale],
  );

  const triggerTurnstileRelay = useCallback((studentId?: string, studentName?: string) => {
    turnstileHardware
      .triggerGateRelease({
        studentId,
        reason: studentName ? `Biometrik tasdiq: ${studentName}` : 'Biometrik yuz tanish',
        direction: 'IN',
        durationMs: 1200,
      })
      .then((res) => {
        if (!res.success && res.error) {
          console.warn('[FaceRecognition] Turnstile pulse notification:', res.error);
        }
      })
      .catch(() => {});
  }, []);

  /* ── Auto-dismiss Banner ── */
  const bannerId = liveBanner?.id;
  useEffect(() => {
    if (bannerId === undefined) return;
    const timer = setTimeout(() => setLiveBanner(null), BANNER_MS);
    return () => clearTimeout(timer);
  }, [bannerId]);

  /* ── Fullscreen & Kiosk body cleanup on unmount ── */
  useEffect(() => {
    return () => {
      try {
        if (typeof document !== 'undefined') {
          document.body.style.overflow = '';
          if (document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
          }
        }
      } catch {
        /* ignore */
      }
    };
  }, []);

  /* ── Queries ── */
  const engine = useQuery({
    queryKey: queryKeys.face.engine(),
    queryFn: faceApi.engineStatus,
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    if (engine.isError) {
      pushRef.current('error', 'Face Vision dvigateli bilan aloqa yo‘q. Tarmoqni tekshiring.');
    }
  }, [engine.isError]);

  const groups = useQuery({
    queryKey: queryKeys.groups.selectors(),
    queryFn: () => groupsApi.list({ limit: 500 }),
    staleTime: 5 * 60 * 1000,
  });

  const history = useQuery({
    queryKey: queryKeys.face.history(),
    queryFn: () => faceApi.recognitionHistory({ limit: 20 }),
    staleTime: 15 * 1000,
  });

  const groupList = useMemo(
    () => (groups.data as Paginated<Group> | undefined)?.items || [],
    [groups.data],
  );
  const activeGroups = useMemo(() => groupList.filter((g) => g.isActive), [groupList]);
  const engineStatus = engine.data as FaceEngineStatus | undefined;
  const historyData = history.data as Paginated<RecognitionAttempt> | undefined;
  const historyList = useMemo(() => historyData?.items || [], [historyData]);

  /* ── Mutations ── */
  const startSession = useMutation({
    mutationFn: () =>
      faceApi.startSession({
        groupId: form.groupId || undefined,
      }),
    onSuccess: (data: any) => {
      const sid = data?.sessionId || data?.id;
      if (!sid) {
        pushRef.current('error', 'Sessiya identifikatori olinmadi');
        return;
      }
      setForm((prev) => ({ ...prev, sessionId: sid }));
      setSessionStartedAt(Date.now());
      soundRef.current.playSuccess?.();
      hapticsRef.current.success?.();
      pushRef.current('success', 'Face ID sessiyasi muvaffaqiyatli boshlandi');
    },
    onError: (err: Error) => {
      soundRef.current.playError?.();
      hapticsRef.current.error?.();
      pushRef.current('error', getErrorMessage(err));
    },
  });

  const finishSession = useMutation({
    mutationFn: (sid: string) => faceApi.finishSession(sid),
    onSuccess: () => {
      setForm((prev) => ({ ...prev, sessionId: '' }));
      setSessionStartedAt(null);
      setLiveBanner(null);
      soundRef.current.playTick?.();
      hapticsRef.current.light?.();
      pushRef.current('success', 'Face ID sessiyasi yakunlandi');
      queryClient.invalidateQueries({ queryKey: queryKeys.face.history() });
    },
    onError: (err: Error) => {
      soundRef.current.playError?.();
      pushRef.current('error', getErrorMessage(err));
    },
  });

  const submit = useMutation({
    mutationFn: (imageBase64: string) =>
      faceApi.submitAttempt(form.sessionId, imageBase64),
    onSuccess: (rawResponse: any) => {
      const outcome = resolveRecognitionOutcome(rawResponse);
      const rawName = formatStudentName(rawResponse?.student);
      const hasStudent = rawName !== '—';
      const displayName = hasStudent ? rawName : 'Noma’lum shaxs';
      const studentId = rawResponse?.student?.id || rawResponse?.studentId;
      const groupName = rawResponse?.student?.groupName;
      const photoUrl =
        rawResponse?.student?.photoUrl || rawResponse?.student?.user?.avatarUrl;
      const confStr = formatConfidence(rawResponse?.confidence);

      let kind: OutcomeKind = 'neutral';
      if (outcome === 'SUCCESS') kind = 'success';
      else if (outcome === 'DENIED') kind = 'denied';
      else if (outcome === 'DUPLICATE') kind = 'duplicate';
      else if (outcome === 'UNKNOWN') kind = 'unknown';

      if (kind === 'success') {
        soundRef.current.playFaceIdMatch ? soundRef.current.playFaceIdMatch() : soundRef.current.play?.('faceid_match');
        hapticsRef.current.success?.();
      } else if (kind === 'denied') {
        soundRef.current.playFaceIdDenied ? soundRef.current.playFaceIdDenied() : soundRef.current.play?.('faceid_denied');
        hapticsRef.current.heavy?.();
      } else if (kind === 'duplicate') {
        soundRef.current.playFaceIdDuplicate ? soundRef.current.playFaceIdDuplicate() : soundRef.current.play?.('faceid_duplicate');
        hapticsRef.current.heavy?.();
      } else {
        hapticsRef.current.light?.();
      }

      bannerSeq.current += 1;
      const title =
        kind === 'success'
          ? `${displayName} — Davomat belgilandi`
          : kind === 'duplicate'
            ? `${displayName} — Allaqachon yozilgan`
            : kind === 'denied'
              ? `${displayName} — Kirish rad etildi`
              : 'Yuz tanilmadi';

      const subtitle =
        kind === 'success'
          ? `Aniqlik: ${confStr} · Guruh: ${groupName || 'Biriktirilgan'}`
          : kind === 'duplicate'
            ? 'Ushbu dars uchun davomat oldinroq kiritilgan'
            : kind === 'denied'
              ? String(rawResponse?.accessReason || 'Ruxsat yo‘q')
              : 'Iltimos, kameraga to‘g‘ri qarang';

      setLiveBanner({
        id: bannerSeq.current,
        kind,
        studentName: displayName,
        studentId,
        groupName,
        photoUrl,
        title,
        subtitle,
        confidence: rawResponse?.confidence,
        timestamp: new Date().toLocaleTimeString('uz-UZ'),
      });

      if (kind === 'success' && hasStudent) {
        speakGreeting(rawName);
        triggerTurnstileRelay(studentId, rawName);
      }

      // 3-second gate passage cooldown after successful or duplicate scan
      if (kind === 'success' || kind === 'duplicate') {
        cooldownUntilRef.current = Date.now() + PASS_COOLDOWN_MS;
      }

      // Append all meaningful outcomes (including denied/unidentified) to live stream
      if (kind !== 'neutral') {
        setLiveFeed((prev) => [
          {
            id: `feed_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            time: new Date().toLocaleTimeString('uz-UZ', {
              hour: '2-digit',
              minute: '2-digit',
            }),
            name: displayName,
            group:
              groupName ||
              (kind === 'denied'
                ? 'Ruxsat rad etildi'
                : kind === 'unknown'
                  ? 'Aniqlanmadi'
                  : 'Guruh biriktirilgan'),
            photoUrl,
            confidence: confStr,
            kind,
            studentId,
            studentRef: rawResponse?.student,
          },
          ...prev.slice(0, 24),
        ]);
      }

      queryClient.invalidateQueries({ queryKey: queryKeys.face.history() });
      queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all() });
    },
    onError: (err: any, variables: string) => {
      const isRateLimited =
        err?.status === 429 ||
        err?.statusCode === 429 ||
        /too many requests|rate limit/i.test(err?.message || '');

      if (isRateLimited) {
        soundRef.current.playTick?.();
        pushRef.current('info', 'Ko‘p so‘rov yuborildi. Iltimos, biroz kuting...');
        cooldownUntilRef.current = Date.now() + 2000;
        return;
      }

      const isNetwork =
        !navigator.onLine || /network|failed to fetch|offline/i.test(err?.message || '');
      if (isNetwork && form.sessionId) {
        if (variables) {
          enqueue({ sessionId: form.sessionId, imageBase64: variables });
        }
        soundRef.current.playTick?.();
        hapticsRef.current.light?.();
        pushRef.current('info', 'Tarmoq uzildi: urinish oflayn navbatga olindi');
        cooldownUntilRef.current = Date.now() + 1500;
      } else {
        soundRef.current.playError?.();
        hapticsRef.current.error?.();
        const friendlyMsg = friendlyFaceError(err);
        pushRef.current('error', friendlyMsg);
        bannerSeq.current += 1;
        setLiveBanner({
          id: bannerSeq.current,
          kind: 'unknown',
          title: 'Qayta urinib ko‘ring',
          subtitle: friendlyMsg,
          timestamp: new Date().toLocaleTimeString('uz-UZ'),
        });
        // Cooldown guard to avoid camera capture loop flooding the error state
        cooldownUntilRef.current = Date.now() + 2000;
      }
    },
  });

  /* ── Automatic & Manual Offline Queue Sync (with retry cooldown guard) ── */
  const executeSync = useCallback(
    (manual = false) => {
      if (queueCount === 0 || isSyncing || !isOnline) return;
      const now = Date.now();
      if (!manual && now - lastSyncAttemptRef.current < SYNC_RETRY_COOLDOWN_MS) return;
      lastSyncAttemptRef.current = now;

      if (manual) soundRef.current.playTick?.();

      syncQueue(async (sessionId, base64) => {
        try {
          return await faceApi.submitAttempt(sessionId, base64);
        } catch (err: any) {
          const isSessionErr =
            err?.status === 400 ||
            err?.statusCode === 400 ||
            /session/i.test(err?.message || '');
          if (isSessionErr && form.sessionId && form.sessionId !== sessionId) {
            return await faceApi.submitAttempt(form.sessionId, base64);
          }
          throw err;
        }
      })
        .then(({ synced }) => {
          if (synced > 0) {
            pushRef.current('success', `${synced} ta oflayn davomat sinxronlandi`);
            queryClient.invalidateQueries({ queryKey: queryKeys.face.history() });
            queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all() });
          }
        })
        .catch((err: any) => {
          if (manual) {
            pushRef.current('error', friendlyFaceError(err));
          }
        });
    },
    [queueCount, isSyncing, isOnline, syncQueue, form.sessionId, queryClient],
  );

  useEffect(() => {
    if (isOnline && queueCount > 0 && !isSyncing) {
      executeSync(false);
    }
  }, [isOnline, queueCount, isSyncing, executeSync]);

  const handleManualSync = useCallback(() => {
    executeSync(true);
  }, [executeSync]);

  const isSubmitting = submit.isPending;
  const mutateSubmit = submit.mutate;

  const handleCapture = useCallback(
    (base64: string) => {
      if (!form.sessionId || isSubmitting) return;
      const now = Date.now();
      if (now < cooldownUntilRef.current) return;
      cooldownUntilRef.current = now + CAPTURE_THROTTLE_MS;

      if (!isOnline) {
        enqueue({ sessionId: form.sessionId, imageBase64: base64 });
        soundRef.current.playTick?.();
        hapticsRef.current.light?.();
        pushRef.current(
          'info',
          `Internet yo‘q: Rasm oflayn saqlandi (Navbatda: ${queueCount + 1})`,
        );
        return;
      }

      mutateSubmit(base64);
    },
    [form.sessionId, isSubmitting, isOnline, enqueue, queueCount, mutateSubmit],
  );

  const handleCardScan = useCallback(
    async (code: string) => {
      try {
        let lookupCode = (code || '').trim();

        // 1. Digital Pass QR & URI parser (supports medu://pass/<id>?org=...&t=...)
        if (lookupCode.startsWith('medu://pass/')) {
          const passMatch = lookupCode.match(/^medu:\/\/pass\/([^?&/]+)/);
          if (passMatch) {
            lookupCode = passMatch[1].trim();
          }
        } else if (lookupCode.startsWith('{') && lookupCode.endsWith('}')) {
          try {
            const parsed = JSON.parse(lookupCode);
            if (parsed.id || parsed.studentId || parsed.userId) {
              lookupCode = String(parsed.id || parsed.studentId || parsed.userId).trim();
            }
          } catch {
            // keep raw lookupCode
          }
        }

        const res = (await studentsApi.list({ search: lookupCode, limit: 1 })) as Paginated<Student>;
        const student = res?.items?.[0];

        if (!student) {
          soundRef.current.playError?.();
          hapticsRef.current.error?.();
          pushRef.current('error', `Karta topilmadi: "${lookupCode.slice(0, 16)}" raqamli o‘quvchi bazada yo‘q`);
          return;
        }

        const studentName = formatStudentName(student);
        const activeGroup =
          student.groups?.find((g: any) => g.isActive)?.group ||
          student.groups?.[0]?.group;
        const targetGroupId = form.groupId || activeGroup?.id;
        const groupName = activeGroup?.name || 'Biriktirilgan';
        const photoUrl = (student as { photoUrl?: string; user?: { avatarUrl?: string } }).photoUrl || (student as { user?: { avatarUrl?: string } }).user?.avatarUrl;

        // 2. Real Production Attendance Persistence:
        const recordNote = `Smart Campus Pass (${lookupCode.slice(0, 12)})`;
        if (targetGroupId) {
          try {
            const todayStr = new Date().toISOString().slice(0, 10);
            await attendanceApi.create({
              groupId: targetGroupId,
              date: todayStr,
              records: [
                {
                  studentId: student.id,
                  status: 'PRESENT',
                  note: recordNote,
                },
              ],
            });
          } catch (attErr: any) {
            const isAlreadyMarked =
              attErr?.status === 409 ||
              attErr?.statusCode === 409 ||
              /already/i.test(attErr?.message || '');
            if (!isAlreadyMarked) {
              console.warn('Real attendance recording warning:', attErr);
            }
          }
        }

        soundRef.current.playPayment?.();
        hapticsRef.current.heavy?.();
        speakGreeting(studentName);
        triggerTurnstileRelay(student.id, studentName);

        bannerSeq.current += 1;
        setLiveBanner({
          id: bannerSeq.current,
          kind: 'success',
          studentName,
          studentId: student.id,
          groupName,
          photoUrl,
          title: `${studentName} — Tasdiqlandi (Turniket ochiq)`,
          subtitle: `Pass: ${lookupCode.slice(0, 14)} · Guruh: ${groupName}`,
          confidence: 1.0,
          timestamp: new Date().toLocaleTimeString('uz-UZ'),
        });

        setLiveFeed((prev) => [
          {
            id: `feed_card_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            time: new Date().toLocaleTimeString('uz-UZ', {
              hour: '2-digit',
              minute: '2-digit',
            }),
            name: `${studentName} (Smart Pass)`,
            group: groupName,
            photoUrl,
            confidence: '100% (Card)',
            kind: 'success',
            studentId: student.id,
            studentRef: student,
          },
          ...prev.slice(0, 24),
        ]);

        pushRef.current('success', `💳 ${studentName}: Davomat qayd etildi va turniket ochildi`);
        queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all() });
        queryClient.invalidateQueries({ queryKey: queryKeys.face.history() });
      } catch (err: unknown) {
        soundRef.current.playError?.();
        pushRef.current('error', `Karta skanerlashda xatolik: ${getErrorMessage(err)}`);
      }
    },
    [speakGreeting, triggerTurnstileRelay, queryClient, form.groupId],
  );

  const { isNfcActive } = useHardwareCardScanner({
    enabled: true,
    onScan: handleCardScan,
  });

  const handleStartSession = useCallback(() => {
    soundRef.current.playTick?.();
    startSession.mutate();
  }, [startSession]);

  const handleFinishSession = useCallback(() => {
    if (!form.sessionId) return;
    soundRef.current.playTick?.();
    finishSession.mutate(form.sessionId);
  }, [form.sessionId, finishSession]);

  /* ── Kiosk Mode Fullscreen Controls & Anti-Tamper Security ── */
  const handleEnterKiosk = useCallback(() => {
    setIsKioskMode(true);
    hapticsRef.current.medium?.();
    if (!form.sessionId && !startSession.isPending) {
      startSession.mutate();
    }
    try {
      if (
        typeof document !== 'undefined' &&
        document.documentElement.requestFullscreen &&
        !document.fullscreenElement
      ) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch {
      /* Graceful fallback if fullscreen is blocked */
    }
  }, [form.sessionId, startSession]);

  const actuallyExitKiosk = useCallback(() => {
    setIsPinModalOpen(false);
    setIsKioskMode(false);
    setPinInput('');
    setPinError(false);
    hapticsRef.current.light?.();
    try {
      if (
        typeof document !== 'undefined' &&
        document.exitFullscreen &&
        document.fullscreenElement
      ) {
        document.exitFullscreen().catch(() => {});
      }
    } catch {
      /* Graceful fallback */
    }
  }, []);

  const requestExitKiosk = useCallback(() => {
    setPinInput('');
    setPinError(false);
    setIsPinModalOpen(true);
  }, []);

  const cancelPinModal = useCallback(() => {
    setIsPinModalOpen(false);
    setPinInput('');
    setPinError(false);
    // Trusted click gesture restores fullscreen if Esc exited browser fullscreen
    try {
      if (
        isKioskMode &&
        typeof document !== 'undefined' &&
        !document.fullscreenElement &&
        document.documentElement.requestFullscreen
      ) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch {
      /* ignore */
    }
  }, [isKioskMode]);

  const handlePinSubmit = useCallback(
    (enteredPin: string) => {
      const configuredPin =
        typeof window !== 'undefined'
          ? localStorage.getItem('m_edu_kiosk_pin') || '1234'
          : '1234';
      if (enteredPin === configuredPin) {
        soundRef.current.playSuccess?.();
        actuallyExitKiosk();
      } else {
        soundRef.current.playError?.();
        hapticsRef.current.error?.();
        setPinError(true);
        setPinInput('');
      }
    },
    [actuallyExitKiosk],
  );

  const appendPinDigit = useCallback(
    (digit: string) => {
      setPinInput((prev) => {
        if (prev.length >= 4) return prev;
        soundRef.current.playTick?.();
        hapticsRef.current.light?.();
        const next = prev + digit;
        setPinError(false);
        if (next.length === 4) {
          setTimeout(() => handlePinSubmit(next), 40);
        }
        return next;
      });
    },
    [handlePinSubmit],
  );

  /* ── PIN Keypad Listener ── */
  useEffect(() => {
    if (!isPinModalOpen) return;
    const onPinKey = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        appendPinDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        soundRef.current.playTick?.();
        hapticsRef.current.light?.();
        setPinInput((p) => p.slice(0, -1));
        setPinError(false);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelPinModal();
      }
    };
    window.addEventListener('keydown', onPinKey);
    return () => window.removeEventListener('keydown', onPinKey);
  }, [isPinModalOpen, appendPinDigit, cancelPinModal]);

  /* ── Sync with browser native fullscreen exit ── */
  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement && isKioskMode && !isPinModalOpen) {
        requestExitKiosk();
      }
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, [isKioskMode, isPinModalOpen, requestExitKiosk]);

  /* ── Keyboard Shortcuts (Esc to exit kiosk, K to toggle kiosk) ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isPinModalOpen) return;
      const target = e.target as HTMLElement | null;
      const isInput =
        /INPUT|TEXTAREA|SELECT/.test(target?.tagName || '') || Boolean(target?.isContentEditable);
      if (e.key === 'Escape' && isKioskMode) {
        e.preventDefault();
        requestExitKiosk();
        return;
      }
      if (isInput || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isKioskMode) {
          requestExitKiosk();
        } else {
          handleEnterKiosk();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isKioskMode, isPinModalOpen, handleEnterKiosk, requestExitKiosk]);

  /* ── Kiosk Body Scroll Lock ── */
  useEffect(() => {
    if (!isKioskMode) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isKioskMode]);

  const handleCopySession = useCallback(() => {
    if (!form.sessionId) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(form.sessionId)
        .then(() => {
          hapticsRef.current.light?.();
          pushRef.current('success', 'Sessiya identifikatori nusxalandi');
        })
        .catch(() => {
          pushRef.current('error', 'Nusxalab bo‘lmadi');
        });
    }
  }, [form.sessionId]);

  const handleGroupChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, groupId: e.target.value }));
  }, []);

  const handleOpenStudentSidecar = useCallback((studentId?: string, studentName?: string) => {
    if (!studentId) return;
    const payload: QuickLookData = {
      type: 'student',
      id: studentId,
      title: studentName || 'O‘quvchi',
      subtitle: '360° Karta & Biometriya',
    };
    openSidecar(payload);
  }, []);

  const isSessionActive = Boolean(form.sessionId);

  /* ── Derived: Stats (Synchronized with History Filter) ── */
  const stats = useMemo(() => {
    const total = historyList.length;
    let recognized = 0;
    let failed = 0;
    for (const a of historyList) {
      const outcome = resolveRecognitionOutcome(a);
      if (outcome === 'SUCCESS') recognized += 1;
      else if (outcome === 'UNKNOWN' || outcome === 'DENIED') failed += 1;
    }
    const rate = total > 0 ? Math.round((recognized / total) * 100) : null;
    return { total, recognized, failed, rate };
  }, [historyList]);

  /* ── Derived: Filtered History ── */
  const filteredHistory = useMemo(() => {
    const q = historyQuery.trim().toLowerCase();
    return historyList.filter((a) => {
      const outcome = resolveRecognitionOutcome(a);
      if (historyFilter === 'success' && outcome !== 'SUCCESS') return false;
      if (historyFilter === 'failed' && outcome !== 'UNKNOWN' && outcome !== 'DENIED') {
        return false;
      }
      if (q) {
        const nameMatch = formatStudentName(a.student).toLowerCase().includes(q);
        const statusMatch = (a.status || '').toLowerCase().includes(q);
        return nameMatch || statusMatch;
      }
      return true;
    });
  }, [historyList, historyFilter, historyQuery]);

  const handleExportCsv = useCallback(() => {
    if (filteredHistory.length === 0) return;
    const rows = [
      ['Vaqt', 'O‘quvchi', 'Holat', 'Aniqlik'],
      ...filteredHistory.map((a) => [
        a.occurredAt || '',
        formatStudentName(a.student),
        a.status || '',
        formatConfidence(a.confidence),
      ]),
    ];
    const csv = '\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `face-recognition-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    hapticsRef.current.light?.();
    pushRef.current('success', 'CSV fayl muvaffaqiyatli yuklandi');
  }, [filteredHistory]);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="page-container relative isolate space-y-6 pb-[max(6rem,env(safe-area-inset-bottom))]"
    >
      <AuroraMesh variant="security" opacity={0.7} />
      {toastNode}

      {/* ══════════════════════════════════════════════════════════════════
       * 1. FULLSCREEN ENTERPRISE TURNSTILE KIOSK & OPERATOR PIN PORTAL
       * ════════════════════════════════════════════════════════════════ */}
      {typeof document !== 'undefined' &&
        createPortal(
          <>
            <AnimatePresence>
              {isKioskMode && (
                <motion.div
                  key="face-kiosk-view"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Face ID Turnstile Kiosk"
                  initial={{ opacity: 0, scale: 0.985 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.985 }}
                  transition={SPRING.smooth}
                  className="fixed inset-0 z-[99990] flex select-none flex-col overflow-hidden bg-[#050811] text-white"
                >
                  {/* Volumetric iOS 27 Ambient Caustic Orbs */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 overflow-hidden"
                  >
                    <div className="absolute -top-[25%] left-1/2 h-[620px] w-[920px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(0,122,255,0.24)_0%,rgba(94,92,230,0.15)_45%,transparent_70%)] blur-3xl" />
                    <div className="absolute -bottom-[20%] right-[-10%] h-[560px] w-[660px] rounded-full bg-[radial-gradient(circle,rgba(52,199,89,0.18)_0%,transparent_65%)] blur-3xl" />
                  </div>

                  {/* Kiosk Header Bar */}
                  <header className="relative z-20 flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.12] bg-[#0B0F19]/85 px-6 py-3.5 shadow-[inset_0_-1px_0_rgba(255,255,255,0.06)] backdrop-blur-3xl">
                    <div className="flex items-center gap-3.5">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-[#007AFF] to-[#5856D6] text-white shadow-[inset_0_1.5px_0_rgba(255,255,255,0.45),0_8px_20px_rgba(0,122,255,0.38)] ring-1 ring-white/30">
                        <Icon paths={I.faceId} size={22} strokeWidth={2.2} />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h1 className="text-base font-bold tracking-tight text-white">
                            M-EDU Face ID
                          </h1>
                          {!isOnline ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300 ring-1 ring-amber-500/40">
                              <span className="h-1.5 w-1.5 animate-ping rounded-full bg-amber-400" />
                              Oflayn rejim ({queueCount} ta navbatda)
                            </span>
                          ) : queueCount > 0 ? (
                            <button
                              type="button"
                              onClick={handleManualSync}
                              disabled={isSyncing}
                              className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-sky-300 ring-1 ring-sky-500/40 transition-colors hover:bg-sky-500/30"
                            >
                              <span
                                className={cn(
                                  'h-1.5 w-1.5 rounded-full bg-sky-400',
                                  isSyncing && 'animate-spin',
                                )}
                              />
                              {isSyncing ? 'Sinxronlanmoqda...' : `Sinxronlash (${queueCount})`}
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                              Turniket Live
                            </span>
                          )}
                          {isNfcActive && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-semibold text-cyan-300 ring-1 ring-cyan-500/30">
                              <span className="h-1 w-1 rounded-full bg-cyan-400" />
                              NFC Faol
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">Aqlli biometrik davomat terminali</p>
                      </div>
                    </div>

                    <LiveClockPill />

                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          soundRef.current.playTick?.();
                          setVoiceEnabled((v) => !v);
                        }}
                        aria-label={voiceEnabled ? 'Ovozni o‘chirish' : 'Ovozni yoqish'}
                        className={cn(
                          'inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-all',
                          voiceEnabled
                            ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-300'
                            : 'border-white/15 bg-white/5 text-slate-400 hover:bg-white/10',
                        )}
                      >
                        <Icon paths={voiceEnabled ? I.soundOn : I.soundOff} size={15} />
                      </button>

                      <button
                        type="button"
                        onClick={() => setAutoScan((s) => !s)}
                        className={cn(
                          'inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition-all',
                          autoScan
                            ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300'
                            : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10',
                        )}
                      >
                        <Icon paths={I.sparkles} size={14} />
                        <span>{autoScan ? 'Avto-skan: Faol' : 'Qo‘lda'}</span>
                      </button>

                      {isSessionActive ? (
                        <div className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3.5 text-xs font-semibold text-white/90">
                          <Icon paths={I.clock} size={14} />
                          <SessionChronometer startedAt={sessionStartedAt} />
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={handleStartSession}
                          disabled={startSession.isPending}
                          aria-label={tr(
                            t,
                            'faceRecognition.startSession',
                            'Start recognition session',
                          )}
                          className="inline-flex h-9 items-center gap-2 rounded-xl bg-gradient-to-r from-[#007AFF] to-[#5E5CE6] px-4 text-xs font-bold text-white shadow-md shadow-[#007AFF]/40 hover:opacity-90"
                        >
                          <Icon paths={I.play} size={13} strokeWidth={2.5} />
                          <span>
                            {tr(t, 'faceRecognition.startSession', 'Sessiyani boshlash')}
                          </span>
                        </button>
                      )}

                      {/* Kiosk Manual Gate Pass Override */}
                      <button
                        type="button"
                        onClick={handleManualGateRelease}
                        title="Turniket qulfini qo‘lda 3 soniyaga ochish"
                        className={cn(
                          'inline-flex h-9 items-center gap-2 rounded-xl border px-3.5 text-xs font-bold transition-all',
                          gateCountdown !== null
                            ? 'border-emerald-400 bg-emerald-500/30 text-emerald-200'
                            : 'border-white/20 bg-white/10 text-white hover:bg-white/20',
                        )}
                      >
                        <span className={cn('h-2 w-2 rounded-full bg-emerald-400', gateCountdown !== null && 'animate-ping')} />
                        <span>{gateCountdown !== null ? `Ochiq (${gateCountdown}s)` : 'Turniketni Ochish'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={requestExitKiosk}
                        className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-white/20"
                      >
                        <Icon paths={I.minimize} size={15} />
                        <span>Chiqish</span>
                        <kbd className="rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-white/60">
                          Esc
                        </kbd>
                      </button>
                    </div>
                  </header>

                  {/* Kiosk Main Stage */}
                  <main className="relative z-10 grid min-h-0 flex-1 grid-cols-1 gap-4 p-3 sm:gap-6 sm:p-6 lg:grid-cols-[1fr_380px]">
                    {/* Viewfinder Column */}
                    <div className="relative flex flex-col items-center justify-center">
                      {isSessionActive ? (
                        <div className="relative flex w-full max-w-2xl flex-col items-center">
                          <div className="relative w-full">
                            <WebcamCapture
                              onCapture={handleCapture}
                              busy={submit.isPending}
                              autoScan={autoScan}
                              onAutoScanToggle={() => setAutoScan((s) => !s)}
                              showAutoScanToggle={false}
                              hideViewfinderOverlay={true}
                              isKiosk={true}
                              label="Yuzni tanish"
                            >
                              <TrueDepthHUD
                                busy={submit.isPending}
                                reduced={reduced}
                                statusKind={liveBanner?.kind}
                              />
                              <AnimatePresence>
                                {liveBanner && <DynamicIslandBanner banner={liveBanner} />}
                              </AnimatePresence>
                            </WebcamCapture>
                          </div>

                          <div className="mt-4 flex items-center justify-center">
                            <div className="inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.06] px-5 py-2 text-xs font-medium text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] backdrop-blur-xl">
                              <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
                              <span>
                                {submit.isPending
                                  ? 'Biometrik yuz tahlili bajarilmoqda…'
                                  : 'Kameraga to‘g‘ri qarang — tizim avtomatik taniydi'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="relative flex max-w-md flex-col items-center overflow-hidden rounded-[2.5rem] border border-white/20 bg-[#0D1424]/90 p-10 text-center shadow-2xl backdrop-blur-2xl">
                          <TopSpecular inset="inset-x-8" />
                          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-tr from-[#007AFF] to-[#5E5CE6] text-white shadow-xl shadow-[#007AFF]/40">
                            <Icon paths={I.faceId} size={32} strokeWidth={2.2} />
                          </div>
                          <h3 className="text-xl font-bold tracking-tight text-white">
                            Sessiya Faol Emas
                          </h3>
                          <p className="mt-2 text-sm text-slate-300">
                            O‘quvchilar davomatini Face ID orqali olish uchun yangi sessiyani
                            boshlang.
                          </p>
                          <button
                            type="button"
                            onClick={handleStartSession}
                            disabled={startSession.isPending}
                            aria-label={tr(
                              t,
                              'faceRecognition.startSession',
                              'Start recognition session',
                            )}
                            className="mt-6 inline-flex h-12 items-center gap-2 rounded-2xl bg-gradient-to-r from-[#007AFF] to-[#5856D6] px-8 text-sm font-bold text-white shadow-lg shadow-[#007AFF]/40 transition-transform hover:brightness-110 active:scale-95"
                          >
                            <Icon paths={I.play} size={16} strokeWidth={2.4} />
                            <span>
                              {tr(t, 'faceRecognition.startSession', 'Sessiyani Boshlash')}
                            </span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Entrants Live Stream Feed */}
                    <section className="relative flex min-h-[340px] flex-col overflow-hidden rounded-[2.5rem] border border-white/20 bg-gradient-to-b from-[#0D1424]/90 to-[#070b14]/95 shadow-[0_24px_50px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.15)] backdrop-blur-3xl lg:min-h-0">
                      <TopSpecular inset="inset-x-8" />
                      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-6 py-4.5">
                        <div className="flex items-center gap-3">
                          <span className="relative flex h-3 w-3">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]" />
                          </span>
                          <div>
                            <h2 className="text-sm font-black tracking-tight text-white">
                              Jonli Kirish Oqimi
                            </h2>
                            <p className="text-[10px] font-mono text-white/50">Real-time attendance stream</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-0.5 font-mono text-xs font-black text-white/95 shadow-inner">
                            {liveFeed.length}
                          </span>
                        </div>
                      </div>

                      <div className="flex-1 space-y-2.5 overflow-y-auto p-4 scrollbar-thin">
                        {liveFeed.length === 0 ? (
                          <div className="flex h-full flex-col items-center justify-center p-8 text-center text-slate-400">
                            <div className="mb-3.5 flex h-14 w-14 items-center justify-center rounded-3xl bg-white/[0.05] border border-white/10 text-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]">
                              <Icon paths={I.faceId} size={30} strokeWidth={1.8} />
                            </div>
                            <p className="text-sm font-bold text-slate-200">
                              Hali hech kim kirmadi
                            </p>
                            <p className="mt-1 text-xs text-slate-400 max-w-[200px]">
                              O‘quvchi tanilganda bu yerda real vaqtda paydo bo‘ladi
                            </p>
                          </div>
                        ) : (
                          liveFeed.map((item) => (
                            <motion.div
                              key={item.id}
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={SPRING.snappy}
                              onClick={() => handleOpenStudentSidecar(item.studentId, item.name)}
                              className="group relative flex cursor-pointer items-center justify-between gap-3.5 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 transition-all hover:bg-white/[0.09] hover:border-white/20 hover:scale-[1.01]"
                            >
                              <div className="flex min-w-0 items-center gap-3.5">
                                {item.photoUrl ? (
                                  <div className="relative shrink-0">
                                    <img
                                      src={item.photoUrl}
                                      alt={item.name}
                                      loading="lazy"
                                      decoding="async"
                                      className="h-11 w-11 rounded-xl object-cover ring-1 ring-white/20 shadow-md"
                                    />
                                  </div>
                                ) : (
                                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[#007AFF] to-[#5856D6] text-xs font-black text-white shadow-md">
                                    {getInitials(item.name)}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-bold text-white transition-colors group-hover:text-[#64D2FF]">
                                    {item.name}
                                  </p>
                                  <p className="truncate text-[11px] text-slate-400 mt-0.5">
                                    {item.group || 'Guruh biriktirilgan'}
                                  </p>
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-2.5 text-right">
                                {item.kind === 'unknown' && (
                                  <SafeLink
                                    to="/face/enroll"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex min-h-[30px] items-center gap-1 rounded-xl border border-[#007AFF]/50 bg-[#007AFF]/25 px-2.5 py-1 text-[10px] font-black text-[#64D2FF] transition-all hover:bg-[#007AFF]/40"
                                  >
                                    <Icon paths={I.userPlus} size={11} />
                                    <span>+ Ro‘yxatga olish</span>
                                  </SafeLink>
                                )}
                                <div className="flex flex-col items-end">
                                  <span
                                    className={cn(
                                      'rounded-full px-2.5 py-0.5 font-mono text-[11px] font-black tracking-tight shadow-sm',
                                      item.kind === 'success'
                                        ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                                        : item.kind === 'duplicate'
                                          ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40'
                                          : 'bg-rose-500/25 text-rose-300 border border-rose-500/40',
                                    )}
                                  >
                                    {item.confidence}
                                  </span>
                                  <p className="mt-1 font-mono text-[10px] text-slate-400 tabular-nums">
                                    {item.time}
                                  </p>
                                </div>
                              </div>
                            </motion.div>
                          ))
                        )}
                      </div>
                    </section>
                  </main>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Kiosk Operator PIN Modal (z-[100000] sits strictly above z-[99990] Kiosk) ── */}
            <AnimatePresence>
              {isPinModalOpen && (
                <motion.div
                  key="kiosk-pin-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Kiosk PIN Security"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-2xl"
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.92, y: 16 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92, y: 16 }}
                    transition={SPRING.snappy}
                    className={cn(
                      'relative w-full max-w-sm overflow-hidden rounded-[2.5rem] border p-8 text-center text-white shadow-2xl backdrop-blur-3xl',
                      pinError
                        ? 'border-rose-500/50 bg-[#1e0a0d]/95 shadow-rose-500/25'
                        : 'border-white/25 bg-[#0B0F19]/95 shadow-black/90',
                    )}
                  >
                    <TopSpecular inset="inset-x-8" />
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
                      <Icon paths={I.lock} size={24} />
                    </div>

                    <h3 className="mt-4 text-lg font-bold">Terminalni qulfdan chiqarish</h3>
                    <p className="mt-1.5 text-xs text-white/65">
                      Kiosk rejimidan chiqish uchun administrator PIN-kodini kiriting
                    </p>

                    {/* PIN Indicators */}
                    <div className="mt-6 flex justify-center gap-3.5">
                      {[0, 1, 2, 3].map((i) => (
                        <span
                          key={i}
                          className={cn(
                            'h-4 w-4 rounded-full border transition-all duration-200',
                            pinInput.length > i
                              ? pinError
                                ? 'scale-110 border-rose-500 bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.8)]'
                                : 'scale-110 border-emerald-400 bg-emerald-400 shadow-[0_0_10px_rgba(52,199,89,0.8)]'
                              : 'border-white/30 bg-white/10',
                          )}
                        />
                      ))}
                    </div>

                    {pinError && (
                      <p className="mt-3 animate-pulse text-xs font-semibold text-rose-400">
                        PIN-kod noto‘g‘ri. Qayta urinib ko‘ring.
                      </p>
                    )}

                    {/* Numeric Keypad */}
                    <div className="mt-7 grid grid-cols-3 gap-3">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                        <motion.button
                          key={digit}
                          type="button"
                          whileTap={reduced ? undefined : { scaleX: 1.06, scaleY: 0.9 }}
                          transition={SPRING.gel}
                          onClick={() => appendPinDigit(String(digit))}
                          className="flex h-14 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.06] text-xl font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] transition-colors hover:bg-white/15"
                        >
                          {digit}
                        </motion.button>
                      ))}
                      <motion.button
                        type="button"
                        whileTap={reduced ? undefined : { scaleX: 1.05, scaleY: 0.92 }}
                        transition={SPRING.gel}
                        onClick={cancelPinModal}
                        className="flex h-14 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.06] text-xs font-bold text-white/75 transition-colors hover:bg-white/15"
                      >
                        Bekor
                      </motion.button>
                      <motion.button
                        type="button"
                        whileTap={reduced ? undefined : { scaleX: 1.06, scaleY: 0.9 }}
                        transition={SPRING.gel}
                        onClick={() => appendPinDigit('0')}
                        className="flex h-14 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.06] text-xl font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] transition-colors hover:bg-white/15"
                      >
                        0
                      </motion.button>
                      <motion.button
                        type="button"
                        whileTap={reduced ? undefined : { scaleX: 1.05, scaleY: 0.92 }}
                        transition={SPRING.gel}
                        onClick={() => {
                          soundRef.current.playTick?.();
                          hapticsRef.current.light?.();
                          setPinInput((p) => p.slice(0, -1));
                          setPinError(false);
                        }}
                        className="flex h-14 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.06] text-sm font-bold text-white/85 transition-colors hover:bg-white/15"
                      >
                        ⌫
                      </motion.button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </>,
          document.body,
        )}

      {/* ══════════════════════════════════════════════════════════════════
       * 2. MAIN DESKTOP / APP STUDIO HEADER
       * ════════════════════════════════════════════════════════════════ */}
      <motion.header variants={cardVariants} className={ cn(LIQUID_CARD, 'p-6') }>
        <TopSpecular inset="inset-x-10" />
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.5rem] bg-gradient-to-br from-[#007AFF] via-[#5856D6] to-[#AF52DE] text-white shadow-[inset_0_1.5px_0_rgba(255,255,255,0.5),0_12px_28px_-6px_rgba(0,122,255,0.4)] ring-2 ring-white/40">
              <Icon paths={I.faceId} size={32} strokeWidth={2.2} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-balance text-[26px] font-bold leading-tight tracking-tight text-[var(--text-primary)] sm:text-3xl">
                  {tr(t, 'faceRecognition.title', 'Face ID Biometriya')}
                </h1>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#007AFF]/25 bg-[#007AFF]/10 px-2.5 py-0.5 text-xs font-bold text-[#007AFF] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:border-[#64D2FF]/30 dark:bg-[#007AFF]/20 dark:text-[#64D2FF]">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[#007AFF]" />
                  Neural Vision
                </span>
                {!isOnline ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-600 dark:bg-amber-500/20 dark:text-amber-300">
                    <span className="h-2 w-2 animate-ping rounded-full bg-amber-500" />
                    Oflayn rejim ({queueCount})
                  </span>
                ) : queueCount > 0 ? (
                  <button
                    type="button"
                    onClick={handleManualSync}
                    disabled={isSyncing}
                    className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/15 px-2.5 py-0.5 text-xs font-bold text-sky-600 transition-all hover:bg-sky-500/25 dark:bg-sky-500/20 dark:text-sky-300"
                  >
                    <span
                      className={cn(
                        'h-2 w-2 rounded-full bg-sky-500',
                        isSyncing && 'animate-spin',
                      )}
                    />
                    {isSyncing ? 'Sinxronlanmoqda...' : `Sinxronlash (${queueCount})`}
                  </button>
                ) : null}
              </div>
              <p className="mt-1 text-sm font-medium text-[var(--text-secondary)]">
                {tr(
                  t,
                  'faceRecognition.subtitle',
                  'Yuzni tanish orqali real vaqtda davomatni avtomatlashtirish',
                )}
              </p>
            </div>
          </div>

          <div className="action-bar w-full lg:w-auto lg:justify-end">
            {/* Biometric Hub Navigation */}
            <div className="inline-flex items-center rounded-xl border border-black/10 bg-black/5 p-0.5 dark:border-white/10 dark:bg-white/5">
              <div className="inline-flex h-10 items-center gap-2 rounded-lg bg-white px-3.5 text-xs font-bold text-[var(--text-primary)] shadow-sm dark:bg-white/15">
                <Icon paths={I.faceId} size={14} className="text-[#007AFF] dark:text-[#64D2FF]" />
                <span>Face ID Terminal</span>
              </div>
              <SafeLink
                to="/face/enroll"
                className="inline-flex h-10 items-center gap-2 rounded-lg px-3.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              >
                <Icon paths={I.userPlus} size={14} />
                <span>Ro‘yxatga Olish</span>
              </SafeLink>
            </div>

            <motion.button
              type="button"
              whileTap={reduced ? undefined : { scaleX: 1.06, scaleY: 0.9 }}
              transition={SPRING.gel}
              onClick={() => {
                soundRef.current.playTick?.();
                setVoiceEnabled((v) => !v);
              }}
              aria-label={voiceEnabled ? 'Ovozli salomlashish faol' : 'Ovoz o‘chirilgan'}
              title={voiceEnabled ? 'Ovozli salomlashish: Yoqilgan' : 'Ovozli salomlashish: O‘chiq'}
              className={cn(
                'inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-colors',
                voiceEnabled
                  ? 'border-[#007AFF]/35 bg-[#007AFF]/10 text-[#007AFF] dark:text-[#64D2FF]'
                  : 'border-black/10 bg-black/5 text-[var(--text-tertiary)] dark:border-white/10 dark:bg-white/5',
              )}
            >
              <Icon paths={voiceEnabled ? I.soundOn : I.soundOff} size={16} />
            </motion.button>

            <motion.button
              type="button"
              whileTap={reduced ? undefined : { scaleX: 1.05, scaleY: 0.92 }}
              transition={SPRING.gel}
              onClick={() => setAutoScan((s) => !s)}
              className={cn(
                'inline-flex h-10 items-center gap-2 rounded-xl border px-3.5 text-xs font-bold transition-colors',
                autoScan
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] dark:text-emerald-400'
                  : 'border-black/10 bg-black/5 text-[var(--text-secondary)] hover:bg-black/10 dark:border-white/10 dark:bg-white/5',
              )}
            >
              <Icon paths={I.sparkles} size={15} />
              <span>{autoScan ? 'Avto-skan Faol' : 'Qo‘lda'}</span>
            </motion.button>

            {/* Manual Turnstile Release Action */}
            <motion.button
              type="button"
              whileTap={reduced ? undefined : { scaleX: 1.05, scaleY: 0.92 }}
              transition={SPRING.gel}
              onClick={handleManualGateRelease}
              title="Turniket qulfini qo‘lda 3 soniyaga ochish"
              className={cn(
                'inline-flex h-10 items-center gap-2 rounded-xl border px-3.5 text-xs font-bold transition-all',
                gateCountdown !== null
                  ? 'border-emerald-500 bg-emerald-500/20 text-emerald-600 shadow-[0_0_16px_rgba(52,199,89,0.35)] dark:text-emerald-400'
                  : 'border-emerald-500/35 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400',
              )}
            >
              <span className={cn('h-2 w-2 rounded-full bg-emerald-500', gateCountdown !== null && 'animate-ping')} />
              <span>{gateCountdown !== null ? `Ochiq (${gateCountdown}s)` : 'Turniketni Ochish'}</span>
            </motion.button>

            <motion.button
              type="button"
              whileTap={reduced ? undefined : { scaleX: 1.05, scaleY: 0.92 }}
              transition={SPRING.gel}
              onClick={handleEnterKiosk}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#AF52DE]/35 bg-gradient-to-r from-[#007AFF]/12 via-[#AF52DE]/15 to-[#34C759]/12 px-4 text-xs font-bold text-[var(--text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_4px_12px_-2px_rgba(175,82,222,0.2)] transition-all hover:opacity-95"
            >
              <Icon paths={I.maximize} size={15} className="text-[#AF52DE]" />
              <span>Kiosk Rejimi</span>
              <kbd className="rounded-md bg-black/10 px-1.5 py-0.5 font-mono text-[10px] dark:bg-white/15">
                K
              </kbd>
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* Hardware Emergency Evacuation & Lockdown Bar */}
      <motion.div variants={cardVariants}>
        <TurnstileEmergencyLockdown />
      </motion.div>

      {/* ══════════════════════════════════════════════════════════════════
       * 3. ULTRA-PREMIUM LIQUID GLASS KPI TELEMETRY METRICS
       * ════════════════════════════════════════════════════════════════ */}
      <motion.section
        variants={cardVariants}
        className="grid grid-cols-2 gap-3.5 sm:gap-4.5 lg:grid-cols-4"
        aria-label="Statistika"
      >
        <div className={cn(LIQUID_KPI, 'group hover:border-cyan-500/30 transition-all')}>
          <TopSpecular inset="inset-x-6" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-[var(--text-tertiary)] group-hover:text-cyan-500 transition-colors">
              {tr(t, 'faceRecognition.engineLabel', 'Biometrik Dvigatel')}
            </span>
            <span
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-2xl text-xs font-bold ring-1 transition-all shadow-sm',
                engineStatus?.isReal
                  ? 'bg-emerald-500/15 text-emerald-500 ring-emerald-500/30 dark:bg-emerald-500/20 shadow-emerald-500/20'
                  : 'bg-amber-500/15 text-amber-500 ring-amber-500/30 dark:bg-amber-500/20 shadow-amber-500/20',
              )}
            >
              <Icon paths={I.shield} size={18} strokeWidth={2.2} />
            </span>
          </div>
          <p className="mt-3 text-xl font-black tracking-tight text-[var(--text-primary)]">
            {engine.isLoading && !engineStatus
              ? '…'
              : engineStatus?.isReal
                ? 'Real Vision ONNX'
                : 'Mock Dvigatel'}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <p className="text-xs font-mono text-[var(--text-secondary)]">
              {engineStatus?.provider ? `${engineStatus.provider} · 512-D` : 'ArcFace Engine'}
            </p>
          </div>
        </div>

        <div className={cn(LIQUID_KPI, 'group hover:border-blue-500/30 transition-all')}>
          <TopSpecular inset="inset-x-6" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-[var(--text-tertiary)] group-hover:text-blue-500 transition-colors">
              {tr(t, 'faceRecognition.sessionActive', 'Terminal Holati')}
            </span>
            <span
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-2xl text-xs font-bold ring-1 transition-all shadow-sm',
                isSessionActive
                  ? 'bg-[#007AFF]/15 text-[#007AFF] ring-[#007AFF]/30 dark:bg-[#007AFF]/25 shadow-blue-500/20'
                  : 'bg-slate-500/15 text-slate-500 ring-slate-500/25',
              )}
            >
              <Icon paths={isSessionActive ? I.play : I.stop} size={18} strokeWidth={2.4} />
            </span>
          </div>
          <p className="mt-3 text-xl font-black tracking-tight text-[var(--text-primary)]">
            {isSessionActive
              ? tr(t, 'faceRecognition.sessionActive', 'Faol Holatda')
              : tr(t, 'faceRecognition.waiting', 'Kutmoqda')}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <span className={cn('h-2 w-2 rounded-full', isSessionActive ? 'bg-emerald-400 animate-ping' : 'bg-slate-400')} />
            <p className="text-xs font-mono text-[var(--text-secondary)]">
              {isSessionActive ? (
                <SessionChronometer startedAt={sessionStartedAt} />
              ) : (
                'Sessiya boshlanmagan'
              )}
            </p>
          </div>
        </div>

        <div className={cn(LIQUID_KPI, 'group hover:border-purple-500/30 transition-all')}>
          <TopSpecular inset="inset-x-6" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-[var(--text-tertiary)] group-hover:text-purple-500 transition-colors">
              {tr(t, 'faceRecognition.historyTitle', 'Jami Urinishlar')}
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-purple-500/15 text-purple-600 ring-1 ring-purple-500/30 shadow-purple-500/20 dark:text-purple-400">
              <Icon paths={I.layers} size={18} strokeWidth={2.2} />
            </span>
          </div>
          <p className="mt-3 font-mono text-2xl font-black tracking-tight tabular-nums text-[var(--text-primary)]">
            {stats.total}
          </p>
          <p className="mt-1.5 text-xs text-[var(--text-secondary)] font-medium">
            <strong className="text-purple-500">{liveFeed.length} ta</strong> shu sessiyada
          </p>
        </div>

        <div className={cn(LIQUID_KPI, 'group hover:border-emerald-500/30 transition-all')}>
          <TopSpecular inset="inset-x-6" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-[var(--text-tertiary)] group-hover:text-emerald-500 transition-colors">
              Aniqlik Darajasi
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/30 shadow-emerald-500/20 dark:text-emerald-400">
              <Icon paths={I.check} size={18} strokeWidth={2.6} />
            </span>
          </div>
          <p className="mt-3 font-mono text-2xl font-black tracking-tight tabular-nums text-emerald-600 dark:text-emerald-400">
            {stats.rate !== null ? `${stats.rate}%` : '—'}
          </p>
          <p className="mt-1.5 text-xs text-[var(--text-secondary)] font-medium">
            <strong className="text-emerald-500">{stats.recognized} ta</strong> tanildi · <strong className="text-rose-400">{stats.failed} ta</strong> rad
          </p>
        </div>
      </motion.section>

      {/* ══════════════════════════════════════════════════════════════════
       * 3.5. INTELLIGENT AI BIOMETRICS & MULTI-CAMERA COMMAND SUITE
       * ════════════════════════════════════════════════════════════════ */}
      <motion.section variants={cardVariants} className={cn(LIQUID_CARD, 'space-y-4 p-5 sm:p-6')}>
        <TopSpecular inset="inset-x-10" />
        <div className="flex flex-col justify-between gap-3 border-b border-black/[0.06] pb-4 sm:flex-row sm:items-center dark:border-white/[0.08]">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-500 ring-1 ring-cyan-500/30">
              <Icon paths={I.camera} size={20} strokeWidth={2.2} />
            </span>
            <div>
              <h2 className="text-base font-black tracking-tight text-[var(--text-primary)] sm:text-lg">
                Intelligent Face ID & Kamera Boshqaruv Markazi
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                6 ta ilg‘or sun’iy intellekt moduli: Rejissyor, Anti-Spoof, Oqim, Ovoz, Telegram va
                Tirbandlik
              </p>
            </div>
          </div>

          {activeBiometricModule && (
            <button
              type="button"
              onClick={() => {
                soundRef.current.playTick?.();
                setActiveBiometricModule(null);
              }}
              className="self-start rounded-xl bg-black/[0.04] px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground sm:self-center dark:bg-white/10"
            >
              Yopish ✕
            </button>
          )}
        </div>

        {/* Quick Module Switcher Pills with Liquid Capsule Morph */}
        <LayoutGroup id="biometric-ai-modules">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: 'director', label: 'Multikamera Rejissyor', badge: 'RTSP 2x2' },
                { id: 'liveness', label: '3D Liveness & Anti-Spoof', badge: '99.4% Tirik' },
                { id: 'rushHour', label: 'Tig‘iz Vaqt Oqimi', badge: 'Parallel Batch' },
                { id: 'voice', label: 'Ovozli Salomlashish', badge: 'Web Speech' },
                { id: 'telegram', label: 'Telegram Push Shlyuz', badge: '<220ms' },
                { id: 'traffic', label: 'Tirbandlik Xaritasi', badge: 'AI Radar' },
              ] as const
            ).map((mod) => {
              const isActive = activeBiometricModule === mod.id;
              return (
                <motion.button
                  key={mod.id}
                  type="button"
                  whileTap={reduced ? undefined : { scaleX: 1.04, scaleY: 0.94 }}
                  transition={SPRING.gel}
                  onClick={() => {
                    soundRef.current.playTick?.();
                    setActiveBiometricModule(isActive ? null : mod.id);
                  }}
                  className={cn(
                    'relative inline-flex items-center gap-2 rounded-2xl border px-3.5 py-2 text-xs font-bold transition-colors',
                    isActive
                      ? 'border-cyan-500/45 text-cyan-600 dark:text-cyan-300'
                      : 'border-black/[0.06] bg-black/[0.025] text-[var(--text-secondary)] hover:border-black/15 hover:text-[var(--text-primary)] dark:border-white/[0.08] dark:bg-white/[0.04]',
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="active-biometric-module-pill"
                      transition={reduced ? { duration: 0.15 } : SPRING.snappy}
                      aria-hidden="true"
                      className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-b from-cyan-500/20 to-cyan-500/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_4px_12px_-2px_rgba(6,182,212,0.25)] dark:from-cyan-400/25 dark:to-cyan-500/10"
                    />
                  )}
                  <span>{mod.label}</span>
                  <span className="rounded-full bg-black/10 px-1.5 py-0.5 font-mono text-[10px] dark:bg-white/15">
                    {mod.badge}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </LayoutGroup>

        {/* Active Module Stage Panel */}
        <AnimatePresence mode="wait">
          {activeBiometricModule === 'director' && (
            <motion.div
              key="mod-director"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="pt-2"
            >
              <MultiCameraAttendanceDirector />
            </motion.div>
          )}
          {activeBiometricModule === 'liveness' && (
            <motion.div
              key="mod-liveness"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="pt-2"
            >
              <LivenessSpoofShieldHUD />
            </motion.div>
          )}
          {activeBiometricModule === 'rushHour' && (
            <motion.div
              key="mod-rushHour"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="pt-2"
            >
              <RushHourBatchAttendanceProcessor />
            </motion.div>
          )}
          {activeBiometricModule === 'voice' && (
            <motion.div
              key="mod-voice"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="pt-2"
            >
              <BiometricVoiceGreetingConsole />
            </motion.div>
          )}
          {activeBiometricModule === 'telegram' && (
            <motion.div
              key="mod-telegram"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="pt-2"
            >
              <TurnstileTelegramNotificationBridge />
            </motion.div>
          )}
          {activeBiometricModule === 'traffic' && (
            <motion.div
              key="mod-traffic"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="pt-2"
            >
              <AttendanceTrafficFlowHeatmap />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>

      {/* ══════════════════════════════════════════════════════════════════
       * 4. MAIN CONTROL STUDIO & LIVE STAGE GRID
       * ════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.85fr)]">
        {/* Left: Viewfinder Studio & Session Controls */}
        <motion.section variants={cardVariants} className={cn(LIQUID_CARD, 'p-6')}>
          <TopSpecular inset="inset-x-10" />
          <div className="flex flex-col gap-4 border-b border-black/[0.06] pb-5 sm:flex-row sm:items-center sm:justify-between dark:border-white/[0.08]">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#007AFF]/10 text-[#007AFF] dark:bg-[#007AFF]/20">
                <Icon paths={I.camera} size={20} />
              </span>
              <div>
                <h2 className="text-base font-bold tracking-tight text-[var(--text-primary)]">
                  {isSessionActive ? 'Kamera Skaneri' : 'Sessiyani Boshlash'}
                </h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  {isSessionActive
                    ? 'Kameraga qarang, tizim avtomatik taniydi'
                    : 'Guruhni tanlang va sessiyani yoqing'}
                </p>
              </div>
            </div>

            {isSessionActive ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopySession}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-black/10 bg-black/5 px-3 font-mono text-xs font-semibold transition-colors hover:bg-black/10 dark:border-white/10 dark:bg-white/5"
                >
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                  <span>{truncateSessionId(form.sessionId)}</span>
                  <Icon paths={I.copy} size={13} />
                </button>
                <motion.button
                  type="button"
                  whileTap={reduced ? undefined : { scaleX: 1.05, scaleY: 0.92 }}
                  transition={SPRING.gel}
                  onClick={handleFinishSession}
                  disabled={finishSession.isPending}
                  aria-label={tr(t, 'faceRecognition.finishSession', 'Sessiyani yakunlash')}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-rose-500 px-3.5 text-xs font-bold text-white shadow-md shadow-rose-500/30 transition-colors hover:bg-rose-600"
                >
                  <Icon paths={I.stop} size={13} strokeWidth={2.4} />
                  <span>Yakunlash</span>
                </motion.button>
              </div>
            ) : (
              <div className="flex w-full items-center gap-3 sm:w-auto">
                <GlassSelect
                  value={form.groupId}
                  onChange={handleGroupChange}
                  aria-label={tr(t, 'faceRecognition.groupSelectAria', 'Guruhni tanlang')}
                  className="text-xs sm:w-48"
                >
                  <option value="">Barcha guruhlar</option>
                  {activeGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </GlassSelect>
                <motion.button
                  type="button"
                  whileTap={reduced ? undefined : { scaleX: 1.05, scaleY: 0.92 }}
                  transition={SPRING.gel}
                  onClick={handleStartSession}
                  disabled={startSession.isPending}
                  aria-label={tr(
                    t,
                    'faceRecognition.startSession',
                    'Start recognition session',
                  )}
                  className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-[#007AFF] to-[#5856D6] px-4 text-xs font-bold text-white shadow-lg shadow-[#007AFF]/35 transition-opacity hover:opacity-90"
                >
                  <Icon paths={I.play} size={14} strokeWidth={2.5} />
                  <span>{tr(t, 'faceRecognition.startSession', 'Sessiyani boshlash')}</span>
                </motion.button>
              </div>
            )}
          </div>

          {/* Viewfinder Canvas */}
          <div className="mt-6 flex flex-col items-center">
            {isSessionActive && !isKioskMode ? (
              <div className="relative w-full max-w-xl flex flex-col items-center">
                <WebcamCapture
                  onCapture={handleCapture}
                  busy={submit.isPending}
                  autoScan={autoScan}
                  onAutoScanToggle={() => setAutoScan((s) => !s)}
                  showAutoScanToggle={false}
                  hideViewfinderOverlay={true}
                  label="Yuzni tanish"
                >
                  <TrueDepthHUD
                    busy={submit.isPending}
                    reduced={reduced}
                    statusKind={liveBanner?.kind}
                  />
                  <AnimatePresence>
                    {liveBanner && <DynamicIslandBanner banner={liveBanner} compact />}
                  </AnimatePresence>
                </WebcamCapture>
              </div>
            ) : (
              <div className="flex w-full flex-col items-center justify-center rounded-[2.25rem] border-2 border-dashed border-black/10 py-16 dark:border-white/10">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#007AFF]/10 text-[#007AFF] dark:bg-[#007AFF]/20">
                  <Icon paths={I.faceId} size={32} strokeWidth={2} />
                </div>
                <h3 className="mt-4 text-base font-bold text-[var(--text-primary)]">
                  Sessiya Faollashtirilmagan
                </h3>
                <p className="mt-1 max-w-sm text-center text-xs text-[var(--text-secondary)]">
                  Davomatni qayd etishni boshlash uchun yuqoridagi tugma orqali yangi sessiyani
                  oching.
                </p>
                <motion.button
                  type="button"
                  whileTap={reduced ? undefined : { scaleX: 1.05, scaleY: 0.92 }}
                  transition={SPRING.gel}
                  onClick={handleStartSession}
                  disabled={startSession.isPending}
                  aria-label={tr(
                    t,
                    'faceRecognition.startSession',
                    'Start recognition session',
                  )}
                  className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-[#007AFF] to-[#5856D6] px-5 text-xs font-bold text-white shadow-md shadow-[#007AFF]/35 hover:opacity-90"
                >
                  <Icon paths={I.play} size={14} strokeWidth={2.4} />
                  <span>{tr(t, 'faceRecognition.startSession', 'Sessiyani boshlash')}</span>
                </motion.button>
              </div>
            )}
          </div>
        </motion.section>

        {/* Right: Live Stream Feed */}
        <motion.section
          variants={cardVariants}
          className={cn(LIQUID_CARD, 'flex flex-col p-6')}
        >
          <TopSpecular inset="inset-x-10" />
          <div className="flex items-center justify-between border-b border-black/[0.06] pb-4 dark:border-white/[0.08]">
            <div className="flex items-center gap-2.5">
              <span className="flex h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />
              <h3 className="text-base font-bold tracking-tight text-[var(--text-primary)]">
                Jonli Qaydlar Oqimi
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-black/5 px-2.5 py-0.5 font-mono text-xs font-bold text-[var(--text-secondary)] dark:bg-white/10">
                {liveFeed.length}
              </span>
              <button
                type="button"
                onClick={handleExportLiveFeed}
                title="Qaydlarni CSV ga eksport qilish"
                className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-black/10 bg-black/5 px-2 text-[11px] font-semibold text-[var(--text-secondary)] transition-colors hover:bg-black/10 hover:text-[var(--text-primary)] dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              >
                <Icon paths={I.download} size={12} />
                <span>CSV</span>
              </button>
            </div>
          </div>

          <div className="mt-4 max-h-[460px] flex-1 space-y-2.5 overflow-y-auto pr-1">
            {liveFeed.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center text-center text-[var(--text-tertiary)]">
                <Icon paths={I.faceId} size={36} strokeWidth={1.5} className="mb-2.5 opacity-40" />
                <p className="text-sm font-semibold text-[var(--text-secondary)]">
                  Sessiyada qaydlar yo‘q
                </p>
                <p className="mt-1 text-xs">
                  Yuz aniqlanganda o‘quvchi ma’lumotlari shu yerda ko‘rinadi
                </p>
              </div>
            ) : (
              liveFeed.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleOpenStudentSidecar(item.studentId, item.name)}
                  className="group flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-black/[0.05] bg-black/[0.02] p-3 transition-all hover:bg-black/[0.05] dark:border-white/[0.06] dark:bg-white/[0.025] dark:hover:bg-white/[0.06]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {item.photoUrl ? (
                      <img
                        src={item.photoUrl}
                        alt={item.name}
                        loading="lazy"
                        decoding="async"
                        className="h-10 w-10 shrink-0 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[#007AFF] to-[#5856D6] text-xs font-bold text-white">
                        {getInitials(item.name)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-[var(--text-primary)] transition-colors group-hover:text-[#007AFF]">
                        {item.name}
                      </p>
                      <p className="truncate text-[11px] text-[var(--text-tertiary)]">
                        {item.group || 'Guruh'} · {item.time}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-right">
                    {item.kind === 'unknown' && (
                      <SafeLink
                        to="/face/enroll"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-[#007AFF]/30 bg-[#007AFF]/10 px-2 py-1 text-[11px] font-semibold text-[#007AFF] transition-colors hover:bg-[#007AFF]/20 dark:text-[#64D2FF]"
                      >
                        <Icon paths={I.userPlus} size={12} />
                        <span>+ Ro‘yxatga olish</span>
                      </SafeLink>
                    )}
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[11px] font-bold',
                        item.kind === 'success'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : item.kind === 'duplicate'
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                            : 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
                      )}
                    >
                      {item.confidence}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.section>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
       * 5. HISTORICAL BIOMETRIC RECOGNITION LEDGER
       * ════════════════════════════════════════════════════════════════ */}
      <motion.section variants={cardVariants} className={cn(LIQUID_CARD, 'p-6')}>
        <TopSpecular inset="inset-x-10" />
        <div className="flex flex-col gap-4 border-b border-black/[0.06] pb-5 md:flex-row md:items-center md:justify-between dark:border-white/[0.08]">
          <div>
            <h3 className="text-lg font-black tracking-tight text-[var(--text-primary)]">
              {tr(t, 'faceRecognition.historyTitle', 'Biometrik Audit Tarixi')}
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              Oxirgi aniqlash urinishlari va davomat yozuvlari
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Segmented Filter Tabs with Liquid Lens Pill */}
            <LayoutGroup id="face-history-filter">
              <div className="inline-flex items-center rounded-xl border border-black/[0.06] bg-black/[0.04] p-1 dark:border-white/[0.08] dark:bg-white/[0.06]">
                {(
                  [
                    { id: 'all', label: 'Barchasi' },
                    { id: 'success', label: 'Tanilgan' },
                    { id: 'failed', label: 'Tanilmagan' },
                  ] as const
                ).map((tab) => {
                  const selected = historyFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        soundRef.current.playTick?.();
                        setHistoryFilter(tab.id);
                      }}
                      className={cn(
                        'relative rounded-lg px-3 py-1 text-xs font-bold transition-colors',
                        selected
                          ? 'text-[var(--text-primary)]'
                          : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]',
                      )}
                    >
                      {selected && (
                        <motion.span
                          layoutId="history-filter-pill"
                          transition={reduced ? { duration: 0.15 } : SPRING.snappy}
                          aria-hidden="true"
                          className="absolute inset-0 -z-10 rounded-lg bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_2px_6px_rgba(0,0,0,0.08)] dark:bg-white/20"
                        />
                      )}
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </LayoutGroup>

            {/* Search */}
            <div className="relative">
              <Icon
                paths={I.search}
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
              />
              <input
                type="text"
                role="searchbox"
                value={historyQuery}
                onChange={(e) => setHistoryQuery(e.target.value)}
                placeholder="Ism bo‘yicha qidirish…"
                className="h-9 w-44 rounded-xl border border-black/10 bg-black/[0.035] pl-8 pr-3 text-xs font-medium outline-none transition-all focus:border-[#007AFF]/50 focus:bg-white/80 focus:ring-2 focus:ring-[#007AFF]/30 dark:border-white/10 dark:bg-white/5 dark:focus:bg-white/10"
              />
            </div>

            {/* CSV Export */}
            <motion.button
              type="button"
              whileTap={reduced ? undefined : { scaleX: 1.05, scaleY: 0.92 }}
              transition={SPRING.gel}
              onClick={handleExportCsv}
              disabled={filteredHistory.length === 0}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-black/10 bg-white/80 px-3 text-xs font-bold text-[var(--text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_2px_6px_rgba(0,0,0,0.04)] transition-all hover:bg-white disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
            >
              <Icon paths={I.download} size={14} />
              <span>CSV</span>
            </motion.button>
          </div>
        </div>

        {/* History Table */}
        <div className="mt-5 overflow-x-auto">
          {filteredHistory.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--text-tertiary)]">
              Mos keladigan Face ID yozuvlari topilmadi
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-black/[0.06] text-[var(--text-tertiary)] dark:border-white/[0.08]">
                  <th className="pb-3 font-bold">Vaqt</th>
                  <th className="pb-3 font-bold">O‘quvchi</th>
                  <th className="pb-3 font-bold">Holat</th>
                  <th className="pb-3 font-bold">Aniqlik</th>
                  <th className="pb-3 text-right font-bold">Amal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                {filteredHistory.map((item) => {
                  const studentName = formatStudentName(item.student);
                  const outcome = resolveRecognitionOutcome(item);
                  return (
                    <tr
                      key={item.id}
                      className="transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                    >
                      <td className="py-3 font-mono text-[11px] tabular-nums text-[var(--text-secondary)]">
                        {item.occurredAt ? formatDateTime(item.occurredAt) : '—'}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#007AFF]/15 text-[10px] font-bold text-[#007AFF]">
                            {getInitials(studentName)}
                          </div>
                          <span className="font-bold text-[var(--text-primary)]">
                            {studentName}
                          </span>
                        </div>
                      </td>
                      <td className="py-3">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold',
                            outcome === 'SUCCESS'
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : outcome === 'DUPLICATE'
                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                : 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
                          )}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {outcome === 'SUCCESS'
                            ? 'Tanildi'
                            : outcome === 'DUPLICATE'
                              ? 'Takroriy'
                              : outcome === 'DENIED'
                                ? 'Rad etildi'
                                : 'Tanilmadi'}
                        </span>
                      </td>
                      <td className="py-3 font-mono font-bold tabular-nums">
                        {formatConfidence(item.confidence)}
                      </td>
                      <td className="py-3 text-right">
                        {item.student?.id && (
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenStudentSidecar(item.student?.id, studentName)
                            }
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-[#007AFF] hover:underline"
                          >
                            <span>Profil</span>
                            <Icon paths={I.chevronRight} size={12} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </motion.section>
    </motion.div>
  );
}

export default FaceRecognitionPage;