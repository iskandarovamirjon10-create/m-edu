import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, TextInput, EmptyState, GlassButton, Badge, PageLoader } from '@/components/ui';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useUniversalSearch } from '@/hooks/useUniversalSearch';

const TYPE_BADGE: Record<string, { label: string; color: 'success' | 'warning' | 'error' | 'primary' | 'muted' }> = {
  STUDENT: { label: 'Student', color: 'primary' },
  TEACHER: { label: 'Teacher', color: 'success' },
  GROUP: { label: 'Group', color: 'warning' },
  COURSE: { label: 'Course', color: 'primary' },
  LEAD: { label: 'Lead', color: 'warning' },
  PAYMENT: { label: 'Payment', color: 'success' },
  EMPLOYEE: { label: 'Employee', color: 'primary' },
  BOOK: { label: 'Book', color: 'muted' },
  CERTIFICATE: { label: 'Certificate', color: 'success' },
  USER: { label: 'User', color: 'muted' },
};

const TYPE_FILTERS = [
  { value: '', label: 'All' },
  { value: 'STUDENT', label: 'Students' },
  { value: 'TEACHER', label: 'Teachers' },
  { value: 'GROUP', label: 'Groups' },
  { value: 'COURSE', label: 'Courses' },
  { value: 'LEAD', label: 'Leads' },
  { value: 'PAYMENT', label: 'Payments' },
  { value: 'BOOK', label: 'Books' },
  { value: 'CERTIFICATE', label: 'Certificates' },
];

export function UniversalSearchPage() {
  usePageTitle('Search');
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { results, loading, runSearch } = useUniversalSearch(query, typeFilter ? [typeFilter] : []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (query.length >= 2) runSearch(query);
      else if (query.length === 0) {
        // reset
        runSearch('');
      }
    }, 250);
    return () => clearTimeout(timeout);
  }, [query, runSearch]);

  const handleResultClick = useCallback((href: string) => {
    navigate(href);
  }, [navigate]);

  const grouped = useMemo(() => {
    const map: Record<string, typeof results.results> = {};
    results.results.forEach(r => {
      (map[r.type] ||= []).push(r);
    });
    return map;
  }, [results.results]);

  return (
    <div className="orb-container">
      <div className="orb orb-cyan-1" />
      <div className="orb orb-indigo-1" />
      <div className="page-container space-y-4">
        <PageHeader
          title="Universal Search"
          subtitle="Find any record across the platform — students, teachers, groups, courses, payments, books, certificates, and more"
        />

        <div className="glass-card p-4 space-y-3">
          <div className="relative">
            <TextInput
              ref={inputRef as unknown as React.Ref<HTMLInputElement>}
              type="search"
              placeholder="Search for anyone or anything…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="text-lg py-3 pl-12"
              aria-label="Search query"
            />
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <div className="flex flex-wrap gap-2">
            {TYPE_FILTERS.map(f => (
              <GlassButton
                key={f.value}
                size="sm"
                variant={typeFilter === f.value ? 'primary' : 'ghost'}
                onClick={() => setTypeFilter(f.value)}
              >
                {f.label}
              </GlassButton>
            ))}
          </div>
        </div>

        {query.length < 2 ? (
          <div className="glass-card p-12 text-center">
            <p className="text-muted text-sm">Type at least 2 characters to start searching.</p>
          </div>
        ) : loading ? (
          <div className="glass-card p-8">
            <PageLoader label="Searching…" />
          </div>
        ) : results.results.length === 0 ? (
          <div className="glass-card p-8">
            <EmptyState
              title="No results"
              message={`No matches for "${query}". Try fewer words or a different filter.`}
            />
          </div>
        ) : (
          <>
            <div className="text-sm text-muted px-1">
              Found <strong className="text-[var(--text-primary)]">{results.total}</strong> results
              in <span className="font-mono">{results.tookMs}ms</span>
            </div>
            {Object.entries(grouped).map(([type, items]) => {
              const meta = TYPE_BADGE[type] || { label: type, color: 'muted' as const };
              return (
                <section key={type} className="glass-card overflow-hidden">
                  <header className="flex items-center justify-between px-4 py-3 border-b border-subtle">
                    <div className="flex items-center gap-2">
                      <Badge color={meta.color}>{meta.label}</Badge>
                      <span className="text-xs text-muted">{items.length} match{items.length === 1 ? '' : 'es'}</span>
                    </div>
                  </header>
                  <ul className="divide-y divide-[var(--border-subtle)]">
                    {items.map((item) => (
                      <li
                        key={`${type}-${item.id}`}
                        className="px-4 py-3 cursor-pointer hover:bg-[rgba(148,234,239,0.06)] transition-colors"
                        onClick={() => handleResultClick(item.href)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-medium text-sm text-[var(--text-primary)] truncate">
                              {item.title || 'Untitled'}
                            </h3>
                            {item.subtitle && (
                              <p className="text-xs text-muted mt-0.5 truncate">{item.subtitle}</p>
                            )}
                          </div>
                          <div className="text-xs text-muted font-mono whitespace-nowrap">
                            {item.relevanceScore}%
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
