/**
 * Teachers V2 Enterprise Features Test Suite
 * Tests advanced filters, quick tabs, TeacherProfileDrawer, AI lesson planner, and bulk action modals.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '@/i18n/I18nProvider';
import { TeachersPage } from '../Teachers';
import type { Teacher } from '@/lib/types';

const mockTeachers: (Teacher & { metrics: any })[] = [
  {
    id: 't-1',
    organizationId: 'org-1',
    userId: 'u-1',
    specializations: ['React', 'Node.js'],
    salaryType: 'HOURLY',
    hourlyRate: '150000',
    experience: 5,
    bio: 'Senior fullstack mentor',
    user: {
      id: 'u-1',
      firstName: 'Anvar',
      lastName: 'Sobirov',
      email: 'anvar@example.com',
      phone: '+998901112233',
      isActive: true,
    },
    groups: [
      {
        id: 'g-1',
        organizationId: 'org-1',
        name: 'React Pro 2026',
        courseId: 'c-1',
        course: { id: 'c-1', name: 'Frontend React' },
        schedules: [
          {
            id: 's-1',
            groupId: 'g-1',
            dayOfWeek: 'MONDAY' as any,
            startTime: '14:00',
            endTime: '18:00',
            room: 'Lab 1',
            isActive: true,
          },
        ],
        _count: { enrollments: 18 },
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any,
    ],
    metrics: {
      totalStudents: 18,
      weeklyHours: 24, // High workload
      groupsCount: 1,
    },
  },
  {
    id: 't-2',
    organizationId: 'org-1',
    userId: 'u-2',
    specializations: ['Python', 'Django'],
    salaryType: 'MONTHLY',
    hourlyRate: '100000',
    experience: 2,
    bio: 'Backend specialist',
    user: {
      id: 'u-2',
      firstName: 'Nodira',
      lastName: 'Karimova',
      email: 'nodira@example.com',
      phone: '+998903334455',
      isActive: true,
    },
    groups: [], // Available / No groups
    metrics: {
      totalStudents: 0,
      weeklyHours: 0,
      groupsCount: 0,
    },
  },
];

const mockList = vi.fn();
const mockBulkStatus = vi.fn();
const mockBulkSalary = vi.fn();
const mockBulkSpecializations = vi.fn();

vi.mock('@/lib/api', () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  teachersApi: {
    list: (...args: unknown[]) => mockList(...args),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    bulkStatus: (...args: unknown[]) => mockBulkStatus(...args),
    bulkSalary: (...args: unknown[]) => mockBulkSalary(...args),
    bulkSpecializations: (...args: unknown[]) => mockBulkSpecializations(...args),
    assignGroup: vi.fn(),
    getStats: vi.fn().mockResolvedValue({
      total: 2,
      active: 2,
      inactive: 0,
      withGroups: 1,
      withoutGroups: 1,
      totalGroups: 1,
      totalHoursWeekly: 24,
      avgHourlyRate: 125000,
      avgExperience: 3.5,
      salaryTypes: { monthly: 1, hourly: 1, perLesson: 0 },
      specializations: [],
    }),
  },
  groupsApi: {
    list: vi.fn().mockResolvedValue({ items: [], total: 0 }),
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
      <I18nProvider initialLocale="en">
        <MemoryRouter>
          <TeachersPage />
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe('Teachers V2 Enterprise Features', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue({
      items: mockTeachers,
      total: mockTeachers.length,
      page: 1,
      limit: 24,
      totalPages: 1,
    });
  });

  it('filters by High Workload tab', async () => {
    renderComponent();

    expect(await screen.findByText('Anvar Sobirov', {}, { timeout: 10000 })).toBeInTheDocument();
    expect(screen.getByText('Nodira Karimova')).toBeInTheDocument();

    const highWorkloadTab = screen.getByTestId('teachers-status-HIGH_WORKLOAD');
    fireEvent.click(highWorkloadTab);

    await waitFor(() => {
      expect(screen.getByText('Anvar Sobirov')).toBeInTheDocument();
      expect(screen.queryByText('Nodira Karimova')).not.toBeInTheDocument();
    });
  });

  it('filters by Available (No Groups) tab', async () => {
    renderComponent();

    expect(await screen.findByText('Anvar Sobirov')).toBeInTheDocument();

    const availableTab = screen.getByTestId('teachers-status-AVAILABLE');
    fireEvent.click(availableTab);

    await waitFor(() => {
      expect(screen.queryByText('Anvar Sobirov')).not.toBeInTheDocument();
      expect(screen.getByText('Nodira Karimova')).toBeInTheDocument();
    });
  });

  it('opens TeacherProfileDrawer on row click', async () => {
    renderComponent();

    const anvarRow = await screen.findByText('Anvar Sobirov');
    fireEvent.click(anvarRow);

    // Drawer should show with weekly hours and group info
    await waitFor(() => {
      expect(screen.getAllByText('Anvar Sobirov').length).toBeGreaterThan(1);
    });
  });

  it('displays FloatingActionIsland with bulk actions when teacher selected', async () => {
    renderComponent();

    expect(await screen.findByText('Anvar Sobirov')).toBeInTheDocument();

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    // Floating island toolbar should appear
    expect(await screen.findByRole('toolbar')).toBeInTheDocument();
  });
});
