import { useEffect, useRef } from 'react';

/**
 * JS BRIDGE — Cursor glow tracking
 * Captures mouse coordinates relative to the element and updates CSS variables
 * `--ad-glow-x` and `--ad-glow-y` for lighting and spotlight effects.
 */
export function useCursorGlow<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        // Fallback for touch devices or elements completely outside viewport
        if (r.width === 0 || r.height === 0) return;
        
        el.style.setProperty('--ad-glow-x', `${((e.clientX - r.left) / r.width) * 100}%`);
        el.style.setProperty('--ad-glow-y', `${((e.clientY - r.top) / r.height) * 100}%`);
      });
    };

    el.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      el.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return ref;
}
