import { useState, useCallback, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { faceApi, studentsApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys.factory';
import { GlassPageHeader, GlassBadge, GlassPageLoader, GlassErrorState, GlassEmptyState, GlassField, GlassSelect, GlassButton, ConfirmDialog, useToasts, statusColor } from '@/components/ui';
import { WebcamCapture } from '@/components/WebcamCapture';
import { formatDate } from '@/lib/format';
import { friendlyFaceError } from '@/lib/faceErrors';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, Student, FaceEnrollment, FaceEnrollmentStatus } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';
import { translate } from '@/i18n';

const FACE_ENROLLMENT_EN_FALLBACK: Record<string, string> = {
  'faceEnrollment.startEnrollment': 'Start enrollment',
  'faceEnrollment.starting': 'Starting…',
  'faceEnrollment.inProgress': 'Enrollment in progress: {id}',
};

function useT(): (key: string, vars?: Record<string, string | number>) => string {
  try {
    const { t } = useI18n();
    return t;
  } catch {
    return (key: string, vars?: Record<string, string | number>) => {
      const viaEn = translate('en', key, vars);
      if (viaEn !== key) return viaEn;
      const template = FACE_ENROLLMENT_EN_FALLBACK[key];
      if (!template) return key;
      if (!vars) return template;
      return template.replace(/\{(\w+)\}/g, (match, name: string) =>
        name in vars ? String(vars[name]) : match,
      );
    };
  }
}

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

const FACE_ENROLLMENT_STATUS_KEYS: Record<FaceEnrollmentStatus, string> = {
  PENDING: 'faceEnrollment.status.PENDING',
  ACTIVE: 'faceEnrollment.status.ACTIVE',
  REVOKED: 'faceEnrollment.status.REVOKED',
  EXPIRED: 'faceEnrollment.status.EXPIRED',
};

function getEnrollmentStatusBadge(status: FaceEnrollmentStatus): { color: string; labelKey: string } {
  return {
    color: statusColor(status),
    labelKey: FACE_ENROLLMENT_STATUS_KEYS[status] ?? '',
  };
}

function truncateEnrollmentId(id: string, maxLength = 8): string {
  return id.length > maxLength ? `${id.slice(0, maxLength)}…` : id;
}

export function FaceEnrollmentPage() {
  const t = useT();
  usePageTitle(t('faceEnrollment.title'));
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();

  // Form state
  const [form, setForm] = useState<EnrollmentFormState>(INITIAL_FORM);
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof EnrollmentFormState, string>>
  >({});

  // Reference to track if enrollment was just started
  const enrollmentStartedRef = useRef(false);

  // Invalidation helper
  const invalidateFaceQueries = () => {
    qc.invalidateQueries({ queryKey: queryKeys.face.enrollments() });
    qc.invalidateQueries({ queryKey: queryKeys.face.studentEnrollments() });
    qc.invalidateQueries({ queryKey: queryKeys.students.faces() });
    qc.invalidateQueries({ queryKey: queryKeys.students.details() });
    qc.invalidateQueries({ queryKey: queryKeys.students.all() });
  };

  // Data fetching
  const students = useQuery({
    queryKey: queryKeys.students.faces(),
    queryFn: () => studentsApi.list({ limit: 100 }),
    placeholderData: (previousData) => previousData,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const enrollments = useQuery({
    queryKey: queryKeys.face.enrollments(),
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
      push('success', t('faceEnrollment.startedToast'));
      invalidateFaceQueries();
    },
    onError: (e: Error) => {
      push('error', friendlyFaceError(e));
    },
  });

  // Capture face mutation
  const capture = useMutation({
    mutationFn: (b64: string) => faceApi.capture(form.enrollmentId, b64),
    onSuccess: () => {
      push('success', t('faceEnrollment.capturedToast'));
      invalidateFaceQueries();
    },
    onError: (e: Error) => {
      push('error', friendlyFaceError(e));
    },
  });

  // Revoke enrollment mutation
  const revoke = useMutation({
    mutationFn: (id: string) => faceApi.revoke(id, 'operator_revoked'),
    onSuccess: () => {
      push('success', t('faceEnrollment.revokedToast'));
      invalidateFaceQueries();
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
      setFormErrors({ studentId: t('faceEnrollment.selectStudentError') });
      return;
    }
    start.mutate();
  }, [form.studentId, start, t]);

  const handleCapture = useCallback(
    (b64: string) => {
      if (!form.enrollmentId) {
        push('error', t('faceEnrollment.noActiveSession'));
        return;
      }
      capture.mutate(b64);
    },
    [form.enrollmentId, capture, push, t],
  );

  const handleCancelEnrollment = useCallback(async () => {
    if (form.enrollmentId) {
      try {
        await faceApi.cancelPending(form.enrollmentId);
      } catch (err) {
        console.error('Failed to cancel pending enrollment', err);
      }
    }
    setForm((prev) => ({ ...prev, enrollmentId: '' }));
    enrollmentStartedRef.current = false;
    push('info', t('faceEnrollment.cancelledToast'));
  }, [form.enrollmentId, push, t]);

  const handleRevoke = useCallback((enrollmentId: string) => {
    setRevokeTarget(enrollmentId);
  }, []);

  const confirmRevoke = useCallback(() => {
    if (!revokeTarget) return;
    revoke.mutate(revokeTarget);
    setRevokeTarget(null);
  }, [revokeTarget, revoke]);

  const { refetch: refetchEnrollments } = enrollments;
  const handleRetryEnrollments = useCallback(() => {
    void refetchEnrollments();
  }, [refetchEnrollments]);

  // Check if any mutation is pending
  const isStartPending = start.isPending;
  const isCapturePending = capture.isPending;
  const isRevoking = revoke.isPending;

  return (
    <div style={{ display: "contents" }}>
      <div className="page-container space-y-6">
        <GlassPageHeader
          title={t('faceEnrollment.title')}
          subtitle={t('faceEnrollment.subtitle')}
        />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* New enrollment */}
        <div className="glass-card">
          <div className="border-b px-5 py-4" style={{ borderColor: 'var(--border-subtle)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {t('faceEnrollment.newEnrollment')}
            </h2>
          </div>
          <div className="p-5">
            <div className="space-y-4">
              <GlassField label={t('faceEnrollment.student')} required error={formErrors.studentId}>
                <GlassSelect
                  value={form.studentId}
                  onChange={handleStudentChange}
                  aria-invalid={Boolean(formErrors.studentId)}
                  aria-describedby={
                    formErrors.studentId ? 'student-error' : undefined
                  }
                  disabled={isStartPending || isCapturePending}
                >
                  <option value="">{t('faceEnrollment.selectStudent')}</option>
                  {studentList.map((student) => (
                    <option key={student.id} value={student.id}>
                      {formatStudentName(student)}
                    </option>
                  ))}
                </GlassSelect>
                {formErrors.studentId && (
                  <span id="student-error" className="mt-1 text-sm" style={{ color: 'var(--state-error)' }}>
                    {formErrors.studentId}
                  </span>
                )}
              </GlassField>

              {!form.enrollmentId ? (
                <GlassButton
                  type="button"
                  variant="primary"
                  className="w-full"
                  onClick={handleStartEnrollment}
                  disabled={!form.studentId || isStartPending}
                >
                  {isStartPending ? t('faceEnrollment.starting') : t('faceEnrollment.startEnrollment')}
                </GlassButton>
              ) : (
                <div className="space-y-3">
 <div className="flex items-center justify-between">
 <GlassBadge color="green">
 {t('faceEnrollment.inProgress', { id: truncateEnrollmentId(form.enrollmentId) })}
 </GlassBadge>
 <GlassButton
 type="button"
 variant="ghost"
 size="sm"
 onClick={handleCancelEnrollment}
 disabled={isCapturePending}
 >
 {t('common.cancel')}
 </GlassButton>
 </div>

                  <WebcamCapture
                    onCapture={handleCapture}
                    busy={isCapturePending}
                    label={t('faceEnrollment.captureFace')}
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
                {t('faceEnrollment.pipelineHint')}
              </p>
            </div>
          </div>
        </div>

        {/* Existing enrollments */}
        <div className="glass-card">
          <div className="border-b px-5 py-4" style={{ borderColor: 'var(--border-subtle)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {t('faceEnrollment.listTitle')}
            </h2>
          </div>

          {enrollments.isLoading && !enrollments.data ? (
            <div className="p-8">
              <GlassPageLoader label={t('faceEnrollment.loading')} />
            </div>
          ) : enrollments.isError ? (
            <div className="p-8">
              <GlassErrorState
                title={t('faceEnrollment.loadError')}
                message={getErrorMessage(enrollments.error as Error)}
                onRetry={handleRetryEnrollments}
              />
            </div>
          ) : enrollmentList.length === 0 ? (
            <GlassEmptyState
              title={t('faceEnrollment.empty')}
              message={t('faceEnrollment.emptyHint')}
            />
          ) : (
            <div className="glass-table-wrap">
              <table className="glass-table">
                <thead>
                  <tr>
                    <th>{t('faceEnrollment.student')}</th>
                    <th>{t('common.status')}</th>
                    <th>{t('faceEnrollment.enrolled')}</th>
                    <th style={{ textAlign: 'right' }}>{t('common.actions')}</th>
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
                          <GlassBadge color={statusBadge.color}>
                            {statusBadge.labelKey ? t(statusBadge.labelKey) : enrollment.status}
                          </GlassBadge>
                        </td>
                        <td className="whitespace-nowrap">
                          {formatDate(enrollment.enrolledAt)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {enrollment.status === 'ACTIVE' && (
                            <GlassButton
                              type="button"
                              variant="danger"
                              size="sm"
                              onClick={() => handleRevoke(enrollment.id)}
                              disabled={isRevokingThis}
                            >
                              {isRevokingThis ? t('faceEnrollment.revoking') : t('faceEnrollment.revoke')}
                            </GlassButton>
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

      <ConfirmDialog
        open={revokeTarget !== null}
        onClose={() => setRevokeTarget(null)}
        onConfirm={confirmRevoke}
        description={t('faceEnrollment.revokeConfirm')}
        loading={revoke.isPending}
      />

      {toastNode}
      </div>
    </div>
  );
}