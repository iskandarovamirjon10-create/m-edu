/**
 * ============================================================================
 * AiThinking v2.0 — Liquid Glass + Premium Motion
 * ============================================================================
 * Fixes:
 *  - showDetails prop now respected (defaultExpanded)
 *  - resolveTranslation helper — no raw-key leaks
 *  - py-[1px] (was invalid py-0.2)
 *  - Shimmer replaced: overlay sheen works in both light/dark
 *  - aria-busy reflects activeStep < 3
 *  - conic ring radius matches inner tile (rounded-2xl)
 *  - steps array memoized
 *  - toggle button dark-mode color + aria-expanded
 *  - sparkle rotation softened (±3°, was ±10°)
 * Design — Liquid Glass:
 *  - 4-layer glass surface (gradient + dark override + specular top/bottom
 *    edges + inner corner glow)
 *  - Ambient tone-aware radial leak pulses with current step
 *  - Slow glint sweep across the surface
 *  - Comet progress track (gradient + glowing head)
 *  - Crossfading step labels (AnimatePresence mode="wait")
 *  - Step-completed checkmark pop + pulsing current-step indicator
 *  - Stacked glass timeline (opacity-based — Safari-safe)
 * ============================================================================
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Sparkles, ChevronDown, CheckCircle2, Search, Database, Cpu } from 'lucide-react';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/design';

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  liquid: { type: 'spring', stiffness: 380, damping: 26, mass: 0.85 },
} as const;

/** Per-step tones — progression mirrors the AiWelcome gradient (blue→purple). */
const STEP_TONES = [
  { fg: '#007AFF', ring: 'rgba(0,122,255,0.22)', glow: 'rgba(0,122,255,0.35)' },
  { fg: '#5856D6', ring: 'rgba(88,86,214,0.22)', glow: 'rgba(88,86,214,0.35)' },
  { fg: '#AF52DE', ring: 'rgba(175,82,222,0.22)', glow: 'rgba(175,82,222,0.35)' },
] as const;

function resolveTranslation(
  t: (key: string) => string,
  key: string,
  fallback: string,
): string {
  try {
    const v = t(key);
    return !v || v === key ? fallback : v;
  } catch {
    return fallback;
  }
}

export interface AiThinkingProps {
  label?: string;
  step?: number;
  showDetails?: boolean;
}

export function AiThinking({
  label,
  step: externalStep,
  showDetails = false,
}: AiThinkingProps) {
  const { t } = useSafeI18n();
  const reduced = useReducedMotion();
  const [internalStep, setInternalStep] = useState(1);
  const [expanded, setExpanded] = useState(showDetails);

  const activeStep = externalStep ?? internalStep;
  const isBusy = activeStep < 3;

  // Realistic step progression
  useEffect(() => {
    if (externalStep !== undefined) return;
    const t1 = setTimeout(() => setInternalStep(2), 1600);
    const t2 = setTimeout(() => setInternalStep(3), 3600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [externalStep]);

  const steps = useMemo(
    () => [
      {
        id: 1,
        title: resolveTranslation(
          t,
          'ai.thinking.step1',
          'So\'rov va sahifa konteksti tahlil qilinmoqda…',
        ),
        icon: Search,
        tag: 'Context',
      },
      {
        id: 2,
        title: resolveTranslation(
          t,
          'ai.thinking.step2',
          'Tizim ma\'lumotlari va qoidalar tekshirilmoqda…',
        ),
        icon: Database,
        tag: 'Database',
      },
      {
        id: 3,
        title: resolveTranslation(
          t,
          'ai.thinking.step3',
          'Tahliliy xulosa va tavsiyalar tayyorlanmoqda…',
        ),
        icon: Cpu,
        tag: 'Synthesis',
      },
    ],
    [t],
  );

  const currentStepData = steps[Math.min(Math.max(activeStep - 1, 0), steps.length - 1)];
  const currentTone = STEP_TONES[currentStepData.id - 1];
  const resolved = label ?? currentStepData.title;

  const toggleLabel = expanded
    ? resolveTranslation(t, 'ai.thinking.toggleHide', 'Yashirish')
    : resolveTranslation(t, 'ai.thinking.toggleShow', 'Fikrlash');

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 8, scale: 0.98, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      transition={{
        ...SPRING.snappy,
        filter: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
      }}
      role="status"
      aria-live="polite"
      aria-busy={isBusy}
      className="flex w-full max-w-xl flex-col gap-2 py-1"
    >
      {/* ═══ Header glass panel ═══════════════════════════════════════ */}
      <div className="relative">
        {/* Ambient tone-aware leak — pulses with the current step */}
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute -inset-3 -z-10 rounded-3xl blur-2xl',
            !reduced && 'motion-safe:animate-[aiAmbient_4.5s_ease-in-out_infinite]',
          )}
          style={{
            opacity: 0.55,
            background: `radial-gradient(ellipse at 30% 30%, ${currentTone.glow}, transparent 65%), radial-gradient(ellipse at 75% 70%, rgba(175,82,222,0.28), transparent 65%)`,
          }}
        />

        {/* Glass surface */}
        <div
          className={cn(
            'relative overflow-hidden rounded-2xl',
            'border border-white/60 dark:border-white/[0.10]',
            'backdrop-blur-2xl backdrop-saturate-150',
            'shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.14)]',
            'dark:shadow-[0_1px_2px_rgba(0,0,0,0.30),0_8px_24px_-12px_rgba(0,0,0,0.50)]',
          )}
          style={{
            background:
              'linear-gradient(135deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.55) 100%)',
          }}
        >
          {/* Dark-mode tint (opacity-based — Safari-safe) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 hidden dark:block"
            style={{
              background:
                'linear-gradient(135deg, rgba(28,28,30,0.65) 0%, rgba(28,28,30,0.45) 100%)',
            }}
          />

          {/* Specular top edge (light bending) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/25"
          />

          {/* Specular bottom bevel (glass thickness) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-black/[0.06] to-transparent dark:via-white/[0.06]"
          />

          {/* Inner corner glow (top-left lens flare) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-8 -top-8 h-20 w-20 rounded-full bg-white/40 blur-2xl dark:bg-white/15"
          />

          {/* Slow glint sweep across the glass */}
          {!reduced && (
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-25"
              style={{
                background:
                  'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.55) 50%, transparent 60%)',
                backgroundSize: '250% 100%',
                backgroundRepeat: 'no-repeat',
              }}
              animate={{ backgroundPositionX: ['120%', '-20%'] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}

          {/* ─── Content row ───────────────────────────────────── */}
          <div className="relative flex items-center gap-3 px-3.5 py-2.5">
            {/* Avatar — liquid conic ring + glass tile */}
            <div className="relative h-9 w-9 shrink-0">
              {/* Conic ring (rotating light on glass edge) */}
              <motion.span
                aria-hidden="true"
                className="pointer-events-none absolute -inset-[2px] rounded-2xl"
                style={{
                  background:
                    'conic-gradient(from 0deg, #007AFF, #5856D6, #AF52DE, #FF2D55, #FF9500, #007AFF)',
                  filter: 'blur(0.5px)',
                }}
                animate={reduced ? undefined : { rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              />

              {/* Inner glass tile */}
              <div
                className="relative flex h-full w-full items-center justify-center rounded-[14px] text-white"
                style={{
                  background: 'linear-gradient(135deg, #007AFF 0%, #AF52DE 100%)',
                  boxShadow:
                    'inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(0,0,0,0.08), 0 4px 12px -4px rgba(0,122,255,0.5)',
                }}
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-[14px]"
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(255,255,255,0.45), transparent 55%)',
                  }}
                />
                <motion.span
                  className="relative flex items-center justify-center"
                  animate={
                    reduced
                      ? undefined
                      : { scale: [1, 1.08, 1], rotate: [0, 3, -3, 0] }
                  }
                  transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
                </motion.span>
              </div>
            </div>

            {/* Right column */}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              {/* Row: step badge · wave dots · toggle */}
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.08em]"
                  style={{
                    background: currentTone.ring,
                    color: currentTone.fg,
                    borderColor: currentTone.ring,
                  }}
                >
                  <motion.span
                    aria-hidden="true"
                    className="h-1 w-1 rounded-full"
                    style={{ background: currentTone.fg }}
                    animate={reduced ? undefined : { opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  {activeStep}/3
                </span>

                {/* Three-dot wave */}
                <span className="flex items-center gap-[3px]" aria-hidden="true">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="h-1 w-1 rounded-full"
                      style={{ background: currentTone.fg }}
                      animate={
                        reduced
                          ? undefined
                          : { y: [0, -2.5, 0], opacity: [0.35, 1, 0.35] }
                      }
                      transition={{
                        duration: 1.2,
                        repeat: Infinity,
                        delay: i * 0.15,
                        ease: 'easeInOut',
                      }}
                    />
                  ))}
                </span>

                {/* Toggle */}
                <button
                  type="button"
                  onClick={() => setExpanded((p) => !p)}
                  aria-label={toggleLabel}
                  aria-expanded={expanded}
                  className={cn(
                    'ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5',
                    'text-[10.5px] font-medium',
                    'text-[var(--ai-text-muted,#86868B)] hover:text-[var(--ai-text-primary,#1D1D1F)]',
                    'dark:text-[var(--ai-text-muted,#A1A1A6)] dark:hover:text-[var(--ai-text-primary,#F5F5F7)]',
                    'transition-colors duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]/40',
                  )}
                >
                  <span>{toggleLabel}</span>
                  <motion.span
                    animate={{ rotate: expanded ? 180 : 0 }}
                    transition={SPRING.snappy}
                    className="flex items-center"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </motion.span>
                </button>
              </div>

              {/* Crossfading label with colored sheen sweep */}
              <div className="relative min-w-0">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={activeStep}
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -3 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className="relative truncate text-[12.5px] font-medium tracking-tight text-[var(--ai-text-primary,#1D1D1F)] dark:text-[var(--ai-text-primary,#F5F5F7)]"
                  >
                    <span className="relative z-10">{resolved}</span>
                    {!reduced && (
                      <motion.span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 z-20"
                        style={{
                          background:
                            'linear-gradient(90deg, transparent 0%, rgba(0,122,255,0.20) 50%, transparent 100%)',
                        }}
                        initial={{ x: '-100%' }}
                        animate={{ x: '100%' }}
                        transition={{
                          duration: 2.4,
                          repeat: Infinity,
                          ease: 'easeInOut',
                          repeatDelay: 0.6,
                        }}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Comet progress track */}
              <div className="relative mt-0.5 h-[2px] w-full overflow-hidden rounded-full bg-black/[0.05] dark:bg-white/[0.06]">
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    background:
                      'linear-gradient(90deg, #007AFF 0%, #5856D6 50%, #AF52DE 100%)',
                  }}
                  animate={{ width: `${(activeStep / steps.length) * 100}%` }}
                  transition={SPRING.smooth}
                >
                  {!reduced && (
                    <motion.span
                      aria-hidden="true"
                      className="absolute right-0 top-1/2 h-[6px] w-[6px] -translate-y-1/2 translate-x-1/2 rounded-full bg-white"
                      style={{
                        boxShadow: `0 0 8px ${currentTone.fg}, 0 0 12px ${currentTone.fg}`,
                      }}
                      animate={{ scale: [0.9, 1.15, 0.9], opacity: [0.85, 1, 0.85] }}
                      transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  )}
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Expandable reasoning timeline ══════════════════════════ */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="timeline"
            initial={{ opacity: 0, height: 0, y: -4 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -4 }}
            transition={SPRING.liquid}
            className="overflow-hidden pl-12 pr-1"
          >
            <div
              className={cn(
                'relative mt-1 overflow-hidden rounded-2xl',
                'border border-white/50 dark:border-white/[0.08]',
                'backdrop-blur-2xl backdrop-saturate-150',
                'shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_16px_-10px_rgba(0,0,0,0.10)]',
                'dark:shadow-none',
              )}
              style={{
                background:
                  'linear-gradient(135deg, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0.45) 100%)',
              }}
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 hidden dark:block"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(28,28,30,0.70) 0%, rgba(28,28,30,0.50) 100%)',
                }}
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20"
              />

              <div className="relative flex flex-col gap-1.5 p-3">
                {steps.map((s, idx) => {
                  const IconComponent = s.icon;
                  const tone = STEP_TONES[idx];
                  const isCompleted = activeStep > s.id;
                  const isCurrent = activeStep === s.id;

                  return (
                    <div key={s.id} className="flex items-center gap-2.5 text-[11.5px]">
                      <div
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-colors duration-300"
                        style={{
                          background: isCompleted
                            ? 'rgba(52,199,89,0.15)'
                            : isCurrent
                              ? tone.ring
                              : 'rgba(0,0,0,0.04)',
                          color: isCompleted
                            ? '#34C759'
                            : isCurrent
                              ? tone.fg
                              : 'var(--ai-text-muted,#86868B)',
                        }}
                      >
                        {isCompleted ? (
                          <motion.span
                            initial={reduced ? false : { scale: 0.6, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={SPRING.snappy}
                            className="flex"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.4} />
                          </motion.span>
                        ) : (
                          <IconComponent className="h-3 w-3" strokeWidth={2} />
                        )}
                      </div>

                      <span
                        className={cn(
                          'min-w-0 flex-1 truncate transition-colors duration-300',
                          isCurrent
                            ? 'font-semibold text-[var(--ai-text-primary,#1D1D1F)] dark:text-[var(--ai-text-primary,#F5F5F7)]'
                            : isCompleted
                              ? 'text-[var(--ai-text-muted,#86868B)] dark:text-[var(--ai-text-muted,#A1A1A6)]'
                              : 'text-[var(--ai-text-muted,#86868B)] opacity-55 dark:text-[var(--ai-text-muted,#A1A1A6)]',
                        )}
                      >
                        {s.title}
                      </span>

                      {isCurrent && !reduced && (
                        <motion.span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: tone.fg }}
                          animate={{ opacity: [0.4, 1, 0.4], scale: [0.85, 1.15, 0.85] }}
                          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      )}

                      <span
                        className="shrink-0 rounded px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-[0.08em]"
                        style={{
                          background: isCurrent ? tone.ring : 'transparent',
                          color: isCurrent ? tone.fg : 'var(--ai-text-muted,#86868B)',
                          opacity: isCompleted ? 0.5 : 1,
                        }}
                      >
                        {s.tag}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scoped keyframes */}
      <style>{`
        @keyframes aiAmbient {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50%      { opacity: 0.60; transform: scale(1.05); }
        }
      `}</style>
    </motion.div>
  );
}

export default AiThinking;