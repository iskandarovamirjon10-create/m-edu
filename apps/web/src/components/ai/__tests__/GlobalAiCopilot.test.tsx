import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { GlobalAiCopilot } from '../GlobalAiCopilot';

vi.mock('@/lib/ai', () => ({
  aiChatStream: vi.fn(),
  aiChat: vi.fn(),
  toAiErrorInfo: vi.fn(),
  confirmAiAction: vi.fn(),
  buildActionResult: vi.fn(),
  isPendingConfirmation: vi.fn(),
  parseActionParameters: vi.fn(),
  prettifyArguments: vi.fn(),
}));

describe('GlobalAiCopilot', () => {
  it('renders FAB when closed', () => {
    render(
      <BrowserRouter>
        <GlobalAiCopilot />
      </BrowserRouter>
    );
    expect(screen.getByRole('button', { name: /AI Copilot/i })).toBeInTheDocument();
  });

  it('opens panel without crashing when triggered', () => {
    window.localStorage.setItem(
      'medu:ai-copilot:v1',
      JSON.stringify({
        version: 1,
        messages: [
          { id: '1', role: 'user', content: 'Salom' },
          { id: '2', role: 'assistant', content: 'Salom! Qanday yordam bera olaman?' },
        ],
      })
    );

    render(
      <BrowserRouter>
        <GlobalAiCopilot />
      </BrowserRouter>
    );

    const fab = screen.getByRole('button', { name: /AI Copilot/i });
    fireEvent.click(fab);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Salom! Qanday yordam bera olaman?')).toBeInTheDocument();
  });
});
