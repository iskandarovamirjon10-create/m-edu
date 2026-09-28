/**
 * GlassTable V2 — Consistent table system.
 * Features: sticky header, sort indicators, loading skeleton rows,
 *           empty state, responsive, token-driven hover.
 */
import { type ReactNode, type CSSProperties, type KeyboardEvent, isValidElement } from 'react';

interface GlassTableProps {
  children: ReactNode;
  className?: string;
  /** Enable sticky table header */
  stickyHeader?: boolean;
}

interface ExtraProps {
  style?: CSSProperties;
  title?: string;
  onClick?: (e: React.MouseEvent) => void;
  onKeyDown?: (e: KeyboardEvent) => void;
  tabIndex?: number;
  role?: string;
  'aria-label'?: string;
  'aria-selected'?: boolean;
  'aria-sort'?: 'ascending' | 'descending' | 'none';
  colSpan?: number;
}

export function GlassTable({ children, className = '', stickyHeader = false }: GlassTableProps) {
  return (
    <div
      className={[
        'bg-[var(--bg-glass)]',
        'backdrop-blur-[16px] [-webkit-backdrop-filter:blur(16px)_saturate(1.4)]',
        'border border-[var(--border-subtle)]',
        'rounded-[var(--radius-lg)]',
        'overflow-hidden',
        'shadow-[var(--shadow-sm)]',
        className,
      ].join(' ')}
    >
      <div className={stickyHeader ? 'overflow-auto max-h-[600px]' : 'overflow-x-auto'}>
        <table className="w-full border-collapse min-w-[500px]">{children}</table>
      </div>
    </div>
  );
}

export function GlassTHead({ children }: { children: ReactNode | ReactNode[] }) {
  const isRowChild = isValidElement(children) && (children.type === GlassTR || children.type === 'tr');
  return (
    <thead className="bg-[rgba(15,23,42,0.04)] dark:bg-[rgba(255,255,255,0.03)] sticky top-0 z-10">
      {isRowChild ? children : <tr>{children as never}</tr>}
    </thead>
  );
}

interface GlassTHProps {
  children?: ReactNode;
  className?: string;
  sortable?: boolean;
  sortDir?: 'asc' | 'desc' | null;
  onSort?: () => void;
  align?: 'left' | 'right' | 'center';
}

export function GlassTH({
  children,
  className = '',
  sortable = false,
  sortDir = null,
  onSort,
  align = 'left',
  ...rest
}: GlassTHProps & ExtraProps) {
  const SortIcon = () => (
    <svg
      className={[
        'w-3.5 h-3.5 flex-shrink-0 transition-colors duration-[var(--duration-fast)]',
        sortDir ? 'text-[var(--primary)]' : 'text-[var(--text-tertiary)]',
      ].join(' ')}
      viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden
    >
      {sortDir === 'asc' ? (
        <path d="M8 12V4m-4 4 4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
      ) : sortDir === 'desc' ? (
        <path d="M8 4v8m-4-4 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M5 6l3-3 3 3M11 10l-3 3-3-3" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );

  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

  return (
    <th
      className={[
        'px-4 py-3',
        'text-[var(--text-overline)] font-semibold tracking-[0.05em] uppercase',
        'text-[var(--text-tertiary)]',
        'border-b border-[var(--border-subtle)]',
        'whitespace-nowrap',
        alignClass,
        sortable ? 'cursor-pointer select-none hover:text-[var(--text-secondary)] group' : '',
        className,
      ].join(' ')}
      onClick={sortable ? onSort : undefined}
      aria-sort={sortDir === 'asc' ? 'ascending' : sortDir === 'desc' ? 'descending' : sortable ? 'none' : undefined}
      {...(rest as object)}
    >
      <span className="inline-flex items-center gap-1.5">
        {children}
        {sortable && <SortIcon />}
      </span>
    </th>
  );
}

export function GlassTBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-[var(--border-subtle)]">{children}</tbody>;
}

export function GlassTR({
  children,
  onClick,
  className = '',
  ...rest
}: GlassTableProps & ExtraProps) {
  return (
    <tr
      className={[
        'transition-colors duration-[var(--duration-fast)] [transition-timing-function:var(--ease-standard)]',
        'hover:bg-[var(--state-hover)]',
        onClick ? 'cursor-pointer' : '',
        rest['aria-selected'] ? 'bg-[var(--state-active)]' : '',
        className,
      ].join(' ')}
      onClick={onClick}
      {...(rest as object)}
    >
      {children}
    </tr>
  );
}

export function GlassTD({
  children,
  className = '',
  align,
  ...rest
}: GlassTableProps & ExtraProps & { align?: 'left' | 'right' | 'center' }) {
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : '';
  return (
    <td
      className={[
        'px-4 py-3.5',
        'text-[var(--text-body)] text-[var(--text-primary)]',
        'align-middle',
        alignClass,
        className,
      ].join(' ')}
      {...(rest as object)}
    >
      {children}
    </td>
  );
}

/* ── Skeleton Loading Rows ──────────────────────────────────── */
function SkeletonCell({ width = 'w-full' }: { width?: string }) {
  return (
    <td className="px-4 py-3.5 align-middle">
      <div className={['h-4 rounded-[var(--radius-sm)] skeleton-shimmer', width].join(' ')} />
    </td>
  );
}

export function GlassTableSkeleton({
  rows = 5,
  columns = 5,
}: {
  rows?: number;
  columns?: number;
}) {
  const widths = ['w-32', 'w-24', 'w-40', 'w-20', 'w-28'];
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r} className="border-b border-[var(--border-subtle)] last:border-0">
          {Array.from({ length: columns }, (_, c) => (
            <SkeletonCell key={c} width={widths[c % widths.length]} />
          ))}
        </tr>
      ))}
    </>
  );
}

export default GlassTable;
