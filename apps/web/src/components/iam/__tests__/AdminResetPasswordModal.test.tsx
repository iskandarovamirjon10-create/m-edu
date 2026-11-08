import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminResetPasswordModal } from '../AdminResetPasswordModal';
import type { User } from '@/lib/types';

const resetPasswordMock = vi.fn();

vi.mock('@/lib/api', () => ({
  iamApi: {
    resetPassword: (...args: unknown[]) => resetPasswordMock(...args),
  },
}));

vi.mock('@/hooks/usePremiumSound', () => ({
  usePremiumSound: () => ({
    playTick: vi.fn(),
    playSuccess: vi.fn(),
    playError: vi.fn(),
  }),
}));

const mockUser: User = {
  id: 'usr_test_123',
  username: 'sherzod_admin',
  firstName: 'Sherzod',
  lastName: 'Qodirov',
  email: 'sherzod@m-edu.uz',
  role: 'ORG_ADMIN',
  isActive: true,
  organizationId: 'org_main_01',
};

describe('AdminResetPasswordModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders target user info correctly when open', () => {
    render(
      <AdminResetPasswordModal
        user={mockUser}
        open={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Sherzod Qodirov')).toBeInTheDocument();
    expect(screen.getByText('@sherzod_admin')).toBeInTheDocument();
    expect(screen.getByText('ORG_ADMIN')).toBeInTheDocument();
    expect(screen.getByText('Faol')).toBeInTheDocument();
  });

  it('initializes with a strong auto-generated password and mustChangePassword enabled', () => {
    render(
      <AdminResetPasswordModal
        user={mockUser}
        open={true}
        onClose={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText('Kuchli parol kiriting...') as HTMLInputElement;
    expect(input.value.length).toBeGreaterThanOrEqual(12);

    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it('submits administrative reset and renders credentials card on success', async () => {
    resetPasswordMock.mockResolvedValueOnce({
      message: 'Password reset successfully',
    });
    const onSuccess = vi.fn();

    render(
      <AdminResetPasswordModal
        user={mockUser}
        open={true}
        onClose={vi.fn()}
        onSuccess={onSuccess}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /Parolni Yangilash/i });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(resetPasswordMock).toHaveBeenCalledWith('usr_test_123', {
        newPassword: expect.any(String),
        mustChangePassword: true,
      });
      expect(onSuccess).toHaveBeenCalled();
    });

    expect(await screen.findByText('Parol muvaffaqiyatli yangilandi!')).toBeInTheDocument();
    expect(screen.getAllByText('@sherzod_admin').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('button', { name: /Login va Parolni Nusxalash/i })).toBeInTheDocument();
  });

  it('handles API error properly and displays error message', async () => {
    resetPasswordMock.mockRejectedValueOnce(new Error('Foydalanuvchi topilmadi'));

    render(
      <AdminResetPasswordModal
        user={mockUser}
        open={true}
        onClose={vi.fn()}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /Parolni Yangilash/i });
    await userEvent.click(submitBtn);

    expect(await screen.findByText('Foydalanuvchi topilmadi')).toBeInTheDocument();
  });
});
