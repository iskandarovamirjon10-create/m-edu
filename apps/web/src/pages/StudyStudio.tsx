import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { GlassPageHeader } from '@/components/ui';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/GlassToast';
import { usePageTitle } from '@/hooks/usePageTitle';
import { cn, usePrefersReducedMotion } from '@/lib/design';
import request from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessages';

/* ══════════════════════════════════════════════════════════════════════════
 * STUDY STUDIO — Focus & Recall
 *
 * One calm surface for two daily habits that actually move grades:
 *   1. A focus timer whose completed minutes are persisted per user.
 *   2. A spaced-repetition queue (SM-2 on the API) built from personal decks.
 *
 * Everything is server-backed: no localStorage, no demo fixtures. The UI is
 * light-first with soft indigo/mint accents and spring motion.
 * ════════════════════════════════════════════════════════════════════════ */

type Accent = 'indigo' | 'violet' | 'emerald' | 'amber' | 'rose' | 'sky';
type Rating = 'again' | 'hard' | 'good' | 'easy';

interface DeckSummary {
  id: string;
  title: string;
  subject: string | null;
  description: string | null;
  accent: string;
  cardCount: number;
  dueCount: number;
}

interface Overview {
  decks: DeckSummary[];
  totals: {
    cards: number;
    due: number;
    reviewsToday: number;
    focusMinutesToday: number;
    focusMinutesWeek: number;
    streakDays: number;
    accuracy7d: number;
  };
  activity: { date: string; reviews: number; focusMinutes: number }[];
}

interface QueueCard {
  id: string;
  front: string;
  back: string;
  intervalDays: number;
  repetitions: number;
  deck: { id: string; title: string; accent: string };
}

interface DeckCard {
  id: string;
  front: string;
  back: string;
  dueAt: string;
  intervalDays: number;
  repetitions: number;
  lapses: number;
}

const ACCENTS: Record<Accent, { dot: string; soft: string; text: string; ring: string }> = {
  indigo: {
    dot: 'bg-[#5B6CFF]',
    soft: 'from-[#EEF0FF] to-white dark:from-[#5B6CFF]/15 dark:to-transparent',
    text: 'text-[#4350C9] dark:text-[#A7B0FF]',
    ring: 'ring-[#5B6CFF]/25',
  },
  violet: {
    dot: 'bg-[#8B5CF6]',
    soft: 'from-[#F6F0FF] to-white dark:from-[#8B5CF6]/15 dark:to-transparent',
    text: 'text-[#6D3FD1] dark:text-[#C9B2FF]',
    ring: 'ring-[#8B5CF6]/25',
  },
  emerald: {
    dot: 'bg-[#22A06B]',
    soft: 'from-[#EDFAF3] to-white dark:from-[#22A06B]/15 dark:to-transparent',
    text: 'text-[#177A50] dark:text-[#9BE3C4]',
    ring: 'ring-[#22A06B]/25',
  },
  amber: {
    dot: 'bg-[#E0A32E]',
    soft: 'from-[#FFF8EA] to-white dark:from-[#E0A32E]/15 dark:to-transparent',
    text: 'text-[#9A6B10] dark:text-[#F3D79B]',
    ring: 'ring-[#E0A32E]/25',
  },
  rose: {
    dot: 'bg-[#E05776]',
    soft: 'from-[#FFF1F4] to-white dark:from-[#E05776]/15 dark:to-transparent',
    text: 'text-[#A93050] dark:text-[#F5B3C3]',
    ring: 'ring-[#E05776]/25',
  },
  sky: {
    dot: 'bg-[#2F8FD8]',
    soft: 'from-[#EDF7FF] to-white dark:from-[#2F8FD8]/15 dark:to-transparent',
    text: 'text-[#1B6DA8] dark:text-[#A9D6F5]',
    ring: 'ring-[#2F8FD8]/25',
  },
};

const ACCENT_KEYS = Object.keys(ACCENTS) as Accent[];

function accentOf(value: string): Accent {
  return (ACCENT_KEYS as string[]).includes(value) ? (value as Accent) : 'indigo';
}

const RATING_META: Record<Rating, { className: string; key: string }> = {
  again: {
    className:
      'border-[#E05776]/25 bg-[#E05776]/[0.07] text-[#A93050] hover:bg-[#E05776]/[0.12] dark:text-[#F5B3C3]',
    key: '1',
  },
  hard: {
    className:
      'border-[#E0A32E]/25 bg-[#E0A32E]/[0.07] text-[#9A6B10] hover:bg-[#E0A32E]/[0.12] dark:text-[#F3D79B]',
    key: '2',
  },
  good: {
    className:
      'border-[#22A06B]/25 bg-[#22A06B]/[0.07] text-[#177A50] hover:bg-[#22A06B]/[0.12] dark:text-[#9BE3C4]',
    key: '3',
  },
  easy: {
    className:
      'border-[#5B6CFF]/25 bg-[#5B6CFF]/[0.07] text-[#4350C9] hover:bg-[#5B6CFF]/[0.12] dark:text-[#A7B0FF]',
    key: '4',
  },
};

const PRESETS = [15, 25, 50] as const;

function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/* ── Small surface pieces ───────────────────────────────────────────── */

function SoftBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[#FBFBFD] dark:bg-[#0C0D12]" />
      <div className="absolute -left-32 -top-40 h-[520px] w-[520px] rounded-full bg-[#5B6CFF]/[0.09] blur-[110px] dark:bg-[#5B6CFF]/[0.12]" />
      <div className="absolute -right-40 top-1/4 h-[460px] w-[460px] rounded-full bg-[#22A06B]/[0.08] blur-[110px] dark:bg-[#22A06B]/[0.1]" />
      <div className="absolute bottom-[-20%] left-1/3 h-[380px] w-[380px] rounded-full bg-[#E0A32E]/[0.07] blur-[120px] dark:bg-[#E0A32E]/[0.08]" />
    </div>
  );
}

function StatTile({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone: Accent;
}) {
  const a = ACCENTS[tone];
  return (
    <div className="relative overflow-hidden rounded-[22px] border border-black/[0.06] bg-white/80 p-4 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_10px_30px_-24px_rgba(15,23,42,0.35)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.04]">
      <div className={cn('absolute inset-0 bg-gradient-to-br opacity-70', a.soft)} />
      <div className="relative">
        <div className="flex items-center gap-2">
          <span className={cn('h-1.5 w-1.5 rounded-full', a.dot)} />
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6B7280] dark:text-slate-400">
            {label}
          </span>
        </div>
        <p className="mt-2 text-[26px] font-bold leading-none tracking-tight text-[#1D1D1F] tabular-nums dark:text-white">
          {value}
        </p>
        <p className="mt-1.5 truncate text-[11.5px] font-medium text-[#8A8F98] dark:text-slate-500">
          {note}
        </p>
      </div>
    </div>
  );
}

function FocusRing({
  progress,
  running,
  children,
}: {
  progress: number;
  running: boolean;
  children: React.ReactNode;
}) {
  const radius = 88;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, progress));
  return (
    <div className="relative mx-auto h-[228px] w-[228px]">
      <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90" aria-hidden>
        <defs>
          <linearGradient id="study-focus-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#5B6CFF" />
            <stop offset="55%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#22A06B" />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-black/[0.06] dark:text-white/[0.08]" />
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="none"
          stroke="url(#study-focus-gradient)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.16,1,0.3,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.div
          animate={running ? { scale: [1, 1.02, 1] } : { scale: 1 }}
          transition={running ? { duration: 4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
          className="text-center"
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}

/* ── Focus timer ────────────────────────────────────────────────────── */

function FocusTimer({
  minutesToday,
  minutesWeek,
  onSave,
  saving,
}: {
  minutesToday: number;
  minutesWeek: number;
  onSave: (minutes: number) => void;
  saving: boolean;
}) {
  const { t } = useSafeI18n();
  const [preset, setPreset] = useState<number>(25);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const autoSavedRef = useRef(false);

  const total = preset * 60;
  const elapsed = total - secondsLeft;
  const progress = total > 0 ? elapsed / total : 0;

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (secondsLeft > 0 || !running) return;
    setRunning(false);
    if (!autoSavedRef.current) {
      autoSavedRef.current = true;
      onSave(preset);
    }
  }, [secondsLeft, running, preset, onSave]);

  const choosePreset = (next: number) => {
    setPreset(next);
    setSecondsLeft(next * 60);
    setRunning(false);
    autoSavedRef.current = false;
  };

  const reset = () => {
    setSecondsLeft(preset * 60);
    setRunning(false);
    autoSavedRef.current = false;
  };

  const finishNow = () => {
    if (elapsed < 60) return;
    const earned = Math.max(1, Math.round(elapsed / 60));
    setRunning(false);
    autoSavedRef.current = true;
    onSave(earned);
  };

  const toggleRunning = () => {
    if (!running && secondsLeft === 0) {
      autoSavedRef.current = false;
      setSecondsLeft(preset * 60);
    }
    setRunning((prev) => !prev);
  };

  return (
    <section className="flex h-full flex-col rounded-[28px] border border-black/[0.06] bg-white/85 p-5 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset,0_24px_60px_-40px_rgba(15,23,42,0.4)] backdrop-blur-2xl dark:border-white/[0.08] dark:bg-white/[0.045]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-bold tracking-tight text-[#1D1D1F] dark:text-white">
            {t('study.focusTitle')}
          </h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[#6B7280] dark:text-slate-400">
            {t('study.focusDesc')}
          </p>
        </div>
        <span className="rounded-full border border-[#22A06B]/20 bg-[#22A06B]/[0.08] px-2.5 py-1 text-[10.5px] font-bold text-[#177A50] dark:text-[#9BE3C4]">
          {t('study.todayMinutes', { n: minutesToday })}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {PRESETS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => choosePreset(value)}
            aria-pressed={preset === value}
            className={cn(
              'min-h-[36px] rounded-full border px-3.5 text-[12px] font-bold transition-all duration-200',
              preset === value
                ? 'border-[#5B6CFF]/30 bg-[#5B6CFF]/[0.1] text-[#4350C9] dark:text-[#A7B0FF]'
                : 'border-black/[0.07] bg-white/60 text-[#6B7280] hover:border-black/[0.12] dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-slate-400',
            )}
          >
            {t('study.presetMinutes', { n: value })}
          </button>
        ))}
      </div>

      <div className="mt-3 flex-1">
        <FocusRing progress={progress} running={running}>
          <span className="block text-[40px] font-bold leading-none tracking-tight text-[#1D1D1F] tabular-nums dark:text-white">
            {formatClock(secondsLeft)}
          </span>
          <span className="mt-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8A8F98] dark:text-slate-500">
            {running ? t('study.focusing') : t('study.ready')}
          </span>
        </FocusRing>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={toggleRunning}
          className="min-h-[46px] flex-1 rounded-2xl bg-[#1D1D1F] text-[13.5px] font-bold text-white shadow-[0_10px_24px_-12px_rgba(15,23,42,0.7)] transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0 dark:bg-white dark:text-[#1D1D1F]"
        >
          {running
            ? t('study.pause')
            : secondsLeft === total
              ? t('study.start')
              : t('study.resume')}
        </button>
        <button
          type="button"
          onClick={reset}
          className="min-h-[46px] rounded-2xl border border-black/[0.08] bg-white/70 px-4 text-[12.5px] font-bold text-[#4B5563] transition-colors hover:bg-white dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-slate-300"
        >
          {t('study.reset')}
        </button>
        <button
          type="button"
          onClick={finishNow}
          disabled={elapsed < 60 || saving}
          className="min-h-[46px] rounded-2xl border border-[#22A06B]/25 bg-[#22A06B]/[0.08] px-4 text-[12.5px] font-bold text-[#177A50] transition-colors hover:bg-[#22A06B]/[0.14] disabled:cursor-not-allowed disabled:opacity-40 dark:text-[#9BE3C4]"
        >
          {saving ? t('study.saving') : t('study.save')}
        </button>
      </div>

      <p className="mt-3 text-center text-[11px] font-medium text-[#8A8F98] dark:text-slate-500">
        {t('study.weekFocus', { n: minutesWeek })}
      </p>
    </section>
  );
}

/* ── Review card ────────────────────────────────────────────────────── */

function ReviewSurface({
  card,
  remaining,
  reviewed,
  onRate,
  pending,
}: {
  card: QueueCard | null;
  remaining: number;
  reviewed: number;
  onRate: (rating: Rating) => void;
  pending: boolean;
}) {
  const { t } = useSafeI18n();
  const [flipped, setFlipped] = useState(false);
  const reduced = usePrefersReducedMotion();
  const currentId = card?.id ?? null;

  useEffect(() => {
    setFlipped(false);
  }, [currentId]);

  // Space owns the flip; the parent owns 1–4 grading.
  useEffect(() => {
    if (!card) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (target?.isContentEditable) return;
      if (event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault();
        setFlipped((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [card]);

  const total = Math.max(1, remaining + reviewed);
  const progress = Math.min(1, reviewed / total);

  return (
    <section className="flex h-full flex-col rounded-[28px] border border-black/[0.06] bg-white/85 p-5 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset,0_24px_60px_-40px_rgba(15,23,42,0.4)] backdrop-blur-2xl dark:border-white/[0.08] dark:bg-white/[0.045]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[17px] font-bold tracking-tight text-[#1D1D1F] dark:text-white">
            {t('study.reviewTitle')}
          </h2>
          <p className="mt-1 truncate text-[12.5px] text-[#6B7280] dark:text-slate-400">
            {card ? card.deck.title : t('study.allDoneTitle')}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-[#5B6CFF]/20 bg-[#5B6CFF]/[0.08] px-2.5 py-1 text-[10.5px] font-bold text-[#4350C9] dark:text-[#A7B0FF]">
          {t('study.reviewedOf', { done: reviewed, total })}
        </span>
      </div>

      <div className="mt-3 h-1 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.08]">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-[#5B6CFF] via-[#8B5CF6] to-[#22A06B]"
          animate={{ width: `${progress * 100}%` }}
          transition={{ type: 'spring', stiffness: 180, damping: 26 }}
        />
      </div>

      <div className="mt-4 flex-1">
        <AnimatePresence mode="wait" initial={false}>
          {card ? (
            <motion.div
              key={card.id}
              initial={reduced ? undefined : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="flex h-full min-h-[250px] flex-col"
            >
              <div className="perspective-[1400px] flex-1">
                <motion.button
                  type="button"
                  onClick={() => setFlipped((prev) => !prev)}
                  aria-label={t('study.flip')}
                  aria-pressed={flipped}
                  animate={{ rotateY: reduced ? 0 : flipped ? 180 : 0 }}
                  transition={{ type: 'spring', stiffness: 170, damping: 22 }}
                  className="relative block h-full min-h-[250px] w-full rounded-[22px] border border-black/[0.06] bg-gradient-to-br from-white to-[#F6F7FF] p-6 text-left shadow-[0_18px_40px_-30px_rgba(15,23,42,0.5)] [transform-style:preserve-3d] dark:border-white/[0.08] dark:from-white/[0.05] dark:to-white/[0.02]"
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  <span className="absolute left-5 top-4 text-[10px] font-bold uppercase tracking-[0.18em] text-[#9AA0A6] dark:text-slate-500">
                    {t('study.question')}
                  </span>
                  <span
                    className="flex h-full items-center justify-center px-2 text-center text-[19px] font-semibold leading-snug text-[#1D1D1F] dark:text-white"
                    style={{ backfaceVisibility: 'hidden' }}
                  >
                    {card.front}
                  </span>

                  <span
                    className="absolute inset-0 flex flex-col items-center justify-center rounded-[22px] bg-gradient-to-br from-[#F3F6FF] to-[#EEFBF4] p-6 text-center dark:from-[#141a2e] dark:to-[#0f2019]"
                    style={{
                      backfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)',
                    }}
                  >
                    <span className="absolute left-5 top-4 text-[10px] font-bold uppercase tracking-[0.18em] text-[#22A06B]">
                      {t('study.answer')}
                    </span>
                    <span className="text-[17.5px] font-medium leading-relaxed text-[#1D1D1F] dark:text-white">
                      {card.back}
                    </span>
                  </span>
                </motion.button>
              </div>

              <p className="mt-3 text-center text-[11px] font-medium text-[#8A8F98] dark:text-slate-500">
                {flipped ? t('study.rateHint') : t('study.flipHint')}
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={reduced ? undefined : { opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduced ? undefined : { opacity: 0, scale: 0.98 }}
              className="flex min-h-[250px] flex-col items-center justify-center rounded-[22px] border border-dashed border-[#22A06B]/25 bg-[#22A06B]/[0.05] p-6 text-center"
            >
              <div className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm dark:bg-white/10">
                <svg viewBox="0 0 24 24" className="h-7 w-7 text-[#22A06B]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
              <p className="text-[15px] font-bold text-[#1D1D1F] dark:text-white">
                {t('study.allDoneTitle')}
              </p>
              <p className="mt-1 max-w-[260px] text-[12.5px] leading-relaxed text-[#6B7280] dark:text-slate-400">
                {t('study.allDoneDesc')}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(Object.keys(RATING_META) as Rating[]).map((rating) => {
          const meta = RATING_META[rating];
          return (
            <button
              key={rating}
              type="button"
              disabled={!card || pending}
              onClick={() => onRate(rating)}
              className={cn(
                'min-h-[52px] rounded-2xl border px-2 py-2 text-center transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40',
                meta.className,
              )}
            >
              <span className="block text-[12.5px] font-bold leading-none">
                {t(`study.rating${rating[0].toUpperCase()}${rating.slice(1)}`)}
              </span>
              <span className="mt-1 block text-[9.5px] font-semibold uppercase tracking-[0.06em] opacity-70">
                {meta.key} · {t(`study.rating${rating[0].toUpperCase()}${rating.slice(1)}Hint`)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ── Deck creation ──────────────────────────────────────────────────── */

function Sheet({
  open,
  title,
  description,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { t } = useSafeI18n();
  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[140] flex items-end justify-center p-3 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label={t('study.close')}
            onClick={onClose}
            className="absolute inset-0 bg-[#0B1020]/25 backdrop-blur-[2px]"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: 24, opacity: 0, scale: 0.99 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.99 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            className="relative z-10 max-h-[86vh] w-full max-w-[560px] overflow-y-auto rounded-[26px] border border-black/[0.06] bg-white/95 p-5 shadow-2xl backdrop-blur-2xl dark:border-white/[0.08] dark:bg-[#14151B]/95"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[17px] font-bold tracking-tight text-[#1D1D1F] dark:text-white">
                  {title}
                </h3>
                {description && (
                  <p className="mt-1 text-[12.5px] text-[#6B7280] dark:text-slate-400">
                    {description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t('study.close')}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[#6B7280] transition-colors hover:bg-black/[0.05] dark:text-slate-400 dark:hover:bg-white/[0.06]"
              >
                <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <div className="mt-4">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function NewDeckSheet({
  open,
  onClose,
  onCreate,
  pending,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (input: { title: string; subject?: string; accent: Accent; description?: string }) => void;
  pending: boolean;
}) {
  const { t } = useSafeI18n();
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [accent, setAccent] = useState<Accent>('indigo');

  useEffect(() => {
    if (open) {
      setTitle('');
      setSubject('');
      setAccent('indigo');
    }
  }, [open]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('study.createDeckTitle')}
      description={t('study.createDeckDesc')}
    >
      <div className="space-y-3">
        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6B7280] dark:text-slate-400">
            {t('study.titleField')}
          </span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t('study.titlePlaceholder')}
            maxLength={120}
            className="mt-1.5 min-h-[44px] w-full rounded-xl border border-black/[0.08] bg-white px-3.5 text-[13.5px] font-medium text-[#1D1D1F] outline-none transition-shadow focus:border-[#5B6CFF]/40 focus:ring-4 focus:ring-[#5B6CFF]/10 dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-white"
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6B7280] dark:text-slate-400">
            {t('study.subjectField')}
          </span>
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder={t('study.subjectPlaceholder')}
            maxLength={120}
            className="mt-1.5 min-h-[44px] w-full rounded-xl border border-black/[0.08] bg-white px-3.5 text-[13.5px] font-medium text-[#1D1D1F] outline-none transition-shadow focus:border-[#5B6CFF]/40 focus:ring-4 focus:ring-[#5B6CFF]/10 dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-white"
          />
        </label>
        <div>
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6B7280] dark:text-slate-400">
            {t('study.colorField')}
          </span>
          <div className="mt-2 flex gap-2">
            {ACCENT_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setAccent(key)}
                aria-label={t('study.colorAria', { name: key })}
                aria-pressed={accent === key}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full transition-transform duration-200',
                  accent === key ? 'scale-110' : 'hover:scale-105',
                )}
              >
                <span className={cn('h-6 w-6 rounded-full ring-2 ring-white dark:ring-[#14151B]', ACCENTS[key].dot)} />
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] rounded-xl border border-black/[0.08] px-4 text-[12.5px] font-bold text-[#4B5563] dark:border-white/[0.1] dark:text-slate-300"
        >
          {t('study.cancel')}
        </button>
        <button
          type="button"
          disabled={title.trim().length < 2 || pending}
          onClick={() => onCreate({ title: title.trim(), subject: subject.trim() || undefined, accent })}
          className="min-h-[44px] rounded-xl bg-[#1D1D1F] px-4 text-[12.5px] font-bold text-white transition-opacity disabled:opacity-40 dark:bg-white dark:text-[#1D1D1F]"
        >
          {pending ? t('study.creating') : t('study.create')}
        </button>
      </div>
    </Sheet>
  );
}

/* ── Deck manager ───────────────────────────────────────────────────── */

function DeckSheet({
  deck,
  onClose,
  onDeleteDeck,
}: {
  deck: DeckSummary | null;
  onClose: () => void;
  onDeleteDeck: (deck: DeckSummary) => void;
}) {
  const { t } = useSafeI18n();
  const queryClient = useQueryClient();
  const { push } = useToast();
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [bulk, setBulk] = useState('');

  const deckId = deck?.id ?? null;

  const cardsQuery = useQuery<DeckCard[]>({
    queryKey: ['study-deck-cards', deckId],
    queryFn: () => request<DeckCard[]>(`/study/decks/${deckId}/cards`),
    enabled: Boolean(deckId),
  });

  const addMutation = useMutation({
    mutationFn: (cards: { front: string; back: string }[]) =>
      request<{ created: number }>(`/study/decks/${deckId}/cards`, {
        method: 'POST',
        body: JSON.stringify({ cards }),
      }),
    onSuccess: (result) => {
      push('success', t('study.cardsAdded', { n: result.created }));
      setFront('');
      setBack('');
      setBulk('');
      void queryClient.invalidateQueries({ queryKey: ['study-overview'] });
      void queryClient.invalidateQueries({ queryKey: ['study-queue'] });
      void queryClient.invalidateQueries({ queryKey: ['study-deck-cards', deckId] });
    },
    onError: (error) => push('error', getErrorMessage(error)),
  });

  const deleteCardMutation = useMutation({
    mutationFn: (cardId: string) =>
      request(`/study/cards/${cardId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['study-overview'] });
      void queryClient.invalidateQueries({ queryKey: ['study-deck-cards', deckId] });
    },
    onError: (error) => push('error', getErrorMessage(error)),
  });

  useEffect(() => {
    setFront('');
    setBack('');
    setBulk('');
  }, [deckId]);

  const bulkCards = useMemo(() => {
    return bulk
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [left, ...restParts] = line.split('|');
        const right = restParts.join('|').trim();
        return { front: left.trim(), back: right };
      })
      .filter((card) => card.front.length > 0 && card.back.length > 0);
  }, [bulk]);

  if (!deck) return null;

  return (
    <Sheet
      open={Boolean(deck)}
      onClose={onClose}
      title={deck.title}
      description={t('study.manageCardsDesc', {
        n: cardsQuery.data?.length ?? deck.cardCount,
        due: deck.dueCount,
      })}
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-black/[0.06] p-3.5 dark:border-white/[0.08]">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6B7280] dark:text-slate-400">
            {t('study.addCard')}
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <textarea
              value={front}
              onChange={(event) => setFront(event.target.value)}
              placeholder={t('study.frontPlaceholder')}
              rows={2}
              maxLength={2000}
              className="min-h-[46px] w-full resize-y rounded-xl border border-black/[0.08] bg-white px-3 py-2.5 text-[13px] text-[#1D1D1F] outline-none focus:border-[#5B6CFF]/40 focus:ring-4 focus:ring-[#5B6CFF]/10 dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-white"
            />
            <textarea
              value={back}
              onChange={(event) => setBack(event.target.value)}
              placeholder={t('study.backPlaceholder')}
              rows={2}
              maxLength={4000}
              className="min-h-[46px] w-full resize-y rounded-xl border border-black/[0.08] bg-white px-3 py-2.5 text-[13px] text-[#1D1D1F] outline-none focus:border-[#5B6CFF]/40 focus:ring-4 focus:ring-[#5B6CFF]/10 dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-white"
            />
          </div>
          <button
            type="button"
            disabled={!front.trim() || !back.trim() || addMutation.isPending}
            onClick={() => addMutation.mutate([{ front: front.trim(), back: back.trim() }])}
            className="mt-2 min-h-10 w-full rounded-xl bg-[#1D1D1F] text-[12.5px] font-bold text-white disabled:opacity-40 dark:bg-white dark:text-[#1D1D1F]"
          >
            {addMutation.isPending ? t('study.adding') : t('study.addCardAction')}
          </button>
        </div>

        <div className="rounded-2xl border border-black/[0.06] p-3.5 dark:border-white/[0.08]">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6B7280] dark:text-slate-400">
            {t('study.bulkAdd')}
          </p>
          <p className="mt-1 text-[11.5px] text-[#8A8F98] dark:text-slate-500">
            {t('study.bulkHint')}
          </p>
          <textarea
            value={bulk}
            onChange={(event) => setBulk(event.target.value)}
            rows={4}
            placeholder={t('study.bulkExample')}
            className="mt-2 w-full resize-y rounded-xl border border-black/[0.08] bg-white px-3 py-2.5 font-mono text-[12px] text-[#1D1D1F] outline-none focus:border-[#5B6CFF]/40 focus:ring-4 focus:ring-[#5B6CFF]/10 dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-white"
          />
          <button
            type="button"
            disabled={bulkCards.length === 0 || addMutation.isPending}
            onClick={() => addMutation.mutate(bulkCards)}
            className="mt-2 min-h-10 w-full rounded-xl border border-[#5B6CFF]/25 bg-[#5B6CFF]/[0.08] text-[12.5px] font-bold text-[#4350C9] disabled:opacity-40 dark:text-[#A7B0FF]"
          >
            {bulkCards.length > 0
              ? t('study.bulkActionCount', { n: bulkCards.length })
              : t('study.bulkAction')}
          </button>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6B7280] dark:text-slate-400">
              {t('study.cardsHeading')}
            </p>
            <button
              type="button"
              onClick={() => onDeleteDeck(deck)}
              className="text-[11.5px] font-bold text-[#E05776] hover:underline"
            >
              {t('study.deleteDeck')}
            </button>
          </div>
          <div className="mt-2 max-h-[240px] space-y-1.5 overflow-y-auto pr-1">
            {cardsQuery.isPending && (
              <div className="space-y-1.5">
                {[0, 1, 2].map((key) => (
                  <div key={key} className="h-14 animate-pulse rounded-xl bg-black/[0.04] dark:bg-white/[0.05]" />
                ))}
              </div>
            )}
            {cardsQuery.isError && (
              <p className="rounded-xl bg-[#E05776]/[0.08] p-3 text-[12px] font-medium text-[#A93050]">
                {t('study.cardsError')}
              </p>
            )}
            {cardsQuery.data?.map((card) => (
              <div
                key={card.id}
                className="group flex items-start gap-3 rounded-xl border border-black/[0.05] bg-white/60 p-3 dark:border-white/[0.06] dark:bg-white/[0.03]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-semibold text-[#1D1D1F] dark:text-white">
                    {card.front}
                  </p>
                  <p className="mt-0.5 truncate text-[11.5px] text-[#6B7280] dark:text-slate-400">
                    {card.back}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-black/[0.04] px-2 py-0.5 text-[10px] font-bold text-[#6B7280] dark:bg-white/[0.06] dark:text-slate-400">
                  {card.intervalDays === 0
                    ? t('study.cardNew')
                    : t('study.cardInterval', { n: card.intervalDays })}
                </span>
                <button
                  type="button"
                  onClick={() => deleteCardMutation.mutate(card.id)}
                  aria-label={t('study.deleteCard')}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#9AA0A6] transition-colors hover:bg-[#E05776]/10 hover:text-[#E05776]"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
                  </svg>
                </button>
              </div>
            ))}
            {cardsQuery.data?.length === 0 && (
              <p className="rounded-xl border border-dashed border-black/[0.08] p-4 text-center text-[12px] text-[#8A8F98] dark:border-white/[0.1] dark:text-slate-500">
                {t('study.noCards')}
              </p>
            )}
          </div>
        </div>
      </div>
    </Sheet>
  );
}

/* ── Page ───────────────────────────────────────────────────────────── */

export function StudyStudioPage() {
  const { t } = useSafeI18n();
  usePageTitle(t('study.title'));
  const queryClient = useQueryClient();
  const { push } = useToast();
  const [newDeckOpen, setNewDeckOpen] = useState(false);
  const [managedDeck, setManagedDeck] = useState<DeckSummary | null>(null);
  const [deckToDelete, setDeckToDelete] = useState<DeckSummary | null>(null);
  const [reviewedIds, setReviewedIds] = useState<string[]>([]);

  const overviewQuery = useQuery<Overview>({
    queryKey: ['study-overview'],
    queryFn: () => request<Overview>('/study/overview'),
    staleTime: 30_000,
  });

  const queueQuery = useQuery<QueueCard[]>({
    queryKey: ['study-queue'],
    queryFn: () => request<QueueCard[]>('/study/queue?limit=40'),
    staleTime: 15_000,
  });

  const createDeckMutation = useMutation({
    mutationFn: (input: { title: string; subject?: string; accent: Accent }) =>
      request('/study/decks', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => {
      setNewDeckOpen(false);
      push('success', t('study.deckCreated'));
      void queryClient.invalidateQueries({ queryKey: ['study-overview'] });
    },
    onError: (error) => push('error', getErrorMessage(error)),
  });

  const deleteDeckMutation = useMutation({
    mutationFn: (deckId: string) =>
      request(`/study/decks/${deckId}`, { method: 'DELETE' }),
    onSuccess: () => {
      setDeckToDelete(null);
      setManagedDeck(null);
      push('success', t('study.deckDeleted'));
      void queryClient.invalidateQueries({ queryKey: ['study-overview'] });
      void queryClient.invalidateQueries({ queryKey: ['study-queue'] });
    },
    onError: (error) => push('error', getErrorMessage(error)),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ cardId, rating }: { cardId: string; rating: Rating }) =>
      request(`/study/cards/${cardId}/review`, {
        method: 'POST',
        body: JSON.stringify({ rating }),
      }),
    onSuccess: (_data, variables) => {
      setReviewedIds((prev) => [...prev, variables.cardId]);
      void queryClient.invalidateQueries({ queryKey: ['study-overview'] });
    },
    onError: (error) => push('error', getErrorMessage(error)),
  });

  const saveFocusMutation = useMutation({
    mutationFn: (minutes: number) =>
      request('/study/focus-sessions', {
        method: 'POST',
        body: JSON.stringify({ minutes, mode: 'FOCUS' }),
      }),
    onSuccess: () => {
      push('success', t('study.focusSaved'));
      void queryClient.invalidateQueries({ queryKey: ['study-overview'] });
    },
    onError: (error) => push('error', getErrorMessage(error)),
  });

  const handleSaveFocus = useCallback(
    (minutes: number) => {
      if (saveFocusMutation.isPending) return;
      saveFocusMutation.mutate(minutes);
    },
    [saveFocusMutation],
  );

  const activeCard = useMemo(
    () => (queueQuery.data ?? []).find((card) => !reviewedIds.includes(card.id)) ?? null,
    [queueQuery.data, reviewedIds],
  );

  const handleRate = useCallback(
    (rating: Rating) => {
      if (!activeCard || reviewMutation.isPending) return;
      reviewMutation.mutate({ cardId: activeCard.id, rating });
    },
    [activeCard, reviewMutation],
  );

  // Keyboard-first review: Space flips, 1–4 grade. Ignored while typing.
  useEffect(() => {
    if (!activeCard) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (target?.isContentEditable) return;
      const key = event.key.toLowerCase();
      const ratingByKey: Record<string, Rating> = {
        '1': 'again',
        '2': 'hard',
        '3': 'good',
        '4': 'easy',
      };
      const rating = ratingByKey[key];
      if (rating) {
        event.preventDefault();
        handleRate(rating);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeCard, handleRate]);

  const totals = overviewQuery.data?.totals;
  const decks = overviewQuery.data?.decks ?? [];
  const remaining = Math.max(0, (queueQuery.data?.length ?? 0) - reviewedIds.length);

  return (
    <>
      <SoftBackdrop />
      <div className="relative mx-auto w-full max-w-[1200px] pb-[max(6rem,env(safe-area-inset-bottom))]">
        <GlassPageHeader
          title={t('study.title')}
          description={t('study.subtitle')}
          actions={
            <button
              type="button"
              onClick={() => setNewDeckOpen(true)}
              className="min-h-[44px] rounded-full bg-[#1D1D1F] px-4 text-[12.5px] font-bold text-white shadow-[0_10px_24px_-14px_rgba(15,23,42,0.8)] transition-transform hover:-translate-y-0.5 dark:bg-white dark:text-[#1D1D1F]"
            >
              {t('study.newDeck')}
            </button>
          }
        />

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label={t('study.statDueLabel')}
            value={String(totals?.due ?? 0)}
            note={t('study.statDueNote')}
            tone="indigo"
          />
          <StatTile
            label={t('study.statStreakLabel')}
            value={t('study.dayCount', { n: totals?.streakDays ?? 0 })}
            note={t('study.statStreakNote')}
            tone="amber"
          />
          <StatTile
            label={t('study.statFocusLabel')}
            value={t('study.todayMinutes', { n: totals?.focusMinutesToday ?? 0 })}
            note={t('study.statFocusNote', { n: totals?.focusMinutesWeek ?? 0 })}
            tone="emerald"
          />
          <StatTile
            label={t('study.statAccuracyLabel')}
            value={`${totals?.accuracy7d ?? 0}%`}
            note={t('study.statAccuracyNote')}
            tone="violet"
          />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          {queueQuery.isError ? (
            <section className="flex min-h-[320px] flex-col items-center justify-center rounded-[28px] border border-[#E05776]/20 bg-[#E05776]/[0.05] p-6 text-center">
              <p className="text-[14px] font-bold text-[#A93050]">{t('study.queueError')}</p>
              <button
                type="button"
                onClick={() => void queueQuery.refetch()}
                className="mt-3 min-h-10 rounded-xl bg-[#A93050] px-4 text-[12.5px] font-bold text-white"
              >
                {t('study.retry')}
              </button>
            </section>
          ) : (
            <ReviewSurface
              card={activeCard}
              remaining={remaining}
              reviewed={reviewedIds.length}
              onRate={handleRate}
              pending={reviewMutation.isPending}
            />
          )}

          <FocusTimer
            minutesToday={totals?.focusMinutesToday ?? 0}
            minutesWeek={totals?.focusMinutesWeek ?? 0}
            onSave={handleSaveFocus}
            saving={saveFocusMutation.isPending}
          />
        </div>

        <div className="mt-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-bold tracking-tight text-[#1D1D1F] dark:text-white">
                {t('study.decksHeading')}
              </h2>
              <p className="mt-0.5 text-[12px] text-[#6B7280] dark:text-slate-400">
                {t('study.decksSummary', {
                  cards: totals?.cards ?? 0,
                  decks: decks.length,
                })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void overviewQuery.refetch()}
              className="min-h-[36px] rounded-full border border-black/[0.08] px-3 text-[11.5px] font-bold text-[#6B7280] transition-colors hover:bg-white dark:border-white/[0.1] dark:text-slate-400"
            >
              {t('study.refresh')}
            </button>
          </div>

          {overviewQuery.isPending ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((key) => (
                <div key={key} className="h-[120px] animate-pulse rounded-[22px] bg-black/[0.04] dark:bg-white/[0.05]" />
              ))}
            </div>
          ) : overviewQuery.isError ? (
            <p className="mt-3 rounded-2xl bg-[#E05776]/[0.07] p-4 text-[12.5px] font-medium text-[#A93050]">
              {t('study.overviewError')}
            </p>
          ) : decks.length === 0 ? (
            <div className="mt-3 rounded-[24px] border border-dashed border-black/[0.1] bg-white/60 p-8 text-center dark:border-white/[0.1] dark:bg-white/[0.03]">
              <p className="text-[14px] font-bold text-[#1D1D1F] dark:text-white">
                {t('study.emptyTitle')}
              </p>
              <p className="mx-auto mt-1 max-w-[380px] text-[12.5px] leading-relaxed text-[#6B7280] dark:text-slate-400">
                {t('study.emptyDesc')}
              </p>
              <button
                type="button"
                onClick={() => setNewDeckOpen(true)}
                className="mt-4 min-h-[44px] rounded-full bg-[#1D1D1F] px-5 text-[12.5px] font-bold text-white dark:bg-white dark:text-[#1D1D1F]"
              >
                {t('study.emptyCta')}
              </button>
            </div>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {decks.map((deck) => {
                const accent = accentOf(deck.accent);
                const a = ACCENTS[accent];
                return (
                  <motion.button
                    key={deck.id}
                    type="button"
                    onClick={() => setManagedDeck(deck)}
                    whileHover={{ y: -3 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                    className={cn(
                      'relative overflow-hidden rounded-[22px] border border-black/[0.06] bg-white/80 p-4 text-left shadow-[0_16px_40px_-34px_rgba(15,23,42,0.5)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.04]',
                      'ring-1 ring-inset',
                      a.ring,
                    )}
                  >
                    <div className={cn('absolute inset-0 bg-gradient-to-br opacity-60', a.soft)} />
                    <div className="relative">
                      <div className="flex items-start justify-between gap-2">
                        <span className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', a.dot)} />
                        <span
                          className={cn(
                            'rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold dark:bg-black/20',
                            a.text,
                          )}
                        >
                          {deck.dueCount > 0
                            ? t('study.dueInQueue', { n: deck.dueCount })
                            : t('study.deckReady')}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-[14px] font-bold leading-snug tracking-tight text-[#1D1D1F] dark:text-white">
                        {deck.title}
                      </p>
                      <p className="mt-1 truncate text-[11.5px] font-medium text-[#6B7280] dark:text-slate-400">
                        {deck.subject || t('study.generalSubject')} · {t('study.manageCardsDesc', {
                          n: deck.cardCount,
                          due: deck.dueCount,
                        })}
                      </p>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <NewDeckSheet
        open={newDeckOpen}
        onClose={() => setNewDeckOpen(false)}
        onCreate={(input) => createDeckMutation.mutate(input)}
        pending={createDeckMutation.isPending}
      />

      <DeckSheet
        deck={managedDeck}
        onClose={() => setManagedDeck(null)}
        onDeleteDeck={(deck) => setDeckToDelete(deck)}
      />

      <ConfirmDialog
        open={Boolean(deckToDelete)}
        onClose={() => setDeckToDelete(null)}
        onConfirm={() => {
          if (deckToDelete) deleteDeckMutation.mutate(deckToDelete.id);
        }}
        title={t('study.deleteDeckTitle')}
        description={t('study.deleteDeckDesc')}
        itemName={deckToDelete?.title}
        tone="danger"
        confirmLabel={t('study.delete')}
      />
    </>
  );
}

export default StudyStudioPage;
