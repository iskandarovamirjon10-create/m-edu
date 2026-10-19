/**
 * M-EDU Language Switcher — v3 "Hyper-Refractive Liquid Glass"
 * VisionOS-inspired optical glass switcher with native select dropdown,
 * spring-powered micro-interactions, and specular hover glow.
 */
import { useI18n, LOCALES, LOCALE_META } from '@/i18n/I18nProvider';
import { usePersistSettings } from '@/hooks/usePersistSettings';
import { motion } from 'framer-motion';
import { useRef } from 'react';

const SWITCHER_SPRING = {
  type: 'spring' as const,
  stiffness: 480,
  damping: 28,
  mass: 0.65,
};

export function LanguageSwitcher() {
  let ctx: ReturnType<typeof useI18n> | null = null;
  try {
    ctx = useI18n();
  } catch {
    // Graceful fallback
  }

  let persist: ((prefs: { language: string }) => void) | null = null;
  try {
    persist = usePersistSettings();
  } catch {
    // Graceful fallback
  }

  const locale = ctx?.locale ?? 'en';
  const setLocale = ctx?.setLocale ?? (() => {});
  const t = ctx?.t ?? ((key: string) => key);
  const selectRef = useRef<HTMLSelectElement>(null);

  return (
    <motion.div
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      transition={SWITCHER_SPRING}
      className="group relative flex h-10 w-10 items-center justify-center rounded-full border border-black/[0.08] dark:border-white/[0.12] bg-white/60 dark:bg-[#1C1C1E]/60 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.08),inset_0_1px_1px_rgba(255,255,255,0.8)] backdrop-blur-2xl backdrop-saturate-[210%] text-[#86868B] dark:text-[#98989D] transition-colors hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] hover:border-[#007AFF]/40 dark:hover:border-[#0A84FF]/40"
      title={t('nav.language') || 'Language'}
    >
      {/* Specular Top Rim */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-2 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/80 dark:via-white/30 to-transparent"
      />

      <svg
        className="h-4.5 w-4.5 shrink-0 transition-transform duration-500 ease-out group-hover:rotate-45"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        <path d="M2 12h20" />
      </svg>

      <select
        ref={selectRef}
        value={locale}
        onChange={(e) => {
          const next = e.target.value;
          if (LOCALES.includes(next as (typeof LOCALES)[number])) {
            setLocale(next as (typeof LOCALES)[number]);
            persist?.({ language: next });
          }
          selectRef.current?.blur();
        }}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 outline-none"
        aria-label={t('nav.language') || 'Language'}
      >
        {LOCALES.map((code) => (
          <option key={code} value={code} className="bg-white dark:bg-[#1C1C1E] text-neutral-900 dark:text-white">
            {LOCALE_META[code].label}
          </option>
        ))}
      </select>
    </motion.div>
  );
}