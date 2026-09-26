/**
 * Settings → Integrations → Telegram must be fully localized.
 *
 * The panel is user-facing copy, so every key it renders has to exist in all
 * three dictionaries AND actually be translated (an Uzbek screen showing
 * English is a defect, not a fallback).
 */
import { describe, it, expect } from 'vitest';
import en from '../locales/en';
import uz from '../locales/uz';
import ru from '../locales/ru';

const DICTS: Record<string, Record<string, string>> = {
  en: en as unknown as Record<string, string>,
  uz: uz as unknown as Record<string, string>,
  ru: ru as unknown as Record<string, string>,
};

const TELEGRAM_SETTINGS_KEYS = [
  'settings.telegram.title',
  'settings.telegram.subtitle',
  'settings.telegram.hint',
  'settings.telegram.stateActive',
  'settings.telegram.stateNotLinked',
  'settings.telegram.stateDisconnected',
  'settings.telegram.stateBlocked',
  'settings.telegram.stateSuspended',
  'settings.telegram.blockedHint',
  'settings.telegram.lastSeen',
  'settings.telegram.never',
  'settings.telegram.connect',
  'settings.telegram.reconnect',
  'settings.telegram.disconnect',
  'settings.telegram.test',
  'settings.telegram.openLink',
  'settings.telegram.linkReady',
  'settings.telegram.linkExpires',
  'settings.telegram.disconnected',
  'settings.telegram.testSent',
  'settings.telegram.testFailed',
];

describe('locale coverage — Telegram integration settings', () => {
  it.each(Object.keys(DICTS))('%s defines every Telegram settings key', (locale) => {
    const dict = DICTS[locale];
    expect(TELEGRAM_SETTINGS_KEYS.filter((key) => !dict[key])).toEqual([]);
  });

  it.each(['uz', 'ru'])('%s actually translates the labels', (locale) => {
    const dict = DICTS[locale];
    const identical = TELEGRAM_SETTINGS_KEYS.filter((key) => dict[key] === DICTS.en[key]);
    // Interpolation placeholders may legitimately match; the bulk must differ.
    expect(identical.length).toBeLessThan(TELEGRAM_SETTINGS_KEYS.length * 0.2);
  });
});
