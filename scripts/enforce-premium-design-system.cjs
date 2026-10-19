const fs = require('fs');
const path = require('path');

const PAGES_DIR = path.join(__dirname, '..', 'apps', 'web', 'src', 'pages');
const COMPONENTS_DIR = path.join(__dirname, '..', 'apps', 'web', 'src', 'components');

const REPLACEMENTS = [
  // 1. Primary Colors: Apple Blue (#007AFF) -> Royal Blue (#2563EB)
  { from: /#007AFF/gi, to: '#2563EB' },
  { from: /rgba\(\s*0\s*,\s*122\s*,\s*255\s*,/gi, to: 'rgba(37,99,235,' },

  // 2. Success: Apple Green (#34C759) -> Emerald (#10B981)
  { from: /#34C759/gi, to: '#10B981' },
  { from: /rgba\(\s*52\s*,\s*199\s*,\s*89\s*,/gi, to: 'rgba(16,185,129,' },

  // 3. Warning: Apple Orange (#FF9500) -> Amber (#F59E0B)
  { from: /#FF9500/gi, to: '#F59E0B' },
  { from: /rgba\(\s*255\s*,\s*149\s*,\s*0\s*,/gi, to: 'rgba(245,158,11,' },

  // 4. Danger: Apple Red (#FF3B30) -> Muted Red (#EF4444)
  { from: /#FF3B30/gi, to: '#EF4444' },
  { from: /rgba\(\s*255\s*,\s*59\s*,\s*48\s*,/gi, to: 'rgba(239,68,68,' },

  // 5. Accent: Apple Purple (#AF52DE) & Indigo (#5856D6) -> Soft Violet (#6366F1)
  { from: /#AF52DE/gi, to: '#6366F1' },
  { from: /#5856D6/gi, to: '#6366F1' },
  { from: /rgba\(\s*175\s*,\s*82\s*,\s*222\s*,/gi, to: 'rgba(99,102,241,' },

  // 6. Cyan / Sky: Apple Cyan (#32ADE6) -> Sky Blue (#0284C7)
  { from: /#32ADE6/gi, to: '#0284C7' },
  { from: /rgba\(\s*50\s*,\s*173\s*,\s*230\s*,/gi, to: 'rgba(2,132,199,' },

  // 7. Muted Slate: Apple Gray (#86868B) -> Slate Gray (#64748B)
  { from: /#86868B/gi, to: '#64748B' },
  { from: /rgba\(\s*134\s*,\s*134\s*,\s*139\s*,/gi, to: 'rgba(100,116,139,' },

  // 8. Dark Mode Surface: Apple OLED near-black (#1c1c1e) -> Obsidian Navy (#131622)
  { from: /#1c1c1e/gi, to: '#131622' },
  { from: /dark:bg-\[#1c1c1e80\]/gi, to: 'dark:bg-[#131622]/90' },
  { from: /dark:bg-\[#1c1c1e\]/gi, to: 'dark:bg-[#131622]' },

  // 9. Excessive Blurs: 40px blur -> clean 12px blur
  { from: /backdrop-blur-2xl/g, to: 'backdrop-blur-md' },
  { from: /backdrop-blur-3xl/g, to: 'backdrop-blur-md' },

  // 10. Bubble Radiuses: rounded-3xl / rounded-[2rem] -> crisp enterprise rounded-2xl
  { from: /rounded-3xl/g, to: 'rounded-2xl' },
  { from: /rounded-\[2rem\]/g, to: 'rounded-2xl' },

  // 11. Substrate Border and Background cleanups
  { from: /border-\[#ffffff60\]/g, to: 'border-slate-200/80' },
  { from: /dark:border-\[#ffffff10\]/g, to: 'dark:border-slate-800' },
  { from: /bg-\[#ffffff80\]/g, to: 'bg-white/90' },
];

function processDirectory(dirPath) {
  const files = fs.readdirSync(dirPath);
  let modifiedCount = 0;

  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      modifiedCount += processDirectory(fullPath);
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
      console.log(`[UPDATED] ${path.relative(path.join(__dirname, '..'), fullPath)}`);
      modifiedCount++;
    }
  }

  return modifiedCount;
}

console.log('=== STARTING ENFORCEMENT OF PREMIUM DESIGN TOKENS ===');
const pagesUpdated = processDirectory(PAGES_DIR);
console.log(`Processed pages directory: ${pagesUpdated} files updated.`);

const componentsUpdated = processDirectory(COMPONENTS_DIR);
console.log(`Processed components directory: ${componentsUpdated} files updated.`);
console.log(`=== TOTAL FILES UPDATED: ${pagesUpdated + componentsUpdated} ===`);
