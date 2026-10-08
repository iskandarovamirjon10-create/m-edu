import '@testing-library/jest-dom/vitest';

/**
 * jsdom does not implement matchMedia, which useTheme reads to resolve the
 * "prefers-color-scheme" default, and which AppLayout's responsive tiers
 * (isWide/showRail) read to pick desktop vs. tablet vs. phone presentation.
 *
 * Provide a query-aware stub:
 *  - `(min-width: Npx)` / `(max-width: Npx)` clauses are evaluated against
 *    the current window.innerWidth, so responsive layout code behaves the
 *    way it does in a real browser (a 1024px jsdom window matches
 *    `(min-width: 768px)` but not `(min-width: 1280px)`).
 *  - every other query (prefers-reduced-motion, prefers-color-scheme,
 *    hover/pointer …) resolves to false — a plain, motion-friendly, light
 *    environment, matching the previous always-false behaviour.
 *
 * `matches` is a getter, so it is re-evaluated on every read: components
 * that cache a MediaQueryList (useTheme) or re-read it in a snapshot
 * (useMediaQuery) observe the viewport value current at that moment.
 */
if (typeof window !== 'undefined' && !window.matchMedia) {
  const matchesQuery = (query: string): boolean => {
    const clauses = query.match(/\((?:min|max)-width:\s*[\d.]+px\)/g);
    if (!clauses) return false;
    const width = window.innerWidth;
    return clauses.every((clause) => {
      const hit = /\((min|max)-width:\s*([\d.]+)px\)/.exec(clause);
      if (!hit) return false;
      const bound = parseFloat(hit[2]);
      return hit[1] === 'min' ? width >= bound : width <= bound;
    });
  };

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      get matches() {
        return matchesQuery(query);
      },
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
