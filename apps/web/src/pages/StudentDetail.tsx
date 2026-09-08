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
  Select,
  useToasts,
  statusColor,
  Field,
  Badge,
} from '@/components/ui';
import { fullName, formatDate, formatCurrency } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, Student, Group } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';

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

interface FaceEnrollmentItem {
  id: string;
  status: string;
  enrolledAt: string;
}

function formatStudentStatus(isActive: boolean | undefined): { color: string; label: string } {
  return isActive === false
    ? { color: 'red', label: 'Inactive' }
    : { color: 'green', label: 'Active' };
}

function formatGroupStatus(isActive: boolean): { color: string; label: string } {
  return isActive
    ? { color: 'green', label: 'Active' }
    : { color: 'slate', label: 'Inactive' };
}

export function StudentDetailPage() {
  usePageTitle('Student Details');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();

  // Modal state
  const [assignOpen, setAssignOpen] = useState(false);
  const [groupId, setGroupId] = useState('');

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
      push('success', 'Student assigned to group successfully');
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
      push('success', 'Student removed from group');
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

  const handleRemoveFromGroup = useCallback(
    (groupIdToRemove: string) => {
      if (
        window.confirm(
          'Are you sure you want to remove this student from the group?',
        )
      ) {
        removeFromGroup.mutate(groupIdToRemove);
      }
    },
    [removeFromGroup],
  );

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
          <PageHeader title="Student" subtitle="Loading student details…" />
          <div className="glass-card p-8">
            <PageLoader label="Loading student…" />
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
          <PageHeader title="Student" subtitle="Student details" />
          <div className="glass-card p-8">
            <ErrorState
              title="Student not found"
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
            <button
              type="button"
              className="glass-btn-secondary"
              onClick={handleEdit}
            >
              Edit
            </button>
            <button
              type="button"
              className="glass-btn-primary"
              onClick={handleOpenAssign}
            >
              Assign to group
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Profile card */}
        <div className="glass-card overflow-hidden lg:col-span-1">
          <div className="border-b border-[var(--border-subtle)] px-5 py-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Profile</h2>
          </div>
          <div className="p-5">
            <dl className="space-y-4">
              <div className="flex items-start justify-between">
                <dt className="text-sm text-[var(--text-primary)]">Date of birth</dt>
                <dd className="text-sm font-medium text-[var(--text-primary)]">
                  {formatDate(studentData.dateOfBirth)}
                </dd>
              </div>
              <div className="flex items-start justify-between">
                <dt className="text-sm text-[var(--text-primary)]">Gender</dt>
                <dd className="text-sm font-medium text-[var(--text-primary)]">
                  {studentData.gender || '—'}
                </dd>
              </div>
              <div className="flex items-start justify-between">
                <dt className="text-sm text-[var(--text-primary)]">Address</dt>
                <dd className="text-sm font-medium text-[var(--text-primary)]">
                  {studentData.address || '—'}
                </dd>
              </div>
              <div className="flex items-start justify-between">
                <dt className="text-sm text-[var(--text-primary)]">Phone</dt>
                <dd className="text-sm font-medium text-[var(--text-primary)]">
                  {studentData.user?.phone || '—'}
                </dd>
              </div>
              <div className="flex items-start justify-between">
                <dt className="text-sm text-[var(--text-primary)]">Status</dt>
                <dd>
                  <Badge color={studentStatus.color}>
                    {studentStatus.label}
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
              Parent / Guardian
            </h2>
          </div>
          <div className="p-5">
            <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-[var(--text-primary)]">Name</dt>
                <dd className="mt-1 font-medium text-[var(--text-primary)]">
                  {studentData.parentName || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--text-primary)]">Phone</dt>
                <dd className="mt-1 font-medium text-[var(--text-primary)]">
                  {studentData.parentPhone || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--text-primary)]">Email</dt>
                <dd className="mt-1 font-medium text-[var(--text-primary)]">
                  {studentData.parentEmail || '—'}
                </dd>
              </div>
            </dl>
            {studentData.notes && (
              <div className="mt-4 rounded-lg glass-card p-4 text-sm text-[var(--text-primary)]">
                <span className="font-medium">Notes: </span>
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
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Groups</h2>
            <button
              type="button"
              className="text-xs font-medium text-[#2f4d9b] hover:text-[#3a5ab0] dark:text-[#e7e7cd] dark:hover:text-white"
              onClick={handleOpenAssign}
            >
              Assign
            </button>
          </div>
          {studentGroups.length === 0 ? (
            <EmptyState
              title="Not assigned to any group"
              message="Assign this student to a group to get started."
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
                          Room {groupEnrollment.group.room}
                        </p>
                      )}
                    </div>
                    <div className="ml-4 flex shrink-0 items-center gap-2">
                      <Badge color={groupStatus.color}>
                        {groupStatus.label}
                      </Badge>
                      {groupEnrollment.isActive && (
                        <button
                          type="button"
                          className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                          onClick={() =>
                            handleRemoveFromGroup(groupEnrollment.group.id)
                          }
                          disabled={isRemoving}
                        >
                          {isRemoving ? 'Removing…' : 'Remove'}
                        </button>
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
              Recent attendance
            </h2>
          </div>
          {studentAttendance.length === 0 ? (
            <EmptyState
              title="No attendance records"
              message="Attendance will appear here after it is recorded."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Date</TH>
                    <TH>Status</TH>
                    <TH>Source</TH>
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
                          {attendance.status}
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
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Payments</h2>
          </div>
          {studentPayments.length === 0 ? (
            <EmptyState
              title="No payments"
              message="Payments for this student appear here."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Date</TH>
                    <TH>Status</TH>
                    <TH className="text-right">Amount</TH>
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
                          {payment.status}
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
              Face enrollment
            </h2>
          </div>
          {myEnrollments.length === 0 ? (
            <EmptyState
              title="Not enrolled"
              message="Enroll this student's face to enable automatic recognition attendance."
              action={
                <button
                  type="button"
                  className="glass-btn-primary"
                  onClick={handleEnrollFace}
                >
                  Enroll face
                </button>
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
                      Enrollment
                    </p>
                    <p className="text-xs text-[var(--text-primary)]">
                      {formatDate(enrollment.enrolledAt)}
                    </p>
                  </div>
                  <Badge color={statusColor(enrollment.status)}>
                    {enrollment.status}
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
        title="Assign to group"
      >
        <Field label="Group" required>
          <Select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            aria-label="Select group to assign"
          >
            <option value="">Select a group…</option>
            {activeGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="glass-btn-secondary"
            onClick={handleCloseAssign}
            disabled={assign.isPending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="glass-btn-primary"
            disabled={!groupId || assign.isPending}
            onClick={handleAssign}
          >
            {assign.isPending ? 'Assigning…' : 'Assign'}
          </button>
        </div>
      </Modal>

      {toastNode}
      </div>
    </>
  );
}