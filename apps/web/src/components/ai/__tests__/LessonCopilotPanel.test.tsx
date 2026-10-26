import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LessonCopilotPanel } from '../LessonCopilotPanel';
import { lessonsApi } from '@/lib/api';
import type { LessonCopilotAnalysis } from '@/types/academics';

vi.mock('@/lib/api', () => ({
  lessonsApi: {
    getCopilotAnalysis: vi.fn(),
  },
}));

const mockAnalysis: LessonCopilotAnalysis = {
  lessonId: 'les-1',
  topic: 'Kvadrat tenglamalar',
  courseName: 'Algebra',
  groupName: 'Algebra 9-A',
  groupMetrics: {
    totalStudents: 10,
    presentToday: 9,
    absentToday: 1,
    lateToday: 0,
    attendanceRateToday: 90,
    averageHistoricalAttendance: 95,
    homeworkCompletionRate: 88,
    groupMasteryIndex: 91,
    comprehensionStatus: 'EXCELLENT',
  },
  atRiskStudents: [
    {
      studentId: 'stud-1',
      fullName: 'Aziz Rahimov',
      phone: '+998901234567',
      riskType: 'ABSENCE_STREAK',
      level: 'HIGH',
      reason: 'Oxirgi 2 ta darsda qatnashmagan',
      stats: {
        absenceCount: 2,
        absenceStreak: 2,
        homeworkAverage: 45,
        latesCount: 0,
      },
      recommendedIntervention: "Ota-onasi bilan bog'lanish tavsiya etiladi",
    },
  ],
  pedagogicalCheckpoints: [
    {
      phase: 'WARM_UP',
      title: 'Tezkor Kirish va Diqqatni Jamlash',
      durationMinutes: 7,
      instruction: 'Qisqa 2 ta savol bering',
      promptExample: 'Formula nima?',
    },
  ],
  differentiatedTasks: [
    {
      tier: 'FOUNDATION',
      targetAudience: "O'zlashtirishi sust o'quvchilar",
      badgeText: "Boshlang'ich (Qo'llab-quvvatlash)",
      taskTitle: 'Asosiy formulalar',
      taskPrompt: 'Formulani yozing va 1-misolni yeching',
      solutionHint: 'Kitobdagi namunaga qarang',
    },
    {
      tier: 'CORE',
      targetAudience: "Guruhning asosiy o'quvchilari",
      badgeText: 'Asosiy (Standart)',
      taskTitle: 'Amaliy misollar',
      taskPrompt: 'Tenglamani yeching',
      solutionHint: 'Diskriminantni hisoblang',
    },
    {
      tier: 'ADVANCED',
      targetAudience: "Ilg'or o'quvchilar",
      badgeText: "Ilg'or (Challenge)",
      taskTitle: 'Olimpiada darajasidagi masala',
      taskPrompt: 'Parametrli tenglamani tahlil qiling',
      solutionHint: 'Ekstremal holatlarni tekshiring',
    },
  ],
};

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('LessonCopilotPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders collapsed state with topic and at-risk badge', async () => {
    vi.mocked(lessonsApi.getCopilotAnalysis).mockResolvedValue(mockAnalysis);

    renderWithClient(<LessonCopilotPanel lessonId="les-1" />);

    expect(screen.getByText('AI Lesson Copilot')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('1 ta xavf guruhi')).toBeInTheDocument();
      expect(screen.getByText(/Mavzu: Kvadrat tenglamalar/i)).toBeInTheDocument();
    });
  });

  it('expands on click and shows metrics and differentiated tasks', async () => {
    vi.mocked(lessonsApi.getCopilotAnalysis).mockResolvedValue(mockAnalysis);

    renderWithClient(<LessonCopilotPanel lessonId="les-1" />);

    await waitFor(() => {
      expect(screen.getByText('AI Lesson Copilot')).toBeInTheDocument();
    });

    const trigger = screen.getByRole('button', { name: /AI Lesson Copilot/i });
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('Guruh Mastery')).toBeInTheDocument();
      expect(screen.getByText('91')).toBeInTheDocument();
      expect(screen.getByText('90%')).toBeInTheDocument();
      expect(screen.getByText('Asosiy formulalar')).toBeInTheDocument();
    });
  });

  it('allows applying task to lesson notes and homework', async () => {
    vi.mocked(lessonsApi.getCopilotAnalysis).mockResolvedValue(mockAnalysis);

    const onApplyNotes = vi.fn();
    const onApplyHomework = vi.fn();

    renderWithClient(
      <LessonCopilotPanel
        lessonId="les-1"
        onApplyDifferentiatedTaskToNotes={onApplyNotes}
        onApplyDifferentiatedTaskToHomework={onApplyHomework}
      />,
    );

    const trigger = screen.getByRole('button', { name: /AI Lesson Copilot/i });
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getAllByText('📋 Dars izohiga qo‘shish').length).toBeGreaterThan(0);
    });

    const notesBtn = screen.getAllByText('📋 Dars izohiga qo‘shish')[0];
    fireEvent.click(notesBtn);
    expect(onApplyNotes).toHaveBeenCalledTimes(1);

    const hwBtn = screen.getAllByText('📝 Uy vazifasiga ko‘chirish')[0];
    fireEvent.click(hwBtn);
    expect(onApplyHomework).toHaveBeenCalledTimes(1);
  });

  it('switches between tabs (Checkpoints and At-Risk)', async () => {
    vi.mocked(lessonsApi.getCopilotAnalysis).mockResolvedValue(mockAnalysis);

    renderWithClient(<LessonCopilotPanel lessonId="les-1" />);

    const trigger = screen.getByRole('button', { name: /AI Lesson Copilot/i });
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('Dars Qadamlari (4)')).toBeInTheDocument();
    });

    // Checkpoints tab
    fireEvent.click(screen.getByText('Dars Qadamlari (4)'));
    await waitFor(() => {
      expect(screen.getByText('Tezkor Kirish va Diqqatni Jamlash')).toBeInTheDocument();
      expect(screen.getByText(/⏱️ 7 daqiqa/i)).toBeInTheDocument();
    });

    // At-Risk tab
    fireEvent.click(screen.getByRole('button', { name: "Xavf guruhi ro‘yxati" }));
    await waitFor(() => {
      expect(screen.getByText('Aziz Rahimov')).toBeInTheDocument();
      expect(screen.getByText(/Oxirgi 2 ta darsda qatnashmagan/i)).toBeInTheDocument();
      expect(screen.getByText(/📞 Bog‘lanish: \+998901234567/i)).toBeInTheDocument();
    });
  });
});
