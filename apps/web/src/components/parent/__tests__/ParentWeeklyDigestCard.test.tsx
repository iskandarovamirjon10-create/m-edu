import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ParentWeeklyDigestCard } from '../ParentWeeklyDigestCard';
import { parentPortalApi } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  parentPortalApi: {
    weeklyDigest: vi.fn(),
  },
}));

vi.mock('@/lib/format', () => ({
  formatDate: (val: string) => val.slice(0, 10),
  formatTime: (_val: string) => '09:00',
}));

const mockDigest = {
  student: {
    id: 'stud-1',
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

describe('ParentWeeklyDigestCard Component Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders error state when query fails', async () => {
    vi.mocked(parentPortalApi.weeklyDigest).mockRejectedValue(new Error('Network error'));

    renderWithQuery(<ParentWeeklyDigestCard studentId="stud-1" />);

    await waitFor(() => {
      expect(screen.getByText(/Haftalik digestni yuklashda xatolik/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Qayta urinish/i })).toBeInTheDocument();
    });
  });

  it('renders digest metrics, highlights, turnstile entries, and recommendations', async () => {
    vi.mocked(parentPortalApi.weeklyDigest).mockResolvedValue(mockDigest);

    renderWithQuery(<ParentWeeklyDigestCard studentId="stud-1" studentName="Aziza Alieva" />);

    // Header & tone
    await waitFor(() => {
      expect(screen.getByText('Haftalik Akademik Digest')).toBeInTheDocument();
      expect(screen.getByText("A'lo darajada")).toBeInTheDocument();
    });

    // Metrics
    expect(screen.getByText('98')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('95')).toBeInTheDocument();

    // Default tab: Highlights
    expect(screen.getByText(/Haftadagi barcha darslarga to'liq va faol qatnashdi/i)).toBeInTheDocument();

    // Switch to Turnstile tab
    const turnstileTab = screen.getByRole('button', { name: /Turniket & Qatnashuv/i });
    fireEvent.click(turnstileTab);

    await waitFor(() => {
      expect(screen.getByText('Turniket RFID')).toBeInTheDocument();
      expect(screen.getByText('Kelgan')).toBeInTheDocument();
    });

    // Switch to Assignments tab
    const assignmentsTab = screen.getByRole('button', { name: /Topshiriqlar/i });
    fireEvent.click(assignmentsTab);

    await waitFor(() => {
      expect(screen.getByText('Essay 1')).toBeInTheDocument();
      expect(screen.getByText('95 / 100')).toBeInTheDocument();
    });

    // Parental recommendation
    expect(screen.getByText(/Farzandingiz haftani a'lo natijalar bilan yakunladi/i)).toBeInTheDocument();
  });

  it('copies weekly summary when copy button is clicked', async () => {
    vi.mocked(parentPortalApi.weeklyDigest).mockResolvedValue(mockDigest);

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    renderWithQuery(<ParentWeeklyDigestCard studentId="stud-1" studentName="Aziza Alieva" />);

    await waitFor(() => {
      expect(screen.getByText('Haftalik Akademik Digest')).toBeInTheDocument();
    });

    const copyBtn = screen.getByRole('button', { name: /Xulosani nusxalash/i });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalled();
    });
  });
});
