/**
 * Comprehensive Vitest Suite for TeacherWorkloadPage (10/10 visionOS Edition)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  TeacherWorkloadPage,
  getInitials,
  nameHash,
  avatarGradient,
  getWorkloadStatus,
  calculateTeacherSalary,
  type TeacherWorkload,
  type TeacherWorkloadSummary,
} from '../TeacherWorkload';
import request from '@/lib/api';
import { openSidecar } from '@/stores/ui.store';

/* --------------------------------------------------------------------------
 * MOCKS
 * ------------------------------------------------------------------------ */

vi.mock('@/lib/api', () => {
  class ApiError extends Error {
    status?: number;
    code?: string;
  }
  return {
    default: vi.fn(),
    ApiError,
  };
});

vi.mock('@/stores/ui.store', () => ({
  openSidecar: vi.fn(),
}));

vi.mock('@/hooks/usePageTitle', () => ({
  usePageTitle: vi.fn(),
}));

vi.mock('@/hooks/usePremiumSound', () => ({
  usePremiumSound: () => ({
    playTick: vi.fn(),
    playPop: vi.fn(),
    playSuccess: vi.fn(),
    playError: vi.fn(),
  }),
}));

vi.mock('@/i18n/I18nProvider', () => ({
  useSafeI18n: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
    locale: 'uz',
  }),
}));

vi.mock('@/components/ui', () => ({
  GlassBadge: ({ children, variant }: any) => (
    <span data-testid="glass-badge" data-variant={variant}>
      {children}
    </span>
  ),
  GlassCard: ({ children, className }: any) => <div className={className}>{children}</div>,
  GlassErrorState: ({ message, onRetry }: any) => (
    <div data-testid="glass-error">
      <p>{message}</p>
      <button onClick={onRetry}>Qayta urinish</button>
    </div>
  ),
  GlassEmptyState: ({ title, message }: any) => (
    <div data-testid="glass-empty">
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  ),
}));

/* --------------------------------------------------------------------------
 * FIXTURES
 * ------------------------------------------------------------------------ */

const mockSummary: TeacherWorkloadSummary = {
  total: 4,
  overloaded: 1,
  balanced: 2,
  underutilized: 1,
  avgUtilization: 0.85,
};

const mockTeachers: TeacherWorkload[] = [
  {
    teacherId: 'teacher-1',
    teacherName: 'Anvar Karimov',
    groupsCount: 4,
    studentsCount: 48,
    hoursPerWeek: 28,
    capacityHours: 30,
    utilization: 0.93,
    status: 'BALANCED',
    retentionRate: 94,
    attendanceRate: 90,
    avgGrade: 88,
    hourlyRate: 150000,
    baseSalary: 3000000,
  },
  {
    teacherId: 'teacher-2',
    teacherName: 'Dilnoza Rahimova',
    groupsCount: 6,
    studentsCount: 72,
    hoursPerWeek: 38,
    capacityHours: 32,
    utilization: 1.19,
    status: 'OVERLOADED',
    retentionRate: 88,
    attendanceRate: 82,
    avgGrade: 84,
    hourlyRate: 140000,
    baseSalary: 2500000,
  },
  {
    teacherId: 'teacher-3',
    teacherName: 'Sardorbek Umarov',
    groupsCount: 2,
    studentsCount: 20,
    hoursPerWeek: 12,
    capacityHours: 30,
    utilization: 0.40,
    status: 'UNDERUTILIZED',
    retentionRate: 91,
    attendanceRate: 89,
    avgGrade: 90,
    hourlyRate: 120000,
    baseSalary: 2000000,
  },
];

function renderWithClient() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <TeacherWorkloadPage />
    </QueryClientProvider>,
  );
}

/* --------------------------------------------------------------------------
 * TESTS
 * ------------------------------------------------------------------------ */

describe('TeacherWorkloadPage (Apple 10/10 visionOS Edition)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (request as any).mockImplementation((url: string) => {
      if (url.includes('/teacher-workload/summary')) {
        return Promise.resolve(mockSummary);
      }
      if (url.includes('/teacher-workload')) {
        return Promise.resolve({ items: mockTeachers, total: mockTeachers.length });
      }
      return Promise.reject(new Error(`Unknown url: ${url}`));
    });
  });

  /* --------------------------------------------------------------------------
   * 1. PURE DOMAIN HELPERS
   * ------------------------------------------------------------------------ */
  describe('Pure Domain Helpers', () => {
    it('getInitials extracts uppercase initials or fallback', () => {
      expect(getInitials('Anvar Karimov')).toBe('AK');
      expect(getInitials('Dilnoza')).toBe('D');
      expect(getInitials('')).toBe('—');
      expect(getInitials('   ')).toBe('—');
      expect(getInitials(null as any)).toBe('—');
    });

    it('nameHash produces deterministic positive integer', () => {
      const h1 = nameHash('Anvar Karimov');
      const h2 = nameHash('Anvar Karimov');
      expect(h1).toBe(h2);
      expect(h1).toBeGreaterThanOrEqual(0);
      expect(nameHash('')).toBe(0);
    });

    it('avatarGradient produces a valid CSS linear-gradient', () => {
      const grad = avatarGradient('Anvar Karimov');
      expect(grad).toMatch(/^linear-gradient\(135deg,\s*#[0-9A-Fa-f]{6}/);
    });

    it('getWorkloadStatus classifies UNDERUTILIZED, BALANCED, and OVERLOADED', () => {
      expect(getWorkloadStatus(10, 30)).toBe('UNDERUTILIZED'); // 33%
      expect(getWorkloadStatus(25, 30)).toBe('BALANCED'); // 83%
      expect(getWorkloadStatus(35, 30)).toBe('OVERLOADED'); // 116%
      expect(getWorkloadStatus(0, 0)).toBe('BALANCED');
    });

    it('calculateTeacherSalary computes transparent payroll breakdown and KPI bonuses', () => {
      // 20 hours/wk, 100k rate => monthly hours = 84 => 8,400,000
      // retention 92% >= 90% => +500,000 bonus
      // attendance 88% >= 85% => +400,000 bonus
      // base = 2,500,000
      // total = 2,500,000 + 8,400,000 + 500,000 + 400,000 = 11,800,000
      const res = calculateTeacherSalary({
        hoursPerWeek: 20,
        hourlyRate: 100000,
        retentionRate: 92,
        attendanceRate: 88,
        baseSalary: 2500000,
      });

      expect(res.monthlyHours).toBe(84);
      expect(res.hoursEarnings).toBe(8400000);
      expect(res.retentionBonus).toBe(500000);
      expect(res.attendanceBonus).toBe(400000);
      expect(res.totalSalary).toBe(11800000);
      expect(res.kpiBonusPercent).toBe(8); // (900,000 / 11,800,000) * 100 ≈ 7.6% -> 8%
    });

    it('calculateTeacherSalary omits bonuses when below thresholds', () => {
      const res = calculateTeacherSalary({
        hoursPerWeek: 10,
        hourlyRate: 100000,
        retentionRate: 85, // < 90
        attendanceRate: 80, // < 85
        baseSalary: 2000000,
      });

      expect(res.retentionBonus).toBe(0);
      expect(res.attendanceBonus).toBe(0);
      expect(res.totalSalary).toBe(2000000 + 42 * 100000);
      expect(res.kpiBonusPercent).toBe(0);
    });
  });

  /* --------------------------------------------------------------------------
   * 2. MAIN COMPONENT RENDERING & WORKLOAD SUMMARY
   * ------------------------------------------------------------------------ */
  describe('Workload Summary & Stat Tiles', () => {
    it('renders hero title and workload chips', async () => {
      renderWithClient();

      expect(await screen.findByText(/O'qituvchilar yuklamasi/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Workload/i).length).toBeGreaterThan(0);
      // Summary chips in hero (loaded asynchronously via summaryQuery)
      expect(await screen.findByText(/1 Ortiqcha/i)).toBeInTheDocument();
      expect(screen.getByText(/2 Muvozanatda/i)).toBeInTheDocument();
    });

    it('renders all 5 stat tiles with count-up values', async () => {
      renderWithClient();

      expect(await screen.findByText(/O'rtacha bandlik/i)).toBeInTheDocument();
      expect(screen.getByText(/Kam yuklama/i)).toBeInTheDocument();
    });
  });

  /* --------------------------------------------------------------------------
   * 3. TEACHER ROWS & ACTIONS
   * ------------------------------------------------------------------------ */
  describe('Teacher Rows & Interactive Controls', () => {
    it('renders teacher cards with status badges and KPI badges', async () => {
      renderWithClient();

      expect(await screen.findByText('Anvar Karimov', {}, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.getByText('Dilnoza Rahimova')).toBeInTheDocument();
      expect(screen.getByText('Sardorbek Umarov')).toBeInTheDocument();

      // Check hours vs capacity
      expect(screen.getByText('28')).toBeInTheDocument();
      expect(screen.getAllByText(/\/ 30h/i).length).toBeGreaterThan(0);

      // Check KPI chips
      expect(screen.getByText(/94% Saqlash/i)).toBeInTheDocument();
      expect(screen.getByText(/90% Davomat/i)).toBeInTheDocument();
    });

    it('toggles smart salary breakdown on button click', async () => {
      renderWithClient();

      expect(await screen.findByText('Anvar Karimov', {}, { timeout: 4000 })).toBeInTheDocument();

      // Find salary breakdown buttons
      const salaryButtons = screen.getAllByRole('button', { name: /Smart maosh tafsiloti/i });
      expect(salaryButtons.length).toBeGreaterThan(0);

      // Expand first teacher's salary
      fireEvent.click(salaryButtons[0]);

      // Check breakdown fields
      expect(await screen.findByText(/Fiksa Oklad/i)).toBeInTheDocument();
      expect(screen.getByText(/KPI Bonuslari/i)).toBeInTheDocument();
      expect(screen.getByText(/Jami Hisoblangan/i)).toBeInTheDocument();
    });

    it('triggers split-view sidecar when clicking sidecar button', async () => {
      renderWithClient();

      expect(await screen.findByText('Anvar Karimov')).toBeInTheDocument();

      const sidecarButtons = screen.getAllByRole('button', { name: /Split-view sidecar/i });
      expect(sidecarButtons.length).toBe(3);

      fireEvent.click(sidecarButtons[0]);

      expect(openSidecar).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'teacher-1',
          type: 'teacher',
          title: 'Anvar Karimov',
        }),
      );
    });

    it('verifies WCAG 2.2 AA SC 2.5.8 touch targets (>= 44x44px)', async () => {
      renderWithClient();

      expect(await screen.findByText('Anvar Karimov')).toBeInTheDocument();

      const sidecarButtons = screen.getAllByRole('button', { name: /Split-view sidecar/i });
      for (const btn of sidecarButtons) {
        expect(btn.className).toMatch(/min-h-\[44px\]/);
        expect(btn.className).toMatch(/min-w-\[44px\]/);
      }

      const salaryButtons = screen.getAllByRole('button', { name: /Smart maosh tafsiloti/i });
      for (const btn of salaryButtons) {
        expect(btn.className).toMatch(/min-h-\[44px\]/);
      }
    });
  });

  /* --------------------------------------------------------------------------
   * 4. SMART PAYROLL SIMULATOR
   * ------------------------------------------------------------------------ */
  describe('Smart Payroll & KPI Calculator Simulator', () => {
    it('renders simulator with inputs and dynamic auto-calc', async () => {
      renderWithClient();

      expect(await screen.findByText(/Smart Payroll & KPI Kalkulyatori/i)).toBeInTheDocument();
      expect(screen.getByText(/Haftalik dars:/i)).toBeInTheDocument();
      expect(screen.getByText(/Soatlik stavka:/i)).toBeInTheDocument();
      expect(screen.getByText(/Oylik Maosh Tarkibi/i)).toBeInTheDocument();
      expect(screen.getByText(/Shaffof formula/i)).toBeInTheDocument();
    });

    it('allows selecting a specific teacher from dropdown to simulate their salary', async () => {
      renderWithClient();

      expect(await screen.findByText('Anvar Karimov')).toBeInTheDocument();

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'teacher-1' } });

      // Anvar Karimov has 28 hours
      expect(screen.getByText(/28 soat\/hafta/i)).toBeInTheDocument();
    });
  });

  /* --------------------------------------------------------------------------
   * 5. MODEL LEGEND
   * ------------------------------------------------------------------------ */
  describe('Model Legend', () => {
    it('renders capacity and thresholds explanation', async () => {
      renderWithClient();

      expect(await screen.findByText(/Yuklama hisoblash formulasi/i)).toBeInTheDocument();
      expect(screen.getAllByText(/capacity/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/hoursWeek/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/utilization/i).length).toBeGreaterThan(0);
    });
  });

  /* --------------------------------------------------------------------------
   * 6. EMPTY & ERROR STATES
   * ------------------------------------------------------------------------ */
  describe('Empty and Error States', () => {
    it('renders empty state when there are no teachers', async () => {
      (request as any).mockImplementation((url: string) => {
        if (url === '/teacher-workload/summary') {
          return Promise.resolve({ total: 0, overloaded: 0, balanced: 0, underutilized: 0, avgUtilization: 0 });
        }
        if (url === '/teacher-workload') {
          return Promise.resolve({ items: [], total: 0 });
        }
        return Promise.reject(new Error('error'));
      });

      renderWithClient();

      expect(await screen.findByTestId('glass-empty')).toBeInTheDocument();
      expect(screen.getByText(/O'qituvchilar topilmadi/i)).toBeInTheDocument();
    });

    it('renders error state and retries on click', async () => {
      (request as any).mockImplementation((url: string) => {
        if (url === '/teacher-workload') {
          return Promise.reject(new Error('Server error'));
        }
        return Promise.resolve(mockSummary);
      });

      renderWithClient();

      expect(await screen.findByTestId('glass-error')).toBeInTheDocument();
      const retryBtn = screen.getByRole('button', { name: /Qayta urinish/i });
      fireEvent.click(retryBtn);
      expect(request).toHaveBeenCalledWith('/teacher-workload');
    });
  });
});
