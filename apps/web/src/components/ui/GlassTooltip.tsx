/**
 * GlassTooltip — portal tooltip with top/bottom/left/right placement,
 * open/close delays, Escape-to-hide and `aria-describedby` injection.
 *
 * Fixes over the previous edition:
 *  - consumer mouse/focus/touch handlers are CHAINED, never dropped
 *  - child refs (function AND object) are merged through a useCallback ref
 *  - touchstart no longer calls preventDefault (scrolling still works)
 */
import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type MouseEvent as ReactMouseEvent,
  type MutableRefObject,
  type ReactElement,
  type ReactNode,
  type Ref,
  type TouchEvent as ReactTouchEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { cn, usePrefersReducedMotion } from '@/lib/design';

/* ─────────────────────────────────────────────────────────────
 * Public types
 * ───────────────────────────────────────────────────────────── */

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';
export type TooltipSize = 'sm' | 'md' | 'lg';
export type TooltipTone = 'default' | 'primary' | 'danger' | 'success';

export interface GlassTooltipProps {
  children: ReactNode;
  content: string;
  placement?: TooltipPlacement;
  /** Delay before the tooltip appears (ms). Default 120. */
  openDelay?: number;
  /** Delay before the tooltip hides (ms). Default 80. */
  closeDelay?: number;
  /** Maximum width in px. Default 260. */
  maxWidth?: number;
  /** Renders an arrow pointing to the trigger. Default true. */
  arrow?: boolean;
  size?: TooltipSize;
  tone?: TooltipTone;
  /** Disable portal (render inline). Use only when no clipping ancestor exists. */
  inline?: boolean;
  /** @deprecated no-op — the bubble no longer renders an SVG filter. */
  disableRefraction?: boolean;
  className?: string;
}

/* ─────────────────────────────────────────────────────────────
 * Tokens
 * ───────────────────────────────────────────────────────────── */

const SIZE_CLASS: Record<TooltipSize, string> = {
  sm: 'px-2 py-1 text-[11px]',
  md: 'px-2.5 py-1.5 text-xs',
  lg: 'px-3 py-2 text-sm',
};

const ARROW_SIZE: Record<TooltipSize, number> = { sm: 6, md: 7, lg: 8 };

const TONE_CLASS: Record<TooltipTone, string> = {
  default:
    'bg-surface-900/90 text-white backdrop-blur-xl border border-white/10 dark:bg-surface-900/90 dark:text-white dark:border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]',
  primary:
    'bg-apple-blue/90 text-white backdrop-blur-xl border border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]',
  danger:
    'bg-apple-red/90 text-white backdrop-blur-xl border border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]',
  success:
    'bg-apple-green/90 text-white backdrop-blur-xl border border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]',
};

/* ─────────────────────────────────────────────────────────────
 * Ref + handler helpers
 * ───────────────────────────────────────────────────────────── */

function assignRef<T>(ref: Ref<T> | null | undefined, value: T | null): void {
  if (typeof ref === 'function') ref(value);
  else if (ref) (ref as MutableRefObject<T | null>).current = value;
}

/** React 18 keeps a DOM child's ref on the element; React 19 puts it in props. */
function resolveChildRef(child: ReactElement): Ref<HTMLElement> | undefined {
  const propsRef = (child.props as { ref?: Ref<HTMLElement> | null } | null)?.ref;
  const elementRef = (child as unknown as { ref?: Ref<HTMLElement> | null }).ref;
  return propsRef ?? elementRef ?? undefined;
}

/** Run the consumer handler first, then ours. */
function chain<E>(own: ((e: E) => void) | undefined, theirs: ((e: E) => void) | undefined) {
  return (e: E): void => {
    theirs?.(e);
    own?.(e);
  };
}

/* ─────────────────────────────────────────────────────────────
 * Position math (with viewport flip + clamp)
 * ───────────────────────────────────────────────────────────── */

interface Coords {
  top: number;
  left: number;
  resolvedPlacement: TooltipPlacement;
}

const GAP = 8;
const MARGIN = 6;

function computePosition(
  trigger: DOMRect,
  bubble: DOMRect,
  placement: TooltipPlacement,
): Coords {
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;

  const fits = {
    top: trigger.top - bubble.height - GAP >= 0,
    bottom: trigger.bottom + bubble.height + GAP <= viewportH,
    left: trigger.left - bubble.width - GAP >= 0,
    right: trigger.right + bubble.width + GAP <= viewportW,
  };
  const opposite: Record<TooltipPlacement, TooltipPlacement> = {
    top: 'bottom',
    bottom: 'top',
    left: 'right',
    right: 'left',
  };
  const resolved = fits[placement] ? placement : opposite[placement];

  let top = 0;
  let left = 0;
  switch (resolved) {
    case 'top':
      top = trigger.top - bubble.height - GAP;
      left = trigger.left + trigger.width / 2 - bubble.width / 2;
      break;
    case 'bottom':
      top = trigger.bottom + GAP;
      left = trigger.left + trigger.width / 2 - bubble.width / 2;
      break;
    case 'left':
      top = trigger.top + trigger.height / 2 - bubble.height / 2;
      left = trigger.left - bubble.width - GAP;
      break;
    case 'right':
      top = trigger.top + trigger.height / 2 - bubble.height / 2;
      left = trigger.right + GAP;
      break;
  }

  left = Math.max(MARGIN, Math.min(left, viewportW - bubble.width - MARGIN));
  top = Math.max(MARGIN, Math.min(top, viewportH - bubble.height - MARGIN));
  return { top, left, resolvedPlacement: resolved };
}

function arrowStyle(placement: TooltipPlacement, size: number): CSSProperties {
  const half = size / 2;
  switch (placement) {
    case 'top':
      return { bottom: -half, left: '50%', marginLeft: -half };
    case 'bottom':
      return { top: -half, left: '50%', marginLeft: -half };
    case 'left':
      return { right: -half, top: '50%', marginTop: -half };
    case 'right':
      return { left: -half, top: '50%', marginTop: -half };
  }
}

/* ─────────────────────────────────────────────────────────────
 * Trigger prop contract (used for cloneElement typing)
 * ───────────────────────────────────────────────────────────── */

interface TriggerProps {
  ref?: Ref<HTMLElement>;
  'aria-describedby'?: string;
  onMouseEnter?: (e: ReactMouseEvent) => void;
  onMouseLeave?: (e: ReactMouseEvent) => void;
  onFocus?: (e: ReactFocusEvent) => void;
  onBlur?: (e: ReactFocusEvent) => void;
  onTouchStart?: (e: ReactTouchEvent) => void;
  onTouchEnd?: (e: ReactTouchEvent) => void;
}

/* ─────────────────────────────────────────────────────────────
 * GlassTooltip
 * ───────────────────────────────────────────────────────────── */

export function GlassTooltip({
  children,
  content,
  placement = 'top',
  openDelay = 120,
  closeDelay = 80,
  maxWidth = 260,
  arrow = true,
  size = 'md',
  tone = 'default',
  inline = false,
  className,
}: GlassTooltipProps) {
  const tooltipId = `glass-tooltip-${useId().replace(/:/g, '')}`;
  const reduced = usePrefersReducedMotion();

  const triggerRef = useRef<HTMLElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const childrenRef = useRef<ReactNode>(children);
  childrenRef.current = children;

  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<Coords>({
    top: 0,
    left: 0,
    resolvedPlacement: placement,
  });

  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
  }, []);

  const show = useCallback(() => {
    clearTimers();
    openTimer.current = setTimeout(() => setOpen(true), openDelay);
  }, [clearTimers, openDelay]);

  const hide = useCallback(() => {
    clearTimers();
    closeTimer.current = setTimeout(() => setOpen(false), closeDelay);
  }, [clearTimers, closeDelay]);

  /* ── Position tracking ──────────────────────────── */
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const bubble = bubbleRef.current;
    if (!trigger || !bubble) return;

    const update = () => {
      setCoords(
        computePosition(trigger.getBoundingClientRect(), bubble.getBoundingClientRect(), placement),
      );
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, placement, content]);

  /* ── Escape closes ──────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, hide]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  /* ── Trigger: chained handlers + merged ref ─────── */
  const setTriggerRef = useCallback((el: HTMLElement | null) => {
    triggerRef.current = el;
    const current = childrenRef.current;
    if (isValidElement(current)) assignRef(resolveChildRef(current), el);
  }, []);

  const child = isValidElement(children) ? (children as ReactElement<TriggerProps>) : null;
  const childProps = (child?.props ?? {}) as TriggerProps;

  const trigger = child
    ? cloneElement(child, {
        ref: setTriggerRef,
        'aria-describedby': open ? tooltipId : undefined,
        onMouseEnter: chain(show, childProps.onMouseEnter),
        onMouseLeave: chain(hide, childProps.onMouseLeave),
        onFocus: chain(show, childProps.onFocus),
        onBlur: chain(hide, childProps.onBlur),
        onTouchStart: chain(show, childProps.onTouchStart),
        onTouchEnd: chain(hide, childProps.onTouchEnd),
      })
    : (
        <span
          ref={setTriggerRef}
          aria-describedby={open ? tooltipId : undefined}
          onMouseEnter={show}
          onMouseLeave={hide}
          onFocus={show}
          onBlur={hide}
          style={{ display: 'inline-flex' }}
        >
          {children}
        </span>
      );

  /* ── Bubble ─────────────────────────────────────── */
  const bubble = open ? (
    <div
      ref={bubbleRef}
      id={tooltipId}
      role="tooltip"
      className={cn(
        'pointer-events-none fixed z-[var(--z-tooltip,1300)]',
        'select-none rounded-lg font-medium leading-snug shadow-dropdown',
        SIZE_CLASS[size],
        TONE_CLASS[tone],
        !reduced && 'animate-fade-in',
        className,
      )}
      style={{ top: coords.top, left: coords.left, maxWidth }}
    >
      {content}
      {arrow && (
        <span
          aria-hidden="true"
          className="absolute block rotate-45 rounded-[1px] bg-inherit"
          style={{ width: ARROW_SIZE[size], height: ARROW_SIZE[size], ...arrowStyle(coords.resolvedPlacement, ARROW_SIZE[size]) }}
        />
      )}
    </div>
  ) : null;

  return (
    <>
      {trigger}
      {bubble &&
        (inline
          ? bubble
          : typeof document !== 'undefined' && createPortal(bubble, document.body))}
    </>
  );
}

export default GlassTooltip;
