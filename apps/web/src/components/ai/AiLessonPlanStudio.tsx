'use client';

/**
 * ============================================================================
 * M-EDU V2 — AI Pedagogical Lesson Studio & Quiz Generator (`AiLessonPlanStudio.tsx`)
 * iOS 27 / visionOS "Liquid Curriculum & Interactive Lab Engine"
 * ============================================================================
 *
 * Capabilities & Fixes:
 *  • Complete 5-Stage Lesson Architecture (Objectives, Icebreaker, Theory + Code,
 *    Hands-On Lab with Hint toggle, Interactive Quiz Simulator, Homework Checklist)
 *  • Dynamic topic, duration (45m / 90m proportional scaling) & level adaptation
 *  • Liquid Glass Segmented Controls replacing raw native <select> elements
 *  • Interactive Quiz Mode: click options to test students live & reveal explanations
 *  • Direct 1-Click Export: Copy Markdown, Print A4 PDF, and Share to Telegram
 *  • Safe timeout cleanup, `initialSubject` binding, and `{toastNode}` rendering
 * ============================================================================
 */

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  memo,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import {
  Sparkles,
  BookOpen,
  Code2,
  HelpCircle,
  Copy,
  Check,
  Printer,
  Send,
  Clock,
  Layers,
  X,
  Lightbulb,
  Target,
  Flame,
  Laptop,
  CheckCircle2,
  XCircle,
  GraduationCap,
  Eye,
  EyeOff,
} from 'lucide-react';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useHaptics } from '@/hooks/useHaptics';
import { useToasts } from '@/components/ui';
import { cn, usePrefersReducedMotion } from '@/lib/design';
import { aiApi } from '@/lib/api';

/* ─────────────────────────────────────────────────────────────────────────
 * Types & Constants
 * ─────────────────────────────────────────────────────────────────────── */

export type LessonDuration = 45 | 90;
export type LessonLevel = "Boshlang'ich" | "O'rta" | "Ilg'or";

export interface LessonPlanResult {
  title: string;
  durationMin: LessonDuration;
  level: LessonLevel;
  timeBreakdown: {
    warmupMin: number;
    theoryMin: number;
    handsOnMin: number;
    quizMin: number;
    homeworkMin: number;
  };
  learningObjectives: string[];
  warmup: { duration: string; activity: string };
  theory: { duration: string; topics: string[]; demoCode?: string };
  handsOn: { duration: string; task: string; hint: string };
  quizQuestions: Array<{
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }>;
  homework: { title: string; requirements: string[] };
}

export interface AiLessonPlanStudioProps {
  initialSubject?: string;
  onClose?: () => void;
}

const SPRING_SNAPPY = {
  type: 'spring' as const,
  stiffness: 520,
  damping: 34,
  mass: 0.6,
};

const SPRING_GEL = {
  type: 'spring' as const,
  stiffness: 740,
  damping: 25,
  mass: 0.34,
};

const TOPIC_PRESETS = [
  'React Hooks: useEffect va Custom Hooks yaratish',
  'Python OOP: Class, Inheritance va Polimorfizm',
  'IELTS Writing Task 2: Opinion & Discussion Essays',
  'Matematika: Kvadrat tenglamalar va Vieta teoremasi',
] as const;

const LEVEL_OPTIONS: ReadonlyArray<{
  id: LessonLevel;
  label: string;
  badge: string;
}> = [
  { id: "Boshlang'ich", label: "Boshlang'ich", badge: 'Junior' },
  { id: "O'rta", label: "O'rta", badge: 'Middle' },
  { id: "Ilg'or", label: "Ilg'or", badge: 'Advanced' },
];

const DURATION_OPTIONS: ReadonlyArray<{
  value: LessonDuration;
  label: string;
  sub: string;
}> = [
  { value: 45, label: '45 daqiqa', sub: 'Standart akademik' },
  { value: 90, label: '90 daqiqa', sub: 'Chuqur laboratoriya' },
];

/* ─────────────────────────────────────────────────────────────────────────
 * Dynamic Topic-Aware Lesson Plan Builder
 * ─────────────────────────────────────────────────────────────────────── */

function buildDynamicLessonPlan(
  rawTopic: string,
  duration: LessonDuration,
  level: LessonLevel,
): LessonPlanResult {
  const topic = rawTopic.trim();
  const lower = topic.toLowerCase();

  const timeBreakdown =
    duration === 45
      ? { warmupMin: 5, theoryMin: 15, handsOnMin: 15, quizMin: 6, homeworkMin: 4 }
      : { warmupMin: 10, theoryMin: 30, handsOnMin: 35, quizMin: 10, homeworkMin: 5 };

  // 1. Python / Backend Track
  if (lower.includes('python') || lower.includes('oop') || lower.includes('django')) {
    return {
      title: topic,
      durationMin: duration,
      level,
      timeBreakdown,
      learningObjectives: [
        `${topic} bo'yicha asosiy arxitektura tamoyillari va sintaksisni (${level} darajada) o'zlashtirish`,
        'Kodni obyektga yo‘naltirilgan (OOP) uslubda modullarga ajratish va qayta ishlatish',
        'Xotira va ishlash tezligini optimallashtirgan holda real amaliy masalani yechish',
      ],
      warmup: {
        duration: `${timeBreakdown.warmupMin} daqiqa`,
        activity:
          'O‘quvchilarga takrorlanuvchi (spagetti) funksional kod ko‘rsatiladi — "3 daqiqada buni qanday qilib bitta obyektga birlashtiramiz?" blits-muhokamasi.',
      },
      theory: {
        duration: `${timeBreakdown.theoryMin} daqiqa`,
        topics: [
          'Class va Object tushunchasi, `__init__` konstruktori hamda `self` konteksti',
          'Vorislik (Inheritance) va metodlarni qayta yozish (`super()` funksiyasi)',
          'Inkapsulyatsiya va xususiyatlarni `@property` dekoratori orqali himoyalash',
        ],
        demoCode: `class Student:\n    def __init__(self, name: str, score: int):\n        self.name = name\n        self._score = max(0, min(100, score))\n\n    @property\n    def is_passed(self) -> bool:\n        return self._score >= 70\n\nclass ScholarshipStudent(Student):\n    def grant_amount(self) -> int:\n        return 1_500_000 if self.is_passed else 0`,
      },
      handsOn: {
        duration: `${timeBreakdown.handsOnMin} daqiqa`,
        task:
          'O‘quv markazi uchun `Course` va `Group` klasslarini yozing: o‘quvchi qo‘shish, o‘rtacha ballni hisoblash va sertifikat berish metodlarini yarating.',
        hint: '`__str__` metodidan foydalanib obyektni chiroyli formatda chop eting hamda ro‘yxat bo‘sh bo‘lganda `ZeroDivisionError` oldini oling.',
      },
      quizQuestions: [
        {
          question: 'Python klasslarida `super().__init__()` chaqiruvi nima vazifani bajaradi?',
          options: [
            'Yangi global o‘zgaruvchi yaratadi',
            'Ota-klass (Parent class) konstruktorini ishga tushirib, uning xususiyatlarini meros qilib oladi',
            'Klassni xotiradan o‘chiradi',
            'Faqat xususiy (private) metodlarni bloklaydi',
          ],
          correctIndex: 1,
          explanation:
            '`super()` bola-klass ichidan turib ota-klassning metodlari va `__init__` konstruktoriga murojaat qilish imkonini beradi.',
        },
        {
          question: 'Obyekt ichidagi atribut nomini `_score` kabi bitta pastki chiziq bilan boshlash nimani anglatadi?',
          options: [
            'Kod sintaktik xato beradi',
            'O‘zgaruvchi faqat butun son bo‘lishi shart',
            'Protected (himoyalangan) atribut ekanligini bildiruvchi dasturchilar kelishuvi (konvensiya)',
            'Avtomatik ravishda bazaga saqlanadi',
          ],
          correctIndex: 2,
          explanation:
            'Python’da `_nom` himoyalangan (protected) a’zoni bildiradi va uni tashqaridan to‘g‘ridan-to‘g‘ri o‘zgartirmaslik tavsiya etiladi.',
        },
      ],
      homework: {
        title: `"${topic}" — Elektron Kutubxona Boshqaruv Tizimi`,
        requirements: [
          '`Book`, `Member` va `Library` klasslarini yaratish hamda kitob ijarasi tarixini yuritish',
          'Barcha metodlarga Type Hinting (`str`, `int`, `list`) va qisqa docstring yozish',
          'Kamida 3 ta unit-test yozib, GitHub repozitoriyga yuklash',
        ],
      },
    };
  }

  // 2. English / IELTS Track
  if (
    lower.includes('ielts') ||
    lower.includes('english') ||
    lower.includes('writing') ||
    lower.includes('speaking') ||
    lower.includes('ingliz')
  ) {
    return {
      title: topic,
      durationMin: duration,
      level,
      timeBreakdown,
      learningObjectives: [
        `Band 7.5+ darajasidagi akademik struktura (Task Response & Coherence) qoidalarini (${level}) egallash`,
        'Mavzuga oid C1/C2 akademik kollokatsiyalar va bog‘lovchi vositalarni (Cohesive Devices) tabiiy qo‘llash',
        'Berilgan vaqt chegarasida aniq Thesis Statement va 2 ta Body Paragraph yozish',
      ],
      warmup: {
        duration: `${timeBreakdown.warmupMin} daqiqa`,
        activity:
          '"Paraphrase Duel": O‘qituvchi ekranga 2 ta oddiy gap chiqaradi, o‘quvchilar 90 soniya ichida sinonim va grammatik inversiya orqali uni C1 darajaga o‘giradilar.',
      },
      theory: {
        duration: `${timeBreakdown.theoryMin} daqiqa`,
        topics: [
          'Introduction: Hook + Background Paraphrase + Clear Thesis Statement formulasi',
          'PEEL strukturasi: Point → Explanation → Concrete Example → Link',
          'Eng ko‘p ball tushiradigan xatolar: Overgeneralization va shablon iboralarni haddan ortiq ishlatish',
        ],
        demoCode: `// Band 8.0 Introduction & PEEL Body Template:\n[Paraphrase]: While it is frequently argued that technology isolates individuals...\n[Thesis]: I firmly contend that digital platforms foster global collaboration, provided they are used mindfully.\n\n[Topic Sentence]: Primarily, virtual ecosystems bridge geographical divides...\n[Example]: For instance, empirical studies by Oxford University indicate that...`,
      },
      handsOn: {
        duration: `${timeBreakdown.handsOnMin} daqiqa`,
        task:
          'Berilgan real imtihon savoli bo‘yicha 4 daqiqalik reja (outline), to‘liq Introduction hamda 1-Body Paragraph ni 110–130 so‘z hajmida yozing.',
        hint: 'Har bir gap oldingi gap bilan mantiqan bog‘langanini `This means that...` yoki `Consequently...` orqali tekshiring.',
      },
      quizQuestions: [
        {
          question: 'IELTS Writing Task 2 da "Task Response" mezoni bo‘yicha yuqori ball olishning eng muhim sharti nima?',
          options: [
            'Faqat juda murakkab va kam ishlatiladigan lug‘atlarni yodlab yozish',
            'Savolning barcha qismlariga to‘liq javob berish va aniq pozitsiyani oxirigacha asoslab borish',
            '450 so‘zdan ko‘p insho yozish',
            'Har bir gapda Passive Voice ishlatish',
          ],
          correctIndex: 1,
          explanation:
            'Examiner birinchi navbatda savolning har bir qismi yoritilganini va fikrlar dalillar bilan uzviy rivojlantirilganini baholaydi.',
        },
        {
          question: 'Quyidagi bog‘lovchilardan qaysi biri qarama-qarshi fikrni akademik uslubda kiritish uchun eng mos?',
          options: [
            'Anyway, besides that...',
            'Nonetheless, it is worth acknowledging that...',
            'First of all, secondly...',
            'As a matter of fact, in conclusion...',
          ],
          correctIndex: 1,
          explanation:
            '`Nonetheless, it is worth acknowledging that...` C1/C2 darajadagi tabiiy concessive (yon bosuvchi) akademik konstruksiyadir.',
        },
      ],
      homework: {
        title: `To‘liq 250+ so‘zlik Essay & Self-Audit Checklist`,
        requirements: [
          '40 daqiqa taymer qo‘yib, 4 paragrafdan iborat to‘liq insho yozish (kamida 260 so‘z)',
          'Ishlatilgan 8 ta C1 darajadagi kollokatsiyani matnda ajratib (highlight qilib) ko‘rsatish',
          'Grammatik tekshiruvdan o‘tkazib, M-EDU platformasiga yuklash',
        ],
      },
    };
  }

  // 3. Default / React / Frontend / General Track (Dynamically interpolates `topic`)
  const isReact = lower.includes('react') || lower.includes('hook') || lower.includes('js');

  return {
    title: topic,
    durationMin: duration,
    level,
    timeBreakdown,
    learningObjectives: isReact
      ? [
          'useEffect lifecycle bosqichlari va dependency array qoidalarini chuqur o‘zlashtirish',
          'Memory leak’larning oldini olish (cleanup funksiyasi va AbortController amaliyoti)',
          'Qayta ishlatiluvchi Custom Hook (useDebounce va useLocalStorage) arxitekturasini yaratish',
        ]
      : [
          `"${topic}" mavzusining nazariy asoslari va amaliy qo‘llanilishini (${level} darajada) o‘zlashtirish`,
          'Real loyihalarda uchraydigan muammolarni tizimli tahlil qilish va xatosiz yechim qurish',
          'Mustaqil laboratoriya topshirig‘ini mezonlar asosida bajarish va himoya qilish',
        ],
    warmup: {
      duration: `${timeBreakdown.warmupMin} daqiqa`,
      activity: isReact
        ? 'O‘quvchilarga noto‘g‘ri yozilgan infinite-loop `useEffect` kodini ko‘rsatish va xatoni 2 daqiqa ichida topish bo‘yicha "Code Review Blitz" mashqi.'
        : `"${topic}" bo‘yicha 3 ta tezkor muammoli vaziyat (case-study) ko‘rsatiladi — o‘quvchilar juftlikda eng qisqa yechimni taklif qiladilar.`,
    },
    theory: {
      duration: `${timeBreakdown.theoryMin} daqiqa`,
      topics: isReact
        ? [
            'Side-effects tushunchasi va ularni sof (pure) komponent renderidan ajratish',
            'Dependency array: bo‘sh massiv `[]`, elementli `[dep]` va massivsiz holatlar farqi',
            'Cleanup funksiyasi va `AbortController` yordamida asinxron so‘rovlarni xavfsiz bekor qilish',
          ]
        : [
            `"${topic}" — asosiy tushunchalar, terminologiya va ishlash mexanizmi`,
            `${level} darajadagi eng muhim qoidalar, chegaraviy holatlar (edge-cases) va best-practices`,
            'Amaliyotda eng ko‘p yo‘l qo‘yiladigan xatolar va ularni bartaraf etish usullari',
          ],
      demoCode: isReact
        ? `function useDebounce<T>(value: T, delayMs = 300): T {\n  const [debounced, setDebounced] = useState<T>(value);\n\n  useEffect(() => {\n    const timer = window.setTimeout(() => setDebounced(value), delayMs);\n    return () => window.clearTimeout(timer);\n  }, [value, delayMs]);\n\n  return debounced;\n}`
        : `// 📌 "${topic}" — Asosiy Algoritm / Formula Namunasi:\n// 1. Kiruvchi ma’lumotlarni tekshirish (Validation)\n// 2. Asosiy transformatsiya va hisoblash mantiqi\n// 3. Natijani tekshirish va xatoliklarni qayta ishlash`,
    },
    handsOn: {
      duration: `${timeBreakdown.handsOnMin} daqiqa`,
      task: isReact
        ? 'Har bir talaba real vaqtda klaviaturadan kiritilayotgan qidiruv so‘zini 300ms kechiktiruvchi `useDebounce` hookini yozsin va API qidiruv inputiga ulasin.'
        : `"${topic}" mavzusida berilgan amaliy keysni guruhda 3 bosqichda bajaring va natijani sinov ma’lumotlari bilan tekshiring.`,
      hint: isReact
        ? '`setTimeout` va `clearTimeout` kombinatsiyasidan foydalaning; dependency massiviga `value` va `delayMs` ni kiritishni unutmang.'
        : 'Vazifani kichik qismlarga bo‘lib oling va har bir qadam natijasini oraliq tekshiruvdan o‘tkazing.',
    },
    quizQuestions: isReact
      ? [
          {
            question: 'useEffect ichidagi return (cleanup) funksiyasi qachon ishga tushadi?',
            options: [
              'Faqat brauzer oynasi butunlay yopilganda',
              'Komponent unmount bo‘lganda yoki dependency o‘zgarib keyingi effect ishlashidan oldin',
              'Har bir tugma bosilganda avtomatik ravishda',
              'Faqat server 500 xatolik qaytarganda',
            ],
            correctIndex: 1,
            explanation:
              'Cleanup funksiyasi eski taymer va obunalarni (subscriptions) tozalash uchun komponent o‘chirilganda yoki yangi effect ishga tushishidan oldin bajariladi.',
          },
          {
            question: 'Agar useEffect ning 2-argumentiga `[]` (bo‘sh massiv) berilsa nima bo‘ladi?',
            options: [
              'Effect har bir renderda qayta-qayta chaqiriladi',
              'Effect faqat komponent ilk bor DOM’ga ulanganda (mount) 1 marta ishlaydi',
              'TypeScript kompilyatsiya xatosini beradi',
              'Effect umuman ishga tushmaydi',
            ],
            correctIndex: 1,
            explanation:
              'Bo‘sh dependency array hech qanday o‘zgaruvchiga bog‘liq emasligini bildiradi va faqat initial mount vaqtida 1 marta bajariladi.',
          },
        ]
      : [
          {
            question: `"${topic}" mavzusini amaliyotda qo‘llashda birinchi navbatda nimaga e’tibor berish kerak?`,
            options: [
              'Faqat tashqi ko‘rinish va dizaynga',
              'Kiruvchi shartlarni to‘g‘ri aniqlash, asosiy qoida va chegaraviy holatlarni tekshirishga',
              'Nazorat testlarini o‘tkazib yuborishga',
              'Faqat tayyor shablonni o‘zgarishsiz ko‘chirishga',
            ],
            correctIndex: 1,
            explanation:
              'Tizimli tahlil va chegaraviy holatlarni (edge-cases) hisobga olish barqaror natija beradi.',
          },
          {
            question: 'Amaliy laboratoriya yakunida yechimning to‘g‘riligi qanday tasdiqlanadi?',
            options: [
              'Nazariy mezonlar va test-keyslar orqali natijani solishtirish bilan',
              'Faqatgina bitta misolni ko‘zdan kechirish bilan',
              'Tekshirmasdan topshirish orqali',
              'Tasodifiy qiymat tanlash orqali',
            ],
            correctIndex: 0,
            explanation:
              'Har qanday amaliy yechim belgilangan mezonlar va kamida 2–3 xil sinov holatlari bilan tekshirilishi shart.',
          },
        ],
    homework: {
      title: isReact
        ? 'Custom Audio Player & Debounced Search Ilovasi'
        : `"${topic}" — Mustaqil Amaliy Loyiha`,
      requirements: isReact
        ? [
            '`useLocalStorage` hookini yozish va foydalanuvchining so‘nggi 5 ta qidiruvini saqlash',
            'Audio ijro etilganda vaqt shkalasini `useEffect` va `requestAnimationFrame` bilan yangilash',
            'Kodni GitHub’ga yuklab, README faylida barcha Custom Hook’lar API tavsifini yozish',
          ]
        : [
            `"${topic}" bo‘yicha darsda o‘tilgan qoidalarni qamrab oluvchi 3 ta amaliy topshiriqni bajarish`,
            'Har bir yechim uchun qisqacha izoh va xulosa yozish',
            'Tayyor ishni keyingi darsgacha M-EDU portaliga yuklash',
          ],
    },
  };
}

/* ─────────────────────────────────────────────────────────────────────────
 * Shared Liquid Glass Subcomponents
 * ─────────────────────────────────────────────────────────────────────── */

const TopSpecular = memo(function TopSpecular({ inset = 'inset-x-8' }: { inset?: string }) {
  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute top-0 z-10', inset)}>
      <div className="h-px bg-gradient-to-r from-transparent via-white/95 to-transparent dark:via-white/35" />
      <div className="h-[0.5px] bg-gradient-to-r from-transparent via-indigo-400/35 to-transparent dark:via-indigo-400/25" />
    </div>
  );
});

const SUB_CARD = cn(
  'relative isolate overflow-hidden rounded-2xl',
  'border border-black/[0.06] bg-white/[0.72] p-4 backdrop-blur-2xl',
  'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9),0_6px_20px_-6px_rgba(15,23,42,0.05)]',
  'dark:border-white/[0.08] dark:bg-white/[0.035]',
  'dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),0_10px_24px_-8px_rgba(0,0,0,0.45)]',
);

/* ─────────────────────────────────────────────────────────────────────────
 * Main Component: AiLessonPlanStudio
 * ─────────────────────────────────────────────────────────────────────── */

export const AiLessonPlanStudio = memo(function AiLessonPlanStudio({
  initialSubject,
  onClose,
}: AiLessonPlanStudioProps) {
  const { push, toastNode } = useToasts();
  const sound = usePremiumSound();
  const haptics = useHaptics();
  const reduced = usePrefersReducedMotion();

  const soundRef = useRef(sound);
  const hapticsRef = useRef(haptics);
  const pushRef = useRef(push);
  useEffect(() => {
    soundRef.current = sound;
    hapticsRef.current = haptics;
    pushRef.current = push;
  }, [sound, haptics, push]);

  const [topic, setTopic] = useState(
    () => initialSubject?.trim() || 'React Hooks: useEffect va Custom Hooks yaratish',
  );
  const [duration, setDuration] = useState<LessonDuration>(90);
  const [level, setLevel] = useState<LessonLevel>("O'rta");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<LessonPlanResult | null>(null);

  // Interactive studio states
  const [activeStageFilter, setActiveStageFilter] = useState<
    'all' | 'warmup' | 'theory' | 'lab' | 'quiz' | 'homework'
  >('all');
  const [showLabHint, setShowLabHint] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [revealAllQuiz, setRevealAllQuiz] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rectRef = useRef<DOMRect | null>(null);

  // Sync if initialSubject prop changes externally
  useEffect(() => {
    if (initialSubject && initialSubject.trim()) {
      setTopic(initialSubject.trim());
    }
  }, [initialSubject]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  /* ── Zero-Layout-Thrash Pointer Spotlight ──────────────────────── */
  const handlePointerEnter = useCallback(() => {
    if (reduced || !containerRef.current) return;
    rectRef.current = containerRef.current.getBoundingClientRect();
    containerRef.current.style.setProperty('--lp-spot-opacity', '1');
  }, [reduced]);

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (reduced || !containerRef.current) return;
      if (!rectRef.current) {
        rectRef.current = containerRef.current.getBoundingClientRect();
      }
      const r = rectRef.current;
      containerRef.current.style.setProperty('--lp-mx', `${(e.clientX - r.left).toFixed(0)}px`);
      containerRef.current.style.setProperty('--lp-my', `${(e.clientY - r.top).toFixed(0)}px`);
    },
    [reduced],
  );

  const handlePointerLeave = useCallback(() => {
    containerRef.current?.style.setProperty('--lp-spot-opacity', '0');
  }, []);

  /* ── Generate Curriculum Handler ───────────────────────────────── */
  const handleGenerate = useCallback(async () => {
    const cleanTopic = topic.trim();
    if (!cleanTopic || isGenerating) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    soundRef.current?.playTick?.();
    hapticsRef.current?.medium?.();
    setIsGenerating(true);
    pushRef.current('info', 'Gemini AI dars rejasi va test savollarini shakllantirmoqda...');

    try {
      const blooms =
        level === "Boshlang'ich" ? 'understand' : level === "O'rta" ? 'apply' : 'analyze';
      const response = await aiApi.generateLessonPlan({
        topic: cleanTopic,
        level,
        durationMinutes: duration,
        bloomsTaxonomyLevel: blooms,
      });

      if (response && response.warmup && response.theory && response.handsOn) {
        setGeneratedPlan({
          title: response.title || cleanTopic,
          durationMin: (response.durationMin || duration) as LessonDuration,
          level: (response.level || level) as LessonLevel,
          timeBreakdown: response.timeBreakdown || (duration === 45
            ? { warmupMin: 5, theoryMin: 15, handsOnMin: 15, quizMin: 6, homeworkMin: 4 }
            : { warmupMin: 10, theoryMin: 30, handsOnMin: 35, quizMin: 10, homeworkMin: 5 }),
          learningObjectives:
            Array.isArray(response.learningObjectives) && response.learningObjectives.length > 0
              ? response.learningObjectives
              : [`${cleanTopic} mavzusining asosiy tamoyillarini o'rganish va amaliyotda qo'llash`],
          warmup: response.warmup,
          theory: response.theory,
          handsOn: response.handsOn,
          quizQuestions:
            Array.isArray(response.quizQuestions) && response.quizQuestions.length > 0
              ? response.quizQuestions
              : [
                  {
                    question: `${cleanTopic} mavzusining asosiy maqsadi nima?`,
                    options: [
                      'Nazariyani amaliyotda to‘g‘ri qo‘llash',
                      'Faqat qoidalarni yodlab olish',
                      'Vaqtinchalik sinovdan o‘tish',
                      'Boshqa tushunchalarni e’tiborsiz qoldirish',
                    ],
                    correctIndex: 0,
                    explanation: 'Asosiy maqsad — nazariyani chuqur anglab, mustaqil amaliyotda erkin qo‘llash.',
                  },
                ],
          homework: response.homework || {
            title: `${cleanTopic} bo‘yicha mustaqil loyiha`,
            requirements: ['Mavzuni takrorlash', 'Amaliy mashqlarni bajarish'],
          },
        });
      } else {
        const nextPlan = buildDynamicLessonPlan(cleanTopic, duration, level);
        setGeneratedPlan(nextPlan);
      }

      setShowLabHint(false);
      setSelectedAnswers({});
      setRevealAllQuiz(false);
      setActiveStageFilter('all');
      soundRef.current?.playSuccess?.();
      hapticsRef.current?.success?.();
      pushRef.current('success', '5 bosqichli dars rejasi muvaffaqiyatli tayyorlandi!');
    } catch {
      const nextPlan = buildDynamicLessonPlan(cleanTopic, duration, level);
      setGeneratedPlan(nextPlan);
      setShowLabHint(false);
      setSelectedAnswers({});
      setRevealAllQuiz(false);
      setActiveStageFilter('all');
      soundRef.current?.playSuccess?.();
      hapticsRef.current?.success?.();
      pushRef.current('success', 'Dars rejasi tayyorlandi (avtonom rejim)!');
    } finally {
      setIsGenerating(false);
    }
  }, [topic, duration, level, isGenerating]);

  /* ── Copy & Export Utilities ───────────────────────────────────── */
  const triggerCopy = useCallback((id: string, text: string, toastMsg: string) => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard
      .writeText(text)
      .then(() => {
        soundRef.current?.playSuccess?.();
        hapticsRef.current?.light?.();
        setCopiedId(id);
        pushRef.current('success', toastMsg);
        if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
        copyTimerRef.current = setTimeout(() => setCopiedId(null), 2000);
      })
      .catch(() => {});
  }, []);

  const formattedMarkdown = useMemo(() => {
    if (!generatedPlan) return '';
    return [
      `📘 **Dars Rejasi:** ${generatedPlan.title}`,
      `⏱ **Davomiyligi:** ${generatedPlan.durationMin} daqiqa | 📊 **Daraja:** ${generatedPlan.level}`,
      '',
      '🎯 **Kutilayotgan natijalar (Learning Objectives):**',
      ...generatedPlan.learningObjectives.map((o) => `• ${o}`),
      '',
      `🔥 **1. Kirish va Faollashtirish (${generatedPlan.warmup.duration}):**`,
      generatedPlan.warmup.activity,
      '',
      `📖 **2. Nazariy Qism (${generatedPlan.theory.duration}):**`,
      ...generatedPlan.theory.topics.map((tItem) => `• ${tItem}`),
      ...(generatedPlan.theory.demoCode
        ? ['', '```tsx', generatedPlan.theory.demoCode, '```']
        : []),
      '',
      `💻 **3. Amaliy Laboratoriya (${generatedPlan.handsOn.duration}):**`,
      `Vazifa: ${generatedPlan.handsOn.task}`,
      `💡 Maslahat: ${generatedPlan.handsOn.hint}`,
      '',
      `❓ **4. Nazorat Test Savollari (${generatedPlan.quizQuestions.length} ta):**`,
      ...generatedPlan.quizQuestions.map(
        (q, i) =>
          `${i + 1}. ${q.question}\n   ✓ To'g'ri javob: ${q.options[q.correctIndex]} (${q.explanation})`,
      ),
      '',
      `🏠 **5. Uyga Vazifa:** ${generatedPlan.homework.title}`,
      ...generatedPlan.homework.requirements.map((r) => `• ${r}`),
    ].join('\n');
  }, [generatedPlan]);

  const handleCopyFullPlan = useCallback(() => {
    if (!formattedMarkdown) return;
    triggerCopy('full-plan', formattedMarkdown, 'To‘liq dars rejasi nusxalandi!');
  }, [formattedMarkdown, triggerCopy]);

  const handleShareTelegram = useCallback(() => {
    if (!generatedPlan) return;
    const tgText = [
      `🎓 ${generatedPlan.title} (${generatedPlan.durationMin} daq · ${generatedPlan.level})`,
      '',
      '🎯 Dars maqsadlari:',
      ...generatedPlan.learningObjectives.map((o) => `✅ ${o}`),
      '',
      `💻 Amaliy topshiriq: ${generatedPlan.handsOn.task}`,
      '',
      `🏠 Uyga vazifa (${generatedPlan.homework.title}):`,
      ...generatedPlan.homework.requirements.map((r) => `📌 ${r}`),
    ].join('\n');

    triggerCopy('tg-share', tgText, 'Telegram kanal uchun formatlangan matn nusxalandi!');
    if (typeof window !== 'undefined') {
      const url = `https://t.me/share/url?url=${encodeURIComponent('https://m-edu.uz')}&text=${encodeURIComponent(tgText)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, [generatedPlan, triggerCopy]);

  const handlePrintPdf = useCallback(() => {
    if (!generatedPlan || typeof window === 'undefined') return;
    soundRef.current?.playTick?.();
    const printWin = window.open('', '_blank', 'width=880,height=920');
    if (!printWin) {
      window.print();
      return;
    }
    const escapeHtml = (str: string) =>
      str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    printWin.document.write(`<!DOCTYPE html>
<html lang="uz">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(generatedPlan.title)} — M-EDU Dars Rejasi</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; padding: 36px; line-height: 1.55; }
    h1 { font-size: 22px; margin: 0 0 6px; color: #1e1b4b; }
    .meta { font-size: 12px; color: #475569; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 2px solid #e2e8f0; }
    .section { margin-bottom: 18px; padding: 14px 16px; border: 1px solid #cbd5e1; border-radius: 12px; page-break-inside: avoid; }
    .section h2 { font-size: 14px; margin: 0 0 8px; color: #312e81; text-transform: uppercase; letter-spacing: 0.04em; }
    ul { margin: 6px 0 0; padding-left: 20px; font-size: 13px; }
    p { margin: 4px 0; font-size: 13px; }
    pre { background: #0f172a; color: #f8fafc; padding: 12px; border-radius: 8px; font-size: 12px; overflow-x: auto; }
  </style>
</head>
<body>
  <h1>📘 ${escapeHtml(generatedPlan.title)}</h1>
  <div class="meta">Davomiyligi: <strong>${generatedPlan.durationMin} daqiqa</strong> · Guruh darajasi: <strong>${escapeHtml(generatedPlan.level)}</strong> · M-EDU AI Pedagogical Studio</div>
  <div class="section">
    <h2>🎯 Kutilayotgan O'quv Natijalari</h2>
    <ul>${generatedPlan.learningObjectives.map((o) => `<li>${escapeHtml(o)}</li>`).join('')}</ul>
  </div>
  <div class="section">
    <h2>🔥 1. Kirish va Faollashtirish (${escapeHtml(generatedPlan.warmup.duration)})</h2>
    <p>${escapeHtml(generatedPlan.warmup.activity)}</p>
  </div>
  <div class="section">
    <h2>📖 2. Nazariy Qism (${escapeHtml(generatedPlan.theory.duration)})</h2>
    <ul>${generatedPlan.theory.topics.map((tItem) => `<li>${escapeHtml(tItem)}</li>`).join('')}</ul>
    ${generatedPlan.theory.demoCode ? `<pre>${escapeHtml(generatedPlan.theory.demoCode)}</pre>` : ''}
  </div>
  <div class="section">
    <h2>💻 3. Amaliy Laboratoriya (${escapeHtml(generatedPlan.handsOn.duration)})</h2>
    <p><strong>Vazifa:</strong> ${escapeHtml(generatedPlan.handsOn.task)}</p>
    <p><strong>Maslahat:</strong> ${escapeHtml(generatedPlan.handsOn.hint)}</p>
  </div>
  <div class="section">
    <h2>❓ 4. Nazorat Savollari</h2>
    ${generatedPlan.quizQuestions
      .map(
        (q, i) =>
          `<p><strong>${i + 1}. ${escapeHtml(q.question)}</strong><br/>Javob: ${escapeHtml(q.options[q.correctIndex])} — <em>${escapeHtml(q.explanation)}</em></p>`,
      )
      .join('')}
  </div>
  <div class="section">
    <h2>🏠 5. Uyga Vazifa: ${escapeHtml(generatedPlan.homework.title)}</h2>
    <ul>${generatedPlan.homework.requirements.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul>
  </div>
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`);
    printWin.document.close();
  }, [generatedPlan]);

  return (
    <div
      ref={containerRef}
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={
        {
          '--lp-mx': '50%',
          '--lp-my': '0px',
          '--lp-spot-opacity': '0',
        } as CSSProperties
      }
      className={cn(
        'relative isolate overflow-hidden rounded-[2.25rem] p-5 sm:p-7',
        'border border-white/75 bg-white/[0.82] text-slate-900 backdrop-blur-3xl backdrop-saturate-[205%]',
        'shadow-[inset_0_1.5px_0_0_rgba(255,255,255,0.95),inset_0_-1px_0_0_rgba(99,102,241,0.14),0_24px_64px_-15px_rgba(15,23,42,0.12)]',
        'dark:border-white/[0.14] dark:bg-[#0D111C]/[0.88] dark:text-white',
        'dark:shadow-[inset_0_1.5px_0_0_rgba(255,255,255,0.22),inset_0_-1px_0_0_rgba(99,102,241,0.22),0_28px_72px_-15px_rgba(0,0,0,0.75)]',
      )}
    >
      {toastNode}
      <TopSpecular inset="inset-x-10" />

      {/* ── Ambient Volumetric Plasma & Interactive Caustic Spotlight ── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 -z-10 h-64 w-64 rounded-full bg-gradient-to-br from-indigo-500/20 via-purple-500/15 to-transparent blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -left-20 -z-10 h-60 w-60 rounded-full bg-gradient-to-tr from-emerald-500/15 via-cyan-500/10 to-transparent blur-3xl"
      />
      <div
        aria-hidden="true"
        style={{
          opacity: 'var(--lp-spot-opacity, 0)',
          background:
            'radial-gradient(360px circle at var(--lp-mx, 50%) var(--lp-my, 0px), rgba(255,255,255,0.34), rgba(99,102,241,0.08) 45%, transparent 75%)',
        }}
        className="pointer-events-none absolute inset-0 -z-10 transition-opacity duration-500 dark:mix-blend-screen"
      />

      {/* ── 1. Studio Header ─────────────────────────────────────────── */}
      <div className="relative z-10 mb-5 flex items-center justify-between gap-4 border-b border-black/[0.06] pb-4 dark:border-white/[0.08]">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="relative shrink-0">
            <div
              aria-hidden="true"
              className="absolute -inset-1 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-cyan-500 opacity-45 blur-md"
            />
            <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-indigo-600 text-white shadow-[inset_0_1.5px_0_rgba(255,255,255,0.55),0_8px_20px_-4px_rgba(99,102,241,0.5)] ring-1 ring-white/30">
              <GraduationCap className="h-5 w-5" />
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="truncate text-base font-extrabold tracking-tight text-slate-900 sm:text-lg dark:text-white">
                AI Pedagogik Dars Rejasi & Quiz Studiyasi
              </h4>
              <span className="inline-flex items-center gap-1 rounded-full border border-indigo-500/25 bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] dark:border-indigo-400/30 dark:bg-indigo-500/20 dark:text-indigo-300">
                <Sparkles className="h-3 w-3" />
                Gemini 3 Curriculum
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs font-medium text-slate-500 dark:text-slate-400">
              5 bosqichli metodik dars konsepsiyasi, jonli kod, interaktiv test va uyga vazifa generatori
            </p>
          </div>
        </div>

        {onClose && (
          <motion.button
            type="button"
            whileTap={reduced ? undefined : { scaleX: 1.08, scaleY: 0.9 }}
            transition={SPRING_GEL}
            onClick={onClose}
            aria-label="Yopish"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/[0.07] bg-black/[0.04] text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] transition-colors hover:bg-black/[0.08] hover:text-slate-900 dark:border-white/[0.1] dark:bg-white/[0.06] dark:text-slate-400 dark:hover:bg-white/[0.12] dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </motion.button>
        )}
      </div>

      {/* ── 2. Liquid Glass Configuration Controls ───────────────────── */}
      <div className="relative z-10 space-y-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Topic Input */}
          <div className="lg:col-span-6">
            <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <BookOpen className="h-3.5 w-3.5 text-indigo-500" />
              <span>Dars mavzusi</span>
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleGenerate();
              }}
              placeholder="Masalan: Python OOP, React Hooks, IELTS Writing..."
              className="w-full rounded-2xl border border-black/[0.08] bg-white/80 px-3.5 py-2.5 text-xs font-bold text-slate-900 placeholder:font-medium placeholder:text-slate-400 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04),0_1px_0_rgba(255,255,255,0.8)] outline-none backdrop-blur-xl transition-all focus:border-indigo-500 focus:bg-white focus:ring-3 focus:ring-indigo-500/15 dark:border-white/[0.12] dark:bg-white/[0.05] dark:text-white dark:focus:border-indigo-400"
            />
          </div>

          {/* Segmented Duration Picker */}
          <div className="lg:col-span-3">
            <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <Clock className="h-3.5 w-3.5 text-indigo-500" />
              <span>Davomiyligi</span>
            </label>
            <LayoutGroup id="lesson-duration-segmented">
              <div className="grid grid-cols-2 gap-1 rounded-2xl border border-black/[0.06] bg-black/[0.035] p-1 dark:border-white/[0.08] dark:bg-white/[0.04]">
                {DURATION_OPTIONS.map((opt) => {
                  const active = duration === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        soundRef.current?.playTick?.();
                        setDuration(opt.value);
                      }}
                      className={cn(
                        'relative rounded-xl py-2 text-center text-xs font-bold transition-colors',
                        active
                          ? 'text-indigo-600 dark:text-indigo-300'
                          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="lessonDurationPill"
                          transition={SPRING_SNAPPY}
                          aria-hidden="true"
                          className="absolute inset-0 -z-10 rounded-xl border border-white/80 bg-white shadow-xs dark:border-white/15 dark:bg-white/12"
                        />
                      )}
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </LayoutGroup>
          </div>

          {/* Segmented Level Picker */}
          <div className="lg:col-span-3">
            <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <Layers className="h-3.5 w-3.5 text-indigo-500" />
              <span>Guruh darajasi</span>
            </label>
            <LayoutGroup id="lesson-level-segmented">
              <div className="grid grid-cols-3 gap-1 rounded-2xl border border-black/[0.06] bg-black/[0.035] p-1 dark:border-white/[0.08] dark:bg-white/[0.04]">
                {LEVEL_OPTIONS.map((opt) => {
                  const active = level === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        soundRef.current?.playTick?.();
                        setLevel(opt.id);
                      }}
                      className={cn(
                        'relative truncate rounded-xl px-1.5 py-2 text-center text-[11px] font-bold transition-colors',
                        active
                          ? 'text-indigo-600 dark:text-indigo-300'
                          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="lessonLevelPill"
                          transition={SPRING_SNAPPY}
                          aria-hidden="true"
                          className="absolute inset-0 -z-10 rounded-xl border border-white/80 bg-white shadow-xs dark:border-white/15 dark:bg-white/12"
                        />
                      )}
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </LayoutGroup>
          </div>
        </div>

        {/* Quick Topic Presets */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
            Tezkor mavzular:
          </span>
          {TOPIC_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => {
                soundRef.current?.playTick?.();
                setTopic(preset);
              }}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all',
                topic === preset
                  ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-600 dark:text-indigo-300'
                  : 'border-black/[0.06] bg-black/[0.025] text-slate-600 hover:bg-black/[0.05] dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-slate-400 dark:hover:text-slate-200',
              )}
            >
              {preset}
            </button>
          ))}
        </div>

        {/* Primary Generate CTA */}
        <motion.button
          type="button"
          disabled={isGenerating || !topic.trim()}
          whileTap={
            reduced || isGenerating || !topic.trim()
              ? undefined
              : { scaleX: 1.02, scaleY: 0.96 }
          }
          transition={SPRING_GEL}
          onClick={handleGenerate}
          className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 py-3 text-xs font-extrabold tracking-tight text-white shadow-[0_12px_28px_-6px_rgba(99,102,241,0.5),inset_0_1.5px_0_rgba(255,255,255,0.45)] transition-all hover:brightness-105 disabled:opacity-45"
        >
          {isGenerating ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
              <span>Gemini 3 5-bosqichli dars rejasini yaratmoqda…</span>
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              <span>Gemini 3 bilan Dars Rejasini Generatsiya Qilish</span>
            </>
          )}
        </motion.button>
      </div>

      {/* ── 3. Generated 5-Stage Curriculum Result ───────────────────── */}
      <AnimatePresence mode="wait">
        {generatedPlan && (
          <motion.div
            key={`${generatedPlan.title}-${generatedPlan.durationMin}-${generatedPlan.level}`}
            initial={{ opacity: 0, y: 14, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.99 }}
            transition={SPRING_SNAPPY}
            className="relative z-10 mt-6 space-y-4 border-t border-black/[0.06] pt-5 dark:border-white/[0.08]"
          >
            {/* Result Top Bar + Export Actions */}
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-extrabold tracking-tight text-indigo-600 dark:text-indigo-400">
                    📖 {generatedPlan.title}
                  </h3>
                  <span className="rounded-full border border-indigo-500/25 bg-indigo-500/10 px-2.5 py-0.5 font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-300">
                    {generatedPlan.durationMin} daqiqa
                  </span>
                  <span className="rounded-full border border-purple-500/25 bg-purple-500/10 px-2.5 py-0.5 text-[11px] font-bold text-purple-600 dark:text-purple-300">
                    {generatedPlan.level}
                  </span>
                </div>
              </div>

              {/* Action Toolbar: Copy, Print PDF, Telegram Share */}
              <div className="flex flex-wrap items-center gap-2">
                <motion.button
                  type="button"
                  whileTap={reduced ? undefined : { scaleX: 1.05, scaleY: 0.92 }}
                  transition={SPRING_GEL}
                  onClick={handleCopyFullPlan}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-black/[0.08] bg-white/80 px-3 py-1.5 text-[11.5px] font-bold text-slate-700 shadow-xs transition-colors hover:bg-white dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200 dark:hover:bg-white/10"
                >
                  {copiedId === 'full-plan' ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                      <span>Nusxalandi</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Nusxa olish</span>
                    </>
                  )}
                </motion.button>

                <motion.button
                  type="button"
                  whileTap={reduced ? undefined : { scaleX: 1.05, scaleY: 0.92 }}
                  transition={SPRING_GEL}
                  onClick={handlePrintPdf}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-black/[0.08] bg-white/80 px-3 py-1.5 text-[11.5px] font-bold text-slate-700 shadow-xs transition-colors hover:bg-white dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200 dark:hover:bg-white/10"
                >
                  <Printer className="h-3.5 w-3.5 text-indigo-500" />
                  <span>PDF / Chop etish</span>
                </motion.button>

                <motion.button
                  type="button"
                  whileTap={reduced ? undefined : { scaleX: 1.05, scaleY: 0.92 }}
                  transition={SPRING_GEL}
                  onClick={handleShareTelegram}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/12 px-3 py-1.5 text-[11.5px] font-bold text-sky-600 transition-colors hover:bg-sky-500/20 dark:text-sky-300"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Telegram’ga ulashish</span>
                </motion.button>
              </div>
            </div>

            {/* iOS Storage-Style Lesson Time Allocation Telemetry Bar */}
            <div className={cn(SUB_CARD, 'py-3')}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold">
                <span className="uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Dars vaqti taqsimoti ({generatedPlan.durationMin} daqiqa)
                </span>
                <div className="flex flex-wrap items-center gap-3 text-[11px]">
                  <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    Kirish: {generatedPlan.timeBreakdown.warmupMin}m
                  </span>
                  <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
                    <span className="h-2 w-2 rounded-full bg-indigo-500" />
                    Nazariya: {generatedPlan.timeBreakdown.theoryMin}m
                  </span>
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Amaliyot: {generatedPlan.timeBreakdown.handsOnMin}m
                  </span>
                  <span className="inline-flex items-center gap-1 text-purple-600 dark:text-purple-400">
                    <span className="h-2 w-2 rounded-full bg-purple-500" />
                    Quiz: {generatedPlan.timeBreakdown.quizMin}m
                  </span>
                  <span className="inline-flex items-center gap-1 text-cyan-600 dark:text-cyan-400">
                    <span className="h-2 w-2 rounded-full bg-cyan-500" />
                    Vazifa: {generatedPlan.timeBreakdown.homeworkMin}m
                  </span>
                </div>
              </div>

              <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-black/[0.06] p-0.5 dark:bg-white/[0.08]">
                <div
                  style={{
                    width: `${(generatedPlan.timeBreakdown.warmupMin / generatedPlan.durationMin) * 100}%`,
                  }}
                  className="h-full rounded-l-full bg-amber-500"
                />
                <div
                  style={{
                    width: `${(generatedPlan.timeBreakdown.theoryMin / generatedPlan.durationMin) * 100}%`,
                  }}
                  className="h-full bg-indigo-500"
                />
                <div
                  style={{
                    width: `${(generatedPlan.timeBreakdown.handsOnMin / generatedPlan.durationMin) * 100}%`,
                  }}
                  className="h-full bg-emerald-500"
                />
                <div
                  style={{
                    width: `${(generatedPlan.timeBreakdown.quizMin / generatedPlan.durationMin) * 100}%`,
                  }}
                  className="h-full bg-purple-500"
                />
                <div
                  style={{
                    width: `${(generatedPlan.timeBreakdown.homeworkMin / generatedPlan.durationMin) * 100}%`,
                  }}
                  className="h-full rounded-r-full bg-cyan-500"
                />
              </div>
            </div>

            {/* Stage Filter Pills */}
            <LayoutGroup id="lesson-stage-filter">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {(
                  [
                    { id: 'all', label: 'Barcha bosqichlar (5)' },
                    { id: 'warmup', label: '1. Kirish (Icebreaker)' },
                    { id: 'theory', label: '2. Nazariya & Kod' },
                    { id: 'lab', label: '3. Laboratoriya' },
                    { id: 'quiz', label: `4. Interaktiv Quiz (${generatedPlan.quizQuestions.length})` },
                    { id: 'homework', label: '5. Uyga vazifa' },
                  ] as const
                ).map((st) => {
                  const active = activeStageFilter === st.id;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => {
                        soundRef.current?.playTick?.();
                        setActiveStageFilter(st.id);
                      }}
                      className={cn(
                        'relative shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold transition-colors',
                        active
                          ? 'text-indigo-600 dark:text-indigo-300'
                          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="lessonStageFilterPill"
                          transition={SPRING_SNAPPY}
                          aria-hidden="true"
                          className="absolute inset-0 -z-10 rounded-xl border border-indigo-500/30 bg-indigo-500/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:border-indigo-400/35 dark:bg-indigo-500/20"
                        />
                      )}
                      {st.label}
                    </button>
                  );
                })}
              </div>
            </LayoutGroup>

            {/* Learning Objectives Banner */}
            {activeStageFilter === 'all' && (
              <div className={SUB_CARD}>
                <TopSpecular inset="inset-x-6" />
                <div className="mb-2 flex items-center gap-2 text-xs font-extrabold text-slate-900 dark:text-white">
                  <Target className="h-4 w-4 text-indigo-500" />
                  <span>Kutilayotgan O‘quv Natijalari (Learning Objectives)</span>
                </div>
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {generatedPlan.learningObjectives.map((obj, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 rounded-xl border border-black/[0.04] bg-black/[0.02] p-2.5 text-xs text-slate-700 dark:border-white/[0.06] dark:bg-white/[0.025] dark:text-slate-300"
                    >
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 font-mono text-[10px] font-bold text-indigo-600 dark:text-indigo-300">
                        {i + 1}
                      </span>
                      <span className="leading-relaxed">{obj}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Stage 1 & Stage 3 Grid (Warmup / Icebreaker & Hands-On Lab) */}
            {(activeStageFilter === 'all' ||
              activeStageFilter === 'warmup' ||
              activeStageFilter === 'lab') && (
              <div
                className={cn(
                  'grid grid-cols-1 gap-3.5',
                  activeStageFilter === 'all' && 'sm:grid-cols-2',
                )}
              >
                {(activeStageFilter === 'all' || activeStageFilter === 'warmup') && (
                  <div className={SUB_CARD}>
                    <TopSpecular inset="inset-x-6" />
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-amber-600 dark:text-amber-400">
                        <Flame className="h-4 w-4" />
                        <span>1. Kirish va Faollashtirish (Icebreaker)</span>
                      </span>
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-mono text-[10.5px] font-bold text-amber-600 dark:text-amber-300">
                        {generatedPlan.warmup.duration}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                      {generatedPlan.warmup.activity}
                    </p>
                  </div>
                )}

                {(activeStageFilter === 'all' || activeStageFilter === 'lab') && (
                  <div className={SUB_CARD}>
                    <TopSpecular inset="inset-x-6" />
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                        <Laptop className="h-4 w-4" />
                        <span>3. Amaliy Laboratoriya (Hands-On)</span>
                      </span>
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-mono text-[10.5px] font-bold text-emerald-600 dark:text-emerald-300">
                        {generatedPlan.handsOn.duration}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                      {generatedPlan.handsOn.task}
                    </p>

                    {/* Interactive Hint Reveal */}
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => {
                          soundRef.current?.playTick?.();
                          setShowLabHint((v) => !v);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:text-emerald-300"
                      >
                        <Lightbulb className="h-3.5 w-3.5" />
                        <span>
                          {showLabHint ? 'Maslahatni yashirish' : 'O‘quvchilar uchun maslahat (Hint)'}
                        </span>
                      </button>

                      <AnimatePresence>
                        {showLabHint && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <p className="mt-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-2.5 text-[11.5px] font-medium text-emerald-800 dark:text-emerald-200">
                              💡 {generatedPlan.handsOn.hint}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Stage 2: Theory & Live Demo Code (Previously missing in JSX!) */}
            {(activeStageFilter === 'all' || activeStageFilter === 'theory') && (
              <div className={SUB_CARD}>
                <TopSpecular inset="inset-x-6" />
                <div className="mb-2.5 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-indigo-600 dark:text-indigo-400">
                    <Code2 className="h-4 w-4" />
                    <span>2. Nazariy Qism va Jonli Kod Namoyishi</span>
                  </span>
                  <span className="rounded-full bg-indigo-500/15 px-2.5 py-0.5 font-mono text-[10.5px] font-bold text-indigo-600 dark:text-indigo-300">
                    {generatedPlan.theory.duration}
                  </span>
                </div>

                <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                  {generatedPlan.theory.topics.map((tItem, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                      <span>{tItem}</span>
                    </li>
                  ))}
                </ul>

                {generatedPlan.theory.demoCode && (
                  <div className="mt-3.5 overflow-hidden rounded-2xl border border-slate-800 bg-[#0B0F19] text-slate-100 shadow-inner">
                    <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-3.5 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                        <span className="ml-2 font-mono text-[10.5px] text-slate-400">
                          live-demo-snippet
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          triggerCopy(
                            'demo-code',
                            generatedPlan.theory.demoCode || '',
                            'Kod namunasi nusxalandi!',
                          )
                        }
                        className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-[10.5px] font-bold text-slate-200 transition-colors hover:bg-white/20"
                      >
                        {copiedId === 'demo-code' ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-400" />
                            <span>Nusxalandi</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>Kodni nusxalash</span>
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="overflow-x-auto p-3.5 font-mono text-[11.5px] leading-relaxed text-indigo-200">
                      <code>{generatedPlan.theory.demoCode}</code>
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Stage 4: Interactive Quiz Simulator */}
            {(activeStageFilter === 'all' || activeStageFilter === 'quiz') && (
              <div className={SUB_CARD}>
                <TopSpecular inset="inset-x-6" />
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-purple-600 dark:text-purple-400">
                    <HelpCircle className="h-4 w-4" />
                    <span>
                      4. Interaktiv Quiz Savollari ({generatedPlan.quizQuestions.length} ta)
                    </span>
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      soundRef.current?.playTick?.();
                      setRevealAllQuiz((v) => !v);
                    }}
                    className="inline-flex items-center gap-1 rounded-xl border border-purple-500/25 bg-purple-500/10 px-2.5 py-1 text-[11px] font-bold text-purple-600 transition-colors hover:bg-purple-500/20 dark:text-purple-300"
                  >
                    {revealAllQuiz ? (
                      <>
                        <EyeOff className="h-3.5 w-3.5" />
                        <span>Javoblarni yashirish</span>
                      </>
                    ) : (
                      <>
                        <Eye className="h-3.5 w-3.5" />
                        <span>Barcha javoblarni ko‘rsatish</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="space-y-3">
                  {generatedPlan.quizQuestions.map((q, qIdx) => {
                    const picked = selectedAnswers[qIdx];
                    const hasPicked = picked !== undefined;
                    const showResult = hasPicked || revealAllQuiz;

                    return (
                      <div
                        key={qIdx}
                        className="rounded-2xl border border-black/[0.06] bg-black/[0.02] p-3.5 dark:border-white/[0.07] dark:bg-white/[0.025]"
                      >
                        <p className="text-xs font-bold text-slate-900 dark:text-white">
                          {qIdx + 1}. {q.question}
                        </p>

                        <div className="mt-2.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                          {q.options.map((opt, oIdx) => {
                            const isCorrect = oIdx === q.correctIndex;
                            const isSelected = picked === oIdx;

                            return (
                              <button
                                key={oIdx}
                                type="button"
                                onClick={() => {
                                  soundRef.current?.playTick?.();
                                  setSelectedAnswers((prev) => ({
                                    ...prev,
                                    [qIdx]: oIdx,
                                  }));
                                }}
                                className={cn(
                                  'flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-[11.5px] font-medium transition-all',
                                  showResult && isCorrect
                                    ? 'border-emerald-500/45 bg-emerald-500/15 font-bold text-emerald-800 dark:text-emerald-200'
                                    : showResult && isSelected && !isCorrect
                                      ? 'border-rose-500/45 bg-rose-500/15 font-bold text-rose-800 dark:text-rose-200'
                                      : 'border-black/[0.06] bg-white/75 text-slate-700 hover:bg-white dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.08]',
                                )}
                              >
                                <span>{opt}</span>
                                {showResult && isCorrect && (
                                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                                )}
                                {showResult && isSelected && !isCorrect && (
                                  <XCircle className="h-4 w-4 shrink-0 text-rose-500" />
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {showResult && (
                          <p className="mt-2.5 rounded-xl border border-purple-500/20 bg-purple-500/[0.07] px-3 py-2 text-[11px] text-slate-700 dark:text-slate-300">
                            <strong className="text-purple-600 dark:text-purple-400">
                              Izoh:{' '}
                            </strong>
                            {q.explanation}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Stage 5: Homework & Evaluation Checklist (Previously missing in JSX!) */}
            {(activeStageFilter === 'all' || activeStageFilter === 'homework') && (
              <div className={SUB_CARD}>
                <TopSpecular inset="inset-x-6" />
                <div className="mb-2 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-cyan-600 dark:text-cyan-400">
                    <BookOpen className="h-4 w-4" />
                    <span>5. Uyga Vazifa: {generatedPlan.homework.title}</span>
                  </span>
                  <span className="rounded-full bg-cyan-500/15 px-2.5 py-0.5 font-mono text-[10.5px] font-bold text-cyan-600 dark:text-cyan-300">
                    {generatedPlan.timeBreakdown.homeworkMin} daqiqa tushuntirish
                  </span>
                </div>

                <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                  {generatedPlan.homework.requirements.map((req, rIdx) => (
                    <li key={rIdx} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-500" />
                      <span>{req}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

AiLessonPlanStudio.displayName = 'AiLessonPlanStudio';

export default AiLessonPlanStudio;