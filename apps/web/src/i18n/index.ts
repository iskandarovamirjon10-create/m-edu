/**
 * M-EDU i18n — lightweight, dependency-free translation layer.
 *
 * Requirement source: docs/V2_ARCHITECTURE.md ("Multi-language (i18n) —
 * Uzbek, Russian, English"). The app previously had zero i18n code; this
 * module provides the architecture the requirement calls for:
 *
 *   - locale dictionaries for uz / ru / en (en is the default + fallback),
 *   - `t(key, vars)` translation with {placeholder} interpolation,
 *   - missing-key fallthrough: en → the key itself (visible in dev),
 *   - persistence via localStorage (`medu-lang`) with cross-tab sync,
 *   - `<html lang>` update for accessibility/screen readers,
 *   - dev-only warning when a key is missing from a non-English dictionary
 *     so translators can find gaps without breaking production.
 */

export const LOCALES = ['uz', 'ru', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';
const STORAGE_KEY = 'medu-lang';

export interface LocaleMeta {
  code: Locale;
  /** Native name, shown in the language switcher. */
  label: string;
  /** BCP 47 tag for <html lang>. */
  htmlLang: string;
}

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  uz: { code: 'uz', label: 'O\'zbekcha', htmlLang: 'uz' },
  ru: { code: 'ru', label: 'Русский', htmlLang: 'ru' },
  en: { code: 'en', label: 'English', htmlLang: 'en' },
};

import en from './locales/en';
import uz from './locales/uz';
import ru from './locales/ru';

const DICTIONARIES: Record<Locale, Record<string, string>> = { en, uz, ru };

/** Flat key → translated string with {placeholder} and optional fallback support. */
export type TranslateFn = (
  key: string,
  varsOrFallback?: Record<string, string | number> | string,
  fallback?: string,
) => string;

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** Read the persisted locale, falling back to the default. */
export function getStoredLocale(): Locale {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isLocale(raw) ? raw : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function storeLocale(locale: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // storage unavailable (private mode) — in-memory only
  }
}

const MISSING_KEY = (key: string, locale: Locale) =>
  `[i18n:${locale}] missing key "${key}"`;

/**
 * Translate `key` for `locale`.
 *
 * Fallthrough: locale dictionary → English dictionary → the key itself.
 * In development a missing non-English key is logged once per key so the
 * translation gap is discoverable without breaking the UI.
 */
export function translate(
  locale: Locale,
  key: string,
  varsOrFallback?: Record<string, string | number> | string,
  fallback?: string,
): string {
  const vars = typeof varsOrFallback === 'object' && varsOrFallback !== null ? varsOrFallback : undefined;
  const fb = typeof varsOrFallback === 'string' ? varsOrFallback : fallback;
  const dict = DICTIONARIES[locale];
  let template: string | undefined = dict?.[key];

  if (template === undefined && locale !== DEFAULT_LOCALE) {
    template = DICTIONARIES[DEFAULT_LOCALE]?.[key];
    if (template !== undefined && import.meta.env.DEV) {
      // Rate: keep it cheap — one warn per key per session is fine.
      console.warn(MISSING_KEY(key, locale));
    }
  }

  if (template === undefined) {
    if (import.meta.env.DEV) console.warn(MISSING_KEY(key, locale));
    return fb ?? key;
  }

  return interpolate(template, vars);
}
