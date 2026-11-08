import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RotateCcw,
  CheckCircle2,
  XCircle,
  Check,
  Brain,
  BookOpen,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import request from '@/lib/api';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useTelegram } from '@/hooks/useTelegram';
import '@/styles/arena-liquid.css';

export interface VaultMistakeItem {
  id: string;
  questionId: string;
  subjectCategory: string;
  subjectName: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  questionText: string;
  options: Array<{ optionKey: string; optionText: string; isCorrect: boolean; explanation?: string | null }>;
  chosenOptionKey: string | null;
  correctOptionKey: string;
  explanation: string;
  codeSnippet?: string | null;
  codeLanguage?: string | null;
  failedAt: string;
  practiceCount: number;
  mastered: boolean;
}

const VAULT_STORAGE_KEY = 'm-edu.arena-mistakes-vault';

const SUBJECT_NAMES: Record<string, string> = {
  MATHEMATICS: 'Matematika',
  PHYSICS: 'Fizika',
  PROGRAMMING: 'Dasturlash',
  HISTORY: 'Tarix',
  ENGLISH: 'Ingliz tili',
  LOGIC_PUZZLE: 'Mantiq',
  GENERAL_SCIENCE: 'Fan',
};

export function ArenaMistakeVault() {
  const { play, playSuccess, playError, playTick } = usePremiumSound();
  const { haptic } = useTelegram();

  // Load real approved questions from DB to serve as curriculum practice bank
  const { data: practiceBankResp, isLoading: bankLoading } = useQuery<{ items: any[]; total: number }>({
    queryKey: ['arena-mistakes-practice-bank'],
    queryFn: () => request('/arena/questions?status=APPROVED&limit=40'),
    staleTime: 60_000,
  });

  const [storedMistakes, setStoredMistakes] = useState<VaultMistakeItem[]>(() => {
    try {
      const stored = localStorage.getItem(VAULT_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Ignored
    }
    return [];
  });

  // Mode: 'MY_MISTAKES' (real duel errors) vs 'ACADEMIC_DRILL' (real DB questions)
  const [vaultTab, setVaultTab] = useState<'MY_MISTAKES' | 'ACADEMIC_DRILL'>('MY_MISTAKES');
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL');
  const [filterMode, setFilterMode] = useState<'PENDING' | 'MASTERED' | 'ALL'>('PENDING');

  const [activeDrillItem, setActiveDrillItem] = useState<VaultMistakeItem | null>(null);
  const [drillChosenKey, setDrillChosenKey] = useState<string | null>(null);
  const [drillShowSolution, setDrillShowSolution] = useState<boolean>(false);

  // Sync stored mistakes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(storedMistakes));
    } catch {
      // Storage safe
    }
  }, [storedMistakes]);

  // Convert DB questions to practice drill items
  const dbPracticeItems = useMemo<VaultMistakeItem[]>(() => {
    if (!practiceBankResp?.items) return [];
    return practiceBankResp.items.map((q) => {
      const correctOpt = q.options?.find((o: any) => o.isCorrect);
      return {
        id: `db-q-${q.id}`,
        questionId: q.id,
        subjectCategory: q.subjectCategory,
        subjectName: SUBJECT_NAMES[q.subjectCategory] || q.subjectCategory,
        difficulty: q.difficulty,
        questionText: q.questionText,
        options: (q.options || []).map((o: any) => ({
          optionKey: o.optionKey,
          optionText: o.optionText,
          isCorrect: o.isCorrect,
          explanation: o.explanation,
        })),
        chosenOptionKey: null,
        correctOptionKey: correctOpt?.optionKey || 'A',
        explanation: q.explanation || 'To‘g‘ri javob tasdiqlangan.',
        codeSnippet: q.codeSnippet,
        codeLanguage: q.codeLanguage,
        failedAt: q.createdAt,
        practiceCount: 0,
        mastered: false,
      };
    });
  }, [practiceBankResp]);

  // Effective list based on tab
  const activeItems = useMemo(() => {
    return vaultTab === 'MY_MISTAKES' ? storedMistakes : dbPracticeItems;
  }, [vaultTab, storedMistakes, dbPracticeItems]);

  const stats = useMemo(() => {
    const total = activeItems.length;
    const mastered = activeItems.filter((m) => m.mastered).length;
    const pending = total - mastered;
    const masteryRate = total > 0 ? Math.round((mastered / total) * 100) : 100;
    return { total, mastered, pending, masteryRate };
  }, [activeItems]);

  const filteredItems = useMemo(() => {
    return activeItems.filter((m) => {
      if (selectedSubject !== 'ALL' && m.subjectCategory !== selectedSubject) return false;
      if (filterMode === 'PENDING' && m.mastered) return false;
      if (filterMode === 'MASTERED' && !m.mastered) return false;
      return true;
    });
  }, [activeItems, selectedSubject, filterMode]);

  const startDrill = (item: VaultMistakeItem) => {
    play('pop');
    haptic('selection');
    setActiveDrillItem(item);
    setDrillChosenKey(null);
    setDrillShowSolution(false);
  };

  const handleSelectDrillOption = (key: string) => {
    if (drillShowSolution) return;
    setDrillChosenKey(key);
    play('tick');
    haptic('selection');
  };

  const handleVerifyDrillAnswer = () => {
    if (!activeDrillItem || !drillChosenKey) return;
    const isCorrect = drillChosenKey === activeDrillItem.correctOptionKey;
    setDrillShowSolution(true);

    if (isCorrect) {
      playSuccess();
      haptic('impactLight');
      if (vaultTab === 'MY_MISTAKES') {
        setStoredMistakes((prev) =>
          prev.map((m) =>
            m.id === activeDrillItem.id
              ? { ...m, practiceCount: m.practiceCount + 1, mastered: true }
              : m
          )
        );
      }
    } else {
      playError();
      haptic('notificationError');
      if (vaultTab === 'MY_MISTAKES') {
        setStoredMistakes((prev) =>
          prev.map((m) =>
            m.id === activeDrillItem.id
              ? { ...m, practiceCount: m.practiceCount + 1 }
              : m
          )
        );
      }
    }
  };

  const closeDrill = () => {
    play('tick');
    setActiveDrillItem(null);
    setDrillChosenKey(null);
    setDrillShowSolution(false);
  };

  return (
    <div className="space-y-6">
      {/* =====================================================================
          TOP HEADER: MISTAKE VAULT KPI SUBSTRATE
      ===================================================================== */}
      <div className="arena-glass rounded-3xl p-5 sm:p-6 border border-black/[0.06] dark:border-white/10 shadow-sm relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-1.5 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full arena-inset text-xs font-bold text-amber-700 dark:text-amber-300 border border-amber-500/25">
              <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
              <span>Pedagogik Tahlil & Spaced Repetition V2</span>
            </div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Xatolar Laboratoriyasi (Mistake Vault)
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Real 1v1 duellarda adashgan savollaringiz ustida ishlang yoki rasmiy akademik baza orqali zaif mavzularingizni reyting pasayish xavfisiz mustahkamlang!
            </p>
          </div>

          {/* Quick Metrics Island */}
          <div className="grid grid-cols-3 gap-3 w-full lg:w-auto">
            <div className="p-3.5 rounded-2xl arena-inset text-center min-w-[90px] border border-black/[0.05] dark:border-white/10">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Kutilmoqda
              </div>
              <div className="text-xl sm:text-2xl font-black text-rose-500 dark:text-rose-400 mt-0.5">
                {stats.pending}
              </div>
              <div className="text-[10px] text-slate-400">Mashq zarur</div>
            </div>

            <div className="p-3.5 rounded-2xl arena-inset text-center min-w-[90px] border border-black/[0.05] dark:border-white/10">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                O‘zlashtirildi
              </div>
              <div className="text-xl sm:text-2xl font-black text-emerald-500 dark:text-emerald-400 mt-0.5">
                {stats.mastered}
              </div>
              <div className="text-[10px] text-slate-400">Hal qilindi</div>
            </div>

            <div className="p-3.5 rounded-2xl arena-inset text-center min-w-[90px] border border-black/[0.05] dark:border-white/10">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Aniqlik
              </div>
              <div className="text-xl sm:text-2xl font-black text-blue-600 dark:text-cyan-400 mt-0.5">
                {stats.masteryRate}%
              </div>
              <div className="text-[10px] text-slate-400">Ko‘rsatkich</div>
            </div>
          </div>
        </div>

        {/* Tab Switcher & Filter Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-5 pt-4 border-t border-black/[0.06] dark:border-white/10">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 p-1 rounded-2xl arena-inset">
              {(
                [
                  { id: 'PENDING', label: 'Bajarilmagan' },
                  { id: 'MASTERED', label: 'O‘zlashtirilgan' },
                  { id: 'ALL', label: 'Hammasi' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    playTick();
                    setFilterMode(f.id);
                  }}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                    filterMode === f.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                playTick();
                setVaultTab('MY_MISTAKES');
              }}
              className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all ${
                vaultTab === 'MY_MISTAKES'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Mening Xatolarim ({storedMistakes.length})
            </button>
            <button
              onClick={() => {
                playTick();
                setVaultTab('ACADEMIC_DRILL');
              }}
              className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all ${
                vaultTab === 'ACADEMIC_DRILL'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Akademik Trenajor ({dbPracticeItems.length})
            </button>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {[
              { id: 'ALL', label: 'Barcha Fanlar' },
              { id: 'MATHEMATICS', label: 'Matematika' },
              { id: 'PHYSICS', label: 'Fizika' },
              { id: 'PROGRAMMING', label: 'Dasturlash' },
              { id: 'HISTORY', label: 'Tarix' },
              { id: 'ENGLISH', label: 'Ingliz tili' },
              { id: 'LOGIC_PUZZLE', label: 'Mantiq' },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  playTick();
                  setSelectedSubject(s.id);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                  selectedSubject === s.id
                    ? 'border-blue-500 bg-blue-500/10 text-blue-700 dark:text-cyan-300 font-bold'
                    : 'border-black/[0.05] dark:border-white/10 text-slate-500 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* =====================================================================
          MISTAKES CARDS GRID
      ===================================================================== */}
      {bankLoading ? (
        <div className="p-12 text-center arena-glass rounded-3xl border border-black/[0.06] dark:border-white/10 space-y-3">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            Savollar bazasi yuklanmoqda...
          </p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-12 text-center arena-glass rounded-3xl border border-black/[0.06] dark:border-white/10 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center text-2xl shadow-inner">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            {vaultTab === 'MY_MISTAKES'
              ? 'Duellarda hali xatoga yo‘l qo‘ymagansiz! 🎉'
              : 'Ushbu bo‘limda savollar mavjud emas'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {vaultTab === 'MY_MISTAKES'
              ? 'Xatolaringiz shu yerda to‘planib boradi. Bazasidagi savollarni ko‘rish uchun "Akademik Trenajor" yorlig‘iga o‘ting!'
              : 'Boshqa fan yoki qiyinlik darajasini tanlang.'}
          </p>
          {vaultTab === 'MY_MISTAKES' && dbPracticeItems.length > 0 && (
            <button
              onClick={() => setVaultTab('ACADEMIC_DRILL')}
              className="mt-3 px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md inline-flex items-center gap-1.5"
            >
              <span>Akademik Trenajorga O‘tish</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-5 rounded-3xl arena-glass border transition-all flex flex-col justify-between space-y-4 ${
                m.mastered
                  ? 'border-emerald-500/30 dark:border-emerald-500/30'
                  : 'border-black/[0.06] dark:border-white/10 hover:border-blue-500/40'
              }`}
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-blue-700 dark:text-cyan-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20">
                    {m.subjectName}
                  </span>
                  {m.mastered ? (
                    <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                      <Check className="w-3 h-3" /> O‘ZLASHTIRILDI
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/25">
                      Mashq qilinmagan
                    </span>
                  )}
                </div>

                <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-3 leading-snug">
                  {m.questionText}
                </h4>

                {m.chosenOptionKey && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                    <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-medium">
                      <XCircle className="w-3 h-3 shrink-0" />
                      <span>Sizning javobingiz: Variant {m.chosenOptionKey}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3 h-3 shrink-0" />
                      <span>To‘g‘ri javob: Variant {m.correctOptionKey}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-black/[0.05] dark:border-white/10 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-mono">
                  {m.difficulty} daraja
                </span>

                <button
                  onClick={() => startDrill(m)}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{m.mastered ? 'Qayta Yechish' : 'Mashq Qilish'}</span>
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* =====================================================================
          INTERACTIVE DRILL MODAL (Focus Solver with Explanations)
      ===================================================================== */}
      <AnimatePresence>
        {activeDrillItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl arena-glass rounded-3xl p-6 sm:p-8 border border-white/20 shadow-2xl relative space-y-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-black/[0.06] dark:border-white/10 pb-4">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-blue-500/15 text-blue-600 dark:text-cyan-400">
                    <Brain className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      Akademik Mashq Trenajori
                    </h3>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {activeDrillItem.subjectName} • Stress-free Rejim (Reytingga ta’sir qilmaydi)
                    </span>
                  </div>
                </div>

                <button
                  onClick={closeDrill}
                  className="w-8 h-8 rounded-full arena-inset flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-white font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Question Text */}
              <div className="space-y-3">
                <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-relaxed">
                  {activeDrillItem.questionText}
                </p>

                {activeDrillItem.codeSnippet && (
                  <pre className="p-4 rounded-2xl bg-black/90 text-cyan-300 font-mono text-xs overflow-x-auto border border-white/10">
                    <code>{activeDrillItem.codeSnippet}</code>
                  </pre>
                )}
              </div>

              {/* Options */}
              <div className="space-y-2.5">
                {activeDrillItem.options.map((opt) => {
                  const isSelected = drillChosenKey === opt.optionKey;
                  const isCorrect = opt.isCorrect;

                  let optClass =
                    'bg-white/50 dark:bg-white/5 border-black/[0.06] dark:border-white/10 hover:border-blue-400';
                  if (drillShowSolution) {
                    if (isCorrect) {
                      optClass = 'bg-emerald-500/20 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-bold';
                    } else if (isSelected && !isCorrect) {
                      optClass = 'bg-rose-500/20 border-rose-500 text-rose-700 dark:text-rose-300 font-bold';
                    } else {
                      optClass = 'opacity-40 border-transparent';
                    }
                  } else if (isSelected) {
                    optClass = 'border-blue-500 bg-blue-500/10 font-bold text-blue-700 dark:text-cyan-300';
                  }

                  return (
                    <button
                      key={opt.optionKey}
                      type="button"
                      disabled={drillShowSolution}
                      onClick={() => handleSelectDrillOption(opt.optionKey)}
                      className={`w-full p-4 rounded-2xl border text-left text-sm transition-all flex items-center justify-between gap-3 ${optClass}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-lg bg-black/10 dark:bg-white/10 flex items-center justify-center text-xs font-black shrink-0">
                          {opt.optionKey}
                        </span>
                        <span>{opt.optionText}</span>
                      </div>
                      {drillShowSolution && isCorrect && (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                      )}
                      {drillShowSolution && isSelected && !isCorrect && (
                        <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Solution & Explanation Box */}
              {drillShowSolution && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-2 text-xs"
                >
                  <div className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-amber-500" />
                    <span>Pedagogik Tushuntirish va To‘g‘ri Yechim:</span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-mono">
                    {activeDrillItem.explanation}
                  </p>
                </motion.div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 border-t border-black/[0.06] dark:border-white/10 flex items-center justify-end gap-3">
                {!drillShowSolution ? (
                  <button
                    onClick={handleVerifyDrillAnswer}
                    disabled={!drillChosenKey}
                    className="px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wider bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25 active:scale-95 transition-all disabled:opacity-40"
                  >
                    Javobni Tekshirish
                  </button>
                ) : (
                  <button
                    onClick={closeDrill}
                    className="px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 active:scale-95 transition-all"
                  >
                    Tushundim • Davom Etish
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
