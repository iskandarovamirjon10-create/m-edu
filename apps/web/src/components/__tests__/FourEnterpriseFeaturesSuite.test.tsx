import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StudentCareerPathwayStudio } from '../career/StudentCareerPathwayStudio';
import { FranchiseNetworkCommandStudio } from '../franchise/FranchiseNetworkCommandStudio';
import { CampusDigitalSignageStudio } from '../campus/CampusDigitalSignageStudio';
import { SmartDebtCollectionStudio } from '../finance/SmartDebtCollectionStudio';

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
    useToast: () => ({
      push: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
    }),
  };
});

vi.mock('@/lib/api', () => ({
  studentsApi: {
    list: vi.fn().mockResolvedValue({
      items: [
        {
          id: 'st-1',
          firstName: 'Jasur',
          lastName: 'Bekmurodov',
          balanceUzs: -750000,
          phone: '+998 90 123 45 67',
        },
      ],
    }),
  },
  branchesApi: {
    list: vi.fn().mockResolvedValue({
      items: [
        {
          id: 'b-1',
          name: 'Toshkent Bosh Filiali',
          city: 'Toshkent',
          monthlyTurnover: 120000000,
          status: 'ACTIVE',
        },
        {
          id: 'b-2',
          name: 'Samarqand Franshiza Markazi',
          city: 'Samarqand',
          monthlyTurnover: 70000000,
          status: 'ACTIVE',
        },
      ],
    }),
  },
  scheduleApi: {
    list: vi.fn().mockResolvedValue({
      items: [
        {
          id: 'sch-1',
          room: 'Auditoriya 101',
          startTime: '09:00',
          endTime: '10:30',
          teacherName: 'Aziz Rahimov',
        },
      ],
    }),
  },
  attendanceApi: {
    list: vi.fn().mockResolvedValue({
      items: [
        {
          id: 'att-1',
          student: { firstName: 'Temur', lastName: 'Oripov' },
          checkInTime: new Date().toISOString(),
          status: 'ON_TIME',
        },
      ],
    }),
  },
  paymentsApi: {
    createPayment: vi.fn().mockResolvedValue({ success: true }),
  },
}));

describe('Four Enterprise Features Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. StudentCareerPathwayStudio renders university matcher, GPA metrics and dossier export', async () => {
    render(<StudentCareerPathwayStudio />);

    expect(screen.getByText(/Talaba Karyera & Universitet Yo‘nalishi Matritsasi/i)).toBeInTheDocument();
    expect(screen.getByText(/AI Admission & Career Pathway Engine/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Jasur Bekmurodov/i)).toBeInTheDocument();
      expect(screen.getByText(/Yangi O‘zbekiston Universiteti/i)).toBeInTheDocument();
      expect(screen.getByText(/Westminster International University in Tashkent/i)).toBeInTheDocument();
    });

    const exportBtn = screen.getByRole('button', { name: /Akademik Dossier \(PDF\)/i });
    fireEvent.click(exportBtn);
  });

  it('2. FranchiseNetworkCommandStudio renders multi-branch network and calculates royalty', async () => {
    render(<FranchiseNetworkCommandStudio />);

    expect(screen.getByText(/Franshiza & Ko‘p Filialli Boshqaruv Markazi/i)).toBeInTheDocument();
    expect(screen.getByText(/Franchise & Multi-Campus Command HQ/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText(/Toshkent Bosh Filiali/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Samarqand Franshiza Markazi/i)).toBeInTheDocument();
    });

    const exportBtn = screen.getByRole('button', { name: /Konsolidatsiyalangan Hisobot \(Excel\)/i });
    fireEvent.click(exportBtn);
  });

  it('3. CampusDigitalSignageStudio renders live TV kiosk clock, room timetable and turnstile feed', async () => {
    render(<CampusDigitalSignageStudio campusName="Toshkent IT Akademiyasi" />);

    expect(screen.getByText(/Toshkent IT Akademiyasi/i)).toBeInTheDocument();
    expect(screen.getByText(/Live Signage Kiosk/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Auditoriya 101/i)).toBeInTheDocument();
      expect(screen.getByText(/Temur Oripov/i)).toBeInTheDocument();
    });

    const emergencyBtn = screen.getByRole('button', { name: /Favqulodda E’lon/i });
    fireEvent.click(emergencyBtn);
    expect(screen.getByText(/DIQQAT! 15 daqiqadan so‘ng barcha guruhlar uchun/i)).toBeInTheDocument();
  });

  it('4. SmartDebtCollectionStudio renders aging buckets and generates installment agreement', async () => {
    render(<SmartDebtCollectionStudio />);

    expect(screen.getByText(/Qarzdorlikni Undirish & Naqd Pul Oqimi Nazorati/i)).toBeInTheDocument();
    expect(screen.getByText(/Predictive Cashflow & AI Debt Recovery/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText(/Jasur Bekmurodov/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/750.*000.*UZS/i).length).toBeGreaterThan(0);
    });

    const linkBtn = screen.getByRole('button', { name: /To‘lov Havolasi/i });
    fireEvent.click(linkBtn);

    const contractBtn = screen.getByRole('button', { name: /Muddatli To‘lov Bitimi/i });
    fireEvent.click(contractBtn);
  });
});
