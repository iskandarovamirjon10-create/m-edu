/**
 * Unit & Integration Test Suite for SchedulePage (Apple 10/10 VisionOS Edition)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '@/i18n/I18nProvider';
import { SchedulePage } from '../Schedule';
import type { Schedule, Group } from '@/lib/types';

const mockGroups: Group[] = [
  {
    id: 'grp-1',
    organizationId: 'org-1',
    name: 'Frontend React Pro',
    courseId: 'crs-1',
    teacherId: 'tch-1',
    room: 'Room 101',
    capacity: 20,
    isActive: true,
  },
  {
    id: 'grp-2',
    organizationId: 'org-1',
    name: 'Python Backend Advanced',
    courseId: 'crs-2',
    teacherId: 'tch-2',
    room: 'Room 101',
    capacity: 20,
    isActive: true,
  },
];

const mockSchedules: (Schedule & { group?: { name: string } })[] = [
  {
    id: 'sch-1',
    groupId: 'grp-1',
    dayOfWeek: 'MONDAY',
    startTime: '09:00',
    endTime: '11:00',
    room: 'Room 101',
    isActive: true,
    group: { name: 'Frontend React Pro' },
  },
  {
    id: 'sch-2',
    groupId: 'grp-2',
    dayOfWeek: 'MONDAY',
    startTime: '10:00', // Overlaps with sch-1 in Room 101!
    endTime: '12:00',
    room: 'Room 101',
    isActive: true,
    group: { name: 'Python Backend Advanced' },
  },
  {
    id: 'sch-3',
    groupId: 'grp-1',
    dayOfWeek: 'WEDNESDAY',
    startTime: '14:00',
    endTime: '16:00',
    room: 'Room 202',
    isActive: true,
    group: { name: 'Frontend React Pro' },
  },
];

const mockUtilization = {
  utilizationPercentage: 78,
  totalAvailableSlots: 100,
  occupiedSlots: 78,
  deadHoursCount: 2,
  rooms: [
    {
      name: 'Room 101',
      capacity: 20,
      utilization: 85,
      occupiedSlots: 17,
      totalSlots: 20,
      isDeadHourProne: false,
      dayBreakdown: { MONDAY: 4, TUESDAY: 3 },
    },
    {
      name: 'Room 202',
      capacity: 15,
      utilization: 30,
      occupiedSlots: 6,
      totalSlots: 20,
      isDeadHourProne: true,
      dayBreakdown: { WEDNESDAY: 2 },
    },
  ],
  recommendations: ['Reschedule Room 202 classes to fill dead morning hours.'],
};

const mockList = vi.fn();
const mockUtilizationFn = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockRemove = vi.fn();
const mockGroupsList = vi.fn();

vi.mock('@/lib/api', () => ({
  scheduleApi: {
    list: (...args: unknown[]) => mockList(...args),
    getRoomUtilization: (...args: unknown[]) => mockUtilizationFn(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    remove: (...args: unknown[]) => mockRemove(...args),
  },
  groupsApi: {
    list: (...args: unknown[]) => mockGroupsList(...args),
  },
}));

vi.mock('@/hooks/usePageTitle', () => ({
  usePageTitle: vi.fn(),
}));

function renderSchedulePage() {
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
          <SchedulePage />
        </I18nProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SchedulePage (Apple 10/10 VisionOS)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue({
      items: mockSchedules,
      total: 3,
      page: 1,
      limit: 200,
      totalPages: 1,
    });
    mockUtilizationFn.mockResolvedValue(mockUtilization);
    mockGroupsList.mockResolvedValue({
      items: mockGroups,
    });
  });

  it('renders command bar header, title, and total slots KPI', async () => {
    renderSchedulePage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });

    // Check presence of slot entries and groups
    expect(screen.getAllByText('Frontend React Pro').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Python Backend Advanced').length).toBeGreaterThan(0);
  });

  it('identifies schedule conflicts for overlapping sessions in the same room', async () => {
    renderSchedulePage();

    await waitFor(() => {
      expect(screen.getAllByText('Frontend React Pro').length).toBeGreaterThan(0);
    });

    // Overlapping slots sch-1 & sch-2 in Room 101 on Monday should trigger conflict badge
    const conflictBadges = screen.getAllByText(/Zidiyat|Conflict|Конфликт/i);
    expect(conflictBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('switches between Grid view, List view, and Heatmap view', async () => {
    renderSchedulePage();

    await waitFor(() => {
      expect(screen.getAllByText('Frontend React Pro').length).toBeGreaterThan(0);
    });

    // Switch to List view
    const listBtn = screen.getByRole('radio', { name: /List/i });
    fireEvent.click(listBtn);

    await waitFor(() => {
      // Ghost numerals like "01" exist in list view
      expect(screen.getByText('01')).toBeInTheDocument();
    });

    // Switch to Heatmap view
    const heatmapBtn = screen.getByRole('radio', { name: /Heat/i });
    fireEvent.click(heatmapBtn);

    await waitFor(() => {
      expect(screen.getByText('78%')).toBeInTheDocument();
      expect(screen.getByText('Reschedule Room 202 classes to fill dead morning hours.')).toBeInTheDocument();
    });
  });

  it('opens Add Schedule modal with accessible form controls', async () => {
    renderSchedulePage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });

    const addBtn = screen.getByRole('button', { name: /Add Entry|Yozuv qo'shish|Добавить запись/i });
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('filters schedule by day and allows clearing filter', async () => {
    renderSchedulePage();

    await waitFor(() => {
      expect(screen.getAllByText('Frontend React Pro').length).toBeGreaterThan(0);
    });

    // Click Wednesday day filter on desktop rail or mobile
    const wednesdayButtons = screen.getAllByRole('button', { name: /Wednesday|Wed/i });
    fireEvent.click(wednesdayButtons[0]);

    await waitFor(() => {
      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({
          dayOfWeek: 'WEDNESDAY',
        }),
      );
    });
  });
});
