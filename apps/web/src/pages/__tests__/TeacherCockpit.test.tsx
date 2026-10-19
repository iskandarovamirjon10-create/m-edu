import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TeacherCockpitPage } from '../TeacherCockpit';
import { lessonsApi, attendanceApi, assignmentsApi } from '@/lib/api';

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
  useI18n: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
    locale: 'uz',
  }),
}));

vi.mock('@/hooks/usePageTitle', () => ({
  usePageTitle: vi.fn(),
}));

const mockAddToast = vi.fn();
vi.mock('@/components/ui', () => ({
  useToasts: () => ({ push: mockAddToast, toastNode: null }),
  GlassButton: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  GlassInput: (props: any) => <input {...props} />,
  GlassField: ({ children }: any) => <div>{children}</div>,
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
  date: '2026-10-13T00:00:00.000Z',
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

describe('TeacherCockpitPage Component', () => {
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

  it('renders teacher greeting and lesson cards', async () => {
    renderComponent();

    // Teacher greeting & title
    expect(await screen.findByText(/Anvar Karimov/)).toBeInTheDocument();
    expect(await screen.findByText(/IELTS Master A1/)).toBeInTheDocument();
    expect(screen.getByText(/09:00 - 10:30/)).toBeInTheDocument();
    expect(screen.getByText(/Rejalashtirilgan/i)).toBeInTheDocument();
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
});
