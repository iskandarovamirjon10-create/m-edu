/**
 * AiThinking — Ultra Premium Edition
 *
 * An animated AI thinking indicator with step-by-step reasoning feedback.
 * Craft:
 *  - Avatar tile with rotating conic ring (matches AiAvatar)
 *  - Step-by-step reasoning feedback with stage progression:
 *      1. Analyzing request & route context
 *      2. Scanning data records & organizational policy
 *      3. Synthesizing structured response & recommendations
 *  - Visual progress dots & completed step badges
 *  - Expandable / collapsible reasoning timeline
 *  - Three-dot wave & shimmer sweep across label
 *  - Tone-aware & reduced-motion friendly
 *  - A11y: role="status", aria-live, aria-busy
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Sparkles, ChevronDown, CheckCircle2, Search, Database, Cpu } from 'lucide-react';
import { useSafeI18n } from '@/i18n/I18nProvider';

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
} as const;

export interface AiThinkingProps {
  label?: string;
  step?: number;
  showDetails?: boolean;
}

export function AiThinking({ label, step: externalStep }: AiThinkingProps) {
  const { t } = useSafeI18n();
  const reduced = useReducedMotion();
  const [internalStep, setInternalStep] = useState(1);
  const [expanded, setExpanded] = useState(false);

  const activeStep = externalStep ?? internalStep;

  // Realistic reasoning step progression
  useEffect(() => {
    if (externalStep !== undefined) return;
    const t1 = setTimeout(() => setInternalStep(2), 1400);
    const t2 = setTimeout(() => setInternalStep(3), 3200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [externalStep]);

  const steps = [
    {
      id: 1,
      title: t('ai.thinking.step1') || 'So‘rov va sahifa konteksti tahlil qilinmoqda…',
      icon: Search,
      tag: 'Context',
    },
    {
      id: 2,
      title: t('ai.thinking.step2') || 'Tizim ma’lumotlari va qoidalar tekshirilmoqda…',
      icon: Database,
      tag: 'Database',
    },
    {
      id: 3,
      title: t('ai.thinking.step3') || 'Tahliliy xulosa va tavsiyalar tayyorlanmoqda…',
      icon: Cpu,
      tag: 'Synthesis',
    },
  ];

  const currentStepData = steps[Math.min(Math.max(activeStep - 1, 0), steps.length - 1)];
  const resolved = label ?? currentStepData.title;

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 8, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={SPRING.snappy}
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex flex-col gap-2 py-1 max-w-xl"
    >
      {/* ── Main thinking row ────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        {/* Avatar tile with conic ring */}
        <div className="relative h-8 w-8 shrink-0">
          {!reduced && (
            <motion.span
              className="absolute inset-[-2px] rounded-xl"
              style={{
                background:
                  'conic-gradient(from 0deg, #007AFF, #5856D6, #AF52DE, #FF2D55, #FF9500, #007AFF)',
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
              aria-hidden
            />
          )}
          {reduced && (
            <span
              className="absolute inset-[-2px] rounded-xl"
              style={{
                background:
                  'conic-gradient(from 0deg, #007AFF, #5856D6, #AF52DE, #FF2D55, #FF9500, #007AFF)',
              }}
              aria-hidden
            />
          )}

          {/* Inner gradient tile */}
          <div
            className="relative flex h-full w-full items-center justify-center rounded-xl text-white"
            style={{
              background: 'linear-gradient(135deg, #007AFF 0%, #AF52DE 100%)',
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.45), ' +
                'inset 0 -1px 0 rgba(0,0,0,0.08), ' +
                '0 4px 12px -4px rgba(0,122,255,0.5)',
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
            <motion.span
              className="relative flex items-center justify-center"
              animate={
                reduced
                  ? undefined
                  : { scale: [1, 1.15, 1], rotate: [0, 10, -10, 0] }
              }
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
            </motion.span>
          </div>
        </div>

        {/* Label + Step indicators */}
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <div className="flex items-center gap-2">
            {/* Step pill */}
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider"
              style={{
                background: 'rgba(0,122,255,0.12)',
                color: '#007AFF',
                border: '1px solid rgba(0,122,255,0.22)',
              }}
            >
              Step {activeStep}/3
            </span>

            {/* Three-dot wave */}
            <span className="flex items-center gap-1" aria-hidden>
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: '#007AFF' }}
                  animate={
                    reduced
                      ? undefined
                      : {
                          y: [0, -3, 0],
                          opacity: [0.4, 1, 0.4],
                          scale: [0.9, 1.15, 0.9],
                        }
                  }
                  transition={{
                    duration: 1.1,
                    repeat: Infinity,
                    delay: i * 0.16,
                    ease: 'easeInOut',
                  }}
                />
              ))}
            </span>

            {/* Toggle detail disclosure */}
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium text-[var(--ai-text-muted,#86868B)] hover:text-[var(--ai-text-primary,#1D1D1F)] transition-colors"
              aria-label={expanded ? t('ai.thinking.toggleHide') : t('ai.thinking.toggleShow')}
            >
              <span>{expanded ? t('ai.thinking.toggleHide') || 'Hide' : t('ai.thinking.toggleShow') || 'Reasoning'}</span>
              <motion.span
                animate={{ rotate: expanded ? 180 : 0 }}
                transition={SPRING.snappy}
              >
                <ChevronDown className="h-3 w-3" />
              </motion.span>
            </button>
          </div>

          {/* Shimmer label */}
          <div className="relative mt-0.5 inline-block overflow-hidden text-[12.5px] font-medium tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7] truncate">
            {resolved}
            {!reduced && (
              <motion.span
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.7) 50%, transparent 100%)',
                  mixBlendMode: 'overlay',
                }}
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Expandable Step-by-Step Reasoning Timeline ───────────────── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={SPRING.smooth}
            className="overflow-hidden pl-11 pr-2 pt-1"
          >
            <div
              className="flex flex-col gap-2 rounded-2xl border p-3"
              style={{
                background: 'var(--ai-bg-glass, rgba(255,255,255,0.65))',
                borderColor: 'var(--ai-border, rgba(0,0,0,0.08))',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)',
              }}
            >
              {steps.map((s) => {
                const IconComponent = s.icon;
                const isCompleted = activeStep > s.id;
                const isCurrent = activeStep === s.id;

                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-2.5 text-[11.5px] transition-colors"
                  >
                    <div
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md"
                      style={{
                        background: isCompleted
                          ? 'rgba(52,199,89,0.15)'
                          : isCurrent
                          ? 'rgba(0,122,255,0.15)'
                          : 'rgba(0,0,0,0.04)',
                        color: isCompleted
                          ? '#34C759'
                          : isCurrent
                          ? '#007AFF'
                          : '#86868B',
                      }}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.4} />
                      ) : (
                        <IconComponent className="h-3 w-3" strokeWidth={2} />
                      )}
                    </div>
                    <span
                      className={`min-w-0 flex-1 truncate ${
                        isCurrent
                          ? 'font-semibold text-[var(--ai-text-primary,#1D1D1F)]'
                          : isCompleted
                          ? 'text-[var(--ai-text-muted,#86868B)] line-through opacity-85'
                          : 'text-[var(--ai-text-muted,#86868B)] opacity-60'
                      }`}
                    >
                      {s.title}
                    </span>
                    <span
                      className="shrink-0 rounded px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider"
                      style={{
                        background: isCurrent ? 'rgba(0,122,255,0.10)' : 'transparent',
                        color: isCurrent ? '#007AFF' : '#86868B',
                      }}
                    >
                      {s.tag}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default AiThinking;