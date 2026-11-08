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

vi.mock('@/lib/api', () => ({
  studentsApi: {
    list: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  },
}));

/** Haqiqiy API javobiga mos o'quvchi (qabul maydonlari hali to'ldirilmagan). */
const realStudent = {
  id: 'stu-1',
  user: {
    id: 'u-1',
    firstName: 'Sardor',
    lastName: 'Rahimov',
    email: 'sardor.rahimov@example.com',
    phone: '+998901234567',
    isActive: true,
  },
  parentPhone: '+998907654321',
} as any;

function renderWithStudent() {
  return render(
    <UniversityAdmissionPathfinder isOpen onClose={vi.fn()} students={[realStudent]} />,
  );
}

describe('UniversityAdmissionPathfinder Component Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an honest empty state instead of demo students', () => {
    render(<UniversityAdmissionPathfinder isOpen onClose={vi.fn()} students={[]} />);

    expect(screen.getAllByText(/AI Abituriyent & Karyera Admission Pathfinder/i)[0]).toBeInTheDocument();
    expect(screen.getByText(/Talabalar topilmadi/i)).toBeInTheDocument();
    expect(screen.queryByText(/Sardor Rahimov/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Madina Usmonova/i)).not.toBeInTheDocument();
  });

  it('renders a real student profile from the database', () => {
    renderWithStudent();

    expect(screen.getAllByText(/Sardor Rahimov/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Talaba:/i)).toBeInTheDocument();
    // OTM ma'lumotlari bazada yo'q — demo kartalar o'rniga tushunarli bo'sh holat
    expect(screen.getByText(/ma.lumotlari kiritilmagan/i)).toBeInTheDocument();
  });

  it('keeps destination filters working with real data', async () => {
    renderWithStudent();

    fireEvent.click(screen.getByText(/DTM Davlat OTMlari/i));

    await waitFor(() => {
      expect(screen.getByText(/Natija:/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Yangi O.zbekiston Universiteti/i)).not.toBeInTheDocument();
  });

  it('switches to gap analysis with an explicit empty state', async () => {
    renderWithStudent();

    fireEvent.click(screen.getByText(/90 Kunlik Reja/i));

    await waitFor(() => {
      expect(screen.getByText(/90 Kunlik Strategik/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/hali kiritilmagan/i)).toBeInTheDocument();
  });

  it('switches to career projection tab', async () => {
    renderWithStudent();

    fireEvent.click(screen.getByText(/Karyera Gorizonti/i));

    await waitFor(() => {
      expect(screen.getByText(/Kelajak Mutaxassislik Profili/i)).toBeInTheDocument();
    });
  });

  it('switches to printable roadmap tab', async () => {
    renderWithStudent();

    fireEvent.click(screen.getByText(/A4 Rasmiy Yo.l Xaritasi/i));

    await waitFor(() => {
      expect(
        screen.getByText(/Shaxsiy Abituriyent & Karyera Yo.l Xaritasi/i),
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/A4 Karyera Pasportini Chop Etish/i)).toBeInTheDocument();
  });
});
