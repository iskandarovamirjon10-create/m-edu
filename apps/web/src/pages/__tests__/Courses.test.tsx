/**
 * Unit & Integration Test Suite for CoursesPage (Apple visionOS & macOS Sequoia 10/10 Edition)
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
  {
    id: 'crs-3',
    organizationId: 'org-1',
    name: 'Legacy PHP Maintenance',
    description: 'Monolith maintenance and refactoring techniques',
    price: '150000',
    duration: 2,
    level: 'INTERMEDIATE',
    isActive: false, // Inactive
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
  },
];

const mockList = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockRemove = vi.fn();
const mockGetStats = vi.fn().mockResolvedValue({
  total: 3,
  active: 2,
  inactive: 1,
  avgPrice: 233333,
  levelDistribution: { ADVANCED: 1, BEGINNER: 1, INTERMEDIATE: 1 },
  totalGroups: 5,
  totalStudents: 42,
});

vi.mock('@/lib/api', () => ({
  coursesApi: {
    list: (...args: unknown[]) => mockList(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    remove: (...args: unknown[]) => mockRemove(...args),
    getStats: (...args: unknown[]) => mockGetStats(...args),
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

describe('CoursesPage (Apple 10/10 VisionOS & macOS Sequoia)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockList.mockResolvedValue({ items: mockCourses, total: mockCourses.length });
  });

  it('renders hero title, KPI metrics ribbon, and course cards in gallery mode', async () => {
    renderCoursesPage();

    await waitFor(() => {
      expect(screen.getByText('Fullstack React Architecture')).toBeInTheDocument();
      expect(screen.getByText('Python for Beginners')).toBeInTheDocument();
      expect(screen.getByText('Legacy PHP Maintenance')).toBeInTheDocument();
    });

    // Check KPI counts are rendered
    expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1); // 3 Total
  });

  it('switches view mode between gallery and table', async () => {
    renderCoursesPage();

    await waitFor(() => {
      expect(screen.getByText('Fullstack React Architecture')).toBeInTheDocument();
    });

    // Default view mode is gallery
    const tableButton = screen.getByLabelText(/Table|Jadval|Таблица/i);
    fireEvent.click(tableButton);

    // Verify localStorage persistence
    expect(localStorage.getItem('medu_courses_view_mode')).toBe('table');

    // Switch back to gallery
    const galleryButton = screen.getByLabelText(/Gallery|Galereya|Галерея/i);
    fireEvent.click(galleryButton);
    expect(localStorage.getItem('medu_courses_view_mode')).toBe('gallery');
  });

  it('filters courses by level using segmented filter', async () => {
    renderCoursesPage();

    await waitFor(() => {
      expect(screen.getByText('Fullstack React Architecture')).toBeInTheDocument();
      expect(screen.getByText('Python for Beginners')).toBeInTheDocument();
    });

    // Click on Beginner filter button
    const beginnerFilter = screen.getByRole('button', { name: /Beginner|Boshlang'ich|Начальный/i });
    fireEvent.click(beginnerFilter);

    // Now only Python for Beginners should appear
    await waitFor(() => {
      expect(screen.getByText('Python for Beginners')).toBeInTheDocument();
      expect(screen.queryByText('Fullstack React Architecture')).not.toBeInTheDocument();
      expect(screen.queryByText('Legacy PHP Maintenance')).not.toBeInTheDocument();
    });
  });

  it('searches courses by keyword and clears search', async () => {
    renderCoursesPage();

    await waitFor(() => {
      expect(screen.getByText('Fullstack React Architecture')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search|qidirish|поиск/i);
    fireEvent.change(searchInput, { target: { value: 'Python' } });

    await waitFor(() => {
      expect(screen.getByText('Python for Beginners')).toBeInTheDocument();
      expect(screen.queryByText('Fullstack React Architecture')).not.toBeInTheDocument();
    });

    // Clear search
    const clearButton = screen.getByLabelText(/clear|tozalash|очистить/i);
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(screen.getByText('Fullstack React Architecture')).toBeInTheDocument();
      expect(screen.getByText('Python for Beginners')).toBeInTheDocument();
    });
  });

  it('opens create modal on add button click and triggers form validation', async () => {
    renderCoursesPage();

    await waitFor(() => {
      expect(screen.getByText('Fullstack React Architecture')).toBeInTheDocument();
    });

    // Click "+ Add Course" button in hero
    const addButton = screen.getByRole('button', { name: /kurs qo'shish|add course|добавить курс/i });
    fireEvent.click(addButton);

    // Modal opens and shows form fields
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /kurs yaratish|create course|создать курс/i })).toBeInTheDocument();
    });

    // Submit empty form to trigger validation
    const submitButton = screen.getByRole('button', { name: /kurs yaratish|create course|создать курс/i });
    fireEvent.click(submitButton);

    // Form errors appear and create API was NOT called
    await waitFor(() => {
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });
});
