const fs = require('fs');
const path = require('path');

const PAGES_DIR = path.join(__dirname, '..', 'apps', 'web', 'src', 'pages');

const REPLACEMENTS = [
  // 1. Moderate blurs down to crisp 12px
  { from: /backdrop-blur-xl/g, to: 'backdrop-blur-md' },

  // 2. Black border utilities to Slate tokens
  { from: /border-\[#00000008\]/g, to: 'border-slate-200/80 dark:border-slate-800' },
  { from: /border-\[#00000010\]/g, to: 'border-slate-200/80 dark:border-slate-800' },
  { from: /border-\[#00000015\]/g, to: 'border-slate-300 dark:border-slate-700' },
  { from: /border-black\/\[0\.06\]/g, to: 'border-slate-200/80 dark:border-slate-800' },
  { from: /divide-\[#00000008\]/g, to: 'divide-slate-200/80 dark:divide-slate-800' },
  { from: /divide-black\/\[0\.04\]/g, to: 'divide-slate-200/80 dark:divide-slate-800' },

  // 3. Black background tints to Slate tints
  { from: /bg-\[#00000002\]/g, to: 'bg-slate-500/[0.02]' },
  { from: /bg-\[#00000004\]/g, to: 'bg-slate-100 dark:bg-slate-800/40' },
  { from: /bg-\[#00000006\]/g, to: 'bg-slate-100 dark:bg-slate-800/60' },
  { from: /bg-\[#0000000A\]/g, to: 'bg-slate-200 dark:bg-slate-800' },
  { from: /bg-black\/\[0\.02\]/g, to: 'bg-slate-50 dark:bg-slate-900/40' },
  { from: /bg-black\/\[0\.06\]/g, to: 'bg-slate-200 dark:bg-slate-800' },

  // 4. Black hovers to Slate hovers
  { from: /hover:bg-\[#00000008\]/g, to: 'hover:bg-slate-100 dark:hover:bg-slate-800/60' },
  { from: /hover:bg-black\/\[0\.02\]/g, to: 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40' },
  { from: /hover:bg-black\/\[0\.05\]/g, to: 'hover:bg-slate-100 dark:hover:bg-slate-800/60' },
  { from: /hover:bg-black\/\[0\.06\]/g, to: 'hover:bg-slate-100 dark:hover:bg-slate-800/60' },
  { from: /hover:bg-black\/5/g, to: 'hover:bg-slate-100 dark:hover:bg-slate-800' },

  // 5. Black rings to Slate rings
  { from: /dark:ring-black\/30/g, to: 'dark:ring-slate-900/50' },
  { from: /dark:ring-black\/50/g, to: 'dark:ring-slate-900/60' },

  // 6. Generic blue in Grades to brand Royal Blue
  { from: /bg-blue-500\/10/g, to: 'bg-brand-500/10' },
  { from: /text-blue-600/g, to: 'text-brand-600' },
  { from: /dark:text-blue-400/g, to: 'dark:text-brand-400' },
  { from: /border-blue-500\/25/g, to: 'border-brand-500/25' },
];

function processDirectory(dirPath) {
  const files = fs.readdirSync(dirPath);
  let count = 0;

  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      count += processDirectory(fullPath);
      continue;
    }

    if (!file.endsWith('.tsx') && !file.endsWith('.ts')) continue;

    let content = fs.readFileSync(fullPath, 'utf8');
    let original = content;

    for (const { from, to } of REPLACEMENTS) {
      content = content.replace(from, to);
    }

    if (content !== original) {
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`[REFINED] ${file}`);
      count++;
    }
  }

  return count;
}

const refined = processDirectory(PAGES_DIR);
console.log(`=== TOTAL REFINED FILES: ${refined} ===`);
