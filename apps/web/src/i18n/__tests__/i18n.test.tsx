import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider, useI18n, LOCALES, isLocale } from '../I18nProvider';
import { translate } from '../index';

afterEach(cleanup);

function Probe({ onReady }: { onReady: (t: (k: string) => string, locale: string) => void }) {
  const { t, locale } = useI18n();
  useEffect(() => {
    onReady(t, locale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    expect(select.options[0].text).toBe('Oʻzbekcha');
    expect(select.options[1].text).toBe('Русский');
    expect(select.options[2].text).toBe('English');
  });
});
