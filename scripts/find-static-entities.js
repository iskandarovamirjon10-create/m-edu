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
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      if (!file.includes('.test.') && !file.includes('.spec.')) {
        filelist.push(filepath);
      }
    }
  }
  return filelist;
}

const files = walk('apps/web/src');
const patterns = [
  /\[\s*\{\s*id:\s*['"]\w+['"],\s*(name|student|studentName|teacher|teacherName|title|fullName):/i,
  /const\s+DEFAULT_STUDENTS/i,
  /const\s+INITIAL_STUDENTS/i,
  /const\s+SAMPLE_STUDENTS/i,
  /const\s+MOCK_STUDENTS/i,
  /const\s+DEMO_STUDENTS/i,
  /const\s+DEFAULT_TEACHERS/i,
  /const\s+INITIAL_TEACHERS/i,
  /const\s+SAMPLE_TEACHERS/i,
  /const\s+DEFAULT_CLASSES/i,
  /const\s+DEFAULT_GROUPS/i,
  /const\s+INITIAL_GROUPS/i,
  /const\s+SAMPLE_GROUPS/i,
  /const\s+DEFAULT_LEADS/i,
  /const\s+INITIAL_LEADS/i,
  /const\s+SAMPLE_LEADS/i,
  /const\s+DEFAULT_PAYMENTS/i,
  /const\s+INITIAL_PAYMENTS/i,
  /const\s+SAMPLE_PAYMENTS/i,
  /const\s+DEFAULT_ATTENDANCE/i,
  /const\s+INITIAL_ATTENDANCE/i,
  /const\s+SAMPLE_ATTENDANCE/i,
  /const\s+INITIAL_MISTAKES/i,
  /const\s+INITIAL_EXAMS/i,
  /const\s+INITIAL_SCHEDULE/i,
  /const\s+DEFAULT_SCHEDULE/i,
];

const matches = [];

for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');
  lines.forEach((l, idx) => {
    const trim = l.trim();
    if (trim.startsWith('//') || trim.startsWith('*')) return;
    for (const p of patterns) {
      if (p.test(trim)) {
        matches.push({ file: f.replace(/\\/g, '/'), line: idx + 1, text: trim.slice(0, 120) });
        break;
      }
    }
  });
}

console.log('Matches found for static entity definitions:', matches.length);
matches.forEach((m) => console.log(`${m.file}:${m.line} -> ${m.text}`));
