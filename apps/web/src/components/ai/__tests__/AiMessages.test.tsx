/**
 * @vitest-environment jsdom
 *
 * Tests for AiMessages:
 *  - Rendering assistant messages
 *  - Extraction and rendering of Quick Action Chips from links
 *  - Dispatching medu:navigate events on chip click
 */
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AiAssistantMessage } from '../AiMessages';
import type { AiUiMessage } from '@/types/ai';

describe('AiAssistantMessage Action Chips', () => {
  it('renders quick action chips when content contains internal routes', () => {
    const navigateSpy = vi.fn();
    window.addEventListener('medu:navigate', navigateSpy);

    const message: AiUiMessage = {
      id: 'msg-1',
      role: 'assistant',
      content:
        'Bugungi davomat indeksi 92%. [Davomat jurnali](/attendance) orqali batafsil koʻrishingiz mumkin. Shuningdek [Toʻlovlar](/payments) sahifasini tekshiring.',
      createdAt: Date.now(),
    };

    render(
      <AiAssistantMessage
        message={message}
        confirming={false}
        onConfirm={vi.fn()}
        onReject={vi.fn()}
        onDismissActionError={vi.fn()}
      />
    );

    // Verify Action Chips section is present
    expect(screen.getByText(/Tezkor amallar:/i)).toBeInTheDocument();

    const attendanceChip = screen.getByRole('button', { name: /Davomat jurnali/i });
    expect(attendanceChip).toBeInTheDocument();

    const paymentsChip = screen.getByRole('button', { name: /Toʻlovlar/i });
    expect(paymentsChip).toBeInTheDocument();

    // Click attendance chip
    fireEvent.click(attendanceChip);

    expect(navigateSpy).toHaveBeenCalledTimes(1);
    const event = navigateSpy.mock.calls[0][0] as CustomEvent;
    expect(event.detail.path).toBe('/attendance');

    window.removeEventListener('medu:navigate', navigateSpy);
  });
});
