import { useMemo } from 'react';

interface GlassPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}

export function GlassPagination({ page, totalPages, onPageChange }: GlassPaginationProps) {
  const pageNumbers = useMemo(() => {
    const pages: (number | '...')[] = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
      if (page < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  }, [page, totalPages]);

  if (totalPages <= 1) return null;

  return (
    <nav className="mt-6 flex items-center justify-between" aria-label="Pagination">
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Page {page} of {totalPages}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
          style={{
            background: 'var(--bg-glass)',
            border: '1px solid var(--border-medium)',
            color: 'var(--text-primary)',
          }}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          Previous
        </button>
        <div className="hidden sm:flex items-center gap-1">
          {pageNumbers.map((pageNum, index) =>
            pageNum === '...' ? (
              <span key={`e-${index}`} className="px-2" style={{ color: 'var(--text-muted)' }}>…</span>
            ) : (
              <button
                key={pageNum}
                type="button"
                className="h-8 w-8 rounded-lg text-sm font-medium transition-all"
                style={
                  pageNum === page
                    ? {
                        background: 'var(--m-vivid)',
                        color: '#fff',
                        boxShadow: '0 2px 8px rgba(84,115,252,0.35)',
                      }
                    : {
                        color: 'var(--text-secondary)',
                      }
                }
                onClick={() => onPageChange(pageNum)}
                aria-label={`Page ${pageNum}`}
                aria-current={pageNum === page ? 'page' : undefined}
              >
                {pageNum}
              </button>
            ),
          )}
        </div>
        <button
          type="button"
          className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
          style={{
            background: 'var(--bg-glass)',
            border: '1px solid var(--border-medium)',
            color: 'var(--text-primary)',
          }}
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          Next
        </button>
      </div>
    </nav>
  );
}
