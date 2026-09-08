import { useMemo, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { attendanceApi, studentsApi, groupsApi } from '@/lib/api';
import {
  GlassPageHeader,
  GlassCard,
  GlassBadge,
  GlassPageLoader,
  GlassErrorState,
  GlassEmptyState,
  GlassTable,
  GlassTHead,
  GlassTBody,
  GlassTR,
  GlassTH,
  GlassTD,
  GlassPagination,
  GlassInput,
  GlassSelect,
  GlassField,
  GlassModal,
  useToasts,
} from '@/components/ui';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, Attendance, Student, Group, AttendanceStatus } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';

const ATTENDANCE_STATUSES: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];

interface AttendanceFilters {
  page: number;
  limit: number;
  groupId?: string;
  date?: string;
  status?: AttendanceStatus;
}

interface AttendanceFormState {
  studentId: string;
  groupId: string;
  date: string;
  status: AttendanceStatus;
  note: string;
}

const INITIAL_FORM: AttendanceFormState = {
  studentId: '',
  groupId: '',
  date: new Date().toISOString().slice(0, 10),
  status: 'PRESENT',
  note: '',
};

function statusBadgeVariant(status: AttendanceStatus): 'success' | 'error' | 'warning' | 'azure' {
  switch (status) {
    case 'PRESENT':
      return 'success';
    case 'ABSENT':
      return 'error';
    case 'LATE':
      return 'warning';
    case 'EXCUSED':
      return 'azure';
  }
}

export function AttendancePage() {
  usePageTitle('Attendance');
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();

  // Filter state
  const [page, setPage] = useState(1);
  const [groupId, setGroupId] = useState('');
  const [date, setDate] = useState('');
  const [status, setStatus] = useState('');

  // Debounce filter values to prevent excessive API calls
  const debouncedGroupId = useDebounce(groupId);
  const debouncedDate = useDebounce(date);
  const debouncedStatus = useDebounce(status);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<AttendanceFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof AttendanceFormState, string>>>({});

  // Build query params with debounced values
  const params = useMemo<AttendanceFilters>(
    () => ({
      page,
      limit: 20,
      groupId: debouncedGroupId || undefined,
      date: debouncedDate || undefined,
      status: (debouncedStatus as AttendanceStatus) || undefined,
    }),
    [page, debouncedGroupId, debouncedDate, debouncedStatus],
  );

  // Data fetching
  const attendance = useQuery({
    queryKey: ['attendance', params],
    queryFn: () => attendanceApi.list(params),
    placeholderData: (previousData) => previousData,
  });

  const groups = useQuery({
    queryKey: ['groups-selector'],
    queryFn: () => groupsApi.list({ limit: 100 }),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const students = useQuery({
    queryKey: ['students-selector'],
    queryFn: () => studentsApi.list({ limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });

  const data = attendance.data as Paginated<Attendance> | undefined;
  const groupList = (groups.data as Paginated<Group> | undefined)?.items || [];
  const studentList = (students.data as Paginated<Student> | undefined)?.items || [];

  // Reset page when filters change
  const handleFilterChange = useCallback(
    (setter: (value: string) => void) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
      setter(e.target.value);
      setPage(1);
    },
    [],
  );

  // Form handlers
  const handleFormChange = useCallback((field: keyof AttendanceFormState) => {
    return (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      // Clear error for this field when user starts typing
      setFormErrors((prev) => ({ ...prev, [field]: undefined }));
    };
  }, []);

  const validateForm = useCallback((): boolean => {
    const errors: Partial<Record<keyof AttendanceFormState, string>> = {};

    if (!form.studentId) {
      errors.studentId = 'Please select a student';
    }
    if (!form.groupId) {
      errors.groupId = 'Please select a group';
    }
    if (!form.date) {
      errors.date = 'Please select a date';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form]);

  // Create attendance mutation
  const create = useMutation({
    mutationFn: () =>
      attendanceApi.create({
        groupId: form.groupId,
        date: new Date(form.date).toISOString(),
        records: [{ studentId: form.studentId, status: form.status, note: form.note || undefined }],
      }),
    onSuccess: () => {
      push('success', 'Attendance recorded successfully');
      setModalOpen(false);
      setForm(INITIAL_FORM);
      setFormErrors({});
      qc.invalidateQueries({ queryKey: ['attendance'] });
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
    },
  });

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!validateForm()) {
        return;
      }
      create.mutate();
    },
    [validateForm, create],
  );

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setForm(INITIAL_FORM);
    setFormErrors({});
  }, []);

  const { refetch: refetchAttendance } = attendance;
  const handleRetry = useCallback(() => {
    void refetchAttendance();
  }, [refetchAttendance]);

  // Render loading state
  if (attendance.isLoading && !data) {
    return (
      <div className="orb-container">
        <div className="orb orb-cyan-1" />
        <div className="orb orb-cyan-2" />
        <div className="orb orb-indigo-1" />
        <div className="orb orb-deep-1" />
        <div className="page-container">
          <GlassPageHeader title="Attendance" subtitle="Records and manual attendance entry" />
          <GlassCard className="p-8">
            <GlassPageLoader label="Loading attendance records…" />
          </GlassCard>
        </div>
      </div>
    );
  }

  // Render error state
  if (attendance.isError) {
    return (
      <div className="orb-container">
        <div className="orb orb-cyan-1" />
        <div className="orb orb-cyan-2" />
        <div className="orb orb-indigo-1" />
        <div className="orb orb-deep-1" />
        <div className="page-container">
          <GlassPageHeader title="Attendance" subtitle="Records and manual attendance entry" />
          <GlassCard className="p-8">
            <GlassErrorState
              title="Failed to load attendance"
              message={getErrorMessage(attendance.error as Error)}
              onRetry={handleRetry}
            />
          </GlassCard>
        </div>
      </div>
    );
  }

  const hasActiveFilters = Boolean(groupId || date || status);
  const totalRecords = data?.total || 0;

  return (
    <div className="orb-container">
      <div className="orb orb-cyan-1" />
      <div className="orb orb-cyan-2" />
      <div className="orb orb-indigo-1" />
      <div className="orb orb-deep-1" />
      <div className="page-container">
        <GlassPageHeader
          title="Attendance"
          subtitle="Records and manual attendance entry"
          actions={
            <button
              type="button"
              className="glass-btn glass-btn-primary"
              onClick={() => setModalOpen(true)}
              aria-label="Record attendance"
            >
              Record attendance
            </button>
          }
        />

        {/* Filters */}
        <GlassCard className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:flex-1">
              <GlassSelect
                value={groupId}
                onChange={handleFilterChange(setGroupId)}
                aria-label="Filter by group"
              >
                <option value="">All groups</option>
                {groupList.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </GlassSelect>
              <GlassInput
                type="date"
                value={date}
                onChange={handleFilterChange(setDate)}
                aria-label="Filter by date"
              />
              <GlassSelect
                value={status}
                onChange={handleFilterChange(setStatus)}
                aria-label="Filter by status"
              >
                <option value="">All statuses</option>
                {ATTENDANCE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0) + s.slice(1).toLowerCase()}
                  </option>
                ))}
              </GlassSelect>
            </div>
            <div className="text-sm sm:ml-4 sm:shrink-0" style={{ color: 'var(--text-secondary)' }}>
              {totalRecords} {totalRecords === 1 ? 'record' : 'records'}
            </div>
          </div>
        </GlassCard>

        {/* Attendance table */}
        <GlassCard className="overflow-hidden">
          {!data || data.items.length === 0 ? (
            <GlassEmptyState
              title={hasActiveFilters ? 'No matching records' : 'No attendance records yet'}
              message={
                hasActiveFilters
                  ? 'Try adjusting your filters to see more results.'
                  : 'Attendance records will appear here once you start recording attendance.'
              }
            />
          ) : (
            <>
              <div className="glass-table-wrap">
                <GlassTable>
                  <GlassTHead>
                    <GlassTR>
                      <GlassTH>Date</GlassTH>
                      <GlassTH>Student</GlassTH>
                      <GlassTH>Group</GlassTH>
                      <GlassTH>Status</GlassTH>
                      <GlassTH>Source</GlassTH>
                    </GlassTR>
                  </GlassTHead>
                  <GlassTBody>
                    {data.items.map((a) => (
                      <GlassTR key={a.id} className="transition-colors">
                        <GlassTD className="whitespace-nowrap">{formatDate(a.date)}</GlassTD>
                        <GlassTD className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          {a.student?.user
                            ? `${a.student.user.firstName} ${a.student.user.lastName}`
                            : '—'}
                        </GlassTD>
                        <GlassTD>{a.group?.name || '—'}</GlassTD>
                        <GlassTD>
                          <GlassBadge variant={statusBadgeVariant(a.status)}>{a.status}</GlassBadge>
                        </GlassTD>
                        <GlassTD style={{ color: 'var(--text-secondary)' }}>{a.source}</GlassTD>
                      </GlassTR>
                    ))}
                  </GlassTBody>
                </GlassTable>
              </div>
              <div className="px-4 py-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <GlassPagination
                  page={page}
                  totalPages={data.totalPages}
                  onPageChange={setPage}
                />
              </div>
            </>
          )}
        </GlassCard>

        {/* Record attendance modal */}
        <GlassModal
          open={modalOpen}
          onClose={handleCloseModal}
          title="Record attendance"
          wide
        >
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <GlassField label="Student" required error={formErrors.studentId}>
                <GlassSelect
                  value={form.studentId}
                  onChange={handleFormChange('studentId')}
                  required
                  aria-invalid={Boolean(formErrors.studentId)}
                  aria-describedby={formErrors.studentId ? 'student-error' : undefined}
                >
                  <option value="">Select student…</option>
                  {studentList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.user?.firstName} {s.user?.lastName}
                    </option>
                  ))}
                </GlassSelect>
                {formErrors.studentId && (
                  <span id="student-error" className="mt-1 text-sm" style={{ color: 'var(--state-error)' }}>
                    {formErrors.studentId}
                  </span>
                )}
              </GlassField>
              <GlassField label="Group" required error={formErrors.groupId}>
                <GlassSelect
                  value={form.groupId}
                  onChange={handleFormChange('groupId')}
                  required
                  aria-invalid={Boolean(formErrors.groupId)}
                  aria-describedby={formErrors.groupId ? 'group-error' : undefined}
                >
                  <option value="">Select group…</option>
                  {groupList.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </GlassSelect>
                {formErrors.groupId && (
                  <span id="group-error" className="mt-1 text-sm" style={{ color: 'var(--state-error)' }}>
                    {formErrors.groupId}
                  </span>
                )}
              </GlassField>
              <GlassField label="Date" required error={formErrors.date}>
                <GlassInput
                  type="date"
                  value={form.date}
                  onChange={handleFormChange('date')}
                  required
                  aria-invalid={Boolean(formErrors.date)}
                  aria-describedby={formErrors.date ? 'date-error' : undefined}
                />
                {formErrors.date && (
                  <span id="date-error" className="mt-1 text-sm" style={{ color: 'var(--state-error)' }}>
                    {formErrors.date}
                  </span>
                )}
              </GlassField>
              <GlassField label="Status" required>
                <GlassSelect
                  value={form.status}
                  onChange={handleFormChange('status')}
                  aria-label="Attendance status"
                >
                  {ATTENDANCE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.charAt(0) + s.slice(1).toLowerCase()}
                    </option>
                  ))}
                </GlassSelect>
              </GlassField>
            </div>
            <GlassField label="Note">
              <GlassInput
                value={form.note}
                onChange={handleFormChange('note')}
                placeholder="Optional note…"
              />
            </GlassField>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="glass-btn glass-btn-secondary"
                onClick={handleCloseModal}
                disabled={create.isPending}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="glass-btn glass-btn-primary"
                disabled={create.isPending}
              >
                {create.isPending ? 'Saving…' : 'Record'}
              </button>
            </div>
          </form>
        </GlassModal>

        {toastNode}
      </div>
    </div>
  );
}
