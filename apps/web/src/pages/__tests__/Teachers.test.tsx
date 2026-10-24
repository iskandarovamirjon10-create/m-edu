/**
 * Unit & Integration Test Suite for TeachersPage (Apple 10/10 VisionOS Edition)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '@/i18n/I18nProvider';
import { TeachersPage } from '../Teachers';
import type { Teacher } from '@/lib/types';

const mockTeachers: Teacher[] = [
  {
    id: 't-1',
    organizationId: 'org-1',
    userId: 'u-1',
    specializations: ['React', 'Node.js'],
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
  },
  {
    id: 't-2',
    organizationId: 'org-1',
    userId: 'u-2',
    specializations: ['Python', 'Django'],
    hourlyRate: '120000',
    experience: 3,
    bio: 'Backend specialist',
    user: {
      id: 'u-2',
      firstName: 'Nodira',
      lastName: 'Karimova',
      email: 'nodira@example.com',
      phone: '+998903334455',
      isActive: false,
    },
  },
];

const mockList = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockRemove = vi.fn();

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
    create: (...args: unknown[]) => mockCreate(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    remove: (...args: unknown[]) => mockRemove(...args),
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
          <TeachersPage />
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe('TeachersPage (Apple 10/10 VisionOS)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue({
      items: mockTeachers,
      total: 2,
      page: 1,
      limit: 24,
      totalPages: 1,
    });
  });

  it('renders page header, metric counters and search input', async () => {
    renderComponent();

    // Verify header and search input
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(await screen.findByTestId('teachers-search-input')).toBeInTheDocument();

    // Verify metric pills rendered
    expect(await screen.findByTestId('teachers-metric-blue')).toBeInTheDocument();
    expect(await screen.findByTestId('teachers-metric-green')).toBeInTheDocument();

    // Verify teacher names rendered in list
    expect(await screen.findByText('Anvar Sobirov')).toBeInTheDocument();
    expect(screen.getByText('Nodira Karimova')).toBeInTheDocument();
  });

  it('renders empty state when no teachers exist', async () => {
    mockList.mockResolvedValueOnce({
      items: [],
      total: 0,
      page: 1,
      limit: 24,
      totalPages: 0,
    });

    renderComponent();

    // Empty state should be visible
    expect(await screen.findByText(/No teachers yet/i)).toBeInTheDocument();
  });

  it('switches between List and Grid view mode', async () => {
    renderComponent();

    await screen.findByText('Anvar Sobirov');

    // Switch to Grid view
    const gridBtn = await screen.findByTestId('teachers-view-grid');
    fireEvent.click(gridBtn);

    // Cards should still render teachers
    expect(await screen.findByText('Anvar Sobirov')).toBeInTheDocument();
    expect(screen.getByText('Nodira Karimova')).toBeInTheDocument();
  });

  it('filters by status when clicking status tab', async () => {
    renderComponent();

    await screen.findByText('Anvar Sobirov');

    // Click "Active" status tab
    const activeTab = screen.getByTestId('teachers-status-ACTIVE');
    fireEvent.click(activeTab);

    // Anvar Sobirov is active, Nodira Karimova is inactive
    expect(screen.getByText('Anvar Sobirov')).toBeInTheDocument();
    expect(screen.queryByText('Nodira Karimova')).not.toBeInTheDocument();
  });

  it('filters teachers using search input', async () => {
    renderComponent();

    await screen.findByText('Anvar Sobirov');

    const searchInput = screen.getByTestId('teachers-search-input');
    fireEvent.change(searchInput, { target: { value: 'Nodira' } });

    // Only Nodira Karimova should match
    expect(screen.getByText('Nodira Karimova')).toBeInTheDocument();
    expect(screen.queryByText('Anvar Sobirov')).not.toBeInTheDocument();
  });

  it('toggles teacher selection via checkbox and displays FloatingActionIsland', async () => {
    renderComponent();

    await screen.findByText('Anvar Sobirov');

    const checkboxes = screen.getAllByRole('checkbox');
    // First teacher checkbox
    const teacherCheck = checkboxes[0];
    fireEvent.click(teacherCheck);

    // Floating bulk action island toolbar should appear
    expect(await screen.findByRole('toolbar', { name: /Ommaviy amallar paneli/i })).toBeInTheDocument();
  });
});
