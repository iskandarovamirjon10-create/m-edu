const fs = require('fs');
const path = require('path');

function walk(dir, filelist = []) {
  if (!fs.existsSync(dir)) return filelist;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filepath = path.join(dir, file);
    if (fs.statSync(filepath).isDirectory()) {
      if (
        file !== '__tests__' &&
        file !== 'node_modules' &&
        file !== '.next' &&
        file !== 'dist' &&
        file !== 'build' &&
        file !== '.git'
      ) {
        walk(filepath, filelist);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js')) {
      if (!file.includes('.test.') && !file.includes('.spec.')) {
        filelist.push(filepath);
      }
    }
  }
  return filelist;
}

const targetDirs = ['apps/web/src', 'apps/api/src'];
const allFiles = targetDirs.flatMap((d) => walk(d));

const patterns = [
  /\b(demo[A-Z]\w*|mock[A-Z]\w*|dummy[A-Z]\w*)\b/i,
  /\b(mockData|demoData|sampleData|dummyData)\b/i,
  /\b(MOCK_|DEMO_|DUMMY_)\w+/i,
  /DEFAULT_([A-Z_]+)\s*=\s*\[\s*\{/i,
  /INITIAL_([A-Z_]+)\s*=\s*\[\s*\{/i,
  /FALLBACK_([A-Z_]+)\s*=\s*\[\s*\{/i,
  /\[\s*\{\s*id:\s*['"](demo|mock|sample|fake)/i,
];

const matches = [];

for (const f of allFiles) {
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');
  lines.forEach((l, idx) => {
    const lineTrim = l.trim();
    // Skip comments that merely mention "demo" in explanations or test helpers
    if (lineTrim.startsWith('//') || lineTrim.startsWith('*')) return;
    for (const p of patterns) {
      if (p.test(lineTrim)) {
        matches.push({
          file: f.replace(/\\/g, '/'),
          line: idx + 1,
          text: lineTrim.slice(0, 120),
        });
        break;
      }
    }
  });
}

console.log('Total potential fake/mock matches found:', matches.length);
fs.writeFileSync('audit-fakes.json', JSON.stringify(matches, null, 2));

// Group by file
const byFile = {};
matches.forEach((m) => {
  byFile[m.file] = byFile[m.file] || [];
  byFile[m.file].push(m);
});

console.log('Unique files with potential fake/demo data:', Object.keys(byFile).length);
for (const [file, items] of Object.entries(byFile)) {
  console.log(`\nFile: ${file} (${items.length} matches):`);
  items.slice(0, 5).forEach((item) => console.log(`  L${item.line}: ${item.text}`));
}
