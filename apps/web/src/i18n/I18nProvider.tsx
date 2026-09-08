import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_META,
  getStoredLocale,
  isLocale,
  storeLocale,
  translate,
  type Locale,
  type LocaleMeta,
  type TranslateFn,
} from './index';

export { LOCALES, LOCALE_META, DEFAULT_LOCALE, isLocale };
export type { Locale, LocaleMeta, TranslateFn };

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TranslateFn;
}

const I18nContext = createContext<I18nContextValue | null>(null);

interface I18nProviderProps {
  children: ReactNode;
  /** Force a locale (tests); otherwise the persisted/default locale is used. */
  initialLocale?: Locale;
}

/**
 * Application-wide i18n provider.
 *
 * - Persists the selected locale to localStorage and syncs it across tabs
 *   via the `storage` event.
 * - Keeps `<html lang>` in sync for screen readers and spellcheck.
 * - Exposes a stable `t()` bound to the active locale.
 */
export function I18nProvider({ children, initialLocale }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(() => initialLocale ?? getStoredLocale());

  useEffect(() => {
    const meta = LOCALE_META[locale];
    if (meta && document.documentElement.lang !== meta.htmlLang) {
      document.documentElement.lang = meta.htmlLang;
    }
  }, [locale]);

  useEffect(() => {
    // Cross-tab sync: another tab changed the language.
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'medu-lang' && isLocale(e.newValue)) {
        setLocaleState(e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale: (next: Locale) => {
        setLocaleState(next);
        storeLocale(next);
      },
      t: (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars),
    }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Access the active locale and translator. Throws outside the provider. */
export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return ctx;
}
