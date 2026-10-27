import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExecutivePDFStudio } from '../ExecutivePDFStudio';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/hooks/usePremiumSound', () => ({
  usePremiumSound: () => ({
    playTick: vi.fn(),
    playSuccess: vi.fn(),
  }),
}));

describe('ExecutivePDFStudio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders certificate mode with recipient details and QR code', () => {
    const mockData = {
      id: 'CERT-TEST-001',
      docType: 'certificate' as const,
      title: 'Malaka va Natijalar Sertifikati',
      recipientName: 'Ali Valiyev',
      courseName: 'Python Backend Dasturlash',
      organizationName: 'M-EDU Test Academy',
      verificationCode: 'MEDUTEST1234',
      dateStr: '27.10.2026',
    };

    render(
      <ExecutivePDFStudio
        open={true}
        onClose={() => {}}
        initialData={mockData}
      />
    );

    expect(screen.getByText('Apple Print & Executive PDF Studio')).toBeInTheDocument();
    expect(screen.getByText('Ali Valiyev')).toBeInTheDocument();
    expect(screen.getByText('Python Backend Dasturlash')).toBeInTheDocument();
    expect(screen.getByText(/M-EDU Test Academy/i)).toBeInTheDocument();
    expect(screen.getByText('MEDUTEST1234')).toBeInTheDocument();
  });

  it('switches between Certificate, Kvitansiya (Receipt), and Transkript modes', async () => {
    const user = userEvent.setup();
    const mockData = {
      id: 'INV-TEST-001',
      docType: 'receipt' as const,
      title: "To'lov Kvitansiyasi",
      recipientName: 'Malika Sobirova',
      amount: '1 200 000 UZS',
      organizationName: 'M-EDU Test Academy',
      dateStr: '27.10.2026',
      items: [{ label: 'Oylik kurs tolovi', value: '1 200 000 UZS' }],
    };

    render(
      <ExecutivePDFStudio
        open={true}
        onClose={() => {}}
        initialData={mockData}
      />
    );

    // Default mode is receipt
    expect(screen.getByText(/To'lov Kvitansiyasi/i)).toBeInTheDocument();
    expect(screen.getAllByText('1 200 000 UZS').length).toBeGreaterThan(0);

    // Switch to Transcript
    const transcriptTab = screen.getByRole('button', { name: 'Transkript' });
    await user.click(transcriptTab);
    expect(screen.getByText(/Akademik Transkript/i)).toBeInTheDocument();

    // Switch to Certificate
    const certificateTab = screen.getByRole('button', { name: 'Sertifikat' });
    await user.click(certificateTab);
    expect(screen.getByText(/MALAKA VA NATIJALAR SERTIFIKATI/i)).toBeInTheDocument();
  });

  it('invokes window.print when Chop etish / PDF is clicked', async () => {
    const user = userEvent.setup();
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});

    render(
      <ExecutivePDFStudio
        open={true}
        onClose={() => {}}
      />
    );

    const printBtn = screen.getByRole('button', { name: /Chop etish \/ PDF/i });
    await user.click(printBtn);

    expect(printSpy).toHaveBeenCalled();
    printSpy.mockRestore();
  });
});
