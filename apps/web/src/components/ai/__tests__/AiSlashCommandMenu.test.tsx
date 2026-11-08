/**
 * AiSlashCommandMenu & Composer Slash Navigation Tests
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AiSlashCommandMenu } from '../AiSlashCommandMenu';
import { AiComposer } from '../AiComposer';

describe('AiSlashCommandMenu component', () => {
  it('renders all commands when query is "/"', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <AiSlashCommandMenu
        query="/"
        selectedIndex={0}
        onSelect={onSelect}
        onClose={onClose}
      />
    );

    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByText('/davomat')).toBeInTheDocument();
    expect(screen.getByText('/qarz')).toBeInTheDocument();
    expect(screen.getByText('/jadval')).toBeInTheDocument();
    expect(screen.getByText('/talaba')).toBeInTheDocument();
    expect(screen.getByText('/xulosa')).toBeInTheDocument();
  });

  it('filters commands according to user input', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <AiSlashCommandMenu
        query="/qar"
        selectedIndex={0}
        onSelect={onSelect}
        onClose={onClose}
      />
    );

    expect(screen.getByText('/qarz')).toBeInTheDocument();
    expect(screen.queryByText('/davomat')).toBeNull();
  });

  it('triggers onSelect when an item is clicked', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <AiSlashCommandMenu
        query="/"
        selectedIndex={0}
        onSelect={onSelect}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByText('/jadval'));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ command: '/jadval' })
    );
  });
});

describe('AiComposer slash command interaction', () => {
  it('opens slash menu when user types / and selects command on enter', () => {
    const onSend = vi.fn();
    const onStop = vi.fn();

    render(<AiComposer status="idle" onSend={onSend} onStop={onStop} />);

    const textarea = screen.getByTestId('ai-composer-input');
    fireEvent.change(textarea, { target: { value: '/' } });

    // Menu should appear
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByText('/davomat')).toBeInTheDocument();

    // Press Enter to execute first command (/davomat)
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });

    expect(onSend).toHaveBeenCalledWith('Bugungi umumiy davomat tahlilini ko‘rsat');
  });

  it('navigates slash menu with arrow keys', () => {
    const onSend = vi.fn();
    const onStop = vi.fn();

    render(<AiComposer status="idle" onSend={onSend} onStop={onStop} />);

    const textarea = screen.getByTestId('ai-composer-input');
    fireEvent.change(textarea, { target: { value: '/' } });

    // Press ArrowDown to select second command (/qarz)
    fireEvent.keyDown(textarea, { key: 'ArrowDown', code: 'ArrowDown' });
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });

    expect(onSend).toHaveBeenCalledWith(
      'Muddati o‘tgan to‘lovlar va qarzdorlar ro‘yxatini ko‘rsat'
    );
  });

  it('inserts prompt prefix into draft for commands with args (/talaba)', () => {
    const onSend = vi.fn();
    const onStop = vi.fn();

    render(<AiComposer status="idle" onSend={onSend} onStop={onStop} />);

    const textarea = screen.getByTestId('ai-composer-input') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '/tal' } });

    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });

    // Should NOT send yet, but populate textarea draft
    expect(onSend).not.toHaveBeenCalled();
    expect(textarea.value).toBe('talaba haqida maʼlumot: ');
  });

  it('closes slash menu on Escape', () => {
    const onSend = vi.fn();
    const onStop = vi.fn();

    render(<AiComposer status="idle" onSend={onSend} onStop={onStop} />);

    const textarea = screen.getByTestId('ai-composer-input') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '/' } });

    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.keyDown(textarea, { key: 'Escape', code: 'Escape' });

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(textarea.value).toBe('');
  });
});
