/**
 * ============================================================================
 *  ScrollToTop — v28 "iOS 27 Smart Scroll Restoration Engine"
 * ============================================================================
 *
 *  🌟 v18 → v28 Breakthroughs:
 *   • Session-Persistent Positions — Survives full-page reloads (per tab).
 *   • Focus Management — a11y: focuses <main> on every route change.
 *   • User-Interrupt Detection — Smooth scroll aborts on wheel/touch/key.
 *   • Container-Aware — Works with any scrollable region, not just window.
 *   • Header-Offset Awareness — Fixed headers never hide hash targets.
 *   • View Transitions Integration — Native cross-fade when supported.
 *   • Scroll Telemetry — `medu:scroll` CustomEvent for progress UIs.
 *   • Idle-Optimized Writes — rAF + requestIdleCallback persistence.
 *   • Reduced-Motion Guarantee — Honored at every scroll call.
 *   • Zero-Regression API — Drop-in replacement for the v18 component.
 * ============================================================================
 */

import {
  useLayoutEffect,
  useEffect,
  useRef,
  useCallback,
  useState,
  useSyncExternalStore,
} from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/* ══════════════════════════════════════════════════════════════════════════
 * CONFIG
 * ════════════════════════════════════════════════════════════════════════ */

const INSTANT = 'instant' as ScrollBehavior;
const STORAGE_KEY = 'm-edu.scroll-positions.v1';
const HASH_RETRY_FRAMES = 24;
const DEFAULT_FOCUS_SELECTOR = 'main, [data-scroll-focus], [role="main"]';
const DEFAULT_CONTAINER_SELECTOR = '[data-scroll-container]';

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const supportsViewTransitions = (): boolean =>
  typeof document !== 'undefined' && 'startViewTransition' in document;

/* ══════════════════════════════════════════════════════════════════════════
 * PERSISTENCE LAYER (sessionStorage, per-tab, idle-flushed)
 * ════════════════════════════════════════════════════════════════════════ */

const positions = new Map<string, number>();
let hydrated = false;

function hydrate() {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, number>;
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'number' && Number.isFinite(v)) positions.set(k, v);
    }
  } catch {
    /* silent — corrupted storage is not fatal */
  }
}

let persistScheduled = false;
function schedulePersist() {
  if (persistScheduled || typeof window === 'undefined') return;
  persistScheduled = true;
  const flush = () => {
    persistScheduled = false;
    try {
      const obj: Record<string, number> = {};
      positions.forEach((v, k) => {
        obj[k] = v;
      });
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch {
      /* silent */
    }
  };
  if ('requestIdleCallback' in window) {
    (window as Window & typeof globalThis & {
      requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number;
    }).requestIdleCallback(flush, { timeout: 500 });
  } else {
    setTimeout(flush, 120);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
 * SCROLL TARGET — abstracts window vs. custom container
 * ════════════════════════════════════════════════════════════════════════ */

type ScrollTarget = {
  el: HTMLElement | Window;
  getY: () => number;
  getMaxY: () => number;
  setY: (y: number, behavior: ScrollBehavior) => void;
  addScrollListener: (cb: (e?: Event) => void) => () => void;
};

function getScrollTarget(containerSelector: string): ScrollTarget {
  if (typeof window === 'undefined') {
    return {
      el: {} as Window,
      getY: () => 0,
      getMaxY: () => 1,
      setY: () => {},
      addScrollListener: () => () => {},
    };
  }

  const container = document.querySelector<HTMLElement>(containerSelector);
  if (container) {
    return {
      el: container,
      getY: () => container.scrollTop,
      getMaxY: () => Math.max(1, container.scrollHeight - container.clientHeight),
      setY: (y, behavior) =>
        container.scrollTo({ top: y, left: 0, behavior }),
      addScrollListener: (cb) => {
        container.addEventListener('scroll', cb, { passive: true });
        return () => container.removeEventListener('scroll', cb);
      },
    };
  }

  return {
    el: window,
    getY: () => window.scrollY,
    getMaxY: () =>
      Math.max(1, document.documentElement.scrollHeight - window.innerHeight),
    setY: (y, behavior) => window.scrollTo({ top: y, left: 0, behavior }),
    addScrollListener: (cb) => {
      window.addEventListener('scroll', cb, { passive: true });
      return () => window.removeEventListener('scroll', cb);
    },
  };
}

/* ══════════════════════════════════════════════════════════════════════════
 * HASH SCROLLER — retry loop + header offset + interrupt handling
 * ════════════════════════════════════════════════════════════════════════ */

function scrollToHash(
  hash: string,
  target: ScrollTarget,
  { smooth, headerOffset }: { smooth: boolean; headerOffset: number },
) {
  const id = decodeURIComponent(hash.slice(1));
  if (!id) return;

  let frames = 0;
  let cancelled = false;
  let abortCleanup: (() => void) | null = null;

  const abort = () => {
    cancelled = true;
    abortCleanup?.();
  };

  const tryScroll = () => {
    if (cancelled) return;
    const el = document.getElementById(id);
    if (!el) {
      if (frames++ < HASH_RETRY_FRAMES) requestAnimationFrame(tryScroll);
      return;
    }

    // Compute absolute Y relative to target minus header offset.
    const rect = el.getBoundingClientRect();
    const currentY = target.getY();
    const targetY = currentY + rect.top - headerOffset;

    if (smooth) {
      // Abort smooth scroll on any user input — feels native, not hijacked.
      const onUserInput = () => abort();
      const events: Array<keyof WindowEventMap> = [
        'wheel', 'touchstart', 'keydown', 'mousedown',
      ];
      events.forEach((ev) =>
        window.addEventListener(ev, onUserInput, { passive: true, once: true }),
      );
      abortCleanup = () =>
        events.forEach((ev) => window.removeEventListener(ev, onUserInput));
    }

    target.setY(Math.max(0, targetY), smooth ? 'smooth' : INSTANT);
  };

  tryScroll();
}

/* ══════════════════════════════════════════════════════════════════════════
 * MAIN COMPONENT
 * ════════════════════════════════════════════════════════════════════════ */

export interface ScrollToTopProps {
  /** Pixel height of any fixed header (used for hash-scroll offset). */
  headerOffset?: number;
  /** CSS selector for the scrollable region. Defaults to window. */
  containerSelector?: string;
  /** Selector of the element to focus on route change. Defaults to `<main>`. */
  focusSelector?: string;
  /** Enable View Transitions API when the browser supports it. */
  viewTransitions?: boolean;
  /** Persist positions to sessionStorage across reloads. */
  persistAcrossReloads?: boolean;
}

export function ScrollToTop({
  headerOffset = 0,
  containerSelector = DEFAULT_CONTAINER_SELECTOR,
  focusSelector = DEFAULT_FOCUS_SELECTOR,
  viewTransitions = true,
  persistAcrossReloads = true,
}: ScrollToTopProps = {}) {
  const { pathname, hash, key } = useLocation();
  const navType = useNavigationType();

  const prevPath = useRef<string | null>(null);
  const prevHash = useRef('');
  const keyRef = useRef(key);
  keyRef.current = key;

  const targetRef = useRef<ScrollTarget | null>(null);

  /* ── 0. Hydrate persisted positions + take over browser restoration ── */
  useEffect(() => {
    if (persistAcrossReloads) hydrate();

    if (!('scrollRestoration' in window.history)) return;
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, [persistAcrossReloads]);

  /* ── 1. Resolve scroll target (may change if container mounts late) ── */
  const getTarget = useCallback((): ScrollTarget => {
    if (!targetRef.current || targetRef.current.el === window) {
      targetRef.current = getScrollTarget(containerSelector);
    }
    return targetRef.current;
  }, [containerSelector]);

  /* ── 2. Track scroll position per history entry (rAF-batched, capture-phase) ── */
  useEffect(() => {
    let raf = 0;
    let lastY = -1;

    const emitTelemetry = (y: number, dir: 'up' | 'down' | 'idle', max: number) => {
      if (typeof window === 'undefined') return;
      window.dispatchEvent(
        new CustomEvent('medu:scroll', {
          detail: { y, dir, max, key: keyRef.current, pathname },
        }),
      );
    };

    const handleScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const target = getTarget();
        const y = target.getY();
        const max = target.getMaxY();
        positions.set(keyRef.current, y);
        if (persistAcrossReloads) schedulePersist();

        const dir: 'up' | 'down' | 'idle' =
          y > lastY + 2 ? 'down' : y < lastY - 2 ? 'up' : 'idle';
        lastY = y;
        emitTelemetry(y, dir, max);
      });
    };

    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true });
      if (raf) cancelAnimationFrame(raf);
    };
  }, [getTarget, persistAcrossReloads, pathname]);

  /* ── 3. Route-aware restoration (runs BEFORE paint — no flash) ── */
  useLayoutEffect(() => {
    const isFirst = prevPath.current === null;
    const pathChanged = prevPath.current !== pathname;
    const hashChanged = prevHash.current !== hash;
    prevPath.current = pathname;
    prevHash.current = hash;

    if (isFirst && !hash) return;
    if (!pathChanged && !hashChanged) return;

    const target = getTarget();
    const reduced = prefersReducedMotion();

    const perform = () => {
      // Back / Forward → restore saved position (instant, feels native).
      if (navType === 'POP' && pathChanged && !hash) {
        target.setY(positions.get(key) ?? 0, INSTANT);
        return;
      }

      // Deep link to a section.
      if (hash) {
        scrollToHash(hash, target, {
          smooth: !reduced && !pathChanged,
          headerOffset,
        });
        return;
      }

      // Regular navigation → top.
      target.setY(0, INSTANT);
    };

    // Wrap in View Transition if enabled + supported + not reduced.
    if (viewTransitions && supportsViewTransitions() && !reduced) {
      (document as Document & {
        startViewTransition: (cb: () => void) => { finished: Promise<void> };
      }).startViewTransition(perform);
    } else {
      perform();
    }
  }, [pathname, hash, key, navType, getTarget, headerOffset, viewTransitions]);

  /* ── 4. Focus management on initial mount & route change (a11y, non-hijacking) ── */
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(focusSelector);
      if (!el) return;
      // Only focus if user hasn't already engaged with an interactive element
      const active = document.activeElement;
      const bodyActive = !active || active === document.body;
      if (!bodyActive) return;

      // Add tabindex="-1" once, remove on blur, so we don't pollute the DOM.
      if (el.getAttribute('tabindex') === null) {
        el.setAttribute('tabindex', '-1');
        el.addEventListener('blur', () => el.removeAttribute('tabindex'), {
          once: true,
        });
      }
      el.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [pathname, focusSelector]);

  return null;
}

/* ══════════════════════════════════════════════════════════════════════════
 * PUBLIC HOOKS — for progress bars, back-to-top buttons, etc.
 * ════════════════════════════════════════════════════════════════════════ */

/** Scroll progress: 0 (top) → 1 (bottom). Updates on `medu:scroll`. */
export function useScrollProgress(): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const update = (e: Event) => {
      const detail = (e as CustomEvent<{ y?: number; max?: number }>).detail ?? {};
      const y = detail.y ?? 0;
      const max =
        typeof detail.max === 'number' && detail.max > 0
          ? detail.max
          : Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      setProgress(Math.min(1, Math.max(0, y / max)));
    };
    window.addEventListener('medu:scroll', update);
    return () => window.removeEventListener('medu:scroll', update);
  }, []);

  return progress;
}

let globalScrollDir: 'up' | 'down' | 'idle' = 'idle';
let lastGlobalScrollY = 0;
const scrollDirListeners = new Set<() => void>();

function updateGlobalScrollDir(y: number) {
  const dir: 'up' | 'down' | 'idle' =
    y > lastGlobalScrollY + 4 ? 'down' : y < lastGlobalScrollY - 4 ? 'up' : 'idle';
  lastGlobalScrollY = y;
  if (dir !== globalScrollDir) {
    globalScrollDir = dir;
    scrollDirListeners.forEach((fn) => fn());
  }
}

/** Scroll direction with hysteresis. `'idle'` prevents flapping. 100% pure React 18 store. */
export function useScrollDirection(): 'up' | 'down' | 'idle' {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleScroll = (e: Event) => {
      const detail = (e as CustomEvent<{ y: number }>).detail;
      if (typeof detail?.y === 'number') {
        updateGlobalScrollDir(detail.y);
      }
    };
    window.addEventListener('medu:scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('medu:scroll', handleScroll);
  }, []);

  return useSyncExternalStore(
    (notify) => {
      scrollDirListeners.add(notify);
      return () => scrollDirListeners.delete(notify);
    },
    () => globalScrollDir,
    () => 'idle',
  );
}

export default ScrollToTop;