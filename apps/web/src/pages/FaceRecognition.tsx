import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { faceApi, groupsApi } from '@/lib/api';
import {
  PageHeader,
  Badge,
  PageLoader,
  ErrorState,
  EmptyState,
  useToasts,
  statusColor,
  Field,
  Select,
} from '@/components/ui';
import { WebcamCapture } from '@/components/WebcamCapture';
import { formatDateTime } from '@/lib/format';
import { friendlyFaceError } from '@/lib/faceErrors';
import { getErrorMessage } from '@/lib/errorMessages';
import { usePageTitle } from '@/hooks/usePageTitle';
import type {
  Paginated,
  RecognitionAttempt,
  RecognitionSession,
  Group,
  FaceEngineStatus,
} from '@/lib/types';

interface RecognitionFormState {
  sessionId: string;
  groupId: string;
}

interface RecognitionResult {
  student?: {
    user?: {
      firstName?: string;
      lastName?: string;
    };
  };
  status: string;
  confidence?: number;
  livenessResult?: string;
}

const INITIAL_FORM: RecognitionFormState = {
  sessionId: '',
  groupId: '',
};

function formatStudentName(student: { user?: { firstName?: string; lastName?: string }; firstName?: string; lastName?: string } | null | undefined): string {
  if (!student) return '—';
  if (student.firstName) return [student.firstName, student.lastName].filter(Boolean).join(' ') || '—';
  if (student.user) return [student.user.firstName, student.user.lastName].filter(Boolean).join(' ') || '—';
  return '—';
}

export function formatConfidence(confidence: string | number | null | undefined): string {
  if (!confidence && confidence !== 0) return '—';
  // The backend sends either a numeric similarity score (0–1) or a
  // categorical confidence string ('HIGH' | 'MEDIUM' | 'LOW' | 'NONE') for
  // the live attempt result. Numeric → percentage; categorical → as-is.
  if (typeof confidence === 'string') {
    if (['HIGH', 'MEDIUM', 'LOW', 'NONE'].includes(confidence)) return confidence;
    const numeric = parseFloat(confidence);
    if (!Number.isNaN(numeric)) return `${(numeric * 100).toFixed(0)}%`;
    return confidence;
  }
  return `${(confidence * 100).toFixed(0)}%`;
}

function formatLivenessResult(result: string | null | undefined): string {
  if (!result) return '—';
  return result.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function truncateSessionId(id: string, maxLength = 8): string {
  return id.length > maxLength ? `${id.slice(0, maxLength)}…` : id;
}

function formatRecognitionResult(result: unknown): RecognitionResult | null {
  if (!result) return null;
  return result as RecognitionResult;
}

export function FaceRecognitionPage() {
  usePageTitle('Face Recognition');
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();

  // Form state
  const [form, setForm] = useState<RecognitionFormState>(INITIAL_FORM);
  const [result, setResult] = useState<unknown>(null);

  // Data fetching
  const engine = useQuery({
    queryKey: ['face-engine'],
    queryFn: faceApi.engineStatus,
    placeholderData: (previousData) => previousData,
  });

  const groups = useQuery({
    queryKey: ['face-groups'],
    queryFn: () => groupsApi.list({ limit: 100 }),
    placeholderData: (previousData) => previousData,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const history = useQuery({
    queryKey: ['face-history'],
    queryFn: () => faceApi.recognitionHistory({ limit: 20 }),
    placeholderData: (previousData) => previousData,
  });

  const groupList = useMemo(
    () => (groups.data as Paginated<Group> | undefined)?.items || [],
    [groups.data],
  );

  const activeGroups = useMemo(
    () => groupList.filter((group) => group.isActive),
    [groupList],
  );

  const engineStatus = engine.data as FaceEngineStatus | undefined;
  const historyData = history.data as Paginated<RecognitionAttempt> | undefined;
  const historyList = useMemo(() => historyData?.items || [], [historyData]);

  // Start session mutation
  const startSession = useMutation({
    mutationFn: () => faceApi.startSession({ groupId: form.groupId || undefined }),
    onSuccess: (res) => {
      const session = res as RecognitionSession;
      // Backend POST /face/sessions returns { sessionId, status } (not { id }).
      setForm((prev) => ({ ...prev, sessionId: session.sessionId ?? session.id }));
      setResult(null);
      push('success', 'Recognition session started');
    },
    onError: (e: Error) => {
      push('error', friendlyFaceError(e));
    },
  });

  // Submit attempt mutation
  const submit = useMutation({
    mutationFn: (b64: string) => faceApi.submitAttempt(form.sessionId, b64),
    onSuccess: (res) => {
      setResult(res);
      push('success', 'Attempt processed');
      qc.invalidateQueries({ queryKey: ['face-history'] });
    },
    onError: (e: Error) => {
      push('error', friendlyFaceError(e));
    },
  });

  // Finish session mutation
  const finish = useMutation({
    mutationFn: () => faceApi.finishSession(form.sessionId, 'operator_finished'),
    onSuccess: () => {
      push('success', 'Session finished');
      setForm((prev) => ({ ...prev, sessionId: '' }));
      setResult(null);
      qc.invalidateQueries({ queryKey: ['face-history'] });
    },
    onError: (e: Error) => {
      push('error', friendlyFaceError(e));
    },
  });

  // Form handlers
  const handleGroupChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, groupId: e.target.value }));
    },
    [],
  );

  const handleStartSession = useCallback(() => {
    startSession.mutate();
  }, [startSession]);

  const handleFinishSession = useCallback(() => {
    finish.mutate();
  }, [finish]);

  const handleCapture = useCallback(
    (b64: string) => {
      if (!form.sessionId) {
        push('error', 'No active recognition session');
        return;
      }
      submit.mutate(b64);
    },
    [form.sessionId, submit, push],
  );

  const { refetch: refetchHistory } = history;
  const handleRetryHistory = useCallback(() => {
    void refetchHistory();
  }, [refetchHistory]);

  const { refetch: refetchEngine } = engine;
  const handleRetryEngine = useCallback(() => {
    void refetchEngine();
  }, [refetchEngine]);

  // Derived state
  const isSessionActive = Boolean(form.sessionId);
  const isMockEngine = engineStatus ? !engineStatus.isReal : false;
  const recognitionResult = formatRecognitionResult(result);

  return (
    <div className="orb-container">
      <div className="orb orb-cyan-1" />
      <div className="orb orb-cyan-2" />
      <div className="orb orb-indigo-1" />
      <div className="orb orb-deep-1" />
      <div className="page-container space-y-6">
        <PageHeader
          title="Face Recognition"
          subtitle="Live recognition sessions with liveness checks"
        />

      {/* Engine status and session controls */}
      <div className="glass-card">
        <div className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Engine:</span>
              {engine.isLoading && !engineStatus ? (
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</span>
              ) : engine.isError ? (
                <button
                  type="button"
                  className="text-sm font-medium"
                  style={{ color: 'var(--state-error)' }}
                  onClick={handleRetryEngine}
                >
                  Failed to load — retry
                </button>
              ) : engineStatus ? (
                <Badge color={engineStatus.isReal ? 'green' : 'amber'}>
                  {engineStatus.provider || 'unknown'}
                </Badge>
              ) : null}
            </div>

            {isSessionActive ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Badge color="green">Session active</Badge>
                <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                  {truncateSessionId(form.sessionId)}
                </span>
                <button
                  type="button"
                  className="glass-btn glass-btn-secondary glass-btn-sm"
                  onClick={handleFinishSession}
                  disabled={finish.isPending}
                >
                  {finish.isPending ? 'Finishing…' : 'Finish session'}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <Field label="Group (optional)">
                  <Select
                    value={form.groupId}
                    onChange={handleGroupChange}
                    className="w-full sm:w-48"
                    aria-label="Select group for recognition"
                    disabled={startSession.isPending}
                  >
                    <option value="">Any group</option>
                    {activeGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <button
                  type="button"
                  className="glass-btn glass-btn-primary glass-btn-sm"
                  onClick={handleStartSession}
                  disabled={startSession.isPending}
                >
                  {startSession.isPending
                    ? 'Starting…'
                    : 'Start recognition session'}
                </button>
              </div>
            )}
          </div>

          {isMockEngine && (
            <div
              className="mt-3 rounded-lg px-4 py-3 text-xs"
              style={{ background: 'rgba(245,184,106,0.12)', color: '#c07828' }}
              role="note"
            >
              Mock engine is active (development only). Production requires the
              real ONNX engine with liveness.
            </div>
          )}

          {startSession.isError && (
            <div
              className="mt-3 rounded-lg px-4 py-3 text-sm"
              style={{ background: 'rgba(240,112,112,0.12)', color: '#d04545' }}
              role="alert"
            >
              {friendlyFaceError(startSession.error as Error)}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Capture section */}
        <div className="glass-card">
          <div className="border-b px-5 py-4" style={{ borderColor: 'var(--border-subtle)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {isSessionActive ? 'Submit a capture' : 'Start a session first'}
            </h2>
          </div>
          <div className="p-5">
            {isSessionActive ? (
              <WebcamCapture
                onCapture={handleCapture}
                busy={submit.isPending}
                label="Recognize face"
              />
            ) : (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Start a recognition session to begin capturing faces for
                attendance.
              </p>
            )}

            {submit.isError && (
              <div
                className="mt-4 rounded-lg px-4 py-3 text-sm"
                style={{ background: 'rgba(240,112,112,0.12)', color: '#d04545' }}
                role="alert"
              >
                {friendlyFaceError(submit.error as Error)}
              </div>
            )}

            {recognitionResult && (
              <div className="mt-4 space-y-3 rounded-lg p-4" style={{ background: 'var(--bg-glass)' }}>
                <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                  Recognition result
                </h3>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Student</span>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {formatStudentName(recognitionResult.student)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Status</span>
                    <Badge color={statusColor(recognitionResult.status)}>
                      {recognitionResult.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Confidence</span>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {formatConfidence(recognitionResult.confidence)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Liveness</span>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {formatLivenessResult(recognitionResult.livenessResult)}
                    </span>
                  </div>
                </div>

                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                    View raw response
                  </summary>
                  <pre className="mt-2 whitespace-pre-wrap rounded p-3 font-mono text-xs" style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </div>
        </div>

        {/* History section */}
        <div className="glass-card">
          <div className="border-b px-5 py-4" style={{ borderColor: 'var(--border-subtle)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Recognition history
            </h2>
          </div>

          {history.isLoading && !historyData ? (
            <div className="p-8">
              <PageLoader label="Loading history…" />
            </div>
          ) : history.isError ? (
            <div className="p-8">
              <ErrorState
                title="Failed to load recognition history"
                message={getErrorMessage(history.error as Error)}
                onRetry={handleRetryHistory}
              />
            </div>
          ) : historyList.length === 0 ? (
            <EmptyState
              title="No recognition attempts"
              message="Attempts will appear here after sessions run."
            />
          ) : (
            <div className="glass-table-wrap">
              <table className="glass-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Student</th>
                    <th>Status</th>
                    <th>Confidence</th>
                    <th>Liveness</th>
                  </tr>
                </thead>
                <tbody>
                  {historyList.slice(0, 15).map((attempt) => (
                    <tr key={attempt.id}>
                      <td className="whitespace-nowrap">
                        {formatDateTime(attempt.occurredAt)}
                      </td>
                      <td className="font-medium" style={{ color: 'var(--text-primary)' }}>
                        {formatStudentName(attempt.student)}
                      </td>
                      <td>
                        <Badge color={statusColor(attempt.status)}>
                          {attempt.status}
                        </Badge>
                      </td>
                      <td>{formatConfidence(attempt.confidence)}</td>
                      <td>{formatLivenessResult(attempt.livenessResult)}</td>
                    </tr>
                  ))}
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