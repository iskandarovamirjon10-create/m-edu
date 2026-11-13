import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Kiosk } from '../Kiosk';

vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'usr-1', firstName: 'Sardor', role: 'ADMIN', organization: { name: 'M-EDU Academy' } },
    isAuthenticated: true,
  }),
}));

vi.mock('@/components/WebcamCapture', () => ({
  WebcamCapture: () => <div data-testid="webcam-capture-mock">Webcam Mock</div>,
}));

describe('Kiosk Page', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it('renders Kiosk header, live turnstile HUD, and biometric tabs', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Kiosk />
        </BrowserRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText(/Smart Reception Kiosk/i)).toBeInTheDocument();
    expect(screen.getByText(/Face ID Biometriya/i)).toBeInTheDocument();
    expect(screen.getByText(/QR \/ ID Karta/i)).toBeInTheDocument();
    expect(screen.getByText(/Bugungi Darslar Jadvali & Xonalar/i)).toBeInTheDocument();
  });

  it('switches between Face ID and QR modes', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Kiosk />
        </BrowserRouter>
      </QueryClientProvider>
    );

    const qrTab = screen.getByRole('button', { name: /QR \/ ID Karta/i });
    fireEvent.click(qrTab);
    expect(screen.getByText(/ID \/ QR Kartani/i)).toBeInTheDocument();

    const faceTab = screen.getByRole('button', { name: /Face ID Biometriya/i });
    fireEvent.click(faceTab);
    expect(screen.getByText(/Kameraga qarang/i)).toBeInTheDocument();
  });

  it('opens lock exit pin modal when exit button is clicked', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Kiosk />
        </BrowserRouter>
      </QueryClientProvider>
    );

    const exitBtn = screen.getByRole('button', { name: /Kioskdan chiqish/i });
    fireEvent.click(exitBtn);

    expect(screen.getByText(/Kioskdanni Chiqish/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/••••/i)).toBeInTheDocument();
  });
});
