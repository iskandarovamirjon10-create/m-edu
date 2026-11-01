import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { GlassButton } from '@/components/ui';
import { coursesApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys.factory';
import { formatCurrency, fullName } from '@/lib/format';
import type { Course } from '@/lib/types';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useHaptics } from '@/hooks/useHaptics';

interface CourseSyllabusDrawerProps {
  course: Course | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (course: Course) => void;
  onOpenAiArchitect: (course: Course) => void;
  onCreateGroup?: (course: Course) => void;
}

const LEVEL_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  BEGINNER: { bg: 'bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-500/20' },
  INTERMEDIATE: { bg: 'bg-blue-500/10', text: 'text-blue-700 dark:text-blue-400', border: 'border-blue-500/20' },
  ADVANCED: { bg: 'bg-purple-500/10', text: 'text-purple-700 dark:text-purple-400', border: 'border-purple-500/20' },
  EXPERT: { bg: 'bg-rose-500/10', text: 'text-rose-700 dark:text-rose-400', border: 'border-rose-500/20' },
};

export const CourseSyllabusDrawer = memo(function CourseSyllabusDrawer({
  course,
  isOpen,
  onClose,
  onEdit,
  onOpenAiArchitect,
  onCreateGroup,
}: CourseSyllabusDrawerProps) {
  const { t } = useSafeI18n();
  const navigate = useNavigate();
  const sound = usePremiumSound();
  const haptics = useHaptics();

  // Fetch full course details (with active groups)
  const { data: fullCourse, isLoading } = useQuery<Course>({
    queryKey: queryKeys.courses.detail(course?.id || ''),
    queryFn: () => coursesApi.get(course!.id) as Promise<Course>,
    enabled: isOpen && Boolean(course?.id),
    staleTime: 30000,
  });

  if (!isOpen || !course) return null;

  const activeCourse = (fullCourse || course) as Course & { groups?: any[] };
  const groups = activeCourse.groups || [];
  const levelStyle = (activeCourse.level && LEVEL_COLORS[activeCourse.level]) || LEVEL_COLORS.BEGINNER;

  const totalEnrolled = groups.reduce(
    (sum: number, g: any) => sum + (g._count?.enrollments ?? 0),
    0
  );

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        />

        {/* Drawer Panel */}
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="relative w-full max-w-lg bg-white/95 dark:bg-surface-900/95 backdrop-blur-2xl shadow-2xl border-l border-black/[0.08] dark:border-white/[0.08] flex flex-col h-full z-10 overflow-hidden"
        >
          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between shrink-0 bg-black/[0.01] dark:bg-white/[0.01] gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 sm:h-12 sm:w-12 shrink-0 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white flex items-center justify-center font-bold text-base sm:text-lg shadow-md shadow-brand-500/20">
                {activeCourse.name ? activeCourse.name.slice(0, 2).toUpperCase() : 'CS'}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)] font-display tracking-tight truncate">
                    {activeCourse.name}
                  </h3>
                  {activeCourse.level && (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold border shrink-0 ${levelStyle.bg} ${levelStyle.text} ${levelStyle.border}`}
                    >
                      {activeCourse.level}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] sm:text-[12px] text-[var(--text-secondary)] truncate">
                  <span>{activeCourse.duration} oy</span>
                  <span>·</span>
                  <span className="font-semibold text-brand-600 dark:text-brand-400">
                    {formatCurrency(Number(activeCourse.price))} / oy
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center hover:bg-black/[0.06] dark:hover:bg-white/[0.06] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Action Toolbar */}
          <div className="px-6 py-3 bg-black/[0.02] dark:bg-white/[0.02] border-b border-black/[0.05] dark:border-white/[0.05] flex items-center gap-2 flex-wrap">
            <GlassButton
              variant="secondary"
              size="sm"
              onClick={() => {
                sound.playTick?.();
                haptics.light();
                onEdit(activeCourse);
              }}
            >
              <svg className="w-3.5 h-3.5 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              {t('common.edit', 'Tahrirlash')}
            </GlassButton>

            <GlassButton
              variant="secondary"
              size="sm"
              onClick={() => {
                sound.playTick?.();
                haptics.light();
                onOpenAiArchitect(activeCourse);
              }}
              className="border-indigo-500/30 text-indigo-600 dark:text-indigo-400"
            >
              <svg className="w-3.5 h-3.5 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
              </svg>
              {t('courses.aiArchitect', 'AI Kurs Me\'mori')}
            </GlassButton>

            <GlassButton
              variant="primary"
              size="sm"
              onClick={() => {
                sound.playTick?.();
                if (onCreateGroup) {
                  onCreateGroup(activeCourse);
                } else {
                  navigate(`/groups?new=true&courseId=${activeCourse.id}`);
                }
              }}
            >
              <svg className="w-3.5 h-3.5 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {t('courses.createGroup', 'Guruh ochish')}
            </GlassButton>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Overview & Description */}
            {activeCourse.description && (
              <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-4 bg-black/[0.01] dark:bg-white/[0.01]">
                <h4 className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
                  {t('courses.description', 'Kurs tavsifi')}
                </h4>
                <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
                  {activeCourse.description}
                </p>
              </div>
            )}

            {/* Telemetry Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.08] p-3 bg-black/[0.01] dark:bg-white/[0.01]">
                <div className="text-[11px] text-[var(--text-tertiary)]">{t('courses.activeGroups', 'Faol guruhlar')}</div>
                <div className="text-[18px] font-bold text-[var(--text-primary)] mt-0.5">{groups.length}</div>
              </div>

              <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.08] p-3 bg-black/[0.01] dark:bg-white/[0.01]">
                <div className="text-[11px] text-[var(--text-tertiary)]">{t('courses.totalStudents', 'O\'quvchilar')}</div>
                <div className="text-[18px] font-bold text-brand-600 dark:text-brand-400 mt-0.5">{totalEnrolled}</div>
              </div>

              <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.08] p-3 bg-black/[0.01] dark:bg-white/[0.01]">
                <div className="text-[11px] text-[var(--text-tertiary)]">{t('courses.durationMonths', 'Davomiyligi')}</div>
                <div className="text-[18px] font-bold text-[var(--text-primary)] mt-0.5">{activeCourse.duration} oy</div>
              </div>
            </div>

            {/* Active Groups List */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[12px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                  {t('courses.assignedGroups', 'Mavjud guruhlar')} ({groups.length})
                </h4>
                {groups.length > 0 && (
                  <button
                    type="button"
                    onClick={() => navigate(`/groups?courseId=${activeCourse.id}`)}
                    className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 hover:underline"
                  >
                    {t('common.viewAll', 'Barchasini ko\'rish')}
                  </button>
                )}
              </div>

              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2].map((n) => (
                    <div key={n} className="h-14 rounded-xl bg-black/[0.04] dark:bg-white/[0.04] animate-pulse" />
                  ))}
                </div>
              ) : groups.length === 0 ? (
                <div className="rounded-xl border border-dashed border-black/[0.08] dark:border-white/[0.08] p-6 text-center space-y-2">
                  <p className="text-[12.5px] text-[var(--text-secondary)]">
                    {t('courses.noGroupsForCourse', 'Ushbu kurs bo\'yicha hozircha faol guruhlar yo\'q')}
                  </p>
                  <GlassButton
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      if (onCreateGroup) {
                        onCreateGroup(activeCourse);
                      } else {
                        navigate(`/groups?new=true&courseId=${activeCourse.id}`);
                      }
                    }}
                  >
                    + Yangi guruh ochish
                  </GlassButton>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {groups.map((grp: any) => {
                    const teacherName = grp.teacher?.user
                      ? fullName(grp.teacher.user.firstName, grp.teacher.user.lastName)
                      : (grp.teacher?.firstName ? fullName(grp.teacher.firstName, grp.teacher.lastName) : 'O\'qituvchisiz');
                    const roomName = typeof grp.room === 'object' ? grp.room?.name : grp.room;
                    const cap = grp.capacity ?? 20;
                    const enrCount = grp._count?.enrollments ?? 0;
                    const pct = cap > 0 ? Math.min(100, Math.round((enrCount / cap) * 100)) : 0;

                    return (
                      <div
                        key={grp.id}
                        onClick={() => navigate(`/groups/${grp.id}`)}
                        className="cursor-pointer flex items-center justify-between p-3 rounded-xl border border-black/[0.05] dark:border-white/[0.06] bg-black/[0.01] dark:bg-white/[0.01] hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors"
                      >
                        <div className="min-w-0 flex-1 pr-3">
                          <div className="text-[13px] font-bold text-[var(--text-primary)] truncate">
                            {grp.name}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[var(--text-tertiary)]">
                            <span>{teacherName}</span>
                            {roomName && (
                              <>
                                <span>·</span>
                                <span>{roomName}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-right shrink-0">
                          <div>
                            <div className="text-[12px] font-bold text-[var(--text-primary)]">
                              {enrCount} / {cap}
                            </div>
                            <div className="text-[10px] text-[var(--text-tertiary)]">{pct}% to'lgan</div>
                          </div>
                          <svg className="w-4 h-4 text-[var(--text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
});
