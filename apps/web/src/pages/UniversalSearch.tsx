import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, TextInput, EmptyState, GlassButton, Badge, PageLoader, ErrorState } from '@/components/ui';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useUniversalSearch } from '@/hooks/useUniversalSearch';
import { getErrorMessage } from '@/lib/errorMessages';
import { useI18n } from '@/i18n/I18nProvider';

const TYPE_BADGE: Record<string, { labelKey: string; color: 'success' | 'warning' | 'error' | 'primary' | 'muted' }> = {
  STUDENT: { labelKey: 'enum.badge.STUDENT', color: 'primary' },
  TEACHER: { labelKey: 'enum.badge.TEACHER', color: 'success' },
  GROUP: { labelKey: 'enum.badge.GROUP', color: 'warning' },
  COURSE: { labelKey: 'enum.badge.COURSE', color: 'primary' },
  LEAD: { labelKey: 'enum.badge.LEAD', color: 'warning' },
  PAYMENT: { labelKey: 'enum.badge.PAYMENT', color: 'success' },
  EMPLOYEE: { labelKey: 'enum.badge.EMPLOYEE', color: 'primary' },
  BOOK: { labelKey: 'enum.badge.BOOK', color: 'muted' },
  CERTIFICATE: { labelKey: 'enum.badge.CERTIFICATE', color: 'success' },
  USER: { labelKey: 'enum.badge.USER', color: 'muted' },
};

const TYPE_FILTERS = [
  { value: '', labelKey: 'enum.all' },
  { value: 'STUDENT', labelKey: 'enum.searchType.STUDENT' },
  { value: 'TEACHER', labelKey: 'enum.searchType.TEACHER' },
  { value: 'GROUP', labelKey: 'enum.searchType.GROUP' },
  { value: 'COURSE', labelKey: 'enum.searchType.COURSE' },
  { value: 'LEAD', labelKey: 'enum.searchType.LEAD' },
  { value: 'PAYMENT', labelKey: 'enum.searchType.PAYMENT' },
  { value: 'BOOK', labelKey: 'enum.searchType.BOOK' },
  { value: 'CERTIFICATE', labelKey: 'enum.searchType.CERTIFICATE' },
];

export function UniversalSearchPage() {
  const { t } = useI18n();
  usePageTitle(t('search.title'));
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { results, loading, error, runSearch } = useUniversalSearch(query, typeFilter ? [typeFilter] : []);

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
    <div style={{ display: "contents" }}>
      <div className="orb orb-cyan-1" />
      <div className="orb orb-indigo-1" />
      <div className="page-container space-y-4">
        <PageHeader
          title={t('search.title')}
          subtitle={t('search.subtitle')}
        />

        <div className="glass-card p-4 space-y-3">
          <div className="relative">
            <TextInput
              ref={inputRef as unknown as React.Ref<HTMLInputElement>}
              type="search"
              placeholder={t('search.placeholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="text-lg py-3 pl-12"
              aria-label={t('search.placeholder')}
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
                {t(f.labelKey)}
              </GlassButton>
            ))}
          </div>
        </div>

        {query.length < 2 ? (
          <div className="glass-card p-12 text-center">
            <p className="text-muted text-sm">{t('search.typeMore')}</p>
          </div>
        ) : loading ? (
          <div className="glass-card p-8">
            <PageLoader label={t('search.searching')} />
          </div>
        ) : error ? (
          <div className="glass-card p-8">
            <ErrorState
              message={getErrorMessage(error)}
              onRetry={() => runSearch(query)}
            />
          </div>
        ) : results.results.length === 0 ? (
          <div className="glass-card p-8">
            <EmptyState
              title={t('search.noResults')}
              message={t('search.noResultsHint', { query })}
            />
          </div>
        ) : (
          <>
            <div className="text-sm text-muted px-1">
              {t('search.foundSummary', { n: results.total, ms: results.tookMs })}
            </div>
            {Object.entries(grouped).map(([type, items]) => {
              const meta = TYPE_BADGE[type] || { labelKey: '', color: 'muted' as const };
              return (
                <section key={type} className="glass-card overflow-hidden">
                  <header className="flex items-center justify-between px-4 py-3 border-b border-subtle">
                    <div className="flex items-center gap-2">
                      <Badge color={meta.color}>{meta.labelKey ? t(meta.labelKey) : type}</Badge>
                      <span className="text-xs text-muted">{t('search.matchCount', { n: items.length })}</span>
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
                              {item.title || t('search.untitled')}
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
