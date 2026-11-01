import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassButton } from '@/components/ui';
import { formatCurrency, fullName } from '@/lib/format';
import type { Teacher } from '@/lib/types';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useHaptics } from '@/hooks/useHaptics';

interface TeacherProfileDrawerProps {
  teacher: Teacher | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (teacher: Teacher) => void;
  onAssignGroup: (teacher: Teacher) => void;
  onOpenAiPlanner: (teacher: Teacher) => void;
}

const DAY_NAMES: Record<string, string> = {
  MONDAY: 'Dushanba',
  TUESDAY: 'Seshanba',
  WEDNESDAY: 'Chorshanba',
  THURSDAY: 'Payshanba',
  FRIDAY: 'Juma',
  SATURDAY: 'Shanba',
  SUNDAY: 'Yakshanba',
};

export const TeacherProfileDrawer = memo(function TeacherProfileDrawer({
  teacher,
  isOpen,
  onClose,
  onEdit,
  onAssignGroup,
  onOpenAiPlanner,
}: TeacherProfileDrawerProps) {
  const { t } = useSafeI18n();
  const sound = usePremiumSound();
  const haptics = useHaptics();

  if (!isOpen || !teacher) return null;

  const teacherName = fullName(teacher.user?.firstName, teacher.user?.lastName);
  const isActive = teacher.user?.isActive !== false;
  const groups = teacher.groups || [];
  const metrics = (teacher as any).metrics || {
    totalStudents: 0,
    weeklyHours: 0,
    groupsCount: groups.length,
  };

  // Build weekly schedule items
  const scheduleItems: Array<{
    day: string;
    startTime: string;
    endTime: string;
    groupName: string;
    room?: string | null;
  }> = [];

  for (const group of groups) {
    for (const schedule of (group as any).schedules || []) {
      scheduleItems.push({
        day: DAY_NAMES[schedule.dayOfWeek] || schedule.dayOfWeek,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        groupName: group.name,
        room: schedule.room,
      });
    }
  }

  // Estimated compensation
  const hourlyRate = Number(teacher.hourlyRate) || 0;
  const lessonRate = Number(teacher.lessonRate) || 0;
  let estimatedMonthly = 0;
  if (teacher.salaryType === 'HOURLY') {
    estimatedMonthly = Math.round(metrics.weeklyHours * 4.2 * hourlyRate);
  } else if (teacher.salaryType === 'PER_LESSON') {
    estimatedMonthly = Math.round(metrics.weeklyHours * 4.2) * lessonRate;
  } else {
    estimatedMonthly = 3_500_000 + Math.round(metrics.weeklyHours * 4.2 * 45_000);
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            sound.playTick?.();
            onClose();
          }}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        />

        {/* Drawer panel */}
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative w-full max-w-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-l border-slate-200/80 dark:border-white/10 shadow-2xl h-full overflow-y-auto flex flex-col z-10"
        >
          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-white/[0.06] flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <div className="w-11 h-11 sm:w-14 sm:h-14 shrink-0 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold text-base sm:text-xl shadow-md">
                {teacherName.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-xl font-bold text-slate-900 dark:text-white truncate">{teacherName}</h2>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${
                      isActive
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-slate-500/10 text-slate-500 dark:text-white/50'
                    }`}
                  >
                    {isActive ? t('teachers.filter.active') : t('teachers.filter.inactive')}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-white/50 mt-0.5 truncate">
                  {teacher.user?.phone || 'Telefon raqam yo‘q'} · {teacher.user?.email || 'Email yo‘q'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 shrink-0 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Quick Contact & Quick Actions Bar */}
          <div className="px-6 py-3 bg-slate-50/50 dark:bg-white/[0.02] border-b border-slate-100 dark:border-white/[0.06] flex flex-wrap gap-2">
            {teacher.user?.phone && (
              <a
                href={`tel:${teacher.user.phone}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
              >
                📞 Qo‘ng‘iroq
              </a>
            )}
            {teacher.user?.phone && (
              <a
                href={`https://t.me/+${teacher.user.phone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 transition-colors"
              >
                ✈️ Telegram
              </a>
            )}
            <button
              type="button"
              onClick={() => {
                sound.playPop?.();
                haptics.light();
                onOpenAiPlanner(teacher);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 transition-colors"
            >
              ✨ {t('teachers.drawer.aiLessonPlan')}
            </button>
            <button
              type="button"
              onClick={() => {
                sound.playTick?.();
                onAssignGroup(teacher);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors"
            >
              ➕ {t('teachers.drawer.assignGroup')}
            </button>
          </div>

          {/* Main Body */}
          <div className="flex-1 p-4 sm:p-6 space-y-6">
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/[0.06]">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-white/50 uppercase">
                  {t('teachers.drawer.studentsCount')}
                </p>
                <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                  {metrics.totalStudents} <span className="text-xs font-normal text-slate-400">nafar</span>
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/[0.06]">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-white/50 uppercase">
                  {t('teachers.drawer.weeklyHours')}
                </p>
                <p className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                  {metrics.weeklyHours} <span className="text-xs font-normal text-slate-400">soat</span>
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/[0.06]">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-white/50 uppercase">
                  {t('teachers.drawer.groupsCount')}
                </p>
                <p className="text-xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                  {metrics.groupsCount} <span className="text-xs font-normal text-slate-400">ta</span>
                </p>
              </div>
            </div>

            {/* Specializations & Bio */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {t('teachers.sidecar.specializations')}
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {(teacher.specializations || []).length > 0 ? (
                  teacher.specializations.map((spec, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-xl text-xs font-medium bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-white/80 border border-slate-200/60 dark:border-white/10"
                    >
                      {spec}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400 dark:text-white/40">
                    {t('teachers.sidecar.generalSpecialization')}
                  </span>
                )}
              </div>
              {teacher.bio && (
                <p className="text-xs leading-relaxed text-slate-600 dark:text-white/70 bg-slate-50 dark:bg-white/[0.02] p-3 rounded-xl border border-slate-100 dark:border-white/[0.06]">
                  {teacher.bio}
                </p>
              )}
            </div>

            {/* Compensation Box */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/5 to-indigo-500/10 border border-blue-500/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-600 dark:text-white/70">
                    {t('teachers.drawer.compensation')}
                  </p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                    {formatCurrency(estimatedMonthly)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200/60 dark:border-white/10">
                    {teacher.salaryType || 'MONTHLY'}
                  </span>
                  {hourlyRate > 0 && (
                    <p className="text-[11px] text-slate-400 dark:text-white/40 mt-1">
                      {formatCurrency(hourlyRate)} / soat
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Weekly Timetable */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center justify-between">
                <span>{t('teachers.drawer.timetable')}</span>
                <span className="text-xs font-normal text-slate-400">
                  {scheduleItems.length} mashg‘ulot
                </span>
              </h3>
              {scheduleItems.length > 0 ? (
                <div className="space-y-2">
                  {scheduleItems.map((item, index) => (
                    <div
                      key={index}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/[0.06] flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {item.day}
                        </span>
                        <span className="text-slate-400 dark:text-white/40 ml-2">
                          {item.startTime} – {item.endTime}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
                          {item.groupName}
                        </span>
                        {item.room && (
                          <span className="text-slate-400 dark:text-white/40">{item.room}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 dark:text-white/40 italic">
                  {t('teachers.drawer.noSchedule')}
                </p>
              )}
            </div>

            {/* Groups list */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Biriktirilgan guruhlar ({groups.length})
              </h3>
              {groups.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {groups.map((g) => (
                    <div
                      key={g.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/[0.06] space-y-1"
                    >
                      <p className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                        {g.name}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-white/50">
                        {g.course?.name || 'Kurs nomi'} · {(g as any)._count?.enrollments ?? 0} o‘quvchi
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 dark:text-white/40 italic">
                  Hozircha guruh biriktirilmagan.
                </p>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between">
            <GlassButton
              variant="secondary"
              onClick={() => {
                sound.playTick?.();
                onEdit(teacher);
                onClose();
              }}
            >
              ✏️ {t('teachers.actions.edit')}
            </GlassButton>

            <GlassButton
              variant="primary"
              onClick={() => {
                sound.playPop?.();
                onOpenAiPlanner(teacher);
              }}
            >
              ✨ {t('teachers.drawer.aiLessonPlan')}
            </GlassButton>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
});
