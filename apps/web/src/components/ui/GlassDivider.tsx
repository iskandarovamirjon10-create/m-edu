/**
 * GlassDivider — Simple divider line.
 */
interface GlassDividerProps {
  className?: string;
  label?: string;
}

export function GlassDivider({ className = '', label }: GlassDividerProps) {
  if (label) {
    return (
      <div className={['flex items-center gap-3', className].join(' ')}>
        <div className="flex-1 h-px bg-[var(--border-subtle)]" />
        <span className="text-xs text-[var(--text-muted)] font-medium px-2">{label}</span>
        <div className="flex-1 h-px bg-[var(--border-subtle)]" />
      </div>
    );
  }
  return <div className={['h-px bg-[var(--border-subtle)]', className].join(' ')} />;
}

export default GlassDivider;
