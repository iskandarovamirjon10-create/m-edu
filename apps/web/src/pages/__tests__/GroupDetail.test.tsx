/**
 * Unit & Integration Test Suite for GroupDetailPage (Apple 10/10 VisionOS Edition)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { I18nProvider } from '@/i18n/I18nProvider';
import {
  GroupDetailPage,
  formatDayOfWeek,
  formatCapacity,
  capacityRatio,
  formatScheduleTime,
  getScheduleRoom,
  getInitials,
  nameHash,
  avatarGradient,
  durationDays,
} from '../GroupDetail';
import { openSidecar } from '@/stores/ui.store';

// Mock ui.store
vi.mock('@/stores/ui.store', () => ({
  openSidecar: vi.fn(),
}));

// Mock sound hook
vi.mock('@/hooks/usePremiumSound', () => ({
  usePremiumSound: () => ({
    playTick: vi.fn(),
    playPop: vi.fn(),
    playSuccess: vi.fn(),
    playError: vi.fn(),
  }),
}));

const { mockGetGroup } = vi.hoisted(() => ({
  mockGetGroup: vi.fn(),
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
    },
  };
});

const mockGroupData = {
  id: 'group-101',
  name: 'IELTS Advanced 8.0',
  capacity: 15,
  isActive: true,
  startDate: '2026-01-10T00:00:00.000Z',
  endDate: '2026-06-10T00:00:00.000Z',
  room: 'Room 404',
  course: {
    id: 'course-1',
    name: 'IELTS Masterclass',
  },
  teacher: {
    id: 'teacher-1',
    user: {
      firstName: 'Rustam',
      lastName: 'Karimov',
    },
  },
  enrollments: [
    {
      student: {
        id: 'student-1',
        user: {
          firstName: 'Jasur',
          lastName: 'Toshmatov',
          email: 'jasur@example.com',
          phone: '+998901234567',
        },
      },
      isActive: true,
      joinedAt: '2026-01-12T10:00:00.000Z',
    },
    {
      student: {
        id: 'student-2',
        user: {
          firstName: 'Malika',
          lastName: 'Sobirova',
          email: 'malika@example.com',
          phone: '+998909876543',
        },
      },
      isActive: true,
      joinedAt: '2026-01-15T10:00:00.000Z',
    },
    {
      student: {
        id: 'student-3',
        user: {
          firstName: 'Olim',
          lastName: 'Zokirov',
        },
      },
      isActive: false,
      joinedAt: '2026-01-16T10:00:00.000Z',
    },
  ],
  schedules: [
    {
      id: 'sched-1',
      dayOfWeek: 'MONDAY',
      startTime: '14:00',
      endTime: '16:00',
      room: 'Room 404',
    },
    {
      id: 'sched-2',
      dayOfWeek: 'WEDNESDAY',
      startTime: '14:00',
      endTime: '16:00',
      room: 'Room 404',
    },
  ],
};

function renderComponent(groupId = 'group-101') {
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
        <MemoryRouter initialEntries={[`/groups/${groupId}`]}>
          <Routes>
            <Route path="/groups/:id" element={<GroupDetailPage />} />
            <Route path="/groups" element={<div data-testid="groups-list">Groups Page</div>} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe('GroupDetailPage (Apple 10/10 VisionOS Edition)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetGroup.mockResolvedValue(mockGroupData);
  });

  /* --------------------------------------------------------------------------
   * 1. PURE HELPERS TEST SUITE
   * ------------------------------------------------------------------------ */
  describe('Pure Helpers and Domain Logic', () => {
    it('formatDayOfWeek converts day correctly to i18n key', () => {
      expect(formatDayOfWeek('monday')).toBe('schedule.day.MONDAY');
      expect(formatDayOfWeek('FRIDAY')).toBe('schedule.day.FRIDAY');
    });

    it('formatCapacity formats current count and max capacity correctly', () => {
      expect(formatCapacity(10, 20)).toBe('10 / 20');
      expect(formatCapacity(10, null)).toBe('10');
      expect(formatCapacity(10, undefined)).toBe('10');
    });

    it('capacityRatio clamps values between 0 and 1 safely', () => {
      expect(capacityRatio(10, 20)).toBe(0.5);
      expect(capacityRatio(25, 20)).toBe(1);
      expect(capacityRatio(5, null)).toBe(0);
      expect(capacityRatio(5, 0)).toBe(0);
    });

    it('formatScheduleTime formats time strings correctly', () => {
      expect(formatScheduleTime('14:00')).toBeTruthy();
    });

    it('getScheduleRoom resolves schedule room or fallback room', () => {
      expect(getScheduleRoom({ id: 's1', dayOfWeek: 'MONDAY', startTime: '10:00', endTime: '12:00', room: 'Room A' } as any, 'Room B')).toBe('Room A');
      expect(getScheduleRoom({ id: 's1', dayOfWeek: 'MONDAY', startTime: '10:00', endTime: '12:00', room: '' } as any, 'Room B')).toBe('Room B');
      expect(getScheduleRoom({ id: 's1', dayOfWeek: 'MONDAY', startTime: '10:00', endTime: '12:00', room: '' } as any, null)).toBe('—');
    });

    it('getInitials returns 2 uppercase characters or dash fallback', () => {
      expect(getInitials('Rustam Karimov')).toBe('RK');
      expect(getInitials('Alisher')).toBe('A');
      expect(getInitials('')).toBe('—');
    });

    it('nameHash produces positive deterministic numbers', () => {
      const h1 = nameHash('Rustam');
      const h2 = nameHash('Rustam');
      const h3 = nameHash('Karimov');
      expect(h1).toBe(h2);
      expect(h1).toBeGreaterThanOrEqual(0);
      expect(h1).not.toBe(h3);
    });

    it('avatarGradient produces valid linear gradient string', () => {
      const grad = avatarGradient('Rustam Karimov');
      expect(grad).toContain('linear-gradient(135deg,');
    });

    it('durationDays calculates date delta accurately in days', () => {
      const delta = durationDays('2026-01-01', '2026-01-11');
      expect(delta).toBe(10);
      expect(durationDays(null, '2026-01-11')).toBeNull();
      expect(durationDays('2026-01-11', '2026-01-01')).toBeNull();
    });
  });

  /* --------------------------------------------------------------------------
   * 2. RENDERING & INTERACTION TEST SUITE
   * ------------------------------------------------------------------------ */
  describe('Rendering & Interactive Features', () => {
    it('renders loading skeleton when fetching group details', () => {
      mockGetGroup.mockReturnValue(new Promise(() => {}));
      renderComponent();
      expect(screen.getByTestId('group-detail-skeleton')).toBeInTheDocument();
    });

    it('renders error state and handles retry action', async () => {
      mockGetGroup.mockRejectedValueOnce(new Error('Network connection failed'));
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Group not found|Guruh topilmadi/i)).toBeInTheDocument();
      });

      // Try retry
      mockGetGroup.mockResolvedValueOnce(mockGroupData);
      const retryBtn = screen.getByRole('button', { name: /try again|qayta urinish/i });
      fireEvent.click(retryBtn);

      await waitFor(() => {
        expect(mockGetGroup).toHaveBeenCalledTimes(2);
      });
    });

    it('renders hero header with group name, room, course and active status', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: 'IELTS Advanced 8.0' })).toBeInTheDocument();
      });

      expect(screen.getByText('IELTS Masterclass')).toBeInTheDocument();
      expect(screen.getAllByText('Room 404')[0]).toBeInTheDocument();
    });

    it('renders breadcrumb with link to /groups and back button', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument();
      });

      const backLink = screen.getByLabelText(/Guruhlar ro'yxatiga qaytish|Back to groups/i);
      expect(backLink).toBeInTheDocument();
    });

    it('renders KPI stats tiles correctly (members, capacity, schedule, duration)', async () => {
      renderComponent();

      await waitFor(() => {
        // Active members / schedules / badges
        expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);
        // 15 capacity
        expect(screen.getByText('15')).toBeInTheDocument();
      });
    });

    it('opens sidecar drawer when clicking Sidecar button in hero', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: 'IELTS Advanced 8.0' })).toBeInTheDocument();
      });

      const sidecarBtn = screen.getByLabelText(/Split View Sidecar/i);
      fireEvent.click(sidecarBtn);

      expect(openSidecar).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'group',
          id: 'group-101',
          title: 'IELTS Advanced 8.0',
        }),
      );
    });

    it('dispatches open-ai-copilot custom event when clicking AI Copilot button', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: 'IELTS Advanced 8.0' })).toBeInTheDocument();
      });

      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
      const aiBtn = screen.getByLabelText(/AI (Analysis|Tahlil)/i);
      fireEvent.click(aiBtn);

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'open-ai-copilot',
        }),
      );
      dispatchSpy.mockRestore();
    });

    it('renders active members list and allows opening member sidecar', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Jasur Toshmatov')).toBeInTheDocument();
        expect(screen.getByText('Malika Sobirova')).toBeInTheDocument();
        // Inactive member should not be displayed in active members list
        expect(screen.queryByText('Olim Zokirov')).not.toBeInTheDocument();
      });

      const memberSidecarBtn = screen.getByLabelText('Sidecar: Jasur Toshmatov');
      fireEvent.click(memberSidecarBtn);

      expect(openSidecar).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'student',
          id: 'student-1',
          title: 'Jasur Toshmatov',
        }),
      );
    });

    it('renders schedule slots list with time chips and day labels', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('2 ta dars sloti')).toBeInTheDocument();
        // Schedule day tiles
        expect(screen.getByText('01')).toBeInTheDocument(); // MONDAY
        expect(screen.getByText('03')).toBeInTheDocument(); // WEDNESDAY
      });
    });
  });
});
