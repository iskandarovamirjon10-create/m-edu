import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SmartClassroomSeatingStudio } from '../groups/SmartClassroomSeatingStudio';
import { VoiceSpeakingDiagnosticStudio } from '../exams/VoiceSpeakingDiagnosticStudio';

// Mock audio & toasts
vi.mock('@/hooks/usePremiumSound', () => ({
  usePremiumSound: () => ({
    playSuccess: vi.fn(),
    playError: vi.fn(),
    playTick: vi.fn(),
    playPop: vi.fn(),
    playLaserScan: vi.fn(),
    playFaceIdMatch: vi.fn(),
  }),
}));

vi.mock('@/components/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/ui')>();
  return {
    ...actual,
    useToast: () => ({
      push: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
      toastNode: <div data-testid="toast-node" />,
    }),
  };
});

vi.mock('@/lib/api', () => ({
  studentsApi: {
    list: vi.fn().mockResolvedValue({
      items: [
        { id: 'sp-1', firstName: 'Dilnoza', lastName: 'Karimova', groupName: 'IELTS Intensive C1', predictedBand: '7.5 (C1)' },
        { id: 'sp-2', firstName: 'Temurbek', lastName: 'Oripov', groupName: 'General English B2', predictedBand: '6.5 (B2)' },
      ],
    }),
  },
}));

describe('Two Ultra-Creative Features V2 Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ══════════════════════════════════════════════════════════════════════════
   * 1. SmartClassroomSeatingStudio Tests
   * ════════════════════════════════════════════════════════════════════════ */
  it('1. SmartClassroomSeatingStudio renders 2D desk matrix, podium and swaps seats', () => {
    const mockGroup = {
      id: 'g-1',
      name: 'IELTS Pro 2026',
      room: 'Auditoriya 305',
      enrollments: [
        {
          isActive: true,
          student: { id: 's-1', user: { firstName: 'Alisher', lastName: 'Qodirov' }, score: 92, attendanceRate: 98, hasGlasses: true },
        },
        {
          isActive: true,
          student: { id: 's-2', user: { firstName: 'Zilola', lastName: 'Rahimova' }, score: 88, attendanceRate: 95 },
        },
      ],
    } as any;

    render(
      <SmartClassroomSeatingStudio
        group={mockGroup}
        groupName="IELTS Pro 2026"
        roomName="Auditoriya 305"
      />
    );

    // Verify title and classroom badge
    expect(screen.getByText(/IELTS Pro 2026 — Interaktiv Partalar Matritsasi/i)).toBeInTheDocument();
    expect(screen.getByText(/Smart Classroom 2D/i)).toBeInTheDocument();
    expect(screen.getByText(/Auditoriya 305/i)).toBeInTheDocument();

    // Verify Teacher Podium and Whiteboard
    expect(screen.getByText(/O'qituvchi Minbari va Smart Interaktiv Doska/i)).toBeInTheDocument();

    // Verify enrolled students are placed
    expect(screen.getByText(/Alisher Qodirov/i)).toBeInTheDocument();
    expect(screen.getByText(/Zilola Rahimova/i)).toBeInTheDocument();

    // Strategy Buttons
    const antiCheatBtn = screen.getByRole('button', { name: /Imtihon Shaxmati \(Anti-Cheat\)/i });
    fireEvent.click(antiCheatBtn);

    const ergonomicBtn = screen.getByRole('button', { name: /Ergonomika/i });
    fireEvent.click(ergonomicBtn);

    const synergyBtn = screen.getByRole('button', { name: /Simbioz/i });
    fireEvent.click(synergyBtn);

    // Save Seating Plan
    const saveBtn = screen.getByRole('button', { name: /Joylashuvni Saqlash/i });
    fireEvent.click(saveBtn);
  });

  /* ══════════════════════════════════════════════════════════════════════════
   * 2. VoiceSpeakingDiagnosticStudio Tests
   * ════════════════════════════════════════════════════════════════════════ */
  it('2. VoiceSpeakingDiagnosticStudio renders acoustic HUD, WPM cadence and switches phases', async () => {
    render(
      <VoiceSpeakingDiagnosticStudio
        examTitle="IELTS Mock Oral Exam — London Center"
      />
    );

    // Verify title & Engine badge
    expect(screen.getByText(/IELTS Mock Oral Exam — London Center/i)).toBeInTheDocument();
    expect(screen.getByText(/AI Voice Engine v3.2/i)).toBeInTheDocument();

    // Verify Acoustic & Linguistic Telemetry KPI
    expect(screen.getByText(/Nutq Tezligi \(Cadence\)/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Lug‘at Boyligi \(Lexical\)/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Ikkilanish & To‘xtalish/i)).toBeInTheDocument();
    expect(screen.getByText(/Prognoz Qilingan Daraja/i)).toBeInTheDocument();

    // Wait for candidates from API to load
    await waitFor(() => {
      expect(screen.getByText(/Dilnoza Karimova/i)).toBeInTheDocument();
      expect(screen.getByText(/Temurbek Oripov/i)).toBeInTheDocument();
    });

    const temurBtn = screen.getByRole('button', { name: /Temurbek Oripov/i });
    fireEvent.click(temurBtn);

    // Verify Phase Switching (Part 1, Part 2, Part 3)
    const part1Btn = screen.getByRole('button', { name: /Faza 1/i });
    fireEvent.click(part1Btn);
    expect(screen.getByText(/Faza 1: Kirish & Umumiy Savollar/i)).toBeInTheDocument();

    const part2Btn = screen.getByRole('button', { name: /Faza 2/i });
    fireEvent.click(part2Btn);
    expect(screen.getByText(/Faza 2: Mavzuli Kartochka/i)).toBeInTheDocument();

    // Scratchpad notes
    const textarea = screen.getByPlaceholderText(/Asosiy nuqtalar/i);
    fireEvent.change(textarea, { target: { value: 'My goal is software architecture in Silicon Valley.' } });
    expect(textarea).toHaveValue('My goal is software architecture in Silicon Valley.');

    // Start and Stop Voice Recording
    const startRecordBtn = screen.getByRole('button', { name: /Ovozni Yozishni Boshlash/i });
    fireEvent.click(startRecordBtn);

    const stopRecordBtn = screen.getByRole('button', { name: /To‘xtatish & Tahlil Qilish/i });
    fireEvent.click(stopRecordBtn);

    // Telegram report dispatch
    const telegramBtn = screen.getByRole('button', { name: /Telegramga Hisobot/i });
    fireEvent.click(telegramBtn);
  });
});
