const fs = require('fs');
const path = require('path');

const files = [
  'apps/web/src/pages/Groups.tsx',
  'apps/web/src/pages/GroupForm.tsx',
  'apps/web/src/pages/Attendance.tsx',
  'apps/web/src/pages/Schedule.tsx',
  'apps/web/src/pages/Library.tsx',
  'apps/web/src/pages/HR.tsx',
  'apps/web/src/pages/Payroll.tsx'
];

const specularSnippet = `<div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20 z-10" />`;

files.forEach(f => {
  const filePath = path.join(process.cwd(), f);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  // If file doesn't already have specular snippet
  if (!content.includes('via-white/80 to-transparent dark:via-white/20')) {
    // Inject specular edge right after relative overflow-hidden rounded-3xl or rounded-[2.25rem]
    content = content.replace(
      /(<div[^>]*className="[^"]*relative overflow-hidden rounded-(?:3xl|2xl|\[2(?:\.[0-9]+)?rem\])[^"]*"[^>]*>)/g,
      `$1\n        ${specularSnippet}`
    );
    // Replace any legacy import { toLocalISOString } from '../lib/format'
    content = content.replace("from '../lib/format'", "from '@/lib/format'");

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated specular edges in: ${f}`);
  } else {
    console.log(`Already has specular edges: ${f}`);
  }
});
