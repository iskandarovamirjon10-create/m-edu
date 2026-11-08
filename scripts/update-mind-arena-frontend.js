const fs = require('fs');
const path = require('path');

const filePath = path.resolve('apps/web/src/pages/MindArena.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add import
const importTarget = "import { useToast } from '@/components/ui/GlassToast';";
if (!content.includes('ArenaQuestionsStudio')) {
  content = content.replace(
    importTarget,
    importTarget + "\nimport { ArenaQuestionsStudio } from '@/components/arena/ArenaQuestionsStudio';"
  );
  console.log('Added ArenaQuestionsStudio import');
}

// 2. Update activeTab state type
content = content.replace(
  "useState<'studio' | 'titles' | 'leaderboard'>('studio')",
  "useState<'studio' | 'titles' | 'leaderboard' | 'questions'>('studio')"
);
console.log('Updated activeTab state definition');

// 3. Add Tab button
if (!content.includes("setActiveTab('questions')")) {
  const targetBtn = `onClick={() => setActiveTab('leaderboard')}`;
  const newBtn = `onClick={() => setActiveTab('questions')}
            className={\`px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 flex items-center gap-2 \${
              activeTab === 'questions'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }\`}
          >
            <span>🧠</span> Savollar Banki & AI
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')`;
  content = content.replace(targetBtn, newBtn);
  console.log('Added questions tab button');
}

// 4. Render questions tab content
if (!content.includes('<ArenaQuestionsStudio />')) {
  const targetEnd = `{/* Tab 3: Leaderboard */}`;
  const newTabContent = `{/* Tab 4: Questions Bank & AI Generator */}
        {activeTab === 'questions' && <ArenaQuestionsStudio />}

        {/* Tab 3: Leaderboard */}`;
  content = content.replace(targetEnd, newTabContent);
  console.log('Added ArenaQuestionsStudio tab content');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('MindArena.tsx updated successfully');
