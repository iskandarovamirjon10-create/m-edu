import { useMemo } from 'react';
import { useSafeI18n } from '@/i18n/I18nProvider';

interface GlassPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  /** Show total items count */
  totalItems?: number;
}

const NavBtn = ({
  onClick,
  disabled,
  ariaLabel,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  ariaLabel: string;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    className={[
      'flex items-center gap-1.5 px-3.5 py-1.5',
      'text-[var(--text-body-sm)] font-medium',
      'bg-[var(--bg-glass)] border border-[var(--border-medium)]',
      'rounded-[var(--radius-md)]',
      'text-[var(--text-primary)]',
      'transition-[background-color,border-color,opacity]',
      'duration-[var(--duration-fast)] [transition-timing-function:var(--ease-standard)]',
      'hover:bg-[var(--bg-glass-hover)] hover:border-[var(--border-strong)]',
      'focus-visible:outline-2 focus-visible:outline-[var(--border-focus)]',
      'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
    ].join(' ')}
    onClick={onClick}
    disabled={disabled}
    aria-label={ariaLabel}
  >
    {children}
  </button>
);

const ChevronLeft = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m15 18-6-6 6-6" />
  </svg>
);

const ChevronRight = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m9 18 6-6-6-6" />
  </svg>
);

export function GlassPagination({
  page,
  totalPages,
  onPageChange,
  totalItems,
}: GlassPaginationProps) {
  const { t } = useSafeI18n();

  const pageNumbers = useMemo(() => {
    const pages: (number | '...')[] = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
        pages.push(i);
      }
      if (page < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  }, [page, totalPages]);

  if (totalPages <= 1) return null;

  return (
    <nav
      className="flex items-center justify-between gap-4 mt-6 flex-wrap"
      aria-label={t('a11y.pagination')}
    >
      {/* Page info */}
      <p className="text-[var(--text-caption)] text-[var(--text-tertiary)]">
        {totalItems != null
          ? `${totalItems} results — page ${page} of ${totalPages}`
          : `${t('common.page')} ${page} ${t('common.of')} ${totalPages}`
        }
      </p>

      <div className="flex items-center gap-2">
        <NavBtn
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          ariaLabel={t('a11y.prevPage')}
        >
          <ChevronLeft />
          <span>{t('common.previous')}</span>
        </NavBtn>

        <div className="hidden sm:flex items-center gap-1">
          {pageNumbers.map((pageNum, index) =>
            pageNum === '...' ? (
              <span
                key={`e-${index}`}
                className="w-8 text-center text-[var(--text-tertiary)] text-[var(--text-body-sm)]"
              >
                …
              </span>
            ) : (
              <button
                key={pageNum}
                type="button"
                className={[
                  'h-8 w-8 rounded-[var(--radius-md)] text-[var(--text-body-sm)] font-medium',
                  'transition-[background-color,color,box-shadow] duration-[var(--duration-fast)]',
                  'focus-visible:outline-2 focus-visible:outline-[var(--border-focus)]',
                  pageNum === page
                    ? 'bg-[var(--primary)] text-white shadow-[0_2px_8px_rgba(79,70,229,0.30)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--state-hover)] hover:text-[var(--text-primary)]',
                ].join(' ')}
                onClick={() => onPageChange(pageNum)}
                aria-label={`Page ${pageNum}`}
                aria-current={pageNum === page ? 'page' : undefined}
              >
                {pageNum}
              </button>
            ),
          )}
        </div>

        <NavBtn
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          ariaLabel={t('a11y.nextPage')}
        >
          <span>{t('common.next')}</span>
          <ChevronRight />
        </NavBtn>
      </div>
    </nav>
  );
}

export default GlassPagination;
