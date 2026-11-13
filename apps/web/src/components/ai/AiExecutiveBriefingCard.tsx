'use client';

/**
 * ============================================================================
 * AiExecutiveBriefingCard — iOS 27 / visionOS Liquid Glass Executive Cockpit
 * ============================================================================
 * Provides leadership with a proactive, contextual AI-driven morning briefing:
 *  • Live synthesized operational summary with Voice Readout & 1-click Copy.
 *  • Interactive 8-metric telemetry grid with SVG Radial Attendance Ring.
 *  • Executive Privacy Mask (1-click blur for sensitive financial figures).
 *  • Category-coded priority action pills with direct AI Copilot deep-linking.
 *  • Persistent collapse state with compact header summary pills.
 * ============================================================================
 */

import {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Users,
  CreditCard,
  GraduationCap,
  TrendingUp,
  ShieldAlert,
  Clock,
  Copy,
  Check,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  UserPlus,
  Briefcase,
  CheckCircle2,
  Wallet,
  Activity,
} from 'lucide-react';
import { aiApi, type AiExecutiveBriefing } from '@/lib/api';
import { cn } from '@/lib/design';

// ============================================================================
// EXTENDED SAFE TYPES & CONSTANTS
// ============================================================================

type BriefingSentiment = 'positive' | 'attention' | 'critical';
type ActionCategory =
  | 'governance'
  | 'attendance'
  | 'finance'
  | 'risk'
  | 'academics'
  | string;

interface ExtendedBriefingMetrics {
  studentsCount: number;
  groupsCount: number;
  teachersCount: number;
  attendanceRate: number;
  presentToday: number;
  absentToday: number;
  lateToday: number;
  debtorsCount: number;
  overdueAmount: number;
  highRiskStudents: number;
  monthlyRevenue: number;
  pendingActionsCount: number;
  newEnrollmentsCount: number;
}

const STORAGE_COLLAPSED_KEY = 'medu:ai-briefing:collapsed';
const STORAGE_PRIVACY_KEY = 'medu:ai-briefing:privacy-mask';

const SENTIMENT_CONFIG: Readonly<
  Record<
    BriefingSentiment,
    {
      label: string;
      surfaceGradient: string;
      borderClass: string;
      glowColor: string;
      badgeBg: string;
      dotColor: string;
    }
  >
> = {
  positive: {
    label: 'Barqaror holat',
    surfaceGradient:
      'from-[#007AFF]/[0.12] via-[#5856D6]/[0.08] to-[#AF52DE]/[0.12] dark:from-[#007AFF]/[0.16] dark:via-[#5856D6]/[0.12] dark:to-[#AF52DE]/[0.16]',
    borderClass: 'border-[#007AFF]/25 dark:border-[#64D2FF]/25',
    glowColor: 'from-[#007AFF]/25 to-[#AF52DE]/25',
    badgeBg:
      'bg-emerald-500/12 text-emerald-700 border-emerald-500/25 dark:bg-emerald-500/20 dark:text-emerald-300',
    dotColor: 'bg-emerald-500',
  },
  attention: {
    label: 'E’tibor talab etiladi',
    surfaceGradient:
      'from-amber-500/[0.14] via-orange-500/[0.08] to-[#007AFF]/[0.10] dark:from-amber-500/[0.18] dark:via-orange-500/[0.12] dark:to-sky-500/[0.12]',
    borderClass: 'border-amber-500/35 dark:border-amber-400/30',
    glowColor: 'from-amber-500/25 to-orange-500/20',
    badgeBg:
      'bg-amber-500/15 text-amber-800 border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-300',
    dotColor: 'bg-amber-500',
  },
  critical: {
    label: 'Muhim nazorat zarur',
    surfaceGradient:
      'from-rose-500/[0.15] via-orange-500/[0.10] to-amber-500/[0.12] dark:from-rose-500/[0.20] dark:via-orange-500/[0.14] dark:to-amber-500/[0.14]',
    borderClass: 'border-rose-500/35 dark:border-rose-400/35',
    glowColor: 'from-rose-500/30 to-orange-500/25',
    badgeBg:
      'bg-rose-500/15 text-rose-700 border-rose-500/30 dark:bg-rose-500/20 dark:text-rose-300',
    dotColor: 'bg-rose-500',
  },
};

function getCategoryStyle(category?: ActionCategory) {
  switch (category) {
    case 'finance':
      return {
        Icon: Wallet,
        iconColor: 'text-emerald-600 dark:text-emerald-400',
        hoverClass:
          'hover:border-emerald-500/50 hover:bg-emerald-500/[0.08] dark:hover:bg-emerald-500/[0.15]',
      };
    case 'attendance':
      return {
        Icon: Users,
        iconColor: 'text-[#007AFF] dark:text-[#64D2FF]',
        hoverClass:
          'hover:border-[#007AFF]/50 hover:bg-[#007AFF]/[0.08] dark:hover:bg-[#007AFF]/[0.15]',
      };
    case 'risk':
      return {
        Icon: AlertTriangle,
        iconColor: 'text-rose-600 dark:text-rose-400',
        hoverClass:
          'hover:border-rose-500/50 hover:bg-rose-500/[0.08] dark:hover:bg-rose-500/[0.15]',
      };
    case 'governance':
      return {
        Icon: ShieldAlert,
        iconColor: 'text-amber-600 dark:text-amber-400',
        hoverClass:
          'hover:border-amber-500/50 hover:bg-amber-500/[0.08] dark:hover:bg-amber-500/[0.15]',
      };
    default:
      return {
        Icon: GraduationCap,
        iconColor: 'text-indigo-600 dark:text-indigo-400',
        hoverClass:
          'hover:border-indigo-500/50 hover:bg-indigo-500/[0.08] dark:hover:bg-indigo-500/[0.15]',
      };
  }
}

function formatCompactSum(amount: number): string {
  if (!amount || isNaN(amount)) return "0 so'm";
  const abs = Math.abs(amount);
  if (abs >= 1_000_000_000) {
    return `${(amount / 1_000_000_000).toFixed(1)} mlrd so'm`;
  }
  if (abs >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)} mln so'm`;
  }
  return `${amount.toLocaleString('uz-UZ')} so'm`;
}

function formatBriefingTime(isoString?: string): string {
  if (!isoString) return 'Hozirgina';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return 'Bugun';
    return date.toLocaleTimeString('uz-UZ', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Bugun';
  }
}

// ============================================================================
// SUB-COMPONENT: SVG RADIAL PROGRESS RING
// ============================================================================

function AttendanceRadialRing({ percentage }: { percentage: number }) {
  const safePct = Math.min(100, Math.max(0, percentage));
  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (safePct / 100) * circumference;

  const strokeColor =
    safePct >= 90
      ? 'stroke-emerald-500'
      : safePct >= 75
        ? 'stroke-[#007AFF]'
        : 'stroke-amber-500';

  return (
    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
      <svg className="h-10 w-10 -rotate-90 transform" viewBox="0 0 38 38">
        <circle
          cx="19"
          cy="19"
          r={radius}
          fill="transparent"
          strokeWidth="3.5"
          className="stroke-zinc-200/80 dark:stroke-zinc-700/70"
        />
        <circle
          cx="19"
          cy="19"
          r={radius}
          fill="transparent"
          strokeWidth="3.5"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={cn('transition-all duration-700 ease-out', strokeColor)}
        />
      </svg>
      <Users className="absolute h-3.5 w-3.5 text-[#007AFF] dark:text-[#64D2FF]" />
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AiExecutiveBriefingCard() {
  const [briefing, setBriefing] = useState<AiExecutiveBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showExtendedMetrics, setShowExtendedMetrics] = useState(false);
  const [privacyMasked, setPrivacyMasked] = useState(false);
  const [copiedDigest, setCopiedDigest] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const reqCounterRef = useRef(0);
  const mountedRef = useRef(true);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore user preferences from localStorage
  useEffect(() => {
    mountedRef.current = true;
    try {
      if (typeof window !== 'undefined') {
        const savedCollapsed = localStorage.getItem(STORAGE_COLLAPSED_KEY);
        if (savedCollapsed === 'true') setCollapsed(true);
        const savedPrivacy = localStorage.getItem(STORAGE_PRIVACY_KEY);
        if (savedPrivacy === 'true') setPrivacyMasked(true);
      }
    } catch {
      // Ignore storage access errors
    }

    return () => {
      mountedRef.current = false;
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_COLLAPSED_KEY, String(next));
      } catch {
        // Ignore
      }
      return next;
    });
  }, []);

  const togglePrivacyMask = useCallback(() => {
    setPrivacyMasked((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_PRIVACY_KEY, String(next));
      } catch {
        // Ignore
      }
      return next;
    });
  }, []);

  const fetchBriefing = useCallback(async (isManual = false) => {
    const currentReqId = ++reqCounterRef.current;
    if (isManual) setRefreshing(true);
    else setLoading(true);
    setErrorState(false);

    try {
      const data = await aiApi.getExecutiveBriefing();
      if (!mountedRef.current || currentReqId !== reqCounterRef.current) return;
      if (data) {
        setBriefing(data);
      } else {
        setErrorState(true);
      }
    } catch {
      if (!mountedRef.current || currentReqId !== reqCounterRef.current) return;
      setErrorState(true);
    } finally {
      if (mountedRef.current && currentReqId === reqCounterRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchBriefing(false);
  }, [fetchBriefing]);

  const handleActionClick = useCallback((prompt: string) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent('open-ai-copilot', {
        detail: { prompt },
      }),
    );
  }, []);

  // Safely normalized metrics (includes lateToday in attendance fraction)
  const metrics = useMemo<ExtendedBriefingMetrics>(() => {
    const raw = (briefing?.metrics ?? {}) as Partial<ExtendedBriefingMetrics>;
    return {
      studentsCount: Number(raw.studentsCount ?? 0),
      groupsCount: Number(raw.groupsCount ?? 0),
      teachersCount: Number(raw.teachersCount ?? 0),
      attendanceRate: Number(raw.attendanceRate ?? 100),
      presentToday: Number(raw.presentToday ?? 0),
      absentToday: Number(raw.absentToday ?? 0),
      lateToday: Number(raw.lateToday ?? 0),
      debtorsCount: Number(raw.debtorsCount ?? 0),
      overdueAmount: Number(raw.overdueAmount ?? 0),
      highRiskStudents: Number(raw.highRiskStudents ?? 0),
      monthlyRevenue: Number(raw.monthlyRevenue ?? 0),
      pendingActionsCount: Number(raw.pendingActionsCount ?? 0),
      newEnrollmentsCount: Number(raw.newEnrollmentsCount ?? 0),
    };
  }, [briefing?.metrics]);

  const attendedToday = metrics.presentToday + metrics.lateToday;
  const totalMarkedToday = attendedToday + metrics.absentToday;

  // Copy full executive digest to clipboard
  const handleCopyDigest = useCallback(async () => {
    if (!briefing || typeof navigator === 'undefined') return;
    const text = [
      `📊 M-EDU AI Boshqaruv Brifingi (${formatBriefingTime(briefing.generatedAt)})`,
      '',
      briefing.summary,
      '',
      `• Davomat: ${metrics.attendanceRate}% (${attendedToday}/${totalMarkedToday || metrics.studentsCount})`,
      `• Faol guruhlar: ${metrics.groupsCount} ta | O'quvchilar: ${metrics.studentsCount} nafar`,
      `• Qarzdorlar: ${metrics.debtorsCount} nafar (${formatCompactSum(metrics.overdueAmount)})`,
      `• Akademik xavf guruhi: ${metrics.highRiskStudents} nafar`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopiedDigest(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedDigest(false), 2200);
    } catch {
      // Ignore clipboard permission error
    }
  }, [briefing, metrics, attendedToday, totalMarkedToday]);

  // Voice Briefing Readout (TTS)
  const handleToggleSpeech = useCallback(() => {
    if (
      !briefing ||
      typeof window === 'undefined' ||
      !('speechSynthesis' in window)
    ) {
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(briefing.summary);
    utterance.lang = 'uz-UZ';
    utterance.rate = 1.0;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.cancel();
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }, [briefing, isSpeaking]);

  /* ── 1. Loading Skeleton State ────────────────────────────────── */
  if (loading) {
    return (
      <div
        role="status"
        aria-label="AI Boshqaruv Brifingi yuklanmoqda"
        className="relative overflow-hidden rounded-3xl border border-black/[0.06] dark:border-white/10 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-2xl p-5 shadow-sm"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[#007AFF]/20 animate-pulse" />
            <div className="space-y-1.5">
              <div className="h-4 w-48 rounded-md bg-black/10 dark:bg-white/10 animate-pulse" />
              <div className="h-3 w-64 rounded-md bg-black/5 dark:bg-white/5 animate-pulse" />
            </div>
          </div>
          <div className="flex gap-1.5">
            <div className="h-8 w-8 rounded-xl bg-black/5 dark:bg-white/5 animate-pulse" />
            <div className="h-8 w-8 rounded-xl bg-black/5 dark:bg-white/5 animate-pulse" />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <div className="h-3.5 w-full rounded-md bg-black/5 dark:bg-white/5 animate-pulse" />
          <div className="h-3.5 w-5/6 rounded-md bg-black/5 dark:bg-white/5 animate-pulse" />
        </div>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 rounded-2xl bg-black/[0.04] dark:bg-white/[0.04] animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  /* ── 2. Resilient Error Fallback State (Never disappears silently) ── */
  if (!briefing && errorState) {
    return (
      <div className="relative flex items-center justify-between gap-3 overflow-hidden rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] dark:bg-amber-950/20 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
              AI Boshqaruv Brifingi vaqtincha yangilanmadi
            </p>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
              Tarmoq aloqasini tekshiring yoki qayta urinib ko‘ring
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => fetchBriefing(true)}
          disabled={refreshing}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-amber-500/30 bg-white/80 dark:bg-zinc-900/80 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 transition-all active:scale-95"
        >
          <RefreshCw
            className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')}
          />
          <span>Qayta yuklash</span>
        </button>
      </div>
    );
  }

  if (!briefing) return null;

  const sentimentKey: BriefingSentiment =
    briefing.sentiment === 'critical' ||
    briefing.sentiment === 'attention' ||
    briefing.sentiment === 'positive'
      ? briefing.sentiment
      : 'positive';

  const theme = SENTIMENT_CONFIG[sentimentKey];

  return (
    <motion.section
      aria-label="AI Boshqaruv Brifingi"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn(
        'relative w-full min-w-0 max-w-full overflow-hidden rounded-[24px] border transition-all duration-300',
        'bg-gradient-to-br backdrop-blur-2xl backdrop-saturate-150',
        'shadow-[0_10px_32px_-10px_rgba(0,122,255,0.14),inset_0_1px_0_rgba(255,255,255,0.65)]',
        'dark:shadow-[0_12px_36px_-10px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.10)]',
        theme.surfaceGradient,
        theme.borderClass,
      )}
    >
      {/* Top Specular Hairline */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/80 dark:via-white/25 to-transparent"
      />

      {/* Ambient Aurora Orb */}
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-gradient-to-br blur-3xl opacity-80',
          theme.glowColor,
        )}
      />

      {/* ====================================================================
          HEADER BAR
         ==================================================================== */}
      <div className="relative flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 pt-3.5 sm:pt-4 pb-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Brand Prism Icon */}
          <div className="relative flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#007AFF] via-[#5856D6] to-[#AF52DE] text-white shadow-md shadow-[#007AFF]/25 ring-1 ring-white/30">
            <Sparkles className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
            <span
              className={cn(
                'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-zinc-900',
                theme.dotColor,
              )}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="truncate text-xs sm:text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                AI Boshqaruv Brifingi
              </h2>

              {/* Sentiment Status Pill */}
              <span
                className={cn(
                  'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                  theme.badgeBg,
                )}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full animate-pulse',
                    theme.dotColor,
                  )}
                />
                {theme.label}
              </span>

              {/* Timestamp */}
              <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                <Clock className="h-2.5 w-2.5" />
                {formatBriefingTime(briefing.generatedAt)}
              </span>
            </div>

            {/* Subtitle OR Compact Summary Pills when Collapsed */}
            {collapsed ? (
              <div className="flex items-center gap-2 mt-1 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 overflow-x-auto scrollbar-none">
                <span className="inline-flex items-center gap-1 rounded-md bg-white/70 dark:bg-zinc-800/70 px-1.5 py-0.5">
                  Davomat: {metrics.attendanceRate}%
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-white/70 dark:bg-zinc-800/70 px-1.5 py-0.5">
                  Qarzdorlar: {metrics.debtorsCount}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-white/70 dark:bg-zinc-800/70 px-1.5 py-0.5">
                  Xavf: {metrics.highRiskStudents}
                </span>
              </div>
            ) : (
              <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                Bugungi operatsion svodka, moliya va ustuvor boshqaruv qarorlari
              </p>
            )}
          </div>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Voice Readout Button */}
          <button
            type="button"
            onClick={handleToggleSpeech}
            aria-label={isSpeaking ? "Ovozni to'xtatish" : 'Ovozli eshitish'}
            title={isSpeaking ? "Ovozni to'xtatish" : 'Brifingni ovozli eshitish'}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-xl border transition-all active:scale-95',
              isSpeaking
                ? 'border-[#007AFF] bg-[#007AFF] text-white shadow-sm shadow-[#007AFF]/30'
                : 'border-transparent text-zinc-500 hover:bg-black/5 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100',
            )}
          >
            {isSpeaking ? (
              <VolumeX className="h-3.5 w-3.5 animate-pulse" />
            ) : (
              <Volume2 className="h-3.5 w-3.5" />
            )}
          </button>

          {/* Copy Digest Button */}
          <button
            type="button"
            onClick={handleCopyDigest}
            aria-label="Brifingni nusxalash"
            title="Brifing xulosasini nusxalash"
            className="flex h-9 w-9 min-h-[38px] min-w-[38px] items-center justify-center rounded-xl text-zinc-500 hover:bg-black/5 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100 transition-all active:scale-95"
          >
            {copiedDigest ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>

          {/* Privacy Mask Toggle for Financial Figures */}
          <button
            type="button"
            onClick={togglePrivacyMask}
            aria-label={
              privacyMasked
                ? "Moliyaviy summalarni ko'rsatish"
                : 'Moliyaviy summalarni yashirish'
            }
            title={
              privacyMasked
                ? "Moliyaviy summalarni ko'rsatish"
                : 'Moliyaviy summalarni yashirish (Maxfiy rejim)'
            }
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-xl transition-all active:scale-95',
              privacyMasked
                ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300'
                : 'text-zinc-500 hover:bg-black/5 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100',
            )}
          >
            {privacyMasked ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
          </button>

          {/* Refresh Briefing Button */}
          <button
            type="button"
            onClick={() => fetchBriefing(true)}
            disabled={refreshing}
            aria-label="Qayta tahlil qilish"
            title="Ma'lumotlarni yangilash"
            className="flex h-9 w-9 min-h-[38px] min-w-[38px] items-center justify-center rounded-xl text-zinc-500 hover:bg-black/5 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100 transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw
              className={cn(
                'h-3.5 w-3.5 transition-transform',
                refreshing && 'animate-spin text-[#007AFF]',
              )}
            />
          </button>

          {/* Collapse / Expand Toggle */}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Brifingni yoyish' : 'Brifingni yig‘ish'}
            className="flex h-9 w-9 min-h-[38px] min-w-[38px] items-center justify-center rounded-xl text-zinc-500 hover:bg-black/5 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100 transition-all active:scale-95"
          >
            {collapsed ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* ====================================================================
          COLLAPSIBLE BODY (Zero-Jump Overflow Wrapper)
         ==================================================================== */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="briefing-body"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden w-full min-w-0"
          >
            <div className="px-4 sm:px-5 pb-4 pt-0.5 space-y-3.5 w-full min-w-0">
              {/* Executive Digest Narrative Box */}
              <div className="rounded-2xl border border-black/[0.05] dark:border-white/[0.06] bg-white/60 dark:bg-zinc-900/45 px-3.5 py-2.5 backdrop-blur-md">
                <p className="text-[13.5px] sm:text-sm font-medium leading-relaxed text-zinc-800 dark:text-zinc-100">
                  {briefing.summary}
                </p>
              </div>

              {/* Primary 4 Interactive Telemetry Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5 w-full min-w-0">
                {/* 1. Attendance Card with SVG Radial Ring */}
                <button
                  type="button"
                  onClick={() =>
                    handleActionClick(
                      "Bugungi davomat, kelmagan va kechikkan o'quvchilar tahlilini ko'rsat",
                    )
                  }
                  className="group flex items-center gap-2.5 rounded-2xl bg-white/80 dark:bg-zinc-900/70 border border-black/[0.06] dark:border-white/[0.08] hover:border-[#007AFF]/50 p-2.5 sm:p-3 text-left transition-all hover:shadow-md active:scale-[0.99] min-w-0 overflow-hidden"
                >
                  <AttendanceRadialRing percentage={metrics.attendanceRate} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 dark:text-zinc-500 truncate">
                        Davomat
                      </span>
                      <ArrowRight className="h-3 w-3 text-zinc-300 group-hover:text-[#007AFF] group-hover:translate-x-0.5 transition-all shrink-0" />
                    </div>
                    <div className="text-sm font-extrabold text-zinc-900 dark:text-zinc-50 truncate">
                      {metrics.attendanceRate}%{' '}
                      <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                        ({attendedToday}/{totalMarkedToday})
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                      {metrics.absentToday > 0
                        ? `${metrics.absentToday} kelmagan${metrics.lateToday > 0 ? `, ${metrics.lateToday} kechikkan` : ''}`
                        : "Sababsiz qoldirish yo'q"}
                    </div>
                  </div>
                </button>

                {/* 2. Debtors & Overdue Amount Card */}
                <button
                  type="button"
                  onClick={() =>
                    handleActionClick(
                      "Qarzdor o'quvchilar ro'yxati va muddati o'tgan to'lovlar tahlilini ko'rsat",
                    )
                  }
                  className="group flex items-center gap-2.5 rounded-2xl bg-white/80 dark:bg-zinc-900/70 border border-black/[0.06] dark:border-white/[0.08] hover:border-emerald-500/50 p-2.5 sm:p-3 text-left transition-all hover:shadow-md active:scale-[0.99] min-w-0 overflow-hidden"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
                    <CreditCard className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 dark:text-zinc-500 truncate">
                        Qarzdorlar
                      </span>
                      <ArrowRight className="h-3 w-3 text-zinc-300 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </div>
                    <div className="text-sm font-extrabold text-zinc-900 dark:text-zinc-50 truncate">
                      {metrics.debtorsCount}{' '}
                      <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                        nafar
                      </span>
                    </div>
                    <div
                      className={cn(
                        'text-[10px] font-medium text-rose-600 dark:text-rose-400 truncate mt-0.5 transition-all',
                        privacyMasked && 'blur-[4px] select-none',
                      )}
                    >
                      {metrics.overdueAmount > 0
                        ? `Qarz: ${formatCompactSum(metrics.overdueAmount)}`
                        : 'Qarzdorlik yopilgan'}
                    </div>
                  </div>
                </button>

                {/* 3. Groups & Active Contingent Card */}
                <button
                  type="button"
                  onClick={() =>
                    handleActionClick(
                      "Faol guruhlar, o'quvchilar kontingenti va bugungi dars jadvalini ko'rsat",
                    )
                  }
                  className="group flex items-center gap-2.5 rounded-2xl bg-white/80 dark:bg-zinc-900/70 border border-black/[0.06] dark:border-white/[0.08] hover:border-indigo-500/50 p-2.5 sm:p-3 text-left transition-all hover:shadow-md active:scale-[0.99] min-w-0 overflow-hidden"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/12 text-indigo-600 dark:text-indigo-400">
                    <GraduationCap className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 dark:text-zinc-500 truncate">
                        Guruhlar
                      </span>
                      <ArrowRight className="h-3 w-3 text-zinc-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </div>
                    <div className="text-sm font-extrabold text-zinc-900 dark:text-zinc-50 truncate">
                      {metrics.groupsCount}{' '}
                      <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                        ta faol
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                      Jami {metrics.studentsCount} nafar o‘quvchi
                    </div>
                  </div>
                </button>

                {/* 4. Academic Risk Radar Card */}
                <button
                  type="button"
                  onClick={() =>
                    handleActionClick(
                      "Akademik xavf ostidagi o'quvchilar ro'yxati va sabablarini tahlil qilib ber",
                    )
                  }
                  className="group flex items-center gap-2.5 rounded-2xl bg-white/80 dark:bg-zinc-900/70 border border-black/[0.06] dark:border-white/[0.08] hover:border-amber-500/50 p-2.5 sm:p-3 text-left transition-all hover:shadow-md active:scale-[0.99] min-w-0 overflow-hidden"
                >
                  <div
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                      metrics.highRiskStudents > 0
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                        : 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
                    )}
                  >
                    {metrics.highRiskStudents > 0 ? (
                      <AlertTriangle className="h-4.5 w-4.5" />
                    ) : (
                      <CheckCircle2 className="h-4.5 w-4.5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 dark:text-zinc-500 truncate">
                        Xavf Radari
                      </span>
                      <ArrowRight className="h-3 w-3 text-zinc-300 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </div>
                    <div className="text-sm font-extrabold text-zinc-900 dark:text-zinc-50 truncate">
                      {metrics.highRiskStudents}{' '}
                      <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                        o‘quvchi
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                      {metrics.highRiskStudents > 0
                        ? 'Shaxsiy nazorat zarur'
                        : 'Kritik xavf aniqlanmadi'}
                    </div>
                  </div>
                </button>
              </div>

              {/* Secondary Executive Telemetry Strip (Expandable / Financial + HR Pulse) */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-black/[0.05] dark:border-white/[0.06] bg-white/55 dark:bg-zinc-900/45 px-3.5 py-2 text-xs">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  <div className="inline-flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Oylik tushum:
                    </span>
                    <span
                      className={cn(
                        'text-[11px] font-bold text-zinc-900 dark:text-zinc-100 transition-all',
                        privacyMasked && 'blur-[4px] select-none',
                      )}
                    >
                      {formatCompactSum(metrics.monthlyRevenue)}
                    </span>
                  </div>

                  <div className="inline-flex items-center gap-1.5">
                    <UserPlus className="h-3.5 w-3.5 text-[#007AFF]" />
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Yangi qabul (30 kun):
                    </span>
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                      +{metrics.newEnrollmentsCount} nafar
                    </span>
                  </div>

                  {showExtendedMetrics && (
                    <div className="inline-flex items-center gap-1.5">
                      <Briefcase className="h-3.5 w-3.5 text-violet-500" />
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Pedagoglar:
                      </span>
                      <span className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100">
                        {metrics.teachersCount} nafar ustoz
                      </span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowExtendedMetrics((prev) => !prev)}
                  className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-[#007AFF] dark:text-[#64D2FF] hover:underline"
                >
                  <Activity className="h-3 w-3" />
                  <span>
                    {showExtendedMetrics ? 'Ixchamlashtirish' : 'Barcha raqamlar'}
                  </span>
                </button>
              </div>

              {/* Pending AI Governance Actions Banner */}
              {metrics.pendingActionsCount > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-amber-500/12 border border-amber-500/30 px-3.5 py-2.5 text-xs text-amber-800 dark:text-amber-200">
                  <div className="flex items-center gap-2.5">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                    </span>
                    <span>
                      <strong>{metrics.pendingActionsCount} ta AI boshqaruv amali</strong>{' '}
                      rahbar tasdig‘ini kutmoqda
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleActionClick(
                        "Tasdiqlash kutilayotgan barcha AI amallarini ko'rsat",
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 px-2.5 py-1 font-bold text-amber-800 dark:text-amber-200 transition-colors"
                  >
                    <span>Ko‘rib chiqish</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              )}

              {/* Category-Coded Priority Action Pills */}
              {briefing.priorityActions && briefing.priorityActions.length > 0 && (
                <div className="space-y-2 pt-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      Ustuvor AI tavsiyalar ({briefing.priorityActions.length})
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleActionClick(
                          "Markazning bugungi to'liq boshqaruv hisoboti va tahlilini chiqarib ber",
                        )
                      }
                      className="text-[11px] font-semibold text-[#007AFF] dark:text-[#64D2FF] hover:underline"
                    >
                      AI Copilotda chuqur tahlil →
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {briefing.priorityActions.map((act) => {
                      const catStyle = getCategoryStyle(
                        (act as { category?: string }).category,
                      );
                      const CategoryIcon = catStyle.Icon;

                      return (
                        <button
                          key={act.id}
                          type="button"
                          onClick={() => handleActionClick(act.prompt)}
                          className={cn(
                            'group flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all duration-200 active:scale-[0.98]',
                            'bg-white/85 dark:bg-zinc-900/80 border border-black/[0.08] dark:border-white/10',
                            'shadow-2xs hover:shadow-md',
                            catStyle.hoverClass,
                          )}
                        >
                          <CategoryIcon
                            className={cn(
                              'h-3.5 w-3.5 shrink-0 transition-transform group-hover:scale-110',
                              catStyle.iconColor,
                            )}
                          />
                          <span className="text-zinc-800 dark:text-zinc-200 font-medium text-left">
                            {act.title}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-lg bg-[#007AFF]/10 dark:bg-[#007AFF]/20 px-2 py-0.5 text-[11px] font-bold text-[#007AFF] dark:text-[#64D2FF] group-hover:bg-[#007AFF] group-hover:text-white transition-colors">
                            {act.actionLabel}
                            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

export default AiExecutiveBriefingCard;
