'use client';

/**
 * ============================================================================
 * M-EDU AiExecutiveSuperStudio — iOS 27 / visionOS "Liquid Intelligence Lab"
 * ============================================================================
 *
 * 10/10 Spatial Executive Suite:
 *  • True iOS 27 multi-layer refractive Liquid Glass (Light & Dark adaptive)
 *  • Zero-rerender pointer caustic spotlight + dual chromatic specular rims
 *  • Accent-adaptive ambient plasma orbs that morph per active module
 *  • Isolated per-module async states (Churn, Debt, Rubric) + inline error recovery
 *  • Liquid Segmented Controls replacing raw native <select> dropdowns
 *  • 1-Click Copy & "Send to Copilot" integration across all 4 modules
 *  • Live 16-bar acoustic waveform visualizer + speech rate control + safe cleanup
 * ============================================================================
 */

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  memo,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import {
  ShieldAlert,
  CreditCard,
  GraduationCap,
  Volume2,
  Sparkles,
  RefreshCw,
  X,
  ArrowUpRight,
  Copy,
  Check,
  Phone,
  Wallet,
  Activity,
  AlertTriangle,
  Square,
  Play,
  Sliders,
  TrendingUp,
  HelpCircle,
  BookOpen,
  Clock,
  Target,
  CheckCircle2,
} from 'lucide-react';
import { aiApi, type AiStudentDiagnostic, type AiGeneratedQuizResponse } from '@/lib/api';
import { cn, usePrefersReducedMotion } from '@/lib/design';
import { useHaptics } from '@/hooks/useHaptics';
import { usePremiumSound } from '@/hooks/usePremiumSound';

/* ─────────────────────────────────────────────────────────────────────────
 * Types & Constants
 * ─────────────────────────────────────────────────────────────────────── */

export type StudioTabId = 'churn' | 'debt' | 'diagnostic' | 'quiz' | 'rubric' | 'voice' | 'scenario';

export interface AiExecutiveSuperStudioProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertPrompt?: (prompt: string) => void;
  initialTab?: StudioTabId;
}

const SPRING_MODAL = {
  type: 'spring' as const,
  stiffness: 420,
  damping: 34,
  mass: 0.72,
  restDelta: 0.001,
};

const SPRING_PILL = {
  type: 'spring' as const,
  stiffness: 520,
  damping: 35,
  mass: 0.55,
};

const SPRING_GEL = {
  type: 'spring' as const,
  stiffness: 740,
  damping: 25,
  mass: 0.34,
};

interface TabConfig {
  readonly id: StudioTabId;
  readonly label: string;
  readonly shortLabel: string;
  readonly badge: string;
  readonly icon: typeof ShieldAlert;
  readonly accentText: string;
  readonly accentBg: string;
  readonly accentBorder: string;
  readonly orbGradient: string;
  readonly buttonGradient: string;
  readonly glowShadow: string;
}

const STUDIO_TABS: readonly TabConfig[] = [
  {
    id: 'churn',
    label: 'Ketib Qolish Radari',
    shortLabel: 'Xavf Radari',
    badge: 'AI Churn',
    icon: ShieldAlert,
    accentText: 'text-rose-600 dark:text-rose-400',
    accentBg: 'bg-rose-500/12 dark:bg-rose-500/20',
    accentBorder: 'border-rose-500/30 dark:border-rose-400/35',
    orbGradient:
      'radial-gradient(circle, rgba(244,63,94,0.22) 0%, rgba(251,113,133,0.08) 45%, transparent 70%)',
    buttonGradient: 'from-rose-500 via-pink-600 to-rose-600',
    glowShadow: 'shadow-[0_10px_28px_-6px_rgba(244,63,94,0.45),inset_0_1px_0_rgba(255,255,255,0.45)]',
  },
  {
    id: 'debt',
    label: 'Qarzdorlikni Tiklash',
    shortLabel: 'Qarz SMS',
    badge: 'Smart CRM',
    icon: CreditCard,
    accentText: 'text-amber-600 dark:text-amber-400',
    accentBg: 'bg-amber-500/12 dark:bg-amber-500/20',
    accentBorder: 'border-amber-500/30 dark:border-amber-400/35',
    orbGradient:
      'radial-gradient(circle, rgba(245,158,11,0.22) 0%, rgba(217,119,6,0.08) 45%, transparent 70%)',
    buttonGradient: 'from-amber-500 via-orange-500 to-amber-600',
    glowShadow: 'shadow-[0_10px_28px_-6px_rgba(245,158,11,0.45),inset_0_1px_0_rgba(255,255,255,0.45)]',
  },
  {
    id: 'diagnostic',
    label: 'O‘quvchi 360° Diagnostika',
    shortLabel: '360° Tahlil',
    badge: 'AI Pedagogy',
    icon: Activity,
    accentText: 'text-emerald-600 dark:text-emerald-400',
    accentBg: 'bg-emerald-500/12 dark:bg-emerald-500/20',
    accentBorder: 'border-emerald-500/30 dark:border-emerald-400/35',
    orbGradient:
      'radial-gradient(circle, rgba(16,185,129,0.22) 0%, rgba(5,150,105,0.08) 45%, transparent 70%)',
    buttonGradient: 'from-emerald-500 via-teal-600 to-emerald-600',
    glowShadow: 'shadow-[0_10px_28px_-6px_rgba(16,185,129,0.45),inset_0_1px_0_rgba(255,255,255,0.45)]',
  },
  {
    id: 'quiz',
    label: 'Bloom Test & Dars Rejasi',
    shortLabel: 'Test & Reja',
    badge: 'Bloom 4-Phase',
    icon: HelpCircle,
    accentText: 'text-violet-600 dark:text-violet-400',
    accentBg: 'bg-violet-500/12 dark:bg-violet-500/20',
    accentBorder: 'border-violet-500/30 dark:border-violet-400/35',
    orbGradient:
      'radial-gradient(circle, rgba(139,92,246,0.25) 0%, rgba(168,85,247,0.10) 45%, transparent 70%)',
    buttonGradient: 'from-violet-500 via-purple-600 to-indigo-600',
    glowShadow: 'shadow-[0_10px_28px_-6px_rgba(139,92,246,0.48),inset_0_1px_0_rgba(255,255,255,0.45)]',
  },
  {
    id: 'rubric',
    label: 'Baholash Rubrikalari',
    shortLabel: 'Rubrika',
    badge: 'Bloom AI',
    icon: GraduationCap,
    accentText: 'text-indigo-600 dark:text-indigo-400',
    accentBg: 'bg-indigo-500/12 dark:bg-indigo-500/20',
    accentBorder: 'border-indigo-500/30 dark:border-indigo-400/35',
    orbGradient:
      'radial-gradient(circle, rgba(99,102,241,0.25) 0%, rgba(168,85,247,0.10) 45%, transparent 70%)',
    buttonGradient: 'from-indigo-500 via-purple-600 to-indigo-600',
    glowShadow: 'shadow-[0_10px_28px_-6px_rgba(99,102,241,0.48),inset_0_1px_0_rgba(255,255,255,0.45)]',
  },
  {
    id: 'voice',
    label: 'Ovozli Xabarnoma (TTS)',
    shortLabel: 'Ovozli AI',
    badge: 'Neural TTS',
    icon: Volume2,
    accentText: 'text-cyan-600 dark:text-cyan-400',
    accentBg: 'bg-cyan-500/12 dark:bg-cyan-500/20',
    accentBorder: 'border-cyan-500/30 dark:border-cyan-400/35',
    orbGradient:
      'radial-gradient(circle, rgba(6,182,212,0.22) 0%, rgba(16,185,129,0.09) 45%, transparent 70%)',
    buttonGradient: 'from-cyan-500 via-teal-500 to-emerald-600',
    glowShadow: 'shadow-[0_10px_28px_-6px_rgba(6,182,212,0.45),inset_0_1px_0_rgba(255,255,255,0.45)]',
  },
  {
    id: 'scenario',
    label: 'Moliyaviy Ssenariy Modellashtirish',
    shortLabel: 'What-If Model',
    badge: 'Executive AI',
    icon: TrendingUp,
    accentText: 'text-amber-500 dark:text-amber-300',
    accentBg: 'bg-amber-500/12 dark:bg-amber-500/20',
    accentBorder: 'border-amber-500/30 dark:border-amber-400/35',
    orbGradient:
      'radial-gradient(circle, rgba(245,158,11,0.25) 0%, rgba(217,119,6,0.10) 45%, transparent 70%)',
    buttonGradient: 'from-amber-500 via-orange-600 to-amber-600',
    glowShadow: 'shadow-[0_10px_28px_-6px_rgba(245,158,11,0.48),inset_0_1px_0_rgba(255,255,255,0.45)]',
  },
] as const;

const QUIZ_PRESETS = [
  { topic: 'JavaScript: Event Loop va Asinxron Dasturlash', subject: 'Frontend Dasturlash' },
  { topic: 'IELTS Writing Task 2: Cohesion & Coherence', subject: 'Ingliz tili' },
  { topic: 'Matematika: Ehtimollar nazariyasi va Kombinatorika', subject: 'Matematika' },
  { topic: 'Python: Ma’lumotlar tuzilmalari va OOP tamoyillari', subject: 'Backend' },
] as const;

const DEBT_SEGMENTS = [
  { id: 'ALL', label: 'Barcha qarzdorlar', sub: 'Umumiy ro‘yxat' },
  { id: 'MILD_1_7_DAYS', label: 'Yengil (1–7 kun)', sub: 'Yumshoq eslatma' },
  { id: 'MODERATE_7_30_DAYS', label: 'O‘rtacha (8–30 kun)', sub: 'Tizimli ogohlantirish' },
  { id: 'SEVERE_30_PLUS_DAYS', label: 'Og‘ir (30+ kun)', sub: 'Qat’iy talabnoma' },
] as const;

const DEBT_TONES = [
  { id: 'friendly', label: 'Do‘stona va muloyim', badge: 'Tavsiya' },
  { id: 'official', label: 'Rasmiy / Korporativ', badge: 'Standart' },
  { id: 'urgent', label: 'Shoshilinch ogohlantirish', badge: 'Qat’iy' },
] as const;

const RUBRIC_PRESETS = [
  'IELTS Writing Task 2 Argumentative Essay',
  'Matematika: Kvadrat tenglamalar va funksiyalar',
  'Frontend React & TypeScript Amaliy Loyiha',
  'Speaking Mock Interview — Fluency & Coherence',
] as const;

const VOICE_PRESETS = [
  {
    label: 'Ertalabki Direktor Dayjesti',
    text: 'Assalomu alaykum! M-EDU AI Copilot tizimi barcha darslar, to‘lovlar va biometrik davomat ma’lumotlarini tahlil qildi. Bugungi umumiy davomat ko‘rsatkichi 94 foizni tashkil etmoqda, barcha guruhlarda darslar o‘z vaqtida boshlandi.',
  },
  {
    label: 'Qarzdorlik va Moliya Hisoboti',
    text: 'Diqqat, moliya bo‘limi axboroti: joriy oyda to‘lovlar rejasi 88 foizga bajarildi. Muddati o‘tgan qarzdorliklar bo‘yicha avtomatik SMS eslatmalar tayyorlandi va tasdiqlashingizni kutmoqda.',
  },
  {
    label: 'Face ID Xavfsizlik Xulosasi',
    text: 'Turniket va Face ID biometrik terminallari barqaror ishlamoqda. Bugun 312 nafar o‘quvchi yuzni tanish orqali markazga kirdi, ruxsatsiz kirish holatlari aniqlanmadi.',
  },
] as const;

/* ─────────────────────────────────────────────────────────────────────────
 * Shared Liquid Glass Subcomponents
 * ─────────────────────────────────────────────────────────────────────── */

const TopSpecular = memo(function TopSpecular({ inset = 'inset-x-8' }: { inset?: string }) {
  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute top-0 z-20', inset)}>
      <div className="h-px bg-gradient-to-r from-transparent via-white/95 to-transparent dark:via-white/35" />
      <div className="h-[0.5px] bg-gradient-to-r from-transparent via-indigo-400/35 to-transparent dark:via-indigo-400/25" />
    </div>
  );
});

const GLASS_CARD = cn(
  'relative isolate overflow-hidden rounded-[1.5rem]',
  'border border-black/[0.06] bg-white/[0.68] backdrop-blur-2xl',
  'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9),0_8px_24px_-6px_rgba(15,23,42,0.06)]',
  'dark:border-white/[0.09] dark:bg-white/[0.035]',
  'dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_12px_28px_-8px_rgba(0,0,0,0.45)]',
);

const GLASS_INPUT = cn(
  'w-full rounded-2xl border border-black/[0.08] bg-white/80 px-3.5 py-2.5 text-[13px] font-medium text-slate-900 placeholder:text-slate-400',
  'shadow-[inset_0_1px_2px_rgba(15,23,42,0.04),0_1px_0_rgba(255,255,255,0.8)] outline-none backdrop-blur-xl transition-all',
  'focus:border-indigo-500/60 focus:bg-white focus:ring-3 focus:ring-indigo-500/15',
  'dark:border-white/[0.1] dark:bg-white/[0.045] dark:text-white dark:placeholder:text-slate-500',
  'dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)] dark:focus:border-indigo-400/60 dark:focus:bg-white/[0.07]',
);

function getInitials(name?: string): string {
  if (!name) return 'ST';
  return (
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'ST'
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Main Component: AiExecutiveSuperStudio
 * ─────────────────────────────────────────────────────────────────────── */

type ChurnRadarData = Awaited<ReturnType<typeof aiApi.getChurnRadar>>;
type DebtCampaignData = Awaited<ReturnType<typeof aiApi.draftDebtRecoveryCampaign>>;
type RubricData = Awaited<ReturnType<typeof aiApi.generateRubric>>;

export function AiExecutiveSuperStudio({
  isOpen,
  onClose,
  onInsertPrompt,
  initialTab,
}: AiExecutiveSuperStudioProps) {
  const reduced = usePrefersReducedMotion();
  const haptics = useHaptics();
  const sound = usePremiumSound();

  const hapticsRef = useRef(haptics);
  const soundRef = useRef(sound);
  useEffect(() => {
    hapticsRef.current = haptics;
    soundRef.current = sound;
  }, [haptics, sound]);

  const [activeTab, setActiveTab] = useState<StudioTabId>(initialTab ?? 'churn');
  // Scenario Simulator interactive state
  const [studentDelta, setStudentDelta] = useState<number>(10);
  const [priceDelta, setPriceDelta] = useState<number>(0);
  const [expenseDelta, setExpenseDelta] = useState<number>(5);
  const [churnReduction, setChurnReduction] = useState<number>(15);

  useEffect(() => {
    if (initialTab && isOpen) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  // Independent per-module loading & error states
  const [churnLoading, setChurnLoading] = useState(false);
  const [debtLoading, setDebtLoading] = useState(false);
  const [diagnosticLoading, setDiagnosticLoading] = useState(false);
  const [quizLoading, setQuizLoading] = useState(false);
  const [rubricLoading, setRubricLoading] = useState(false);

  const [churnError, setChurnError] = useState<string | null>(null);
  const [debtError, setDebtError] = useState<string | null>(null);
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [rubricError, setRubricError] = useState<string | null>(null);

  const [churnData, setChurnData] = useState<ChurnRadarData | null>(null);
  const [debtData, setDebtData] = useState<DebtCampaignData | null>(null);
  const [diagnosticData, setDiagnosticData] = useState<AiStudentDiagnostic | null>(null);
  const [quizData, setQuizData] = useState<AiGeneratedQuizResponse | null>(null);
  const [rubricData, setRubricData] = useState<RubricData | null>(null);

  // Form states
  const [debtSegment, setDebtSegment] = useState<string>('ALL');
  const [debtTone, setDebtTone] = useState<string>('friendly');

  // Diagnostic form states
  const [diagnosticStudentId, setDiagnosticStudentId] = useState<string>('');
  const [diagnosticStudentName, setDiagnosticStudentName] = useState<string>('');

  // Quiz form states
  const [quizTopic, setQuizTopic] = useState<string>(
    'JavaScript: Event Loop va Asinxron Dasturlash',
  );
  const [quizSubject, setQuizSubject] = useState<string>('Frontend Dasturlash');
  const [quizLevel, setQuizLevel] = useState<string>("O‘rtacha");
  const [quizCount, setQuizCount] = useState<number>(5);

  const [rubricTopic, setRubricTopic] = useState<string>(
    'IELTS Writing Task 2 Argumentative Essay',
  );
  const [rubricMaxScore, setRubricMaxScore] = useState<number>(100);

  // Voice speech state
  const [speechText, setSpeechText] = useState<string>(VOICE_PRESETS[0].text);
  const [speechRate, setSpeechRate] = useState<number>(1.0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Copy feedback state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Zero-layout-thrash pointer spotlight tracking
  const modalRef = useRef<HTMLDivElement | null>(null);
  const rectRef = useRef<DOMRect | null>(null);
  const rafRef = useRef<number>(0);
  const pointRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const activeTabConfig =
    STUDIO_TABS.find((t) => t.id === activeTab) ?? STUDIO_TABS[0];

  /* ── Stop Speech Helper ────────────────────────────────────────── */
  const stopSpeaking = useCallback(() => {
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    } catch {
      /* ignore */
    }
    utteranceRef.current = null;
    setIsSpeaking(false);
  }, []);

  const handleClose = useCallback(() => {
    stopSpeaking();
    soundRef.current?.playTick?.();
    onClose();
  }, [stopSpeaking, onClose]);

  // Stop speech when modal closes or unmounts
  useEffect(() => {
    if (!isOpen) {
      stopSpeaking();
    }
    return () => {
      stopSpeaking();
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isOpen, stopSpeaking]);

  // Escape key, Tab focus trap & body scroll lock
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Auto-focus first interactive element when opened
    const focusTimer = setTimeout(() => {
      const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
      );
      if (focusable && focusable.length > 0) {
        focusable[0]?.focus();
      }
    }, 50);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        handleClose();
      } else if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      clearTimeout(focusTimer);
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, handleClose]);

  /* ── Pointer Caustic Spotlight ─────────────────────────────────── */
  const handlePointerEnter = useCallback(() => {
    if (reduced || !modalRef.current) return;
    rectRef.current = modalRef.current.getBoundingClientRect();
    modalRef.current.style.setProperty('--st-spot-opacity', '1');
  }, [reduced]);

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (reduced || !modalRef.current) return;
      pointRef.current = { x: e.clientX, y: e.clientY };
      if (!rectRef.current) {
        rectRef.current = modalRef.current.getBoundingClientRect();
      }
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        const el = modalRef.current;
        const r = rectRef.current;
        if (!el || !r) return;
        el.style.setProperty('--st-mx', `${(pointRef.current.x - r.left).toFixed(0)}px`);
        el.style.setProperty('--st-my', `${(pointRef.current.y - r.top).toFixed(0)}px`);
      });
    },
    [reduced],
  );

  const handlePointerLeave = useCallback(() => {
    rectRef.current = null;
    modalRef.current?.style.setProperty('--st-spot-opacity', '0');
  }, []);

  /* ── Copy & Insert Helpers ─────────────────────────────────────── */
  const handleCopy = useCallback((key: string, text: string) => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard
      .writeText(text)
      .then(() => {
        hapticsRef.current?.light?.();
        soundRef.current?.playTick?.();
        setCopiedKey(key);
        if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
        copyTimerRef.current = setTimeout(() => setCopiedKey(null), 2000);
      })
      .catch(() => {});
  }, []);

  const triggerInsertPrompt = useCallback(
    (promptText: string) => {
      if (!onInsertPrompt) return;
      hapticsRef.current?.medium?.();
      soundRef.current?.playPop?.();
      stopSpeaking();
      onInsertPrompt(promptText);
      onClose();
    },
    [onInsertPrompt, stopSpeaking, onClose],
  );

  /* ── API Actions ───────────────────────────────────────────────── */
  const fetchChurnRadar = useCallback(async () => {
    if (churnLoading) return;
    setChurnLoading(true);
    setChurnError(null);
    soundRef.current?.playPop?.();
    hapticsRef.current?.light?.();
    try {
      const res = await aiApi.getChurnRadar();
      setChurnData(res);
      soundRef.current?.playSuccess?.();
    } catch {
      setChurnError(
        'Xavf radarini yuklashda xatolik yuz berdi. Server aloqasini tekshirib, qayta urinib ko‘ring.',
      );
      soundRef.current?.playError?.();
    } finally {
      setChurnLoading(false);
    }
  }, [churnLoading]);

  const fetchDebtCampaign = useCallback(async () => {
    if (debtLoading) return;
    setDebtLoading(true);
    setDebtError(null);
    soundRef.current?.playPop?.();
    hapticsRef.current?.light?.();
    try {
      const res = await aiApi.draftDebtRecoveryCampaign({
        segment: debtSegment,
        tone: debtTone,
      });
      setDebtData(res);
      soundRef.current?.playSuccess?.();
    } catch {
      setDebtError(
        'Qarzdorlik xabarlarini generatsiya qilishda xatolik yuz berdi. Qayta urinib ko‘ring.',
      );
      soundRef.current?.playError?.();
    } finally {
      setDebtLoading(false);
    }
  }, [debtLoading, debtSegment, debtTone]);

  const fetchStudentDiagnostic = useCallback(
    async (studentIdToUse?: string, studentNameToUse?: string) => {
      const targetId = (studentIdToUse || diagnosticStudentId).trim();
      const targetName = (studentNameToUse || diagnosticStudentName).trim();
      if (!targetId || diagnosticLoading) return;
      setDiagnosticLoading(true);
      setDiagnosticError(null);
      soundRef.current?.playPop?.();
      hapticsRef.current?.light?.();
      try {
        const res = await aiApi.diagnoseStudent(targetId);
        setDiagnosticData(res);
        soundRef.current?.playSuccess?.();
      } catch {
        setDiagnosticError(
          `${targetName || 'Talaba'} bo‘yicha diagnostika olinmadi. Iltimos, qayta urinib ko‘ring.`,
        );
        soundRef.current?.playError?.();
      } finally {
        setDiagnosticLoading(false);
      }
    },
    [diagnosticStudentId, diagnosticStudentName, diagnosticLoading],
  );

  const generateQuizAction = useCallback(async () => {
    const cleanTopic = quizTopic.trim();
    if (!cleanTopic || quizLoading) {
      if (!cleanTopic) setQuizError('Iltimos, test mavzusini kiriting.');
      return;
    }
    setQuizLoading(true);
    setQuizError(null);
    soundRef.current?.playPop?.();
    hapticsRef.current?.light?.();
    try {
      const res = await aiApi.generateQuiz({
        topic: cleanTopic,
        subject: quizSubject,
        gradeLevel: quizLevel,
      });
      setQuizData(res);
      soundRef.current?.playSuccess?.();
    } catch {
      setQuizError(
        "Testni yaratib bo'lmadi: AI xizmati javob bermadi. Iltimos, qayta urinib ko'ring.",
      );

    } finally {
      setQuizLoading(false);
    }
  }, [quizTopic, quizSubject, quizLevel, quizLoading]);

  const generateRubric = useCallback(async () => {
    const cleanTopic = rubricTopic.trim();
    if (!cleanTopic || rubricLoading) {
      if (!cleanTopic) setRubricError('Iltimos, mavzu yoki topshiriq nomini kiriting.');
      return;
    }
    const safeScore = Number.isFinite(rubricMaxScore) && rubricMaxScore > 0 ? rubricMaxScore : 100;
    setRubricLoading(true);
    setRubricError(null);
    soundRef.current?.playPop?.();
    hapticsRef.current?.light?.();
    try {
      const res = await aiApi.generateRubric({
        topic: cleanTopic,
        maxScore: safeScore,
      });
      setRubricData(res);
      soundRef.current?.playSuccess?.();
    } catch {
      setRubricError(
        'Rubrikani generatsiya qilishda xatolik yuz berdi. Qayta urinib ko‘ring.',
      );
      soundRef.current?.playError?.();
    } finally {
      setRubricLoading(false);
    }
  }, [rubricTopic, rubricMaxScore, rubricLoading]);

  const handleSpeak = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (isSpeaking) {
      stopSpeaking();
      hapticsRef.current?.light?.();
      return;
    }
    const clean = speechText.trim();
    if (!clean) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(clean);
    utteranceRef.current = utterance;
    utterance.lang = 'uz-UZ';
    utterance.rate = speechRate;
    utterance.pitch = 1.02;
    utterance.onend = () => {
      setIsSpeaking(false);
      utteranceRef.current = null;
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      utteranceRef.current = null;
    };

    hapticsRef.current?.medium?.();
    soundRef.current?.playPop?.();
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }, [isSpeaking, speechText, speechRate, stopSpeaking]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="ai-super-studio-portal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed inset-0 z-[220] flex items-center justify-center p-2.5 sm:p-5"
        >
          {/* ── Frosted Optical Backdrop ──────────────────────────── */}
          <div
            onClick={handleClose}
            aria-hidden="true"
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-xl transition-opacity dark:bg-black/75"
          />

          {/* ── Main iOS 27 Liquid Glass Studio Window ────────────── */}
          <motion.div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-label="M-EDU AI Copilot Super Studio"
            onPointerEnter={handlePointerEnter}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
            initial={
              reduced
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.94, y: 20 }
            }
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={
              reduced
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.96, y: 14 }
            }
            transition={reduced ? { duration: 0.15 } : SPRING_MODAL}
            style={
              {
                '--st-mx': '50%',
                '--st-my': '0px',
                '--st-spot-opacity': '0',
              } as CSSProperties
            }
            className={cn(
              'relative isolate flex max-h-[92dvh] sm:max-h-[90dvh] w-full max-w-4xl flex-col overflow-hidden rounded-[1.85rem] sm:rounded-[2.25rem]',
              'border border-white/75 bg-white/[0.84] text-slate-900 backdrop-blur-3xl backdrop-saturate-[210%]',
              'shadow-[inset_0_1.5px_0_0_rgba(255,255,255,0.95),inset_0_-1px_0_0_rgba(99,102,241,0.16),0_32px_88px_-16px_rgba(15,23,42,0.32),0_4px_20px_-4px_rgba(15,23,42,0.1)]',
              'dark:border-white/[0.15] dark:bg-[#0B0F1A]/[0.88] dark:text-slate-100',
              'dark:shadow-[inset_0_1.5px_0_0_rgba(255,255,255,0.24),inset_0_-1px_0_0_rgba(99,102,241,0.24),0_36px_96px_-16px_rgba(0,0,0,0.85),0_6px_24px_-4px_rgba(0,0,0,0.55)]',
            )}
          >
            <TopSpecular inset="inset-x-10" />

            {/* ── 1. Dynamic Accent-Adaptive Volumetric Plasma Orbs ── */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-28 left-1/4 -z-10 h-80 w-[34rem] -translate-x-1/2 rounded-full blur-3xl transition-all duration-700"
              style={{ background: activeTabConfig.orbGradient }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-28 -right-20 -z-10 h-72 w-96 rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.14)_0%,transparent_70%)] blur-3xl"
            />

            {/* ── 2. Interactive Cursor Caustic Spotlight ──────────── */}
            <div
              aria-hidden="true"
              style={{
                opacity: 'var(--st-spot-opacity, 0)',
                background:
                  'radial-gradient(380px circle at var(--st-mx, 50%) var(--st-my, 0px), rgba(255,255,255,0.32), rgba(99,102,241,0.08) 45%, transparent 75%)',
              }}
              className="pointer-events-none absolute inset-0 -z-10 transition-opacity duration-500 dark:mix-blend-screen"
            />

            {/* ── 3. Studio Header ─────────────────────────────────── */}
            <header className="relative z-10 flex items-center justify-between gap-3 sm:gap-4 border-b border-black/[0.06] px-4 py-3.5 sm:px-7 sm:py-5 dark:border-white/[0.08]">
              <div className="flex min-w-0 items-center gap-3 sm:gap-3.5">
                <div className="relative shrink-0">
                  <div
                    aria-hidden="true"
                    className="absolute -inset-1 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 opacity-45 blur-md"
                  />
                  <div className="relative flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 text-white shadow-[inset_0_1.5px_0_rgba(255,255,255,0.55),0_8px_20px_-4px_rgba(99,102,241,0.5)] ring-1 ring-white/30">
                    <Sparkles className="h-5 w-5" />
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-sm sm:text-base lg:text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
                      M-EDU AI Super Studio
                    </h2>
                    <span className="inline-flex items-center gap-1 rounded-full border border-indigo-500/25 bg-indigo-500/10 px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-indigo-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] dark:border-indigo-400/30 dark:bg-indigo-500/20 dark:text-indigo-300">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500 dark:bg-indigo-400" />
                      Executive Lab
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400">
                    Sun’iy intellekt orqali o‘quv markazini boshqarish va chuqur tahlil laboratoriyasi
                  </p>
                </div>
              </div>

              <motion.button
                type="button"
                whileTap={reduced ? undefined : { scaleX: 1.08, scaleY: 0.9 }}
                transition={SPRING_GEL}
                onClick={handleClose}
                aria-label="Yopish"
                title="Yopish (Esc)"
                className="flex h-11 w-11 sm:h-9 sm:w-9 min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px] shrink-0 items-center justify-center rounded-full border border-black/[0.07] bg-black/[0.04] text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] transition-colors hover:bg-black/[0.08] hover:text-slate-900 dark:border-white/[0.1] dark:bg-white/[0.06] dark:text-slate-400 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] dark:hover:bg-white/[0.12] dark:hover:text-white touch-manipulation"
              >
                <X className="h-4 w-4" />
              </motion.button>
            </header>

            {/* ── 4. Segmented Liquid Lens Tab Bar ─────────────────── */}
            <div className="relative z-10 shrink-0 border-b border-black/[0.06] bg-black/[0.02] px-3 py-2.5 sm:px-7 dark:border-white/[0.07] dark:bg-white/[0.015]">
              <LayoutGroup id="ai-super-studio-tabs">
                <div
                  role="tablist"
                  aria-label="AI Super Studio modullari"
                  className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6"
                >
                  {STUDIO_TABS.map((tab) => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.id;
                    return (
                      <motion.button
                        key={tab.id}
                        id={`studio-tab-${tab.id}`}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        aria-controls={`studio-panel-${tab.id}`}
                        whileTap={reduced ? undefined : { scaleX: 1.03, scaleY: 0.95 }}
                        transition={SPRING_GEL}
                        onClick={() => {
                          soundRef.current?.playTick?.();
                          hapticsRef.current?.light?.();
                          setActiveTab(tab.id);
                        }}
                        className={cn(
                          'relative flex items-center justify-center gap-1.5 sm:gap-2 rounded-2xl px-2.5 sm:px-3 py-2.5 text-xs font-bold tracking-tight transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 min-h-[44px] touch-manipulation',
                          active
                            ? tab.accentText
                            : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200',
                        )}
                      >
                        {active && (
                          <motion.span
                            layoutId="superStudioTabPill"
                            transition={reduced ? { duration: 0.15 } : SPRING_PILL}
                            aria-hidden="true"
                            className={cn(
                              'absolute inset-0 -z-10 rounded-2xl border bg-white/90 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.95),0_4px_14px_-4px_rgba(15,23,42,0.1)] dark:bg-white/[0.08] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_4px_16px_-4px_rgba(0,0,0,0.5)]',
                              tab.accentBorder,
                            )}
                          />
                        )}
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate hidden md:inline">{tab.label}</span>
                        <span className="truncate md:hidden">{tab.shortLabel}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </LayoutGroup>
            </div>

            {/* ── 5. Interactive Module Stage ──────────────────────── */}
            <div className="relative z-10 min-h-0 flex-1 overflow-y-auto p-4 sm:p-7">
              <AnimatePresence mode="wait">
                {/* ════════════════════════════════════════════════════
                 * TAB 1: CHURN RADAR (Ketib Qolish Xavfi Radari)
                 * ══════════════════════════════════════════════════ */}
                {activeTab === 'churn' && (
                  <motion.div
                    key="tab-churn"
                    id="studio-panel-churn"
                    role="tabpanel"
                    aria-labelledby="studio-tab-churn"
                    tabIndex={0}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18 }}
                    className="space-y-5 outline-none"
                  >
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                            O‘quvchilarning Kursni Tark Etish Xavfi Radari
                          </h3>
                          <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                            Early Warning
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                          Davomat pasayishi, to‘lov kechikishi va faollik tushishini birgalikda o‘rganuvchi AI modeli
                        </p>
                      </div>

                      <motion.button
                        type="button"
                        whileTap={reduced ? undefined : { scaleX: 1.04, scaleY: 0.94 }}
                        transition={SPRING_GEL}
                        onClick={fetchChurnRadar}
                        disabled={churnLoading}
                        className={cn(
                          'inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r px-4 py-2.5 text-xs font-bold text-white transition-all disabled:opacity-50 min-h-[44px] sm:min-h-[40px] touch-manipulation',
                          activeTabConfig.buttonGradient,
                          activeTabConfig.glowShadow,
                        )}
                      >
                        <RefreshCw
                          className={cn('h-3.5 w-3.5', churnLoading && 'animate-spin')}
                        />
                        <span>
                          {churnLoading ? 'Tahlil qilinmoqda…' : 'Tahlilni Yangilash'}
                        </span>
                      </motion.button>
                    </div>

                    {churnError && (
                      <div
                        role="alert"
                        className="flex items-center justify-between gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-semibold text-rose-600 dark:text-rose-300"
                      >
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          <span>{churnError}</span>
                        </div>
                        <button
                          type="button"
                          onClick={fetchChurnRadar}
                          className="shrink-0 rounded-lg bg-rose-500/20 px-2.5 py-1 text-[11px] font-bold hover:bg-rose-500/30"
                        >
                          Qayta urinish
                        </button>
                      </div>
                    )}

                    {!churnData ? (
                      <div className={cn(GLASS_CARD, 'flex flex-col items-center justify-center px-6 py-14 text-center')}>
                        <TopSpecular inset="inset-x-8" />
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-rose-500/25 bg-rose-500/10 text-rose-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_12px_28px_-8px_rgba(244,63,94,0.35)]">
                          <ShieldAlert className="h-8 w-8" />
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          AI Xavf Radari skanerlashga tayyor
                        </h4>
                        <p className="mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">
                          Barcha faol guruhlardagi o‘quvchilarning davomat va to‘lov dinamikasini tekshirish uchun yuqoridagi tugmani bosing.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* KPI Bento Row */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <div className={cn(GLASS_CARD, 'p-4')}>
                            <TopSpecular inset="inset-x-5" />
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Tahlil qilinganlar
                              </span>
                              <Activity className="h-4 w-4 text-indigo-500" />
                            </div>
                            <div className="mt-2 font-mono text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">
                              {churnData.totalAnalyzed ?? 0}{' '}
                              <span className="text-xs font-semibold text-slate-400">nafar</span>
                            </div>
                          </div>

                          <div className="relative isolate overflow-hidden rounded-[1.5rem] border border-rose-500/30 bg-rose-500/[0.08] p-4 backdrop-blur-2xl dark:border-rose-400/30 dark:bg-rose-500/[0.12]">
                            <TopSpecular inset="inset-x-5" />
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-300">
                                Yuqori Xavf (High)
                              </span>
                              <ShieldAlert className="h-4 w-4 text-rose-500" />
                            </div>
                            <div className="mt-2 font-mono text-2xl font-extrabold tabular-nums text-rose-600 dark:text-rose-400">
                              {churnData.highRiskCount ?? 0}{' '}
                              <span className="text-xs font-semibold opacity-80">nafar</span>
                            </div>
                          </div>

                          <div className="relative isolate overflow-hidden rounded-[1.5rem] border border-amber-500/30 bg-amber-500/[0.08] p-4 backdrop-blur-2xl dark:border-amber-400/30 dark:bg-amber-500/[0.12]">
                            <TopSpecular inset="inset-x-5" />
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-300">
                                O‘rtacha Xavf (Medium)
                              </span>
                              <AlertTriangle className="h-4 w-4 text-amber-500" />
                            </div>
                            <div className="mt-2 font-mono text-2xl font-extrabold tabular-nums text-amber-600 dark:text-amber-400">
                              {churnData.mediumRiskCount ?? 0}{' '}
                              <span className="text-xs font-semibold opacity-80">nafar</span>
                            </div>
                          </div>
                        </div>

                        {/* At-Risk Student Cards */}
                        <div className="space-y-2.5">
                          {(churnData.students || []).map((s) => {
                            const isHigh = s.riskLevel === 'HIGH';
                            const score = Math.min(100, Math.max(0, Number(s.riskScore) || 0));
                            return (
                              <div
                                key={s.studentId}
                                className={cn(
                                  GLASS_CARD,
                                  'p-4 transition-all hover:border-rose-500/35',
                                )}
                              >
                                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                                  <div className="flex min-w-0 items-center gap-3">
                                    <div
                                      className={cn(
                                        'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xs font-extrabold text-white shadow-sm',
                                        isHigh
                                          ? 'bg-gradient-to-br from-rose-500 to-pink-600'
                                          : 'bg-gradient-to-br from-amber-500 to-orange-600',
                                      )}
                                    >
                                      {getInitials(s.name)}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="truncate text-sm font-bold text-slate-900 dark:text-white">
                                          {s.name}
                                        </span>
                                        <span
                                          className={cn(
                                            'rounded-full border px-2.5 py-0.5 font-mono text-[10.5px] font-bold uppercase',
                                            isHigh
                                              ? 'border-rose-500/35 bg-rose-500/15 text-rose-600 dark:text-rose-300'
                                              : 'border-amber-500/35 bg-amber-500/15 text-amber-600 dark:text-amber-300',
                                          )}
                                        >
                                          Xavf: {score}%
                                        </span>
                                      </div>

                                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                                        {s.phone && (
                                          <span className="inline-flex items-center gap-1 font-mono">
                                            <Phone className="h-3 w-3 opacity-70" />
                                            {s.phone}
                                          </span>
                                        )}
                                        <span>
                                          Davomat:{' '}
                                          <strong className="text-slate-800 dark:text-slate-200">
                                            {s.attendanceRate}%
                                          </strong>
                                        </span>
                                        <span>
                                          Balans:{' '}
                                          <strong
                                            className={
                                              Number(s.balanceUzs) < 0
                                                ? 'text-rose-600 dark:text-rose-400'
                                                : 'text-emerald-600 dark:text-emerald-400'
                                            }
                                          >
                                            {Number(s.balanceUzs || 0).toLocaleString('uz-UZ')} so‘m
                                          </strong>
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {onInsertPrompt && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        triggerInsertPrompt(
                                          `O‘quvchi ${s.name} (Xavf darajasi: ${score}%, Davomat: ${s.attendanceRate}%, Balans: ${Number(s.balanceUzs || 0).toLocaleString('uz-UZ')} so‘m) bo‘yicha individual saqlab qolish rejasini va ota-onasiga yuboriladigan xabar matnini tuzib ber.`,
                                        )
                                      }
                                      className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-1.5 text-[11px] font-bold text-rose-600 transition-colors hover:bg-rose-500/20 sm:self-center dark:text-rose-300"
                                    >
                                      <span>Copilot’da yechim</span>
                                      <ArrowUpRight className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>

                                {/* Risk Progress Bar */}
                                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.08]">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${score}%` }}
                                    transition={{ duration: 0.7, ease: 'easeOut' }}
                                    className={cn(
                                      'h-full rounded-full',
                                      isHigh
                                        ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                                        : 'bg-gradient-to-r from-amber-400 to-orange-500',
                                    )}
                                  />
                                </div>

                                {s.recommendation && (
                                  <div className="mt-3 rounded-xl border border-indigo-500/20 bg-indigo-500/[0.06] px-3 py-2 text-xs text-slate-700 dark:text-slate-300">
                                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                      💡 AI Tavsiyasi:{' '}
                                    </span>
                                    {s.recommendation}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* ════════════════════════════════════════════════════
                 * TAB 2: DEBT CAMPAIGN (Qarzdorlikni Tiklash)
                 * ══════════════════════════════════════════════════ */}
                {activeTab === 'debt' && (
                  <motion.div
                    key="tab-debt"
                    id="studio-panel-debt"
                    role="tabpanel"
                    aria-labelledby="studio-tab-debt"
                    tabIndex={0}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18 }}
                    className="space-y-5 outline-none"
                  >
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                            Avtomatlashtirilgan Qarzdorlikni Tiklash Kampaniyasi
                          </h3>
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                            Smart Recovery
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                          Kechikkan muddatga qarab muloyim, rasmiy va qat’iy xabarlarni generatsiya qilish
                        </p>
                      </div>

                      <motion.button
                        type="button"
                        whileTap={reduced ? undefined : { scaleX: 1.04, scaleY: 0.94 }}
                        transition={SPRING_GEL}
                        onClick={fetchDebtCampaign}
                        disabled={debtLoading}
                        className={cn(
                          'inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r px-4 py-2.5 text-xs font-bold text-white transition-all disabled:opacity-50 min-h-[44px] sm:min-h-[40px] touch-manipulation',
                          activeTabConfig.buttonGradient,
                          activeTabConfig.glowShadow,
                        )}
                      >
                        <RefreshCw
                          className={cn('h-3.5 w-3.5', debtLoading && 'animate-spin')}
                        />
                        <span>
                          {debtLoading
                            ? 'Generatsiya qilinmoqda…'
                            : 'Xabarlarni Generatsiya Qilish'}
                        </span>
                      </motion.button>
                    </div>

                    {/* Liquid Glass Segment & Tone Selectors */}
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <div className={cn(GLASS_CARD, 'p-4')}>
                        <TopSpecular inset="inset-x-5" />
                        <label className="mb-2.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          1. Qarzdorlar Segmenti
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {DEBT_SEGMENTS.map((seg) => {
                            const selected = debtSegment === seg.id;
                            return (
                              <button
                                key={seg.id}
                                type="button"
                                onClick={() => {
                                  soundRef.current?.playTick?.();
                                  setDebtSegment(seg.id);
                                }}
                                className={cn(
                                  'flex flex-col items-start rounded-xl border p-2.5 text-left transition-all',
                                  selected
                                    ? 'border-amber-500/50 bg-amber-500/12 text-amber-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:border-amber-400/50 dark:bg-amber-500/20 dark:text-amber-300'
                                    : 'border-black/[0.06] bg-white/50 text-slate-600 hover:bg-white/80 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-slate-300 dark:hover:bg-white/[0.06]',
                                )}
                              >
                                <span className="text-xs font-bold">{seg.label}</span>
                                <span className="mt-0.5 text-[10px] opacity-75">{seg.sub}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className={cn(GLASS_CARD, 'p-4')}>
                        <TopSpecular inset="inset-x-5" />
                        <label className="mb-2.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          2. Xabar Ohangi (Tone of Voice)
                        </label>
                        <div className="space-y-2">
                          {DEBT_TONES.map((tItem) => {
                            const selected = debtTone === tItem.id;
                            return (
                              <button
                                key={tItem.id}
                                type="button"
                                onClick={() => {
                                  soundRef.current?.playTick?.();
                                  setDebtTone(tItem.id);
                                }}
                                className={cn(
                                  'flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-xs font-bold transition-all',
                                  selected
                                    ? 'border-amber-500/50 bg-amber-500/12 text-amber-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:border-amber-400/50 dark:bg-amber-500/20 dark:text-amber-300'
                                    : 'border-black/[0.06] bg-white/50 text-slate-600 hover:bg-white/80 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-slate-300 dark:hover:bg-white/[0.06]',
                                )}
                              >
                                <span>{tItem.label}</span>
                                <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-[10px] dark:bg-white/10">
                                  {tItem.badge}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {debtError && (
                      <div
                        role="alert"
                        className="flex items-center justify-between gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-semibold text-rose-600 dark:text-rose-300"
                      >
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          <span>{debtError}</span>
                        </div>
                        <button
                          type="button"
                          onClick={fetchDebtCampaign}
                          className="shrink-0 rounded-lg bg-rose-500/20 px-2.5 py-1 text-[11px] font-bold hover:bg-rose-500/30"
                        >
                          Qayta urinish
                        </button>
                      </div>
                    )}

                    {debtData && (
                      <div className="space-y-3.5">
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.09] px-4 py-3 text-xs dark:bg-amber-500/[0.14]">
                          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                            <Wallet className="h-4 w-4 text-amber-500" />
                            <span>
                              Topilgan qarzdorlar:{' '}
                              <strong className="font-mono text-sm">
                                {debtData.targetCount ?? 0} nafar
                              </strong>
                            </span>
                          </div>
                          <span className="font-mono text-xs font-bold text-amber-800 dark:text-amber-200">
                            Jami qarz: {Number(debtData.totalDebtUzs || 0).toLocaleString('uz-UZ')} so‘m
                          </span>
                        </div>

                        <div className="space-y-3">
                          {Object.entries(debtData.templates || {}).map(([key, tmpl]) => {
                            if (!tmpl) return null;
                            const isCopied = copiedKey === `debt-${key}`;
                            const tmplTitle = tmpl.title || 'SMS Eslatma';
                            const tmplText = tmpl.textUz || '';
                            return (
                              <div key={key} className={cn(GLASS_CARD, 'p-4')}>
                                <TopSpecular inset="inset-x-6" />
                                <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-xs font-extrabold text-amber-600 dark:text-amber-400">
                                    {tmplTitle}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleCopy(`debt-${key}`, tmplText)}
                                      className="inline-flex items-center gap-1 rounded-xl border border-black/[0.08] bg-white/70 px-2.5 py-1 text-[11px] font-bold text-slate-700 transition-colors hover:bg-white dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200"
                                    >
                                      {isCopied ? (
                                        <>
                                          <Check className="h-3 w-3 text-emerald-500" />
                                          <span>Nusxalandi</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="h-3 w-3" />
                                          <span>Nusxa olish</span>
                                        </>
                                      )}
                                    </button>
                                    {onInsertPrompt && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          triggerInsertPrompt(
                                            `Ushbu xabarni qarzdor o‘quvchilarga yuborish rejasini tasdiqlab ber: "${tmplText}"`,
                                          )
                                        }
                                        className="inline-flex items-center gap-1 rounded-xl border border-indigo-500/30 bg-indigo-500/15 px-3 py-1 text-[11px] font-bold text-indigo-600 transition-colors hover:bg-indigo-500/25 dark:text-indigo-300"
                                      >
                                        <span>Copilot’ga joylash</span>
                                        <ArrowUpRight className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <p className="rounded-xl border border-black/[0.05] bg-black/[0.025] p-3 font-mono text-xs leading-relaxed text-slate-700 dark:border-white/[0.06] dark:bg-black/30 dark:text-slate-200">
                                  {tmplText}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* ════════════════════════════════════════════════════
                 * TAB 3: STUDENT 360° DIAGNOSTIC (O‘quvchi 360° Diagnostika)
                 * ══════════════════════════════════════════════════ */}
                {activeTab === 'diagnostic' && (
                  <motion.div
                    key="tab-diagnostic"
                    id="studio-panel-diagnostic"
                    role="tabpanel"
                    aria-labelledby="studio-tab-diagnostic"
                    tabIndex={0}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18 }}
                    className="space-y-5 outline-none"
                  >
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                            O‘quvchining 360° Akademik va Pedagogik Diagnostikasi
                          </h3>
                          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                            Retention & Pedagogy
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                          O‘quvchining davomati, baholari, to‘lovlari va o‘zlashtirish dinamikasini chuqur tahlil qilish
                        </p>
                      </div>

                      <motion.button
                        type="button"
                        whileTap={reduced ? undefined : { scaleX: 1.04, scaleY: 0.94 }}
                        transition={SPRING_GEL}
                        onClick={() => fetchStudentDiagnostic()}
                        disabled={diagnosticLoading || !diagnosticStudentId.trim()}
                        className={cn(
                          'inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r px-4 py-2.5 text-xs font-bold text-white transition-all disabled:opacity-50 min-h-[44px] sm:min-h-[40px] touch-manipulation',
                          activeTabConfig.buttonGradient,
                          activeTabConfig.glowShadow,
                        )}
                      >
                        <RefreshCw
                          className={cn('h-3.5 w-3.5', diagnosticLoading && 'animate-spin')}
                        />
                        <span>
                          {diagnosticLoading ? 'Tahlil qilinmoqda…' : 'Diagnostika O‘tkazish'}
                        </span>
                      </motion.button>
                    </div>

                    <div className={cn(GLASS_CARD, 'space-y-3.5 p-4')}>
                      <TopSpecular inset="inset-x-6" />
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Talaba ID yoki Kodi
                          </label>
                          <input
                            type="text"
                            value={diagnosticStudentId}
                            onChange={(e) => {
                              setDiagnosticStudentId(e.target.value);
                              if (diagnosticError) setDiagnosticError(null);
                            }}
                            placeholder="Masalan: s1, s2 yoki talaba ID"
                            className={GLASS_INPUT}
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Talaba Ism-Familiyasi (Qidiruv)
                          </label>
                          <input
                            type="text"
                            value={diagnosticStudentName}
                            onChange={(e) => setDiagnosticStudentName(e.target.value)}
                            placeholder="Masalan: Javohir Toshmatov"
                            className={GLASS_INPUT}
                          />
                        </div>
                      </div>

                    </div>

                    {diagnosticError && (
                      <div
                        role="alert"
                        className="flex items-center justify-between gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-semibold text-rose-600 dark:text-rose-300"
                      >
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          <span>{diagnosticError}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => fetchStudentDiagnostic()}
                          className="shrink-0 rounded-lg bg-rose-500/20 px-2.5 py-1 text-[11px] font-bold hover:bg-rose-500/30"
                        >
                          Qayta urinish
                        </button>
                      </div>
                    )}

                    {!diagnosticData ? (
                      <div className={cn(GLASS_CARD, 'flex flex-col items-center justify-center px-6 py-14 text-center')}>
                        <TopSpecular inset="inset-x-8" />
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_12px_28px_-8px_rgba(16,185,129,0.35)]">
                          <Activity className="h-8 w-8" />
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Talaba diagnostika tahlili tayyor
                        </h4>
                        <p className="mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">
                          Yuqoridagi namunaviy talabalardan birini tanlang yoki talaba ID raqamini kiritib &ldquo;Diagnostika O‘tkazish&rdquo; tugmasini bosing.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* 360 Score & Health Card */}
                        <div className={cn(GLASS_CARD, 'p-5')}>
                          <TopSpecular inset="inset-x-8" />
                          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/[0.06] pb-4 dark:border-white/[0.08]">
                            <div className="flex items-center gap-3">
                              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-base font-black text-white shadow-md">
                                {getInitials(diagnosticData.studentName)}
                              </div>
                              <div>
                                <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                                  {diagnosticData.studentName}
                                </h4>
                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                  Guruh: {diagnosticData.groups?.join(', ') || 'Asosiy guruh'}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                  Akademik Salomatlik
                                </div>
                                <div className="text-2xl font-black tabular-nums text-emerald-600 dark:text-emerald-400">
                                  {diagnosticData.overallScore}%
                                </div>
                              </div>
                              <span
                                className={cn(
                                  'rounded-xl px-3 py-1.5 text-xs font-bold uppercase tracking-wide',
                                  diagnosticData.riskLevel === 'low'
                                    ? 'bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                                    : diagnosticData.riskLevel === 'medium'
                                      ? 'bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                                      : 'bg-rose-500/15 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
                                )}
                              >
                                {diagnosticData.riskLevel === 'low'
                                  ? 'Barqaror (Past xavf)'
                                  : diagnosticData.riskLevel === 'medium'
                                    ? 'Diqqat (O‘rtacha)'
                                    : 'Kritik Xavf'}
                              </span>
                            </div>
                          </div>

                          {/* 4 Metric Chips */}
                          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <div className="rounded-2xl border border-black/[0.05] bg-black/[0.02] p-3 dark:border-white/[0.06] dark:bg-white/[0.02]">
                              <div className="text-[10.5px] font-bold uppercase text-slate-400">
                                Davomat
                              </div>
                              <div className="mt-0.5 text-base font-extrabold text-slate-900 dark:text-white">
                                {diagnosticData.attendanceRate}%
                              </div>
                            </div>
                            <div className="rounded-2xl border border-black/[0.05] bg-black/[0.02] p-3 dark:border-white/[0.06] dark:bg-white/[0.02]">
                              <div className="text-[10.5px] font-bold uppercase text-slate-400">
                                O‘rtacha Baho
                              </div>
                              <div className="mt-0.5 text-base font-extrabold text-slate-900 dark:text-white">
                                {diagnosticData.averageGrade ?? '4.5'}
                              </div>
                            </div>
                            <div className="rounded-2xl border border-black/[0.05] bg-black/[0.02] p-3 dark:border-white/[0.06] dark:bg-white/[0.02]">
                              <div className="text-[10.5px] font-bold uppercase text-slate-400">
                                Moliyaviy Balans
                              </div>
                              <div className="mt-0.5 text-base font-extrabold text-slate-900 dark:text-white">
                                {(Number(diagnosticData.balance) || 0) <= 0 ? 'To‘langan' : `${(Number(diagnosticData.balance) || 0).toLocaleString()} so‘m`}
                              </div>
                            </div>
                            <div className="rounded-2xl border border-black/[0.05] bg-black/[0.02] p-3 dark:border-white/[0.06] dark:bg-white/[0.02]">
                              <div className="text-[10.5px] font-bold uppercase text-slate-400">
                                AI Status
                              </div>
                              <div className="mt-0.5 text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                                Tasdiqlangan
                              </div>
                            </div>
                          </div>

                          <p className="mt-3.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                            {diagnosticData.summary}
                          </p>
                        </div>

                        {/* Multi-Vector SWOT: Strengths & Risks */}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div className={cn(GLASS_CARD, 'p-4')}>
                            <TopSpecular inset="inset-x-6" />
                            <div className="mb-2.5 flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="h-4 w-4" />
                              <span>Kuchli Tomonlar & Yutuqlar</span>
                            </div>
                            <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                              {(diagnosticData.strengths || []).map((str, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                                  <span>{str}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className={cn(GLASS_CARD, 'p-4')}>
                            <TopSpecular inset="inset-x-6" />
                            <div className="mb-2.5 flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400">
                              <AlertTriangle className="h-4 w-4" />
                              <span>Xavf Omillari & Bo‘shliqlar</span>
                            </div>
                            <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                              {(diagnosticData.riskFactors || []).map((rf, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                                  <span>{rf}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* AI Recommendations & Suggested Parent Message */}
                        <div className={cn(GLASS_CARD, 'space-y-3.5 p-4 sm:p-5')}>
                          <TopSpecular inset="inset-x-8" />
                          <div>
                            <div className="mb-2 flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                              <Target className="h-4 w-4" />
                              <span>Pedagogik Tavsiyalar va Yo‘l Xaritasi</span>
                            </div>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              {(diagnosticData.recommendations || []).map((rec, idx) => (
                                <div
                                  key={idx}
                                  className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-2.5 text-xs text-slate-700 dark:text-slate-300"
                                >
                                  {rec}
                                </div>
                              ))}
                            </div>
                          </div>

                          {diagnosticData.suggestedParentMessage && (
                            <div className="mt-3 rounded-2xl border border-black/[0.07] bg-white/70 p-3.5 dark:border-white/[0.08] dark:bg-white/[0.03]">
                              <div className="mb-1.5 flex items-center justify-between">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                  Ota-onaga Tavsiya Etilgan SMS Loyihasi:
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCopy('diag-msg', diagnosticData.suggestedParentMessage)
                                    }
                                    className="inline-flex items-center gap-1 rounded-lg border border-black/[0.06] bg-black/[0.03] px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-black/[0.06] dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-300"
                                  >
                                    {copiedKey === 'diag-msg' ? (
                                      <>
                                        <Check className="h-3 w-3 text-emerald-500" />
                                        <span>Nusxalandi</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="h-3 w-3" />
                                        <span>Nusxa olish</span>
                                      </>
                                    )}
                                  </button>
                                  {onInsertPrompt && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        triggerInsertPrompt(
                                          `Quyidagi ota-onaga xabar loyihasini tekshirib, yakuniy yuborish formatiga keltir:\n"${diagnosticData.suggestedParentMessage}"`,
                                        )
                                      }
                                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 shadow-sm"
                                    >
                                      <span>Copilot’ga yuborish</span>
                                      <ArrowUpRight className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs font-medium italic text-slate-700 dark:text-slate-200">
                                &ldquo;{diagnosticData.suggestedParentMessage}&rdquo;
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* ════════════════════════════════════════════════════
                 * TAB 4: BLOOM QUIZ & LESSON GENERATOR (Bloom Test & Reja)
                 * ══════════════════════════════════════════════════ */}
                {activeTab === 'quiz' && (
                  <motion.div
                    key="tab-quiz"
                    id="studio-panel-quiz"
                    role="tabpanel"
                    aria-labelledby="studio-tab-quiz"
                    tabIndex={0}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18 }}
                    className="space-y-5 outline-none"
                  >
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                            Bloom Test & Dars Rejasi Generatori
                          </h3>
                          <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                            Bloom 4-Phase
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                          Pedagogik bosqichli dars konspekti va avtomatik javob kalitlari bilan interaktiv testlar
                        </p>
                      </div>

                      <motion.button
                        type="button"
                        whileTap={reduced ? undefined : { scaleX: 1.04, scaleY: 0.94 }}
                        transition={SPRING_GEL}
                        onClick={generateQuizAction}
                        disabled={quizLoading || !quizTopic.trim()}
                        className={cn(
                          'inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r px-4 py-2.5 text-xs font-bold text-white transition-all disabled:opacity-50 min-h-[44px] sm:min-h-[40px] touch-manipulation',
                          activeTabConfig.buttonGradient,
                          activeTabConfig.glowShadow,
                        )}
                      >
                        <Sparkles
                          className={cn('h-3.5 w-3.5', quizLoading && 'animate-spin')}
                        />
                        <span>
                          {quizLoading ? 'Tuzilmoqda…' : 'Test & Reja Generatsiya Qilish'}
                        </span>
                      </motion.button>
                    </div>

                    <div className={cn(GLASS_CARD, 'space-y-3.5 p-4')}>
                      <TopSpecular inset="inset-x-6" />
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="sm:col-span-2">
                          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Mavzu Nomi
                          </label>
                          <input
                            type="text"
                            value={quizTopic}
                            onChange={(e) => {
                              setQuizTopic(e.target.value);
                              if (quizError) setQuizError(null);
                            }}
                            placeholder="Masalan: JavaScript Event Loop yoki IELTS Writing Task 2"
                            className={GLASS_INPUT}
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Fan / Yo‘nalish
                          </label>
                          <input
                            type="text"
                            value={quizSubject}
                            onChange={(e) => setQuizSubject(e.target.value)}
                            placeholder="Masalan: Dasturlash, Ingliz tili"
                            className={GLASS_INPUT}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div>
                          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Daraja
                          </label>
                          <select
                            value={quizLevel}
                            onChange={(e) => setQuizLevel(e.target.value)}
                            className={GLASS_INPUT}
                          >
                            <option value="Boshlang‘ich">Boshlang‘ich</option>
                            <option value="O‘rtacha">O‘rtacha</option>
                            <option value="Murakkab">Murakkab / Advanced</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Savollar Soni
                          </label>
                          <select
                            value={quizCount}
                            onChange={(e) => setQuizCount(Number(e.target.value) || 5)}
                            className={GLASS_INPUT}
                          >
                            <option value={3}>3 ta savol</option>
                            <option value={5}>5 ta savol (Standart)</option>
                            <option value={10}>10 ta savol</option>
                          </select>
                        </div>
                        <div className="col-span-2 flex items-end">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                              Shablonlar:
                            </span>
                            {QUIZ_PRESETS.map((preset) => (
                              <button
                                key={preset.topic}
                                type="button"
                                onClick={() => {
                                  soundRef.current?.playTick?.();
                                  setQuizTopic(preset.topic);
                                  setQuizSubject(preset.subject);
                                }}
                                className={cn(
                                  'rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-all',
                                  quizTopic === preset.topic
                                    ? 'border-violet-500/40 bg-violet-500/15 text-violet-700 dark:text-violet-300'
                                    : 'border-black/[0.06] bg-black/[0.03] text-slate-600 hover:bg-black/[0.06] dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-400',
                                )}
                              >
                                {preset.subject}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {quizError && (
                      <div
                        role="alert"
                        className="flex items-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-semibold text-rose-600 dark:text-rose-300"
                      >
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>{quizError}</span>
                      </div>
                    )}

                    {quizData && (
                      <div className="space-y-4">
                        {/* Micro Lesson Plan */}
                        <div className={cn(GLASS_CARD, 'p-5')}>
                          <TopSpecular inset="inset-x-8" />
                          <div className="flex items-center justify-between border-b border-black/[0.06] pb-3 dark:border-white/[0.08]">
                            <div className="flex items-center gap-2">
                              <BookOpen className="h-4 w-4 text-violet-500" />
                              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                                {quizData.lessonPlan?.title || `${quizData.topic} dars rejasi`}
                              </h4>
                            </div>
                            <span className="flex items-center gap-1 text-xs font-bold text-violet-600 dark:text-violet-400">
                              <Clock className="h-3.5 w-3.5" />
                              <span>{quizData.lessonPlan?.durationMinutes ?? 45} daqiqa</span>
                            </span>
                          </div>

                          <div className="mt-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-4">
                            {quizData.lessonPlan?.steps?.map((step, idx) => (
                              <div
                                key={idx}
                                className="rounded-2xl border border-black/[0.05] bg-black/[0.02] p-3 dark:border-white/[0.06] dark:bg-white/[0.02]"
                              >
                                <div className="text-[10.5px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                                  {step.minute}
                                </div>
                                <div className="mt-1 text-xs font-bold text-slate-900 dark:text-white">
                                  {step.name}
                                </div>
                                <p className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                                  {step.goal}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Questions List */}
                        <div className={cn(GLASS_CARD, 'space-y-4 p-5')}>
                          <TopSpecular inset="inset-x-8" />
                          <div className="flex items-center justify-between border-b border-black/[0.06] pb-3 dark:border-white/[0.08]">
                            <div>
                              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                                Bloom Nazorat Test Savollari ({quizData.questions?.length ?? 0} ta savol)
                              </h4>
                              <p className="text-[11px] text-slate-500">
                                Har bir savol uchun avtomatik to‘g‘ri javob kaliti va sharh taqdim etiladi
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const text = (quizData.questions || [])
                                    .map(
                                      (q, i) =>
                                        `${i + 1}. ${q.question}\n${(q.options || []).map((o) => `   - ${o}`).join('\n')}\nTo‘g‘ri javob: ${q.correctAnswer}\nSharh: ${q.explanation}\n`,
                                    )
                                    .join('\n');
                                  handleCopy('quiz-all', text);
                                }}
                                className="inline-flex items-center gap-1 rounded-lg border border-black/[0.06] bg-black/[0.03] px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-black/[0.06] dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-300"
                              >
                                {copiedKey === 'quiz-all' ? (
                                  <>
                                    <Check className="h-3 w-3 text-emerald-500" />
                                    <span>Nusxalandi</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3 w-3" />
                                    <span>Nusxalash</span>
                                  </>
                                )}
                              </button>

                              {onInsertPrompt && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    triggerInsertPrompt(
                                      `Quyidagi "${quizData.topic}" bo‘yicha tuzilgan Bloom test savollarini o‘quvchilarga taqdim etish uchun interaktiv shaklga keltir:\n${(quizData.questions || [])
                                        .map((q, i) => `${i + 1}. ${q.question}`)
                                        .join('\n')}`,
                                    )
                                  }
                                  className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-violet-700 shadow-sm"
                                >
                                  <span>Copilot’ga yuborish</span>
                                  <ArrowUpRight className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="space-y-3.5">
                            {(quizData.questions || []).map((q, idx) => (
                              <div
                                key={idx}
                                className="rounded-2xl border border-black/[0.06] bg-white/70 p-4 dark:border-white/[0.08] dark:bg-white/[0.03]"
                              >
                                <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                                  {idx + 1}. {q.question}
                                </div>
                                <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                  {(q.options || []).map((opt, oIdx) => {
                                    const isCorrect = opt === q.correctAnswer;
                                    return (
                                      <div
                                        key={oIdx}
                                        className={cn(
                                          'flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-medium transition-all',
                                          isCorrect
                                            ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-bold'
                                            : 'border-black/[0.05] bg-black/[0.02] text-slate-600 dark:border-white/[0.06] dark:bg-white/[0.02] dark:text-slate-400',
                                        )}
                                      >
                                        <span>{opt}</span>
                                        {isCorrect && (
                                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                                {q.explanation && (
                                  <div className="mt-2.5 rounded-xl bg-violet-500/10 px-3 py-1.5 text-[11px] text-violet-800 dark:text-violet-300">
                                    <span className="font-bold">Pedagogik izoh: </span>
                                    {q.explanation}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* ════════════════════════════════════════════════════
                 * TAB 5: RUBRIC GENERATOR (Baholash Mezonlari)
                 * ══════════════════════════════════════════════════ */}
                {activeTab === 'rubric' && (
                  <motion.div
                    key="tab-rubric"
                    id="studio-panel-rubric"
                    role="tabpanel"
                    aria-labelledby="studio-tab-rubric"
                    tabIndex={0}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18 }}
                    className="space-y-5 outline-none"
                  >
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                            Baholash Mezonlari (Rubrika) Generatori
                          </h3>
                          <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                            Bloom Taxonomy
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                          Imtihon, yozma ish va loyihalarni xolis baholash uchun akademik mezonlar jadvali
                        </p>
                      </div>

                      <motion.button
                        type="button"
                        whileTap={reduced ? undefined : { scaleX: 1.04, scaleY: 0.94 }}
                        transition={SPRING_GEL}
                        onClick={generateRubric}
                        disabled={rubricLoading || !rubricTopic.trim()}
                        className={cn(
                          'inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r px-4 py-2.5 text-xs font-bold text-white transition-all disabled:opacity-50 min-h-[44px] sm:min-h-[40px] touch-manipulation',
                          activeTabConfig.buttonGradient,
                          activeTabConfig.glowShadow,
                        )}
                      >
                        <Sparkles
                          className={cn('h-3.5 w-3.5', rubricLoading && 'animate-spin')}
                        />
                        <span>
                          {rubricLoading
                            ? 'Tuzilmoqda…'
                            : 'Rubrikani Generatsiya Qilish'}
                        </span>
                      </motion.button>
                    </div>

                    <div className={cn(GLASS_CARD, 'space-y-3.5 p-4')}>
                      <TopSpecular inset="inset-x-6" />
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                        <div className="sm:col-span-3">
                          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Mavzu yoki Topshiriq Nomi
                          </label>
                          <input
                            type="text"
                            value={rubricTopic}
                            onChange={(e) => {
                              setRubricTopic(e.target.value);
                              if (rubricError) setRubricError(null);
                            }}
                            placeholder="Masalan: IELTS Writing Task 2 Argumentative Essay"
                            className={GLASS_INPUT}
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Maksimal Ball
                          </label>
                          <input
                            type="number"
                            min={10}
                            max={1000}
                            value={rubricMaxScore}
                            onChange={(e) =>
                              setRubricMaxScore(Math.max(1, Number(e.target.value) || 100))
                            }
                            className={cn(GLASS_INPUT, 'font-mono tabular-nums')}
                          />
                        </div>
                      </div>

                      {/* Quick Topic Presets */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="mr-1 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                          Shablonlar:
                        </span>
                        {RUBRIC_PRESETS.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => {
                              soundRef.current?.playTick?.();
                              setRubricTopic(preset);
                            }}
                            className={cn(
                              'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all',
                              rubricTopic === preset
                                ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-600 dark:text-indigo-300'
                                : 'border-black/[0.06] bg-black/[0.03] text-slate-600 hover:bg-black/[0.06] dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-400',
                            )}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>

                    {rubricError && (
                      <div
                        role="alert"
                        className="flex items-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-semibold text-rose-600 dark:text-rose-300"
                      >
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>{rubricError}</span>
                      </div>
                    )}

                    {rubricData && (
                      <div className={cn(GLASS_CARD, 'space-y-4 p-5')}>
                        <TopSpecular inset="inset-x-8" />
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.06] pb-3 dark:border-white/[0.08]">
                          <div>
                            <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                              {rubricData.topic}
                            </h4>
                            <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                              Jami maksimal ball: {rubricData.maxScore} ball
                            </span>
                          </div>

                          {onInsertPrompt && (
                            <button
                              type="button"
                              onClick={() =>
                                triggerInsertPrompt(
                                  `"${rubricData.topic}" (${rubricData.maxScore} ballik) baholash rubrikasi asosida o‘quvchilar ishini tekshirish varaqasini (checklist) tayyorlab ber.`,
                                )
                              }
                              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/15 px-3 py-1.5 text-xs font-bold text-indigo-600 transition-colors hover:bg-indigo-500/25 dark:text-indigo-300"
                            >
                              <span>Copilot’ga yuborish</span>
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="space-y-3">
                          {(rubricData.criteria || []).map((c, idx) => (
                            <div
                              key={idx}
                              className="rounded-2xl border border-black/[0.06] bg-white/60 p-3.5 dark:border-white/[0.08] dark:bg-white/[0.03]"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                                  {idx + 1}. {c.name}
                                </span>
                                <span className="rounded-full bg-indigo-500/15 px-2.5 py-0.5 font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-300">
                                  {c.weightPercent}% vazn
                                </span>
                              </div>

                              <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08] p-2.5 text-xs text-emerald-900 dark:text-emerald-200">
                                  <strong className="block text-[10.5px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                                    A’lo (Exemplary)
                                  </strong>
                                  <span className="mt-0.5 block leading-relaxed">
                                    {c.exemplary}
                                  </span>
                                </div>
                                <div className="rounded-xl border border-blue-500/25 bg-blue-500/[0.08] p-2.5 text-xs text-blue-900 dark:text-blue-200">
                                  <strong className="block text-[10.5px] uppercase tracking-wider text-blue-600 dark:text-blue-400">
                                    Yaxshi (Proficient)
                                  </strong>
                                  <span className="mt-0.5 block leading-relaxed">
                                    {c.proficient}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* ════════════════════════════════════════════════════
                 * TAB 4: VOICE TTS (AI Ovozli Xabarnoma Studiyasi)
                 * ══════════════════════════════════════════════════ */}
                
                {/* ══════════════════════════════════════════════════
                 * TAB 7: SCENARIO WHAT-IF MODELER (Executive C-Level)
                 * ══════════════════════════════════════════════════ */}
                {activeTab === 'scenario' && (
                  <motion.div
                    key="tab-scenario"
                    id="studio-panel-scenario"
                    role="tabpanel"
                    aria-labelledby="studio-tab-scenario"
                    tabIndex={0}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18 }}
                    className="space-y-6 outline-none"
                  >
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                            Moliyaviy va Kontingent "What-If" Ssenariy Simulyatori
                          </h3>
                          <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                            C-Level Modeling
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                          O'quvchilar soni, narxlar va xarajatlar tebranishining oylik va yillik sof foydaga ta'sirini interaktiv modellashtirish
                        </p>
                      </div>

                      {onInsertPrompt && (
                        <button
                          type="button"
                          onClick={() => {
                            haptics.light();
                            onInsertPrompt(
                              `Hozirgi moliyaviy holatimiz bo'yicha ssenariy tahlilini hisoblab ber: o'quvchilar soni ${studentDelta >= 0 ? '+' : ''}${studentDelta}%, kurs narxi ${priceDelta >= 0 ? '+' : ''}${priceDelta}%, xarajatlar ${expenseDelta >= 0 ? '+' : ''}${expenseDelta}%, chiqib ketish (churn) kamayishi ${churnReduction}%. Boshqaruv xulosasi va 24h playbook bilan taqdim et.`
                            );
                            onClose();
                          }}
                          className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-amber-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] min-h-11 sm:min-h-[40px] touch-manipulation"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>Copilotga Ssenariyni Yuborish</span>
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Interactive Parameter Sliders */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {/* Slider 1: Students */}
                      <div className="rounded-2xl border border-black/[0.08] bg-black/[0.02] p-4 dark:border-white/[0.08] dark:bg-white/[0.02]">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-700 dark:text-slate-300">O'quvchilar Soni</span>
                          <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-black', studentDelta >= 0 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400')}>
                            {studentDelta >= 0 ? '+' : ''}{studentDelta}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="-30"
                          max="100"
                          step="5"
                          value={studentDelta}
                          onChange={(e) => setStudentDelta(Number(e.target.value))}
                          className="mt-3 w-full accent-amber-500"
                        />
                        <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                          <span>-30%</span>
                          <span>0%</span>
                          <span>+100%</span>
                        </div>
                      </div>

                      {/* Slider 2: Price */}
                      <div className="rounded-2xl border border-black/[0.08] bg-black/[0.02] p-4 dark:border-white/[0.08] dark:bg-white/[0.02]">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-700 dark:text-slate-300">Kurs Narxi O'zgarishi</span>
                          <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-black', priceDelta >= 0 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400')}>
                            {priceDelta >= 0 ? '+' : ''}{priceDelta}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="-20"
                          max="50"
                          step="5"
                          value={priceDelta}
                          onChange={(e) => setPriceDelta(Number(e.target.value))}
                          className="mt-3 w-full accent-amber-500"
                        />
                        <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                          <span>-20%</span>
                          <span>0%</span>
                          <span>+50%</span>
                        </div>
                      </div>

                      {/* Slider 3: Expenses */}
                      <div className="rounded-2xl border border-black/[0.08] bg-black/[0.02] p-4 dark:border-white/[0.08] dark:bg-white/[0.02]">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-700 dark:text-slate-300">Xarajatlar Tebranishi</span>
                          <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-black', expenseDelta <= 0 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400')}>
                            {expenseDelta >= 0 ? '+' : ''}{expenseDelta}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="-20"
                          max="40"
                          step="5"
                          value={expenseDelta}
                          onChange={(e) => setExpenseDelta(Number(e.target.value))}
                          className="mt-3 w-full accent-amber-500"
                        />
                        <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                          <span>-20%</span>
                          <span>0%</span>
                          <span>+40%</span>
                        </div>
                      </div>

                      {/* Slider 4: Churn Reduction */}
                      <div className="rounded-2xl border border-black/[0.08] bg-black/[0.02] p-4 dark:border-white/[0.08] dark:bg-white/[0.02]">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-700 dark:text-slate-300">Chiqib Ketishni Kamaytirish</span>
                          <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[11px] font-black text-emerald-600 dark:text-emerald-400">
                            +{churnReduction}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="50"
                          step="5"
                          value={churnReduction}
                          onChange={(e) => setChurnReduction(Number(e.target.value))}
                          className="mt-3 w-full accent-amber-500"
                        />
                        <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                          <span>0%</span>
                          <span>25%</span>
                          <span>+50%</span>
                        </div>
                      </div>
                    </div>

                    {/* Calculated Live Projection Matrix */}
                    <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 via-orange-500/5 to-transparent p-5">
                      <div className="flex items-center justify-between border-b border-black/[0.06] pb-3 dark:border-white/[0.06]">
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4 text-amber-500" />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                            Dinamik Prognoz Matritsasi (Kalkulyatsiya)
                          </h4>
                        </div>
                        <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                          M-EDU Predictive Engine
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                        <div className="rounded-xl border border-black/[0.06] bg-white/40 p-3.5 backdrop-blur-md dark:border-white/[0.06] dark:bg-white/[0.02]">
                          <span className="text-[11px] font-bold text-slate-400">Daromad O'zgarishi</span>
                          <p className="mt-1 text-lg font-black text-slate-900 dark:text-white">
                            {studentDelta + priceDelta + Math.round(churnReduction * 0.4) >= 0 ? '+' : ''}
                            {studentDelta + priceDelta + Math.round(churnReduction * 0.4)}%
                          </p>
                          <span className="text-[10px] text-slate-500">Talabalar va narx kümülatifi</span>
                        </div>

                        <div className="rounded-xl border border-black/[0.06] bg-white/40 p-3.5 backdrop-blur-md dark:border-white/[0.06] dark:bg-white/[0.02]">
                          <span className="text-[11px] font-bold text-slate-400">Xarajatlar Bosimi</span>
                          <p className="mt-1 text-lg font-black text-slate-900 dark:text-white">
                            {expenseDelta >= 0 ? '+' : ''}{expenseDelta}%
                          </p>
                          <span className="text-[10px] text-slate-500">Operatsion yuk</span>
                        </div>

                        <div className="rounded-xl border border-black/[0.06] bg-white/40 p-3.5 backdrop-blur-md dark:border-white/[0.06] dark:bg-white/[0.02]">
                          <span className="text-[11px] font-bold text-slate-400">Kutilayotgan Sof Foyda</span>
                          <p className="mt-1 text-lg font-black text-emerald-600 dark:text-emerald-400">
                            {((studentDelta + priceDelta + Math.round(churnReduction * 0.4)) * 1.3 - expenseDelta * 0.6) >= 0 ? '+' : ''}
                            {Math.round(((studentDelta + priceDelta + Math.round(churnReduction * 0.4)) * 1.3 - expenseDelta * 0.6) * 10) / 10}%
                          </p>
                          <span className="text-[10px] text-slate-500">Margin multiplikatori</span>
                        </div>

                        <div className="rounded-xl border border-black/[0.06] bg-white/40 p-3.5 backdrop-blur-md dark:border-white/[0.06] dark:bg-white/[0.02]">
                          <span className="text-[11px] font-bold text-slate-400">Rentabellik Ko'rsatkichi</span>
                          <p className="mt-1 text-lg font-black text-amber-500">
                            {studentDelta >= 15 ? "BARQAROR O'SISH" : studentDelta < 0 ? "XAVF OSTIDA" : "OPTIMAL"}
                          </p>
                          <span className="text-[10px] text-slate-500">Boshqaruv signali</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'voice' && (
                  <motion.div
                    key="tab-voice"
                    id="studio-panel-voice"
                    role="tabpanel"
                    aria-labelledby="studio-tab-voice"
                    tabIndex={0}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18 }}
                    className="space-y-5 outline-none"
                  >
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                            AI Ovozli Hisobot va Matnni O‘qish (Neural TTS)
                          </h3>
                          <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                            uz-UZ Speech
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                          Direktor va administratorlar uchun ertalabki hisobotlarni ovozli eshitish moduli
                        </p>
                      </div>

                      {/* Speed Selector */}
                      <div className="inline-flex items-center gap-1 rounded-2xl border border-black/[0.07] bg-black/[0.03] p-1 dark:border-white/[0.1] dark:bg-white/[0.04]">
                        <Sliders className="ml-2 mr-1 h-3.5 w-3.5 text-slate-400" />
                        {[0.9, 1.0, 1.15].map((rate) => (
                          <button
                            key={rate}
                            type="button"
                            onClick={() => {
                              soundRef.current?.playTick?.();
                              setSpeechRate(rate);
                            }}
                            className={cn(
                              'rounded-xl px-2.5 py-1 font-mono text-[11px] font-bold transition-all',
                              speechRate === rate
                                ? 'bg-white text-cyan-600 shadow-xs dark:bg-white/15 dark:text-cyan-300'
                                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400',
                            )}
                          >
                            {rate}x
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Executive Briefing Presets */}
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                      {VOICE_PRESETS.map((preset) => {
                        const active = speechText === preset.text;
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => {
                              soundRef.current?.playTick?.();
                              if (isSpeaking) stopSpeaking();
                              setSpeechText(preset.text);
                            }}
                            className={cn(
                              'flex flex-col items-start rounded-2xl border p-3 text-left transition-all',
                              active
                                ? 'border-cyan-500/50 bg-cyan-500/12 text-cyan-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:border-cyan-400/50 dark:bg-cyan-500/20 dark:text-cyan-200'
                                : 'border-black/[0.06] bg-white/60 text-slate-700 hover:bg-white/90 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-slate-300',
                            )}
                          >
                            <span className="text-xs font-extrabold">{preset.label}</span>
                            <span className="mt-1 line-clamp-2 text-[11px] opacity-75">
                              {preset.text}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className={cn(GLASS_CARD, 'space-y-4 p-4 sm:p-5')}>
                      <TopSpecular inset="inset-x-6" />
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Ovozli O‘qiladigan Matn
                        </label>
                        <span className="font-mono text-[11px] text-slate-400">
                          {speechText.length} belgi
                        </span>
                      </div>

                      <textarea
                        rows={4}
                        value={speechText}
                        onChange={(e) => setSpeechText(e.target.value)}
                        placeholder="Ovozli o‘qish uchun matn kiriting…"
                        className={cn(GLASS_INPUT, 'resize-none leading-relaxed')}
                      />

                      {/* Live Acoustic Visualizer & Controls */}
                      <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                        <div className="flex items-center gap-3">
                          <motion.button
                            type="button"
                            whileTap={reduced ? undefined : { scaleX: 1.05, scaleY: 0.92 }}
                            transition={SPRING_GEL}
                            onClick={handleSpeak}
                            disabled={!speechText.trim()}
                            className={cn(
                              'inline-flex items-center gap-2.5 rounded-2xl px-5 py-2.5 text-xs font-bold text-white transition-all disabled:opacity-50 min-h-[44px] touch-manipulation',
                              isSpeaking
                                ? 'bg-gradient-to-r from-rose-500 to-red-600 shadow-[0_10px_24px_-6px_rgba(244,63,94,0.5)]'
                                : cn('bg-gradient-to-r', activeTabConfig.buttonGradient, activeTabConfig.glowShadow),
                            )}
                          >
                            {isSpeaking ? (
                              <>
                                <Square className="h-3.5 w-3.5 fill-current" />
                                <span>Ovozni To‘xtatish</span>
                              </>
                            ) : (
                              <>
                                <Play className="h-3.5 w-3.5 fill-current" />
                                <span>Ovozli O‘qishni Boshlash</span>
                              </>
                            )}
                          </motion.button>

                          {onInsertPrompt && (
                            <button
                              type="button"
                              onClick={() =>
                                triggerInsertPrompt(
                                  `Quyidagi hisobot matnini yanada ta’sirchan va qisqa rahbariyat brifingi ko‘rinishida qayta tahrirlab ber:\n\n"${speechText}"`,
                                )
                              }
                              className="inline-flex items-center gap-1.5 rounded-2xl border border-black/[0.08] bg-white/70 px-3.5 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-white dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200 min-h-[44px] touch-manipulation"
                            >
                              <span>Copilot’da boyitish</span>
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        {/* 16-Bar Live Acoustic Waveform */}
                        <div
                          aria-hidden="true"
                          className="flex h-8 items-center gap-1 rounded-xl border border-black/[0.05] bg-black/[0.025] px-3 dark:border-white/[0.07] dark:bg-white/[0.03]"
                        >
                          {Array.from({ length: 16 }).map((_, idx) => (
                            <motion.span
                              key={idx}
                              animate={
                                isSpeaking && !reduced
                                  ? {
                                      height: [
                                        '25%',
                                        `${35 + ((idx * 19) % 60)}%`,
                                        '20%',
                                        `${45 + ((idx * 13) % 50)}%`,
                                        '25%',
                                      ],
                                    }
                                  : { height: '22%' }
                              }
                              transition={
                                isSpeaking
                                  ? {
                                      duration: 0.7 + (idx % 4) * 0.12,
                                      repeat: Infinity,
                                      ease: 'easeInOut',
                                    }
                                  : { duration: 0.2 }
                              }
                              className={cn(
                                'w-1 rounded-full transition-colors',
                                isSpeaking
                                  ? 'bg-gradient-to-t from-cyan-500 to-emerald-400'
                                  : 'bg-slate-300 dark:bg-slate-700',
                              )}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export default AiExecutiveSuperStudio;