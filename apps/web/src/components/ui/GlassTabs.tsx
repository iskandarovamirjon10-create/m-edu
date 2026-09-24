/**
 * GlassTabs V2 — Canonical tab system.
 * variant: 'segmented' | 'underline' | 'pill'
 */

interface Tab {
  id: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface GlassTabsProps {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
  variant?: 'segmented' | 'underline' | 'pill';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}



// ── Segmented (pill background) ───────────────────────────────
function SegmentedTabs({ tabs, active, onChange, size = 'md', className = '' }: GlassTabsProps) {
  const sizeClass = size === 'sm' ? 'px-3 py-1.5 text-sm' : size === 'lg' ? 'px-5 py-2.5 text-base' : 'px-4 py-2 text-[var(--text-body-sm)]';

  return (
    <div
      role="tablist"
      className={[
        'inline-flex items-center gap-0.5 p-1',
        'bg-[var(--bg-glass)] backdrop-blur-xl [-webkit-backdrop-filter:blur(16px)]',
        'border border-[var(--border-subtle)]',
        'rounded-[var(--radius-lg)]',
        className,
      ].join(' ')}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            disabled={tab.disabled}
            onClick={() => !tab.disabled && onChange(tab.id)}
            className={[
              'relative flex items-center gap-2',
              sizeClass,
              'font-medium rounded-[var(--radius-md)]',
              'whitespace-nowrap select-none',
              'transition-[background-color,color,box-shadow]',
              'duration-[var(--duration-fast)] [transition-timing-function:var(--ease-standard)]',
              'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--border-focus)]',
              isActive
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-[var(--shadow-xs)] font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--state-hover)]',
              tab.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
            ].join(' ')}
          >
            {tab.icon && (
              <span className="[&>svg]:w-4 [&>svg]:h-4 flex-shrink-0">{tab.icon}</span>
            )}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={[
                  'px-1.5 py-0.5 text-[0.6875rem] font-semibold rounded-[var(--radius-pill)] min-w-[1.125rem] text-center leading-none',
                  isActive
                    ? 'bg-[var(--primary-soft)] text-[var(--primary)]'
                    : 'bg-[var(--border-subtle)] text-[var(--text-tertiary)]',
                ].join(' ')}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Underline tabs ────────────────────────────────────────────
function UnderlineTabs({ tabs, active, onChange, size = 'md', className = '' }: GlassTabsProps) {
  const sizeClass = size === 'sm' ? 'px-1 py-2 text-sm' : size === 'lg' ? 'px-1 py-3.5 text-base' : 'px-1 py-3 text-[var(--text-body-sm)]';

  return (
    <div
      role="tablist"
      className={[
        'flex items-center gap-4',
        'border-b border-[var(--border-subtle)]',
        className,
      ].join(' ')}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            disabled={tab.disabled}
            onClick={() => !tab.disabled && onChange(tab.id)}
            className={[
              'relative flex items-center gap-2',
              sizeClass,
              'font-medium whitespace-nowrap select-none',
              'transition-[color] duration-[var(--duration-fast)] [transition-timing-function:var(--ease-standard)]',
              'focus-visible:outline-none',
              'after:absolute after:bottom-[-1px] after:left-0 after:right-0 after:h-[2px] after:rounded-full',
              'after:transition-[background-color,transform,opacity]',
              'after:duration-[var(--duration-fast)] after:[transition-timing-function:var(--ease-standard)]',
              isActive
                ? 'text-[var(--primary)] after:bg-[var(--primary)] after:scale-x-100 after:opacity-100'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] after:bg-transparent after:opacity-0',
              tab.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
            ].join(' ')}
          >
            {tab.icon && <span className="[&>svg]:w-4 [&>svg]:h-4">{tab.icon}</span>}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={[
                  'px-1.5 py-0.5 text-[0.6875rem] font-semibold rounded-[var(--radius-pill)] min-w-[1.125rem] text-center leading-none',
                  isActive
                    ? 'bg-[var(--primary-soft)] text-[var(--primary)]'
                    : 'bg-[var(--border-subtle)] text-[var(--text-tertiary)]',
                ].join(' ')}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Pill tabs (compact inline) ────────────────────────────────
function PillTabs({ tabs, active, onChange, size = 'md', className = '' }: GlassTabsProps) {
  const sizeClass = size === 'sm' ? 'px-2.5 py-1 text-xs' : size === 'lg' ? 'px-5 py-2 text-base' : 'px-3.5 py-1.5 text-sm';

  return (
    <div role="tablist" className={['flex flex-wrap items-center gap-2', className].join(' ')}>
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            disabled={tab.disabled}
            onClick={() => !tab.disabled && onChange(tab.id)}
            className={[
              'flex items-center gap-1.5',
              sizeClass,
              'font-medium rounded-[var(--radius-pill)] border',
              'whitespace-nowrap select-none',
              'transition-[background-color,color,border-color,box-shadow]',
              'duration-[var(--duration-fast)] [transition-timing-function:var(--ease-standard)]',
              'focus-visible:outline-2 focus-visible:outline-[var(--border-focus)]',
              isActive
                ? 'bg-[var(--primary)] border-[var(--primary)] text-white shadow-[0_2px_6px_rgba(79,70,229,0.25)]'
                : 'bg-transparent border-[var(--border-medium)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] hover:bg-[var(--state-hover)]',
              tab.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
            ].join(' ')}
          >
            {tab.icon && <span className="[&>svg]:w-3.5 [&>svg]:h-3.5">{tab.icon}</span>}
            {tab.label}
            {tab.count !== undefined && (
              <span className={['px-1.5 py-0.5 text-[0.6875rem] rounded-[var(--radius-pill)] leading-none min-w-[1.125rem] text-center font-semibold',
                isActive ? 'bg-white/20' : 'bg-[var(--border-subtle)] text-[var(--text-tertiary)]'].join(' ')}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────
export function GlassTabs({ variant = 'segmented', ...props }: GlassTabsProps) {
  if (variant === 'underline') return <UnderlineTabs {...props} variant={variant} />;
  if (variant === 'pill')      return <PillTabs {...props} variant={variant} />;
  return <SegmentedTabs {...props} variant={variant} />;
}

export default GlassTabs;
