import { useQuery } from '@tanstack/react-query';
import {
  PageHeader,
  Badge,
  PageLoader,
  ErrorState,
  EmptyState,
  GlassStatCard,
} from '@/components/ui';
import { usePageTitle } from '@/hooks/usePageTitle';
import request from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessages';
import { useI18n } from '@/i18n/I18nProvider';

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

const LEVEL_LABEL_KEY: Record<AcademicRisk['level'], string> = {
  LOW: 'anomaly.lowSeverity',
  MEDIUM: 'anomaly.mediumSeverity',
  HIGH: 'anomaly.highSeverity',
};

interface AcademicRiskSummary {
  high: number;
  medium: number;
  low: number;
  avgScore: number;
}

export function AcademicRiskPage() {
  const { t } = useI18n();
  usePageTitle(t('academicRisk.title'));

  const summaryQuery = useQuery({
    queryKey: ['academic-risk-summary'],
    queryFn: () => request('/academic-risk/summary') as Promise<AcademicRiskSummary>,
  });

  const studentsQuery = useQuery({
    queryKey: ['academic-risk'],
    queryFn: () => request('/academic-risk') as Promise<{ items: AcademicRisk[]; total: number }>,
  });

  const students: AcademicRisk[] = studentsQuery.data?.items ?? [];
  const summary = summaryQuery.data;

  return (
    <div style={{ display: "contents" }}>
      <div className="orb orb-cyan-1" />
      <div className="orb orb-indigo-1" />
      <div className="page-container space-y-4">
        <PageHeader
          title={t('academicRisk.title')}
          subtitle={t('academicRisk.subtitle')}
        />

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <GlassStatCard label={t('academicRisk.atRisk')} value={(summary?.high ?? 0) + (summary?.medium ?? 0)} />
          <GlassStatCard label={t('anomaly.highSeverity')} value={summary?.high ?? 0} />
          <GlassStatCard label={t('anomaly.mediumSeverity')} value={summary?.medium ?? 0} />
          <GlassStatCard label={t('anomaly.lowSeverity')} value={summary?.low ?? 0} />
          <GlassStatCard label={t('academicRisk.avgScore')} value={summary?.avgScore ?? 0} />
        </div>

        <div className="glass-card p-4 space-y-2">
          <h3 className="font-semibold text-[var(--text-primary)]">{t('academicRisk.factorsTitle')}</h3>
          <ul className="text-sm space-y-1.5 text-muted">
            <li>• <strong className="text-[var(--text-primary)]">{t('academicRisk.factor.gradeTrend')}</strong> — {t('academicRisk.factor.gradeTrendDesc')}</li>
            <li>• <strong className="text-[var(--text-primary)]">{t('academicRisk.factor.attendanceRate')}</strong> — {t('academicRisk.factor.attendanceRateDesc')}</li>
            <li>• <strong className="text-[var(--text-primary)]">{t('academicRisk.factor.homework')}</strong> — {t('academicRisk.factor.homeworkDesc')}</li>
            <li>• <strong className="text-[var(--text-primary)]">{t('academicRisk.factor.absences')}</strong> — {t('academicRisk.factor.absencesDesc')}</li>
            <li>• <strong className="text-[var(--text-primary)]">{t('academicRisk.factor.lateSubmissions')}</strong> — {t('academicRisk.factor.lateSubmissionsDesc')}</li>
            <li>• <strong className="text-[var(--text-primary)]">{t('academicRisk.factor.scoreFormula')}</strong> — {t('academicRisk.factor.scoreFormulaDesc')}</li>
          </ul>
        </div>

        <div className="glass-card overflow-hidden">
          {studentsQuery.isLoading ? (
            <div className="p-8"><PageLoader label={t('academicRisk.loading')} /></div>
          ) : studentsQuery.isError ? (
            <div className="p-8">
              <ErrorState
                message={getErrorMessage(studentsQuery.error)}
                onRetry={() => studentsQuery.refetch()}
              />
            </div>
          ) : students.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title={t('academicRisk.emptyTitle')}
                message={t('academicRisk.emptyMessage')}
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
                      <Badge color={LEVEL_COLOR[s.level]}>{t(LEVEL_LABEL_KEY[s.level])}</Badge>
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
