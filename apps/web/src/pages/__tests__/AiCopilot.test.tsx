/**
 * AiCopilot page — critical flow tests against the mocked AI API:
 *  empty state / quick prompts, send + loading, reply rendering,
 *  network & auth errors, retry without duplication, tool round-trips,
 *  action confirmation (confirm / reject / failure / escape),
 *  cancellation, keyboard behavior, persistence, clear chat,
 *  accessibility states, responsive guards, dark mode and offline pill.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@/lib/api';
import type { AiChatResponse, AiWireMessage } from '@/types/ai';
import AiCopilot from '../AiCopilot';
import { I18nProvider } from '@/i18n/I18nProvider';

const { aiChatMock, confirmMock } = vi.hoisted(() => ({
  aiChatMock: vi.fn(),
  confirmMock: vi.fn(),
}));

vi.mock('@/lib/ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ai')>();
  return {
    ...actual,
    aiChat: (messages: AiWireMessage[], options?: { signal?: AbortSignal }) =>
      aiChatMock(messages, options),
    confirmAiAction: (actionId: string) => confirmMock(actionId),
  };
});

const STORAGE_KEY = 'medu:ai-copilot:v1';

function assistantReply(content: string): AiChatResponse {
  return { type: 'message', message: { role: 'assistant', content } };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const composer = () => screen.getByRole('textbox', { name: 'Xabar matni' });
const sendButton = () => screen.getByTestId('ai-send');
const messageList = () => screen.getByTestId('ai-message-list');

async function typeAndSend(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(composer(), `${text}{enter}`);
}

/** First response proposing a Telegram message that needs confirmation. */
function pendingConfirmationResponse(): AiChatResponse {
  return {
    type: 'tool_calls',
    message: {
      role: 'assistant',
      content: '',
      toolCalls: [
        {
          id: 'tc1',
          function: {
            name: 'telegram.prepareMessage',
            arguments: JSON.stringify({
              message: 'Ertangi darslar bekor qilindi',
              audience: 'Barcha ota-onalar',
            }),
          },
        },
      ],
    },
    toolResults: [
      {
        id: 'tc1',
        status: 'PENDING_CONFIRMATION',
        actionId: 'act-123',
        message: 'Requires user confirmation for action: telegram.prepareMessage',
      },
    ],
  };
}

function renderCopilot() {
  return render(
    <I18nProvider initialLocale="uz">
      <AiCopilot />
    </I18nProvider>,
  );
}

async function reachConfirmation(user: ReturnType<typeof userEvent.setup>) {
  aiChatMock.mockResolvedValueOnce(pendingConfirmationResponse());
  await typeAndSend(user, 'Ota-onalarga xabar yubor');
  return screen.findByTestId('ai-action-confirmation');
}

describe('AiCopilot empty state', () => {
  beforeEach(() => {
    localStorage.clear();
    aiChatMock.mockReset();
    confirmMock.mockReset();
  });

  afterEach(() => {
    document.documentElement.classList.remove('dark');
  });

  it('renders the welcome, six capability quick prompts and the composer', () => {
    renderCopilot();

    expect(
      screen.getByRole('heading', { name: 'Bugun sizga qanday yordam beray?' }),
    ).toBeInTheDocument();
    expect(messageList()).toHaveAttribute('role', 'log');
    expect(messageList()).toHaveAttribute('aria-live', 'polite');
    expect(composer()).toBeEnabled();
    expect(screen.getByText('AI yordamchi')).toBeInTheDocument();

    const prompts = screen.getAllByRole('button', { name: /— / });
    expect(prompts).toHaveLength(6);
    expect(screen.getByRole('button', { name: /^Davomat — / })).toBeEnabled();
    expect(screen.getByRole('button', { name: /^To’lovlar — / })).toBeInTheDocument();
  });

  it('sends a quick prompt straight to the API', async () => {
    aiChatMock.mockResolvedValue(assistantReply('Davomat tayyor.'));
    const user = userEvent.setup();
    renderCopilot();

    await user.click(screen.getByRole('button', { name: /^Davomat — / }));

    expect(await screen.findByText('Davomat tayyor.')).toBeInTheDocument();
    expect(aiChatMock).toHaveBeenCalledTimes(1);
    expect(aiChatMock.mock.calls[0][0]).toEqual([
      { role: 'user', content: 'Bugungi davomatni ko’rsat' },
    ]);
  });
});

describe('AiCopilot sending and replies', () => {
  beforeEach(() => {
    localStorage.clear();
    aiChatMock.mockReset();
    confirmMock.mockReset();
  });

  it('sends on Enter, shows loading states and renders the reply', async () => {
    const pending = deferred<AiChatResponse>();
    aiChatMock.mockReturnValue(pending.promise);
    const user = userEvent.setup();
    renderCopilot();

    await typeAndSend(user, 'Bugungi davomatni ko’rsat');

    expect(await screen.findByText('Bugungi davomatni ko’rsat')).toBeInTheDocument();
    expect(aiChatMock).toHaveBeenCalledTimes(1);
    expect(aiChatMock.mock.calls[0][0]).toEqual([
      { role: 'user', content: 'Bugungi davomatni ko’rsat' },
    ]);

    const thinking = within(messageList()).getByRole('status');
    expect(thinking).toHaveTextContent('AI ishlayapti');
    expect(thinking).toHaveAttribute('aria-live', 'polite');
    expect(messageList()).toHaveAttribute('aria-busy', 'true');
    expect(composer()).toBeDisabled();
    expect(sendButton()).toHaveAttribute('aria-busy', 'true');

    await act(async () => {
      pending.resolve(assistantReply('Bugungi davomat tayyor.'));
    });

    expect(await screen.findByText('Bugungi davomat tayyor.')).toBeInTheDocument();
    expect(within(messageList()).queryByRole('status')).toBeNull();
    expect(messageList()).toHaveAttribute('aria-busy', 'false');
    expect(composer()).toBeEnabled();
    expect(sendButton()).not.toHaveAttribute('aria-busy');
  });

  it('renders markdown replies (headings, emphasis, tables)', async () => {
    aiChatMock.mockResolvedValue(
      assistantReply('## Hisobot\n\n**Jami:** 42\n\n| Guruh | Soni |\n| --- | --- |\n| A-1 | 20 |'),
    );
    const user = userEvent.setup();
    renderCopilot();

    await typeAndSend(user, 'Bugungi hisobot');

    expect(await screen.findByRole('heading', { level: 2, name: 'Hisobot' })).toBeInTheDocument();
    expect(screen.getByText('Jami:').tagName).toBe('STRONG');
    const table = await screen.findByRole('table');
    expect(within(table).getByRole('cell', { name: 'A-1' })).toBeInTheDocument();
  });

  it('Shift+Enter inserts a newline instead of sending', async () => {
    aiChatMock.mockResolvedValue(assistantReply('ok'));
    const user = userEvent.setup();
    renderCopilot();

    await user.type(composer(), 'birinchi qator');
    await user.keyboard('{shift>}{enter}{/shift}');
    await user.type(composer(), 'ikkinchi qator');

    expect(composer()).toHaveValue('birinchi qator\nikkinchi qator');
    expect(aiChatMock).not.toHaveBeenCalled();
  });
});

describe('AiCopilot errors and retry', () => {
  beforeEach(() => {
    localStorage.clear();
    aiChatMock.mockReset();
    confirmMock.mockReset();
  });

  it('shows a friendly network error with retry and the last prompt', async () => {
    aiChatMock.mockRejectedValue(new TypeError('fetch failed'));
    const user = userEvent.setup();
    renderCopilot();

    await typeAndSend(user, 'Bugungi davomatni ko’rsat');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      'AI bilan bog’lanib bo’lmadi. Internet aloqasini tekshirib, qayta urinib ko’ring.',
    );
    expect(alert).toHaveTextContent('So’rov:');
    expect(alert).toHaveTextContent('Bugungi davomatni ko’rsat');
    expect(screen.getByTestId('ai-retry')).toBeInTheDocument();
    expect(composer()).toBeEnabled();
  });

  it('retries the exact history without duplicating the user message', async () => {
    aiChatMock
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(assistantReply('Tayyor javob'));
    const user = userEvent.setup();
    renderCopilot();

    await typeAndSend(user, 'Salom');
    await screen.findByRole('alert');
    await user.click(screen.getByTestId('ai-retry'));

    expect(await screen.findByText('Tayyor javob')).toBeInTheDocument();
    expect(aiChatMock).toHaveBeenCalledTimes(2);

    const secondHistory = aiChatMock.mock.calls[1][0] as AiWireMessage[];
    expect(secondHistory.filter((message) => message.role === 'user')).toHaveLength(1);
    expect(screen.getAllByText('Salom')).toHaveLength(1);
    expect(screen.queryByTestId('ai-error-card')).toBeNull();
  });

  it('hides retry for non-retryable auth errors and keeps the composer usable', async () => {
    aiChatMock.mockRejectedValue(new ApiError(401, 'expired'));
    const user = userEvent.setup();
    renderCopilot();

    await typeAndSend(user, 'Birinchi savol');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Sessiya muddati tugagan');
    expect(screen.queryByTestId('ai-retry')).toBeNull();
    expect(composer()).toBeEnabled();

    aiChatMock.mockResolvedValueOnce(assistantReply('Qaytadan javob'));
    await typeAndSend(user, 'Boshqa savol');

    expect(await screen.findByText('Qaytadan javob')).toBeInTheDocument();
    expect(screen.queryByTestId('ai-error-card')).toBeNull();
  });

  it('cancels an in-flight request from the stop button', async () => {
    aiChatMock.mockImplementation(
      (_messages: AiWireMessage[], options?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const user = userEvent.setup();
    renderCopilot();

    await typeAndSend(user, 'Salom');
    await user.click(await screen.findByTestId('ai-stop'));

    expect(await screen.findByText('Javob bekor qilindi.')).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
    await waitFor(() => expect(composer()).toBeEnabled());
  });
});

describe('AiCopilot tool calls', () => {
  beforeEach(() => {
    localStorage.clear();
    aiChatMock.mockReset();
    confirmMock.mockReset();
  });

  it('shows a human-readable tool activity, feeds the tool result back and continues', async () => {
    aiChatMock
      .mockResolvedValueOnce({
        type: 'tool_calls',
        message: {
          role: 'assistant',
          content: '',
          toolCalls: [{ id: 'tc1', function: { name: 'attendance.today', arguments: '{}' } }],
        },
        toolResults: [{ id: 'tc1', result: { present: 12, absent: 3 } }],
      })
      .mockResolvedValueOnce(assistantReply('Bugungi davomat: 12 kishi.'));
    const user = userEvent.setup();
    renderCopilot();

    await typeAndSend(user, 'Bugungi davomat?');

    expect(await screen.findByText('Davomat ma’lumotlari olindi')).toBeInTheDocument();
    expect(aiChatMock).toHaveBeenCalledTimes(2);

    const secondHistory = aiChatMock.mock.calls[1][0] as AiWireMessage[];
    expect(
      secondHistory.some((message) => message.role === 'tool' && message.toolCallId === 'tc1'),
    ).toBe(true);

    expect(await screen.findByText('Bugungi davomat: 12 kishi.')).toBeInTheDocument();
  });
});

describe('AiCopilot action confirmation', () => {
  beforeEach(() => {
    localStorage.clear();
    aiChatMock.mockReset();
    confirmMock.mockReset();
  });

  it('opens an explicit confirmation card with backend-provided parameters and locks the composer', async () => {
    const user = userEvent.setup();
    renderCopilot();

    const card = await reachConfirmation(user);

    expect(card).toHaveTextContent('Telegram xabari tayyorlash');
    expect(card).toHaveTextContent(/Tasdiqlash talab qilinadi|ai\.confirmationRequired/i);
    expect(within(card).getByText('Xabar')).toBeInTheDocument();
    expect(within(card).getByText('Ertangi darslar bekor qilindi')).toBeInTheDocument();
    expect(within(card).getByText('Olchov')).toBeInTheDocument();
    expect(within(card).getByText('Barcha ota-onalar')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: /Tasdiqlash|Confirm/i })).toBeEnabled();
    expect(within(card).getByRole('button', { name: /Bekor qilish|Cancel|common\.cancel/i })).toBeEnabled();

    expect(composer()).toBeDisabled();
    expect(screen.getByText('Amalni tasdiqlashni yakunlang')).toBeInTheDocument();
    expect(aiChatMock).toHaveBeenCalledTimes(1);
    expect(confirmMock).not.toHaveBeenCalled();
  });

  it('confirms exactly once and renders the structured result card', async () => {
    confirmMock.mockResolvedValue({ status: 'PREPARED', message: 'Tayyorlandi' });
    const user = userEvent.setup();
    renderCopilot();

    const card = await reachConfirmation(user);
    const confirmButton = within(card).getByRole('button', { name: /Tasdiqlash|common\.confirm|Confirm/i });
    const cancelButton = within(card).getByRole('button', { name: /Bekor qilish|Cancel|common\.cancel/i });
    expect(document.activeElement).toBe(cancelButton);

    await user.click(confirmButton);

    const result = await screen.findByTestId('ai-action-result');
    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(confirmMock.mock.calls[0][0]).toBe('act-123');
    expect(result).toHaveTextContent('Amal muvaffaqiyatli bajarildi');
    expect(result).toHaveTextContent('Holat');
    expect(result).toHaveTextContent('PREPARED');
    expect(result).toHaveTextContent(/Texnik tafsilotlar|ai\.technicalDetails/i);
    await user.click(within(result).getByRole('button', { name: /Texnik tafsilotlar|ai\.technicalDetails/i }));
    await waitFor(() => expect(result).toHaveTextContent('"status": "PREPARED"'));

    expect(screen.queryByTestId('ai-action-confirmation')).toBeNull();
    expect(aiChatMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(composer()).toBeEnabled());
  });

  it('rejecting (button or Escape) cancels without calling the API again', async () => {
    const user = userEvent.setup();
    renderCopilot();

    const card = await reachConfirmation(user);
    await user.click(within(card).getByRole('button', { name: /Bekor qilish|Cancel|common\.cancel/i }));

    expect(screen.queryByTestId('ai-action-confirmation')).toBeNull();
    expect(
      await screen.findByText('Amal bekor qilindi. Boshqa topshiriq berishingiz mumkin.'),
    ).toBeInTheDocument();
    expect(confirmMock).not.toHaveBeenCalled();
    expect(aiChatMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(composer()).toBeEnabled());

    // A second confirmation round, dismissed with Escape from the focused button.
    const secondCard = await reachConfirmation(user);
    const secondCancelButton = within(secondCard).getByRole('button', { name: /Bekor qilish|Cancel|common\.cancel/i });
    expect(document.activeElement).toBe(secondCancelButton);
    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('ai-action-confirmation')).toBeNull();
    expect(confirmMock).not.toHaveBeenCalled();
  });

  it('shows a non-retryable failure card when confirmation is rejected by the backend', async () => {
    confirmMock.mockRejectedValue(new ApiError(404, 'action expired'));
    const user = userEvent.setup();
    renderCopilot();

    const card = await reachConfirmation(user);
    await user.click(within(card).getByRole('button', { name: /Tasdiqlash|Confirm/i }));

    const errorCard = await screen.findByTestId('ai-action-error');
    expect(errorCard).toHaveAttribute('role', 'alert');
    expect(errorCard).toHaveTextContent(/Tasdiqlanayotgan amal topilmadi|muddati tugagan|ai\./i);
    expect(screen.queryByTestId('ai-action-confirmation')).toBeNull();
    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(aiChatMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(composer()).toBeEnabled());
  });
});

describe('AiCopilot persistence and clear', () => {
  beforeEach(() => {
    localStorage.clear();
    aiChatMock.mockReset();
    confirmMock.mockReset();
  });

  it('persists the conversation and restores it on the next visit', async () => {
    aiChatMock.mockResolvedValue(assistantReply('Saqlangan javob.'));
    const user = userEvent.setup();
    const first = renderCopilot();

    await typeAndSend(user, 'Assalomu alaykum');
    await screen.findByText('Saqlangan javob.');

    const stored = localStorage.getItem(STORAGE_KEY);
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored as string);
    expect(parsed.version).toBe(1);
    expect(
      (parsed.messages as Array<{ role: string }>).some((message) => message.role === 'assistant'),
    ).toBe(true);

    first.unmount();
    renderCopilot();

    expect(screen.getByText('Assalomu alaykum')).toBeInTheDocument();
    expect(screen.getByText('Saqlangan javob.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Bugun sizga qanday yordam beray?' })).toBeNull();
  });

  it('drops stale pending confirmations when restoring', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        messages: [
          {
            id: 'm1',
            role: 'assistant',
            content: '',
            createdAt: 1,
            confirmation: { actionId: 'old-act', toolName: 'telegram.prepareMessage' },
            toolActivities: [
              { id: 't1', toolName: 'telegram.prepareMessage', status: 'pending_confirmation' },
            ],
          },
        ],
        history: [{ role: 'user', content: 'x' }],
      }),
    );

    renderCopilot();

    expect(screen.queryByTestId('ai-action-confirmation')).toBeNull();
    expect(screen.getByText('Telegram xabari bekor qilindi')).toBeInTheDocument();
    expect(composer()).toBeEnabled();
  });

  it('clears the conversation and its stored data after confirmation', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        messages: [
          { id: 'm1', role: 'user', content: 'eski xabar', createdAt: 1 },
        ],
        history: [{ role: 'user', content: 'eski xabar' }],
      }),
    );
    const user = userEvent.setup();
    renderCopilot();

    expect(screen.getByText('eski xabar')).toBeInTheDocument();
    await user.click(screen.getByTestId('ai-clear-header'));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Chatni tozalash');
    await user.click(within(dialog).getByRole('button', { name: 'Tozalash' }));

    expect(
      await screen.findByRole('heading', { name: 'Bugun sizga qanday yordam beray?' }),
    ).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(screen.queryByText('eski xabar')).toBeNull();
  });
});

describe('AiCopilot presentation states', () => {
  beforeEach(() => {
    localStorage.clear();
    aiChatMock.mockReset();
    confirmMock.mockReset();
  });

  afterEach(() => {
    document.documentElement.classList.remove('dark');
  });

  it('announces busy state through aria-busy on the live region', async () => {
    const pending = deferred<AiChatResponse>();
    aiChatMock.mockReturnValue(pending.promise);
    const user = userEvent.setup();
    renderCopilot();

    expect(messageList()).toHaveAttribute('aria-busy', 'false');
    await typeAndSend(user, 'Salom');
    expect(messageList()).toHaveAttribute('aria-busy', 'true');

    await act(async () => {
      pending.resolve(assistantReply('Javob'));
    });
    expect(messageList()).toHaveAttribute('aria-busy', 'false');
  });

  it('keeps mobile-safe layout constraints on prompts, bubbles and composer', async () => {
    aiChatMock.mockResolvedValue(assistantReply('Javob matni'));
    const user = userEvent.setup();
    const { container } = renderCopilot();

    const [firstPrompt] = screen.getAllByRole('button', { name: /— / });
    const grid = firstPrompt.parentElement as HTMLElement;
    expect(grid.className).toContain('grid gap-3 sm:grid-cols-2 lg:grid-cols-3');

    expect(composer().className).toContain('flex-1');
    expect(sendButton().className).toContain('shrink-0');

    await typeAndSend(user, 'Salom');
    await screen.findByText('Javob matni');

    const userLabel = screen.getByText(/ai\.you|You|Siz/i);
    const userBubble = userLabel.parentElement as HTMLElement;
    expect(userBubble.className).toContain('max-w-[85%]');
    expect(userBubble.className).toContain('sm:max-w-[70%]');
    expect(userBubble.style.overflowWrap).toBe('anywhere');
    expect(container.querySelector('[data-testid="ai-message-list"]')?.className).toContain(
      'overflow-y-auto',
    );
  });

  it('renders with the dark theme class applied (design tokens, no hard-coded colors)', () => {
    document.documentElement.classList.add('dark');
    renderCopilot();

    expect(document.documentElement).toHaveClass('dark');
    expect(screen.getByText('M-EDU AI Copilot')).toBeInTheDocument();
    const header = document.querySelector('header') as HTMLElement;
    const identityCard = header.children[1] as HTMLElement;
    expect(identityCard.className).toContain('var(--bg-card)');
    expect(composer().className).not.toContain('bg-white');
  });

  it('shows the offline pill when the connection is down', () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'onLine');
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });

    try {
      renderCopilot();
      expect(screen.getByText('Oflayn')).toBeInTheDocument();
      expect(screen.queryByText('AI yordamchi')).toBeNull();
    } finally {
      if (original) {
        Object.defineProperty(navigator, 'onLine', original);
      } else {
        delete (navigator as { onLine?: boolean }).onLine;
      }
    }
  });
});
