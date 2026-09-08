/**
 * GlassTable — Glass morphism table wrapper.
 */
import { type ReactNode, type CSSProperties, type KeyboardEvent } from 'react';

/** Extra props tolerated for backwards compatibility with legacy pages. */
interface ExtraProps {
  style?: CSSProperties;
  title?: string;
  onClick?: (e: React.MouseEvent) => void;
  onKeyDown?: (e: KeyboardEvent) => void;
  tabIndex?: number;
  role?: string;
  'aria-label'?: string;
}

interface GlassTableProps {
  children: ReactNode;
  className?: string;
}

export function GlassTable({ children, className = '' }: GlassTableProps) {
  return (
    <div className={[
      'bg-[var(--bg-glass)]',
      'backdrop-blur-2xl backdrop-saturate-[1.4]',
      'border border-[var(--border-subtle)]',
      'rounded-2xl',
      'overflow-hidden',
      'shadow-[var(--shadow-sm)]',
      className,
    ].join(' ')}>
      <table className="w-full border-collapse">
        {children}
      </table>
    </div>
  );
}

export function GlassTHead({ children }: { children: ReactNode | ReactNode[] }) {
  return (
    <thead className="bg-[rgba(20,30,45,0.04)]">
      <tr>{children as never}</tr>
    </thead>
  );
}

export function GlassTH({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return (
    <th className={[
      'px-4 py-3 text-left text-[0.8125rem] font-semibold tracking-[0.03em] uppercase',
      'text-[var(--text-muted)]',
      'whitespace-nowrap',
      'border-b border-[var(--border-subtle)]',
      className,
    ].join(' ')}>
      {children}
    </th>
  );
}

export function GlassTBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
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
        'border-b border-[var(--border-subtle)] last:border-b-0',
        'transition-colors duration-150',
        'hover:bg-[rgba(148,234,239,0.05)]',
        onClick ? 'cursor-pointer' : '',
        className,
      ].join(' ')}
      onClick={onClick}
      {...(rest as object)}
    >
      {children}
    </tr>
  );
}

export function GlassTD({ children, className = '', ...rest }: GlassTableProps & ExtraProps) {
  return (
    <td
      className={[
        'px-4 py-3 text-[0.9375rem] text-[var(--text-primary)]',
        'align-middle',
        className,
      ].join(' ')}
      {...(rest as object)}
    >
      {children}
    </td>
  );
}

export default GlassTable;
