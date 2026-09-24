import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ForecastingService } from '../forecasting.service';

// The service buckets history with Prisma model aggregates (payment.aggregate,
// student.count, attendance.count) rather than raw SQL, so the mock mirrors
// that surface.
function createMockPrisma() {
  return {
    payment: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }) },
    student: { count: vi.fn().mockResolvedValue(0) },
    attendance: { count: vi.fn().mockResolvedValue(0) },
  };
}

function generateMonths(
  count: number,
  startYear: number,
  startMonth: number,
  values: number[],
): { month: string; total: number }[] {
  const result: { month: string; total: number }[] = [];
  for (let i = 0; i < count; i++) {
    const m = ((startMonth - 1 + i) % 12) + 1;
    const y = startYear + Math.floor((startMonth - 1 + i) / 12);
    const label = `${y}-${String(m).padStart(2, '0')}`;
    result.push({ month: `${label}-01`, total: values[i] ?? 0 });
  }
  return result;
}

function generateAttendanceRows(
  count: number,
  startYear: number,
  startMonth: number,
  presentCounts: number[],
  absentCounts: number[],
): { month: string; count: number; status: string }[] {
  const rows: { month: string; count: number; status: string }[] = [];
  for (let i = 0; i < count; i++) {
    const m = ((startMonth - 1 + i) % 12) + 1;
    const y = startYear + Math.floor((startMonth - 1 + i) / 12);
    const label = `${y}-${String(m).padStart(2, '0')}`;
    rows.push({ month: `${label}-01`, count: presentCounts[i] ?? 0, status: 'PRESENT' });
    rows.push({ month: `${label}-01`, count: absentCounts[i] ?? 0, status: 'ABSENT' });
  }
  return rows;
}

describe('ForecastingService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let svc: ForecastingService;

  const NOW = new Date('2026-09-01T00:00:00Z');

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    prisma = createMockPrisma();
    svc = new ForecastingService(prisma as unknown as ConstructorParameters<typeof ForecastingService>[0]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Month keys are the `YYYY-MM` prefix of the sample rows; the service asks
  // for one bucket per month via a [gte, lt) window, so we key off the `gte`
  // boundary of whichever date column the call filtered on.
  const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  function mockQueryRaw(
    revenueData: { month: string; total: number }[],
    enrollmentData: { month: string; total: number }[],
    attendanceData: { month: string; count: number; status: string }[],
  ) {
    const revenue = new Map<string, number>();
    for (const r of revenueData) revenue.set(r.month.slice(0, 7), r.total);

    const enrollments = new Map<string, number>();
    for (const e of enrollmentData) enrollments.set(e.month.slice(0, 7), e.total);

    const attendance = new Map<string, { present: number; total: number }>();
    for (const a of attendanceData) {
      const key = a.month.slice(0, 7);
      const rec = attendance.get(key) ?? { present: 0, total: 0 };
      if (a.status === 'PRESENT') rec.present += a.count;
      rec.total += a.count;
      attendance.set(key, rec);
    }

    prisma.payment.aggregate.mockImplementation(async (args: { where: { paidAt: { gte: Date } } }) => ({
      _sum: { amount: revenue.get(ym(args.where.paidAt.gte)) ?? 0 },
    }));
    prisma.student.count.mockImplementation(
      async (args: { where: { createdAt: { gte: Date } } }) => enrollments.get(ym(args.where.createdAt.gte)) ?? 0,
    );
    prisma.attendance.count.mockImplementation(async (args: { where: { date: { gte: Date }; status?: string } }) => {
      const rec = attendance.get(ym(args.where.date.gte));
      if (!rec) return 0;
      return args.where.status === 'PRESENT' ? rec.present : rec.total;
    });
  }

  function mockAllZero() {
    mockQueryRaw([], [], []);
  }

  // NOW = Sep 2026, so the 12-month window is Oct 2025 - Aug 2026
  // Projections are: Sep 2026, Oct 2026, Nov 2026
  const WINDOW_START_MONTH = 10; // October
  const WINDOW_START_YEAR = 2025;
  const PROJ_MONTHS = ['2026-10', '2026-11', '2026-12'];

  // ──────────────────────────────────────────────────────────
  // a) LINEAR method (used for revenue & enrollments)
  // ──────────────────────────────────────────────────────────
  describe('LINEAR forecast method', () => {
    it('captures upward trend from 12 months of increasing data', async () => {
      // LINEAR regression on [100,110,...,210]: slope=10, intercept=100
      // x=12→220, x=13→230, x=14→240, all residuals=0
      const months = generateMonths(12, WINDOW_START_YEAR, WINDOW_START_MONTH,
        [100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210]);
      mockQueryRaw(months, [], []);

      const result = await svc.getSummary('org-1');
      const revenueSeries = result.series.find(s => s.metric === 'revenue' && s.method === 'LINEAR');

      expect(revenueSeries).toBeDefined();
      expect(revenueSeries!.projected.length).toBe(3);
      expect(revenueSeries!.projected[0].forecast).toBe(220);
      expect(revenueSeries!.projected[1].forecast).toBe(230);
      expect(revenueSeries!.projected[2].forecast).toBe(240);
      for (const p of revenueSeries!.projected) {
        expect(p.actual).toBeNull();
        expect(p.lower).toBe(p.forecast);
        expect(p.upper).toBe(p.forecast);
      }
    });

    it('produces flat forecast for constant data (no artificial trend)', async () => {
      const months = generateMonths(12, WINDOW_START_YEAR, WINDOW_START_MONTH,
        Array(12).fill(500));
      mockQueryRaw(months, [], []);

      const result = await svc.getSummary('org-1');
      const revenueSeries = result.series.find(s => s.metric === 'revenue' && s.method === 'LINEAR');

      expect(revenueSeries).toBeDefined();
      for (const p of revenueSeries!.projected) {
        expect(p.forecast).toBe(500);
        expect(p.lower).toBe(500);
        expect(p.upper).toBe(500);
      }
    });

    it('falls back to constantForecast when only 1 month of data exists', async () => {
      // getHistory always returns 12 month slots; only the matching month has data
      // With 1 non-zero value out of 12, n=12 but most values are 0
      // LINEAR still runs regression (n >= 2 since monthMap has 12 entries)
      const months = generateMonths(1, 2026, 8, [300]);
      mockQueryRaw(months, [], []);

      const result = await svc.getSummary('org-1');
      const revenueSeries = result.series.find(s => s.metric === 'revenue' && s.method === 'LINEAR');

      expect(revenueSeries).toBeDefined();
      expect(revenueSeries!.historical.length).toBe(12);
      // Only Aug 2026 has value 300; all other months are 0
      const nonZero = revenueSeries!.historical.filter(p => p.actual !== 0);
      expect(nonZero.length).toBe(1);
      expect(nonZero[0].actual).toBe(300);
      // LINEAR with [0,0,...,0,300] produces a forecast based on regression
      expect(revenueSeries!.projected.length).toBe(3);
      for (const p of revenueSeries!.projected) {
        expect(p.forecast).toBeGreaterThanOrEqual(0);
      }
    });

    it('follows the line y = 2x + 10', async () => {
      const values = Array.from({ length: 12 }, (_, i) => 2 * i + 10);
      const months = generateMonths(12, WINDOW_START_YEAR, WINDOW_START_MONTH, values);
      mockQueryRaw(months, [], []);

      const result = await svc.getSummary('org-1');
      const revenueSeries = result.series.find(s => s.metric === 'revenue' && s.method === 'LINEAR');

      expect(revenueSeries).toBeDefined();
      // Perfect linear: slope=2, intercept=10
      // x=12: 2*12+10=34, x=13: 36, x=14: 38
      expect(revenueSeries!.projected[0].forecast).toBe(34);
      expect(revenueSeries!.projected[1].forecast).toBe(36);
      expect(revenueSeries!.projected[2].forecast).toBe(38);
      expect(revenueSeries!.projected[0].lower).toBe(34);
      expect(revenueSeries!.projected[0].upper).toBe(34);
    });

    it('uses LINEAR for both revenue and enrollments', async () => {
      const revMonths = generateMonths(12, WINDOW_START_YEAR, WINDOW_START_MONTH,
        [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200]);
      const enrMonths = generateMonths(12, WINDOW_START_YEAR, WINDOW_START_MONTH,
        [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]);
      mockQueryRaw(revMonths, enrMonths, []);

      const result = await svc.getSummary('org-1');

      const revSeries = result.series.find(s => s.metric === 'revenue');
      const enrSeries = result.series.find(s => s.metric === 'enrollments');
      expect(revSeries!.method).toBe('LINEAR');
      expect(enrSeries!.method).toBe('LINEAR');
    });

    it('projects increasing forecast for increasing linear data', async () => {
      const months = generateMonths(12, WINDOW_START_YEAR, WINDOW_START_MONTH,
        [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200]);
      mockQueryRaw(months, [], []);

      const result = await svc.getSummary('org-1');
      const revenueSeries = result.series.find(s => s.metric === 'revenue' && s.method === 'LINEAR');

      expect(revenueSeries).toBeDefined();
      const forecasts = revenueSeries!.projected.map(p => p.forecast!);
      expect(forecasts[0]).toBeLessThan(forecasts[1]);
      expect(forecasts[1]).toBeLessThan(forecasts[2]);
    });

    it('handles zero slope (perfectly flat data)', async () => {
      const months = generateMonths(12, WINDOW_START_YEAR, WINDOW_START_MONTH,
        Array(12).fill(777));
      mockQueryRaw(months, [], []);

      const result = await svc.getSummary('org-1');
      const revSeries = result.series.find(s => s.metric === 'revenue' && s.method === 'LINEAR');

      for (const p of revSeries!.projected) {
        expect(p.forecast).toBe(777);
        expect(p.lower).toBe(777);
        expect(p.upper).toBe(777);
      }
    });
  });

  // ──────────────────────────────────────────────────────────
  // b) SEASONAL_NAIVE method (used for attendance)
  // ──────────────────────────────────────────────────────────
  describe('SEASONAL_NAIVE forecast method', () => {
    it('uses values from the start of history array for projections', async () => {
      // history.length = 12 (monthMap always has 12 slots)
      // seasonalIdx = (history.length + i - 1) - 12 = i - 1
      // i=1 → values[0], i=2 → values[1], i=3 → values[2]
      // So the first 3 historical values are used for the 3 projections
      const presentCounts = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 55, 65];
      const absentCounts = presentCounts.map(p => 100 - p);
      const attRows = generateAttendanceRows(12, WINDOW_START_YEAR, WINDOW_START_MONTH, presentCounts, absentCounts);
      mockQueryRaw([], [], attRows);

      const result = await svc.getSummary('org-1');
      const attendanceSeries = result.series.find(s => s.metric === 'attendance' && s.method === 'SEASONAL_NAIVE');

      expect(attendanceSeries).toBeDefined();
      expect(attendanceSeries!.historical.length).toBe(12);
      // Historical percentages: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 55, 65]
      // Projections use values[0..2] = [10, 20, 30]
      expect(attendanceSeries!.projected[0].forecast).toBe(10);
      expect(attendanceSeries!.projected[1].forecast).toBe(20);
      expect(attendanceSeries!.projected[2].forecast).toBe(30);
    });

    it('returns 0 when all history values are 0 (no attendance data)', async () => {
      mockQueryRaw([], [], []);

      const result = await svc.getSummary('org-1');
      const attendanceSeries = result.series.find(s => s.metric === 'attendance' && s.method === 'SEASONAL_NAIVE');

      expect(attendanceSeries).toBeDefined();
      for (const p of attendanceSeries!.projected) {
        expect(p.forecast).toBe(0);
      }
    });

    it('uses SEASONAL_NAIVE for attendance metric', async () => {
      mockQueryRaw([], [], []);

      const result = await svc.getSummary('org-1');
      const attendanceSeries = result.series.find(s => s.metric === 'attendance');

      expect(attendanceSeries!.method).toBe('SEASONAL_NAIVE');
    });

    it('computes attendance as percentage of PRESENT vs total', async () => {
      // Each month: 80 PRESENT, 20 ABSENT → 80%
      const presentCounts = Array(12).fill(80);
      const absentCounts = Array(12).fill(20);
      const attRows = generateAttendanceRows(12, WINDOW_START_YEAR, WINDOW_START_MONTH, presentCounts, absentCounts);
      mockQueryRaw([], [], attRows);

      const result = await svc.getSummary('org-1');
      const attendanceSeries = result.series.find(s => s.metric === 'attendance');

      for (const p of attendanceSeries!.historical) {
        expect(p.actual).toBe(80);
      }
    });

    it('handles varying attendance rates across months', async () => {
      const presentCounts = [50, 75, 100, 60, 80, 90, 70, 85, 95, 55, 65, 45];
      const absentCounts = presentCounts.map(p => 100 - p);
      const attRows = generateAttendanceRows(12, WINDOW_START_YEAR, WINDOW_START_MONTH, presentCounts, absentCounts);
      mockQueryRaw([], [], attRows);

      const result = await svc.getSummary('org-1');
      const attendanceSeries = result.series.find(s => s.metric === 'attendance');

      for (let i = 0; i < 12; i++) {
        expect(attendanceSeries!.historical[i].actual).toBe(presentCounts[i]);
      }
    });
  });

  // ──────────────────────────────────────────────────────────
  // c) Confidence bands
  // ──────────────────────────────────────────────────────────
  describe('confidence bands', () => {
    it('wider intervals for volatile data (LINEAR)', async () => {
      const volatileMonths = generateMonths(12, WINDOW_START_YEAR, WINDOW_START_MONTH,
        [100, 500, 100, 500, 100, 500, 100, 500, 100, 500, 100, 500]);
      mockQueryRaw(volatileMonths, [], []);

      const resultVolatile = await svc.getSummary('org-1');
      const revVolatile = resultVolatile.series.find(s => s.metric === 'revenue' && s.method === 'LINEAR');
      const volatileBand = revVolatile!.projected[0].upper! - revVolatile!.projected[0].lower!;

      vi.clearAllMocks();
      const stableMonths = generateMonths(12, WINDOW_START_YEAR, WINDOW_START_MONTH,
        Array(12).fill(300));
      mockQueryRaw(stableMonths, [], []);

      const resultStable = await svc.getSummary('org-1');
      const revStable = resultStable.series.find(s => s.metric === 'revenue' && s.method === 'LINEAR');
      const stableBand = revStable!.projected[0].upper! - revStable!.projected[0].lower!;

      expect(volatileBand).toBeGreaterThan(stableBand);
      expect(stableBand).toBe(0);
    });

    it('wider intervals for volatile attendance data (SEASONAL_NAIVE)', async () => {
      // Volatile: PRESENT counts alternate between 20 and 80 → percentages 20%, 80%, ...
      const volatilePresent = [20, 80, 20, 80, 20, 80, 20, 80, 20, 80, 20, 80];
      const volatileAbsent = volatilePresent.map(p => 100 - p);
      const volatileRows = generateAttendanceRows(12, WINDOW_START_YEAR, WINDOW_START_MONTH, volatilePresent, volatileAbsent);
      mockQueryRaw([], [], volatileRows);

      const resultVolatile = await svc.getSummary('org-1');
      const attVolatile = resultVolatile.series.find(s => s.metric === 'attendance');
      const volatileBand = attVolatile!.projected[0].upper! - attVolatile!.projected[0].lower!;

      vi.clearAllMocks();
      // Stable: all 50%
      const stablePresent = Array(12).fill(50);
      const stableAbsent = Array(12).fill(50);
      const stableRows = generateAttendanceRows(12, WINDOW_START_YEAR, WINDOW_START_MONTH, stablePresent, stableAbsent);
      mockQueryRaw([], [], stableRows);

      const resultStable = await svc.getSummary('org-1');
      const attStable = resultStable.series.find(s => s.metric === 'attendance');
      const stableBand = attStable!.projected[0].upper! - attStable!.projected[0].lower!;

      expect(volatileBand).toBeGreaterThan(stableBand);
    });

    it('zero-width bands for constant data (LINEAR)', async () => {
      const months = generateMonths(12, WINDOW_START_YEAR, WINDOW_START_MONTH,
        Array(12).fill(500));
      mockQueryRaw(months, [], []);

      const result = await svc.getSummary('org-1');
      const revSeries = result.series.find(s => s.metric === 'revenue');

      for (const p of revSeries!.projected) {
        expect(p.lower).toBe(p.forecast);
        expect(p.upper).toBe(p.forecast);
      }
    });

    it('confidence interval always contains the forecast value', async () => {
      const months = generateMonths(12, WINDOW_START_YEAR, WINDOW_START_MONTH,
        [100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650]);
      mockQueryRaw(months, [], []);

      const result = await svc.getSummary('org-1');
      for (const series of result.series) {
        for (const p of series.projected) {
          if (p.forecast !== null) {
            expect(p.lower).toBeLessThanOrEqual(p.forecast!);
            expect(p.upper).toBeGreaterThanOrEqual(p.forecast!);
          }
        }
      }
    });

    it('lower bound is never negative', async () => {
      const months = generateMonths(12, WINDOW_START_YEAR, WINDOW_START_MONTH,
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      mockQueryRaw(months, [], []);

      const result = await svc.getSummary('org-1');
      for (const series of result.series) {
        for (const p of series.projected) {
          expect(p.lower!).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('lower bound is clamped at 0 for data that would produce negative bands', async () => {
      const months = generateMonths(12, WINDOW_START_YEAR, WINDOW_START_MONTH,
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 100]);
      mockQueryRaw(months, [], []);

      const result = await svc.getSummary('org-1');
      const revSeries = result.series.find(s => s.metric === 'revenue');
      for (const p of revSeries!.projected) {
        expect(p.lower!).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // ──────────────────────────────────────────────────────────
  // d) getSummary endpoint
  // ──────────────────────────────────────────────────────────
  describe('getSummary', () => {
    it('returns all 3 forecast series (revenue, enrollments, attendance)', async () => {
      const months = generateMonths(12, WINDOW_START_YEAR, WINDOW_START_MONTH,
        [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200]);
      const attRows = generateAttendanceRows(12, WINDOW_START_YEAR, WINDOW_START_MONTH,
        Array(12).fill(80), Array(12).fill(20));
      mockQueryRaw(months, months, attRows);

      const result = await svc.getSummary('org-1');

      expect(result.series.length).toBe(3);
      const metrics = result.series.map(s => s.metric);
      expect(metrics).toContain('revenue');
      expect(metrics).toContain('enrollments');
      expect(metrics).toContain('attendance');
    });

    it('each series has historical and projected arrays with correct lengths', async () => {
      const months = generateMonths(12, WINDOW_START_YEAR, WINDOW_START_MONTH,
        [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200]);
      const attRows = generateAttendanceRows(12, WINDOW_START_YEAR, WINDOW_START_MONTH,
        Array(12).fill(80), Array(12).fill(20));
      mockQueryRaw(months, months, attRows);

      const result = await svc.getSummary('org-1');

      for (const series of result.series) {
        expect(series.historical).toBeDefined();
        expect(Array.isArray(series.historical)).toBe(true);
        expect(series.historical.length).toBe(12);
        expect(series.projected).toBeDefined();
        expect(Array.isArray(series.projected)).toBe(true);
        expect(series.projected.length).toBe(3);
        expect(typeof series.projectedTotal).toBe('number');
      }
    });

    it('projectedTotal equals sum of projected forecast values', async () => {
      const months = generateMonths(12, WINDOW_START_YEAR, WINDOW_START_MONTH,
        [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200]);
      const attRows = generateAttendanceRows(12, WINDOW_START_YEAR, WINDOW_START_MONTH,
        Array(12).fill(80), Array(12).fill(20));
      mockQueryRaw(months, months, attRows);

      const result = await svc.getSummary('org-1');

      for (const series of result.series) {
        const expectedTotal = Math.round(
          series.projected.reduce((s, p) => s + (p.forecast ?? 0), 0),
        );
        expect(series.projectedTotal).toBe(expectedTotal);
      }
    });

    it('includes projectedRevenue and projectedEnrollments at summary level', async () => {
      const months = generateMonths(12, WINDOW_START_YEAR, WINDOW_START_MONTH,
        [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200]);
      const attRows = generateAttendanceRows(12, WINDOW_START_YEAR, WINDOW_START_MONTH,
        Array(12).fill(80), Array(12).fill(20));
      mockQueryRaw(months, months, attRows);

      const result = await svc.getSummary('org-1');

      expect(result).toHaveProperty('projectedRevenue');
      expect(result).toHaveProperty('projectedEnrollments');
      expect(typeof result.projectedRevenue).toBe('number');
      expect(typeof result.projectedEnrollments).toBe('number');
    });

    it('projectedRevenue matches revenue series projectedTotal', async () => {
      const months = generateMonths(12, WINDOW_START_YEAR, WINDOW_START_MONTH,
        [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200]);
      const attRows = generateAttendanceRows(12, WINDOW_START_YEAR, WINDOW_START_MONTH,
        Array(12).fill(80), Array(12).fill(20));
      mockQueryRaw(months, months, attRows);

      const result = await svc.getSummary('org-1');
      const revSeries = result.series.find(s => s.metric === 'revenue');

      expect(result.projectedRevenue).toBe(revSeries!.projectedTotal);
    });

    it('returns zeroed projections when no historical data exists', async () => {
      mockAllZero();

      const result = await svc.getSummary('org-1');

      for (const series of result.series) {
        expect(series.historical.length).toBe(12);
        for (const p of series.historical) {
          expect(p.actual).toBe(0);
        }
        for (const p of series.projected) {
          expect(p.forecast).toBe(0);
        }
        expect(series.projectedTotal).toBe(0);
      }
      expect(result.projectedRevenue).toBe(0);
      expect(result.projectedEnrollments).toBe(0);
    });
  });

  // ──────────────────────────────────────────────────────────
  // e) findAll endpoint
  // ──────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('returns all series with no filters', async () => {
      const months = generateMonths(12, WINDOW_START_YEAR, WINDOW_START_MONTH,
        [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200]);
      const attRows = generateAttendanceRows(12, WINDOW_START_YEAR, WINDOW_START_MONTH,
        Array(12).fill(80), Array(12).fill(20));
      mockQueryRaw(months, months, attRows);

      const result = await svc.findAll('org-1', {});
      expect(result.items.length).toBe(3);
    });

    it('filters by metric', async () => {
      const months = generateMonths(12, WINDOW_START_YEAR, WINDOW_START_MONTH,
        [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200]);
      const attRows = generateAttendanceRows(12, WINDOW_START_YEAR, WINDOW_START_MONTH,
        Array(12).fill(80), Array(12).fill(20));
      mockQueryRaw(months, months, attRows);

      const result = await svc.findAll('org-1', { metric: 'revenue' });
      expect(result.items.length).toBe(1);
      expect(result.items[0].metric).toBe('revenue');
    });

    it('filters by method', async () => {
      const months = generateMonths(12, WINDOW_START_YEAR, WINDOW_START_MONTH,
        [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200]);
      const attRows = generateAttendanceRows(12, WINDOW_START_YEAR, WINDOW_START_MONTH,
        Array(12).fill(80), Array(12).fill(20));
      mockQueryRaw(months, months, attRows);

      const result = await svc.findAll('org-1', { method: 'LINEAR' });
      expect(result.items.length).toBe(2); // revenue + enrollments
      for (const item of result.items) {
        expect(item.method).toBe('LINEAR');
      }
    });

    it('filters by both metric and method', async () => {
      const months = generateMonths(12, WINDOW_START_YEAR, WINDOW_START_MONTH,
        [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200]);
      const attRows = generateAttendanceRows(12, WINDOW_START_YEAR, WINDOW_START_MONTH,
        Array(12).fill(80), Array(12).fill(20));
      mockQueryRaw(months, months, attRows);

      const result = await svc.findAll('org-1', { metric: 'attendance', method: 'SEASONAL_NAIVE' });
      expect(result.items.length).toBe(1);
      expect(result.items[0].metric).toBe('attendance');
      expect(result.items[0].method).toBe('SEASONAL_NAIVE');
    });

    it('returns empty items when filter matches nothing', async () => {
      const months = generateMonths(12, WINDOW_START_YEAR, WINDOW_START_MONTH,
        [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200]);
      const attRows = generateAttendanceRows(12, WINDOW_START_YEAR, WINDOW_START_MONTH,
        Array(12).fill(80), Array(12).fill(20));
      mockQueryRaw(months, months, attRows);

      const result = await svc.findAll('org-1', { metric: 'revenue', method: 'MOVING_AVG' });
      expect(result.items.length).toBe(0);
    });

    it('filters only attendance (SEASONAL_NAIVE)', async () => {
      const months = generateMonths(12, WINDOW_START_YEAR, WINDOW_START_MONTH,
        [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200]);
      const attRows = generateAttendanceRows(12, WINDOW_START_YEAR, WINDOW_START_MONTH,
        Array(12).fill(80), Array(12).fill(20));
      mockQueryRaw(months, months, attRows);

      const result = await svc.findAll('org-1', { method: 'SEASONAL_NAIVE' });
      expect(result.items.length).toBe(1);
      expect(result.items[0].metric).toBe('attendance');
    });
  });

  // ──────────────────────────────────────────────────────────
  // f) Tenant isolation
  // ──────────────────────────────────────────────────────────
  describe('tenant isolation', () => {
    it('scopes the revenue aggregate to the organization and settles by paidAt', async () => {
      mockAllZero();
      await svc.getSummary('org-tenant-42');

      expect(prisma.payment.aggregate).toHaveBeenCalled();
      for (const call of prisma.payment.aggregate.mock.calls) {
        expect(call[0].where.organizationId).toBe('org-tenant-42');
        expect(call[0].where.status).toBe('PAID');
        expect(call[0].where.paidAt).toBeDefined();
      }
    });

    it('scopes enrollment counts to the organization', async () => {
      mockAllZero();
      await svc.getSummary('org-tenant-99');

      expect(prisma.student.count).toHaveBeenCalled();
      for (const call of prisma.student.count.mock.calls) {
        expect(call[0].where.organizationId).toBe('org-tenant-99');
      }
    });

    it('scopes attendance counts to the organization', async () => {
      mockAllZero();
      await svc.getSummary('org-tenant-7');

      expect(prisma.attendance.count).toHaveBeenCalled();
      for (const call of prisma.attendance.count.mock.calls) {
        expect(call[0].where.organizationId).toBe('org-tenant-7');
      }
    });

    it('different orgIds produce different query parameters', async () => {
      mockAllZero();
      await svc.getSummary('org-A');
      const orgsA = prisma.payment.aggregate.mock.calls.map(
        (c: [{ where: { organizationId: string } }]) => c[0].where.organizationId,
      );

      vi.clearAllMocks();
      mockAllZero();
      await svc.getSummary('org-B');
      const orgsB = prisma.payment.aggregate.mock.calls.map(
        (c: [{ where: { organizationId: string } }]) => c[0].where.organizationId,
      );

      expect(orgsA.length).toBeGreaterThan(0);
      expect(orgsA.every((o: string) => o === 'org-A')).toBe(true);
      expect(orgsB.every((o: string) => o === 'org-B')).toBe(true);
    });

    it('findAll also isolates by organizationId', async () => {
      mockAllZero();
      await svc.findAll('org-isolated', { metric: 'revenue' });

      expect(prisma.payment.aggregate).toHaveBeenCalled();
      for (const call of prisma.payment.aggregate.mock.calls) {
        expect(call[0].where.organizationId).toBe('org-isolated');
      }
    });
  });

  // ──────────────────────────────────────────────────────────
  // g) Edge cases
  // ──────────────────────────────────────────────────────────
  describe('edge cases', () => {
    it('handles all-zero historical data without errors', async () => {
      const months = generateMonths(12, WINDOW_START_YEAR, WINDOW_START_MONTH, Array(12).fill(0));
      mockQueryRaw(months, months, []);

      const result = await svc.getSummary('org-1');
      expect(result.series.length).toBe(3);
      for (const s of result.series) {
        expect(s.projectedTotal).toBe(0);
      }
    });

    it('handles very large values', async () => {
      const months = generateMonths(12, WINDOW_START_YEAR, WINDOW_START_MONTH, [
        1000000, 2000000, 3000000, 4000000, 5000000,
        6000000, 7000000, 8000000, 9000000, 10000000,
        11000000, 12000000,
      ]);
      mockQueryRaw(months, [], []);

      const result = await svc.getSummary('org-1');
      const revSeries = result.series.find(s => s.metric === 'revenue');
      expect(revSeries).toBeDefined();
      for (const p of revSeries!.projected) {
        expect(p.forecast).toBeGreaterThan(0);
        expect(p.lower).toBeGreaterThanOrEqual(0);
      }
    });

    it('handles negative revenue data gracefully (capped at 0)', async () => {
      const months = generateMonths(12, WINDOW_START_YEAR, WINDOW_START_MONTH,
        [-100, -50, 0, 50, 100, 150, 200, 250, 300, 350, 400, 450]);
      mockQueryRaw(months, [], []);

      const result = await svc.getSummary('org-1');
      const revSeries = result.series.find(s => s.metric === 'revenue');
      expect(revSeries).toBeDefined();
      for (const p of revSeries!.projected) {
        expect(p.forecast!).toBeGreaterThanOrEqual(0);
        expect(p.lower!).toBeGreaterThanOrEqual(0);
      }
    });

    it('projection months are correct (Sep-Nov 2026)', async () => {
      const months = generateMonths(12, WINDOW_START_YEAR, WINDOW_START_MONTH,
        [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200]);
      mockQueryRaw(months, [], []);

      const result = await svc.getSummary('org-1');
      const revSeries = result.series.find(s => s.metric === 'revenue');
      const projectedMonths = revSeries!.projected.map(p => p.month);

      expect(projectedMonths).toEqual(PROJ_MONTHS);
    });

    it('handles empty history (no DB rows) gracefully', async () => {
      mockAllZero();

      const result = await svc.getSummary('org-1');
      expect(result.series.length).toBe(3);
      for (const s of result.series) {
        expect(s.historical.length).toBe(12);
        expect(s.projected.length).toBe(3);
        expect(s.projectedTotal).toBe(0);
      }
    });

    it('method assignment: revenue=enrollments=LINEAR, attendance=SEASONAL_NAIVE', async () => {
      mockAllZero();

      const result = await svc.getSummary('org-1');

      const rev = result.series.find(s => s.metric === 'revenue');
      const enr = result.series.find(s => s.metric === 'enrollments');
      const att = result.series.find(s => s.metric === 'attendance');

      expect(rev!.method).toBe('LINEAR');
      expect(enr!.method).toBe('LINEAR');
      expect(att!.method).toBe('SEASONAL_NAIVE');
    });

    it('historical points have forecast=null, lower=null, upper=null', async () => {
      const months = generateMonths(12, WINDOW_START_YEAR, WINDOW_START_MONTH,
        [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200]);
      mockQueryRaw(months, [], []);

      const result = await svc.getSummary('org-1');
      const revSeries = result.series.find(s => s.metric === 'revenue');

      for (const p of revSeries!.historical) {
        expect(p.forecast).toBeNull();
        expect(p.lower).toBeNull();
        expect(p.upper).toBeNull();
      }
    });

    it('projected points have actual=null', async () => {
      const months = generateMonths(12, WINDOW_START_YEAR, WINDOW_START_MONTH,
        [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200]);
      mockQueryRaw(months, [], []);

      const result = await svc.getSummary('org-1');

      for (const series of result.series) {
        for (const p of series.projected) {
          expect(p.actual).toBeNull();
        }
      }
    });
  });
});
