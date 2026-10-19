const fs = require('fs');
const file = 'apps/web/src/pages/Login.tsx';
let src = fs.readFileSync(file, 'utf8');

src = src.replace(
  '<section className="glass-card p-8 sm:p-10">',
  `<section className="relative overflow-hidden rounded-[2.25rem] bg-white/70 dark:bg-white/[0.04] p-8 sm:p-10 backdrop-blur-2xl ring-1 ring-inset ring-white/80 dark:ring-white/[0.08] shadow-[0_25px_60px_-15px_rgba(15,23,42,0.12)] dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20" />`
);

src = src.replace(
  'className="flex p-1 mb-6 rounded-[12px] bg-[var(--state-hover)] border border-[var(--border-subtle)] text-[13px] font-medium"',
  'className="flex p-1 mb-6 rounded-2xl bg-black/[0.04] dark:bg-white/[0.06] backdrop-blur-md border border-black/[0.05] dark:border-white/[0.08] text-[13px] font-medium shadow-inner"'
);

src = src.replace(
  `!isParent
                  ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-[0_1px_3px_rgba(0,0,0,0.1)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'`,
  `!isParent
                  ? 'bg-white dark:bg-white/15 text-slate-900 dark:text-white shadow-sm font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'`
);

src = src.replace(
  `isParent
                  ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-[0_1px_3px_rgba(0,0,0,0.1)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'`,
  `isParent
                  ? 'bg-white dark:bg-white/15 text-slate-900 dark:text-white shadow-sm font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'`
);

fs.writeFileSync(file, src, 'utf8');
console.log('Login.tsx modernized successfully!');
