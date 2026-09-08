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

interface RiskFactor {
  name: string;
  weight: number;
  score: number;
  evidence: string;
}

interface AcademicRisk {
  studentId: string;
  studentName: string;
  riskScore: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  factors: RiskFactor[];
  recommendation: string;
}

const LEVEL_COLOR: Record<AcademicRisk['level'], 'success' | 'warning' | 'error'> = {
  LOW: 'success',
  MEDIUM: 'warning',
  HIGH: 'error',
};

export function AcademicRiskPage() {
  usePageTitle('Academic Risk');

  const summaryQuery = useQuery({
    queryKey: ['academic-risk-summary'],
    queryFn: () => request('/academic-risk/summary') as Promise<Record<string, any>>,
  });

  const studentsQuery = useQuery({
    queryKey: ['academic-risk'],
    queryFn: () => request('/academic-risk') as Promise<{ items: AcademicRisk[]; total: number }>,
  });

  const students: AcademicRisk[] = (studentsQuery.data as any)?.items ?? [];
  const summary = summaryQuery.data;

  return (
    <div className="orb-container">
      <div className="orb orb-cyan-1" />
      <div className="orb orb-indigo-1" />
      <div className="page-container space-y-4">
        <PageHeader
          title="Academic Risk"
          subtitle="Rule-based risk score from grades, attendance, homework, behavior"
        />

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <GlassStatCard label="At risk" value={(summary?.high ?? 0) + (summary?.medium ?? 0)} />
          <GlassStatCard label="High" value={summary?.high ?? 0} />
          <GlassStatCard label="Medium" value={summary?.medium ?? 0} />
          <GlassStatCard label="Low" value={summary?.low ?? 0} />
          <GlassStatCard label="Avg score" value={summary?.avgScore ?? 0} />
        </div>

        <div className="glass-card p-4 space-y-2">
          <h3 className="font-semibold text-[var(--text-primary)]">Risk factors (deterministic weights)</h3>
          <ul className="text-sm space-y-1.5 text-muted">
            <li>• <strong className="text-[var(--text-primary)]">Grade trend</strong> — comparing last 3 grade entries to prior 3 (weight 30)</li>
            <li>• <strong className="text-[var(--text-primary)]">Attendance rate</strong> — present/(present+absent) over last 30 days (weight 25)</li>
            <li>• <strong className="text-[var(--text-primary)]">Homework completion</strong> — submitted/assigned in current month (weight 20)</li>
            <li>• <strong className="text-[var(--text-primary)]">Consecutive absences</strong> — exact run-length (weight 15)</li>
            <li>• <strong className="text-[var(--text-primary)]">Late submissions</strong> — count in last 30 days (weight 10)</li>
            <li>• <strong className="text-[var(--text-primary)]">Score formula</strong> — Σ(factor.score × factor.weight) ÷ Σ(weight); rule-based, no AI</li>
          </ul>
        </div>

        <div className="glass-card overflow-hidden">
          {studentsQuery.isLoading ? (
            <div className="p-8"><PageLoader label="Loading risk data…" /></div>
          ) : students.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="No students at risk"
                message="All students are within acceptable thresholds."
              />
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {students.map((s) => (
                <li key={s.studentId} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium text-sm text-[var(--text-primary)]">{s.studentName}</h4>
                      <p className="text-xs text-muted mt-0.5">{s.recommendation}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono">{s.riskScore}</span>
                      <Badge color={LEVEL_COLOR[s.level]}>{s.level}</Badge>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
                    {s.factors.map((f) => (
                      <div
                        key={f.name}
                        className="rounded-lg border border-[var(--border-subtle)] px-2 py-1.5 text-xs"
                      >
                        <div className="flex justify-between">
                          <span className="text-[var(--text-primary)] font-medium">{f.name}</span>
                          <span className="text-muted">w{f.weight}</span>
                        </div>
                        <div className="text-muted">{f.evidence}</div>
                      </div>
                    ))}
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
