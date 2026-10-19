const fs = require('fs');
const path = require('path');

const specularSnippet = `<div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20 z-10" />`;

// 1. AiCopilot.tsx
{
  const file = path.join(process.cwd(), 'apps/web/src/pages/AiCopilot.tsx');
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(
    `      {/* Layer 1 — Top sheen */}`,
    `      ${specularSnippet}\n      {/* Layer 1 — Top sheen */}`
  );
  fs.writeFileSync(file, content, 'utf8');
  console.log('Updated AiCopilot.tsx');
}

// 2. GamificationHub.tsx
{
  const file = path.join(process.cwd(), 'apps/web/src/pages/GamificationHub.tsx');
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(
    '<div className="page-container relative z-10 space-y-6">',
    `<div className="page-container relative z-10 space-y-6">\n        ${specularSnippet}`
  );
  fs.writeFileSync(file, content, 'utf8');
  console.log('Updated GamificationHub.tsx');
}

// 3. Schedule.tsx
{
  const file = path.join(process.cwd(), 'apps/web/src/pages/Schedule.tsx');
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(
    '<motion.div variants={cardVariants}>',
    `<motion.div variants={cardVariants}>\n        ${specularSnippet}`
  );
  fs.writeFileSync(file, content, 'utf8');
  console.log('Updated Schedule.tsx');
}

// 4. TelegramWebApp.tsx
{
  const file = path.join(process.cwd(), 'apps/web/src/pages/TelegramWebApp.tsx');
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(
    'return (',
    `// Apple V2 Cupertino Refinement\n  return (`
  );
  content = content.replace(
    '<div className="relative min-h-screen',
    `<div className="relative min-h-screen">\n        ${specularSnippet}<div className="`
  );
  fs.writeFileSync(file, content, 'utf8');
  console.log('Updated TelegramWebApp.tsx');
}
