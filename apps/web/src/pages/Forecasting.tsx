import { useQuery } from '@tanstack/react-query';
import { GlassPageHeader, GlassBadge, GlassPageLoader, GlassErrorState, GlassEmptyState, GlassStatCard } from '@/components/ui';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getErrorMessage } from '@/lib/errorMessages';
import { useI18n } from '@/i18n/I18nProvider';
import { forecastingApi } from '@/lib/api';

interface ForecastPoint {
  period: string; // YYYY-MM
  value: number;
  lowerBound: number;
  upperBound: number;
  method: 'MOVING_AVG' | 'LINEAR' | 'SEASONAL_NAIVE';
}

interface ForecastSeries {
  metric: string;
  description: string;
  history: ForecastPoint[];
  forecast: ForecastPoint[];
  confidence: number; // 0..1
}

interface ForecastSummary {
  series: number;
  projectedRevenue: number;
  projectedEnrollments: number;
}

interface ForecastListResponse {
  items: ForecastSeries[];
}

const METHOD_COLOR: Record<ForecastPoint['method'], 'muted' | 'primary' | 'success'> = {
  MOVING_AVG: 'muted',
  LINEAR: 'primary',
  SEASONAL_NAIVE: 'success',
};

export function ForecastingPage() {
  const { t } = useI18n();
  usePageTitle(t('forecasting.pageTitle'));

  const summaryQuery = useQuery({
    queryKey: ['forecast-summary'],
    queryFn: () => forecastingApi.summary() as Promise<ForecastSummary>,
  });

  const seriesQuery = useQuery({
    queryKey: ['forecast'],
    queryFn: () => forecastingApi.list() as Promise<ForecastListResponse>,
  });

  const series: ForecastSeries[] = seriesQuery.data?.items ?? [];
  const summary = summaryQuery.data;

  return (
    <div style={{ display: "contents" }}>
      <div className="orb orb-cyan-1" />
      <div className="orb orb-indigo-1" />
      <div className="page-container space-y-4">
        <GlassPageHeader
          title={t('forecasting.pageTitle')}
          subtitle={t('forecasting.subtitle')}
        />

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <GlassStatCard label={t('forecasting.seriesTracked')} value={summary?.series ?? 0} />
          <GlassStatCard
            label={t('forecasting.projectedRevenue')}
            value={`$${(summary?.projectedRevenue ?? 0).toLocaleString()}`}
          />
          <GlassStatCard
            label={t('forecasting.projectedEnrollments')}
            value={summary?.projectedEnrollments ?? 0}
          />
        </div>

        <div className="glass-card p-4 space-y-2">
          <h3 className="font-semibold text-[var(--text-primary)]">{t('forecasting.methodsTitle')}</h3>
          <ul className="text-sm space-y-1.5 text-muted">
            <li>• <strong className="text-[var(--text-primary)]">{t('forecasting.method.movingAvg')}</strong> — {t('forecasting.method.movingAvgDesc')}</li>
            <li>• <strong className="text-[var(--text-primary)]">{t('forecasting.method.linearTrend')}</strong> — {t('forecasting.method.linearTrendDesc')}</li>
            <li>• <strong className="text-[var(--text-primary)]">{t('forecasting.method.seasonalNaive')}</strong> — {t('forecasting.method.seasonalNaiveDesc')}</li>
            <li>• <strong className="text-[var(--text-primary)]">{t('forecasting.method.confidenceBands')}</strong> — {t('forecasting.method.confidenceBandsDesc')}</li>
            <li>• <strong className="text-[var(--text-primary)]">{t('forecasting.method.metrics')}</strong> — {t('forecasting.method.metricsDesc')}</li>
          </ul>
        </div>

        <div className="space-y-3">
          {seriesQuery.isLoading ? (
            <div className="glass-card p-8"><GlassPageLoader label={t('forecasting.loading')} /></div>
          ) : seriesQuery.isError ? (
            <div className="glass-card p-8">
              <GlassErrorState
                message={getErrorMessage(seriesQuery.error)}
                onRetry={() => seriesQuery.refetch()}
              />
            </div>
          ) : series.length === 0 ? (
            <div className="glass-card p-8">
              <GlassEmptyState
                title={t('forecasting.emptyTitle')}
                message={t('forecasting.emptyMessage')}
              />
            </div>
          ) : (
            series.map((s) => (
              <div key={s.metric} className="glass-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-[var(--text-primary)]">{s.metric}</h3>
                    <p className="text-xs text-muted">{s.description}</p>
                  </div>
                  <span className="text-xs text-muted">
                    {t('forecasting.confidence', { n: Math.round(s.confidence * 100) })}
                  </span>
                </div>
                <div className="flex items-end gap-1 h-32">
                  {[...s.history, ...s.forecast].map((p, i) => {
                    const all = [...s.history, ...s.forecast];
                    const max = Math.max(...all.map((x) => x.upperBound), 1);
                    const h = (p.value / max) * 100;
                    const isForecast = i >= s.history.length;
                    return (
                      <div
                        key={p.period}
                        className="flex-1 flex flex-col items-center gap-1 min-w-[8px]"
                        title={`${p.period}: ${p.value} (${p.lowerBound}–${p.upperBound})`}
                      >
                        <div
                          className={[
                            'w-full rounded-t',
                            isForecast ? 'bg-brand-500/60' : 'bg-emerald-500/60',
                          ].join(' ')}
                          style={{ height: `${h}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-1 text-[10px] text-muted">
                  {s.forecast.map((p) => (
                    <GlassBadge key={p.period} color={METHOD_COLOR[p.method]}>
                      {p.period} {p.value}
                    </GlassBadge>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
