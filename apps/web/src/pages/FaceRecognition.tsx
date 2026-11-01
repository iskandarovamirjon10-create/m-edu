/**
 * M-EDU Face ID Recognition Page
 * Real-time biometric attendance terminal with turnstile integration and offline kiosk mode.
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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { faceApi, groupsApi, studentsApi } from '@/lib/api';
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
 * ANIMATION TOKENS — Apple Glass Fluid Springs
 * ========================================================================== */

const SPRING = {
  snappy: { type: 'spring', stiffness: 520, damping: 32, mass: 0.65 },
  smooth: { type: 'spring', stiffness: 360, damping: 30, mass: 0.85 },
  soft:   { type: 'spring', stiffness: 220, damping: 28, mass: 1.0 },
} as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.02 },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.99 },
  visible: { opacity: 1, y: 0, scale: 1, transition: SPRING.smooth },
};

/* ============================================================================
 * CONSTANTS & TYPES
 * ========================================================================== */

const BANNER_MS = 4200;

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
    user?: { firstName?: string; lastName?: string };
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

export function resolveRecognitionOutcome(
  attempt: any,
): RecognitionOutcome {
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
  student?: { firstName?: string; lastName?: string; name?: string; user?: { firstName?: string; lastName?: string } } | null,
): string {
  if (!student) return '—';
  if (student.name) return student.name;
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

/* ============================================================================
 * CUSTOM SVG ICONS (Apple SVG Icons)
 * ========================================================================== */

function Icon({ paths, size = 18, strokeWidth = 2, className = '' }: { paths: string[]; size?: number; strokeWidth?: number; className?: string }) {
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
  maximize: ['M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3'],
  minimize: ['M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3'],
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
  copy: ['M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2', 'M15 2H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z'],
  download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3'],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.35-4.35'],
  soundOn: ['M11 5L6 9H2v6h4l5 4V5z', 'M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07'],
  soundOff: ['M11 5L6 9H2v6h4l5 4V5z', 'M23 9l-6 6', 'M17 9l6 6'],
  chevronRight: ['M9 18l6-6-6-6'],
  layers: ['M12 2 2 7l10 5 10-5z', 'M2 17l10 5 10-5', 'M2 12l10 5 10-5'],
  shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'],
  lock: ['M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z', 'M7 11V7a5 5 0 0 1 10 0v4'],
};

/* ============================================================================
 * ISOLATED SUBCOMPONENTS
 * ========================================================================== */

const LiveClockPill = memo(function LiveClockPill() {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  );
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3.5 py-1.5 font-mono text-xs font-semibold text-white/90 backdrop-blur-xl shadow-inner">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <span>{time}</span>
    </div>
  );
});

const SessionChronometer = memo(function SessionChronometer({ startedAt }: { startedAt: number | null }) {
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
 * TRUEDEPTH HUD OVERLAY (Apple Face ID Viewfinder)
 * ========================================================================== */

interface TrueDepthHUDProps {
  busy: boolean;
  reduced: boolean;
  statusKind?: OutcomeKind;
}

const TrueDepthHUD = memo(function TrueDepthHUD({ busy, reduced, statusKind }: TrueDepthHUDProps) {
  const isIdentified = statusKind === 'success';
  const isFailed = statusKind === 'unknown' || statusKind === 'denied';

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {/* 1. Ambient Dynamic Ring Meniscus */}
      <div
        className={cn(
          'absolute inset-0 transition-opacity duration-700',
          isIdentified
            ? 'opacity-100 shadow-[inset_0_0_60px_rgba(52,199,89,0.35)]'
            : isFailed
              ? 'opacity-100 shadow-[inset_0_0_60px_rgba(255,59,48,0.35)]'
              : busy
                ? 'opacity-100 shadow-[inset_0_0_50px_rgba(0,122,255,0.3)]'
                : 'opacity-0',
        )}
      />

      {/* 2. Apple Face ID Holographic Viewfinder Frame */}
      <div className="absolute inset-6 sm:inset-10 flex items-center justify-center">
        <div className="relative aspect-[3/4] h-full max-h-[380px] w-full max-w-[300px]">
          {/* Dynamic Corner Reticles */}
          <div
            className={cn(
              'absolute -left-1 -top-1 h-9 w-9 rounded-tl-2xl border-l-[3.5px] border-t-[3.5px] transition-all duration-300',
              isIdentified ? 'border-emerald-400 shadow-[0_0_15px_#34C759]' : isFailed ? 'border-rose-500 shadow-[0_0_15px_#FF3B30]' : busy ? 'border-[#007AFF] shadow-[0_0_15px_#007AFF]' : 'border-white/80',
            )}
          />
          <div
            className={cn(
              'absolute -right-1 -top-1 h-9 w-9 rounded-tr-2xl border-r-[3.5px] border-t-[3.5px] transition-all duration-300',
              isIdentified ? 'border-emerald-400 shadow-[0_0_15px_#34C759]' : isFailed ? 'border-rose-500 shadow-[0_0_15px_#FF3B30]' : busy ? 'border-[#007AFF] shadow-[0_0_15px_#007AFF]' : 'border-white/80',
            )}
          />
          <div
            className={cn(
              'absolute -bottom-1 -left-1 h-9 w-9 rounded-bl-2xl border-b-[3.5px] border-l-[3.5px] transition-all duration-300',
              isIdentified ? 'border-emerald-400 shadow-[0_0_15px_#34C759]' : isFailed ? 'border-rose-500 shadow-[0_0_15px_#FF3B30]' : busy ? 'border-[#007AFF] shadow-[0_0_15px_#007AFF]' : 'border-white/80',
            )}
          />
          <div
            className={cn(
              'absolute -bottom-1 -right-1 h-9 w-9 rounded-br-2xl border-b-[3.5px] border-r-[3.5px] transition-all duration-300',
              isIdentified ? 'border-emerald-400 shadow-[0_0_15px_#34C759]' : isFailed ? 'border-rose-500 shadow-[0_0_15px_#FF3B30]' : busy ? 'border-[#007AFF] shadow-[0_0_15px_#007AFF]' : 'border-white/80',
            )}
          />

          {/* Biometric Laser Scanning Beam */}
          {busy && !reduced && (
            <motion.div
              className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-[#007AFF] to-transparent shadow-[0_0_16px_#007AFF]"
              initial={{ top: '8%' }}
              animate={{ top: ['8%', '92%', '8%'] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}

          {/* Central Alignment Crosshair Guide */}
          <div className="absolute inset-0 flex items-center justify-center opacity-40">
            <div className="relative h-20 w-20 rounded-full border border-dashed border-white/60">
              <span className="absolute -top-1 left-1/2 h-2 w-0.5 -translate-x-1/2 bg-white/70" />
              <span className="absolute -bottom-1 left-1/2 h-2 w-0.5 -translate-x-1/2 bg-white/70" />
              <span className="absolute -left-1 top-1/2 h-0.5 w-2 -translate-y-1/2 bg-white/70" />
              <span className="absolute -right-1 top-1/2 h-0.5 w-2 -translate-y-1/2 bg-white/70" />
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
  const { t } = useSafeI18n();
  usePageTitle(t('faceRecognition.title') || 'Face ID');

  const reduced = usePrefersReducedMotion();
  const { push, toastNode } = useToasts();
  const queryClient = useQueryClient();
  const { playTick, playSuccess, playError, playPayment } = usePremiumSound();
  const haptics = useHaptics();
  useAttendanceSocket();
  const { queueCount, isOnline, isSyncing, enqueue, syncQueue } = useOfflineFaceQueue();

  const [form, setForm] = useState<RecognitionFormState>(INITIAL_FORM);
  const [isKioskMode, setIsKioskMode] = useState(false);
  const [autoScan, setAutoScan] = useState(true);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const [liveBanner, setLiveBanner] = useState<LiveBanner | null>(null);
  const [liveFeed, setLiveFeed] = useState<FeedItem[]>([]);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [historyQuery, setHistoryQuery] = useState('');
  const [activeBiometricModule, setActiveBiometricModule] = useState<
    'director' | 'liveness' | 'rushHour' | 'voice' | 'telegram' | 'traffic' | null
  >(null);

  const lastCaptureTimeRef = useRef<number>(0);
  const bannerSeq = useRef(0);

  /* ── Kiosk Security & Audio Synthesis ── */
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  const speakGreeting = useCallback((name: string) => {
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const firstName = name.split(' ')[0] || name;
        const text = `Xush kelibsiz, ${firstName}!`;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.05;
        utterance.lang = 'uz-UZ';
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      }
    } catch {
      // Audio speech fallback silent
    }
  }, []);

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

  /* ── Engine status alert when unreachable ── */
  useEffect(() => {
    if (engine.isError) {
      push('error', 'Face Vision dvigateli bilan aloqa yo‘q. Tarmoqni tekshiring.');
    }
  }, [engine.isError, push]);

  const groups = useQuery({
    queryKey: queryKeys.groups.selectors(),
    queryFn: () => groupsApi.list({ limit: 100 }),
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
      // Contract invariant: consumes `sessionId`
      const sid = data?.sessionId || data?.id;
      if (!sid) {
        push('error', 'Sessiya identifikatori olinmadi');
        return;
      }
      setForm((prev) => ({ ...prev, sessionId: sid }));
      setSessionStartedAt(Date.now());
      playSuccess();
      haptics.success();
      push('success', 'Face ID sessiyasi muvaffaqiyatli boshlandi');
    },
    onError: (err: Error) => {
      playError();
      haptics.error();
      push('error', getErrorMessage(err));
    },
  });

  const finishSession = useMutation({
    mutationFn: (sid: string) => faceApi.finishSession(sid),
    onSuccess: () => {
      setForm((prev) => ({ ...prev, sessionId: '' }));
      setSessionStartedAt(null);
      setLiveBanner(null);
      playTick();
      haptics.light();
      push('success', 'Face ID sessiyasi yakunlandi');
      queryClient.invalidateQueries({ queryKey: queryKeys.face.history() });
    },
    onError: (err: Error) => {
      playError();
      push('error', getErrorMessage(err));
    },
  });

  const submit = useMutation({
    mutationFn: (imageBase64: string) =>
      faceApi.submitAttempt(form.sessionId, imageBase64),
    onSuccess: (rawResponse: any) => {
      const outcome = resolveRecognitionOutcome(rawResponse);
      const studentName = formatStudentName(rawResponse?.student);
      const studentId = rawResponse?.student?.id || rawResponse?.studentId;
      const groupName = rawResponse?.student?.groupName;
      const photoUrl = rawResponse?.student?.photoUrl;
      const confStr = formatConfidence(rawResponse?.confidence);

      let kind: OutcomeKind = 'neutral';
      if (outcome === 'SUCCESS') kind = 'success';
      else if (outcome === 'DENIED') kind = 'denied';
      else if (outcome === 'DUPLICATE') kind = 'duplicate';
      else if (outcome === 'UNKNOWN') kind = 'unknown';

      // Anti-repetition audio policy: gentle sound, no repetitive talking
      if (kind === 'success') {
        playSuccess();
        haptics.success();
      } else if (kind === 'denied' || kind === 'duplicate') {
        playTick();
        haptics.heavy();
      } else {
        haptics.light();
      }

      // Present Dynamic Island Result Banner
      bannerSeq.current += 1;
      const title =
        kind === 'success'
          ? `${studentName} — Davomat belgilandi`
          : kind === 'duplicate'
            ? `${studentName} — Allaqachon yozilgan`
            : kind === 'denied'
              ? `${studentName} — Kirish rad etildi`
              : 'Yuz tanilmadi';

      const subtitle =
        kind === 'success'
          ? `Aniqlik: ${confStr} · Guruh: ${groupName || 'Biriktirilgan'}`
          : kind === 'duplicate'
            ? 'Ushbu dars uchun davomat oldinroq kiritilgan'
            : kind === 'denied'
              ? String(rawResponse?.accessReason || 'Ruxsat yo\'q')
              : 'Iltimos, kameraga to\'g\'ri qarang';

      setLiveBanner({
        id: bannerSeq.current,
        kind,
        studentName,
        studentId,
        groupName,
        photoUrl,
        title,
        subtitle,
        confidence: rawResponse?.confidence,
        timestamp: new Date().toLocaleTimeString('uz-UZ'),
      });

      if (kind === 'success' && studentName && studentName !== '—') {
        speakGreeting(studentName);
        triggerTurnstileRelay(studentId, studentName);
      }

      // Append to live session stream
      if (studentName && studentName !== '—') {
        setLiveFeed((prev) => [
          {
            id: `feed_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            time: new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }),
            name: studentName,
            group: groupName,
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
        playTick();
        push('info', 'Ko‘p so‘rov yuborildi. Iltimos, biroz kuting...');
        return;
      }

      const isNetwork = !navigator.onLine || /network|failed to fetch|offline/i.test(err?.message || '');
      if (isNetwork && form.sessionId) {
        if (variables) {
          enqueue({ sessionId: form.sessionId, imageBase64: variables });
        }
        playTick();
        haptics.light();
        push('info', 'Tarmoq uzildi: urinish oflayn navbatga olindi');
      } else {
        playError();
        haptics.error();
        const friendlyMsg = friendlyFaceError(err);
        push('error', friendlyMsg);
        bannerSeq.current += 1;
        setLiveBanner({
          id: bannerSeq.current,
          kind: 'unknown',
          title: 'Qayta urinib ko‘ring',
          subtitle: friendlyMsg,
          timestamp: new Date().toLocaleTimeString('uz-UZ'),
        });
      }
    },
  });

  /* ── Automatic & Manual Offline Queue Sync ── */
  useEffect(() => {
    if (isOnline && queueCount > 0 && !isSyncing) {
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
      }).then(({ synced }) => {
        if (synced > 0) {
          push('success', `${synced} ta oflayn davomat sinxronlandi`);
          queryClient.invalidateQueries({ queryKey: queryKeys.face.history() });
          queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all() });
        }
      }).catch(() => {
        // Suppress unhandled rejections during background retry
      });
    }
  }, [isOnline, queueCount, isSyncing, syncQueue, push, queryClient, form.sessionId]);

  const handleManualSync = useCallback(() => {
    if (queueCount === 0 || isSyncing || !isOnline) return;
    playTick();
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
    }).then(({ synced }) => {
      if (synced > 0) {
        push('success', `${synced} ta oflayn davomat sinxronlandi`);
        queryClient.invalidateQueries({ queryKey: queryKeys.face.history() });
        queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all() });
      }
    }).catch((err: any) => {
      push('error', friendlyFaceError(err));
    });
  }, [queueCount, isSyncing, isOnline, playTick, syncQueue, push, queryClient, form.sessionId]);

  const handleCapture = useCallback(
    (base64: string) => {
      if (!form.sessionId || submit.isPending) return;
      const now = Date.now();
      if (now - lastCaptureTimeRef.current < 1500) return;
      lastCaptureTimeRef.current = now;

      if (!isOnline) {
        enqueue({ sessionId: form.sessionId, imageBase64: base64 });
        playTick();
        haptics.light();
        push('info', `Internet yo‘q: Rasm oflayn saqlandi (Navbatda: ${queueCount + 1})`);
        return;
      }

      submit.mutate(base64);
    },
    [form.sessionId, submit, isOnline, enqueue, queueCount, playTick, haptics, push],
  );

  const handleCardScan = useCallback(
    async (code: string) => {
      try {
        const res = (await studentsApi.list({ search: code, limit: 1 })) as Paginated<Student>;
        const student = res?.items?.[0];

        if (!student) {
          playError();
          haptics.error();
          push('error', `Karta topilmadi: "${code}" raqamli o'quvchi bazada yo'q`);
          return;
        }

        const studentName = formatStudentName(student);
        const groupName = student.groups?.[0]?.group?.name || 'Biriktirilgan';
        const photoUrl = (student as any).photoUrl || (student as any).user?.avatarUrl;

        playPayment();
        haptics.heavy();
        speakGreeting(studentName);
        triggerTurnstileRelay(student.id, studentName);

        // Display Result Banner
        bannerSeq.current += 1;
        setLiveBanner({
          id: bannerSeq.current,
          kind: 'success',
          studentName,
          studentId: student.id,
          groupName,
          photoUrl,
          title: `${studentName} — Karta orqali tasdiqlandi`,
          subtitle: `RFID / Barcode: ${code} · Guruh: ${groupName}`,
          confidence: 1.0,
          timestamp: new Date().toLocaleTimeString('uz-UZ'),
        });

        // Append to live feed
        setLiveFeed((prev) => [
          {
            id: `feed_card_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            time: new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }),
            name: `${studentName} (RFID)`,
            group: groupName,
            confidence: '100% (Card)',
            kind: 'success',
            studentId: student.id,
            studentRef: student,
          },
          ...prev.slice(0, 24),
        ]);

        push('success', `💳 ${studentName}: Turniket ochildi`);
        queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all() });
      } catch (err: unknown) {
        playError();
        push('error', `Karta skanerlashda xatolik: ${getErrorMessage(err)}`);
      }
    },
    [playError, playPayment, haptics, speakGreeting, triggerTurnstileRelay, push, queryClient],
  );

  const { isNfcActive } = useHardwareCardScanner({
    enabled: true,
    onScan: handleCardScan,
  });

  const handleStartSession = useCallback(() => {
    playTick();
    startSession.mutate();
  }, [playTick, startSession]);

  const handleFinishSession = useCallback(() => {
    if (!form.sessionId) return;
    playTick();
    finishSession.mutate(form.sessionId);
  }, [form.sessionId, playTick, finishSession]);

  /* ── Kiosk Mode Fullscreen Controls & Anti-Tamper Security ── */
  const handleEnterKiosk = useCallback(() => {
    setIsKioskMode(true);
    haptics.medium();
    if (!form.sessionId && !startSession.isPending) {
      startSession.mutate();
    }
    try {
      if (typeof document !== 'undefined' && document.documentElement.requestFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch {
      // Graceful fallback if fullscreen is blocked by browser policy
    }
  }, [haptics, form.sessionId, startSession]);

  const actuallyExitKiosk = useCallback(() => {
    setIsPinModalOpen(false);
    setIsKioskMode(false);
    haptics.light();
    try {
      if (typeof document !== 'undefined' && document.exitFullscreen && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    } catch {
      // Graceful fallback
    }
  }, [haptics]);

  const requestExitKiosk = useCallback(() => {
    setPinInput('');
    setPinError(false);
    setIsPinModalOpen(true);
  }, []);

  const handlePinSubmit = useCallback((enteredPin: string) => {
    const configuredPin = typeof window !== 'undefined' ? localStorage.getItem('m_edu_kiosk_pin') || '1234' : '1234';
    if (enteredPin === configuredPin) {
      playSuccess();
      actuallyExitKiosk();
    } else {
      playError();
      haptics.error();
      setPinError(true);
      setPinInput('');
    }
  }, [playSuccess, playError, haptics, actuallyExitKiosk]);

  /* ── PIN Keypad Listener ── */
  useEffect(() => {
    if (!isPinModalOpen) return;
    const onPinKey = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        if (pinInput.length < 4) {
          playTick();
          haptics.light();
          const next = pinInput + e.key;
          setPinInput(next);
          setPinError(false);
          if (next.length === 4) {
            handlePinSubmit(next);
          }
        }
      } else if (e.key === 'Backspace') {
        playTick();
        haptics.light();
        setPinInput((p) => p.slice(0, -1));
        setPinError(false);
      } else if (e.key === 'Escape') {
        setIsPinModalOpen(false);
        setPinInput('');
        setPinError(false);
        if (isKioskMode && typeof document !== 'undefined' && !document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      }
    };
    window.addEventListener('keydown', onPinKey);
    return () => window.removeEventListener('keydown', onPinKey);
  }, [isPinModalOpen, pinInput, playTick, haptics, handlePinSubmit, isKioskMode]);

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
      const target = e.target as HTMLElement;
      const isInput = /INPUT|TEXTAREA|SELECT/.test(target?.tagName || '') || target?.isContentEditable;
      if (e.key === 'Escape' && isKioskMode && !isPinModalOpen) {
        e.preventDefault();
        requestExitKiosk();
        return;
      }
      if (isInput || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() === 'k') {
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
          haptics.light();
          push('success', 'Sessiya identifikatori nusxalandi');
        })
        .catch(() => {
          push('error', "Nusxalab bo'lmadi");
        });
    }
  }, [form.sessionId, haptics, push]);

  const handleGroupChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, groupId: e.target.value }));
  }, []);

  const handleOpenStudentSidecar = useCallback((studentId?: string, studentName?: string) => {
    if (!studentId) return;
    const payload: QuickLookData = {
      type: 'student',
      id: studentId,
      title: studentName || 'O\'quvchi',
      subtitle: '360° Karta & Biometriya',
    };
    openSidecar(payload);
  }, []);

  const isSessionActive = Boolean(form.sessionId);

  /* ── Derived: Stats ── */
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
      if (historyFilter === 'failed' && outcome === 'SUCCESS') return false;
      if (q && !formatStudentName(a.student).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [historyList, historyFilter, historyQuery]);

  const handleExportCsv = useCallback(() => {
    if (filteredHistory.length === 0) return;
    const rows = [
      ['Vaqt', 'O\'quvchi', 'Holat', 'Aniqlik'],
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
    haptics.light();
    push('success', 'CSV fayl muvaffaqiyatli yuklandi');
  }, [filteredHistory, haptics, push]);

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
       * 1. FULLSCREEN ENTERPRISE TURNSTILE KIOSK (Apple Glass)
       * ════════════════════════════════════════════════════════════════ */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {isKioskMode && (
              <motion.div
                key="face-kiosk-view"
                role="dialog"
                aria-modal="true"
                aria-label="Face ID Turnstile Kiosk"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={SPRING.smooth}
                className="fixed inset-0 z-[99999] flex select-none flex-col overflow-hidden text-white"
                style={{ backgroundColor: '#060912' }}
              >
                {/* Volumetric ambient background orbs */}
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
                  <div className="absolute -top-[25%] left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(0,122,255,0.22)_0%,rgba(175,82,222,0.14)_45%,transparent_70%)] blur-3xl" />
                  <div className="absolute -bottom-[20%] right-[-10%] h-[550px] w-[650px] rounded-full bg-[radial-gradient(circle,rgba(52,199,89,0.18)_0%,transparent_65%)] blur-3xl" />
                </div>

                {/* Kiosk Header Bar */}
                <header className="relative z-20 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-[#0B0F19]/95 px-6 py-3.5 backdrop-blur-3xl">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#007AFF] to-[#5856D6] text-white shadow-lg shadow-[#007AFF]/35 ring-1 ring-white/30">
                      <Icon paths={I.faceId} size={22} strokeWidth={2.2} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h1 className="text-base font-bold tracking-tight text-white">M-EDU Face ID</h1>
                        {!isOnline ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300 ring-1 ring-amber-500/40">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
                            Oflayn rejim ({queueCount} ta navbatda)
                          </span>
                        ) : queueCount > 0 ? (
                          <button
                            type="button"
                            onClick={handleManualSync}
                            disabled={isSyncing}
                            className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-sky-300 ring-1 ring-sky-500/40 hover:bg-sky-500/30"
                          >
                            <span className={cn('h-1.5 w-1.5 rounded-full bg-sky-400', isSyncing && 'animate-spin')} />
                            {isSyncing ? 'Sinxronlanmoqda...' : `Sinxronlash (${queueCount})`}
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
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
                      onClick={() => setAutoScan((s) => !s)}
                      className={cn(
                        'inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition-all',
                        autoScan
                          ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300'
                          : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10',
                      )}
                    >
                      <Icon paths={I.sparkles} size={14} />
                      <span>{autoScan ? 'Avto-skan: Faol' : 'Qo\'lda'}</span>
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
                        aria-label={t('faceRecognition.startSession') || 'Start recognition session'}
                        className="inline-flex h-9 items-center gap-2 rounded-xl bg-gradient-to-r from-[#007AFF] to-[#5E5CE6] px-4 text-xs font-bold text-white shadow-md shadow-[#007AFF]/40 hover:opacity-90"
                      >
                        <Icon paths={I.play} size={13} strokeWidth={2.5} />
                        <span>{t('faceRecognition.startSession') || 'Sessiyani boshlash'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={requestExitKiosk}
                      className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3.5 text-xs font-semibold text-white hover:bg-white/20 transition-colors"
                    >
                      <Icon paths={I.minimize} size={15} />
                      <span>Chiqish</span>
                      <kbd className="rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-white/60">Esc</kbd>
                    </button>
                  </div>
                </header>

                {/* Kiosk Main Stage */}
                <main className="relative z-10 grid min-h-0 flex-1 grid-cols-1 gap-4 p-3 sm:gap-6 sm:p-6 lg:grid-cols-[1fr_380px]">
                  {/* Viewfinder Column */}
                  <div className="relative flex flex-col items-center justify-center">
                    {isSessionActive ? (
                      <div className="relative flex w-full max-w-2xl flex-col items-center">
                        {/* Viewfinder Glass Pod */}
                        <div className="relative w-full overflow-hidden rounded-[2.5rem] border border-white/20 bg-black/50 shadow-2xl shadow-black/80 ring-1 ring-white/10">
                          <WebcamCapture
                            onCapture={handleCapture}
                            busy={submit.isPending}
                            autoScan={autoScan}
                            onAutoScanToggle={() => setAutoScan((s) => !s)}
                            showAutoScanToggle={false}
                            isKiosk={true}
                            label="Yuzni tanish"
                          />
                          <TrueDepthHUD busy={submit.isPending} reduced={reduced} statusKind={liveBanner?.kind} />

                          {/* Morphing Dynamic Island Floating Overlay */}
                          <AnimatePresence>
                            {liveBanner && (
                              <motion.div
                                key={liveBanner.id}
                                initial={{ opacity: 0, y: -24, scale: 0.94 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -16, scale: 0.96 }}
                                transition={SPRING.snappy}
                                className="pointer-events-auto absolute inset-x-4 top-4 z-40 mx-auto max-w-lg"
                              >
                                <div
                                  className={cn(
                                    'flex items-center justify-between gap-4 rounded-3xl border p-4 backdrop-blur-3xl shadow-2xl transition-all',
                                    liveBanner.kind === 'success'
                                      ? 'border-emerald-500/40 bg-[#0B2117]/90 text-white shadow-emerald-500/20'
                                      : liveBanner.kind === 'duplicate'
                                        ? 'border-amber-500/40 bg-[#251A0A]/90 text-white shadow-amber-500/20'
                                        : liveBanner.kind === 'denied'
                                          ? 'border-rose-500/40 bg-[#250A0E]/90 text-white shadow-rose-500/20'
                                          : 'border-white/20 bg-black/80 text-white',
                                  )}
                                >
                                  <div className="flex items-center gap-3.5 min-w-0">
                                    <div
                                      className={cn(
                                        'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-base font-bold shadow-inner',
                                        liveBanner.kind === 'success'
                                          ? 'bg-gradient-to-tr from-emerald-500 to-teal-400 text-white ring-2 ring-emerald-400/50'
                                          : liveBanner.kind === 'duplicate'
                                            ? 'bg-gradient-to-tr from-amber-500 to-orange-400 text-white'
                                            : 'bg-gradient-to-tr from-rose-500 to-red-400 text-white',
                                      )}
                                    >
                                      {liveBanner.kind === 'success' ? (
                                        <Icon paths={I.check} size={24} strokeWidth={3} />
                                      ) : (
                                        getInitials(liveBanner.studentName || '')
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <h4 className="truncate text-base font-bold tracking-tight">
                                        {liveBanner.studentName || 'Yuz tanilmadi'}
                                      </h4>
                                      <p className="truncate text-xs opacity-80">{liveBanner.subtitle}</p>
                                    </div>
                                  </div>
                                  <span className="shrink-0 rounded-full border border-white/20 bg-white/10 px-3 py-1 font-mono text-xs font-bold tabular-nums">
                                    {formatConfidence(liveBanner.confidence)}
                                  </span>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Camera Guidance Pill */}
                        <div className="mt-4 flex items-center justify-center">
                          <div className="inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/5 px-5 py-2 text-xs font-medium text-white/85 backdrop-blur-xl">
                            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                            <span>
                              {submit.isPending
                                ? 'Biometrik yuz tahlili bajarilmoqda…'
                                : 'Kameraga to\'g\'ri qarang — tizim avtomatik taniydi'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex max-w-md flex-col items-center rounded-[2.5rem] border border-white/15 bg-[#0D1424] p-10 text-center shadow-2xl">
                        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-tr from-[#007AFF] to-[#5E5CE6] text-white shadow-xl shadow-[#007AFF]/40">
                          <Icon paths={I.faceId} size={32} strokeWidth={2.2} />
                        </div>
                        <h3 className="text-xl font-bold tracking-tight text-white">Sessiya Faol Emas</h3>
                        <p className="mt-2 text-sm text-slate-300">
                          O'quvchilar davomatini Face ID orqali olish uchun yangi sessiyani boshlang.
                        </p>
                        <button
                          type="button"
                          onClick={handleStartSession}
                          disabled={startSession.isPending}
                          aria-label={t('faceRecognition.startSession') || 'Start recognition session'}
                          className="mt-6 inline-flex h-12 items-center gap-2 rounded-2xl bg-gradient-to-r from-[#007AFF] to-[#5856D6] px-8 text-sm font-bold text-white shadow-lg shadow-[#007AFF]/40 hover:brightness-110 transition-transform active:scale-95"
                        >
                          <Icon paths={I.play} size={16} strokeWidth={2.4} />
                          <span>{t('faceRecognition.startSession') || 'Sessiyani Boshlash'}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Entrants Live Stream Feed */}
                  <section className="flex min-h-[300px] flex-col overflow-hidden rounded-[2.5rem] border border-white/10 bg-[#0D1424] lg:min-h-0 shadow-2xl">
                    <div className="flex items-center justify-between border-b border-white/10 px-6 py-4.5 bg-white/[0.02]">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                        <h2 className="text-sm font-bold tracking-tight text-white">Kirganlar Ro'yxati</h2>
                      </div>
                      <span className="rounded-full bg-white/10 px-2.5 py-0.5 font-mono text-xs font-bold text-white/90">
                        {liveFeed.length}
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                      {liveFeed.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center p-6 text-center text-slate-400">
                          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-slate-400">
                            <Icon paths={I.faceId} size={28} strokeWidth={1.8} />
                          </div>
                          <p className="text-sm font-semibold text-slate-200">Hali hech kim kirmadi</p>
                          <p className="mt-1 text-xs text-slate-400">O'quvchi tanilganda bu yerda real vaqtda paydo bo'ladi</p>
                        </div>
                      ) : (
                        liveFeed.map((item) => (
                          <div
                            key={item.id}
                            onClick={() => handleOpenStudentSidecar(item.studentId, item.name)}
                            className="group flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 hover:bg-white/10 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[#007AFF] to-[#5856D6] font-bold text-xs text-white">
                                {getInitials(item.name)}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-xs font-bold text-white group-hover:text-[#64D2FF] transition-colors">
                                  {item.name}
                                </p>
                                <p className="text-[11px] text-slate-400">{item.group || 'Guruh biriktirilgan'}</p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-300">
                                {item.confidence}
                              </span>
                              <p className="mt-0.5 font-mono text-[10px] text-slate-400">{item.time}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </section>
                </main>
              </motion.div>
            )}

            {/* ── Kiosk Operator PIN Modal ── */}
            <AnimatePresence>
              {isPinModalOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-2xl"
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.92, y: 16 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92, y: 16 }}
                    transition={SPRING.snappy}
                    className={cn(
                      "w-full max-w-sm overflow-hidden rounded-[2.5rem] border p-8 shadow-2xl backdrop-blur-3xl text-center text-white",
                      pinError
                        ? "border-rose-500/50 bg-[#1e0a0d]/95 shadow-rose-500/20"
                        : "border-white/20 bg-black/80 shadow-black/80"
                    )}
                  >
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-white shadow-inner">
                      <Icon paths={I.lock} size={24} />
                    </div>

                    <h3 className="mt-4 text-lg font-bold">Terminalni qulfdan chiqarish</h3>
                    <p className="mt-1.5 text-xs text-white/60">
                      Kiosk rejimidan chiqish uchun administrator PIN-kodini kiriting
                    </p>

                    {/* PIN Indicators */}
                    <div className="mt-6 flex justify-center gap-3.5">
                      {[0, 1, 2, 3].map((i) => (
                        <span
                          key={i}
                          className={cn(
                            "h-4 w-4 rounded-full border transition-all duration-200",
                            pinInput.length > i
                              ? pinError
                                ? "border-rose-500 bg-rose-500 scale-110 shadow-[0_0_10px_rgba(244,63,94,0.8)]"
                                : "border-emerald-400 bg-emerald-400 scale-110 shadow-[0_0_10px_rgba(52,199,89,0.8)]"
                              : "border-white/30 bg-white/10"
                          )}
                        />
                      ))}
                    </div>

                    {pinError && (
                      <p className="mt-3 text-xs font-semibold text-rose-400 animate-pulse">
                        PIN-kod noto‘g‘ri. Qayta urinib ko‘ring.
                      </p>
                    )}

                    {/* Numeric Keypad */}
                    <div className="mt-7 grid grid-cols-3 gap-3">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                        <button
                          key={digit}
                          type="button"
                          onClick={() => {
                            if (pinInput.length < 4) {
                              playTick();
                              haptics.light();
                              const next = pinInput + digit;
                              setPinInput(next);
                              setPinError(false);
                              if (next.length === 4) {
                                handlePinSubmit(next);
                              }
                            }
                          }}
                          className="flex h-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-xl font-bold text-white shadow-sm hover:bg-white/15 active:scale-95 transition-all"
                        >
                          {digit}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setIsPinModalOpen(false);
                          setPinInput('');
                          setPinError(false);
                        }}
                        className="flex h-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-xs font-bold text-white/70 hover:bg-white/15 active:scale-95 transition-all"
                      >
                        Bekor
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (pinInput.length < 4) {
                            playTick();
                            haptics.light();
                            const next = pinInput + '0';
                            setPinInput(next);
                            setPinError(false);
                            if (next.length === 4) {
                              handlePinSubmit(next);
                            }
                          }
                        }}
                        className="flex h-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-xl font-bold text-white shadow-sm hover:bg-white/15 active:scale-95 transition-all"
                      >
                        0
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          playTick();
                          haptics.light();
                          setPinInput((p) => p.slice(0, -1));
                          setPinError(false);
                        }}
                        className="flex h-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm font-bold text-white/80 hover:bg-white/15 active:scale-95 transition-all"
                      >
                        ⌫
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </AnimatePresence>,
          document.body,
        )}

      {/* ══════════════════════════════════════════════════════════════════
       * 2. MAIN DESKTOP / APP STUDIO HEADER
       * ════════════════════════════════════════════════════════════════ */}
      <motion.header
        variants={cardVariants}
        className="relative overflow-hidden rounded-[2.25rem] border border-white/60 bg-white/70 p-6 shadow-2xl backdrop-blur-3xl dark:border-white/10 dark:bg-[#121622]/70"
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4.5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.5rem] bg-gradient-to-br from-[#007AFF] via-[#5856D6] to-[#AF52DE] text-white shadow-xl shadow-[#007AFF]/30 ring-2 ring-white/40">
              <Icon paths={I.faceId} size={32} strokeWidth={2.2} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-black tracking-tight text-[var(--text-primary)] sm:text-3xl">
                  {t('faceRecognition.title') || 'Face ID Biometriya'}
                </h1>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#007AFF]/10 px-2.5 py-0.5 text-xs font-bold text-[#007AFF] dark:bg-[#007AFF]/20 dark:text-[#64D2FF]">
                  <span className="h-2 w-2 rounded-full bg-[#007AFF] animate-pulse" />
                  Neural Vision
                </span>
                {!isOnline ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-600 dark:bg-amber-500/20 dark:text-amber-300">
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                    Oflayn rejim ({queueCount})
                  </span>
                ) : queueCount > 0 ? (
                  <button
                    type="button"
                    onClick={handleManualSync}
                    disabled={isSyncing}
                    className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/15 px-2.5 py-0.5 text-xs font-bold text-sky-600 dark:bg-sky-500/20 dark:text-sky-300 hover:bg-sky-500/25 transition-all"
                  >
                    <span className={cn('h-2 w-2 rounded-full bg-sky-500', isSyncing && 'animate-spin')} />
                    {isSyncing ? 'Sinxronlanmoqda...' : `Sinxronlash (${queueCount})`}
                  </button>
                ) : null}
              </div>
              <p className="mt-1 text-sm font-medium text-[var(--text-secondary)]">
                {t('faceRecognition.subtitle') || 'Yuzni tanish orqali real vaqtda davomatni avtomatlashtirish'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setAutoScan((s) => !s)}
              className={cn(
                'inline-flex h-10 items-center gap-2 rounded-2xl border px-3.5 text-xs font-bold transition-all',
                autoScan
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'border-black/10 bg-black/5 text-[var(--text-secondary)] hover:bg-black/10 dark:border-white/10 dark:bg-white/5',
              )}
            >
              <Icon paths={I.sparkles} size={15} />
              <span>{autoScan ? 'Avto-skan Faol' : 'Qo\'lda'}</span>
            </button>

            <button
              type="button"
              onClick={handleEnterKiosk}
              className="inline-flex h-10 items-center gap-2 rounded-2xl border border-[#AF52DE]/30 bg-gradient-to-r from-[#007AFF]/10 via-[#AF52DE]/15 to-[#34C759]/10 px-4 text-xs font-bold text-[var(--text-primary)] shadow-sm hover:opacity-90 active:scale-95 transition-all"
            >
              <Icon paths={I.maximize} size={15} className="text-[#AF52DE]" />
              <span>Kiosk Rejimi</span>
              <kbd className="rounded-md bg-black/10 px-1.5 py-0.5 text-[10px] dark:bg-white/15">K</kbd>
            </button>
          </div>
        </div>
      </motion.header>

      {/* Hardware Emergency Evacuation & Lockdown Bar */}
      <motion.div variants={cardVariants}>
        <TurnstileEmergencyLockdown />
      </motion.div>

      {/* ══════════════════════════════════════════════════════════════════
       * 3. KPI TELEMETRY BENTO GRID
       * ════════════════════════════════════════════════════════════════ */}
      <motion.section
        variants={cardVariants}
        className="grid grid-cols-2 gap-4 sm:grid-cols-4"
        aria-label="Statistika"
      >
        {/* 1. Dvigatel holati */}
        <div className="rounded-[1.75rem] border border-white/60 bg-white/70 p-5 backdrop-blur-2xl shadow-sm dark:border-white/10 dark:bg-[#121622]/70">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
              {t('faceRecognition.engineLabel') || 'Dvigatel'}
            </span>
            <span
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold',
                engineStatus?.isReal ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
              )}
            >
              <Icon paths={I.shield} size={16} />
            </span>
          </div>
          <p className="mt-3 text-lg font-black tracking-tight text-[var(--text-primary)]">
            {engine.isLoading && !engineStatus ? '…' : engineStatus?.isReal ? 'Real Vision' : 'Mock Dvigatel'}
          </p>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">{engineStatus?.provider || 'Native Provider'}</p>
        </div>

        {/* 2. Sessiya holati */}
        <div className="rounded-[1.75rem] border border-white/60 bg-white/70 p-5 backdrop-blur-2xl shadow-sm dark:border-white/10 dark:bg-[#121622]/70">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
              {t('faceRecognition.sessionActive') || 'Sessiya'}
            </span>
            <span
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold',
                isSessionActive ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400' : 'bg-slate-500/15 text-slate-500',
              )}
            >
              <Icon paths={isSessionActive ? I.play : I.stop} size={16} />
            </span>
          </div>
          <p className="mt-3 text-lg font-black tracking-tight text-[var(--text-primary)]">
            {isSessionActive
              ? t('faceRecognition.sessionActive') || 'Faol Holatda'
              : t('faceRecognition.waiting') || 'Kutmoqda'}
          </p>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">
            {isSessionActive ? <SessionChronometer startedAt={sessionStartedAt} /> : 'Sessiya boshlanmagan'}
          </p>
        </div>

        {/* 3. Jami tanilganlar */}
        <div className="rounded-[1.75rem] border border-white/60 bg-white/70 p-5 backdrop-blur-2xl shadow-sm dark:border-white/10 dark:bg-[#121622]/70">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
              {t('faceRecognition.historyTitle') || 'Tarix'}
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400">
              <Icon paths={I.layers} size={16} />
            </span>
          </div>
          <p className="mt-3 text-lg font-black tracking-tight text-[var(--text-primary)] tabular-nums">
            {stats.total}
          </p>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">{liveFeed.length} ta shu sessiyada</p>
        </div>

        {/* 4. Muvaffaqiyat ko'rsatkichi */}
        <div className="rounded-[1.75rem] border border-white/60 bg-white/70 p-5 backdrop-blur-2xl shadow-sm dark:border-white/10 dark:bg-[#121622]/70">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
              Muvaffaqiyat
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Icon paths={I.check} size={16} strokeWidth={2.5} />
            </span>
          </div>
          <p className="mt-3 text-lg font-black tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">
            {stats.rate !== null ? `${stats.rate}%` : '—'}
          </p>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">
            {stats.recognized} ta tanilgan · {stats.failed} ta boshqa
          </p>
        </div>
      </motion.section>

      {/* ══════════════════════════════════════════════════════════════════
       * 3.5. INTELLIGENT AI BIOMETRICS & MULTI-CAMERA COMMAND SUITE
       * ════════════════════════════════════════════════════════════════ */}
      <motion.section
        variants={cardVariants}
        className="space-y-4 rounded-[2.25rem] border border-white/60 bg-white/70 p-5 sm:p-6 shadow-2xl backdrop-blur-3xl dark:border-white/10 dark:bg-[#121622]/70"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/[0.06] pb-4 dark:border-white/[0.08]">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-500 ring-1 ring-cyan-500/30">
              <Icon paths={I.camera} size={20} strokeWidth={2.2} />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-[var(--text-primary)]">
                Intelligent Face ID & Kamera Boshqaruv Markazi
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                6 ta ilg‘or sun’iy intellekt moduli: Rejissyor, Anti-Spoof, Oqim, Ovoz, Telegram va Tirbandlik
              </p>
            </div>
          </div>

          {activeBiometricModule && (
            <button
              type="button"
              onClick={() => {
                playTick();
                setActiveBiometricModule(null);
              }}
              className="self-start sm:self-center text-xs font-semibold text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-xl bg-black/[0.04] dark:bg-white/10 transition-colors"
            >
              Yopish ✕
            </button>
          )}
        </div>

        {/* Quick Module Switcher Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'director', label: 'Multikamera Rejissyor', badge: 'RTSP 2x2' },
            { id: 'liveness', label: '3D Liveness & Anti-Spoof', badge: '99.4% Tirik' },
            { id: 'rushHour', label: 'Tig‘iz Vaqt Oqimi', badge: 'Parallel Batch' },
            { id: 'voice', label: 'Ovozli Salomlashish', badge: 'Web Speech' },
            { id: 'telegram', label: 'Telegram Push Shlyuz', badge: '<220ms' },
            { id: 'traffic', label: 'Tirbandlik Xaritasi', badge: 'AI Radar' },
          ].map((mod) => {
            const isActive = activeBiometricModule === mod.id;
            return (
              <button
                key={mod.id}
                type="button"
                onClick={() => {
                  playTick();
                  setActiveBiometricModule(isActive ? null : (mod.id as typeof activeBiometricModule));
                }}
                className={cn(
                  'inline-flex items-center gap-2 rounded-2xl px-3.5 py-2 text-xs font-bold transition-all border shadow-sm',
                  isActive
                    ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-500 dark:text-cyan-400 ring-2 ring-cyan-500/30'
                    : 'bg-black/[0.03] dark:bg-white/[0.05] border-black/[0.06] dark:border-white/[0.08] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-black/20'
                )}
              >
                <span>{mod.label}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-black/10 dark:bg-white/15">
                  {mod.badge}
                </span>
              </button>
            );
          })}
        </div>

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
        <motion.section
          variants={cardVariants}
          className="relative overflow-hidden rounded-[2.25rem] border border-white/60 bg-white/70 p-6 shadow-2xl backdrop-blur-3xl dark:border-white/10 dark:bg-[#121622]/70"
        >
          {/* Studio Header & Group Selector */}
          <div className="flex flex-col gap-4 border-b border-black/[0.06] pb-5 sm:flex-row sm:items-center sm:justify-between dark:border-white/[0.08]">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#007AFF]/10 text-[#007AFF] dark:bg-[#007AFF]/20">
                <Icon paths={I.camera} size={20} />
              </span>
              <div>
                <h2 className="text-base font-bold tracking-tight text-[var(--text-primary)]">
                  {isSessionActive ? 'Kamera Skaneri' : 'Sessiyani Boshlash'}
                </h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  {isSessionActive ? 'Kameraga qarang, tizim avtomatik taniydi' : 'Guruhni tanlang va sessiyani yoqing'}
                </p>
              </div>
            </div>

            {isSessionActive ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopySession}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-black/10 bg-black/5 px-3 font-mono text-xs font-semibold hover:bg-black/10 dark:border-white/10 dark:bg-white/5 transition-colors"
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{truncateSessionId(form.sessionId)}</span>
                  <Icon paths={I.copy} size={13} />
                </button>
                <button
                  type="button"
                  onClick={handleFinishSession}
                  disabled={finishSession.isPending}
                  aria-label={t('faceRecognition.finishSession') || 'Sessiyani yakunlash'}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-rose-500 px-3.5 text-xs font-bold text-white shadow-md shadow-rose-500/30 hover:bg-rose-600 transition-colors"
                >
                  <Icon paths={I.stop} size={13} strokeWidth={2.4} />
                  <span>Yakunlash</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <GlassSelect
                  value={form.groupId}
                  onChange={handleGroupChange}
                  aria-label={t('faceRecognition.groupSelectAria') || 'Guruhni tanlang'}
                  className="text-xs sm:w-48"
                >
                  <option value="">Barcha guruhlar</option>
                  {activeGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </GlassSelect>
                <button
                  type="button"
                  onClick={handleStartSession}
                  disabled={startSession.isPending}
                  aria-label={t('faceRecognition.startSession') || 'Start recognition session'}
                  className="inline-flex h-10 shrink-0 items-center gap-2 rounded-2xl bg-gradient-to-r from-[#007AFF] to-[#5856D6] px-4 text-xs font-bold text-white shadow-lg shadow-[#007AFF]/35 hover:opacity-90 active:scale-95 transition-all"
                >
                  <Icon paths={I.play} size={14} strokeWidth={2.5} />
                  <span>{t('faceRecognition.startSession') || 'Sessiyani boshlash'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Viewfinder Canvas */}
          <div className="mt-6 flex flex-col items-center">
            {isSessionActive && !isKioskMode ? (
              <div className="relative w-full max-w-xl overflow-hidden rounded-[2.25rem] border border-black/10 bg-black/60 shadow-2xl dark:border-white/15">
                <WebcamCapture
                  onCapture={handleCapture}
                  busy={submit.isPending}
                  autoScan={autoScan}
                  onAutoScanToggle={() => setAutoScan((s) => !s)}
                  showAutoScanToggle={false}
                  label="Yuzni tanish"
                />
                <TrueDepthHUD busy={submit.isPending} reduced={reduced} statusKind={liveBanner?.kind} />

                {/* Floating Top Biometric Result Capsule */}
                <AnimatePresence>
                  {liveBanner && (
                    <motion.div
                      key={liveBanner.id}
                      initial={{ opacity: 0, y: -20, scale: 0.94 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -16, scale: 0.96 }}
                      transition={SPRING.snappy}
                      className="pointer-events-auto absolute inset-x-3 top-3 z-40 mx-auto max-w-md"
                    >
                      <div
                        className={cn(
                          'flex items-center justify-between gap-3 rounded-2xl border p-3.5 backdrop-blur-3xl shadow-2xl',
                          liveBanner.kind === 'success'
                            ? 'border-emerald-500/40 bg-[#071F14]/90 text-white'
                            : liveBanner.kind === 'duplicate'
                              ? 'border-amber-500/40 bg-[#251A0A]/90 text-white'
                              : liveBanner.kind === 'denied'
                                ? 'border-rose-500/40 bg-[#240A0F]/90 text-white'
                                : 'border-white/20 bg-black/80 text-white',
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={cn(
                              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold text-xs',
                              liveBanner.kind === 'success' ? 'bg-emerald-500 text-white' : 'bg-white/15 text-white',
                            )}
                          >
                            {liveBanner.kind === 'success' ? (
                              <Icon paths={I.check} size={20} strokeWidth={2.8} />
                            ) : (
                              getInitials(liveBanner.studentName || '')
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="truncate text-sm font-bold">{liveBanner.studentName || 'Yuz tanilmadi'}</h4>
                            <p className="truncate text-[11px] opacity-80">{liveBanner.subtitle}</p>
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full bg-white/15 px-2.5 py-0.5 font-mono text-xs font-bold">
                          {formatConfidence(liveBanner.confidence)}
                        </span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="flex w-full flex-col items-center justify-center rounded-[2.25rem] border-2 border-dashed border-black/10 py-16 dark:border-white/10">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#007AFF]/10 text-[#007AFF] dark:bg-[#007AFF]/20">
                  <Icon paths={I.faceId} size={32} strokeWidth={2} />
                </div>
                <h3 className="mt-4 text-base font-bold text-[var(--text-primary)]">Sessiya Faollashtirilmagan</h3>
                <p className="mt-1 text-xs text-[var(--text-secondary)] text-center max-w-sm">
                  Davomatni qayd etishni boshlash uchun yuqoridagi tugma orqali yangi sessiyani oching.
                </p>
                <button
                  type="button"
                  onClick={handleStartSession}
                  disabled={startSession.isPending}
                  aria-label={t('faceRecognition.startSession') || 'Start recognition session'}
                  className="mt-5 inline-flex h-10 items-center gap-2 rounded-2xl bg-gradient-to-r from-[#007AFF] to-[#5856D6] px-5 text-xs font-bold text-white shadow-md shadow-[#007AFF]/35 hover:opacity-90"
                >
                  <Icon paths={I.play} size={14} strokeWidth={2.4} />
                  <span>{t('faceRecognition.startSession') || 'Sessiyani boshlash'}</span>
                </button>
              </div>
            )}
          </div>
        </motion.section>

        {/* Right: Live Stream Feed */}
        <motion.section
          variants={cardVariants}
          className="relative flex flex-col overflow-hidden rounded-[2.25rem] border border-white/60 bg-white/70 p-6 shadow-2xl backdrop-blur-3xl dark:border-white/10 dark:bg-[#121622]/70"
        >
          <div className="flex items-center justify-between border-b border-black/[0.06] pb-4 dark:border-white/[0.08]">
            <div className="flex items-center gap-2.5">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="text-base font-bold tracking-tight text-[var(--text-primary)]">
                Jonli Qaydlar Oqimi
              </h3>
            </div>
            <span className="rounded-full bg-black/5 px-2.5 py-0.5 font-mono text-xs font-bold text-[var(--text-secondary)] dark:bg-white/10">
              {liveFeed.length}
            </span>
          </div>

          <div className="mt-4 flex-1 space-y-2.5 overflow-y-auto max-h-[460px] pr-1">
            {liveFeed.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center text-center text-[var(--text-tertiary)]">
                <Icon paths={I.faceId} size={36} strokeWidth={1.5} className="mb-2.5 opacity-40" />
                <p className="text-sm font-semibold text-[var(--text-secondary)]">Sessiyada qaydlar yo'q</p>
                <p className="mt-1 text-xs">Yuz aniqlanganda o'quvchi ma'lumotlari shu yerda ko'rinadi</p>
              </div>
            ) : (
              liveFeed.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleOpenStudentSidecar(item.studentId, item.name)}
                  className="group flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-black/[0.05] bg-black/[0.02] p-3 transition-all hover:bg-black/[0.05] dark:border-white/[0.06] dark:bg-white/[0.02] dark:hover:bg-white/[0.06]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[#007AFF] to-[#5856D6] font-bold text-xs text-white">
                      {getInitials(item.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-[var(--text-primary)] group-hover:text-[#007AFF] transition-colors">
                        {item.name}
                      </p>
                      <p className="truncate text-[11px] text-[var(--text-tertiary)]">
                        {item.group || 'Guruh'} · {item.time}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
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
      <motion.section
        variants={cardVariants}
        className="relative overflow-hidden rounded-[2.25rem] border border-white/60 bg-white/70 p-6 shadow-2xl backdrop-blur-3xl dark:border-white/10 dark:bg-[#121622]/70"
      >
        <div className="flex flex-col gap-4 border-b border-black/[0.06] pb-5 md:flex-row md:items-center md:justify-between dark:border-white/[0.08]">
          <div>
            <h3 className="text-lg font-black tracking-tight text-[var(--text-primary)]">
              {t('faceRecognition.historyTitle') || 'Biometrik Audit Tarixi'}
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              Oxirgi aniqlash urinishlari va davomat yozuvlari
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Filter Tabs */}
            <div className="inline-flex items-center rounded-xl bg-black/[0.05] p-1 dark:bg-white/10">
              {(
                [
                  { id: 'all', label: 'Barchasi' },
                  { id: 'success', label: 'Tanilgan' },
                  { id: 'failed', label: 'Tanilmagan' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setHistoryFilter(tab.id)}
                  className={cn(
                    'rounded-lg px-3 py-1 text-xs font-bold transition-all',
                    historyFilter === tab.id
                      ? 'bg-white text-black shadow-sm dark:bg-white/20 dark:text-white'
                      : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <Icon paths={I.search} size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <input
                type="text"
                value={historyQuery}
                onChange={(e) => setHistoryQuery(e.target.value)}
                placeholder="Ism bo'yicha qidirish…"
                className="h-9 w-44 rounded-xl border border-black/10 bg-black/5 pl-8 pr-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#007AFF] dark:border-white/10 dark:bg-white/5"
              />
            </div>

            {/* CSV Export */}
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3 text-xs font-bold text-[var(--text-primary)] shadow-sm hover:bg-black/[0.02] dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
            >
              <Icon paths={I.download} size={14} />
              <span>CSV</span>
            </button>
          </div>
        </div>

        {/* History Table */}
        <div className="mt-5 overflow-x-auto">
          {filteredHistory.length === 0 ? (
            <div className="py-12 text-center text-[var(--text-tertiary)] text-xs">
              Mos keladigan Face ID yozuvlari topilmadi
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-black/[0.06] text-[var(--text-tertiary)] dark:border-white/[0.08]">
                  <th className="pb-3 font-bold">Vaqt</th>
                  <th className="pb-3 font-bold">O'quvchi</th>
                  <th className="pb-3 font-bold">Holat</th>
                  <th className="pb-3 font-bold">Aniqlik</th>
                  <th className="pb-3 font-bold text-right">Amal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                {filteredHistory.map((item) => {
                  const studentName = formatStudentName(item.student);
                  const outcome = resolveRecognitionOutcome(item);
                  return (
                    <tr key={item.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 font-mono text-[11px] text-[var(--text-secondary)]">
                        {item.occurredAt ? formatDateTime(item.occurredAt) : '—'}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#007AFF]/15 text-[#007AFF] font-bold text-[10px]">
                            {getInitials(studentName)}
                          </div>
                          <span className="font-bold text-[var(--text-primary)]">{studentName}</span>
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
                              : 'Tanilmadi'}
                        </span>
                      </td>
                      <td className="py-3 font-mono font-bold">{formatConfidence(item.confidence)}</td>
                      <td className="py-3 text-right">
                        {item.student?.id && (
                          <button
                            type="button"
                            onClick={() => handleOpenStudentSidecar(item.student?.id, studentName)}
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
