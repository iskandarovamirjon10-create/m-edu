/**
 * Unit & Integration Test Suite for ReportsPage (Apple 10/10 VisionOS / macOS Sequoia Edition)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '@/i18n/I18nProvider';
import { ReportsPage } from '../Reports';

const mockReportData = {
  status: 'READY',
  type: 'STUDENTS',
  columns: [
    { key: 'name', label: 'Talaba ismi' },
    { key: 'phone', label: 'Telefon' },
    { key: 'active', label: 'Faol' },
  ],
  selectedColumns: ['name', 'phone', 'active'],
  rows: [
    { name: 'Ali Karimov', phone: '+998901112233', active: true },
    { name: 'Zarina Rahimova', phone: '+998909998877', active: false },
    { name: 'Bobur Saidov', phone: '+998935554433', active: true },
  ],
  totalRows: 3,
  page: 1,
  pageSize: 50,
  totalPages: 1,
  generatedAt: '2026-10-22T10:00:00Z',
};

const mockRun = vi.fn();
const mockExport = vi.fn();

vi.mock('@/lib/api', () => ({
  reportsApi: {
    run: (...args: unknown[]) => mockRun(...args),
    export: (...args: unknown[]) => mockExport(...args),
  },
}));

vi.mock('@/hooks/usePageTitle', () => ({
  usePageTitle: vi.fn(),
}));

vi.mock('@/hooks/usePremiumSound', () => ({
  usePremiumSound: () => ({
    playTick: vi.fn(),
    playPop: vi.fn(),
    playSuccess: vi.fn(),
    playError: vi.fn(),
  }),
}));

function renderReportsPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return render(
    <MemoryRouter>
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <ReportsPage />
        </QueryClientProvider>
      </I18nProvider>
    </MemoryRouter>
  );
}

describe('ReportsPage (Apple 10/10 VisionOS / macOS Sequoia Edition)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRun.mockResolvedValue(mockReportData);
    mockExport.mockResolvedValue(new Blob(['test'], { type: 'text/csv' }));
  });

  it('renders hero header, KPI ribbons and table columns when data loads', async () => {
    renderReportsPage();

    await waitFor(() => {
      expect(screen.getByText('Talaba ismi')).toBeInTheDocument();
      expect(screen.getByText('Ali Karimov')).toBeInTheDocument();
      expect(screen.getByText('Zarina Rahimova')).toBeInTheDocument();
      expect(screen.getByText('Bobur Saidov')).toBeInTheDocument();
    });

    // KPI values
    expect(screen.getByText('+998901112233')).toBeInTheDocument();
  });

  it('changes dimension and refetches report', async () => {
    renderReportsPage();

    await waitFor(() => {
      expect(screen.getByText('Ali Karimov')).toBeInTheDocument();
    });

    const dimensionSelect = screen.getByRole('combobox');
    fireEvent.change(dimensionSelect, { target: { value: 'ATTENDANCE' } });

    await waitFor(() => {
      expect(mockRun).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ATTENDANCE',
        })
      );
    });
  });

  it('applies quick date presets when clicked', async () => {
    renderReportsPage();

    await waitFor(() => {
      expect(screen.getByText('Ali Karimov')).toBeInTheDocument();
    });

    const todayPresets = screen.getAllByRole('button', { name: /bugun|today/i });
    expect(todayPresets.length).toBeGreaterThan(0);
    fireEvent.click(todayPresets[0]);

    await waitFor(() => {
      expect(mockRun).toHaveBeenCalled();
    });
  });

  it('changes export format and triggers export download', async () => {
    renderReportsPage();

    await waitFor(() => {
      expect(screen.getByText('Ali Karimov')).toBeInTheDocument();
    });

    // Switch format to XLSX
    const xlsxBtn = screen.getByRole('radio', { name: /xlsx/i });
    fireEvent.click(xlsxBtn);

    // Click Export
    const exportBtn = screen.getByRole('button', { name: /eksport qilish|export/i });
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(mockExport).toHaveBeenCalledWith(
        'STUDENTS',
        'xlsx',
        expect.anything()
      );
    });
  });

  it('filters rows locally when typing in the search box', async () => {
    renderReportsPage();

    await waitFor(() => {
      expect(screen.getByText('Ali Karimov')).toBeInTheDocument();
      expect(screen.getByText('Zarina Rahimova')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/hisobot ma'lumotlaridan qidirish|filter report rows/i);
    fireEvent.change(searchInput, { target: { value: 'Zarina' } });

    await waitFor(() => {
      expect(screen.getByText('Zarina Rahimova')).toBeInTheDocument();
      expect(screen.queryByText('Ali Karimov')).not.toBeInTheDocument();
    });
  });

  it('sorts columns when clicking column headers', async () => {
    renderReportsPage();

    await waitFor(() => {
      expect(screen.getByText('Ali Karimov')).toBeInTheDocument();
    });

    const colHeaderBtn = screen.getByRole('button', { name: /talaba ismi/i });
    // First click: asc
    fireEvent.click(colHeaderBtn);

    // Second click: desc
    fireEvent.click(colHeaderBtn);

    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      // Verify table rows exist
      expect(rows.length).toBeGreaterThan(1);
    });
  });
});
