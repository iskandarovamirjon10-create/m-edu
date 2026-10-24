/**
 * M-EDU Language Switcher — v20 "Apple Spatial Pro · Liquid Glass"
 *
 * 🎯 World-Class Enhancements:
 *  ✅ WCAG 2.2 AA & Apple HIG: Guaranteed >= 44x44px touch targets across all breakpoints
 *  ✅ Crystal Focus-Visible Halo: Spatial neon-blue focus ring for keyboard navigation
 *  ✅ Dynamic Active Locale Indicator: Visual uppercase 2-letter badge (`UZ`, `RU`, `EN`)
 *  ✅ Dual Adaptive Modes: Supported `variant="icon"` (compact circular button) and `variant="pill"` (capsule with label)
 *  ✅ Optical Specular Highlights: Top rim gradient and backdrop-blur-2xl with refractive glass physics
 *  ✅ Seamless Server & Local Persistence: Syncs with `usePersistSettings` and cross-tab `I18nProvider`
 */

import { useSafeI18n, LOCALES, LOCALE_META, type Locale } from '@/i18n/I18nProvider';
import { usePersistSettings } from '@/hooks/usePersistSettings';
import { motion } from 'framer-motion';
import { useRef, useId, memo } from 'react';

const SWITCHER_SPRING = {
  type: 'spring' as const,
  stiffness: 480,
  damping: 28,
  mass: 0.65,
};

export interface LanguageSwitcherProps {
  /** Visual presentation mode: compact circular icon button or expanded pill */
  variant?: 'icon' | 'pill';
  /** Extra class names for outer positioning or layout integration */
  className?: string;
  /** Whether to render the 2-letter active locale badge in 'icon' mode (default: true) */
  showBadge?: boolean;
}

export const LanguageSwitcher = memo(function LanguageSwitcher({
  variant = 'icon',
  className = '',
  showBadge = true,
}: LanguageSwitcherProps) {
  const ctx = useSafeI18n();
  const persist = usePersistSettings();
  const selectId = useId();

  const locale = (ctx.locale ?? 'en') as Locale;
  const setLocale = ctx.setLocale ?? (() => {});
  const t = ctx.t ?? ((key: string) => key);
  const selectRef = useRef<HTMLSelectElement>(null);

  const activeMeta = LOCALE_META[locale] ?? LOCALE_META.en;
  const activeCodeUpper = (activeMeta.code || 'EN').toUpperCase();

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value as Locale;
    if (LOCALES.includes(next)) {
      setLocale(next);
      persist?.({ language: next });
    }
    selectRef.current?.blur();
  };

  const isPill = variant === 'pill';

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.94 }}
      transition={SWITCHER_SPRING}
      className={`group relative flex items-center justify-center select-none ${
        isPill
          ? 'h-11 min-h-[44px] gap-2.5 px-3.5 rounded-full'
          : 'h-11 w-11 min-h-[44px] min-w-[44px] rounded-full'
      } border border-black/[0.08] dark:border-white/[0.14] bg-white/70 dark:bg-[#1C1C1E]/70 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.1),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.18)] backdrop-blur-2xl backdrop-saturate-[210%] text-[#48484A] dark:text-[#EBEBF5]/90 transition-all duration-200 hover:text-[#1D1D1F] dark:hover:text-white hover:border-[#007AFF]/50 dark:hover:border-[#0A84FF]/50 group-focus-within:ring-2 group-focus-within:ring-[#007AFF] group-focus-within:ring-offset-2 dark:group-focus-within:ring-offset-[#1C1C1E] ${className}`}
      title={t('nav.language') || 'Language'}
    >
      {/* Specular Top Rim */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-2.5 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/90 dark:via-white/35 to-transparent"
      />

      {/* Globe Icon */}
      <svg
        className="h-4.5 w-4.5 shrink-0 transition-transform duration-500 ease-out group-hover:rotate-45 text-[#007AFF] dark:text-[#0A84FF]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        <path d="M2 12h20" />
      </svg>

      {/* Pill Variant Label */}
      {isPill && (
        <span className="text-[13px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
          {activeMeta.label}
        </span>
      )}

      {/* Pill Chevron Down */}
      {isPill && (
        <svg
          className="h-3.5 w-3.5 text-neutral-400 transition-transform duration-300 group-hover:translate-y-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      )}

      {/* Icon Variant: 2-Letter Active Language Indicator Badge */}
      {!isPill && showBadge && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-gradient-to-br from-[#007AFF] to-[#0051D5] px-1 text-[8.5px] font-extrabold uppercase tracking-tight text-white shadow-[0_1px_4px_rgba(0,122,255,0.4)] border border-white/80 dark:border-[#1C1C1E]"
        >
          {activeCodeUpper}
        </span>
      )}

      {/* Native Select with Full Touch Target Over Container */}
      <select
        id={selectId}
        ref={selectRef}
        value={locale}
        onChange={handleSelectChange}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 outline-none"
        aria-label={t('nav.language') || 'Language'}
      >
        {LOCALES.map((code) => (
          <option
            key={code}
            value={code}
            className="bg-white dark:bg-[#1C1C1E] text-neutral-900 dark:text-neutral-100 py-1"
          >
            {LOCALE_META[code].label}
          </option>
        ))}
      </select>

      {/* Screen Reader Announcement */}
      <span className="sr-only" aria-live="polite">
        {activeMeta.label}
      </span>
    </motion.div>
  );
});
