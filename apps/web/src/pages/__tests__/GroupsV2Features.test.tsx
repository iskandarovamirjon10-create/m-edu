/**
 * Enterprise V2/V3 Features Integration Test Suite for Groups
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
    capacity: 20,
    room: 'Room 101',
    startDate: '2026-02-01',
    endDate: null,
    isActive: true,
    _count: { enrollments: 16 },
  },
  {
    id: 'g-2',
    organizationId: 'org-1',
    name: 'Backend Node 02',
    courseId: 'c-1',
    course: mockCourse,
    teacherId: 't-1',
    teacher: mockTeacher,
    capacity: 15,
    room: 'Room 102',
    startDate: '2026-01-15',
    endDate: null,
    isActive: true,
    _count: { enrollments: 5 },
  },
];

const mockList = vi.fn();
const mockGet = vi.fn();
const mockCreate = vi.fn();
const mockRemove = vi.fn();
const mockGraduate = vi.fn();
const mockBulkStatus = vi.fn();
const mockBulkTeacher = vi.fn();
const mockBulkRoom = vi.fn();
const mockCoursesList = vi.fn();
const mockTeachersList = vi.fn();
const mockAiChat = vi.fn();

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
    get: (...args: unknown[]) => mockGet(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    remove: (...args: unknown[]) => mockRemove(...args),
    graduate: (...args: unknown[]) => mockGraduate(...args),
    bulkStatus: (...args: unknown[]) => mockBulkStatus(...args),
    bulkTeacher: (...args: unknown[]) => mockBulkTeacher(...args),
    bulkRoom: (...args: unknown[]) => mockBulkRoom(...args),
  },
  coursesApi: {
    list: (...args: unknown[]) => mockCoursesList(...args),
  },
  teachersApi: {
    list: (...args: unknown[]) => mockTeachersList(...args),
  },
  aiApi: {
    chat: (...args: unknown[]) => mockAiChat(...args),
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
      <I18nProvider initialLocale="uz">
        <MemoryRouter>
          <GroupsPage />
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe('Groups V2/V3 Enterprise Upgrades', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue({
      items: mockGroups,
      total: 2,
      page: 1,
      limit: 50,
      totalPages: 1,
    });
    mockGet.mockResolvedValue({
      ...mockGroups[0],
      enrollments: [
        {
          id: 'enr-1',
          isActive: true,
          student: {
            id: 'st-1',
            phone: '+998901234567',
            user: { firstName: 'Jasur', lastName: 'Aliyev', email: 'jasur@example.com' },
          },
        },
      ],
      schedules: [
        {
          id: 'sch-1',
          dayOfWeek: 'MONDAY',
          startTime: '14:00',
          endTime: '16:00',
          room: 'Room 101',
        },
      ],
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
    mockAiChat.mockResolvedValue({
      content: 'AI Guruhi tahlili: Guruh to\'ldirilishi 80%. Davomat barqaror.',
      conversationId: 'conv-123',
    });
  });

  it('opens GroupDossierDrawer on dossier button click and shows occupancy and schedule', async () => {
    renderComponent();

    expect(await screen.findByText('Frontend React 01')).toBeInTheDocument();

    // Find and click the Dossier button (title="Guruh dosyesi & Talabalar ro'yxati")
    const dossierButtons = screen.getAllByTitle(/Guruh dosyesi/i);
    expect(dossierButtons.length).toBeGreaterThan(0);
    fireEvent.click(dossierButtons[0]);

    // Drawer should open and display group occupancy details
    expect(await screen.findByText(/Guruh to‘ldirilishi|Guruh to'ldirilishi/i)).toBeInTheDocument();
    expect(await screen.findByText(/Bo‘sh o‘rin|Bo'sh o'rin/i)).toBeInTheDocument();
  });

  it('opens BulkGroupActionsModals and handles bulk status action', async () => {
    mockBulkStatus.mockResolvedValue({
      success: true,
      count: 1,
      isActive: true,
      message: '1 ta guruh faollashtirildi',
    });

    renderComponent();

    await screen.findByText('Frontend React 01');

    // Select first group via checkbox
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);

    // FloatingActionIsland should be visible
    expect(await screen.findByRole('toolbar', { name: /Ommaviy amallar paneli/i })).toBeInTheDocument();

    // Click "Holat" action button
    const statusBtn = screen.getByRole('button', { name: /Holat/i });
    fireEvent.click(statusBtn);

    // Modal should appear
    expect(await screen.findByText(/Guruhlar holatini o‘zgartirish|Guruhlar holatini o'zgartirish/i)).toBeInTheDocument();

    // Click "Qo'llash" button
    const applyBtn = screen.getByRole('button', { name: /Qo'llash|Qo‘llash/i });
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(mockBulkStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          groupIds: expect.any(Array),
        }),
      );
    });
  });

  it('opens GroupAiAdvisorModal and triggers diagnosis', async () => {
    renderComponent();

    await screen.findByText('Frontend React 01');

    // Find and click the AI Advisor button
    const aiButtons = screen.getAllByTitle(/AI Maslahatchi/i);
    expect(aiButtons.length).toBeGreaterThan(0);
    fireEvent.click(aiButtons[0]);

    // AI modal should open
    expect(await screen.findByTestId('group-ai-advisor-title')).toBeInTheDocument();

    // Verify chat call
    await waitFor(() => {
      expect(mockAiChat).toHaveBeenCalled();
    });
  });
});
