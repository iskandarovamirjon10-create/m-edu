/**
 * i18n audit — finds keys used via t('...') that are missing from locale
 * dictionaries, and keys defined but unused. Read-only diagnostic.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = new URL('../src', import.meta.url).pathname.replace(/%20/g, ' ');

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx?|ts)$/.test(e.name) && !/__tests__|\.test\./.test(p)) out.push(p);
  }
  return out;
}

// 1. Load dictionary keys by evaluating the default exports
function loadDict(file) {
  const src = readFileSync(file, 'utf8');
  const keys = [...src.matchAll(/'([a-zA-Z0-9_.]+)'\s*:/g)].map((m) => m[1]);
  return new Set(keys);
}
const en = loadDict(join(SRC, 'i18n/locales/en.ts'));
const uz = loadDict(join(SRC, 'i18n/locales/uz.ts'));
const ru = loadDict(join(SRC, 'i18n/locales/ru.ts'));

// 2. Collect used keys from t('...') / t("...") calls, incl. template fallbacks
const used = new Map(); // key -> [file:line]
for (const f of walk(SRC)) {
  if (f.includes('/i18n/')) continue;
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
