import { useI18n, LOCALES, LOCALE_META } from '@/i18n/I18nProvider';
import { usePersistSettings } from '@/hooks/usePersistSettings';
import { GlassButton } from '@/components/ui';

/**
 * Language switcher — compact select bound to the i18n context.
 * Persists via setLocale (localStorage + cross-tab sync handled by the
 * provider) AND publishes the choice to the server, so the same account comes
 * back in the same language on another browser or device.
 */
export function LanguageSwitcher() {
  let ctx: ReturnType<typeof useI18n> | null = null;
  try {
    ctx = useI18n();
  } catch {
    // Graceful fallback when rendered outside I18nProvider (e.g. isolated test harnesses)
  }

  let persist: ((prefs: { language: string }) => void) | null = null;
  try {
    persist = usePersistSettings();
  } catch {
    // Rendered outside AuthProvider (isolated test harnesses).
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
            persist?.({ language: next });
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
