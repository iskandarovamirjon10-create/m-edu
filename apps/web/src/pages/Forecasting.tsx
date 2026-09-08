import { useQuery } from '@tanstack/react-query';
import {
  PageHeader,
  Badge,
  PageLoader,
  EmptyState,
  GlassStatCard,
} from '@/components/ui';
import { usePageTitle } from '@/hooks/usePageTitle';

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

const METHOD_COLOR: Record<ForecastPoint['method'], 'muted' | 'primary' | 'success'> = {
  MOVING_AVG: 'muted',
  LINEAR: 'primary',
  SEASONAL_NAIVE: 'success',
};

export function ForecastingPage() {
  usePageTitle('Forecasting');

  // NOTE: the backend controller is mounted at /api/forecasting (not /forecast).
  // The previous URLs hit a non-existent route, so this page always showed zeros.
  const summaryQuery = useQuery({
    queryKey: ['forecast-summary'],
    queryFn: async () => {
      const res = await fetch('/api/forecasting/summary');
      if (!res.ok) return { series: 0, projectedRevenue: 0, projectedEnrollments: 0 };
      return res.json();
    },
  });

  const seriesQuery = useQuery({
    queryKey: ['forecast'],
    queryFn: async () => {
      const res = await fetch('/api/forecasting');
      if (!res.ok) return { items: [] as ForecastSeries[] };
      return res.json();
    },
  });

  const series: ForecastSeries[] = (seriesQuery.data as any)?.items ?? [];
  const summary = summaryQuery.data;

  return (
    <div className="orb-container">
      <div className="orb orb-cyan-1" />
      <div className="orb orb-indigo-1" />
      <div className="page-container space-y-4">
        <PageHeader
          title="Forecasting"
          subtitle="Deterministic statistical projections — moving average, linear trend, seasonal naive"
        />

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <GlassStatCard label="Series tracked" value={summary?.series ?? 0} />
          <GlassStatCard
            label="Projected revenue (next period)"
            value={`$${(summary?.projectedRevenue ?? 0).toLocaleString()}`}
          />
          <GlassStatCard
            label="Projected enrollments (next period)"
            value={summary?.projectedEnrollments ?? 0}
          />
        </div>

        <div className="glass-card p-4 space-y-2">
          <h3 className="font-semibold text-[var(--text-primary)]">Methods (no AI, no ML)</h3>
          <ul className="text-sm space-y-1.5 text-muted">
            <li>• <strong className="text-[var(--text-primary)]">Moving average</strong> — arithmetic mean of last N periods (N=3 default)</li>
            <li>• <strong className="text-[var(--text-primary)]">Linear trend</strong> — least-squares fit over the full history, no extrapolation beyond ±25%</li>
            <li>• <strong className="text-[var(--text-primary)]">Seasonal naive</strong> — repeat last year's same period (for monthly metrics with ≥12 months of history)</li>
            <li>• <strong className="text-[var(--text-primary)]">Confidence bands</strong> — empirical std-dev of historical residuals (no neural network, no probabilistic model)</li>
            <li>• <strong className="text-[var(--text-primary)]">Metrics</strong> — revenue, enrollments, attendance, lead conversion, churn</li>
          </ul>
        </div>

        <div className="space-y-3">
          {seriesQuery.isLoading ? (
            <div className="glass-card p-8"><PageLoader label="Loading forecasts…" /></div>
          ) : series.length === 0 ? (
            <div className="glass-card p-8">
              <EmptyState
                title="No forecast data"
                message="At least 3 months of history is required to project a metric."
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
                    Confidence {Math.round(s.confidence * 100)}%
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
                    <Badge key={p.period} color={METHOD_COLOR[p.method]}>
                      {p.period} {p.value}
                    </Badge>
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
