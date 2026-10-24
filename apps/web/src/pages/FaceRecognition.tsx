/**
 * M-EDU FaceRecognitionPage — Liquid Glass "Scanner Stage" edition
 *
 * Design intent
 *  - One memorable moment: the Scanner Stage (reticle, scan line, confidence ring).
 *    Everything around it stays quiet: one glass family, three radii, sentence-case labels.
 *  - Comfort first: AA-contrast secondary text, 44px touch targets on mobile, reduced-motion
 *    and reduced-transparency friendly, no layout shift between idle / live / result states.
 *
 * Premium features added
 *  - Session timer + copy session ID
 *  - Confidence ring with animated sweep
 *  - Auto-dismiss banner with countdown bar
 *  - Success-rate KPI with live progress
 *  - History: segmented filter (shared-layout pill), name search, CSV export
 *  - Keyboard: K toggles kiosk, Esc exits (ignored while typing)
 *  - Kiosk locks body scroll, shows live clock without re-rendering the page
 *
 * Bugs fixed relative to the previous version
 *  - Status checks used legacy RECOGNIZED/UNKNOWN only, so success/failure UI and KPI counts
 *    never matched real API statuses (IDENTIFIED, MATCH_NOT_FOUND, …). Now one `statusKind()`.
 *  - Kiosk + page rendered two <WebcamCapture/> at once (two camera streams, double submits).
 *    Only one is mounted at any time now.
 *  - A 1 s clock interval re-rendered the whole page; it now lives in <KioskClock/>.
 *  - Ambient orbs were `fixed` without z-index and could paint over content.
 *  - `Math.random()` feed ids replaced with a monotonic sequence.
 *  - Toast spam in auto-scan mode: banners carry the outcome, toast only for neutral results.
 *
 * Preserved: exports (FaceRecognitionPage, formatConfidence, resolveRecognitionOutcome,
 * RecognitionOutcome), all API calls, mutations, cache invalidation, sounds, haptics, voice,
 * sidecar, i18n keys + English fallback.
 */

import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  memo,
  type ButtonHTMLAttributes,
  type ChangeEvent,
  type ReactNode,
  type SVGProps,
} from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { faceApi, groupsApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys.factory';
import { GlassErrorState, useToasts, GlassField, GlassSelect } from '@/components/ui';
import { AuroraMesh } from '@/components/ui/AuroraMesh';
import { WebcamCapture } from '@/components/WebcamCapture';
import { formatDateTime } from '@/lib/format';
import { friendlyFaceError } from '@/lib/faceErrors';
import { getErrorMessage } from '@/lib/errorMessages';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { translate } from '@/i18n';
import { cn, usePrefersReducedMotion } from '@/lib/design';
import type {
  Paginated,
  RecognitionAttempt,
  RecognitionSession,
  Group,
  FaceEngineStatus,
} from '@/lib/types';
import { useAttendanceSocket } from '@/hooks/useAttendanceSocket';
import { useHaptics } from '@/hooks/useHaptics';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useVoiceFeedback } from '@/hooks/useVoiceFeedback';
import { openSidecar, type QuickLookData } from '@/stores/ui.store';

/* ══════════════════════════════════════════════════════════════════════
 * MOTION
 * ════════════════════════════════════════════════════════════════════ */

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 32, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 32, mass: 0.9 },
} as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: SPRING.smooth },
};

/* ══════════════════════════════════════════════════════════════════════
 * i18n (English fallback preserved)
 * ════════════════════════════════════════════════════════════════════ */

const FACE_RECOGNITION_EN_FALLBACK: Record<string, string> = {
  'faceRecognition.startSession': 'Start recognition session',
  'faceRecognition.starting': 'Starting…',
  'faceRecognition.sessionActive': 'Session active',
  'faceRecognition.finishSession': 'Finish session',
  'faceRecognition.finishing': 'Finishing…',
};

function useT(): (key: string, vars?: Record<string, string | number>) => string {
  const { t } = useSafeI18n();
  return (key: string, vars?: Record<string, string | number>) => {
    const res = t(key, vars);
    if (res && res !== key) return res;
    const viaEn = translate('en', key, vars);
    if (viaEn !== key) return viaEn;
    const template = FACE_RECOGNITION_EN_FALLBACK[key];
    if (!template) return key;
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (match, name) =>
      name in vars ? String(vars[name]) : match,
    );
  };
}

/* ══════════════════════════════════════════════════════════════════════
 * ICONS (SF-Symbols proportions)
 * ════════════════════════════════════════════════════════════════════ */

const I: Record<string, string[]> = {
  maximize: ['M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3'],
  minimize: ['M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3'],
  volume: ['M11 5L6 9H2v6h4l5 4V5z', 'M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07'],
  volumeX: ['M11 5L6 9H2v6h4l5 4V5z', 'M23 9l-6 6', 'M17 9l6 6'],
  scan: [
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
    'M18.5 3.5v3',
    'M20 5h-3',
    'M5.5 18v2.5',
    'M6.75 19.25h-2.5',
  ],
  checkCircle: ['M22 11.08V12a10 10 0 1 1-5.93-9.14', 'M22 4 12 14.01l-3-3'],
  xCircle: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M15 9l-6 6', 'M9 9l6 6'],
  alertCircle: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 8v4', 'M12 16h.01'],
  clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'],
  play: ['M6 4l14 8-14 8z'],
  stop: ['M6 6h12v12H6z'],
  refresh: ['M23 4v6h-6', 'M1 20v-6h6', 'M3.51 9a9 9 0 0 1 14.85-3.36L23 10', 'M1 14l4.64 4.36A9 9 0 0 0 20.49 15'],
  warning: [
    'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
    'M12 9v4',
    'M12 17h.01',
  ],
  shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', 'M9 12l2 2 4-4'],
  fingerprint: ['M12 11a2 2 0 0 1 2 2v3', 'M8 13a4 4 0 0 1 8 0v5', 'M12 22a10 10 0 1 1 0-20 10 10 0 0 1 10 10'],
  activity: ['M22 12h-4l-3 9L9 3l-3 9H2'],
  users: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M22 21v-2a4 4 0 0 0-3-3.9',
    'M16 3.1a4 4 0 0 1 0 7.8',
  ],
  user: ['M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M20 21v-1a8 8 0 0 0-16 0v1'],
  empty: [
    'M20 7h-9',
    'M14 17H5',
    'M19 19v-2a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v2',
    'M10 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  ],
  layers: ['M12 2 2 7l10 5 10-5z', 'M2 17l10 5 10-5', 'M2 12l10 5 10-5'],
  chevronDown: ['M6 9l6 6 6-6'],
  copy: [
    'M8 8h11a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z',
    'M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h2',
  ],
  download: ['M12 3v12', 'M7 10l5 5 5-5', 'M5 21h14'],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.3-4.3'],
};

function Icon({
  paths,
  size = 18,
  className = '',
  strokeWidth = 1.8,
  ...rest
}: {
  paths: string[];
  size?: number;
  className?: string;
  strokeWidth?: number;
} & SVGProps<SVGSVGElement>) {
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
      focusable="false"
      {...rest}
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════════
 * TOKENS — one glass family
 * ════════════════════════════════════════════════════════════════════ */

const TXT = 'text-[#1D1D1F] dark:text-[#F5F5F7]';
const TXT_2 = 'text-[#6E6E73] dark:text-[#98989D]';

/** Primary surface */
const CARD = cn(
  'relative overflow-hidden rounded-[28px] border border-white/70 bg-white/70 backdrop-blur-2xl backdrop-saturate-150',
  'shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_1px_2px_rgba(16,24,40,0.04),0_18px_44px_-22px_rgba(16,24,40,0.2)]',
  'dark:border-white/[0.08] dark:bg-[#1c1c1e]/70',
  'dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_22px_52px_-22px_rgba(0,0,0,0.75)]',
);

/** Recessed inner well */
const WELL = cn(
  'rounded-[20px] border border-black/[0.05] bg-black/[0.025]',
  'dark:border-white/[0.07] dark:bg-white/[0.035]',
);

const HAIRLINE = 'border-black/[0.06] dark:border-white/[0.08]';

const FOCUS =
  'outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]/60 focus-visible:ring-offset-0';

type Tone = 'blue' | 'emerald' | 'amber' | 'red' | 'purple' | 'cyan' | 'gray';

const TONE: Record<Tone, { chip: string; tile: string; solid: string; dot: string; hex: string }> = {
  blue: {
    chip: 'bg-[#007AFF]/10 text-[#0A5FCC] ring-1 ring-inset ring-[#007AFF]/20 dark:bg-[#0A84FF]/15 dark:text-[#6CB6FF] dark:ring-[#0A84FF]/30',
    tile: 'bg-[#007AFF]/10 text-[#0A5FCC] dark:bg-[#0A84FF]/15 dark:text-[#6CB6FF]',
    solid: 'bg-gradient-to-b from-[#2F9BFF] to-[#007AFF] text-white shadow-[0_8px_20px_-8px_rgba(0,122,255,0.6),inset_0_1px_0_rgba(255,255,255,0.4)]',
    dot: 'bg-[#007AFF]',
    hex: '#007AFF',
  },
  emerald: {
    chip: 'bg-[#34C759]/12 text-[#1E7B34] ring-1 ring-inset ring-[#34C759]/25 dark:bg-[#30D158]/15 dark:text-[#4CD964] dark:ring-[#30D158]/30',
    tile: 'bg-[#34C759]/12 text-[#1E7B34] dark:bg-[#30D158]/15 dark:text-[#4CD964]',
    solid: 'bg-gradient-to-b from-[#48D56C] to-[#28A745] text-white shadow-[0_8px_20px_-8px_rgba(52,199,89,0.6),inset_0_1px_0_rgba(255,255,255,0.4)]',
    dot: 'bg-[#34C759]',
    hex: '#34C759',
  },
  amber: {
    chip: 'bg-[#FF9500]/12 text-[#965800] ring-1 ring-inset ring-[#FF9500]/25 dark:bg-[#FF9F0A]/15 dark:text-[#FFB340] dark:ring-[#FF9F0A]/30',
    tile: 'bg-[#FF9500]/12 text-[#965800] dark:bg-[#FF9F0A]/15 dark:text-[#FFB340]',
    solid: 'bg-gradient-to-b from-[#FFAA33] to-[#F08300] text-white shadow-[0_8px_20px_-8px_rgba(255,149,0,0.6),inset_0_1px_0_rgba(255,255,255,0.4)]',
    dot: 'bg-[#FF9500]',
    hex: '#FF9500',
  },
  red: {
    chip: 'bg-[#FF3B30]/10 text-[#C4281E] ring-1 ring-inset ring-[#FF3B30]/25 dark:bg-[#FF453A]/15 dark:text-[#FF6961] dark:ring-[#FF453A]/30',
    tile: 'bg-[#FF3B30]/10 text-[#C4281E] dark:bg-[#FF453A]/15 dark:text-[#FF6961]',
    solid: 'bg-gradient-to-b from-[#FF5A50] to-[#E8281D] text-white shadow-[0_8px_20px_-8px_rgba(255,59,48,0.6),inset_0_1px_0_rgba(255,255,255,0.4)]',
    dot: 'bg-[#FF3B30]',
    hex: '#FF3B30',
  },
  purple: {
    chip: 'bg-[#AF52DE]/10 text-[#8944AB] ring-1 ring-inset ring-[#AF52DE]/25 dark:bg-[#BF5AF2]/15 dark:text-[#D08CF0] dark:ring-[#BF5AF2]/30',
    tile: 'bg-[#AF52DE]/10 text-[#8944AB] dark:bg-[#BF5AF2]/15 dark:text-[#D08CF0]',
    solid: 'bg-gradient-to-b from-[#C070EA] to-[#9A3FCB] text-white shadow-[0_8px_20px_-8px_rgba(175,82,222,0.6),inset_0_1px_0_rgba(255,255,255,0.4)]',
    dot: 'bg-[#AF52DE]',
    hex: '#AF52DE',
  },
  cyan: {
    chip: 'bg-[#32ADE6]/12 text-[#0B6F99] ring-1 ring-inset ring-[#32ADE6]/25 dark:bg-[#64D2FF]/15 dark:text-[#64D2FF] dark:ring-[#64D2FF]/30',
    tile: 'bg-[#32ADE6]/12 text-[#0B6F99] dark:bg-[#64D2FF]/15 dark:text-[#64D2FF]',
    solid: 'bg-gradient-to-b from-[#5AC8FA] to-[#1E9ED8] text-white shadow-[0_8px_20px_-8px_rgba(50,173,230,0.6),inset_0_1px_0_rgba(255,255,255,0.4)]',
    dot: 'bg-[#32ADE6]',
    hex: '#32ADE6',
  },
  gray: {
    chip: 'bg-black/[0.05] text-[#5C5C61] ring-1 ring-inset ring-black/[0.07] dark:bg-white/10 dark:text-[#AEAEB2] dark:ring-white/10',
    tile: 'bg-black/[0.05] text-[#5C5C61] dark:bg-white/10 dark:text-[#AEAEB2]',
    solid: 'bg-gradient-to-b from-[#9A9AA0] to-[#6E6E73] text-white shadow-[0_8px_20px_-8px_rgba(110,110,115,0.5),inset_0_1px_0_rgba(255,255,255,0.35)]',
    dot: 'bg-[#8E8E93]',
    hex: '#8E8E93',
  },
};

/* Buttons */
const BTN =
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-semibold tracking-tight transition-[transform,background,box-shadow,filter] duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50';
const BTN_SIZE = { sm: 'h-9 px-3 text-[12.5px]', md: 'h-10 px-4 text-[13px]' } as const;
const BTN_VARIANT = {
  primary:
    'bg-gradient-to-b from-[#2F9BFF] to-[#007AFF] text-white shadow-[0_8px_20px_-8px_rgba(0,122,255,0.65),inset_0_1px_0_rgba(255,255,255,0.4)] hover:brightness-105',
  danger:
    'bg-[#FF3B30]/10 text-[#C4281E] ring-1 ring-inset ring-[#FF3B30]/25 hover:bg-[#FF3B30]/15 dark:bg-[#FF453A]/15 dark:text-[#FF6961]',
  glass: cn(
    'bg-white/60 ring-1 ring-inset ring-black/[0.07] hover:bg-white/90',
    'dark:bg-white/[0.07] dark:ring-white/10 dark:hover:bg-white/[0.12]',
    TXT,
  ),
} as const;

function Btn({
  variant = 'glass',
  size = 'md',
  className,
  ...props
}: {
  variant?: keyof typeof BTN_VARIANT;
  size?: keyof typeof BTN_SIZE;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={cn(BTN, BTN_SIZE[size], BTN_VARIANT[variant], FOCUS, className)}
    />
  );
}

/* ══════════════════════════════════════════════════════════════════════
 * HELPERS (public ones preserved verbatim)
 * ════════════════════════════════════════════════════════════════════ */

interface RecognitionFormState {
  sessionId: string;
  groupId: string;
}

interface RecognitionResult {
  student?: {
    id?: string;
    firstName?: string;
    lastName?: string;
    user?: { firstName?: string; lastName?: string };
  };
  group?: { id?: string; name?: string };
  status: string;
  confidence?: number | string;
  livenessResult?: string;
  attendanceDecision?: string;
  accessDenied?: boolean;
  accessReason?: string;
}

const INITIAL_FORM: RecognitionFormState = { sessionId: '', groupId: '' };

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

export function formatConfidence(confidence: string | number | null | undefined): string {
  if (!confidence && confidence !== 0) return '—';
  if (typeof confidence === 'string') {
    if (['HIGH', 'MEDIUM', 'LOW', 'NONE'].includes(confidence)) return confidence;
    const numeric = parseFloat(confidence);
    if (!Number.isNaN(numeric)) return `${(numeric * 100).toFixed(0)}%`;
    return confidence;
  }
  return `${(confidence * 100).toFixed(0)}%`;
}

/** 0..1 for numeric confidences, null for level strings (HIGH/LOW/…) */
function confidenceValue(confidence: string | number | null | undefined): number | null {
  if (confidence === null || confidence === undefined || confidence === '') return null;
  const n = typeof confidence === 'number' ? confidence : parseFloat(confidence);
  if (Number.isNaN(n)) return null;
  return Math.max(0, Math.min(1, n > 1 ? n / 100 : n));
}

function formatLivenessResult(result: string | null | undefined): string {
  if (!result) return '—';
  return result
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function humanizeStatus(status: string | null | undefined): string {
  return formatLivenessResult(status);
}

function truncateSessionId(id: string, maxLength = 10): string {
  return id.length > maxLength ? `${id.slice(0, maxLength)}…` : id;
}

function formatRecognitionResult(result: unknown): RecognitionResult | null {
  if (!result || typeof result !== 'object') return null;
  return result as RecognitionResult;
}

const NON_IDENTIFIED_STATUSES = new Set<string>([
  'UNIDENTIFIED',
  'MATCH_NOT_FOUND',
  'MATCH_UNCERTAIN',
  'QUALITY_FAILED',
  'LIVENESS_FAILED',
  'LIVENESS_UNCERTAIN',
  'LIVENESS_UNAVAILABLE',
  'ERROR',
  'UNKNOWN',
  'SPOOF_DETECTED',
  'BLOCKED',
]);

export type RecognitionOutcome = 'DENIED' | 'DUPLICATE' | 'SUCCESS' | 'UNKNOWN' | 'NEUTRAL';

/**
 * Classify a recognition response for UI feedback. Precedence is intentional: an entry gate
 * (accessDenied) and duplicate prevention must win over a bare IDENTIFIED status.
 */
export function resolveRecognitionOutcome(
  parsed: RecognitionResult | null | undefined,
): RecognitionOutcome {
  if (!parsed) return 'NEUTRAL';
  if (parsed.accessDenied) return 'DENIED';
  if (parsed.attendanceDecision === 'DUPLICATE_PREVENTED') return 'DUPLICATE';
  if (parsed.status === 'IDENTIFIED') return 'SUCCESS';
  if (NON_IDENTIFIED_STATUSES.has(parsed.status)) return 'UNKNOWN';
  return 'NEUTRAL';
}

/* ── Unified presentation kind (fixes legacy-status mismatch) ── */

type Kind = 'success' | 'duplicate' | 'denied' | 'unknown' | 'neutral';

const SUCCESS_STATUSES = new Set(['IDENTIFIED', 'RECOGNIZED', 'ATTENDANCE_RECORDED']);

function statusKind(status: string | null | undefined): Kind {
  if (!status) return 'neutral';
  if (SUCCESS_STATUSES.has(status)) return 'success';
  if (status === 'DUPLICATE' || status === 'DUPLICATE_PREVENTED') return 'duplicate';
  if (status === 'DENIED') return 'denied';
  if (NON_IDENTIFIED_STATUSES.has(status)) return 'unknown';
  return 'neutral';
}

const OUTCOME_KIND: Record<RecognitionOutcome, Kind> = {
  SUCCESS: 'success',
  DUPLICATE: 'duplicate',
  DENIED: 'denied',
  UNKNOWN: 'unknown',
  NEUTRAL: 'neutral',
};

const KIND_META: Record<Kind, { tone: Tone; icon: string[] }> = {
  success: { tone: 'emerald', icon: I.checkCircle },
  duplicate: { tone: 'amber', icon: I.alertCircle },
  denied: { tone: 'red', icon: I.xCircle },
  unknown: { tone: 'red', icon: I.xCircle },
  neutral: { tone: 'gray', icon: I.activity },
};

function bannerCaption(kind: Kind): string {
  if (kind === 'success') return 'Davomat qayd etildi';
  if (kind === 'duplicate') return 'Ogohlantirish';
  return "Rad etildi / Noma'lum";
}

function accessReasonLabel(reason?: string): string {
  return reason === 'INSUFFICIENT_FUNDS' ? "To'lov qarzi" : 'Darsdan tashqari';
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

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

function csvCell(v: unknown): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/* ══════════════════════════════════════════════════════════════════════
 * LOCAL TYPES
 * ════════════════════════════════════════════════════════════════════ */

interface FeedItem {
  id: string;
  studentName: string;
  time: string;
  groupName?: string;
  kind: Kind;
  /** Short badge text: confidence %, "Qayta", denial reason… */
  label: string;
}

interface LiveBanner {
  id: number;
  kind: Kind;
  title: string;
  subtitle?: string;
  time: string;
  confidence?: string;
}

type HistoryFilter = 'all' | 'success' | 'failed';

const BANNER_MS = 4000;

/* ══════════════════════════════════════════════════════════════════════
 * SMALL BUILDING BLOCKS
 * ════════════════════════════════════════════════════════════════════ */

function Pulse({ className }: { className?: string }) {
  return (
    <span className="relative flex h-2 w-2" aria-hidden="true">
      <span
        className={cn(
          'absolute inline-flex h-full w-full rounded-full opacity-60 motion-safe:animate-ping',
          className,
        )}
      />
      <span className={cn('relative inline-flex h-2 w-2 rounded-full', className)} />
    </span>
  );
}

function Chip({
  tone = 'gray',
  icon,
  children,
  title,
  className,
}: {
  tone?: Tone;
  icon?: ReactNode;
  children: ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold leading-none',
        TONE[tone].chip,
        className,
      )}
    >
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}

function IconTile({
  icon,
  tone = 'blue',
  size = 40,
  solid = false,
  radius,
  className,
}: {
  icon: string[];
  tone?: Tone;
  size?: number;
  solid?: boolean;
  /** px corner radius; defaults to 14 */
  radius?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center',
        solid ? TONE[tone].solid : TONE[tone].tile,
        className,
      )}
      style={{ width: size, height: size, borderRadius: radius ?? 14 }}
    >
      <Icon paths={icon} size={Math.round(size * 0.46)} strokeWidth={2} />
    </span>
  );
}

const Avatar = memo(function Avatar({
  name,
  size = 40,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'relative flex shrink-0 items-center justify-center rounded-full font-semibold text-white',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_4px_12px_-4px_rgba(0,0,0,0.3)]',
        className,
      )}
      style={{ width: size, height: size, background: avatarGradient(name), fontSize: size * 0.34 }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/35 to-transparent"
      />
      <span className="relative">{getInitials(name)}</span>
    </span>
  );
});

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={cn('rounded-2xl bg-black/[0.05] motion-safe:animate-pulse dark:bg-white/[0.07]', className)}
    />
  );
}

function CountUp({ value, reduced }: { value: number; reduced: boolean }) {
  const [n, setN] = useState(reduced ? value : 0);
  const fromRef = useRef(0);

  useEffect(() => {
    if (reduced) {
      setN(value);
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const step = (ts: number) => {
      const p = Math.min(1, (ts - start) / 900);
      const eased = 1 - Math.pow(1 - p, 4);
      const next = from + (value - from) * eased;
      setN(next);
      if (p < 1) raf = requestAnimationFrame(step);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, reduced]);

  return <span className="tabular-nums">{Math.round(n).toLocaleString('uz-UZ')}</span>;
}

/** Soft ambient colour — sits *behind* the page (negative z, isolated stacking context) */
const AmbientOrbs = memo(function AmbientOrbs({ reduced }: { reduced: boolean }) {
  return (
    <>
      <AuroraMesh variant="security" />
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <motion.div
          className="absolute -left-[8%] top-[4%] h-[46%] w-[42%] rounded-full"
          style={{ background: 'radial-gradient(closest-side, rgba(0,122,255,0.14), transparent 70%)' }}
          animate={reduced ? undefined : { x: [0, 24, 0], y: [0, 18, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-[10%] -right-[8%] h-[48%] w-[44%] rounded-full"
          style={{ background: 'radial-gradient(closest-side, rgba(175,82,222,0.12), transparent 70%)' }}
          animate={reduced ? undefined : { x: [0, -28, 0], y: [0, -22, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
    </>
  );
});

/** Circular confidence gauge */
const ConfidenceRing = memo(function ConfidenceRing({
  value,
  label,
  size = 68,
  reduced,
}: {
  value: number | null;
  label: string;
  size?: number;
  reduced: boolean;
}) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const v = value ?? 0;
  const tone: Tone = v >= 0.85 ? 'emerald' : v >= 0.6 ? 'amber' : 'red';
  const hex = value === null ? TONE.gray.hex : TONE[tone].hex;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Ishonch: ${label}`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={5}
          className="stroke-black/[0.07] dark:stroke-white/[0.1]"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={hex}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: reduced ? c * (1 - v) : c }}
          animate={{ strokeDashoffset: c * (1 - v) }}
          transition={reduced ? { duration: 0 } : { duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: `drop-shadow(0 0 6px ${hex}66)` }}
        />
      </svg>
      <span
        className={cn(
          'absolute inset-0 flex items-center justify-center text-[14px] font-semibold tabular-nums',
          TXT,
        )}
      >
        {label}
      </span>
    </div>
  );
});

/** Corner brackets + scan line over the camera area */
interface FaceBoxItem {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  kind: Kind;
}

function getUnknownOutcomeGuidance(status: string | null | undefined): { title: string; subtitle: string; label: string } {
  if (status === 'FACE_NOT_DETECTED') {
    return { title: 'Yuz aniqlanmadi', subtitle: 'Kameraga to‘g‘ri qarang va yorug‘likni tekshiring', label: 'Yuz yo‘q' };
  }
  if (status === 'FACE_QUALITY_TOO_LOW' || status === 'QUALITY_FAILED') {
    return { title: 'Tasvir sifati past', subtitle: 'Kameraga yaqinroq keling va harakatlanmang', label: 'Sifat past' };
  }
  if (status === 'LIVENESS_FAILED' || status === 'SPOOF_DETECTED') {
    return { title: 'Jonlilik tekshiruvi o‘tmadi', subtitle: 'Foto yoki ekran tasviri emas, jonli yuz kerak', label: 'Soxta' };
  }
  if (status === 'LIVENESS_UNCERTAIN') {
    return { title: 'Jonlilik noaniq', subtitle: 'Kameraga to‘g‘ri qarab, bir oz kuting', label: 'Noaniq' };
  }
  if (status === 'MULTIPLE_FACES_DETECTED') {
    return { title: 'Bir nechta yuz aniqlandi', subtitle: 'Kadrda faqat bitta shaxs bo‘lishi lozim', label: 'Ko‘p shaxs' };
  }
  if (status === 'MATCH_NOT_FOUND' || status === 'UNIDENTIFIED') {
    return { title: 'Yuz tizimda topilmadi', subtitle: 'O‘quvchi ro‘yxatdan o‘tmagan yoki qayta kiritish kerak', label: 'Noma’lum' };
  }
  if (status === 'OUT_OF_SCHEDULE') {
    return { title: 'Dars jadvalidan tashqari', subtitle: 'Bu vaqtda guruh uchun dars belgilanmagan', label: 'Jadvaldan tashqari' };
  }
  if (status === 'INSUFFICIENT_FUNDS') {
    return { title: 'To‘lov qarzdorligi', subtitle: 'Davomat yozish uchun kassa bilan bog‘laning', label: 'Qarzdorlik' };
  }
  return { title: 'Yuz tanilmadi', subtitle: 'Qayta urinib ko‘ring', label: 'Noma’lum' };
}

/** Corner brackets + scan line + LiDAR face bounding boxes over the camera area */
const ScanReticle = memo(function ScanReticle({
  busy,
  reduced,
  boxes = [],
}: {
  busy: boolean;
  reduced: boolean;
  boxes?: FaceBoxItem[];
}) {
  const color = busy ? 'border-[#32ADE6]' : 'border-white/80';
  const corner = cn('absolute h-6 w-6 transition-colors duration-300', color);
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-3 z-10 overflow-hidden">
      <span className={cn(corner, 'left-0 top-0 rounded-tl-xl border-l-2 border-t-2')} />
      <span className={cn(corner, 'right-0 top-0 rounded-tr-xl border-r-2 border-t-2')} />
      <span className={cn(corner, 'bottom-0 left-0 rounded-bl-xl border-b-2 border-l-2')} />
      <span className={cn(corner, 'bottom-0 right-0 rounded-br-xl border-b-2 border-r-2')} />
      {busy && !reduced && (
        <motion.span
          className="absolute inset-x-3 h-px bg-gradient-to-r from-transparent via-[#32ADE6] to-transparent shadow-[0_0_14px_#32ADE6]"
          initial={{ top: '6%' }}
          animate={{ top: ['6%', '94%'] }}
          transition={{ duration: 1.4, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
        />
      )}
      <AnimatePresence>
        {boxes.map((b) => {
          const isSuccess = b.kind === 'success';
          return (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, scale: 0.88 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={SPRING.smooth}
              className="absolute pointer-events-none z-20"
              style={{
                left: `${Math.max(2, Math.min(84, (b.x / 640) * 100))}%`,
                top: `${Math.max(2, Math.min(84, (b.y / 640) * 100))}%`,
                width: `${Math.max(14, Math.min(65, (b.width / 640) * 100))}%`,
                height: `${Math.max(14, Math.min(65, (b.height / 640) * 100))}%`,
              }}
            >
              <div
                className={cn(
                  'relative h-full w-full rounded-2xl border-2 transition-all duration-300',
                  isSuccess
                    ? 'border-[#34C759] shadow-[0_0_20px_rgba(52,199,89,0.55),inset_0_0_10px_rgba(52,199,89,0.3)]'
                    : 'border-[#FF3B30] shadow-[0_0_20px_rgba(255,59,48,0.55),inset_0_0_10px_rgba(255,59,48,0.3)]',
                )}
              >
                <span
                  className={cn(
                    'absolute -top-7 left-1/2 -translate-x-1/2 truncate max-w-[180px] rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white shadow-lg backdrop-blur-md',
                    isSuccess ? 'bg-[#34C759]/90' : 'bg-[#FF3B30]/90',
                  )}
                >
                  {b.label}
                </span>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
});

/** Ticking timer isolated so only this node re-renders each second */
const SessionTimer = memo(function SessionTimer({ startedAt }: { startedAt: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  if (!startedAt) return null;
  return <span className="tabular-nums">{formatElapsed(now - startedAt)}</span>;
});

const KioskClock = memo(function KioskClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="hidden flex-col items-center sm:flex">
      <div className="font-mono text-2xl font-bold tracking-wider text-white tabular-nums">
        {now.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>
      <div className="text-[11px] font-medium text-white/60">
        {now.toLocaleDateString('uz-UZ', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
      </div>
    </div>
  );
});

/* ── Banner (toast + kiosk variants) ── */

const OutcomeBanner = memo(function OutcomeBanner({
  banner,
  variant,
}: {
  banner: LiveBanner;
  variant: 'toast' | 'kiosk';
}) {
  const meta = KIND_META[banner.kind];
  const tone = TONE[meta.tone];
  const kiosk = variant === 'kiosk';

  return (
    <div
      className={cn(
        'relative overflow-hidden border backdrop-blur-2xl',
        kiosk
          ? 'rounded-3xl border-white/15 bg-black/70 p-5 text-white shadow-2xl shadow-black/60'
          : cn(
              'rounded-[22px] border-white/70 bg-white/85 p-4 shadow-[0_24px_56px_-18px_rgba(16,24,40,0.35)]',
              'dark:border-white/10 dark:bg-[#1c1c1e]/90',
              TXT,
            ),
      )}
    >
      <div className="flex items-center gap-3.5">
        <span
          className={cn(
            'flex shrink-0 items-center justify-center',
            tone.solid,
            kiosk ? 'h-16 w-16 rounded-2xl' : 'h-12 w-12 rounded-[14px]',
          )}
        >
          <Icon paths={meta.icon} size={kiosk ? 32 : 24} strokeWidth={2.3} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className={cn('text-[12px] font-medium', kiosk ? 'text-white/70' : TXT_2)}>
              {bannerCaption(banner.kind)}
            </span>
            <span className={cn('font-mono text-[11.5px] tabular-nums', kiosk ? 'text-white/70' : TXT_2)}>
              {banner.time}
            </span>
          </div>
          <h4 className={cn('truncate font-semibold tracking-tight', kiosk ? 'mt-0.5 text-xl' : 'mt-0.5 text-[15.5px]')}>
            {banner.title}
          </h4>
          {(banner.subtitle || banner.confidence) && (
            <p className={cn('mt-0.5 truncate text-[12.5px] font-medium', kiosk ? 'text-white/80' : TXT_2)}>
              {banner.subtitle}
              {banner.confidence && ` • Ishonch: ${banner.confidence}`}
            </p>
          )}
        </div>
      </div>

      {/* Auto-dismiss countdown */}
      <motion.span
        key={banner.id}
        aria-hidden="true"
        className={cn('absolute inset-x-0 bottom-0 h-[3px] origin-left', tone.dot)}
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: BANNER_MS / 1000, ease: 'linear' }}
      />
    </div>
  );
});

/* ── Feed row ── */

const FeedRow = memo(function FeedRow({
  item,
  dark = false,
  onOpen,
}: {
  item: FeedItem;
  dark?: boolean;
  onOpen?: (item: FeedItem) => void;
}) {
  const tone = TONE[KIND_META[item.kind].tone];
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING.smooth}
      className={cn(
        'flex items-center gap-3 rounded-2xl p-2.5',
        dark ? 'bg-white/[0.04] hover:bg-white/[0.08]' : 'bg-black/[0.025] hover:bg-black/[0.045] dark:bg-white/[0.04] dark:hover:bg-white/[0.07]',
        'transition-colors',
      )}
    >
      <Avatar name={item.studentName} size={36} />
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-[13px] font-semibold', dark ? 'text-white' : TXT)}>{item.studentName}</p>
        <p className={cn('truncate text-[11.5px] tabular-nums', dark ? 'text-white/55' : TXT_2)}>
          {item.groupName ? `${item.groupName} • ` : ''}
          {item.time}
        </p>
      </div>
      <span className={cn('shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold leading-none', tone.chip)}>
        {item.label}
      </span>
      {onOpen && (
        <button
          type="button"
          onClick={() => onOpen(item)}
          aria-label="Split View"
          title="Split View Sidecar"
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold transition-colors',
            dark
              ? 'text-white/50 hover:bg-white/10 hover:text-white'
              : 'text-[#6E6E73] hover:bg-black/[0.06] hover:text-[#1D1D1F] dark:text-[#98989D] dark:hover:bg-white/10 dark:hover:text-white',
            FOCUS,
          )}
        >
          ◨
        </button>
      )}
    </motion.li>
  );
});

/** Toggle pill used in the header + kiosk bar */
function ToggleChip({
  pressed,
  onClick,
  icon,
  label,
  title,
  dark = false,
  kbd,
}: {
  pressed: boolean;
  onClick: () => void;
  icon: string[];
  label: string;
  title?: string;
  dark?: boolean;
  kbd?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      title={title ?? label}
      className={cn(
        'inline-flex h-10 items-center gap-2 rounded-xl px-3 text-[12.5px] font-semibold tracking-tight transition-all duration-200 active:scale-[0.97]',
        FOCUS,
        dark
          ? pressed
            ? 'border border-cyan-400/30 bg-cyan-400/15 text-cyan-200'
            : 'border border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
          : pressed
            ? TONE.blue.chip
            : cn('bg-black/[0.04] ring-1 ring-inset ring-black/[0.06] hover:bg-black/[0.07]', 'dark:bg-white/[0.06] dark:ring-white/10 dark:hover:bg-white/10', TXT_2),
      )}
    >
      <Icon paths={icon} size={15} strokeWidth={2.1} />
      <span className="hidden sm:inline">{label}</span>
      {kbd && (
        <kbd className="hidden rounded-md bg-black/[0.07] px-1.5 py-0.5 font-sans text-[10.5px] font-semibold text-inherit opacity-70 lg:inline dark:bg-white/10">
          {kbd}
        </kbd>
      )}
    </button>
  );
}

function StatCell({
  icon,
  tone,
  label,
  children,
  hint,
  className,
}: {
  icon: string[];
  tone: Tone;
  label: string;
  children: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      <IconTile icon={icon} tone={tone} size={40} />
      <div className="min-w-0">
        <div className={cn('truncate text-[12px] font-medium', TXT_2)}>{label}</div>
        <div className={cn('mt-0.5 text-[24px] font-semibold leading-none tracking-[-0.03em]', TXT)}>{children}</div>
        {hint && <div className={cn('mt-1 truncate text-[11.5px] font-medium', TXT_2)}>{hint}</div>}
      </div>
    </div>
  );
}

function ResultRow({
  icon,
  label,
  value,
}: {
  icon: string[];
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className={cn('inline-flex items-center gap-2.5 text-[12.5px] font-medium', TXT_2)}>
        <span className={cn('flex h-6 w-6 items-center justify-center rounded-lg', TONE.blue.tile)}>
          <Icon paths={icon} size={12} strokeWidth={2.2} />
        </span>
        {label}
      </span>
      <span className={cn('min-w-0 text-right text-[13px] font-semibold', TXT)}>{value}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
 * MAIN PAGE
 * ════════════════════════════════════════════════════════════════════ */

export function FaceRecognitionPage() {
  const t = useT();
  /** translate with a guaranteed readable fallback when a key is missing */
  const tx = useCallback(
    (key: string, fallback: string) => {
      const v = t(key);
      return !v || v === key ? fallback : v;
    },
    [t],
  );

  usePageTitle(t('faceRecognition.title'));

  const reduced = usePrefersReducedMotion();
  const { push, toastNode } = useToasts();
  const queryClient = useQueryClient();
  const { playTick, playError, playFaceIdMatch, playFaceIdDenied, playFaceIdDuplicate } =
    usePremiumSound();
  const haptics = useHaptics();
  const voice = useVoiceFeedback();
  useAttendanceSocket();

  const [form, setForm] = useState<RecognitionFormState>(INITIAL_FORM);
  const [result, setResult] = useState<unknown>(null);
  const [rawExpanded, setRawExpanded] = useState(false);
  const [isKioskMode, setIsKioskMode] = useState(false);
  /** true from kiosk open until its exit animation ends — keeps a single camera stream alive */
  const [kioskMounted, setKioskMounted] = useState(false);
  const [autoScan, setAutoScan] = useState(true);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const [liveBanner, setLiveBanner] = useState<LiveBanner | null>(null);
  const [liveFeed, setLiveFeed] = useState<FeedItem[]>([]);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [historyQuery, setHistoryQuery] = useState('');
  const [detectedFaceBoxes, setDetectedFaceBoxes] = useState<FaceBoxItem[]>([]);

  const lastCaptureTimeRef = useRef<number>(0);
  const cooldownMapRef = useRef<Map<string, number>>(new Map());
  const detectedFaceBoxesTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const feedSeq = useRef(0);
  const bannerSeq = useRef(0);

  /* ── Cleanup on unmount ── */
  useEffect(() => {
    return () => {
      if (detectedFaceBoxesTimeoutRef.current) {
        clearTimeout(detectedFaceBoxesTimeoutRef.current);
      }
    };
  }, []);

  /* ── Keyboard: Esc exits kiosk (always), K toggles kiosk (not while typing) ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isKioskMode) {
        setIsKioskMode(false);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isEditableTarget(e.target)) return;
      if (e.key === 'k' || e.key === 'K') setIsKioskMode((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isKioskMode]);

  useEffect(() => {
    if (isKioskMode) setKioskMounted(true);
  }, [isKioskMode]);

  /* ── Kiosk locks background scroll ── */
  useEffect(() => {
    if (!isKioskMode) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isKioskMode]);

  /* ── Banner auto-dismiss (keyed by id so a new banner restarts the timer) ── */
  const bannerId = liveBanner?.id;
  useEffect(() => {
    if (bannerId === undefined) return;
    const timer = setTimeout(() => setLiveBanner(null), BANNER_MS);
    return () => clearTimeout(timer);
  }, [bannerId]);

  /* ── Queries ── */
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
  const activeGroups = useMemo(() => groupList.filter((group) => group.isActive), [groupList]);

  const engineStatus = engine.data as FaceEngineStatus | undefined;
  const historyData = history.data as Paginated<RecognitionAttempt> | undefined;
  const historyList = useMemo(() => historyData?.items || [], [historyData]);

  /* ── Feed / banner helpers ── */
  const pushFeed = useCallback((item: Omit<FeedItem, 'id'>) => {
    const id = `${Date.now()}-${feedSeq.current++}`;
    setLiveFeed((prev) => [{ ...item, id }, ...prev.slice(0, 9)]);
  }, []);

  const showBanner = useCallback((banner: Omit<LiveBanner, 'id'>) => {
    bannerSeq.current += 1;
    setLiveBanner({ ...banner, id: bannerSeq.current });
  }, []);

  /* ── Mutations ── */
  const startSession = useMutation({
    mutationFn: () => faceApi.startSession({ groupId: form.groupId || undefined }),
    onSuccess: (response) => {
      const session = response as RecognitionSession;
      setForm((previous) => ({ ...previous, sessionId: session.sessionId ?? session.id }));
      setResult(null);
      setSessionStartedAt(Date.now());
      playTick();
      haptics.light();
      push('success', t('faceRecognition.sessionStarted'));
    },
    onError: (error: Error) => {
      playError();
      haptics.error();
      push('error', friendlyFaceError(error));
    },
  });

  const submit = useMutation({
    mutationFn: (base64: string) => faceApi.submitAttempt(form.sessionId, base64),
    onSuccess: (response) => {
      setResult(response);
      const parsed = formatRecognitionResult(response);
      const studentName = formatStudentName(parsed?.student) || "O'quvchi";
      const timeStr = new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });

      // `accessDenied` and DUPLICATE_PREVENTED take precedence over a bare IDENTIFIED.
      const outcome = resolveRecognitionOutcome(parsed);

      // Extract raw multi-face matches if present
      const rawMatches: any[] = Array.isArray((response as any)?.matches) && (response as any).matches.length > 0
        ? (response as any).matches
        : [];

      // Extract bounding boxes for visionOS biometric overlay
      const boxes: FaceBoxItem[] = [];
      if (rawMatches.length > 0) {
        rawMatches.forEach((m: any, idx: number) => {
          if (m.boundingBox) {
            const name = m.student ? formatStudentName(m.student) : (m.identified ? "Aniqlangan" : "Noma'lum");
            boxes.push({
              id: `box-${Date.now()}-${idx}`,
              x: m.boundingBox.x,
              y: m.boundingBox.y,
              width: m.boundingBox.width,
              height: m.boundingBox.height,
              label: name,
              kind: m.identified ? 'success' : 'unknown',
            });
          }
        });
      } else if ((response as any)?.boundingBox) {
        const bb = (response as any).boundingBox;
        boxes.push({
          id: `box-${Date.now()}-0`,
          x: bb.x,
          y: bb.y,
          width: bb.width,
          height: bb.height,
          label: studentName,
          kind: OUTCOME_KIND[outcome],
        });
      }
      if (detectedFaceBoxesTimeoutRef.current) {
        clearTimeout(detectedFaceBoxesTimeoutRef.current);
        detectedFaceBoxesTimeoutRef.current = null;
      }
      if (boxes.length > 0) {
        setDetectedFaceBoxes(boxes);
        detectedFaceBoxesTimeoutRef.current = setTimeout(() => {
          setDetectedFaceBoxes([]);
          detectedFaceBoxesTimeoutRef.current = null;
        }, 2500);
      }

      if (outcome === 'SUCCESS') {
        const studentId = parsed?.student?.id || studentName;
        const lastSeen = cooldownMapRef.current.get(studentId) || 0;
        const now = Date.now();

        // Prevent memory leak in long-running kiosk mode: prune entries older than 60s
        if (cooldownMapRef.current.size > 150) {
          for (const [sId, time] of cooldownMapRef.current.entries()) {
            if (now - time > 60000) cooldownMapRef.current.delete(sId);
          }
        }

        if (now - lastSeen < 18000) {
          playFaceIdDuplicate();
          haptics.light();
          return;
        }

        cooldownMapRef.current.set(studentId, now);
        playFaceIdMatch();
        haptics.heavy();
        voice.speakSuccess(studentName, parsed?.group?.name);

        const confidence = formatConfidence(parsed?.confidence);
        pushFeed({
          studentName,
          time: timeStr,
          groupName: parsed?.group?.name,
          kind: 'success',
          label: confidence,
        });
        showBanner({
          kind: 'success',
          title: studentName,
          subtitle: parsed?.group?.name,
          time: timeStr,
          confidence,
        });

        // Dispatch window event for FloatingPiPCamera and live tickers
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('medu:attendance-logged', {
              detail: {
                id: studentId,
                name: studentName,
                group: parsed?.group?.name || '',
                time: timeStr,
              },
            }),
          );
        }

        // Process any secondary identified matches from multi-face capture
        if (rawMatches.length > 1) {
          const otherMatches = rawMatches.filter(
            (m: any) => m.identified && m.student && m.student.id !== (parsed?.student?.id)
          );
          for (const m of otherMatches) {
            const mStudentName = formatStudentName(m.student);
            const mStudentId = m.student.id;
            const mLastSeen = cooldownMapRef.current.get(mStudentId) || 0;
            if (now - mLastSeen >= 18000) {
              cooldownMapRef.current.set(mStudentId, now);
              const mConfidence = formatConfidence(m.confidence || m.similarityScore);
              pushFeed({
                studentName: mStudentName,
                time: timeStr,
                groupName: m.group?.name || parsed?.group?.name,
                kind: 'success',
                label: mConfidence,
              });
              if (typeof window !== 'undefined') {
                window.dispatchEvent(
                  new CustomEvent('medu:attendance-logged', {
                    detail: {
                      id: mStudentId,
                      name: mStudentName,
                      group: m.group?.name || parsed?.group?.name || '',
                      time: timeStr,
                    },
                  }),
                );
              }
            }
          }
        }
      } else if (outcome === 'DUPLICATE') {
        playFaceIdDuplicate();
        haptics.medium();
        voice.speakDuplicate(studentName);
        pushFeed({
          studentName,
          time: timeStr,
          groupName: parsed?.group?.name,
          kind: 'duplicate',
          label: 'Qayta',
        });
        showBanner({
          kind: 'duplicate',
          title: studentName,
          subtitle: parsed?.group?.name,
          time: timeStr,
        });
      } else if (outcome === 'DENIED') {
        playFaceIdDenied();
        haptics.error();
        voice.speakAccessDenied(parsed?.accessReason);
        const reasonText = accessReasonLabel(parsed?.accessReason);
        pushFeed({
          studentName,
          time: timeStr,
          groupName: parsed?.group?.name,
          kind: 'denied',
          label: reasonText,
        });
        showBanner({
          kind: 'denied',
          title: studentName,
          subtitle:
            parsed?.accessReason === 'INSUFFICIENT_FUNDS' ? "To'lov qarzi mavjud" : 'Darsdan tashqari',
          time: timeStr,
        });
      } else if (outcome === 'UNKNOWN') {
        playFaceIdDenied();
        haptics.error();
        voice.speakUnknown();
        const guidance = getUnknownOutcomeGuidance(parsed?.status);
        pushFeed({
          studentName: guidance.title,
          time: timeStr,
          kind: 'unknown',
          label: guidance.label,
        });
        showBanner({
          kind: 'unknown',
          title: guidance.title,
          subtitle: guidance.subtitle,
          time: timeStr,
        });
        lastCaptureTimeRef.current = Date.now() + 1000;
      } else {
        playTick();
        haptics.medium();
        push('success', t('faceRecognition.attemptProcessed'));
      }

      queryClient.invalidateQueries({ queryKey: queryKeys.face.history() });
      queryClient.invalidateQueries({ queryKey: queryKeys.face.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.attendance.analyticsAll() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
    },
    onError: (error: Error) => {
      playError();
      haptics.error();
      push('error', friendlyFaceError(error));
    },
  });

  const finish = useMutation({
    mutationFn: () => faceApi.finishSession(form.sessionId, 'operator_finished'),
    onSuccess: () => {
      playTick();
      haptics.light();
      push('success', t('faceRecognition.sessionFinished'));
      setForm((previous) => ({ ...previous, sessionId: '' }));
      setResult(null);
      setSessionStartedAt(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.face.history() });
      queryClient.invalidateQueries({ queryKey: ['face-history'] });
      queryClient.invalidateQueries({ queryKey: ['face', 'history'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all() });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-analytics'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
    },
    onError: (error: Error) => {
      playError();
      haptics.error();
      push('error', friendlyFaceError(error));
    },
  });

  /* ── Handlers ── */
  const handleGroupChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    setForm((previous) => ({ ...previous, groupId: event.target.value }));
  }, []);

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
      if (submit.isPending) return;
      const now = Date.now();
      if (now - lastCaptureTimeRef.current < 1600) return;
      lastCaptureTimeRef.current = now;
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

  const handleOpenRecognitionSidecar = useCallback(
    (item: FeedItem) => {
      playTick();
      const tone = KIND_META[item.kind].tone;
      const color = TONE[tone].hex;
      const sidecarData: QuickLookData = {
        id: item.id || 'recognition-item',
        type: 'student',
        title: item.studentName || "O'quvchi",
        subtitle: `${item.groupName || 'Guruh'} · ${item.time || 'Hozir'}`,
        badge: {
          text: item.kind === 'success' && item.label ? `${item.label} Ishonch` : item.label || 'ANIQLANDI',
          tone: item.kind === 'success' ? 'emerald' : item.kind === 'duplicate' ? 'amber' : 'rose',
        },
        avatar: {
          text: (item.studentName || 'OQ').slice(0, 2).toUpperCase(),
          color,
        },
        metrics: [
          { label: "O'quvchi", value: item.studentName || '—' },
          { label: 'Guruh', value: item.groupName || '—' },
          { label: 'Natija', value: item.label || '—' },
          { label: 'Vaqt', value: item.time || 'Hozir' },
        ],
        details: [
          { label: "O'quvchi", value: item.studentName },
          { label: 'Guruh', value: item.groupName || '—' },
          { label: 'Natija', value: item.label || '—' },
          { label: 'Qayd etilgan vaqt', value: item.time || '—' },
        ],
      };
      openSidecar(sidecarData);
    },
    [playTick],
  );

  const handleCopySession = useCallback(async () => {
    if (!form.sessionId) return;
    try {
      await navigator.clipboard.writeText(form.sessionId);
      haptics.light();
      push('success', tx('faceRecognition.sessionCopied', 'Sessiya ID nusxalandi'));
    } catch {
      push('error', tx('faceRecognition.copyFailed', 'Nusxalab bo‘lmadi'));
    }
  }, [form.sessionId, haptics, push, tx]);

  const isSessionActive = Boolean(form.sessionId);
  const isMockEngine = engineStatus ? !engineStatus.isReal : false;
  const recognitionResult = formatRecognitionResult(result);

  /* ── Derived: stats ── */
  const stats = useMemo(() => {
    const total = historyList.length;
    let recognized = 0;
    let unknown = 0;
    for (const a of historyList) {
      const k = statusKind(a.status);
      if (k === 'success') recognized += 1;
      else if (k === 'unknown') unknown += 1;
    }
    const rate = total > 0 ? Math.round((recognized / total) * 100) : null;
    return { total, recognized, unknown, rate };
  }, [historyList]);

  /* ── Derived: filtered history ── */
  const filteredHistory = useMemo(() => {
    const q = historyQuery.trim().toLowerCase();
    return historyList.filter((a) => {
      const k = statusKind(a.status);
      if (historyFilter === 'success' && k !== 'success') return false;
      if (historyFilter === 'failed' && k === 'success') return false;
      if (q && !formatStudentName(a.student).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [historyList, historyFilter, historyQuery]);

  const handleExportCsv = useCallback(() => {
    if (filteredHistory.length === 0) return;
    const rows = [
      ['time', 'student', 'status', 'confidence'],
      ...filteredHistory.map((a) => [
        a.occurredAt,
        formatStudentName(a.student),
        a.status,
        formatConfidence(a.confidence),
      ]),
    ];
    const csv = '\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `recognition-history-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    haptics.light();
    push('success', tx('faceRecognition.exported', 'CSV yuklab olindi'));
  }, [filteredHistory, haptics, push, tx]);

  const filterOptions: Array<{ id: HistoryFilter; label: string }> = [
    { id: 'all', label: tx('common.all', 'Barchasi') },
    { id: 'success', label: tx('faceRecognition.filterIdentified', 'Tanilgan') },
    { id: 'failed', label: tx('faceRecognition.filterFailed', 'Tanilmagan') },
  ];

  /* ── Result card derived values ── */
  const resultKind: Kind = recognitionResult
    ? OUTCOME_KIND[resolveRecognitionOutcome(recognitionResult)]
    : 'neutral';
  const resultName = formatStudentName(recognitionResult?.student);
  const resultConfidence = confidenceValue(recognitionResult?.confidence);

  const resultHeadline = (() => {
    switch (resultKind) {
      case 'success':
        return { title: resultName, text: 'Face ID orqali aniqlandi • Davomat belgilandi' };
      case 'duplicate':
        return { title: resultName, text: 'Davomat allaqachon qayd etilgan' };
      case 'denied':
        return { title: resultName, text: `Kirish rad etildi • ${accessReasonLabel(recognitionResult?.accessReason)}` };
      case 'unknown':
        return {
          title: tx('face.noFaceMatch', 'Yuz tanilmadi'),
          text: "Yuzingizni kameraga to'g'rilang yoki avval yuzni ro'yxatdan o'tkazing",
        };
      default:
        return { title: humanizeStatus(recognitionResult?.status), text: t('faceRecognition.resultTitle') };
    }
  })();

  /* ══════════════════════════════════════════════════════════════════
   * RENDER
   * ════════════════════════════════════════════════════════════════ */
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="page-container relative isolate space-y-5 pb-[max(6rem,env(safe-area-inset-bottom))]"
    >
      <AmbientOrbs reduced={reduced} />
      {toastNode}

      {/* ── Outcome toast (hidden in kiosk — kiosk shows its own) ── */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-3 top-[calc(0.75rem+env(safe-area-inset-top,0px))] z-50 mx-auto max-w-md sm:inset-x-auto sm:right-6 sm:top-6 sm:mx-0 sm:w-full"
      >
        <AnimatePresence>
          {liveBanner && !isKioskMode && (
            <motion.div
              key={liveBanner.id}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: -24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.96 }}
              transition={SPRING.snappy}
              className="pointer-events-auto"
            >
              <OutcomeBanner banner={liveBanner} variant="toast" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ══════════════════ KIOSK / TURNSTILE ══════════════════ */}
      <AnimatePresence onExitComplete={() => setKioskMounted(false)}>
        {isKioskMode && (
          <motion.div
            key="kiosk"
            role="dialog"
            aria-modal="true"
            aria-label={tx('face.kioskTitle', 'Kiosk')}
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.985 }}
            transition={SPRING.smooth}
            className="fixed inset-0 z-[100] flex select-none flex-col overflow-hidden bg-[#07090E] text-white"
          >
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
              <div
                className="absolute -top-[20%] left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full"
                style={{
                  background:
                    'radial-gradient(circle, rgba(0,122,255,0.18) 0%, rgba(175,82,222,0.12) 40%, transparent 70%)',
                }}
              />
              <div
                className="absolute -bottom-[20%] right-[-10%] h-[500px] w-[600px] rounded-full"
                style={{ background: 'radial-gradient(circle, rgba(52,199,89,0.14) 0%, transparent 60%)' }}
              />
            </div>

            <header className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] backdrop-blur-2xl sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <IconTile icon={I.scan} tone="blue" size={44} solid />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="truncate text-base font-semibold tracking-tight">
                      {tx('face.kioskTitle', 'Kiosk')}
                    </h1>
                    <span className="flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                      <Pulse className="bg-emerald-400" />
                      {tx('face.liveTurnstile', 'Live')}
                    </span>
                  </div>
                  <p className="truncate text-xs text-white/55">{tx('face.smartTerminal', 'Smart terminal')}</p>
                </div>
              </div>

              <KioskClock />

              <div className="flex flex-wrap items-center gap-2">
                <ToggleChip
                  dark
                  pressed={voice.enabled}
                  onClick={() => voice.toggleVoice()}
                  icon={voice.enabled ? I.volume : I.volumeX}
                  label={voice.enabled ? 'Ovoz yoqiq' : "Ovoz o'chiq"}
                  title="Ovozli yordamchi"
                />
                <ToggleChip
                  dark
                  pressed={autoScan}
                  onClick={() => setAutoScan((s) => !s)}
                  icon={I.sparkles}
                  label={autoScan ? 'Avto-skan: faol' : "Avto-skan: qo'lda"}
                />
                {isSessionActive ? (
                  <span className="hidden items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-300 lg:inline-flex">
                    <Pulse className="bg-emerald-400" />
                    <SessionTimer startedAt={sessionStartedAt} />
                  </span>
                ) : (
                  <Btn variant="primary" size="sm" onClick={handleStartSession} disabled={startSession.isPending}>
                    <Icon paths={I.play} size={13} strokeWidth={2.4} />
                    {tx('face.startSession', 'Sessiyani boshlash')}
                  </Btn>
                )}
                <button
                  type="button"
                  onClick={() => setIsKioskMode(false)}
                  title="Kioskdan chiqish (Esc)"
                  className={cn(
                    'inline-flex h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3.5 text-xs font-semibold transition-colors hover:bg-white/20',
                    FOCUS,
                  )}
                >
                  <Icon paths={I.minimize} size={15} strokeWidth={2.2} />
                  <span>{tx('common.exit', 'Chiqish')}</span>
                  <kbd className="hidden rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-white/60 sm:inline-block">
                    Esc
                  </kbd>
                </button>
              </div>
            </header>

            <main className="relative z-10 grid min-h-0 flex-1 grid-cols-1 gap-5 overflow-y-auto p-4 sm:p-6 lg:grid-cols-[1fr_380px] lg:overflow-hidden">
              <div className="relative flex min-h-0 flex-col items-center justify-center">
                {isSessionActive ? (
                  <div className="relative flex w-full max-w-2xl flex-col items-center">
                    <div className="relative w-full overflow-hidden rounded-[28px] border border-white/15 bg-black/40 shadow-2xl shadow-black/70">
                      <WebcamCapture
                        onCapture={handleCapture}
                        busy={submit.isPending}
                        autoScan={autoScan}
                        onAutoScanToggle={() => setAutoScan((s) => !s)}
                        showAutoScanToggle={true}
                        isKiosk={true}
                        label="Yuzni tanish"
                      />
                      <ScanReticle busy={submit.isPending} reduced={reduced} boxes={detectedFaceBoxes} />
                    </div>

                    <div className="mt-4 flex items-center justify-center">
                      <div className="flex items-center gap-2.5 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-white/80 backdrop-blur-lg">
                        <Pulse className="bg-cyan-400" />
                        <span>
                          {submit.isPending
                            ? 'Yuz tahlil qilinmoqda, kuting...'
                            : "Kameraga to'g'ri qarang — tizim avtomatik taniydi"}
                        </span>
                      </div>
                    </div>

                    <div className="pointer-events-none absolute inset-x-4 top-4 z-30">
                      <AnimatePresence>
                        {liveBanner && (
                          <motion.div
                            key={liveBanner.id}
                            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 24 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: -16 }}
                            transition={SPRING.snappy}
                          >
                            <OutcomeBanner banner={liveBanner} variant="kiosk" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                ) : (
                  <div className="flex max-w-md flex-col items-center rounded-[28px] border border-white/10 bg-white/5 p-8 text-center backdrop-blur-xl">
                    <IconTile icon={I.camera} tone="blue" size={64} className="mb-4" />
                    <h3 className="text-lg font-semibold">{tx('face.sessionNotActivated', 'Sessiya faol emas')}</h3>
                    <p className="mb-5 mt-1 text-sm text-white/60">{tx('face.kioskDesc', '')}</p>
                    <Btn variant="primary" onClick={handleStartSession} disabled={startSession.isPending}>
                      <Icon paths={I.play} size={15} strokeWidth={2.4} />
                      {tx('face.startSession', 'Sessiyani boshlash')}
                    </Btn>
                  </div>
                )}
              </div>

              <section className="flex min-h-[260px] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] backdrop-blur-xl lg:min-h-0">
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                  <div className="flex items-center gap-2.5">
                    <Pulse className="bg-emerald-400" />
                    <h2 className="text-sm font-semibold">{tx('face.liveStream', 'Jonli oqim')}</h2>
                  </div>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white/70">
                    {liveFeed.length}
                  </span>
                </div>
                {liveFeed.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-white/45">
                    <Icon paths={I.empty} size={28} strokeWidth={1.6} className="mb-2 opacity-60" />
                    <p className="text-xs">{tx('face.noOneEntered', 'Hali hech kim kirmadi')}</p>
                    <p className="mt-0.5 text-[11px] text-white/35">
                      O&apos;quvchi tanilganda bu yerda real vaqtda paydo bo&apos;ladi
                    </p>
                  </div>
                ) : (
                  <ul className="flex-1 space-y-1.5 overflow-y-auto p-2.5">
                    <AnimatePresence initial={false}>
                      {liveFeed.map((item) => (
                        <FeedRow key={item.id} item={item} dark onOpen={handleOpenRecognitionSidecar} />
                      ))}
                    </AnimatePresence>
                  </ul>
                )}
              </section>
            </main>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════ HEADER ══════════════════ */}
      <motion.header variants={cardVariants} className={cn(CARD, 'p-5 sm:p-6')}>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/50 to-transparent dark:from-white/[0.04]"
        />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <motion.span
              initial={reduced ? false : { scale: 0.9, opacity: 0, rotate: -6 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={SPRING.smooth}
              className="relative flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-[20px] text-white shadow-[0_14px_30px_-10px_rgba(0,122,255,0.6),inset_0_2px_0_rgba(255,255,255,0.35)]"
              style={{ background: 'linear-gradient(135deg, #007AFF 0%, #AF52DE 100%)' }}
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-[20px] bg-gradient-to-b from-white/40 to-transparent"
              />
              <Icon paths={I.scan} size={28} strokeWidth={2} className="relative" />
            </motion.span>

            <div className="min-w-0">
              <h1 className={cn('text-[28px] font-semibold leading-tight tracking-[-0.03em] sm:text-[34px]', TXT)}>
                {t('faceRecognition.title')}
              </h1>
              <p className={cn('mt-1 text-[14px] font-medium leading-snug', TXT_2)}>
                {t('faceRecognition.subtitle')}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {engineStatus && (
                  <Chip
                    tone={engineStatus.isReal ? 'emerald' : 'amber'}
                    icon={<Pulse className={engineStatus.isReal ? 'bg-[#34C759]' : 'bg-[#FF9500]'} />}
                  >
                    {engineStatus.provider || t('common.unknown')}
                  </Chip>
                )}
                {isSessionActive && (
                  <Chip tone="blue" icon={<Icon paths={I.clock} size={12} strokeWidth={2.2} />}>
                    <SessionTimer startedAt={sessionStartedAt} />
                  </Chip>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ToggleChip
              pressed={voice.enabled}
              onClick={() => voice.toggleVoice()}
              icon={voice.enabled ? I.volume : I.volumeX}
              label={voice.enabled ? 'Ovoz yoqiq' : "Ovoz o'chiq"}
              title="Ovozli qutlov va e'lonlar"
            />
            <ToggleChip
              pressed={autoScan}
              onClick={() => setAutoScan((s) => !s)}
              icon={I.sparkles}
              label={autoScan ? 'Avto-skan' : "Qo'lda"}
              title="Avtomatik skanerlash"
            />
            <button
              type="button"
              onClick={() => setIsKioskMode(true)}
              className={cn(
                'inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-[12.5px] font-semibold tracking-tight transition-all active:scale-[0.97]',
                'bg-gradient-to-r from-[#007AFF]/15 via-[#AF52DE]/15 to-[#34C759]/15 ring-1 ring-inset ring-[#AF52DE]/30 hover:from-[#007AFF]/25 hover:via-[#AF52DE]/25 hover:to-[#34C759]/25',
                TXT,
                FOCUS,
              )}
            >
              <Icon paths={I.maximize} size={15} strokeWidth={2.2} className="text-[#AF52DE]" />
              <span>Kiosk rejimi</span>
              <kbd className="hidden rounded-md bg-black/[0.07] px-1.5 py-0.5 font-sans text-[10.5px] font-semibold opacity-70 lg:inline dark:bg-white/10">
                K
              </kbd>
            </button>
          </div>
        </div>
      </motion.header>

      {/* ══════════════════ KPI STRIP ══════════════════ */}
      <motion.section
        variants={cardVariants}
        aria-label="Statistika"
        className={cn(CARD, 'grid grid-cols-2 gap-x-4 gap-y-5 p-5 sm:grid-cols-4 sm:gap-y-0')}
      >
        <StatCell
          icon={I.activity}
          tone={engineStatus?.isReal ? 'emerald' : 'amber'}
          label={t('faceRecognition.engineLabel')}
          hint={engineStatus?.provider}
        >
          {engine.isLoading && !engineStatus ? '…' : engineStatus?.isReal ? 'Real' : 'Mock'}
        </StatCell>

        <StatCell
          icon={isSessionActive ? I.play : I.stop}
          tone={isSessionActive ? 'blue' : 'gray'}
          label={t('faceRecognition.sessionActive')}
          hint={isSessionActive ? <SessionTimer startedAt={sessionStartedAt} /> : tx('faceRecognition.noSessionShort', 'Sessiya boshlanmagan')}
          className="sm:border-l sm:border-black/[0.07] sm:pl-5 dark:sm:border-white/[0.09]"
        >
          {isSessionActive ? tx('faceRecognition.stateActive', 'Faol') : tx('faceRecognition.stateIdle', 'Kutmoqda')}
        </StatCell>

        <StatCell
          icon={I.layers}
          tone="purple"
          label={t('faceRecognition.historyTitle')}
          hint={`${liveFeed.length} · ${tx('faceRecognition.thisSession', 'shu sessiyada')}`}
          className="sm:border-l sm:border-black/[0.07] sm:pl-5 dark:sm:border-white/[0.09]"
        >
          <CountUp value={stats.total} reduced={reduced} />
        </StatCell>

        <StatCell
          icon={I.checkCircle}
          tone="emerald"
          label={tx('faceRecognition.successRate', 'Muvaffaqiyat')}
          hint={`${stats.recognized} ${tx('faceRecognition.identified', 'tanilgan')} · ${stats.unknown} ${tx('faceRecognition.notMatched', 'tanilmagan')}`}
          className="sm:border-l sm:border-black/[0.07] sm:pl-5 dark:sm:border-white/[0.09]"
        >
          {stats.rate === null ? '—' : (
            <>
              <CountUp value={stats.rate} reduced={reduced} />
              <span className="text-[16px]">%</span>
            </>
          )}
        </StatCell>
      </motion.section>

      {/* ══════════════════ MAIN GRID ══════════════════ */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        {/* ──────────── SCANNER STAGE ──────────── */}
        <motion.section variants={cardVariants} className={cn(CARD, 'min-w-0')} aria-label={t('faceRecognition.engineLabel')}>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white/50 to-transparent dark:from-white/[0.04]"
          />

          {/* Session controls */}
          <div className={cn('relative flex flex-col gap-4 border-b px-5 py-4 lg:flex-row lg:items-center lg:justify-between', HAIRLINE)}>
            <div className="flex min-w-0 items-center gap-3">
              <IconTile icon={I.camera} tone="blue" size={40} solid />
              <div className="min-w-0">
                <h2 className={cn('truncate text-[15px] font-semibold tracking-tight', TXT)}>
                  {isSessionActive ? t('faceRecognition.submitCapture') : t('faceRecognition.startFirst')}
                </h2>
                <p className={cn('mt-0.5 truncate text-[12.5px] font-medium', TXT_2)}>
                  {isSessionActive ? t('faceRecognition.recognizeFace') : t('faceRecognition.captureHint')}
                </p>
              </div>
            </div>

            {isSessionActive ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopySession}
                  title={form.sessionId}
                  aria-label={tx('faceRecognition.copySession', 'Sessiya ID ni nusxalash')}
                  className={cn(
                    'inline-flex h-9 items-center gap-2 rounded-xl px-3 font-mono text-[12px] font-medium transition-colors',
                    'bg-black/[0.04] ring-1 ring-inset ring-black/[0.06] hover:bg-black/[0.07]',
                    'dark:bg-white/[0.06] dark:ring-white/10 dark:hover:bg-white/10',
                    TXT_2,
                    FOCUS,
                  )}
                >
                  <Pulse className="bg-[#34C759]" />
                  {truncateSessionId(form.sessionId)}
                  <Icon paths={I.copy} size={13} strokeWidth={2} />
                </button>
                <Btn
                  variant="danger"
                  size="sm"
                  onClick={handleFinishSession}
                  disabled={finish.isPending}
                  aria-label={t('faceRecognition.finishSession')}
                >
                  <Icon paths={I.stop} size={12} strokeWidth={2.4} />
                  {finish.isPending ? t('faceRecognition.finishing') : t('faceRecognition.finishSession')}
                </Btn>
              </div>
            ) : (
              <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end lg:w-auto">
                <GlassField label={t('faceRecognition.groupOptional')}>
                  <GlassSelect
                    value={form.groupId}
                    onChange={handleGroupChange}
                    aria-label={t('faceRecognition.groupSelectAria')}
                    disabled={startSession.isPending}
                    className="sm:min-w-52"
                  >
                    <option value="">{t('faceRecognition.anyGroup')}</option>
                    {activeGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </GlassSelect>
                </GlassField>
                <Btn
                  variant="primary"
                  onClick={handleStartSession}
                  disabled={startSession.isPending}
                  aria-busy={startSession.isPending}
                >
                  {startSession.isPending ? (
                    <>
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white motion-safe:animate-spin" />
                      {t('faceRecognition.starting')}
                    </>
                  ) : (
                    <>
                      <Icon paths={I.play} size={14} strokeWidth={2.4} />
                      {t('faceRecognition.startSession')}
                    </>
                  )}
                </Btn>
              </div>
            )}
          </div>

          <div className="relative space-y-4 p-5">
            {/* Notices */}
            {isMockEngine && (
              <div
                role="note"
                className={cn('flex items-start gap-2.5 rounded-2xl px-4 py-3 text-[12.5px] font-medium leading-5', TONE.amber.chip)}
              >
                <Icon paths={I.warning} size={15} strokeWidth={2.2} className="mt-0.5 shrink-0" />
                <span>{t('faceRecognition.mockNotice')}</span>
              </div>
            )}
            {startSession.isError && (
              <div role="alert" className={cn('flex items-start gap-2.5 rounded-2xl px-4 py-3 text-[12.5px] font-medium leading-5', TONE.red.chip)}>
                <Icon paths={I.xCircle} size={15} strokeWidth={2.2} className="mt-0.5 shrink-0" />
                <span>{friendlyFaceError(startSession.error as Error)}</span>
              </div>
            )}
            {engine.isError && (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[12.5px] font-medium text-[#C4281E] dark:text-[#FF6961]">
                  {t('faceRecognition.engineRetry')}
                </span>
                <Btn variant="danger" size="sm" onClick={handleRetryEngine}>
                  <Icon paths={I.refresh} size={12} strokeWidth={2.4} />
                  {t('faceRecognition.engineRetry')}
                </Btn>
              </div>
            )}

            {/* Stage */}
            {isSessionActive && !isKioskMode && !kioskMounted ? (
              <div className="relative overflow-hidden rounded-[24px] border border-black/[0.06] bg-black/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] dark:border-white/[0.08] dark:bg-white/[0.04]">
                <WebcamCapture
                  onCapture={handleCapture}
                  busy={submit.isPending}
                  label={t('faceRecognition.recognizeFace')}
                  autoScan={autoScan}
                  onAutoScanToggle={() => setAutoScan((s) => !s)}
                  showAutoScanToggle={isSessionActive}
                  isKiosk={false}
                />
                <ScanReticle busy={submit.isPending} reduced={reduced} boxes={detectedFaceBoxes} />
                {isMockEngine && (
                  <span className="absolute right-4 top-4 z-20 inline-flex items-center gap-1.5 rounded-full bg-[#FF9500] px-2.5 py-1 text-[11px] font-semibold text-white shadow-md">
                    <Icon paths={I.warning} size={11} strokeWidth={2.4} />
                    Simulation
                  </span>
                )}
                {submit.isPending && (
                  <span className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1.5 text-[12px] font-medium text-white backdrop-blur-md">
                    Tahlil qilinmoqda…
                  </span>
                )}
              </div>
            ) : isSessionActive ? (
              <div className={cn(WELL, 'flex min-h-60 flex-col items-center justify-center gap-3 px-6 text-center')}>
                <IconTile icon={I.maximize} tone="purple" size={48} />
                <p className={cn('text-[13px] font-medium', TXT_2)}>Kamera kiosk rejimida ishlamoqda.</p>
                <Btn onClick={() => setIsKioskMode(false)}>
                  <Icon paths={I.minimize} size={14} strokeWidth={2.2} />
                  {tx('common.exit', 'Chiqish')}
                </Btn>
              </div>
            ) : (
              <div className={cn(WELL, 'relative flex min-h-72 flex-col items-center justify-center overflow-hidden px-6 py-10 text-center')}>
                <div aria-hidden="true" className="relative mb-5 flex h-24 w-24 items-center justify-center">
                  <span className="absolute inset-0 rounded-full bg-[#007AFF]/10 motion-safe:animate-pulse" />
                  <span className="absolute inset-3 rounded-full bg-[#007AFF]/10" />
                  <IconTile icon={I.scan} tone="blue" size={56} solid radius={20} className="relative" />
                </div>
                <p className={cn('max-w-sm text-[14px] font-medium leading-6', TXT_2)}>
                  {t('faceRecognition.captureHint')}
                </p>
                <Btn
                  variant="primary"
                  className="mt-5"
                  onClick={handleStartSession}
                  disabled={startSession.isPending}
                >
                  <Icon paths={I.play} size={14} strokeWidth={2.4} />
                  {t('faceRecognition.startSession')}
                </Btn>
              </div>
            )}

            {submit.isError && (
              <div role="alert" className={cn('flex items-start gap-2.5 rounded-2xl px-4 py-3 text-[12.5px] font-medium leading-5', TONE.red.chip)}>
                <Icon paths={I.xCircle} size={15} strokeWidth={2.2} className="mt-0.5 shrink-0" />
                <span>{friendlyFaceError(submit.error as Error)}</span>
              </div>
            )}

            {/* Result */}
            <AnimatePresence initial={false}>
              {recognitionResult && (
                <motion.div
                  key="result"
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={SPRING.smooth}
                  className={cn(WELL, 'p-4')}
                  role="status"
                  aria-live="polite"
                >
                  <div className="flex items-center gap-4">
                    <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl', TONE[KIND_META[resultKind].tone].solid)}>
                      <Icon paths={KIND_META[resultKind].icon} size={24} strokeWidth={2.3} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className={cn('truncate text-[16px] font-semibold tracking-tight', TXT)}>
                        {resultHeadline.title}
                      </h3>
                      <p className={cn('mt-0.5 text-[12.5px] font-medium leading-5', TXT_2)}>{resultHeadline.text}</p>
                    </div>
                    {resultConfidence !== null && (
                      <ConfidenceRing
                        value={resultConfidence}
                        label={formatConfidence(recognitionResult.confidence)}
                        reduced={reduced}
                      />
                    )}
                  </div>

                  <div className={cn('mt-3 divide-y', 'divide-black/[0.06] dark:divide-white/[0.08]')}>
                    <ResultRow icon={I.user} label={t('faceRecognition.student')} value={resultName} />
                    <ResultRow
                      icon={I.shield}
                      label={t('common.status')}
                      value={
                        <Chip tone={KIND_META[resultKind].tone}>{humanizeStatus(recognitionResult.status)}</Chip>
                      }
                    />
                    <ResultRow
                      icon={I.activity}
                      label={t('faceRecognition.confidence')}
                      value={<span className="tabular-nums">{formatConfidence(recognitionResult.confidence)}</span>}
                    />
                    <ResultRow
                      icon={I.fingerprint}
                      label={t('faceRecognition.liveness')}
                      value={formatLivenessResult(recognitionResult.livenessResult)}
                    />
                    {recognitionResult.group?.name && (
                      <ResultRow icon={I.users} label="Guruh" value={recognitionResult.group.name} />
                    )}
                  </div>

                  <div className={cn('mt-3 border-t pt-2', HAIRLINE)}>
                    <button
                      type="button"
                      onClick={() => setRawExpanded((v) => !v)}
                      aria-expanded={rawExpanded}
                      className={cn(
                        'flex min-h-9 w-full items-center justify-between gap-2 rounded-lg px-1 text-left text-[12.5px] font-semibold transition-colors',
                        TXT_2,
                        'hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]',
                        FOCUS,
                      )}
                    >
                      <span>{t('faceRecognition.viewRaw')}</span>
                      <motion.span animate={{ rotate: rawExpanded ? 180 : 0 }} transition={SPRING.snappy}>
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
                          className={cn(
                            'mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-black/[0.04] p-3 font-mono text-[11.5px] leading-relaxed dark:bg-white/[0.05]',
                            TXT,
                          )}
                        >
                          {JSON.stringify(result, null, 2)}
                        </motion.pre>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.section>

        {/* ──────────── RIGHT COLUMN ──────────── */}
        <div className="flex min-w-0 flex-col gap-5">
          {/* Session feed */}
          <motion.section variants={cardVariants} className={CARD} aria-label={tx('face.liveStream', 'Jonli oqim')}>
            <div className={cn('flex items-center justify-between gap-3 border-b px-5 py-4', HAIRLINE)}>
              <div className="flex items-center gap-3">
                <IconTile icon={I.users} tone="emerald" size={36} />
                <div>
                  <h2 className={cn('text-[15px] font-semibold tracking-tight', TXT)}>
                    {tx('faceRecognition.sessionFeed', 'Sessiyadagi so‘nggi tanishlar')}
                  </h2>
                  <p className={cn('mt-0.5 text-[12px] font-medium', TXT_2)}>
                    {liveFeed.length > 0 ? `${liveFeed.length} ta yozuv` : 'Real vaqt'}
                  </p>
                </div>
              </div>
              {isSessionActive && <Pulse className="bg-[#34C759]" />}
            </div>

            <div className="p-3">
              {liveFeed.length === 0 ? (
                <div className="flex flex-col items-center px-6 py-8 text-center">
                  <IconTile icon={I.empty} tone="gray" size={44} className="mb-3" />
                  <p className={cn('text-[13px] font-semibold', TXT)}>
                    {tx('face.noOneEntered', 'Hali hech kim tanilmadi')}
                  </p>
                  <p className={cn('mt-1 max-w-xs text-[12px] font-medium', TXT_2)}>
                    O&apos;quvchi tanilganda bu yerda real vaqtda paydo bo&apos;ladi.
                  </p>
                </div>
              ) : (
                <ul className="max-h-[340px] space-y-1.5 overflow-y-auto pr-0.5">
                  <AnimatePresence initial={false}>
                    {liveFeed.map((item) => (
                      <FeedRow key={item.id} item={item} onOpen={handleOpenRecognitionSidecar} />
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>
          </motion.section>

          {/* History */}
          <motion.section variants={cardVariants} className={cn(CARD, 'min-w-0')}>
            <div className={cn('flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4', HAIRLINE)}>
              <div className="flex items-center gap-3">
                <IconTile icon={I.layers} tone="purple" size={36} />
                <div>
                  <h2 className={cn('text-[15px] font-semibold tracking-tight', TXT)}>
                    {t('faceRecognition.historyTitle')}
                  </h2>
                  <p className={cn('mt-0.5 text-[12px] font-medium tabular-nums', TXT_2)}>
                    {historyList.length > 0 ? `${historyList.length} ta yozuv` : '—'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {history.isFetching && !history.isLoading && (
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 rounded-full border-2 border-[#007AFF]/25 border-t-[#007AFF] motion-safe:animate-spin"
                  />
                )}
                <Btn
                  size="sm"
                  onClick={handleExportCsv}
                  disabled={filteredHistory.length === 0}
                  title={tx('faceRecognition.exportCsv', 'CSV eksport')}
                >
                  <Icon paths={I.download} size={14} strokeWidth={2.1} />
                  <span className="hidden sm:inline">CSV</span>
                </Btn>
              </div>
            </div>

            {historyList.length > 0 && (
              <div className={cn('flex flex-col gap-2.5 border-b px-5 py-3 sm:flex-row sm:items-center sm:justify-between', HAIRLINE)}>
                {/* Segmented filter */}
                <div
                  role="tablist"
                  aria-label="Filtr"
                  className="relative inline-flex rounded-xl bg-black/[0.045] p-[3px] dark:bg-white/[0.07]"
                >
                  {filterOptions.map((opt) => {
                    const active = historyFilter === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setHistoryFilter(opt.id)}
                        className={cn(
                          'relative min-h-8 rounded-[9px] px-3 text-[12.5px] font-semibold transition-colors',
                          active ? TXT : TXT_2,
                          FOCUS,
                        )}
                      >
                        {active && (
                          <motion.span
                            layoutId="history-filter-pill"
                            transition={reduced ? { duration: 0 } : SPRING.snappy}
                            aria-hidden="true"
                            className="absolute inset-0 rounded-[9px] bg-white shadow-[0_1px_3px_rgba(16,24,40,0.12),0_0_0_0.5px_rgba(16,24,40,0.06)] dark:bg-white/[0.14]"
                          />
                        )}
                        <span className="relative">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Search */}
                <label className="relative block sm:w-52">
                  <span className="sr-only">{tx('common.search', 'Qidirish')}</span>
                  <Icon
                    paths={I.search}
                    size={14}
                    strokeWidth={2.1}
                    className={cn('pointer-events-none absolute left-3 top-1/2 -translate-y-1/2', TXT_2)}
                  />
                  <input
                    value={historyQuery}
                    onChange={(e) => setHistoryQuery(e.target.value)}
                    type="search"
                    placeholder={tx('faceRecognition.searchStudent', 'O‘quvchi nomi')}
                    autoComplete="off"
                    className={cn(
                      'h-9 w-full rounded-xl pl-9 pr-3 text-[13px] font-medium outline-none transition-shadow',
                      'bg-black/[0.045] placeholder:text-[#8E8E93] focus:bg-white focus:ring-2 focus:ring-[#007AFF]/40',
                      'dark:bg-white/[0.07] dark:focus:bg-white/[0.1]',
                      '[&::-webkit-search-cancel-button]:hidden',
                      TXT,
                    )}
                  />
                </label>
              </div>
            )}

            {history.isLoading && !historyData ? (
              <div className="space-y-2.5 p-5">
                {[1, 2, 3, 4].map((i) => (
                  <Shimmer key={i} className="h-16" />
                ))}
              </div>
            ) : history.isError ? (
              <div className="p-6">
                <GlassErrorState
                  title={t('faceRecognition.historyError')}
                  message={getErrorMessage(history.error as Error)}
                  onRetry={handleRetryHistory}
                />
              </div>
            ) : historyList.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <IconTile icon={I.empty} tone="purple" size={52} className="mb-3" />
                <p className={cn('text-[14px] font-semibold', TXT)}>{t('faceRecognition.emptyHistory')}</p>
                <p className={cn('mt-1 max-w-sm text-[12.5px] font-medium', TXT_2)}>
                  {t('faceRecognition.emptyHistoryHint')}
                </p>
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <IconTile icon={I.search} tone="gray" size={48} className="mb-3" />
                <p className={cn('text-[13.5px] font-semibold', TXT)}>
                  {tx('faceRecognition.nothingFound', 'Hech narsa topilmadi')}
                </p>
                <Btn
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    setHistoryFilter('all');
                    setHistoryQuery('');
                  }}
                >
                  {tx('faceRecognition.resetFilters', 'Filtrni tozalash')}
                </Btn>
              </div>
            ) : (
              <ul className="max-h-[520px] divide-y divide-black/[0.06] overflow-y-auto dark:divide-white/[0.08]">
                {filteredHistory.map((attempt) => {
                  const name = formatStudentName(attempt.student);
                  const kind = statusKind(attempt.status);
                  const meta = KIND_META[kind];
                  return (
                    <li
                      key={attempt.id}
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                    >
                      <Avatar name={name} size={40} />
                      <div className="min-w-0 flex-1">
                        <p className={cn('truncate text-[13.5px] font-semibold tracking-tight', TXT)}>{name}</p>
                        <div className={cn('mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] font-medium tabular-nums', TXT_2)}>
                          <span className="inline-flex items-center gap-1">
                            <Icon paths={I.clock} size={11} strokeWidth={2.2} className="opacity-70" />
                            {formatDateTime(attempt.occurredAt)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Icon paths={I.activity} size={11} strokeWidth={2.2} className="opacity-70" />
                            {formatConfidence(attempt.confidence)}
                          </span>
                        </div>
                      </div>
                      <Chip tone={meta.tone} icon={<span className={cn('h-1.5 w-1.5 rounded-full', TONE[meta.tone].dot)} />}>
                        {humanizeStatus(attempt.status)}
                      </Chip>
                    </li>
                  );
                })}
              </ul>
            )}
          </motion.section>
        </div>
      </div>
    </motion.div>
  );
}