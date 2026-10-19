/**
 * Uzbek NLP and Morphology Utilities for M-EDU AI Copilot.
 *
 * Provides safe morphological stem extraction, case/affix stripping, and entity
 * candidate grouping for Uzbek educational and administrative queries.
 */

// Normalized stop words that should not be queried as entity names
export const UZBEK_STOP_WORDS = new Set([
  'salom', 'assalomu', 'alaykum', 'qanday', 'haqida', 'tahlil', 'tahlili', 'ber', 'bering',
  'ko\'rsat', 'korsat', 'ko‘rsat', 'qiling', 'holati', 'davomati', 'to\'lovi', 'to‘lovi',
  'to\'lovlari', 'to‘lovlari', 'guruh', 'guruhi', 'guruhlari', 'talaba', 'talabalar',
  'o\'quvchi', 'o‘quvchi', 'o\'quvchilar', 'o‘quvchilar', 'bugun', 'bugungi', 'ertaga', 'kecha',
  'kimlar', 'kim', 'qaysi', 'nechta', 'bormi', 'yo\'qmi', 'yo‘qmi', 'yoqmi', 'narxi', 'dars',
  'darslari', 'batafsil', 'malumot', 'ma\'lumot', 'ma’lumot', 'tuzib', 'yordam', 'copilot',
  'qarz', 'qarzdor', 'qarzdorlik', 'status', 'summary', 'about', 'student', 'students',
  'group', 'groups', 'attendance', 'payment', 'payments', 'today', 'report', 'analyze',
  'analysis', 'check', 'details', 'kimga', 'qayerda', 'iltimos', 'aytib',
  'кто', 'сегодня', 'студент', 'студенты', 'группа', 'группы', 'посещаемость', 'оплата', 'долг'
]);

// Suffixes ordered by length descending to match longest affixes first
const SUFFIX_RULES: string[] = [
  // Compound case/plural/possessive
  'dagilardan', 'dagilarga', 'dagilarni', 'dagilar',
  'larning', 'laridan', 'lariga', 'larini', 'larida',
  'sining', 'sidan', 'siga', 'sini', 'sida',
  'imizga', 'imizdan', 'imizni', 'imizda', 'imiz',
  'ingizga', 'ingizdan', 'ingizni', 'ingizda', 'ingiz',
  
  // Honorific / Affectionate compounds
  'jonning', 'jondan', 'jonga', 'jonni', 'jonda',
  'bekning', 'bekdan', 'bekga', 'bekni', 'bekda',
  'xonning', 'xondan', 'xonga', 'xonni', 'xonda',

  // Basic cases & plurals
  'dagi', 'ning', 'dan', 'lar', 'lari', 'ga', 'ka', 'qa', 'da', 'ni',
  'si', 'im', 'ing', 'i',

  // Honorific roots
  'jon', 'bek', 'xon', 'boy',
];

/**
 * Normalize apostrophes and diacritics in Uzbek text.
 */
export function normalizeUzbekText(text: string): string {
  if (!text) return '';
  return text
    .replace(/[‘`’]/g, "'")
    .toLowerCase()
    .trim();
}

/**
 * Safely strips common Uzbek suffixes from a word while preserving the stem.
 * Returns an array containing candidate stems (ordered from shortest/deepest stem to original).
 */
export function stemUzbekWord(rawWord: string): string[] {
  const trimmed = rawWord.trim();
  if (trimmed.length <= 3) {
    return [trimmed];
  }

  const results: string[] = [trimmed];
  const lower = trimmed.toLowerCase();

  let currentLower = lower;
  let changed = true;
  let iterations = 0;

  while (changed && iterations < 3 && currentLower.length > 3) {
    changed = false;
    iterations++;

    for (const suffix of SUFFIX_RULES) {
      if (currentLower.endsWith(suffix) && currentLower.length - suffix.length >= 3) {
        const stemLength = currentLower.length - suffix.length;
        const stemOriginal = trimmed.slice(0, stemLength);
        if (!results.includes(stemOriginal)) {
          results.push(stemOriginal);
        }
        currentLower = currentLower.slice(0, stemLength);
        changed = true;
        break;
      }
    }
  }

  return Array.from(new Set(results)).reverse();
}

export interface EntityCandidates {
  singleTokens: string[];
  namePairs: Array<{ first: string; last: string }>;
}

/**
 * Checks if a word or any of its stems is a known stop word.
 */
function isStopWordOrStem(token: string, stems: string[]): boolean {
  if (UZBEK_STOP_WORDS.has(token.toLowerCase())) return true;
  for (const stem of stems) {
    if (UZBEK_STOP_WORDS.has(stem.toLowerCase())) return true;
  }
  return false;
}

/**
 * Extracts candidate entity tokens and potential Full Name (first + last) pairs from a natural language query.
 */
export function extractUzbekEntityCandidates(message: string): EntityCandidates {
  if (!message || message.trim().length < 2) {
    return { singleTokens: [], namePairs: [] };
  }

  // Standardize apostrophes
  const normalized = message.replace(/[‘`’]/g, "'");

  // Split into raw words by whitespace and common punctuation
  const rawTokens = normalized
    .replace(/[,;!?()[\]{}"~^#$%=]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2);

  const cleanCandidates: string[] = [];
  const tokenStemsMap: Array<{ original: string; stems: string[] }> = [];

  for (const token of rawTokens) {
    const stems = stemUzbekWord(token);
    if (isStopWordOrStem(token, stems)) continue;

    tokenStemsMap.push({ original: token, stems });

    for (const stem of stems) {
      if (!cleanCandidates.includes(stem)) {
        cleanCandidates.push(stem);
      }
    }
  }

  // Generate adjacent name pairs (First Last) from successive candidate words
  const namePairs: Array<{ first: string; last: string }> = [];
  for (let i = 0; i < tokenStemsMap.length - 1; i++) {
    const current = tokenStemsMap[i];
    const next = tokenStemsMap[i + 1];

    for (const s1 of current.stems) {
      for (const s2 of next.stems) {
        namePairs.push({ first: s1, last: s2 });
      }
    }
  }

  return {
    singleTokens: cleanCandidates.slice(0, 8),
    namePairs: namePairs.slice(0, 6),
  };
}
