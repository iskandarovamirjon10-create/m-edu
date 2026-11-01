/**
 * Test Suite for Payments v2 Features:
 * - AiDebtReminderModal
 * - PosThermalReceiptModal
 * - PaymentsAnalyticsTab
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AiDebtReminderModal } from '../AiDebtReminderModal';
import { PosThermalReceiptModal } from '../PosThermalReceiptModal';
import { PaymentsAnalyticsTab } from '../PaymentsAnalyticsTab';
import type { Payment, Student } from '@/lib/types';

vi.mock('@/hooks/usePremiumSound', () => ({
  usePremiumSound: () => ({
    playTick: vi.fn(),
    playPop: vi.fn(),
    playSuccess: vi.fn(),
    playError: vi.fn(),
  }),
}));

vi.mock('@/hooks/useHaptics', () => ({
  useHaptics: () => ({
    light: vi.fn(),
    medium: vi.fn(),
    heavy: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

const mockStudent: Student = {
  id: 'st-1',
  organizationId: 'org-1',
  userId: 'usr-1',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  user: {
    id: 'usr-1',
    firstName: 'Azizbek',
    lastName: 'Rahimov',
    email: 'azizbek@example.com',
    phone: '+998901234567',
    isActive: true,
  },
};

const mockPayment: Payment = {
  id: 'pay-xyz-123456',
  organizationId: 'org-1',
  studentId: 'st-1',
  amount: '750000',
  status: 'OVERDUE',
  method: 'CASH',
  description: 'Oktabr oylik tolovi',
  createdAt: '2026-10-15T10:00:00Z',
  student: mockStudent,
};

describe('Payments v2 Suite', () => {
  it('renders PosThermalReceiptModal with 80mm POS slip content', () => {
    const handleClose = vi.fn();
    render(
      <PosThermalReceiptModal
        open={true}
        onClose={handleClose}
        payment={mockPayment}
        orgName="M-EDU TASHKENT"
        cashierName="Kamola"
      />,
    );

    expect(screen.getByText(/M-EDU TASHKENT/i)).toBeInTheDocument();
    expect(screen.getByText(/RASMIY TO'LOV CHEKI/i)).toBeInTheDocument();
    expect(screen.getByText(/Azizbek Rahimov/i)).toBeInTheDocument();
    expect(screen.getByText(/Kamola/i)).toBeInTheDocument();
  });

  it('renders PaymentsAnalyticsTab with calculated telemetry and method distribution', () => {
    const paymentsList: Payment[] = [
      mockPayment,
      {
        ...mockPayment,
        id: 'pay-2',
        status: 'PAID',
        method: 'CARD',
        amount: '1250000',
      },
    ];

    render(
      <PaymentsAnalyticsTab
        payments={paymentsList}
        onOpenQuickPayment={vi.fn()}
        onOpenZReport={vi.fn()}
      />,
    );

    expect(screen.getByText(/Jami Qabul Qilingan Tushum/i)).toBeInTheDocument();
    expect(screen.getByText(/To'lov Intizomi Ko'rsatkichi/i)).toBeInTheDocument();
    expect(screen.getByText(/To'lov Usullari Taqsimoti/i)).toBeInTheDocument();
    expect(screen.getByText(/Naqd pul/i)).toBeInTheDocument();
    expect(screen.getByText(/Bank kartasi/i)).toBeInTheDocument();
  });

  it('renders AiDebtReminderModal and tone selector', async () => {
    render(
      <AiDebtReminderModal
        open={true}
        onClose={vi.fn()}
        payment={mockPayment}
      />,
    );

    expect(screen.getByText(/AI Smart Eslatma/i)).toBeInTheDocument();
    expect(screen.getByText(/Azizbek Rahimov/i)).toBeInTheDocument();
    expect(screen.getByText(/Samimiy/i)).toBeInTheDocument();
    expect(screen.getByText(/Rasmiy/i)).toBeInTheDocument();
    expect(screen.getByText(/Shoshilinch/i)).toBeInTheDocument();
  });
});
