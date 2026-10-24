/**
 * Unit & Integration Test Suite for StudentsPage (Apple 10/10 VisionOS Edition)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '@/i18n/I18nProvider';
import { StudentsPage } from '../Students';
import type { Student } from '@/lib/types';

const mockStudents: Student[] = [
  {
    id: 's-1',
    organizationId: 'org-1',
    userId: 'u-1',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    user: { id: 'u-1', firstName: 'Dilnoza', lastName: 'Rahimova', email: 'dilnoza@example.com', phone: '+998901234567', isActive: true },
    parentName: 'Karim Rahimov',
    parentPhone: '+998907654321',
    groups: [
      {
        isActive: true,
        group: { id: 'g-1', name: 'Frontend React 01' },
      },
    ],
  },
  {
    id: 's-2',
    organizationId: 'org-1',
    userId: 'u-2',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    user: { id: 'u-2', firstName: 'Aziz', lastName: 'Aliyev', email: 'aziz@example.com', phone: '+998912345678', isActive: false },
    parentName: 'Gulnora Aliyeva',
    parentPhone: '+998917654322',
    groups: [],
  },
];

const mockList = vi.fn();
const mockFreeze = vi.fn();
const mockUnfreeze = vi.fn();
const mockRemove = vi.fn();
const mockGroupsList = vi.fn();

vi.mock('@/lib/api', () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  studentsApi: {
    list: (...args: unknown[]) => mockList(...args),
    freeze: (...args: unknown[]) => mockFreeze(...args),
    unfreeze: (...args: unknown[]) => mockUnfreeze(...args),
    remove: (...args: unknown[]) => mockRemove(...args),
  },
  groupsApi: {
    list: (...args: unknown[]) => mockGroupsList(...args),
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
          <StudentsPage />
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe('StudentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue({
      items: mockStudents,
      total: 2,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
    mockGroupsList.mockResolvedValue({
      items: [{ id: 'g-1', name: 'Frontend React 01' }],
      total: 1,
      page: 1,
      limit: 100,
      totalPages: 1,
    });
  });

  it('renders page header, metric counters and search input', async () => {
    renderComponent();

    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(await screen.findByTestId('students-search-input')).toBeInTheDocument();

    // Verify student names rendered in table
    expect(await screen.findByText('Dilnoza Rahimova')).toBeInTheDocument();
    expect(screen.getByText('Aziz Aliyev')).toBeInTheDocument();
  });

  it('renders empty state when no students exist', async () => {
    mockList.mockResolvedValueOnce({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    });

    renderComponent();

    expect(await screen.findByText(/No students found/i)).toBeInTheDocument();
  });

  it('switches between Table and Grid view mode', async () => {
    renderComponent();

    await screen.findByText('Dilnoza Rahimova');

    // Find grid view toggle
    const gridTab = await screen.findByTestId('segment-grid');
    fireEvent.click(gridTab);

    // Group badge should be rendered
    const matches = await screen.findAllByText('Frontend React 01');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('toggles student selection via checkbox and displays FloatingActionIsland', async () => {
    renderComponent();

    await screen.findByText('Dilnoza Rahimova');

    const checkboxes = screen.getAllByRole('checkbox');
    // First checkbox is select all, second is student 1
    const studentCheck = checkboxes[1];
    fireEvent.click(studentCheck);

    // Floating bulk action island toolbar should appear
    expect(await screen.findByRole('toolbar', { name: /Ommaviy amallar paneli/i })).toBeInTheDocument();
  });

  it('filters by status when clicking status metric pills', async () => {
    renderComponent();

    await screen.findByText('Dilnoza Rahimova');

    // Click "Active" metric pill (tone="green")
    const activePill = screen.getByTestId('metric-pill-green');
    fireEvent.click(activePill);

    // Dilnoza is active, Aziz is inactive
    expect(screen.getByText('Dilnoza Rahimova')).toBeInTheDocument();
    expect(screen.queryByText('Aziz Aliyev')).not.toBeInTheDocument();
  });
});
