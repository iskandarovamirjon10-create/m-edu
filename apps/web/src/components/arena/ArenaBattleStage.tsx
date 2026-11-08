import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Swords,
  Timer,
  Zap,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Trophy,
  Flame,
  Award,
  Coins,
  RefreshCw,
  LogOut,
  Sparkles,
  Volume2,
  VolumeX,
  Vibrate,
  BookOpen,
  RotateCcw,
  HelpCircle,
  Copy,
  Check,
  Users,
  Compass,
  Lightbulb,
  Hourglass,
  Sliders,
  ChevronDown,
  ChevronUp,
  Wifi,
  WifiOff,
  X,
  GraduationCap,
  Brain,
  ArrowRight,
} from 'lucide-react';
import {
  useArenaBattleSocket,
} from '@/hooks/useArenaBattleSocket';
import { useAuth } from '@/auth/AuthContext';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useTelegram } from '@/hooks/useTelegram';
import '@/styles/arena-liquid.css';

interface ArenaBattleStageProps {
  myDuelProfile?: {
    studentId?: string;
    rating?: number;
    winStreak?: number;
    bestStreak?: number;
    activeAvatar?: {
      thumbnailUrl?: string;
      battleRenderUrl?: string;
      victoryRenderUrl?: string;
    } | null;
    activeTitle?: {
      name?: string;
      icon?: string;
    } | null;
  } | null;
  onClose?: () => void;
  onOpenMistakes?: () => void;
  onOpenAiCoach?: () => void;
  onOpenTeacherChallenge?: () => void;
}

const QUICK_EMOTES = ['🔥', '⚡', '🧠', '🤯', '🛡️', '😎', '🎯', '🚀'];

const SUBJECTS = [
  { id: 'MATHEMATICS', label: 'Matematika', icon: '🧮', desc: 'Hisob-kitob, tenglamalar & geometriya' },
  { id: 'PHYSICS', label: 'Fizika', icon: '⚛️', desc: 'Mexanika, optika, kvant qonuniyatlari' },
  { id: 'PROGRAMMING', label: 'Dasturlash', icon: '💻', desc: 'Algoritmlar, ma’lumotlar tuzilmasi, JS/Python' },
  { id: 'HISTORY', label: 'Tarix', icon: '📜', desc: 'Jahon va O‘zbekiston xronologiyasi' },
  { id: 'ENGLISH', label: 'Ingliz tili', icon: '🇬🇧', desc: 'Grammatika, CEFR B2/C1 lug‘at boyligi' },
  { id: 'LOGIC_PUZZLE', label: 'Mantiq', icon: '🧩', desc: 'Mantiqiy zanjirlar, deduktsiya & IQ' },
];

const DIFFICULTIES = [
  {
    id: 'EASY',
    label: 'Oson',
    time: '12 soniya',
    seconds: 12,
    mult: 'x1.0 ELO',
    color: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-500/40',
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
  },
  {
    id: 'MEDIUM',
    label: 'O‘rta',
    time: '15 soniya',
    seconds: 15,
    mult: 'x1.25 ELO',
    color: 'text-blue-600 dark:text-cyan-400',
    border: 'border-blue-500/40 dark:border-cyan-500/40',
    bg: 'bg-blue-50 dark:bg-cyan-500/10',
  },
  {
    id: 'HARD',
    label: 'Qiyin',
    time: '25 soniya',
    seconds: 25,
    mult: 'x1.5 ELO',
    color: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-500/40',
    bg: 'bg-rose-50 dark:bg-rose-500/10',
  },
];

const SUBTOPICS_MAP: Record<string, string[]> = {
  MATHEMATICS: ['Barchasi', 'Algebra & Tenglamalar', 'Geometriya', 'Arifmetika'],
  PHYSICS: ['Barchasi', 'Dinamika & Nyuton', 'Optika & To‘lqinlar', 'Elektr & Zaryad'],
  PROGRAMMING: ['Barchasi', 'Algoritmlar (Big-O)', 'Python Asoslari', 'Web & JavaScript'],
  HISTORY: ['Barchasi', 'O‘zbekiston Tarixi', 'Jahon Sivilizatsiyalari'],
  ENGLISH: ['Barchasi', 'Grammar & Tenses', 'CEFR B2-C1 Vocabulary', 'Idioms'],
  LOGIC_PUZZLE: ['Barchasi', 'Sonli Ketma-ketliklar', 'Fazoviy Mantiq', 'Deduksiya'],
};

export const ArenaBattleStage: React.FC<ArenaBattleStageProps> = ({
  myDuelProfile,
  onClose,
  onOpenMistakes,
  onOpenAiCoach,
  onOpenTeacherChallenge,
}) => {
  const { user } = useAuth();
  const { play, isMuted, toggleMuted, hapticsEnabled, toggleHaptics } = usePremiumSound();
  const { haptic } = useTelegram();

  const {
    isConnected,
    matchmakingStatus,
    searchSeconds,
    currentMatch,
    currentRound,
    roundTimeLeft,
    selectedOptionKey,
    hasAnswered,
    opponentHasAnswered,
    roundResult,
    duelFinishResult,
    latestReaction,
    rematchRequestedBy,
    isRematchWaiting,
    disabledOptionKeys,
    activeHint,
    powerUpsUsed,
    roundsHistory,
    customRoomCode,
    joinQueue,
    leaveQueue,
    submitAnswer,
    sendReaction,
    requestRematch,
    acceptRematch,
    usePowerUp,
    createCustomRoom,
    joinCustomRoom,
    surrenderDuel,
    resetBattle,
  } = useArenaBattleSocket();

  const [selectedSubject, setSelectedSubject] = useState<string>('MATHEMATICS');
  const [selectedSubTopic, setSelectedSubTopic] = useState<string>('Barchasi');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('MEDIUM');
  const [lobbyMode, setLobbyMode] = useState<'MATCHMAKING' | 'CUSTOM_ROOM' | 'TEACHER_PIN'>('MATCHMAKING');
  const [inputRoomCode, setInputRoomCode] = useState<string>('');
  const [inputPinCode, setInputPinCode] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [isReviewOpen, setIsReviewOpen] = useState<boolean>(false);
  const [confirmSurrender, setConfirmSurrender] = useState<boolean>(false);
  const [showShortcutsTip, setShowShortcutsTip] = useState<boolean>(false);

  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Canonical current student identifier (fixes user.id vs studentId mismatch)
  const myCanonicalId = useMemo(() => {
    return (
      myDuelProfile?.studentId ||
      (user as { studentId?: string; id?: string } | null)?.studentId ||
      user?.id ||
      ''
    );
  }, [myDuelProfile?.studentId, user]);

  // Safe player & opponent resolution
  const { myPlayer, opponentPlayer } = useMemo(() => {
    const players = currentMatch?.players || [];
    if (players.length === 0) {
      return { myPlayer: undefined, opponentPlayer: undefined };
    }

    const foundMe =
      players.find(
        (p) =>
          p.studentId === myCanonicalId ||
          p.studentId === user?.id
      ) || players[0];

    const foundOpponent =
      players.find((p) => p.studentId !== foundMe?.studentId) || players[1];

    return {
      myPlayer: foundMe,
      opponentPlayer: foundOpponent,
    };
  }, [currentMatch?.players, myCanonicalId, user?.id]);

  const effectiveMyId = myPlayer?.studentId || myCanonicalId;

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  // Auto-reset surrender confirmation after 4 seconds
  useEffect(() => {
    if (!confirmSurrender) return;
    const timer = setTimeout(() => setConfirmSurrender(false), 4000);
    return () => clearTimeout(timer);
  }, [confirmSurrender]);

  // Audio effects triggered by round start
  const prevRoundRef = useRef<number>(0);
  useEffect(() => {
    if (currentRound && currentRound.roundNumber !== prevRoundRef.current) {
      prevRoundRef.current = currentRound.roundNumber;
      setConfirmSurrender(false);
      play('whoosh');
      haptic('impactMedium');
    }
  }, [currentRound, play, haptic]);

  // Low-time countdown tick sound (4 seconds or less)
  useEffect(() => {
    if (
      currentMatch &&
      !duelFinishResult &&
      !roundResult &&
      !hasAnswered &&
      roundTimeLeft > 0 &&
      roundTimeLeft <= 4
    ) {
      play('tick');
      haptic('selection');
    }
  }, [roundTimeLeft, currentMatch, duelFinishResult, roundResult, hasAnswered, play, haptic]);

  // Audio effects when round result is resolved
  useEffect(() => {
    if (roundResult) {
      const myAns = roundResult.answers.find(
        (a) => a.studentId === effectiveMyId || a.studentId === user?.id
      );
      if (myAns?.isCorrect) {
        play('success');
        haptic('impactLight');
      } else {
        play('error');
        haptic('notificationError');
      }
    }
  }, [roundResult, effectiveMyId, user?.id, play, haptic]);

  // Audio effects when match finishes
  useEffect(() => {
    if (duelFinishResult) {
      const won =
        duelFinishResult.winnerId === effectiveMyId ||
        duelFinishResult.winnerId === user?.id;
      if (won) {
        play('victory');
        haptic('celebration');
      } else {
        play('defeat');
        haptic('notificationWarning');
      }
    }
  }, [duelFinishResult, effectiveMyId, user?.id, play, haptic]);

  // Sound & haptic for incoming opponent reaction
  useEffect(() => {
    if (
      latestReaction &&
      latestReaction.studentId !== effectiveMyId &&
      latestReaction.studentId !== user?.id
    ) {
      play('pop');
      haptic('selection');
    }
  }, [latestReaction, effectiveMyId, user?.id, play, haptic]);

  // Auto-record failed questions into the Mistake Vault
  useEffect(() => {
    if (duelFinishResult && roundsHistory.length > 0) {
      try {
        const existingStr = localStorage.getItem('m-edu.arena-mistakes-vault');
        const existing = existingStr ? JSON.parse(existingStr) : [];
        const newMistakes: any[] = [];

        roundsHistory.forEach((r) => {
          const myAns = r.answers.find(
            (a: any) => a.studentId === effectiveMyId || a.studentId === user?.id
          );
          if (myAns && !myAns.isCorrect) {
            const alreadyExists = existing.some((item: any) => item.questionId === r.questionId);
            if (!alreadyExists) {
              newMistakes.push({
                id: `vm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                questionId: r.questionId,
                subjectCategory: selectedSubject,
                subjectName: SUBJECTS.find((s) => s.id === selectedSubject)?.label || 'Fan',
                difficulty: selectedDifficulty,
                questionText: r.questionText,
                options: r.options || [],
                chosenOptionKey: myAns.chosenOptionKey,
                correctOptionKey: r.correctOptionKey,
                explanation: r.explanation || 'Pedagogik tahlil: Savol yechimini ko‘rib chiqing.',
                failedAt: new Date().toISOString(),
                practiceCount: 0,
                mastered: false,
              });
            }
          }
        });

        if (newMistakes.length > 0) {
          localStorage.setItem(
            'm-edu.arena-mistakes-vault',
            JSON.stringify([...newMistakes, ...existing])
          );
        }
      } catch {
        // Storage safe
      }
    }
  }, [duelFinishResult, roundsHistory, effectiveMyId, user?.id, selectedSubject, selectedDifficulty]);

  // Handlers
  const handleSelectOption = useCallback(
    (key: string) => {
      if (hasAnswered || Boolean(roundResult) || disabledOptionKeys.includes(key)) return;
      play('switch');
      haptic('selection');
      submitAnswer(key);
    },
    [hasAnswered, roundResult, disabledOptionKeys, play, haptic, submitAnswer]
  );

  const handleUsePowerUp = useCallback(
    (type: 'FIFTY_FIFTY' | 'ADD_TIME' | 'HINT') => {
      if (hasAnswered || Boolean(roundResult)) return;
      if (type === 'FIFTY_FIFTY' && powerUpsUsed.fiftyFifty) return;
      if (type === 'ADD_TIME' && powerUpsUsed.addTime) return;
      if (type === 'HINT' && powerUpsUsed.hint) return;

      play('zap');
      haptic('impactMedium');
      usePowerUp(type);
    },
    [hasAnswered, roundResult, powerUpsUsed, play, haptic, usePowerUp]
  );

  const handleSendReaction = (emoji: string) => {
    play('pop');
    haptic('selection');
    sendReaction(emoji);
  };

  // Keyboard shortcuts during active battle (1-4 / A-D for options, Q/W/E for Power-ups)
  useEffect(() => {
    if (!currentMatch || duelFinishResult || !currentRound) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      const key = e.key.toUpperCase();
      const options = currentRound.question?.options || [];

      if (key === '1' || key === 'A') {
        const opt = options[0];
        if (opt) handleSelectOption(opt.optionKey);
      } else if (key === '2' || key === 'B') {
        const opt = options[1];
        if (opt) handleSelectOption(opt.optionKey);
      } else if (key === '3' || key === 'C') {
        const opt = options[2];
        if (opt) handleSelectOption(opt.optionKey);
      } else if (key === '4' || key === 'D') {
        const opt = options[3];
        if (opt) handleSelectOption(opt.optionKey);
      } else if (key === 'Q') {
        handleUsePowerUp('FIFTY_FIFTY');
      } else if (key === 'W') {
        handleUsePowerUp('ADD_TIME');
      } else if (key === 'E') {
        handleUsePowerUp('HINT');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentMatch, duelFinishResult, currentRound, handleSelectOption, handleUsePowerUp]);

  // Derived battle scores & states
  const myRoundAnswer = roundResult?.answers.find(
    (a) => a.studentId === effectiveMyId || a.studentId === user?.id
  );
  const oppRoundAnswer = roundResult?.answers.find(
    (a) => a.studentId === opponentPlayer?.studentId
  );

  const myTotalScore =
    currentRound?.scores?.[effectiveMyId] ??
    currentRound?.scores?.[user?.id || ''] ??
    0;
  const oppTotalScore =
    currentRound?.scores?.[opponentPlayer?.studentId || ''] ?? 0;

  const totalCombinedScore = myTotalScore + oppTotalScore;
  const myMomentumPercent =
    totalCombinedScore === 0
      ? 50
      : Math.min(92, Math.max(8, Math.round((myTotalScore / totalCombinedScore) * 100)));

  const isWinner =
    Boolean(duelFinishResult?.winnerId) &&
    (duelFinishResult?.winnerId === effectiveMyId ||
      duelFinishResult?.winnerId === user?.id);
  const isDraw = Boolean(duelFinishResult?.isDraw);

  const myFinal =
    duelFinishResult?.players?.find(
      (p: any) => p.studentId === effectiveMyId || p.studentId === user?.id
    ) ||
    duelFinishResult?.results?.find(
      (p: any) => p.studentId === effectiveMyId || p.studentId === user?.id
    ) ||
    duelFinishResult?.results?.[0];

  const oppFinal =
    duelFinishResult?.players?.find(
      (p: any) => p.studentId !== myFinal?.studentId
    ) ||
    duelFinishResult?.results?.find(
      (p: any) => p.studentId !== myFinal?.studentId
    );

  // Max round time for SVG circular timer calculation
  const maxRoundSeconds = useMemo(() => {
    const diffObj = DIFFICULTIES.find((d) => d.id === selectedDifficulty);
    return Math.max(roundTimeLeft, diffObj?.seconds || 15);
  }, [selectedDifficulty, roundTimeLeft]);

  const timerProgress = Math.min(1, Math.max(0, roundTimeLeft / maxRoundSeconds));
  const circleCircumference = 2 * Math.PI * 24; // r = 24

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      play('pop');
      haptic('selection');
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      setCopiedCode(false);
    }
  };

  return (
    <div className="relative min-h-[640px] arena-glass rounded-3xl border border-black/[0.08] dark:border-white/10 p-4 sm:p-6 md:p-8 overflow-hidden shadow-lg dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] flex flex-col justify-between select-none">
      {/* Background ambient light orbs */}
      <div className="arena-orb arena-orb-1 top-0 left-1/4 w-96 h-96 bg-blue-500/10 dark:bg-cyan-500/15 pointer-events-none" />
      <div className="arena-orb arena-orb-2 bottom-0 right-1/4 w-96 h-96 bg-indigo-500/10 dark:bg-purple-500/15 pointer-events-none" />
      <div className="arena-orb arena-orb-3 top-1/2 right-10 w-72 h-72 bg-rose-500/10 pointer-events-none" />

      {/* ========================================================================= */}
      {/* TOP BAR: CONNECTION TELEMETRY + AUDIO/HAPTICS + SHORTCUTS ISLAND          */}
      {/* ========================================================================= */}
      <div className="relative z-30 flex items-center justify-between gap-2 mb-2">
        {/* Live Socket Telemetry Indicator */}
        <div
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-[11px] font-bold border arena-dock ${
            isConnected
              ? 'border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : 'border-amber-500/40 text-amber-700 dark:text-amber-300 animate-pulse'
          }`}
        >
          {isConnected ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-emerald-500" />
              <span>ARENA SERVER: ONLINE</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-amber-500" />
              <span>SERVERGA ULANMOQDA...</span>
            </>
          )}
        </div>

        {/* Right Controls Island */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl arena-dock border border-black/[0.06] dark:border-white/10">
          <button
            onClick={() => {
              play('tick');
              setShowShortcutsTip((prev) => !prev);
            }}
            className={`p-2 rounded-xl text-xs transition-all hidden sm:flex items-center gap-1 ${
              showShortcutsTip
                ? 'bg-blue-500/15 text-blue-600 dark:text-cyan-300'
                : 'text-slate-400 hover:text-slate-700 dark:hover:text-white'
            }`}
            title="Klaviatura tezkor tugmalari"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              play('tick');
              toggleMuted();
            }}
            className={`p-2 rounded-xl text-xs transition-all flex items-center gap-1 ${
              !isMuted
                ? 'text-blue-600 dark:text-cyan-300 hover:text-blue-700 dark:hover:text-white'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
            title={isMuted ? 'Ovozni yoqish' : 'Ovozni o‘chirish'}
          >
            {!isMuted ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            onClick={() => {
              haptic('selection');
              toggleHaptics();
            }}
            className={`p-2 rounded-xl text-xs transition-all flex items-center gap-1 ${
              hapticsEnabled
                ? 'text-purple-600 dark:text-purple-300 hover:text-purple-700 dark:hover:text-white'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
            title={hapticsEnabled ? 'Haptik tebranish yoqilgan' : 'Haptik tebranish o‘chirilgan'}
          >
            <Vibrate className="w-4 h-4" />
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-xs text-slate-400 hover:text-rose-500 transition-colors"
              title="Arenani yopish"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Keyboard Shortcuts Popover Banner */}
      <AnimatePresence>
        {showShortcutsTip && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="relative z-30 mb-4 p-3 rounded-2xl arena-inset border border-blue-500/30 text-xs flex flex-wrap items-center justify-between gap-2 text-slate-700 dark:text-slate-300"
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-bold text-blue-600 dark:text-cyan-400 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" /> Pro Klaviatura Boshqaruvi:
              </span>
              <span>
                Javob tanlash: <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono font-bold">1-4</kbd> yoki{' '}
                <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono font-bold">A-D</kbd>
              </span>
              <span>•</span>
              <span>
                50/50: <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono font-bold">Q</kbd>
              </span>
              <span>
                +5s Vaqt: <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono font-bold">W</kbd>
              </span>
              <span>
                Maslahat: <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono font-bold">E</kbd>
              </span>
            </div>
            <button
              onClick={() => setShowShortcutsTip(false)}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-white font-bold"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* PHASE 1: IDLE / MATCHMAKING LOBBY                                         */}
      {/* ========================================================================= */}
      {matchmakingStatus === 'IDLE' && !currentMatch && !duelFinishResult && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto my-auto w-full text-center space-y-6 py-4 sm:py-6 relative z-10"
        >
          {/* Header Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full arena-inset border border-blue-500/30 dark:border-cyan-500/30 text-blue-700 dark:text-cyan-300 text-xs font-bold uppercase tracking-wider shadow-sm">
            <span className="w-2 h-2 rounded-full bg-blue-500 dark:bg-cyan-400 animate-pulse" />
            <span>Mind Arena • Jonli 1v1 Intellektual Duel</span>
          </div>

          <div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              Aql Duellari Arenasi
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-lg mx-auto leading-relaxed">
              Fan yo‘nalishini tanlang, tasodifiy raqib yoki do‘stingiz bilan maxsus xona kodi orqali 5 raundlik tezkor jangga kiring!
            </p>
          </div>

          {/* Lobby Mode Toggle: Quick Match vs Private Room vs Teacher PIN */}
          <div className="inline-flex flex-wrap items-center justify-center p-1 rounded-2xl arena-dock border border-black/[0.06] dark:border-white/10 gap-1">
            <button
              onClick={() => {
                play('tick');
                haptic('selection');
                setLobbyMode('MATCHMAKING');
              }}
              className={`relative px-4 sm:px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                lobbyMode === 'MATCHMAKING'
                  ? 'bg-blue-600 dark:bg-gradient-to-r dark:from-cyan-500 dark:to-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Swords className="w-3.5 h-3.5" />
              <span>Tasodifiy Raqib (Matchmaking)</span>
            </button>
            <button
              onClick={() => {
                play('tick');
                haptic('selection');
                setLobbyMode('CUSTOM_ROOM');
              }}
              className={`relative px-4 sm:px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                lobbyMode === 'CUSTOM_ROOM'
                  ? 'bg-purple-600 dark:bg-gradient-to-r dark:from-purple-500 dark:to-pink-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Do‘st bilan Jang (Room Code)</span>
            </button>
            <button
              onClick={() => {
                play('tick');
                haptic('selection');
                setLobbyMode('TEACHER_PIN');
              }}
              className={`relative px-4 sm:px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                lobbyMode === 'TEACHER_PIN'
                  ? 'bg-amber-600 dark:bg-gradient-to-r dark:from-amber-500 dark:to-orange-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Vazifa PIN Kodi</span>
            </button>
          </div>

          {/* Subject Selector */}
          <div className="arena-inset rounded-2xl p-4 sm:p-5 text-left space-y-3 border border-black/[0.06] dark:border-white/10">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <span>📚</span> Fan Yo‘nalishi
              </label>
              <span className="text-[11px] font-mono text-blue-600 dark:text-cyan-400 font-bold">
                {SUBJECTS.find((s) => s.id === selectedSubject)?.label}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {SUBJECTS.map((s) => {
                const isSelected = selectedSubject === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      play('tick');
                      haptic('selection');
                      setSelectedSubject(s.id);
                    }}
                    className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden ${
                      isSelected
                        ? 'bg-blue-50/90 dark:bg-cyan-500/20 border-blue-500/70 dark:border-cyan-500/60 shadow-md shadow-blue-500/10 text-blue-900 dark:text-white'
                        : 'bg-white/80 dark:bg-white/[0.04] border-black/[0.08] dark:border-white/5 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.08] shadow-sm'
                    }`}
                  >
                    <div className="text-xl mb-1">{s.icon}</div>
                    <div className="text-xs font-bold truncate text-slate-900 dark:text-white">
                      {s.label}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                      {s.desc}
                    </div>
                    {isSelected && (
                      <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-blue-600 dark:bg-cyan-400 shadow-sm" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Sub-topics Specific Focus */}
            <div className="pt-3 border-t border-black/[0.06] dark:border-white/10 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
                Yo‘nalish:
              </span>
              {(SUBTOPICS_MAP[selectedSubject] || ['Barchasi']).map((topic) => {
                const isTopicSelected = selectedSubTopic === topic;
                return (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => {
                      play('tick');
                      haptic('selection');
                      setSelectedSubTopic(topic);
                    }}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                      isTopicSelected
                        ? 'border-blue-500 bg-blue-500/10 text-blue-700 dark:text-cyan-300 font-bold shadow-xs'
                        : 'border-black/[0.06] dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                    }`}
                  >
                    {topic}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Difficulty Selector */}
          <div className="arena-inset rounded-2xl p-4 sm:p-5 text-left space-y-3 border border-black/[0.06] dark:border-white/10">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Timer className="w-3.5 h-3.5 text-amber-500" /> Qiyinchilik va Raund Vaqti
              </label>
              <span className="text-[11px] font-mono text-amber-600 dark:text-amber-400 font-bold">
                {DIFFICULTIES.find((d) => d.id === selectedDifficulty)?.mult}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {DIFFICULTIES.map((d) => {
                const isSelected = selectedDifficulty === d.id;
                return (
                  <button
                    key={d.id}
                    onClick={() => {
                      play('tick');
                      haptic('selection');
                      setSelectedDifficulty(d.id);
                    }}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      isSelected
                        ? `${d.bg} ${d.border} text-slate-900 dark:text-white shadow-sm font-bold`
                        : 'bg-white/80 dark:bg-white/[0.04] border-black/[0.08] dark:border-white/5 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.08] shadow-sm'
                    }`}
                  >
                    <div className={`text-xs font-black ${d.color}`}>{d.label}</div>
                    <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300 mt-0.5">
                      {d.time}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold mt-1">
                      {d.mult}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* MODE A: Matchmaking Button */}
          {lobbyMode === 'MATCHMAKING' && (
            <button
              onClick={() => {
                play('pop');
                haptic('heavy');
                joinQueue(selectedSubject, selectedDifficulty, 'SOLO_1V1');
              }}
              disabled={!isConnected}
              className="w-full py-4 rounded-2xl font-black text-sm sm:text-base uppercase tracking-wider bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-xl shadow-blue-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-3 arena-sheen disabled:opacity-50"
            >
              <Swords className="w-5 h-5 animate-pulse" />
              <span>Jangga Kirish (Raqib Qidirish)</span>
            </button>
          )}

          {/* MODE B: Private Room Creation & Joining */}
          {lobbyMode === 'CUSTOM_ROOM' && (
            <div className="space-y-4">
              {customRoomCode ? (
                /* Created Room Code Display with Cancel Option */
                <div className="p-6 rounded-2xl arena-inset border border-purple-500/40 text-center space-y-4 shadow-md">
                  <div className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                    Maxsus Jang Xonasi Yaratildi! 🎯
                  </div>
                  <div className="text-3xl sm:text-4xl font-black font-mono tracking-widest text-slate-900 dark:text-white py-2 select-all">
                    {customRoomCode}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 max-w-sm mx-auto">
                    Ushbu kodni do‘stingizga yuboring. U kodni kiritishi bilan duel avtomatik boshlanadi!
                  </p>

                  <div className="flex flex-wrap items-center justify-center gap-2.5">
                    <button
                      onClick={() => handleCopyCode(customRoomCode)}
                      className="px-5 py-2.5 rounded-xl font-bold text-xs arena-glass text-blue-600 dark:text-cyan-300 border border-blue-500/30 dark:border-cyan-500/40 flex items-center gap-1.5 active:scale-95 transition-all shadow-sm"
                    >
                      {copiedCode ? (
                        <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                      <span>{copiedCode ? 'Nusxalandi!' : 'Kodni Nusxalash'}</span>
                    </button>

                    <button
                      onClick={() => {
                        play('tick');
                        leaveQueue();
                        resetBattle();
                      }}
                      className="px-4 py-2.5 rounded-xl font-bold text-xs arena-inset text-rose-600 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-500/10 transition-all"
                    >
                      Xonani Yopish
                    </button>
                  </div>

                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2 animate-pulse pt-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-500" />
                    <span>Do‘stingiz ulanishi kutilmoqda...</span>
                  </div>
                </div>
              ) : (
                /* Create or Join Controls */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Create Room Button */}
                  <div className="p-5 rounded-2xl arena-inset border border-black/[0.06] dark:border-white/10 flex flex-col justify-between text-left space-y-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-500" /> Yangi Xona Yaratish
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        Tanlangan fan va daraja bo‘yicha maxsus kod olasiz va do‘stingizni taklif qilasiz.
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        play('pop');
                        await createCustomRoom(selectedSubject, selectedDifficulty);
                      }}
                      disabled={!isConnected}
                      className="w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider bg-purple-600 hover:bg-purple-500 text-white shadow-md transition-all active:scale-95 disabled:opacity-50"
                    >
                      Xona Kodini Olish 🔑
                    </button>
                  </div>

                  {/* Join Room by Code */}
                  <div className="p-5 rounded-2xl arena-inset border border-black/[0.06] dark:border-white/10 flex flex-col justify-between text-left space-y-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Users className="w-4 h-4 text-blue-600 dark:text-cyan-400" /> Do‘stning Xonasiga Kirish
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        Do‘stingiz bergan xona kodini kiriting (masalan: ARENA-4819).
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="ARENA-XXXX"
                        value={inputRoomCode}
                        onChange={(e) => setInputRoomCode(e.target.value.toUpperCase())}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && inputRoomCode.trim()) {
                            play('pop');
                            joinCustomRoom(inputRoomCode.trim());
                          }
                        }}
                        className="flex-1 min-w-0 px-3 py-2 bg-white dark:bg-black/50 border border-slate-300 dark:border-white/10 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500"
                      />
                      <button
                        onClick={async () => {
                          if (inputRoomCode.trim()) {
                            play('pop');
                            await joinCustomRoom(inputRoomCode.trim());
                          }
                        }}
                        disabled={!inputRoomCode.trim() || !isConnected}
                        className="px-4 py-2 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 transition-all active:scale-95 shadow-sm shrink-0"
                      >
                        Kirish
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MODE C: Teacher Task PIN Entry & Challenge Launcher */}
          {lobbyMode === 'TEACHER_PIN' && (
            <div className="space-y-4">
              <div className="p-6 rounded-2xl arena-inset border border-amber-500/40 text-center space-y-4 shadow-md max-w-xl mx-auto">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold uppercase tracking-wider">
                  <GraduationCap className="w-3.5 h-3.5 text-amber-500" />
                  <span>O‘qituvchi Vazifasi (PIN)</span>
                </div>

                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  Sinf / Guruh Duel Vazifasiga Ulanish
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
                  O‘qituvchingiz bergan 6 xonali topshiriq PIN kodini kiriting (masalan: TASK-7842). Natijangiz to‘g‘ridan-to‘g‘ri elektron jurnalga qayd etiladi.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <input
                    type="text"
                    placeholder="TASK-XXXX"
                    value={inputPinCode}
                    onChange={(e) => setInputPinCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && inputPinCode.trim()) {
                        play('pop');
                        joinCustomRoom(inputPinCode.trim());
                      }
                    }}
                    className="w-full sm:w-64 px-4 py-3 bg-white dark:bg-black/50 border border-amber-500/50 rounded-2xl text-center text-sm font-mono font-black text-slate-900 dark:text-white tracking-widest outline-none focus:ring-2 focus:ring-amber-500 shadow-inner"
                  />
                  <button
                    onClick={() => {
                      if (inputPinCode.trim()) {
                        play('pop');
                        joinCustomRoom(inputPinCode.trim());
                      }
                    }}
                    disabled={!inputPinCode.trim() || !isConnected}
                    className="w-full sm:w-auto px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wider bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/25 active:scale-95 transition-all disabled:opacity-40"
                  >
                    Vazifani Boshlash 🚀
                  </button>
                </div>

                {onOpenTeacherChallenge && (
                  <div className="pt-3 border-t border-black/[0.06] dark:border-white/10 flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">
                      Siz o‘qituvchimisiz?
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        play('pop');
                        onOpenTeacherChallenge();
                      }}
                      className="text-amber-600 dark:text-amber-400 font-bold hover:underline inline-flex items-center gap-1"
                    >
                      <span>Yangi Vazifa / PIN Yaratish</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* PHASE 2: RADAR SEARCHING ANIMATION                                        */}
      {/* ========================================================================= */}
      {matchmakingStatus === 'SEARCHING' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md mx-auto my-auto text-center space-y-6 py-12 relative z-10"
        >
          {/* Radar Scanner Animation */}
          <div className="relative w-48 h-48 mx-auto flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border border-blue-500/20 dark:border-cyan-500/20 animate-ping" style={{ animationDuration: '3s' }} />
            <div className="absolute inset-0 rounded-full border border-blue-500/25 dark:border-cyan-500/25" />
            <div className="absolute inset-8 rounded-full border border-blue-500/35 dark:border-cyan-500/35" />
            <div className="absolute inset-16 rounded-full border border-blue-500/45 dark:border-cyan-500/45" />

            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2.2, ease: 'linear' }}
              className="absolute inset-0 rounded-full bg-gradient-to-tr from-blue-500/25 via-transparent to-transparent pointer-events-none"
            />

            <div className="relative z-10 w-20 h-20 rounded-2xl arena-glass border border-blue-500/50 p-1.5 flex items-center justify-center shadow-lg">
              <img
                src={
                  myDuelProfile?.activeAvatar?.thumbnailUrl ||
                  '/avatars/arena/cyber-scholar/default.png'
                }
                alt="My Avatar"
                className="w-full h-full object-contain"
              />
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-500 dark:text-cyan-400 animate-spin" />
              <span>Raqib Qidirilmoqda...</span>
            </h3>
            <p className="text-xs font-mono text-blue-600 dark:text-cyan-300 font-bold">
              Qidiruv vaqti: {searchSeconds}s • ELO: {myDuelProfile?.rating || 1000} ±{' '}
              {Math.min(300, 100 + searchSeconds * 20)}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
              8 soniyadan so‘ng mos darajadagi Kiber-AI Jangchi bilan avtomatik duel boshlanadi
            </p>
          </div>

          <button
            onClick={() => {
              play('tick');
              haptic('light');
              leaveQueue();
            }}
            className="px-6 py-2.5 rounded-xl border border-rose-500/30 arena-inset text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 text-xs font-bold transition-all shadow-sm active:scale-95"
          >
            Qidiruvni Bekor Qilish
          </button>
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* PHASE 3: LIVE ACTIVE BATTLE ARENA                                         */}
      {/* ========================================================================= */}
      {currentMatch && !duelFinishResult && (
        <div className="w-full max-w-5xl mx-auto space-y-4 sm:space-y-5 relative z-10">
          {/* Top Split Arena HUD: Player vs Opponent */}
          <div className="arena-glass rounded-3xl p-3.5 sm:p-5 border border-black/[0.08] dark:border-white/10 relative overflow-hidden shadow-sm dark:shadow-xl space-y-3">
            <div className="grid grid-cols-12 items-center gap-2 sm:gap-4">
              {/* Player 1 (ME) */}
              <div className="col-span-5 flex items-center gap-2.5 sm:gap-3.5">
                <div
                  className={`relative w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-2xl arena-inset p-1 shrink-0 ${
                    (myDuelProfile?.winStreak || 0) >= 3
                      ? 'border-2 border-amber-400 shadow-md shadow-amber-500/20'
                      : 'border border-blue-500/40 dark:border-cyan-500/40 shadow-sm'
                  }`}
                >
                  <img
                    src={myPlayer?.avatarUrl || '/avatars/arena/cyber-scholar/battle.png'}
                    alt={myPlayer?.name || 'Siz'}
                    className="w-full h-full object-contain"
                  />
                  {hasAnswered && (
                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-black shadow-lg">
                      ✓
                    </div>
                  )}
                  {(myDuelProfile?.winStreak || 0) >= 3 && (
                    <span className="absolute -bottom-1 -left-1 px-1.5 py-0.5 rounded-md bg-amber-500 text-black text-[9px] font-black shadow-sm flex items-center gap-0.5">
                      <Flame className="w-2.5 h-2.5 fill-black" />
                      {myDuelProfile?.winStreak}x
                    </span>
                  )}

                  {/* My Floating Reaction Bubble */}
                  <AnimatePresence>
                    {latestReaction &&
                      (latestReaction.studentId === effectiveMyId ||
                        latestReaction.studentId === user?.id) && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.5, y: 10 }}
                          animate={{ opacity: 1, scale: 1.25, y: -24 }}
                          exit={{ opacity: 0, scale: 0.5, y: -35 }}
                          className="absolute -top-4 -right-5 z-20 text-2xl sm:text-3xl filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.25)]"
                        >
                          {latestReaction.emoji}
                        </motion.div>
                      )}
                  </AnimatePresence>
                </div>

                <div className="overflow-hidden min-w-0">
                  <span className="hidden sm:inline-block text-[10px] font-bold text-blue-700 dark:text-cyan-300 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20 truncate max-w-full">
                    {myPlayer?.titleIcon || '🎖️'} {myPlayer?.titleName || 'Aql Jangchisi'}
                  </span>
                  <h4 className="text-xs sm:text-base font-black text-slate-900 dark:text-white truncate mt-0.5">
                    {myPlayer?.name || 'Siz'}
                  </h4>
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-0.5">
                    <span className="text-[11px] font-mono font-bold text-amber-500 dark:text-amber-400">
                      ⚡ {myPlayer?.rating ?? myDuelProfile?.rating ?? 1000}
                    </span>
                    <span className="text-xs font-black text-blue-600 dark:text-cyan-300">
                      {myTotalScore} Ball
                    </span>
                  </div>
                </div>
              </div>

              {/* Center VS & SVG Circular Countdown Ring */}
              <div className="col-span-2 text-center flex flex-col items-center justify-center">
                <div className="text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">
                  Raund {currentRound?.roundNumber || 1}/{currentMatch.totalRounds || 5}
                </div>

                <div className="relative w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 56 56">
                    <circle
                      cx="28"
                      cy="28"
                      r="24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="4"
                      className="text-slate-200 dark:text-white/10"
                    />
                    <circle
                      cx="28"
                      cy="28"
                      r="24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray={circleCircumference}
                      strokeDashoffset={circleCircumference * (1 - timerProgress)}
                      className={`transition-all duration-300 ${
                        roundTimeLeft <= 4
                          ? 'text-rose-500'
                          : roundTimeLeft <= 8
                          ? 'text-amber-500'
                          : 'text-blue-600 dark:text-cyan-400'
                      }`}
                    />
                  </svg>
                  <span
                    className={`absolute font-black text-base sm:text-xl ${
                      roundTimeLeft <= 4
                        ? 'text-rose-600 dark:text-rose-400 animate-pulse'
                        : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    {roundTimeLeft}
                  </span>
                </div>

                {/* 5-Round Mini Progress Dots */}
                <div className="flex items-center gap-1 mt-1.5">
                  {Array.from({ length: currentMatch.totalRounds || 5 }).map((_, i) => {
                    const rNum = i + 1;
                    const pastRound = roundsHistory.find((rh: any) => rh.roundNumber === rNum);
                    const pastMyAns = pastRound?.answers?.find(
                      (a: any) => a.studentId === effectiveMyId || a.studentId === user?.id
                    );
                    const isCurrent = (currentRound?.roundNumber || 1) === rNum;

                    return (
                      <span
                        key={rNum}
                        className={`h-1.5 rounded-full transition-all ${
                          isCurrent
                            ? 'w-4 bg-blue-500 dark:bg-cyan-400'
                            : pastRound
                            ? pastMyAns?.isCorrect
                              ? 'w-1.5 bg-emerald-500'
                              : 'w-1.5 bg-rose-500'
                            : 'w-1.5 bg-slate-300 dark:bg-white/15'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Player 2 (OPPONENT) */}
              <div className="col-span-5 flex items-center justify-end gap-2.5 sm:gap-3.5 text-right">
                <div className="overflow-hidden min-w-0">
                  <span className="hidden sm:inline-block text-[10px] font-bold text-purple-700 dark:text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20 truncate max-w-full">
                    {opponentPlayer?.isBot
                      ? '🤖 Kiber AI Duelist'
                      : `${opponentPlayer?.titleIcon || '⚔️'} ${opponentPlayer?.titleName || 'Raqib'}`}
                  </span>
                  <h4 className="text-xs sm:text-base font-black text-slate-900 dark:text-white truncate mt-0.5">
                    {opponentPlayer?.name || 'Raqib'}
                  </h4>
                  <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2 mt-0.5">
                    <span className="text-xs font-black text-rose-600 dark:text-rose-400">
                      {oppTotalScore} Ball
                    </span>
                    <span className="text-[11px] font-mono font-bold text-amber-500 dark:text-amber-400">
                      ⚡ {opponentPlayer?.rating ?? 1000}
                    </span>
                  </div>
                </div>

                <div className="relative w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-2xl arena-inset border border-rose-500/40 p-1 shrink-0 shadow-sm">
                  <img
                    src={opponentPlayer?.avatarUrl || '/avatars/arena/neon-samurai/battle.png'}
                    alt={opponentPlayer?.name || 'Raqib'}
                    className="w-full h-full object-contain"
                  />
                  {opponentHasAnswered && (
                    <div className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-black shadow-lg">
                      ✓
                    </div>
                  )}

                  {/* Opponent Live Reaction Bubble */}
                  <AnimatePresence>
                    {latestReaction &&
                      latestReaction.studentId === opponentPlayer?.studentId && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.5, y: 10 }}
                          animate={{ opacity: 1, scale: 1.25, y: -24 }}
                          exit={{ opacity: 0, scale: 0.5, y: -35 }}
                          className="absolute -top-4 -left-5 z-20 text-2xl sm:text-3xl filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.25)]"
                        >
                          {latestReaction.emoji}
                        </motion.div>
                      )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Live Tug-of-War Score Dominance Bar */}
            <div className="w-full h-1.5 rounded-full bg-rose-500/30 dark:bg-rose-500/40 overflow-hidden flex">
              <motion.div
                animate={{ width: `${myMomentumPercent}%` }}
                transition={{ type: 'spring', stiffness: 260, damping: 25 }}
                className="h-full bg-gradient-to-r from-blue-600 to-cyan-400"
              />
            </div>
          </div>

          {/* Tactical Cyber Power-Ups Bar */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
            <button
              onClick={() => handleUsePowerUp('FIFTY_FIFTY')}
              disabled={powerUpsUsed.fiftyFifty || hasAnswered || Boolean(roundResult)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold arena-dock border transition-all flex items-center gap-1.5 ${
                powerUpsUsed.fiftyFifty
                  ? 'opacity-40 border-black/[0.04] dark:border-white/5 cursor-not-allowed text-slate-400'
                  : 'border-blue-500/30 dark:border-cyan-500/40 text-blue-700 dark:text-cyan-300 hover:bg-blue-500/10 dark:hover:bg-cyan-500/20 active:scale-95 shadow-sm'
              }`}
              title="Ikkita noto‘g‘ri variantni olib tashlash (Klaviatura: Q)"
            >
              <Sliders className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
              <span>50/50 Shifrlovchi</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/15 dark:bg-cyan-500/20">
                {powerUpsUsed.fiftyFifty ? '0x' : '1x'}
              </span>
            </button>

            <button
              onClick={() => handleUsePowerUp('ADD_TIME')}
              disabled={powerUpsUsed.addTime || hasAnswered || Boolean(roundResult)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold arena-dock border transition-all flex items-center gap-1.5 ${
                powerUpsUsed.addTime
                  ? 'opacity-40 border-black/[0.04] dark:border-white/5 cursor-not-allowed text-slate-400'
                  : 'border-amber-500/30 dark:border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 dark:hover:bg-amber-500/20 active:scale-95 shadow-sm'
              }`}
              title="+5 soniya qo‘shimcha vaqt olish (Klaviatura: W)"
            >
              <Hourglass className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>+5s Vaqt</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 dark:bg-amber-500/20">
                {powerUpsUsed.addTime ? '0x' : '1x'}
              </span>
            </button>

            <button
              onClick={() => handleUsePowerUp('HINT')}
              disabled={powerUpsUsed.hint || hasAnswered || Boolean(roundResult)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold arena-dock border transition-all flex items-center gap-1.5 ${
                powerUpsUsed.hint
                  ? 'opacity-40 border-black/[0.04] dark:border-white/5 cursor-not-allowed text-slate-400'
                  : 'border-purple-500/30 dark:border-purple-500/40 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 dark:hover:bg-purple-500/20 active:scale-95 shadow-sm'
              }`}
              title="Pedagogik maslahat yoki formulani ko‘rish (Klaviatura: E)"
            >
              <Lightbulb className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>Kiber Maslahat</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/15 dark:bg-purple-500/20">
                {powerUpsUsed.hint ? '0x' : '1x'}
              </span>
            </button>
          </div>

          {/* Active Hint Box if revealed */}
          <AnimatePresence>
            {activeHint && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="p-3.5 rounded-2xl arena-inset border border-amber-500/40 bg-amber-50/80 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs max-w-2xl mx-auto flex items-center gap-2.5 shadow-sm"
              >
                <Lightbulb className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>
                  <strong>Kiber Maslahat:</strong> {activeHint}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Question Board Area */}
          <div className="arena-glass rounded-3xl p-5 sm:p-7 md:p-8 border border-black/[0.08] dark:border-white/10 space-y-6 shadow-sm dark:shadow-xl">
            <AnimatePresence mode="wait">
              <motion.h3
                key={currentRound?.roundNumber || 'q'}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="text-base sm:text-lg md:text-xl font-bold text-slate-900 dark:text-white text-center leading-relaxed select-text"
              >
                {currentRound?.question.questionText || 'Savol tayyorlanmoqda...'}
              </motion.h3>
            </AnimatePresence>

            {/* Code block if programming question */}
            {currentRound?.question.codeSnippet && (
              <div className="max-w-2xl mx-auto rounded-2xl overflow-hidden border border-black/[0.08] dark:border-white/10 bg-slate-900 text-slate-100 shadow-inner">
                <div className="px-4 py-1.5 bg-black/40 border-b border-white/5 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                  <span>{currentRound.question.codeLanguage || 'code'}</span>
                  <span className="text-cyan-400">Deterministik Sandbox ✓</span>
                </div>
                <pre className="p-4 text-xs font-mono text-cyan-200 overflow-x-auto leading-relaxed select-text">
                  <code>{currentRound.question.codeSnippet}</code>
                </pre>
              </div>
            )}

            {/* 4 Interactive Options (A, B, C, D) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl mx-auto">
              {currentRound?.question.options.map((opt, idx) => {
                const isSelected = selectedOptionKey === opt.optionKey;
                const isOpponentChoice =
                  roundResult && oppRoundAnswer?.selectedKey === opt.optionKey;
                const isDisabledByPowerUp = disabledOptionKeys.includes(opt.optionKey);
                const isRevealedCorrect =
                  Boolean(roundResult) && roundResult?.correctOptionKey === opt.optionKey;
                const isRevealedWrong =
                  Boolean(roundResult) && isSelected && !isRevealedCorrect;

                return (
                  <button
                    key={opt.optionKey}
                    disabled={hasAnswered || Boolean(roundResult) || isDisabledByPowerUp}
                    onClick={() => handleSelectOption(opt.optionKey)}
                    className={`p-4 rounded-2xl border text-left font-medium text-sm transition-all duration-200 flex items-center gap-3.5 arena-inset shadow-sm relative ${
                      isDisabledByPowerUp
                        ? 'opacity-30 line-through border-black/[0.04] dark:border-white/5 cursor-not-allowed'
                        : isRevealedCorrect
                        ? 'bg-emerald-50 dark:bg-emerald-500/25 border-emerald-500 text-emerald-900 dark:text-emerald-200 shadow-md'
                        : isRevealedWrong
                        ? 'bg-rose-50 dark:bg-rose-500/25 border-rose-500 text-rose-900 dark:text-rose-200'
                        : isSelected
                        ? 'bg-blue-50 dark:bg-cyan-500/25 border-blue-500 dark:border-cyan-400 text-blue-900 dark:text-cyan-200 shadow-md'
                        : 'border-black/[0.08] dark:border-white/10 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.06] active:scale-[0.98]'
                    }`}
                  >
                    <span
                      className={`w-8 h-8 rounded-xl font-black text-sm flex items-center justify-center shrink-0 ${
                        isRevealedCorrect
                          ? 'bg-emerald-500 text-white'
                          : isRevealedWrong
                          ? 'bg-rose-500 text-white'
                          : isSelected
                          ? 'bg-blue-600 dark:bg-cyan-400 text-white dark:text-black'
                          : 'bg-slate-200/80 dark:bg-white/10 text-slate-800 dark:text-white'
                      }`}
                    >
                      {opt.optionKey}
                    </span>

                    <span className="flex-1 text-xs sm:text-sm leading-snug">
                      {opt.optionText}
                    </span>

                    {/* Keyboard shortcut hint when unanswered */}
                    {!hasAnswered && !roundResult && !isDisabledByPowerUp && (
                      <span className="hidden lg:inline-block text-[10px] font-mono text-slate-400 border border-black/[0.06] dark:border-white/10 px-1.5 py-0.5 rounded">
                        {idx + 1}
                      </span>
                    )}

                    {/* Opponent choice badge on reveal */}
                    {isOpponentChoice && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/30 shrink-0">
                        Raqib
                      </span>
                    )}

                    {isRevealedCorrect && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    )}
                    {isRevealedWrong && (
                      <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Answer lock-in status */}
            {hasAnswered && !roundResult && (
              <p className="text-center text-xs font-bold text-blue-600 dark:text-cyan-300 flex items-center justify-center gap-2 animate-pulse">
                <CheckCircle2 className="w-4 h-4 text-blue-500 dark:text-cyan-400" />
                <span>Javobingiz qulflandi! Raqib javobi kutilmoqda...</span>
              </p>
            )}

            {/* Round Ended Pedagogical Explanation Card */}
            <AnimatePresence>
              {roundResult && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="p-4 sm:p-5 rounded-2xl arena-inset border border-blue-500/30 dark:border-cyan-500/40 text-xs text-slate-700 dark:text-slate-300 max-w-2xl mx-auto space-y-2 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 font-bold text-blue-700 dark:text-cyan-300">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>To‘g‘ri javob ({roundResult.correctOptionKey}) va Ilmiy Isbot:</span>
                    </span>
                    {myRoundAnswer?.isCorrect ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-black">
                        +{myRoundAnswer.scoreEarned} Ball! (Tezlik: +{myRoundAnswer.speedBonus})
                      </span>
                    ) : (
                      <span className="text-rose-600 dark:text-rose-400 font-bold">
                        Noto‘g‘ri javob (0 ball)
                      </span>
                    )}
                  </div>
                  <p className="text-slate-700 dark:text-slate-200 pl-4 border-l-2 border-blue-500/50 leading-relaxed text-xs">
                    {roundResult.explanation}
                  </p>
                  <p className="text-right text-[11px] font-mono text-blue-600 dark:text-cyan-400 pt-1 font-bold">
                    Keyingi raund yuklanmoqda... ⏳
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Bottom Bar: Emote Reactions & Safe 2-Step Surrender */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            {/* Quick Emotes Floating Bar */}
            <div className="flex items-center gap-1 sm:gap-1.5 p-1 rounded-2xl arena-dock border border-black/[0.06] dark:border-white/10 overflow-x-auto">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 px-2 shrink-0">
                Emotlar:
              </span>
              {QUICK_EMOTES.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleSendReaction(emoji)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-base hover:scale-125 active:scale-95 transition-all hover:bg-slate-200/50 dark:hover:bg-white/10 shrink-0"
                  title="Raqibga yuborish"
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* 2-Step Safe Surrender Control */}
            {!confirmSurrender ? (
              <button
                onClick={() => {
                  play('tick');
                  setConfirmSurrender(true);
                }}
                className="text-xs text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-1.5 transition-colors p-2 font-semibold"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Taslim bo‘lish</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30">
                <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                  Jangni tark etasizmi?
                </span>
                <button
                  onClick={() => {
                    play('error');
                    haptic('warning');
                    setConfirmSurrender(false);
                    surrenderDuel();
                  }}
                  className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-xs font-black hover:bg-rose-500 transition-all"
                >
                  Ha, chiqish
                </button>
                <button
                  onClick={() => setConfirmSurrender(false)}
                  className="px-2 py-1 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10"
                >
                  Yo‘q
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PHASE 4: FINAL DUEL RESULTS / PODIUM, REMATCH & POST-MATCH DEBRIEF        */}
      {/* ========================================================================= */}
      {duelFinishResult && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-2xl mx-auto my-auto w-full text-center space-y-6 py-4 sm:py-6 relative z-10"
        >
          {/* Result Banner */}
          <div className="space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl arena-inset border border-black/[0.06] dark:border-white/10 text-4xl shadow-md mb-1">
              {isWinner ? '👑' : isDraw ? '🤝' : '⚔️'}
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white uppercase tracking-wider">
              {isWinner ? 'G‘alaba!' : isDraw ? 'Durrang!' : 'Munosib Kurash'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto">
              {isWinner
                ? 'Ajoyib natija! Siz tezkor bilim va deduktsiya orqali raqib ustidan g‘alaba qozondingiz!'
                : isDraw
                ? 'Murosasiz duel! Ikkala jangchi ham tengma-teng kurash olib bordi.'
                : 'Tajriba — eng katta yutuq! Xatolarni tahlil qilib, revanshda g‘alaba qozoning.'}
            </p>
          </div>

          {/* Winner Avatar Display */}
          <div className="w-36 h-36 sm:w-44 sm:h-44 mx-auto my-2 relative">
            <img
              src={
                isWinner
                  ? myPlayer?.avatarUrl?.replace('battle', 'victory') ||
                    '/avatars/arena/cyber-scholar/victory.png'
                  : myPlayer?.avatarUrl || '/avatars/arena/cyber-scholar/default.png'
              }
              alt="Avatar"
              className="w-full h-full object-contain drop-shadow-[0_15px_30px_rgba(0,122,255,0.25)] dark:drop-shadow-[0_15px_30px_rgba(6,182,212,0.45)]"
            />
          </div>

          {/* Head-to-Head Final Score Comparison Pill */}
          <div className="arena-glass rounded-2xl p-4 border border-black/[0.06] dark:border-white/10 flex items-center justify-between max-w-md mx-auto">
            <div className="text-left">
              <div className="text-xs font-extrabold text-slate-900 dark:text-white truncate max-w-[130px]">
                {myPlayer?.name || 'Siz'}
              </div>
              <div className="text-lg font-black text-blue-600 dark:text-cyan-400">
                {myFinal?.totalScore ?? myTotalScore} ball
              </div>
            </div>

            <div className="px-3 py-1 rounded-xl arena-inset text-[11px] font-black uppercase text-slate-500">
              YAKUNIY HISOB
            </div>

            <div className="text-right">
              <div className="text-xs font-extrabold text-slate-900 dark:text-white truncate max-w-[130px]">
                {opponentPlayer?.name || 'Raqib'}
              </div>
              <div className="text-lg font-black text-rose-600 dark:text-rose-400">
                {oppFinal?.totalScore ?? oppTotalScore} ball
              </div>
            </div>
          </div>

          {/* Scores & Rewards Card */}
          <div className="grid grid-cols-3 gap-3 arena-inset rounded-2xl p-4 sm:p-5 border border-black/[0.06] dark:border-white/10 shadow-sm">
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider flex items-center justify-center gap-1">
                <Trophy className="w-3 h-3 text-amber-500" /> Rating
              </div>
              <div
                className={`text-xl sm:text-2xl font-black mt-1 ${
                  (myFinal?.ratingDelta ?? 0) >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {(myFinal?.ratingDelta ?? 0) >= 0
                  ? `+${myFinal?.ratingDelta ?? 0}`
                  : myFinal?.ratingDelta}{' '}
                ⚡
              </div>
              <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                Yangi: {myFinal?.newRating ?? myDuelProfile?.rating ?? 1000}
              </div>
            </div>

            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider flex items-center justify-center gap-1">
                <Award className="w-3 h-3 text-amber-500" /> XP
              </div>
              <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-300 mt-1">
                +{myFinal?.xpEarned || 50}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Daraja tajribasi</div>
            </div>

            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider flex items-center justify-center gap-1">
                <Coins className="w-3 h-3 text-blue-600 dark:text-cyan-400" /> M-Coin
              </div>
              <div className="text-xl sm:text-2xl font-black text-blue-600 dark:text-cyan-300 mt-1">
                +{myFinal?.coinsEarned || 2} 🪙
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Mukofot balansi</div>
            </div>
          </div>

          {/* Title Unlock Banner */}
          {myFinal?.newTitleUnlocked && (
            <div className="p-4 rounded-2xl bg-purple-50 dark:bg-gradient-to-r dark:from-purple-500/25 dark:to-pink-500/25 border border-purple-300 dark:border-purple-500/50 text-purple-800 dark:text-purple-200 text-sm font-bold flex items-center justify-center gap-2 shadow-sm">
              <span>🎉</span> Yangi Unvon Qulfi Ochildi: &ldquo;{myFinal.newTitleUnlocked.name}&rdquo;!
            </div>
          )}

          {/* Incoming Rematch Invitation Alert */}
          {rematchRequestedBy && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-2xl arena-dock border border-blue-500/30 dark:border-cyan-500/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-left shadow-md"
            >
              <div>
                <div className="text-xs font-bold text-blue-600 dark:text-cyan-400 uppercase tracking-wider">
                  Qayta Jang Taklifi! ⚔️
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                  {rematchRequestedBy.fromName} sizni revansh jangga chorlamoqda!
                </div>
              </div>
              <button
                onClick={() => {
                  play('success');
                  haptic('heavy');
                  acceptRematch();
                }}
                className="px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider bg-emerald-600 text-white hover:bg-emerald-500 active:scale-95 transition-all shadow"
              >
                Qabul Qilish ⚡
              </button>
            </motion.div>
          )}

          {/* Actions: Rematch, Review, New Game */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => {
                play('pop');
                haptic('selection');
                requestRematch();
              }}
              disabled={isRematchWaiting}
              className="px-6 py-3 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider arena-inset border border-blue-500/30 dark:border-cyan-500/50 text-blue-700 dark:text-cyan-300 hover:bg-blue-500/10 dark:hover:bg-cyan-500/20 active:scale-95 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{isRematchWaiting ? 'Raqib kutilmoqda...' : 'Qayta Jang (Revansh)'}</span>
            </button>

            <button
              onClick={() => {
                play('tick');
                setIsReviewOpen(!isReviewOpen);
              }}
              className="px-5 py-3 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider arena-dock border border-black/[0.08] dark:border-white/20 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white active:scale-95 transition-all flex items-center gap-2 shadow-sm"
            >
              <Compass className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>Jang Tahlili ({roundsHistory.length || 5} raund)</span>
              {isReviewOpen ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            {onOpenMistakes && (
              <button
                onClick={() => {
                  play('pop');
                  haptic('selection');
                  onOpenMistakes();
                }}
                className="px-5 py-3 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25 active:scale-95 transition-all flex items-center gap-2 shadow-sm"
              >
                <BookOpen className="w-4 h-4 text-amber-500" />
                <span>Xatolar Laboratoriyasi</span>
              </button>
            )}

            {onOpenAiCoach && (
              <button
                onClick={() => {
                  play('pop');
                  haptic('selection');
                  onOpenAiCoach();
                }}
                className="px-5 py-3 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider bg-purple-500/15 border border-purple-500/30 text-purple-700 dark:text-purple-300 hover:bg-purple-500/25 active:scale-95 transition-all flex items-center gap-2 shadow-sm"
              >
                <Brain className="w-4 h-4 text-purple-500" />
                <span>AI Murabbiy Tahlili</span>
              </button>
            )}

            <button
              onClick={() => {
                play('pop');
                haptic('selection');
                resetBattle();
              }}
              className="px-7 py-3 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 text-white shadow-xl shadow-blue-500/25 hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 arena-sheen"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Yangi Raqib Qidirish</span>
            </button>
          </div>

          {/* Post-Battle Rounds Debrief & Mistake Review */}
          <AnimatePresence>
            {isReviewOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden pt-4 text-left space-y-3"
              >
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Batafsil Raundlar Tahlili va Yechimlar:
                </div>
                {roundsHistory.map((r: any, idx: number) => {
                  const myAns = r.answers?.find(
                    (a: any) =>
                      a.studentId === effectiveMyId || a.studentId === user?.id
                  );
                  const isCorrect = Boolean(myAns?.isCorrect);

                  return (
                    <div
                      key={r.roundNumber ?? idx}
                      className={`p-4 rounded-2xl arena-glass border space-y-2 shadow-sm ${
                        isCorrect
                          ? 'border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-500/10'
                          : 'border-rose-500/40 bg-rose-50/50 dark:bg-rose-500/10'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          Raund #{r.roundNumber ?? idx + 1}
                        </span>
                        <span
                          className={`font-black flex items-center gap-1 ${
                            isCorrect
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-rose-700 dark:text-rose-400'
                          }`}
                        >
                          {isCorrect ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>To‘g‘ri (+{myAns?.scoreEarned ?? 0} ball)</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5" />
                              <span>
                                Noto‘g‘ri (Tanlov: {myAns?.selectedKey || 'Vaqt tugagan'})
                              </span>
                            </>
                          )}
                        </span>
                      </div>

                      <p className="text-xs font-semibold text-slate-900 dark:text-white">
                        {r.questionText}
                      </p>

                      {r.codeSnippet && (
                        <pre className="p-2.5 bg-slate-900 text-cyan-200 rounded-xl text-[11px] font-mono overflow-x-auto">
                          <code>{r.codeSnippet}</code>
                        </pre>
                      )}

                      <div className="p-2.5 rounded-xl arena-inset text-[11px] text-slate-700 dark:text-slate-300 space-y-1">
                        <strong className="text-blue-700 dark:text-cyan-300">
                          To‘g‘ri kalit: {r.correctOptionKey}
                        </strong>
                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                          {r.explanation}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
};