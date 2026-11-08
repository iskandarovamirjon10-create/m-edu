const fs = require('fs');
const path = require('path');

const filePath = path.resolve('apps/web/src/pages/MindArena.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add import
if (!content.includes('ArenaBattleStage')) {
  content = content.replace(
    "import { ArenaQuestionsStudio } from '@/components/arena/ArenaQuestionsStudio';",
    "import { ArenaQuestionsStudio } from '@/components/arena/ArenaQuestionsStudio';\nimport { ArenaBattleStage } from '@/components/arena/ArenaBattleStage';"
  );
  console.log('Added ArenaBattleStage import');
}

// 2. Update state type
content = content.replace(
  "useState<'studio' | 'titles' | 'leaderboard' | 'questions'>('studio')",
  "useState<'battle' | 'studio' | 'titles' | 'questions' | 'leaderboard'>('battle')"
);
console.log('Updated activeTab state definition with battle default');

// 3. Add Tab button at front
if (!content.includes("setActiveTab('battle')")) {
  const targetFirstBtn = `<button
            onClick={() => setActiveTab('studio')}`;
  const newFirstBtn = `<button
            onClick={() => setActiveTab('battle')}
            className={\`px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 flex items-center gap-2 \${
              activeTab === 'battle'
                ? 'bg-gradient-to-r from-rose-500/20 via-pink-500/20 to-purple-500/20 text-rose-300 border border-rose-500/50 shadow-[0_0_20px_rgba(244,63,94,0.4)]'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }\`}
          >
            <span className="animate-pulse">⚔️</span> Jonli Jang (1v1 Arena)
          </button>
          <button
            onClick={() => setActiveTab('studio')}`;
  content = content.replace(targetFirstBtn, newFirstBtn);
  console.log('Added battle tab button');
}

// 4. Render Battle Stage tab content
if (!content.includes('<ArenaBattleStage')) {
  const targetMainArea = `<div className="max-w-7xl mx-auto">`;
  const newMainArea = `<div className="max-w-7xl mx-auto">
        {/* Tab 0: Realtime Live 1v1 Battle Arena */}
        {activeTab === 'battle' && <ArenaBattleStage myDuelProfile={profile} />}`;
  content = content.replace(targetMainArea, newMainArea);
  console.log('Added ArenaBattleStage tab content');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('MindArena.tsx updated with Battle Stage successfully');
