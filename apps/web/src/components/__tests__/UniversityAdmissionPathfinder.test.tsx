import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UniversityAdmissionPathfinder } from '../students/UniversityAdmissionPathfinder';

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

describe('UniversityAdmissionPathfinder Component Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders student telemetry, target field, and university cards', () => {
    render(
      <UniversityAdmissionPathfinder
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/AI Abituriyent & Karyera Admission Pathfinder/i)).toBeInTheDocument();
    expect(screen.getByText(/Sardor Rahimov/i)).toBeInTheDocument();
    expect(screen.getByText(/7.5 Band/i)).toBeInTheDocument();
    expect(screen.getByText(/Yangi O‘zbekiston Universiteti/i)).toBeInTheDocument();
    expect(screen.getByText(/WIUT/i)).toBeInTheDocument();
  });

  it('allows filtering by destination categories', async () => {
    render(
      <UniversityAdmissionPathfinder
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const dtmFilter = screen.getByText(/DTM Davlat OTMlari/i);
    fireEvent.click(dtmFilter);

    await waitFor(() => {
      expect(screen.getByText(/O‘zbekiston Milliy Universiteti/i)).toBeInTheDocument();
      expect(screen.queryByText(/Yangi O‘zbekiston Universiteti/i)).not.toBeInTheDocument();
    });
  });

  it('allows switching to gap analysis tab', async () => {
    render(
      <UniversityAdmissionPathfinder
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const gapTab = screen.getByText(/Bo‘shliqlarni To‘ldirish/i);
    fireEvent.click(gapTab);

    await waitFor(() => {
      expect(screen.getByText(/90 Kunlik Strategik Bo‘shliqlarni To‘ldirish Xaritasi/i)).toBeInTheDocument();
    });
  });

  it('allows switching to career and salary projection tab', async () => {
    render(
      <UniversityAdmissionPathfinder
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const careerTab = screen.getByText(/Karyera Gorizonti/i);
    fireEvent.click(careerTab);

    await waitFor(() => {
      expect(screen.getByText(/Kelajak Mutaxassislik Profili/i)).toBeInTheDocument();
      expect(screen.getAllByText(/AI & Machine Learning Solutions Architect/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('allows switching to printable roadmap tab', async () => {
    render(
      <UniversityAdmissionPathfinder
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const roadmapTab = screen.getByText(/A4 Rasmiy Yo‘l Xaritasi/i);
    fireEvent.click(roadmapTab);

    await waitFor(() => {
      expect(screen.getByText(/Shaxsiy Abituriyent & Karyera Yo‘l Xaritasi/i)).toBeInTheDocument();
      expect(screen.getByText(/A4 Karyera Pasportini Chop Etish/i)).toBeInTheDocument();
    });
  });
});
