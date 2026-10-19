const fs = require('fs');
const path = require('path');

const files = [
  'apps/web/src/pages/Payments.tsx',
  'apps/web/src/pages/Expenses.tsx',
  'apps/web/src/pages/Reports.tsx',
  'apps/web/src/pages/FinancialAnalytics.tsx',
  'apps/web/src/pages/PayrollAnalytics.tsx',
  'apps/web/src/pages/CRMAnalytics.tsx',
  'apps/web/src/pages/Reconciliation.tsx',
  'apps/web/src/pages/Audit.tsx'
];

const specularSnippet = `<div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20 z-10" />`;

files.forEach(f => {
  const filePath = path.join(process.cwd(), f);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  // Fix relative imports:
  content = content.replace(/from '\.\.\/lib\//g, "from '@/lib/");
  content = content.replace(/from '\.\.\/i18n\//g, "from '@/i18n/");

  if (f.endsWith('Expenses.tsx')) {
    content = content.replace("import { toLocalISOString } from '../lib/format';", "import { toLocalISOString } from '@/lib/format';");
  }

  if (f.endsWith('Audit.tsx')) {
    if (!content.includes("from 'framer-motion'")) {
      content = `import { motion } from 'framer-motion';\n` + content;
      content = content.replace(
        '<div className="page-container space-y-4">',
        `<motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', damping: 28, stiffness: 320 }} className="page-container space-y-4">`
      );
      content = content.replace(
        '<div className="glass-card overflow-hidden">',
        `<div className="relative overflow-hidden rounded-[2rem] bg-white/70 dark:bg-white/[0.04] backdrop-blur-2xl ring-1 ring-inset ring-black/[0.06] dark:ring-white/[0.08] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)]">\n        ${specularSnippet}`
      );
      content = content.replace('</div>\n  );\n}\n\nexport default AuditPage;', '</motion.div>\n  );\n}\n\nexport default AuditPage;');
    }
  }

  if (f.endsWith('Reconciliation.tsx')) {
    if (!content.includes("from 'framer-motion'")) {
      content = `import { motion } from 'framer-motion';\n` + content;
      content = content.replace(
        '<div className="relative z-10 w-full max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6 animate-in fade-in duration-500">',
        `<motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', damping: 28, stiffness: 320 }} className="relative z-10 w-full max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6">`
      );
      content = content.replace(
        '</div>\n  </div>\n  );\n}\n\nexport default ReconciliationPage;',
        '</motion.div>\n  </div>\n  );\n}\n\nexport default ReconciliationPage;'
      );
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
  console.log(`Updated Batch 4 file: ${f}`);
});
