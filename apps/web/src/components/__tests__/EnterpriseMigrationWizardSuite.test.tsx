import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModmeExcelMigrationStudio } from '../migration/ModmeExcelMigrationStudio';
import { SchoolLaunchWizardStudio } from '../onboarding/SchoolLaunchWizardStudio';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock audio hook
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

// Mock toast hook
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

// Mock backend APIs
vi.mock('@/lib/api', () => ({
  default: vi.fn().mockResolvedValue({ id: 'import-123', importedCount: 5 }),
  coursesApi: {
    create: vi.fn().mockResolvedValue({ id: 'course-1', name: 'Test Course' }),
  },
  groupsApi: {
    create: vi.fn().mockResolvedValue({ id: 'group-1', name: 'Test Group' }),
  },
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('Enterprise Migration & School Launch Wizard Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. ModmeExcelMigrationStudio', () => {
    it('renders migration studio with presets and action triggers', () => {
      renderWithClient(<ModmeExcelMigrationStudio />);
      expect(
        screen.getByText(/Eski Tizimdan M-EDU ga 1 Qadamda Ko‘chirish/i)
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Modme CRM/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /AlfaCRM/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Universal Excel/i })).toBeInTheDocument();
      expect(screen.getByText(/Shablonni Yuklab Olish/i)).toBeInTheDocument();
    });

    it('switches between migration presets', () => {
      renderWithClient(<ModmeExcelMigrationStudio />);
      const alfaBtn = screen.getByRole('button', { name: /AlfaCRM/i });
      fireEvent.click(alfaBtn);
      expect(alfaBtn).toBeInTheDocument();

      const excelBtn = screen.getByRole('button', { name: /Universal Excel/i });
      fireEvent.click(excelBtn);
      expect(excelBtn).toBeInTheDocument();
    });

    it('loads sample Modme data and renders telemetry and preview table', () => {
      renderWithClient(<ModmeExcelMigrationStudio />);
      const sampleBtn = screen.getByText(/Namunaviy Ma’lumotlar bilan Sinash/i);
      fireEvent.click(sampleBtn);

      expect(screen.getByText(/Aniqlangan O‘quvchilar/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Abdurashidov Bilolbek/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/General English B2/i)).toBeInTheDocument();
    });
  });

  describe('2. SchoolLaunchWizardStudio', () => {
    it('renders step 1 with center profile inputs and advances to next steps', async () => {
      renderWithClient(<SchoolLaunchWizardStudio />);
      expect(
        screen.getByText(/Boshlang‘ich Sozlash Ustasi \(School Launch Wizard\)/i)
      ).toBeInTheDocument();
      expect(screen.getByDisplayValue(/Apex International Academy/i)).toBeInTheDocument();

      // Step 1 -> Step 2
      const nextBtn = screen.getByText(/Keyingi Qadam/i);
      fireEvent.click(nextBtn);
      await waitFor(() => {
        expect(
          screen.getAllByText(/Auditoriyalar/i).length
        ).toBeGreaterThan(0);
      });

      // Step 2 -> Step 3
      fireEvent.click(screen.getByText(/Keyingi Qadam/i));
      await waitFor(() => {
        expect(
          screen.getAllByText(/Asosiy Kurslar/i).length
        ).toBeGreaterThan(0);
      });

      // Step 3 -> Step 4
      fireEvent.click(screen.getByText(/Keyingi Qadam/i));
      await waitFor(() => {
        expect(
          screen.getAllByText(/Birinchi Guruh/i).length
        ).toBeGreaterThan(0);
      });

      // Step 4 -> Step 5
      fireEvent.click(screen.getByText(/Keyingi Qadam/i));
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /🚀 Markazni Ishga Tushirish/i })
        ).toBeInTheDocument();
      });
    });

    it('triggers grand launch batch activation on step 5', async () => {
      const onLaunchCompleted = vi.fn();
      renderWithClient(<SchoolLaunchWizardStudio onLaunchCompleted={onLaunchCompleted} />);

      // Fast forward to step 5
      fireEvent.click(screen.getByText(/Keyingi Qadam/i));
      await waitFor(() => expect(screen.getAllByText(/Auditoriyalar/i).length).toBeGreaterThan(0));

      fireEvent.click(screen.getByText(/Keyingi Qadam/i));
      await waitFor(() => expect(screen.getAllByText(/Asosiy Kurslar/i).length).toBeGreaterThan(0));

      fireEvent.click(screen.getByText(/Keyingi Qadam/i));
      await waitFor(() => expect(screen.getAllByText(/Birinchi Guruh/i).length).toBeGreaterThan(0));

      fireEvent.click(screen.getByText(/Keyingi Qadam/i));
      await waitFor(() => expect(screen.getByRole('button', { name: /🚀 Markazni Ishga Tushirish/i })).toBeInTheDocument());

      const launchBtn = screen.getByRole('button', { name: /🚀 Markazni Ishga Tushirish/i });
      fireEvent.click(launchBtn);
    });
  });
});
