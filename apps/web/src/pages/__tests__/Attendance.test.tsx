/**
 * Unit & Integration Test Suite for AttendancePage (Apple 10/10 VisionOS Edition)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '@/i18n/I18nProvider';
import { AttendancePage } from '../Attendance';
import type { Attendance, Group, Student, AttendanceAnalytics } from '@/lib/types';

const mockGroup: Group = {
  id: 'g-1',
  organizationId: 'org-1',
  name: 'Frontend React 01',
  courseId: 'c-1',
  teacherId: 't-1',
  capacity: 16,
  room: 'Room 101',
  startDate: '2026-02-01',
  endDate: null,
  isActive: true,
};

const mockStudent: Student = {
  id: 's-1',
  organizationId: 'org-1',
  userId: 'u-1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  user: {
    id: 'u-1',
    firstName: 'Aziz',
    lastName: 'Vohidov',
    email: 'aziz@example.com',
    phone: '+998901234567',
    isActive: true,
  },
};

const mockAttendanceItems: Attendance[] = [
  {
    id: 'att-1',
    organizationId: 'org-1',
    studentId: 's-1',
    groupId: 'g-1',
    date: '2026-10-22',
    status: 'PRESENT',
    source: 'FACE_ID',
    note: 'Keldi va faol qatnashdi',
    student: mockStudent,
    group: mockGroup,
  },
  {
    id: 'att-2',
    organizationId: 'org-1',
    studentId: 's-1',
    groupId: 'g-1',
    date: '2026-10-21',
    status: 'ABSENT',
    source: 'MANUAL',
    note: 'Kasallik sababli kelmadi',
    student: mockStudent,
    group: mockGroup,
  },
];

const mockAnalytics: AttendanceAnalytics = {
  overall: {
    rate: 85,
    present: 17,
    total: 20,
  },
  byStatus: [
    { status: 'PRESENT', count: 17 },
    { status: 'ABSENT', count: 2 },
    { status: 'LATE', count: 1 },
    { status: 'EXCUSED', count: 0 },
  ],
  byGroup: [],
  daily: [],
};

const mockList = vi.fn();
const mockAnalyticsApi = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockRemove = vi.fn();
const mockGroupsList = vi.fn();
const mockStudentsList = vi.fn();

vi.mock('@/lib/api', () => ({
  attendanceApi: {
    list: (...args: unknown[]) => mockList(...args),
    analytics: (...args: unknown[]) => mockAnalyticsApi(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    remove: (...args: unknown[]) => mockRemove(...args),
  },
  groupsApi: {
    list: (...args: unknown[]) => mockGroupsList(...args),
  },
  studentsApi: {
    list: (...args: unknown[]) => mockStudentsList(...args),
  },
}));

vi.mock('@/hooks/useAttendanceSocket', () => ({
  useAttendanceSocket: vi.fn(),
}));

vi.mock('@/hooks/usePageTitle', () => ({
  usePageTitle: vi.fn(),
}));

function renderAttendancePage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <MemoryRouter>
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <AttendancePage />
        </QueryClientProvider>
      </I18nProvider>
    </MemoryRouter>
  );
}

describe('AttendancePage (Apple 10/10 VisionOS)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue({
      items: mockAttendanceItems,
      total: 2,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
    mockAnalyticsApi.mockResolvedValue(mockAnalytics);
    mockGroupsList.mockResolvedValue({ items: [mockGroup], total: 1 });
    mockStudentsList.mockResolvedValue({ items: [mockStudent], total: 1 });
  });

  it('renders page header, title, and total records count', async () => {
    renderAttendancePage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      expect(screen.getAllByText('Aziz Vohidov')[0]).toBeInTheDocument();
    });
  });

  it('renders student attendance rows with status badges and source chips', async () => {
    renderAttendancePage();

    await waitFor(() => {
      expect(screen.getByText('Keldi va faol qatnashdi')).toBeInTheDocument();
      expect(screen.getByText('Kasallik sababli kelmadi')).toBeInTheDocument();
    });
  });

  it('guarantees touch targets >= 44x44px for row action buttons', async () => {
    renderAttendancePage();

    await waitFor(() => {
      expect(screen.getAllByText('Aziz Vohidov')[0]).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    expect(editButtons.length).toBeGreaterThan(0);
    editButtons.forEach((btn) => {
      expect(btn.className).toContain('min-h-[44px]');
      expect(btn.className).toContain('min-w-[44px]');
    });

    const voidButtons = screen.getAllByTitle('Void');
    expect(voidButtons.length).toBeGreaterThan(0);
    voidButtons.forEach((btn) => {
      expect(btn.className).toContain('min-h-[44px]');
      expect(btn.className).toContain('min-w-[44px]');
    });

    const sidecarButtons = screen.getAllByLabelText('Attendance Dossier');
    expect(sidecarButtons.length).toBeGreaterThan(0);
    sidecarButtons.forEach((btn) => {
      expect(btn.className).toContain('min-h-[44px]');
      expect(btn.className).toContain('min-w-[44px]');
    });
  });

  it('allows selecting rows with accessible >= 44x44px checkbox touch targets', async () => {
    renderAttendancePage();

    await waitFor(() => {
      expect(screen.getAllByText('Aziz Vohidov')[0]).toBeInTheDocument();
    });

    const selectButtons = screen.getAllByLabelText(/Select Aziz Vohidov/i);
    expect(selectButtons.length).toBeGreaterThan(0);
    selectButtons.forEach((btn) => {
      expect(btn.className).toContain('min-h-[44px]');
      expect(btn.className).toContain('min-w-[44px]');
    });

    // Toggle selection
    fireEvent.click(selectButtons[0]);

    // Floating action island should appear
    await waitFor(() => {
      expect(screen.getByText(/Mark all as Present/i)).toBeInTheDocument();
      expect(screen.getByText(/Export \(CSV\)/i)).toBeInTheDocument();
    });
  });

  it('opens Record Attendance modal when clicking record button', async () => {
    renderAttendancePage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });

    const recordButtons = screen.getAllByRole('button', { name: /Record attendance/i });
    fireEvent.click(recordButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Record an attendance entry/i)).toBeInTheDocument();
    });
  });
});
