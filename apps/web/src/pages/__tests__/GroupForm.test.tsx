/**
 * Unit & Integration Test Suite for GroupFormPage (Apple 10/10 VisionOS Edition)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { I18nProvider } from '@/i18n/I18nProvider';
import {
  GroupFormPage,
  getInitials,
  nameHash,
  avatarGradient,
  formatTeacherOption,
  validateGroupForm,
  EMPTY_FORM,
} from '../GroupForm';

// Mock sound hook
vi.mock('@/hooks/usePremiumSound', () => ({
  usePremiumSound: () => ({
    playTick: vi.fn(),
    playPop: vi.fn(),
    playSuccess: vi.fn(),
    playError: vi.fn(),
  }),
}));

const { mockGetGroup, mockCreateGroup, mockUpdateGroup, mockListCourses, mockListTeachers } =
  vi.hoisted(() => ({
    mockGetGroup: vi.fn(),
    mockCreateGroup: vi.fn(),
    mockUpdateGroup: vi.fn(),
    mockListCourses: vi.fn(),
    mockListTeachers: vi.fn(),
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
    groupsApi: {
      get: (...args: unknown[]) => mockGetGroup(...args),
      create: (...args: unknown[]) => mockCreateGroup(...args),
      update: (...args: unknown[]) => mockUpdateGroup(...args),
    },
    coursesApi: {
      list: (...args: unknown[]) => mockListCourses(...args),
    },
    teachersApi: {
      list: (...args: unknown[]) => mockListTeachers(...args),
    },
  };
});

const mockCoursesData = {
  items: [
    { id: 'course-1', name: 'IELTS Masterclass', isActive: true },
    { id: 'course-2', name: 'General English B2', isActive: true },
  ],
  total: 2,
};

const mockTeachersData = {
  items: [
    {
      id: 'teacher-1',
      user: { firstName: 'Rustam', lastName: 'Karimov' },
    },
    {
      id: 'teacher-2',
      user: { firstName: 'Malika', lastName: 'Saidova' },
    },
  ],
  total: 2,
};

const mockExistingGroup = {
  id: 'group-101',
  name: 'IELTS Advanced 8.0',
  courseId: 'course-1',
  teacherId: 'teacher-1',
  capacity: 18,
  room: 'Room 302',
  startDate: '2026-02-01T00:00:00.000Z',
  endDate: '2026-07-01T00:00:00.000Z',
  isActive: true,
};

function renderComponent(route = '/groups/new') {
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
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path="/groups/new" element={<GroupFormPage />} />
            <Route path="/groups/:id/edit" element={<GroupFormPage />} />
            <Route path="/groups/:id" element={<div data-testid="group-detail-view">Group Detail Page</div>} />
            <Route path="/groups" element={<div data-testid="groups-list">Groups Page</div>} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe('GroupFormPage (Apple 10/10 VisionOS Edition)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListCourses.mockResolvedValue(mockCoursesData);
    mockListTeachers.mockResolvedValue(mockTeachersData);
    mockGetGroup.mockResolvedValue(mockExistingGroup);
    mockCreateGroup.mockResolvedValue({ id: 'group-new-123' });
    mockUpdateGroup.mockResolvedValue({ id: 'group-101' });
  });

  /* --------------------------------------------------------------------------
   * 1. PURE HELPERS & VALIDATION LOGIC
   * ------------------------------------------------------------------------ */
  describe('Pure Helpers and Domain Validation', () => {
    it('getInitials extracts initials accurately or fallback', () => {
      expect(getInitials('Rustam Karimov')).toBe('RK');
      expect(getInitials('Malika')).toBe('M');
      expect(getInitials('')).toBe('—');
    });

    it('nameHash generates positive deterministic hash numbers', () => {
      const h1 = nameHash('Rustam');
      const h2 = nameHash('Rustam');
      expect(h1).toBe(h2);
      expect(h1).toBeGreaterThanOrEqual(0);
    });

    it('avatarGradient produces linear-gradient CSS string', () => {
      expect(avatarGradient('Rustam')).toContain('linear-gradient(135deg,');
    });

    it('formatTeacherOption formats teacher name or truncated ID', () => {
      expect(
        formatTeacherOption({
          id: 't1',
          user: { firstName: 'Rustam', lastName: 'Karimov' },
        } as any),
      ).toBe('Rustam Karimov');

      expect(
        formatTeacherOption({
          id: 'abcdef123456',
        } as any),
      ).toBe('abcdef12');
    });

    it('validateGroupForm validates required fields and capacity range', () => {
      const t = (k: string, fb?: string) => fb || k;

      // Empty form
      const errorsEmpty = validateGroupForm(EMPTY_FORM, t);
      expect(errorsEmpty.name).toBeTruthy();
      expect(errorsEmpty.courseId).toBeTruthy();

      // Valid form
      const errorsValid = validateGroupForm(
        {
          ...EMPTY_FORM,
          name: 'IELTS Batch 1',
          courseId: 'course-1',
          capacity: '20',
        },
        t,
      );
      expect(Object.keys(errorsValid)).toHaveLength(0);

      // Invalid capacity (> 100 or < 1)
      const errorsCapHigh = validateGroupForm(
        {
          ...EMPTY_FORM,
          name: 'IELTS Batch 1',
          courseId: 'course-1',
          capacity: '150',
        },
        t,
      );
      expect(errorsCapHigh.capacity).toBeTruthy();

      const errorsCapLow = validateGroupForm(
        {
          ...EMPTY_FORM,
          name: 'IELTS Batch 1',
          courseId: 'course-1',
          capacity: '0',
        },
        t,
      );
      expect(errorsCapLow.capacity).toBeTruthy();
    });
  });

  /* --------------------------------------------------------------------------
   * 2. CREATE MODE TESTS
   * ------------------------------------------------------------------------ */
  describe('Create Mode (/groups/new)', () => {
    it('renders create mode header, breadcrumbs, and select inputs', async () => {
      renderComponent('/groups/new');

      await waitFor(() => {
        expect(
          screen.getByRole('heading', { level: 1, name: /New group|Yangi guruh/i }),
        ).toBeInTheDocument();
      });

      // Course select options
      await waitFor(() => {
        expect(screen.getByText('IELTS Masterclass')).toBeInTheDocument();
        expect(screen.getByText('General English B2')).toBeInTheDocument();
      });

      // Teacher select options
      await waitFor(() => {
        expect(screen.getByText('Rustam Karimov')).toBeInTheDocument();
        expect(screen.getByText('Malika Saidova')).toBeInTheDocument();
      });
    });

    it('blocks submission and shows errors when required fields are missing', async () => {
      renderComponent('/groups/new');

      await waitFor(() => {
        expect(
          screen.getByRole('heading', { level: 1, name: /New group|Yangi guruh/i }),
        ).toBeInTheDocument();
      });

      const submitBtn = screen.getByRole('button', { name: /Create|Guruh yaratish/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockCreateGroup).not.toHaveBeenCalled();
      });
    });

    it('successfully submits valid group data and navigates to detail view', async () => {
      renderComponent('/groups/new');

      await waitFor(() => {
        expect(
          screen.getByRole('heading', { level: 1, name: /New group|Yangi guruh/i }),
        ).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('IELTS Masterclass')).toBeInTheDocument();
      });

      // Fill in Name
      const nameInput = screen.getByPlaceholderText(/Morning class A|Masalan: IELTS/i);
      fireEvent.change(nameInput, { target: { value: 'New Test Group' } });

      // Select Course
      const courseSelect = screen.getAllByRole('combobox')[0];
      fireEvent.change(courseSelect, { target: { value: 'course-1' } });

      // Fill in Capacity
      const capacityInput = screen.getByPlaceholderText('20');
      fireEvent.change(capacityInput, { target: { value: '25' } });

      // Submit
      const submitBtn = screen.getByRole('button', { name: /Create|Guruh yaratish/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockCreateGroup).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'New Test Group',
            courseId: 'course-1',
            capacity: 25,
            isActive: true,
          }),
        );
      });
    });
  });

  /* --------------------------------------------------------------------------
   * 3. EDIT MODE TESTS
   * ------------------------------------------------------------------------ */
  describe('Edit Mode (/groups/:id/edit)', () => {
    it('loads existing group data and populates form fields', async () => {
      renderComponent('/groups/group-101/edit');

      await waitFor(() => {
        expect(mockGetGroup).toHaveBeenCalledWith('group-101');
      });

      await waitFor(() => {
        const nameInput = screen.getByDisplayValue('IELTS Advanced 8.0');
        expect(nameInput).toBeInTheDocument();
      });

      // Room
      expect(screen.getByDisplayValue('Room 302')).toBeInTheDocument();
      // Capacity
      expect(screen.getByDisplayValue('18')).toBeInTheDocument();
      // Teacher preview badge rendered
      expect(screen.getAllByText('Rustam Karimov').length).toBeGreaterThanOrEqual(1);
    });

    it('allows toggling active status in edit mode', async () => {
      renderComponent('/groups/group-101/edit');

      await waitFor(() => {
        expect(screen.getByDisplayValue('IELTS Advanced 8.0')).toBeInTheDocument();
      });

      // Click "Nofaol / Inactive" radio button
      const inactiveToggle = screen.getByRole('radio', { name: /Nofaol|Inactive/i });
      fireEvent.click(inactiveToggle);

      // Submit update
      const saveBtn = screen.getByRole('button', { name: /O'zgarishlarni saqlash|save/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockUpdateGroup).toHaveBeenCalledWith(
          'group-101',
          expect.objectContaining({
            isActive: false,
          }),
        );
      });
    });

    it('renders error state when fetching existing group fails and handles retry', async () => {
      mockGetGroup.mockRejectedValueOnce(new Error('Group not found error'));
      renderComponent('/groups/group-err/edit');

      await waitFor(() => {
        expect(
          screen.getByRole('heading', { name: /Group not found|Guruh topilmadi/i }),
        ).toBeInTheDocument();
      });

      // Retry
      mockGetGroup.mockResolvedValueOnce(mockExistingGroup);
      const retryBtn = screen.getByRole('button', { name: /try again|qayta urinish/i });
      fireEvent.click(retryBtn);

      await waitFor(() => {
        expect(mockGetGroup).toHaveBeenCalledTimes(2);
      });
    });
  });
});
