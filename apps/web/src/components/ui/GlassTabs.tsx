/**
 * GlassTabs — Segmented tab control.
 */

interface GlassTabsProps {
  tabs: Array<{ id: string; label: string; count?: number }>;
  active: string;
  onChange: (id: string) => void;
  className?: string;
}

export function GlassTabs({ tabs, active, onChange, className = '' }: GlassTabsProps) {
  return (
    <div
      className={[
        'inline-flex items-center gap-1 p-1',
        'bg-[var(--bg-glass)]',
        'backdrop-blur-2xl',
        'border border-[var(--border-subtle)]',
        'rounded-2xl',
        className,
      ].join(' ')}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={[
              'relative z-10 flex items-center gap-1.5',
              'px-4 py-2 text-sm font-medium',
              'rounded-xl',
              'transition-all duration-200',
              'whitespace-nowrap',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700',
              isActive
                ? 'bg-[var(--bg-surface)] text-brand-700 shadow-[var(--shadow-xs)] font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/40',
            ].join(' ')}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={[
                  'px-1.5 py-0.5 text-[0.75rem] rounded-full min-w-[1.25rem] text-center',
                  isActive
                    ? 'bg-brand-700/12 text-brand-700'
                    : 'bg-[var(--border-subtle)] text-[var(--text-muted)]',
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

export default GlassTabs;
