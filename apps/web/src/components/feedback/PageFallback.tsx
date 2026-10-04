import { m, useReducedMotion } from 'framer-motion';
import { useI18n } from '@/i18n/I18nProvider';
import { AppleSpinner } from './AppleSpinner';

const appleSpring = {
  glassFloat: { type: 'spring' as const, stiffness: 220, damping: 20, mass: 1 },
};

export function PageFallback({ labelKey }: { labelKey?: string }) {
  const prefersReduced = useReducedMotion();
  const { t } = useI18n();

  const text = labelKey ? t(labelKey) : t('common.loading') || 'Loading...';

  return (
    <div
      role="status"
      className="relative flex min-h-[55vh] w-full items-center justify-center p-6"
    >
      {/* Specular Ambient Glow */}
      <div 
        aria-hidden="true" 
        className="pointer-events-none absolute h-64 w-64 rounded-full bg-[var(--primary-soft)] blur-[80px] dark:bg-[var(--primary-soft)] motion-reduce:animate-none animate-pulse" 
      />

      <m.div
        initial={prefersReduced ? false : { opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={prefersReduced ? undefined : { opacity: 0, scale: 0.98, y: -8 }}
        transition={appleSpring.glassFloat}
        className="
          relative z-10 flex flex-col items-center gap-4 rounded-[26px]
          border border-white/60 bg-white/70 px-8 py-7 shadow-[0_8px_32px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]
          backdrop-blur-2xl
          dark:border-white/[0.08] dark:bg-[var(--bg-glass)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.4)]
        "
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/[0.03] text-[var(--primary)] dark:bg-white/[0.06] dark:text-[var(--primary)]">
          <AppleSpinner size="lg" />
        </div>

        <div className="flex flex-col items-center gap-1">
          <span className="text-[14px] font-medium tracking-tight text-[var(--text-primary)]">
            {text}
          </span>
          <span className="text-[12px] tracking-normal text-[var(--text-tertiary)]">
            M-EDU Workspace
          </span>
        </div>
      </m.div>
    </div>
  );
}
