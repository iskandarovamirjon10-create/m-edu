/**
 * AiWelcome / AiQuickPrompt — the Copilot's first impression.
 * ============================================================================
 * iOS 27 "studio" treatment: a floating orb, an aurora-lit headline and six
 * capability tiles with spring hover, graceful stagger and a specular sweep.
 *
 * Contract kept for hosts + tests:
 *  - heading text remains "Bugun sizga qanday yordam beray?"
 *  - each tile is a button whose accessible name is "<Title> — <hint>"
 *  - the grid carries `grid gap-3 sm:grid-cols-2 lg:grid-cols-3`
 *  - selecting "Davomat" sends "Bugungi davomatni ko'rsat"
 * ============================================================================
 */
import { useId, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  IconArrowDown,
  IconAttendance,
  IconChevronRight,
  IconFinance,
  IconMegaphone,
  IconReport,
  IconSchedule,
  IconStudents,
} from './copilotIcons';
import { CopilotKbd } from './CopilotControls';
import { cn } from '@/lib/design';
import { MeduAiLogo } from '@/components/brand/MeduAiLogo';
import { useSafeI18n } from '@/i18n/I18nProvider';

/* ─────────────────────────────────────────────────────────────────────────
 * Utilities
 * ─────────────────────────────────────────────────────────────────────── */

function haptic(kind: 'tap' | 'success' = 'tap') {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(kind === 'success' ? [10, 26, 10] : 8);
  } catch {
    /* noop */
  }
}

function resolve(
  t: ((key: string, fallback?: string) => string) | undefined,
  key: string,
  fallback: string,
): string {
  if (!t) return fallback;
  try {
    const value = t(key, fallback);
    return !value || value === key ? fallback : value;
  } catch {
    return fallback;
  }
}

/* ─────────────────────────────────────────────────────────────────────────
 * Catalog
 * ─────────────────────────────────────────────────────────────────────── */

type Tone = 'blue' | 'violet' | 'emerald' | 'amber' | 'cyan' | 'pink';

export type AiQuickPromptId =
  | 'attendance'
  | 'schedule'
  | 'students'
  | 'finance'
  | 'report'
  | 'announcement';

interface PromptMeta {
  id: AiQuickPromptId;
  tone: Tone;
  icon: ReactNode;
  digit: string;
  gradient: string;
  glow: string;
}

const TONE_GRADIENT: Record<Tone, { gradient: string; glow: string; text: string }> = {
  blue: { gradient: 'linear-gradient(140deg,#0A84FF,#32ADE6)', glow: 'rgba(10,132,255,0.55)', text: '#0A84FF' },
  violet: { gradient: 'linear-gradient(140deg,#5E5CE6,#BF5AF2)', glow: 'rgba(94,92,230,0.5)', text: '#5E5CE6' },
  emerald: { gradient: 'linear-gradient(140deg,#30D158,#10B981)', glow: 'rgba(48,209,88,0.45)', text: '#1EB954' },
  amber: { gradient: 'linear-gradient(140deg,#FF9F0A,#FF375F)', glow: 'rgba(255,159,10,0.5)', text: '#FF9500' },
  cyan: { gradient: 'linear-gradient(140deg,#32ADE6,#0A84FF)', glow: 'rgba(50,173,230,0.5)', text: '#32ADE6' },
  pink: { gradient: 'linear-gradient(140deg,#FF375F,#BF5AF2)', glow: 'rgba(255,55,95,0.5)', text: '#FF375F' },
};

const PROMPT_META: PromptMeta[] = [
  { id: 'attendance', tone: 'blue', digit: '1', icon: <IconAttendance size={20} />, gradient: TONE_GRADIENT.blue.gradient, glow: TONE_GRADIENT.blue.glow },
  { id: 'schedule', tone: 'violet', digit: '2', icon: <IconSchedule size={20} />, gradient: TONE_GRADIENT.violet.gradient, glow: TONE_GRADIENT.violet.glow },
  { id: 'students', tone: 'emerald', digit: '3', icon: <IconStudents size={20} />, gradient: TONE_GRADIENT.emerald.gradient, glow: TONE_GRADIENT.emerald.glow },
  { id: 'finance', tone: 'amber', digit: '4', icon: <IconFinance size={20} />, gradient: TONE_GRADIENT.amber.gradient, glow: TONE_GRADIENT.amber.glow },
  { id: 'report', tone: 'cyan', digit: '5', icon: <IconReport size={20} />, gradient: TONE_GRADIENT.cyan.gradient, glow: TONE_GRADIENT.cyan.glow },
  { id: 'announcement', tone: 'pink', digit: '6', icon: <IconMegaphone size={20} />, gradient: TONE_GRADIENT.pink.gradient, glow: TONE_GRADIENT.pink.glow },
];

interface PromptCopy {
  title: string;
  hint: string;
  text: string;
}

const FALLBACK_COPY: Record<AiQuickPromptId, PromptCopy> = {
  attendance: {
    title: 'Davomat',
    hint: "Bugungi davomatni ko'rsating",
    text: "Bugungi davomatni ko'rsat",
  },
  schedule: {
    title: 'Darslar',
    hint: 'Bugungi dars jadvali va xonalar',
    text: "Bugungi darslar jadvalini ko'rsat",
  },
  students: {
    title: "O'quvchilar",
    hint: 'Guruhlar va o‘quvchilar ro‘yxati',
    text: "Guruhlar va o'quvchilar ro'yxatini ko'rsat",
  },
  finance: {
    title: "To'lovlar",
    hint: "Qarzdorlar va to'lovlar holati",
    text: "To'lovlar va qarzdorlar holatini ko'rsat",
  },
  report: {
    title: 'Hisobot',
    hint: 'Kunlik boshqaruv hisoboti',
    text: "Bugungi boshqaruv hisobotini tayyorla",
  },
  announcement: {
    title: 'Xabarlar',
    hint: "Ota-onalarga e'lon yuborish",
    text: "Ota-onalarga e'lon tayyorlab ber",
  },
};

export interface AiQuickPromptData {
  id: string;
  title: string;
  hint: string;
  text: string;
  icon: ReactNode;
  tone: Tone;
  digit?: string;
}

/** i18n-aware catalog used by hosts that want to override copy. */
export function useAiQuickPrompts(
  t?: (key: string, fallback?: string) => string,
): AiQuickPromptData[] {
  return useMemo(
    () =>
      PROMPT_META.map((meta) => {
        const copy = FALLBACK_COPY[meta.id];
        return {
          id: meta.id,
          tone: meta.tone,
          icon: meta.icon,
          digit: meta.digit,
          title: resolve(t, `ai.quickPrompts.${meta.id}.title`, copy.title),
          hint: resolve(t, `ai.quickPrompts.${meta.id}.hint`, copy.hint),
          text: resolve(t, `ai.quickPrompts.${meta.id}.text`, copy.text),
        };
      }),
    [t],
  );
}

/** Backward-compatible static list. */
export const AI_QUICK_PROMPTS: AiQuickPromptData[] = PROMPT_META.map((meta) => {
  const copy = FALLBACK_COPY[meta.id];
  return { id: meta.id, tone: meta.tone, icon: meta.icon, digit: meta.digit, ...copy };
});

/* ─────────────────────────────────────────────────────────────────────────
 * Tile
 * ─────────────────────────────────────────────────────────────────────── */

export interface AiQuickPromptProps {
  prompt: AiQuickPromptData;
  disabled?: boolean;
  selected?: boolean;
  onSelect: (text: string) => void;
  index?: number;
  isApple?: boolean;
}

export function AiQuickPrompt({
  prompt,
  disabled = false,
  selected = false,
  onSelect,
  index = 0,
  isApple,
}: AiQuickPromptProps) {
  const reduced = Boolean(useReducedMotion());
  const [pressed, setPressed] = useState(false);
  const tone = TONE_GRADIENT[prompt.tone];
  const shortcut = prompt.digit
    ? isApple === false
      ? `Ctrl+${prompt.digit}`
      : `⌘${prompt.digit}`
    : undefined;

  const styleVars = {
    '--cp-prompt-glow': tone.glow,
    '--cp-prompt-tone': tone.text,
  } as CSSProperties;

  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        setPressed(true);
        haptic('tap');
        onSelect(prompt.text);
        window.setTimeout(() => setPressed(false), 220);
      }}
      initial={reduced ? false : { opacity: 0, y: 18, scale: 0.965 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay: reduced ? 0 : Math.min(index * 0.045, 0.24),
        type: 'spring',
        stiffness: 380,
        damping: 30,
        mass: 0.85,
      }}
      whileTap={reduced || disabled ? undefined : { scale: 0.975 }}
      aria-label={`${prompt.title} — ${prompt.hint}`}
      aria-pressed={selected}
      aria-busy={disabled || undefined}
      style={styleVars}
      className={cn(
        'cp-prompt group/prompt flex min-h-[132px] w-full flex-col justify-between gap-3 p-4',
        'outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--cp-accent)]',
        selected && 'border-[color:var(--cp-prompt-tone)]',
        disabled && 'pointer-events-none opacity-45',
      )}
    >
      <span className="flex items-start justify-between gap-2">
        <span
          aria-hidden="true"
          className="cp-prompt__icon relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-white transition-transform duration-300 ease-out group-hover/prompt:-rotate-3 group-hover/prompt:scale-105 motion-reduce:transform-none"
          style={{ background: tone.gradient }}
        >
          <span className="pointer-events-none absolute inset-0 rounded-[14px] bg-[linear-gradient(180deg,rgba(255,255,255,0.42),transparent_58%)]" />
          <span className="relative">{prompt.icon}</span>
        </span>

        <span className="flex items-center gap-1.5">
          {shortcut && (
            <CopilotKbd>{shortcut}</CopilotKbd>
          )}
          <span
            aria-hidden="true"
            className="flex h-6 w-6 items-center justify-center rounded-full border border-[color:var(--cp-hairline)] bg-[color:var(--cp-surface-sunken)] text-[color:var(--cp-text-quaternary)] transition-all duration-200 group-hover/prompt:border-[color:var(--cp-accent-line)] group-hover/prompt:text-[color:var(--cp-accent)]"
          >
            <IconChevronRight size={12} />
          </span>
        </span>
      </span>

      <span className="min-w-0">
        <span className="block text-[14px] font-semibold tracking-[-0.015em] text-[color:var(--cp-text)]">
          {prompt.title}
        </span>
        <span className="mt-0.5 block text-[12px] leading-relaxed text-[color:var(--cp-text-tertiary)]">
          {prompt.hint}
        </span>
      </span>

      {pressed && !reduced && (
        <motion.span
          aria-hidden="true"
          initial={{ scale: 0, opacity: 0.3 }}
          animate={{ scale: 2.6, opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="pointer-events-none absolute left-5 top-5 h-14 w-14 rounded-full"
          style={{ background: tone.glow }}
        />
      )}
    </motion.button>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Welcome
 * ─────────────────────────────────────────────────────────────────────── */

export interface AiWelcomeProps {
  disabled?: boolean;
  selectedId?: string;
  onSelect?: (text: string) => void;
  /** Deprecated alias — `onSelect` wins. */
  onSelectPrompt?: (text: string) => void;
  prompts?: AiQuickPromptData[];
  t?: (key: string, fallback?: string) => string;
  /** Compact variant for the floating panel. */
  compact?: boolean;
  userName?: string;
}

export function AiWelcome({
  disabled = false,
  selectedId,
  onSelect,
  onSelectPrompt,
  prompts,
  t,
  compact = false,
  userName,
}: AiWelcomeProps) {
  const reduced = Boolean(useReducedMotion());
  const i18n = useSafeI18n();
  const idPrefix = useId();
  const tx = t ?? ((key: string, fallback?: string) => resolve(i18n.t, key, fallback ?? key));
  const generatedCatalog = useAiQuickPrompts(tx);
  const catalog = prompts ?? generatedCatalog;

  const handleSelect = (text: string) => (onSelect ?? onSelectPrompt)?.(text);

  const isApple =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || '');
  const greeting = userName ? `${userName},` : null;

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center min-h-full w-full overflow-hidden px-4',
        compact ? 'py-4 sm:py-6' : 'py-8 sm:py-12',
      )}
    >
      {/* Ambient light — CSS only, respects reduced data/motion. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-14%] h-[26rem] w-[26rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(10,132,255,0.16),transparent_62%)] blur-3xl dark:bg-[radial-gradient(circle,rgba(10,132,255,0.22),transparent_62%)]" />
        <div className="absolute bottom-[-22%] left-1/2 h-[22rem] w-[22rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(191,90,242,0.12),transparent_64%)] blur-3xl" />
      </div>

      <div className={cn('cp-enter-rise relative mx-auto w-full', compact ? 'max-w-xl' : 'max-w-2xl')}>
        {/* Orb */}
        <div className="relative mx-auto mb-6 flex h-16 w-16 items-center justify-center sm:h-[72px] sm:w-[72px]">
          {!reduced && (
            <motion.span
              aria-hidden="true"
              className="absolute -inset-1 rounded-[26px] opacity-70"
              style={{
                background:
                  'conic-gradient(from 0deg,#0A84FF,#5E5CE6,#BF5AF2,#FF375F,#FF9F0A,#0A84FF)',
                WebkitMask:
                  'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
                WebkitMaskComposite: 'xor',
                maskComposite: 'exclude',
                padding: 1.5,
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
            />
          )}
          <div
            aria-hidden="true"
            className="relative flex h-full w-full items-center justify-center rounded-[24px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_20px_46px_-16px_rgba(10,132,255,0.7)]"
            style={{ background: 'var(--cp-brand-gradient)' }}
          >
            <MeduAiLogo size="xl" glow interactive />
          </div>
        </div>

        {/* Eyebrow */}
        <div className="mb-3 flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--cp-hairline)] bg-[color:var(--cp-surface)] px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[color:var(--cp-text-tertiary)] backdrop-blur-xl">
            <span className="cp-live-dot" aria-hidden="true" />
            M-EDU Copilot · Studio
          </span>
        </div>

        <h2 className="text-balance text-center text-[26px] font-bold leading-[1.12] tracking-[-0.03em] sm:text-[34px]">
          {greeting && (
            <span className="block pb-1 text-[15px] font-semibold tracking-normal text-[color:var(--cp-text-tertiary)]">
              {greeting}
            </span>
          )}
          <span className="bg-[linear-gradient(100deg,var(--cp-text)_18%,var(--cp-accent)_52%,var(--cp-violet)_82%)] bg-clip-text text-transparent">
            Bugun sizga qanday yordam beray?
          </span>
        </h2>

        <p className="mx-auto mt-3 max-w-lg text-balance text-center text-[13.5px] font-medium leading-relaxed text-[color:var(--cp-text-tertiary)]">
          M-EDU ma'lumotlarini tahlil qiling, hisobot tayyorlang yoki kundalik
          vazifalarni bir suhbatda hal qiling.
        </p>

        {/* Capabilities */}
        <ul
          role="list"
          aria-label="Tezkor AI so'rovlar"
          className={cn('mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3', compact && 'mt-4 sm:grid-cols-2 lg:grid-cols-2 gap-2.5')}
        >
          {catalog.map((prompt, index) => (
            <li key={prompt.id} role="listitem">
              <AiQuickPrompt
                prompt={prompt}
                disabled={disabled}
                selected={selectedId === prompt.id}
                onSelect={handleSelect}
                index={index}
                isApple={isApple}
              />
            </li>
          ))}
        </ul>

        {/* Comfort footer */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[10.5px] font-medium text-[color:var(--cp-text-quaternary)]">
          <span className="hidden items-center gap-1.5 sm:inline-flex">
            <CopilotKbd>⌘K</CopilotKbd> buyruqlar
          </span>
          <span className="hidden items-center gap-1.5 sm:inline-flex">
            <CopilotKbd>/</CopilotKbd> tezkor buyruq
          </span>
          <span className="inline-flex items-center gap-1.5">
            <IconArrowDown size={12} />
            suhbatni pastga suring
          </span>
        </div>

        <span id={`${idPrefix}-anchor`} hidden aria-hidden="true" />
      </div>
    </div>
  );
}

export default AiWelcome;
