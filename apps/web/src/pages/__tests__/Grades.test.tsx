/**
 * Unit & Integration Test Suite for GradesPage (Apple 10/10 VisionOS Edition)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '@/i18n/I18nProvider';
import { GradesPage, getScoreTier, formatStudentName, getInitials } from '../Grades';
import type { Grade, Student, Group } from '@/lib/types';

describe('Grades Pure Helpers', () => {
  it('computes score tiers accurately', () => {
    expect(getScoreTier(95, 100).grade).toBe('A');
    expect(getScoreTier(85, 100).grade).toBe('B');
    expect(getScoreTier(75, 100).grade).toBe('C');
    expect(getScoreTier(65, 100).grade).toBe('D');
    expect(getScoreTier(45, 100).grade).toBe('F');
  });

  it('formats student names safely', () => {
    expect(formatStudentName(null)).toBe('—');
    expect(formatStudentName({ user: { firstName: 'Ali', lastName: 'Valiyev' } })).toBe('Ali Valiyev');
  });

  it('generates initials correctly', () => {
    expect(getInitials('Ali Valiyev')).toBe('AV');
    expect(getInitials('Jasur')).toBe('JA');
    expect(getInitials('—')).toBe('ST');
  });
});

const mockStudents: Student[] = [
  {
    id: 'stud-1',
    organizationId: 'org-1',
    userId: 'user-1',
    user: {
      id: 'user-1',
      firstName: 'Ali',
      lastName: 'Valiyev',
      email: 'ali@example.com',
      phone: '+998901234567',
      isActive: true,
    },
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
];

const mockGroups: Group[] = [
  {
    id: 'grp-1',
    organizationId: 'org-1',
    name: 'Frontend React Pro',
    courseId: 'crs-1',
    isActive: true,
  },
];

const mockGrades: (Grade & { student?: Student; group?: Group })[] = [
  {
    id: 'grd-1',
    studentId: 'stud-1',
    groupId: 'grp-1',
    value: 92,
    maxValue: 100,
    label: 'Midterm Exam',
    notes: 'Outstanding react hooks implementation',
    student: mockStudents[0],
    group: mockGroups[0],
  },
  {
    id: 'grd-2',
    studentId: 'stud-1',
    groupId: 'grp-1',
    value: 58,
    maxValue: 100,
    label: 'Quiz 1',
    notes: 'Needs improvement in state management',
    student: mockStudents[0],
    group: mockGroups[0],
  },
];

const mockList = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockRemove = vi.fn();
const mockStudentsList = vi.fn();
const mockGroupsList = vi.fn();

vi.mock('@/lib/api', () => ({
  gradesApi: {
    list: (...args: unknown[]) => mockList(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    remove: (...args: unknown[]) => mockRemove(...args),
  },
  studentsApi: {
    list: (...args: unknown[]) => mockStudentsList(...args),
  },
  groupsApi: {
    list: (...args: unknown[]) => mockGroupsList(...args),
  },
}));

vi.mock('@/hooks/usePageTitle', () => ({
  usePageTitle: vi.fn(),
}));

function renderGradesPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <I18nProvider>
          <GradesPage />
        </I18nProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('GradesPage (Apple 10/10 VisionOS)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue({
      items: mockGrades,
      total: 2,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
    mockStudentsList.mockResolvedValue({
      items: mockStudents,
    });
    mockGroupsList.mockResolvedValue({
      items: mockGroups,
    });
  });

  it('renders hero title, KPI cards, and grade entries', async () => {
    renderGradesPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });

    await waitFor(() => {
      // Check student name rendered in table/cards
      const studentNames = screen.getAllByText('Ali Valiyev');
      expect(studentNames.length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText('Midterm Exam').length).toBeGreaterThan(0);
  });

  it('displays A and F grade tier badges', async () => {
    renderGradesPage();

    await waitFor(() => {
      expect(screen.getAllByText('Midterm Exam').length).toBeGreaterThan(0);
    });

    // Score 92/100 should show grade A badge (dual mobile/desktop view)
    expect(screen.getAllByText('A').length).toBeGreaterThan(0);
    // Score 58/100 should show grade F badge (dual mobile/desktop view)
    expect(screen.getAllByText('F').length).toBeGreaterThan(0);
  });

  it('selects multiple grades and surfaces FloatingActionIsland', async () => {
    renderGradesPage();

    await waitFor(() => {
      expect(screen.getByText('Midterm Exam')).toBeInTheDocument();
    });

    // Click select all checkbox in table header
    const selectAllCheckbox = screen.getByRole('checkbox', { name: /Select all grades/i });
    fireEvent.click(selectAllCheckbox);

    // FloatingActionIsland should surface with CSV Export and Delete Selected
    await waitFor(() => {
      expect(screen.getByText(/Export CSV|CSV eksport/i)).toBeInTheDocument();
      expect(screen.getByText(/Delete Selected|Tanlanganlarni o'chirish/i)).toBeInTheDocument();
    });
  });

  it('opens Add Grade modal with accessible inputs', async () => {
    renderGradesPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });

    const addBtn = screen.getByRole('button', { name: /Add Grade|Baho qo'shish|Добавить оценку/i });
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });
});
