/**
 * GlassPagination — compact Apple-premium pager.
 *
 * Pill buttons (`h-8 min-w-8 rounded-lg`), active page filled with the brand
 * color, `aria-current="page"`, labelled prev/next controls and localized
 * screen-reader strings (English literal where no locale key exists).
 */
import { useMemo, type ReactNode } from 'react';
import { Icon, cn } from '@/lib/design';
import { useSafeI18n } from '@/i18n/I18nProvider';

/* ─────────────────────────────────────────────────────────────
 * Public types
 * ───────────────────────────────────────────────────────────── */

export type PaginationSize = 'sm' | 'md' | 'lg';

export interface GlassPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  /** Show total items count. */
  totalItems?: number;
  size?: PaginationSize;
  /** Max visible page numbers before ellipsis kicks in. */
  maxVisible?: number;
  /** @deprecated no-op — controls no longer render an SVG filter. */
  disableRefraction?: boolean;
  className?: string;
}

/* ─────────────────────────────────────────────────────────────
 * Size tokens
 * ───────────────────────────────────────────────────────────── */

const PILL_CLASS: Record<PaginationSize, string> = {
  sm: 'h-7 min-w-7 gap-1 px-2 text-xs',
  md: 'h-8 min-w-8 gap-1.5 px-2.5 text-xs',
  lg: 'h-9 min-w-9 gap-1.5 px-3 text-sm',
};

const SQUARE_CLASS: Record<PaginationSize, string> = {
  sm: 'h-7 w-7 text-xs',
  md: 'h-8 w-8 text-xs',
  lg: 'h-9 w-9 text-sm',
};

const SHELL_CLASS: Record<PaginationSize, string> = {
  sm: 'gap-1',
  md: 'gap-1.5',
  lg: 'gap-2',
};

/* ─────────────────────────────────────────────────────────────
 * Chip — shared button shell
 * ───────────────────────────────────────────────────────────── */

interface ChipProps {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  ariaLabel: string;
  ariaCurrent?: 'page' | undefined;
  size: PaginationSize;
  shape: 'pill' | 'square';
}

function PageChip({
  children,
  onClick,
  disabled,
  active,
  ariaLabel,
  ariaCurrent,
  size,
  shape,
}: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-current={ariaCurrent}
      className={cn(
        'inline-flex select-none items-center justify-center rounded-lg font-medium',
        'transition-colors duration-150 active:scale-[0.98]',
        'focus-visible:outline-2 focus-visible:outline-offset-2',
        'focus-visible:outline-[var(--border-focus)]',
        'disabled:cursor-not-allowed disabled:opacity-40',
        shape === 'square' ? SQUARE_CLASS[size] : PILL_CLASS[size],
        active
          ? 'bg-apple-blue text-white shadow-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] hover:bg-apple-blue/90'
          : 'bg-white/60 dark:bg-white/[0.06] backdrop-blur-md border border-black/[0.04] dark:border-white/[0.06] text-secondary hover:bg-white/90 hover:text-primary ' +
            'dark:hover:bg-white/[0.12]',
      )}
    >
      {children}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
 * GlassPagination
 * ───────────────────────────────────────────────────────────── */

export function GlassPagination({
  page,
  totalPages,
  onPageChange,
  totalItems,
  size = 'md',
  maxVisible = 5,
  className,
}: GlassPaginationProps) {
  const { t } = useSafeI18n();
  const safeTotalPages = Number.isFinite(totalPages) && totalPages > 0 ? Math.floor(totalPages) : 1;
  const safePage = Number.isFinite(page) && page > 0 ? Math.min(Math.floor(page), safeTotalPages) : 1;

  const pageNumbers = useMemo(() => {
    const pages: (number | '...')[] = [];
    if (safeTotalPages <= maxVisible) {
      for (let i = 1; i <= safeTotalPages; i += 1) pages.push(i);
    } else {
      pages.push(1);
      if (safePage > 3) pages.push('...');
      for (
        let i = Math.max(2, safePage - 1);
        i <= Math.min(safeTotalPages - 1, safePage + 1);
        i += 1
      ) {
        pages.push(i);
      }
      if (safePage < safeTotalPages - 2) pages.push('...');
      pages.push(safeTotalPages);
    }
    return pages;
  }, [safePage, safeTotalPages, maxVisible]);

  if (safeTotalPages <= 1) return null;

  const canPrev = safePage > 1;
  const canNext = safePage < safeTotalPages;
  const pageWord = t('common.page', 'Page');

  // No `common.results` locale key exists yet → English literal fallback.
  const summary =
    totalItems != null
      ? `${totalItems} results — page ${safePage} of ${safeTotalPages}`
      : `${pageWord} ${safePage} ${t('common.of', 'of')} ${safeTotalPages}`;

  return (
    <nav
      data-component="glass-pagination"
      data-size={size}
      aria-label={t('a11y.pagination', 'Pagination')}
      className={cn('mt-6 flex flex-wrap items-center justify-between gap-4', className)}
    >
      <p className="text-xs text-tertiary">{summary}</p>

      <div className={cn('flex items-center', SHELL_CLASS[size])}>
        <PageChip
          shape="pill"
          size={size}
          onClick={() => onPageChange(safePage - 1)}
          disabled={!canPrev}
          ariaLabel={t('a11y.prevPage', 'Previous page')}
        >
          <Icon name="chevronLeft" size={16} />
          <span className="hidden sm:inline">{t('common.previous', 'Previous')}</span>
        </PageChip>

        {/* Page numbers */}
        <div className={cn('hidden items-center sm:flex', SHELL_CLASS[size])}>
          {pageNumbers.map((pageNum, index) =>
            pageNum === '...' ? (
              <span
                key={`ellipsis-${index}`}
                aria-hidden="true"
                className={cn(
                  'inline-flex items-center justify-center text-tertiary',
                  SQUARE_CLASS[size],
                )}
              >
                …
              </span>
            ) : (
              <PageChip
                key={`page-${pageNum}`}
                shape="square"
                size={size}
                active={pageNum === safePage}
                onClick={() => onPageChange(pageNum)}
                ariaLabel={`${pageWord} ${pageNum}`}
                ariaCurrent={pageNum === safePage ? 'page' : undefined}
              >
                {pageNum}
              </PageChip>
            ),
          )}
        </div>

        {/* Mobile page indicator */}
        <span className="text-xs font-medium text-secondary sm:hidden">
          {safePage} / {safeTotalPages}
        </span>

        <PageChip
          shape="pill"
          size={size}
          onClick={() => onPageChange(safePage + 1)}
          disabled={!canNext}
          ariaLabel={t('a11y.nextPage', 'Next page')}
        >
          <span className="hidden sm:inline">{t('common.next', 'Next')}</span>
          <Icon name="chevronRight" size={16} />
        </PageChip>
      </div>
    </nav>
  );
}

export default GlassPagination;
