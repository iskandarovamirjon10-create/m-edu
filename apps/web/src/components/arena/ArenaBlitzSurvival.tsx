import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Zap,
  Timer,
  Flame,
  Trophy,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Play,
  Sparkles,
  ShieldAlert,
  Loader2,
  BookOpen,
} from 'lucide-react';
import request from '@/lib/api';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useTelegram } from '@/hooks/useTelegram';
import '@/styles/arena-liquid.css';

interface ArenaQuestionOption {
  id: string;
  optionKey: string;
  optionText: string;
  isCorrect: boolean;
  explanation?: string | null;
}

interface ArenaQuestion {
  id: string;
  subjectCategory: string;
  difficulty: string;
  questionText: string;
  codeSnippet?: string | null;
  codeLanguage?: string | null;
  explanation?: string | null;
  options: ArenaQuestionOption[];
}

const SUBJECT_META: Record<string, { label: string; icon: string; color: string }> = {
  MATHEMATICS: { label: 'Matematika', icon: '📐', color: 'text-amber-500' },
  PHYSICS: { label: 'Fizika', icon: '⚛️', color: 'text-blue-500' },
  PROGRAMMING: { label: 'Dasturlash', icon: '💻', color: 'text-emerald-500' },
  HISTORY: { label: 'Tarix', icon: '📜', color: 'text-orange-500' },
  ENGLISH: { label: 'Ingliz tili', icon: '🇬🇧', color: 'text-rose-500' },
  LOGIC_PUZZLE: { label: 'Mantiq', icon: '🧩', color: 'text-purple-500' },
  GENERAL_SCIENCE: { label: 'Fan', icon: '🔬', color: 'text-cyan-500' },
};

const BLITZ_STORAGE_RECORD_KEY = 'm-edu.arena-blitz-high-score';

export function ArenaBlitzSurvival() {
  const { play, playTick, playSuccess, playError, playCelebration } = usePremiumSound();
  const { haptic } = useTelegram();

  // Load real approved questions from PostgreSQL backend
  const { data: questionsResp, isLoading } = useQuery<{ items: ArenaQuestion[]; total: number }>({
    queryKey: ['arena-blitz-questions-v2'],
    queryFn: () => request('/arena/questions?status=APPROVED&limit=100'),
    staleTime: 60_000,
  });

  const allQuestions = useMemo(() => questionsResp?.items || [], [questionsResp]);

  const [activePool, setActivePool] = useState<ArenaQuestion[]>([]);
  const [gameState, setGameState] = useState<'IDLE' | 'PLAYING' | 'GAMEOVER'>('IDLE');
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(12);
  const [streak, setStreak] = useState<number>(0);
  const [score, setScore] = useState<number>(0);
  const [selectedOptionKey, setSelectedOptionKey] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<boolean>(false);
  const [highScore, setHighScore] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(BLITZ_STORAGE_RECORD_KEY);
      return stored ? Number(stored) : 0;
    } catch {
      return 0;
    }
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Timer ichidan eng so‘nggi game-over handlerini chaqirish uchun ref.
  const handleGameOverRef = useRef<(reason: string) => void>(() => {});

  // Active question from shuffled pool
  const currentQuestion = useMemo<ArenaQuestion | null>(() => {
    if (activePool.length === 0) return null;
    return activePool[currentIdx % activePool.length];
  }, [activePool, currentIdx]);

  // Multiplier calculation based on streak
  const multiplier = useMemo(() => {
    if (streak >= 8) return 3.0;
    if (streak >= 5) return 2.0;
    if (streak >= 3) return 1.5;
    return 1.0;
  }, [streak]);

  // Timer loop
  useEffect(() => {
    if (gameState !== 'PLAYING') {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleGameOverRef.current('Vaqt tugadi!');
          return 0;
        }
        if (prev <= 4) {
          playTick();
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState, playTick]);

  const startGame = () => {
    if (allQuestions.length === 0) return;

    // Pseudo-randomly shuffle all approved questions
    const shuffled = [...allQuestions].sort(() => 0.5 - Math.random());
    setActivePool(shuffled);

    play('pop');
    haptic('heavy');
    setGameState('PLAYING');
    setCurrentIdx(0);
    setStreak(0);
    setScore(0);
    setTimeLeft(12);
    setSelectedOptionKey(null);
    setRevealed(false);
  };

  const handleSelectOption = (opt: ArenaQuestionOption) => {
    if (revealed || gameState !== 'PLAYING' || !currentQuestion) return;

    setSelectedOptionKey(opt.optionKey);
    setRevealed(true);

    const isCorrect = opt.isCorrect;

    if (isCorrect) {
      playSuccess();
      haptic('impactLight');
      const gained = Math.round(100 * multiplier + timeLeft * 10);
      const newScore = score + gained;
      const newStreak = streak + 1;

      setScore(newScore);
      setStreak(newStreak);

      if (newScore > highScore) {
        setHighScore(newScore);
        try {
          localStorage.setItem(BLITZ_STORAGE_RECORD_KEY, String(newScore));
        } catch {
          // Local storage safe
        }
      }

      // Bonus time + advance to next question
      setTimeout(() => {
        setTimeLeft((prev) => Math.min(15, prev + 3)); // +3s bonus
        setSelectedOptionKey(null);
        setRevealed(false);
        setCurrentIdx((prev) => prev + 1);
      }, 700);
    } else {
      playError();
      haptic('notificationError');
      setTimeout(() => {
        handleGameOver('Noto‘g‘ri javob!');
      }, 950);
    }
  };

  const handleGameOver = useCallback(
    (_reason: string) => {
      if (timerRef.current) clearInterval(timerRef.current);
      setGameState('GAMEOVER');
      if (score >= highScore && score > 0) {
        playCelebration();
        haptic('celebration');
      }
    },
    [score, highScore, playCelebration, haptic],
  );

  useEffect(() => {
    handleGameOverRef.current = handleGameOver;
  }, [handleGameOver]);

  const currentSubject = currentQuestion
    ? SUBJECT_META[currentQuestion.subjectCategory] || {
        label: currentQuestion.subjectCategory,
        icon: '📚',
        color: 'text-blue-500',
      }
    : null;

  return (
    <div className="space-y-6">
      {/* =====================================================================
          HEADER BANNER
      ===================================================================== */}
      <div className="arena-glass rounded-3xl p-6 border border-amber-500/25 dark:border-amber-500/30 shadow-md relative overflow-hidden">
        <div className="pointer-events-none absolute -right-20 -top-20 w-64 h-64 rounded-full bg-amber-500/10 blur-3xl" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full arena-inset text-xs font-bold text-amber-700 dark:text-amber-300 border border-amber-500/20">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Sudden Death • Jonli Akademik Blitz</span>
            </div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Tezyurar Blitz V2 (Survival Marafon)
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              12 soniyalik shiddatli ilmiy sinov. Savollar to‘g‘ridan-to‘g‘ri M-EDU tasdiqlangan akademik bazasidan olinadi. Har bir to‘g‘ri javob +3s vaqt va kombo ko‘paytiruvchi beradi!
            </p>
          </div>

          <div className="p-4 rounded-2xl arena-inset text-center border border-black/[0.06] dark:border-white/10 shrink-0 min-w-[170px]">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Shaxsiy Rekord
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-500 flex items-center justify-center gap-1 mt-0.5">
              <Trophy className="w-5 h-5 text-amber-500" /> {highScore}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
              {allQuestions.length} ta Haqiqiy Savol
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          MAIN PLAYING ARENA CONTAINER
      ===================================================================== */}
      <div className="arena-glass rounded-3xl p-6 sm:p-8 border border-black/[0.06] dark:border-white/10 min-h-[460px] flex flex-col justify-between relative overflow-hidden shadow-lg">
        {isLoading && (
          <div className="max-w-md mx-auto my-auto text-center space-y-4 py-12">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              Akademik savollar bazasi yuklanmoqda...
            </p>
          </div>
        )}

        {/* PHASE 1: IDLE / START SCREEN */}
        {!isLoading && gameState === 'IDLE' && (
          <div className="max-w-md mx-auto my-auto text-center space-y-6 py-8">
            <div className="w-20 h-20 rounded-3xl bg-amber-500/15 border border-amber-500/30 text-amber-500 mx-auto flex items-center justify-center text-3xl shadow-lg">
              <Zap className="w-10 h-10 animate-pulse" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                Blitz Marafoniga Tayyormisiz?
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Platforma bazasida mavjud bo‘lgan <span className="font-bold text-amber-500">{allQuestions.length} ta</span> tasdiqlangan savollar bo‘yicha tezlik va bilimingizni sinab ko‘ring!
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-2xl arena-inset border border-black/[0.05] dark:border-white/10">
                <div className="text-base font-black text-slate-900 dark:text-white">12s</div>
                <div className="text-[10px] text-slate-400">Boshlang‘ich vaqt</div>
              </div>
              <div className="p-3 rounded-2xl arena-inset border border-black/[0.05] dark:border-white/10">
                <div className="text-base font-black text-emerald-500">+3s</div>
                <div className="text-[10px] text-slate-400">Bonus vaqt</div>
              </div>
              <div className="p-3 rounded-2xl arena-inset border border-black/[0.05] dark:border-white/10">
                <div className="text-base font-black text-purple-500">x3.0</div>
                <div className="text-[10px] text-slate-400">Maks kombo</div>
              </div>
            </div>

            <button
              onClick={startGame}
              disabled={allQuestions.length === 0}
              className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:brightness-110 text-black shadow-xl shadow-amber-500/25 active:scale-95 transition-all flex items-center justify-center gap-2.5 arena-sheen disabled:opacity-50"
            >
              <Play className="w-5 h-5 fill-black" />
              <span>Blitzni Boshlash ({allQuestions.length} ta savol)</span>
            </button>
          </div>
        )}

        {/* PHASE 2: ACTIVE PLAYING HUD */}
        {!isLoading && gameState === 'PLAYING' && currentQuestion && currentSubject && (
          <div className="space-y-6 max-w-2xl mx-auto w-full">
            {/* Top Telemetry */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">{currentSubject.icon}</span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {currentSubject.label}
                </span>
                <span className="text-xs text-slate-400">• Savol #{currentIdx + 1}</span>
              </div>

              {/* Combo Multiplier Pill */}
              <div
                className={`px-3 py-1 rounded-full text-xs font-black flex items-center gap-1.5 border ${
                  multiplier >= 3.0
                    ? 'bg-purple-500/15 border-purple-500/40 text-purple-600 dark:text-purple-300 animate-pulse'
                    : multiplier >= 2.0
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400'
                    : 'bg-blue-500/10 border-blue-500/25 text-blue-600 dark:text-cyan-400'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span>{multiplier.toFixed(1)}x Kombo ({streak} streak)</span>
              </div>

              {/* Live Score */}
              <div className="text-right">
                <span className="text-xs font-mono font-bold text-slate-400">Ball:</span>
                <span className="ml-1 text-lg font-black text-slate-900 dark:text-white font-mono">
                  {score}
                </span>
              </div>
            </div>

            {/* Countdown Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold font-mono">
                <span className="flex items-center gap-1 text-slate-500">
                  <Timer className="w-3.5 h-3.5" /> Vaqt:
                </span>
                <span
                  className={
                    timeLeft <= 3
                      ? 'text-rose-500 animate-ping font-black'
                      : timeLeft <= 5
                      ? 'text-amber-500 font-bold'
                      : 'text-emerald-500 font-bold'
                  }
                >
                  {timeLeft}s
                </span>
              </div>

              <div className="w-full h-2 rounded-full bg-black/[0.08] dark:bg-white/10 overflow-hidden">
                <motion.div
                  animate={{ width: `${(timeLeft / 15) * 100}%` }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className={`h-full rounded-full transition-colors ${
                    timeLeft <= 3 ? 'bg-rose-500' : timeLeft <= 5 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                />
              </div>
            </div>

            {/* Question Card */}
            <div className="p-6 rounded-2xl arena-inset border border-black/[0.06] dark:border-white/10 text-center space-y-3">
              <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white leading-relaxed">
                {currentQuestion.questionText}
              </p>
              {currentQuestion.codeSnippet && (
                <pre className="p-3 rounded-xl bg-slate-900 text-emerald-400 font-mono text-xs text-left overflow-x-auto border border-emerald-500/20">
                  <code>{currentQuestion.codeSnippet}</code>
                </pre>
              )}
            </div>

            {/* 4 Interactive Answer Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {currentQuestion.options.map((opt) => {
                const isSelected = selectedOptionKey === opt.optionKey;
                const isCorrect = opt.isCorrect;

                let btnClass =
                  'bg-white/70 dark:bg-white/[0.05] border-black/[0.08] dark:border-white/10 hover:border-amber-400';
                if (revealed) {
                  if (isCorrect) {
                    btnClass = 'bg-emerald-500 text-white border-emerald-500 font-bold shadow-md';
                  } else if (isSelected && !isCorrect) {
                    btnClass = 'bg-rose-500 text-white border-rose-500 font-bold shadow-md';
                  } else {
                    btnClass = 'opacity-35 border-transparent';
                  }
                }

                return (
                  <button
                    key={opt.optionKey}
                    type="button"
                    disabled={revealed}
                    onClick={() => handleSelectOption(opt)}
                    className={`p-4 rounded-2xl border text-left font-semibold text-sm transition-all flex items-center justify-between gap-3 ${btnClass}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-lg bg-black/10 dark:bg-white/10 flex items-center justify-center text-xs font-bold shrink-0">
                        {opt.optionKey}
                      </span>
                      <span>{opt.optionText}</span>
                    </div>
                    {revealed && isCorrect && <CheckCircle2 className="w-5 h-5 text-white shrink-0" />}
                    {revealed && isSelected && !isCorrect && (
                      <XCircle className="w-5 h-5 text-white shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Explanation reveal on answer */}
            {revealed && currentQuestion.explanation && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2"
              >
                <BookOpen className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span>{currentQuestion.explanation}</span>
              </motion.div>
            )}
          </div>
        )}

        {/* PHASE 3: GAME OVER PODIUM */}
        {!isLoading && gameState === 'GAMEOVER' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md mx-auto my-auto text-center space-y-6 py-6"
          >
            <div className="w-20 h-20 rounded-3xl bg-rose-500/15 border border-rose-500/30 text-rose-500 mx-auto flex items-center justify-center text-3xl shadow-lg">
              <ShieldAlert className="w-10 h-10" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                Blitz Yakunlandi!
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tezlik va chidamlilik sinovidagi ajoyib natija!
              </p>
            </div>

            {/* Score Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl arena-inset text-center border border-black/[0.05] dark:border-white/10">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  To‘plangan Ball
                </div>
                <div className="text-3xl font-black text-amber-500 mt-1">{score}</div>
              </div>
              <div className="p-4 rounded-2xl arena-inset text-center border border-black/[0.05] dark:border-white/10">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Maks Zanjir
                </div>
                <div className="text-3xl font-black text-purple-500 mt-1">{streak} ta</div>
              </div>
            </div>

            {score >= highScore && score > 0 && (
              <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Tabriklaymiz! Yangi Shaxsiy Rekord O‘rnatildi!</span>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={startGame}
                className="flex-1 py-3.5 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/25 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Qayta Urinib Ko‘rish</span>
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
