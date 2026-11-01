/**
 * Regression: keys that are REFERENCED but never DEFINED.
 *
 * `translate()` returns the key itself when a lookup misses, so the very
 * common call-site idiom
 *
 *     t('branches.noManager') || 'Unassigned'
 *
 * can never fire: `'branches.noManager'` is truthy. The result is a raw key
 * rendered on screen (`nav.collapse`, `login.tabStaff`, `validation.required`,
 * …). 67 such keys shipped before this test existed, spread over 20+ pages.
 *
 * The existing parity test only proves uz/ru match EN — it cannot catch keys
 * that are missing from ALL three locales, which is exactly this failure.
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

import en from '../locales/en';

const SRC = fs.existsSync(path.resolve(process.cwd(), 'src'))
  ? path.resolve(process.cwd(), 'src')
  : path.resolve(__dirname, '../../');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const REFERENCE_PATTERNS: RegExp[] = [
  /\bt\(\s*'([^']+)'/g,
  /\bt\(\s*"([^"]+)"/g,
  /\btr\(\s*'([^']+)'/g,
  /\btr\(\s*"([^"]+)"/g,
  /\btranslate\(\s*[^,]+,\s*'([^']+)'/g,
];

describe('i18n referenced keys', () => {
  it('every key referenced from application code exists in the English dictionary', () => {
    const dictionary = en as unknown as Record<string, string>;
    const missing = new Map<string, string[]>();

    const files = walk(SRC).filter((file) => {
      if (!/\.(ts|tsx)$/.test(file)) return false;
      if (file.includes(`${path.sep}locales${path.sep}`)) return false;
      // Test files legitimately reference sentinel keys to assert fallbacks.
      if (file.includes(`${path.sep}__tests__${path.sep}`)) return false;
      return true;
    });

    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      const relative = path.relative(SRC, file);

      for (const pattern of REFERENCE_PATTERNS) {
        for (const match of source.matchAll(pattern)) {
          const key = match[1];
          if (Object.prototype.hasOwnProperty.call(dictionary, key)) continue;

          const locations = missing.get(key) ?? [];
          if (locations.length < 3 && !locations.includes(relative)) {
            locations.push(relative);
          }
          missing.set(key, locations);
        }
      }
    }

    const report = [...missing.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, locations]) => `${key}  <-  ${locations.join(', ')}`)
      .join('\n');

    expect(report).toBe('');
  });
});
