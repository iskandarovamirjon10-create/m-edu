/**
 * i18n audit — finds keys used via t('...') that are missing from locale
 * dictionaries, and cross-dictionary key parity gaps. Read-only diagnostic.
 */
import { readFileSync, readdirSync } from 'node:fs';
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

function loadDict(file) {
  const src = readFileSync(file, 'utf8');
  const keys = [...src.matchAll(/'([a-zA-Z0-9_.]+)'\s*:/g)].map((m) => m[1]);
  return new Set(keys);
}
const en = loadDict(join(SRC, 'i18n/locales/en.ts'));
const uz = loadDict(join(SRC, 'i18n/locales/uz.ts'));
const ru = loadDict(join(SRC, 'i18n/locales/ru.ts'));

const used = new Map();
for (const f of walk(SRC)) {
  if (f.includes('/i18n/')) continue;
  const src = readFileSync(f, 'utf8');
  src.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(/\bt\(\s*['"]([a-zA-Z0-9_.]+)['"]/g)) {
      const key = m[1];
      if (!used.has(key)) used.set(key, []);
      used.get(key).push(`${relative(SRC, f)}:${i + 1}`);
    }
  });
}

const sort = (s) => [...s].sort();
console.log(`Used keys: ${used.size}, en: ${en.size}, uz: ${uz.size}, ru: ${ru.size}`);

const inEnNotUz = sort([...en].filter((k) => !uz.has(k)));
const inEnNotRu = sort([...en].filter((k) => !ru.has(k)));
const inUzNotEn = sort([...uz].filter((k) => !en.has(k)));
const inRuNotEn = sort([...ru].filter((k) => !en.has(k)));

console.log(`\n=== IN en BUT NOT uz (${inEnNotUz.length}) ===\n${inEnNotUz.join('\n')}`);
console.log(`\n=== IN en BUT NOT ru (${inEnNotRu.length}) ===\n${inEnNotRu.join('\n')}`);
console.log(`\n=== IN uz BUT NOT en (${inUzNotEn.length}) ===\n${inUzNotEn.join('\n')}`);
console.log(`\n=== IN ru BUT NOT en (${inRuNotEn.length}) ===\n${inRuNotEn.join('\n')}`);
