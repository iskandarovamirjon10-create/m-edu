import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { parentPortalApi } from '@/lib/api';
import type { ParentWeeklyDigest } from '@/types/parent';
import { formatDate, formatTime } from '@/lib/format';

interface ParentWeeklyDigestCardProps {
  studentId: string;
  studentName?: string;
  className?: string;
}

const SPRING_SMOOTH = { type: 'spring' as const, stiffness: 320, damping: 28, mass: 0.9 };

export function ParentWeeklyDigestCard({
  studentId,
  studentName,
  className = '',
}: ParentWeeklyDigestCardProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'highlights' | 'turnstile' | 'assignments'>('highlights');

  const { data: digest, isLoading, isError, refetch } = useQuery<ParentWeeklyDigest>({
    queryKey: ['parent-portal-weekly-digest', studentId],
    queryFn: () => parentPortalApi.weeklyDigest(studentId),
    enabled: !!studentId,
  });

  const handleCopySummary = async () => {
    if (!digest) return;
    const text = [
      `📊 HAFTALIK AKADEMIK DIGEST — ${studentName || digest.student.fullName}`,
      `Davr: ${digest.period.startDate} – ${digest.period.endDate} (${digest.period.weekNumber}-hafta)`,
      `Umumiy o'zlashtirish ko'rsatkichi: ${digest.metrics.weeklyMasteryScore}% (${digest.metrics.statusTone})`,
      `Darslarga qatnashish: ${digest.metrics.attendanceRate}% (${digest.metrics.lessonsAttended}/${digest.metrics.totalLessons} dars)`,
      `Kechikishlar soni: ${digest.metrics.latesCount}`,
      `Vazifalar o'rtacha bali: ${digest.metrics.averageScore}`,
      '',
      'Yutuqlar va xulosalar:',
      ...digest.highlights.map((h) => `- ${h}`),
      '',
      'Tavsiyalar:',
      ...digest.recommendations.map((r) => `- ${r}`),
    ].join('\n');

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      // Fallback
      setCopied(false);
    }
  };

  if (isLoading) {
    return (
      <div className={`overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 p-6 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 ${className}`}>
        <div className="flex animate-pulse items-center justify-between">
          <div className="h-5 w-48 rounded-lg bg-slate-200 dark:bg-white/10" />
          <div className="h-5 w-24 rounded-lg bg-slate-200 dark:bg-white/10" />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100 dark:bg-white/5" />
          ))}
        </div>
        <div className="mt-4 h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-white/5" />
      </div>
    );
  }

  if (isError || !digest) {
    return (
      <div className={`overflow-hidden rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 backdrop-blur-xl ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <span className="text-xl">⚠️</span>
            <span className="text-sm font-semibold">Haftalik digestni yuklashda xatolik yuz berdi</span>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-lg bg-rose-600/10 px-3 py-1.5 text-xs font-bold text-rose-700 transition hover:bg-rose-600/20 dark:text-rose-300"
          >
            Qayta urinish
          </button>
        </div>
      </div>
    );
  }

  const { metrics, period, highlights, recommendations, recentAttendances, recentAssignments } = digest;

  const toneConfig = {
    EXCELLENT: {
      label: "A'lo darajada",
      icon: '✨',
      badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      glowClass: 'from-emerald-500/10 via-transparent to-transparent',
    },
    GOOD: {
      label: 'Yaxshi darajada',
      icon: '👍',
      badgeClass: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
      glowClass: 'from-indigo-500/10 via-transparent to-transparent',
    },
    NEEDS_ATTENTION: {
      label: "E'tibor talab qiladi",
      icon: '⚠️',
      badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
      glowClass: 'from-amber-500/10 via-transparent to-transparent',
    },
  }[metrics.statusTone];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING_SMOOTH}
      className={`group relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/85 p-6 backdrop-blur-xl shadow-card dark:border-white/[0.08] dark:bg-surface-900/85 ${className}`}
    >
      {/* Aurora Ambient Glow */}
      <div
        className={`pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-gradient-to-br ${toneConfig.glowClass} blur-3xl opacity-60`}
      />

      {/* Top Header */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/60 pb-4 dark:border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-600 shadow-sm ring-1 ring-inset ring-indigo-500/30 dark:text-indigo-400">
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[1.05rem] font-black tracking-tight text-[var(--text-primary)]">
                Haftalik Akademik Digest
              </h2>
              <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[0.7rem] font-black ${toneConfig.badgeClass}`}>
                <span>{toneConfig.icon}</span>
                <span>{toneConfig.label}</span>
              </span>
            </div>
            <p className="mt-0.5 text-[0.78rem] font-medium text-[var(--text-muted)]">
              Davr: {formatDate(period.startDate)} – {formatDate(period.endDate)} · {period.weekNumber}-hafta
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopySummary}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/70 px-3 py-1.5 text-[0.78rem] font-bold text-[var(--text-primary)] shadow-sm backdrop-blur transition hover:bg-slate-50 dark:border-white/[0.1] dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
            title="Xulosani nusxalash"
            aria-label="Xulosani nusxalash"
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            <span>{copied ? 'Nusxalandi! ✨' : 'Xulosani nusxalash'}</span>
          </button>
        </div>
      </div>

      {/* 4 Metric Key Performance Indicators */}
      <div className="relative z-10 mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Metric 1: Weekly Mastery Score */}
        <div className="relative overflow-hidden rounded-xl border border-slate-200/70 bg-gradient-to-br from-indigo-50/60 to-white/70 p-3.5 shadow-sm dark:border-white/[0.06] dark:from-indigo-950/20 dark:to-white/[0.02]">
          <span className="text-[0.68rem] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
            O&apos;zlashtirish
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-[var(--text-primary)] tabular-nums">
              {metrics.weeklyMasteryScore}
            </span>
            <span className="text-xs font-bold text-[var(--text-muted)]">/ 100</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${metrics.weeklyMasteryScore}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
            />
          </div>
        </div>

        {/* Metric 2: Attendance Rate */}
        <div className="relative overflow-hidden rounded-xl border border-slate-200/70 bg-gradient-to-br from-emerald-50/60 to-white/70 p-3.5 shadow-sm dark:border-white/[0.06] dark:from-emerald-950/20 dark:to-white/[0.02]">
          <span className="text-[0.68rem] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
            Dars qatnashishi
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              {metrics.attendanceRate}%
            </span>
          </div>
          <span className="mt-1 block text-[0.72rem] font-medium text-[var(--text-muted)]">
            {metrics.lessonsAttended} / {metrics.totalLessons} dars ishtirok etildi
          </span>
        </div>

        {/* Metric 3: Punctuality */}
        <div className="relative overflow-hidden rounded-xl border border-slate-200/70 bg-gradient-to-br from-sky-50/60 to-white/70 p-3.5 shadow-sm dark:border-white/[0.06] dark:from-sky-950/20 dark:to-white/[0.02]">
          <span className="text-[0.68rem] font-black uppercase tracking-wider text-sky-700 dark:text-sky-300">
            Vaqtga rioya
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-[var(--text-primary)] tabular-nums">
              {metrics.latesCount}
            </span>
            <span className="text-xs font-bold text-[var(--text-muted)]">ta kechikish</span>
          </div>
          <span className="mt-1 block text-[0.72rem] font-medium text-[var(--text-muted)]">
            {metrics.latesCount === 0 ? "Mukammal punktuallik ⏱️" : "Diqqat qilish lozim"}
          </span>
        </div>

        {/* Metric 4: Average Score */}
        <div className="relative overflow-hidden rounded-xl border border-slate-200/70 bg-gradient-to-br from-purple-50/60 to-white/70 p-3.5 shadow-sm dark:border-white/[0.06] dark:from-purple-950/20 dark:to-white/[0.02]">
          <span className="text-[0.68rem] font-black uppercase tracking-wider text-purple-700 dark:text-purple-300">
            Uy vazifalari
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-purple-600 dark:text-purple-400 tabular-nums">
              {metrics.averageScore}
            </span>
            <span className="text-xs font-bold text-[var(--text-muted)]">ball</span>
          </div>
          <span className="mt-1 block text-[0.72rem] font-medium text-[var(--text-muted)]">
            Topshirish: {metrics.homeworkCompletionRate}%
          </span>
        </div>
      </div>

      {/* Tabs: Yutuqlar | Turniket monitori | Oxirgi topshiriqlar */}
      <div className="relative z-10 mt-5">
        <div className="flex border-b border-slate-200/60 dark:border-white/[0.06]">
          <button
            type="button"
            onClick={() => setActiveTab('highlights')}
            className={`relative pb-2.5 px-3 text-xs font-bold transition-colors ${
              activeTab === 'highlights'
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <span>🌟 Haftalik yutuqlar</span>
            {activeTab === 'highlights' && (
              <motion.div
                layoutId="digest-tab-indicator"
                className="absolute bottom-0 inset-x-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full"
              />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('turnstile')}
            className={`relative pb-2.5 px-3 text-xs font-bold transition-colors ${
              activeTab === 'turnstile'
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <span>🚪 Turniket & Qatnashuv ({recentAttendances.length})</span>
            {activeTab === 'turnstile' && (
              <motion.div
                layoutId="digest-tab-indicator"
                className="absolute bottom-0 inset-x-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full"
              />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('assignments')}
            className={`relative pb-2.5 px-3 text-xs font-bold transition-colors ${
              activeTab === 'assignments'
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <span>📚 Topshiriqlar ({recentAssignments.length})</span>
            {activeTab === 'assignments' && (
              <motion.div
                layoutId="digest-tab-indicator"
                className="absolute bottom-0 inset-x-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full"
              />
            )}
          </button>
        </div>

        <div className="mt-3">
          <AnimatePresence mode="wait">
            {activeTab === 'highlights' && (
              <motion.div
                key="highlights"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="space-y-2"
              >
                {highlights.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 rounded-xl border border-slate-200/50 bg-slate-50/60 p-3 text-[0.82rem] font-medium leading-relaxed text-[var(--text-primary)] dark:border-white/[0.05] dark:bg-white/[0.02]"
                  >
                    <span>{item}</span>
                  </div>
                ))}
              </motion.div>
            )}

            {activeTab === 'turnstile' && (
              <motion.div
                key="turnstile"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="space-y-2"
              >
                {recentAttendances.length === 0 ? (
                  <p className="py-4 text-center text-xs text-[var(--text-muted)]">
                    Ushbu haftada dars qaydlari mavjud emas
                  </p>
                ) : (
                  recentAttendances.map((att, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-xl border border-slate-200/50 bg-slate-50/60 p-2.5 text-xs dark:border-white/[0.05] dark:bg-white/[0.02]"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-lg px-2 py-0.5 text-[0.68rem] font-black uppercase tracking-wider ${
                            att.status === 'PRESENT'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : att.status === 'LATE'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {att.status === 'PRESENT' ? 'Kelgan' : att.status === 'LATE' ? 'Kechikkan' : 'Sababli'}
                        </span>
                        <span className="font-bold text-[var(--text-primary)]">{att.groupName}</span>
                        {att.source === 'RFID_TURNSTILE' && (
                          <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[0.62rem] font-bold text-sky-600 dark:text-sky-400">
                            Turniket RFID
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[var(--text-muted)] font-medium">
                        {att.markedAt && <span>{formatTime(att.markedAt)}</span>}
                        <span>{formatDate(att.date)}</span>
                      </div>
                    </div>
                  ))
                )}
              </motion.div>
            )}

            {activeTab === 'assignments' && (
              <motion.div
                key="assignments"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="space-y-2"
              >
                {recentAssignments.length === 0 ? (
                  <p className="py-4 text-center text-xs text-[var(--text-muted)]">
                    Ushbu haftada yangi topshiriqlar mavjud emas
                  </p>
                ) : (
                  recentAssignments.map((ass, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-xl border border-slate-200/50 bg-slate-50/60 p-2.5 text-xs dark:border-white/[0.05] dark:bg-white/[0.02]"
                    >
                      <div>
                        <p className="font-bold text-[var(--text-primary)]">{ass.title}</p>
                        <p className="text-[0.68rem] text-[var(--text-muted)]">{ass.groupName}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-indigo-600 dark:text-indigo-400">
                          {ass.score !== null ? `${ass.score} / ${ass.maxScore}` : 'Tekshirilmoqda'}
                        </span>
                        <p className="text-[0.65rem] text-[var(--text-muted)]">
                          {formatDate(ass.submittedAt)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Parental Recommendations Block */}
      {recommendations.length > 0 && (
        <div className="relative z-10 mt-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3.5 dark:border-indigo-500/30 dark:bg-indigo-950/20">
          <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
            <span className="text-sm">💡</span>
            <span className="text-xs font-black uppercase tracking-wider">Ota-onalar uchun pedagogik tavsiya</span>
          </div>
          <p className="mt-1 text-[0.8rem] font-medium leading-relaxed text-[var(--text-primary)]">
            {recommendations[0]}
          </p>
        </div>
      )}
    </motion.div>
  );
}
