/**
 * i18n audit — finds keys used via t('...') that are missing from locale
 * dictionaries, and keys defined but unused. Read-only diagnostic.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../src', import.meta.url));

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx?|ts)$/.test(e.name) && !/__tests__|\.test\./.test(p)) out.push(p);
  }
  return out;
}

// 1. Load dictionary keys by scanning all locale files and slice files
function loadAllKeysForLocale(locale) {
  const dir = join(SRC, 'i18n', 'locales');
  const files = readdirSync(dir);
  const keys = new Set();

  for (const file of files) {
    if (!file.endsWith('.ts')) continue;
    const content = readFileSync(join(dir, file), 'utf8');

    // If it's a main locale file like en.ts, uz.ts, ru.ts
    // or locale specific slice like *.uz.ts, *.ru.ts, or shared like ai-slices.ts
    // Check if file belongs to this locale
    let isForLocale = false;
    if (file === `${locale}.ts`) isForLocale = true;
    else if (file.endsWith(`.${locale}.ts`)) isForLocale = true;
    else if (locale === 'en' && !file.includes('.uz.') && !file.includes('.ru.')) isForLocale = true;
    else if (file === 'ai-slices.ts' || file === 'students-slices.ts' || file === 'groups-slices.ts' || file === 'teachers-slices.ts' || file === 'tgapp-slices.ts') {
      // In these shared files, keys are defined in objects like aiEn, aiUz, aiRu etc.
      // We can extract keys inside the respective object block
      const prefix = locale === 'en' ? 'En' : locale === 'uz' ? 'Uz' : 'Ru';
      const regex = new RegExp(`export const \\w+${prefix}(?::[\\s\\S]*?)?\\s*=\\s*\\{([\\s\\S]*?)\\};`, 'g');
      for (const match of content.matchAll(regex)) {
        for (const k of match[1].matchAll(/['"]([a-zA-Z0-9_.]+)['"]\s*:/g)) {
          keys.add(k[1]);
        }
      }
      continue;
    }

    if (isForLocale) {
      for (const m of content.matchAll(/['"]([a-zA-Z0-9_.]+)['"]\s*:/g)) {
        keys.add(m[1]);
      }
    }
  }

  return keys;
}

const en = loadAllKeysForLocale('en');
const uz = loadAllKeysForLocale('uz');
const ru = loadAllKeysForLocale('ru');

// 2. Collect used keys from t('...') / t("...") calls, incl. template fallbacks
const used = new Map(); // key -> [file:line]
for (const f of walk(SRC)) {
  if (f.includes('/i18n/') || f.includes('\\i18n\\')) continue;
  const src = readFileSync(f, 'utf8');
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/\bt\(\s*['"]([a-zA-Z0-9_.]+)['"]/g)) {
      const key = m[1];
      if (!used.has(key)) used.set(key, []);
      used.get(key).push(`${relative(SRC, f)}:${i + 1}`);
    }
  });
}

// 3. Report
const missingEn = [...used.keys()].filter((k) => !en.has(k));
const missingUz = [...used.keys()].filter((k) => !uz.has(k));
const missingRu = [...used.keys()].filter((k) => !ru.has(k));

console.log(`Used keys: ${used.size}, en: ${en.size}, uz: ${uz.size}, ru: ${ru.size}\n`);

const uniq = (a) => [...new Set(a)].sort();
console.log('=== MISSING IN en.ts ===');
console.log(uniq(missingEn).join('\n') || '(none)');
console.log(`\n=== MISSING IN uz.ts (${uniq(missingUz).length}) ===`);
console.log(uniq(missingUz).join('\n') || '(none)');
console.log(`\n=== MISSING IN ru.ts (${uniq(missingRu).length}) ===`);
console.log(uniq(missingRu).join('\n') || '(none)');

// 4. Defined but never used (en only)
const unused = [...en].filter((k) => !used.has(k));
console.log(`\n=== DEFINED BUT UNUSED (${unused.length}) ===`);
console.log(unused.join('\n') || '(none)');
