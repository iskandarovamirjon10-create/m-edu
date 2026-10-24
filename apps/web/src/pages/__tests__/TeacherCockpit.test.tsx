/**
 * Unit & Integration Test Suite for TeacherCockpitPage (Apple 10/10 visionOS Edition)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  TeacherCockpitPage,
  getTodayIso,
  shiftIsoDate,
  formatDisplayDate,
  getInitials,
  nameHash,
  avatarBg,
  nextStatus,
  timeToMinutes,
} from '../TeacherCockpit';
import { lessonsApi, attendanceApi, assignmentsApi } from '@/lib/api';
import { openSidecar } from '@/stores/ui.store';

vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'teacher-user-1',
      firstName: 'Anvar',
      lastName: 'Karimov',
      role: 'TEACHER',
      organizationId: 'org-test-1',
    },
  }),
}));

vi.mock('@/i18n/I18nProvider', () => ({
  useSafeI18n: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
    locale: 'uz',
  }),
  useI18n: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
    locale: 'uz',
  }),
}));

vi.mock('@/hooks/usePageTitle', () => ({
  usePageTitle: vi.fn(),
}));

vi.mock('@/stores/ui.store', () => ({
  openSidecar: vi.fn(),
}));

vi.mock('@/hooks/usePremiumSound', () => ({
  usePremiumSound: () => ({
    playTick: vi.fn(),
    playPop: vi.fn(),
    playSuccess: vi.fn(),
    playError: vi.fn(),
  }),
}));

const mockAddToast = vi.fn();
vi.mock('@/components/ui', () => ({
  useToasts: () => ({ push: mockAddToast, toastNode: null }),
  GlassButton: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  GlassInput: (props: any) => <input {...props} />,
  GlassField: ({ children }: any) => <div>{children}</div>,
  GlassModal: ({ children, open, title }: any) =>
    open ? (
      <div data-testid="glass-modal" aria-label={title}>
        {children}
      </div>
    ) : null,
}));

vi.mock('@/lib/api', () => ({
  lessonsApi: {
    list: vi.fn(),
    get: vi.fn(),
    updateStatus: vi.fn(),
    updateContent: vi.fn(),
  },
  attendanceApi: {
    create: vi.fn(),
  },
  assignmentsApi: {
    create: vi.fn(),
  },
}));

const mockLesson1 = {
  id: 'lesson-101',
  groupId: 'group-201',
  date: new Date().toISOString(),
  startTime: '09:00',
  endTime: '10:30',
  status: 'PLANNED',
  room: '3-Xona',
  notes: 'Avvalgi mavzu takrorlandi',
  Group: {
    id: 'group-201',
    name: 'IELTS Master A1',
    room: '3-Xona',
    course: { id: 'c-1', title: 'IELTS Preparation' },
    enrollments: [
      {
        id: 'enr-1',
        studentId: 'stud-1',
        student: {
          id: 'stud-1',
          user: { firstName: 'Jasur', lastName: 'Aliyev', phone: '+998901234567' },
        },
      },
      {
        id: 'enr-2',
        studentId: 'stud-2',
        student: {
          id: 'stud-2',
          user: { firstName: 'Malika', lastName: 'Rustamova', phone: '+998939876543' },
        },
      },
    ],
  },
  attendances: [],
  Assignment: [],
};

function renderComponent() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <TeacherCockpitPage />
    </QueryClientProvider>,
  );
}

describe('TeacherCockpitPage (Apple 10/10 visionOS Edition)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (lessonsApi.list as any).mockResolvedValue({
      items: [mockLesson1],
      total: 1,
      page: 1,
      limit: 50,
      totalPages: 1,
    });
    (lessonsApi.get as any).mockResolvedValue(mockLesson1);
    (lessonsApi.updateStatus as any).mockResolvedValue({ id: 'lesson-101', status: 'CONDUCTED' });
    (lessonsApi.updateContent as any).mockResolvedValue({ id: 'lesson-101', notes: 'Done' });
    (attendanceApi.create as any).mockResolvedValue({ count: 2 });
    (assignmentsApi.create as any).mockResolvedValue({ id: 'asg-301' });
  });

  /* --------------------------------------------------------------------------
   * 1. PURE DOMAIN HELPERS
   * ------------------------------------------------------------------------ */
  describe('Pure Domain Helpers', () => {
    it('getTodayIso returns YYYY-MM-DD format', () => {
      const today = getTodayIso();
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('shiftIsoDate calculates forward and backward dates correctly', () => {
      expect(shiftIsoDate('2026-10-20', 1)).toBe('2026-10-21');
      expect(shiftIsoDate('2026-10-20', -1)).toBe('2026-10-19');
      expect(shiftIsoDate('2026-10-20', 5)).toBe('2026-10-25');
    });

    it('formatDisplayDate returns main date, weekday sub, and today flag', () => {
      const res = formatDisplayDate('2026-10-20', 'uz');
      expect(res.main).toBeDefined();
      expect(res.sub).toBeDefined();
      expect(typeof res.isToday).toBe('boolean');
    });

    it('getInitials extracts uppercase initials from names', () => {
      expect(getInitials('Anvar', 'Karimov')).toBe('AK');
      expect(getInitials('Jasur', '')).toBe('J');
      expect(getInitials('', '')).toBe('O');
    });

    it('nameHash produces deterministic non-negative integer hashes', () => {
      const h1 = nameHash('Jasur Aliyev');
      const h2 = nameHash('Jasur Aliyev');
      expect(h1).toBe(h2);
      expect(h1).toBeGreaterThanOrEqual(0);
    });

    it('avatarBg returns a valid CSS radial-gradient string', () => {
      const bg = avatarBg('Jasur Aliyev');
      expect(bg).toContain('radial-gradient');
      expect(bg).toContain('linear-gradient');
    });

    it('nextStatus cycles through PRESENT -> ABSENT -> LATE -> EXCUSED -> PRESENT', () => {
      expect(nextStatus('PRESENT')).toBe('ABSENT');
      expect(nextStatus('ABSENT')).toBe('LATE');
      expect(nextStatus('LATE')).toBe('EXCUSED');
      expect(nextStatus('EXCUSED')).toBe('PRESENT');
    });

    it('timeToMinutes converts HH:MM format into minute numbers', () => {
      expect(timeToMinutes('09:30')).toBe(570);
      expect(timeToMinutes('00:00')).toBe(0);
      expect(timeToMinutes('14:15')).toBe(855);
      expect(timeToMinutes('')).toBe(0);
    });
  });

  /* --------------------------------------------------------------------------
   * 2. CORE COMPONENT & STREAM TESTS
   * ------------------------------------------------------------------------ */
  describe('TeacherCockpitPage Core Flows', () => {
    it('renders teacher greeting and lesson cards', async () => {
      renderComponent();

      // Teacher greeting & title
      expect(await screen.findByText(/Anvar Karimov/)).toBeInTheDocument();
      expect(await screen.findByText(/IELTS Master A1/)).toBeInTheDocument();
      expect(screen.getByText(/09:00 - 10:30/)).toBeInTheDocument();
      expect(screen.getAllByText(/Rejalashtirilgan/i).length).toBeGreaterThan(0);
    });

    it('displays enrolled students with phone dial links and initial present status', async () => {
      renderComponent();

      expect(await screen.findByText('Jasur Aliyev')).toBeInTheDocument();
      expect(screen.getByText('Malika Rustamova')).toBeInTheDocument();

      const phoneLink = screen.getByRole('link', { name: /\+998901234567/ });
      expect(phoneLink).toHaveAttribute('href', 'tel:+998901234567');
    });

    it('allows 1-touch status toggle (e.g. absent Q) for a student', async () => {
      renderComponent();

      expect(await screen.findByText('Jasur Aliyev')).toBeInTheDocument();

      // Click 'Q' (Absent) for first student
      const absentButtons = screen.getAllByTitle('Qoldi (Absent)');
      fireEvent.click(absentButtons[0]);

      // Save attendance button
      const saveButton = screen.getByRole('button', { name: /Davomatni saqlash/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(attendanceApi.create).toHaveBeenCalledWith(
          expect.objectContaining({
            groupId: 'group-201',
            lessonId: 'lesson-101',
            records: expect.arrayContaining([
              expect.objectContaining({ studentId: 'stud-1', status: 'ABSENT' }),
              expect.objectContaining({ studentId: 'stud-2', status: 'PRESENT' }),
            ]),
          }),
        );
      });
    });

    it('marks all students present on Barchasi keldi click', async () => {
      renderComponent();

      expect(await screen.findByText('Jasur Aliyev')).toBeInTheDocument();

      // Toggle one to absent first
      const absentButtons = screen.getAllByTitle('Qoldi (Absent)');
      fireEvent.click(absentButtons[0]);

      // Click "Barchasi keldi"
      const markAllBtn = screen.getByRole('button', { name: /Barchasi keldi/i });
      fireEvent.click(markAllBtn);

      // Save attendance
      const saveButton = screen.getByRole('button', { name: /Davomatni saqlash/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(attendanceApi.create).toHaveBeenCalledWith(
          expect.objectContaining({
            groupId: 'group-201',
            lessonId: 'lesson-101',
            records: expect.arrayContaining([
              expect.objectContaining({ studentId: 'stud-1', status: 'PRESENT' }),
              expect.objectContaining({ studentId: 'stud-2', status: 'PRESENT' }),
            ]),
          }),
        );
      });
    });

    it('starts lesson via Darsni boshlash button', async () => {
      renderComponent();

      // Wait for student to ensure lesson detail is fetched
      expect(await screen.findByText('Jasur Aliyev')).toBeInTheDocument();

      const startBtn = await screen.findByRole('button', { name: /Darsni boshlash/i });
      fireEvent.click(startBtn);

      await waitFor(() => {
        expect(lessonsApi.updateStatus).toHaveBeenCalledWith('lesson-101', 'CONDUCTED');
      });
    });

    it('assigns homework via quick form', async () => {
      renderComponent();

      // Open homework drawer
      const openHwBtn = await screen.findByRole('button', { name: /\+ Yangi biriktirish/i });
      fireEvent.click(openHwBtn);

      // Fill title
      const titleInput = screen.getByPlaceholderText(/Masalan: 12-18 mashqlar/i);
      fireEvent.change(titleInput, { target: { value: 'Unit 5 Vocab & Grammar' } });

      // Submit homework
      const submitBtn = screen.getByRole('button', { name: /Uy vazifasini biriktirish/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(assignmentsApi.create).toHaveBeenCalledWith(
          expect.objectContaining({
            groupId: 'group-201',
            lessonId: 'lesson-101',
            title: 'Unit 5 Vocab & Grammar',
          }),
        );
      });
    });

    it('navigates dates with Stepper (previous day, next day, today)', async () => {
      renderComponent();

      await screen.findByText('Anvar Karimov');

      const prevBtn = screen.getByRole('button', { name: /Oldingi kun/i });
      fireEvent.click(prevBtn);

      await waitFor(() => {
        expect(lessonsApi.list).toHaveBeenCalledTimes(2);
      });

      const nextBtn = screen.getByRole('button', { name: /Keyingi kun/i });
      fireEvent.click(nextBtn);

      await waitFor(() => {
        expect(lessonsApi.list).toHaveBeenCalledTimes(3);
      });
    });

    it('opens sidecar drawer when clicking sidecar button on lesson card', async () => {
      renderComponent();

      await screen.findByText('IELTS Master A1');

      const sidecarBtn = screen.getByLabelText(/Split-view sidecar/i);
      fireEvent.click(sidecarBtn);

      expect(openSidecar).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'lesson-101',
          title: 'IELTS Master A1',
        }),
      );
    });

    it('opens 360° Identity Card modal on badge button click', async () => {
      renderComponent();

      const idCardBtn = await screen.findByRole('button', { name: /360° ID Karta/i });
      fireEvent.click(idCardBtn);

      expect(screen.getByTestId('glass-modal')).toBeInTheDocument();
    });

    it('renders empty state when there are no lessons scheduled', async () => {
      (lessonsApi.list as any).mockResolvedValueOnce({
        items: [],
        total: 0,
      });

      renderComponent();

      expect(
        await screen.findByText(/Bu kunga darslar rejalashtirilmagan/i),
      ).toBeInTheDocument();
    });
  });
});
