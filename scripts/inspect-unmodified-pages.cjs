const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const gitStatus = execSync('git status --porcelain apps/web/src/pages', { encoding: 'utf8' });
const modifiedFiles = new Set(
  gitStatus.split('\n')
    .filter(l => l.trim())
    .map(l => l.substring(3).trim().replace(/\\/g, '/'))
);

const pagesDir = path.join(process.cwd(), 'apps', 'web', 'src', 'pages');
const allPages = fs.readdirSync(pagesDir).filter(f => f.endsWith('.tsx'));
const unmod = allPages.filter(f => !modifiedFiles.has('apps/web/src/pages/' + f));

console.log('Unmodified pages count:', unmod.length);

const summary = unmod.map(file => {
  const content = fs.readFileSync(path.join(pagesDir, file), 'utf8');
  return {
    file,
    lines: content.split('\n').length,
    hasMotion: content.includes('framer-motion'),
    hasGlassCard: content.includes('glass-card'),
    hasAppleDesignHeader: content.includes('Apple Design Award Edition') || content.includes('Apple-inspired') || content.includes('Apple Design'),
    hasPageContainer: content.includes('page-container'),
  };
});

console.table(summary);
