import { useQuery } from '@tanstack/react-query';
import { GlassPageHeader, GlassBadge, GlassPageLoader, GlassErrorState, GlassEmptyState, GlassStatCard } from '@/components/ui';
import { usePageTitle } from '@/hooks/usePageTitle';
import request from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessages';
import { useI18n } from '@/i18n/I18nProvider';

interface TeacherWorkload {
  teacherId: string;
  teacherName: string;
  groupsCount: number;
  studentsCount: number;
  hoursPerWeek: number;
  capacityHours: number;
  utilization: number; // 0..1
  status: 'UNDERUTILIZED' | 'BALANCED' | 'OVERLOADED';
}

const STATUS_COLOR: Record<TeacherWorkload['status'], 'warning' | 'success' | 'error'> = {
  UNDERUTILIZED: 'warning',
  BALANCED: 'success',
  OVERLOADED: 'error',
};

interface TeacherWorkloadSummary {
  total: number;
  overloaded: number;
  balanced: number;
  underutilized: number;
  avgUtilization: number;
}

export function TeacherWorkloadPage() {
  const { t } = useI18n();
  usePageTitle(t('teacherWorkload.title'));

  const summaryQuery = useQuery({
    queryKey: ['teacher-workload-summary'],
    queryFn: () => request('/teacher-workload/summary') as Promise<TeacherWorkloadSummary>,
  });

  const teachersQuery = useQuery({
    queryKey: ['teacher-workload'],
    queryFn: () => request('/teacher-workload') as Promise<{ items: TeacherWorkload[]; total: number }>,
  });

  const teachers: TeacherWorkload[] = teachersQuery.data?.items ?? [];
  const summary = summaryQuery.data;

  return (
    <div style={{ display: "contents" }}>
      <div className="orb orb-cyan-1" />
      <div className="orb orb-indigo-1" />
      <div className="page-container space-y-4">
        <GlassPageHeader
          title={t('teacherWorkload.title')}
          subtitle={t('teacherWorkload.subtitle')}
        />

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <GlassStatCard label={t('nav.teachers')} value={summary?.total ?? 0} />
          <GlassStatCard label={t('teacherWorkload.overloaded')} value={summary?.overloaded ?? 0} />
          <GlassStatCard label={t('teacherWorkload.balanced')} value={summary?.balanced ?? 0} />
          <GlassStatCard label={t('teacherWorkload.underutilized')} value={summary?.underutilized ?? 0} />
          <GlassStatCard label={t('teacherWorkload.avgUtilization')} value={`${Math.round((summary?.avgUtilization ?? 0) * 100)}%`} />
        </div>

        <div className="glass-card p-4 space-y-2">
          <h3 className="font-semibold text-[var(--text-primary)]">{t('teacherWorkload.modelTitle')}</h3>
          <ul className="text-sm space-y-1.5 text-muted">
            <li>• <strong className="text-[var(--text-primary)]">{t('teacherWorkload.model.capacity')}</strong> — {t('teacherWorkload.model.capacityDesc')}</li>
            <li>• <strong className="text-[var(--text-primary)]">{t('teacherWorkload.model.hoursWeek')}</strong> — {t('teacherWorkload.model.hoursWeekDesc')}</li>
            <li>• <strong className="text-[var(--text-primary)]">{t('teacherWorkload.model.utilization')}</strong> — {t('teacherWorkload.model.utilizationDesc')}</li>
            <li>• <strong className="text-[var(--text-primary)]">{t('teacherWorkload.model.thresholds')}</strong> — {t('teacherWorkload.model.thresholdsDesc')}</li>
          </ul>
        </div>

        <div className="glass-card overflow-hidden">
          {teachersQuery.isLoading ? (
            <div className="p-8"><GlassPageLoader label={t('teacherWorkload.loading')} /></div>
          ) : teachersQuery.isError ? (
            <div className="p-8">
              <GlassErrorState
                message={getErrorMessage(teachersQuery.error)}
                onRetry={() => teachersQuery.refetch()}
              />
            </div>
          ) : teachers.length === 0 ? (
            <div className="p-8">
              <GlassEmptyState
                title={t('teacherWorkload.emptyTitle')}
                message={t('teacherWorkload.emptyMessage')}
              />
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {teachers.map((teacher) => (
                <li key={teacher.teacherId} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium text-sm text-[var(--text-primary)]">{teacher.teacherName}</h4>
                      <p className="text-xs text-muted mt-0.5">
                        {t('teacherWorkload.rowMeta', {
                          groups: teacher.groupsCount,
                          students: teacher.studentsCount,
                          hours: teacher.hoursPerWeek,
                          capacity: teacher.capacityHours,
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono">{Math.round(teacher.utilization * 100)}%</span>
                      <GlassBadge color={STATUS_COLOR[teacher.status]}>{t(`teacherWorkload.${teacher.status.toLowerCase()}`)}</GlassBadge>
                    </div>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-[var(--bg-glass)] overflow-hidden">
                    <div
                      className={[
                        'h-full rounded-full',
                        teacher.utilization > 1 ? 'bg-red-500' :
                        teacher.utilization < 0.6 ? 'bg-amber-500' :
                        'bg-emerald-500',
                      ].join(' ')}
                      style={{ width: `${Math.min(100, teacher.utilization * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
