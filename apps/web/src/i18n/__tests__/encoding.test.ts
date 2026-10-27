/**
 * Guards against double-encoded locale strings.
 *
 * A previous merge wrote UTF-8 bytes through a Windows-1252 decoder, so
 * Russian users saw "ÐŸÐ¾Ð´ Ñ€Ð¸ÑÐºÐ¾Ð¼" instead of "Под риском". The
 * marker characters below are the tell-tale signature of that corruption.
 */
import { describe, it, expect } from 'vitest';
import en from '../locales/en';
import uz from '../locales/uz';
import ru from '../locales/ru';

const DICTIONARIES = { en, uz, ru } as const;
const MOJIBAKE = /[\u00d0\u00d1]|\u00e2\u20ac/;

describe('locale encoding', () => {
  it.each(Object.entries(DICTIONARIES))('%s contains no double-encoded strings', (_locale, dict) => {
    const broken = Object.entries(dict as Record<string, string>).filter(([, value]) =>
      typeof value === 'string' && MOJIBAKE.test(value),
    );

    expect(broken.map(([key]) => key)).toEqual([]);
  });
});
