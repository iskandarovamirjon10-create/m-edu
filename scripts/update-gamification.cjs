const fs = require('fs');
const file = 'apps/web/src/pages/GamificationHub.tsx';
let src = fs.readFileSync(file, 'utf8');

src = src.replace(
  `      {/* Chromatic fringe */}`,
  `      {/* Apple V2 Top Specular Edge */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/25 z-20"
      />
      {/* Chromatic fringe */}`
);

fs.writeFileSync(file, src, 'utf8');
console.log('Updated GamificationHub.tsx with Apple V2 specular edge');
