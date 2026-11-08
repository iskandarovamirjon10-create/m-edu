'use client';

/**
 * ============================================================================
 * M-EDU FaceEnrollmentPage — Master "Spatial Biometric Studio" (V4 Edition)
 * ============================================================================
 *
 * Synthesizes Senior Architect Security/Audit fixes & Principal UI/UX upgrades:
 *  • Single-layer Liquid Glass V4 surface architecture (compositor-optimized)
 *  • Interactive KPI Bento Cards (click-to-filter, animated counters, SVG ring)
 *  • 5-State Status Segmentation (ALL, ACTIVE, PENDING, REVOKED, EXPIRED) with counts
 *  • Dual-Engine Capture: Live LiDAR Viewfinder + Studio Photo Upload fallback
 *  • Smart Auto-Queue: 1-click "Pick Next", unenrolled filter, auto-advance on scan
 *  • Active Duplicate Warning: Instant notice + 1-click "Revoke Old" button
 *  • Biometric Compliance: Operator consent validation gate
 *  • Seamless Resume: 1-click continue for PENDING sessions from directory
 *  • Directory Quick Actions: Sidecar QuickLook, Re-enroll, Copy ID, CSV Export
 *  • Hardened CSV Export: UTF-8 BOM + formula injection protection (=, +, -, @)
 *  • Session Safety: beforeunload guard while camera session is active
 *  • Performance: Transform-only laser animation, deferred search, ref-synced fx
 *  • 100% API contract & regression test preservation (Vitest & Web contracts)
 * ============================================================================
 */

import {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  useDeferredValue,
  memo,
  type ChangeEvent,
  type ReactNode,
} from 'react';
import { Link, useInRouterContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  motion,
  AnimatePresence,
  LayoutGroup,
  animate,
  useMotionValue,
  useTransform,
  type Variants,
} from 'framer-motion';
import { usePageTitle } from '@/hooks/usePageTitle';
import { faceApi, studentsApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys.factory';
import {
  GlassBadge,
  GlassPageLoader,
  GlassErrorState,
  GlassEmptyState,
  GlassField,
  GlassSelect,
  GlassButton,
  ConfirmDialog,
  useToasts,
  statusColor,
} from '@/components/ui';
import { AuroraMesh } from '@/components/ui/AuroraMesh';
import { WebcamCapture } from '@/components/WebcamCapture';
import { formatDate } from '@/lib/format';
import { friendlyFaceError } from '@/lib/faceErrors';
import { getErrorMessage } from '@/lib/errorMessages';
import { cn, usePrefersReducedMotion } from '@/lib/design';
import type {
  Paginated,
  Student,
  FaceEnrollment,
  FaceEnrollmentStatus,
} from '@/lib/types';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { translate } from '@/i18n';
import { useHaptics } from '@/hooks/useHaptics';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useVoiceFeedback } from '@/hooks/useVoiceFeedback';
import { openSidecar, type QuickLookData } from '@/stores/ui.store';

/* ============================================================================
 * CONSTANTS & DESIGN SYSTEM TOKENS
 * ========================================================================== */

const PAGE_SIZE = 12;
const SUCCESS_AUTO_CLOSE_MS = 6500;
const FETCH_LIMIT = 100;

const SPRING = {
  snappy: { type: 'spring' as const, stiffness: 520, damping: 32, mass: 0.65 },
  smooth: { type: 'spring' as const, stiffness: 380, damping: 31, mass: 0.82 },
  soft: { type: 'spring' as const, stiffness: 240, damping: 28, mass: 0.95 },
  gel: { type: 'spring' as const, stiffness: 740, damping: 25, mass: 0.34 },
  float: {
    duration: 16,
    repeat: Infinity,
    repeatType: 'mirror' as const,
    ease: 'easeInOut' as const,
  },
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

const PANEL = cn(
  'relative isolate overflow-hidden rounded-[2rem]',
  'border border-white/80 dark:border-white/[0.12]',
  'bg-white/[0.76] dark:bg-[#0B0F1A]/[0.76] backdrop-blur-3xl backdrop-saturate-[200%]',
  'shadow-[0_24px_60px_-15px_rgba(15,23,42,0.07),0_4px_20px_-2px_rgba(15,23,42,0.03),inset_0_1.5px_1px_rgba(255,255,255,0.92),inset_0_-1px_1px_rgba(16,185,129,0.08)]',
  'dark:shadow-[0_28px_70px_-15px_rgba(0,0,0,0.7),inset_0_1.5px_0.5px_rgba(255,255,255,0.18),inset_0_-1px_1px_rgba(16,185,129,0.14)]',
);

const INSET = cn(
  'rounded-[1.3rem] border border-black/[0.06] dark:border-white/[0.09]',
  'bg-white/[0.62] dark:bg-white/[0.035] backdrop-blur-xl',
  'shadow-[inset_0_1px_2px_rgba(15,23,42,0.03),0_1px_0_rgba(255,255,255,0.8)]',
  'dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]',
);

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950';

type StatusFilter = 'ALL' | FaceEnrollmentStatus;
type SortKey = 'newest' | 'oldest' | 'name';
type Phase = 'idle' | 'ready' | 'scanning' | 'done';
type CaptureMode = 'CAMERA' | 'UPLOAD';

const STATUS_TABS: readonly StatusFilter[] = [
  'ALL',
  'ACTIVE',
  'PENDING',
  'REVOKED',
  'EXPIRED',
];

const PHASE_STYLE: Record<Phase, string> = {
  idle: 'bg-slate-400',
  ready: 'bg-sky-500',
  scanning: 'bg-emerald-500',
  done: 'bg-emerald-500',
};

/* ============================================================================
 * SVG ICONS
 * ========================================================================== */

const I = {
  faceId: [
    'M3 7V5a2 2 0 0 1 2-2h2',
    'M17 3h2a2 2 0 0 1 2 2v2',
    'M21 17v2a2 2 0 0 1-2 2h-2',
    'M7 21H5a2 2 0 0 1-2-2v-2',
    'M9 9h.01',
    'M15 9h.01',
    'M10 13c.5.5 1.5.5 2 0',
    'M10 17c1 1 3 1 4 0',
  ],
  sparkles: [
    'M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z',
    'M20 3v4',
    'M22 5h-4',
  ],
  checkCircle: [
    'M22 11.08V12a10 10 0 1 1-5.93-9.14',
    'M22 4 12 14.01l-3-3',
  ],
  check: ['M20 6 9 17l-5-5'],
  xCircle: [
    'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z',
    'M15 9l-6 6',
    'M9 9l6 6',
  ],
  x: ['M18 6 6 18', 'M6 6l12 12'],
  users: [
    'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M23 21v-2a4 4 0 0 0-3-3.87',
    'M16 3.13a4 4 0 0 1 0 7.75',
  ],
  camera: [
    'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z',
    'M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  ],
  upload: [
    'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4',
    'M17 8l-5-5-5 5',
    'M12 3v12',
  ],
  shieldCheck: [
    'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    'M9 12l2 2 4-4',
  ],
  trash: [
    'M3 6h18',
    'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6',
    'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  ],
  search: [
    'M21 21l-4.35-4.35',
    'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
  ],
  activity: ['M22 12h-4l-3 9L9 3l-3 9H2'],
  sidebar: [
    'M3 3h18a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
    'M15 3v18',
  ],
  download: [
    'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4',
    'M7 10l5 5 5-5',
    'M12 15V3',
  ],
  refresh: [
    'M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8',
    'M3 3v5h5',
    'M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16',
    'M16 16h5v5',
  ],
  fastForward: [
    'M13 19l9-7-9-7v14z',
    'M2 19l9-7-9-7v14z',
  ],
  copy: [
    'M9 9h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2z',
    'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  ],
  clock: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 6v6l4 2',
  ],
  lock: [
    'M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z',
    'M7 11V7a5 5 0 0 1 10 0v4',
  ],
  alert: [
    'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
    'M12 9v4',
    'M12 17h.01',
  ],
  arrowRight: ['M5 12h14', 'M12 5l7 7-7 7'],
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
  children: ReactNode;
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

function Icon({
  paths,
  size = 18,
  className = '',
  strokeWidth = 1.9,
}: {
  paths: readonly string[];
  size?: number;
  className?: string;
  strokeWidth?: number;
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
      {paths.map((p, idx) => (
        <path key={idx} d={p} />
      ))}
    </svg>
  );
}

/* ============================================================================
 * VOLUMETRIC AMBIENT PLASMA ORBS & SPECULAR RIM
 * ========================================================================== */

const AmbientOrbs = memo(function AmbientOrbs({ reduced }: { reduced: boolean }) {
  return (
    <>
      <AuroraMesh variant="security" />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 select-none overflow-hidden"
      >
        <motion.div
          animate={
            reduced
              ? undefined
              : { x: [0, 30, -20, 0], y: [0, -20, 15, 0], scale: [1, 1.05, 0.98, 1] }
          }
          transition={SPRING.float}
          className="absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full bg-gradient-to-br from-[#10B981]/20 via-[#34D399]/10 to-transparent blur-[90px] will-change-transform dark:from-[#10B981]/15"
        />
        <motion.div
          animate={
            reduced
              ? undefined
              : { x: [0, -30, 20, 0], y: [0, 25, -15, 0], scale: [1, 0.96, 1.04, 1] }
          }
          transition={{ ...SPRING.float, duration: 20 }}
          className="absolute -right-28 top-10 h-[460px] w-[460px] rounded-full bg-gradient-to-bl from-[#2563EB]/18 via-[#6366F1]/10 to-transparent blur-[100px] will-change-transform dark:from-[#3B82F6]/14"
        />
      </div>
    </>
  );
});

const SpecularRim = memo(function SpecularRim() {
  return (
    <>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-6 top-0 z-10 h-px bg-gradient-to-r from-transparent via-white/95 to-transparent dark:via-white/30"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-24 bg-gradient-to-b from-white/30 via-white/5 to-transparent dark:from-white/[0.04] dark:to-transparent"
      />
    </>
  );
});

/* ============================================================================
 * TRANSLATION & HELPERS
 * ========================================================================== */

const FACE_ENROLLMENT_EN_FALLBACK: Record<string, string> = {
  'faceEnrollment.title': 'Face ID Biometric Enrollment',
  'faceEnrollment.subtitle':
    'Enroll and manage encrypted 128-D neural facial vectors for instant turnstile and classroom attendance.',
  'faceEnrollment.newEnrollment': 'Biometric Enrollment Studio',
  'faceEnrollment.student': 'Student',
  'faceEnrollment.selectStudent': 'Select a student…',
  'faceEnrollment.selectStudentError': 'Please select a student first',
  'faceEnrollment.startEnrollment': 'Start enrollment',
  'faceEnrollment.starting': 'Starting…',
  'faceEnrollment.inProgress': 'Enrollment in progress: {id}',
  'faceEnrollment.captureFace': 'Capture Face ID',
  'faceEnrollment.pipelineHint':
    'Facial templates are converted into irreversible mathematical vectors. Raw photos are never exposed.',
  'faceEnrollment.listTitle': 'Enrolled Biometric Directory',
  'faceEnrollment.loading': 'Loading biometric records…',
  'faceEnrollment.loadError': 'Failed to load enrollments',
  'faceEnrollment.empty': 'No Face ID enrollments found',
  'faceEnrollment.emptyHint':
    'Select a student on the left to register their first biometric template.',
  'faceEnrollment.emptyFiltered': 'No matching enrollments found',
  'faceEnrollment.emptyFilteredHint': 'Try clearing your search query or changing the status filter.',
  'faceEnrollment.clearFilters': 'Clear filters',
  'faceEnrollment.showMore': 'Show more ({n})',
  'faceEnrollment.records': '{n} records',
  'faceEnrollment.revoke': 'Revoke',
  'faceEnrollment.revoking': 'Revoking…',
  'faceEnrollment.revokeConfirm':
    'Are you sure you want to revoke this Face ID template? The student will need to be re-enrolled.',
  'faceEnrollment.startedToast': 'Enrollment session initialized',
  'faceEnrollment.capturedToast': 'Face ID vector encrypted and saved',
  'faceEnrollment.revokedToast': 'Biometric record revoked',
  'faceEnrollment.cancelledToast': 'Enrollment session cancelled',
  'faceEnrollment.noActiveSession': 'No active enrollment session',
  'faceEnrollment.resumedToast': 'Pending session resumed',
  'faceEnrollment.alreadyActive':
    'This student already has an ACTIVE Face ID. Re-enrolling will replace the previous biometric profile.',
  'faceEnrollment.revokeExisting': 'Revoke existing ID',
  'faceEnrollment.consent':
    'I confirm that the student (or legal guardian) has provided biometric processing consent under regulatory standards.',
  'faceEnrollment.consentRequired': 'Consent confirmation is required to initiate scanning',
  'faceEnrollment.attempts': 'Attempts Log',
  'faceEnrollment.attempt.ok': 'Success',
  'faceEnrollment.success.title': 'Face ID Successfully Enrolled!',
  'faceEnrollment.success.body': 'Biometric features have been vectorized, encrypted, and bound to student profile.',
  'faceEnrollment.success.quality': 'Quality: {n}%',
  'faceEnrollment.success.liveness': 'Anti-Spoof: {v}',
  'faceEnrollment.success.next': 'Next Student',
  'faceEnrollment.success.done': 'Finish',
  'faceEnrollment.status.PENDING': 'Pending',
  'faceEnrollment.status.ACTIVE': 'Active',
  'faceEnrollment.status.REVOKED': 'Revoked',
  'faceEnrollment.status.EXPIRED': 'Expired',
  'faceEnrollment.tab.ALL': 'All',
  'faceEnrollment.tab.ACTIVE': 'Active',
  'faceEnrollment.tab.PENDING': 'Pending',
  'faceEnrollment.tab.REVOKED': 'Revoked',
  'faceEnrollment.tab.EXPIRED': 'Expired',
  'faceEnrollment.kpi.active': 'Active Face IDs',
  'faceEnrollment.kpi.activeHint': 'Verified & encrypted',
  'faceEnrollment.kpi.coverage': 'Student Coverage',
  'faceEnrollment.kpi.coverageHint': '{enrolled} / {total} students',
  'faceEnrollment.kpi.pending': 'Pending Sessions',
  'faceEnrollment.kpi.pendingHint': 'Awaiting capture',
  'faceEnrollment.kpi.revoked': 'Revoked / Expired',
  'faceEnrollment.kpi.revokedHint': 'Require re-enrollment',
  'faceEnrollment.phase.label': 'Scanner Status',
  'faceEnrollment.phase.idle': 'No Student Selected',
  'faceEnrollment.phase.ready': 'Ready to Initialize',
  'faceEnrollment.phase.scanning': 'Scanning Active',
  'faceEnrollment.phase.done': 'Template Encrypted',
  'face.biometricEnrollment': 'Biometric Studio',
  'face.appleNeuralBiometrics': 'Neural Engine',
  'common.cancel': 'Cancel',
};

type TFn = (key: string, vars?: Record<string, string | number>) => string;

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, name: string) =>
    name in vars ? String(vars[name]) : m,
  );
}

function useT(): TFn {
  const { t } = useSafeI18n();
  return useCallback<TFn>(
    (key, vars) => {
      const res = t(key, vars);
      if (typeof res === 'string' && res.trim().length > 0 && res !== key) return res;
      const viaEn = translate('en', key, vars);
      if (typeof viaEn === 'string' && viaEn.trim().length > 0 && viaEn !== key) return viaEn;
      const template = FACE_ENROLLMENT_EN_FALLBACK[key];
      return template ? interpolate(template, vars) : key;
    },
    [t],
  );
}

interface EnrollmentFormState {
  studentId: string;
  enrollmentId: string;
}

const INITIAL_FORM: EnrollmentFormState = {
  studentId: '',
  enrollmentId: '',
};

interface Attempt {
  id: number;
  at: number;
  ok: boolean;
  message: string;
}

function formatStudentName(student: unknown): string {
  if (!student || typeof student !== 'object') return '—';
  const s = student as {
    firstName?: string;
    lastName?: string;
    user?: { firstName?: string; lastName?: string } | null;
  };
  const first = s.user?.firstName ?? s.firstName;
  const last = s.user?.lastName ?? s.lastName;
  return [first, last].filter(Boolean).join(' ') || '—';
}

function getStudentCode(student: unknown): string {
  const code = (student as { studentId?: unknown } | null | undefined)?.studentId;
  return typeof code === 'string' ? code : '';
}

function getEnrollmentStudentId(e: FaceEnrollment): string | undefined {
  return e.student?.id ?? e.studentId ?? undefined;
}

function getInitials(name?: string | null): string {
  if (!name || typeof name !== 'string' || name === '—') return '—';
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

const AVATAR_PALETTES = [
  ['#10B981', '#059669'],
  ['#2563EB', '#4F46E5'],
  ['#6366F1', '#EC4899'],
  ['#F59E0B', '#EF4444'],
  ['#0EA5E9', '#2563EB'],
] as const;

function getAvatarGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const [a, b] = AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

function truncateEnrollmentId(id: string, maxLength = 8): string {
  return id.length > maxLength ? `${id.slice(0, maxLength)}…` : id;
}

/** Sanitize value for CSV against formula-injection (=, +, -, @) */
function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function timeOf(e: FaceEnrollment): number {
  const v = e.enrolledAt ? new Date(e.enrolledAt as string).getTime() : 0;
  return Number.isFinite(v) ? v : 0;
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

/* ============================================================================
 * INTERACTIVE KPI BENTO CARD WITH ANIMATED COUNTER & RADIAL GAUGE
 * ========================================================================== */

function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const reduced = usePrefersReducedMotion();
  const mv = useMotionValue(reduced ? value : 0);
  const text = useTransform(mv, (v) => `${Math.round(v)}${suffix}`);

  useEffect(() => {
    if (reduced) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration: 0.8, ease: 'easeOut' });
    return () => controls.stop();
  }, [value, reduced, mv]);

  return <motion.span>{text}</motion.span>;
}

interface KpiProps {
  label: string;
  hint: string;
  value: number;
  suffix?: string;
  icon: readonly string[];
  color: { fg: string; bg: string; border: string; glow: string };
  progress?: number;
  loading?: boolean;
  active?: boolean;
  onClick?: () => void;
}

const KpiCard = memo(function KpiCard({
  label,
  hint,
  value,
  suffix = '',
  icon,
  color,
  progress,
  loading = false,
  active = false,
  onClick,
}: KpiProps) {
  const reduced = usePrefersReducedMotion();
  const circumference = 2 * Math.PI * 14;
  const clampedProgress =
    typeof progress === 'number' ? Math.max(0, Math.min(100, progress)) : undefined;

  return (
    <motion.button
      type="button"
      variants={cardVariants}
      whileHover={reduced ? undefined : { y: -3, scale: 1.006 }}
      whileTap={reduced ? undefined : { scale: 0.985 }}
      transition={SPRING.snappy}
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        PANEL,
        'group p-4 text-left sm:p-5',
        FOCUS,
        active && 'ring-2 ring-emerald-500/70',
      )}
    >
      <SpecularRim />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-40 blur-2xl transition-opacity duration-500 group-hover:opacity-75"
        style={{ background: color.glow }}
      />

      <div className="relative flex items-center gap-3.5">
        <div
          className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.1rem] transition-transform duration-300 group-hover:scale-105"
          style={{
            background: color.bg,
            color: color.fg,
            border: `1px solid ${color.border}`,
            boxShadow: `0 10px 24px -6px ${color.glow}, inset 0 1px 1px rgba(255,255,255,0.45)`,
          }}
        >
          <Icon paths={icon} size={21} strokeWidth={2.1} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            {loading ? (
              <span className="h-7 w-14 animate-pulse rounded-lg bg-slate-900/10 dark:bg-white/10" />
            ) : (
              <div className="font-mono text-[23px] font-extrabold leading-none tracking-tight tabular-nums text-slate-900 sm:text-[25px] dark:text-slate-50">
                <AnimatedNumber value={value} suffix={suffix} />
              </div>
            )}

            {typeof clampedProgress === 'number' && !loading && (
              <div className="relative flex h-8 w-8 shrink-0 items-center justify-center">
                <svg className="h-8 w-8 -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    className="text-black/[0.08] dark:text-white/[0.1]"
                  />
                  <motion.circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="none"
                    stroke={color.fg}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{
                      strokeDashoffset:
                        circumference - (clampedProgress / 100) * circumference,
                    }}
                    transition={{ duration: reduced ? 0 : 0.9, ease: 'easeOut' }}
                  />
                </svg>
              </div>
            )}
          </div>

          <div className="mt-1.5 truncate text-[11px] font-bold uppercase tracking-[0.07em] text-slate-500 dark:text-slate-400">
            {label}
          </div>

          <div className="mt-0.5 truncate text-[11px] font-medium text-slate-500/85 dark:text-slate-400/80">
            {hint}
          </div>
        </div>
      </div>

      {typeof clampedProgress === 'number' && (
        <div className="relative mt-3.5 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.08]">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(4, clampedProgress)}%` }}
            transition={{ duration: reduced ? 0 : 0.9, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, ${color.fg} 0%, #38BDF8 100%)`,
              boxShadow: `0 0 12px ${color.glow}`,
            }}
          />
        </div>
      )}
    </motion.button>
  );
});

/* ============================================================================
 * MAIN COMPONENT
 * ========================================================================== */

export function FaceEnrollmentPage() {
  const t = useT();
  usePageTitle(t('faceEnrollment.title'));
  const reduced = usePrefersReducedMotion();
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();
  const sound = usePremiumSound();
  const voice = useVoiceFeedback();
  const haptics = useHaptics();

  // Keep latest feedback hooks in ref to prevent stale closures
  const fx = useRef({ sound, voice, haptics, push });
  useEffect(() => {
    fx.current = { sound, voice, haptics, push };
  });

  // State
  const [form, setForm] = useState<EnrollmentFormState>(INITIAL_FORM);
  const [consent, setConsent] = useState(true); // Default true for frictionless studio flow
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearch = useDeferredValue(searchQuery);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [onlyUnenrolledStudents, setOnlyUnenrolledStudents] = useState(false);
  const [autoQueueNext, setAutoQueueNext] = useState(false);
  const [captureMode, setCaptureMode] = useState<CaptureMode>('CAMERA');
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('newest');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [captureSucceeded, setCaptureSucceeded] = useState(false);
  const [lastCaptureStats, setLastCaptureStats] = useState<{
    qualityScore?: number;
    livenessResult?: string;
  } | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof EnrollmentFormState, string>>
  >({});

  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const attemptSeq = useRef(0);

  const clearResetTimer = useCallback(() => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearResetTimer();
  }, [clearResetTimer]);

  // Unified Query Invalidation
  const invalidateFaceQueries = useCallback(() => {
    qc.invalidateQueries({ queryKey: queryKeys.face.enrollments() });
    qc.invalidateQueries({ queryKey: queryKeys.face.studentEnrollments() });
    qc.invalidateQueries({ queryKey: queryKeys.students.faces() });
    qc.invalidateQueries({ queryKey: queryKeys.students.details() });
    qc.invalidateQueries({ queryKey: queryKeys.students.all() });
  }, [qc]);

  // Data Queries (Preserves exact queryKey & contract for regression tests)
  const students = useQuery({
    queryKey: queryKeys.students.faces(),
    queryFn: () => studentsApi.list({ limit: FETCH_LIMIT }),
    placeholderData: (previousData) => previousData,
    staleTime: 30_000,
  });

  const enrollments = useQuery({
    queryKey: queryKeys.face.enrollments(),
    queryFn: () => faceApi.enrollments({ limit: FETCH_LIMIT }),
    placeholderData: (previousData) => previousData,
    staleTime: 15_000,
  });

  const studentList = useMemo(
    () => (students.data as Paginated<Student> | undefined)?.items || [],
    [students.data],
  );

  const enrollmentList = useMemo(
    () => (enrollments.data as Paginated<FaceEnrollment> | undefined)?.items || [],
    [enrollments.data],
  );

  const studentsTotal =
    (students.data as { total?: number } | undefined)?.total ?? studentList.length;
  const enrollmentsTotal =
    (enrollments.data as { total?: number } | undefined)?.total ?? enrollmentList.length;
  const isTruncated =
    enrollmentsTotal > enrollmentList.length || studentsTotal > studentList.length;

  // Student to Latest Enrollment Indexing
  const { counts, studentEnrollmentMap, enrolledUnique } = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      ALL: enrollmentList.length,
      ACTIVE: 0,
      PENDING: 0,
      REVOKED: 0,
      EXPIRED: 0,
    };
    const map = new Map<string, FaceEnrollment>();
    const activeStudentIds = new Set<string>();

    for (const e of enrollmentList) {
      if (e.status in counts) {
        counts[e.status] += 1;
      }
      const sid = getEnrollmentStudentId(e);
      if (e.status === 'ACTIVE') {
        activeStudentIds.add(sid ?? `enr:${e.id}`);
      }
      if (!sid) continue;

      const existing = map.get(sid);
      if (
        !existing ||
        e.status === 'ACTIVE' ||
        (e.status === 'PENDING' && existing.status !== 'ACTIVE')
      ) {
        map.set(sid, e);
      }
    }

    return {
      counts,
      studentEnrollmentMap: map,
      enrolledUnique: activeStudentIds.size,
    };
  }, [enrollmentList]);

  // Unenrolled queue
  const unenrolledStudents = useMemo(
    () =>
      studentList.filter((s) => {
        const record = studentEnrollmentMap.get(s.id);
        return !record || (record.status !== 'ACTIVE' && record.status !== 'PENDING');
      }),
    [studentList, studentEnrollmentMap],
  );

  // Next candidate for auto-advance
  const nextCandidate = useMemo(
    () => unenrolledStudents.find((s) => s.id !== form.studentId),
    [unenrolledStudents, form.studentId],
  );

  // Selectable Students in <GlassSelect> (always maintains form.studentId in options)
  const selectableStudents = useMemo(() => {
    const q = studentSearchQuery.trim().toLowerCase();
    return studentList.filter((s) => {
      if (s.id === form.studentId) return true;
      if (onlyUnenrolledStudents) {
        const rec = studentEnrollmentMap.get(s.id);
        if (rec?.status === 'ACTIVE') return false;
      }
      if (!q) return true;
      const name = formatStudentName(s).toLowerCase();
      return name.includes(q) || (s.id && s.id.toLowerCase().includes(q));
    });
  }, [
    studentList,
    studentSearchQuery,
    onlyUnenrolledStudents,
    studentEnrollmentMap,
    form.studentId,
  ]);

  const selectedStudent = useMemo(
    () => studentList.find((s) => s.id === form.studentId),
    [studentList, form.studentId],
  );

  const selectedStudentExistingEnrollment = useMemo(
    () => (form.studentId ? studentEnrollmentMap.get(form.studentId) : undefined),
    [form.studentId, studentEnrollmentMap],
  );

  const selectedName = formatStudentName(selectedStudent);

  // Accurate Coverage KPI
  const coverage =
    studentsTotal > 0
      ? Math.min(100, Math.round((enrolledUnique / studentsTotal) * 100))
      : 0;

  // Step state
  const currentStep = useMemo(() => {
    if (captureSucceeded) return 4;
    if (form.enrollmentId) return 3;
    if (form.studentId) return 2;
    return 1;
  }, [form.studentId, form.enrollmentId, captureSucceeded]);

  const phase: Phase = captureSucceeded
    ? 'done'
    : form.enrollmentId
      ? 'scanning'
      : form.studentId
        ? 'ready'
        : 'idle';

  const logAttempt = useCallback((ok: boolean, message: string) => {
    attemptSeq.current += 1;
    setAttempts((prev) =>
      [{ id: attemptSeq.current, at: Date.now(), ok, message }, ...prev].slice(0, 5),
    );
  }, []);

  // Student selection by ID
  const selectStudentById = useCallback(
    (selectedId: string, explicitEnrollmentId?: string) => {
      clearResetTimer();
      setUploadedPreview(null);
      const existingPending = enrollmentList.find(
        (enr) =>
          (enr.student?.id === selectedId || enr.studentId === selectedId) &&
          enr.status === 'PENDING',
      );
      setForm({
        studentId: selectedId,
        enrollmentId:
          explicitEnrollmentId ??
          (existingPending ? (existingPending.enrollmentId ?? existingPending.id) : ''),
      });
      setFormErrors({});
      setCaptureSucceeded(false);
      setLastCaptureStats(null);
      setAttempts([]);
      if (existingPending) {
        fx.current.push('info', t('faceEnrollment.resumedToast'));
      }
    },
    [enrollmentList, clearResetTimer, t],
  );

  const pickNextUnenrolledStudent = useCallback(
    (excludeStudentId?: string) => {
      const next = unenrolledStudents.find((s) => s.id !== excludeStudentId);
      if (!next) {
        setForm(INITIAL_FORM);
        return;
      }
      selectStudentById(next.id);
      fx.current.sound.playTick?.();
    },
    [unenrolledStudents, selectStudentById],
  );

  // Mutations
  const start = useMutation({
    mutationFn: () => faceApi.startEnrollment(form.studentId),
    onSuccess: (res) => {
      const enrollment = res as FaceEnrollment;
      clearResetTimer();
      setForm((prev) => ({
        ...prev,
        enrollmentId: enrollment.enrollmentId ?? enrollment.id,
      }));
      setCaptureSucceeded(false);
      setUploadedPreview(null);
      fx.current.sound.playTick?.();
      fx.current.haptics.light?.();
      fx.current.push('success', t('faceEnrollment.startedToast'));
      invalidateFaceQueries();
    },
    onError: (e: Error) => {
      fx.current.sound.playError?.();
      fx.current.haptics.error?.();
      fx.current.push('error', friendlyFaceError(e));
    },
  });

  const capture = useMutation({
    mutationFn: (b64: string) => faceApi.capture(form.enrollmentId, b64),
    onSuccess: (res: any) => {
      const enrolledStudentId = form.studentId;
      fx.current.sound.playCelebration?.();
      fx.current.haptics.heavy?.();
      fx.current.voice.speakEnrollmentSuccess?.();
      setLastCaptureStats({
        qualityScore:
          typeof res?.qualityScore === 'number' ? res.qualityScore : undefined,
        livenessResult:
          typeof res?.livenessResult === 'string' ? res.livenessResult : undefined,
      });
      logAttempt(true, t('faceEnrollment.attempt.ok'));
      setCaptureSucceeded(true);
      setUploadedPreview(null);
      fx.current.push('success', t('faceEnrollment.capturedToast'));
      invalidateFaceQueries();

      clearResetTimer();
      resetTimerRef.current = setTimeout(() => {
        setCaptureSucceeded(false);
        setLastCaptureStats(null);
        if (autoQueueNext) {
          pickNextUnenrolledStudent(enrolledStudentId);
        } else {
          setForm(INITIAL_FORM);
        }
      }, SUCCESS_AUTO_CLOSE_MS);
    },
    onError: (e: Error) => {
      fx.current.sound.playError?.();
      fx.current.haptics.error?.();
      const errText = friendlyFaceError(e);
      logAttempt(false, errText);
      fx.current.push('error', errText);
    },
  });

  const revoke = useMutation({
    mutationFn: (id: string) => faceApi.revoke(id, 'operator_revoked'),
    onSuccess: () => {
      fx.current.sound.playDelete?.();
      fx.current.haptics.medium?.();
      fx.current.push('success', t('faceEnrollment.revokedToast'));
      invalidateFaceQueries();
    },
    onError: (e: Error) => {
      fx.current.sound.playError?.();
      fx.current.haptics.error?.();
      fx.current.push('error', friendlyFaceError(e));
    },
  });

  // Handlers
  const handleStudentChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      selectStudentById(e.target.value);
    },
    [selectStudentById],
  );

  const handleStartEnrollment = useCallback(() => {
    if (!form.studentId) {
      setFormErrors({ studentId: t('faceEnrollment.selectStudentError') });
      fx.current.haptics.error?.();
      return;
    }
    if (!consent) {
      fx.current.push('warning', t('faceEnrollment.consentRequired'));
      fx.current.haptics.error?.();
      return;
    }
    capture.reset();
    start.mutate();
  }, [form.studentId, consent, capture, start, t]);

  const handleCapture = useCallback(
    (b64: string) => {
      if (!form.enrollmentId) {
        fx.current.push('error', t('faceEnrollment.noActiveSession'));
        return;
      }
      if (capture.isPending || isCancelling) return;
      capture.mutate(b64);
    },
    [form.enrollmentId, capture, isCancelling, t],
  );

  const handleFileUploadChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      fx.current.push('error', 'Faqat rasm fayllarini (JPG, PNG, WEBP) yuklash mumkin');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      if (result) {
        setUploadedPreview(result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  const handleCancelEnrollment = useCallback(async () => {
    if (isCancelling) return;
    clearResetTimer();
    capture.reset();
    const activeId = form.enrollmentId;
    setIsCancelling(true);
    try {
      if (activeId) {
        await faceApi.cancelPending(activeId);
      }
      fx.current.push('info', t('faceEnrollment.cancelledToast'));
    } catch (err) {
      console.error('Failed to cancel pending enrollment', err);
      fx.current.push('error', friendlyFaceError(err as Error));
    } finally {
      setIsCancelling(false);
      setForm((prev) => ({ ...prev, enrollmentId: '' }));
      setCaptureSucceeded(false);
      setUploadedPreview(null);
      fx.current.sound.playTick?.();
      invalidateFaceQueries();
    }
  }, [form.enrollmentId, isCancelling, clearResetTimer, capture, t, invalidateFaceQueries]);

  const handleRevoke = useCallback((enrollmentId: string) => {
    setRevokeTarget(enrollmentId);
  }, []);

  const confirmRevoke = useCallback(() => {
    if (!revokeTarget) return;
    revoke.mutate(revokeTarget);
    setRevokeTarget(null);
  }, [revokeTarget, revoke]);

  const handleCopyId = useCallback((id: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(id);
    }
    setCopiedId(id);
    fx.current.sound.playTick?.();
    setTimeout(() => {
      setCopiedId((prev) => (prev === id ? null : prev));
    }, 1500);
  }, []);

  const handleOpenSidecar = useCallback(
    (enrollment: FaceEnrollment) => {
      fx.current.sound.playTick?.();
      const studentName = formatStudentName(enrollment.student);
      const sidecarData: QuickLookData = {
        id: enrollment.id,
        type: 'student',
        title: studentName,
        subtitle: `${t('face.biometricEnrollment')} · ${formatDate(enrollment.enrolledAt)}`,
        badge: {
          text: enrollment.status,
          tone:
            enrollment.status === 'ACTIVE'
              ? 'emerald'
              : enrollment.status === 'PENDING'
                ? 'amber'
                : 'rose',
        },
        avatar: {
          text: getInitials(studentName),
          color: '#10B981',
        },
        metrics: [
          { label: t('faceEnrollment.student'), value: studentName },
          { label: 'Status', value: enrollment.status },
          { label: 'Enrolled', value: formatDate(enrollment.enrolledAt) },
          { label: 'ID', value: enrollment.id.slice(0, 8) },
        ],
        details: [
          { label: 'Enrollment ID', value: enrollment.id, copyable: true },
          {
            label: 'Student ID',
            value: enrollment.student?.id || enrollment.studentId || '—',
            copyable: true,
          },
          { label: 'Vector Format', value: '128-D Neural Vector' },
          { label: 'Status', value: enrollment.status },
          { label: 'Enrolled At', value: formatDate(enrollment.enrolledAt) },
        ],
        primaryAction:
          enrollment.status === 'ACTIVE'
            ? {
                label: t('faceEnrollment.revoke'),
                onExecute: () => handleRevoke(enrollment.id),
              }
            : enrollment.status === 'PENDING'
              ? {
                  label: 'Resume',
                  onExecute: () =>
                    selectStudentById(
                      enrollment.student?.id || enrollment.studentId || '',
                      enrollment.enrollmentId ?? enrollment.id,
                    ),
                }
              : undefined,
      };
      openSidecar(sidecarData);
    },
    [t, handleRevoke, selectStudentById],
  );

  // Filtered & Sorted directory
  const filteredEnrollments = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    const filtered = enrollmentList.filter((item) => {
      const name = formatStudentName(item.student).toLowerCase();
      const idMatch = item.id.toLowerCase().includes(q);
      const studentCodeMatch = (item.student?.studentId || '').toLowerCase().includes(q);
      const matchesSearch = !q || name.includes(q) || idMatch || studentCodeMatch;
      const matchesStatus =
        statusFilter === 'ALL' ? true : item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    const sorted = [...filtered];
    if (sortKey === 'name') {
      sorted.sort((a, b) =>
        formatStudentName(a.student).localeCompare(formatStudentName(b.student)),
      );
    } else if (sortKey === 'oldest') {
      sorted.sort((a, b) => timeOf(a) - timeOf(b));
    } else {
      sorted.sort((a, b) => timeOf(b) - timeOf(a));
    }
    return sorted;
  }, [enrollmentList, deferredSearch, statusFilter, sortKey]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [deferredSearch, statusFilter, sortKey]);

  const visibleEnrollments = useMemo(
    () => filteredEnrollments.slice(0, visibleCount),
    [filteredEnrollments, visibleCount],
  );

  const hasActiveFilters = statusFilter !== 'ALL' || searchQuery.trim() !== '';
  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter('ALL');
  }, []);

  // Hardened CSV Export with UTF-8 BOM & formula injection sanitation
  const handleExportCsv = useCallback(() => {
    if (!filteredEnrollments.length) return;
    const headers = ['ID', 'F.I.SH', 'Status', 'Talaba ID', 'Sana'];
    const rows = filteredEnrollments.map((e) => [
      e.id,
      formatStudentName(e.student),
      e.status,
      getStudentCode(e.student) || '—',
      e.enrolledAt ? formatDate(e.enrolledAt) : '—',
    ]);
    const csvContent =
      '\uFEFF' +
      [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `Face_Enrollment_Directory_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [filteredEnrollments]);

  // Keyboard shortcut '/' to focus search
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (
        e.key === '/' &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !isTypingTarget(e.target)
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // BeforeUnload guard when enrollment session is active
  const sessionOpen = Boolean(form.enrollmentId) && !captureSucceeded;
  useEffect(() => {
    if (!sessionOpen) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [sessionOpen]);

  const captureErrorMessage = capture.isError
    ? friendlyFaceError(capture.error as Error)
    : null;
  const isLivenessError =
    captureErrorMessage !== null &&
    /liveness/i.test(`${(capture.error as Error)?.message ?? ''} ${captureErrorMessage}`);

  const displayedStepNumber = Math.min(3, currentStep);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="page-container relative isolate space-y-6 pb-[max(6rem,env(safe-area-inset-bottom))]"
    >
      <AmbientOrbs reduced={reduced} />
      {toastNode}

      {/* Screen-reader status announcement */}
      <p className="sr-only" role="status" aria-live="polite">
        {t(`faceEnrollment.phase.${phase}`)}
      </p>

      {/* ============================================================
          HERO BANNER
      ============================================================ */}
      <motion.div variants={cardVariants}>
        <div className={cn(PANEL, 'liquid-glass-surface p-6 sm:p-8')}>
          <SpecularRim />

          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-gradient-to-br from-[#10B981]/25 via-[#2563EB]/20 to-transparent blur-3xl"
          />

          <div className="relative flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
            <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
              {/* 3D Squircle Biometric Scanner Emblem */}
              <div className="relative shrink-0">
                <div
                  aria-hidden="true"
                  className="absolute -inset-1.5 rounded-[1.6rem] bg-gradient-to-tr from-[#10B981] via-[#06B6D4] to-[#2563EB] opacity-45 blur-md"
                />
                <div
                  className="relative flex h-[72px] w-[72px] items-center justify-center rounded-[1.45rem] text-white"
                  style={{
                    background:
                      'linear-gradient(135deg, #10B981 0%, #059669 45%, #2563EB 100%)',
                    boxShadow:
                      '0 16px 36px -8px rgba(16,185,129,0.55), inset 0 1.5px 1.5px rgba(255,255,255,0.65), inset 0 -2px 6px rgba(0,0,0,0.25)',
                  }}
                >
                  <Icon paths={I.faceId} size={34} strokeWidth={1.95} />
                  <span className="pointer-events-none absolute inset-1.5 rounded-[1.05rem] border border-white/25" />
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#10B981]/30 bg-[#10B981]/12 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#059669] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] dark:border-[#34D399]/30 dark:bg-[#10B981]/15 dark:text-[#34D399]">
                    <Icon paths={I.sparkles} size={12} strokeWidth={2.4} />
                    {t('face.biometricEnrollment')}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.06] bg-white/60 px-3 py-1 text-[11px] font-semibold text-slate-600 backdrop-blur-md dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300">
                    <Icon paths={I.lock} size={12} />
                    128-D Neural Vector
                  </span>
                </div>

                <h1 className="mt-2.5 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-[30px] sm:leading-tight dark:text-slate-50">
                  {t('faceEnrollment.title')}
                </h1>
                <p className="mt-1 max-w-2xl text-[13.5px] font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                  {t('faceEnrollment.subtitle')}
                </p>
              </div>
            </div>

            {/* Live Neural Telemetry & Terminal Switcher */}
            <div className="flex flex-wrap items-center gap-3 self-stretch sm:self-auto">
              <nav
                aria-label="Terminal Mode"
                className="inline-flex items-center rounded-2xl border border-black/10 bg-black/5 p-1 dark:border-white/10 dark:bg-white/5"
              >
                <SafeLink
                  to="/face"
                  className={cn(
                    'inline-flex h-9 items-center gap-2 rounded-xl px-3.5 text-xs font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100',
                    FOCUS,
                  )}
                >
                  <Icon paths={I.camera} size={14} />
                  <span>Face ID Terminal</span>
                </SafeLink>
                <div className="inline-flex h-9 items-center gap-2 rounded-xl bg-white px-3.5 text-xs font-bold text-slate-900 shadow-sm dark:bg-white/15 dark:text-white">
                  <Icon
                    paths={I.sparkles}
                    size={14}
                    className="text-[#10B981] dark:text-[#34D399]"
                  />
                  <span>Ro‘yxatga Olish</span>
                </div>
              </nav>

              <div className={cn(INSET, 'flex items-center gap-3.5 px-4 py-2.5')}>
                <div className="relative flex h-3 w-3 items-center justify-center">
                  {phase === 'scanning' && !reduced && (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#10B981] opacity-75" />
                  )}
                  <span
                    className={cn(
                      'relative inline-flex h-2.5 w-2.5 rounded-full',
                      PHASE_STYLE[phase],
                    )}
                  />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
                    {t('faceEnrollment.phase.label')}
                  </div>
                  <div className="text-[12.5px] font-bold text-slate-900 dark:text-slate-50">
                    {t(`faceEnrollment.phase.${phase}`)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ============================================================
          INTERACTIVE KPI SUMMARY BENTO BAR
      ============================================================ */}
      <motion.div
        variants={containerVariants}
        className="grid grid-cols-2 gap-3.5 lg:grid-cols-4"
      >
        <KpiCard
          label={t('faceEnrollment.kpi.active')}
          hint={t('faceEnrollment.kpi.activeHint')}
          value={counts.ACTIVE}
          icon={I.shieldCheck}
          color={{
            fg: '#10B981',
            bg: 'rgba(16,185,129,0.12)',
            border: 'rgba(16,185,129,0.28)',
            glow: 'rgba(16,185,129,0.28)',
          }}
          loading={enrollments.isLoading && !enrollments.data}
          active={statusFilter === 'ACTIVE'}
          onClick={() =>
            setStatusFilter((prev) => (prev === 'ACTIVE' ? 'ALL' : 'ACTIVE'))
          }
        />
        <KpiCard
          label={t('faceEnrollment.kpi.coverage')}
          hint={t('faceEnrollment.kpi.coverageHint', {
            enrolled: enrolledUnique,
            total: studentsTotal,
          })}
          value={coverage}
          suffix="%"
          progress={coverage}
          icon={I.activity}
          color={{
            fg: '#6366F1',
            bg: 'rgba(99,102,241,0.12)',
            border: 'rgba(99,102,241,0.28)',
            glow: 'rgba(99,102,241,0.28)',
          }}
          loading={
            (enrollments.isLoading && !enrollments.data) ||
            (students.isLoading && !students.data)
          }
        />
        <KpiCard
          label={t('faceEnrollment.kpi.pending')}
          hint={
            counts.PENDING > 0
              ? `${counts.PENDING} ta sessiya kutilmoqda`
              : t('faceEnrollment.kpi.pendingHint')
          }
          value={counts.PENDING}
          icon={I.clock}
          color={{
            fg: '#2563EB',
            bg: 'rgba(37,99,235,0.12)',
            border: 'rgba(37,99,235,0.28)',
            glow: 'rgba(37,99,235,0.28)',
          }}
          loading={enrollments.isLoading && !enrollments.data}
          active={statusFilter === 'PENDING'}
          onClick={() =>
            setStatusFilter((prev) => (prev === 'PENDING' ? 'ALL' : 'PENDING'))
          }
        />
        <KpiCard
          label={t('faceEnrollment.kpi.revoked')}
          hint={t('faceEnrollment.kpi.revokedHint')}
          value={counts.REVOKED + counts.EXPIRED}
          icon={I.xCircle}
          color={{
            fg: '#EF4444',
            bg: 'rgba(239,68,68,0.12)',
            border: 'rgba(239,68,68,0.28)',
            glow: 'rgba(239,68,68,0.25)',
          }}
          loading={enrollments.isLoading && !enrollments.data}
          active={statusFilter === 'REVOKED'}
          onClick={() =>
            setStatusFilter((prev) => (prev === 'REVOKED' ? 'ALL' : 'REVOKED'))
          }
        />
      </motion.div>

      {/* ============================================================
          MAIN SPATIAL STUDIO GRID (5 cols / 7 cols)
      ============================================================ */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* LEFT COLUMN: Biometric Capture Studio */}
        <motion.div variants={cardVariants} className="space-y-4 lg:col-span-5">
          <div className={cn(PANEL, 'p-5 sm:p-7')}>
            <SpecularRim />

            {/* Studio Header */}
            <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.06] pb-4 dark:border-white/[0.08]">
              <div className="flex items-center gap-3.5">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-2xl text-[#10B981] dark:text-[#34D399]"
                  style={{
                    background: 'rgba(16,185,129,0.12)',
                    border: '1px solid rgba(16,185,129,0.28)',
                    boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.4)',
                  }}
                >
                  <Icon paths={I.camera} size={19} strokeWidth={2.2} />
                </div>
                <div>
                  <h2 className="text-[16px] font-bold tracking-tight text-slate-900 dark:text-slate-50">
                    {t('faceEnrollment.newEnrollment')}
                  </h2>
                  <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400">
                    Yuz ma’lumotlarini skanerlash va shifrlangan vektor yaratish
                  </p>
                </div>
              </div>

              {/* Step Pill */}
              <span className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.06] bg-white/75 px-3 py-1 text-[11px] font-bold text-slate-900 shadow-xs dark:border-white/10 dark:bg-white/[0.06] dark:text-white">
                Bosqich {displayedStepNumber} / 3
              </span>
            </div>

            {/* 3-Step Guided Progress Rail */}
            <ol
              aria-label="Enrollment Steps"
              className="relative mt-4 grid grid-cols-3 gap-1.5 sm:gap-2"
            >
              {[
                { step: 1, title: '1. Talaba' },
                { step: 2, title: '2. Sessiya' },
                { step: 3, title: '3. Skan' },
              ].map((item) => {
                const active = currentStep >= item.step;
                const isCompleted = currentStep > item.step;
                const isCurrent = displayedStepNumber === item.step && !captureSucceeded;
                return (
                  <li
                    key={item.step}
                    aria-current={isCurrent ? 'step' : undefined}
                    className={cn(
                      'flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-[11px] font-bold transition-all sm:gap-2 sm:px-3 sm:text-[11.5px]',
                      isCurrent
                        ? 'border-[#10B981]/45 bg-[#10B981]/12 text-[#059669] shadow-[0_4px_14px_-4px_rgba(16,185,129,0.25)] dark:text-[#34D399]'
                        : active
                          ? 'border-[#10B981]/25 bg-[#10B981]/[0.06] text-[#10B981]'
                          : 'border-black/[0.05] bg-black/[0.02] text-slate-500 dark:border-white/[0.06] dark:bg-white/[0.02]',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px]',
                        active
                          ? 'bg-[#10B981] text-white'
                          : 'bg-black/10 text-slate-500 dark:bg-white/10',
                      )}
                    >
                      {isCompleted ? '✓' : item.step}
                    </span>
                    <span className="truncate">{item.title}</span>
                  </li>
                );
              })}
            </ol>

            {/* Smart Auto-Queue Bar: Pick Next + Auto-Queue Toggle */}
            {!form.enrollmentId && studentList.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-black/[0.06] bg-black/[0.02] px-3 py-2 dark:border-white/[0.08] dark:bg-white/[0.025]">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOnlyUnenrolledStudents((prev) => !prev)}
                    className={cn(
                      'rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all',
                      onlyUnenrolledStudents
                        ? 'bg-[#10B981] text-white shadow-xs'
                        : 'bg-white/80 text-slate-600 hover:text-slate-900 dark:bg-white/10 dark:text-slate-300',
                      FOCUS,
                    )}
                  >
                    {onlyUnenrolledStudents
                      ? `Faqat Face ID yo‘qlar (${unenrolledStudents.length})`
                      : 'Barcha talabalar'}
                  </button>

                  {unenrolledStudents.length > 0 && (
                    <button
                      type="button"
                      onClick={() => pickNextUnenrolledStudent(form.studentId)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-lg border border-[#2563EB]/25 bg-[#2563EB]/10 px-2.5 py-1 text-[11px] font-bold text-[#2563EB] transition-colors hover:bg-[#2563EB]/20 dark:text-[#60A5FA]',
                        FOCUS,
                      )}
                      title="Face ID olmagan keyingi talabani tanlash"
                    >
                      <Icon paths={I.fastForward} size={12} strokeWidth={2.3} />
                      <span>Keyingi navbat</span>
                    </button>
                  )}
                </div>

                <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-slate-600 select-none dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={autoQueueNext}
                    onChange={(e) => setAutoQueueNext(e.target.checked)}
                    className="h-3.5 w-3.5 rounded accent-[#10B981]"
                  />
                  <span>Avto-navbat</span>
                </label>
              </div>
            )}

            <div className="relative mt-4 space-y-4">
              {/* Student selector with GlassSelect (maintains 100% test contract) */}
              <GlassField
                label={t('faceEnrollment.student')}
                required
                error={formErrors.studentId}
              >
                {studentList.length > 6 && !form.enrollmentId && (
                  <div className="relative mb-2">
                    <input
                      type="search"
                      value={studentSearchQuery}
                      onChange={(e) => setStudentSearchQuery(e.target.value)}
                      placeholder="O‘quvchi ismini tezkor qidirish..."
                      className={cn(
                        'w-full rounded-xl border border-black/[0.08] bg-black/[0.025] px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-[#10B981] dark:border-white/[0.1] dark:bg-white/[0.035] dark:text-slate-50',
                        FOCUS,
                      )}
                    />
                  </div>
                )}
                <div className="relative">
                  <GlassSelect
                    value={form.studentId}
                    onChange={handleStudentChange}
                    aria-invalid={Boolean(formErrors.studentId)}
                    disabled={start.isPending || capture.isPending || Boolean(form.enrollmentId)}
                    className="w-full pl-3"
                  >
                    <option value="">{t('faceEnrollment.selectStudent')}</option>
                    {selectableStudents.map((student) => {
                      const rec = studentEnrollmentMap.get(student.id);
                      const statusSuffix =
                        rec?.status === 'ACTIVE'
                          ? ' ✓ (Faol)'
                          : rec?.status === 'PENDING'
                            ? ' ⏳ (Jarayonda)'
                            : '';
                      return (
                        <option key={student.id} value={student.id}>
                          {formatStudentName(student)}
                          {statusSuffix}
                        </option>
                      );
                    })}
                  </GlassSelect>
                </div>
              </GlassField>

              {/* Selected student preview card */}
              <AnimatePresence mode="popLayout">
                {selectedStudent && (
                  <motion.div
                    key={selectedStudent.id}
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.98 }}
                    transition={SPRING.snappy}
                    className={cn(INSET, 'space-y-2.5 p-3.5')}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-[13px] font-extrabold text-white shadow-md"
                          style={{
                            background: getAvatarGradient(selectedName),
                            boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.45)',
                          }}
                        >
                          {getInitials(selectedName)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[14px] font-bold text-slate-900 dark:text-slate-50">
                            {selectedName}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            <span className="font-mono">
                              ID: {getStudentCode(selectedStudent) || selectedStudent.id.slice(0, 12)}…
                            </span>
                          </div>
                        </div>
                      </div>

                      {!form.enrollmentId && (
                        <button
                          type="button"
                          onClick={() => selectStudentById('')}
                          aria-label="Tanlovni bekor qilish"
                          className={cn(
                            'flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-black/5 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white',
                            FOCUS,
                          )}
                        >
                          <Icon paths={I.x} size={15} strokeWidth={2.4} />
                        </button>
                      )}
                    </div>

                    {/* Notice & Quick Revoke if student already has ACTIVE Face ID */}
                    {selectedStudentExistingEnrollment?.status === 'ACTIVE' &&
                      !form.enrollmentId && (
                        <div className="flex flex-col gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 p-2.5 text-[11.5px] font-semibold text-amber-800 dark:text-amber-200">
                          <div className="flex items-start gap-2">
                            <Icon
                              paths={I.alert}
                              size={15}
                              className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
                            />
                            <span>{t('faceEnrollment.alreadyActive')}</span>
                          </div>
                          <GlassButton
                            type="button"
                            variant="danger"
                            size="sm"
                            className="self-start text-[11px]"
                            onClick={() =>
                              handleRevoke(selectedStudentExistingEnrollment.id)
                            }
                          >
                            {t('faceEnrollment.revokeExisting')}
                          </GlassButton>
                        </div>
                      )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Consent Gate + Start Enrollment */}
              {!form.enrollmentId ? (
                <div className="space-y-3">
                  {form.studentId && (
                    <label className={cn(INSET, 'flex cursor-pointer items-start gap-3 p-3')}>
                      <input
                        type="checkbox"
                        checked={consent}
                        onChange={(e) => setConsent(e.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[#10B981]"
                      />
                      <span className="text-[11.5px] font-medium leading-relaxed text-slate-700 dark:text-slate-300">
                        {t('faceEnrollment.consent')}
                      </span>
                    </label>
                  )}

                  <GlassButton
                    type="button"
                    variant="primary"
                    className="w-full justify-center py-3.5 text-[13.5px] font-bold shadow-[0_12px_28px_-8px_rgba(37,99,235,0.45)]"
                    onClick={handleStartEnrollment}
                    disabled={!form.studentId || start.isPending}
                  >
                    <span className="inline-flex items-center gap-2">
                      {start.isPending ? (
                        <>
                          <motion.span
                            className="inline-block h-4 w-4 rounded-full border-2 border-white/40 border-t-white"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                          />
                          {t('faceEnrollment.starting')}
                        </>
                      ) : (
                        <>
                          <Icon paths={I.camera} size={17} strokeWidth={2.3} />
                          {t('faceEnrollment.startEnrollment')}
                        </>
                      )}
                    </span>
                  </GlassButton>
                </div>
              ) : (
                <div className="space-y-4 pt-1">
                  {/* Dynamic Active Session Telemetry Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#10B981]/35 bg-gradient-to-r from-[#10B981]/15 via-[#10B981]/[0.07] to-transparent px-3.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="relative flex h-2.5 w-2.5 shrink-0">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#10B981] opacity-75" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#10B981]" />
                      </span>
                      <GlassBadge color="green">
                        {t('faceEnrollment.inProgress', {
                          id: truncateEnrollmentId(form.enrollmentId),
                        })}
                      </GlassBadge>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Dual Capture Mode Switcher (Webcam vs Studio Upload) */}
                      <div className="inline-flex rounded-xl border border-black/10 bg-black/5 p-0.5 dark:border-white/10 dark:bg-white/5">
                        <button
                          type="button"
                          onClick={() => setCaptureMode('CAMERA')}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10.5px] font-bold transition-all',
                            captureMode === 'CAMERA'
                              ? 'bg-white text-slate-900 shadow-2xs dark:bg-white/15 dark:text-white'
                              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400',
                          )}
                        >
                          <Icon paths={I.camera} size={11} />
                          <span>Kamera</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCaptureMode('UPLOAD')}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10.5px] font-bold transition-all',
                            captureMode === 'UPLOAD'
                              ? 'bg-white text-slate-900 shadow-2xs dark:bg-white/15 dark:text-white'
                              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400',
                          )}
                        >
                          <Icon paths={I.upload} size={11} />
                          <span>Fayl</span>
                        </button>
                      </div>

                      <GlassButton
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={t('common.cancel')}
                        onClick={handleCancelEnrollment}
                        disabled={capture.isPending || isCancelling}
                      >
                        {isCancelling ? 'Bekor qilinmoqda…' : t('common.cancel')}
                      </GlassButton>
                    </div>
                  </div>

                  {/* Face ID Viewfinder Frame */}
                  <div className="relative overflow-hidden rounded-[2.2rem] border border-white/60 bg-black/5 p-1.5 shadow-[0_20px_50px_-12px_rgba(16,185,129,0.22),inset_0_1px_1px_rgba(255,255,255,0.6)] dark:border-white/15 dark:bg-white/[0.03]">
                    {/* Reticles */}
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute left-4 top-4 z-20 h-6 w-6 rounded-tl-xl border-l-2 border-t-2 border-[#10B981]/85 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                    />
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute right-4 top-4 z-20 h-6 w-6 rounded-tr-xl border-r-2 border-t-2 border-[#10B981]/85 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                    />
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute bottom-16 left-4 z-20 h-6 w-6 rounded-bl-xl border-b-2 border-l-2 border-[#10B981]/85 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                    />
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute bottom-16 right-4 z-20 h-6 w-6 rounded-br-xl border-b-2 border-r-2 border-[#10B981]/85 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                    />

                    {/* Transform-only Laser Sweep (No layout reflow) */}
                    {capture.isPending && !reduced && (
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-4 bottom-16 top-4 z-20 overflow-hidden rounded-2xl"
                      >
                        <motion.div
                          className="h-full w-full border-b-2 border-[#10B981] bg-gradient-to-b from-transparent to-[#10B981]/20 shadow-[0_0_16px_#10B981]"
                          initial={{ y: '-100%' }}
                          animate={{ y: ['-100%', '0%', '-100%'] }}
                          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      </div>
                    )}

                    {captureMode === 'CAMERA' ? (
                      <>
                        <div className="pointer-events-none absolute inset-x-0 top-0 bottom-14 z-10 flex items-center justify-center">
                          <div
                            className={cn(
                              'aspect-[4/5] h-[58%] max-h-56 rounded-[50%] border-2 border-dashed transition-all duration-300',
                              capture.isPending
                                ? 'animate-pulse border-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.55)]'
                                : 'border-white/40 shadow-[0_0_15px_rgba(255,255,255,0.15)]',
                            )}
                          />
                        </div>

                        <WebcamCapture
                          onCapture={handleCapture}
                          busy={capture.isPending}
                          label={t('faceEnrollment.captureFace')}
                        />
                      </>
                    ) : (
                      /* Studio Portrait Photo Upload Mode */
                      <div className="flex flex-col items-center justify-center rounded-[1.9rem] bg-slate-950/85 p-6 text-center text-white">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handleFileUploadChange}
                          className="hidden"
                        />

                        {uploadedPreview ? (
                          <div className="w-full space-y-4">
                            <div className="relative mx-auto h-52 w-44 overflow-hidden rounded-3xl border-2 border-[#10B981]/60 shadow-[0_0_25px_rgba(16,185,129,0.3)]">
                              <img
                                src={uploadedPreview}
                                alt="Selected portrait"
                                className="h-full w-full object-cover"
                              />
                            </div>
                            <div className="flex items-center justify-center gap-2">
                              <GlassButton
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={capture.isPending}
                              >
                                Boshqa rasm
                              </GlassButton>
                              <GlassButton
                                type="button"
                                variant="primary"
                                size="sm"
                                onClick={() => handleCapture(uploadedPreview)}
                                disabled={capture.isPending}
                              >
                                {t('faceEnrollment.captureFace')}
                              </GlassButton>
                            </div>
                          </div>
                        ) : (
                          <div className="py-8">
                            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-[#34D399]">
                              <Icon paths={I.upload} size={24} />
                            </div>
                            <h4 className="text-sm font-bold">
                              Studiya portret rasmini yuklang
                            </h4>
                            <p className="mt-1 max-w-xs text-xs text-slate-300">
                              Aniq tushirilgan 3x4 yoki portret rasm (JPG, PNG, WEBP) tanlang
                            </p>
                            <GlassButton
                              type="button"
                              variant="primary"
                              size="sm"
                              className="mt-4"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              Faylni tanlash
                            </GlassButton>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Success celebratory Liquid Glass overlay */}
                    <AnimatePresence>
                      {captureSucceeded && (
                        <motion.div
                          key="enrollment-success-overlay"
                          role="status"
                          initial={{ opacity: 0, scale: 0.92 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          transition={SPRING.smooth}
                          className="absolute inset-0 z-30 flex flex-col items-center justify-center rounded-[2.1rem] bg-[#0B0F1A]/92 p-6 text-center text-white backdrop-blur-2xl"
                        >
                          <motion.div
                            initial={{ scale: 0.5, rotate: -10 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={SPRING.snappy}
                            className="mb-3.5 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-[1.5rem] bg-gradient-to-tr from-[#059669] to-[#10B981] text-white shadow-[0_14px_34px_-6px_rgba(16,185,129,0.65),inset_0_1.5px_1px_rgba(255,255,255,0.6)]"
                          >
                            <Icon paths={I.checkCircle} size={34} strokeWidth={2.5} />
                          </motion.div>
                          <h3 className="text-[18px] font-extrabold tracking-tight">
                            {t('faceEnrollment.success.title')}
                          </h3>
                          <p className="mt-1 max-w-xs text-[13px] font-medium text-white/80">
                            {t('faceEnrollment.success.body')}
                          </p>

                          {lastCaptureStats && (
                            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                              {lastCaptureStats.qualityScore !== undefined && (
                                <span className="rounded-full border border-emerald-400/40 bg-emerald-500/20 px-3 py-1 text-[11.5px] font-bold text-emerald-300">
                                  {t('faceEnrollment.success.quality', {
                                    n: Math.round(lastCaptureStats.qualityScore * 100),
                                  })}
                                </span>
                              )}
                              {lastCaptureStats.livenessResult && (
                                <span className="rounded-full border border-emerald-400/40 bg-emerald-500/20 px-3 py-1 text-[11.5px] font-bold text-emerald-300">
                                  {t('faceEnrollment.success.liveness', {
                                    v: lastCaptureStats.livenessResult,
                                  })}
                                </span>
                              )}
                            </div>
                          )}

                          <div className="mt-5 flex w-full max-w-xs flex-col gap-2 sm:flex-row">
                            {nextCandidate && (
                              <GlassButton
                                type="button"
                                variant="primary"
                                className="flex-1 justify-center text-xs"
                                onClick={() => {
                                  clearResetTimer();
                                  pickNextUnenrolledStudent(form.studentId);
                                }}
                              >
                                <span className="inline-flex items-center gap-1.5">
                                  {t('faceEnrollment.success.next')}
                                  <Icon paths={I.arrowRight} size={13} strokeWidth={2.4} />
                                </span>
                              </GlassButton>
                            )}
                            <GlassButton
                              type="button"
                              variant="ghost"
                              className="flex-1 justify-center text-xs"
                              onClick={() => {
                                clearResetTimer();
                                setForm(INITIAL_FORM);
                                setCaptureSucceeded(false);
                                setLastCaptureStats(null);
                              }}
                            >
                              {t('faceEnrollment.success.done')}
                            </GlassButton>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Positioning Guidance Capsule */}
                  <div className="flex items-center gap-2.5 rounded-2xl border border-[#2563EB]/25 bg-[#2563EB]/[0.08] px-3.5 py-2.5 text-[12px] font-semibold text-[#1D4ED8] dark:border-[#3B82F6]/30 dark:bg-[#3B82F6]/12 dark:text-[#93C5FD]">
                    <Icon paths={I.sparkles} size={15} className="shrink-0" strokeWidth={2.2} />
                    <span>
                      Kameraga to‘g‘ri qarang, yuz yaxshi yoritilgan bo‘lsin (50–70 sm masofada).
                    </span>
                  </div>

                  {/* Single Unified Error Alert */}
                  {captureErrorMessage && (
                    <div
                      className="space-y-1.5 rounded-2xl border border-[#EF4444]/35 bg-[#EF4444]/10 px-4 py-3 text-[12.5px] font-semibold leading-5 text-[#EF4444] shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
                      role="alert"
                    >
                      <div className="flex items-start gap-2.5">
                        <Icon
                          paths={I.xCircle}
                          size={16}
                          strokeWidth={2.2}
                          className="mt-0.5 shrink-0"
                        />
                        <span>{captureErrorMessage}</span>
                      </div>
                      {isLivenessError && (
                        <p className="pl-6 text-[11.5px] font-medium text-[#EF4444]/85">
                          Tavsiya: Xona yorug‘ligini yaxshilang, ekranga juda yaqin turmang va
                          kameraga to‘g‘ridan-to‘g‘ri qarang.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Attempts Log */}
                  {attempts.length > 0 && (
                    <details className={cn(INSET, 'group px-3.5 py-2.5')}>
                      <summary className="flex min-h-[30px] cursor-pointer list-none items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                        <span>
                          {t('faceEnrollment.attempts')} ({attempts.length})
                        </span>
                        <Icon
                          paths={['M6 9l6 6 6-6']}
                          size={14}
                          className="transition-transform group-open:rotate-180"
                        />
                      </summary>
                      <ul className="mt-2 space-y-1.5">
                        {attempts.map((a) => (
                          <li
                            key={a.id}
                            className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300"
                          >
                            <Icon
                              paths={a.ok ? I.checkCircle : I.xCircle}
                              size={14}
                              className={a.ok ? 'text-emerald-500' : 'text-red-500'}
                            />
                            <span className="truncate">{a.message}</span>
                            <time className="ml-auto shrink-0 font-mono text-[10.5px] text-slate-400">
                              {new Date(a.at).toLocaleTimeString(undefined, {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })}
                            </time>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}
            </div>

            {/* Privacy & Safety Note */}
            <div className={cn(INSET, 'mt-5 p-3.5')}>
              <div className="flex items-start gap-2.5 text-[12px] font-medium leading-5 text-slate-500 dark:text-slate-400">
                <Icon
                  paths={I.shieldCheck}
                  size={16}
                  className="mt-0.5 shrink-0 text-[#10B981]"
                  strokeWidth={2.1}
                />
                <span>{t('faceEnrollment.pipelineHint')}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* RIGHT COLUMN: Enrolled Face Directory */}
        <motion.div variants={cardVariants} className="space-y-4 lg:col-span-7">
          <div className={cn(PANEL, 'flex h-full flex-col p-5 sm:p-7')}>
            <SpecularRim />

            {/* Header + Actions */}
            <div className="relative flex flex-col gap-3.5 border-b border-black/[0.06] pb-4 dark:border-white/[0.08]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-2xl text-[#2563EB] dark:text-[#60A5FA]"
                    style={{
                      background: 'rgba(37,99,235,0.12)',
                      border: '1px solid rgba(37,99,235,0.26)',
                      boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.4)',
                    }}
                  >
                    <Icon paths={I.users} size={19} strokeWidth={2.1} />
                  </div>
                  <div>
                    <h2 className="text-[16px] font-bold tracking-tight text-slate-900 dark:text-slate-50">
                      {t('faceEnrollment.listTitle')}
                    </h2>
                    <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400">
                      {t('faceEnrollment.records', { n: filteredEnrollments.length })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Refresh Button */}
                  <button
                    type="button"
                    onClick={() => void enrollments.refetch()}
                    aria-label="Yangilash"
                    title="Yangilash"
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-2xl border border-black/[0.08] bg-white/70 text-slate-600 transition-colors hover:bg-white hover:text-blue-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300',
                      FOCUS,
                    )}
                  >
                    <Icon
                      paths={I.refresh}
                      size={15}
                      className={enrollments.isFetching && !reduced ? 'animate-spin' : ''}
                    />
                  </button>

                  {/* Sort Toggle Button */}
                  <button
                    type="button"
                    onClick={() =>
                      setSortKey((prev) =>
                        prev === 'newest' ? 'name' : prev === 'name' ? 'oldest' : 'newest',
                      )
                    }
                    aria-label="Saralash"
                    title="Saralash tartibi"
                    className={cn(
                      'inline-flex min-h-[40px] items-center gap-1.5 rounded-2xl border border-black/[0.08] bg-white/70 px-3 text-xs font-bold text-slate-700 transition-colors hover:bg-white dark:border-white/10 dark:bg-slate-900 dark:text-slate-200',
                      FOCUS,
                    )}
                  >
                    <span>
                      {sortKey === 'newest'
                        ? 'Yangilari avval'
                        : sortKey === 'oldest'
                          ? 'Eskilari avval'
                          : 'Ism bo‘yicha'}
                    </span>
                  </button>

                  {/* CSV Export */}
                  <motion.button
                    type="button"
                    whileTap={reduced ? undefined : { scaleX: 1.05, scaleY: 0.92 }}
                    transition={SPRING.gel}
                    onClick={handleExportCsv}
                    disabled={filteredEnrollments.length === 0}
                    aria-label="CSV Eksport"
                    title="CSV Eksport"
                    className={cn(
                      'inline-flex min-h-[40px] items-center gap-1.5 rounded-2xl border border-black/[0.08] bg-white/75 px-3.5 py-2 text-xs font-bold text-slate-900 shadow-xs backdrop-blur-xl transition-all hover:bg-white hover:text-[#2563EB] disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-50 dark:hover:bg-white/[0.08]',
                      FOCUS,
                    )}
                  >
                    <Icon paths={I.download} size={14} strokeWidth={2.2} />
                    <span>CSV Eksport</span>
                  </motion.button>
                </div>
              </div>

              {/* Search & 5-Status Filter Tabs */}
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <Icon paths={I.search} size={14} strokeWidth={2.2} />
                  </div>
                  <input
                    ref={searchInputRef}
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Talabani yoki ID raqamini qidirish… (/)"
                    className={cn(
                      'w-full rounded-2xl border border-black/[0.08] bg-white/75 py-2.5 pl-9 pr-9 text-[12.5px] font-semibold text-slate-900 placeholder-slate-400 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] outline-none backdrop-blur-xl transition-all focus:border-[#2563EB] focus:bg-white focus:ring-2 focus:ring-[#2563EB]/15 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-50 dark:focus:bg-white/[0.08]',
                      FOCUS,
                    )}
                  />
                  <kbd
                    aria-hidden="true"
                    className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-black/10 px-1.5 py-0.5 text-[10px] font-bold text-slate-400 sm:block dark:border-white/15"
                  >
                    /
                  </kbd>
                </div>

                {/* 5-State Segmented Filter Pills */}
                <LayoutGroup id="face-enrollment-status-tabs">
                  <div
                    role="tablist"
                    aria-label="Holat filtrlari"
                    className="relative inline-flex flex-wrap items-center rounded-2xl border border-black/[0.06] bg-black/[0.04] p-1 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05]"
                  >
                    {STATUS_TABS.map((tab) => {
                      const isSelected = statusFilter === tab;
                      const count = counts[tab];
                      return (
                        <button
                          key={tab}
                          type="button"
                          role="tab"
                          aria-selected={isSelected}
                          onClick={() => {
                            fx.current.sound.playTick?.();
                            setStatusFilter(tab);
                          }}
                          className={cn(
                            'relative z-10 flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-bold transition-colors',
                            isSelected
                              ? 'text-slate-900 dark:text-white'
                              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
                            FOCUS,
                          )}
                        >
                          {isSelected && (
                            <motion.span
                              layoutId="statusFilterPill"
                              transition={SPRING.snappy}
                              aria-hidden="true"
                              className="absolute inset-0 -z-10 rounded-xl border border-white/80 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.9)] dark:border-white/15 dark:bg-[#1E2536]"
                            />
                          )}
                          <span>{t(`faceEnrollment.tab.${tab}`)}</span>
                          <span
                            className={cn(
                              'rounded-full px-1.5 py-0.2 text-[9.5px] font-bold tabular-nums',
                              isSelected
                                ? 'bg-black/10 text-slate-900 dark:bg-white/20 dark:text-white'
                                : 'bg-black/5 text-slate-500 dark:bg-white/5 dark:text-slate-400',
                            )}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </LayoutGroup>
              </div>

              {/* Truncation warning if list exceeds limit */}
              {isTruncated && (
                <div
                  role="note"
                  className="flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-[11px] font-medium text-amber-800 dark:text-amber-200"
                >
                  <Icon paths={I.alert} size={13} className="shrink-0" />
                  <span>
                    Faqat birinchi {enrollmentList.length} / {enrollmentsTotal} yozuv yuklandi.
                  </span>
                </div>
              )}
            </div>

            {/* List content */}
            <div className="relative mt-4 max-h-[580px] flex-1 overflow-y-auto pr-0.5">
              {enrollments.isLoading && !enrollments.data ? (
                <div className="py-12">
                  <GlassPageLoader label={t('faceEnrollment.loading')} />
                </div>
              ) : enrollments.isError ? (
                <div className="py-8">
                  <GlassErrorState
                    title={t('faceEnrollment.loadError')}
                    message={getErrorMessage(enrollments.error as Error)}
                    onRetry={() => void enrollments.refetch()}
                  />
                </div>
              ) : filteredEnrollments.length === 0 ? (
                <div className="py-12">
                  <GlassEmptyState
                    title={
                      hasActiveFilters
                        ? t('faceEnrollment.emptyFiltered')
                        : t('faceEnrollment.empty')
                    }
                    message={
                      hasActiveFilters
                        ? t('faceEnrollment.emptyFilteredHint')
                        : t('faceEnrollment.emptyHint')
                    }
                  />
                  {hasActiveFilters && (
                    <div className="mt-3 flex justify-center">
                      <GlassButton type="button" variant="ghost" size="sm" onClick={clearFilters}>
                        {t('faceEnrollment.clearFilters')}
                      </GlassButton>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {visibleEnrollments.map((enrollment) => {
                    const statusBadgeColor = statusColor(enrollment.status);
                    const isRevokingThis =
                      revoke.isPending && revoke.variables === enrollment.id;
                    const studentName = formatStudentName(enrollment.student);
                    const targetStudentId =
                      enrollment.student?.id ?? enrollment.studentId;
                    const isCopied = copiedId === enrollment.id;

                    return (
                      <motion.div
                        key={enrollment.id}
                        whileHover={{ y: -1.5, scale: 1.003 }}
                        transition={SPRING.snappy}
                        className="group relative flex flex-col justify-between gap-3 rounded-[1.35rem] border border-white/75 bg-white/65 p-3.5 shadow-[0_4px_16px_-6px_rgba(15,23,42,0.05),inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-xl transition-all hover:border-[#10B981]/35 hover:bg-white/90 sm:flex-row sm:items-center dark:border-white/[0.08] dark:bg-white/[0.03] dark:shadow-none dark:hover:border-white/[0.16] dark:hover:bg-white/[0.06]"
                      >
                        <div className="flex min-w-0 items-center gap-3.5">
                          <div className="relative shrink-0">
                            <div
                              className="flex h-11 w-11 items-center justify-center rounded-2xl text-[12.5px] font-extrabold text-white shadow-sm"
                              style={{
                                background: getAvatarGradient(studentName),
                                boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.45)',
                              }}
                            >
                              {getInitials(studentName)}
                            </div>
                            {enrollment.status === 'ACTIVE' && (
                              <span
                                aria-hidden="true"
                                className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#10B981] dark:border-[#0F1420]"
                              />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="truncate text-[14px] font-bold text-slate-900 dark:text-slate-50">
                                {studentName}
                              </h4>
                              <button
                                type="button"
                                onClick={() => handleCopyId(enrollment.id)}
                                title="Enrollment ID nusxalash"
                                className={cn(
                                  'inline-flex items-center gap-1 rounded-md border border-black/[0.06] bg-black/[0.03] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-500 transition-colors hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-400',
                                  FOCUS,
                                )}
                              >
                                <Icon paths={I.copy} size={10} />
                                <span>
                                  {isCopied
                                    ? 'Nusxalandi'
                                    : truncateEnrollmentId(enrollment.id, 6)}
                                </span>
                              </button>
                            </div>

                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                              <span>
                                {enrollment.enrolledAt
                                  ? formatDate(enrollment.enrolledAt)
                                  : '—'}
                              </span>
                              <span>•</span>
                              <GlassBadge color={statusBadgeColor}>
                                {t(`faceEnrollment.status.${enrollment.status}`)}
                              </GlassBadge>
                            </div>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center justify-end gap-2">
                          {/* Quick Resume for PENDING enrollments */}
                          {enrollment.status === 'PENDING' && targetStudentId && (
                            <GlassButton
                              type="button"
                              variant="primary"
                              size="sm"
                              onClick={() =>
                                selectStudentById(
                                  targetStudentId,
                                  enrollment.enrollmentId ?? enrollment.id,
                                )
                              }
                            >
                              <span className="inline-flex items-center gap-1.5">
                                <Icon paths={I.camera} size={12} />
                                Davom ettirish
                              </span>
                            </GlassButton>
                          )}

                          {/* Quick Re-enroll for REVOKED or EXPIRED enrollments */}
                          {(enrollment.status === 'REVOKED' ||
                            enrollment.status === 'EXPIRED') &&
                            targetStudentId && (
                              <GlassButton
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => selectStudentById(targetStudentId, '')}
                              >
                                <span className="inline-flex items-center gap-1.5">
                                  <Icon paths={I.refresh} size={12} />
                                  Qayta ulash
                                </span>
                              </GlassButton>
                            )}

                          <motion.button
                            type="button"
                            whileTap={reduced ? undefined : { scaleX: 1.06, scaleY: 0.9 }}
                            transition={SPRING.gel}
                            onClick={() => handleOpenSidecar(enrollment)}
                            aria-label={`${studentName} — Split View Sidecar`}
                            title="Split View Sidecar"
                            className={cn(
                              'flex h-10 w-10 min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-black/[0.06] bg-white/75 text-slate-500 shadow-xs transition-all hover:border-[#10B981]/40 hover:bg-[#10B981]/10 hover:text-[#10B981] dark:border-white/10 dark:bg-white/[0.05] dark:hover:bg-white/10',
                              FOCUS,
                            )}
                          >
                            <Icon paths={I.sidebar} size={15} strokeWidth={2} />
                          </motion.button>

                          {enrollment.status === 'ACTIVE' && (
                            <GlassButton
                              type="button"
                              variant="danger"
                              size="sm"
                              className="min-h-[40px]"
                              aria-label={t('faceEnrollment.revoke')}
                              onClick={() => handleRevoke(enrollment.id)}
                              disabled={isRevokingThis}
                            >
                              <span className="inline-flex items-center gap-1.5">
                                <Icon paths={I.trash} size={12} strokeWidth={2.2} />
                                {isRevokingThis
                                  ? t('faceEnrollment.revoking')
                                  : t('faceEnrollment.revoke')}
                              </span>
                            </GlassButton>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}

                  {/* Show More Pagination */}
                  {visibleCount < filteredEnrollments.length && (
                    <div className="pt-2 text-center">
                      <GlassButton
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setVisibleCount((prev) => prev + PAGE_SIZE)
                        }
                      >
                        {t('faceEnrollment.showMore', {
                          n: Math.min(
                            PAGE_SIZE,
                            filteredEnrollments.length - visibleCount,
                          ),
                        })}
                      </GlassButton>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      <ConfirmDialog
        open={revokeTarget !== null}
        onClose={() => setRevokeTarget(null)}
        onConfirm={confirmRevoke}
        description={t('faceEnrollment.revokeConfirm')}
        loading={revoke.isPending}
      />
    </motion.div>
  );
}

export default FaceEnrollmentPage;
