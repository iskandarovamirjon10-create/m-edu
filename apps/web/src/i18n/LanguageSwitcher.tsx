import { useI18n, LOCALES, LOCALE_META } from '@/i18n/I18nProvider';
import { usePersistSettings } from '@/hooks/usePersistSettings';
import { motion } from 'framer-motion';
import { useRef } from 'react';

/**
 * Language switcher â€” premium icon with native select dropdown.
 * Persists via setLocale and cross-tab sync.
 */
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

  // Removed unused activeLabel

  return (
    <motion.button
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.95 }}
      type="button"
      className="group relative flex h-10 w-10 items-center justify-center rounded-full text-[#86868B] outline-none transition-colors hover:bg-black/5 hover:text-[#1D1D1F] focus-within:ring-2 focus-within:ring-[#007AFF]/50 dark:hover:bg-white/5 dark:hover:text-[#F5F5F7]"
      title={t('nav.language') || 'Language'}
    >
      <svg
        className="h-5 w-5 shrink-0 transition-transform duration-500 ease-out group-hover:rotate-45"
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
          <option key={code} value={code}>
            {LOCALE_META[code].label}
          </option>
        ))}
      </select>
    </motion.button>
  );
}
