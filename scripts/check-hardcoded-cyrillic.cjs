#!/usr/bin/env node
/**
 * DS-06 ratchet — blocks NEW hardcoded Cyrillic UI text.
 *
 * The web app still ships ~91k Cyrillic characters typed directly into JSX
 * instead of going through `t()` / the locale dictionaries. Migrating them all
 * is a multi-week product task, so this script freezes the current debt:
 *
 *   node scripts/check-hardcoded-cyrillic.cjs                 # CI: fail on growth
 *   node scripts/check-hardcoded-cyrillic.cjs --write-baseline # refresh the snapshot
 *
 * A file may always go DOWN; going UP (or a new file appearing with Cyrillic)
 * fails CI, which is what prevents the debt from growing while it is paid off.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'apps', 'web', 'src');
const BASELINE_FILE = path.join(__dirname, 'i18n-cyrillic-baseline.json');
const CYRILLIC = /[\u0400-\u04FF]/g;

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      out.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function countCyrillic(file) {
  const text = fs.readFileSync(file, 'utf8');
  const matches = text.match(CYRILLIC);
  return matches ? matches.length : 0;
}

const counts = {};
for (const file of walk(SRC)) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  const count = countCyrillic(file);
  if (count > 0) counts[rel] = count;
}

const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
const fileCount = Object.keys(counts).length;

if (process.argv.includes('--write-baseline')) {
  const sorted = Object.fromEntries(Object.keys(counts).sort().map((k) => [k, counts[k]]));
  fs.writeFileSync(BASELINE_FILE, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
  console.log(`Baseline written: ${fileCount} files, ${total} Cyrillic characters.`);
  process.exit(0);
}

if (!fs.existsSync(BASELINE_FILE)) {
  console.error('Missing scripts/i18n-cyrillic-baseline.json — run with --write-baseline first.');
  process.exit(1);
}

const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
const violations = [];

for (const [file, count] of Object.entries(counts)) {
  const allowed = baseline[file] || 0;
  if (count > allowed) {
    violations.push(`${file}: ${allowed} -> ${count} (+${count - allowed})`);
  }
}

const baselineTotal = Object.values(baseline).reduce((sum, n) => sum + n, 0);
console.log(
  `Hardcoded Cyrillic: ${total} chars across ${fileCount} files ` +
    `(baseline ${baselineTotal}; ${baselineTotal - total} chars migrated).`,
);

if (violations.length > 0) {
  console.error('\nDS-06 regression — move these strings into the locale dictionaries:');
  for (const violation of violations) console.error(`  ${violation}`);
  process.exit(1);
}

console.log('No new hardcoded Cyrillic text. OK.');
