/**
 * Comprehensive Vitest Suite for CurriculumPage (Apple 10/10 visionOS Edition)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  CurriculumPage,
  codeHash,
  curriculumTone,
  statusTone,
  getInitials,
  computeCurriculumStats,
  type Curriculum,
} from '../Curriculum';
import { curriculumApi, subjectsApi } from '@/lib/api';
import { openSidecar } from '@/stores/ui.store';

/* --------------------------------------------------------------------------
 * MOCKS
 * ------------------------------------------------------------------------ */

vi.mock('@/lib/api', () => ({
  curriculumApi: {
    list: vi.fn(),
    create: vi.fn(),
  },
  subjectsApi: {
    list: vi.fn(),
  },
}));

vi.mock('@/stores/ui.store', () => ({
  openSidecar: vi.fn(),
}));

vi.mock('@/hooks/usePremiumSound', () => ({
  usePremiumSound: () => ({
    playTick: vi.fn(),
    playPop: vi.fn(),
    playSuccess: vi.fn(),
    playError: vi.fn(),
  }),
}));

vi.mock('@/i18n/I18nProvider', () => ({
  useSafeI18n: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
    locale: 'uz',
  }),
}));

/* --------------------------------------------------------------------------
 * FIXTURES
 * ------------------------------------------------------------------------ */

const mockSubjects = {
  items: [
    { id: 'sub-1', name: 'Ingliz tili', code: 'ENG' },
    { id: 'sub-2', name: 'Matematika', code: 'MATH' },
  ],
};

const mockCurriculums: Curriculum[] = [
  {
    id: 'cur-1',
    name: 'General English B2',
    version: 1,
    status: 'PUBLISHED',
    subject: { id: 'sub-1', name: 'Ingliz tili', code: 'ENG' },
    _count: { modules: 6 },
  },
  {
    id: 'cur-2',
    name: 'Algebra Asoslari',
    version: 2,
    status: 'DRAFT',
    subject: { id: 'sub-2', name: 'Matematika', code: 'MATH' },
    _count: { modules: 4 },
  },
  {
    id: 'cur-3',
    name: 'Kids Phonics Master',
    version: 1,
    status: 'ARCHIVED',
    subject: null,
    _count: { modules: 2 },
  },
];

function renderWithClient() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <CurriculumPage />
    </QueryClientProvider>,
  );
}

/* --------------------------------------------------------------------------
 * TESTS
 * ------------------------------------------------------------------------ */

describe('CurriculumPage (Apple 10/10 visionOS Edition)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (subjectsApi.list as any).mockResolvedValue(mockSubjects);
    (curriculumApi.list as any).mockResolvedValue(mockCurriculums);
    (curriculumApi.create as any).mockResolvedValue({ id: 'cur-new', name: 'New Curriculum' });
  });

  /* --------------------------------------------------------------------------
   * 1. PURE DOMAIN HELPERS
   * ------------------------------------------------------------------------ */
  describe('Pure Domain Helpers', () => {
    it('codeHash generates deterministic non-negative hash', () => {
      const h1 = codeHash('General English');
      const h2 = codeHash('General English');
      expect(h1).toBe(h2);
      expect(h1).toBeGreaterThanOrEqual(0);
      expect(codeHash('')).toBe(0);
    });

    it('curriculumTone picks a valid aesthetic tone', () => {
      const tone = curriculumTone('General English');
      expect(['blue', 'purple', 'green', 'orange', 'red', 'slate']).toContain(tone);
    });

    it('statusTone correctly maps status values', () => {
      expect(statusTone('PUBLISHED')).toBe('green');
      expect(statusTone('ACTIVE')).toBe('green');
      expect(statusTone('DRAFT')).toBe('orange');
      expect(statusTone('ARCHIVED')).toBe('slate');
      expect(statusTone('INACTIVE')).toBe('slate');
      expect(statusTone('REVIEW')).toBe('blue');
      expect(statusTone('UNKNOWN')).toBe('purple');
    });

    it('getInitials extracts uppercase initials or fallback', () => {
      expect(getInitials('General English')).toBe('GE');
      expect(getInitials('Algebra')).toBe('A');
      expect(getInitials('')).toBe('—');
      expect(getInitials('   ')).toBe('—');
      expect(getInitials(null as any)).toBe('—');
    });

    it('computeCurriculumStats calculates total, published, drafts, and modules', () => {
      const stats = computeCurriculumStats(mockCurriculums);
      expect(stats.total).toBe(3);
      expect(stats.published).toBe(1);
      expect(stats.drafts).toBe(1);
      expect(stats.modules).toBe(12); // 6 + 4 + 2
    });
  });

  /* --------------------------------------------------------------------------
   * 2. MAIN COMPONENT RENDERING & STATS
   * ------------------------------------------------------------------------ */
  describe('Main View & Summary Stats', () => {
    it('renders hero title, badges and stat tiles', async () => {
      renderWithClient();

      expect(await screen.findByText(/O[‘']quv rejalari va sillabus/i)).toBeInTheDocument();
      expect(screen.getByText("Jami rejalar")).toBeInTheDocument();
      expect(screen.getByText("Nashr etilgan")).toBeInTheDocument();
      expect(screen.getByText("Qoralamalar")).toBeInTheDocument();
      expect(screen.getByText("Jami modullar")).toBeInTheDocument();
    });

    it('renders curriculum rows with versions, subject badges, and module counts', async () => {
      renderWithClient();

      expect(await screen.findByText('General English B2')).toBeInTheDocument();
      expect(screen.getByText('Algebra Asoslari')).toBeInTheDocument();
      expect(screen.getByText('Kids Phonics Master')).toBeInTheDocument();

      // Version badges
      expect(screen.getAllByText('v1').length).toBeGreaterThan(0);
      expect(screen.getByText('v2')).toBeInTheDocument();

      // Subject tags
      expect(screen.getByText('ENG')).toBeInTheDocument();
      expect(screen.getByText('MATH')).toBeInTheDocument();
      expect(screen.getByText('Fan biriktirilmagan')).toBeInTheDocument();
    });
  });

  /* --------------------------------------------------------------------------
   * 3. FILTERING & INTERACTIONS
   * ------------------------------------------------------------------------ */
  describe('Subject Filtering & Keyboard Navigation', () => {
    it('filters curriculums by selected subject', async () => {
      renderWithClient();

      expect(await screen.findByText('General English B2')).toBeInTheDocument();

      const filterSelect = screen.getByLabelText(/Fan bo[‘']yicha filtrlash/i);
      fireEvent.change(filterSelect, { target: { value: 'sub-1' } });

      await waitFor(() => {
        expect(curriculumApi.list).toHaveBeenCalledWith({ subjectId: 'sub-1' });
      });

      // Clear button appears
      const clearBtn = screen.getByRole('button', { name: 'Tozalash' });
      fireEvent.click(clearBtn);

      await waitFor(() => {
        expect(curriculumApi.list).toHaveBeenCalledWith(undefined);
      });
    });

    it('triggers Split-View Sidecar when clicking sidecar button', async () => {
      renderWithClient();

      expect(await screen.findByText('General English B2')).toBeInTheDocument();

      const sidecarBtns = screen.getAllByRole('button', { name: 'Split-view sidecar' });
      expect(sidecarBtns.length).toBe(3);

      fireEvent.click(sidecarBtns[0]);

      expect(openSidecar).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'cur-1',
          type: 'general',
          title: 'General English B2',
        }),
      );
    });

    it('verifies WCAG 2.2 AA SC 2.5.8 touch targets (>= 44x44px)', async () => {
      renderWithClient();

      expect(await screen.findByText('General English B2')).toBeInTheDocument();

      const sidecarBtns = screen.getAllByRole('button', { name: 'Split-view sidecar' });
      for (const btn of sidecarBtns) {
        expect(btn.className).toMatch(/min-h-\[44px\]/);
        expect(btn.className).toMatch(/min-w-\[44px\]/);
      }

      const createBtn = screen.getByRole('button', { name: /Yangi reja yaratish/i });
      expect(createBtn.className).toMatch(/min-h-\[44px\]/);
    });
  });

  /* --------------------------------------------------------------------------
   * 4. CREATE MODAL & MUTATION
   * ------------------------------------------------------------------------ */
  describe('Create Curriculum Modal', () => {
    it('opens modal, validates required fields, and submits successfully', async () => {
      renderWithClient();

      expect(await screen.findByText('General English B2')).toBeInTheDocument();

      // Open create modal
      const openBtn = screen.getByRole('button', { name: /Yangi reja yaratish/i });
      fireEvent.click(openBtn);

      // Verify modal opened
      expect(screen.getByText(/Yangi o[‘']quv rejasiga nom bering/i)).toBeInTheDocument();

      // Submit empty to test validation
      const submitBtn = screen.getByRole('button', { name: 'Yaratish' });
      fireEvent.click(submitBtn);

      expect(screen.getByText('Reja nomini kiritish majburiy')).toBeInTheDocument();
      expect(screen.getByText('Fanni tanlash majburiy')).toBeInTheDocument();

      // Fill in form
      const nameInput = screen.getByPlaceholderText(/Masalan: Ingliz tili B2 Intensive/i);
      fireEvent.change(nameInput, { target: { value: 'IELTS Intensive 7.5+' } });

      const subjectSelect = screen.getByRole('combobox', { name: /Fan \*/i });
      fireEvent.change(subjectSelect, { target: { value: 'sub-1' } });

      // Re-submit
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(curriculumApi.create).toHaveBeenCalledWith({
          name: 'IELTS Intensive 7.5+',
          subjectId: 'sub-1',
        });
      });
    });

    it('cancels and closes modal on cancel button click', async () => {
      renderWithClient();

      expect(await screen.findByText('General English B2')).toBeInTheDocument();

      const openBtn = screen.getByRole('button', { name: /Yangi reja yaratish/i });
      fireEvent.click(openBtn);

      const cancelBtn = screen.getByRole('button', { name: 'Bekor qilish' });
      fireEvent.click(cancelBtn);

      await waitFor(() => {
        expect(screen.queryByText(/Yangi o[‘']quv rejasiga nom bering/i)).not.toBeInTheDocument();
      });
    });
  });

  /* --------------------------------------------------------------------------
   * 5. EMPTY & ERROR STATES
   * ------------------------------------------------------------------------ */
  describe('Empty and Error States', () => {
    it('renders empty state when there are no curriculums', async () => {
      (curriculumApi.list as any).mockResolvedValue([]);

      renderWithClient();

      expect(await screen.findByText(/Hozircha o[‘']quv rejalari mavjud emas/i)).toBeInTheDocument();
    });

    it('renders error state and refetches on click', async () => {
      (curriculumApi.list as any).mockRejectedValue(new Error('Network failure'));

      renderWithClient();

      expect(await screen.findByText(/O[‘']quv rejalarini yuklab bo[‘']lmadi/i)).toBeInTheDocument();
      expect(screen.getByText('Network failure')).toBeInTheDocument();

      const retryBtn = screen.getByRole('button', { name: 'Qayta urinish' });
      fireEvent.click(retryBtn);

      expect(curriculumApi.list).toHaveBeenCalled();
    });
  });
});
