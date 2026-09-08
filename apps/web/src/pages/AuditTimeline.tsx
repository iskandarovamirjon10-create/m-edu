import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader, Badge, PageLoader, ErrorState, EmptyState, Table, THead, TBody, TR, TH, TD, Pagination, TextInput, Select } from '@/components/ui';
import { usePageTitle } from '@/hooks/usePageTitle';

import type { Paginated, SystemAuditEvent } from '@/lib/types';

/**
 * Global Audit Timeline — rule-based, deterministic (NO AI).
 * Uses the AuditLog model via the backend audit endpoint.
 */

const EVENT_TYPE_FILTERS = [
  { value: '', label: 'All actions' },
  { value: 'LOGIN', label: 'Login' },
  { value: 'CREATE', label: 'Create' },
  { value: 'UPDATE', label: 'Update' },
  { value: 'DELETE', label: 'Delete' },
  { value: 'EXPORT', label: 'Export' },
  { value: 'IMPORT', label: 'Import' },
];

export function AuditTimelinePage() {
  usePageTitle('Audit Timeline');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [limit] = useState(20);

  const params = useMemo(() => ({
    page,
    limit,
    action: action || undefined,
    search: search || undefined,
  }), [page, limit, action, search]);

  const auditQuery = useQuery({
    queryKey: ['audit-timeline', params],
    queryFn: async () => {
      // Use the new audit endpoint (rule-based, no AI)
      const res = await fetch(`/api/audit?${new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit),
        ...(params.action && { action: params.action }),
        ...(params.search && { search: params.search }),
      })}`);
      if (!res.ok) throw new Error('Failed to load audit timeline');
      return res.json() as Promise<Paginated<SystemAuditEvent>>;
    },
    placeholderData: (prev) => prev,
  });

  const data = auditQuery.data;

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  }, []);

  const handleActionChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setAction(e.target.value);
    setPage(1);
  }, []);

  const formatAction = (a: string) => a.toLowerCase().replace(/_/g, ' ');

  const statusColor = (action: string) => {
    if (action === 'CREATE') return 'success';
    if (action === 'UPDATE') return 'warning';
    if (action === 'DELETE') return 'error';
    if (action === 'LOGIN') return 'primary';
    return 'muted';
  };

  return (
    <div className="orb-container">
      <div className="orb orb-cyan-1" />
      <div className="orb orb-cyan-2" />
      <div className="orb orb-indigo-1" />
      <div className="page-container space-y-4">
        <PageHeader
          title="Audit Timeline"
          subtitle="Every meaningful change across the platform — rule-based, explainable, no AI"
        />

        {/* Filters */}
        <div className="glass-card p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:flex-1">
              <TextInput
                placeholder="Search events, descriptions, resources…"
                aria-label="Search audit timeline"
                value={search}
                onChange={handleSearchChange}
                type="search"
              />
              <Select
                value={action}
                onChange={handleActionChange}
                aria-label="Filter by action"
              >
                {EVENT_TYPE_FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </Select>
            </div>
            <div className="text-sm text-muted sm:ml-4 sm:shrink-0">
              {data ? `${data.total} events` : '—'}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="glass-card overflow-hidden">
          {auditQuery.isLoading && !data ? (
            <div className="p-8"><PageLoader label="Loading audit timeline…" /></div>
          ) : auditQuery.isError ? (
            <div className="p-8"><ErrorState title="Failed to load audit timeline" message={auditQuery.error instanceof Error ? auditQuery.error.message : 'Unknown error'} /></div>
          ) : (!data || data.items.length === 0) ? (
            <EmptyState
              title={search || action ? 'No matching events' : 'No audit events yet'}
              message={search || action ? 'Adjust filters to see results.' : 'Platform changes will appear here as they occur.'}
            />
          ) : (
            <>
              <div className="glass-table-wrap">
                <Table>
                  <THead>
                    <TR>
                      <TH>Time</TH>
                      <TH>Action</TH>
                      <TH>Resource</TH>
                      <TH>Actor</TH>
                      <TH>Details</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {data.items.map((item) => (
                      <TR key={item.id} className="group hover:bg-[rgba(148,234,239,0.06)] transition-colors">
                        <TD className="whitespace-nowrap font-mono text-xs text-muted">
                          {new Date(item.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </TD>
                        <TD>
                          <Badge color={statusColor(item.action)}>
                            {formatAction(item.action || '')}
                          </Badge>
                        </TD>
                        <TD className="text-xs text-muted font-medium">
                          {item.entityType}
                          {item.entityId ? ` · ${String(item.entityId).slice(0, 8)}` : ''}
                        </TD>
                        <TD className="whitespace-nowrap text-sm">
                          {item.actorName || 'System'}
                        </TD>
                        <TD className="max-w-xs truncate text-xs text-muted" title={item.description}>
                          {item.description}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
              <div className="border-t border-subtle px-4 py-3">
                <Pagination
                  page={page}
                  totalPages={data.totalPages}
                  onPageChange={setPage}
                />
              </div>
            </>
          )}
        </div>

        {/* Note: this page uses the existing AuditLog model (line 1440 of schema.prisma).
            It is fully rule-based: every event comes from the database, no LLM / AI / prediction. */}
      </div>
    </div>
  );
}
