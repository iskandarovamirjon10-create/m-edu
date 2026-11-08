const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SAMPLE_QUESTIONS = [
  {
    subjectCategory: 'MATHEMATICS',
    difficulty: 'EASY',
    status: 'APPROVED',
    source: 'ADMIN',
    questionText: 'Tenglamani yeching: 3x + 12 = 27. x ning qiymati nechaga teng?',
    explanation: '3x = 27 - 12 = 15 boʻladi. Demak, x = 15 / 3 = 5 ga teng.',
    timeLimitSec: 15,
    tags: ['algebra', 'chiziqli-tenglama'],
    timesUsed: 12,
    correctCount: 10,
    options: [
      { optionKey: 'A', optionText: 'x = 3', isCorrect: false, explanation: 'Xato hisoblash' },
      { optionKey: 'B', optionText: 'x = 5', isCorrect: true, explanation: 'Toʻgʻri javob' },
      { optionKey: 'C', optionText: 'x = 7', isCorrect: false, explanation: 'Xato hisoblash' },
      { optionKey: 'D', optionText: 'x = 9', isCorrect: false, explanation: 'Xato hisoblash' },
    ],
  },
  {
    subjectCategory: 'MATHEMATICS',
    difficulty: 'MEDIUM',
    status: 'APPROVED',
    source: 'ADMIN',
    questionText: 'Kvadrat tenglamaning ildizlari yigʻindisini toping: x² - 9x + 20 = 0.',
    explanation: 'Viyet teoremasiga koʻra: x₁ + x₂ = -(-9)/1 = 9 ga teng.',
    timeLimitSec: 20,
    tags: ['algebra', 'viyet-teoremasi'],
    timesUsed: 25,
    correctCount: 19,
    options: [
      { optionKey: 'A', optionText: 'x₁ + x₂ = -9', isCorrect: false },
      { optionKey: 'B', optionText: 'x₁ + x₂ = 20', isCorrect: false },
      { optionKey: 'C', optionText: 'x₁ + x₂ = 9', isCorrect: true },
      { optionKey: 'D', optionText: 'x₁ + x₂ = -20', isCorrect: false },
    ],
  },
  {
    subjectCategory: 'PHYSICS',
    difficulty: 'MEDIUM',
    status: 'APPROVED',
    source: 'ADMIN',
    questionText: 'Massasi 4 kg boʻlgan jismga 12 N kuch taʼsir qilmoqda. Jism qanday tezlanish bilan harakatlanadi?',
    explanation: 'Nyutonning 2-qonuniga asosan: a = F / m = 12 N / 4 kg = 3 m/s² boʻladi.',
    timeLimitSec: 20,
    tags: ['mexanika', 'nyuton-qonunlari'],
    timesUsed: 18,
    correctCount: 14,
    options: [
      { optionKey: 'A', optionText: '2 m/s²', isCorrect: false },
      { optionKey: 'B', optionText: '3 m/s²', isCorrect: true },
      { optionKey: 'C', optionText: '48 m/s²', isCorrect: false },
      { optionKey: 'D', optionText: '8 m/s²', isCorrect: false },
    ],
  },
  {
    subjectCategory: 'PROGRAMMING',
    difficulty: 'MEDIUM',
    status: 'APPROVED',
    source: 'ADMIN',
    questionText: 'Quyidagi JavaScript kodining bajarilishidan soʻng konsolga qaysi qiymat chiqadi?',
    codeSnippet: 'const arr = [10, 20, 30];\nconst res = arr.map(x => x / 10).filter(x => x > 1);\nconsole.log(res.length);',
    codeLanguage: 'javascript',
    explanation: 'arr.map(x => x / 10) natijasi [1, 2, 3]. filter(x => x > 1) natijasi [2, 3]. res.length = 2 boʻladi.',
    timeLimitSec: 25,
    tags: ['javascript', 'array-methods'],
    timesUsed: 30,
    correctCount: 22,
    options: [
      { optionKey: 'A', optionText: '1', isCorrect: false },
      { optionKey: 'B', optionText: '2', isCorrect: true },
      { optionKey: 'C', optionText: '3', isCorrect: false },
      { optionKey: 'D', optionText: 'undefined', isCorrect: false },
    ],
  },
  {
    subjectCategory: 'HISTORY',
    difficulty: 'EASY',
    status: 'APPROVED',
    source: 'ADMIN',
    questionText: 'Sohibqiron Amir Temur qaysi yilda tavallud topgan?',
    explanation: 'Amir Temur 1336-yil 9-aprelda Kesh (hozirgi Shahrisabz) yaqinidagi Xoʻja Ilgʻor qishlogʻida tugʻilgan.',
    timeLimitSec: 15,
    tags: ['temuriylar', 'tarix-sanalar'],
    timesUsed: 40,
    correctCount: 36,
    options: [
      { optionKey: 'A', optionText: '1336-yil', isCorrect: true },
      { optionKey: 'B', optionText: '1370-yil', isCorrect: false },
      { optionKey: 'C', optionText: '1405-yil', isCorrect: false },
      { optionKey: 'D', optionText: '1221-yil', isCorrect: false },
    ],
  },
  {
    subjectCategory: 'ENGLISH',
    difficulty: 'MEDIUM',
    status: 'APPROVED',
    source: 'ADMIN',
    questionText: 'Choose the correct form to complete the conditional sentence: "If she _____ harder, she would pass the exam."',
    explanation: 'Second Conditional (shart mayli 2): If + Past Simple, would + Verb 1. Demak "studied" toʻgʻri keladi.',
    timeLimitSec: 15,
    tags: ['grammar', 'second-conditional'],
    timesUsed: 15,
    correctCount: 11,
    options: [
      { optionKey: 'A', optionText: 'studies', isCorrect: false },
      { optionKey: 'B', optionText: 'studied', isCorrect: true },
      { optionKey: 'C', optionText: 'has studied', isCorrect: false },
      { optionKey: 'D', optionText: 'will study', isCorrect: false },
    ],
  },
  {
    subjectCategory: 'LOGIC_PUZZLE',
    difficulty: 'MEDIUM',
    status: 'APPROVED',
    source: 'ADMIN',
    questionText: 'Ketma-ketlikdagi qonuniyatni topib, boʻsh joydagi sonni aniqlang: 2, 6, 12, 20, 30, ___?',
    explanation: 'Qoʻshiluvchilar ketma-ketligi juft sonlar: +4, +6, +8, +10, keyingisi +12 boʻladi. 30 + 12 = 42. (Yoki n*(n+1): 1*2, 2*3, 3*4, 4*5, 5*6, 6*7=42).',
    timeLimitSec: 25,
    tags: ['mantiq', 'ketma-ketlik'],
    timesUsed: 22,
    correctCount: 15,
    options: [
      { optionKey: 'A', optionText: '38', isCorrect: false },
      { optionKey: 'B', optionText: '40', isCorrect: false },
      { optionKey: 'C', optionText: '42', isCorrect: true },
      { optionKey: 'D', optionText: '44', isCorrect: false },
    ],
  },
];

async function seed() {
  console.log('Seeding Mind Arena Phase 2 Verified Questions...');
  
  for (const q of SAMPLE_QUESTIONS) {
    const existing = await prisma.arenaQuestion.findFirst({
      where: { questionText: q.questionText },
    });

    if (!existing) {
      await prisma.arenaQuestion.create({
        data: {
          organizationId: null, // Global questions bank
          subjectCategory: q.subjectCategory,
          difficulty: q.difficulty,
          status: q.status,
          source: q.source,
          questionText: q.questionText,
          codeSnippet: q.codeSnippet,
          codeLanguage: q.codeLanguage,
          explanation: q.explanation,
          timeLimitSec: q.timeLimitSec,
          tags: q.tags,
          timesUsed: q.timesUsed,
          correctCount: q.correctCount,
          verificationLog: {
            score: 100,
            verifiedBy: 'MASTER_ARCHITECTURE_VALIDATION',
            timestamp: new Date().toISOString(),
          },
          options: {
            create: q.options.map((opt, idx) => ({
              optionKey: opt.optionKey,
              optionText: opt.optionText,
              isCorrect: opt.isCorrect,
              explanation: opt.explanation,
              orderIndex: idx,
            })),
          },
        },
      });
      console.log(`+ Created verified question: [${q.subjectCategory}] ${q.questionText.slice(0, 40)}...`);
    } else {
      console.log(`= Question already exists: [${q.subjectCategory}]`);
    }
  }

  const count = await prisma.arenaQuestion.count();
  console.log(`Total Arena Questions in DB: ${count}`);
}

seed()
  .catch(console.error)
  .finally(() => prisma['$disconnect']());
