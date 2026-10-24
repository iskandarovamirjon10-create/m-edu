/**
 * AiLessonQuizStudioModal — AI Lesson Plan & Quiz Generation Studio.
 * ============================================================================
 * Enables teachers to instantly generate pedagogical 45-minute lesson structures
 * and 5 multiple-choice questions with answer keys and explanations.
 * ============================================================================
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Sparkles,
  BookOpen,
  HelpCircle,
  Copy,
  Check,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { aiApi, type AiGeneratedQuizResponse } from '@/lib/api';
import { cn } from '@/lib/design';
import { useSafeI18n } from '@/i18n/I18nProvider';

export interface AiLessonQuizStudioModalProps {
  open: boolean;
  onClose: () => void;
  defaultTopic?: string;
  defaultSubject?: string;
}

export function AiLessonQuizStudioModal({
  open,
  onClose,
  defaultTopic = '',
  defaultSubject = '',
}: AiLessonQuizStudioModalProps) {
  const { t } = useSafeI18n();
  const [topic, setTopic] = useState(defaultTopic);
  const [subject, setSubject] = useState(defaultSubject);
  const [level, setLevel] = useState("O'rta");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'plan' | 'quiz'>('plan');
  const [result, setResult] = useState<AiGeneratedQuizResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    try {
      const res = await aiApi.generateQuiz({
        topic: topic.trim(),
        subject: subject.trim() || undefined,
        level,
        questionCount: 5,
      });
      setResult(res);
    } catch {
      // Quiet failover
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    const text =
      activeTab === 'plan'
        ? `${result.lessonPlan.title}\nDavomiyligi: ${result.lessonPlan.durationMinutes} daqiqa\n\n` +
          result.lessonPlan.steps.map((s) => `[${s.minute} daq] ${s.name}: ${s.goal}`).join('\n')
        : `${result.topic} bo'yicha test savollari:\n\n` +
          result.questions
            .map(
              (q, idx) =>
                `${idx + 1}. ${q.question}\n` +
                q.options.join('\n') +
                `\nTo'g'ri javob: ${q.correctAnswer}\nIzoh: ${q.explanation}\n`,
            )
            .join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className={cn(
          'relative w-full max-w-2xl overflow-hidden rounded-2xl border',
          'bg-white dark:bg-zinc-900 border-black/10 dark:border-white/10',
          'shadow-2xl shadow-black/20 backdrop-blur-2xl p-6 space-y-4 max-h-[90vh] flex flex-col',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/5 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-[#007AFF] to-[#AF52DE] text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                AI Dars Rejasi va Test Savollari Studio
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                O'qituvchilar uchun 45 daqiqalik dars rejasi va testlar generatori
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-black/5 hover:text-zinc-700 dark:hover:bg-white/5 dark:hover:text-zinc-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
          <div className="sm:col-span-2">
            <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">
              Dars mavzusi
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Masalan: Kvadrat tenglamalar, Present Perfect..."
              className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-zinc-50 dark:bg-zinc-800/80 px-3 py-2 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">
              Qiyinlik darajasi
            </label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-zinc-50 dark:bg-zinc-800/80 px-3 py-2 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
            >
              <option value="Boshlang'ich">Boshlang'ich</option>
              <option value="O'rta">O'rta</option>
              <option value="Murakkab">Murakkab</option>
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading || !topic.trim()}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#007AFF] via-[#5856D6] to-[#AF52DE] px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-[#007AFF]/20 hover:brightness-105 active:scale-[0.99] transition-all disabled:opacity-50 shrink-0"
        >
          {loading ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>AI dars va test yaratmoqda…</span>
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              <span>{result ? 'Qayta Yaratish' : 'Dars Rejasi va Testlarni Yaratish'}</span>
            </>
          )}
        </button>

        {/* Results area */}
        {result && (
          <div className="flex-1 min-h-0 flex flex-col space-y-3 pt-2 border-t border-black/5 dark:border-white/5">
            <div className="flex items-center justify-between shrink-0">
              <div className="flex rounded-xl bg-zinc-100 dark:bg-zinc-800 p-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('plan')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-all',
                    activeTab === 'plan'
                      ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100',
                  )}
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>Dars Rejasi (45 daq)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('quiz')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-all',
                    activeTab === 'quiz'
                      ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100',
                  )}
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  <span>5 ta Test Savoli</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#007AFF] hover:underline"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? 'Nusxalandi' : 'Nusxa olish'}</span>
              </button>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {activeTab === 'plan' ? (
                <div className="space-y-2.5">
                  <div className="rounded-xl bg-[#007AFF]/5 dark:bg-[#007AFF]/10 border border-[#007AFF]/20 p-3 flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#007AFF]">{result.lessonPlan.title}</span>
                    <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                      <Clock className="h-3 w-3" />
                      {result.lessonPlan.durationMinutes} daqiqa
                    </span>
                  </div>

                  <div className="space-y-2">
                    {result.lessonPlan.steps.map((step, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-black/5 dark:border-white/5 p-3 flex items-start gap-3"
                      >
                        <span className="rounded-lg bg-zinc-200 dark:bg-zinc-700 px-2 py-1 text-[10px] font-bold text-zinc-700 dark:text-zinc-300 shrink-0">
                          {step.minute} daq
                        </span>
                        <div>
                          <h5 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{step.name}</h5>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{step.goal}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {result.questions.map((q, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-black/5 dark:border-white/5 p-3.5 space-y-2"
                    >
                      <h5 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                        {idx + 1}. {q.question}
                      </h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                        {q.options.map((opt, oIdx) => (
                          <div
                            key={oIdx}
                            className={cn(
                              'rounded-lg px-2.5 py-1.5 text-[11px] border',
                              opt.startsWith(q.correctAnswer)
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-semibold'
                                : 'bg-white dark:bg-zinc-800/80 border-black/5 dark:border-white/5 text-zinc-700 dark:text-zinc-300',
                            )}
                          >
                            {opt}
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 italic pt-1 border-t border-black/5 dark:border-white/5">
                        Izoh: {q.explanation}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
