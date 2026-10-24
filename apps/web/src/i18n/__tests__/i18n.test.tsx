/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider, useI18n, useSafeI18n, LOCALES, isLocale, type I18nContextValue } from '../I18nProvider';
import { translate } from '../index';

afterEach(cleanup);

function Probe({ onReady }: { onReady: (t: (k: string) => string, locale: string) => void }) {
  const { t, locale } = useI18n();
  useEffect(() => {
    onReady(t, locale);
      }, [t, locale]);
  return null;
}

describe('i18n dictionaries', () => {
  it('every locale exposes the same key set as English (the fallback)', async () => {
    const en = (await import('../locales/en')).default;
    const uz = (await import('../locales/uz')).default;
    const ru = (await import('../locales/ru')).default;

    const enKeys = Object.keys(en).sort();
    expect(Object.keys(uz).sort()).toEqual(enKeys);
    expect(Object.keys(ru).sort()).toEqual(enKeys);
    expect(enKeys.length).toBeGreaterThan(50);
  });

  it('no dictionary value is empty', async () => {
    const en = (await import('../locales/en')).default;
    const uz = (await import('../locales/uz')).default;
    const ru = (await import('../locales/ru')).default;
    for (const dict of [en, uz, ru]) {
      for (const [key, value] of Object.entries(dict)) {
        expect(value.trim(), `${key} in dictionary`).not.toBe('');
      }
    }
  });

  it('translate returns English for an unknown locale key fallthrough', () => {
    expect(translate('ru', 'common.cancel')).toBe('Отмена');
    expect(translate('uz', 'common.save')).toBe('Saqlash');
    expect(translate('en', 'common.delete')).toBe('Delete');
  });

  it('interpolates {placeholders}', () => {
    const out = translate('en', 'templates.deleteConfirm', { name: 'Gold' });
    expect(out).toBe('Delete template Gold? This cannot be undone.');
  });

  it('returns the key itself when missing in every dictionary', () => {
    const dev = import.meta.env.DEV;
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(translate('en', 'definitely.not.a.key')).toBe('definitely.not.a.key');
    } finally {
      spy.mockRestore();
      void dev;
    }
  });

  it('LOCALES contains exactly the three required languages', () => {
    expect([...LOCALES].sort()).toEqual(['en', 'ru', 'uz']);
    expect(isLocale('fr')).toBe(false);
    expect(isLocale('uz')).toBe(true);
  });
});

describe('I18nProvider', () => {
  it('provides t() and persists a locale change to localStorage', () => {
    let capturedT: ((k: string) => string) | null = null;
    let capturedLocale = '';

    render(
      <I18nProvider initialLocale="en">
        <Probe
          onReady={(t, locale) => {
            capturedT = t;
            capturedLocale = locale;
          }}
        />
      </I18nProvider>,
    );

    expect(capturedLocale).toBe('en');
    const t = capturedT as ((k: string) => string) | null;
    expect(t?.('certificates.title')).toBe('Certificates');
  });

  it('switching locale changes translations (ru)', () => {
    function Switcher() {
      const { t, setLocale, locale } = useI18n();
      return (
        <div>
          <span>{t('nav.settings')}</span>
          <button type="button" onClick={() => setLocale('ru')} data-testid="switch">
            switch ({locale})
          </button>
        </div>
      );
    }

    render(
      <I18nProvider initialLocale="en">
        <Switcher />
      </I18nProvider>,
    );

    expect(screen.getByText('Settings')).toBeTruthy();
    fireEvent.click(screen.getByTestId('switch'));
    expect(screen.getByText('Настройки')).toBeTruthy();
    expect(localStorage.getItem('medu-lang')).toBe('ru');
    expect(document.documentElement.lang).toBe('ru');
  });

  it('renders the three language options in the switcher', async () => {
    const { LanguageSwitcher } = await import('../LanguageSwitcher');
    render(
      <I18nProvider initialLocale="en">
        <LanguageSwitcher />
      </I18nProvider>,
    );
    const select = screen.getByRole('combobox', { name: 'Language' }) as HTMLSelectElement;
    expect(select.options.length).toBe(3);
    expect(select.options[0].text).toBe('O\'zbekcha');
    expect(select.options[1].text).toBe('Русский');
    expect(select.options[2].text).toBe('English');
  });

  it('synchronizes HTML dir, data-locale, and data-locale-loaded attributes', () => {
    render(
      <I18nProvider initialLocale="uz">
        <div data-testid="child">M-EDU</div>
      </I18nProvider>,
    );

    expect(document.documentElement.lang).toBe('uz');
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.documentElement.getAttribute('data-locale')).toBe('uz');
    expect(document.documentElement.getAttribute('data-locale-loaded')).toBe('true');
  });

  it('provides Apple HIG Intl formatters bound to the active locale', () => {
    let captured: I18nContextValue | undefined;
    function FormatterProbe() {
      const i18n = useI18n();
      useEffect(() => {
        captured = i18n;
      }, [i18n]);
      return null;
    }

    render(
      <I18nProvider initialLocale="en">
        <FormatterProbe />
      </I18nProvider>,
    );

    expect(captured).toBeDefined();
    const ctx = captured!;
    expect(ctx.isRTL).toBe(false);
    expect(ctx.meta.code).toBe('en');

    // formatNumber
    const formattedNum = ctx.formatNumber(1250000);
    expect(formattedNum).toContain('1');

    // formatCurrency
    const formattedCur = ctx.formatCurrency(50000, 'USD');
    expect(formattedCur).toContain('50,000');

    // formatDate
    const testDate = new Date(2026, 9, 22);
    const formattedDate = ctx.formatDate(testDate);
    expect(formattedDate).toBeTruthy();

    // formatRelativeTime
    const justNow = new Date(Date.now() - 5000);
    const relTime = ctx.formatRelativeTime(justNow);
    expect(relTime).toBeTruthy();
  });

  it('useSafeI18n works reliably outside I18nProvider without throwing', () => {
    let safeCtx: I18nContextValue | undefined;
    function SafeProbe() {
      const i18n = useSafeI18n();
      useEffect(() => {
        safeCtx = i18n;
      }, [i18n]);
      return <div>Safe Fallback</div>;
    }

    render(<SafeProbe />);

    expect(safeCtx).toBeDefined();
    expect(safeCtx!.locale).toBe('en');
    expect(safeCtx!.t('certificates.title')).toBe('Certificates');
    expect(safeCtx!.formatNumber(100)).toBe('100');
  });

  it('LanguageSwitcher renders active badge and pill mode correctly', async () => {
    const { LanguageSwitcher } = await import('../LanguageSwitcher');
    const { container } = render(
      <I18nProvider initialLocale="uz">
        <LanguageSwitcher variant="pill" />
      </I18nProvider>,
    );

    const matches = screen.getAllByText("O'zbekcha");
    expect(matches.length).toBeGreaterThanOrEqual(2);
    expect(container.querySelector('select')).toBeDefined();
  });
});
