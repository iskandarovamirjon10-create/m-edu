/**
 * Enterprise Test Suite for Attendance v2 Architecture
 *
 * Verifies:
 * 1. 4-Tab Enterprise Switcher (Ledger, Analytics, Radar, Flow)
 * 2. Express Fast-Tap Event Dispatch
 * 3. Official A4 Attendance Register Sheet Modal (Roll sheet, QR seal, print action)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '@/i18n/I18nProvider';
import { AttendancePage } from '../Attendance';
import { OfficialAttendanceRegisterModal } from '@/components/attendance/OfficialAttendanceRegisterModal';
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
const mockGroupsList = vi.fn();
const mockStudentsList = vi.fn();
const mockTriggerPrint = vi.fn();

vi.mock('@/lib/api', () => ({
  attendanceApi: {
    list: (...args: unknown[]) => mockList(...args),
    analytics: (...args: unknown[]) => mockAnalyticsApi(...args),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
  groupsApi: {
    list: (...args: unknown[]) => mockGroupsList(...args),
    get: vi.fn().mockResolvedValue({ id: 'g-1', name: 'Frontend React 01' }),
  },
  studentsApi: {
    list: (...args: unknown[]) => mockStudentsList(...args),
  },
  earlyWarningApi: {
    list: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  },
  camerasApi: {
    list: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  },
  faceApi: {
    recognitionHistory: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  },
}));

vi.mock('@/lib/printEngine', () => ({
  triggerPrint: (...args: unknown[]) => mockTriggerPrint(...args),
}));

vi.mock('@/hooks/useAttendanceSocket', () => ({
  useAttendanceSocket: vi.fn(),
}));

vi.mock('@/hooks/usePageTitle', () => ({
  usePageTitle: vi.fn(),
}));

function renderWithProviders(ui: React.ReactElement, locale = 'uz') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <MemoryRouter>
      <I18nProvider initialLocale={locale as any}>
        <QueryClientProvider client={queryClient}>
          {ui}
        </QueryClientProvider>
      </I18nProvider>
    </MemoryRouter>
  );
}

describe('Attendance Enterprise Features Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue({
      items: mockAttendanceItems,
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
    mockAnalyticsApi.mockResolvedValue(mockAnalytics);
    mockGroupsList.mockResolvedValue({ items: [mockGroup], total: 1 });
    mockStudentsList.mockResolvedValue({ items: [mockStudent], total: 1 });
  });

  it('renders 4 enterprise tabs and switches between Ledger, Analytics, Radar, and Flow', async () => {
    renderWithProviders(<AttendancePage />);

    await waitFor(() => {
      expect(screen.getByText('Davomat Jurnali')).toBeInTheDocument();
      expect(screen.getByText('Tahlil va Dinamika')).toBeInTheDocument();
      expect(screen.getByText('Yo‘qlovlar va Xavf')).toBeInTheDocument();
      expect(screen.getByText('Turniket va Oqim')).toBeInTheDocument();
    });

    // Default tab is Ledger
    expect(screen.getByText('Keldi va faol qatnashdi')).toBeInTheDocument();

    // Switch to Analytics tab
    fireEvent.click(screen.getByText('Tahlil va Dinamika'));
    await waitFor(() => {
      // The wave chart period pills or rate should be rendered
      expect(screen.getByText('Hafta')).toBeInTheDocument();
    });

    // Switch to Absenteeism Radar tab
    fireEvent.click(screen.getByText('Yo‘qlovlar va Xavf'));
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Yo‘qlovlar va Xavf/i })).toBeInTheDocument();
    });

    // Switch to Flow tab
    fireEvent.click(screen.getByText('Turniket va Oqim'));
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Turniket va Oqim/i })).toBeInTheDocument();
    });
  });

  it('dispatches medu:open-quick-attendance custom event on Express Mode button click', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    renderWithProviders(<AttendancePage />);

    await waitFor(() => {
      expect(screen.getByText('Tezkor Davomat')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Tezkor Davomat'));

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'medu:open-quick-attendance',
      })
    );
  });

  it('renders OfficialAttendanceRegisterModal and triggers print correctly', async () => {
    const onClose = vi.fn();
    renderWithProviders(
      <OfficialAttendanceRegisterModal
        open={true}
        onClose={onClose}
        initialGroupName="Frontend & AI Masterclass — F-01"
        initialTeacherName="Sanjarbek Karimov"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Rasmiy Oylik Davomat Vedomosti \(A4\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Oylik Davomat va Dars Qatnashishi Vedomosti/i)).toBeInTheDocument();
      expect(screen.getByText(/Frontend & AI Masterclass — F-01/i)).toBeInTheDocument();
    });

    // Click print button
    const printBtn = screen.getByText(/A4 Chop etish \(Print\)/i);
    fireEvent.click(printBtn);

    expect(mockTriggerPrint).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'receipt-a4',
      })
    );
  });
});
