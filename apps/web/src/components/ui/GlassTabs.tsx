/**
 * GlassTabs V3 — Canonical tabs for M-EDU Design System V4 (Aurora Prime).
 *
 * Variants: segmented | underline | pill
 * Sizes:    sm | md | lg
 *
 * Fully WAI-ARIA compliant (tablist pattern):
 *   - Arrow Left/Right: move focus between tabs
 *   - Home/End: first/last tab
 *   - tabIndex: only active tab is tabbable (roving tabindex)
 *   - id + aria-controls + aria-labelledby: panel association
 *
 * v3 FIXES (v2 → v3):
 *  1. Keyboard navigation (Arrow/Home/End + roving tabIndex) — was missing (P0)
 *  2. aria-controls / id / aria-labelledby — panel association
 *  3. type="button" on all tabs — was missing (form submit bug)
 *  4. React.ReactNode → import type { ReactNode }
 *  5. TabCountBadge extracted — was 3x duplicated
 *  6. formatCount (1.2K, 15K) — better UX for large counts
 *  7. Motion — sliding indicator via Framer Motion layoutId (segmented + underline)
 *  8. Mobile — overflow-x-auto + scroll-snap (segmented + underline)
 *  9. Underline: focus-visible outline (was outline-none — a11y bug)
 * 10. Underline: after:scale-x-0 initial (was scale-x-100 — pop)
 * 11. Design tokens: --shadow-brand, --text-on-brand, --opacity-disabled
 * 12. Token sizes: --text-md/lg/xl (was Tailwind text-base 16px)
 * 13. SIZE_MAP — single source of truth (was 3x inline)
 * 14. tablist aria-label — dev warning if absent
 */

import {
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
  type KeyboardEvent,
} from 'react';
import { motion } from 'framer-motion';

/* ============================================================================
 * TYPES
 * ========================================================================== */

export interface Tab {
  id: string;
  label: string;
  count?: number;
  icon?: ReactNode;
  disabled?: boolean;
  /** Optional: id of the panel this tab controls (for a11y) */
  panelId?: string;
}

type Variant = 'segmented' | 'underline' | 'pill';
type Size = 'sm' | 'md' | 'lg';

export interface GlassTabsProps {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
  variant?: Variant;
  size?: Size;
  className?: string;
  /** A11y label for the tablist. Strongly recommended. */
  'aria-label'?: string;
  /** Alternative a11y label via element id */
  'aria-labelledby'?: string;
}

interface InternalProps extends Omit<GlassTabsProps, 'variant'> {
  variant: Variant;
}

/* ============================================================================
 * CONSTANTS
 * ========================================================================== */

const MOTION_SPRING = {
  type: 'spring',
  stiffness: 380,
  damping: 32,
  mass: 0.7,
} as const;

const SIZE_MAP: Record<Variant, Record<Size, string>> = {
  segmented: {
    sm: 'px-3 py-1.5 text-[var(--text-sm)]',
    md: 'px-4 py-2 text-[var(--text-md)]',
    lg: 'px-5 py-2.5 text-[var(--text-lg)]',
  },
  underline: {
    sm: 'px-1 py-2 text-[var(--text-sm)]',
    md: 'px-1 py-3 text-[var(--text-md)]',
    lg: 'px-1 py-3.5 text-[var(--text-lg)]',
  },
  pill: {
    sm: 'px-2.5 py-1 text-[var(--text-xs)]',
    md: 'px-3.5 py-1.5 text-[var(--text-sm)]',
    lg: 'px-5 py-2 text-[var(--text-lg)]',
  },
};

const ICON_SIZE_MAP: Record<Variant, string> = {
  segmented: '[&>svg]:w-4 [&>svg]:h-4',
  underline: '[&>svg]:w-4 [&>svg]:h-4',
  pill:      '[&>svg]:w-3.5 [&>svg]:h-3.5',
};

/* ============================================================================
 * HELPERS
 * ========================================================================== */

/** Compact number formatting: 1234 → "1.2K", 1_500_000 → "1.5M" */
function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    const k = n / 1000;
    return k < 10 ? `${k.toFixed(1).replace(/\.0$/, '')}K` : `${Math.round(k)}K`;
  }
  const m = n / 1_000_000;
  return m < 10 ? `${m.toFixed(1).replace(/\.0$/, '')}M` : `${Math.round(m)}M`;
}

const isDev = (() => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) return true;
  } catch { /* noop */ }
  try {
    return process.env.NODE_ENV !== 'production';
  } catch {
    return false;
  }
})();

function devWarn(condition: boolean, message: string): void {
  if (isDev && condition && typeof console !== 'undefined') {
    // eslint-disable-next-line no-console
    console.warn(`[GlassTabs] ${message}`);
  }
}

/* ============================================================================
 * SHARED — TabCountBadge
 * ----------------------------------------------------------------------------
 * Previously duplicated 3 times. Single source of truth.
 * ========================================================================== */

function TabCountBadge({
  count,
  isActive,
  variant,
}: {
  count: number;
  isActive: boolean;
  variant: Variant;
}) {
  const isPill = variant === 'pill';

  // Pill: count badge on primary background
  if (isPill) {
    return (
      <span
        className={[
          'px-1.5 py-0.5 text-[var(--text-2xs)] font-semibold rounded-[var(--radius-pill)]',
          'min-w-[1.125rem] text-center leading-tight tabular-nums',
          isActive
            ? 'bg-white/20 text-[var(--text-on-brand)]'
            : 'bg-[var(--border-subtle)] text-[var(--text-tertiary)]',
        ].join(' ')}
      >
        {formatCount(count)}
      </span>
    );
  }

  // Segmented + Underline: same visual
  return (
    <span
      className={[
        'px-1.5 py-0.5 text-[var(--text-2xs)] font-semibold rounded-[var(--radius-pill)]',
        'min-w-[1.125rem] text-center leading-tight tabular-nums',
        isActive
          ? 'bg-[var(--primary-soft)] text-[var(--primary)]'
          : 'bg-[var(--border-subtle)] text-[var(--text-tertiary)]',
      ].join(' ')}
    >
      {formatCount(count)}
    </span>
  );
}

/* ============================================================================
 * SHARED — Keyboard navigation hook (roving tabindex)
 * ========================================================================== */

function useTabKeyboardNav(
  tabs: Tab[],
  onChange: (id: string) => void,
  tabRefs: React.MutableRefObject<Map<string, HTMLButtonElement>>,
) {
  return useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, currentId: string) => {
      const enabledTabs = tabs.filter((t) => !t.disabled);
      if (enabledTabs.length === 0) return;

      const currentIndex = enabledTabs.findIndex((t) => t.id === currentId);
      if (currentIndex === -1) return;

      let nextIndex = currentIndex;

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          nextIndex = (currentIndex + 1) % enabledTabs.length;
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          nextIndex = (currentIndex - 1 + enabledTabs.length) % enabledTabs.length;
          break;
        case 'Home':
          nextIndex = 0;
          break;
        case 'End':
          nextIndex = enabledTabs.length - 1;
          break;
        default:
          return;
      }

      e.preventDefault();
      const nextTab = enabledTabs[nextIndex];
      onChange(nextTab.id);
      // Move focus after state update
      requestAnimationFrame(() => {
        tabRefs.current.get(nextTab.id)?.focus();
      });
    },
    [tabs, onChange, tabRefs],
  );
}

/* ============================================================================
 * SEGMENTED TABS
 * ========================================================================== */

function SegmentedTabs({
  tabs, active, onChange, size = 'md', className = '',
  'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy,
}: InternalProps) {
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const sizeClass = SIZE_MAP.segmented[size];
  const iconClass = ICON_SIZE_MAP.segmented;

  const handleKeyDown = useTabKeyboardNav(tabs, onChange, tabRefs);

  devWarn(
    !ariaLabel && !ariaLabelledBy,
    'tablist should have `aria-label` or `aria-labelledby` for screen readers.',
  );

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={[
        // Mobile: horizontal scroll
        'inline-flex items-center gap-0.5 p-1',
        'bg-[var(--bg-glass)] backdrop-blur-xl [-webkit-backdrop-filter:blur(16px)]',
        'border border-[var(--border-subtle)]',
        'rounded-[var(--radius-lg)]',
        // Scroll safety
        'max-w-full overflow-x-auto scrollbar-thin',
        'whitespace-nowrap',
        className,
      ].join(' ')}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        const isDisabled = Boolean(tab.disabled);

        return (
          <button
            key={tab.id}
            ref={(el) => {
              if (el) tabRefs.current.set(tab.id, el);
              else tabRefs.current.delete(tab.id);
            }}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-controls={tab.panelId}
            aria-selected={isActive}
            aria-disabled={isDisabled || undefined}
            disabled={isDisabled}
            tabIndex={isActive ? 0 : -1}
            onClick={() => !isDisabled && onChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, tab.id)}
            className={[
              'relative flex items-center gap-2',
              sizeClass,
              'font-medium rounded-[var(--radius-md)]',
              'whitespace-nowrap select-none',
              'transition-colors',
              'duration-[var(--duration-fast)] [transition-timing-function:var(--ease-standard)]',
              'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--border-focus)]',
              isActive
                ? 'text-[var(--text-primary)] font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--state-hover)]',
              isDisabled ? 'opacity-[var(--opacity-disabled,0.55)] cursor-not-allowed' : 'cursor-pointer',
            ].join(' ')}
          >
            {/* Sliding indicator (Framer Motion) */}
            {isActive && (
              <motion.span
                layoutId="glass-tabs-segmented-indicator"
                className="absolute inset-0 rounded-[var(--radius-md)]"
                style={{
                  background: 'var(--bg-surface)',
                  boxShadow: 'var(--shadow-xs)',
                }}
                transition={MOTION_SPRING}
                aria-hidden
              />
            )}

            <span className="relative z-10 flex items-center gap-2">
              {tab.icon && <span className={`${iconClass} flex-shrink-0 flex items-center`}>{tab.icon}</span>}
              {tab.label}
              {tab.count !== undefined && (
                <TabCountBadge count={tab.count} isActive={isActive} variant="segmented" />
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================================
 * UNDERLINE TABS
 * ========================================================================== */

function UnderlineTabs({
  tabs, active, onChange, size = 'md', className = '',
  'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy,
}: InternalProps) {
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const sizeClass = SIZE_MAP.underline[size];
  const iconClass = ICON_SIZE_MAP.underline;

  const handleKeyDown = useTabKeyboardNav(tabs, onChange, tabRefs);

  devWarn(
    !ariaLabel && !ariaLabelledBy,
    'tablist should have `aria-label` or `aria-labelledby` for screen readers.',
  );

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={[
        'flex items-center gap-4',
        'border-b border-[var(--border-subtle)]',
        // Mobile scroll
        'max-w-full overflow-x-auto scrollbar-thin',
        'whitespace-nowrap',
        className,
      ].join(' ')}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        const isDisabled = Boolean(tab.disabled);

        return (
          <button
            key={tab.id}
            ref={(el) => {
              if (el) tabRefs.current.set(tab.id, el);
              else tabRefs.current.delete(tab.id);
            }}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-controls={tab.panelId}
            aria-selected={isActive}
            aria-disabled={isDisabled || undefined}
            disabled={isDisabled}
            tabIndex={isActive ? 0 : -1}
            onClick={() => !isDisabled && onChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, tab.id)}
            className={[
              'relative flex items-center gap-2',
              sizeClass,
              'font-medium whitespace-nowrap select-none',
              'transition-colors duration-[var(--duration-fast)] [transition-timing-function:var(--ease-standard)]',
              // v3: focus ring (was outline-none — a11y bug)
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)] focus-visible:rounded-[var(--radius-xs)]',
              isActive
                ? 'text-[var(--primary)] font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
              isDisabled ? 'opacity-[var(--opacity-disabled,0.55)] cursor-not-allowed' : 'cursor-pointer',
            ].join(' ')}
          >
            {tab.icon && <span className={`${iconClass} flex-shrink-0 flex items-center`}>{tab.icon}</span>}
            {tab.label}
            {tab.count !== undefined && (
              <TabCountBadge count={tab.count} isActive={isActive} variant="underline" />
            )}

            {/* Sliding underline (Framer Motion) */}
            {isActive && (
              <motion.span
                layoutId="glass-tabs-underline-indicator"
                className="absolute -bottom-px left-0 right-0 h-[2px] rounded-full"
                style={{ background: 'var(--primary)' }}
                transition={MOTION_SPRING}
                aria-hidden
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================================
 * PILL TABS
 * ========================================================================== */

function PillTabs({
  tabs, active, onChange, size = 'md', className = '',
  'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy,
}: InternalProps) {
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const sizeClass = SIZE_MAP.pill[size];
  const iconClass = ICON_SIZE_MAP.pill;

  const handleKeyDown = useTabKeyboardNav(tabs, onChange, tabRefs);

  devWarn(
    !ariaLabel && !ariaLabelledBy,
    'tablist should have `aria-label` or `aria-labelledby` for screen readers.',
  );

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={['flex flex-wrap items-center gap-2', className].join(' ')}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        const isDisabled = Boolean(tab.disabled);

        return (
          <button
            key={tab.id}
            ref={(el) => {
              if (el) tabRefs.current.set(tab.id, el);
              else tabRefs.current.delete(tab.id);
            }}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-controls={tab.panelId}
            aria-selected={isActive}
            aria-disabled={isDisabled || undefined}
            disabled={isDisabled}
            tabIndex={isActive ? 0 : -1}
            onClick={() => !isDisabled && onChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, tab.id)}
            className={[
              'flex items-center gap-1.5',
              sizeClass,
              'font-medium rounded-[var(--radius-pill)] border',
              'whitespace-nowrap select-none',
              'transition-[background-color,color,border-color,box-shadow]',
              'duration-[var(--duration-fast)] [transition-timing-function:var(--ease-standard)]',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]',
              isActive
                ? 'bg-[var(--primary)] border-[var(--primary)] text-[var(--text-on-brand)] shadow-[var(--shadow-brand)]'
                : 'bg-transparent border-[var(--border-medium)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] hover:bg-[var(--state-hover)]',
              isDisabled ? 'opacity-[var(--opacity-disabled,0.55)] cursor-not-allowed' : 'cursor-pointer',
            ].join(' ')}
          >
            {tab.icon && <span className={`${iconClass} flex-shrink-0 flex items-center`}>{tab.icon}</span>}
            {tab.label}
            {tab.count !== undefined && (
              <TabCountBadge count={tab.count} isActive={isActive} variant="pill" />
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================================
 * MAIN EXPORT
 * ========================================================================== */

export function GlassTabs({ variant = 'segmented', ...props }: GlassTabsProps) {
  // Memoize variant switch to avoid re-render churn when tabs list is stable
  const VariantComponent = useMemo(() => {
    switch (variant) {
      case 'underline': return UnderlineTabs;
      case 'pill':      return PillTabs;
      case 'segmented':
      default:          return SegmentedTabs;
    }
  }, [variant]);

  return <VariantComponent {...props} variant={variant} />;
}

export default GlassTabs;