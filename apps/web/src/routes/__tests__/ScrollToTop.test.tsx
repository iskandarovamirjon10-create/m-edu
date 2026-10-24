import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, renderHook } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { ScrollToTop, useScrollProgress } from '../ScrollToTop';

function TestApp({
  initialEntries = ['/page-one'],
  withContainer = true,
}: {
  initialEntries?: string[];
  withContainer?: boolean;
}) {
  return (
    <MemoryRouter initialEntries={initialEntries}>
      <ScrollToTop />
      {withContainer ? (
        <main
          id="main-content"
          data-scroll-container
          data-scroll-focus
          style={{ height: '300px', overflowY: 'auto' }}
        >
          <NavigationProbe />
          <div style={{ height: '1000px' }}>Scrollable Content</div>
          <div id="section-two" style={{ height: '500px' }}>Section Two</div>
        </main>
      ) : (
        <main id="main-content" data-scroll-focus>
          <NavigationProbe />
          <div style={{ height: '1000px' }}>Window Content</div>
        </main>
      )}
    </MemoryRouter>
  );
}

function NavigationProbe() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div>
      <span data-testid="current-path">{location.pathname}</span>
      <button type="button" onClick={() => navigate('/page-two')}>
        Go to Two
      </button>
      <button type="button" onClick={() => navigate('/page-two#section-two')}>
        Go to Hash
      </button>
    </div>
  );
}

describe('ScrollToTop & Scroll Substrate', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders and binds to [data-scroll-container] when present', () => {
    render(<TestApp withContainer={true} />);
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('data-scroll-container');
  });

  it('scrolls container to top on route change', async () => {
    render(<TestApp withContainer={true} />);
    const main = screen.getByRole('main');

    // Simulate scrolled state
    main.scrollTop = 450;
    const scrollToSpy = vi.fn();
    main.scrollTo = scrollToSpy;

    const btn = screen.getByText('Go to Two');
    await act(async () => {
      btn.click();
    });

    expect(screen.getByTestId('current-path')).toHaveTextContent('/page-two');
    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' });
  });

  it('manages accessible focus without scroll jumping', async () => {
    render(<TestApp withContainer={true} />);
    const main = screen.getByRole('main');

    // Wait for rAF focus
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(r));
    });

    expect(document.activeElement).toBe(main);
  });

  it('dispatches medu:scroll telemetry event on scroll', async () => {
    const telemetrySpy = vi.fn();
    window.addEventListener('medu:scroll', telemetrySpy);

    render(<TestApp withContainer={true} />);
    const main = screen.getByRole('main');
    main.scrollTop = 120;

    // Trigger scroll in capture phase
    await act(async () => {
      main.dispatchEvent(new Event('scroll', { bubbles: false }));
      await new Promise((r) => requestAnimationFrame(r));
    });

    expect(telemetrySpy).toHaveBeenCalled();
    const detail = (telemetrySpy.mock.calls[0][0] as CustomEvent).detail;
    expect(detail).toHaveProperty('y');
    expect(detail).toHaveProperty('dir');

    window.removeEventListener('medu:scroll', telemetrySpy);
  });

  it('calculates useScrollProgress accurately', async () => {
    const { result } = renderHook(() => useScrollProgress());
    expect(result.current).toBe(0);

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('medu:scroll', {
          detail: { y: 250, max: 1000 },
        }),
      );
    });

    expect(result.current).toBe(0.25);
  });
});
