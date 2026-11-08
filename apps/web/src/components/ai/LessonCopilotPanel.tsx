import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { lessonsApi } from '@/lib/api';
import type { LessonCopilotAnalysis, DifferentiatedTask } from '@/types/academics';

export interface LessonCopilotPanelProps {
  lessonId: string;
  onApplyDifferentiatedTaskToNotes?: (taskText: string) => void;
  onApplyDifferentiatedTaskToHomework?: (task: { title: string; description: string }) => void;
  onOpenAiQuizStudio?: (topic: string, subject: string) => void;
  className?: string;
}

export function LessonCopilotPanel({
  lessonId,
  onApplyDifferentiatedTaskToNotes,
  onApplyDifferentiatedTaskToHomework,
  onOpenAiQuizStudio,
  className = '',
}: LessonCopilotPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'AT_RISK' | 'CHECKPOINTS' | 'TASKS'>('TASKS');
  const [copiedTaskId, setCopiedTaskId] = useState<string | null>(null);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
    };
  }, []);

  const {
    data: copilot,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery<LessonCopilotAnalysis>({
    queryKey: ['lesson-copilot-analysis', lessonId],
    queryFn: () => lessonsApi.getCopilotAnalysis(lessonId),
    enabled: !!lessonId,
    staleTime: 60_000,
  });

  const handleApplyNotes = (task: DifferentiatedTask) => {
    if (!onApplyDifferentiatedTaskToNotes) return;
    const formatted = `\n[${task.badgeText}]: ${task.taskTitle}\nTopshiriq: ${task.taskPrompt}\nEslatma: ${task.solutionHint}`;
    onApplyDifferentiatedTaskToNotes(formatted);
    setCopiedTaskId(task.tier + '-notes');
    if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
    copiedTimeoutRef.current = setTimeout(() => setCopiedTaskId(null), 2000);
  };

  const handleApplyHomework = (task: DifferentiatedTask) => {
    if (!onApplyDifferentiatedTaskToHomework) return;
    onApplyDifferentiatedTaskToHomework({
      title: task.taskTitle,
      description: `${task.taskPrompt}\n\nKo'rsatma / Maslahat: ${task.solutionHint}`,
    });
    setCopiedTaskId(task.tier + '-hw');
    if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
    copiedTimeoutRef.current = setTimeout(() => setCopiedTaskId(null), 2000);
  };

  const atRiskCount = copilot?.atRiskStudents?.length || 0;

  return (
    <div
      className={`rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-950/20 via-surface-900/40 to-purple-950/20 backdrop-blur-xl shadow-lg transition-all ${className}`}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between p-3.5 sm:p-4">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex flex-1 items-center gap-3 text-left min-h-[44px]"
          aria-expanded={isOpen}
        >
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/25">
            <span className="text-base" role="img" aria-label="Copilot">
              ⚡
            </span>
            {isFetching && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500" />
              </span>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black tracking-wide uppercase text-indigo-700 dark:text-indigo-300">
                AI Lesson Copilot
              </span>
              {atRiskCount > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                  {atRiskCount} ta xavf guruhi
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Barqaror guruh
                </span>
              )}
            </div>
            <p className="truncate text-xs font-semibold text-slate-600 dark:text-slate-300 mt-0.5">
              {copilot?.topic ? `Mavzu: ${copilot.topic}` : "Jonli ta'lim intellekti & differensial reja"}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-2">
          {onOpenAiQuizStudio && copilot && (
            <button
              type="button"
              onClick={() => onOpenAiQuizStudio(copilot.topic, copilot.courseName)}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-xs font-bold text-purple-700 dark:text-purple-300 hover:bg-purple-500/20 transition-colors"
            >
              <span>✨ Test Studio</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            aria-label={isOpen ? "Yopish" : "Ochish"}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
              ▼
            </motion.span>
          </button>
        </div>
      </div>

      {/* Collapsible Body */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden border-t border-indigo-500/10"
          >
            <div className="p-3.5 sm:p-4 space-y-4">
              {isLoading ? (
                <div className="space-y-3 py-4">
                  <div className="h-16 w-full animate-pulse rounded-xl bg-indigo-500/10" />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="h-12 animate-pulse rounded-lg bg-indigo-500/10" />
                    <div className="h-12 animate-pulse rounded-lg bg-indigo-500/10" />
                    <div className="h-12 animate-pulse rounded-lg bg-indigo-500/10" />
                    <div className="h-12 animate-pulse rounded-lg bg-indigo-500/10" />
                  </div>
                </div>
              ) : isError || !copilot ? (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-center">
                  <p className="text-xs font-bold text-rose-700 dark:text-rose-300">
                    Copilot tahlilini yuklashda xatolik yuz berdi.
                  </p>
                  <button
                    type="button"
                    onClick={() => refetch()}
                    className="mt-2 text-xs font-black text-rose-600 underline hover:text-rose-700"
                  >
                    Qayta urinish
                  </button>
                </div>
              ) : (
                <>
                  {/* Metrics Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-white/50 dark:bg-surface-800/50 p-2.5">
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Guruh Mastery
                      </div>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
                          {copilot.groupMetrics.groupMasteryIndex}
                        </span>
                        <span className="text-[10px] text-slate-400">/100</span>
                      </div>
                    </div>

                    <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-white/50 dark:bg-surface-800/50 p-2.5">
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Bugungi Davomat
                      </div>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                          {copilot.groupMetrics.attendanceRateToday}%
                        </span>
                        <span className="text-[10px] text-slate-400">
                          ({copilot.groupMetrics.presentToday}/{copilot.groupMetrics.totalStudents})
                        </span>
                      </div>
                    </div>

                    <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-white/50 dark:bg-surface-800/50 p-2.5">
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Tarixiy Davomat
                      </div>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-xl font-black text-blue-600 dark:text-blue-400 tabular-nums">
                          {copilot.groupMetrics.averageHistoricalAttendance}%
                        </span>
                      </div>
                    </div>

                    <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-white/50 dark:bg-surface-800/50 p-2.5">
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Vazifa Faolligi
                      </div>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-xl font-black text-purple-600 dark:text-purple-400 tabular-nums">
                          {copilot.groupMetrics.homeworkCompletionRate}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Navigation Segment Tabs */}
                  <div className="flex items-center gap-1 rounded-xl bg-black/[0.04] dark:bg-white/[0.05] p-1">
                    <button
                      type="button"
                      aria-label="Differensial vazifalar"
                      onClick={() => setActiveTab('TASKS')}
                      className={`flex-1 min-h-[38px] rounded-lg py-1.5 text-xs font-black uppercase tracking-wider transition-all ${
                        activeTab === 'TASKS'
                          ? 'bg-white dark:bg-surface-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Differensial Vazifalar (3)
                    </button>
                    <button
                      type="button"
                      aria-label="Dars qadamlari"
                      onClick={() => setActiveTab('CHECKPOINTS')}
                      className={`flex-1 min-h-[38px] rounded-lg py-1.5 text-xs font-black uppercase tracking-wider transition-all ${
                        activeTab === 'CHECKPOINTS'
                          ? 'bg-white dark:bg-surface-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Dars Qadamlari (4)
                    </button>
                    <button
                      type="button"
                      aria-label="Xavf guruhi ro‘yxati"
                      onClick={() => setActiveTab('AT_RISK')}
                      className={`flex-1 min-h-[38px] rounded-lg py-1.5 text-xs font-black uppercase tracking-wider transition-all ${
                        activeTab === 'AT_RISK'
                          ? 'bg-white dark:bg-surface-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Xavf Guruhi ({atRiskCount})
                    </button>
                  </div>

                  {/* Tab 1: Differentiated Tasks */}
                  {activeTab === 'TASKS' && (
                    <div className="space-y-2.5">
                      {copilot.differentiatedTasks.map((task) => {
                        const tierColor =
                          task.tier === 'FOUNDATION'
                            ? 'border-amber-500/25 bg-amber-500/[0.05] text-amber-700 dark:text-amber-300'
                            : task.tier === 'CORE'
                            ? 'border-blue-500/25 bg-blue-500/[0.05] text-blue-700 dark:text-blue-300'
                            : 'border-purple-500/25 bg-purple-500/[0.05] text-purple-700 dark:text-purple-300';

                        return (
                          <div
                            key={task.tier}
                            className="rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-white/70 dark:bg-surface-800/70 p-3 space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${tierColor}`}
                              >
                                {task.badgeText}
                              </span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                {task.targetAudience}
                              </span>
                            </div>

                            <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                              {task.taskTitle}
                            </p>
                            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                              {task.taskPrompt}
                            </p>
                            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 italic">
                              💡 Maslahat: {task.solutionHint}
                            </p>

                            <div className="flex items-center justify-end gap-2 pt-1">
                              {onApplyDifferentiatedTaskToNotes && (
                                <button
                                  type="button"
                                  onClick={() => handleApplyNotes(task)}
                                  className="min-h-[38px] px-3 py-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/20 transition-colors"
                                >
                                  {copiedTaskId === task.tier + '-notes'
                                    ? '✓ Izohga qo‘shildi'
                                    : '📋 Dars izohiga qo‘shish'}
                                </button>
                              )}
                              {onApplyDifferentiatedTaskToHomework && (
                                <button
                                  type="button"
                                  onClick={() => handleApplyHomework(task)}
                                  className="min-h-[38px] px-3 py-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 text-xs font-bold text-purple-700 dark:text-purple-300 hover:bg-purple-500/20 transition-colors"
                                >
                                  {copiedTaskId === task.tier + '-hw'
                                    ? '✓ Vazifaga o‘tdi'
                                    : '📝 Uy vazifasiga ko‘chirish'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Tab 2: Pedagogical Checkpoints */}
                  {activeTab === 'CHECKPOINTS' && (
                    <div className="space-y-2.5">
                      {copilot.pedagogicalCheckpoints.map((cp, idx) => (
                        <div
                          key={cp.phase}
                          className="rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-white/70 dark:bg-surface-800/70 p-3 space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500/15 text-[10px] font-black text-indigo-600 dark:text-indigo-400">
                                {idx + 1}
                              </span>
                              {cp.title}
                            </span>
                            <span className="rounded-md bg-black/[0.05] dark:bg-white/[0.08] px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                              ⏱️ {cp.durationMinutes} daqiqa
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-300">
                            {cp.instruction}
                          </p>
                          <div className="rounded-lg bg-indigo-500/[0.06] p-2 text-[11px] font-medium text-indigo-900 dark:text-indigo-200">
                            <strong>Tavsiya:</strong> {cp.promptExample}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Tab 3: At-Risk Students */}
                  {activeTab === 'AT_RISK' && (
                    <div className="space-y-2.5">
                      {atRiskCount === 0 ? (
                        <div className="rounded-xl border border-dashed border-emerald-500/30 bg-emerald-500/[0.05] p-6 text-center">
                          <span className="text-2xl" role="img" aria-label="Celebration">
                            🎉
                          </span>
                          <p className="mt-1 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                            Guruhda xavf guruhi aniqlanmadi!
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Barcha o‘quvchilar darslarga faol qatnashmoqda va vazifalarni o‘z vaqtida topshirmoqda.
                          </p>
                        </div>
                      ) : (
                        copilot.atRiskStudents.map((st) => (
                          <div
                            key={st.studentId}
                            className="rounded-xl border border-rose-500/25 bg-rose-500/[0.04] p-3 space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-xs font-black text-slate-900 dark:text-slate-100">
                                  {st.fullName}
                                </p>
                                <p className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold">
                                  {st.reason}
                                </p>
                              </div>
                              <span
                                className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                                  st.level === 'HIGH'
                                    ? 'bg-rose-500 text-white'
                                    : 'bg-amber-500 text-white'
                                }`}
                              >
                                {st.level === 'HIGH' ? 'Yuqori Xavf' : "O'rta Xavf"}
                              </span>
                            </div>

                            <div className="flex flex-wrap gap-2 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                              <span>Ketma-ket qoldirish: {st.stats.absenceStreak} ta</span>
                              <span>•</span>
                              <span>Vazifa balli: {st.stats.homeworkAverage}%</span>
                              <span>•</span>
                              <span>Kechikishlar: {st.stats.latesCount} ta</span>
                            </div>

                            <div className="rounded-lg bg-black/[0.03] dark:bg-white/[0.04] p-2 text-[11px] text-slate-700 dark:text-slate-300">
                              <strong>Tavsiya etilgan chora:</strong> {st.recommendedIntervention}
                            </div>

                            {st.phone && (
                              <div className="flex justify-end pt-1">
                                <a
                                  href={`tel:${st.phone}`}
                                  className="min-h-[34px] inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-white/10 px-2.5 py-1 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                                >
                                  📞 Bog‘lanish: {st.phone}
                                </a>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
