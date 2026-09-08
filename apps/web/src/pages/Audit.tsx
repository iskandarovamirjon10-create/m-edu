import { useMemo, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { faceApi } from '@/lib/api';
import {
  PageHeader,
  Badge,
  PageLoader,
  ErrorState,
  EmptyState,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  Pagination,
  TextInput,
  Select,
  statusColor,
} from '@/components/ui';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDateTime } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, FaceAuditEvent, AuditEventType } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';

const AUDIT_EVENT_TYPES: { value: AuditEventType; label: string }[] = [
  { value: 'FACE_ENROLLMENT_CREATED', label: 'Enrollment created' },
  { value: 'FACE_ENROLLMENT_REVOKED', label: 'Enrollment revoked' },
  { value: 'FACE_RECOGNITION_ATTEMPTED', label: 'Recognition attempted' },
  { value: 'FACE_RECOGNITION_CONFIRMED', label: 'Recognition confirmed' },
  { value: 'FACE_RECOGNITION_REJECTED', label: 'Recognition rejected' },
  { value: 'LIVENESS_FAILED', label: 'Liveness failed' },
  { value: 'DEVICE_REGISTERED', label: 'Device registered' },
  { value: 'DEVICE_ACTIVATED', label: 'Device activated' },
];

interface AuditFilters {
  page: number;
  limit: number;
  type?: AuditEventType;
  search?: string;
}

function formatEventType(type: string): string {
  return type
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function truncateResourceId(id: string, maxLength = 8): string {
  return id.length > maxLength ? `${id.slice(0, maxLength)}…` : id;
}

function formatActorName(event: FaceAuditEvent): string {
  if (!event.user) return '—';
  const { firstName, lastName } = event.user;
  return [firstName, lastName].filter(Boolean).join(' ') || '—';
}

export function AuditPage() {
  usePageTitle('Audit Log');
  const [page, setPage] = useState(1);
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const [limit] = useState(20);
  const debouncedSearch = useDebounce(search, 300);

  const params = useMemo<AuditFilters>(
    () => ({
      page,
      limit,
      type: (type as AuditEventType) || undefined,
      search: debouncedSearch || undefined,
    }),
    [page, debouncedSearch, type, limit],
  );

  const audit = useQuery({
    queryKey: ['audit', params],
    queryFn: () => faceApi.auditLog(params),
    placeholderData: (previousData) => previousData,
  });

  const data = audit.data as Paginated<FaceAuditEvent> | undefined;

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value);
      setPage(1);
    },
    [],
  );

  const handleTypeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setType(e.target.value);
      setPage(1);
    },
    [],
  );

  const { refetch: refetchAudit } = audit;
  const handleRetry = useCallback(() => {
    void refetchAudit();
  }, [refetchAudit]);

  const hasActiveFilters = Boolean(search || type);
  const totalEvents = data?.total || 0;

  // Early return for loading state (only when no data is available)
  if (audit.isLoading && !data) {
    return (
      <div className="orb-container">
        <div className="page-container space-y-4">
          <PageHeader
            title="Audit Log"
            subtitle="Security-sensitive operations across the platform"
          />
          <div className="glass-card p-8">
            <PageLoader label="Loading audit events…" />
          </div>
        </div>
      </div>
    );
  }

  // Early return for error state
  if (audit.isError) {
    return (
      <div className="orb-container">
        <div className="page-container space-y-4">
          <PageHeader
            title="Audit Log"
            subtitle="Security-sensitive operations across the platform"
          />
          <div className="glass-card p-8">
            <ErrorState
              title="Failed to load audit log"
              message={getErrorMessage(audit.error as Error)}
              onRetry={handleRetry}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="orb-container">
      <div className="orb orb-cyan-1"></div>
      <div className="orb orb-cyan-2"></div>
      <div className="orb orb-indigo-1"></div>
      <div className="orb orb-deep-1"></div>
    <div className="page-container space-y-4">
      <PageHeader
        title="Audit Log"
        subtitle="Security-sensitive operations across the platform"
      />

      {/* Filters */}
      <div className="glass-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:flex-1">
            <TextInput
              placeholder="Search by description, type or resource…"
              aria-label="Search audit log"
              value={search}
              onChange={handleSearchChange}
              type="search"
            />
            <Select
              value={type}
              onChange={handleTypeChange}
              aria-label="Filter by event type"
            >
              <option value="">All event types</option>
              {AUDIT_EVENT_TYPES.map((eventType) => (
                <option key={eventType.value} value={eventType.value}>
                  {eventType.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="text-sm text-muted sm:ml-4 sm:shrink-0">
            {totalEvents} {totalEvents === 1 ? 'event' : 'events'}
          </div>
        </div>
      </div>

      {/* Audit table */}
      <div className="glass-card overflow-hidden">
        {!data || data.items.length === 0 ? (
          <EmptyState
            title={hasActiveFilters ? 'No matching events' : 'No audit events'}
            message={
              hasActiveFilters
                ? 'Try adjusting your filters to see more results.'
                : 'Security-sensitive operations will be recorded here.'
            }
          />
        ) : (
          <>
            <div className="glass-table-wrap">
              <Table>
                <THead>
                  <TR>
                    <TH>Time</TH>
                    <TH>Event</TH>
                    <TH>Resource</TH>
                    <TH>Description</TH>
                    <TH>Actor</TH>
                  </TR>
                </THead>
                <TBody>
                  {data.items.map((event) => (
                    <TR
                      key={event.id}
                    >
                      <TD className="whitespace-nowrap">
                        {formatDateTime(event.createdAt)}
                      </TD>
                      <TD>
                        <Badge color={statusColor(event.type)}>
                          {formatEventType(event.type)}
                        </Badge>
                      </TD>
                      <TD className="text-xs text-muted">
                        {event.resourceType}
                        {event.resourceId
                          ? ` · ${truncateResourceId(event.resourceId)}`
                          : ''}
                      </TD>
                      <TD
                        className="max-w-xs truncate"
                        title={event.description}
                      >
                        {event.description}
                      </TD>
                      <TD className="whitespace-nowrap">
                        {formatActorName(event)}
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
    </div>
    </div>
  );
}