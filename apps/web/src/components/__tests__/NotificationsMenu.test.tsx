import { describe, it, expect, vi, beforeEach} from'vitest';
import { render, screen, waitFor} from'@testing-library/react';
import userEvent from'@testing-library/user-event';
import { QueryClient, QueryClientProvider} from'@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { NotificationsMenu } from '../NotificationsMenu';

const { listMock, markReadMock, markAllReadMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  markReadMock: vi.fn(),
  markAllReadMock: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  notificationsApi: {
    list: listMock,
    markRead: markReadMock,
    markAllRead: markAllReadMock,
  },
}));

function renderMenu() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <NotificationsMenu />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const payload = {
 items: [
 {
 id:'n1',
 title:'New payment',
 message:'Ali received $120.00',
 isRead: false,
 createdAt: new Date().toISOString(),
},
 {
 id:'n2',
 title:'Attendance recorded',
 message:'Face recognition confirmed for today',
 isRead: true,
 createdAt: new Date(Date.now() - 3_600_000).toISOString(),
},
 ],
 total: 2,
 unread: 1,
};

describe('NotificationsMenu', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 listMock.mockResolvedValue(payload);
 markReadMock.mockResolvedValue({ success: true});
 markAllReadMock.mockResolvedValue({ success: true});
});

 it('renders the bell button with an unread badge', async () => {
  renderMenu();
  await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1));
  const bell = await screen.findByRole(
    'button',
    { name: /Notifications, 1 unread/i},
    { timeout: 5000},
  );
  expect(bell).toBeInTheDocument();
 });

 it('loads the unread count on mount and lists items when opened', async () => {
 const user = userEvent.setup();
 renderMenu();
 await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1));
 await user.click(await screen.findByRole('button', { name: /Notifications/i}));
 expect(await screen.findByText('New payment')).toBeInTheDocument();
 expect(screen.getByText('Attendance recorded')).toBeInTheDocument();
});

 it('marks a single notification as read on click', async () => {
 const user = userEvent.setup();
 renderMenu();
 await user.click(await screen.findByRole('button', { name: /Notifications/i}));
 const unreadItem = await screen.findByText('New payment');
 await user.click(unreadItem);
 await waitFor(() => expect(markReadMock).toHaveBeenCalledWith('n1'));
});

  it('marks all as read', async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(await screen.findByRole('button', { name: /Notifications/i }));
    await user.click(await screen.findByRole('button', { name: /Mark all/i }));
    await waitFor(() => expect(markAllReadMock).toHaveBeenCalledTimes(1));
  });
});
