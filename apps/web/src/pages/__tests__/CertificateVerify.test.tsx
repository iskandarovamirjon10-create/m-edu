// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CertificateVerifyPage } from '../CertificateVerify';
import { certificatesApi } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  certificatesApi: {
    verify: vi.fn(),
  },
}));

vi.mock('@/i18n/I18nProvider', () => ({
  useI18n: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
    locale: 'uz',
  }),
}));

vi.mock('@/hooks/usePageTitle', () => ({
  usePageTitle: vi.fn(),
}));

vi.mock('@/components/ui', () => ({
  useToasts: () => ({ push: vi.fn(), toastNode: null }),
  GlassButton: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  GlassInput: (props: any) => <input {...props} />,
}));

vi.mock('@/components/certificates/TiltCertificate', () => ({
  TiltCertificate: ({ data }: any) => (
    <div data-testid="tilt-certificate">
      <span>{data?.student?.firstName} {data?.student?.lastName}</span>
      <span>{data?.course?.name}</span>
      <span>{data?.certificateNumber}</span>
    </div>
  ),
}));

function renderWithClient(initialRoute = '/verify') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/verify" element={<CertificateVerifyPage />} />
          <Route path="/verify/:code" element={<CertificateVerifyPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CertificateVerifyPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders search input when no code is supplied in route', () => {
    renderWithClient('/verify');
    expect(screen.getByPlaceholderText(/9B47FA2B8C11/i)).toBeDefined();
  });

  it('fetches and displays certificate when valid code is supplied in URL', async () => {
    vi.mocked(certificatesApi.verify).mockResolvedValueOnce({
      isValid: true,
      certificateNumber: 'CERT-2026-0001',
      student: { firstName: 'Jasur', lastName: 'Rahimov' },
      course: { name: 'Full Stack Web Development' },
      issueDate: '2026-05-20',
    } as any);

    renderWithClient('/verify/CERT-2026-0001');

    await waitFor(() => {
      expect(certificatesApi.verify).toHaveBeenCalledWith('CERT-2026-0001');
    });

    await waitFor(() => {
      expect(screen.getByTestId('tilt-certificate')).toBeDefined();
      expect(screen.getByText(/Jasur Rahimov/i)).toBeDefined();
      expect(screen.getByText(/Full Stack Web Development/i)).toBeDefined();
    });
  });

  it('renders not found alert when API rejects or code is not found', async () => {
    vi.mocked(certificatesApi.verify).mockRejectedValueOnce(new Error('Not found'));

    renderWithClient('/verify/CERT-FAKE-999');

    await waitFor(() => {
      expect(certificatesApi.verify).toHaveBeenCalledWith('CERT-FAKE-999');
    });

    await waitFor(() => {
      expect(screen.getByText(/Certificate Not Found/i)).toBeDefined();
    });
  });

  it('allows manual search submission via input and button', async () => {
    vi.mocked(certificatesApi.verify).mockResolvedValueOnce({
      isValid: true,
      certificateNumber: 'CERT-MANUAL-123',
      student: { firstName: 'Malika', lastName: 'Saidova' },
      course: { name: 'Data Science' },
      issueDate: '2026-06-15',
    } as any);

    renderWithClient('/verify');

    const input = screen.getByPlaceholderText(/9B47FA2B8C11/i);
    fireEvent.change(input, { target: { value: 'CERT-MANUAL-123' } });

    const submitBtn = screen.getByRole('button', { name: /common.verify/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(certificatesApi.verify).toHaveBeenCalledWith('CERT-MANUAL-123');
    });
  });
});
