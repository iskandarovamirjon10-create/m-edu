/**
 * AiLessonQuizStudioModal — AI-Powered Interactive Lesson & Quiz Generator.
 * ============================================================================
 * Enables teachers to instantly generate a complete 45-minute lesson plan
 * and tailored multiple-choice quiz questions for any subject or topic.
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
} from 'lucide-react';
import { aiApi, type AiGeneratedQuizResponse } from '@/lib/api';
import { cn } from '@/lib/design';

export interface AiLessonQuizStudioModalProps {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  defaultTopic?: string;
  defaultSubject?: string;
}

export function AiLessonQuizStudioModal(props: AiLessonQuizStudioModalProps) {
  const {
    open = props.isOpen ?? false,
    onClose,
    defaultTopic = '',
    defaultSubject = '',
  } = props;

  const [topic, setTopic] = useState(defaultTopic);
  const [subject, setSubject] = useState(defaultSubject);
  const [level, setLevel] = useState("O'rta");
  const [loading, setLoading] = useState(false);
  const [quizData, setQuizData] = useState<AiGeneratedQuizResponse | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    try {
      const res = await aiApi.generateQuiz({
        topic: topic.trim(),
        subject: subject.trim() || undefined,
        gradeLevel: level,
      });
      setQuizData(res);
    } catch {
      // Fallback lesson plan and quiz if backend offline
      setQuizData({
        topic,
        subject: subject || 'Fan',
        level,
        lessonPlan: {
          title: `"${topic}" mavzusida interaktiv dars rejasi`,
          durationMinutes: 45,
          steps: [
            { minute: '00-05', name: 'Kirish & Motivatsiya', goal: 'Mavzuga qiziqish uyg‘otish va o‘tgan mavzuni takrorlash' },
            { minute: '05-25', name: 'Yangi mavzu bayoni', goal: 'Asosiy tushunchalar va amaliy misollarni tushuntirish' },
            { minute: '25-38', name: 'Amaliy mashq & Test', goal: 'O‘quvchilar bilan interaktiv savol-javob' },
            { minute: '38-45', name: 'Xulosa & Uyga vazifa', goal: 'Darsni mustahkamlash va vazifa berish' },
          ],
        },
        questions: [
          {
            question: `"${topic}" bo‘yicha asosiy tushuncha qaysi javobda to‘g‘ri ifodalangan?`,
            options: ['A) Nazariy asoslangan standart ta’rif', 'B) Noto‘g‘ri ma’lumot', 'C) Cheklangan variant', 'D) Barchasi to‘g‘ri'],
            correctAnswer: 'A',
            explanation: 'Mavzuning asosiy formulasiga ko‘ra birinchi variant to‘liq mos keladi.',
          },
          {
            question: `Qaysi holatda ushbu qoidani amalda qo‘llash tavsiya etiladi?`,
            options: ['A) Amaliy mashg‘ulotlarda', 'B) Faqat imtihonda', 'C) Hech qachon', 'D) Faqat uyda'],
            correctAnswer: 'A',
            explanation: 'Interaktiv metodika doimiy amaliyotni talab qiladi.',
          },
        ],
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyQuestion = (idx: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
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
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#1C1C1E] shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  AI Dars Rejasi va Test Savollari Studiyasi
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  O'qituvchilar uchun 45 daqiqalik dars rejasi va viktorina generatori
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Form Controls */}
          <div className="p-5 border-b border-black/5 dark:border-white/10 bg-zinc-50/50 dark:bg-zinc-800/30 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Dars Mavzusi:
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="masalan: Kvadrat tenglamalar va Viyet teoremasi"
                  className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Fan:
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Matematika"
                  className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                <span className="font-semibold">Daraja:</span>
                {['Boshlang‘ich', "O'rta", 'Yuqori'].map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLevel(l)}
                    className={cn(
                      'rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all',
                      level === l
                        ? 'bg-indigo-600 text-white shadow-sm'
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
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-md hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 transition-all active:scale-[0.99]"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>AI Tayyorlamoqda...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Dars & Test Tuzish</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Results Scrollable Area */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {!quizData && !loading && (
              <div className="py-12 text-center text-zinc-400">
                <BookOpen className="h-10 w-10 mx-auto mb-2 opacity-30 text-indigo-500" />
                <p className="text-xs font-medium">Mavzuni kiriting va "Dars & Test Tuzish" tugmasini bosing</p>
              </div>
            )}

            {quizData && (
              <>
                {/* Lesson Plan Section */}
                {quizData.lessonPlan && (
                  <div className="rounded-xl border border-black/8 dark:border-white/10 p-4 bg-zinc-50 dark:bg-zinc-800/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-indigo-500" />
                        <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                          {quizData.lessonPlan.title}
                        </h4>
                      </div>
                      <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
                        {quizData.lessonPlan.durationMinutes} daqiqa
                      </span>
                    </div>

                    <div className="space-y-2">
                      {quizData.lessonPlan.steps.map((st, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2.5 text-xs border-l-2 border-indigo-500/40 pl-3 py-1"
                        >
                          <span className="font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                            [{st.minute}]
                          </span>
                          <div className="min-w-0">
                            <span className="font-semibold text-zinc-800 dark:text-zinc-200">{st.name}: </span>
                            <span className="text-zinc-600 dark:text-zinc-400 text-[11px]">{st.goal}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Questions Section */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                    Interaktiv Test Savollari ({quizData.questions?.length ?? 0} ta):
                  </h4>

                  <div className="space-y-3">
                    {quizData.questions?.map((q, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-black/8 dark:border-white/10 p-3.5 bg-white dark:bg-zinc-800/70 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                            {idx + 1}. {q.question}
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyQuestion(
                                idx,
                                `${q.question}\n${q.options.join('\n')}\nJavob: ${q.correctAnswer}\nIzoh: ${q.explanation}`,
                              )
                            }
                            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                            title="Savolni nusxalash"
                          >
                            {copiedIndex === idx ? (
                              <Check className="h-3.5 w-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {q.options.map((opt, oIdx) => (
                            <div
                              key={oIdx}
                              className={cn(
                                'rounded-lg px-2.5 py-1.5 text-[11px] border',
                                opt.startsWith(q.correctAnswer) || opt.includes(` ${q.correctAnswer})`)
                                  ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400 font-semibold'
                                  : 'border-black/5 dark:border-white/5 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400',
                              )}
                            >
                              {opt}
                            </div>
                          ))}
                        </div>

                        {q.explanation && (
                          <p className="text-[10.5px] text-zinc-500 dark:text-zinc-400 italic pt-1">
                            💡 Izoh: {q.explanation}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-black/5 dark:border-white/10 px-5 py-3 bg-zinc-50/50 dark:bg-zinc-800/30">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              Yopish
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
