import { describe, it, expect } from 'vitest';
import {
  TELEGRAM_LANGUAGES,
  catalogueKeys,
  normalizeLanguage,
  resolveLanguage,
  t,
} from '../i18n/telegram-i18n';
import { escapeHtml, formatDate, formatMoney, formatName } from '../ui/format';

describe('telegram i18n', () => {
  it('exposes the same key set in every supported language', () => {
    const reference = catalogueKeys('en');
    expect(reference.length).toBeGreaterThan(50);
    for (const lang of TELEGRAM_LANGUAGES) {
      expect(catalogueKeys(lang)).toEqual(reference);
    }
  });

  it('translates a key in all three languages', () => {
    const en = t('en', 'menu.title');
    const ru = t('ru', 'menu.title');
    const uz = t('uz', 'menu.title');
    expect(en).not.toBe(ru);
    expect(en).not.toBe(uz);
    expect(en).toContain('M-EDU');
  });

  it('interpolates params', () => {
    expect(t('en', 'menu.subtitle', { name: 'Ali' })).toContain('Ali');
    expect(t('ru', 'profile.children', { count: 3 })).toContain('3');
  });

  it('falls back to the key when a translation is missing', () => {
    expect(t('en', 'this.key.does.not.exist')).toBe('this.key.does.not.exist');
  });

  it('localizes the notification category labels shown by /settings', () => {
    const categories = [
      'ATTENDANCE',
      'PAYMENT',
      'DEBT',
      'ACADEMIC',
      'CRM',
      'SYSTEM',
      'HOMEWORK',
      'EVENT',
    ];
    for (const category of categories) {
      const label = t('uz', `category.${category}`);
      // Resolved from the catalogue, never falling back to the key itself.
      expect(label).not.toBe(`category.${category}`);
      expect(label.length).toBeGreaterThan(1);
    }
    expect(t('ru', 'category.ATTENDANCE')).toBe('Посещаемость');
    expect(t('uz', 'category.PAYMENT')).toBe("To'lovlar");
  });

  it('normalizes regional and unknown language codes', () => {
    expect(normalizeLanguage('uz-UZ')).toBe('uz');
    expect(normalizeLanguage('RU')).toBe('ru');
    expect(normalizeLanguage('de')).toBeNull();
    expect(normalizeLanguage(null)).toBeNull();
  });

  it('prefers the M-EDU preference over the organization and the Telegram client', () => {
    // M-EDU user preference wins, then organization, then Telegram, then en.
    expect(resolveLanguage('ru', 'uz', 'en')).toBe('ru');
    expect(resolveLanguage(null, 'uz', 'ru')).toBe('uz');
    expect(resolveLanguage(null, null, 'uz')).toBe('uz');
    expect(resolveLanguage(null, null, 'de')).toBe('en');
    expect(resolveLanguage()).toBe('en');
  });
});

describe('telegram message formatting safety', () => {
  it('escapes every Telegram-HTML-significant character', () => {
    expect(escapeHtml('A&B')).toBe('A&amp;B');
    expect(escapeHtml('<Admin>')).toBe('&lt;Admin&gt;');
    expect(escapeHtml('[Student]')).toBe('[Student]');
    expect(escapeHtml('Test_*User*')).toBe('Test_*User*');
    expect(escapeHtml('<b>bold</b>')).toBe('&lt;b&gt;bold&lt;/b&gt;');
  });

  it('preserves unicode, Uzbek and Russian characters', () => {
    expect(escapeHtml('Алишер Навои')).toBe('Алишер Навои');
    expect(escapeHtml("G'ulom & O‘zbek")).toBe("G'ulom &amp; O‘zbek");
  });

  it('handles null/undefined without emitting "undefined"', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('formats names, money and dates defensively', () => {
    expect(formatName('Ali', 'Valiyev')).toBe('Ali Valiyev');
    expect(formatName(null, null)).toBe('—');
    expect(formatMoney(1500)).toBe('1,500 UZS');
    expect(formatMoney(null)).toBe('0 UZS');
    expect(formatMoney('not-a-number')).toBe('0 UZS');
    expect(formatDate(new Date('2026-03-04T10:00:00Z'))).toBe('2026-03-04');
    expect(formatDate('nonsense')).toBe('—');
  });
});
