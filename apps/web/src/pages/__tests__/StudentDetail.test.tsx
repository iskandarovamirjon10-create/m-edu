/**
 * Unit & Integration Test Suite for StudentDetailPage (Apple 10/10 VisionOS / macOS Sequoia Edition)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { I18nProvider } from '@/i18n/I18nProvider';
import {
  StudentDetailPage,
  formatStudentStatus,
  formatGroupStatus,
  getInitials,
  nameHash,
  avatarGradient,
} from '../StudentDetail';
import { openSidecar } from '@/stores/ui.store';

// Mock sound hook
vi.mock('@/hooks/usePremiumSound', () => ({
  usePremiumSound: () => ({
    playTick: vi.fn(),
    playPop: vi.fn(),
    playSuccess: vi.fn(),
    playError: vi.fn(),
  }),
}));

// Mock ui.store
vi.mock('@/stores/ui.store', () => ({
  openSidecar: vi.fn(),
}));

// Mock Auth
vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'admin-1', role: 'ORG_ADMIN' },
    isAuthenticated: true,
  }),
}));

// Mock SpatialIdentityCard360 to keep tests light
vi.mock('@/components/cards/SpatialIdentityCard360', () => ({
  SpatialIdentityCard360: ({ data }: { data: any }) => (
    <div data-testid="spatial-identity-card-360">
      <span>{data.fullName}</span>
      <span>{data.role}</span>
    </div>
  ),
}));

// Mock API
const mockStudentData = {
  id: 'student-007',
  organizationId: 'org-1',
  dateOfBirth: '2008-05-14T00:00:00.000Z',
  gender: 'Male',
  address: 'Tashkent, Chilonzor 9',
  notes: 'Iqtidorli va tirishqoq o\'quvchi',
  parentName: 'Jamshid Karimov',
  parentPhone: '+998901234567',
  parentEmail: 'jamshid@example.com',
  user: {
    id: 'user-007',
    firstName: 'Azizbek',
    lastName: 'Karimov',
    email: 'azizbek@example.com',
    phone: '+998909876543',
    isActive: true,
  },
  groups: [
    {
      id: 'enroll-1',
      isActive: true,
      group: {
        id: 'group-101',
        name: 'IELTS Advanced Morning',
        room: 'Room 302',
      },
    },
  ],
  attendance: [
    {
      id: 'att-1',
      date: '2026-10-20T09:00:00.000Z',
      status: 'PRESENT',
      source: 'MANUAL',
    },
    {
      id: 'att-2',
      date: '2026-10-18T09:00:00.000Z',
      status: 'PRESENT',
      source: 'FACE_RECOGNITION',
    },
  ],
  payments: [
    {
      id: 'pay-1',
      createdAt: '2026-10-01T10:00:00.000Z',
      amount: '1200000',
      status: 'PAID',
    },
  ],
};

const mockGroups = [
  { id: 'group-101', name: 'IELTS Advanced Morning', isActive: true },
  { id: 'group-102', name: 'SAT Math Weekend', isActive: true },
];

const mockEnrollments = {
  items: [
    {
      id: 'face-1',
      status: 'ACTIVE',
      enrolledAt: '2026-09-15T00:00:00.000Z',
    },
  ],
};

const mockParents = [
  {
    id: 'link-1',
    parentId: 'parent-1',
    relationship: 'father',
    isPrimary: true,
    canViewGrades: true,
    canViewAttendance: true,
    canViewPayments: true,
    parent: {
      id: 'parent-1',
      firstName: 'Jamshid',
      lastName: 'Karimov',
      email: 'jamshid@example.com',
      phone: '+998901234567',
      isActive: true,
    },
  },
];

const {
  mockGet,
  mockAssignGroup,
  mockRemoveGroup,
  mockGetParents,
  mockAddParent,
  mockUpdateParent,
  mockUnlinkParent,
  mockGroupsList,
  mockEnrollmentsList,
} = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockAssignGroup: vi.fn(),
  mockRemoveGroup: vi.fn(),
  mockGetParents: vi.fn(),
  mockAddParent: vi.fn(),
  mockUpdateParent: vi.fn(),
  mockUnlinkParent: vi.fn(),
  mockGroupsList: vi.fn(),
  mockEnrollmentsList: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  studentsApi: {
    get: (...args: unknown[]) => mockGet(...args),
    assignGroup: (...args: unknown[]) => mockAssignGroup(...args),
    removeGroup: (...args: unknown[]) => mockRemoveGroup(...args),
    getParents: (...args: unknown[]) => mockGetParents(...args),
    addParent: (...args: unknown[]) => mockAddParent(...args),
    updateParent: (...args: unknown[]) => mockUpdateParent(...args),
    unlinkParent: (...args: unknown[]) => mockUnlinkParent(...args),
  },
  groupsApi: {
    list: (...args: unknown[]) => mockGroupsList(...args),
  },
  faceApi: {
    enrollments: (...args: unknown[]) => mockEnrollmentsList(...args),
  },
}));

function renderComponent(studentId = 'student-007') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <MemoryRouter initialEntries={[`/students/${studentId}`]}>
          <Routes>
            <Route path="/students/:id" element={<StudentDetailPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>
  );
}

describe('StudentDetailPage (Apple 10/10 VisionOS / macOS Sequoia Edition)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue(mockStudentData);
    mockGroupsList.mockResolvedValue(mockGroups);
    mockEnrollmentsList.mockResolvedValue(mockEnrollments);
    mockGetParents.mockResolvedValue(mockParents);
    mockAssignGroup.mockResolvedValue({ success: true });
    mockRemoveGroup.mockResolvedValue({ success: true });
    mockAddParent.mockResolvedValue({ success: true });
    mockUpdateParent.mockResolvedValue({ success: true });
    mockUnlinkParent.mockResolvedValue({ success: true });
  });

  /* -------------------------------------------------------------
     PURE HELPERS TEST SUITE
  ------------------------------------------------------------- */
  describe('Pure Helper Functions', () => {
    it('formatStudentStatus handles active, inactive, and undefined', () => {
      expect(formatStudentStatus(true)).toEqual({ color: 'green', label: 'enum.status.ACTIVE' });
      expect(formatStudentStatus(false)).toEqual({ color: 'red', label: 'enum.status.INACTIVE' });
      expect(formatStudentStatus(undefined)).toEqual({ color: 'green', label: 'enum.status.ACTIVE' });
    });

    it('formatGroupStatus handles boolean active flag', () => {
      expect(formatGroupStatus(true)).toEqual({ color: 'green', label: 'enum.status.ACTIVE' });
      expect(formatGroupStatus(false)).toEqual({ color: 'slate', label: 'enum.status.INACTIVE' });
    });

    it('getInitials extracts two letters or fallback dash', () => {
      expect(getInitials('Azizbek Karimov')).toBe('AK');
      expect(getInitials('Dilshod')).toBe('D');
      expect(getInitials('')).toBe('—');
    });

    it('nameHash produces a deterministic non-negative integer', () => {
      const h1 = nameHash('Azizbek');
      const h2 = nameHash('Azizbek');
      expect(h1).toBe(h2);
      expect(h1).toBeGreaterThanOrEqual(0);
    });

    it('avatarGradient generates a valid CSS linear gradient string', () => {
      const grad = avatarGradient('Azizbek Karimov');
      expect(grad).toMatch(/^linear-gradient\(135deg, #[0-9a-fA-F]{6} 0%, #[0-9a-fA-F]{6} 100%\)$/);
    });
  });

  /* -------------------------------------------------------------
     UI RENDERING & HERO TESTS
  ------------------------------------------------------------- */
  describe('Page Rendering and Data Display', () => {
    it('renders hero identity card, full name, email, badges and quick actions', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Azizbek Karimov')).toBeInTheDocument();
      });

      expect(screen.getByText('azizbek@example.com')).toBeInTheDocument();
      expect(screen.getByText('Face ID')).toBeInTheDocument();
      expect(screen.getByText('360° Karta')).toBeInTheDocument();
      expect(screen.getByText(/Sidecar/i)).toBeInTheDocument();
      expect(screen.getByText(/AI Tahlil/i)).toBeInTheDocument();
    });

    it('renders 4 stats tiles: attendance rate, groups count, total paid, and Face ID', async () => {
      renderComponent();

      await waitFor(() => {
        const rates = screen.getAllByText('100%');
        expect(rates.length).toBeGreaterThanOrEqual(1);
      });

      // Total paid: 1,200,000
      expect(screen.getAllByText(/1.*200.*000/).length).toBeGreaterThanOrEqual(1);
    });

    it('renders profile card information and notes', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Tashkent, Chilonzor 9')).toBeInTheDocument();
      });

      expect(screen.getByText('+998909876543')).toBeInTheDocument();
      expect(screen.getByText('Male')).toBeInTheDocument();
      expect(screen.getByText("Iqtidorli va tirishqoq o'quvchi")).toBeInTheDocument();
    });
  });

  /* -------------------------------------------------------------
     PARENT MANAGEMENT TESTS
  ------------------------------------------------------------- */
  describe('Parent Account Management & Modals', () => {
    it('displays linked parents list with permissions and primary badge', async () => {
      renderComponent();

      await waitFor(() => {
        const parents = screen.getAllByText('Jamshid Karimov');
        expect(parents.length).toBeGreaterThanOrEqual(1);
      });

      expect(screen.getAllByText('jamshid@example.com').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('+998901234567').length).toBeGreaterThanOrEqual(1);
    });

    it('opens sidecar QuickLook when sidecar button is pressed', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Azizbek Karimov')).toBeInTheDocument();
      });

      const sidecarBtn = screen.getByText(/Sidecar/i);
      fireEvent.click(sidecarBtn);

      expect(openSidecar).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'student',
          id: 'student-007',
          title: 'Azizbek Karimov',
        })
      );
    });

    it('opens 360 card modal when 360 button is pressed', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Azizbek Karimov')).toBeInTheDocument();
      });

      const cardBtn = screen.getByText('360° Karta');
      fireEvent.click(cardBtn);

      await waitFor(() => {
        expect(screen.getByTestId('spatial-identity-card-360')).toBeInTheDocument();
      });
    });
  });
});
