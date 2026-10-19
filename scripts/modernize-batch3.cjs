const fs = require('fs');
const path = require('path');

const files = [
  'apps/web/src/pages/Assessment.tsx',
  'apps/web/src/pages/Assignments.tsx',
  'apps/web/src/pages/Curriculum.tsx',
  'apps/web/src/pages/Student360.tsx',
  'apps/web/src/pages/TeacherWorkload.tsx',
  'apps/web/src/pages/ParentPortal.tsx'
];

const specularSnippet = `<div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20 z-10" />`;

files.forEach(f => {
  const filePath = path.join(process.cwd(), f);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  // Fix relative imports:
  content = content.replace(/from '\.\.\/lib\//g, "from '@/lib/");
  content = content.replace(/from '\.\.\/i18n\//g, "from '@/i18n/");

  if (f.endsWith('ParentPortal.tsx')) {
    if (!content.includes("from 'framer-motion'")) {
      content = `import { motion } from 'framer-motion';\n` + content;
    }
    // Update StatCard to have specular edge
    content = content.replace(
      'className="relative overflow-hidden rounded-[2rem] p-5 sm:p-6 group transition-all duration-300 hover:-translate-y-1 glass-card"',
      'className="relative overflow-hidden rounded-[2rem] p-5 sm:p-6 group transition-all duration-300 hover:-translate-y-1 bg-white/70 dark:bg-white/[0.04] backdrop-blur-2xl ring-1 ring-inset ring-black/[0.06] dark:ring-white/[0.08] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)]"'
    );
    // Update Hero card
    content = content.replace(
      '<div className="rounded-[2.5rem] glass-card p-6 sm:p-10 flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6 relative overflow-hidden group mb-8">',
      `<div className="rounded-[2.5rem] bg-white/70 dark:bg-white/[0.04] backdrop-blur-2xl ring-1 ring-inset ring-black/[0.06] dark:ring-white/[0.08] shadow-[0_12px_40px_-15px_rgba(0,0,0,0.08)] p-6 sm:p-10 flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6 relative overflow-hidden group mb-8">
          ${specularSnippet}`
    );
  }

  // Inject specular highlight into cards
  if (!content.includes('via-white/80 to-transparent dark:via-white/20')) {
    content = content.replace(
      /(<div[^>]*className="[^"]*relative overflow-hidden rounded-(?:3xl|2xl|\[2(?:\.[0-9]+)?rem\])[^"]*"[^>]*>)/g,
      `$1\n        ${specularSnippet}`
    );
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated Batch 3 file: ${f}`);
});
