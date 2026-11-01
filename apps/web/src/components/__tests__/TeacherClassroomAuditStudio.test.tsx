import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TeacherClassroomAuditStudio } from '../teachers/TeacherClassroomAuditStudio';

vi.mock('@/hooks/usePremiumSound', () => ({
  usePremiumSound: () => ({
    playSuccess: vi.fn(),
    playError: vi.fn(),
    playTick: vi.fn(),
    playPop: vi.fn(),
  }),
}));

vi.mock('@/hooks/useHaptics', () => ({
  useHaptics: () => ({
    light: vi.fn(),
    medium: vi.fn(),
    heavy: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('TeacherClassroomAuditStudio Component Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly when open', () => {
    render(
      <TeacherClassroomAuditStudio
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/AI Dars Sifati & Pedagogik Audit Studiyasi/i)).toBeInTheDocument();
    expect(screen.getByText(/Umumiy Sifat Bahosi/i)).toBeInTheDocument();
    expect(screen.getByText(/Nutq Taqsimoti \(TTT \/ STT\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Blum Taksonomiyasi Bo‘yicha Savollar Chuqurligi/i)).toBeInTheDocument();
  });

  it('allows switching tabs to transcript and displays timestamped moments', async () => {
    render(
      <TeacherClassroomAuditStudio
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const transcriptTab = screen.getByText(/Dars Xronologiyasi/i);
    fireEvent.click(transcriptTab);

    await waitFor(() => {
      expect(screen.getByText(/Kognitiv Faollashtirish \(Hook\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Sokratik So‘roq va Chuqur Tahlil/i)).toBeInTheDocument();
    });
  });

  it('allows switching tabs to teacher growth plan', async () => {
    render(
      <TeacherClassroomAuditStudio
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const growthTab = screen.getByText(/Ustozning O‘sish Xaritasi/i);
    fireEvent.click(growthTab);

    await waitFor(() => {
      expect(screen.getByText(/14 Kunlik Shaxsiy Pedagogik O‘sish Xaritasi/i)).toBeInTheDocument();
    });
  });

  it('allows switching tabs to printable certificate', async () => {
    render(
      <TeacherClassroomAuditStudio
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const certTab = screen.getByText(/Rasmiy Attestatsiya Sertifikati/i);
    fireEvent.click(certTab);

    await waitFor(() => {
      expect(screen.getByText(/Pedagogik Mahorat & Dars Sifati Attestatsiya Sertifikati/i)).toBeInTheDocument();
      expect(screen.getByText(/A4 Sertifikatni Chop Etish/i)).toBeInTheDocument();
    });
  });
});
