/**
 * Regression test: POST /face/sessions returns { sessionId, status }.
 * The page previously read `.id` (undefined) so `isSessionActive` stayed
 * false and captures were permanently disabled.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from '@/i18n/I18nProvider';
import { FaceRecognitionPage } from '../FaceRecognition';

const startSessionMock = vi.fn();

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
  faceApi: {
    engineStatus: vi.fn().mockResolvedValue({ provider: 'mock', isReal: false }),
    startSession: (...a: unknown[]) => startSessionMock(...a),
    submitAttempt: vi.fn(),
    finishSession: vi.fn(),
    recognitionHistory: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20, totalPages: 0 }),
    enrollments: vi.fn(),
    startEnrollment: vi.fn(),
    capture: vi.fn(),
    revoke: vi.fn(),
    reenroll: vi.fn(),
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

vi.mock('@/hooks/useAttendanceSocket', () => ({
  useAttendanceSocket: vi.fn(),
}));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <I18nProvider initialLocale="en">
      <QueryClientProvider client={qc}>
        <FaceRecognitionPage />
      </QueryClientProvider>
    </I18nProvider>,
  );
}

describe('FaceRecognitionPage — start-session response contract', () => {
  beforeEach(() => {
    startSessionMock.mockReset();
  });

  it('activates the session (capture enabled) when the backend returns { sessionId, status }', async () => {
    startSessionMock.mockResolvedValue({ sessionId: 'sess-123', status: 'STARTED' });
    renderPage();

    // Wait for the page to settle
    await screen.findByText(/face recognition/i);

    await userEvent.click(screen.getAllByRole('button', { name: /start recognition session/i })[0]);

    // The session-active state must engage and the capture surface appear.
    await waitFor(() => {
      expect(screen.getAllByText(/session active/i).length).toBeGreaterThanOrEqual(1);
    });
    expect(startSessionMock).toHaveBeenCalledWith({ groupId: undefined });
    // The truncated session id must be rendered (not 'undefined').
    expect(screen.queryByText(/undefined/i)).not.toBeInTheDocument();
  });
});
