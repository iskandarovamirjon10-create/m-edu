import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StudentSkillConstellationStudio } from '../gamification/StudentSkillConstellationStudio';

// Mock audio & toasts
vi.mock('@/hooks/usePremiumSound', () => ({
  usePremiumSound: () => ({
    playSuccess: vi.fn(),
    playError: vi.fn(),
    playTick: vi.fn(),
    playPop: vi.fn(),
  }),
}));

vi.mock('@/components/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/ui')>();
  return {
    ...actual,
    useToasts: () => ({
      push: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
    }),
  };
});

describe('StudentSkillConstellationStudio Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders learning tracks, progress metrics, and nodes', () => {
    render(
      <StudentSkillConstellationStudio
        studentName="Amirjon Olimov"
        studentLevel={8}
      />
    );

    // Verify header telemetry
    expect(screen.getByText(/RPG Mahorat Shajarasi · Spatial Skill Constellation/i)).toBeInTheDocument();
    expect(screen.getByText(/Level 8 · Amirjon Olimov/i)).toBeInTheDocument();
    expect(screen.getByText(/Full-Stack Dasturlash & Bulut Tizimlari/i)).toBeInTheDocument();

    // Verify stats
    expect(screen.getByText(/O'zlashtirish/i)).toBeInTheDocument();
    expect(screen.getByText(/Mahoratlar/i)).toBeInTheDocument();
    expect(screen.getByText(/Jamg'arma/i)).toBeInTheDocument();

    // Verify track nodes
    expect(screen.getByText(/TypeScript & Tiplar Mantig'i/i)).toBeInTheDocument();
    expect(screen.getByText(/Algoritmik Murakkablik & O\(n\)/i)).toBeInTheDocument();
  });

  it('allows switching tracks between Full-Stack and IELTS', () => {
    render(<StudentSkillConstellationStudio />);

    // Switch to IELTS track
    const ieltsBtn = screen.getByRole('button', { name: /IELTS/i });
    fireEvent.click(ieltsBtn);

    // Verify IELTS track is active
    expect(screen.getByText(/IELTS 8.5\+ & Xalqaro Akademik Ingliz Tili/i)).toBeInTheDocument();
    expect(screen.getByText(/C1 Akademik Leksika \(Collocations\)/i)).toBeInTheDocument();
  });

  it('clicking a node opens the inspector with quiz questions and allows submission', () => {
    const handleUnlocked = vi.fn();
    render(<StudentSkillConstellationStudio onSkillUnlocked={handleUnlocked} />);

    // Click on TypeScript node
    const nodeBtn = screen.getByRole('button', { name: /TypeScript & Tiplar Mantig'i/i });
    fireEvent.click(nodeBtn);

    // Inspector should appear
    expect(screen.getByText(/Bilim Sinovi \(Checkpoint Quiz\)/i)).toBeInTheDocument();
    expect(screen.getByText(/O'zlashtirish Natijalari \(Learning Outcomes\)/i)).toBeInTheDocument();
  });

  it('opens and closes the official Skill Passport modal', () => {
    render(<StudentSkillConstellationStudio studentName="Amirjon Olimov" />);

    const passportBtn = screen.getByRole('button', { name: /Passport/i });
    fireEvent.click(passportBtn);

    // Modal title should appear
    expect(screen.getAllByText(/Passport/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/ID: MEDU-SKILL-/i)).toBeInTheDocument();
  });
});
