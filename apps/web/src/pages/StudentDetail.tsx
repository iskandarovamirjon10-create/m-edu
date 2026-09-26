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
  Input,
} from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
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

  const { user } = useAuth();
  const canManageParents = ['SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER'].includes(user?.role || '');

  // Parent Management State
  const [parentModalOpen, setParentModalOpen] = useState(false);
  const [editLinkModalOpen, setEditLinkModalOpen] = useState(false);
  const [unlinkParentTarget, setUnlinkParentTarget] = useState<{ id: string; name: string } | null>(null);
  const [editingLink, setEditingLink] = useState<{
    id: string;
    parentId: string;
    relationship?: string;
    isPrimary?: boolean;
    canViewGrades?: boolean;
    canViewPayments?: boolean;
    canViewAttendance?: boolean;
  } | null>(null);

  // Form states for creating / linking parent
  const [parentFirstName, setParentFirstName] = useState('');
  const [parentLastName, setParentLastName] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [parentRelationship, setParentRelationship] = useState('parent');
  const [parentPassword, setParentPassword] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [canViewGrades, setCanViewGrades] = useState(true);
  const [canViewPayments, setCanViewPayments] = useState(true);
  const [canViewAttendance, setCanViewAttendance] = useState(true);

  // Edit link states
  const [editRelationship, setEditRelationship] = useState('parent');
  const [editIsPrimary, setEditIsPrimary] = useState(false);
  const [editCanViewGrades, setEditCanViewGrades] = useState(true);
  const [editCanViewPayments, setEditCanViewPayments] = useState(true);
  const [editCanViewAttendance, setEditCanViewAttendance] = useState(true);

  // Parent query
  const parentsQuery = useQuery({
    queryKey: ['student-parents', id],
    queryFn: () => studentsApi.getParents(id!),
    enabled: !!id,
  });

  const linkedParents = useMemo(() => parentsQuery.data || [], [parentsQuery.data]);

  const addParentMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        firstName: parentFirstName.trim(),
        lastName: parentLastName.trim(),
        email: parentEmail.trim().toLowerCase(),
        phone: parentPhone.trim() || undefined,
        relationship: parentRelationship,
        isPrimary,
        canViewGrades,
        canViewPayments,
        canViewAttendance,
      };
      if (parentPassword.trim()) {
        payload.password = parentPassword.trim();
      }
      return studentsApi.addParent(id!, payload);
    },
    onSuccess: () => {
      push('success', 'Parent account linked successfully');
      setParentModalOpen(false);
      setParentFirstName('');
      setParentLastName('');
      setParentEmail('');
      setParentPhone('');
      setParentPassword('');
      setIsPrimary(false);
      qc.invalidateQueries({ queryKey: ['student-parents', id] });
      qc.invalidateQueries({ queryKey: ['student', id] });
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
    },
  });

  const updateParentLinkMutation = useMutation({
    mutationFn: async () => {
      if (!editingLink) throw new Error('No parent link selected');
      return studentsApi.updateParent(id!, editingLink.parentId, {
        relationship: editRelationship,
        isPrimary: editIsPrimary,
        canViewGrades: editCanViewGrades,
        canViewPayments: editCanViewPayments,
        canViewAttendance: editCanViewAttendance,
      });
    },
    onSuccess: () => {
      push('success', 'Parent permissions updated successfully');
      setEditLinkModalOpen(false);
      setEditingLink(null);
      qc.invalidateQueries({ queryKey: ['student-parents', id] });
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
    },
  });

  const unlinkParentMutation = useMutation({
    mutationFn: (parentId: string) => studentsApi.unlinkParent(id!, parentId),
    onSuccess: () => {
      push('success', 'Parent unlinked successfully');
      setUnlinkParentTarget(null);
      qc.invalidateQueries({ queryKey: ['student-parents', id] });
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
    },
  });

  const openEditParentModal = useCallback((link: any) => {
    setEditingLink(link);
    setEditRelationship(link.relationship || 'parent');
    setEditIsPrimary(link.isPrimary ?? false);
    setEditCanViewGrades(link.canViewGrades ?? true);
    setEditCanViewPayments(link.canViewPayments ?? true);
    setEditCanViewAttendance(link.canViewAttendance ?? true);
    setEditLinkModalOpen(true);
  }, []);

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

        {/* Parent / Guardian Accounts Card */}
        <div className="glass-card overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                {t('studentForm.parentSection')}
              </h2>
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                Manage linked parent portal accounts, access permissions, and emergency contacts
              </p>
            </div>
            {canManageParents && (
              <GlassButton
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setParentModalOpen(true)}
              >
                + Add / Invite Parent
              </GlassButton>
            )}
          </div>
          <div className="p-5">
            {parentsQuery.isLoading ? (
              <div className="py-8 flex justify-center items-center">
                <PageLoader />
              </div>
            ) : parentsQuery.isError ? (
              <ErrorState
                title="Failed to load parent accounts"
                message={getErrorMessage(parentsQuery.error)}
                onRetry={() => parentsQuery.refetch()}
              />
            ) : linkedParents.length > 0 ? (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border-subtle)] text-xs text-[var(--text-tertiary)]">
                        <th className="pb-2 font-medium">Parent</th>
                        <th className="pb-2 font-medium">Contact</th>
                        <th className="pb-2 font-medium">Relationship</th>
                        <th className="pb-2 font-medium">Permissions</th>
                        <th className="pb-2 font-medium">Status</th>
                        {canManageParents && <th className="pb-2 font-medium text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)]">
                      {linkedParents.map((link: any) => {
                        const p = link.parent;
                        return (
                          <tr key={link.id} className="hover:bg-[var(--bg-glass-hover)] transition-colors">
                            <td className="py-3 pr-4">
                              <div className="font-medium text-[var(--text-primary)]">
                                {p ? `${p.firstName} ${p.lastName}` : 'Parent User'}
                                {link.isPrimary && (
                                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    Primary
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-[var(--text-tertiary)]">
                                {p?.email}
                              </div>
                            </td>
                            <td className="py-3 pr-4 text-[var(--text-secondary)]">
                              {p?.phone || '—'}
                            </td>
                            <td className="py-3 pr-4 capitalize text-[var(--text-secondary)]">
                              {link.relationship || 'Parent'}
                            </td>
                            <td className="py-3 pr-4">
                              <div className="flex flex-wrap gap-1">
                                {link.canViewGrades && (
                                  <Badge color="blue">Grades</Badge>
                                )}
                                {link.canViewAttendance && (
                                  <Badge color="green">Attendance</Badge>
                                )}
                                {link.canViewPayments && (
                                  <Badge color="purple">Payments</Badge>
                                )}
                              </div>
                            </td>
                            <td className="py-3 pr-4">
                              <Badge color={p?.isActive ? 'green' : 'slate'}>
                                {p?.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </td>
                            {canManageParents && (
                              <td className="py-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <GlassButton
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openEditParentModal(link)}
                                  >
                                    Edit
                                  </GlassButton>
                                  <GlassButton
                                    type="button"
                                    variant="danger"
                                    size="sm"
                                    onClick={() =>
                                      setUnlinkParentTarget({
                                        id: link.parentId,
                                        name: p ? `${p.firstName} ${p.lastName}` : 'this parent',
                                      })
                                    }
                                  >
                                    Unlink
                                  </GlassButton>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--border-subtle)] p-6 text-center">
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  No parent portal accounts linked yet
                </p>
                <p className="mt-1 text-xs text-[var(--text-tertiary)] max-w-md mx-auto">
                  Link a parent or guardian to grant them secure access to view this student's attendance records, academic progress, and payment history.
                </p>
                {canManageParents && (
                  <div className="mt-4">
                    <GlassButton
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => setParentModalOpen(true)}
                    >
                      + Add / Invite Parent
                    </GlassButton>
                  </div>
                )}
              </div>
            )}

            {/* Offline / Legacy Student Contact Info */}
            {studentData && (studentData.parentName || studentData.parentPhone || studentData.parentEmail) && (
              <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
                <h3 className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
                  Emergency Contact on File (Student Record)
                </h3>
                <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-[var(--text-tertiary)]">{t('common.name')}</dt>
                    <dd className="mt-0.5 font-medium text-[var(--text-primary)]">
                      {studentData.parentName || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--text-tertiary)]">{t('common.phone')}</dt>
                    <dd className="mt-0.5 font-medium text-[var(--text-primary)]">
                      {studentData.parentPhone || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--text-tertiary)]">{t('common.email')}</dt>
                    <dd className="mt-0.5 font-medium text-[var(--text-primary)]">
                      {studentData.parentEmail || '—'}
                    </dd>
                  </div>
                </dl>
              </div>
            )}

            {studentData?.notes && (
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

      {/* Add / Invite Parent Modal */}
      <Modal
        open={parentModalOpen}
        onClose={() => setParentModalOpen(false)}
        title="Add or Link Parent Account"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="First Name" required>
              <Input
                type="text"
                placeholder="e.g. John"
                value={parentFirstName}
                onChange={(e) => setParentFirstName(e.target.value)}
              />
            </Field>
            <Field label="Last Name" required>
              <Input
                type="text"
                placeholder="e.g. Doe"
                value={parentLastName}
                onChange={(e) => setParentLastName(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Parent Email Address" required>
            <Input
              type="email"
              placeholder="e.g. parent@example.com"
              value={parentEmail}
              onChange={(e) => setParentEmail(e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Phone Number">
              <Input
                type="tel"
                placeholder="+998..."
                value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value)}
              />
            </Field>
            <Field label="Relationship">
              <Select
                value={parentRelationship}
                onChange={(e) => setParentRelationship(e.target.value)}
              >
                <option value="parent">Parent</option>
                <option value="father">Father</option>
                <option value="mother">Mother</option>
                <option value="guardian">Guardian</option>
                <option value="other">Other</option>
              </Select>
            </Field>
          </div>

          <Field label="Temporary Password" hint="Optional. If omitted, a secure temporary password will be auto-generated.">
            <Input
              type="password"
              placeholder="Minimum 6 characters"
              value={parentPassword}
              onChange={(e) => setParentPassword(e.target.value)}
            />
          </Field>

          <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
            <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
              Access & Permissions
            </p>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--text-primary)]">
              <input
                type="checkbox"
                checked={isPrimary}
                onChange={(e) => setIsPrimary(e.target.checked)}
                className="rounded border-[var(--border-medium)] text-indigo-600 focus:ring-indigo-500"
              />
              <span>Primary Guardian</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--text-primary)]">
              <input
                type="checkbox"
                checked={canViewGrades}
                onChange={(e) => setCanViewGrades(e.target.checked)}
                className="rounded border-[var(--border-medium)] text-indigo-600 focus:ring-indigo-500"
              />
              <span>Can View Academic Grades</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--text-primary)]">
              <input
                type="checkbox"
                checked={canViewAttendance}
                onChange={(e) => setCanViewAttendance(e.target.checked)}
                className="rounded border-[var(--border-medium)] text-indigo-600 focus:ring-indigo-500"
              />
              <span>Can View Attendance Logs</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--text-primary)]">
              <input
                type="checkbox"
                checked={canViewPayments}
                onChange={(e) => setCanViewPayments(e.target.checked)}
                className="rounded border-[var(--border-medium)] text-indigo-600 focus:ring-indigo-500"
              />
              <span>Can View Tuition & Invoices</span>
            </label>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <GlassButton
              type="button"
              variant="secondary"
              onClick={() => setParentModalOpen(false)}
              disabled={addParentMutation.isPending}
            >
              Cancel
            </GlassButton>
            <GlassButton
              type="button"
              variant="primary"
              disabled={
                !parentFirstName.trim() ||
                !parentLastName.trim() ||
                !parentEmail.trim() ||
                addParentMutation.isPending
              }
              onClick={() => addParentMutation.mutate()}
            >
              {addParentMutation.isPending ? 'Linking...' : 'Link Parent'}
            </GlassButton>
          </div>
        </div>
      </Modal>

      {/* Edit Parent Link Modal */}
      <Modal
        open={editLinkModalOpen}
        onClose={() => setEditLinkModalOpen(false)}
        title="Edit Parent Permissions"
      >
        <div className="space-y-4">
          <Field label="Relationship">
            <Select
              value={editRelationship}
              onChange={(e) => setEditRelationship(e.target.value)}
            >
              <option value="parent">Parent</option>
              <option value="father">Father</option>
              <option value="mother">Mother</option>
              <option value="guardian">Guardian</option>
              <option value="other">Other</option>
            </Select>
          </Field>

          <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
            <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
              Access & Permissions
            </p>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--text-primary)]">
              <input
                type="checkbox"
                checked={editIsPrimary}
                onChange={(e) => setEditIsPrimary(e.target.checked)}
                className="rounded border-[var(--border-medium)] text-indigo-600 focus:ring-indigo-500"
              />
              <span>Primary Guardian</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--text-primary)]">
              <input
                type="checkbox"
                checked={editCanViewGrades}
                onChange={(e) => setEditCanViewGrades(e.target.checked)}
                className="rounded border-[var(--border-medium)] text-indigo-600 focus:ring-indigo-500"
              />
              <span>Can View Academic Grades</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--text-primary)]">
              <input
                type="checkbox"
                checked={editCanViewAttendance}
                onChange={(e) => setEditCanViewAttendance(e.target.checked)}
                className="rounded border-[var(--border-medium)] text-indigo-600 focus:ring-indigo-500"
              />
              <span>Can View Attendance Logs</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--text-primary)]">
              <input
                type="checkbox"
                checked={editCanViewPayments}
                onChange={(e) => setEditCanViewPayments(e.target.checked)}
                className="rounded border-[var(--border-medium)] text-indigo-600 focus:ring-indigo-500"
              />
              <span>Can View Tuition & Invoices</span>
            </label>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <GlassButton
              type="button"
              variant="secondary"
              onClick={() => setEditLinkModalOpen(false)}
              disabled={updateParentLinkMutation.isPending}
            >
              Cancel
            </GlassButton>
            <GlassButton
              type="button"
              variant="primary"
              disabled={updateParentLinkMutation.isPending}
              onClick={() => updateParentLinkMutation.mutate()}
            >
              {updateParentLinkMutation.isPending ? 'Saving...' : 'Save Changes'}
            </GlassButton>
          </div>
        </div>
      </Modal>

      {/* Unlink Parent Confirm Dialog */}
      <ConfirmDialog
        open={unlinkParentTarget !== null}
        onClose={() => setUnlinkParentTarget(null)}
        onConfirm={() => unlinkParentTarget && unlinkParentMutation.mutate(unlinkParentTarget.id)}
        title="Unlink Parent Account"
        description={`Are you sure you want to unlink ${unlinkParentTarget?.name || 'this parent'} from this student? The parent account will remain in the system, but will no longer have access to this student.`}
        confirmLabel="Unlink"
        loading={unlinkParentMutation.isPending}
      />

      {toastNode}
      </div>
    </>
  );
}