import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportExportPage } from '../ImportExport';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as apiLib from '@/lib/api';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof apiLib>();
  return {
    ...actual,
    default: vi.fn(),
    downloadFile: vi.fn(),
  };
});

vi.mock('@/hooks/usePremiumSound', () => ({
  usePremiumSound: () => ({
    playTick: vi.fn(),
    playPop: vi.fn(),
    playSuccess: vi.fn(),
    playError: vi.fn(),
  }),
}));

vi.mock('@/components/ui/GlassToast', () => ({
  useToast: () => ({
    push: vi.fn(),
  }),
}));

describe('ImportExportPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    vi.mocked(apiLib.default).mockImplementation(async (path: any) => {
      if (path === '/imports') {
        return {
          items: [
            {
              id: 'job-1',
              entityType: 'STUDENT',
              fileName: 'students_list.xlsx',
              status: 'COMPLETED',
              total: 50,
              processed: 50,
              succeeded: 48,
              failed: 2,
              errors: [{ row: 12, message: 'Invalid phone format' }],
              startedAt: '2026-10-25T10:00:00.000Z',
              finishedAt: '2026-10-25T10:01:00.000Z',
            },
          ],
          total: 1,
        };
      }
      return {};
    });
  });

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {ui}
      </QueryClientProvider>
    );
  };

  it('renders KPI metrics and recent import job correctly', async () => {
    renderWithProviders(<ImportExportPage />);

    expect(await screen.findByText(/students_list\.xlsx/)).toBeInTheDocument();
    expect(screen.getByText(/STUDENT/)).toBeInTheDocument();
  });

  it('switches export format between Excel, CSV, and PDF and triggers export', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ImportExportPage />);

    // Format buttons
    const excelBtn = screen.getByRole('button', { name: /^Excel$/i });
    const csvBtn = screen.getByRole('button', { name: /^CSV$/i });
    const pdfBtn = screen.getByRole('button', { name: /^PDF$/i });

    expect(excelBtn).toBeInTheDocument();
    expect(csvBtn).toBeInTheDocument();
    expect(pdfBtn).toBeInTheDocument();

    // Switch to PDF
    await user.click(pdfBtn);

    // Click Export
    const exportBtn = screen.getByRole('button', { name: /Eksport|Export/i });
    await user.click(exportBtn);

    expect(apiLib.downloadFile).toHaveBeenCalledWith(
      expect.stringContaining('format=pdf'),
      expect.objectContaining({ defaultFilename: expect.stringContaining('.pdf') })
    );

    // Switch to Excel
    await user.click(excelBtn);
    await user.click(exportBtn);

    expect(apiLib.downloadFile).toHaveBeenCalledWith(
      expect.stringContaining('format=xlsx'),
      expect.objectContaining({ defaultFilename: expect.stringContaining('.xlsx') })
    );
  });

  it('triggers template download when download template button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ImportExportPage />);

    const templateBtn = screen.getByRole('button', { name: /Shablon|Template/i });
    await user.click(templateBtn);

    expect(apiLib.downloadFile).toHaveBeenCalledWith(
      expect.stringContaining('/template?entityType=STUDENT'),
      expect.objectContaining({ defaultFilename: 'student-template.csv' })
    );
  });
});
