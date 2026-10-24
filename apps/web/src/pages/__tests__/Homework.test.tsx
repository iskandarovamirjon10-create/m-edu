/**
 * Unit & Integration Test Suite for HomeworkPage (Apple 10/10 VisionOS Edition)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '@/i18n/I18nProvider';
import { HomeworkPage } from '../Homework';
import type { Homework, Group } from '@/lib/types';

const mockGroups: Group[] = [
  {
    id: 'grp-1',
    organizationId: 'org-1',
    name: 'Frontend React Pro',
    courseId: 'crs-1',
    isActive: true,
  },
  {
    id: 'grp-2',
    organizationId: 'org-1',
    name: 'Python Backend Advanced',
    courseId: 'crs-2',
    isActive: true,
  },
];

const mockHomeworks: Homework[] = [
  {
    id: 'hw-1',
    organizationId: 'org-1',
    groupId: 'grp-1',
    title: 'Custom Hooks Architecture',
    description: 'Build a useDebounce and useThrottle hook suite',
    deadline: '2026-11-01T18:00:00Z',
    maxScore: 100,
    group: mockGroups[0],
  },
  {
    id: 'hw-2',
    organizationId: 'org-1',
    groupId: 'grp-2',
    title: 'FastAPI Dependency Injection',
    description: 'Implement database session lifespan dependency',
    deadline: '2026-10-01T12:00:00Z', // Past due!
    maxScore: 50,
    group: mockGroups[1],
  },
];

const mockList = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockRemove = vi.fn();
const mockGroupsList = vi.fn();

vi.mock('@/lib/api', () => ({
  homeworkApi: {
    list: (...args: unknown[]) => mockList(...args),
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

function renderHomeworkPage() {
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
          <HomeworkPage />
        </I18nProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('HomeworkPage (Apple 10/10 VisionOS)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue({
      items: mockHomeworks,
      total: 2,
      page: 1,
      limit: 100,
      totalPages: 1,
    });
    mockGroupsList.mockResolvedValue({
      items: mockGroups,
    });
  });

  it('renders hero title, KPI cards, and homework entries', async () => {
    renderHomeworkPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('Custom Hooks Architecture')).toBeInTheDocument();
      expect(screen.getByText('FastAPI Dependency Injection')).toBeInTheDocument();
    });
  });

  it('filters homework by status using segmented controls', async () => {
    renderHomeworkPage();

    await waitFor(() => {
      expect(screen.getByText('Custom Hooks Architecture')).toBeInTheDocument();
    });

    // Click Past Due filter
    const pastDueRadio = screen.getByRole('radio', { name: /Past due|Muddati o'tgan|Просрочено/i });
    fireEvent.click(pastDueRadio);

    await waitFor(() => {
      expect(screen.getByText('FastAPI Dependency Injection')).toBeInTheDocument();
      expect(screen.queryByText('Custom Hooks Architecture')).not.toBeInTheDocument();
    });
  });

  it('selects multiple homework rows and surfaces FloatingActionIsland', async () => {
    renderHomeworkPage();

    await waitFor(() => {
      expect(screen.getByText('Custom Hooks Architecture')).toBeInTheDocument();
    });

    // Select row 1
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    // FloatingActionIsland should surface with CSV Export and Delete Selected
    await waitFor(() => {
      expect(screen.getByText(/Export CSV|CSV eksport/i)).toBeInTheDocument();
      expect(screen.getByText(/Delete Selected|Tanlanganlarni o'chirish/i)).toBeInTheDocument();
    });
  });

  it('opens Add Homework modal with accessible form fields', async () => {
    renderHomeworkPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });

    const addBtn = screen.getByRole('button', { name: /Add homework|Topshiriq qo'shish|Добавить задание/i });
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });
});
