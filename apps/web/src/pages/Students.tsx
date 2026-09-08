import { useMemo, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
} from '@/components/ui';
import { useDebounce } from '@/hooks/useDebounce';
import { fullName } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, Student, Group } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';

interface StudentFilters {
  page: number;
  limit: number;
  search?: string;
  groupId?: string;
}

function OrbBackdrop() {
  return (
    <div className="orb-container" aria-hidden="true">
      <div className="orb orb-cyan-1" />
      <div className="orb orb-cyan-2" />
      <div className="orb orb-indigo-1" />
      <div className="orb orb-deep-1" />
    </div>
  );
}

export function formatStudentName(student: Student): string {
  return fullName(student.user?.firstName, student.user?.lastName);
}

export function getStudentStatusBadge(isActive: boolean | undefined): { color: string; label: string } {
  return isActive === false
    ? { color: 'red', label: 'Inactive' }
    : { color: 'green', label: 'Active' };
}

export function StudentsPage() {
  usePageTitle('Students');
  const navigate = useNavigate();

  // Filter state
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [groupId, setGroupId] = useState('');
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
            title="Students"
            subtitle="Manage students, enrollments and attendance"
            actions={
              <Link to="/students/new" className="glass-btn-primary">
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                </svg>
                Add student
              </Link>
            }
          />
          <div className="glass-card p-8">
            <PageLoader label="Loading students…" />
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
            title="Students"
            subtitle="Manage students, enrollments and attendance"
            actions={
              <Link to="/students/new" className="glass-btn-primary">
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                </svg>
                Add student
              </Link>
            }
          />
          <div className="glass-card p-8">
            <ErrorState
              title="Failed to load students"
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
          title="Students"
          subtitle="Manage students, enrollments and attendance"
          actions={
            <Link to="/students/new" className="glass-btn-primary">
              <svg
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
              </svg>
              Add student
            </Link>
          }
        />

        {/* Filters */}
        <div className="glass-card p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:flex-1">
              <TextInput
                placeholder="Search by name or email…"
                value={search}
                onChange={handleSearchChange}
                aria-label="Search students"
                type="search"
              />
              <Select
                value={groupId}
                onChange={handleGroupFilterChange}
                aria-label="Filter by group"
              >
                <option value="">All groups</option>
                {groupList.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="text-sm sm:ml-4 sm:shrink-0" style={{ color: 'var(--text-primary)' }}>
              {totalStudents} {totalStudents === 1 ? 'student' : 'students'}
            </div>
          </div>
        </div>

        {/* Students table */}
        <div className="glass-card overflow-hidden">
          {studentList.length === 0 ? (
            <EmptyState
              title={hasActiveFilters ? 'No matching students' : 'No students found'}
              message={
                hasActiveFilters
                  ? 'Try adjusting your filters to see more results.'
                  : 'Add your first student to get started.'
              }
              action={
                <Link to="/students/new" className="glass-btn-primary">
                  Add student
                </Link>
              }
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <TR>
                      <TH>Name</TH>
                      <TH>Email</TH>
                      <TH>Groups</TH>
                      <TH>Parent</TH>
                      <TH>Status</TH>
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
                          aria-label={`View student ${formatStudentName(student)}`}
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
                              {statusBadge.label}
                            </Badge>
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
      </div>
    </>
  );
}