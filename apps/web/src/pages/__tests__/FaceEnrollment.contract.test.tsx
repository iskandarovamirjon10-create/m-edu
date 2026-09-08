/**
 * Regression test: POST /face/enrollments returns { enrollmentId, status }.
 * The page previously read `.id` (undefined) so the capture UI never
 * activated — enrollment could not be completed from the UI.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FaceEnrollmentPage } from '../FaceEnrollment';

const startEnrollmentMock = vi.fn();

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
  studentsApi: {
    list: vi.fn().mockResolvedValue({
      items: [{ id: 'student-1', user: { id: 'u1', firstName: 'Ali', lastName: 'Valiyev' } }],
      total: 1, page: 1, limit: 100, totalPages: 1,
    }),
  },
  faceApi: {
    enrollments: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 100, totalPages: 0 }),
    startEnrollment: (...a: unknown[]) => startEnrollmentMock(...a),
    capture: vi.fn(),
    revoke: vi.fn(),
    reenroll: vi.fn(),
    engineStatus: vi.fn(),
    startSession: vi.fn(),
    submitAttempt: vi.fn(),
    finishSession: vi.fn(),
    recognitionHistory: vi.fn(),
    devices: vi.fn(),
    registerDevice: vi.fn(),
    revokeDevice: vi.fn(),
    auditLog: vi.fn(),
    analytics: vi.fn(),
    getEnrollment: vi.fn(),
    sessionAttempts: vi.fn(),
  },
  groupsApi: { list: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 100, totalPages: 0 }) },
}));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <FaceEnrollmentPage />
    </QueryClientProvider>,
  );
}

describe('FaceEnrollmentPage — start-enrollment response contract', () => {
  beforeEach(() => {
    startEnrollmentMock.mockReset();
  });

  it('activates the capture UI when the backend returns { enrollmentId, status }', async () => {
    startEnrollmentMock.mockResolvedValue({ enrollmentId: 'env-123', status: 'PENDING' });
    renderPage();

    // Wait for the student selector to load
    const select = await screen.findByRole('combobox');
    // Wait for the students list to load before selecting.
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Ali Valiyev/i })).toBeInTheDocument();
    });
    await userEvent.selectOptions(select, 'student-1');

    await userEvent.click(screen.getByRole('button', { name: /start enrollment/i }));

    // The capture UI (WebcamCapture + progress badge) must become visible —
    // this only happens if the page consumed `enrollmentId` correctly.
    await waitFor(() => {
      expect(screen.getByText(/enrollment in progress: env-123/i)).toBeInTheDocument();
    });
    expect(startEnrollmentMock).toHaveBeenCalledWith('student-1');
  });
});
