/**
 * Unit & Integration Test Suite for SubjectsPage (Apple 10/10 VisionOS Edition)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '@/i18n/I18nProvider';
import {
  SubjectsPage,
  codeHash,
  codeTone,
  safeErrorMessage,
} from '../Subjects';
import { openSidecar } from '@/stores/ui.store';

// Mock ui.store
vi.mock('@/stores/ui.store', () => ({
  openSidecar: vi.fn(),
}));

// Mock sound hook
vi.mock('@/hooks/usePremiumSound', () => ({
  usePremiumSound: () => ({
    playTick: vi.fn(),
    playPop: vi.fn(),
    playSuccess: vi.fn(),
    playError: vi.fn(),
  }),
}));

const { mockListSubjects, mockCreateSubject, mockUpdateSubject, mockDeleteSubject } =
  vi.hoisted(() => ({
    mockListSubjects: vi.fn(),
    mockCreateSubject: vi.fn(),
    mockUpdateSubject: vi.fn(),
    mockDeleteSubject: vi.fn(),
  }));

vi.mock('@/lib/api', () => {
  class ApiError extends Error {
    status: number;
    code?: string;
    constructor(message: string, status = 500, code?: string) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.code = code;
    }
  }
  return {
    ApiError,
    subjectsApi: {
      list: (...args: unknown[]) => mockListSubjects(...args),
      create: (...args: unknown[]) => mockCreateSubject(...args),
      update: (...args: unknown[]) => mockUpdateSubject(...args),
      delete: (...args: unknown[]) => mockDeleteSubject(...args),
    },
  };
});

const mockSubjectsList = [
  {
    id: 'subj-1',
    code: 'ENG101',
    name: 'General English B2',
    department: 'Foreign Languages',
    isActive: true,
  },
  {
    id: 'subj-2',
    code: 'MTH201',
    name: 'Advanced Mathematics',
    department: 'Exact Sciences',
    isActive: true,
  },
  {
    id: 'subj-3',
    code: 'HIS101',
    name: 'World History',
    department: 'Social Sciences',
    isActive: false,
  },
];

function renderComponent() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <MemoryRouter>
          <SubjectsPage />
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe('SubjectsPage (Apple 10/10 VisionOS Edition)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListSubjects.mockResolvedValue({ items: mockSubjectsList, total: 3 });
    mockCreateSubject.mockResolvedValue({ id: 'subj-new-4' });
    mockUpdateSubject.mockResolvedValue({ id: 'subj-1' });
    mockDeleteSubject.mockResolvedValue({ success: true });
  });

  /* --------------------------------------------------------------------------
   * 1. PURE HELPERS TEST SUITE
   * ------------------------------------------------------------------------ */
  describe('Pure Helpers and Domain Logic', () => {
    it('codeHash generates positive deterministic hash values', () => {
      const h1 = codeHash('ENG101');
      const h2 = codeHash('ENG101');
      expect(h1).toBe(h2);
      expect(h1).toBeGreaterThanOrEqual(0);
    });

    it('codeTone resolves a valid theme tone from palettes', () => {
      const tone = codeTone('ENG101');
      expect(['blue', 'purple', 'green', 'orange', 'red', 'cyan']).toContain(tone);
    });

    it('safeErrorMessage safely parses errors or provides fallback', () => {
      expect(safeErrorMessage(new Error('Network error'), 'Fallback')).toBe('Network error');
      expect(safeErrorMessage({ message: 'Object error' }, 'Fallback')).toBe('Object error');
      expect(safeErrorMessage('Direct string error', 'Fallback')).toBe('Direct string error');
      expect(safeErrorMessage(null, 'Fallback string')).toBe('Fallback string');
    });
  });

  /* --------------------------------------------------------------------------
   * 2. RENDERING & FILTERING TEST SUITE
   * ------------------------------------------------------------------------ */
  describe('Rendering, Search, and Filtering', () => {
    it('renders loading skeleton when fetching data', () => {
      mockListSubjects.mockReturnValue(new Promise(() => {}));
      renderComponent();
      expect(screen.getByTestId('subjects-skeleton')).toBeInTheDocument();
    });

    it('renders error state and handles retry action', async () => {
      mockListSubjects.mockRejectedValueOnce(new Error('Connection failure'));
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Failed to load subjects|xatolik yuz berdi/i)).toBeInTheDocument();
      });

      mockListSubjects.mockResolvedValueOnce({ items: mockSubjectsList, total: 3 });
      const retryBtn = screen.getByRole('button', { name: /retry|qayta urinish/i });
      fireEvent.click(retryBtn);

      await waitFor(() => {
        expect(mockListSubjects).toHaveBeenCalledTimes(2);
      });
    });

    it('renders subject list in editorial view mode by default', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('General English B2')).toBeInTheDocument();
        expect(screen.getByText('Advanced Mathematics')).toBeInTheDocument();
        expect(screen.getByText('World History')).toBeInTheDocument();
      });

      // Numerals rendered
      expect(screen.getAllByText('01').length).toBeGreaterThan(0);
      expect(screen.getAllByText('02').length).toBeGreaterThan(0);
      expect(screen.getAllByText('03').length).toBeGreaterThan(0);
    });

    it('switches view mode between Editorial list and Bento grid', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('General English B2')).toBeInTheDocument();
      });

      // Switch to Bento / Grid
      const bentoToggle = screen.getByRole('button', { name: /Grid|Bento/i });
      fireEvent.click(bentoToggle);

      expect(bentoToggle).toHaveAttribute('aria-pressed', 'true');
    });

    it('filters subjects by status: Active, Archived, and All', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('General English B2')).toBeInTheDocument();
      });

      // Click "Active" filter
      const activeFilterBtn = screen.getByRole('button', { name: /Faol fanlar|Active/i });
      fireEvent.click(activeFilterBtn);

      await waitFor(() => {
        expect(screen.getByText('General English B2')).toBeInTheDocument();
        expect(screen.getByText('Advanced Mathematics')).toBeInTheDocument();
        // Inactive World History should be filtered out
        expect(screen.queryByText('World History')).not.toBeInTheDocument();
      });

      // Click "Archived" filter
      const archivedFilterBtn = screen.getByRole('button', { name: /Arxiv|Archived/i });
      fireEvent.click(archivedFilterBtn);

      await waitFor(() => {
        expect(screen.queryByText('General English B2')).not.toBeInTheDocument();
        expect(screen.getByText('World History')).toBeInTheDocument();
      });
    });

    it('filters subjects by department rail selection', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('General English B2')).toBeInTheDocument();
      });

      // Click department "Exact Sciences"
      const deptBtn = screen.getByRole('button', { name: /Exact Sciences/i });
      fireEvent.click(deptBtn);

      await waitFor(() => {
        expect(screen.getByText('Advanced Mathematics')).toBeInTheDocument();
        expect(screen.queryByText('General English B2')).not.toBeInTheDocument();
      });
    });

    it('opens sidecar drawer when clicking Sidecar button on subject row', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('General English B2')).toBeInTheDocument();
      });

      const sidecarBtns = screen.getAllByLabelText(/Split-view sidecar/i);
      fireEvent.click(sidecarBtns[0]);

      // Items are sorted alphabetically by default ('Advanced Mathematics' -> subj-2)
      expect(openSidecar).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'subj-2',
          title: 'Advanced Mathematics',
        }),
      );
    });
  });

  /* --------------------------------------------------------------------------
   * 3. MUTATIONS & MODAL ACTIONS
   * ------------------------------------------------------------------------ */
  describe('Modals & Mutations (Create, Edit, Archive)', () => {
    it('opens create modal, fills form, and submits new subject', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('General English B2')).toBeInTheDocument();
      });

      const addBtn = screen.getByRole('button', { name: /Fan qo‘shish|Add/i });
      fireEvent.click(addBtn);

      // Modal is open
      await waitFor(() => {
        expect(screen.getByTestId('subject-name-input')).toBeInTheDocument();
      });

      // Fill in Name
      fireEvent.change(screen.getByTestId('subject-name-input'), { target: { value: 'Physics 101' } });

      // Fill in Code
      fireEvent.change(screen.getByTestId('subject-code-input'), { target: { value: 'PHY101' } });

      // Fill in Department
      fireEvent.change(screen.getByTestId('subject-dept-input'), { target: { value: 'Exact Sciences' } });

      // Submit
      const submitBtn = screen.getByTestId('subject-submit-button');
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockCreateSubject).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Physics 101',
            code: 'PHY101',
            department: 'Exact Sciences',
          }),
        );
      });
    });

    it('opens edit modal with pre-populated data and updates subject', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('General English B2')).toBeInTheDocument();
      });

      // First item in alphabetical order is 'Advanced Mathematics' (subj-2)
      const editBtns = screen.getAllByLabelText(/Tahrirlash|Edit/i);
      fireEvent.click(editBtns[0]);

      await waitFor(() => {
        expect(screen.getByTestId('subject-name-input')).toHaveValue('Advanced Mathematics');
        expect(screen.getByTestId('subject-code-input')).toHaveValue('MTH201');
      });

      // Change name
      fireEvent.change(screen.getByTestId('subject-name-input'), { target: { value: 'Higher Mathematics' } });

      // Submit update
      const saveBtn = screen.getByTestId('subject-submit-button');
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockUpdateSubject).toHaveBeenCalledWith(
          'subj-2',
          expect.objectContaining({
            name: 'Higher Mathematics',
          }),
        );
      });
    });

    it('archives active subject when clicking archive button', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('General English B2')).toBeInTheDocument();
      });

      // First item in alphabetical order is 'Advanced Mathematics' (subj-2, active)
      const archiveBtns = screen.getAllByLabelText(/Arxivlash|Deactivate/i);
      fireEvent.click(archiveBtns[0]);

      await waitFor(() => {
        expect(mockDeleteSubject).toHaveBeenCalledWith('subj-2');
      });
    });
  });
});
