import { useState, useCallback, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { faceApi, studentsApi } from '@/lib/api';
import {
  PageHeader,
  Badge,
  PageLoader,
  ErrorState,
  EmptyState,
  Field,
  Select,
  useToasts,
  statusColor,
} from '@/components/ui';
import { WebcamCapture } from '@/components/WebcamCapture';
import { formatDate } from '@/lib/format';
import { friendlyFaceError } from '@/lib/faceErrors';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, Student, FaceEnrollment, FaceEnrollmentStatus } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';

interface EnrollmentFormState {
  studentId: string;
  enrollmentId: string;
}

const INITIAL_FORM: EnrollmentFormState = {
  studentId: '',
  enrollmentId: '',
};

function formatStudentName(
  student:
    | { user?: { firstName?: string; lastName?: string } }
    | { firstName?: string; lastName?: string }
    | undefined,
): string {
  if (!student) return '—';
  const nested = 'user' in student ? (student as { user?: { firstName?: string; lastName?: string } }).user : undefined;
  const direct = student as { firstName?: string; lastName?: string };
  const firstName = nested?.firstName ?? direct.firstName;
  const lastName = nested?.lastName ?? direct.lastName;
  return [firstName, lastName].filter(Boolean).join(' ') || '—';
}

function getEnrollmentStatusBadge(status: FaceEnrollmentStatus): { color: string; label: string } {
  return {
    color: statusColor(status),
    label: status,
  };
}

function truncateEnrollmentId(id: string, maxLength = 8): string {
  return id.length > maxLength ? `${id.slice(0, maxLength)}…` : id;
}

export function FaceEnrollmentPage() {
  usePageTitle('Face Enrollment');
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();

  // Form state
  const [form, setForm] = useState<EnrollmentFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof EnrollmentFormState, string>>
  >({});

  // Reference to track if enrollment was just started
  const enrollmentStartedRef = useRef(false);

  // Data fetching
  const students = useQuery({
    queryKey: ['students-face'],
    queryFn: () => studentsApi.list({ limit: 100 }),
    placeholderData: (previousData) => previousData,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const enrollments = useQuery({
    queryKey: ['enrollments'],
    queryFn: () => faceApi.enrollments({ limit: 100 }),
    placeholderData: (previousData) => previousData,
  });

  const studentList = useMemo(
    () => (students.data as Paginated<Student> | undefined)?.items || [],
    [students.data],
  );

  const enrollmentList = useMemo(
    () => (enrollments.data as Paginated<FaceEnrollment> | undefined)?.items || [],
    [enrollments.data],
  );

  // Start enrollment mutation
  const start = useMutation({
    mutationFn: () => faceApi.startEnrollment(form.studentId),
    onSuccess: (res) => {
      const enrollment = res as FaceEnrollment;
      // Backend POST /face/enrollments returns { enrollmentId, status } (not { id }).
      setForm((prev) => ({ ...prev, enrollmentId: enrollment.enrollmentId ?? enrollment.id }));
      enrollmentStartedRef.current = true;
      push('success', 'Enrollment started — capture the face now');
      qc.invalidateQueries({ queryKey: ['enrollments'] });
    },
    onError: (e: Error) => {
      push('error', friendlyFaceError(e));
    },
  });

  // Capture face mutation
  const capture = useMutation({
    mutationFn: (b64: string) => faceApi.capture(form.enrollmentId, b64),
    onSuccess: () => {
      push('success', 'Face captured and processed successfully');
      qc.invalidateQueries({ queryKey: ['enrollments'] });
    },
    onError: (e: Error) => {
      push('error', friendlyFaceError(e));
    },
  });

  // Revoke enrollment mutation
  const revoke = useMutation({
    mutationFn: (id: string) => faceApi.revoke(id, 'operator_revoked'),
    onSuccess: () => {
      push('success', 'Enrollment revoked successfully');
      qc.invalidateQueries({ queryKey: ['enrollments'] });
    },
    onError: (e: Error) => {
      push('error', friendlyFaceError(e));
    },
  });

  // Form handlers
  const handleStudentChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setForm((prev) => ({
        ...prev,
        studentId: e.target.value,
        enrollmentId: '', // Reset enrollment when student changes
      }));
      setFormErrors((prev) => ({ ...prev, studentId: undefined }));
      enrollmentStartedRef.current = false;
    },
    [],
  );

  const handleStartEnrollment = useCallback(() => {
    if (!form.studentId) {
      setFormErrors({ studentId: 'Please select a student' });
      return;
    }
    start.mutate();
  }, [form.studentId, start]);

  const handleCapture = useCallback(
    (b64: string) => {
      if (!form.enrollmentId) {
        push('error', 'No active enrollment session');
        return;
      }
      capture.mutate(b64);
    },
    [form.enrollmentId, capture, push],
  );

  const handleCancelEnrollment = useCallback(() => {
    setForm((prev) => ({ ...prev, enrollmentId: '' }));
    enrollmentStartedRef.current = false;
    push('info', 'Enrollment cancelled');
  }, [push]);

  const handleRevoke = useCallback(
    (enrollmentId: string) => {
      if (
        window.confirm(
          'Are you sure you want to revoke this enrollment? This action cannot be undone.',
        )
      ) {
        revoke.mutate(enrollmentId);
      }
    },
    [revoke],
  );

  const { refetch: refetchEnrollments } = enrollments;
  const handleRetryEnrollments = useCallback(() => {
    void refetchEnrollments();
  }, [refetchEnrollments]);

  // Check if any mutation is pending
  const isStartPending = start.isPending;
  const isCapturePending = capture.isPending;
  const isRevoking = revoke.isPending;

  return (
    <div className="orb-container">
      <div className="orb orb-cyan-1" />
      <div className="orb orb-cyan-2" />
      <div className="orb orb-indigo-1" />
      <div className="orb orb-deep-1" />
      <div className="page-container space-y-6">
        <PageHeader
          title="Face Enrollment"
          subtitle="Enroll students for automatic recognition attendance"
        />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* New enrollment */}
        <div className="glass-card">
          <div className="border-b px-5 py-4" style={{ borderColor: 'var(--border-subtle)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              New enrollment
            </h2>
          </div>
          <div className="p-5">
            <div className="space-y-4">
              <Field label="Student" required error={formErrors.studentId}>
                <Select
                  value={form.studentId}
                  onChange={handleStudentChange}
                  aria-invalid={Boolean(formErrors.studentId)}
                  aria-describedby={
                    formErrors.studentId ? 'student-error' : undefined
                  }
                  disabled={isStartPending || isCapturePending}
                >
                  <option value="">Select student…</option>
                  {studentList.map((student) => (
                    <option key={student.id} value={student.id}>
                      {formatStudentName(student)}
                    </option>
                  ))}
                </Select>
                {formErrors.studentId && (
                  <span id="student-error" className="mt-1 text-sm" style={{ color: 'var(--state-error)' }}>
                    {formErrors.studentId}
                  </span>
                )}
              </Field>

              {!form.enrollmentId ? (
                <button
                  type="button"
                  className="glass-btn glass-btn-primary w-full"
                  onClick={handleStartEnrollment}
                  disabled={!form.studentId || isStartPending}
                >
                  {isStartPending ? 'Starting…' : 'Start enrollment'}
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge color="green">
                      Enrollment in progress:{' '}
                      {truncateEnrollmentId(form.enrollmentId)}
                    </Badge>
                    <button
                      type="button"
                      className="text-xs font-medium"
                      style={{ color: 'var(--text-secondary)' }}
                      onClick={handleCancelEnrollment}
                      disabled={isCapturePending}
                    >
                      Cancel
                    </button>
                  </div>

                  <WebcamCapture
                    onCapture={handleCapture}
                    busy={isCapturePending}
                    label="Capture face"
                  />

                  {capture.isError && (
                    <div
                      className="rounded-lg px-4 py-3 text-sm"
                      style={{ background: 'rgba(240,112,112,0.12)', color: '#d04545' }}
                      role="alert"
                    >
                      {friendlyFaceError(capture.error as Error)}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-4 rounded-lg px-4 py-3" style={{ background: 'var(--bg-glass)' }}>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Enrollment pipeline: detect → quality assessment → liveness
                check → embed → encrypt template. Templates are encrypted at
                rest (AES-256-GCM).
              </p>
            </div>
          </div>
        </div>

        {/* Existing enrollments */}
        <div className="glass-card">
          <div className="border-b px-5 py-4" style={{ borderColor: 'var(--border-subtle)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Enrollments
            </h2>
          </div>

          {enrollments.isLoading && !enrollments.data ? (
            <div className="p-8">
              <PageLoader label="Loading enrollments…" />
            </div>
          ) : enrollments.isError ? (
            <div className="p-8">
              <ErrorState
                title="Failed to load enrollments"
                message={getErrorMessage(enrollments.error as Error)}
                onRetry={handleRetryEnrollments}
              />
            </div>
          ) : enrollmentList.length === 0 ? (
            <EmptyState
              title="No enrollments"
              message="Enrolled students appear here."
            />
          ) : (
            <div className="glass-table-wrap">
              <table className="glass-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Status</th>
                    <th>Enrolled</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollmentList.map((enrollment) => {
                    const statusBadge = getEnrollmentStatusBadge(
                      enrollment.status,
                    );
                    const isRevokingThis =
                      isRevoking && revoke.variables === enrollment.id;

                    return (
                      <tr key={enrollment.id}>
                        <td className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          {formatStudentName(enrollment.student)}
                        </td>
                        <td>
                          <Badge color={statusBadge.color}>
                            {statusBadge.label}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap">
                          {formatDate(enrollment.enrolledAt)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {enrollment.status === 'ACTIVE' && (
                            <button
                              type="button"
                              className="glass-btn glass-btn-danger glass-btn-sm"
                              onClick={() => handleRevoke(enrollment.id)}
                              disabled={isRevokingThis}
                            >
                              {isRevokingThis ? 'Revoking…' : 'Revoke'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {toastNode}
      </div>
    </div>
  );
}