import { useI18n, LOCALES, LOCALE_META } from '@/i18n/I18nProvider';

/**
 * Language switcher — compact select bound to the i18n context.
 * Persists via setLocale (localStorage + cross-tab sync handled in the
 * provider) and announces itself to assistive tech via aria-label.
 */
export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <select
      value={locale}
      onChange={(e) => {
        const next = e.target.value;
        if (LOCALES.includes(next as (typeof LOCALES)[number])) {
          setLocale(next as (typeof LOCALES)[number]);
        }
      }}
      aria-label={t('nav.language')}
      className="glass-btn glass-btn-secondary glass-btn-sm"
    >
      {LOCALES.map((code) => (
        <option key={code} value={code}>
          {LOCALE_META[code].label}
        </option>
      ))}
    </select>
  );
}
