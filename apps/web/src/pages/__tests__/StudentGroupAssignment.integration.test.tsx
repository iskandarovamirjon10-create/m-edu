/**
 * E2E / Forensic Integration Test:
 * Complete Student -> Group Assignment and Persistence Flow.
 *
 * Verifies:
 * 1. Student detail loads and displays existing student information.
 * 2. Newly created groups (linked to teacher & course) appear in the selector dropdown.
 * 3. Assigning the student to the group calls studentsApi.assignGroup and invalidates query caches.
 * 4. UI optimistically/reactively updates to render the assigned group with room and status.
 * 5. Page reload (cache clear + refetch) maintains persistence.
 * 6. Removing the student from the group updates backend and UI back to empty state.
 * 7. Resilient array vs paginated items payload handling in groups selector.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from '@/i18n/I18nProvider';
import { StudentDetailPage } from '../StudentDetail';

// Mock in-memory DB
interface MockStudent {
  id: string;
  organizationId: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    isActive: boolean;
  };
  status: string;
  groups: Array<{
    id: string;
    isActive: boolean;
    group: {
      id: string;
      name: string;
      room?: string;
    };
  }>;
  attendance: any[];
  payments: any[];
  createdAt: string;
}

interface MockGroup {
  id: string;
  organizationId: string;
  name: string;
  courseId: string;
  teacherId: string;
  capacity: number;
  room: string;
  isActive: boolean;
}

let studentsDb: Record<string, MockStudent> = {};
let groupsDb: Record<string, MockGroup> = {};

const mockAssignGroup = vi.fn(async (studentId: string, groupId: string) => {
  const student = studentsDb[studentId];
  const group = groupsDb[groupId];
  if (!student || !group) throw new Error('Not found');

  student.groups.push({
    id: `enrollment-${Date.now()}`,
    isActive: true,
    group: {
      id: group.id,
      name: group.name,
      room: group.room,
    },
  });
  return { success: true };
});

const mockRemoveGroup = vi.fn(async (studentId: string, groupId: string) => {
  const student = studentsDb[studentId];
  if (!student) throw new Error('Not found');

  student.groups = student.groups.filter((g) => g.group.id !== groupId && g.id !== groupId);
  return { success: true };
});

const mockGetStudent = vi.fn(async (id: string) => {
  const student = studentsDb[id];
  if (!student) throw new Error('Student not found');
  return JSON.parse(JSON.stringify(student));
});

let mockGroupsListReturnDirectArray = false;

const mockListGroups = vi.fn(async () => {
  const items = Object.values(groupsDb);
  if (mockGroupsListReturnDirectArray) {
    return items as any;
  }
  return {
    items,
    total: items.length,
    page: 1,
    limit: 100,
    totalPages: 1,
  };
});

vi.mock('@/lib/api', () => ({
  ApiError: class ApiError extends Error {
    status: number;
    details?: unknown;
    constructor(status: number, message: string, details?: unknown) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.details = details;
    }
  },
  tokenStore: { get: vi.fn(() => 'test-token'), set: vi.fn(), clear: vi.fn() },
  userStore: { get: vi.fn(() => ({ id: 'admin-1', organizationId: 'org-1' })), set: vi.fn(), clear: vi.fn() },
  setUnauthorizedHandler: vi.fn(),
  studentsApi: {
    get: (id: string) => mockGetStudent(id),
    create: vi.fn(),
    assignGroup: (sId: string, gId: string) => mockAssignGroup(sId, gId),
    removeGroup: (sId: string, gId: string) => mockRemoveGroup(sId, gId),
    getParents: vi.fn().mockResolvedValue([]),
    addParent: vi.fn().mockResolvedValue({ id: 'parent-1' }),
    updateParent: vi.fn().mockResolvedValue({ id: 'parent-1' }),
    unlinkParent: vi.fn().mockResolvedValue({ success: true }),
  },
  groupsApi: {
    list: () => mockListGroups(),
    get: vi.fn((id: string) => Promise.resolve(groupsDb[id])),
    create: vi.fn(),
  },
  faceApi: {
    enrollments: vi.fn().mockResolvedValue({ items: [] }),
  },
  aiApi: {
    diagnoseStudent: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'admin-1', role: 'ORG_ADMIN', organizationId: 'org-1' },
    isAuthenticated: true,
  }),
}));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function renderStudentDetail(studentId: string, client?: QueryClient) {
  const qc = client || new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <I18nProvider initialLocale="en">
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[`/students/${studentId}`]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/students/:id" element={<StudentDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

describe('Student -> Group Assignment End-to-End Integration Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGroupsListReturnDirectArray = false;

    // Reset database state
    studentsDb = {
      'student-101': {
        id: 'student-101',
        organizationId: 'org-1',
        user: {
          id: 'u-101',
          firstName: 'Alisher',
          lastName: 'Navoiy',
          email: 'alisher@edu.uz',
          phone: '+998901234567',
          isActive: true,
        },
        status: 'ACTIVE',
        groups: [],
        attendance: [],
        payments: [],
        createdAt: '2026-09-01T08:00:00.000Z',
      },
    };

    groupsDb = {
      'group-202': {
        id: 'group-202',
        organizationId: 'org-1',
        name: 'Advanced Mathematics 101',
        courseId: 'course-calc-1',
        teacherId: 'teacher-al-khwarizmi',
        capacity: 25,
        room: 'Room 304',
        isActive: true,
      },
    };
  });

  it('executes full 10-step student group assignment, cache invalidation and persistence', async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const { unmount } = renderStudentDetail('student-101', queryClient);

    // 1. Verify student detail loaded with initial empty groups state
    expect(await screen.findByText('Alisher Navoiy')).toBeInTheDocument();
    expect(screen.getByText('alisher@edu.uz')).toBeInTheDocument();
    expect(screen.getByText('Not assigned to any group')).toBeInTheDocument();

    // 2. Click "Assign to group" button to open modal
    const assignTrigger = screen.getByRole('button', { name: 'Assign to group' });
    await user.click(assignTrigger);

    // 3. Modal opens: role dialog
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    // 4. Verify the newly created group is present in the selector dropdown
    const selectEl = screen.getByRole('combobox', { name: /select group to assign/i });
    expect(selectEl).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Advanced Mathematics 101' })).toBeInTheDocument();

    // 5. Select the group and submit
    await user.selectOptions(selectEl, 'group-202');
    const submitBtn = within(screen.getByRole('dialog')).getByRole('button', { name: /^Assign$/i });
    await user.click(submitBtn);

    // 6. Verify studentsApi.assignGroup called with correct parameters
    await waitFor(() => {
      expect(mockAssignGroup).toHaveBeenCalledWith('student-101', 'group-202');
    });

    // 7. Verify modal closes and student group is rendered in the list
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(await screen.findByText('Advanced Mathematics 101')).toBeInTheDocument();
    expect(screen.getByText(/Room 304/i)).toBeInTheDocument();
    // "Active" also appears in the student status / face-enrollment tiles,
    // so assert the group's own status badge within its row.
    const groupRow = screen
      .getByText('Advanced Mathematics 101')
      .closest('div.flex.items-center');
    expect(groupRow).not.toBeNull();
    expect(within(groupRow as HTMLElement).getByText('Active')).toBeInTheDocument();

    // 8. Simulate page refresh / new session: unmount and remount with a fresh QueryClient
    unmount();

    const freshQueryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    renderStudentDetail('student-101', freshQueryClient);

    // 9. Verify assignment persists across simulated page refresh
    expect(await screen.findByText('Alisher Navoiy')).toBeInTheDocument();
    expect(screen.getByText('Advanced Mathematics 101')).toBeInTheDocument();
    expect(screen.getByText(/Room 304/i)).toBeInTheDocument();
  });

  it('unassigns / removes student from group and updates UI back to empty state', async () => {
    const user = userEvent.setup();

    // Start with student enrolled in group
    studentsDb['student-101'].groups = [
      {
        id: 'enrollment-1',
        isActive: true,
        group: {
          id: 'group-202',
          name: 'Advanced Mathematics 101',
          room: 'Room 304',
        },
      },
    ];

    renderStudentDetail('student-101');

    // 1. Group is visible initially
    expect(await screen.findByText('Advanced Mathematics 101')).toBeInTheDocument();

    // 2. Click Remove button
    const removeBtn = screen.getByRole('button', { name: /^Remove$/i });
    await user.click(removeBtn);

    // 3. Confirm dialog appears
    const confirmDialog = await screen.findByRole('alertdialog');
    expect(confirmDialog).toBeInTheDocument();
    const dialogContainer = confirmDialog.closest('[role="dialog"]') || document.body;
    const confirmButtons = dialogContainer.querySelectorAll('button');
    const confirmBtn = Array.from(confirmButtons).find((b) => b.textContent?.trim() === 'Remove');
    expect(confirmBtn).toBeDefined();
    await user.click(confirmBtn!);

    // 4. Verify API called and group removed from view
    await waitFor(() => {
      expect(mockRemoveGroup).toHaveBeenCalledWith('student-101', 'group-202');
    });

    expect(await screen.findByText('Not assigned to any group')).toBeInTheDocument();
  });

  it('gracefully handles raw Array response from groups endpoint', async () => {
    mockGroupsListReturnDirectArray = true;
    const user = userEvent.setup();

    renderStudentDetail('student-101');

    expect(await screen.findByText('Alisher Navoiy')).toBeInTheDocument();

    const assignTrigger = screen.getByRole('button', { name: 'Assign to group' });
    await user.click(assignTrigger);

    // The option should still appear even though groups.data is a direct Array
    expect(await screen.findByRole('option', { name: 'Advanced Mathematics 101' })).toBeInTheDocument();
  });
});
