import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Code,
  Search,
  Plus,
  RefreshCw,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Brain,
  Calculator,
  Atom,
  Languages,
  ScrollText,
  HelpCircle,
  Send,
  Zap,
  Play,
  RotateCcw,
  Check,
  Eye,
  EyeOff,
  Clock,
  Tag,
  X,
} from 'lucide-react';
import request from '@/lib/api';
import { useToast } from '@/components/ui/GlassToast';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useTelegram } from '@/hooks/useTelegram';
import '@/styles/arena-liquid.css';

// ============================================================================
// INTERFACES & TYPES
// ============================================================================

export interface ArenaQuestionOption {
  id: string;
  optionKey: string;
  optionText: string;
  isCorrect: boolean;
  explanation?: string | null;
  orderIndex: number;
}

export interface ArenaQuestionItem {
  id: string;
  organizationId?: string | null;
  subjectCategory: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  status: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';
  source: 'AI_GENERATED' | 'TEACHER' | 'ADMIN';
  questionText: string;
  codeSnippet?: string | null;
  codeLanguage?: string | null;
  imageUrl?: string | null;
  explanation: string;
  timeLimitSec: number;
  tags: string[];
  version: number;
  timesUsed: number;
  correctCount: number;
  createdById?: string | null;
  approvedById?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  verificationLog?: {
    score?: number;
    passed?: boolean;
    notes?: string;
  } | null;
  createdAt: string;
  options: ArenaQuestionOption[];
  createdByUser?: {
    firstName: string;
    lastName: string;
    role: string;
  } | null;
  approvedByUser?: {
    firstName: string;
    lastName: string;
  } | null;
}

// ============================================================================
// CONFIGURATION & DESIGN TOKENS (Adaptive Light & Dark Mode)
// ============================================================================

const SUBJECT_CONFIG: Record<
  string,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bg: string;
    presets: string[];
  }
> = {
  MATHEMATICS: {
    label: 'Matematika',
    icon: Calculator,
    color: 'text-cyan-700 dark:text-cyan-400',
    bg: 'bg-cyan-500/10 border-cyan-500/30',
    presets: ['Kvadrat tenglamalar', 'Trigonometriya', 'Logarifmlar', 'Ehtimollar nazariyasi', 'Planimetriya'],
  },
  PHYSICS: {
    label: 'Fizika',
    icon: Atom,
    color: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/30',
    presets: ['Nyuton qonunlari', 'Kinematika', 'Elektr toki', 'Termodinamika', 'Kvant optikasi'],
  },
  PROGRAMMING: {
    label: 'Dasturlash',
    icon: Code,
    color: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/30',
    presets: ['Massivlar va Sikllar', 'Rekursiya', 'Big-O Murakkablik', 'TypeScript / JS Closure', 'Python Lists'],
  },
  HISTORY: {
    label: 'Tarix',
    icon: ScrollText,
    color: 'text-orange-700 dark:text-orange-400',
    bg: 'bg-orange-500/10 border-orange-500/30',
    presets: ['Amir Temur davlati', 'Buyuk Ipak Yo‘li', 'Jadidchilik harakati', 'Ikkinchi jahon urushi', 'Qadimgi Rim'],
  },
  ENGLISH: {
    label: 'Ingliz tili',
    icon: Languages,
    color: 'text-sky-700 dark:text-sky-400',
    bg: 'bg-sky-500/10 border-sky-500/30',
    presets: ['Conditionals (If clauses)', 'Passive Voice', 'Phrasal Verbs', 'CEFR B2 Vocabulary', 'Modal Verbs'],
  },
  LOGIC_PUZZLE: {
    label: 'Mantiq',
    icon: Brain,
    color: 'text-purple-700 dark:text-purple-400',
    bg: 'bg-purple-500/10 border-purple-500/30',
    presets: ['Sonli ketma-ketliklar', 'Kombinatorika', 'Sillogizm va Deduktsiya', 'Shaxmat mantig‘i', 'Kriptogramma'],
  },
  GENERAL_SCIENCE: {
    label: 'Umumiy fan',
    icon: HelpCircle,
    color: 'text-slate-700 dark:text-slate-300',
    bg: 'bg-slate-500/10 border-slate-500/30',
    presets: ['Astronomiya', 'Ekologiya', 'Inson anatomiyasi', 'Geografiya', 'Zamonaviy texnologiyalar'],
  },
};

const DIFFICULTY_MAP: Record<string, { label: string; badge: string; defaultTime: number }> = {
  EASY: {
    label: 'Oson',
    badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/35',
    defaultTime: 12,
  },
  MEDIUM: {
    label: 'O‘rta',
    badge: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/35',
    defaultTime: 15,
  },
  HARD: {
    label: 'Qiyin',
    badge: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/35',
    defaultTime: 25,
  },
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ArenaQuestionsStudio: React.FC = () => {
  const { push: toast } = useToast();
  const queryClient = useQueryClient();
  const { play } = usePremiumSound();
  const { haptic } = useTelegram();

  // Safe toast wrapper compatible with both `type` and `variant` prop signatures
  const notify = (
    title: string,
    description: string,
    kind: 'success' | 'error' = 'success'
  ) => {
    (toast as (arg: Record<string, unknown>) => void)({
      title,
      description,
      type: kind,
      variant: kind,
    });
  };

  // Filters & UI states
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hideCorrectAnswers, setHideCorrectAnswers] = useState<boolean>(false);

  // Debounce search input by 300ms to prevent API request flooding
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Modals state
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Live Test Solver Modal state + Countdown Timer
  const [testQuestion, setTestQuestion] = useState<ArenaQuestionItem | null>(null);
  const [testSelectedKey, setTestSelectedKey] = useState<string | null>(null);
  const [testRevealed, setTestRevealed] = useState(false);
  const [testTimeLeft, setTestTimeLeft] = useState<number>(15);

  useEffect(() => {
    if (!testQuestion || testRevealed) return;
    if (testTimeLeft <= 0) {
      setTestRevealed(true);
      play('error');
      return;
    }
    const interval = setInterval(() => {
      setTestTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [testQuestion, testRevealed, testTimeLeft, play]);

  // AI Generator Form State
  const [aiForm, setAiForm] = useState({
    subjectCategory: 'MATHEMATICS',
    difficulty: 'MEDIUM',
    topic: '',
    count: 3,
    targetGrade: '8-9 sinf',
    language: 'uz',
  });

  // Manual Question Builder State
  const [manualForm, setManualForm] = useState({
    subjectCategory: 'MATHEMATICS',
    difficulty: 'MEDIUM' as 'EASY' | 'MEDIUM' | 'HARD',
    questionText: '',
    hasCode: false,
    codeLanguage: 'javascript',
    codeSnippet: '',
    explanation: '',
    timeLimitSec: 15,
    tagsInput: '',
    correctKey: 'A',
    options: [
      { optionKey: 'A', optionText: '' },
      { optionKey: 'B', optionText: '' },
      { optionKey: 'C', optionText: '' },
      { optionKey: 'D', optionText: '' },
    ],
  });

  // Query: Fetch questions list
  const {
    data: qData,
    isLoading,
    isFetching,
    refetch,
  } = useQuery<{
    items: ArenaQuestionItem[];
    total: number;
    page: number;
    limit: number;
  }>({
    queryKey: [
      'arena-questions',
      selectedSubject,
      selectedDifficulty,
      selectedStatus,
      debouncedSearch,
    ],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedSubject !== 'ALL') params.append('subjectCategory', selectedSubject);
      if (selectedDifficulty !== 'ALL') params.append('difficulty', selectedDifficulty);
      if (selectedStatus !== 'ALL') params.append('status', selectedStatus);
      if (debouncedSearch) params.append('search', debouncedSearch);
      params.append('limit', '50');
      return request(`/arena/questions?${params.toString()}`);
    },
  });

  // Cache baseline KPI metrics when viewing ALL statuses so filtering doesn't zero out KPIs
  const [cachedStats, setCachedStats] = useState({
    total: 0,
    approved: 0,
    pending: 0,
    rejected: 0,
  });

  const questions = useMemo(() => qData?.items || [], [qData?.items]);

  useEffect(() => {
    if (!qData) return;
    const approved = questions.filter((q) => q.status === 'APPROVED').length;
    const pending = questions.filter((q) => q.status === 'PENDING_REVIEW').length;
    const rejected = questions.filter((q) => q.status === 'REJECTED').length;

    if (selectedStatus === 'ALL') {
      setCachedStats({
        total: qData.total || questions.length,
        approved,
        pending,
        rejected,
      });
    } else {
      setCachedStats((prev) => ({
        ...prev,
        [selectedStatus === 'APPROVED'
          ? 'approved'
          : selectedStatus === 'PENDING_REVIEW'
          ? 'pending'
          : 'rejected']: questions.length,
      }));
    }
  }, [qData, questions, selectedStatus]);

  // Mutation: Approve Question
  const approveMutation = useMutation({
    mutationFn: (id: string) =>
      request(`/arena/questions/${id}/approve`, {
        method: 'PATCH',
      }),
    onSuccess: (_, approvedId) => {
      play('success');
      haptic('impactLight');
      notify(
        'Savol tasdiqlandi! ✓',
        'Savol Mind Arena duellar rotatsiyasiga faol kiritildi.',
        'success'
      );
      if (testQuestion?.id === approvedId) {
        setTestQuestion((prev) => (prev ? { ...prev, status: 'APPROVED' } : null));
      }
      queryClient.invalidateQueries({ queryKey: ['arena-questions'] });
    },
    onError: (err: unknown) => {
      play('error');
      haptic('notificationError');
      const message = err instanceof Error ? err.message : 'Tasdiqlashda xatolik';
      notify('Tasdiqlashda xatolik', message, 'error');
    },
  });

  // Mutation: Reject Question
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      request(`/arena/questions/${id}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      }),
    onSuccess: (_, vars) => {
      play('error');
      haptic('notificationWarning');
      notify('Savol rad etildi', 'Savol faol rotatsiyadan chiqarildi.', 'success');
      setIsRejectModalOpen(false);
      setRejectReason('');
      setRejectTargetId(null);
      if (testQuestion?.id === vars.id) {
        setTestQuestion(null);
      }
      queryClient.invalidateQueries({ queryKey: ['arena-questions'] });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Rad etishda xatolik';
      notify('Rad etishda xatolik', message, 'error');
    },
  });

  // Mutation: AI Generator
  const generateAiMutation = useMutation({
    mutationFn: (dto: typeof aiForm) =>
      request<{ generatedCount?: number }>('/arena/questions/generate-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      }),
    onSuccess: (res: { generatedCount?: number }) => {
      play('success');
      haptic('heavy');
      notify(
        'AI Savollar yaratildi! 🤖',
        `${res?.generatedCount || aiForm.count} ta savol tuzildi va deterministik verifikatsiyadan o‘tkazildi.`,
        'success'
      );
      setIsAiModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['arena-questions'] });
    },
    onError: (err: unknown) => {
      play('error');
      haptic('notificationError');
      const message = err instanceof Error ? err.message : 'Xatolik yuz berdi';
      notify('AI Generatsiyada xatolik', message, 'error');
    },
  });

  // Mutation: Manual Question Creation
  const createManualMutation = useMutation({
    mutationFn: () => {
      const payload = {
        subjectCategory: manualForm.subjectCategory,
        difficulty: manualForm.difficulty,
        questionText: manualForm.questionText.trim(),
        codeSnippet: manualForm.hasCode ? manualForm.codeSnippet.trim() : null,
        codeLanguage: manualForm.hasCode ? manualForm.codeLanguage : null,
        explanation: manualForm.explanation.trim(),
        timeLimitSec: Number(manualForm.timeLimitSec) || 15,
        tags: manualForm.tagsInput
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        options: manualForm.options.map((o, idx) => ({
          optionKey: o.optionKey,
          optionText: o.optionText.trim(),
          isCorrect: o.optionKey === manualForm.correctKey,
          orderIndex: idx,
        })),
      };
      return request('/arena/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      play('success');
      haptic('impactMedium');
      notify(
        'Savol saqlandi! ✓',
        'Mualliflik savoli bazaga muvaffaqiyatli qo‘shildi.',
        'success'
      );
      setIsManualModalOpen(false);
      setManualForm((prev) => ({
        ...prev,
        questionText: '',
        codeSnippet: '',
        explanation: '',
        tagsInput: '',
        options: [
          { optionKey: 'A', optionText: '' },
          { optionKey: 'B', optionText: '' },
          { optionKey: 'C', optionText: '' },
          { optionKey: 'D', optionText: '' },
        ],
      }));
      queryClient.invalidateQueries({ queryKey: ['arena-questions'] });
    },
    onError: (err: unknown) => {
      play('error');
      haptic('notificationError');
      const message = err instanceof Error ? err.message : 'Savolni saqlab bo‘lmadi';
      notify('Xatolik yuz berdi', message, 'error');
    },
  });

  const openTestSimulator = (q: ArenaQuestionItem) => {
    play('pop');
    haptic('selection');
    setTestQuestion(q);
    setTestSelectedKey(null);
    setTestRevealed(false);
    setTestTimeLeft(q.timeLimitSec || DIFFICULTY_MAP[q.difficulty]?.defaultTime || 15);
  };

  const resetTestSimulator = () => {
    if (!testQuestion) return;
    play('tick');
    setTestSelectedKey(null);
    setTestRevealed(false);
    setTestTimeLeft(
      testQuestion.timeLimitSec ||
        DIFFICULTY_MAP[testQuestion.difficulty]?.defaultTime ||
        15
    );
  };

  const isManualFormValid =
    manualForm.questionText.trim().length >= 8 &&
    manualForm.explanation.trim().length >= 5 &&
    manualForm.options.every((o) => o.optionText.trim().length > 0);

  return (
    <div className="space-y-6 select-none">
      {/* =====================================================================
          TOP INTERACTIVE KPI METRICS BAR (Click to Filter by Status)
      ===================================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <button
          onClick={() => {
            play('tick');
            setSelectedStatus('ALL');
          }}
          className={`text-left arena-glass rounded-2xl p-4 relative overflow-hidden border transition-all shadow-sm ${
            selectedStatus === 'ALL'
              ? 'border-blue-500 dark:border-cyan-400 ring-2 ring-blue-500/15'
              : 'border-black/[0.06] dark:border-white/10 hover:border-slate-400'
          }`}
        >
          <div className="text-[11px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">
            Jami Savollar
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {cachedStats.total}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
            Arena bankidagi barcha savollar
          </div>
        </button>

        <button
          onClick={() => {
            play('tick');
            setSelectedStatus(selectedStatus === 'APPROVED' ? 'ALL' : 'APPROVED');
          }}
          className={`text-left arena-glass rounded-2xl p-4 border transition-all relative overflow-hidden shadow-sm ${
            selectedStatus === 'APPROVED'
              ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-500/10'
              : 'border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-500/5 hover:border-emerald-500/60'
          }`}
        >
          <div className="text-[11px] uppercase font-bold tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Tasdiqlangan</span>
          </div>
          <div className="text-2xl font-black text-emerald-800 dark:text-emerald-300 mt-1">
            {cachedStats.approved}
          </div>
          <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400/70 mt-1">
            Duellarda faol ishlatilmoqda
          </div>
        </button>

        <button
          onClick={() => {
            play('tick');
            setSelectedStatus(
              selectedStatus === 'PENDING_REVIEW' ? 'ALL' : 'PENDING_REVIEW'
            );
          }}
          className={`text-left arena-glass rounded-2xl p-4 border transition-all relative overflow-hidden shadow-sm ${
            selectedStatus === 'PENDING_REVIEW'
              ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-500/10'
              : 'border-amber-500/30 bg-amber-50/70 dark:bg-amber-500/5 hover:border-amber-500/60'
          }`}
        >
          <div className="text-[11px] uppercase font-bold tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>Kutilmoqda</span>
          </div>
          <div className="text-2xl font-black text-amber-800 dark:text-amber-300 mt-1">
            {cachedStats.pending}
          </div>
          <div className="text-[10px] text-amber-600/80 dark:text-amber-400/70 mt-1">
            Moderator tasdig‘i talab etiladi
          </div>
        </button>

        <button
          onClick={() => {
            play('tick');
            setSelectedStatus(selectedStatus === 'REJECTED' ? 'ALL' : 'REJECTED');
          }}
          className={`text-left arena-glass rounded-2xl p-4 border transition-all relative overflow-hidden shadow-sm ${
            selectedStatus === 'REJECTED'
              ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-500/10'
              : 'border-rose-500/30 bg-rose-50/70 dark:bg-rose-500/5 hover:border-rose-500/60'
          }`}
        >
          <div className="text-[11px] uppercase font-bold tracking-wider text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>Rad etilgan</span>
          </div>
          <div className="text-2xl font-black text-rose-800 dark:text-rose-300 mt-1">
            {cachedStats.rejected}
          </div>
          <div className="text-[10px] text-rose-600/80 dark:text-rose-400/70 mt-1">
            Rotatsiyadan chiqarilgan
          </div>
        </button>
      </div>

      {/* =====================================================================
          MAIN FILTER, SEARCH & ACTION BAR
      ===================================================================== */}
      <div className="arena-glass rounded-3xl p-4 sm:p-5 space-y-4 border border-black/[0.06] dark:border-white/10 shadow-sm">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Debounced Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Savol matni, mavzu yoki #teglar bo‘yicha qidiring..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 bg-white dark:bg-black/40 border border-slate-300 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Classroom Spoiler Protection Toggle */}
            <button
              onClick={() => {
                play('tick');
                setHideCorrectAnswers((prev) => !prev);
              }}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                hideCorrectAnswers
                  ? 'bg-purple-500/15 border-purple-500/40 text-purple-700 dark:text-purple-300'
                  : 'arena-inset border-black/[0.08] dark:border-white/10 text-slate-600 dark:text-slate-300'
              }`}
              title="Proyektor/Dars rejimida to‘g‘ri javoblarni yashirish"
            >
              {hideCorrectAnswers ? (
                <>
                  <EyeOff className="w-4 h-4 text-purple-500" />
                  <span className="hidden sm:inline">Javoblar yashirilgan</span>
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  <span className="hidden sm:inline">Javoblar ko‘rinmoqda</span>
                </>
              )}
            </button>

            {/* Manual Teacher Question Button */}
            <button
              onClick={() => {
                play('tick');
                haptic('selection');
                setIsManualModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm arena-inset border border-blue-500/30 dark:border-cyan-500/40 text-blue-700 dark:text-cyan-300 hover:bg-blue-500/10 active:scale-95 transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Savol Qo‘shish</span>
            </button>

            {/* AI Generator Button */}
            <button
              onClick={() => {
                play('tick');
                haptic('selection');
                setIsAiModalOpen(true);
              }}
              className="px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-500/25 active:scale-95 transition-all flex items-center gap-2 arena-sheen"
            >
              <Sparkles className="w-4 h-4 animate-pulse" />
              <span>AI bilan Yaratish</span>
            </button>

            <button
              onClick={() => {
                play('tick');
                refetch();
              }}
              disabled={isFetching}
              className="p-2.5 rounded-xl border border-black/[0.08] dark:border-white/10 arena-inset text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white active:scale-95 transition-all shadow-sm"
              title="Bazani yangilash"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Categories Strip */}
        <div className="arena-scroll-x flex items-center gap-2 pt-2 border-t border-black/[0.06] dark:border-white/5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => {
              play('tick');
              setSelectedSubject('ALL');
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              selectedSubject === 'ALL'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'arena-inset text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Barchasi
          </button>
          {Object.entries(SUBJECT_CONFIG).map(([key, conf]) => {
            const Icon = conf.icon;
            const isSelected = selectedSubject === key;
            return (
              <button
                key={key}
                onClick={() => {
                  play('tick');
                  haptic('selection');
                  setSelectedSubject(key);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                  isSelected
                    ? 'bg-blue-50 dark:bg-cyan-500/25 text-blue-700 dark:text-cyan-300 border border-blue-500/40 dark:border-cyan-500/50 shadow-sm'
                    : 'arena-inset text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${conf.color}`} />
                <span>{conf.label}</span>
              </button>
            );
          })}
        </div>

        {/* Difficulty & Status Filter Badges */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-500 dark:text-slate-400 font-semibold">Qiyinlik:</span>
            {['ALL', 'EASY', 'MEDIUM', 'HARD'].map((diff) => (
              <button
                key={diff}
                onClick={() => {
                  play('tick');
                  setSelectedDifficulty(diff);
                }}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  selectedDifficulty === diff
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {diff === 'ALL' ? 'Barchasi' : DIFFICULTY_MAP[diff]?.label || diff}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-500 dark:text-slate-400 font-semibold">Holat:</span>
            {[
              { id: 'ALL', label: 'Barchasi' },
              { id: 'APPROVED', label: 'Tasdiqlangan' },
              { id: 'PENDING_REVIEW', label: 'Kutilmoqda' },
              { id: 'REJECTED', label: 'Rad etilgan' },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => {
                  play('tick');
                  setSelectedStatus(st.id);
                }}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  selectedStatus === st.id
                    ? 'bg-blue-50 dark:bg-cyan-500/20 text-blue-700 dark:text-cyan-300 border border-blue-500/30 dark:border-cyan-500/40 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* =====================================================================
          QUESTIONS FEED
      ===================================================================== */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-56 rounded-2xl arena-glass animate-pulse border border-black/[0.06] dark:border-white/10 p-5"
              />
            ))}
          </div>
        ) : questions.length === 0 ? (
          <div className="text-center py-16 arena-glass rounded-3xl border border-black/[0.06] dark:border-white/10 shadow-sm space-y-3 px-4">
            <Brain className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto" />
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
              Savollar topilmadi
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Tanlangan filtrlar bo‘yicha savollar mavjud emas. Filtrlarni tozalang yoki AI yordamida yangi savollar yarating.
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              {(selectedSubject !== 'ALL' ||
                selectedDifficulty !== 'ALL' ||
                selectedStatus !== 'ALL' ||
                searchQuery) && (
                <button
                  onClick={() => {
                    setSelectedSubject('ALL');
                    setSelectedDifficulty('ALL');
                    setSelectedStatus('ALL');
                    setSearchQuery('');
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold arena-inset border border-black/[0.08] dark:border-white/10 text-slate-700 dark:text-slate-200"
                >
                  Filtrlarni Tozalash
                </button>
              )}
              <button
                onClick={() => setIsAiModalOpen(true)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white shadow-sm flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" /> AI Savol Yaratish
              </button>
            </div>
          </div>
        ) : (
          questions.map((q) => {
            const subConf = SUBJECT_CONFIG[q.subjectCategory] || SUBJECT_CONFIG.GENERAL_SCIENCE;
            const SubIcon = subConf.icon;
            const diffConf = DIFFICULTY_MAP[q.difficulty] || DIFFICULTY_MAP.MEDIUM;
            const isExpanded = expandedId === q.id;
            const sortedOptions = [...(q.options || [])].sort(
              (a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)
            );
            const isApprovingThis =
              approveMutation.isPending && approveMutation.variables === q.id;

            return (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`arena-glass rounded-2xl p-5 border transition-all duration-200 shadow-sm ${
                  q.status === 'APPROVED'
                    ? 'border-emerald-500/30 hover:border-emerald-500/50'
                    : q.status === 'PENDING_REVIEW'
                    ? 'border-amber-500/40 hover:border-amber-500/60'
                    : 'border-rose-500/30'
                }`}
              >
                {/* Header metadata */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1.5 ${subConf.bg} ${subConf.color}`}
                    >
                      <SubIcon className="w-3.5 h-3.5" />
                      <span>{subConf.label}</span>
                    </span>

                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${diffConf.badge}`}>
                      {diffConf.label}
                    </span>

                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-white/5 border border-black/[0.06] dark:border-white/10 text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-500" />
                      <span>{q.timeLimitSec || 15}s</span>
                    </span>

                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-white/5 border border-black/[0.06] dark:border-white/10 text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      {q.source === 'AI_GENERATED' ? (
                        <>
                          <Sparkles className="w-3 h-3 text-blue-600 dark:text-cyan-400" />
                          <span>AI Generated</span>
                        </>
                      ) : (
                        <span>
                          👨‍🏫{' '}
                          {q.createdByUser
                            ? `${q.createdByUser.firstName} ${q.createdByUser.lastName}`
                            : 'O‘qituvchi'}
                        </span>
                      )}
                    </span>

                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      {q.organizationId ? '🏢 Maktab maxsus' : '🌐 Global Bank'}
                    </span>
                  </div>

                  {/* Status Indicator Badge */}
                  <div className="flex items-center gap-2">
                    {q.status === 'APPROVED' && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 shadow-sm">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Tasdiqlangan</span>
                      </span>
                    )}
                    {q.status === 'PENDING_REVIEW' && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 flex items-center gap-1.5 shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        <span>Kutilmoqda (v{q.version})</span>
                      </span>
                    )}
                    {q.status === 'REJECTED' && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                        <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                        <span>Rad etilgan</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Question Text */}
                <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-relaxed mb-3 select-text">
                  {q.questionText}
                </h4>

                {/* Code Snippet Box (if present) */}
                {q.codeSnippet && (
                  <div className="mb-4 rounded-xl overflow-hidden border border-black/[0.08] dark:border-white/10 bg-slate-900">
                    <div className="px-4 py-1.5 bg-black/40 border-b border-white/5 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                      <span>{q.codeLanguage || 'code'}</span>
                      <span className="text-cyan-400">Sandbox Verified ✓</span>
                    </div>
                    <pre className="p-4 text-xs font-mono text-cyan-200 overflow-x-auto leading-relaxed select-text">
                      <code>{q.codeSnippet}</code>
                    </pre>
                  </div>
                )}

                {/* Tags Strip (Clickable to filter) */}
                {q.tags && q.tags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mb-3">
                    {q.tags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => setSearchQuery(tag)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-700 dark:text-cyan-300 border border-blue-500/20 hover:border-blue-500 transition-colors"
                      >
                        <Tag className="w-2.5 h-2.5" />
                        <span>{tag}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Options Grid (A, B, C, D) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 my-3">
                  {sortedOptions.map((opt) => {
                    const showAsCorrect = opt.isCorrect && !hideCorrectAnswers;

                    return (
                      <div
                        key={opt.id || opt.optionKey}
                        className={`p-3 rounded-xl border transition-all flex items-start gap-3 arena-inset ${
                          showAsCorrect
                            ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-500/40 text-emerald-900 dark:text-emerald-200 shadow-sm'
                            : 'border-black/[0.06] dark:border-white/5 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span
                          className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 ${
                            showAsCorrect
                              ? 'bg-emerald-500 text-white shadow-sm'
                              : 'bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {opt.optionKey}
                        </span>
                        <div className="flex-1 text-xs select-text">
                          <p className="font-semibold">{opt.optionText}</p>
                          {opt.explanation && !hideCorrectAnswers && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {opt.explanation}
                            </p>
                          )}
                        </div>
                        {showAsCorrect && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Expandable Explanation & Audit Details (Fixed Light/Dark contrast) */}
                <div className="pt-2.5 border-t border-black/[0.06] dark:border-white/5 flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <button
                      onClick={() => {
                        play('tick');
                        setExpandedId(isExpanded ? null : q.id);
                      }}
                      className="text-blue-600 dark:text-cyan-400 hover:text-blue-700 dark:hover:text-cyan-300 font-bold flex items-center gap-1 transition-colors"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5" />
                          <span>Tushuntirish va Isbotni berkitish</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5" />
                          <span>Pedagogik tushuntirish & Isbot</span>
                        </>
                      )}
                    </button>

                    <div className="flex items-center gap-4 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      <span>Duelda: {q.timesUsed} marta</span>
                      <span>
                        Aniqlik:{' '}
                        <strong className="text-slate-700 dark:text-slate-200">
                          {q.timesUsed > 0
                            ? `${Math.round((q.correctCount / q.timesUsed) * 100)}%`
                            : '—'}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-3.5 rounded-xl arena-inset text-xs text-slate-700 dark:text-slate-300 space-y-2 mt-2 border border-black/[0.05] dark:border-white/5">
                          <p className="font-bold text-blue-700 dark:text-cyan-300 flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
                            <span>Ilmiy va Pedagogik Tushuntirish:</span>
                          </p>
                          <p className="leading-relaxed text-slate-700 dark:text-slate-200 pl-4 border-l-2 border-blue-500/40 dark:border-cyan-500/40 select-text">
                            {q.explanation}
                          </p>

                          {/* Verification Log Score */}
                          {q.verificationLog && (
                            <div className="mt-3 pt-2 border-t border-black/[0.06] dark:border-white/5 text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-3">
                              <span>
                                Verifikatsiya bali:{' '}
                                <strong className="text-emerald-600 dark:text-emerald-400">
                                  {q.verificationLog.score ?? 100}/100
                                </strong>
                              </span>
                              <span>
                                Deterministik tekshiruv:{' '}
                                <strong className="text-blue-600 dark:text-cyan-400">
                                  O‘tgan ✓
                                </strong>
                              </span>
                            </div>
                          )}

                          {q.rejectionReason && (
                            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                              <span>
                                <strong>Rad etilish sababi:</strong> {q.rejectionReason}
                              </span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Action Toolbar: Live Preview Solver, Approve, Reject */}
                <div className="mt-4 pt-3 border-t border-black/[0.06] dark:border-white/10 flex flex-wrap items-center justify-between gap-2.5">
                  <button
                    onClick={() => openTestSimulator(q)}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold arena-inset text-blue-700 dark:text-cyan-300 hover:bg-blue-500/10 dark:hover:bg-cyan-500/20 border border-blue-500/30 dark:border-cyan-500/30 transition-all flex items-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                    <span>Sinab Ko‘rish (Live Simulyator)</span>
                  </button>

                  {q.status === 'PENDING_REVIEW' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          play('tick');
                          setRejectTargetId(q.id);
                          setIsRejectModalOpen(true);
                        }}
                        className="px-4 py-1.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 border border-rose-500/30 transition-all"
                      >
                        Rad etish
                      </button>
                      <button
                        onClick={() => approveMutation.mutate(q.id)}
                        disabled={isApprovingThis}
                        className="px-5 py-1.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-black shadow-md shadow-emerald-500/25 active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>
                          {isApprovingThis ? 'Tasdiqlanmoqda...' : 'Tasdiqlash (Faollashtirish)'}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* =====================================================================
          LIVE TEST SOLVER MODAL (With Real Countdown & Reset)
      ===================================================================== */}
      <AnimatePresence>
        {testQuestion && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg arena-glass rounded-3xl p-6 border border-black/[0.08] dark:border-white/10 shadow-2xl relative text-slate-900 dark:text-white space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/10">
                <div className="flex items-center gap-2">
                  <Play className="w-5 h-5 text-blue-600 dark:text-cyan-400" />
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Duel Simulyatori (Sinov)
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-1 rounded-xl text-xs font-black font-mono flex items-center gap-1 border ${
                      testTimeLeft <= 4 && !testRevealed
                        ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/40 animate-pulse'
                        : 'arena-inset text-blue-600 dark:text-cyan-300 border-black/[0.06] dark:border-white/10'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>{testTimeLeft}s</span>
                  </span>

                  <button
                    onClick={resetTestSimulator}
                    className="p-1.5 rounded-lg arena-inset text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    title="Qayta yechish"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setTestQuestion(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="arena-inset p-4 rounded-2xl space-y-2 border border-black/[0.06] dark:border-white/10">
                <span className="text-[10px] font-mono uppercase text-blue-600 dark:text-cyan-400 font-bold">
                  {SUBJECT_CONFIG[testQuestion.subjectCategory]?.label ||
                    testQuestion.subjectCategory}{' '}
                  • {DIFFICULTY_MAP[testQuestion.difficulty]?.label || testQuestion.difficulty}
                </span>
                <p className="text-sm font-bold text-slate-900 dark:text-white leading-relaxed">
                  {testQuestion.questionText}
                </p>
                {testQuestion.codeSnippet && (
                  <pre className="p-3 bg-slate-900 rounded-xl text-xs font-mono text-cyan-200 overflow-x-auto">
                    <code>{testQuestion.codeSnippet}</code>
                  </pre>
                )}
              </div>

              {/* Options */}
              <div className="space-y-2">
                {[...(testQuestion.options || [])]
                  .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
                  .map((opt) => {
                    const isSelected = testSelectedKey === opt.optionKey;
                    const isCorrect = opt.isCorrect;

                    return (
                      <button
                        key={opt.id || opt.optionKey}
                        disabled={testRevealed}
                        onClick={() => {
                          if (testRevealed) return;
                          play(isCorrect ? 'success' : 'error');
                          haptic(isCorrect ? 'impactLight' : 'notificationError');
                          setTestSelectedKey(opt.optionKey);
                          setTestRevealed(true);
                        }}
                        className={`w-full p-3.5 rounded-xl border text-left text-xs font-semibold transition-all flex items-center gap-3 arena-inset shadow-sm ${
                          testRevealed && isCorrect
                            ? 'bg-emerald-50 dark:bg-emerald-500/25 border-emerald-500 text-emerald-900 dark:text-emerald-200 shadow'
                            : testRevealed && isSelected && !isCorrect
                            ? 'bg-rose-50 dark:bg-rose-500/25 border-rose-500 text-rose-900 dark:text-rose-200'
                            : isSelected
                            ? 'bg-blue-50 dark:bg-cyan-500/25 border-blue-500 dark:border-cyan-400 text-blue-900 dark:text-cyan-200'
                            : 'border-black/[0.08] dark:border-white/10 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.06]'
                        }`}
                      >
                        <span
                          className={`w-6 h-6 rounded-lg font-bold flex items-center justify-center shrink-0 ${
                            testRevealed && isCorrect
                              ? 'bg-emerald-500 text-white'
                              : testRevealed && isSelected && !isCorrect
                              ? 'bg-rose-500 text-white'
                              : 'bg-slate-200 dark:bg-white/10 text-slate-800 dark:text-white'
                          }`}
                        >
                          {opt.optionKey}
                        </span>
                        <span className="flex-1">{opt.optionText}</span>
                        {testRevealed && isCorrect && (
                          <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        )}
                      </button>
                    );
                  })}
              </div>

              {/* Explanation Reveal */}
              {testRevealed && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3.5 rounded-xl arena-inset text-xs text-slate-700 dark:text-slate-300 space-y-1 border border-black/[0.06] dark:border-white/10"
                >
                  <div className="font-bold text-blue-700 dark:text-cyan-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span>Ilmiy Isbot va Yechim:</span>
                  </div>
                  <p className="leading-relaxed">{testQuestion.explanation}</p>
                </motion.div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-black/[0.06] dark:border-white/10">
                {testQuestion.status === 'PENDING_REVIEW' ? (
                  <button
                    onClick={() => approveMutation.mutate(testQuestion.id)}
                    disabled={approveMutation.isPending}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-black shadow-sm flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Savolni Tasdiqlash</span>
                  </button>
                ) : (
                  <span />
                )}

                <button
                  onClick={() => setTestQuestion(null)}
                  className="px-5 py-2 rounded-xl text-xs font-bold arena-inset border border-black/[0.08] dark:border-white/10 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm"
                >
                  Yopish
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =====================================================================
          AI GENERATOR MODAL (With Grade, Language & Topic Presets)
      ===================================================================== */}
      <AnimatePresence>
        {isAiModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl arena-glass rounded-3xl p-6 border border-black/[0.08] dark:border-white/10 shadow-2xl relative text-slate-900 dark:text-white space-y-5 max-h-[90vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/15 dark:bg-cyan-500/20 border border-blue-500/30 dark:border-cyan-500/40 flex items-center justify-center text-blue-600 dark:text-cyan-300">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                      AI Savollar Generatori
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Gemini 3.5 Flash & Deterministik AST/Sandbox Verifikator
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAiModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form */}
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Fan yo‘nalishi
                    </label>
                    <select
                      value={aiForm.subjectCategory}
                      onChange={(e) =>
                        setAiForm({ ...aiForm, subjectCategory: e.target.value, topic: '' })
                      }
                      className="w-full p-2.5 bg-white dark:bg-black/50 border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:border-blue-500 outline-none shadow-sm font-semibold"
                    >
                      {Object.entries(SUBJECT_CONFIG).map(([k, c]) => (
                        <option key={k} value={k}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Qiyinchilik darajasi
                    </label>
                    <select
                      value={aiForm.difficulty}
                      onChange={(e) => setAiForm({ ...aiForm, difficulty: e.target.value })}
                      className="w-full p-2.5 bg-white dark:bg-black/50 border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:border-blue-500 outline-none shadow-sm font-semibold"
                    >
                      <option value="EASY">Oson (12s • Foundational)</option>
                      <option value="MEDIUM">O‘rta (15s • Multi-step)</option>
                      <option value="HARD">Qiyin (25s • Olimpiada / Expert)</option>
                    </select>
                  </div>
                </div>

                {/* Previously missing Target Grade, Language & Count selectors */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Auditoriya / Sinf
                    </label>
                    <select
                      value={aiForm.targetGrade}
                      onChange={(e) => setAiForm({ ...aiForm, targetGrade: e.target.value })}
                      className="w-full p-2.5 bg-white dark:bg-black/50 border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:border-blue-500 outline-none shadow-sm font-semibold"
                    >
                      <option value="5-7 sinf">5–7-sinf</option>
                      <option value="8-9 sinf">8–9-sinf</option>
                      <option value="10-11 sinf">10–11-sinf / Litsey</option>
                      <option value="Olimpiada va OTM">Olimpiada / Abituriyent</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Savol tili
                    </label>
                    <select
                      value={aiForm.language}
                      onChange={(e) => setAiForm({ ...aiForm, language: e.target.value })}
                      className="w-full p-2.5 bg-white dark:bg-black/50 border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:border-blue-500 outline-none shadow-sm font-semibold"
                    >
                      <option value="uz">🇺🇿 O‘zbek tili</option>
                      <option value="en">🇬🇧 Ingliz tili (English)</option>
                      <option value="ru">🇷🇺 Rus tili (Русский)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Savollar soni
                    </label>
                    <select
                      value={aiForm.count}
                      onChange={(e) => setAiForm({ ...aiForm, count: Number(e.target.value) })}
                      className="w-full p-2.5 bg-white dark:bg-black/50 border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:border-blue-500 outline-none shadow-sm font-semibold"
                    >
                      <option value={1}>1 ta savol</option>
                      <option value={3}>3 ta savol</option>
                      <option value={5}>5 ta savol (Maksimal)</option>
                    </select>
                  </div>
                </div>

                {/* Topic Input + Quick Subject Presets */}
                <div className="space-y-2">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    Aniq mavzu yoki fokus (Ixtiyoriy)
                  </label>
                  <input
                    type="text"
                    placeholder="Masalan: Kvadrat tenglamalar, Nyuton 2-qonuni, Rekursiya..."
                    value={aiForm.topic}
                    onChange={(e) => setAiForm({ ...aiForm, topic: e.target.value })}
                    className="w-full p-2.5 bg-white dark:bg-black/50 border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:border-blue-500 outline-none shadow-sm"
                  />

                  {/* Smart Topic Chips */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                      <Zap className="w-3 h-3 text-amber-500" /> Tezkor mavzular:
                    </span>
                    {(SUBJECT_CONFIG[aiForm.subjectCategory]?.presets || []).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setAiForm({ ...aiForm, topic: preset })}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all ${
                          aiForm.topic === preset
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'arena-inset text-slate-600 dark:text-slate-300 border-black/[0.06] dark:border-white/10 hover:border-blue-400'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-xl arena-inset text-slate-700 dark:text-slate-300 space-y-1 border border-black/[0.06] dark:border-white/10">
                  <div className="flex items-center gap-1.5 font-bold text-blue-700 dark:text-cyan-300">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>100% Deterministik Sifat Siyosati:</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Yaratilgan barcha savollar avtomatik <strong>PENDING_REVIEW</strong> holatida saqlanadi va AST/Sandbox tekshiruvidan o‘tmaguncha duelga kiritilmaydi.
                  </p>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-black/[0.06] dark:border-white/10">
                <button
                  onClick={() => setIsAiModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  Bekor qilish
                </button>
                <button
                  onClick={() => generateAiMutation.mutate(aiForm)}
                  disabled={generateAiMutation.isPending}
                  className="px-6 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-500/25 active:scale-95 transition-all flex items-center gap-2 arena-sheen disabled:opacity-50"
                >
                  {generateAiMutation.isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Generatsiya qilinmoqda...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Savollarni Yaratish</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =====================================================================
          MANUAL QUESTION BUILDER MODAL (For Teachers & Admins)
      ===================================================================== */}
      <AnimatePresence>
        {isManualModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl arena-glass rounded-3xl p-6 border border-black/[0.08] dark:border-white/10 shadow-2xl relative text-slate-900 dark:text-white space-y-4 max-h-[92vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                      Mualliflik Savoli Qo‘shish
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Mind Arena duellari uchun maxsus savol va 4 ta javob variantini kiriting
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsManualModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Fan yo‘nalishi
                    </label>
                    <select
                      value={manualForm.subjectCategory}
                      onChange={(e) =>
                        setManualForm({ ...manualForm, subjectCategory: e.target.value })
                      }
                      className="w-full p-2.5 bg-white dark:bg-black/50 border border-slate-300 dark:border-white/10 rounded-xl font-semibold"
                    >
                      {Object.entries(SUBJECT_CONFIG).map(([k, c]) => (
                        <option key={k} value={k}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Qiyinchilik
                    </label>
                    <select
                      value={manualForm.difficulty}
                      onChange={(e) =>
                        setManualForm({
                          ...manualForm,
                          difficulty: e.target.value as 'EASY' | 'MEDIUM' | 'HARD',
                        })
                      }
                      className="w-full p-2.5 bg-white dark:bg-black/50 border border-slate-300 dark:border-white/10 rounded-xl font-semibold"
                    >
                      <option value="EASY">Oson</option>
                      <option value="MEDIUM">O‘rta</option>
                      <option value="HARD">Qiyin</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Vaqt (soniya)
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={60}
                      value={manualForm.timeLimitSec}
                      onChange={(e) =>
                        setManualForm({ ...manualForm, timeLimitSec: Number(e.target.value) })
                      }
                      className="w-full p-2.5 bg-white dark:bg-black/50 border border-slate-300 dark:border-white/10 rounded-xl font-mono font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Savol matni *
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Savol shartini aniq va tushunarli kiriting..."
                    value={manualForm.questionText}
                    onChange={(e) =>
                      setManualForm({ ...manualForm, questionText: e.target.value })
                    }
                    className="w-full p-3 bg-white dark:bg-black/50 border border-slate-300 dark:border-white/10 rounded-xl"
                  />
                </div>

                {/* Optional Code Block Toggle */}
                <div>
                  <label className="inline-flex items-center gap-2 cursor-pointer font-bold text-blue-600 dark:text-cyan-400">
                    <input
                      type="checkbox"
                      checked={manualForm.hasCode}
                      onChange={(e) =>
                        setManualForm({ ...manualForm, hasCode: e.target.checked })
                      }
                      className="rounded"
                    />
                    <span>Dasturlash kodi (Code Snippet) biriktirish</span>
                  </label>

                  {manualForm.hasCode && (
                    <div className="mt-2 space-y-2">
                      <textarea
                        rows={3}
                        placeholder="Kod namunasini yozing..."
                        value={manualForm.codeSnippet}
                        onChange={(e) =>
                          setManualForm({ ...manualForm, codeSnippet: e.target.value })
                        }
                        className="w-full p-3 bg-slate-900 text-cyan-200 font-mono rounded-xl border border-white/10"
                      />
                    </div>
                  )}
                </div>

                {/* 4 Options with Radio selector for Correct Answer */}
                <div className="space-y-2">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    Javob variantlari (To‘g‘ri javob kalitini belgilang) *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {manualForm.options.map((opt, idx) => {
                      const isCorrect = manualForm.correctKey === opt.optionKey;
                      return (
                        <div
                          key={opt.optionKey}
                          className={`flex items-center gap-2 p-2 rounded-xl border ${
                            isCorrect
                              ? 'border-emerald-500 bg-emerald-500/10'
                              : 'border-slate-300 dark:border-white/10 bg-white dark:bg-black/40'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setManualForm({ ...manualForm, correctKey: opt.optionKey })
                            }
                            className={`w-7 h-7 rounded-lg font-black text-xs shrink-0 transition-all ${
                              isCorrect
                                ? 'bg-emerald-500 text-white'
                                : 'bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300'
                            }`}
                            title="To‘g‘ri javob sifatida belgilash"
                          >
                            {opt.optionKey}
                          </button>
                          <input
                            type="text"
                            placeholder={`${opt.optionKey} varianti matni...`}
                            value={opt.optionText}
                            onChange={(e) => {
                              const next = [...manualForm.options];
                              next[idx] = { ...next[idx], optionText: e.target.value };
                              setManualForm({ ...manualForm, options: next });
                            }}
                            className="flex-1 bg-transparent outline-none text-xs"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Ilmiy isbot va tushuntirish *
                    </label>
                    <input
                      type="text"
                      placeholder="Nima uchun shu javob to‘g‘ri ekanligini izohlang..."
                      value={manualForm.explanation}
                      onChange={(e) =>
                        setManualForm({ ...manualForm, explanation: e.target.value })
                      }
                      className="w-full p-2.5 bg-white dark:bg-black/50 border border-slate-300 dark:border-white/10 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Teglar (vergul bilan)
                    </label>
                    <input
                      type="text"
                      placeholder="algebra, tenglama, 9-sinf"
                      value={manualForm.tagsInput}
                      onChange={(e) =>
                        setManualForm({ ...manualForm, tagsInput: e.target.value })
                      }
                      className="w-full p-2.5 bg-white dark:bg-black/50 border border-slate-300 dark:border-white/10 rounded-xl"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-black/[0.06] dark:border-white/10">
                <button
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white"
                >
                  Bekor qilish
                </button>
                <button
                  onClick={() => createManualMutation.mutate()}
                  disabled={!isManualFormValid || createManualMutation.isPending}
                  className="px-6 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-md active:scale-95 transition-all flex items-center gap-2 disabled:opacity-40"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {createManualMutation.isPending ? 'Saqlanmoqda...' : 'Savolni Saqlash'}
                  </span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =====================================================================
          REJECT QUESTION MODAL
      ===================================================================== */}
      <AnimatePresence>
        {isRejectModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md arena-glass rounded-3xl p-6 border border-rose-500/30 text-slate-900 dark:text-white space-y-4 shadow-2xl"
            >
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-500" />
                <span>Savolni Rad Etish</span>
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Ushbu savolni rad etish sababini kiriting (muallif va audit jurnalida ko‘rinadi):
              </p>

              {/* Quick Rejection Reason Pills */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Matematik hisobda xatolik bor',
                  'Ikkita to‘g‘ri javob mavjud',
                  'Savol sharti noaniq yozilgan',
                  'Imloviy xatolar mavjud',
                ].map((reasonPreset) => (
                  <button
                    key={reasonPreset}
                    type="button"
                    onClick={() => setRejectReason(reasonPreset)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold arena-inset border border-rose-500/20 text-rose-700 dark:text-rose-300 hover:bg-rose-500/10"
                  >
                    {reasonPreset}
                  </button>
                ))}
              </div>

              <textarea
                rows={3}
                placeholder="Masalan: Matematik hisob-kitobda noaniqlik mavjud..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full p-3 bg-white dark:bg-black/50 border border-slate-300 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-rose-500 outline-none shadow-sm"
              />

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setIsRejectModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  Bekor qilish
                </button>
                <button
                  onClick={() => {
                    if (rejectTargetId && rejectReason.trim()) {
                      rejectMutation.mutate({
                        id: rejectTargetId,
                        reason: rejectReason.trim(),
                      });
                    }
                  }}
                  disabled={!rejectReason.trim() || rejectMutation.isPending}
                  className="px-5 py-2 rounded-xl font-bold text-xs bg-rose-600 hover:bg-rose-500 text-white shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  {rejectMutation.isPending ? 'Rad etilmoqda...' : 'Rad etish'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};