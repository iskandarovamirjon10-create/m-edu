const fs = require('fs');
const path = require('path');

const filesToClean = [
  path.join(__dirname, '../apps/web/src/pages/MindArena.tsx'),
  path.join(__dirname, '../apps/web/src/components/arena/ArenaBattleStage.tsx'),
  path.join(__dirname, '../apps/web/src/components/arena/ArenaQuestionsStudio.tsx'),
  path.join(__dirname, '../apps/web/src/styles/arena-liquid.css'),
];

const REPLACEMENTS = [
  // Emojis & Symbols
  ['ðŸ”¥', '🔥'],
  ['âš¡', '⚡'],
  ['ðŸ§ ', '🧠'],
  ['ðŸ¤¯', '🤯'],
  ['ðŸ›¡ï¸ ', '🛡️'],
  ['ðŸ˜Ž', '😎'],
  ['ðŸŽ¯', '🎯'],
  ['ðŸš€', '🚀'],
  ['âš›ï¸ ', '⚛️'],
  ['ðŸ’»', '💻'],
  ['ðŸ“œ', '📜'],
  ['ðŸ‡¬ðŸ‡§', '🇬🇧'],
  ['ðŸ§©', '🧩'],
  ['ðŸ§', '🧩'],
  ['âš”ï¸ ', '⚔️'],
  ['ðŸ‘¤', '👤'],
  ['ðŸŽ–ï¸ ', '🎖️'],
  ['ðŸ †', '🏆'],
  ['ðŸ”‘', '🔑'],
  ['ðŸ“š', '📚'],
  ['ðŸ“Š', '📊'],
  ['ðŸ”¬', '🔬'],
  ['âš ï¸ ', '⚠️'],
  ['âœ¨', '✨'],
  ['ðŸ“ ', '📝'],
  ['ðŸ‘ ', '👥'],
  ['ðŸ“–', '📖'],
  ['ðŸ‘ï¸ ', '👁️'],
  ['ðŸ”’', '🔒'],
  ['ðŸ§ª', '🧪'],
  ['âœ“', '✓'],
  ['âœ•', '✕'],
  ['â€¢', '•'],
  ['Â±', '±'],
  ['â—¨', '◨'],
  ['âŒ˜', '⌘'],
  ['â†’', '→'],

  // Uzbek typography
  ['Oâ€˜', "O'"],
  ['Gâ€˜', "G'"],
  ['oâ€˜', "o'"],
  ['gâ€˜', "g'"],
  ['boâ€˜', "bo'"],
  ['doâ€˜', "do'"],
  ['yoâ€˜', "yo'"],
  ['koâ€˜', "ko'"],
  ['toâ€˜', "to'"],
  ['lugâ€˜', "lug'"],
  ['oâ€™', "o'"],
  ['gâ€™', "g'"],
  ['maâ€™', "ma'"],
  ['taâ€™', "ta'"],
  ['shoâ€™', "sho'"],
  ['eâ€™', "e'"],
  ['saâ€™', "sa'"],
  ['muâ€™', "mu'"],
  ['roâ€™', "ro'"],
  ['haâ€™', "ha'"],
  ['qoâ€˜', "qo'"],
  ['soâ€˜', "so'"],
  ['toâ€™', "to'"],
  ['yoâ€™', "yo'"],
  ['boâ€™', "bo'"],
  ['oâ€˜g', "o'g"],
  ['gâ€˜a', "g'a"],
  ['oâ€˜z', "o'z"],
  ['Oâ€˜z', "O'z"],
  ['boâ€˜l', "bo'l"],
  ['Boâ€˜l', "Bo'l"],
  ['oâ€˜t', "o't"],
  ['Oâ€˜t', "O't"],
  ['oâ€˜quv', "o'quv"],
  ['Oâ€˜quv', "O'quv"],
  ['oâ€˜qit', "o'qit"],
  ['Oâ€˜qit', "O'qit"],
  ['oâ€˜rin', "o'rin"],
  ['Oâ€˜rin', "O'rin"],
  ['oâ€˜zgar', "o'zgar"],
  ['Oâ€˜zgar', "O'zgar"],
  ['gâ€˜alaba', "g'alaba"],
  ['Gâ€˜alaba', "G'alaba"],
  ['oâ€˜rnat', "o'rnat"],
  ['Oâ€˜rnat', "O'rnat"],
  ['koâ€˜rsat', "ko'rsat"],
  ['Koâ€˜rsat', "Ko'rsat"],
  ['koâ€˜rib', "ko'rib"],
  ['Koâ€˜rib', "Ko'rib"],
  ['boâ€˜yicha', "bo'yicha"],
  ['Boâ€˜yicha', "Bo'yicha"],
  ['toâ€˜lov', "to'lov"],
  ['Toâ€˜lov', "To'lov"],
  ['toâ€˜g', "to'g"],
  ['Toâ€˜g', "To'g"],
  ['toâ€˜rt', "to'rt"],
  ['Toâ€˜rt', "To'rt"],
  ['toâ€˜liq', "to'liq"],
  ['Toâ€˜liq', "To'liq"],
];

for (const filePath of filesToClean) {
  if (!fs.existsSync(filePath)) continue;
  let content = fs.readFileSync(filePath, 'utf8');
  let replacedCount = 0;
  for (const [target, replacement] of REPLACEMENTS) {
    if (content.includes(target)) {
      content = content.split(target).join(replacement);
      replacedCount++;
    }
  }
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Cleaned ${path.basename(filePath)}: ${replacedCount} replacement rules matched`);
}
