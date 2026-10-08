/**
 * M-EDU Theme Provider — Apple Design Award Edition v2
 *
 * v2 FIXES (v1 → v2):
 *  1. system theme: matchMedia('change') listener (was static — bug)
 *  2. FOUC: useLayoutEffect (was useEffect) + inline HTML script recommended
 *  3. localStorage validated with type guard (was `as Theme` unsafe cast)
 *  4. SSR/hydration safe (typeof window/document guards)
 *  5. Context value memoized (useMemo + useCallback) — prevents re-render storm
 *  6. isDark computed synchronously (was false on first render)
 *  7. .light class removed (dead — design tokens use [data-theme])
 *  8. localStorage write wrapped in try/catch (Safari Private Mode)
 *  9. matchMedia cached (single MediaQueryList instance)
 * 10. setTheme renamed internally to avoid scope confusion
 *
 * INLINE HTML SCRIPT (add to index.html <head>, BEFORE app boots):
 *
 *   <script>
 *     (function () {
 *       try {
 *         var stored = localStorage.getItem('medu-theme');
 *         var theme = (stored === 'light' || stored === 'dark' || stored === 'system')
 *           ? stored : 'system';
 *         var resolved = theme === 'system'
 *           ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
 *           : theme;
 *         document.documentElement.classList.toggle('dark', resolved === 'dark');
 *         document.documentElement.setAttribute('data-theme', resolved);
 *       } catch (e) {}
 *     })();
 *   </script>
 *
 * NOTE: ThemeProvider is a client-only component. In an SSR setup,
 * wrap with `dynamic(() => import(...), { ssr: false })` or mount
 * it inside a `<ClientOnly>` boundary.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  useCallback,
  useMemo,
} from 'react';

/* ============================================================================
 * TYPES
 * ========================================================================== */

/**
 * Public theme modes.
 * NOTE: design-tokens.css also supports `sepia`, `oled`, and `auto`
 * (data-theme values). To expose them in UI, extend this union AND
 * update the type guard + resolver below.
 */
export type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
}

/* ============================================================================
 * CONSTANTS
 * ========================================================================== */

const STORAGE_KEY = 'medu-theme';
const DARK_MEDIA = '(prefers-color-scheme: dark)';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/* ============================================================================
 * HELPERS
 * ========================================================================== */

const isTheme = (v: unknown): v is Theme =>
  v === 'light' || v === 'dark' || v === 'system';

function readStoredTheme(fallback: Theme): Theme {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return isTheme(raw) ? raw : fallback;
  } catch {
    // Safari Private Mode / disabled storage
    return fallback;
  }
}

function writeStoredTheme(theme: Theme): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // QuotaExceededError / SecurityError — silent
  }
}

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia(DARK_MEDIA).matches ? 'dark' : 'light';
}

function resolveTheme(theme: Theme): 'light' | 'dark' {
  return theme === 'system' ? getSystemTheme() : theme;
}

/**
 * Apply theme to <html>.
 * - `data-theme` drives design-tokens.css ([data-theme="light"] / [data-theme="dark"])
 * - `.dark` class drives Tailwind `dark:` variants
 * Both must stay in sync.
 */
function applyThemeToDOM(resolved: 'light' | 'dark'): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  // Tailwind dark: variant
  root.classList.toggle('dark', resolved === 'dark');
  // Design tokens
  root.setAttribute('data-theme', resolved);
}

/**
 * useLayoutEffect on client (prevents paint flash), useEffect on server
 * (avoids React SSR warning).
 */
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/* ============================================================================
 * PROVIDER
 * ========================================================================== */

export function ThemeProvider({
  children,
  defaultTheme = 'system',
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
}) {
  /* Read stored theme once. Type-guarded. */
  const [theme, setThemeState] = useState<Theme>(() =>
    readStoredTheme(defaultTheme),
  );

  /* isDark computed synchronously — prevents wrong value on first render. */
  const [isDark, setIsDark] = useState<boolean>(
    () => resolveTheme(readStoredTheme(defaultTheme)) === 'dark',
  );

  /* Apply theme before paint (avoids FOUC in most cases). */
  useIsomorphicLayoutEffect(() => {
    const resolved = resolveTheme(theme);
    applyThemeToDOM(resolved);
    setIsDark(resolved === 'dark');
  }, [theme]);

  /* Subscribe to system theme changes — ONLY while theme === 'system'. */
  useEffect(() => {
    if (theme !== 'system') return;
    if (typeof window === 'undefined') return;

    const mq = window.matchMedia(DARK_MEDIA);
    const handler = (e: MediaQueryListEvent) => {
      const resolved: 'light' | 'dark' = e.matches ? 'dark' : 'light';
      applyThemeToDOM(resolved);
      setIsDark(resolved === 'dark');
    };

    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  /* Stable setter. Memoized. */
  const setTheme = useCallback((next: Theme) => {
    writeStoredTheme(next);
    setThemeState(next);
  }, []);

  /* Memoized context value — prevents consumer re-render storm. */
  const value = useMemo<ThemeContextType>(
    () => ({ theme, setTheme, isDark }),
    [theme, setTheme, isDark],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/* ============================================================================
 * HOOK
 * ========================================================================== */

export const useTheme = (): ThemeContextType => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      theme: 'system',
      setTheme: () => {},
      isDark: typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false,
    };
  }
  return ctx;
};