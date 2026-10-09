/**
 * AiWelcome / AiQuickPrompt — Ultra Premium Edition
 *
 * Exports:
 *  - AI_QUICK_PROMPTS (const array)
 *  - AiQuickPromptData (interface)
 *  - AiQuickPrompt (single card component)  ← ✅ TUZATILDI
 *  - AiWelcome (full empty state)
 *  - default: AiWelcome
 */

import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  CalendarDays,
  ClipboardCheck,
  FileText,
  Megaphone,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';

/* ============================================================================
 * MOTION
 * ========================================================================== */

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
} as const;

/* ============================================================================
 * TONES
 * ========================================================================== */

type Tone = 'blue' | 'purple' | 'emerald' | 'orange' | 'cyan' | 'pink';

const TONES: Record<
  Tone,
  { fg: string; bg: string; border: string; glow: string; gradient: string }
> = {
  blue: {
    fg: '#007AFF',
    bg: 'rgba(0,122,255,0.10)',
    border: 'rgba(0,122,255,0.22)',
    glow: 'rgba(0,122,255,0.28)',
    gradient: 'linear-gradient(135deg, #007AFF 0%, #32ADE6 100%)',
  },
  purple: {
    fg: '#AF52DE',
    bg: 'rgba(175,82,222,0.10)',
    border: 'rgba(175,82,222,0.22)',
    glow: 'rgba(175,82,222,0.28)',
    gradient: 'linear-gradient(135deg, #AF52DE 0%, #FF2D55 100%)',
  },
  emerald: {
    fg: '#10B981',
    bg: 'rgba(16,185,129,0.10)',
    border: 'rgba(16,185,129,0.22)',
    glow: 'rgba(16,185,129,0.28)',
    gradient: 'linear-gradient(135deg, #10B981 0%, #34C759 100%)',
  },
  orange: {
    fg: '#FF9500',
    bg: 'rgba(255,149,0,0.10)',
    border: 'rgba(255,149,0,0.22)',
    glow: 'rgba(255,149,0,0.28)',
    gradient: 'linear-gradient(135deg, #FF9500 0%, #FF2D55 100%)',
  },
  cyan: {
    fg: '#32ADE6',
    bg: 'rgba(50,173,230,0.10)',
    border: 'rgba(50,173,230,0.22)',
    glow: 'rgba(50,173,230,0.28)',
    gradient: 'linear-gradient(135deg, #32ADE6 0%, #007AFF 100%)',
  },
  pink: {
    fg: '#FF2D55',
    bg: 'rgba(255,45,85,0.10)',
    border: 'rgba(255,45,85,0.22)',
    glow: 'rgba(255,45,85,0.28)',
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
    hint: 'Bugungi davomatni ko’rsatish',
    text: 'Bugungi davomatni ko’rsat',
    tone: 'blue',
    icon: <ClipboardCheck className="h-5 w-5" strokeWidth={1.9} />,
  },
  {
    id: 'schedule',
    title: 'Darslar',
    hint: 'Bugungi darslar jadvali',
    text: 'Bugungi darslar jadvalini ko’rsat',
    tone: 'purple',
    icon: <CalendarDays className="h-5 w-5" strokeWidth={1.9} />,
  },
  {
    id: 'students',
    title: 'O’quvchilar',
    hint: 'O’quvchilarni qidirish',
    text: 'O’quvchilarni ismi bo’yicha qidirib ber',
    tone: 'emerald',
    icon: <Users className="h-5 w-5" strokeWidth={1.9} />,
  },
  {
    id: 'finance',
    title: 'To’lovlar',
    hint: 'Qarzdorlar ro’yxati',
    text: 'Qarzdorlar ro’yxatini ko’rsat',
    tone: 'orange',
    icon: <Wallet className="h-5 w-5" strokeWidth={1.9} />,
  },
  {
    id: 'report',
    title: 'Hisobot',
    hint: 'Qisqa kunlik hisobot',
    text: 'Bugungi darslar bo’yicha qisqa hisobot tayyorla',
    tone: 'cyan',
    icon: <FileText className="h-5 w-5" strokeWidth={1.9} />,
  },
  {
    id: 'announcement',
    title: 'Xabarlar',
    hint: 'Telegram xabarini tayyorlash',
    text: 'Ota-onalarga Telegram xabarini tayyorlashni so’rang',
    tone: 'pink',
    icon: <Megaphone className="h-5 w-5" strokeWidth={1.9} />,
  },
];

/* ============================================================================
 * AiQuickPrompt — single card (exported!)
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

  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(prompt.text)}
      initial={reduced ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 + index * 0.05, ...SPRING.smooth }}
      whileHover={disabled || reduced ? undefined : { y: -3, scale: 1.01 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      aria-label={`${prompt.title} — ${prompt.hint}`}
      className="group/prompt relative flex flex-col items-start gap-3 overflow-hidden rounded-2xl border p-4 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#007AFF]/40 disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        borderColor: 'rgba(0,0,0,0.06)',
        background: 'rgba(255,255,255,0.7)',
        backdropFilter: 'blur(20px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.5)',
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.8), 0 4px 16px -10px rgba(0,0,0,0.10)',
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.borderColor = tone.border;
        e.currentTarget.style.boxShadow = `inset 0 1px 0 rgba(255,255,255,0.8), 0 12px 32px -14px ${tone.glow}`;
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        e.currentTarget.style.borderColor = 'rgba(0,0,0,0.06)';
        e.currentTarget.style.boxShadow =
          'inset 0 1px 0 rgba(255,255,255,0.8), 0 4px 16px -10px rgba(0,0,0,0.10)';
      }}
    >
      {/* Gradient icon tile */}
      <div
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
        style={{
          background: tone.gradient,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.4), 0 6px 16px -8px ${tone.glow}`,
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-xl"
          style={{
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.4), transparent 55%)',
          }}
        />
        <span className="relative">{prompt.icon}</span>
      </div>

      {/* Text */}
      <div className="min-w-0">
        <p className="text-[13.5px] font-semibold tracking-tight text-[#1D1D1F]">
          {prompt.title}
        </p>
        <p className="mt-0.5 text-[11.5px] font-medium leading-tight text-[#86868B]">
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
    <div className="flex min-h-full items-center justify-center px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-2xl text-center">
        {/* Hero icon — gradient sparkle */}
        <motion.div
          initial={reduced ? false : { scale: 0.85, opacity: 0, rotate: -8 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 22 }}
          className="relative mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl text-white"
          style={{
            background: 'linear-gradient(135deg, #007AFF 0%, #AF52DE 100%)',
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.45), ' +
              'inset 0 -1px 0 rgba(0,0,0,0.10), ' +
              '0 12px 32px -12px rgba(0,122,255,0.55)',
          }}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-2xl"
            style={{
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.45), transparent 55%)',
            }}
          />
          <motion.div
            animate={reduced ? undefined : { rotate: 360 }}
            transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
            className="relative h-6 w-6"
          >
            <Sparkles className="h-6 w-6" strokeWidth={1.9} />
          </motion.div>
        </motion.div>

        {/* Hero text */}
        <h2 
          className="text-[26px] font-extrabold leading-tight tracking-[-0.02em] sm:text-[32px]"
          style={{
            background: 'linear-gradient(135deg, #007AFF 0%, #AF52DE 50%, #FF2D55 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            color: 'transparent'
          }}
        >
          Bugun sizga qanday yordam beray?
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-[14px] font-medium leading-relaxed text-[#86868B]">
          M-EDU tizimidagi ma’lumotlarni tahlil qiling, hisobotlar tayyorlang yoki kundalik vazifalarni AI yordamida tezlashtiring.
        </p>

        {/* 3-column prompt grid */}
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
    </div>
  );
}

export default AiWelcome;