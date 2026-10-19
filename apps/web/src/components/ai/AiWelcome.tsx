/**
 * ============================================================================
 * AiWelcome / AiQuickPrompt v2.0 — Copilot-grade premium
 * ============================================================================
 * Fixes:
 *  - Removed dead SPRING.snappy
 *  - Eliminated imperative onMouseEnter style writes (race with Framer Motion)
 *  - Gradient hero text now uses Tailwind bg-clip-text with proper fallback
 *    (text stays selectable, no Safari/Firefox quirks)
 *  - Replaced hardcoded #1D1D1F / #86868B with token vars (dark-mode correct)
 *  - Cards min-h fixed — grid never "jumps" between prompts with different
 *    hint lengths
 *  - focus ring moved to ring-[3px] + ring-offset-2 (Apple HIG)
 * Design:
 *  - Hero: breathing ambient glow (2 blobs), shimmer overlay, slow-rotate
 *    sparkle, larger tile, responsive 28→36px gradient title
 *  - Cards: shine sweep on hover, tone-colored border + glow via CSS vars,
 *    playful icon rotation, arrow slide-in, min-h-[120px]
 *  - Cleaner a11y: role="group" for grid, ring-offset, motion-reduce guards
 * ============================================================================
 */

import { type CSSProperties, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowUpRight,
  CalendarDays,
  ClipboardCheck,
  FileText,
  Megaphone,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/design';

/* ============================================================================
 * MOTION
 * ========================================================================== */

const SPRING = {
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
} as const;

/* ============================================================================
 * TONES
 * ========================================================================== */

type Tone = 'blue' | 'purple' | 'emerald' | 'orange' | 'cyan' | 'pink';

const TONES: Record<
  Tone,
  { fg: string; border: string; glow: string; gradient: string }
> = {
  blue: {
    fg: '#007AFF',
    border: 'rgba(0,122,255,0.28)',
    glow: 'rgba(0,122,255,0.32)',
    gradient: 'linear-gradient(135deg, #007AFF 0%, #32ADE6 100%)',
  },
  purple: {
    fg: '#AF52DE',
    border: 'rgba(175,82,222,0.28)',
    glow: 'rgba(175,82,222,0.32)',
    gradient: 'linear-gradient(135deg, #AF52DE 0%, #FF2D55 100%)',
  },
  emerald: {
    fg: '#10B981',
    border: 'rgba(16,185,129,0.28)',
    glow: 'rgba(16,185,129,0.32)',
    gradient: 'linear-gradient(135deg, #10B981 0%, #34C759 100%)',
  },
  orange: {
    fg: '#FF9500',
    border: 'rgba(255,149,0,0.28)',
    glow: 'rgba(255,149,0,0.32)',
    gradient: 'linear-gradient(135deg, #FF9500 0%, #FF2D55 100%)',
  },
  cyan: {
    fg: '#32ADE6',
    border: 'rgba(50,173,230,0.28)',
    glow: 'rgba(50,173,230,0.32)',
    gradient: 'linear-gradient(135deg, #32ADE6 0%, #007AFF 100%)',
  },
  pink: {
    fg: '#FF2D55',
    border: 'rgba(255,45,85,0.28)',
    glow: 'rgba(255,45,85,0.32)',
    gradient: 'linear-gradient(135deg, #FF2D55 0%, #AF52DE 100%)',
  },
};

/* ============================================================================
 * DATA
 * ========================================================================== */

export interface AiQuickPromptData {
  id: string;
  title: string;
  hint: string;
  text: string;
  icon: ReactNode;
  tone: Tone;
}

export const AI_QUICK_PROMPTS: AiQuickPromptData[] = [
  {
    id: 'attendance',
    title: 'Davomat',
    hint: 'Bugungi davomatni ko\'rsatish',
    text: 'Bugungi davomatni ko\'rsat',
    tone: 'blue',
    icon: <ClipboardCheck className="h-5 w-5" strokeWidth={1.9} />,
  },
  {
    id: 'schedule',
    title: 'Darslar',
    hint: 'Bugungi darslar jadvali',
    text: 'Bugungi darslar jadvalini ko\'rsat',
    tone: 'purple',
    icon: <CalendarDays className="h-5 w-5" strokeWidth={1.9} />,
  },
  {
    id: 'students',
    title: 'O\'quvchilar',
    hint: 'O\'quvchilarni qidirish',
    text: 'O\'quvchilarni ismi bo\'yicha qidirib ber',
    tone: 'emerald',
    icon: <Users className="h-5 w-5" strokeWidth={1.9} />,
  },
  {
    id: 'finance',
    title: 'To\'lovlar',
    hint: 'Qarzdorlar ro\'yxati',
    text: 'Qarzdorlar ro\'yxatini ko\'rsat',
    tone: 'orange',
    icon: <Wallet className="h-5 w-5" strokeWidth={1.9} />,
  },
  {
    id: 'report',
    title: 'Hisobot',
    hint: 'Qisqa kunlik hisobot',
    text: 'Bugungi darslar bo\'yicha qisqa hisobot tayyorla',
    tone: 'cyan',
    icon: <FileText className="h-5 w-5" strokeWidth={1.9} />,
  },
  {
    id: 'announcement',
    title: 'Xabarlar',
    hint: 'Telegram xabarini tayyorlash',
    text: 'Ota-onalarga Telegram xabarini tayyorlashni so\'rang',
    tone: 'pink',
    icon: <Megaphone className="h-5 w-5" strokeWidth={1.9} />,
  },
];

/* ============================================================================
 * AiQuickPrompt — single card
 * ========================================================================== */

export interface AiQuickPromptProps {
  prompt: AiQuickPromptData;
  disabled?: boolean;
  onSelect: (text: string) => void;
  index?: number;
}

export function AiQuickPrompt({
  prompt,
  disabled = false,
  onSelect,
  index = 0,
}: AiQuickPromptProps) {
  const tone = TONES[prompt.tone];
  const reduced = useReducedMotion();

  const styleVars = {
    '--tone-border': tone.border,
    '--tone-glow': tone.glow,
  } as CSSProperties;

  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(prompt.text)}
      initial={reduced ? false : { opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.15 + index * 0.05, ...SPRING.smooth }}
      whileHover={disabled || reduced ? undefined : { y: -4, scale: 1.01 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      aria-label={`${prompt.title} — ${prompt.hint}`}
      style={styleVars}
      className={cn(
        'group/prompt relative flex min-h-[120px] w-full flex-col items-start gap-3 overflow-hidden rounded-2xl border p-4 text-left outline-none',
        'border-black/[0.06] bg-white/70 backdrop-blur-xl',
        'dark:border-white/[0.08] dark:bg-white/[0.04]',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_4px_16px_-10px_rgba(0,0,0,0.10)]',
        'dark:shadow-none',
        'transition-[border-color,box-shadow] duration-300 ease-out',
        'hover:border-[color:var(--tone-border)]',
        'hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_12px_32px_-14px_var(--tone-glow)]',
        'focus-visible:ring-[3px] focus-visible:ring-[rgba(0,122,255,0.4)] focus-visible:ring-offset-2',
        'focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#1C1C1E]',
        'disabled:cursor-not-allowed disabled:opacity-45'
      )}
    >
      {/* Shine sweep on hover */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 ease-out group-hover/prompt:translate-x-full dark:via-white/10 motion-reduce:hidden"
      />

      {/* Icon tile — playful rotate on hover */}
      <div
        className={cn(
          'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white',
          'transition-transform duration-300 ease-out',
          'group-hover/prompt:-rotate-[4deg] group-hover/prompt:scale-105',
          'motion-reduce:group-hover/prompt:rotate-0 motion-reduce:group-hover/prompt:scale-100'
        )}
        style={{
          background: tone.gradient,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.4), 0 8px 20px -8px ${tone.glow}`,
        }}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-xl"
          style={{
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.45), transparent 55%)',
          }}
        />
        <span className="relative">{prompt.icon}</span>
      </div>

      {/* Text + arrow */}
      <div className="relative w-full min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[14px] font-semibold tracking-tight text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,#F5F5F7)]">
            {prompt.title}
          </p>
          <ArrowUpRight
            aria-hidden="true"
            className="mt-0.5 h-3.5 w-3.5 shrink-0 -translate-x-1 text-[var(--text-tertiary,#C7C7CC)] opacity-0 transition-all duration-200 ease-out group-hover/prompt:translate-x-0 group-hover/prompt:opacity-100 motion-reduce:transition-none"
          />
        </div>
        <p className="mt-1 line-clamp-2 text-[12px] font-medium leading-relaxed text-[var(--text-secondary,#86868B)] dark:text-[var(--text-secondary,#A1A1A6)]">
          {prompt.hint}
        </p>
      </div>
    </motion.button>
  );
}

/* ============================================================================
 * AiWelcome — full empty state
 * ========================================================================== */

export interface AiWelcomeProps {
  disabled?: boolean;
  onSelect?: (text: string) => void;
  onSelectPrompt?: (text: string) => void;
}

export function AiWelcome({
  disabled = false,
  onSelect,
  onSelectPrompt,
}: AiWelcomeProps) {
  const reduced = useReducedMotion();

  const handleSelect = (text: string) => {
    onSelect?.(text);
    onSelectPrompt?.(text);
  };

  return (
    <div className="relative flex min-h-full items-center justify-center overflow-hidden px-4 py-8 sm:px-6 sm:py-12">
      {/* Ambient background — very subtle, mirrors Copilot hero */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(0,122,255,0.06),transparent_60%)] blur-3xl dark:bg-[radial-gradient(circle,rgba(0,122,255,0.12),transparent_60%)]" />
        <div className="absolute bottom-0 left-1/2 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(175,82,222,0.05),transparent_60%)] blur-3xl dark:bg-[radial-gradient(circle,rgba(175,82,222,0.10),transparent_60%)]" />
      </div>

      <div className="mx-auto w-full max-w-2xl text-center">
        {/* Hero icon — breathing glow + shimmer + slow sparkle */}
        <motion.div
          initial={reduced ? false : { scale: 0.85, opacity: 0, rotate: -8 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 22 }}
          className="relative mx-auto mb-7 flex h-14 w-14 items-center justify-center sm:mb-8 sm:h-16 sm:w-16"
        >
          {/* Ambient glow blobs (breathing) */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -m-6 sm:-m-8">
            <div className="absolute inset-0 rounded-full bg-[#007AFF]/30 blur-3xl motion-safe:animate-[heroGlowPulse_6s_ease-in-out_infinite]" />
            <div className="absolute inset-0 rounded-full bg-[#AF52DE]/25 blur-3xl motion-safe:animate-[heroGlowPulse_6s_ease-in-out_infinite_1.5s]" />
          </div>

          {/* Gradient tile */}
          <div
            className="relative flex h-14 w-14 items-center justify-center rounded-2xl text-white sm:h-16 sm:w-16 sm:rounded-3xl"
            style={{
              background: 'linear-gradient(135deg, #007AFF 0%, #AF52DE 100%)',
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 0 rgba(0,0,0,0.10), ' +
                '0 16px 40px -12px rgba(0,122,255,0.55), 0 8px 24px -8px rgba(175,82,222,0.4)',
            }}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-2xl sm:rounded-3xl"
              style={{
                background:
                  'linear-gradient(180deg, rgba(255,255,255,0.45), transparent 55%)',
              }}
            />
            <motion.div
              animate={reduced ? undefined : { rotate: 360 }}
              transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
              className="relative h-6 w-6 sm:h-7 sm:w-7"
            >
              <Sparkles className="h-full w-full" strokeWidth={1.75} />
            </motion.div>
          </div>
        </motion.div>

        {/* Hero title — gradient text with proper fallback */}
        <h2 className="text-balance text-[28px] font-bold leading-[1.15] tracking-[-0.025em] sm:text-[36px]">
          <span className="bg-gradient-to-br from-[#007AFF] via-[#AF52DE] to-[#FF2D55] bg-clip-text text-transparent dark:from-[#409CFF] dark:via-[#C77DFF] dark:to-[#FF6B8A]">
            Bugun sizga qanday yordam beray?
          </span>
        </h2>

        <p className="mx-auto mt-3 max-w-lg text-balance text-[14px] font-medium leading-relaxed text-[var(--text-secondary,#86868B)] dark:text-[var(--text-secondary,#A1A1A6)]">
          M-EDU tizimidagi ma'lumotlarni tahlil qiling, hisobotlar tayyorlang yoki
          kundalik vazifalarni AI yordamida tezlashtiring.
        </p>

        {/* Prompt grid */}
        <div
          role="group"
          aria-label="Tezkor AI so'rovlar"
          className="mt-8 grid gap-3 sm:grid-cols-2 sm:gap-3.5 lg:grid-cols-3"
        >
          {AI_QUICK_PROMPTS.map((prompt, i) => (
            <AiQuickPrompt
              key={prompt.id}
              prompt={prompt}
              disabled={disabled}
              onSelect={handleSelect}
              index={i}
            />
          ))}
        </div>
      </div>

      {/* Scoped keyframes */}
      <style>{`
        @keyframes heroGlowPulse {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50%      { opacity: 1;   transform: scale(1.15); }
        }
      `}</style>
    </div>
  );
}

export default AiWelcome;