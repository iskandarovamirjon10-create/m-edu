import { useMemo, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditApi } from '@/lib/api';
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
} from '@/components/ui';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDateTime } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, SystemAuditEvent, AuditAction } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';

// Reuse enum.action.* for the 6 exact-match actions; others use audit.action.*.
const ENUM_ACTION_SET = new Set<AuditAction>([
  'CREATE',
  'UPDATE',
  'DELETE',
  'LOGIN',
  'EXPORT',
  'IMPORT',
]);

const AUDIT_ACTIONS: { value: AuditAction; label: string }[] = [
  { value: 'CREATE', label: 'enum.action.CREATE' },
  { value: 'UPDATE', label: 'enum.action.UPDATE' },
  { value: 'DELETE', label: 'enum.action.DELETE' },
  { value: 'RESTORE', label: 'audit.action.RESTORE' },
  { value: 'LOGIN', label: 'enum.action.LOGIN' },
  { value: 'LOGOUT', label: 'audit.action.LOGOUT' },
  { value: 'LOGIN_FAILED', label: 'audit.action.LOGIN_FAILED' },
  { value: 'EXPORT', label: 'enum.action.EXPORT' },
  { value: 'IMPORT', label: 'enum.action.IMPORT' },
  { value: 'BULK_UPDATE', label: 'audit.action.BULK_UPDATE' },
  { value: 'PAYMENT_RECEIVED', label: 'audit.action.PAYMENT_RECEIVED' },
  { value: 'ENROLLMENT_CREATED', label: 'audit.action.ENROLLMENT_CREATED' },
  { value: 'ENROLLMENT_REVOKED', label: 'audit.action.ENROLLMENT_REVOKED' },
  { value: 'ATTENDANCE_RECORDED', label: 'audit.action.ATTENDANCE_RECORDED' },
  { value: 'GRADE_RECORDED', label: 'audit.action.GRADE_RECORDED' },
  { value: 'DOCUMENT_UPLOADED', label: 'audit.action.DOCUMENT_UPLOADED' },
  { value: 'DOCUMENT_DELETED', label: 'audit.action.DOCUMENT_DELETED' },
  { value: 'WORKFLOW_TRIGGERED', label: 'audit.action.WORKFLOW_TRIGGERED' },
  { value: 'WORKFLOW_COMPLETED', label: 'audit.action.WORKFLOW_COMPLETED' },
  { value: 'CUSTOM', label: 'audit.action.CUSTOM' },
];

interface AuditFilters {
  page: number;
  limit: number;
  action?: AuditAction;
  search?: string;
}

function actionKey(action: string): string {
  return ENUM_ACTION_SET.has(action as AuditAction)
    ? `enum.action.${action}`
    : `audit.action.${action}`;
}

function actionColor(action: string): 'success' | 'warning' | 'error' | 'primary' | 'slate' {
  if (action === 'CREATE') return 'success';
  if (action === 'UPDATE') return 'warning';
  if (action === 'DELETE') return 'error';
  if (action === 'LOGIN' || action === 'LOGOUT') return 'primary';
  if (action === 'LOGIN_FAILED') return 'error';
  return 'slate';
}

function truncateId(id: string | null | undefined, maxLength = 8): string {
  if (!id) return '';
  return id.length > maxLength ? `${id.slice(0, maxLength)}…` : id;
}

export function AuditPage() {
  const { t } = useI18n();
  usePageTitle(t('nav.audit'));
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [search, setSearch] = useState('');
  const [limit] = useState(20);
  const debouncedSearch = useDebounce(search, 300);

  const params = useMemo<AuditFilters>(
    () => ({
      page,
      limit,
      action: (action as AuditAction) || undefined,
      search: debouncedSearch || undefined,
    }),
    [page, debouncedSearch, action, limit],
  );

  const audit = useQuery({
    queryKey: ['audit', params],
    queryFn: () => auditApi.list(params),
    placeholderData: (previousData) => previousData,
  });

  const data = audit.data as Paginated<SystemAuditEvent> | undefined;

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value);
      setPage(1);
    },
    [],
  );

  const handleActionChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setAction(e.target.value);
      setPage(1);
    },
    [],
  );

  const { refetch: refetchAudit } = audit;
  const handleRetry = useCallback(() => {
    void refetchAudit();
  }, [refetchAudit]);

  const hasActiveFilters = Boolean(search || action);
  const totalEvents = data?.total || 0;

  // Early return for loading state (only when no data is available)
  if (audit.isLoading && !data) {
    return (
      <div style={{ display: "contents" }}>
        <div className="page-container space-y-4">
          <PageHeader
            title={t('nav.audit')}
            subtitle={t('audit.pageSubtitle')}
          />
          <div className="glass-card p-8">
            <PageLoader label={t('audit.loading')} />
          </div>
        </div>
      </div>
    );
  }

  // Early return for error state
  if (audit.isError) {
    return (
      <div style={{ display: "contents" }}>
        <div className="page-container space-y-4">
          <PageHeader
            title={t('nav.audit')}
            subtitle={t('audit.pageSubtitle')}
          />
          <div className="glass-card p-8">
            <ErrorState
              title={t('audit.loadError')}
              message={getErrorMessage(audit.error as Error)}
              onRetry={handleRetry}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "contents" }}>
      <div className="orb orb-cyan-1"></div>
      <div className="orb orb-cyan-2"></div>
      <div className="orb orb-indigo-1"></div>
      <div className="orb orb-deep-1"></div>
    <div className="page-container space-y-4">
      <PageHeader
        title={t('nav.audit')}
        subtitle={t('audit.pageSubtitle')}
      />

      {/* Filters */}
      <div className="glass-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:flex-1">
            <TextInput
              placeholder={t('audit.searchPlaceholder')}
              aria-label={t('audit.searchAria')}
              value={search}
              onChange={handleSearchChange}
              type="search"
            />
            <Select
              value={action}
              onChange={handleActionChange}
              aria-label={t('common.filterByAction')}
            >
              <option value="">{t('enum.allActions')}</option>
              {AUDIT_ACTIONS.map((auditAction) => (
                <option key={auditAction.value} value={auditAction.value}>
                  {t(auditAction.label)}
                </option>
              ))}
            </Select>
          </div>
          <div className="text-sm text-muted sm:ml-4 sm:shrink-0">
            {totalEvents === 1
              ? t('audit.countOne')
              : t('audit.countMany', { count: totalEvents })}
          </div>
        </div>
      </div>

      {/* Audit table */}
      <div className="glass-card overflow-hidden">
        {!data || data.items.length === 0 ? (
          <EmptyState
              title={t('audit.emptyTitle')}
              message={
                hasActiveFilters
                  ? t('common.adjustFilters')
                  : t('audit.emptyMessage')
              }
          />
        ) : (
          <>
            <div className="glass-table-wrap">
              <Table>
                <THead>
                  <TR>
                    <TH>{t('audit.col.time')}</TH>
                    <TH>{t('audit.col.action')}</TH>
                    <TH>{t('audit.col.entity')}</TH>
                    <TH>{t('common.description')}</TH>
                    <TH>{t('audit.col.actor')}</TH>
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
                        <Badge color={actionColor(event.action)}>
                          {t(actionKey(event.action))}
                        </Badge>
                      </TD>
                      <TD className="text-xs text-muted">
                        {event.entityType}
                        {event.entityId
                          ? ` · ${truncateId(event.entityId)}`
                          : ''}
                      </TD>
                      <TD
                        className="max-w-xs truncate"
                        title={event.description}
                      >
                        {event.description}
                      </TD>
                      <TD className="whitespace-nowrap">
                        {event.actorName || t('common.system')}
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