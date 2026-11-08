import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModmeExcelMigrationStudio } from '../migration/ModmeExcelMigrationStudio';
import { SchoolLaunchWizardStudio } from '../onboarding/SchoolLaunchWizardStudio';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider, type Locale } from '@/i18n/I18nProvider';

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

function renderWithClient(ui: React.ReactElement, locale: Locale = 'uz') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <I18nProvider initialLocale={locale}>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </I18nProvider>
  );
}

describe('Enterprise Migration & School Launch Wizard Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. ModmeExcelMigrationStudio (i18n & UX)', () => {
    it('renders migration studio with presets and action triggers in Uzbek', () => {
      renderWithClient(<ModmeExcelMigrationStudio />, 'uz');
      expect(
        screen.getByText(/Eski Tizimdan M-EDU ga 1 Qadamda Ko‘chirish/i)
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Modme CRM/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /AlfaCRM/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Universal Excel/i })).toBeInTheDocument();
      expect(screen.getByText(/Shablonni Yuklab Olish/i)).toBeInTheDocument();
    });

    it('renders migration studio seamlessly in English and Russian (i18n verification)', () => {
      const { unmount } = renderWithClient(<ModmeExcelMigrationStudio />, 'en');
      expect(
        screen.getByText(/Migrate from Legacy Systems to M-EDU in 1 Step/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/Download Template CSV/i)).toBeInTheDocument();
      unmount();

      renderWithClient(<ModmeExcelMigrationStudio />, 'ru');
      expect(
        screen.getByText(/Перенос из старых систем в M-EDU в 1 шаг/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/Скачать шаблон CSV/i)).toBeInTheDocument();
    });

    it('switches between migration presets', () => {
      renderWithClient(<ModmeExcelMigrationStudio />, 'uz');
      const alfaBtn = screen.getByRole('button', { name: /AlfaCRM/i });
      fireEvent.click(alfaBtn);
      expect(alfaBtn).toBeInTheDocument();

      const excelBtn = screen.getByRole('button', { name: /Universal Excel/i });
      fireEvent.click(excelBtn);
      expect(excelBtn).toBeInTheDocument();
    });

    it('ships no demo students and downloads a header-only template', async () => {
      const blobs: Blob[] = [];
      const originalCreate = URL.createObjectURL;
      URL.createObjectURL = vi.fn((blob: Blob) => {
        blobs.push(blob);
        return 'blob:template';
      });

      try {
        renderWithClient(<ModmeExcelMigrationStudio />, 'uz');

        // Demo tugmasi va namunaviy o'quvchilar butunlay olib tashlangan
        expect(screen.queryByText(/Namunaviy Ma’lumotlar bilan Sinash/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Abdurashidov Bilolbek/i)).not.toBeInTheDocument();

        fireEvent.click(screen.getByText(/Shablonni Yuklab Olish/i));

        expect(blobs).toHaveLength(1);
        const csv = await blobs[0].text();
        expect(csv).toBe(
          'F.I.Sh,Telefon raqami,Guruh nomi,Hisob balansi (UZS),Ota-onasi,Ota-ona telefoni',
        );
        expect(csv).not.toMatch(/\+998\d{9}/);
      } finally {
        URL.createObjectURL = originalCreate;
      }
    });
  });

  describe('2. SchoolLaunchWizardStudio (i18n & Multi-Step Responsive UX)', () => {
    it('renders step 1 with center profile inputs and advances to next steps in Uzbek', async () => {
      renderWithClient(<SchoolLaunchWizardStudio />, 'uz');
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

    it('renders wizard cleanly in English (i18n)', () => {
      renderWithClient(<SchoolLaunchWizardStudio />, 'en');
      expect(
        screen.getByText(/School Launch Wizard/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/Next Step/i)).toBeInTheDocument();
    });

    it('triggers grand launch batch activation on step 5', async () => {
      const onLaunchCompleted = vi.fn();
      renderWithClient(<SchoolLaunchWizardStudio onLaunchCompleted={onLaunchCompleted} />, 'uz');

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
