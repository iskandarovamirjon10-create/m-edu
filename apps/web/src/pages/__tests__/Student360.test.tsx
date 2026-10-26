/**
 * Unit & Integration Test Suite for Student360Page (Apple 10/10 VisionOS / macOS Sequoia Edition)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { I18nProvider } from '@/i18n/I18nProvider';
import {
  Student360Page,
  getInitials,
  nameHash,
  avatarGradient,
  masteryTone,
} from '../Student360';
import { openSidecar } from '@/stores/ui.store';

// Mock ui.store
vi.mock('@/stores/ui.store', () => ({
  openSidecar: vi.fn(),
}));

// Mock sound hook
vi.mock('@/hooks/usePremiumSound', () => ({
  usePremiumSound: () => ({
    playTick: vi.fn(),
    playPop: vi.fn(),
    playSuccess: vi.fn(),
    playError: vi.fn(),
  }),
}));

// Mock SpatialIdentityCard360
vi.mock('@/components/cards/SpatialIdentityCard360', () => ({
  SpatialIdentityCard360: ({ data }: { data: any }) => (
    <div data-testid="spatial-identity-card-360">
      <span>{data.fullName}</span>
      <span>{data.role}</span>
    </div>
  ),
}));

const { mockStudent360 } = vi.hoisted(() => ({
  mockStudent360: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  progressApi: {
    student360: (...args: unknown[]) => mockStudent360(...args),
  },
}));

const mockProfile = {
  student: {
    id: 'student-360',
    name: 'Shaxzod Alimov',
    faceEnrolled: true,
  },
  attendance: {
    rate: 92,
    present: 46,
    absent: 4,
  },
  academic: {
    overallMastery: 84,
    quizzes: {
      avgScore: 88,
      passedAttempts: 15,
      totalAttempts: 17,
    },
    subjectsMastery: [
      {
        subjectId: 'sub-1',
        subjectName: 'Matematika',
        subjectCode: 'MATH-1',
        masteredObjectives: 18,
        totalObjectives: 20,
        masteryPercentage: 90,
      },
      {
        subjectId: 'sub-2',
        subjectName: 'Fizika',
        subjectCode: 'PHYS-1',
        masteredObjectives: 14,
        totalObjectives: 20,
        masteryPercentage: 70,
      },
    ],
  },
  risk: {
    level: 'LOW' as const,
    score: 15,
    signals: ['Uyga vazifa 1 marta kechiktirildi'],
  },
  attendanceHistory: [
    {
      id: 'att-1',
      date: '2026-10-25',
      status: 'PRESENT',
      markedAt: '2026-10-25T08:50:00.000Z',
      source: 'RFID_TURNSTILE',
      groupName: 'Matematika',
    },
  ],
  timeline: [
    {
      id: 'exam-1',
      type: 'EXAM' as const,
      title: 'Yakuniy Imtihon',
      subtitle: 'Muvaffaqiyatli topshirildi',
      score: 95,
      maxScore: 100,
      timestamp: '2026-10-26T10:00:00.000Z',
      tone: 'green' as const,
    },
    {
      id: 'as-1',
      type: 'ASSIGNMENT' as const,
      title: 'Trigonometriya mashqlari',
      subtitle: 'Matematika guruhi',
      score: 88,
      maxScore: 100,
      timestamp: '2026-10-24T14:00:00.000Z',
      tone: 'purple' as const,
    },
  ],
  monthlyTrends: [
    { month: 'May', mastery: 75, attendanceRate: 85 },
    { month: 'Iyun', mastery: 78, attendanceRate: 88 },
    { month: 'Iyul', mastery: 80, attendanceRate: 90 },
    { month: 'Avg', mastery: 82, attendanceRate: 90 },
    { month: 'Sen', mastery: 84, attendanceRate: 92 },
    { month: 'Okt', mastery: 84, attendanceRate: 92 },
  ],
  interventions: [
    {
      id: 'int-1',
      category: 'MASTERY' as const,
      priority: 'LOW' as const,
      title: 'Iqtidorli o‘quvchilar ligasi',
      description: "O‘zlashtirish a'lo darajada.",
      actionLabel: 'Olimpiada dasturi',
    },
  ],
};

function renderComponent(studentId = 'student-360') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <MemoryRouter initialEntries={[`/students/${studentId}/360`]}>
          <Routes>
            <Route path="/students/:id/360" element={<Student360Page />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>
  );
}

describe('Student360Page (Apple 10/10 VisionOS / macOS Sequoia Edition)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStudent360.mockResolvedValue(mockProfile);
  });

  /* -------------------------------------------------------------
     PURE HELPERS TEST SUITE
  ------------------------------------------------------------- */
  describe('Pure Helper Functions', () => {
    it('getInitials extracts two capital letters', () => {
      expect(getInitials('Shaxzod Alimov')).toBe('SA');
      expect(getInitials('Alisher')).toBe('A');
      expect(getInitials('')).toBe('—');
    });

    it('nameHash produces a deterministic integer', () => {
      expect(nameHash('Shaxzod')).toBe(nameHash('Shaxzod'));
      expect(nameHash('Shaxzod')).toBeGreaterThanOrEqual(0);
    });

    it('avatarGradient generates a valid linear gradient CSS string', () => {
      const grad = avatarGradient('Shaxzod Alimov');
      expect(grad).toMatch(/^linear-gradient\(135deg, #[0-9a-fA-F]{6} 0%, #[0-9a-fA-F]{6} 100%\)$/);
    });

    it('masteryTone categorizes percentage thresholds into correct tones', () => {
      expect(masteryTone(90)).toBe('green');
      expect(masteryTone(75)).toBe('blue');
      expect(masteryTone(50)).toBe('orange');
      expect(masteryTone(25)).toBe('red');
    });
  });

  /* -------------------------------------------------------------
     RENDERING & INTERACTIVE FEATURES
  ------------------------------------------------------------- */
  describe('Rendering & Interactive Features', () => {
    it('renders hero profile with student name, avatar, and risk badge', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Shaxzod Alimov')).toBeInTheDocument();
      });

      expect(screen.getByText(/15\/100/)).toBeInTheDocument();
      expect(screen.getByText('360° Karta')).toBeInTheDocument();
    });

    it('renders stats tiles: attendance rate, overall mastery, and quiz average', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('92%')).toBeInTheDocument();
      });

      expect(screen.getByText('84%')).toBeInTheDocument();
      expect(screen.getByText('88%')).toBeInTheDocument();
    });

    it('renders risk signals banner with detected warnings', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Uyga vazifa 1 marta kechiktirildi')).toBeInTheDocument();
      });
    });

    it('renders subject mastery list with progress rings', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Matematika')).toBeInTheDocument();
      });

      expect(screen.getByText('Fizika')).toBeInTheDocument();
      expect(screen.getByText('MATH-1')).toBeInTheDocument();
      expect(screen.getByText('PHYS-1')).toBeInTheDocument();
    });

    it('triggers student sidecar QuickLook when sidecar button is pressed', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Shaxzod Alimov')).toBeInTheDocument();
      });

      const sidecarBtns = screen.getAllByTitle(/Sidecar/i);
      fireEvent.click(sidecarBtns[0]);

      expect(openSidecar).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'student',
          id: 'student-360',
          title: 'Shaxzod Alimov',
        })
      );
    });

    it('toggles 360 spatial identity card on button click', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Shaxzod Alimov')).toBeInTheDocument();
      });

      const cardToggleBtn = screen.getByText('360° Karta');
      fireEvent.click(cardToggleBtn);

      await waitFor(() => {
        expect(screen.getByTestId('spatial-identity-card-360')).toBeInTheDocument();
      });
    });

    it('renders chronological longitudinal growth timeline with event cards', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Xronologik O'sish Lentasi")).toBeInTheDocument();
        expect(screen.getByText('Yakuniy Imtihon')).toBeInTheDocument();
        expect(screen.getByText('Trigonometriya mashqlari')).toBeInTheDocument();
      });
    });

    it('renders 6-month mastery & attendance dynamics and pedagogical interventions', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("6 Oylik O'zlashtirish va Qatnashuv Dinamikasi")).toBeInTheDocument();
        expect(screen.getByText('Pedagogik Interventsiyalar')).toBeInTheDocument();
        expect(screen.getByText('Iqtidorli o‘quvchilar ligasi')).toBeInTheDocument();
      });
    });
  });
});
