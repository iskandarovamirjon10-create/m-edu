import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StudentActivityRingsPassport } from '../StudentActivityRingsPassport';

describe('StudentActivityRingsPassport', () => {
  const mockMetrics = {
    studentId: 'STU-9921',
    studentName: 'Temur Aliyev',
    groupName: 'Frontend Pro-24',
    attendanceRate: 94,
    attendanceStreakDays: 14,
    academicMastery: 88,
    homeworkRate: 92,
    completedHomeworks: 23,
    totalHomeworks: 25,
  };

  it('renders concentric rings header and student activity metrics', () => {
    render(<StudentActivityRingsPassport metrics={mockMetrics} />);

    expect(screen.getByText(/Rivojlanish Halqalari & Smart Pasport/i)).toBeInTheDocument();
    expect(screen.getByText(/ Fitness Rings/i)).toBeInTheDocument();
    expect(screen.getByText(/14 kunlik streak 🔥/i)).toBeInTheDocument();
    expect(screen.getByText(/94%/i)).toBeInTheDocument();
    expect(screen.getByText(/88%/i)).toBeInTheDocument();
    expect(screen.getByText(/92%/i)).toBeInTheDocument();
  });

  it('switches active ring tabs smoothly', () => {
    render(<StudentActivityRingsPassport metrics={mockMetrics} />);

    const davomatBtn = screen.getByRole('button', { name: /Davomat/i });
    fireEvent.click(davomatBtn);
    expect(davomatBtn).toHaveClass('bg-rose-500');

    const akademikBtn = screen.getByRole('button', { name: /Akademik/i });
    fireEvent.click(akademikBtn);
    expect(akademikBtn).toHaveClass('bg-emerald-500');
  });

  it('renders AI diagnostic recommendations', () => {
    render(<StudentActivityRingsPassport metrics={mockMetrics} />);

    expect(screen.getByText(/Sun'iy Intellekt Tahlili & Ota-Onalar Tavsiyasi/i)).toBeInTheDocument();
    expect(screen.getByText(/✦ Kuchli tomoni:/i)).toBeInTheDocument();
    expect(screen.getByText(/⚡ O'sish nuqtasi:/i)).toBeInTheDocument();
    expect(screen.getByText(/🎯 Ota-onaga tavsiya:/i)).toBeInTheDocument();
  });

  it('contains story/passport export action button', () => {
    render(<StudentActivityRingsPassport metrics={mockMetrics} />);

    const exportBtn = screen.getByRole('button', { name: /Story \/ Pasport Yuklab Olish/i });
    expect(exportBtn).toBeInTheDocument();
  });
});
