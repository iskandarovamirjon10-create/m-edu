/**
 * GlassTabs — Apple-premium tabs.
 *
 * Variants: segmented (default) · underline · pill — sizes sm/md/lg.
 * Full WAI-ARIA tablist with roving tabindex and Arrow/Home/End keys,
 * count badges, a framer `layoutId` indicator and DOM ids namespaced per
 * instance via `useId` (fixes the old cross-instance id collision).
 */
import {
  useCallback,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { motion } from 'framer-motion';
import { SPRING, cn, compactNumber, usePrefersReducedMotion } from '@/lib/design';

/* ═══════════════════════════════════════════════════════════
 * TYPES
 * ═══════════════════════════════════════════════════════════ */

export interface Tab {
  id: string;
  label: string;
  count?: number;
  icon?: ReactNode;
  disabled?: boolean;
  /** Optional: id of the panel this tab controls (for a11y). */
  panelId?: string;
}

export type GlassTabsVariant = 'segmented' | 'underline' | 'pill';
export type GlassTabsSize = 'sm' | 'md' | 'lg';

export interface GlassTabsProps {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
  variant?: GlassTabsVariant;
  size?: GlassTabsSize;
  className?: string;
  /** A11y label for the tablist. Strongly recommended. */
  'aria-label'?: string;
  /** Alternative a11y label via element id. */
  'aria-labelledby'?: string;
  /** @deprecated no-op — the shell no longer renders an SVG filter. */
  disableRefraction?: boolean;
  /** Disables the indicator slide animation. */
  disableMotion?: boolean;
}

/* ═══════════════════════════════════════════════════════════
 * STYLE MAPS
 * ═══════════════════════════════════════════════════════════ */

const SIZE_BUTTON: Record<GlassTabsVariant, Record<GlassTabsSize, string>> = {
  segmented: {
    sm: 'gap-1.5 px-3 py-1.5 text-xs rounded-md',
    md: 'gap-2 px-4 py-2 text-sm rounded-md',
    lg: 'gap-2 px-5 py-2.5 text-base rounded-lg',
  },
  underline: {
    sm: 'gap-1.5 px-1 py-2 text-xs',
    md: 'gap-2 px-1 py-2.5 text-sm',
    lg: 'gap-2 px-1 py-3 text-base',
  },
  pill: {
    sm: 'gap-1.5 px-2.5 py-1 text-xs rounded-full',
    md: 'gap-1.5 px-3 py-1.5 text-sm rounded-full',
    lg: 'gap-2 px-4 py-2 text-sm rounded-full',
  },
};

const ICON_SIZE: Record<GlassTabsSize, string> = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-[18px] w-[18px]',
};

const CONTENT_GAP: Record<GlassTabsSize, string> = {
  sm: 'gap-1.5',
  md: 'gap-2',
  lg: 'gap-2',
};

const SHELL_CLASS: Record<GlassTabsVariant, string> = {
  segmented:
    'inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-xl ' +
    'bg-black/[0.04] p-1 border border-black/[0.04] backdrop-blur-xl dark:bg-white/[0.06] dark:border-white/[0.06]',
  underline:
    'flex max-w-full items-center gap-1 overflow-x-auto border-b border-black/[0.06] dark:border-white/[0.08]',
  pill: 'flex flex-wrap items-center gap-2',
};

function tabClass(variant: GlassTabsVariant, isActive: boolean): string {
  if (variant === 'segmented') {
    return isActive ? 'text-primary font-semibold' : 'text-secondary hover:text-primary';
  }
  if (variant === 'underline') {
    return isActive ? 'text-brand-500 font-semibold' : 'text-secondary hover:text-primary';
  }
  return isActive
    ? 'text-white font-semibold'
    : 'text-secondary hover:bg-black/[0.06] dark:hover:bg-white/[0.08]';
}

function indicatorClass(variant: GlassTabsVariant): string {
  if (variant === 'segmented') {
    return 'pointer-events-none absolute inset-0 rounded-lg bg-white/95 dark:bg-surface-800/95 shadow-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]';
  }
  if (variant === 'underline') {
    return 'pointer-events-none absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand-500';
  }
  return 'pointer-events-none absolute inset-0 rounded-full bg-brand-500 shadow-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]';
}

/* ═══════════════════════════════════════════════════════════
 * HELPERS
 * ═══════════════════════════════════════════════════════════ */

function TabCountBadge({
  count,
  isActive,
  variant,
}: {
  count: number;
  isActive: boolean;
  variant: GlassTabsVariant;
}) {
  return (
    <span
      className={cn(
        'inline-flex min-w-[18px] items-center justify-center rounded-full',
        'border px-1.5 py-px text-[11px] font-semibold leading-none tabular-nums',
        isActive
          ? variant === 'pill'
            ? 'border-white/30 bg-white/20 text-white'
            : 'border-brand-500/30 bg-brand-500/10 text-brand-500'
          : 'border-subtle bg-black/[0.04] text-tertiary dark:bg-white/[0.06]',
      )}
    >
      {compactNumber(count)}
    </span>
  );
}

/** Roving tabindex: Arrow keys, Home, End (disabled tabs are skipped). */
function useTabKeyboardNav(
  tabs: Tab[],
  onChange: (id: string) => void,
  tabRefs: RefObject<Map<string, HTMLButtonElement>>,
) {
  return useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, currentId: string) => {
      const enabled = tabs.filter((tab) => !tab.disabled);
      if (enabled.length === 0) return;
      const currentIndex = enabled.findIndex((tab) => tab.id === currentId);
      if (currentIndex === -1) return;

      let nextIndex = currentIndex;
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          nextIndex = (currentIndex + 1) % enabled.length;
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          nextIndex = (currentIndex - 1 + enabled.length) % enabled.length;
          break;
        case 'Home':
          nextIndex = 0;
          break;
        case 'End':
          nextIndex = enabled.length - 1;
          break;
        default:
          return;
      }

      e.preventDefault();
      const nextTab = enabled[nextIndex];
      onChange(nextTab.id);
      requestAnimationFrame(() => tabRefs.current?.get(nextTab.id)?.focus());
    },
    [tabs, onChange, tabRefs],
  );
}

/* ═══════════════════════════════════════════════════════════
 * MAIN
 * ═══════════════════════════════════════════════════════════ */

export function GlassTabs({
  tabs,
  active,
  onChange,
  variant = 'segmented',
  size = 'md',
  className = '',
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  disableMotion = false,
}: GlassTabsProps) {
  // Namespaced per instance — two <GlassTabs /> mounted at once never clash.
  const uid = useId().replace(/:/g, '');
  const indicatorLayoutId = `glass-tabs-${uid}-indicator`;
  const reduced = usePrefersReducedMotion();

  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const handleKeyDown = useTabKeyboardNav(tabs, onChange, tabRefs);

  if (import.meta.env.DEV && !ariaLabel && !ariaLabelledBy) {
    console.warn('[GlassTabs] tablist should have `aria-label` or `aria-labelledby`.');
  }

  const motionTransition =
    reduced || disableMotion ? { duration: 0 } : SPRING.snappy;

  return (
    <div
      data-component="glass-tabs"
      data-variant={variant}
      className={className}
    >
      <div
        role="tablist"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        className={cn(
          SHELL_CLASS[variant],
          variant !== 'pill' &&
            '[scrollbar-width:none] [ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
        )}
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
              id={`${uid}-tab-${tab.id}`}
              aria-controls={tab.panelId}
              aria-selected={isActive}
              aria-disabled={isDisabled || undefined}
              disabled={isDisabled}
              tabIndex={isActive ? 0 : -1}
              onClick={() => !isDisabled && onChange(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, tab.id)}
              className={cn(
                'relative inline-flex shrink-0 select-none items-center whitespace-nowrap',
                'font-medium transition-colors duration-150 active:scale-[0.98]',
                'focus-visible:outline-2 focus-visible:outline-offset-2',
                'focus-visible:outline-[var(--border-focus)]',
                'disabled:cursor-not-allowed disabled:opacity-50',
                SIZE_BUTTON[variant][size],
                tabClass(variant, isActive),
              )}
            >
              {isActive && (
                <motion.span
                  layoutId={indicatorLayoutId}
                  transition={motionTransition}
                  className={indicatorClass(variant)}
                  aria-hidden="true"
                />
              )}

              <span className={cn('relative z-[1] inline-flex items-center', CONTENT_GAP[size])}>
                {tab.icon && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      'flex shrink-0 items-center [&>svg]:h-full [&>svg]:w-full',
                      ICON_SIZE[size],
                    )}
                  >
                    {tab.icon}
                  </span>
                )}
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <TabCountBadge
                    count={tab.count}
                    isActive={isActive}
                    variant={variant}
                  />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default GlassTabs;
