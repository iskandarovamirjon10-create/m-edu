/**
 * exportUtils unit tests — verifies safe Markdown export formatting and download trigger.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportConversationToMarkdown, exportConversationToPrint } from '../exportUtils';
import type { AiUiMessage } from '@/types/ai';

describe('exportConversationToMarkdown', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('does nothing when messages array is empty', () => {
    const createElementSpy = vi.spyOn(document, 'createElement');
    exportConversationToMarkdown([]);
    expect(createElementSpy).not.toHaveBeenCalled();
  });

  it('formats conversation and triggers file download via Blob', () => {
    let capturedBlob: Blob | null = null;
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;

    URL.createObjectURL = vi.fn((blob: Blob) => {
      capturedBlob = blob;
      return 'blob:mock-url';
    });
    URL.revokeObjectURL = vi.fn();

    const mockAnchor = {
      href: '',
      download: '',
      click: vi.fn(),
    };
    vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);
    const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockAnchor as any);
    const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockAnchor as any);

    const sampleMessages: AiUiMessage[] = [
      {
        id: '1',
        role: 'user',
        content: 'Bugungi davomat qanday?',
      },
      {
        id: '2',
        role: 'assistant',
        content: 'Bugungi davomat 92%.',
        toolActivities: [
          {
            toolName: 'attendance.summary',
            subject: 'Davomat tahlili',
            status: 'success',
            detail: 'Davomat hisoboti olindi',
          },
        ],
      },
    ];

    exportConversationToMarkdown(sampleMessages, 'Davomat-Suhbat');

    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(capturedBlob).not.toBeNull();
    expect(mockAnchor.download).toContain('davomat-suhbat-');
    expect(mockAnchor.download).toContain('.md');
    expect(mockAnchor.click).toHaveBeenCalled();
    expect(appendChildSpy).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });
});

describe('exportConversationToPrint', () => {
  it('calls window.print', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    exportConversationToPrint();
    expect(printSpy).toHaveBeenCalled();
  });
});
