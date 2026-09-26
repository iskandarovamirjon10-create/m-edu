import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
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

  // Stable identity across locale changes — consumers may put setLocale in
  // effect deps without re-running (and clobbering) on every language switch.
  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    storeLocale(next);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>, fallback?: string) => translate(locale, key, vars, fallback),
    [locale],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
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

/**
 * Like {@link useI18n} but never throws — shared leaf components (spinners,
 * modals, toasts) can use it without requiring a provider in unit tests.
 * Outside the provider it falls back to the default English dictionary.
 */
export function useSafeI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  const fallbackT = useCallback<TranslateFn>(
    (key, vars) => translate(DEFAULT_LOCALE, key, vars),
    [],
  );
  const fallbackSetLocale = useCallback((_next: Locale) => {
    /* no-op outside provider */
  }, []);
  const fallback = useMemo(
    () => ({ locale: DEFAULT_LOCALE, setLocale: fallbackSetLocale, t: fallbackT }),
    [fallbackSetLocale, fallbackT],
  );
  return ctx ?? fallback;
}
