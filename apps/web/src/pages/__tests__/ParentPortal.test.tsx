import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ParentPortalPage } from '../ParentPortal';
import { parentPortalApi } from '@/lib/api';

vi.mock('@/lib/api', () => {
  class MockApiError extends Error {
    status: number;
    code?: string;
    constructor(message: string, status = 500, code?: string) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.code = code;
    }
  }

  return {
    ApiError: MockApiError,
    parentPortalApi: {
      children: vi.fn(),
      attendance: vi.fn(),
      attendanceSummary: vi.fn(),
      grades: vi.fn(),
      invoices: vi.fn(),
      schedule: vi.fn(),
      weeklyDigest: vi.fn(),
    },
  };
});

vi.mock('@/i18n/I18nProvider', () => {
  const mockI18n = () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (params && params.date) return `Due: ${params.date}`;
      return key;
    },
    locale: 'en',
    setLocale: vi.fn(),
  });
  return {
    useI18n: mockI18n,
    useSafeI18n: mockI18n,
  };
});

vi.mock('@/hooks/usePageTitle', () => ({
  usePageTitle: vi.fn(),
}));

vi.mock('@/components/ui', () => ({
  GlassPageHeader: ({ title, subtitle }: any) => (
    <div data-testid="page-header">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  ),
  GlassPageLoader: ({ label }: any) => <div data-testid="page-loader">{label || 'Loading...'}</div>,
  GlassErrorState: ({ message, onRetry }: any) => (
    <div data-testid="error-state">
      <span>{message}</span>
      <button onClick={onRetry}>Retry</button>
    </div>
  ),
  GlassEmptyState: ({ title, message }: any) => (
    <div data-testid="empty-state">
      <h2>{title}</h2>
      <p>{message}</p>
    </div>
  ),
}));

const mockChild1 = {
  studentId: 'child-1-id',
  relationship: 'MOTHER',
  name: 'Aziza Alieva',
  permissions: {
    grades: true,
    payments: true,
    attendance: true,
  },
  student: {
    id: 'child-1-id',
    balance: 250000,
    status: 'ACTIVE',
    user: {
      firstName: 'Aziza',
      lastName: 'Alieva',
      avatar: null,
    },
    groups: [
      { id: 'group-1', name: 'English Advanced' },
    ],
  },
};

const mockChild2 = {
  studentId: 'child-2-id',
  relationship: 'MOTHER',
  name: 'Jasur Aliev',
  permissions: {
    grades: false,
    payments: true,
    attendance: false,
  },
  student: {
    id: 'child-2-id',
    balance: -100000,
    status: 'ACTIVE',
    user: {
      firstName: 'Jasur',
      lastName: 'Aliev',
      avatar: null,
    },
    groups: [
      { id: 'group-2', name: 'Mathematics 101' },
    ],
  },
};

const mockAttendance = [
  {
    id: 'att-1',
    date: '2026-10-15T09:00:00.000Z',
    status: 'PRESENT',
    group: { id: 'group-1', name: 'English Advanced' },
    lesson: { id: 'less-1', topic: 'Present Perfect', startTime: '09:00' },
  },
];

const mockAttendanceSummary = {
  total: 10,
  byStatus: { PRESENT: 9, ABSENT: 1 },
  attendanceRate: 90,
};

const mockGrades = {
  grades: [
    {
      id: 'grade-1',
      value: 95,
      maxValue: 100,
      label: 'Essay 1',
      notes: 'Excellent grammar and flow',
      createdAt: '2026-10-14T10:00:00.000Z',
      group: { id: 'group-1', name: 'English Advanced' },
    },
  ],
  examResults: [
    {
      id: 'er-1',
      marksObtained: 88,
      isPassed: true,
      exam: {
        id: 'exam-1',
        title: 'Midterm Exam',
        subject: 'English',
        examDate: '2026-10-10T10:00:00.000Z',
        examType: 'WRITTEN',
      },
    },
  ],
};

const mockInvoices = {
  outstanding: 150000,
  overdue: 0,
  invoices: [
    {
      id: 'inv-1',
      number: 'INV-2026-001',
      status: 'ISSUED',
      total: 500000,
      paidAmount: 350000,
      refundedAmount: 0,
      dueDate: '2026-11-01T00:00:00.000Z',
      createdAt: '2026-10-01T00:00:00.000Z',
    },
  ],
  payments: [
    {
      id: 'pay-1',
      amount: 350000,
      status: 'PAID',
      method: 'BANK_TRANSFER',
      receiptNumber: 'REC-9912',
      paidAt: '2026-10-05T12:00:00.000Z',
    },
  ],
};

const mockWeeklyDigest = {
  student: {
    id: 'child-1-id',
    fullName: 'Aziza Alieva',
    avatar: null,
  },
  period: {
    startDate: '2026-10-19',
    endDate: '2026-10-26',
    weekNumber: 4,
  },
  metrics: {
    attendanceRate: 100,
    lessonsAttended: 6,
    totalLessons: 6,
    latesCount: 0,
    excusedCount: 0,
    homeworkCompletionRate: 100,
    averageScore: 95,
    weeklyMasteryScore: 98,
    statusTone: 'EXCELLENT' as const,
  },
  highlights: [
    "🌟 Haftadagi barcha darslarga to'liq va faol qatnashdi.",
    "⏱️ Haftadagi barcha darslarga o'z vaqtida, kechikmasdan keldi.",
  ],
  recommendations: [
    "Farzandingiz haftani a'lo natijalar bilan yakunladi.",
  ],
  recentAttendances: [
    {
      date: '2026-10-25',
      status: 'PRESENT',
      markedAt: '2026-10-25T08:55:00.000Z',
      source: 'RFID_TURNSTILE',
      groupName: 'English Advanced',
    },
  ],
  recentAssignments: [
    {
      title: 'Essay 1',
      groupName: 'English Advanced',
      score: 95,
      maxScore: 100,
      submittedAt: '2026-10-24T18:00:00.000Z',
      feedback: 'Ajoyib natija!',
    },
  ],
};

const mockSchedule = [
  {
    id: 'sch-1',
    dayOfWeek: 'MONDAY',
    startTime: '09:00',
    endTime: '10:30',
    room: 'Room 204',
    group: { id: 'group-1', name: 'English Advanced' },
  },
  {
    id: 'sch-2',
    dayOfWeek: 'WEDNESDAY',
    startTime: '09:00',
    endTime: '10:30',
    room: 'Room 204',
    group: { id: 'group-1', name: 'English Advanced' },
  },
];

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe('ParentPortalPage Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state when fetching children', () => {
    vi.mocked(parentPortalApi.children).mockImplementation(() => new Promise(() => {}));

    renderWithQuery(<ParentPortalPage />);
    expect(screen.getByTestId('page-loader')).toBeInTheDocument();
  });

  it('renders error state when children query fails', async () => {
    vi.mocked(parentPortalApi.children).mockRejectedValue(new Error('Failed to fetch children'));

    renderWithQuery(<ParentPortalPage />);
    await waitFor(() => {
      expect(screen.getByTestId('error-state')).toBeInTheDocument();
    });
  });

  it('renders empty state when parent has no verified children', async () => {
    vi.mocked(parentPortalApi.children).mockResolvedValue([]);

    renderWithQuery(<ParentPortalPage />);
    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });
  });

  it('renders child profile, attendance, grades, schedule and invoices when fully permitted', async () => {
    vi.mocked(parentPortalApi.children).mockResolvedValue([mockChild1]);
    vi.mocked(parentPortalApi.attendance).mockResolvedValue(mockAttendance);
    vi.mocked(parentPortalApi.attendanceSummary).mockResolvedValue(mockAttendanceSummary);
    vi.mocked(parentPortalApi.grades).mockResolvedValue(mockGrades);
    vi.mocked(parentPortalApi.invoices).mockResolvedValue(mockInvoices);
    vi.mocked(parentPortalApi.schedule).mockResolvedValue(mockSchedule);
    vi.mocked(parentPortalApi.weeklyDigest).mockResolvedValue(mockWeeklyDigest);

    renderWithQuery(<ParentPortalPage />);

    // Child name and status
    await waitFor(() => {
      expect(screen.getAllByText('Aziza Alieva')[0]).toBeInTheDocument();
    });

    // Weekly Academic Digest
    await waitFor(() => {
      expect(screen.getByText('Haftalik Akademik Digest')).toBeInTheDocument();
      expect(screen.getByText("A'lo darajada")).toBeInTheDocument();
    });

    // Attendance records
    await waitFor(() => {
      expect(screen.getByText(/Present Perfect/)).toBeInTheDocument();
    });

    // Grades / assessments
    expect(screen.getByText('Essay 1')).toBeInTheDocument();
    expect(screen.getAllByText('95').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Midterm Exam')).toBeInTheDocument();

    // Weekly Schedule
    expect(screen.getAllByText(/Room 204/).length).toBe(2);
    expect(screen.getAllByText('09:00 – 10:30').length).toBeGreaterThan(0);

    // Invoices and payments
    expect(screen.getByText('INV-2026-001')).toBeInTheDocument();
  });

  it('switches between children and respects domain permissions', async () => {
    vi.mocked(parentPortalApi.children).mockResolvedValue([mockChild1, mockChild2]);
    vi.mocked(parentPortalApi.attendance).mockResolvedValue(mockAttendance);
    vi.mocked(parentPortalApi.attendanceSummary).mockResolvedValue(mockAttendanceSummary);
    vi.mocked(parentPortalApi.grades).mockResolvedValue(mockGrades);
    vi.mocked(parentPortalApi.invoices).mockResolvedValue(mockInvoices);
    vi.mocked(parentPortalApi.schedule).mockResolvedValue(mockSchedule);
    vi.mocked(parentPortalApi.weeklyDigest).mockResolvedValue(mockWeeklyDigest);

    renderWithQuery(<ParentPortalPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Aziza Alieva')[0]).toBeInTheDocument();
    });

    // Click on Jasur Aliev switcher button
    const jasurButton = screen.getByRole('tab', { name: /Jasur Aliev/i });
    fireEvent.click(jasurButton);

    // Jasur has attendance = false and grades = false, so those cards should not be rendered
    await waitFor(() => {
      expect(screen.queryByText('Essay 1')).not.toBeInTheDocument();
      expect(screen.queryByText(/Present Perfect/)).not.toBeInTheDocument();
    });

    // But invoices should still be rendered
    expect(screen.getByText('INV-2026-001')).toBeInTheDocument();
  });
});
