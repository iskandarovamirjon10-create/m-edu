/**
 * Unit & Integration Test Suite for GroupsPage (Apple 10/10 VisionOS Edition)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '@/i18n/I18nProvider';
import { GroupsPage } from '../Groups';
import type { Group, Course, Teacher } from '@/lib/types';

const mockCourse: Course = {
  id: 'c-1',
  organizationId: 'org-1',
  name: 'Fullstack Web Development',
  price: '1500000',
  duration: 6,
  isActive: true,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

const mockTeacher: Teacher = {
  id: 't-1',
  organizationId: 'org-1',
  userId: 'u-1',
  specializations: ['React', 'Node.js'],
  user: {
    id: 'u-1',
    firstName: 'Anvar',
    lastName: 'Sobirov',
    email: 'anvar@example.com',
    phone: '+998901112233',
    isActive: true,
  },
};

const mockGroups: Group[] = [
  {
    id: 'g-1',
    organizationId: 'org-1',
    name: 'Frontend React 01',
    courseId: 'c-1',
    course: mockCourse,
    teacherId: 't-1',
    teacher: mockTeacher,
    capacity: 16,
    room: 'Room 101',
    startDate: '2026-02-01',
    endDate: null,
    isActive: true,
    _count: { enrollments: 12 },
  },
  {
    id: 'g-2',
    organizationId: 'org-1',
    name: 'Backend Node 02',
    courseId: 'c-1',
    course: mockCourse,
    teacherId: 't-1',
    teacher: mockTeacher,
    capacity: 20,
    room: 'Room 102',
    startDate: '2026-01-15',
    endDate: null,
    isActive: false,
    _count: { enrollments: 8 },
  },
];

const mockList = vi.fn();
const mockCreate = vi.fn();
const mockRemove = vi.fn();
const mockGraduate = vi.fn();
const mockCoursesList = vi.fn();
const mockTeachersList = vi.fn();

vi.mock('@/lib/api', () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  groupsApi: {
    list: (...args: unknown[]) => mockList(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    remove: (...args: unknown[]) => mockRemove(...args),
    graduate: (...args: unknown[]) => mockGraduate(...args),
  },
  coursesApi: {
    list: (...args: unknown[]) => mockCoursesList(...args),
  },
  teachersApi: {
    list: (...args: unknown[]) => mockTeachersList(...args),
  },
}));

vi.mock('@/stores/ui.store', () => ({
  openQuickLook: vi.fn(),
  openSidecar: vi.fn(),
}));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function renderComponent() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={qc}>
      <I18nProvider>
        <MemoryRouter>
          <GroupsPage />
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe('GroupsPage (Apple 10/10 VisionOS)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue({
      items: mockGroups,
      total: 2,
      page: 1,
      limit: 50,
      totalPages: 1,
    });
    mockCoursesList.mockResolvedValue({
      items: [mockCourse],
      total: 1,
      page: 1,
      limit: 100,
      totalPages: 1,
    });
    mockTeachersList.mockResolvedValue({
      items: [mockTeacher],
      total: 1,
      page: 1,
      limit: 100,
      totalPages: 1,
    });
  });

  it('renders page header, metric counters and search input', async () => {
    renderComponent();

    // Verify main header and search input
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(await screen.findByTestId('groups-search-input')).toBeInTheDocument();

    // Verify metric pills rendered
    expect(await screen.findByTestId('groups-metric-blue')).toBeInTheDocument();
    expect(await screen.findByTestId('groups-metric-green')).toBeInTheDocument();

    // Verify group names rendered in table
    expect(await screen.findByText('Frontend React 01')).toBeInTheDocument();
    expect(screen.getByText('Backend Node 02')).toBeInTheDocument();
  });

  it('renders empty state when no groups exist', async () => {
    mockList.mockResolvedValueOnce({
      items: [],
      total: 0,
      page: 1,
      limit: 50,
      totalPages: 0,
    });

    renderComponent();

    // Empty state should be visible
    expect(await screen.findByText(/No groups yet/i)).toBeInTheDocument();
  });

  it('switches between Table and Grid view mode', async () => {
    renderComponent();

    await screen.findByText('Frontend React 01');

    // Switch to Grid view
    const gridBtn = await screen.findByTestId('groups-view-grid');
    fireEvent.click(gridBtn);

    // Group cards should still render group name and teacher
    expect(await screen.findByText('Frontend React 01')).toBeInTheDocument();
    expect(screen.getByText('Backend Node 02')).toBeInTheDocument();
  });

  it('filters by status when clicking status tab', async () => {
    renderComponent();

    await screen.findByText('Frontend React 01');

    // Click "Active" status tab
    const activeTab = screen.getByTestId('groups-status-ACTIVE');
    fireEvent.click(activeTab);

    // Frontend React 01 is active, Backend Node 02 is inactive
    expect(screen.getByText('Frontend React 01')).toBeInTheDocument();
    expect(screen.queryByText('Backend Node 02')).not.toBeInTheDocument();
  });

  it('filters groups using search input', async () => {
    renderComponent();

    await screen.findByText('Frontend React 01');

    const searchInput = screen.getByTestId('groups-search-input');
    fireEvent.change(searchInput, { target: { value: 'Backend' } });

    // Only Backend Node 02 should match
    expect(screen.getByText('Backend Node 02')).toBeInTheDocument();
    expect(screen.queryByText('Frontend React 01')).not.toBeInTheDocument();
  });

  it('toggles group selection via checkbox and displays FloatingActionIsland', async () => {
    renderComponent();

    await screen.findByText('Frontend React 01');

    const checkboxes = screen.getAllByRole('checkbox');
    // First checkbox is select all, second is group 1
    const groupCheck = checkboxes[1];
    fireEvent.click(groupCheck);

    // Floating bulk action island toolbar should appear
    expect(await screen.findByRole('toolbar', { name: /Ommaviy amallar paneli/i })).toBeInTheDocument();
  });
});
