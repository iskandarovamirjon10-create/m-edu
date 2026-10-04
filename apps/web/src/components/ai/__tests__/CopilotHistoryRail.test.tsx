import { render, screen } from '@testing-library/react';
import { CopilotHistoryRail } from '../CopilotHistoryRail';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AI_FLAGS } from '@/lib/ai/flags';
import * as useConversationsHook from '@/hooks/useConversations';
import * as useAiHealthHook from '@/hooks/useAiHealth';

vi.mock('@/hooks/useConversations');
vi.mock('@/hooks/useAiHealth');

describe('CopilotHistoryRail', () => {
  beforeEach(() => {
    vi.mocked(useConversationsHook.useConversations).mockReturnValue({
      conversations: [
        { id: '1', title: 'Test', preview: '', updatedAt: new Date().toISOString(), messageCount: 1 }
      ],
      isLoading: false,
      createNew: vi.fn(),
      deleteConversation: vi.fn(),
      loadMessages: vi.fn(),
    } as any);

    vi.mocked(useAiHealthHook.useAiHealth).mockReturnValue({
      isOnline: true,
      isLoading: false,
    } as any);
  });

  it('returns null when conversations flag is false', () => {
    (AI_FLAGS as any).conversations = false;
    const { container } = render(
      <CopilotHistoryRail
        collapsed={false}
        onToggleCollapse={() => {}}
        activeId={null}
        onSelect={() => {}}
        onNew={() => {}}
        onDelete={() => {}}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders correctly when conversations flag is true', () => {
    (AI_FLAGS as any).conversations = true;
    render(
      <CopilotHistoryRail
        collapsed={false}
        onToggleCollapse={() => {}}
        activeId={null}
        onSelect={() => {}}
        onNew={() => {}}
        onDelete={() => {}}
      />
    );
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});
