/**
 * ScrollToTop — route-aware scroll manager
 *
 * - PUSH / REPLACE to a new page  → jump to top (instant, before paint, no flash)
 * - POP (Back / Forward)          → restore the exact position the user left
 * - URL with #hash                → scroll to that element (smooth, unless reduced motion)
 * - Same page, only ?search change → untouched
 */

import { useLayoutEffect, useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/** Scroll offsets by history entry key (lives for the session, survives route unmounts). */
const positions = new Map<string, number>();

const INSTANT = 'instant' as ScrollBehavior;

function scrollToHash(hash: string, smooth: boolean) {
  const id = decodeURIComponent(hash.slice(1));
  let frames = 0;

  // The target may not be mounted yet (lazy routes / data loading) — retry for ~20 frames.
  const tryScroll = () => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: smooth ? 'smooth' : INSTANT, block: 'start' });
      return;
    }
    if (frames++ < 20) requestAnimationFrame(tryScroll);
  };
  tryScroll();
}

export function ScrollToTop() {
  const { pathname, hash, key } = useLocation();
  const navType = useNavigationType();

  const prevPath = useRef<string | null>(null);
  const prevHash = useRef('');
  const keyRef = useRef(key);
  keyRef.current = key;

  // We own scroll restoration — stop the browser from fighting us.
  useEffect(() => {
    if (!('scrollRestoration' in window.history)) return;
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  // Remember where the user is on the current history entry (rAF-throttled).
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        positions.set(keyRef.current, window.scrollY);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Layout effect = runs before paint, so the new page never flashes at the old offset.
  useLayoutEffect(() => {
    const isFirst = prevPath.current === null;
    const pathChanged = prevPath.current !== pathname;
    const hashChanged = prevHash.current !== hash;
    prevPath.current = pathname;
    prevHash.current = hash;

    // Initial load without a hash: nothing to do.
    if (isFirst && !hash) return;
    // Same page, only query string changed: leave the scroll alone.
    if (!pathChanged && !hashChanged) return;

    // Back / Forward → restore the saved position.
    if (navType === 'POP' && pathChanged && !hash) {
      window.scrollTo({ top: positions.get(key) ?? 0, left: 0, behavior: INSTANT });
      return;
    }

    // Deep link to a section.
    if (hash) {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      scrollToHash(hash, !reduced && !pathChanged);
      return;
    }

    // Regular navigation → top.
    window.scrollTo({ top: 0, left: 0, behavior: INSTANT });
  }, [pathname, hash, key, navType]);

  return null;
}

export default ScrollToTop;