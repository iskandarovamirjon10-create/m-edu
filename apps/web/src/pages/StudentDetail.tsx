import { useState, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { studentsApi, groupsApi, faceApi } from '@/lib/api';
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
  Modal,
  ConfirmDialog,
  Select,
  useToasts,
  statusColor,
  Field,
  Badge,
  GlassButton,
} from '@/components/ui';
import { fullName, formatDate, formatCurrency } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, Student, Group } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';

function OrbBackdrop() {
  return null;
}

interface FaceEnrollmentItem {
  id: string;
  status: string;
  enrolledAt: string;
}

function formatStudentStatus(isActive: boolean | undefined): { color: string; label: string } {
  return isActive === false
    ? { color: 'red', label: 'enum.status.INACTIVE' }
    : { color: 'green', label: 'enum.status.ACTIVE' };
}

function formatGroupStatus(isActive: boolean): { color: string; label: string } {
  return isActive
    ? { color: 'green', label: 'enum.status.ACTIVE' }
    : { color: 'slate', label: 'enum.status.INACTIVE' };
}

export function StudentDetailPage() {
  const { t } = useI18n();
  usePageTitle(t('students.detailsTitle'));
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();

  // Modal state
  const [assignOpen, setAssignOpen] = useState(false);
  const [groupId, setGroupId] = useState('');
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);

  // Data fetching
  const student = useQuery({
    queryKey: ['student', id],
    queryFn: () => studentsApi.get(id!),
    enabled: !!id,
    placeholderData: (previousData) => previousData,
  });

  const groups = useQuery({
    queryKey: ['groups-selector'],
    queryFn: () => groupsApi.list({ limit: 100 }),
    placeholderData: (previousData) => previousData,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const enrollments = useQuery({
    queryKey: ['face-enrollments', id],
    queryFn: () => faceApi.enrollments({ studentId: id }),
    enabled: !!id,
    placeholderData: (previousData) => previousData,
  });

  const studentData = student.data as Student | undefined;
  const allGroups = useMemo(
    () => (groups.data as Paginated<Group> | undefined)?.items || [],
    [groups.data],
  );
  const activeGroups = useMemo(
    () => allGroups.filter((group) => group.isActive),
    [allGroups],
  );
  const myEnrollments = useMemo(
    () =>
      (enrollments.data as unknown as { items?: FaceEnrollmentItem[] })
        ?.items || [],
    [enrollments.data],
  );

  // Student groups
  const studentGroups = useMemo(
    () => studentData?.groups || [],
    [studentData],
  );

  // Student attendance
  const studentAttendance = useMemo(
    () => studentData?.attendance || [],
    [studentData],
  );

  // Student payments
  const studentPayments = useMemo(
    () => studentData?.payments || [],
    [studentData],
  );

  // Assign to group mutation
  const assign = useMutation({
    mutationFn: () => studentsApi.assignGroup(id!, groupId),
    onSuccess: () => {
      push('success', t('studentDetail.assigned'));
      setAssignOpen(false);
      setGroupId('');
      qc.invalidateQueries({ queryKey: ['student', id] });
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
    },
  });

  // Remove from group mutation
  const removeFromGroup = useMutation({
    mutationFn: (groupIdToRemove: string) =>
      studentsApi.removeGroup(id!, groupIdToRemove),
    onSuccess: () => {
      push('success', t('studentDetail.removed'));
      qc.invalidateQueries({ queryKey: ['student', id] });
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
    },
  });

  // Handlers
  const { refetch: refetchStudent } = student;
  const handleRetry = useCallback(() => {
    void refetchStudent();
  }, [refetchStudent]);

  const handleOpenAssign = useCallback(() => {
    setGroupId('');
    setAssignOpen(true);
  }, []);

  const handleCloseAssign = useCallback(() => {
    setAssignOpen(false);
    setGroupId('');
  }, []);

  const handleAssign = useCallback(() => {
    if (!groupId) return;
    assign.mutate();
  }, [groupId, assign]);

  const handleRemoveFromGroup = useCallback((groupIdToRemove: string) => {
    setRemoveTarget(groupIdToRemove);
  }, []);

  const confirmRemoveFromGroup = useCallback(() => {
    if (!removeTarget) return;
    removeFromGroup.mutate(removeTarget);
    setRemoveTarget(null);
  }, [removeTarget, removeFromGroup]);

  const handleEdit = useCallback(() => {
    navigate(`/students/${id}/edit`);
  }, [navigate, id]);

  const handleEnrollFace = useCallback(() => {
    navigate('/face/enroll');
  }, [navigate]);

  // Early return for loading state
  if (student.isLoading && !studentData) {
    return (
      <>
        <OrbBackdrop />
        <div className="page-container space-y-4">
          <PageHeader
            title={t('enum.badge.STUDENT')}
            subtitle={t('studentDetail.loadingSubtitle')}
          />
          <div className="glass-card p-8">
            <PageLoader label={t('studentForm.loading')} />
          </div>
        </div>
      </>
    );
  }

  // Early return for error state
  if (student.isError || !studentData) {
    return (
      <>
        <OrbBackdrop />
        <div className="page-container space-y-4">
          <PageHeader
            title={t('enum.badge.STUDENT')}
            subtitle={t('studentDetail.detailsSubtitle')}
          />
          <div className="glass-card p-8">
            <ErrorState
              title={t('studentDetail.notFound')}
              message={getErrorMessage(student.error as Error)}
              onRetry={handleRetry}
            />
          </div>
        </div>
      </>
    );
  }

  const studentStatus = formatStudentStatus(studentData.user?.isActive);
  const studentName = fullName(
    studentData.user?.firstName,
    studentData.user?.lastName,
  );

  return (
    <>
      <OrbBackdrop />
      <div className="page-container space-y-6">
        <PageHeader
          title={studentName}
        subtitle={studentData.user?.email || ''}
        actions={
          <div className="flex flex-col gap-2 sm:flex-row">
            <GlassButton
              type="button"
              variant="secondary"
              onClick={handleEdit}
            >
              {t('common.edit')}
            </GlassButton>
            <GlassButton
              type="button"
              variant="primary"
              onClick={handleOpenAssign}
            >
              {t('studentDetail.assignToGroup')}
            </GlassButton>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Profile card */}
        <div className="glass-card overflow-hidden lg:col-span-1">
          <div className="border-b border-[var(--border-subtle)] px-5 py-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              {t('studentDetail.profile')}
            </h2>
          </div>
          <div className="p-5">
            <dl className="space-y-4">
              <div className="flex items-start justify-between">
                <dt className="text-sm text-[var(--text-primary)]">
                  {t('studentForm.dateOfBirth')}
                </dt>
                <dd className="text-sm font-medium text-[var(--text-primary)]">
                  {formatDate(studentData.dateOfBirth)}
                </dd>
              </div>
              <div className="flex items-start justify-between">
                <dt className="text-sm text-[var(--text-primary)]">
                  {t('studentForm.gender')}
                </dt>
                <dd className="text-sm font-medium text-[var(--text-primary)]">
                  {studentData.gender || '—'}
                </dd>
              </div>
              <div className="flex items-start justify-between">
                <dt className="text-sm text-[var(--text-primary)]">
                  {t('hr.form.address')}
                </dt>
                <dd className="text-sm font-medium text-[var(--text-primary)]">
                  {studentData.address || '—'}
                </dd>
              </div>
              <div className="flex items-start justify-between">
                <dt className="text-sm text-[var(--text-primary)]">
                  {t('common.phone')}
                </dt>
                <dd className="text-sm font-medium text-[var(--text-primary)]">
                  {studentData.user?.phone || '—'}
                </dd>
              </div>
              <div className="flex items-start justify-between">
                <dt className="text-sm text-[var(--text-primary)]">
                  {t('common.status')}
                </dt>
                <dd>
                  <Badge color={studentStatus.color}>
                    {t(studentStatus.label)}
                  </Badge>
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Parent/Guardian card */}
        <div className="glass-card overflow-hidden lg:col-span-2">
          <div className="border-b border-[var(--border-subtle)] px-5 py-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              {t('studentForm.parentSection')}
            </h2>
          </div>
          <div className="p-5">
            <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-[var(--text-primary)]">
                  {t('common.name')}
                </dt>
                <dd className="mt-1 font-medium text-[var(--text-primary)]">
                  {studentData.parentName || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--text-primary)]">
                  {t('common.phone')}
                </dt>
                <dd className="mt-1 font-medium text-[var(--text-primary)]">
                  {studentData.parentPhone || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--text-primary)]">
                  {t('common.email')}
                </dt>
                <dd className="mt-1 font-medium text-[var(--text-primary)]">
                  {studentData.parentEmail || '—'}
                </dd>
              </div>
            </dl>
            {studentData.notes && (
              <div className="mt-4 rounded-lg glass-card p-4 text-sm text-[var(--text-primary)]">
                <span className="font-medium">{t('common.notes')}: </span>
                {studentData.notes}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Groups card */}
        <div className="glass-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
 <h2 className="text-sm font-semibold text-[var(--text-primary)]">
 {t('groups.title')}
 </h2>
 <GlassButton
 type="button"
 variant="ghost"
 size="sm"
 onClick={handleOpenAssign}
 >
 {t('studentDetail.assign')}
 </GlassButton>
          </div>
          {studentGroups.length === 0 ? (
            <EmptyState
              title={t('studentDetail.noGroups')}
              message={t('studentDetail.noGroupsHint')}
            />
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              {studentGroups.map((groupEnrollment) => {
                const groupStatus = formatGroupStatus(
                  groupEnrollment.isActive,
                );
                const isRemoving =
                  removeFromGroup.isPending &&
                  removeFromGroup.variables === groupEnrollment.group.id;

                return (
                  <div
                    key={groupEnrollment.group.id}
                    className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-[var(--state-hover)]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                        {groupEnrollment.group.name}
                      </p>
                      {groupEnrollment.group.room && (
                        <p className="text-xs text-[var(--text-primary)]">
                          {t('groups.col.room')} {groupEnrollment.group.room}
                        </p>
                      )}
                    </div>
                    <div className="ml-4 flex shrink-0 items-center gap-2">
                      <Badge color={groupStatus.color}>
                        {groupStatus.label}
                      </Badge>
 {groupEnrollment.isActive && (
 <GlassButton
 type="button"
 variant="ghost"
 size="sm"
 className="text-red-600"
 onClick={() =>
 handleRemoveFromGroup(groupEnrollment.group.id)
 }
 disabled={isRemoving}
 loading={isRemoving}
 >
 {isRemoving
 ? t('studentDetail.removing')
 : t('studentDetail.remove')}
 </GlassButton>
 )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent attendance card */}
        <div className="glass-card overflow-hidden">
          <div className="border-b border-[var(--border-subtle)] px-5 py-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              {t('studentDetail.recentAttendance')}
            </h2>
          </div>
          {studentAttendance.length === 0 ? (
            <EmptyState
              title={t('attendance.empty')}
              message={t('studentDetail.attendanceEmptyHint')}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>{t('common.date')}</TH>
                    <TH>{t('common.status')}</TH>
                    <TH>{t('attendance.col.source')}</TH>
                  </TR>
                </THead>
                <TBody>
                  {studentAttendance.slice(0, 10).map((attendance) => (
                    <TR
                      key={attendance.id}
                      className="transition-colors hover:bg-[var(--state-hover)]"
                    >
                      <TD className="whitespace-nowrap">
                        {formatDate(attendance.date)}
                      </TD>
                      <TD>
                        <Badge color={statusColor(attendance.status)}>
                          {t(`attendance.${attendance.status.toLowerCase()}`)}
                        </Badge>
                      </TD>
                      <TD>{attendance.source}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Payments card */}
        <div className="glass-card overflow-hidden">
          <div className="border-b border-[var(--border-subtle)] px-5 py-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              {t('payments.title')}
            </h2>
          </div>
          {studentPayments.length === 0 ? (
            <EmptyState
              title={t('payments.empty')}
              message={t('studentDetail.paymentsEmptyHint')}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>{t('common.date')}</TH>
                    <TH>{t('common.status')}</TH>
                    <TH className="text-right">{t('payments.col.amount')}</TH>
                  </TR>
                </THead>
                <TBody>
                  {studentPayments.slice(0, 10).map((payment) => (
                    <TR
                      key={payment.id}
                      className="transition-colors hover:bg-[var(--state-hover)]"
                    >
                      <TD className="whitespace-nowrap">
                        {formatDate(payment.createdAt)}
                      </TD>
                      <TD>
                        <Badge color={statusColor(payment.status)}>
                          {t(`payments.status.${payment.status}`)}
                        </Badge>
                      </TD>
                      <TD className="text-right font-medium">
                        {formatCurrency(payment.amount)}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </div>

        {/* Face enrollment card */}
        <div className="glass-card overflow-hidden">
          <div className="border-b border-[var(--border-subtle)] px-5 py-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              {t('studentDetail.faceEnrollment')}
            </h2>
          </div>
          {myEnrollments.length === 0 ? (
            <EmptyState
              title={t('studentDetail.notEnrolled')}
              message={t('studentDetail.enrollHint')}
              action={
                <GlassButton
                  type="button"
                  variant="primary"
                  onClick={handleEnrollFace}
                >
                  {t('studentDetail.enrollFace')}
                </GlassButton>
              }
            />
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              {myEnrollments.map((enrollment) => (
                <div
                  key={enrollment.id}
                  className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-[var(--state-hover)]"
                >
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {t('studentDetail.enrollment')}
                    </p>
                    <p className="text-xs text-[var(--text-primary)]">
                      {formatDate(enrollment.enrolledAt)}
                    </p>
                  </div>
                  <Badge color={statusColor(enrollment.status)}>
                    {t(`enum.status.${enrollment.status}`)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Assign to group modal */}
      <Modal
        open={assignOpen}
        onClose={handleCloseAssign}
        title={t('studentDetail.assignToGroup')}
      >
        <Field label={t('exams.form.group')} required>
          <Select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            aria-label={t('studentDetail.selectGroupAria')}
          >
            <option value="">{t('studentDetail.selectGroupPlaceholder')}</option>
            {activeGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="mt-4 flex justify-end gap-2">
          <GlassButton
            type="button"
            variant="secondary"
            onClick={handleCloseAssign}
            disabled={assign.isPending}
          >
            {t('common.cancel')}
          </GlassButton>
          <GlassButton
            type="button"
            variant="primary"
            disabled={!groupId || assign.isPending}
            onClick={handleAssign}
          >
            {assign.isPending
              ? t('studentDetail.assigning')
              : t('studentDetail.assign')}
          </GlassButton>
        </div>
      </Modal>

      <ConfirmDialog
        open={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        onConfirm={confirmRemoveFromGroup}
        description={t('studentDetail.removeConfirm')}
        loading={removeFromGroup.isPending}
      />

      {toastNode}
      </div>
    </>
  );
}