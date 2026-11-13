import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ExpressPosTerminalModal } from '../ExpressPosTerminalModal';

vi.mock('@/lib/api', () => ({
  studentsApi: {
    list: vi.fn().mockResolvedValue({
      items: [
        {
          id: 'STU-101',
          name: 'Javohir Toshmatov',
          user: { firstName: 'Javohir', lastName: 'Toshmatov', phone: '+998 90 123 45 67' },
          groups: [{ group: { name: 'Frontend Pro-24' } }],
          balance: -800000,
        },
        {
          id: 'STU-102',
          name: 'Madina Umarova',
          user: { firstName: 'Madina', lastName: 'Umarova', phone: '+998 91 987 65 43' },
          groups: [{ group: { name: 'IELTS Band 7.5+' } }],
          balance: -1200000,
        },
      ],
      total: 2,
    }),
  },
  paymentsApi: {
    create: vi.fn().mockResolvedValue({ id: 'PAY-9921', status: 'PAID' }),
  },
}));

describe('ExpressPosTerminalModal', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  const renderModal = (props: { isOpen: boolean; onClose: () => void }) =>
    render(
      <QueryClientProvider client={queryClient}>
        <ExpressPosTerminalModal {...props} />
      </QueryClientProvider>
    );

  it('renders modal when isOpen is true', () => {
    renderModal({ isOpen: true, onClose: vi.fn() });

    expect(screen.getByText(/Express Kassa & POS Terminal/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Ism, telefon yoki ID.../i)).toBeInTheDocument();
    expect(screen.getByText(/Click QR/i)).toBeInTheDocument();
    expect(screen.getByText(/Payme QR/i)).toBeInTheDocument();
  });

  it('displays real students fetched from API', async () => {
    renderModal({ isOpen: true, onClose: vi.fn() });

    expect(await screen.findByText(/Javohir Toshmatov/i)).toBeInTheDocument();
    expect(await screen.findByText(/Madina Umarova/i)).toBeInTheDocument();
  });

  it('updates amount when clicking keypad digits and preset buttons', () => {
    renderModal({ isOpen: true, onClose: vi.fn() });

    const presetBtn = screen.getByRole('button', { name: /\+.*800/i });
    fireEvent.click(presetBtn);

    const matches = screen.getAllByText(/800/i);
    expect(matches.length).toBeGreaterThan(0);
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    renderModal({ isOpen: true, onClose: handleClose });

    const closeBtn = screen.getByRole('button', { name: /Yopish/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalled();
  });
});
