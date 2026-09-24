/**
 * Regression test: the GroupDetail "Edit group" link points to
 * /groups/:id/edit — a route that previously did not exist (users were
 * silently redirected to the Dashboard). GroupFormPage must load the group
 * in edit mode and submit via groupsApi.update.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from '@/i18n/I18nProvider';
import { GroupFormPage } from '../GroupForm';

const getMock = vi.fn();
const updateMock = vi.fn();

vi.mock('@/lib/api', () => ({
  ApiError: class ApiError extends Error {
    status: number;
    details?: unknown;
    constructor(status: number, message: string, details?: unknown) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.details = details;
    }
  },
  tokenStore: { get: vi.fn(() => 't'), set: vi.fn(), clear: vi.fn() },
  userStore: { get: vi.fn(() => null), set: vi.fn(), clear: vi.fn() },
  setUnauthorizedHandler: vi.fn(),
  groupsApi: {
    get: (...a: unknown[]) => getMock(...a),
    update: (...a: unknown[]) => updateMock(...a),
    create: vi.fn(),
    list: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 100, totalPages: 0 }),
  },
  coursesApi: { list: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 100, totalPages: 0 }) },
  teachersApi: { list: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 100, totalPages: 0 }) },
}));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function renderEditRoute() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <I18nProvider initialLocale="en">
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/groups/group-1/edit']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/groups/:id/edit" element={<GroupFormPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

describe('GroupFormPage edit route (/groups/:id/edit)', () => {
  beforeEach(() => {
    getMock.mockReset();
    updateMock.mockReset();
  });

  it('loads the group in edit mode and saves via groupsApi.update', async () => {
    getMock.mockResolvedValue({
      id: 'group-1',
      organizationId: 'org-1',
      name: 'Math Group',
      courseId: 'course-1',
      teacherId: 'teacher-1',
      capacity: 15,
      room: 'Room 1',
      startDate: '2026-09-01T00:00:00.000Z',
      endDate: null,
      isActive: true,
    });
    updateMock.mockResolvedValue({ id: 'group-1', name: 'Math Group' });

    renderEditRoute();

    // Form must be populated from the loaded group (edit mode).
    const nameInput = await screen.findByDisplayValue('Math Group');
    expect(nameInput).toBeInTheDocument();
    expect(screen.getByDisplayValue('Room 1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('15')).toBeInTheDocument();

    // Change the name and submit.
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Math Group 2');
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        'group-1',
        expect.objectContaining({ name: 'Math Group 2', courseId: 'course-1', capacity: 15 }),
      );
    });
  });
});
