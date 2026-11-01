import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { GlassButton } from '@/components/ui';
import { groupsApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys.factory';
import { fullName } from '@/lib/format';
import type { Group } from '@/lib/types';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useHaptics } from '@/hooks/useHaptics';

interface GroupDossierDrawerProps {
  group: Group | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (group: Group) => void;
  onGraduate: (group: Group) => void;
  onOpenAiAdvisor: (group: Group) => void;
}

const DAY_LABELS: Record<string, string> = {
  MONDAY: 'Dushanba',
  TUESDAY: 'Seshanba',
  WEDNESDAY: 'Chorshanba',
  THURSDAY: 'Payshanba',
  FRIDAY: 'Juma',
  SATURDAY: 'Shanba',
  SUNDAY: 'Yakshanba',
};

export const GroupDossierDrawer = memo(function GroupDossierDrawer({
  group,
  isOpen,
  onClose,
  onEdit,
  onGraduate,
  onOpenAiAdvisor,
}: GroupDossierDrawerProps) {
  const { t } = useSafeI18n();
  const navigate = useNavigate();
  const sound = usePremiumSound();
  const haptics = useHaptics();

  // Fetch full details if drawer is open
  const { data: fullGroup, isLoading } = useQuery<Group>({
    queryKey: queryKeys.groups.detail(group?.id || ''),
    queryFn: () => groupsApi.get(group!.id) as Promise<Group>,
    enabled: isOpen && Boolean(group?.id),
    staleTime: 30000,
  });

  if (!isOpen || !group) return null;

  const activeGroup: Group = (fullGroup as Group) || group;
  const capacity = activeGroup.capacity ?? 20;
  const enrolledCount =
    activeGroup.enrollments?.filter((e: any) => e.isActive !== false).length ??
    activeGroup._count?.enrollments ??
    0;
  const occupancyPercent =
    capacity > 0 ? Math.min(100, Math.round((enrolledCount / capacity) * 100)) : 0;
  const availableSeats = Math.max(0, capacity - enrolledCount);

  const teacherName = activeGroup.teacher?.user
    ? fullName(activeGroup.teacher.user.firstName, activeGroup.teacher.user.lastName)
    : null;

  const enrollments = (activeGroup.enrollments || []).filter((e: any) => e.isActive !== false);
  const schedules = activeGroup.schedules || [];

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
                {activeGroup.name ? activeGroup.name.slice(0, 2).toUpperCase() : 'GR'}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)] font-display tracking-tight truncate">
                    {activeGroup.name}
                  </h3>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-semibold shrink-0 ${
                      activeGroup.isActive
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        : 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20'
                    }`}
                  >
                    {activeGroup.isActive
                      ? t('common.active', 'Faol')
                      : t('common.inactive', 'Nofaol')}
                  </span>
                </div>
                <p className="text-[12px] sm:text-[12.5px] text-[var(--text-secondary)] font-medium truncate">
                  {activeGroup.course?.name || t('groups.noCourse', 'Kurs belgilanmagan')}
                </p>
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

          {/* Quick Action Toolbar */}
          <div className="px-6 py-3 bg-black/[0.02] dark:bg-white/[0.02] border-b border-black/[0.05] dark:border-white/[0.05] flex items-center gap-2 flex-wrap">
            <GlassButton
              variant="secondary"
              size="sm"
              onClick={() => {
                sound.playTick?.();
                haptics.light();
                onEdit(activeGroup);
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
                onGraduate(activeGroup);
              }}
            >
              <svg className="w-3.5 h-3.5 mr-1 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c3 3 9 3 12 0v-5" />
              </svg>
              {t('groups.actions.graduate', 'Bosqichga o\'tkazish')}
            </GlassButton>

            <GlassButton
              variant="secondary"
              size="sm"
              onClick={() => {
                sound.playTick?.();
                haptics.light();
                onOpenAiAdvisor(activeGroup);
              }}
              className="border-indigo-500/30 text-indigo-600 dark:text-indigo-400"
            >
              <svg className="w-3.5 h-3.5 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
              </svg>
              {t('groups.aiAdvisor', 'AI Maslahatchi')}
            </GlassButton>

            <GlassButton
              variant="primary"
              size="sm"
              onClick={() => {
                sound.playTick?.();
                navigate(`/groups/${activeGroup.id}`);
              }}
            >
              {t('groups.openDetails', 'Guruh sahifasi')} →
            </GlassButton>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Occupancy & Capacity Meter */}
            <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-4 bg-black/[0.02] dark:bg-white/[0.02]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  {t('groups.occupancyTitle', 'Guruh to\'ldirilishi')}
                </span>
                <span
                  className={`text-[12px] font-bold px-2 py-0.5 rounded-md ${
                    occupancyPercent >= 100
                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      : occupancyPercent >= 80
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {occupancyPercent}% {occupancyPercent >= 100 ? '(To\'liq)' : occupancyPercent >= 80 ? '(Deyarli to\'liq)' : '(Bo\'sh joy bor)'}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="h-3 w-full rounded-full bg-black/10 dark:bg-white/10 overflow-hidden relative mb-3">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${occupancyPercent}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className={`h-full rounded-full ${
                    occupancyPercent >= 100
                      ? 'bg-rose-500'
                      : occupancyPercent >= 80
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                />
              </div>

              <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-black/[0.04] dark:border-white/[0.04]">
                <div>
                  <div className="text-[11px] text-[var(--text-tertiary)]">{t('groups.enrolled', 'Yozilganlar')}</div>
                  <div className="text-[15px] font-bold text-[var(--text-primary)]">{enrolledCount}</div>
                </div>
                <div>
                  <div className="text-[11px] text-[var(--text-tertiary)]">{t('groups.capacity', 'Sig\'im')}</div>
                  <div className="text-[15px] font-bold text-[var(--text-primary)]">{capacity}</div>
                </div>
                <div>
                  <div className="text-[11px] text-[var(--text-tertiary)]">{t('groups.availableSeats', 'Bo\'sh o\'rin')}</div>
                  <div className="text-[15px] font-bold text-emerald-600 dark:text-emerald-400">{availableSeats}</div>
                </div>
              </div>
            </div>

            {/* Quick Details Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.08] p-3 bg-black/[0.01] dark:bg-white/[0.01]">
                <div className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                  {t('groups.form.room', 'Xona')}
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 21h18M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M14 12h.01" />
                    </svg>
                  </div>
                  <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                    {activeGroup.room || t('groups.noRoom', 'Xona belgilanmagan')}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.08] p-3 bg-black/[0.01] dark:bg-white/[0.01]">
                <div className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                  {t('groups.form.teacher', 'O\'qituvchi')}
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
                    </svg>
                  </div>
                  <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                    {teacherName || t('groups.noTeacher', 'O\'qituvchisiz')}
                  </span>
                </div>
              </div>
            </div>

            {/* Schedules Timetable */}
            <div>
              <h4 className="text-[12px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
                {t('groups.scheduleTitle', 'Dars jadvali')} ({schedules.length})
              </h4>
              {schedules.length === 0 ? (
                <div className="rounded-xl border border-dashed border-black/[0.08] dark:border-white/[0.08] p-4 text-center text-[12.5px] text-[var(--text-tertiary)]">
                  {t('groups.noSchedule', 'Dars jadvali belgilanmagan')}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {schedules.map((sc: any) => (
                    <div
                      key={sc.id}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-black/[0.04] dark:border-white/[0.06] bg-black/[0.01] dark:bg-white/[0.01]"
                    >
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-brand-500" />
                        <span className="text-[13px] font-medium text-[var(--text-primary)]">
                          {DAY_LABELS[sc.dayOfWeek] || sc.dayOfWeek}
                        </span>
                      </div>
                      <div className="text-[12px] font-mono text-[var(--text-secondary)]">
                        {sc.startTime} - {sc.endTime} {sc.room ? `(${sc.room})` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Enrolled Students Roster */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[12px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                  {t('groups.enrolledStudents', 'Biriktirilgan o\'quvchilar')} ({enrollments.length})
                </h4>
                {enrollments.length > 0 && (
                  <button
                    type="button"
                    onClick={() => navigate(`/groups/${activeGroup.id}`)}
                    className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 hover:underline"
                  >
                    {t('common.viewAll', 'Barchasini ko\'rish')}
                  </button>
                )}
              </div>

              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="h-12 rounded-xl bg-black/[0.04] dark:bg-white/[0.04] animate-pulse" />
                  ))}
                </div>
              ) : enrollments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-black/[0.08] dark:border-white/[0.08] p-5 text-center text-[12.5px] text-[var(--text-tertiary)]">
                  {t('groups.noStudents', 'Hozircha o\'quvchilar yo\'q')}
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {enrollments.map((enr: any) => {
                    const st = enr.student;
                    const stName = st?.user
                      ? fullName(st.user.firstName, st.user.lastName)
                      : t('groups.unknownStudent', 'Noma\'lum o\'quvchi');
                    const phone = st?.user?.phone || st?.phone || '';
                    return (
                      <div
                        key={enr.id || st?.id}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-black/[0.04] dark:border-white/[0.06] bg-black/[0.01] dark:bg-white/[0.01] hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-8 w-8 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center text-[11px] font-bold shrink-0">
                            {stName.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="truncate">
                            <div className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                              {stName}
                            </div>
                            {phone && (
                              <div className="text-[11px] font-mono text-[var(--text-tertiary)]">
                                {phone}
                              </div>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => st?.id && navigate(`/students/${st.id}`)}
                          className="h-7 w-7 rounded-lg flex items-center justify-center text-[var(--text-tertiary)] hover:text-brand-600 dark:hover:text-brand-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </button>
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
