import { useI18n, LOCALES, LOCALE_META } from '@/i18n/I18nProvider';
import { GlassButton } from '@/components/ui';

/**
 * Language switcher — compact select bound to the i18n context.
 * Persists via setLocale (localStorage + cross-tab sync handled in the
 * provider) and announces itself to assistive tech via aria-label.
 */
export function LanguageSwitcher() {
  let ctx: ReturnType<typeof useI18n> | null = null;
  try {
    ctx = useI18n();
  } catch {
    // Graceful fallback when rendered outside I18nProvider (e.g. isolated test harnesses)
  }

  const locale = ctx?.locale ?? 'en';
  const setLocale = ctx?.setLocale ?? (() => {});
  const t = ctx?.t ?? ((key: string) => key);

  return (
    <GlassButton asChild variant="secondary" size="sm">
      <select
        value={locale}
        onChange={(e) => {
          const next = e.target.value;
          if (LOCALES.includes(next as (typeof LOCALES)[number])) {
            setLocale(next as (typeof LOCALES)[number]);
          }
        }}
        aria-label={t('nav.language')}
      >
        {LOCALES.map((code) => (
          <option key={code} value={code}>
            {LOCALE_META[code].label}
          </option>
        ))}
      </select>
    </GlassButton>
  );
}
