import { useQuery } from '@tanstack/react-query';
import {
  PageHeader,
  Badge,
  PageLoader,
  EmptyState,
  GlassStatCard,
} from '@/components/ui';
import { usePageTitle } from '@/hooks/usePageTitle';
import request from '@/lib/api';

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

export function TeacherWorkloadPage() {
  usePageTitle('Teacher Workload Intelligence');

  const summaryQuery = useQuery({
    queryKey: ['teacher-workload-summary'],
    queryFn: () => request('/teacher-workload/summary') as Promise<Record<string, any>>,
  });

  const teachersQuery = useQuery({
    queryKey: ['teacher-workload'],
    queryFn: () => request('/teacher-workload') as Promise<{ items: TeacherWorkload[]; total: number }>,
  });

  const teachers: TeacherWorkload[] = (teachersQuery.data as any)?.items ?? [];
  const summary = summaryQuery.data;

  return (
    <div className="orb-container">
      <div className="orb orb-cyan-1" />
      <div className="orb orb-indigo-1" />
      <div className="page-container space-y-4">
        <PageHeader
          title="Teacher Workload Intelligence"
          subtitle="Capacity vs. assigned hours, students per teacher, group counts"
        />

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <GlassStatCard label="Teachers" value={summary?.total ?? 0} />
          <GlassStatCard label="Overloaded" value={summary?.overloaded ?? 0} />
          <GlassStatCard label="Balanced" value={summary?.balanced ?? 0} />
          <GlassStatCard label="Underutilized" value={summary?.underutilized ?? 0} />
          <GlassStatCard label="Avg utilization" value={`${Math.round((summary?.avgUtilization ?? 0) * 100)}%`} />
        </div>

        <div className="glass-card p-4 space-y-2">
          <h3 className="font-semibold text-[var(--text-primary)]">Workload model (rule-based)</h3>
          <ul className="text-sm space-y-1.5 text-muted">
            <li>• <strong className="text-[var(--text-primary)]">Capacity</strong> — teacher.contractedHours per week from contract</li>
            <li>• <strong className="text-[var(--text-primary)]">Hours/week</strong> — Σ(group.schedule.slotMinutes) across all groups</li>
            <li>• <strong className="text-[var(--text-primary)]">Utilization</strong> — hoursPerWeek ÷ capacityHours (exact ratio)</li>
            <li>• <strong className="text-[var(--text-primary)]">Status thresholds</strong> — &lt;60% UNDERUTILIZED · 60–100% BALANCED · &gt;100% OVERLOADED</li>
          </ul>
        </div>

        <div className="glass-card overflow-hidden">
          {teachersQuery.isLoading ? (
            <div className="p-8"><PageLoader label="Loading workload…" /></div>
          ) : teachers.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="No teacher data"
                message="Add teachers and assign groups to see workload metrics."
              />
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {teachers.map((t) => (
                <li key={t.teacherId} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium text-sm text-[var(--text-primary)]">{t.teacherName}</h4>
                      <p className="text-xs text-muted mt-0.5">
                        {t.groupsCount} groups · {t.studentsCount} students · {t.hoursPerWeek}h / {t.capacityHours}h
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono">{Math.round(t.utilization * 100)}%</span>
                      <Badge color={STATUS_COLOR[t.status]}>{t.status}</Badge>
                    </div>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-[var(--bg-glass)] overflow-hidden">
                    <div
                      className={[
                        'h-full rounded-full',
                        t.utilization > 1 ? 'bg-red-500' :
                        t.utilization < 0.6 ? 'bg-amber-500' :
                        'bg-emerald-500',
                      ].join(' ')}
                      style={{ width: `${Math.min(100, t.utilization * 100)}%` }}
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
