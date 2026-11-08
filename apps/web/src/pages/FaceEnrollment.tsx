'use client';

/**
 * ============================================================================
 * M-EDU FaceEnrollmentPage — iOS 27 / visionOS "Spatial Biometric Studio"
 * ============================================================================
 *
 * Module Features & Fixes:
 *  • Multi-layered ambient volumetric plasma orbs (respects reduced-motion)
 *  • Refractive iOS 27 Liquid Glass surfaces with chromatic specular rims
 *  • Hero header with 3D squircle biometric scanner emblem + live LiDAR pill
 *  • Animated KPI bento with radial SVG progress ring & specular edge glow
 *  • Guided 3-step Biometric Enrollment Studio with completion checkmarks
 *  • Live Apple Face ID LiDAR HUD Viewfinder with scanning laser beam
 *  • Deduplicated error alerts + automatic mutation reset on student switch
 *  • Safe timer cleanup on unmount & unique student coverage calculation
 *  • 100% preservation of all API contracts, regression tests, and i18n
 * ============================================================================
 */

import {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  memo,
  type ChangeEvent,
} from 'react';
import { Link, useInRouterContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, LayoutGroup, type Variants } from 'framer-motion';
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
 * MOTION TOKENS — iOS 27 Fluid Spring Physics
 * ========================================================================== */

const SPRING = {
  snappy: { type: 'spring' as const, stiffness: 520, damping: 32, mass: 0.65 },
  smooth: { type: 'spring' as const, stiffness: 380, damping: 31, mass: 0.82 },
  soft: { type: 'spring' as const, stiffness: 240, damping: 28, mass: 0.95 },
  gel: { type: 'spring' as const, stiffness: 740, damping: 25, mass: 0.34 },
  float: {
    duration: 14,
    repeat: Infinity,
    repeatType: 'mirror' as const,
    ease: 'easeInOut' as const,
  },
} as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.02 },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.988 },
  visible: { opacity: 1, y: 0, scale: 1, transition: SPRING.smooth },
};

/* ============================================================================
 * iOS 27 LIQUID GLASS DESIGN TOKENS
 * ========================================================================== */

const LIQUID_PANEL = cn(
  'relative isolate overflow-hidden rounded-[2.15rem]',
  'border border-white/75 dark:border-white/[0.13]',
  'bg-white/[0.72] dark:bg-[#0B0F1A]/[0.74] backdrop-blur-3xl backdrop-saturate-[205%]',
  'shadow-[0_24px_60px_-15px_rgba(15,23,42,0.07),0_4px_20px_-2px_rgba(15,23,42,0.03),inset_0_1.5px_1px_rgba(255,255,255,0.9),inset_0_-1px_1px_rgba(16,185,129,0.08)]',
  'dark:shadow-[0_28px_70px_-15px_rgba(0,0,0,0.68),inset_0_1.5px_0.5px_rgba(255,255,255,0.2),inset_0_-1px_1px_rgba(16,185,129,0.14)]',
);

const LIQUID_INSET = cn(
  'rounded-[1.35rem] border border-black/[0.06] dark:border-white/[0.09]',
  'bg-white/[0.58] dark:bg-white/[0.035] backdrop-blur-xl',
  'shadow-[inset_0_1px_2px_rgba(15,23,42,0.03),0_1px_0_rgba(255,255,255,0.75)]',
  'dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.38)]',
);

/* ============================================================================
 * CUSTOM SVG ICONS
 * ========================================================================== */

const ICON_STROKE = 1.9;

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
  xCircle: [
    'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z',
    'M15 9l-6 6',
    'M9 9l6 6',
  ],
  user: [
    'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2',
    'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  ],
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
  cpu: [
    'M4 4h16v16H4z',
    'M9 9h6v6H9z',
    'M9 1v3',
    'M15 1v3',
    'M9 20v3',
    'M15 20v3',
    'M20 9h3',
    'M20 14h3',
    'M1 9h3',
    'M1 14h3',
  ],
  sidebar: [
    'M3 3h18a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
    'M15 3v18',
  ],
  download: [
    'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4',
    'M7 10l5 5 5-5',
    'M12 15V3',
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

function Icon({
  paths,
  size = 18,
  className = '',
  strokeWidth = ICON_STROKE,
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
              : { x: [0, 35, -20, 0], y: [0, -25, 15, 0], scale: [1, 1.08, 0.96, 1] }
          }
          transition={SPRING.float}
          className="absolute -left-32 -top-32 h-[440px] w-[440px] rounded-full bg-gradient-to-br from-[#10B981]/20 via-[#34D399]/10 to-transparent blur-[110px] dark:from-[#10B981]/18 dark:via-[#059669]/8"
        />
        <motion.div
          animate={
            reduced
              ? undefined
              : { x: [0, -40, 25, 0], y: [0, 30, -20, 0], scale: [1, 0.94, 1.06, 1] }
          }
          transition={{ ...SPRING.float, duration: 18 }}
          className="absolute -right-28 top-12 h-[480px] w-[480px] rounded-full bg-gradient-to-bl from-[#2563EB]/18 via-[#6366F1]/12 to-transparent blur-[120px] dark:from-[#3B82F6]/16 dark:via-[#6366F1]/10"
        />
        <motion.div
          animate={reduced ? undefined : { x: [0, 20, -30, 0], y: [0, -20, 25, 0] }}
          transition={{ ...SPRING.float, duration: 22 }}
          className="absolute bottom-[-140px] left-1/3 h-[380px] w-[520px] rounded-full bg-gradient-to-tr from-[#06B6D4]/12 via-[#10B981]/8 to-transparent blur-[110px] dark:from-[#06B6D4]/10"
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
        className="pointer-events-none absolute inset-x-6 top-0 z-10 h-px bg-gradient-to-r from-transparent via-white/95 to-transparent dark:via-white/35"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-10 top-[1px] z-10 h-[0.5px] bg-gradient-to-r from-transparent via-[#34D399]/35 to-transparent dark:via-[#34D399]/25"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-28 bg-gradient-to-b from-white/35 via-white/5 to-transparent dark:from-white/[0.05] dark:to-transparent"
      />
    </>
  );
});

/* ============================================================================
 * STABLE TRANSLATION & HELPERS
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
    'Facial templates are converted into irreversible AES-256 mathematical vectors. Raw photos are never exposed.',
  'faceEnrollment.listTitle': 'Enrolled Biometric Directory',
  'faceEnrollment.loading': 'Loading biometric records…',
  'faceEnrollment.loadError': 'Failed to load enrollments',
  'faceEnrollment.empty': 'No Face ID enrollments found',
  'faceEnrollment.emptyHint': 'Select a student on the left to register their first biometric template.',
  'faceEnrollment.revoke': 'Revoke',
  'faceEnrollment.revoking': 'Revoking…',
  'faceEnrollment.revokeConfirm':
    'Are you sure you want to revoke this Face ID template? The student will need to be re-enrolled.',
  'faceEnrollment.startedToast': 'Enrollment session initialized',
  'faceEnrollment.capturedToast': 'Face ID vector encrypted and saved',
  'faceEnrollment.revokedToast': 'Biometric record revoked',
  'faceEnrollment.cancelledToast': 'Enrollment session cancelled',
  'faceEnrollment.noActiveSession': 'No active enrollment session',
  'face.biometricEnrollment': 'Biometric Studio',
  'face.appleNeuralBiometrics': 'Neural Engine',
  'common.cancel': 'Cancel',
};

function useT(): (key: string, vars?: Record<string, string | number>) => string {
  const { t } = useSafeI18n();
  return useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const res = t(key, vars);
      if (typeof res === 'string' && res.trim().length > 0 && res !== key) return res;
      const viaEn = translate('en', key, vars);
      if (typeof viaEn === 'string' && viaEn.trim().length > 0 && viaEn !== key) return viaEn;
      const template = FACE_ENROLLMENT_EN_FALLBACK[key];
      if (!template) return key;
      if (!vars) return template;
      return template.replace(/\{(\w+)\}/g, (match, name: string) =>
        name in vars ? String(vars[name]) : match,
      );
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

function formatStudentName(
  student:
    | { user?: { firstName?: string; lastName?: string } }
    | { firstName?: string; lastName?: string }
    | undefined,
): string {
  if (!student) return '—';
  const nested =
    'user' in student
      ? (student as { user?: { firstName?: string; lastName?: string } }).user
      : undefined;
  const direct = student as { firstName?: string; lastName?: string };
  const firstName = nested?.firstName ?? direct.firstName;
  const lastName = nested?.lastName ?? direct.lastName;
  return [firstName, lastName].filter(Boolean).join(' ') || '—';
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

const FACE_ENROLLMENT_STATUS_KEYS: Record<FaceEnrollmentStatus, string> = {
  PENDING: 'faceEnrollment.status.PENDING',
  ACTIVE: 'faceEnrollment.status.ACTIVE',
  REVOKED: 'faceEnrollment.status.REVOKED',
  EXPIRED: 'faceEnrollment.status.EXPIRED',
};

function getEnrollmentStatusBadge(status: FaceEnrollmentStatus): {
  color: string;
  labelKey: string;
} {
  return {
    color: statusColor(status),
    labelKey: FACE_ENROLLMENT_STATUS_KEYS[status] ?? '',
  };
}

function truncateEnrollmentId(id: string, maxLength = 8): string {
  return id.length > maxLength ? `${id.slice(0, maxLength)}…` : id;
}

/* ============================================================================
 * LIQUID GLASS KPI CARD COMPONENT (with Radial Ring Gauge)
 * ========================================================================== */

const KpiCard = memo(function KpiCard({
  label,
  value,
  secondary,
  icon,
  progress,
  color,
}: {
  label: string;
  value: string | number;
  secondary?: string;
  icon: readonly string[];
  progress?: number;
  color: { fg: string; bg: string; border: string; glow: string };
}) {
  const clampedProgress =
    typeof progress === 'number' ? Math.max(0, Math.min(100, progress)) : undefined;
  const circumference = 2 * Math.PI * 14;

  return (
    <motion.div
      variants={cardVariants}
      whileHover={{ y: -3, scale: 1.008 }}
      transition={SPRING.snappy}
      className={cn(LIQUID_PANEL, 'group p-4 sm:p-5')}
    >
      <SpecularRim />

      {/* Subtle corner radial caustic */}
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
            <div className="font-mono text-[24px] font-extrabold leading-none tracking-tight tabular-nums text-[#0F172A] dark:text-[#F8FAFC]">
              {value}
            </div>
            {typeof clampedProgress === 'number' && (
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
                    transition={{ duration: 0.9, ease: 'easeOut' }}
                  />
                </svg>
              </div>
            )}
          </div>

          <div className="mt-1.5 truncate text-[11px] font-bold uppercase tracking-[0.08em] text-[#64748B] dark:text-[#94A3B8]">
            {label}
          </div>

          {secondary && (
            <div className="mt-0.5 truncate text-[11px] font-medium text-[#64748B]/85 dark:text-[#94A3B8]/80">
              {secondary}
            </div>
          )}
        </div>
      </div>

      {typeof clampedProgress === 'number' && (
        <div className="relative mt-3.5 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.08]">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(4, clampedProgress)}%` }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, ${color.fg} 0%, #38BDF8 100%)`,
              boxShadow: `0 0 12px ${color.glow}`,
            }}
          />
        </div>
      )}
    </motion.div>
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

  // Ref-stabilized feedback hooks
  const soundRef = useRef(sound);
  const voiceRef = useRef(voice);
  const hapticsRef = useRef(haptics);
  const pushRef = useRef(push);
  useEffect(() => {
    soundRef.current = sound;
    voiceRef.current = voice;
    hapticsRef.current = haptics;
    pushRef.current = push;
  }, [sound, voice, haptics, push]);

  // Form & UI state
  const [form, setForm] = useState<EnrollmentFormState>(INITIAL_FORM);
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'REVOKED'>('ALL');
  const [captureSucceeded, setCaptureSucceeded] = useState(false);
  const [lastCaptureStats, setLastCaptureStats] = useState<{
    qualityScore?: number;
    livenessResult?: string;
  } | null>(null);
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof EnrollmentFormState, string>>
  >({});

  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearResetTimer = useCallback(() => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearResetTimer();
  }, [clearResetTimer]);

  // Invalidation helper
  const invalidateFaceQueries = useCallback(() => {
    qc.invalidateQueries({ queryKey: queryKeys.face.enrollments() });
    qc.invalidateQueries({ queryKey: queryKeys.face.studentEnrollments() });
    qc.invalidateQueries({ queryKey: queryKeys.students.faces() });
    qc.invalidateQueries({ queryKey: queryKeys.students.details() });
    qc.invalidateQueries({ queryKey: queryKeys.students.all() });
  }, [qc]);

  // Data fetching
  const students = useQuery({
    queryKey: queryKeys.students.faces(),
    queryFn: () => studentsApi.list({ limit: 100 }),
    placeholderData: (previousData) => previousData,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const enrollments = useQuery({
    queryKey: queryKeys.face.enrollments(),
    queryFn: () => faceApi.enrollments({ limit: 100 }),
    placeholderData: (previousData) => previousData,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const studentList = useMemo(
    () => (students.data as Paginated<Student> | undefined)?.items || [],
    [students.data],
  );

  const selectableStudents = useMemo(() => {
    if (!studentSearchQuery.trim()) return studentList;
    const q = studentSearchQuery.toLowerCase();
    return studentList.filter((s) => {
      const name = formatStudentName(s).toLowerCase();
      return name.includes(q) || (s.id && s.id.toLowerCase().includes(q));
    });
  }, [studentList, studentSearchQuery]);

  const enrollmentList = useMemo(
    () => (enrollments.data as Paginated<FaceEnrollment> | undefined)?.items || [],
    [enrollments.data],
  );

  const selectedStudent = useMemo(
    () => studentList.find((s) => s.id === form.studentId),
    [studentList, form.studentId],
  );

  // Accurate Statistics (counts unique active students for coverage%)
  const stats = useMemo(() => {
    const total = enrollmentList.length;
    let active = 0;
    let revoked = 0;
    const activeStudentIds = new Set<string>();

    for (const e of enrollmentList) {
      if (e.status === 'ACTIVE') {
        active += 1;
        const sid = e.student?.id ?? e.studentId;
        if (sid) activeStudentIds.add(sid);
      } else if (e.status === 'REVOKED') {
        revoked += 1;
      }
    }

    const totalStudents = studentList.length;
    const uniqueEnrolledCount = activeStudentIds.size || active;
    const coverage =
      totalStudents > 0
        ? Math.min(100, Math.round((uniqueEnrolledCount / totalStudents) * 100))
        : 0;

    return { total, active, revoked, coverage };
  }, [enrollmentList, studentList.length]);

  // Guided 3-step studio progress state (4 = all 3 steps completed with ✓)
  const currentStep = useMemo(() => {
    if (captureSucceeded) return 4;
    if (form.enrollmentId) return 3;
    if (form.studentId) return 2;
    return 1;
  }, [form.studentId, form.enrollmentId, captureSucceeded]);

  // Start enrollment mutation
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
      soundRef.current.playTick?.();
      hapticsRef.current.light?.();
      pushRef.current('success', t('faceEnrollment.startedToast'));
      invalidateFaceQueries();
    },
    onError: (e: Error) => {
      soundRef.current.playError?.();
      hapticsRef.current.error?.();
      pushRef.current('error', friendlyFaceError(e));
    },
  });

  // Capture face mutation
  const capture = useMutation({
    mutationFn: (b64: string) => faceApi.capture(form.enrollmentId, b64),
    onSuccess: (res: any) => {
      soundRef.current.playCelebration?.();
      hapticsRef.current.heavy?.();
      voiceRef.current.speakEnrollmentSuccess?.();
      setLastCaptureStats({
        qualityScore: typeof res?.qualityScore === 'number' ? res.qualityScore : undefined,
        livenessResult: typeof res?.livenessResult === 'string' ? res.livenessResult : undefined,
      });
      setCaptureSucceeded(true);
      pushRef.current('success', t('faceEnrollment.capturedToast'));
      invalidateFaceQueries();

      clearResetTimer();
      resetTimerRef.current = setTimeout(() => {
        setCaptureSucceeded(false);
        setLastCaptureStats(null);
        setForm(INITIAL_FORM);
      }, 3000);
    },
    onError: (e: Error) => {
      soundRef.current.playError?.();
      hapticsRef.current.error?.();
      pushRef.current('error', friendlyFaceError(e));
    },
  });

  // Revoke enrollment mutation
  const revoke = useMutation({
    mutationFn: (id: string) => faceApi.revoke(id, 'operator_revoked'),
    onSuccess: () => {
      soundRef.current.playDelete?.();
      hapticsRef.current.medium?.();
      pushRef.current('success', t('faceEnrollment.revokedToast'));
      invalidateFaceQueries();
    },
    onError: (e: Error) => {
      soundRef.current.playError?.();
      hapticsRef.current.error?.();
      pushRef.current('error', friendlyFaceError(e));
    },
  });

  const resetCaptureError = capture.reset;

  // Form handlers
  const handleStudentChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      clearResetTimer();
      resetCaptureError();
      const selectedId = e.target.value;
      const existingPending = enrollmentList.find(
        (enr) =>
          (enr.student?.id === selectedId || enr.studentId === selectedId) &&
          enr.status === 'PENDING',
      );
      setForm({
        studentId: selectedId,
        enrollmentId: existingPending
          ? (existingPending.enrollmentId ?? existingPending.id)
          : '',
      });
      setFormErrors((prev) => ({ ...prev, studentId: undefined }));
      setCaptureSucceeded(false);
    },
    [enrollmentList, clearResetTimer, resetCaptureError],
  );

  const handleStartEnrollment = useCallback(() => {
    if (!form.studentId) {
      setFormErrors({ studentId: t('faceEnrollment.selectStudentError') });
      hapticsRef.current.error?.();
      return;
    }
    resetCaptureError();
    start.mutate();
  }, [form.studentId, start, t, resetCaptureError]);

  const isCapturePending = capture.isPending;
  const mutateCapture = capture.mutate;

  const handleCapture = useCallback(
    (b64: string) => {
      if (!form.enrollmentId) {
        pushRef.current('error', t('faceEnrollment.noActiveSession'));
        return;
      }
      if (isCapturePending) return;
      mutateCapture(b64);
    },
    [form.enrollmentId, isCapturePending, mutateCapture, t],
  );

  const handleCancelEnrollment = useCallback(async () => {
    clearResetTimer();
    resetCaptureError();
    const activeId = form.enrollmentId;
    if (activeId) {
      try {
        await faceApi.cancelPending(activeId);
      } catch (err) {
        console.error('Failed to cancel pending enrollment', err);
      }
    }
    setForm((prev) => ({ ...prev, enrollmentId: '' }));
    setCaptureSucceeded(false);
    soundRef.current.playTick?.();
    pushRef.current('info', t('faceEnrollment.cancelledToast'));
  }, [form.enrollmentId, clearResetTimer, resetCaptureError, t]);

  const handleRevoke = useCallback((enrollmentId: string) => {
    setRevokeTarget(enrollmentId);
  }, []);

  const confirmRevoke = useCallback(() => {
    if (!revokeTarget) return;
    revoke.mutate(revokeTarget);
    setRevokeTarget(null);
  }, [revokeTarget, revoke]);

  const { refetch: refetchEnrollments } = enrollments;
  const handleRetryEnrollments = useCallback(() => {
    void refetchEnrollments();
  }, [refetchEnrollments]);

  const handleOpenEnrollmentSidecar = useCallback(
    (enrollment: FaceEnrollment) => {
      soundRef.current.playTick?.();
      const studentName = formatStudentName(enrollment.student);
      const sidecarData: QuickLookData = {
        id: enrollment.id,
        type: 'student',
        title: studentName,
        subtitle: `${t('face.biometricEnrollment')} · ${formatDate(enrollment.enrolledAt)}`,
        badge: {
          text: enrollment.status,
          tone: enrollment.status === 'ACTIVE' ? 'emerald' : 'rose',
        },
        avatar: {
          text: getInitials(studentName),
          color: '#10B981',
        },
        metrics: [
          { label: 'O‘quvchi', value: studentName },
          { label: 'Holati', value: enrollment.status },
          { label: 'Ro‘yxatdan o‘tgan', value: formatDate(enrollment.enrolledAt) },
          { label: 'Biometrik ID', value: enrollment.id.slice(0, 8) },
        ],
        details: [
          { label: 'Enrollment ID', value: enrollment.id, copyable: true },
          {
            label: 'Talaba ID',
            value: enrollment.student?.id || enrollment.studentId || '—',
            copyable: true,
          },
          { label: 'Holati', value: enrollment.status },
          { label: 'Sana', value: formatDate(enrollment.enrolledAt) },
        ],
        primaryAction:
          enrollment.status === 'ACTIVE'
            ? {
                label: t('faceEnrollment.revoke') || 'Bekor qilish',
                onExecute: () => handleRevoke(enrollment.id),
              }
            : undefined,
      };
      openSidecar(sidecarData);
    },
    [t, handleRevoke],
  );

  // Filtered enrollments
  const filteredEnrollments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return enrollmentList.filter((item) => {
      const name = formatStudentName(item.student).toLowerCase();
      const idMatch = item.id.toLowerCase().includes(q);
      const matchesSearch = !q || name.includes(q) || idMatch;
      const matchesStatus =
        statusFilter === 'ALL'
          ? true
          : statusFilter === 'ACTIVE'
            ? item.status === 'ACTIVE'
            : item.status === 'REVOKED';
      return matchesSearch && matchesStatus;
    });
  }, [enrollmentList, searchQuery, statusFilter]);

  // CSV Export with UTF-8 BOM
  const handleExportCsv = useCallback(() => {
    if (!filteredEnrollments.length) return;
    const headers = ['ID', 'F.I.SH', 'Status', 'Talaba ID', 'Ro‘yxatdan o‘tgan sana'];
    const rows = filteredEnrollments.map((e) => [
      e.id,
      formatStudentName(e.student),
      e.status,
      e.student?.studentId || '—',
      formatDate(e.enrolledAt),
    ]);
    const csvContent =
      '\uFEFF' +
      [headers, ...rows]
        .map((row) =>
          row
            .map((cell) => {
              const str = cell === null || cell === undefined ? '' : String(cell);
              return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
            })
            .join(','),
        )
        .join('\r\n');

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

  const isStartPending = start.isPending;
  const isRevoking = revoke.isPending;
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

      {/* ============================================================
          HERO BANNER
      ============================================================ */}
      <motion.div variants={cardVariants}>
        <div className={cn(LIQUID_PANEL, 'liquid-glass-surface p-6 sm:p-8')}>
          <SpecularRim />

          {/* Ambient prism glow inside hero */}
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
                    background: 'linear-gradient(135deg, #10B981 0%, #059669 45%, #2563EB 100%)',
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
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.06] bg-white/60 px-3 py-1 text-[11px] font-semibold text-[#475569] backdrop-blur-md dark:border-white/10 dark:bg-white/[0.06] dark:text-[#CBD5E1]">
                    <Icon paths={I.cpu} size={12} strokeWidth={2.1} />
                    {t('face.appleNeuralBiometrics')}
                  </span>
                </div>

                <h1 className="mt-2.5 text-2xl font-extrabold tracking-tight text-[#0F172A] sm:text-[30px] sm:leading-tight dark:text-[#F8FAFC]">
                  {t('faceEnrollment.title')}
                </h1>
                <p className="mt-1 max-w-2xl text-[13.5px] font-medium leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
                  {t('faceEnrollment.subtitle')}
                </p>
              </div>
            </div>

            {/* Live Neural Telemetry & Hub Mode Switcher */}
            <div className="flex flex-wrap items-center gap-3 self-stretch sm:self-auto">
              <div className="inline-flex items-center rounded-2xl border border-black/10 bg-black/5 p-1 dark:border-white/10 dark:bg-white/5">
                <SafeLink
                  to="/face"
                  className="inline-flex h-9 items-center gap-2 rounded-xl px-3.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                >
                  <Icon paths={I.camera} size={14} />
                  <span>Face ID Terminal</span>
                </SafeLink>
                <div className="inline-flex h-9 items-center gap-2 rounded-xl bg-white px-3.5 text-xs font-bold text-[var(--text-primary)] shadow-sm dark:bg-white/15">
                  <Icon paths={I.sparkles} size={14} className="text-[#10B981] dark:text-[#34D399]" />
                  <span>Ro‘yxatga Olish</span>
                </div>
              </div>

              <div className={cn(LIQUID_INSET, 'flex items-center gap-3.5 px-4 py-3')}>
                <div className="relative flex h-3 w-3 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#10B981] opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#10B981] shadow-[0_0_8px_#10B981]" />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#64748B] dark:text-[#94A3B8]">
                    TrueDepth LiDAR Engine
                  </div>
                  <div className="text-[12.5px] font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                    {form.enrollmentId ? 'Skanerlash Faol • 128-D' : 'Tayyor • AES-256 Vektor'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ============================================================
          KPI SUMMARY BENTO BAR
      ============================================================ */}
      <motion.div
        variants={containerVariants}
        className="grid grid-cols-2 gap-3.5 sm:grid-cols-4"
      >
        <KpiCard
          label="Jami Ro‘yxatdan O‘tganlar"
          value={stats.total}
          secondary="Barcha biometrik yozuvlar"
          icon={I.users}
          color={{
            fg: '#2563EB',
            bg: 'rgba(37,99,235,0.12)',
            border: 'rgba(37,99,235,0.28)',
            glow: 'rgba(37,99,235,0.28)',
          }}
        />
        <KpiCard
          label="Faol Face IDlar"
          value={stats.active}
          secondary="Tasdiqlangan va shifrlangan"
          icon={I.shieldCheck}
          color={{
            fg: '#10B981',
            bg: 'rgba(16,185,129,0.12)',
            border: 'rgba(16,185,129,0.28)',
            glow: 'rgba(16,185,129,0.28)',
          }}
        />
        <KpiCard
          label="Talabalar Qamrovi"
          value={`${stats.coverage}%`}
          secondary={`${stats.active} / ${studentList.length} talaba`}
          progress={stats.coverage}
          icon={I.activity}
          color={{
            fg: '#6366F1',
            bg: 'rgba(99,102,241,0.12)',
            border: 'rgba(99,102,241,0.28)',
            glow: 'rgba(99,102,241,0.28)',
          }}
        />
        <KpiCard
          label="Bekor Qilingan"
          value={stats.revoked}
          secondary="Operator tomonidan o‘chirilgan"
          icon={I.xCircle}
          color={{
            fg: '#EF4444',
            bg: 'rgba(239,68,68,0.12)',
            border: 'rgba(239,68,68,0.28)',
            glow: 'rgba(239,68,68,0.25)',
          }}
        />
      </motion.div>

      {/* ============================================================
          MAIN SPATIAL STUDIO GRID
      ============================================================ */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* LEFT COLUMN: Biometric Capture Studio */}
        <motion.div variants={cardVariants} className="space-y-4 lg:col-span-6">
          <div className={cn(LIQUID_PANEL, 'p-6 sm:p-7')}>
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
                  <h2 className="text-[16px] font-bold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
                    {t('faceEnrollment.newEnrollment')}
                  </h2>
                  <p className="text-[12px] font-medium text-[#64748B] dark:text-[#94A3B8]">
                    Yuz ma’lumotlarini yuqori aniqlikda skanerlash va shifrlash
                  </p>
                </div>
              </div>

              {/* Step Pill */}
              <span className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.06] bg-white/75 px-3 py-1 text-[11px] font-bold text-[#0F172A] shadow-xs dark:border-white/10 dark:bg-white/[0.06] dark:text-white">
                Bosqich {displayedStepNumber} / 3
              </span>
            </div>

            {/* 3-Step Guided Biometric Progress Rail */}
            <div className="relative mt-4 grid grid-cols-3 gap-1.5 sm:gap-2">
              {[
                { step: 1, title: '1. Talaba' },
                { step: 2, title: '2. Sessiya' },
                { step: 3, title: '3. Scan' },
              ].map((item) => {
                const active = currentStep >= item.step;
                const isCompleted = currentStep > item.step;
                const isCurrent = displayedStepNumber === item.step && !captureSucceeded;
                return (
                  <div
                    key={item.step}
                    className={cn(
                      'flex items-center gap-1.5 rounded-xl border px-2 py-1.5 text-[10.5px] font-bold transition-all sm:gap-2 sm:px-3 sm:py-2 sm:text-[11.5px]',
                      isCurrent
                        ? 'border-[#10B981]/45 bg-[#10B981]/12 text-[#059669] shadow-[0_4px_14px_-4px_rgba(16,185,129,0.25)] dark:text-[#34D399]'
                        : active
                          ? 'border-[#10B981]/25 bg-[#10B981]/[0.06] text-[#10B981]'
                          : 'border-black/[0.05] bg-black/[0.02] text-[#64748B] dark:border-white/[0.06] dark:bg-white/[0.02]',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px]',
                        active
                          ? 'bg-[#10B981] text-white'
                          : 'bg-black/10 text-[#64748B] dark:bg-white/10',
                      )}
                    >
                      {isCompleted ? '✓' : item.step}
                    </span>
                    <span className="truncate">{item.title}</span>
                  </div>
                );
              })}
            </div>

            <div className="relative mt-5 space-y-4">
              {/* Student selector */}
              <GlassField
                label={t('faceEnrollment.student')}
                required
                error={formErrors.studentId}
              >
                {studentList.length > 5 && !form.enrollmentId && (
                  <div className="relative mb-2">
                    <input
                      type="text"
                      role="searchbox"
                      value={studentSearchQuery}
                      onChange={(e) => setStudentSearchQuery(e.target.value)}
                      placeholder="O‘quvchi ismini tezkor qidirish..."
                      className="w-full rounded-xl border border-black/[0.08] bg-black/[0.025] px-3 py-1.5 text-xs text-[#0F172A] placeholder-[#94A3B8] outline-none transition-colors focus:border-[#10B981] dark:border-white/[0.1] dark:bg-white/[0.035] dark:text-[#F8FAFC]"
                    />
                  </div>
                )}
                <div className="relative">
                  <GlassSelect
                    value={form.studentId}
                    onChange={handleStudentChange}
                    aria-invalid={Boolean(formErrors.studentId)}
                    aria-describedby={formErrors.studentId ? 'student-error' : undefined}
                    disabled={isStartPending || isCapturePending || Boolean(form.enrollmentId)}
                    className="w-full pl-3"
                  >
                    <option value="">{t('faceEnrollment.selectStudent')}</option>
                    {selectableStudents.map((student) => (
                      <option key={student.id} value={student.id}>
                        {formatStudentName(student)}
                      </option>
                    ))}
                  </GlassSelect>
                </div>
                {formErrors.studentId && (
                  <span
                    id="student-error"
                    className="mt-1.5 block text-[12px] font-semibold text-[#EF4444]"
                  >
                    {formErrors.studentId}
                  </span>
                )}
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
                    className={cn(
                      LIQUID_INSET,
                      'flex items-center justify-between gap-3 p-3.5',
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-[13px] font-extrabold text-white shadow-md"
                        style={{
                          background: getAvatarGradient(formatStudentName(selectedStudent)),
                          boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.45)',
                        }}
                      >
                        {getInitials(formatStudentName(selectedStudent))}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px] font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                          {formatStudentName(selectedStudent)}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8]">
                          <span className="font-mono">
                            ID: {selectedStudent.id.slice(0, 12)}…
                          </span>
                        </div>
                      </div>
                    </div>

                    <span className="shrink-0 rounded-full border border-[#10B981]/30 bg-[#10B981]/10 px-2.5 py-1 text-[10.5px] font-bold text-[#10B981]">
                      Tanlandi
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Start enrollment button or Active LiDAR session view */}
              {!form.enrollmentId ? (
                <GlassButton
                  type="button"
                  variant="primary"
                  className="w-full justify-center py-3.5 text-[13.5px] font-bold shadow-[0_12px_28px_-8px_rgba(37,99,235,0.45)]"
                  onClick={handleStartEnrollment}
                  disabled={!form.studentId || isStartPending}
                >
                  <span className="inline-flex items-center gap-2">
                    {isStartPending ? (
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
              ) : (
                <div className="space-y-4 pt-1">
                  {/* Dynamic Island Active Telemetric Bar */}
                  <div className="flex items-center justify-between gap-2 rounded-2xl border border-[#10B981]/35 bg-gradient-to-r from-[#10B981]/15 via-[#10B981]/[0.07] to-transparent px-4 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
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
                    <GlassButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={t('common.cancel')}
                      onClick={handleCancelEnrollment}
                      disabled={isCapturePending}
                    >
                      {t('common.cancel')}
                    </GlassButton>
                  </div>

                  {/* Apple Face ID LiDAR Viewfinder Frame */}
                  <div className="relative overflow-hidden rounded-[2.35rem] border border-white/60 bg-black/5 p-1.5 shadow-[0_20px_50px_-12px_rgba(16,185,129,0.22),inset_0_1px_1px_rgba(255,255,255,0.6)] dark:border-white/15 dark:bg-white/[0.03]">
                    {/* LiDAR HUD Corner Reticles */}
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
                      className="pointer-events-none absolute bottom-4 left-4 z-20 h-6 w-6 rounded-bl-xl border-b-2 border-l-2 border-[#10B981]/85 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                    />
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute bottom-4 right-4 z-20 h-6 w-6 rounded-br-xl border-b-2 border-r-2 border-[#10B981]/85 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                    />

                    {/* TrueDepth Laser Sweep during capture */}
                    {isCapturePending && !reduced && (
                      <motion.div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-4 z-20 h-0.5 bg-gradient-to-r from-transparent via-[#10B981] to-transparent shadow-[0_0_16px_#10B981]"
                        initial={{ top: '10%' }}
                        animate={{ top: ['10%', '88%', '10%'] }}
                        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    )}

                    {/* Apple TrueDepth Biometric Oval Guide */}
                    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                      <div
                        className={cn(
                          'h-48 w-40 rounded-[50%] border-2 border-dashed transition-all duration-300',
                          isCapturePending
                            ? 'border-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.55)] animate-pulse'
                            : 'border-white/35 shadow-[0_0_15px_rgba(255,255,255,0.15)]'
                        )}
                      />
                    </div>

                    <WebcamCapture
                      onCapture={handleCapture}
                      busy={isCapturePending}
                      label={t('faceEnrollment.captureFace')}
                    />

                    {/* Success celebratory Liquid Glass overlay */}
                    <AnimatePresence>
                      {captureSucceeded && (
                        <motion.div
                          key="enrollment-success-overlay"
                          initial={{ opacity: 0, scale: 0.92 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          transition={SPRING.smooth}
                          className="absolute inset-0 z-30 flex flex-col items-center justify-center rounded-[2.25rem] bg-[#0B0F1A]/85 p-6 text-center text-white backdrop-blur-2xl"
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
                            Face ID Muvaffaqiyatli Saqlandi!
                          </h3>
                          <p className="mt-1 max-w-xs text-[13px] font-medium text-white/80">
                            Biometrik xususiyatlar shifrlanib, o‘quvchi profiliga biriktirildi.
                          </p>
                          {lastCaptureStats && (
                            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                              {lastCaptureStats.qualityScore !== undefined && (
                                <span className="rounded-full border border-emerald-400/40 bg-emerald-500/20 px-3 py-1 text-[11.5px] font-bold text-emerald-300 backdrop-blur-md">
                                  Sifat: {Math.round(lastCaptureStats.qualityScore * 100)}%
                                </span>
                              )}
                              {lastCaptureStats.livenessResult && (
                                <span className="rounded-full border border-emerald-400/40 bg-emerald-500/20 px-3 py-1 text-[11.5px] font-bold text-emerald-300 backdrop-blur-md">
                                  Anti-Spoof: {lastCaptureStats.livenessResult}
                                </span>
                              )}
                            </div>
                          )}
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

                  {/* Single Unified Error Alert with Liveness Guidance */}
                  {capture.isError && (
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
                        <span>{friendlyFaceError(capture.error as Error)}</span>
                      </div>
                      {(String((capture.error as Error)?.message || '')
                        .toLowerCase()
                        .includes('liveness') ||
                        friendlyFaceError(capture.error as Error)
                          .toLowerCase()
                          .includes('liveness')) && (
                        <p className="pl-6 text-[11.5px] font-medium text-[#EF4444]/85">
                          Tavsiya: Xona yorug‘ligini yaxshilang, ekranga juda yaqin turmang va
                          kameraga to‘g‘ridan-to‘g‘ri qarang.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Privacy & Safety Note */}
            <div className={cn(LIQUID_INSET, 'mt-5 p-3.5')}>
              <div className="flex items-start gap-2.5 text-[12px] font-medium leading-5 text-[#64748B] dark:text-[#94A3B8]">
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
        <motion.div variants={cardVariants} className="space-y-4 lg:col-span-6">
          <div className={cn(LIQUID_PANEL, 'flex h-full flex-col p-6 sm:p-7')}>
            <SpecularRim />

            {/* Header + Search bar */}
            <div className="relative flex flex-col gap-3.5 border-b border-black/[0.06] pb-4 dark:border-white/[0.08]">
              <div className="flex items-center justify-between gap-2">
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
                    <h2 className="text-[16px] font-bold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
                      {t('faceEnrollment.listTitle')}
                    </h2>
                    <p className="text-[12px] font-medium text-[#64748B] dark:text-[#94A3B8]">
                      Ro‘yxatdan o‘tgan o‘quvchilar ({filteredEnrollments.length})
                    </p>
                  </div>
                </div>

                <motion.button
                  type="button"
                  whileTap={reduced ? undefined : { scaleX: 1.05, scaleY: 0.92 }}
                  transition={SPRING.gel}
                  onClick={handleExportCsv}
                  disabled={filteredEnrollments.length === 0}
                  aria-label="CSV Eksport"
                  title="CSV Eksport"
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-2xl border border-black/[0.08] bg-white/75 px-3.5 py-2 text-xs font-bold text-[#0F172A] shadow-xs backdrop-blur-xl transition-all hover:bg-white hover:text-[#2563EB] disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.04] dark:text-[#F8FAFC] dark:hover:bg-white/[0.08]"
                >
                  <Icon paths={I.download} size={14} strokeWidth={2.2} />
                  <span>CSV Eksport</span>
                </motion.button>
              </div>

              {/* Search & Segmented Filter Pills */}
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B]">
                    <Icon paths={I.search} size={14} strokeWidth={2.2} />
                  </div>
                  <input
                    type="text"
                    role="searchbox"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Talabani qidirish..."
                    className="w-full rounded-2xl border border-black/[0.08] bg-white/75 py-2.5 pl-9 pr-3.5 text-[12.5px] font-semibold text-[#0F172A] placeholder-[#64748B] shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] outline-none backdrop-blur-xl transition-all focus:border-[#2563EB] focus:bg-white focus:ring-2 focus:ring-[#2563EB]/15 dark:border-white/10 dark:bg-white/[0.04] dark:text-[#F8FAFC] dark:focus:bg-white/[0.08]"
                  />
                </div>

                {/* Segmented Control with Isolated LayoutGroup */}
                <LayoutGroup id="face-enrollment-status-tabs">
                  <div className="relative inline-flex items-center rounded-2xl border border-black/[0.06] bg-black/[0.04] p-1 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05]">
                    {(['ALL', 'ACTIVE', 'REVOKED'] as const).map((tab) => {
                      const isSelected = statusFilter === tab;
                      return (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => {
                            soundRef.current.playTick?.();
                            setStatusFilter(tab);
                          }}
                          className={cn(
                            'relative z-10 rounded-xl px-3 py-1.5 text-[11px] font-bold transition-colors',
                            isSelected
                              ? 'text-[#0F172A] dark:text-white'
                              : 'text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-white',
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
                          {tab === 'ALL' ? 'Barchasi' : tab === 'ACTIVE' ? 'Faol' : 'Bekor'}
                        </button>
                      );
                    })}
                  </div>
                </LayoutGroup>
              </div>
            </div>

            {/* List content */}
            <div className="relative mt-4 max-h-[560px] flex-1 overflow-y-auto pr-0.5">
              {enrollments.isLoading && !enrollments.data ? (
                <div className="py-12">
                  <GlassPageLoader label={t('faceEnrollment.loading')} />
                </div>
              ) : enrollments.isError ? (
                <div className="py-8">
                  <GlassErrorState
                    title={t('faceEnrollment.loadError')}
                    message={getErrorMessage(enrollments.error as Error)}
                    onRetry={handleRetryEnrollments}
                  />
                </div>
              ) : filteredEnrollments.length === 0 ? (
                <div className="py-12">
                  <GlassEmptyState
                    title={t('faceEnrollment.empty')}
                    message={t('faceEnrollment.emptyHint')}
                  />
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredEnrollments.map((enrollment) => {
                    const statusBadge = getEnrollmentStatusBadge(enrollment.status);
                    const isRevokingThis = isRevoking && revoke.variables === enrollment.id;
                    const studentName = formatStudentName(enrollment.student);

                    return (
                      <motion.div
                        key={enrollment.id}
                        whileHover={{ y: -1.5, scale: 1.004 }}
                        transition={SPRING.snappy}
                        className="group relative flex items-center justify-between gap-3 rounded-[1.35rem] border border-white/75 bg-white/65 p-3.5 shadow-[0_4px_16px_-6px_rgba(15,23,42,0.05),inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-xl transition-all hover:border-[#10B981]/35 hover:bg-white/90 dark:border-white/[0.08] dark:bg-white/[0.03] dark:shadow-none dark:hover:border-white/[0.16] dark:hover:bg-white/[0.06]"
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

                          <div className="min-w-0">
                            <h4 className="truncate text-[14px] font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                              {studentName}
                            </h4>
                            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8]">
                              <span>{formatDate(enrollment.enrolledAt)}</span>
                              <span>•</span>
                              <GlassBadge color={statusBadge.color}>
                                {statusBadge.labelKey
                                  ? t(statusBadge.labelKey)
                                  : enrollment.status}
                              </GlassBadge>
                            </div>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <motion.button
                            type="button"
                            whileTap={reduced ? undefined : { scaleX: 1.06, scaleY: 0.9 }}
                            transition={SPRING.gel}
                            onClick={() => handleOpenEnrollmentSidecar(enrollment)}
                            aria-label={`${studentName} — Split View Sidecar`}
                            title="Split View Sidecar"
                            className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-black/[0.06] bg-white/75 text-[#64748B] shadow-xs transition-all hover:border-[#10B981]/40 hover:bg-[#10B981]/10 hover:text-[#10B981] dark:border-white/10 dark:bg-white/[0.05] dark:hover:bg-white/10"
                          >
                            <Icon paths={I.sidebar} size={15} strokeWidth={2} />
                          </motion.button>
                          {enrollment.status === 'ACTIVE' && (
                            <GlassButton
                              type="button"
                              variant="danger"
                              size="sm"
                              className="min-h-[44px]"
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