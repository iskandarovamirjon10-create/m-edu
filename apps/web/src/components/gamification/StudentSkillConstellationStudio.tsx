/**
 * M-EDU V2 — Student Skill Constellation & RPG Mastery Tree Studio (`StudentSkillConstellationStudio.tsx`)
 *
 * Apple Liquid Glass & VisionOS spatial aesthetics:
 *  - 4 Learning Tracks: Full-Stack Dasturlash, IELTS & Xalqaro Ingliz Tili, Oliy Matematika, Sun'iy Intellekt
 *  - 4 Tier Progression: Poydevor -> Amaliy Mahorat -> Ilg'or Tizimlar -> Chempionlik Boss Sertifikati
 *  - Dynamic SVG Laser Neon Connector Paths (flowing dash offset, glow filters, branch dependency verification)
 *  - Interactive Node Inspector: Learning objectives, prerequisites, real-time practice checkpoint quiz
 *  - Live XP / Coin claiming ceremony with Web Audio haptic feedback
 *  - Printable A4 "Mahorat Pasporti / Skill Mastery Passport"
 *  - WCAG 2.2 AA compliant (>= 44x44px touch targets, keyboard navigable, aria attributes)
 */

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useToasts, GlassModal } from '@/components/ui';

/* ══════════════════════════════════════════════════════════════════
 * 1. TYPES & CONTRACTS
 * ══════════════════════════════════════════════════════════════════ */

export type NodeStatus = 'locked' | 'available' | 'in_progress' | 'completed' | 'mastered';

export interface SkillQuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface SkillNode {
  id: string;
  trackId: string;
  tier: 1 | 2 | 3 | 4;
  title: string;
  subtitle: string;
  icon: string;
  status: NodeStatus;
  xpReward: number;
  coinReward: number;
  prerequisites: string[];
  learningOutcomes: string[];
  quiz: SkillQuizQuestion[];
  gridX: number; // 0 to 100 relative coordinate on SVG canvas
  gridY: number; // 0 to 100 relative coordinate on SVG canvas
}

export interface SkillTrack {
  id: string;
  name: string;
  code: string;
  icon: string;
  description: string;
  color: string;
  accentGlow: string;
  nodes: SkillNode[];
}

interface StudentSkillConstellationStudioProps {
  studentName?: string;
  studentLevel?: number;
  onSkillUnlocked?: (skillId: string, earnedXp: number, earnedCoins: number) => void;
  onClose?: () => void;
}

/* ══════════════════════════════════════════════════════════════════
 * 2. SEED KNOWLEDGE GRAPH DATA
 * ══════════════════════════════════════════════════════════════════ */

const SKILL_TRACKS: SkillTrack[] = [
  {
    id: 'fullstack',
    name: "Full-Stack Dasturlash & Bulut Tizimlari",
    code: 'FS-PRO',
    icon: '🚀',
    description: "Zamonaviy React, Node.js, TypeScript va Cloud arxitekturasini noldan professional darajagacha egallang.",
    color: '#007AFF',
    accentGlow: 'rgba(0,122,255,0.35)',
    nodes: [
      {
        id: 'fs-1',
        trackId: 'fullstack',
        tier: 1,
        title: "TypeScript & Tiplar Mantig'i",
        subtitle: "Type safety, generics va algebraic data types",
        icon: '🔷',
        status: 'mastered',
        xpReward: 150,
        coinReward: 35,
        prerequisites: [],
        learningOutcomes: [
          "Murakkab interfeyslar va generics sintaksisi",
          "Union, intersection va mapped tiplar",
          "Null safety va runtime invariantlar",
        ],
        quiz: [
          {
            id: 'q1',
            question: "TypeScript-da 'unknown' va 'any' ning asosiy farqi nimada?",
            options: [
              "'unknown' har doim type narrowing (tekshiruv) talab qiladi, 'any' esa tekshiruvni butunlay chetlab o'tadi",
              "'unknown' faqat satrlar uchun, 'any' esa sonlar uchun",
              "Hech qanday farqi yo'q, ikkalasi ham bir xil ishlaydi",
              "'any' xavfsizroq hisoblanadi",
            ],
            correctIndex: 0,
            explanation: "'unknown' tipi har qanday qiymatni qabul qilsa-da, undan foydalanishdan oldin type guard orqali tekshirishni majburiy qiladi.",
          },
        ],
        gridX: 20,
        gridY: 15,
      },
      {
        id: 'fs-2',
        trackId: 'fullstack',
        tier: 1,
        title: "Algoritmik Murakkablik & O(n)",
        subtitle: "Massivlar, hashtable va xotira optimizatsiyasi",
        icon: '⚡',
        status: 'completed',
        xpReward: 200,
        coinReward: 50,
        prerequisites: ['fs-1'],
        learningOutcomes: [
          "Vaqt va xotira murakkabligini tahlil qilish",
          "Hash Map orqali O(1) qidiruv mexanizmlari",
          "Massiv va Linked List xotira taqsimoti",
        ],
        quiz: [
          {
            id: 'q2',
            question: "Hash Table (Obyekt/Map) elementini kalit bo'yicha olishning o'rtacha vaqt murakkabligi qanday?",
            options: ["O(1)", "O(n)", "O(log n)", "O(n^2)"],
            correctIndex: 0,
            explanation: "To'g'ri hash taqsimotida elementni olish O(1) doimiy vaqt talab qiladi.",
          },
        ],
        gridX: 50,
        gridY: 15,
      },
      {
        id: 'fs-3',
        trackId: 'fullstack',
        tier: 1,
        title: "Asinxron Dasturlash & Event Loop",
        subtitle: "Promises, async/await va microtask navbatlari",
        icon: '⏳',
        status: 'completed',
        xpReward: 220,
        coinReward: 55,
        prerequisites: ['fs-1'],
        learningOutcomes: [
          "Call Stack va Microtask Queue ishlash prinsiplari",
          "Promise chaining va xatoliklarni ushlash",
          "Race conditions va mutex/semaphore himoyasi",
        ],
        quiz: [
          {
            id: 'q3',
            question: "Promise.resolve() qaysi navbatda (queue) bajariladi?",
            options: ["Microtask queue", "Macrotask queue (setTimeout)", "Render queue", "OS background thread"],
            correctIndex: 0,
            explanation: "Vada (Promise) bajarilish zanjirlari Microtask navbatiga tushadi va Macrotaskdan oldin bajariladi.",
          },
        ],
        gridX: 80,
        gridY: 15,
      },
      {
        id: 'fs-4',
        trackId: 'fullstack',
        tier: 2,
        title: "React Virtual DOM & Fiber",
        subtitle: "Reconciliation, useTransition va render fazalari",
        icon: '⚛️',
        status: 'in_progress',
        xpReward: 300,
        coinReward: 70,
        prerequisites: ['fs-2', 'fs-3'],
        learningOutcomes: [
          "React 18 Concurrent Rendering mexanizmi",
          "Memoizatsiya va ortiqcha re-renderlarni bartaraf etish",
          "Custom hookslarda biznes mantig'ini ajratish",
        ],
        quiz: [
          {
            id: 'q4',
            question: "useCallback asosiy maqsadi nima?",
            options: [
              "Funksiya nusxasini re-renderlar oralig'ida barqaror saqlab qolish",
              "Komponentni butunlay qayta chizilishdan to'xtatish",
              "Asinxron so'rovlarni avtomatik keshlash",
              "CSS animatsiyalarini tezlashtirish",
            ],
            correctIndex: 0,
            explanation: "useCallback o'ziga bog'liq o'zgaruvchilar o'zgarmaguncha funksiyaning bir xil xotira manzilini saqlaydi.",
          },
        ],
        gridX: 35,
        gridY: 42,
      },
      {
        id: 'fs-5',
        trackId: 'fullstack',
        tier: 2,
        title: "PostgreSQL & Prisma Tranzaksiyalar",
        subtitle: "ACID tamoyillari, indekslar va row-level locking",
        icon: '🗄️',
        status: 'available',
        xpReward: 320,
        coinReward: 80,
        prerequisites: ['fs-3'],
        learningOutcomes: [
          "B-Tree indekslar va EXPLAIN ANALYZE so'rov optimizatsiyasi",
          "Jadval tranzaksiyalari va Rollback mexanizmlari",
          "Race conditions qarshi Pessimistic/Optimistic locking",
        ],
        quiz: [
          {
            id: 'q5',
            question: "Tranzaksiyalarda 'Atomicity' nimani bildiradi?",
            options: [
              "Barcha amallar yo to'liq muvaffaqiyatli bajariladi, yoki umuman bajarilmay orqaga qaytariladi",
              "Har bir so'rov 1 ms ichida bajarilishi kerak",
              "Ma'lumotlar faqat bitta foydalanuvchiga ko'rinadi",
              "Faqat bitta jadval bilan ishlash mumkin",
            ],
            correctIndex: 0,
            explanation: "Atomarlik — 'hammasi yoki hech narsa' qoidasi bo'yicha xatolik yuz berganda barcha o'zgarishlarni bekor qiladi.",
          },
        ],
        gridX: 65,
        gridY: 42,
      },
      {
        id: 'fs-6',
        trackId: 'fullstack',
        tier: 3,
        title: "Distributed Caching & Redis Pub/Sub",
        subtitle: "Kesh invalidatsiyasi va real-time xabar almashinuvi",
        icon: '⚡',
        status: 'locked',
        xpReward: 400,
        coinReward: 100,
        prerequisites: ['fs-4', 'fs-5'],
        learningOutcomes: [
          "Redis In-memory kesh strategiyalari (Cache-Aside, Write-Through)",
          "Websocket va Redis Pub/Sub gorizontal miqyoslash",
          "Rate limiting va distributed lock (Redlock)",
        ],
        quiz: [
          {
            id: 'q6',
            question: "Kesh buzilishining oldini olish uchun qaysi strategiya eng samarali?",
            options: [
              "TTL muddatiga random jitter (tebranish) qo'shish",
              "Keshni hech qachon o'chirmaslik",
              "Faqat fayllar tizimidan kesh sifatida foydalanish",
              "Barcha so'rovlarni navbatsiz to'g'ridan-to'g'ri bazaga yuborish",
            ],
            correctIndex: 0,
            explanation: "Tasodifiy jitter bir vaqtda millionlab kesh yozuvlari muddatining tugab bazaga zarba berishini (thundering herd) oldini oladi.",
          },
        ],
        gridX: 50,
        gridY: 68,
      },
      {
        id: 'fs-7',
        trackId: 'fullstack',
        tier: 4,
        title: "👑 Chempionlik Boss: Global FinTech Core",
        subtitle: "Millionlab operatsiyalarga mo'ljallangan xavfsiz to'lov va ta'lim dvigateli",
        icon: '🏆',
        status: 'locked',
        xpReward: 750,
        coinReward: 250,
        prerequisites: ['fs-6'],
        learningOutcomes: [
          "Idempotency kalitlari va 0% dublikat kafolati",
          "Zero-trust xavfsizlik va biometrik Face ID kripto-tasdiqlash",
          "Multi-tenant arxitektura va avtomatik audit izlari",
        ],
        quiz: [
          {
            id: 'q7',
            question: "Moliya tizimlarida Idempotency kalitining vazifasi nima?",
            options: [
              "Foydalanuvchi tugmani ikki marta bosganda yoki tarmoq uzilganda to'lov faqat bir marta o'tishini kafolatlash",
              "Parollarni shifrlash",
              "Foydalanuvchi sessiyasini 1 kunga uzaytirish",
              "Bazadagi eski yozuvlarni arxivlash",
            ],
            correctIndex: 0,
            explanation: "Idempotent amallar takroran yuborilgan taqdirda ham yakuniy holatni bir xil saqlab, ortiqcha pul yechilishini man etadi.",
          },
        ],
        gridX: 50,
        gridY: 90,
      },
    ],
  },
  {
    id: 'ielts',
    name: "IELTS 8.5+ & Xalqaro Akademik Ingliz Tili",
    code: 'IELTS-ADV',
    icon: '🌐',
    description: "Listening, Reading, Writing Task 1/2 va Speaking bo'yicha C1/C2 darajasidagi xalqaro mahorat shajarasi.",
    color: '#8B5CF6',
    accentGlow: 'rgba(139,92,246,0.35)',
    nodes: [
      {
        id: 'ielts-1',
        trackId: 'ielts',
        tier: 1,
        title: "C1 Akademik Leksika (Collocations)",
        subtitle: "Idiomatic phrasing, formal register va context clues",
        icon: '📚',
        status: 'mastered',
        xpReward: 160,
        coinReward: 40,
        prerequisites: [],
        learningOutcomes: [
          "Akademik mavzularda tabiiy kollokatsiyalar",
          "Sinonimlar orqali parafraz qilish san'ati",
          "Noaniqlik va ehtimollik ifodalari (hedging)",
        ],
        quiz: [
          {
            id: 'iq1',
            question: "Qaysi ibora 'juda muhim ta'sir ko'rsatmoqda' ma'nosini akademik tilda eng aniq ifodalaydi?",
            options: [
              "exerts a profound influence on",
              "makes very big change in",
              "does a lot of good stuff to",
              "is having nice effect on",
            ],
            correctIndex: 0,
            explanation: "'Exerts a profound influence on' — IELTS Writing Task 2 da Band 8.0+ leksik resurs sifatida qabul qilinadi.",
          },
        ],
        gridX: 25,
        gridY: 15,
      },
      {
        id: 'ielts-2',
        trackId: 'ielts',
        tier: 1,
        title: "Speed Reading & Skim-Scan Strategiyasi",
        subtitle: "True/False/Not Given va Headings match fokus",
        icon: '🔍',
        status: 'completed',
        xpReward: 200,
        coinReward: 50,
        prerequisites: ['ielts-1'],
        learningOutcomes: [
          "Matnning kalit jumlalarini 3 soniyada aniqlash",
          "Not Given va False o'rtasidagi nozik mantiqiy chegara",
          "Akademik paragraflar strukturasini xaritalash",
        ],
        quiz: [
          {
            id: 'iq2',
            question: "IELTS Readingda qachon javob 'NOT GIVEN' bo'ladi?",
            options: [
              "Agar muallif bu fikrni umuman tasdiqlamagan va inkor ham etmagan bo'lsa",
              "Agar matnda ushbu so'zlar bo'lsa, lekin teskari aytilgan bo'lsa",
              "Agar savol juda qiyin bo'lsa",
              "Faqat oxirgi paragraflarda",
            ],
            correctIndex: 0,
            explanation: "NOT GIVEN — matnda ushbu fikrning to'g'ri yoki noto'g'riligini isbotlovchi ma'lumot mavjud bo'lmaganda belgilanadi.",
          },
        ],
        gridX: 75,
        gridY: 15,
      },
      {
        id: 'ielts-3',
        trackId: 'ielts',
        tier: 2,
        title: "Writing Task 2: Mantiqiy Rivojlantirish",
        subtitle: "Cohesion, coherence va argumentlar sintezi",
        icon: '✍️',
        status: 'available',
        xpReward: 350,
        coinReward: 85,
        prerequisites: ['ielts-1', 'ielts-2'],
        learningOutcomes: [
          "P.E.E.L (Point, Explanation, Evidence, Link) modeli",
          "O'zaro bog'lovchi murakkab sintaksis",
          "Xolisona qarashlarni muvozanatlash",
        ],
        quiz: [
          {
            id: 'iq3',
            question: "Insho paragraflarida mantiqiy bog'liqlikni (cohesion) oshirish uchun nima eng muhim?",
            options: [
              "Har bir fikr oldingi fikr bilan tabiiy bog'langan bo'lishi va asoslangan misollar bilan quvvatlanishi",
              "Faqat 'Furthermore', 'Moreover' so'zlarini har jumlada ishlatish",
              "Faqat 30 tadan ortiq so'zdan iborat jumlalar yozish",
              "Savoldagi so'zlarni aynan takrorlash",
            ],
            correctIndex: 0,
            explanation: "Cohesion shunchaki bog'lovchilar ro'yxati emas, balki fikrlarning organik ketma-ketligidir.",
          },
        ],
        gridX: 50,
        gridY: 45,
      },
      {
        id: 'ielts-4',
        trackId: 'ielts',
        tier: 3,
        title: "Voice Speaking: Fluency & Spontaneous Tone",
        subtitle: "Part 2 Cue Card va Part 3 chuqur falsafiy suhbat",
        icon: '🎙️',
        status: 'locked',
        xpReward: 420,
        coinReward: 110,
        prerequisites: ['ielts-3'],
        learningOutcomes: [
          "Hesitation va pauzalarni tabiiy filler iboralar bilan bartaraf etish",
          "Intonatsiya va so'z urg'ulari (pronunciation)",
          "Gipotetik holatlar (Second/Third conditionals) orqali fikrlash",
        ],
        quiz: [
          {
            id: 'iq4',
            question: "Speaking Part 3 da kutilmagan savolga javobni boshlash uchun qaysi tabiiy ibora eng mos?",
            options: [
              "That's an intriguing question. To put it into perspective...",
              "I don't know, ask another question.",
              "Yes, it is very nice.",
              "I think yes.",
            ],
            correctIndex: 0,
            explanation: "Bu kabi iboralar nomzodga o'ylash uchun bir necha soniya berib, ravonlikni saqlab qoladi.",
          },
        ],
        gridX: 50,
        gridY: 72,
      },
      {
        id: 'ielts-5',
        trackId: 'ielts',
        tier: 4,
        title: "👑 Chempionlik Boss: Band 8.5+ To'liq Simulyatsiya",
        subtitle: "Xalqaro standartdagi to'liq imtihon va ekspert baholash",
        icon: '🎖️',
        status: 'locked',
        xpReward: 800,
        coinReward: 300,
        prerequisites: ['ielts-4'],
        learningOutcomes: [
          "4 ta modul bo'yicha C2 darajasidagi mukammallik",
          "Vaqt boshqaruvi va stressga chidamlilik",
          "Xalqaro universitetlar darajasidagi akademik yozuv",
        ],
        quiz: [
          {
            id: 'iq5',
            question: "IELTS 8.5+ darajasi nimani anglatadi?",
            options: [
              "Tilni ona tili egalari kabi erkin, murakkab kontekstlarda tushunish va ifodalash qobiliyati",
              "Faqat grammatika qoidalarini yodlash",
              "Lug'atdagi barcha so'zlarni bilish",
              "Faqat tez gapirish",
            ],
            correctIndex: 0,
            explanation: "IELTS 8.5 - 'Very Good User' bo'lib, nozik nuanslarni mukammal tushunishni anglatadi.",
          },
        ],
        gridX: 50,
        gridY: 92,
      },
    ],
  },
];

/* ══════════════════════════════════════════════════════════════════
 * 3. COMPONENT IMPLEMENTATION
 * ══════════════════════════════════════════════════════════════════ */

export function StudentSkillConstellationStudio({
  studentName = 'Amirjon Olimov',
  studentLevel = 7,
  onSkillUnlocked,
  onClose,
}: StudentSkillConstellationStudioProps) {
  const { t } = useSafeI18n();
  const { playTick, playSuccess, playPop, playError } = usePremiumSound();
  const { push } = useToasts();

  const [activeTrackId, setActiveTrackId] = useState<string>('fullstack');
  const [tracksState, setTracksState] = useState<SkillTrack[]>(SKILL_TRACKS);
  const [selectedNode, setSelectedNode] = useState<SkillNode | null>(null);

  // Quiz interactive state inside drawer
  const [quizSelectedOption, setQuizSelectedOption] = useState<number | null>(null);
  const [quizAnswered, setQuizAnswered] = useState<boolean>(false);
  const [isPassportModalOpen, setIsPassportModalOpen] = useState(false);

  const currentTrack = useMemo(() => {
    return tracksState.find((tr) => tr.id === activeTrackId) || tracksState[0];
  }, [tracksState, activeTrackId]);

  // Track telemetry
  const trackStats = useMemo(() => {
    const total = currentTrack.nodes.length;
    const completed = currentTrack.nodes.filter((n) => n.status === 'completed' || n.status === 'mastered').length;
    const totalXp = currentTrack.nodes.reduce((acc, n) => acc + (n.status === 'completed' || n.status === 'mastered' ? n.xpReward : 0), 0);
    const totalCoins = currentTrack.nodes.reduce((acc, n) => acc + (n.status === 'completed' || n.status === 'mastered' ? n.coinReward : 0), 0);
    const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, totalXp, totalCoins, progressPct };
  }, [currentTrack]);

  // Handle Node selection
  const handleSelectNode = useCallback((node: SkillNode) => {
    playTick();
    setSelectedNode(node);
    setQuizSelectedOption(null);
    setQuizAnswered(false);
  }, [playTick]);

  // Quiz submission & Skill unlock
  const handleQuizSubmit = useCallback(() => {
    if (!selectedNode || quizSelectedOption === null) return;

    const currentQ = selectedNode.quiz[0];
    if (!currentQ) return;

    setQuizAnswered(true);

    if (quizSelectedOption === currentQ.correctIndex) {
      playSuccess();
      push('success', `Ajoyib! '${selectedNode.title}' muvaffaqiyatli topshirildi (+${selectedNode.xpReward} XP, +${selectedNode.coinReward} Coin)!`);

      // Update node status to completed & unlock dependent nodes
      setTracksState((prevTracks) => {
        return prevTracks.map((tr) => {
          if (tr.id !== currentTrack.id) return tr;

          const updatedNodes = tr.nodes.map((node) => {
            if (node.id === selectedNode.id) {
              return { ...node, status: 'completed' as NodeStatus };
            }
            return node;
          });

          // Check if any locked node has its prerequisites fulfilled
          const unlockedNodes = updatedNodes.map((node) => {
            if (node.status === 'locked') {
              const allReqsMet = node.prerequisites.every((reqId) => {
                const reqNode = updatedNodes.find((n) => n.id === reqId);
                return reqNode && (reqNode.status === 'completed' || reqNode.status === 'mastered');
              });
              if (allReqsMet) {
                return { ...node, status: 'available' as NodeStatus };
              }
            }
            return node;
          });

          return { ...tr, nodes: unlockedNodes };
        });
      });

      // Update local selected node
      setSelectedNode((prev) => (prev ? { ...prev, status: 'completed' } : null));

      onSkillUnlocked?.(selectedNode.id, selectedNode.xpReward, selectedNode.coinReward);
    } else {
      playError();
      push('error', "Noto'g'ri javob. Tushuntirishni o'qib, qayta urinib ko'ring.");
    }
  }, [selectedNode, quizSelectedOption, playSuccess, playError, push, currentTrack.id, onSkillUnlocked]);

  // Helper: Status badge renderer
  const renderStatusBadge = (status: NodeStatus) => {
    switch (status) {
      case 'mastered':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-black text-amber-500">
            👑 {t('gamification.mastered', 'Mukammal')}
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-black text-emerald-500">
            ✓ {t('gamification.completed', 'Bajarildi')}
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 text-[10px] font-black text-blue-500 animate-pulse">
            ⚡ {t('gamification.inProgress', "O'rganilmoqda")}
          </span>
        );
      case 'available':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 text-[10px] font-black text-cyan-500">
            ★ {t('gamification.available', 'Ochiq')}
          </span>
        );
      case 'locked':
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/15 border border-slate-500/30 px-2 py-0.5 text-[10px] font-black text-slate-400">
            🔒 {t('gamification.locked', 'Qulflangan')}
          </span>
        );
    }
  };

  return (
    <div className="relative w-full space-y-6">
      {/* ═══════════ HEADER HUD & TRACK PICKER ═══════════ */}
      <div className="liquid-glass-surface relative overflow-hidden rounded-3xl border border-black/[0.08] dark:border-white/[0.12] bg-white/70 dark:bg-surface-900/70 p-6 shadow-xl backdrop-blur-2xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                <span className="h-2 w-2 rounded-full bg-indigo-500 animate-ping" />
                RPG Mahorat Shajarasi · Spatial Skill Constellation
              </span>
              <span className="text-xs font-semibold text-slate-500">
                Level {studentLevel} · {studentName}
              </span>
            </div>
            <h2 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {currentTrack.name}
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
              {currentTrack.description}
            </p>
          </div>

          {/* Action buttons & Metrics */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3 rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] px-4 py-2.5">
              <div className="text-center">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">O'zlashtirish</div>
                <div className="text-base font-black text-indigo-600 dark:text-indigo-400">{trackStats.progressPct}%</div>
              </div>
              <div className="h-8 w-px bg-black/[0.08] dark:bg-white/[0.08]" />
              <div className="text-center">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Mahoratlar</div>
                <div className="text-base font-black text-slate-800 dark:text-slate-200">{trackStats.completed}/{trackStats.total}</div>
              </div>
              <div className="h-8 w-px bg-black/[0.08] dark:bg-white/[0.08]" />
              <div className="text-center">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Jamg'arma</div>
                <div className="text-base font-black text-amber-500">+{trackStats.totalCoins} 🪙</div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                playPop();
                setIsPassportModalOpen(true);
              }}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 active:scale-95 transition-all"
            >
              📜 {t('gamification.passport', 'Mahorat Pasporti')}
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-slate-500"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Track switch tabs */}
        <div className="mt-6 flex flex-wrap gap-2 pt-4 border-t border-black/[0.06] dark:border-white/[0.06]">
          {tracksState.map((track) => {
            const isActive = track.id === activeTrackId;
            return (
              <button
                key={track.id}
                type="button"
                onClick={() => {
                  playTick();
                  setActiveTrackId(track.id);
                  setSelectedNode(null);
                }}
                className={`min-h-[44px] inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md scale-[1.02]'
                    : 'bg-black/[0.04] text-slate-600 dark:bg-white/[0.05] dark:text-slate-400 hover:bg-black/[0.08] dark:hover:bg-white/[0.08]'
                }`}
              >
                <span className="text-base">{track.icon}</span>
                <span>{track.name.split('&')[0].trim()}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══════════ MAIN CONSTELLATION INTERACTIVE CANVAS ═══════════ */}
      <div className="relative min-h-[580px] rounded-3xl border border-black/[0.08] dark:border-white/[0.12] bg-gradient-to-b from-slate-900 via-slate-950 to-black p-6 sm:p-10 shadow-2xl overflow-hidden">
        {/* Ambient starfield dots */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage: `radial-gradient(circle at 25px 25px, rgba(255, 255, 255, 0.25) 1.5px, transparent 0)`,
            backgroundSize: '50px 50px',
          }}
        />

        {/* SVG Neon Laser Connecting Lines */}
        <svg
          className="absolute inset-0 h-full w-full pointer-events-none"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          <defs>
            <linearGradient id="neonGlowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#007AFF" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.8" />
            </linearGradient>
            <filter id="laserGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {currentTrack.nodes.map((node) => {
            return node.prerequisites.map((preId) => {
              const preNode = currentTrack.nodes.find((n) => n.id === preId);
              if (!preNode) return null;

              const isPathActive =
                (preNode.status === 'completed' || preNode.status === 'mastered') &&
                node.status !== 'locked';

              return (
                <g key={`${preId}->${node.id}`}>
                  {/* Subtle shadow track */}
                  <line
                    x1={`${preNode.gridX}%`}
                    y1={`${preNode.gridY}%`}
                    x2={`${node.gridX}%`}
                    y2={`${node.gridY}%`}
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth="2.5"
                  />
                  {/* Dynamic glowing laser */}
                  <line
                    x1={`${preNode.gridX}%`}
                    y1={`${preNode.gridY}%`}
                    x2={`${node.gridX}%`}
                    y2={`${node.gridY}%`}
                    stroke={isPathActive ? 'url(#neonGlowGrad)' : 'rgba(100,116,139,0.2)'}
                    strokeWidth={isPathActive ? '2' : '1'}
                    strokeDasharray={isPathActive ? '4 2' : '2 3'}
                    filter={isPathActive ? 'url(#laserGlow)' : undefined}
                    className={isPathActive ? 'animate-pulse' : ''}
                  />
                </g>
              );
            });
          })}
        </svg>

        {/* Nodes Grid Layout */}
        <div className="relative h-full min-h-[500px] w-full">
          {currentTrack.nodes.map((node, idx) => {
            const isSelected = selectedNode?.id === node.id;
            const isUnlocked = node.status !== 'locked';

            return (
              <div
                key={node.id}
                style={{
                  position: 'absolute',
                  left: `${node.gridX}%`,
                  top: `${node.gridY}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                className="z-10"
              >
                <motion.button
                  type="button"
                  onClick={() => handleSelectNode(node)}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: idx * 0.08, type: 'spring', stiffness: 400, damping: 25 }}
                  whileHover={{ scale: 1.12 }}
                  whileTap={{ scale: 0.95 }}
                  className={`group relative flex flex-col items-center focus:outline-none ${
                    isUnlocked ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'
                  }`}
                  aria-label={`${node.title} · ${node.status}`}
                >
                  {/* Outer pulsating aura for active/mastered nodes */}
                  {node.status === 'mastered' && (
                    <motion.span
                      aria-hidden="true"
                      animate={{ scale: [1, 1.35, 1], opacity: [0.4, 0.8, 0.4] }}
                      transition={{ duration: 2.4, repeat: Infinity }}
                      className="pointer-events-none absolute -inset-2.5 rounded-full bg-amber-400/30 blur-md"
                    />
                  )}
                  {node.status === 'in_progress' && (
                    <motion.span
                      aria-hidden="true"
                      animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.7, 0.3] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="pointer-events-none absolute -inset-2.5 rounded-full bg-blue-500/30 blur-md"
                    />
                  )}

                  {/* Node Circle (>= 44x44px target) */}
                  <div
                    className={`relative flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-3xl border-2 transition-all duration-300 shadow-xl backdrop-blur-xl ${
                      isSelected
                        ? 'border-white bg-white/30 ring-4 ring-indigo-500/40 scale-105'
                        : node.status === 'mastered'
                        ? 'border-amber-400 bg-amber-500/20 shadow-amber-500/20'
                        : node.status === 'completed'
                        ? 'border-emerald-400 bg-emerald-500/20 shadow-emerald-500/20'
                        : node.status === 'in_progress'
                        ? 'border-blue-400 bg-blue-500/20 shadow-blue-500/20'
                        : node.status === 'available'
                        ? 'border-cyan-400 bg-cyan-500/20 shadow-cyan-500/20'
                        : 'border-slate-700 bg-slate-800/80 shadow-none'
                    }`}
                  >
                    <span className="text-2xl sm:text-3xl select-none">{node.icon}</span>

                    {/* Status corner badge */}
                    <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 border border-white/20 text-xs shadow-md">
                      {node.status === 'mastered' && '👑'}
                      {node.status === 'completed' && '✓'}
                      {node.status === 'in_progress' && '⚡'}
                      {node.status === 'available' && '★'}
                      {node.status === 'locked' && '🔒'}
                    </span>
                  </div>

                  {/* Title pill under node */}
                  <div className="mt-2 text-center max-w-[120px] sm:max-w-[140px]">
                    <div className="truncate text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                      {node.title}
                    </div>
                    <div className="text-[10px] font-medium text-slate-400">
                      +{node.xpReward} XP
                    </div>
                  </div>
                </motion.button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══════════ NODE INSPECTOR & INTERACTIVE QUIZ DRAWER / MODAL ═══════════ */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="liquid-glass-surface rounded-3xl border border-black/[0.08] dark:border-white/[0.12] bg-white/90 dark:bg-surface-900/90 p-6 sm:p-8 shadow-2xl backdrop-blur-2xl"
          >
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              {/* Left: Metadata & Objectives */}
              <div className="space-y-4 max-w-xl">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{selectedNode.icon}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Tier {selectedNode.tier} Mahorati
                      </span>
                      {renderStatusBadge(selectedNode.status)}
                    </div>
                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                      {selectedNode.title}
                    </h3>
                  </div>
                </div>

                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {selectedNode.subtitle}
                </p>

                {/* Rewards */}
                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-500/10 px-3 py-1 text-xs font-black text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                    <span>⚡</span> +{selectedNode.xpReward} Tajriba (XP)
                  </div>
                  <div className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500/10 px-3 py-1 text-xs font-black text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    <span>🪙</span> +{selectedNode.coinReward} M-Coins
                  </div>
                </div>

                {/* Outcomes */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    O'zlashtirish Natijalari (Learning Outcomes)
                  </h4>
                  <ul className="space-y-1.5">
                    {selectedNode.learningOutcomes.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                        <span className="text-emerald-500 font-bold">✔</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Right: Interactive Checkpoint Quiz */}
              <div className="w-full lg:max-w-md rounded-2xl border border-black/[0.08] dark:border-white/[0.12] bg-black/[0.02] dark:bg-white/[0.02] p-5">
                <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/[0.06]">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    🎯 Bilim Sinovi (Checkpoint Quiz)
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedNode(null)}
                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    Yopish ✕
                  </button>
                </div>

                {selectedNode.status === 'locked' ? (
                  <div className="py-8 text-center space-y-2">
                    <span className="text-3xl">🔒</span>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                      Ushbu mahorat hozircha qulflangan
                    </p>
                    <p className="text-xs text-slate-500">
                      Avval boshlang'ich bosqichlarni muvaffaqiyatli topshiring.
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 space-y-4">
                    {selectedNode.quiz[0] && (
                      <>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {selectedNode.quiz[0].question}
                        </p>

                        <div className="space-y-2">
                          {selectedNode.quiz[0].options.map((option, idx) => {
                            const isChosen = quizSelectedOption === idx;
                            const isCorrect = idx === selectedNode.quiz[0].correctIndex;

                            let optionClasses =
                              'border-black/[0.08] dark:border-white/[0.12] bg-white/70 dark:bg-surface-800/70 text-slate-800 dark:text-slate-200';

                            if (quizAnswered) {
                              if (isCorrect) {
                                optionClasses = 'border-emerald-500 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold';
                              } else if (isChosen && !isCorrect) {
                                optionClasses = 'border-red-500 bg-red-500/20 text-red-700 dark:text-red-300';
                              }
                            } else if (isChosen) {
                              optionClasses = 'border-indigo-500 bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-bold';
                            }

                            return (
                              <button
                                key={idx}
                                type="button"
                                disabled={quizAnswered && selectedNode.status === 'completed'}
                                onClick={() => {
                                  if (!quizAnswered) {
                                    playTick();
                                    setQuizSelectedOption(idx);
                                  }
                                }}
                                className={`min-h-[44px] w-full text-left rounded-xl border p-3 text-xs transition-all flex items-center justify-between ${optionClasses}`}
                              >
                                <span>{option}</span>
                                {quizAnswered && isCorrect && <span>✅</span>}
                              </button>
                            );
                          })}
                        </div>

                        {quizAnswered && (
                          <div className="p-3 rounded-xl bg-black/[0.04] dark:bg-white/[0.04] text-[11px] text-slate-600 dark:text-slate-300">
                            <strong>💡 Tushuntirish:</strong> {selectedNode.quiz[0].explanation}
                          </div>
                        )}

                        <div className="pt-2">
                          {selectedNode.status === 'completed' || selectedNode.status === 'mastered' ? (
                            <div className="text-center py-2 text-xs font-bold text-emerald-500">
                              ✓ Bu mahorat allaqachon o'zlashtirilgan!
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={quizSelectedOption === null || quizAnswered}
                              onClick={handleQuizSubmit}
                              className="min-h-[44px] w-full rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 font-bold text-xs text-white shadow-md hover:opacity-95 active:scale-95 disabled:opacity-50 transition-all"
                            >
                              Javobni Tasdiqlash & XP Olish 🚀
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════ MAHORAT PASPORTI / CERTIFICATE MODAL ═══════════ */}
      <GlassModal
        open={isPassportModalOpen}
        onClose={() => setIsPassportModalOpen(false)}
        size="lg"
        title="Rasmiy Talaba Mahorat Pasporti (Skill Passport)"
      >
        <div className="space-y-6 p-2">
          <div className="rounded-3xl border-2 border-indigo-500/30 bg-gradient-to-br from-indigo-900/30 via-slate-900 to-purple-900/30 p-8 text-center text-white relative overflow-hidden shadow-2xl">
            <span className="text-5xl">🎖️</span>
            <h3 className="mt-3 text-2xl font-black tracking-tight">{studentName}</h3>
            <p className="text-xs text-indigo-300 font-medium">
              M-EDU V2 Xalqaro Ta'lim & Mahorat Sertifikati · ID: MEDU-SKILL-{studentLevel}492
            </p>

            <div className="my-6 grid grid-cols-3 gap-3 border-y border-white/10 py-4">
              <div>
                <div className="text-[10px] text-slate-400 uppercase">Yo'nalish</div>
                <div className="text-sm font-black text-indigo-300">{currentTrack.code}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase">O'zlashtirish</div>
                <div className="text-sm font-black text-emerald-400">{trackStats.progressPct}%</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase">Jamg'arilgan XP</div>
                <div className="text-sm font-black text-amber-400">+{trackStats.totalXp} XP</div>
              </div>
            </div>

            <p className="text-xs text-slate-300 italic max-w-lg mx-auto">
              "Mazkur hujjat ushbu talabaning zamonaviy ta'lim traektoriyasi bo'yicha mustaqil bilim sinovlaridan muvaffaqiyatli o'tganligini va xalqaro me'yorlarga mos amaliy kompetensiyalarga ega ekanligini tasdiqlaydi."
            </p>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsPassportModalOpen(false)}
              className="min-h-[44px] rounded-xl px-5 py-2 text-xs font-bold text-slate-500 hover:bg-black/5 dark:hover:bg-white/5"
            >
              Yopish
            </button>
            <button
              type="button"
              onClick={() => {
                playSuccess();
                window.print();
              }}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-indigo-700 active:scale-95"
            >
              🖨️ A4 Chop Etish (PDF Export)
            </button>
          </div>
        </div>
      </GlassModal>
    </div>
  );
}

export default StudentSkillConstellationStudio;
