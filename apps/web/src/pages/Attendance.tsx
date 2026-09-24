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
  GlassButton,
  GlassStatCard,
  useToasts,
} from '@/components/ui';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, Attendance, Student, Group, AttendanceStatus, AttendanceAnalytics } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';

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
  const { t } = useI18n();
  usePageTitle(t('attendance.title'));
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

  // Edit / void state
  const [editTarget, setEditTarget] = useState<Attendance | null>(null);
  const [editStatus, setEditStatus] = useState<AttendanceStatus>('PRESENT');
  const [editNote, setEditNote] = useState('');
  const [voidTarget, setVoidTarget] = useState<Attendance | null>(null);

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

  const analyticsQuery = useQuery({
    queryKey: ['attendance-analytics', debouncedGroupId, debouncedDate],
    queryFn: () =>
      attendanceApi.analytics({
        groupId: debouncedGroupId || undefined,
        date: debouncedDate || undefined,
      }) as Promise<AttendanceAnalytics>,
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
      errors.studentId = t('common.validation.selectStudent');
    }
    if (!form.groupId) {
      errors.groupId = t('common.validation.selectGroup');
    }
    if (!form.date) {
      errors.date = t('common.validation.selectDate');
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form, t]);

  // Create attendance mutation
  const create = useMutation({
    mutationFn: () =>
      attendanceApi.create({
        groupId: form.groupId,
        date: new Date(form.date).toISOString(),
        records: [{ studentId: form.studentId, status: form.status, note: form.note || undefined }],
      }),
    onSuccess: () => {
      push('success', t('attendance.recordedSuccess'));
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

  // Edit record mutation
  const updateRecord = useMutation({
    mutationFn: (vars: { id: string; status: AttendanceStatus; note: string }) =>
      attendanceApi.update(vars.id, { status: vars.status, note: vars.note }),
    onSuccess: () => {
      push('success', t('attendance.recordUpdated'));
      setEditTarget(null);
      qc.invalidateQueries({ queryKey: ['attendance'] });
      qc.invalidateQueries({ queryKey: ['attendance-analytics'] });
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
    },
  });

  // Void (delete) record mutation
  const voidRecord = useMutation({
    mutationFn: (id: string) => attendanceApi.remove(id),
    onSuccess: () => {
      push('success', t('attendance.recordVoided'));
      setVoidTarget(null);
      qc.invalidateQueries({ queryKey: ['attendance'] });
      qc.invalidateQueries({ queryKey: ['attendance-analytics'] });
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
    },
  });

  const openEdit = useCallback((record: Attendance) => {
    setEditTarget(record);
    setEditStatus(record.status);
    setEditNote(record.note || '');
  }, []);

  const handleEditSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!editTarget) return;
      updateRecord.mutate({ id: editTarget.id, status: editStatus, note: editNote });
    },
    [editTarget, editStatus, editNote, updateRecord],
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
      <div style={{ display: "contents" }}>
        <div className="page-container">
          <GlassPageHeader title={t('attendance.title')} subtitle={t('attendance.pageSubtitle')} />
          <GlassCard className="p-8">
            <GlassPageLoader label={t('attendance.loadingRecords')} />
          </GlassCard>
        </div>
      </div>
    );
  }

  // Render error state
  if (attendance.isError) {
    return (
      <div style={{ display: "contents" }}>
        <div className="page-container">
          <GlassPageHeader title={t('attendance.title')} subtitle={t('attendance.pageSubtitle')} />
          <GlassCard className="p-8">
            <GlassErrorState
              title={t('attendance.loadFailed')}
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
    <div style={{ display: "contents" }}>
      <div className="page-container">
        <GlassPageHeader
          title={t('attendance.title')}
          subtitle={t('attendance.pageSubtitle')}
          actions={
            <GlassButton
              type="button"
              variant="primary"
              onClick={() => setModalOpen(true)}
              aria-label={t('attendance.record')}
            >
              {t('attendance.record')}
            </GlassButton>
          }
        />

        {/* Analytics KPIs */}
        {analyticsQuery.data && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <GlassStatCard
              label={t('executive.attendanceRate')}
              value={`${analyticsQuery.data.overall.rate}%`}
              trend={{
                value: t('attendance.trendPresent', {
                  present: analyticsQuery.data.overall.present,
                  total: analyticsQuery.data.overall.total,
                }),
                direction: 'neutral',
              }}
            />
            {analyticsQuery.data.byStatus.map((s) => (
              <GlassStatCard
                key={s.status}
                label={t(`attendance.${s.status.toLowerCase()}`)}
                value={s.count}
              />
            ))}
          </div>
        )}

        {/* Filters */}
        <GlassCard className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:flex-1">
              <GlassSelect
                value={groupId}
                onChange={handleFilterChange(setGroupId)}
                aria-label={t('students.filterGroupLabel')}
              >
                <option value="">{t('attendance.allGroups')}</option>
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
                aria-label={t('attendance.filterByDate')}
              />
              <GlassSelect
                value={status}
                onChange={handleFilterChange(setStatus)}
                aria-label={t('attendance.filterByStatus')}
              >
                <option value="">{t('attendance.allStatuses')}</option>
                {ATTENDANCE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`attendance.${s.toLowerCase()}`)}
                  </option>
                ))}
              </GlassSelect>
            </div>
            <div className="text-sm sm:ml-4 sm:shrink-0" style={{ color: 'var(--text-secondary)' }}>
              {totalRecords}{' '}
              {totalRecords === 1 ? t('attendance.countOne') : t('attendance.countMany')}
            </div>
          </div>
        </GlassCard>

        {/* Attendance table */}
        <GlassCard className="overflow-hidden">
          {!data || data.items.length === 0 ? (
            <GlassEmptyState
              title={
                hasActiveFilters ? t('attendance.emptyFilteredTitle') : t('attendance.emptyTitle')
              }
              message={
                hasActiveFilters
                  ? t('attendance.emptyFilteredHint')
                  : t('attendance.emptyMessage')
              }
            />
          ) : (
            <>
              <div className="glass-table-wrap">
                <GlassTable>
                  <GlassTHead>
                    <GlassTR>
                      <GlassTH>{t('attendance.col.date')}</GlassTH>
                      <GlassTH>{t('attendance.col.student')}</GlassTH>
                      <GlassTH>{t('attendance.col.group')}</GlassTH>
                      <GlassTH>{t('attendance.col.status')}</GlassTH>
                      <GlassTH>{t('attendance.col.source')}</GlassTH>
                      <GlassTH>{t('attendance.col.actions')}</GlassTH>
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
                          <GlassBadge variant={statusBadgeVariant(a.status)}>
                            {t(`attendance.${a.status.toLowerCase()}`)}
                          </GlassBadge>
                        </GlassTD>
                        <GlassTD style={{ color: 'var(--text-secondary)' }}>{a.source}</GlassTD>
 <GlassTD>
 <div className="flex gap-2">
 <GlassButton
 type="button"
 variant="ghost"
 size="sm"
 onClick={() => openEdit(a)}
 aria-label={t('attendance.editAria', {
 name: a.student?.user?.firstName ?? t('attendance.selectStudent'),
 })}
 >
 {t('common.edit')}
 </GlassButton>
 <GlassButton
 type="button"
 variant="ghost"
 size="sm"
 className="text-red-600"
 onClick={() => setVoidTarget(a)}
 aria-label={t('attendance.voidAria', {
 name: a.student?.user?.firstName ?? t('attendance.selectStudent'),
 })}
 >
 {t('attendance.void')}
 </GlassButton>
 </div>
 </GlassTD>
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
          title={t('attendance.record')}
          wide
        >
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <GlassField label={t('attendance.selectStudent')} required error={formErrors.studentId}>
                <GlassSelect
                  value={form.studentId}
                  onChange={handleFormChange('studentId')}
                  required
                  aria-invalid={Boolean(formErrors.studentId)}
                  aria-describedby={formErrors.studentId ? 'student-error' : undefined}
                >
                  <option value="">{t('attendance.studentPlaceholder')}</option>
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
              <GlassField label={t('attendance.selectGroup')} required error={formErrors.groupId}>
                <GlassSelect
                  value={form.groupId}
                  onChange={handleFormChange('groupId')}
                  required
                  aria-invalid={Boolean(formErrors.groupId)}
                  aria-describedby={formErrors.groupId ? 'group-error' : undefined}
                >
                  <option value="">{t('attendance.groupPlaceholder')}</option>
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
              <GlassField label={t('attendance.selectDate')} required error={formErrors.date}>
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
              <GlassField label={t('common.status')} required>
                <GlassSelect
                  value={form.status}
                  onChange={handleFormChange('status')}
                  aria-label={t('attendance.selectStatus')}
                >
                  {ATTENDANCE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(`attendance.${s.toLowerCase()}`)}
                    </option>
                  ))}
                </GlassSelect>
              </GlassField>
            </div>
            <GlassField label={t('attendance.note')}>
              <GlassInput
                value={form.note}
                onChange={handleFormChange('note')}
                placeholder={t('attendance.notePlaceholder')}
              />
            </GlassField>
            <div className="flex justify-end gap-2">
              <GlassButton
                type="button"
                variant="secondary"
                onClick={handleCloseModal}
                disabled={create.isPending}
              >
                {t('common.cancel')}
              </GlassButton>
              <GlassButton
                type="submit"
                variant="primary"
                disabled={create.isPending}
              >
                {create.isPending ? t('common.saving') : t('attendance.recordSubmit')}
              </GlassButton>
            </div>
          </form>
        </GlassModal>

        {/* Edit record modal */}
        <GlassModal
          open={Boolean(editTarget)}
          onClose={() => setEditTarget(null)}
          title={t('attendance.editTitle')}
        >
          <form className="space-y-4" onSubmit={handleEditSubmit} noValidate>
            <GlassField label={t('common.status')} required>
              <GlassSelect
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as AttendanceStatus)}
                aria-label={t('attendance.selectStatus')}
              >
                {ATTENDANCE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`attendance.${s.toLowerCase()}`)}
                  </option>
                ))}
              </GlassSelect>
            </GlassField>
            <GlassField label={t('attendance.note')}>
              <GlassInput
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder={t('attendance.notePlaceholder')}
              />
            </GlassField>
            <div className="flex justify-end gap-2">
              <GlassButton
                type="button"
                variant="secondary"
                onClick={() => setEditTarget(null)}
                disabled={updateRecord.isPending}
              >
                {t('common.cancel')}
              </GlassButton>
              <GlassButton type="submit" variant="primary" disabled={updateRecord.isPending}>
                {updateRecord.isPending ? t('common.saving') : t('common.save')}
              </GlassButton>
            </div>
          </form>
        </GlassModal>

        {/* Void confirmation modal */}
        <GlassModal
          open={Boolean(voidTarget)}
          onClose={() => setVoidTarget(null)}
          title={t('attendance.voidTitle')}
        >
          <div className="space-y-4">
            <p style={{ color: 'var(--text-secondary)' }}>
              {t('attendance.voidConfirmBefore')}{' '}
              <strong>
                {voidTarget?.student?.user
                  ? `${voidTarget.student.user.firstName} ${voidTarget.student.user.lastName}`
                  : t('attendance.thisStudent')}
              </strong>{' '}
              {t('attendance.voidConfirmAfter', {
                date: voidTarget ? formatDate(voidTarget.date) : '',
              })}
            </p>
            <div className="flex justify-end gap-2">
              <GlassButton
                type="button"
                variant="secondary"
                onClick={() => setVoidTarget(null)}
                disabled={voidRecord.isPending}
              >
                {t('common.cancel')}
              </GlassButton>
              <GlassButton
                type="button"
                variant="danger"
                onClick={() => voidTarget && voidRecord.mutate(voidTarget.id)}
                disabled={voidRecord.isPending}
              >
                {voidRecord.isPending ? t('attendance.voiding') : t('attendance.voidRecord')}
              </GlassButton>
            </div>
          </div>
        </GlassModal>

        {toastNode}
      </div>
    </div>
  );
}
