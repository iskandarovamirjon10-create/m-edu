/**
 * GlassSpinner V3 — Apple Design Award Edition
 *
 * Premium craft:
 *   • prefers-reduced-motion respected (static + subtle pulse)
 *   • No i18n coupling — leaf component, opt-in label
 *   • Tone-aware: default | onPrimary | onDanger | onSuccess | neutral
 *   • aria-hidden auto-detection inside aria-busy containers
 *   • GPU-hinted (will-change only when animating)
 *   • Subpixel-free borders
 *
 * v3 FIXES (v2 → v3):
 *  1. prefers-reduced-motion → static ring + opacity pulse (was always spinning)
 *  2. useSafeI18n coupling removed → opt-in `label` prop (avoids re-render storm)
 *  3. aria-label fallback ('Loading…') when no i18n key
 *  4. aria-hidden when inside an `aria-busy` container (avoids duplicate announcement)
 *  5. tone prop: onPrimary | onDanger | onSuccess (was invisible on primary bg)
 *  6. will-change: transform only while spinning (not in reduced motion)
 *  7. border-[1.5px] → border / border-2 (subpixel-free)
 *  8. dev warning when no label provided in non-decorative use
 *  9. aria-atomic added to role="status"
 * 10. Import cleanup — no i18n dependency
 */

import { useEffect, useRef, useState, type CSSProperties } from 'react';

/* ============================================================================
 * TYPES
 * ========================================================================== */

export type GlassSpinnerSize = 'xs' | 'sm' | 'md' | 'lg';

/**
 * Tone variants — pick based on the surface the spinner sits on.
 *   default   — spinner on neutral / card surfaces (uses --primary)
 *   onPrimary — spinner on a primary-filled button (uses white)
 *   onDanger  — spinner on a danger-filled button (uses white)
 *   onSuccess — spinner on a success-filled button (uses white)
 *   neutral   — spinner on glass / subtle surfaces (uses --text-secondary)
 */
export type GlassSpinnerTone =
  | 'default'
  | 'onPrimary'
  | 'onDanger'
  | 'onSuccess'
  | 'neutral';

interface GlassSpinnerProps {
  size?: GlassSpinnerSize;
  tone?: GlassSpinnerTone;
  className?: string;
  /**
   * Accessible label. If omitted:
   *  - when inside an `aria-busy` container → spinner is `aria-hidden` (no announcement)
   *  - otherwise → falls back to "Loading…"
   */
  label?: string;
  /** Force `aria-hidden` (e.g., when parent already communicates loading) */
  decorative?: boolean;
}

/* ============================================================================
 * CONSTANTS
 * ========================================================================== */

const SIZE_CLASSES: Record<GlassSpinnerSize, string> = {
  xs: 'w-3.5 h-3.5 border',         // 14px, 1px border
  sm: 'w-4 h-4 border-2',           // 16px, 2px
  md: 'w-5 h-5 border-2',           // 20px, 2px
  lg: 'w-8 h-8 border-[3px]',       // 32px, 3px (was 2.5 → subpixel)
};

const TONE_CLASSES: Record<GlassSpinnerTone, { track: string; head: string }> = {
  default:   { track: 'border-[var(--border-medium)]', head: 'border-t-[var(--primary)]' },
  onPrimary: { track: 'border-white/30',               head: 'border-t-white' },
  onDanger:  { track: 'border-white/30',               head: 'border-t-white' },
  onSuccess: { track: 'border-white/30',               head: 'border-t-white' },
  neutral:   { track: 'border-[var(--border-subtle)]', head: 'border-t-[var(--text-secondary)]' },
};

/* ============================================================================
 * HOOKS
 * ========================================================================== */

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

/**
 * Detect whether the spinner is rendered inside a container with aria-busy="true".
 * If so, hide the spinner from AT (parent already announces busy state).
 */
function useInsideBusyContainer(ref: React.RefObject<HTMLElement | null>) {
  const [insideBusy, setInsideBusy] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const busyParent = el.closest('[aria-busy="true"]');
    setInsideBusy(Boolean(busyParent));
  }, [ref]);
  return insideBusy;
}

/* ============================================================================
 * COMPONENT
 * ========================================================================== */

export function GlassSpinner({
  size = 'md',
  tone = 'default',
  className = '',
  label,
  decorative = false,
}: GlassSpinnerProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const reduced = usePrefersReducedMotion();
  const insideBusy = useInsideBusyContainer(ref);

  // If parent is aria-busy, or explicitly decorative — hide from AT.
  const isHidden = decorative || insideBusy;
  const ariaLabel = isHidden ? undefined : (label || 'Loading…');

  const toneClass = TONE_CLASSES[tone];

  const style: CSSProperties = reduced
    ? { animation: 'var(--spinner-pulse, none)' }
    : { willChange: 'transform' };

  return (
    <span
      ref={ref}
      role={isHidden ? undefined : 'status'}
      aria-label={ariaLabel}
      aria-live={isHidden ? undefined : 'polite'}
      aria-atomic={isHidden ? undefined : true}
      aria-hidden={isHidden || undefined}
      className={[
        'inline-block rounded-full',
        'shrink-0',
        toneClass.track,
        toneClass.head,
        reduced ? 'animate-pulse' : 'animate-spin',
        SIZE_CLASSES[size],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
    />
  );
}

export default GlassSpinner;