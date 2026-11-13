/**
 * M-EDU Theme Engine — Apple Design Award Edition v3
 *
 * v3 ARCHITECTURAL UPGRADES:
 *  1. Zero Dual-Render: `resolvedTheme` and `isDark` are derived synchronously (no secondary state).
 *  2. True SSR & Hydration Safety: Powered by React 18 `useSyncExternalStore`.
 *  3. Native UI Sync: Updates CSS `color-scheme` (scrollbars, inputs) & auto-provisions `<meta name="theme-color">`.
 *  4. View Transitions API & Flash Suppression: Smooth macOS-like theme switching without CSS transition lag.
 *  5. True Singleton MediaQueryList: Single cached `matchMedia` instance across the entire app lifecycle.
 *  6. Cross-Tab Synchronization: Instant updates across multiple browser tabs via `storage` event.
 *  7. Full Design-Token Support: Supports `light`, `dark`, `oled`, `sepia`, and `system`.
 *  8. Provider-less Resilience: `useTheme()` works seamlessly even outside `<ThemeProvider>`.
 *
 * INLINE HTML SCRIPT (place in index.html <head> before stylesheets):
 *
 *   <script>
 *     (function () {
 *       try {
 *         var s = localStorage.getItem('medu-theme');
 *         var valid = s === 'light' || s === 'dark' || s === 'oled' || s === 'sepia' || s === 'system';
 *         var t = valid ? s : 'system';
 *         var r = t === 'system'
 *           ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
 *           : t;
 *         var isDark = r === 'dark' || r === 'oled';
 *         var d = document.documentElement;
 *         d.classList.toggle('dark', isDark);
 *         d.setAttribute('data-theme', r);
 *         d.style.colorScheme = isDark ? 'dark' : 'light';
 *       } catch (e) {}
 *     })();
 *   </script>
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  useSyncExternalStore,
} from 'react';

/* ============================================================================
 * 1. TYPES & CONSTANTS
 * ========================================================================== */

export type ResolvedTheme = 'light' | 'dark' | 'oled' | 'sepia';
export type Theme = ResolvedTheme | 'system';

export interface ThemeContextType {
  /** User-selected theme preference ('light' | 'dark' | 'oled' | 'sepia' | 'system') */
  theme: Theme;
  /** Actual active visual theme applied to DOM ('light' | 'dark' | 'oled' | 'sepia') */
  resolvedTheme: ResolvedTheme;
  /** True when active theme is dark-based ('dark' or 'oled') */
  isDark: boolean;
  /** Update theme with optional View Transition animation */
  setTheme: (theme: Theme) => void;
  /** Cycle between light and dark quickly */
  toggleTheme: () => void;
}

const STORAGE_KEY = 'medu-theme';
const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

const META_THEME_COLORS: Readonly<Record<ResolvedTheme, string>> = {
  light: '#F4F7FC', // Apple Studio Alabaster / High-Luminance Crisp Canvas
  dark: '#050912',  // Apple Space Black Velvet / Deep Midnight
  oled: '#000000',  // Pure AMOLED True Black
  sepia: '#F5EEDB', // Apple Books Warm Sepia
};

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/* ============================================================================
 * 2. SINGLETON MEDIA QUERY & EXTERNAL REACTIVE STORE
 * ========================================================================== */

let cachedMediaQuery: MediaQueryList | null = null;

function getMediaQueryList(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null;
  }
  if (!cachedMediaQuery) {
    cachedMediaQuery = window.matchMedia(DARK_MEDIA_QUERY);
  }
  return cachedMediaQuery;
}

export function isTheme(value: unknown): value is Theme {
  return (
    value === 'light' ||
    value === 'dark' ||
    value === 'oled' ||
    value === 'sepia' ||
    value === 'system'
  );
}

function getSystemTheme(): 'light' | 'dark' {
  const mq = getMediaQueryList();
  return mq && mq.matches ? 'dark' : 'light';
}

function resolveThemeValue(theme: Theme): ResolvedTheme {
  return theme === 'system' ? getSystemTheme() : theme;
}

// --- Reactive Store State ---
const listeners = new Set<() => void>();
let currentThemeState: Theme = 'system';
let isStoreInitialized = false;

function initThemeStore(fallback: Theme = 'system'): void {
  if (isStoreInitialized || typeof window === 'undefined') return;
  isStoreInitialized = true;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    currentThemeState = isTheme(raw) ? raw : fallback;
  } catch {
    currentThemeState = fallback;
  }

  // 1. Cross-Tab Storage Sync
  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      const next = isTheme(e.newValue) ? e.newValue : fallback;
      if (currentThemeState !== next) {
        currentThemeState = next;
        applyThemeToDOM(resolveThemeValue(next), false);
        emitStoreChange();
      }
    }
  });

  // 2. Singleton OS System Theme Listener
  const mq = getMediaQueryList();
  if (mq) {
    const handleSystemChange = () => {
      if (currentThemeState === 'system') {
        applyThemeToDOM(resolveThemeValue('system'), false);
        emitStoreChange();
      }
    };

    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', handleSystemChange);
    } else if (typeof (mq as MediaQueryList).addListener === 'function') {
      // Legacy Safari <14 fallback
      (mq as MediaQueryList).addListener(handleSystemChange);
    }
  }
}

function emitStoreChange(): void {
  listeners.forEach((listener) => listener());
}

function subscribeThemeStore(listener: () => void): () => void {
  initThemeStore();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getClientSnapshot(): string {
  initThemeStore();
  const resolved = resolveThemeValue(currentThemeState);
  return `${currentThemeState}:${resolved}`;
}

function getServerSnapshot(): string {
  // Deterministic SSR output to prevent React 18 Hydration Mismatch
  return 'system:light';
}

/* ============================================================================
 * 3. DOM MUTATION & APPLE-GRADE TRANSITION ENGINE
 * ========================================================================== */

/**
 * Temporarily disables CSS transitions on theme switch so complex Liquid Glass
 * surfaces and borders don't lag at different transition durations.
 */
function withoutCSSTransitions(action: () => void): void {
  if (typeof document === 'undefined') {
    action();
    return;
  }

  const style = document.createElement('style');
  style.appendChild(
    document.createTextNode(
      '*,*::before,*::after{-webkit-transition:none!important;transition:none!important}',
    ),
  );
  document.head.appendChild(style);

  action();

  // Force browser reflow (flush CSS changes immediately)
  void window.getComputedStyle(document.documentElement).opacity;

  requestAnimationFrame(() => {
    if (document.head.contains(style)) {
      document.head.removeChild(style);
    }
  });
}

function applyThemeToDOM(resolved: ResolvedTheme, animate = false): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const darkActive = resolved === 'dark' || resolved === 'oled';

  const mutateDOM = () => {
    // 1. Tailwind & Theme classes
    root.classList.toggle('dark', darkActive);
    root.classList.toggle('oled', resolved === 'oled');
    root.classList.toggle('sepia', resolved === 'sepia');

    // 2. Design Tokens `[data-theme="..."]`
    if (root.getAttribute('data-theme') !== resolved) {
      root.setAttribute('data-theme', resolved);
    }

    // 3. Native Browser Controls (Scrollbars, Date Pickers, Select Dropdowns)
    root.style.colorScheme = darkActive ? 'dark' : 'light';

    // 4. Mobile Safari / PWA Status Bar Color (Ensure tag exists in document.head)
    let metaTheme = document.querySelector('meta[name="theme-color"]');
    if (!metaTheme) {
      metaTheme = document.createElement('meta');
      metaTheme.setAttribute('name', 'theme-color');
      document.head.appendChild(metaTheme);
    }
    metaTheme.setAttribute('content', META_THEME_COLORS[resolved]);
  };

  // Use native View Transitions API if supported and requested, otherwise suppress transition jank
  const docWithTransition = document as Document & {
    startViewTransition?: (cb: () => void) => void;
  };

  if (
    animate &&
    typeof docWithTransition.startViewTransition === 'function' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    docWithTransition.startViewTransition(() => {
      withoutCSSTransitions(mutateDOM);
    });
  } else {
    withoutCSSTransitions(mutateDOM);
  }
}

export function setGlobalTheme(next: Theme): void {
  initThemeStore();
  if (!isTheme(next)) return;

  currentThemeState = next;

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Safari Private Mode / QuotaExceededError — ignore safely
    }
  }

  const resolved = resolveThemeValue(next);
  applyThemeToDOM(resolved, true);
  emitStoreChange();
}

/* ============================================================================
 * 4. CONTEXT & PROVIDER
 * ========================================================================== */

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({
  children,
  defaultTheme = 'system',
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
}) {
  // Initialize store with custom defaultTheme if not yet initialized
  if (typeof window !== 'undefined' && !isStoreInitialized) {
    initThemeStore(defaultTheme);
  }

  const snapshot = useSyncExternalStore(
    subscribeThemeStore,
    getClientSnapshot,
    getServerSnapshot,
  );

  const [theme, resolvedTheme] = snapshot.split(':') as [Theme, ResolvedTheme];
  const isDark = resolvedTheme === 'dark' || resolvedTheme === 'oled';

  // Ensure DOM attributes are synced before browser paint on mount
  useIsomorphicLayoutEffect(() => {
    applyThemeToDOM(resolvedTheme, false);
  }, [resolvedTheme]);

  const setTheme = useCallback((next: Theme) => {
    setGlobalTheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    const next: Theme = isDark ? 'light' : 'dark';
    setGlobalTheme(next);
  }, [isDark]);

  const value = useMemo<ThemeContextType>(
    () => ({
      theme,
      resolvedTheme,
      isDark,
      setTheme,
      toggleTheme,
    }),
    [theme, resolvedTheme, isDark, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/* ============================================================================
 * 5. HOOK (Works both inside and outside <ThemeProvider>)
 * ========================================================================== */

export const useTheme = (): ThemeContextType => {
  const ctx = useContext(ThemeContext);

  // Fallback subscription if used outside of ThemeProvider
  const snapshot = useSyncExternalStore(
    subscribeThemeStore,
    getClientSnapshot,
    getServerSnapshot,
  );

  const fallbackSetTheme = useCallback((next: Theme) => {
    setGlobalTheme(next);
  }, []);

  const fallbackValue = useMemo<ThemeContextType>(() => {
    const [theme, resolvedTheme] = snapshot.split(':') as [Theme, ResolvedTheme];
    const isDark = resolvedTheme === 'dark' || resolvedTheme === 'oled';
    return {
      theme,
      resolvedTheme,
      isDark,
      setTheme: fallbackSetTheme,
      toggleTheme: () => setGlobalTheme(isDark ? 'light' : 'dark'),
    };
  }, [snapshot, fallbackSetTheme]);

  return ctx ?? fallbackValue;
};
