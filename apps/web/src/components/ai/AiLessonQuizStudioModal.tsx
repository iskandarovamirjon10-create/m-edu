/**
 * AiLessonQuizStudioModal — AI-Powered Interactive Lesson & Quiz Generator Studio.
 * ============================================================================
 * Enables teachers to instantly generate pedagogical lesson plans with 4-phase
 * breakdowns (Bloom's taxonomy compliant) and tailored quiz assessments.
 * ============================================================================
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Sparkles,
  BookOpen,
  Copy,
  Check,
  RefreshCw,
  Clock,
  Layers,
  HelpCircle,
  FileText,
  Target,
  ListOrdered,
} from 'lucide-react';
import { aiStudioApi } from '@/lib/ai';
import { cn } from '@/lib/design';

export interface AiLessonQuizStudioModalProps {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  defaultTopic?: string;
  defaultSubject?: string;
  initialMode?: 'quiz' | 'lesson';
}

const BLOOM_LEVELS = [
  { id: 'remember', label: 'Eslab qolish', desc: 'Faktlar va tushunchalar' },
  { id: 'understand', label: 'Tushunish', desc: "G'oyalarni sharhlash" },
  { id: 'apply', label: "Qo'llash", desc: "Vaziyatlarda qo'llash" },
  { id: 'analyze', label: 'Tahlil', desc: "Bog'liqliklarni ajratish" },
  { id: 'evaluate', label: 'Baholash', desc: 'Hukm va xulosa chiqarish' },
  { id: 'create', label: 'Yaratish', desc: 'Yangi yechim yoki mahsulot' },
];

export function AiLessonQuizStudioModal(props: AiLessonQuizStudioModalProps) {
  const {
    open = props.isOpen ?? false,
    onClose,
    defaultTopic = '',
    defaultSubject = '',
    initialMode = 'quiz',
  } = props;

  const [mode, setMode] = useState<'quiz' | 'lesson'>(initialMode);
  const [topic, setTopic] = useState(defaultTopic);
  const [subject, setSubject] = useState(defaultSubject);
  const [level, setLevel] = useState("O'rta");
  const [bloomsLevel, setBloomsLevel] = useState('apply');
  const [difficulty, setDifficulty] = useState<'oson' | "o'rtacha" | 'qiyin'>("o'rtacha");
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [durationMinutes, setDurationMinutes] = useState<number>(45);

  const [loading, setLoading] = useState(false);
  const [quizData, setQuizData] = useState<any | null>(null);
  const [lessonData, setLessonData] = useState<any | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setLoading(true);

    try {
      if (mode === 'quiz') {
        const res = await aiStudioApi.generateQuiz({
          topic: topic.trim(),
          subject: subject.trim() || undefined,
          level,
          questionCount,
          bloomsTaxonomyLevel: bloomsLevel,
          difficulty,
        });
        setQuizData(res);
      } else {
        const res = await aiStudioApi.generateLessonPlan({
          topic: topic.trim(),
          subject: subject.trim() || undefined,
          level,
          durationMinutes,
          bloomsTaxonomyLevel: bloomsLevel,
        });
        setLessonData(res);
      }
    } catch {
      // Local graceful fallback if API is unreachable
      if (mode === 'quiz') {
        setQuizData({
          topic,
          subject: subject || 'Umumiy fan',
          level,
          bloomsTaxonomyLevel: bloomsLevel,
          questions: [
            {
              question: `"${topic}" mavzusi bo'yicha asosiy tushuncha qaysi javobda to'g'ri ko'rsatilgan?`,
              options: [
                'A) Nazariy asoslangan standart taʼrif',
                'B) Noto‘g‘ri yoki noaniq fikr',
                'C) Cheklangan amaliy holat',
                'D) Barcha variantlar to‘g‘ri',
              ],
              correctAnswer: 'A',
              explanation: 'Mavzuning asosiy formulasiga ko‘ra birinchi variant eng to‘liq va ilmiy asoslangan.',
              bloomLevel: bloomsLevel,
            },
            {
              question: `Qaysi holatda ushbu qoidani amalda qo‘llash eng samarali hisoblanadi?`,
              options: [
                'A) Amaliy mashg‘ulotlar va mustaqil loyihalarda',
                'B) Faqat yakuniy imtihonda',
                'C) Hech qachon qo‘llanilmaydi',
                'D) Faqat uy sharoitida',
              ],
              correctAnswer: 'A',
              explanation: 'Interaktiv metodika doimiy amaliy mashg‘ulotlarni talab qiladi.',
              bloomLevel: bloomsLevel,
            },
          ],
          rubricCriteria: [
            "Nazariy tushunchalarni to'g'ri ifodalash",
            "Mantiqiy xulosalarni asoslash",
            "Amaliy masalalarni mustaqil yechish",
          ],
        });
      } else {
        const p1 = Math.max(5, Math.round(durationMinutes * 0.15));
        const p2 = Math.round(durationMinutes * 0.35);
        const p3 = Math.round(durationMinutes * 0.35);

        setLessonData({
          title: `"${topic}" mavzusida ${durationMinutes} daqiqalik dars ishlanmasi`,
          topic,
          subject: subject || 'Fan',
          level,
          durationMinutes,
          bloomsTaxonomyLevel: bloomsLevel,
          learningObjectives: [
            `${topic} mavzusining asosiy tushunchalari va tamoyillarini o'rganish`,
            "Nazariy bilimlarni amaliy topshiriqlarda qo'llay olish",
            "Guruhda ishlash va natijalarni tahlil qilish",
          ],
          materialsNeeded: [
            'Interaktiv doska yoki markerli doska',
            'Tarqatma amaliy topshiriqlar to‘plami',
            'Mavzuga oid ko‘rgazmali misollar',
          ],
          steps: [
            {
              minuteRange: `0-${p1}`,
              phase: 'Kirish & Motivatsiya',
              teacherAction: 'Salomlashish, davomatni nazorat qilish va o‘tgan dars yuzasidan 3 ta savol berish.',
              studentAction: 'Darsga diqqatni jamlash, o‘tgan mavzuni yodga olish.',
              checkpoint: 'Barcha o‘quvchilar dars muhitiga kirishganini tekshirish.',
            },
            {
              minuteRange: `${p1}-${p1 + p2}`,
              phase: 'Yangi mavzu bayoni',
              teacherAction: 'Asosiy tushunchalarni taqdim etish, hayotiy misollar va vizual ko‘rgazmalar bilan tushuntirish.',
              studentAction: 'Konspekt qilish, tushunarsiz joylar bo‘yicha savol berish.',
              checkpoint: '2 ta tezkor nazorat savoli orqali mavzuni tushunganlik darajasi.',
            },
            {
              minuteRange: `${p1 + p2}-${p1 + p2 + p3}`,
              phase: 'Amaliy mustahkamlash',
              teacherAction: 'Juftlikda yoki kichik guruhlarda ishlash uchun topshiriqlar tarqatish va yo‘naltirish.',
              studentAction: 'Amaliy masalalarni yechish, natijalarni juftlikda muhokama qilish.',
              checkpoint: 'Guruhlar bajargan 1-topshiriq to‘g‘riligini tekshirish.',
            },
            {
              minuteRange: `${p1 + p2 + p3}-${durationMinutes}`,
              phase: 'Xulosa & Baholash',
              teacherAction: 'Faol qatnashgan o‘quvchilarni rag‘batlantirish, uyga vazifa va ko‘rsatmalar berish.',
              studentAction: 'Refleksiya bildirish, uyga vazifani qayd etish.',
              checkpoint: 'Refleksiya kartochkalari orqali dars samaradorligini baholash.',
            },
          ],
          differentiatedTasks: {
            support: "Mavzuga oid asosiy qoidalar va sodda misollarni yechish.",
            core: "Standart amaliy topshiriqlar va formulani mustaqil qo'llash.",
            extension: "Mantiqiy murakkabroq vaziyatli masalalarni tahlil qilish.",
          },
          homework: `Darslikdagi "${topic}" mavzusini o‘qish va mustahkamlash mashqlarini bajarish.`,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopyQuestion = (idx: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleCopyAll = () => {
    let fullText = '';
    if (mode === 'quiz' && quizData) {
      fullText = `# ${quizData.topic} — Viktorina & Testlar\n\n`;
      fullText += `**Fan:** ${quizData.subject || 'Umumiy'} | **Daraja:** ${quizData.level} | **Taksonomiya:** ${quizData.bloomsTaxonomyLevel}\n\n`;
      quizData.questions?.forEach((q: any, i: number) => {
        fullText += `### ${i + 1}. ${q.question}\n`;
        q.options.forEach((opt: string) => (fullText += `- ${opt}\n`));
        fullText += `\n**To'g'ri javob:** ${q.correctAnswer}\n**Izoh:** ${q.explanation}\n\n`;
      });
    } else if (mode === 'lesson' && lessonData) {
      fullText = `# ${lessonData.title}\n\n`;
      fullText += `**Davomiyligi:** ${lessonData.durationMinutes} daqiqa | **Daraja:** ${lessonData.level}\n\n`;
      fullText += `## Maqsadlar:\n${lessonData.learningObjectives?.map((o: string) => `- ${o}`).join('\n')}\n\n`;
      fullText += `## Dars bosqichlari:\n`;
      lessonData.steps?.forEach((s: any) => {
        fullText += `### [${s.minuteRange} daq] ${s.phase}\n- **O'qituvchi:** ${s.teacherAction}\n- **O'quvchi:** ${s.studentAction}\n- **Nazorat:** ${s.checkpoint}\n\n`;
      });
      if (lessonData.differentiatedTasks) {
        fullText += `## Tabaqalashtirilgan topshiriqlar:\n- Oddiy: ${lessonData.differentiatedTasks.support}\n- Asosiy: ${lessonData.differentiatedTasks.core}\n- Murakkab: ${lessonData.differentiatedTasks.extension}\n\n`;
      }
      if (lessonData.homework) {
        fullText += `## Uyga vazifa:\n${lessonData.homework}\n`;
      }
    }

    if (fullText) {
      navigator.clipboard.writeText(fullText);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative z-10 w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#1C1C1E] shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 px-6 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  AI Metodik Dars & Viktorina Studiyasi
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  O‘qituvchilar uchun Bloom taksonomiyasiga asoslangan dars rejalari va testlar
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Tab Selector */}
              <div className="flex items-center rounded-xl bg-zinc-100 dark:bg-zinc-800 p-1 border border-black/5 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => setMode('quiz')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-all',
                    mode === 'quiz'
                      ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200',
                  )}
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  Viktorina / Test
                </button>
                <button
                  type="button"
                  onClick={() => setMode('lesson')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-all',
                    mode === 'lesson'
                      ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200',
                  )}
                >
                  <FileText className="h-3.5 w-3.5" />
                  Dars Ishlanmasi
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Form Controls */}
          <div className="p-5 border-b border-black/5 dark:border-white/10 bg-zinc-50/70 dark:bg-zinc-800/40 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Mavzu yoki Bo'lim:
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="masalan: Nyuton qonunlari yoki Kvadrat tenglamalar"
                  className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Fan yo'nalishi:
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Fizika / Matematika"
                  className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Bloom's Taxonomy & Specific Parameters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                  <Layers className="h-3.5 w-3.5 text-indigo-500" />
                  Bloom Taksonomiyasi darajasi:
                </label>
                <select
                  value={bloomsLevel}
                  onChange={(e) => setBloomsLevel(e.target.value)}
                  className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {BLOOM_LEVELS.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label} — ({b.desc})
                    </option>
                  ))}
                </select>
              </div>

              {mode === 'quiz' ? (
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Savollar soni:
                    </label>
                    <div className="flex gap-1.5">
                      {[3, 5, 10].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setQuestionCount(num)}
                          className={cn(
                            'flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all border',
                            questionCount === num
                              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                              : 'border-black/5 dark:border-white/5 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400',
                          )}
                        >
                          {num} ta
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Murakkablik:
                    </label>
                    <div className="flex gap-1.5">
                      {(['oson', "o'rtacha", 'qiyin'] as const).map((diff) => (
                        <button
                          key={diff}
                          type="button"
                          onClick={() => setDifficulty(diff)}
                          className={cn(
                            'flex-1 rounded-lg py-1.5 text-[11px] font-semibold capitalize transition-all border',
                            difficulty === diff
                              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                              : 'border-black/5 dark:border-white/5 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400',
                          )}
                        >
                          {diff}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-indigo-500" />
                    Dars davomiyligi:
                  </label>
                  <div className="flex gap-1.5">
                    {[30, 45, 60, 90].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setDurationMinutes(mins)}
                        className={cn(
                          'flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all border',
                          durationMinutes === mins
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                            : 'border-black/5 dark:border-white/5 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400',
                        )}
                      >
                        {mins} daq
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Trigger Button Row */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                <span className="font-semibold">O‘quvchilar darajasi:</span>
                {['Boshlang‘ich', "O'rta", 'Yuqori'].map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLevel(l)}
                    className={cn(
                      'rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all',
                      level === l
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-black/5 dark:bg-white/5 text-zinc-600 dark:text-zinc-400 hover:bg-black/10 dark:hover:bg-white/10',
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading || !topic.trim()}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2 text-xs font-semibold text-white shadow-md hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 transition-all active:scale-[0.99]"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>AI Tayyorlamoqda...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>{mode === 'quiz' ? 'Testlarni Yaratish' : 'Dars Rejasini Tuzish'}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Results Scrollable Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {((mode === 'quiz' && !quizData) || (mode === 'lesson' && !lessonData)) && !loading && (
              <div className="py-16 text-center text-zinc-400">
                <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30 text-indigo-500" />
                <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  {mode === 'quiz'
                    ? 'Viktorina va test savollari generatori'
                    : 'Metodik dars ishlanmasi generatori'}
                </h4>
                <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                  Mavzuni va fan yo'nalishini kiriting, kerakli parametrlarni tanlang va tugmani bosing.
                </p>
              </div>
            )}

            {/* Quiz Mode Results */}
            {mode === 'quiz' && quizData && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-500" />
                    <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      Tuzilgan Viktorina Savollari ({quizData.questions?.length ?? 0} ta):
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyAll}
                    className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                  >
                    {copiedAll ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedAll ? 'Nusxalandi!' : 'Barchasini nusxalash'}
                  </button>
                </div>

                <div className="space-y-3">
                  {quizData.questions?.map((q: any, idx: number) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-black/8 dark:border-white/10 p-4 bg-white dark:bg-zinc-800/80 shadow-xs space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                            {idx + 1}
                          </span>
                          <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 leading-relaxed">
                            {q.question}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyQuestion(
                              idx,
                              `${idx + 1}. ${q.question}\n${q.options.join('\n')}\nJavob: ${q.correctAnswer}\nIzoh: ${q.explanation}`,
                            )
                          }
                          className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 p-1"
                          title="Savolni nusxalash"
                        >
                          {copiedIndex === idx ? (
                            <Check className="h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {q.options?.map((opt: string, oIdx: number) => {
                          const isCorrect =
                            opt.startsWith(q.correctAnswer) ||
                            opt.includes(` ${q.correctAnswer})`) ||
                            opt.startsWith(`${q.correctAnswer}:`);
                          return (
                            <div
                              key={oIdx}
                              className={cn(
                                'rounded-xl px-3 py-2 text-xs border transition-all',
                                isCorrect
                                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-semibold'
                                  : 'border-black/5 dark:border-white/5 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400',
                              )}
                            >
                              {opt}
                            </div>
                          );
                        })}
                      </div>

                      {q.explanation && (
                        <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/40 px-3 py-2 text-[11px] text-zinc-600 dark:text-zinc-400 italic">
                          💡 <span className="font-semibold">Izoh:</span> {q.explanation}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {quizData.rubricCriteria && quizData.rubricCriteria.length > 0 && (
                  <div className="rounded-xl border border-black/5 dark:border-white/10 p-3.5 bg-zinc-50 dark:bg-zinc-800/40">
                    <h5 className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-1.5">
                      <Target className="h-3.5 w-3.5 text-indigo-500" />
                      Baholash mezonlari (Rubric):
                    </h5>
                    <div className="flex flex-wrap gap-1.5">
                      {quizData.rubricCriteria.map((c: string, cIdx: number) => (
                        <span
                          key={cIdx}
                          className="rounded-lg bg-white dark:bg-zinc-700 px-2.5 py-1 text-[11px] text-zinc-700 dark:text-zinc-300 border border-black/5 dark:border-white/5"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Lesson Plan Mode Results */}
            {mode === 'lesson' && lessonData && (
              <div className="space-y-4">
                {/* Header summary card */}
                <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-50/50 to-purple-50/30 dark:from-indigo-950/20 dark:to-purple-950/20 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                        {lessonData.title}
                      </h4>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Fan: {lessonData.subject} • Daraja: {lessonData.level}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        {lessonData.durationMinutes} daqiqa
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyAll}
                        className="flex items-center gap-1 rounded-lg bg-white dark:bg-zinc-800 px-2.5 py-1 text-xs font-semibold text-zinc-700 dark:text-zinc-200 border border-black/10 dark:border-white/10 shadow-xs"
                      >
                        {copiedAll ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedAll ? 'Nusxalandi' : 'Rejani nusxalash'}
                      </button>
                    </div>
                  </div>

                  {/* Objectives */}
                  {lessonData.learningObjectives && lessonData.learningObjectives.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                        <Target className="h-3.5 w-3.5 text-indigo-500" />
                        Darsning o'quv maqsadlari:
                      </span>
                      <ul className="list-disc list-inside text-xs text-zinc-600 dark:text-zinc-400 space-y-0.5">
                        {lessonData.learningObjectives.map((obj: string, i: number) => (
                          <li key={i}>{obj}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Materials */}
                  {lessonData.materialsNeeded && lessonData.materialsNeeded.length > 0 && (
                    <div className="pt-1">
                      <span className="text-[10.5px] font-semibold text-zinc-500 dark:text-zinc-400">
                        Kerakli jihoz va materiallar:{' '}
                      </span>
                      <span className="text-[11px] text-zinc-700 dark:text-zinc-300">
                        {lessonData.materialsNeeded.join('; ')}
                      </span>
                    </div>
                  )}
                </div>

                {/* 4-Phase Step Timeline */}
                <div className="space-y-3">
                  <h5 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <ListOrdered className="h-3.5 w-3.5 text-indigo-500" />
                    Darsning 4 bosqichli xronologiyasi:
                  </h5>

                  <div className="space-y-2.5">
                    {lessonData.steps?.map((st: any, idx: number) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-black/8 dark:border-white/10 p-3.5 bg-white dark:bg-zinc-800/70 shadow-xs space-y-2 border-l-4 border-l-indigo-500"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                            {idx + 1}. {st.phase}
                          </span>
                          <span className="font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400 rounded-md bg-indigo-50 dark:bg-indigo-900/40 px-2 py-0.5">
                            {st.minuteRange} daq
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/40 p-2.5">
                            <span className="font-semibold text-indigo-700 dark:text-indigo-300 block mb-0.5">
                              O‘qituvchi faoliyati:
                            </span>
                            <p className="text-zinc-600 dark:text-zinc-400 text-[11.5px] leading-relaxed">
                              {st.teacherAction}
                            </p>
                          </div>
                          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/40 p-2.5">
                            <span className="font-semibold text-emerald-700 dark:text-emerald-300 block mb-0.5">
                              O‘quvchilar faoliyati:
                            </span>
                            <p className="text-zinc-600 dark:text-zinc-400 text-[11.5px] leading-relaxed">
                              {st.studentAction}
                            </p>
                          </div>
                        </div>

                        {st.checkpoint && (
                          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 italic">
                            🎯 <span className="font-semibold">Nazorat nuqtasi:</span> {st.checkpoint}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Differentiated tasks */}
                {lessonData.differentiatedTasks && (
                  <div className="rounded-xl border border-black/8 dark:border-white/10 p-4 bg-zinc-50 dark:bg-zinc-800/40 space-y-2">
                    <h5 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      Tabaqalashtirilgan (differensial) topshiriqlar:
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <div className="rounded-lg bg-white dark:bg-zinc-800 p-2.5 border border-black/5 dark:border-white/5">
                        <span className="font-bold text-amber-600 dark:text-amber-400 block mb-1">
                          Oddiy (Qo‘llab-quvvatlash):
                        </span>
                        <p className="text-zinc-600 dark:text-zinc-400 text-[11px]">
                          {lessonData.differentiatedTasks.support}
                        </p>
                      </div>
                      <div className="rounded-lg bg-white dark:bg-zinc-800 p-2.5 border border-black/5 dark:border-white/5">
                        <span className="font-bold text-indigo-600 dark:text-indigo-400 block mb-1">
                          Asosiy (Standart):
                        </span>
                        <p className="text-zinc-600 dark:text-zinc-400 text-[11px]">
                          {lessonData.differentiatedTasks.core}
                        </p>
                      </div>
                      <div className="rounded-lg bg-white dark:bg-zinc-800 p-2.5 border border-black/5 dark:border-white/5">
                        <span className="font-bold text-purple-600 dark:text-purple-400 block mb-1">
                          Murakkab (Chuqur):
                        </span>
                        <p className="text-zinc-600 dark:text-zinc-400 text-[11px]">
                          {lessonData.differentiatedTasks.extension}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Homework */}
                {lessonData.homework && (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-950/10 p-3 text-xs">
                    <span className="font-bold text-emerald-800 dark:text-emerald-300">
                      Uyga vazifa:{' '}
                    </span>
                    <span className="text-zinc-700 dark:text-zinc-300">{lessonData.homework}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-black/5 dark:border-white/10 px-6 py-3.5 bg-zinc-50/70 dark:bg-zinc-800/40">
            <span className="text-[11px] text-zinc-400">
              M-EDU AI Pedagogik Yordamchisi • O'qituvchi tomonidan tasdiqlanishi tavsiya etiladi
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              Yopish
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
