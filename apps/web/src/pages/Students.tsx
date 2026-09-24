import { useMemo, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { studentsApi, groupsApi } from '@/lib/api';
import {
  PageHeader,
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
  Badge,
  GlassButton,
  ConfirmDialog,
} from '@/components/ui';
import { useDebounce } from '@/hooks/useDebounce';
import { fullName } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, Student, Group } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';
import { useToasts } from '@/components/ui';

interface StudentFilters {
  page: number;
  limit: number;
  search?: string;
  groupId?: string;
}

function OrbBackdrop() {
  return null;
}

export function formatStudentName(student: Student): string {
  return fullName(student.user?.firstName, student.user?.lastName);
}

export function getStudentStatusBadge(isActive: boolean | undefined): { color: string; label: string } {
  return isActive === false
    ? { color: 'red', label: 'enum.status.INACTIVE' }
    : { color: 'green', label: 'enum.status.ACTIVE' };
}

export function StudentsPage() {
  const { t } = useI18n();
  usePageTitle(t('students.title'));
  const navigate = useNavigate();
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();

  // Filter state
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [groupId, setGroupId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const debouncedSearch = useDebounce(search, 300);

  // Build query params
  const params = useMemo<StudentFilters>(
    () => ({
      page,
      limit: 20,
      search: debouncedSearch || undefined,
      groupId: groupId || undefined,
    }),
    [page, debouncedSearch, groupId],
  );

  // Data fetching
  const students = useQuery({
    queryKey: ['students', params],
    queryFn: () => studentsApi.list(params),
    placeholderData: (previousData) => previousData,
  });

  const groups = useQuery({
    queryKey: ['groups-selector'],
    queryFn: () => groupsApi.list({ limit: 100 }),
    placeholderData: (previousData) => previousData,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const data = students.data as Paginated<Student> | undefined;
  const studentList = useMemo(() => data?.items || [], [data]);
  const groupList = useMemo(
    () => (groups.data as Paginated<Group> | undefined)?.items || [],
    [groups.data],
  );

  // Handlers
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value);
      setPage(1);
    },
    [],
  );

  const handleGroupFilterChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setGroupId(e.target.value);
      setPage(1);
    },
    [],
  );

  const handleStudentClick = useCallback(
    (studentId: string) => {
      navigate(`/students/${studentId}`);
    },
    [navigate],
  );

  const remove = useMutation({
    mutationFn: (id: string) => studentsApi.remove(id),
    onSuccess: () => {
      push('success', t('students.deleted'));
      qc.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
    },
  });

  const handleDelete = useCallback((id: string) => {
    setDeleteTarget(id);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    remove.mutate(deleteTarget);
    setDeleteTarget(null);
  }, [deleteTarget, remove]);

  const { refetch: refetchStudents } = students;
  const handleRetry = useCallback(() => {
    void refetchStudents();
  }, [refetchStudents]);

  const hasActiveFilters = Boolean(search || groupId);
  const totalStudents = data?.total || 0;

  // Early return for loading state
  if (students.isLoading && !data) {
    return (
      <>
        <OrbBackdrop />
        <div className="page-container space-y-4">
          <PageHeader
            title={t('students.title')}
            subtitle={t('students.pageSubtitle')}
            actions={
              <GlassButton asChild variant="primary">
                <Link to="/students/new">
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                  </svg>
                  {t('students.add')}
                </Link>
              </GlassButton>
            }
          />
          <div className="glass-card p-8">
            <PageLoader label={t('students.loading')} />
          </div>
        </div>
      </>
    );
  }

  // Early return for error state
  if (students.isError) {
    return (
      <>
        <OrbBackdrop />
        <div className="page-container space-y-4">
          <PageHeader
            title={t('students.title')}
            subtitle={t('students.pageSubtitle')}
            actions={
              <GlassButton asChild variant="primary">
                <Link to="/students/new">
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                  </svg>
                  {t('students.add')}
                </Link>
              </GlassButton>
            }
          />
          <div className="glass-card p-8">
            <ErrorState
              title={t('students.loadFailed')}
              message={getErrorMessage(students.error as Error)}
              onRetry={handleRetry}
            />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <OrbBackdrop />
      <div className="page-container space-y-4">
        <PageHeader
          title={t('students.title')}
          subtitle={t('students.pageSubtitle')}
          actions={
              <GlassButton asChild variant="primary">
                <Link to="/students/new">
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                  </svg>
                  {t('students.add')}
                </Link>
              </GlassButton>
            }
        />

        {/* Filters */}
        <div className="glass-card p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:flex-1">
              <TextInput
                placeholder={t('students.searchPlaceholderEmail')}
                value={search}
                onChange={handleSearchChange}
                aria-label={t('students.searchLabel')}
                type="search"
              />
              <Select
                value={groupId}
                onChange={handleGroupFilterChange}
                aria-label={t('students.filterGroupLabel')}
              >
                <option value="">{t('students.allGroups')}</option>
                {groupList.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="text-sm sm:ml-4 sm:shrink-0" style={{ color: 'var(--text-primary)' }}>
              {totalStudents === 1
                ? t('students.totalOne')
                : t('students.totalMany', { count: totalStudents })}
            </div>
          </div>
        </div>

        {/* Students table */}
        <div className="glass-card overflow-hidden">
          {studentList.length === 0 ? (
            <EmptyState
              title={hasActiveFilters ? t('students.emptyFiltered') : t('students.emptySearch')}
              message={
                hasActiveFilters
                  ? t('students.emptyFilteredHint')
                  : t('students.emptyHint')
              }
              action={
                <GlassButton asChild variant="primary">
                  <Link to="/students/new">{t('students.add')}</Link>
                </GlassButton>
              }
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <TR>
                      <TH>{t('common.name')}</TH>
                      <TH>{t('common.email')}</TH>
                      <TH>{t('students.col.groups')}</TH>
                      <TH>{t('students.col.parentName')}</TH>
                      <TH>{t('students.col.status')}</TH>
                      <TH>{t('common.actions')}</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {studentList.map((student) => {
                      const statusBadge = getStudentStatusBadge(
                        student.user?.isActive,
                      );
                      const activeGroups = (student.groups || []).filter(
                        (groupEnrollment) => groupEnrollment.isActive,
                      );

                      return (
                        <TR
                          key={student.id}
                          onClick={() => handleStudentClick(student.id)}
                          className="cursor-pointer transition-colors"
                          style={{ background: 'transparent' }}
                          tabIndex={0}
                          role="link"
                          aria-label={t('students.viewStudentAria', {
                            name: formatStudentName(student),
                          })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleStudentClick(student.id);
                            }
                          }}
                        >
                          <TD className="font-medium" style={{ color: 'var(--text-primary)' }}>
                            {formatStudentName(student)}
                          </TD>
                          <TD>{student.user?.email || '—'}</TD>
                          <TD>
                            <div className="flex flex-wrap gap-1">
                              {activeGroups.slice(0, 3).map((groupEnrollment) => (
                                <Badge
                                  key={groupEnrollment.group.id}
                                  color="blue"
                                >
                                  {groupEnrollment.group.name}
                                </Badge>
                              ))}
                              {activeGroups.length === 0 && (
                                <span style={{ color: 'var(--text-muted)' }}>—</span>
                              )}
                              {activeGroups.length > 3 && (
                                <Badge color="slate">
                                  +{activeGroups.length - 3}
                                </Badge>
                              )}
                            </div>
                          </TD>
                          <TD>{student.parentName || '—'}</TD>
                          <TD>
                            <Badge color={statusBadge.color}>
                              {t(statusBadge.label)}
                            </Badge>
                          </TD>
                          <TD>
                            <div
                              className="flex gap-2"
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => e.stopPropagation()}
                            >
                              <GlassButton
                                asChild
                                variant="ghost"
                                size="sm"
                              >
                                <Link to={`/students/${student.id}/edit`}>
                                  {t('common.edit')}
                                </Link>
                              </GlassButton>
                              <GlassButton
                                type="button"
                                variant="danger"
                                size="sm"
                                onClick={() => handleDelete(student.id)}
                                disabled={remove.isPending && remove.variables === student.id}
                              >
                                {t('common.delete')}
                              </GlassButton>
                            </div>
                          </TD>
                        </TR>
                      );
                    })}
                  </TBody>
                </Table>
              </div>
              <div className="border-t px-4 py-3" style={{ borderColor: 'var(--border-subtle)' }}>
                <Pagination
                  page={page}
                  totalPages={data?.totalPages ?? 1}
                  onPageChange={setPage}
                />
              </div>
            </>
          )}
        </div>

        <ConfirmDialog
          open={deleteTarget !== null}
          onClose={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
          description={t('students.confirmDelete')}
          loading={remove.isPending}
        />

        {toastNode}
      </div>
    </>
  );
}