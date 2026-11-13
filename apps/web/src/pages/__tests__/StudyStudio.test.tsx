import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '@/i18n/I18nProvider';
import { StudyStudioPage } from '../StudyStudio';
import request from '@/lib/api';

vi.mock('@/lib/api', () => ({
  default: vi.fn(),
  __esModule: true,
}));

const overview = {
  decks: [
    {
      id: 'deck-1',
      title: 'Biology — cells',
      subject: 'Biology',
      description: null,
      accent: 'emerald',
      cardCount: 12,
      dueCount: 4,
    },
  ],
  totals: {
    cards: 12,
    due: 4,
    reviewsToday: 2,
    focusMinutesToday: 25,
    focusMinutesWeek: 90,
    streakDays: 3,
    accuracy7d: 82,
  },
  activity: [],
};

const queue = [
  {
    id: 'card-1',
    front: 'What is a cell?',
    back: 'The smallest unit of life',
    intervalDays: 1,
    repetitions: 1,
    deck: { id: 'deck-1', title: 'Biology — cells', accent: 'emerald' },
  },
];

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter>
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <StudyStudioPage />
        </QueryClientProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
}

describe('StudyStudioPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(request).mockImplementation(async (url: string) => {
      if (url.includes('/study/overview')) return overview;
      if (url.includes('/study/queue')) return queue;
      if (url.includes('/study/decks') && url.includes('/cards')) return [];
      return {};
    });
  });

  it('renders the study stats and deck list from the API', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Biology — cells').length).toBeGreaterThan(0);
    });
    // eslint-disable-next-line no-console
    console.log(document.body.textContent?.slice(-800));
    await waitFor(() => {
      expect(screen.getAllByText('Biology — cells').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Today').length).toBeGreaterThan(0);
      expect(screen.getByText('4 due')).toBeInTheDocument();
    });

    expect(request).toHaveBeenCalledWith('/study/overview');
    expect(request).toHaveBeenCalledWith('/study/queue?limit=40');
  });

  it('reveals the answer with Space and saves a graded review', async () => {
    renderPage();

    const flip = await screen.findByRole('button', { name: 'Flip the card' });
    expect(flip).toHaveAttribute('aria-pressed', 'false');

    fireEvent.keyDown(window, { key: ' ' });
    expect(flip).toHaveAttribute('aria-pressed', 'true');

    fireEvent.keyDown(window, { key: ' ' });
    expect(flip).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: /^Good/ }));

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith('/study/cards/card-1/review', {
        method: 'POST',
        body: JSON.stringify({ rating: 'good' }),
      });
    });
  });

  it('shows the caught-up state when the queue is empty', async () => {
    vi.mocked(request).mockImplementation(async (url: string) => {
      if (url.includes('/study/overview')) return { ...overview, totals: { ...overview.totals, due: 0 } };
      if (url.includes('/study/queue')) return [];
      return [];
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('All caught up for today').length).toBeGreaterThan(0);
    });
  });

  it('surfaces an overview failure instead of stale data', async () => {
    vi.mocked(request).mockImplementation(async (url: string) => {
      if (url.includes('/study/overview')) throw new Error('network down');
      if (url.includes('/study/queue')) return [];
      return [];
    });

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText('Could not load your study data. Refresh the page.'),
      ).toBeInTheDocument();
    });
  });

  it('creates a deck through the API when the form is valid', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /new deck/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g. Biology — the cell'), {
      target: { value: 'History — dates' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith('/study/decks', {
        method: 'POST',
        body: JSON.stringify({
          title: 'History — dates',
          subject: undefined,
          accent: 'indigo',
        }),
      });
    });
  });
});
