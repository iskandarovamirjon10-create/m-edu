/**
 * Comprehensive V2/V3 Enterprise Test Suite for Courses Module
 * Tests:
 *  - CourseSyllabusDrawer (Active running groups, metrics, drawer slide-out)
 *  - CourseAiSyllabusModal (AI Syllabus, Marketing Copywriter, Pricing Advisor)
 *  - BulkCourseActionsModals (Batch status activation/deactivation, Batch price adjustment)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '@/i18n/I18nProvider';
import { CoursesPage } from '../Courses';
import type { Course } from '@/lib/types';

const mockCourses: Course[] = [
  {
    id: 'crs-1',
    organizationId: 'org-1',
    name: 'Fullstack React Architecture',
    description: 'Master clean architecture, atomic state, and performance',
    price: '350000',
    duration: 6,
    level: 'ADVANCED',
    isActive: true,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'crs-2',
    organizationId: 'org-1',
    name: 'Python for Beginners',
    description: 'Zero to hero syntax, data structures, and algorithms',
    price: '200000',
    duration: 3,
    level: 'BEGINNER',
    isActive: true,
    createdAt: '2026-09-10T00:00:00Z',
    updatedAt: '2026-09-10T00:00:00Z',
  },
];

const mockList = vi.fn();
const mockGet = vi.fn();
const mockGetStats = vi.fn();
const mockBulkStatus = vi.fn();
const mockBulkPrice = vi.fn();
const mockAiChat = vi.fn();

vi.mock('@/lib/api', () => ({
  coursesApi: {
    list: (...args: unknown[]) => mockList(...args),
    get: (...args: unknown[]) => mockGet(...args),
    getStats: (...args: unknown[]) => mockGetStats(...args),
    bulkStatus: (...args: unknown[]) => mockBulkStatus(...args),
    bulkPrice: (...args: unknown[]) => mockBulkPrice(...args),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
  aiApi: {
    chat: (...args: unknown[]) => mockAiChat(...args),
  },
}));

vi.mock('@/hooks/usePremiumSound', () => ({
  usePremiumSound: () => ({
    playTick: vi.fn(),
    playPop: vi.fn(),
    playSuccess: vi.fn(),
    playError: vi.fn(),
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

function renderCoursesPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <I18nProvider>
          <CoursesPage />
        </I18nProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Courses V2/V3 Enterprise Interactive Features', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    mockList.mockResolvedValue({ items: mockCourses, total: mockCourses.length });
    mockGetStats.mockResolvedValue({
      total: 2,
      active: 2,
      inactive: 0,
      avgPrice: 275000,
      levelDistribution: { ADVANCED: 1, BEGINNER: 1 },
      totalGroups: 4,
      totalStudents: 36,
    });
    mockGet.mockResolvedValue({
      ...mockCourses[0],
      groups: [
        {
          id: 'grp-1',
          name: 'React-Evening-101',
          teacher: { firstName: 'Aziz', lastName: 'Karimov' },
          room: { name: 'Lab 3' },
          _count: { enrollments: 12 },
        },
      ],
    });
    mockBulkStatus.mockResolvedValue({ count: 2, message: '2 ta kurs holati yangilandi' });
    mockBulkPrice.mockResolvedValue({ count: 2, message: '2 ta kurs narxi yangilandi' });
    mockAiChat.mockResolvedValue({ content: 'Mocked AI Curriculum & Syllabus plan generated successfully.' });
  });

  it('opens CourseSyllabusDrawer and shows course details and running groups', async () => {
    renderCoursesPage();

    await waitFor(() => {
      expect(screen.getByText('Fullstack React Architecture')).toBeInTheDocument();
    });

    // Find and click the Syllabus drawer button (has aria-label or title matching Curriculum / Kurs rejasi)
    const syllabusButtons = screen.getAllByRole('button', { name: /kurs rejasi va guruhlar|curriculum & groups/i });
    expect(syllabusButtons.length).toBeGreaterThanOrEqual(1);

    fireEvent.click(syllabusButtons[0]);

    // Drawer should open and display course details & active groups
    await waitFor(() => {
      expect(screen.getByText('React-Evening-101')).toBeInTheDocument();
      expect(screen.getByText('Aziz Karimov')).toBeInTheDocument();
    });
  });

  it('opens CourseAiSyllabusModal and allows generating AI content', async () => {
    renderCoursesPage();

    await waitFor(() => {
      expect(screen.getByText('Fullstack React Architecture')).toBeInTheDocument();
    });

    // Find and click the AI Course Architect button
    const aiButtons = screen.getAllByRole('button', { name: /ai kurs me'mori|ai course architect/i });
    expect(aiButtons.length).toBeGreaterThanOrEqual(1);

    fireEvent.click(aiButtons[0]);

    // AI modal should open (auto triggers AI chat)
    await waitFor(() => {
      expect(screen.getByText(/AI Kurs Me'mori/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(mockAiChat).toHaveBeenCalled();
      expect(screen.getByText(/Mocked AI Curriculum/i)).toBeInTheDocument();
    });
  });

  it('supports selecting rows and triggering Bulk Course Status modal', async () => {
    renderCoursesPage();

    await waitFor(() => {
      expect(screen.getByText('Fullstack React Architecture')).toBeInTheDocument();
    });

    // Click row selection checkboxes
    const checkboxes = screen.getAllByLabelText(/kursini tanlash|select/i);
    expect(checkboxes.length).toBeGreaterThanOrEqual(2);

    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);

    // FloatingActionIsland should show bulk actions
    await waitFor(() => {
      expect(screen.getByText(/holatni o'zgartirish|toggle status/i)).toBeInTheDocument();
    });

    // Click bulk toggle status button
    const toggleStatusBtn = screen.getByText(/holatni o'zgartirish|toggle status/i);
    fireEvent.click(toggleStatusBtn);

    // Bulk modal should open
    await waitFor(() => {
      expect(screen.getByText(/kurslar holatini o'zgartirish|batch course status/i)).toBeInTheDocument();
    });

    // Submit the status change
    const submitBtn = screen.getByRole('button', { name: /qo'llash|apply|saqlash|tasdiqlash/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockBulkStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          courseIds: expect.arrayContaining(['crs-1', 'crs-2']),
        })
      );
    });
  });

  it('supports Bulk Price Adjustment modal with percent increase/decrease', async () => {
    renderCoursesPage();

    await waitFor(() => {
      expect(screen.getByText('Fullstack React Architecture')).toBeInTheDocument();
    });

    // Select row
    const checkboxes = screen.getAllByLabelText(/kursini tanlash|select/i);
    fireEvent.click(checkboxes[0]);

    // Floating island should show price button
    await waitFor(() => {
      expect(screen.getByText(/narxlarni yangilash|update prices/i)).toBeInTheDocument();
    });

    const priceBtn = screen.getByText(/narxlarni yangilash|update prices/i).closest('button')!;
    fireEvent.click(priceBtn);

    // Price modal should open
    await waitFor(() => {
      expect(screen.getByText(/kurslar narxini ommaviy yangilash|batch course tuition update/i)).toBeInTheDocument();
    });

    // Enter price value
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '15' } });

    // Submit
    const submitBtn = screen.getByRole('button', { name: /saqlash|save|qo'llash|apply/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockBulkPrice).toHaveBeenCalledWith(
        expect.objectContaining({
          courseIds: ['crs-1'],
          value: 15,
        })
      );
    });
  });
});
