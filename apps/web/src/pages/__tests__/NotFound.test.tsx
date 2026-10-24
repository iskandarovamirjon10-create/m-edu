/**
 * NotFound (404) page tests:
 *  - renders the branded 404 heading and helpful copy
 *  - both recovery links point to the dashboard ("/")
 *  - sets the document title (via usePageTitle)
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '@/i18n/I18nProvider';
import { NotFoundPage } from '../NotFound';

vi.mock('@/hooks/usePageTitle', () => ({
  usePageTitle: (title: string) => {
    document.title = title ? `${title} — M-EDU` : 'M-EDU';
  },
}));

function renderPage() {
  return render(
    <I18nProvider initialLocale="en">
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <NotFoundPage />
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe('NotFoundPage', () => {
  afterEach(() => {
    document.title = '';
  });

  it('renders the 404 heading and explanatory copy', () => {
    renderPage();
    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    // Straight apostrophe — matches the component copy exactly.
    expect(screen.getByText(/doesn't exist or may have been moved/i)).toBeInTheDocument();
  });

  it('offers a primary "Back to dashboard" action linking to /', () => {
    renderPage();
    const back = screen.getByRole('link', { name: 'Back to dashboard' });
    expect(back).toHaveAttribute('href', '/');
  });

  it('offers a secondary "Go home" link to /', () => {
    renderPage();
    const home = screen.getByRole('link', { name: 'Go home' });
    expect(home).toHaveAttribute('href', '/');
  });

  it('sets a professional document title', () => {
    renderPage();
    expect(document.title).toBe('Page Not Found — M-EDU');
  });
});
