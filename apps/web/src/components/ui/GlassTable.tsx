/**
 * GlassTable — clean Apple-premium table.
 *
 * Card shell (card token + hairline border), row hover, sticky header,
 * sortable `GlassTH` with `aria-sort`, and a `density` prop that really
 * changes cell padding (delivered through context to TH/TD/skeleton).
 */
import {
  Children,
  Fragment,
  createContext,
  isValidElement,
  useContext,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { Shimmer, cn } from '@/lib/design';

/* ─────────────────────────────────────────────────────────────
 * Public types
 * ───────────────────────────────────────────────────────────── */

export type TableDensity = 'comfortable' | 'compact';

export interface GlassTableProps {
  children: ReactNode;
  className?: string;
  /** Enable sticky table header. */
  stickyHeader?: boolean;
  /**
   * Minimum width before the table scrolls horizontally.
   * Scrolling happens INSIDE the component; the page never scrolls sideways.
   */
  minWidth?: number | string;
  /** Hide below `md` (for pages that render their own mobile card list). */
  hideOnMobile?: boolean;
  /** Row padding density — compact reduces it. */
  density?: TableDensity;
  /** @deprecated no-op — the shell no longer renders an SVG filter. */
  disableRefraction?: boolean;
  /** @deprecated no-op — rows only use CSS color transitions now. */
  disableMotion?: boolean;
}

interface ExtraProps {
  style?: CSSProperties;
  title?: string;
  onClick?: (e: MouseEvent) => void;
  onKeyDown?: (e: KeyboardEvent) => void;
  tabIndex?: number;
  role?: string;
  'aria-label'?: string;
  'aria-selected'?: boolean;
  'aria-sort'?: 'ascending' | 'descending' | 'none';
  colSpan?: number;
}

/* ─────────────────────────────────────────────────────────────
 * Density — context so cells react to the shell's density prop
 * ───────────────────────────────────────────────────────────── */

const DensityContext = createContext<TableDensity>('comfortable');

const CELL_PADDING: Record<TableDensity, string> = {
  comfortable: 'px-4 py-3',
  compact: 'px-3 py-2',
};

const HEAD_PADDING: Record<TableDensity, string> = {
  comfortable: 'px-4 py-2.5',
  compact: 'px-3 py-2',
};

/* ─────────────────────────────────────────────────────────────
 * GlassTable — shell
 * ───────────────────────────────────────────────────────────── */

export function GlassTable({
  children,
  className = '',
  stickyHeader = false,
  minWidth = 500,
  hideOnMobile = false,
  density = 'comfortable',
}: GlassTableProps) {
  const resolvedMinWidth = typeof minWidth === 'number' ? `${minWidth}px` : minWidth;

  return (
    <DensityContext.Provider value={density}>
      <div
        data-component="glass-table"
        data-density={density}
        className={cn(
          'min-w-0 max-w-full overflow-hidden rounded-2xl border border-black/[0.06] dark:border-white/[0.08]',
          'bg-white/80 dark:bg-surface-900/80 backdrop-blur-xl backdrop-saturate-150 shadow-card shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]',
          hideOnMobile && 'hidden md:block',
          className,
        )}
      >
        {/* Scroller — horizontal scroll stays inside the card. */}
        <div
          className={cn(
            'overflow-x-auto overscroll-contain',
            stickyHeader && 'overflow-y-auto max-h-[min(600px,70dvh)]',
          )}
        >
          <table
            className="w-full border-separate border-spacing-0 text-left align-middle"
            style={{ minWidth: resolvedMinWidth }}
          >
            {children}
          </table>
        </div>
      </div>
    </DensityContext.Provider>
  );
}

/* ─────────────────────────────────────────────────────────────
 * GlassTHead — sniffs its row child (robust to arrays/fragments)
 * ───────────────────────────────────────────────────────────── */

function flattenChildren(nodes: ReactNode[]): ReactNode[] {
  return nodes.flatMap((node) => {
    if (Array.isArray(node)) return flattenChildren(node);
    if (isValidElement(node) && node.type === Fragment) {
      return flattenChildren(Children.toArray((node.props as { children?: ReactNode }).children));
    }
    return [node];
  });
}

function hasTableRows(nodes: ReactNode[]): boolean {
  const meaningful = nodes.filter(
    (node) => !(typeof node === 'string' && node.trim() === ''),
  );
  if (meaningful.length === 0) return true;
  return meaningful.every(
    (node) => isValidElement(node) && (node.type === GlassTR || node.type === 'tr'),
  );
}

export function GlassTHead({ children }: { children: ReactNode | ReactNode[] }) {
  const rowsAlreadyPresent = hasTableRows(flattenChildren(Children.toArray(children)));

  return (
    <thead className="sticky top-0 z-10 bg-white/90 dark:bg-surface-900/90 backdrop-blur-md backdrop-saturate-150 border-b border-black/[0.06] dark:border-white/[0.08]">
      {rowsAlreadyPresent ? children : <tr>{children}</tr>}
    </thead>
  );
}

/* ─────────────────────────────────────────────────────────────
 * GlassTH — sortable header cell
 * ───────────────────────────────────────────────────────────── */

export interface GlassTHProps {
  children?: ReactNode;
  className?: string;
  sortable?: boolean;
  sortDir?: 'asc' | 'desc' | null;
  onSort?: () => void;
  align?: 'left' | 'right' | 'center';
}

function SortIcon({ dir }: { dir: 'asc' | 'desc' | null }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {dir === 'asc' ? (
        <path d="M8 12V4m-4 4 4-4 4 4" />
      ) : dir === 'desc' ? (
        <path d="M8 4v8m-4-4 4 4 4-4" />
      ) : (
        <path d="M5 6l3-3 3 3M11 10l-3 3-3-3" />
      )}
    </svg>
  );
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
  const density = useContext(DensityContext);
  const alignClass =
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  const isActive = sortDir === 'asc' || sortDir === 'desc';

  const inner = sortable ? (
    <button
      type="button"
      onClick={onSort}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md',
        'transition-colors duration-150 hover:text-primary',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]',
        align === 'right' && 'flex-row-reverse',
      )}
    >
      <span>{children}</span>
      <SortIcon dir={sortDir} />
    </button>
  ) : (
    <span className={cn('inline-flex items-center gap-1.5', align === 'right' && 'flex-row-reverse')}>
      {children}
    </span>
  );

  return (
    <th
      scope="col"
      className={cn(
        'whitespace-nowrap border-b border-black/[0.06] dark:border-white/[0.08] align-middle',
        'text-[11px] font-medium uppercase tracking-wide text-tertiary',
        HEAD_PADDING[density],
        alignClass,
        sortable && 'cursor-pointer select-none',
        isActive && 'text-primary',
        className,
      )}
      aria-sort={
        sortDir === 'asc'
          ? 'ascending'
          : sortDir === 'desc'
            ? 'descending'
            : sortable
              ? 'none'
              : undefined
      }
      {...rest}
      onClick={sortable ? undefined : rest.onClick}
    >
      {inner}
    </th>
  );
}

/* ─────────────────────────────────────────────────────────────
 * GlassTBody / GlassTR / GlassTD
 * ───────────────────────────────────────────────────────────── */

export function GlassTBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export interface GlassTRProps {
  children: ReactNode;
  className?: string;
}

export function GlassTR({
  children,
  onClick,
  className = '',
  ...rest
}: GlassTRProps & ExtraProps) {
  const selected = Boolean(rest['aria-selected']);

  return (
    <tr
      data-selected={selected ? 'true' : 'false'}
      className={cn(
        'border-b border-black/[0.04] dark:border-white/[0.06] transition-colors duration-150 last:border-b-0',
        'hover:bg-black/[0.02] dark:hover:bg-white/[0.03]',
        selected && 'bg-apple-blue/[0.07] hover:bg-apple-blue/[0.10] dark:bg-apple-blue/[0.12]',
        onClick && 'cursor-pointer',
        className,
      )}
      onClick={onClick}
      {...rest}
    >
      {children}
    </tr>
  );
}

export interface GlassTDProps {
  children?: ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
}

export function GlassTD({
  children,
  className = '',
  align,
  ...rest
}: GlassTDProps & ExtraProps) {
  const density = useContext(DensityContext);
  const alignClass =
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : '';

  return (
    <td
      className={cn('align-middle text-sm text-primary', CELL_PADDING[density], alignClass, className)}
      {...rest}
    >
      {children}
    </td>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Internal skeleton (kept exported for existing importers)
 * ───────────────────────────────────────────────────────────── */

const SKELETON_WIDTHS = ['70%', '55%', '85%', '45%', '60%'];

export function GlassTableSkeleton({
  rows = 5,
  columns = 5,
}: {
  rows?: number;
  columns?: number;
}) {
  const density = useContext(DensityContext);
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r} className="border-b border-subtle last:border-b-0">
          {Array.from({ length: columns }, (_, c) => (
            <td key={c} className={cn('border-b border-subtle', CELL_PADDING[density])}>
              <Shimmer
                height={12}
                rounded="6px"
                width={SKELETON_WIDTHS[c % SKELETON_WIDTHS.length]}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export default GlassTable;
