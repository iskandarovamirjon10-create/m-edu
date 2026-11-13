import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
      isError: false,
      refetch: vi.fn(),
      createNew: vi.fn(),
      renameConversation: vi.fn(),
      isRenaming: false,
      deleteConversation: vi.fn(),
      loadMessages: vi.fn(),
    } as ReturnType<typeof useConversationsHook.useConversations>);

    vi.mocked(useAiHealthHook.useAiHealth).mockReturnValue({
      isOnline: true,
      mode: 'live',
      configured: true,
      isLoading: false,
      refetch: vi.fn(),
    } as ReturnType<typeof useAiHealthHook.useAiHealth>);
  });

  it('returns null when conversations flag is false', () => {
    AI_FLAGS.conversations = false;
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
    AI_FLAGS.conversations = true;
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

  it('renames a conversation from the row menu without selecting it', async () => {
    AI_FLAGS.conversations = true;
    const user = userEvent.setup();
    const onRename = vi.fn().mockResolvedValue(undefined);
    const onSelect = vi.fn();

    render(
      <CopilotHistoryRail
        collapsed={false}
        onToggleCollapse={() => {}}
        activeId={null}
        onSelect={onSelect}
        onNew={() => {}}
        onRename={onRename}
        onDelete={() => {}}
      />
    );

    await user.click(screen.getByRole('button', { name: /ko'proq|more/i }));
    await user.click(screen.getByRole('menuitem', { name: /nomini|rename/i }));

    const input = screen.getByRole('textbox', { name: /suhbat nomi|conversation title/i });
    expect(input).toHaveValue('Test');

    await user.clear(input);
    await user.type(input, 'Yangi nom{enter}');

    await waitFor(() => expect(onRename).toHaveBeenCalledWith('1', 'Yangi nom'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('shows the provider mode in the footer', () => {
    AI_FLAGS.conversations = true;
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
    expect(screen.getByText(/jonli|live/i)).toBeInTheDocument();
  });
});
