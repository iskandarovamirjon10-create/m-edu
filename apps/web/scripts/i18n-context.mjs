/**
 * Dump every missing i18n key with an example call-site and any
 * `|| 'Fallback'` literal found next to the t() call.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC = new URL('../src', import.meta.url).pathname.replace(/%20/g, ' ');

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(e.name) && !/__tests__|\.test\./.test(p)) out.push(p);
  }
  return out;
}

function keys(file) {
  const src = readFileSync(file, 'utf8');
  return new Set([...src.matchAll(/'([a-zA-Z0-9_.]+)'\s*:/g)].map((m) => m[1]));
}
const en = keys(join(SRC, 'i18n/locales/en.ts'));

const byKey = new Map();
for (const f of walk(SRC)) {
  if (f.includes('/i18n/')) continue;
  const lines = readFileSync(f, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/\bt\(\s*['"]([a-zA-Z0-9_.]+)['"]/g)) {
      const key = m[1];
      if (en.has(key)) continue;
      if (!byKey.has(key)) {
        // try to capture a `|| '...'` fallback on the same line
        const fb = line.match(/\|\|\s*'([^']*)'/);
        byKey.set(key, { site: `${f.replace(SRC + '/', '')}:${i + 1}`, fallback: fb ? fb[1] : '' });
      }
    }
  });
}

for (const [k, v] of [...byKey.entries()].sort()) {
  console.log(`${k}\t${v.site}\t${v.fallback}`);
}
console.error(`total missing: ${byKey.size}`);
