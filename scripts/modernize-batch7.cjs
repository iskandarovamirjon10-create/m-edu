const fs = require('fs');
const path = require('path');

const files = [
  'apps/web/src/pages/FeatureFlags.tsx',
  'apps/web/src/pages/GamificationHub.tsx',
  'apps/web/src/pages/ImportExport.tsx',
  'apps/web/src/pages/ResourceBooking.tsx',
  'apps/web/src/pages/SecurityCenter.tsx',
  'apps/web/src/pages/SystemHealth.tsx',
  'apps/web/src/pages/Users.tsx',
  'apps/web/src/pages/WhatChanged.tsx',
  'apps/web/src/pages/AnomalyDetection.tsx'
];

const specularSnippet = `<div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20 z-10" />`;

files.forEach(f => {
  const filePath = path.join(process.cwd(), f);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  // Fix relative imports if any
  content = content.replace(/from '\.\.\/lib\//g, "from '@/lib/");
  content = content.replace(/from '\.\.\/i18n\//g, "from '@/i18n/");

  if (f.endsWith('FeatureFlags.tsx')) {
    if (!content.includes("from 'framer-motion'")) {
      content = `import { motion } from 'framer-motion';\n` + content;
      content = content.replace(
        '<div className="page-container space-y-4">',
        `<motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', damping: 28, stiffness: 320 }} className="page-container space-y-4">`
      );
      content = content.replace(
        '<div className="glass-card overflow-hidden">',
        `<div className="relative overflow-hidden rounded-[2rem] bg-white/70 dark:bg-white/[0.04] backdrop-blur-2xl ring-1 ring-inset ring-black/[0.06] dark:ring-white/[0.08] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)]">\n          ${specularSnippet}`
      );
      content = content.replace('</div>\n    </div>\n\n      <GlassModal', '</motion.div>\n    </div>\n\n      <GlassModal');
    }
  }

  if (f.endsWith('ImportExport.tsx')) {
    if (!content.includes("from 'framer-motion'")) {
      content = `import { motion } from 'framer-motion';\n` + content;
      content = content.replace(
        '<div className="page-container space-y-4">',
        `<motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', damping: 28, stiffness: 320 }} className="page-container space-y-4">`
      );
      content = content.replace(
        '<div className="glass-card overflow-hidden">',
        `<div className="relative overflow-hidden rounded-[2rem] bg-white/70 dark:bg-white/[0.04] backdrop-blur-2xl ring-1 ring-inset ring-black/[0.06] dark:ring-white/[0.08] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)]">\n          ${specularSnippet}`
      );
      content = content.replace(
        '<div className="glass-card p-4 space-y-2">',
        `<div className="relative overflow-hidden rounded-[2rem] bg-white/70 dark:bg-white/[0.04] backdrop-blur-2xl ring-1 ring-inset ring-black/[0.06] dark:ring-white/[0.08] shadow-sm p-4 space-y-2">\n          ${specularSnippet}`
      );
      content = content.replace('</div>\n    </div>\n  );\n}\n', '</motion.div>\n    </div>\n  );\n}\n');
    }
  }

  if (f.endsWith('ResourceBooking.tsx')) {
    if (!content.includes("from 'framer-motion'")) {
      content = `import { motion } from 'framer-motion';\n` + content;
      content = content.replace(
        '<div className="page-container space-y-4">',
        `<motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', damping: 28, stiffness: 320 }} className="page-container space-y-4">`
      );
      content = content.replace(
        '<div className="glass-card overflow-hidden">',
        `<div className="relative overflow-hidden rounded-[2rem] bg-white/70 dark:bg-white/[0.04] backdrop-blur-2xl ring-1 ring-inset ring-black/[0.06] dark:ring-white/[0.08] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)]">\n          ${specularSnippet}`
      );
      content = content.replace('</div>\n    </div>\n\n      {/* Modal create/edit */}', '</motion.div>\n    </div>\n\n      {/* Modal create/edit */}');
    }
  }

  if (f.endsWith('SecurityCenter.tsx')) {
    if (!content.includes("from 'framer-motion'")) {
      content = `import { motion } from 'framer-motion';\n` + content;
      content = content.replace(
        '<div className="page-container space-y-4">',
        `<motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', damping: 28, stiffness: 320 }} className="page-container space-y-4">`
      );
      content = content.replace(
        '<div className="glass-card overflow-hidden">',
        `<div className="relative overflow-hidden rounded-[2rem] bg-white/70 dark:bg-white/[0.04] backdrop-blur-2xl ring-1 ring-inset ring-black/[0.06] dark:ring-white/[0.08] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)]">\n          ${specularSnippet}`
      );
      content = content.replace(
        '<div className="glass-card p-4 space-y-2">',
        `<div className="relative overflow-hidden rounded-[2rem] bg-white/70 dark:bg-white/[0.04] backdrop-blur-2xl ring-1 ring-inset ring-black/[0.06] dark:ring-white/[0.08] shadow-sm p-4 space-y-2">\n          ${specularSnippet}`
      );
      content = content.replace('</div>\n    </div>\n  );\n}\n', '</motion.div>\n    </div>\n  );\n}\n');
    }
  }

  if (f.endsWith('SystemHealth.tsx')) {
    if (!content.includes("from 'framer-motion'")) {
      content = `import { motion } from 'framer-motion';\n` + content;
      content = content.replace(
        '<div className="page-container space-y-4">',
        `<motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', damping: 28, stiffness: 320 }} className="page-container space-y-4">`
      );
      content = content.replace('</div>\n    </div>\n  );\n}\n', '</motion.div>\n    </div>\n  );\n}\n');
    }
  }

  if (f.endsWith('WhatChanged.tsx')) {
    if (!content.includes("from 'framer-motion'")) {
      content = `import { motion } from 'framer-motion';\n` + content;
      content = content.replace(
        '<div className="page-container space-y-4">',
        `<motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', damping: 28, stiffness: 320 }} className="page-container space-y-4">`
      );
      content = content.replace(
        '<div className="glass-card overflow-hidden">',
        `<div className="relative overflow-hidden rounded-[2rem] bg-white/70 dark:bg-white/[0.04] backdrop-blur-2xl ring-1 ring-inset ring-black/[0.06] dark:ring-white/[0.08] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)]">\n          ${specularSnippet}`
      );
      content = content.replace('</div>\n    </div>\n  );\n}\n', '</motion.div>\n    </div>\n  );\n}\n');
    }
  }

  if (f.endsWith('AnomalyDetection.tsx')) {
    if (!content.includes("from 'framer-motion'")) {
      content = `import { motion } from 'framer-motion';\n` + content;
      content = content.replace(
        '<div className="relative z-10 w-full max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6 animate-in fade-in duration-500">',
        `<motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', damping: 28, stiffness: 320 }} className="relative z-10 w-full max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6">`
      );
      content = content.replace(
        'className="relative overflow-hidden rounded-[2rem] p-5 sm:p-6 group transition-all duration-300 hover:-translate-y-1 glass-card flex flex-col justify-between h-full"',
        'className="relative overflow-hidden rounded-[2rem] p-5 sm:p-6 group transition-all duration-300 hover:-translate-y-1 bg-white/70 dark:bg-white/[0.04] backdrop-blur-2xl ring-1 ring-inset ring-black/[0.06] dark:ring-white/[0.08] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] flex flex-col justify-between h-full"'
      );
      content = content.replace('</div>\n  </div>\n  );\n}\n\nexport default AnomalyDetectionPage;', '</motion.div>\n  </div>\n  );\n}\n\nexport default AnomalyDetectionPage;');
    }
  }

  if (f.endsWith('Users.tsx')) {
    if (!content.includes("from 'framer-motion'")) {
      content = `import { motion } from 'framer-motion';\n` + content;
      content = content.replace(
        '<div className="page-container relative z-10 space-y-5 animate-in fade-in duration-700">',
        `<motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', damping: 28, stiffness: 320 }} className="page-container relative z-10 space-y-5">`
      );
      content = content.replace('</div>\n    </div>\n  );\n}\n', '</motion.div>\n    </div>\n  );\n}\n');
    }
  }

  // Inject specular highlight into cards
  if (!content.includes('via-white/80 to-transparent dark:via-white/20')) {
    content = content.replace(
      /(<div[^>]*className="[^"]*relative overflow-hidden rounded-(?:3xl|2xl|\[2(?:\.[0-9]+)?rem\])[^"]*"[^>]*>)/g,
      `$1\n        ${specularSnippet}`
    );
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated Batch 7 file: ${f}`);
});
