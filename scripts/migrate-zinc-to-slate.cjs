const fs = require('fs');
const path = require('path');

const targetFiles = [
  'Grades.tsx',
  'SecurityCenter.tsx',
  'SystemHealth.tsx',
  'Users.tsx',
  'WhatChanged.tsx',
  'UniversalSearch.tsx'
];

const PAGES_DIR = path.join(__dirname, '..', 'apps', 'web', 'src', 'pages');

targetFiles.forEach((file) => {
  const filePath = path.join(PAGES_DIR, file);
  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Replace dark:bg-zinc-900/70 with dark:bg-[#131622]/90
  content = content.replace(/dark:bg-zinc-900\/70/g, 'dark:bg-[#131622]/90');
  content = content.replace(/dark:bg-zinc-900\/40/g, 'dark:bg-[#131622]/40');
  content = content.replace(/dark:bg-zinc-900/g, 'dark:bg-[#131622]');
  content = content.replace(/dark:bg-zinc-800/g, 'dark:bg-slate-800');
  content = content.replace(/bg-zinc-100/g, 'bg-slate-100');
  content = content.replace(/text-zinc-900/g, 'text-slate-900');
  content = content.replace(/text-zinc-800/g, 'text-slate-800');
  content = content.replace(/text-zinc-500/g, 'text-slate-500');
  content = content.replace(/text-zinc-400/g, 'text-slate-400');
  content = content.replace(/text-zinc-200/g, 'text-slate-200');
  content = content.replace(/text-zinc-100/g, 'text-slate-100');
  content = content.replace(/text-zinc-50/g, 'text-slate-50');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`[ZINC->SLATE] ${file} updated.`);
  }
});
