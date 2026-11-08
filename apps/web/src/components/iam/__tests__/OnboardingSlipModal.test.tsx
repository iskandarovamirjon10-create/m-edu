import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnboardingSlipModal } from '../OnboardingSlipModal';
import * as printEngine from '@/lib/printEngine';

vi.mock('@/lib/printEngine', () => ({
  triggerPrint: vi.fn(),
}));

describe('OnboardingSlipModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockRecords = [
    {
      id: 'u-1',
      fullName: 'Anvar Qosimov',
      username: 'anvar_q',
      temporaryPassword: 'TempPass123!',
      role: 'TEACHER',
      organizationName: 'Prezident Maktabi',
      branchName: 'Toshkent',
      mustChangePassword: true,
    },
    {
      id: 'u-2',
      fullName: 'Malika Karimova',
      username: 'malika_k',
      temporaryPassword: 'TempPass456!',
      role: 'STUDENT',
      organizationName: 'Prezident Maktabi',
      branchName: 'Toshkent',
      mustChangePassword: true,
    },
  ];

  it('renders onboarding slips with credentials and security instructions', () => {
    render(
      <OnboardingSlipModal
        open={true}
        onClose={vi.fn()}
        records={mockRecords}
      />
    );

    expect(screen.getAllByText('Anvar Qosimov').length).toBeGreaterThan(0);
    expect(screen.getAllByText('@anvar_q').length).toBeGreaterThan(0);
    expect(screen.getAllByText('TempPass123!').length).toBeGreaterThan(0);
    expect(screen.getAllByText("O'qituvchi").length).toBeGreaterThan(0);

    expect(screen.getAllByText('Malika Karimova').length).toBeGreaterThan(0);
    expect(screen.getAllByText('@malika_k').length).toBeGreaterThan(0);
    expect(screen.getAllByText('TempPass456!').length).toBeGreaterThan(0);
    expect(screen.getAllByText("O'quvchi").length).toBeGreaterThan(0);

    expect(screen.getAllByText(/Xavfsizlik qoidalari va yo'riqnoma/i).length).toBeGreaterThan(0);
  });

  it('filters slips in real-time when searching by username or name', async () => {
    const user = userEvent.setup();
    render(
      <OnboardingSlipModal
        open={true}
        onClose={vi.fn()}
        records={mockRecords}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Qidiruv/i);
    await user.type(searchInput, 'malika');

    expect(screen.getAllByText('Malika Karimova').length).toBeGreaterThan(0);
    expect(screen.queryByText('Anvar Qosimov')).not.toBeInTheDocument();
  });

  it('calls triggerPrint with onboarding-slip-a4 mode when print button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <OnboardingSlipModal
        open={true}
        onClose={vi.fn()}
        records={mockRecords}
      />
    );

    const printButton = screen.getByRole('button', { name: /Chop etish/i });
    await user.click(printButton);

    expect(printEngine.triggerPrint).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'onboarding-slip-a4',
      })
    );
  });

  it('copies credentials text to clipboard when copy button is clicked', async () => {
    const user = userEvent.setup();
    const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();

    render(
      <OnboardingSlipModal
        open={true}
        onClose={vi.fn()}
        records={mockRecords}
      />
    );

    const copyBtn = screen.getByRole('button', { name: /Matnni nusxalash/i });
    await user.click(copyBtn);

    expect(writeTextSpy).toHaveBeenCalled();
    const copiedText = writeTextSpy.mock.calls[0][0];
    expect(copiedText).toContain('@anvar_q');
    expect(copiedText).toContain('TempPass123!');
    expect(copiedText).toContain('@malika_k');
    expect(copiedText).toContain('TempPass456!');
  });
});
