import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CopilotCommandPalette, type CopilotCommand } from '../CopilotCommandPalette';

function commands(run: () => void): CopilotCommand[] {
  return [
    {
      id: 'new',
      label: 'Yangi suhbat',
      hint: 'Toza suhbat',
      group: 'Amallar',
      icon: null,
      shortcut: '⌘⇧O',
      run,
    },
    {
      id: 'attendance',
      label: 'Davomat tahlili',
      hint: "Bugungi davomat",
      group: 'Tezkor so‘rovlar',
      icon: null,
      run,
    },
  ];
}

describe('CopilotCommandPalette', () => {
  it('filters commands, runs the active one and closes', async () => {
    const onClose = vi.fn();
    const run = vi.fn();

    const { rerender } = render(
      <CopilotCommandPalette open onClose={onClose} commands={commands(run)} />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const input = screen.getByRole('combobox');

    fireEvent.change(input, { target: { value: 'davomat' } });
    expect(screen.getByText('Davomat tahlili')).toBeInTheDocument();
    expect(screen.queryByText('Yangi suhbat')).toBeNull();

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(run).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(<CopilotCommandPalette open={false} onClose={onClose} commands={commands(run)} />);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('moves the active row with the arrow keys', () => {
    const run = vi.fn();
    render(<CopilotCommandPalette open onClose={() => {}} commands={commands(run)} />);

    const input = screen.getByRole('combobox');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<CopilotCommandPalette open onClose={onClose} commands={commands(() => {})} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
