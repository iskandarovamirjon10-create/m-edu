import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OfflineIndicator } from '../OfflineIndicator';
import { I18nProvider } from '@/i18n/I18nProvider';

const mockSyncNow = vi.fn();
const mockClearCompleted = vi.fn();
const mockRetryAction = vi.fn();
const mockRemoveAction = vi.fn();

let mockState = {
  isOnline: true,
  pendingCount: 0,
  isSyncing: false,
  queue: [] as any[],
  syncNow: mockSyncNow,
  clearCompleted: mockClearCompleted,
  retryAction: mockRetryAction,
  removeAction: mockRemoveAction,
};

vi.mock('@/lib/offline-sync', () => ({
  useOfflineSync: () => mockState,
}));

function renderComponent() {
  return render(
    <I18nProvider initialLocale="en">
      <OfflineIndicator />
    </I18nProvider>,
  );
}

describe('OfflineIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState = {
      isOnline: true,
      pendingCount: 0,
      isSyncing: false,
      queue: [],
      syncNow: mockSyncNow,
      clearCompleted: mockClearCompleted,
      retryAction: mockRetryAction,
      removeAction: mockRemoveAction,
    };
  });

  it('renders nothing when online with empty queue and not syncing', () => {
    const { container } = renderComponent();
    expect(container.querySelector('button')).toBeNull();
  });

  it('renders offline pill when isOnline is false', () => {
    mockState.isOnline = false;
    renderComponent();

    const pill = screen.getByRole('button', { name: /Offline/i });
    expect(pill).toBeInTheDocument();
    expect(screen.getByText(/Offline Mode/i)).toBeInTheDocument();
  });

  it('opens and closes inspector modal on toggle click', async () => {
    const user = userEvent.setup();
    mockState.isOnline = false;
    mockState.queue = [
      {
        id: 'action-1',
        label: 'Create Student Payment',
        method: 'POST',
        endpoint: '/api/v1/payments',
        timestamp: Date.now(),
        status: 'pending',
        retryCount: 0,
      },
    ];
    mockState.pendingCount = 1;

    renderComponent();

    const pill = screen.getByRole('button', { name: /Offline/i });
    await user.click(pill);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Create Student Payment')).toBeInTheDocument();

    // Close via close button
    const closeBtn = screen.getByRole('button', { name: /Close/i });
    await user.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('closes inspector modal when Escape key is pressed', async () => {
    const user = userEvent.setup();
    mockState.isOnline = false;
    renderComponent();

    const pill = screen.getByRole('button', { name: /Offline/i });
    await user.click(pill);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('triggers manual sync and clear actions correctly', async () => {
    const user = userEvent.setup();
    mockState.isOnline = true;
    mockState.pendingCount = 1;
    mockState.queue = [
      {
        id: 'action-completed',
        label: 'Submit Attendance',
        method: 'POST',
        endpoint: '/api/v1/attendance',
        timestamp: Date.now(),
        status: 'completed',
        retryCount: 0,
      },
      {
        id: 'action-pending',
        label: 'Add Note',
        method: 'POST',
        endpoint: '/api/v1/notes',
        timestamp: Date.now(),
        status: 'pending',
        retryCount: 0,
      },
    ];

    renderComponent();

    const pill = screen.getByRole('button', { name: /Offline/i });
    await user.click(pill);

    const syncBtn = screen.getByRole('button', { name: /Sync now/i });
    await user.click(syncBtn);
    expect(mockSyncNow).toHaveBeenCalledTimes(1);

    const clearBtn = screen.getByRole('button', { name: /Clear completed/i });
    await user.click(clearBtn);
    expect(mockClearCompleted).toHaveBeenCalledTimes(1);
  });
});
