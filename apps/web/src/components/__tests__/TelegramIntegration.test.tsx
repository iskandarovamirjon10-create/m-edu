import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TelegramIntegration } from '../TelegramIntegration';
import { I18nProvider } from '@/i18n/I18nProvider';

const { statusMock, createLinkMock, unlinkMock, testMock, pushMock } = vi.hoisted(() => ({
  statusMock: vi.fn(),
  createLinkMock: vi.fn(),
  unlinkMock: vi.fn(),
  testMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  telegramApi: {
    status: statusMock,
    createLink: createLinkMock,
    unlink: unlinkMock,
    testNotification: testMock,
  },
}));

vi.mock('@/components/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/ui')>();
  return { ...actual, useToasts: () => ({ push: pushMock, toastNode: null }) };
});

function renderPanel() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <I18nProvider initialLocale="en">
        <TelegramIntegration />
      </I18nProvider>
    </QueryClientProvider>,
  );
}

const NOT_LINKED = {
  linked: false,
  status: null,
  username: null,
  firstName: null,
  lastName: null,
  languageCode: null,
  linkedAt: null,
  lastSeenAt: null,
  pendingLinkExpiresAt: null,
};

describe('TelegramIntegration (Settings → Integrations → Telegram)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    statusMock.mockResolvedValue(NOT_LINKED);
    createLinkMock.mockResolvedValue({
      token: 'secret-token-value',
      deepLink: 'https://t.me/medu_bot?start=secret-token-value',
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    });
    unlinkMock.mockResolvedValue({ disconnected: true });
    testMock.mockResolvedValue({ sent: true });
  });

  it('renders the connection state reported by the server', async () => {
    statusMock.mockResolvedValue({
      ...NOT_LINKED,
      linked: true,
      status: 'ACTIVE',
      username: 'ali_parent',
      lastSeenAt: '2026-06-01T10:00:00Z',
    });
    renderPanel();

    expect(await screen.findByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('@ali_parent')).toBeInTheDocument();
  });

  it('never renders a chat id (the API does not expose one)', async () => {
    statusMock.mockResolvedValue({ ...NOT_LINKED, linked: true, status: 'ACTIVE' });
    const { container } = renderPanel();
    await screen.findByText('Connected');

    expect(container.textContent ?? '').not.toContain('chatId');
    expect(container.textContent ?? '').not.toContain('telegramUserId');
  });

  it('creates a one-time deep link on Connect', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole('button', { name: /Connect Telegram/i }));

    await waitFor(() => expect(createLinkMock).toHaveBeenCalledTimes(1));
    const link = await screen.findByRole('link');
    expect(link).toHaveAttribute('href', 'https://t.me/medu_bot?start=secret-token-value');
  });

  it('disconnects on demand', async () => {
    statusMock.mockResolvedValue({ ...NOT_LINKED, linked: true, status: 'ACTIVE' });
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole('button', { name: /^Disconnect$/i }));

    await waitFor(() => expect(unlinkMock).toHaveBeenCalledTimes(1));
    expect(pushMock).toHaveBeenCalledWith('success', 'Telegram disconnected');
  });

  it('explains recovery when the account is blocked', async () => {
    statusMock.mockResolvedValue({ ...NOT_LINKED, linked: false, status: 'BLOCKED' });
    renderPanel();

    expect(await screen.findByText('Blocked')).toBeInTheDocument();
    expect(screen.getByText(/Press Connect and open the link again/i)).toBeInTheDocument();
  });
});
