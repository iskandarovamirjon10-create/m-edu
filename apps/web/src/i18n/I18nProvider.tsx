/**
 * M-EDU i18n — Application-wide Internationalization Provider (v20 "Apple Spatial Pro")
 *
 * 🎯 World-Class Enhancements:
 *  ✅ Complete DOM & A11y Synchronization: Updates `<html lang="..." dir="ltr" data-locale="..." data-locale-loaded="true">`
 *  ✅ Universal Multi-Tab & In-App Sync: BroadcastChannel + localStorage storage event + CustomEvent for instant sync
 *  ✅ Zero-Cost `STATIC_FALLBACK`: Frozen singleton fallback for `useSafeI18n()` eliminating hook overhead in leaf components
 *  ✅ Apple HIG Intl Toolset: High-precision memoized `formatNumber`, `formatCurrency`, `formatDate`, `formatRelativeTime`
 *  ✅ Reactive `initialLocale`: Responds dynamically to prop changes in test harnesses and preview sandboxes
 *  ✅ 100% Backward Compatible: Preserves all existing `t`, `locale`, `setLocale`, and metadata contracts
 */

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

export interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TranslateFn;
  /** Complete metadata for current active locale */
  meta: LocaleMeta;
  /** Whether the active locale uses right-to-left script (false for uz, ru, en) */
  isRTL: boolean;
  /** Localized number formatter using browser Intl standards */
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  /** Localized currency formatter (defaults to UZS) */
  formatCurrency: (amount: number, currency?: string, options?: Intl.NumberFormatOptions) => string;
  /** Localized date formatter */
  formatDate: (date: Date | number | string, options?: Intl.DateTimeFormatOptions) => string;
  /** Natural relative time ("3 minutes ago", "5 daqiqa oldin", "только что") */
  formatRelativeTime: (date: Date | number | string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/* ══════════════════════════════════════════════════════════════════════════
 * INTL FORMATTER ENGINE (Apple macOS Sequoia / iOS 18 Localized Formatters)
 * ════════════════════════════════════════════════════════════════════════ */

export function formatNumber(
  locale: Locale,
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  try {
    const lang = LOCALE_META[locale]?.htmlLang || 'en';
    return new Intl.NumberFormat(lang, options).format(value);
  } catch {
    return String(value);
  }
}

export function formatCurrency(
  locale: Locale,
  amount: number,
  currency: string = 'UZS',
  options?: Intl.NumberFormatOptions,
): string {
  try {
    const lang = LOCALE_META[locale]?.htmlLang || 'en';
    return new Intl.NumberFormat(lang, {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'UZS' ? 0 : 2,
      ...options,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function formatDate(
  locale: Locale,
  dateInput: Date | number | string,
  options?: Intl.DateTimeFormatOptions,
): string {
  try {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (Number.isNaN(date.getTime())) return '';
    const lang = LOCALE_META[locale]?.htmlLang || 'en';
    return new Intl.DateTimeFormat(lang, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...options,
    }).format(date);
  } catch {
    return String(dateInput);
  }
}

export function formatRelativeTime(
  locale: Locale,
  dateInput: Date | number | string,
): string {
  try {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (Number.isNaN(date.getTime())) return '';
    const diffInSeconds = Math.round((date.getTime() - Date.now()) / 1000);
    const absDiff = Math.abs(diffInSeconds);
    const lang = LOCALE_META[locale]?.htmlLang || 'en';

    const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });

    if (absDiff < 45) {
      return rtf.format(diffInSeconds, 'second');
    }
    if (absDiff < 45 * 60) {
      return rtf.format(Math.round(diffInSeconds / 60), 'minute');
    }
    if (absDiff < 22 * 3600) {
      return rtf.format(Math.round(diffInSeconds / 3600), 'hour');
    }
    if (absDiff < 26 * 86400) {
      return rtf.format(Math.round(diffInSeconds / 86400), 'day');
    }
    if (absDiff < 320 * 86400) {
      return rtf.format(Math.round(diffInSeconds / (86400 * 30)), 'month');
    }
    return rtf.format(Math.round(diffInSeconds / (86400 * 365)), 'year');
  } catch {
    return '';
  }
}

/* ══════════════════════════════════════════════════════════════════════════
 * STATIC SINGLETON FALLBACK (Zero Allocation For Leaf Components)
 * ════════════════════════════════════════════════════════════════════════ */

const STATIC_FALLBACK_T: TranslateFn = (key, vars, fb) =>
  translate(DEFAULT_LOCALE, key, vars, fb);

const STATIC_FALLBACK_SET_LOCALE = (_next: Locale) => {
  /* no-op outside provider */
};

const STATIC_FALLBACK: I18nContextValue = Object.freeze({
  locale: DEFAULT_LOCALE,
  setLocale: STATIC_FALLBACK_SET_LOCALE,
  t: STATIC_FALLBACK_T,
  meta: LOCALE_META[DEFAULT_LOCALE],
  isRTL: false,
  formatNumber: (val: number, opts?: Intl.NumberFormatOptions) =>
    formatNumber(DEFAULT_LOCALE, val, opts),
  formatCurrency: (amt: number, curr: string = 'UZS', opts?: Intl.NumberFormatOptions) =>
    formatCurrency(DEFAULT_LOCALE, amt, curr, opts),
  formatDate: (date: Date | number | string, opts?: Intl.DateTimeFormatOptions) =>
    formatDate(DEFAULT_LOCALE, date, opts),
  formatRelativeTime: (date: Date | number | string) =>
    formatRelativeTime(DEFAULT_LOCALE, date),
});

/* ══════════════════════════════════════════════════════════════════════════
 * SYNC TOKENS & BROADCAST CHANNELS
 * ════════════════════════════════════════════════════════════════════════ */

const BROADCAST_NAME = 'medu-i18n-channel';
const CUSTOM_EVENT_NAME = 'medu:locale-change';

export interface I18nProviderProps {
  children: ReactNode;
  /** Force a locale (tests / preview); otherwise persisted / default locale is used. */
  initialLocale?: Locale;
}

/**
 * Application-wide i18n provider.
 *
 * - Persists selected locale to localStorage and synchronizes across tabs via
 *   BroadcastChannel and the storage event.
 * - Synchronizes `<html lang>`, `dir="ltr"`, and `data-locale` for accessibility.
 * - Exposes high-performance memoized `t()` and Intl formatters.
 */
export function I18nProvider({ children, initialLocale }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(() => initialLocale ?? getStoredLocale());

  // Keep state reactive if initialLocale prop changes dynamically (tests/sandboxes)
  useEffect(() => {
    if (initialLocale && isLocale(initialLocale)) {
      setLocaleState(initialLocale);
    }
  }, [initialLocale]);

  // Synchronize document attributes for screen readers, CSS hooks, and hyphenation
  useEffect(() => {
    const meta = LOCALE_META[locale];
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      const htmlLang = meta?.htmlLang || 'en';
      if (root.lang !== htmlLang) {
        root.lang = htmlLang;
      }
      if (root.dir !== 'ltr') {
        root.dir = 'ltr';
      }
      root.setAttribute('data-locale', locale);
      root.setAttribute('data-locale-loaded', 'true');
    }
  }, [locale]);

  // Multi-tab and intra-app synchronization
  useEffect(() => {
    // 1. Cross-tab StorageEvent
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'medu-lang' && isLocale(e.newValue)) {
        setLocaleState(e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);

    // 2. Intra-window CustomEvent
    const onCustomLocaleChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ locale: unknown }>;
      if (customEvent.detail && isLocale(customEvent.detail.locale)) {
        setLocaleState(customEvent.detail.locale);
      }
    };
    window.addEventListener(CUSTOM_EVENT_NAME, onCustomLocaleChange);

    // 3. BroadcastChannel (Modern PWA cross-tab sync)
    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        channel = new BroadcastChannel(BROADCAST_NAME);
        channel.onmessage = (event: MessageEvent) => {
          if (event.data?.type === 'LOCALE_CHANGE' && isLocale(event.data?.locale)) {
            setLocaleState(event.data.locale);
          }
        };
      } catch {
        // BroadcastChannel unavailable in restricted sandboxes
      }
    }

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(CUSTOM_EVENT_NAME, onCustomLocaleChange);
      channel?.close();
    };
  }, []);

  // Stable setLocale that notifies storage, BroadcastChannel, and in-window listeners
  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    storeLocale(next);

    // Broadcast cross-tab
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const bc = new BroadcastChannel(BROADCAST_NAME);
        bc.postMessage({ type: 'LOCALE_CHANGE', locale: next });
        bc.close();
      } catch {
        // Silently continue if BroadcastChannel is blocked
      }
    }

    // Broadcast in-window
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(
          new CustomEvent(CUSTOM_EVENT_NAME, { detail: { locale: next } }),
        );
      } catch {
        // Continue safely
      }
    }
  }, []);

  const t = useCallback<TranslateFn>(
    (key, varsOrFallback, fallback) => translate(locale, key, varsOrFallback, fallback),
    [locale],
  );

  const formatNumberFn = useCallback(
    (value: number, options?: Intl.NumberFormatOptions) => formatNumber(locale, value, options),
    [locale],
  );

  const formatCurrencyFn = useCallback(
    (amount: number, currency: string = 'UZS', options?: Intl.NumberFormatOptions) =>
      formatCurrency(locale, amount, currency, options),
    [locale],
  );

  const formatDateFn = useCallback(
    (date: Date | number | string, options?: Intl.DateTimeFormatOptions) =>
      formatDate(locale, date, options),
    [locale],
  );

  const formatRelativeTimeFn = useCallback(
    (date: Date | number | string) => formatRelativeTime(locale, date),
    [locale],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t,
      meta: LOCALE_META[locale] ?? LOCALE_META[DEFAULT_LOCALE],
      isRTL: false,
      formatNumber: formatNumberFn,
      formatCurrency: formatCurrencyFn,
      formatDate: formatDateFn,
      formatRelativeTime: formatRelativeTimeFn,
    }),
    [
      locale,
      setLocale,
      t,
      formatNumberFn,
      formatCurrencyFn,
      formatDateFn,
      formatRelativeTimeFn,
    ],
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
 * Outside the provider it falls back to the default English dictionary and Intl formatters.
 */
export function useSafeI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  return ctx ?? STATIC_FALLBACK;
}
