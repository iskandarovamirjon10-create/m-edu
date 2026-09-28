import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { faceApi, groupsApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys.factory';
import { GlassPageHeader, GlassBadge, GlassPageLoader, GlassErrorState, GlassEmptyState, useToasts, statusColor, GlassField, GlassSelect, GlassButton } from '@/components/ui';
import { WebcamCapture } from '@/components/WebcamCapture';
import { formatDateTime } from '@/lib/format';
import { friendlyFaceError } from '@/lib/faceErrors';
import { getErrorMessage } from '@/lib/errorMessages';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';
import { translate } from '@/i18n';
import type {
  Paginated,
  RecognitionAttempt,
  RecognitionSession,
  Group,
  FaceEngineStatus,
} from '@/lib/types';

const FACE_RECOGNITION_EN_FALLBACK: Record<string, string> = {
  'faceRecognition.startSession': 'Start recognition session',
  'faceRecognition.starting': 'Starting…',
  'faceRecognition.sessionActive': 'Session active',
  'faceRecognition.finishSession': 'Finish session',
  'faceRecognition.finishing': 'Finishing…',
};

function useT(): (key: string, vars?: Record<string, string | number>) => string {
  try {
    const { t } = useI18n();
    return t;
  } catch {
    return (key: string, vars?: Record<string, string | number>) => {
      const viaEn = translate('en', key, vars);

      if (viaEn !== key) return viaEn;

      const template = FACE_RECOGNITION_EN_FALLBACK[key];

      if (!template) return key;
      if (!vars) return template;

      return template.replace(/\{(\w+)\}/g, (match, name: string) =>
        name in vars ? String(vars[name]) : match,
      );
    };
  }
}

interface RecognitionFormState {
  sessionId: string;
  groupId: string;
}

interface RecognitionResult {
  student?: {
    firstName?: string;
    lastName?: string;
    user?: {
      firstName?: string;
      lastName?: string;
    };
  };
  status: string;
  confidence?: number | string;
  livenessResult?: string;
}

const INITIAL_FORM: RecognitionFormState = {
  sessionId: '',
  groupId: '',
};

function formatStudentName(
  student:
    | {
        user?: {
          firstName?: string;
          lastName?: string;
        };
        firstName?: string;
        lastName?: string;
      }
    | null
    | undefined,
): string {
  if (!student) return '—';

  if (student.firstName) {
    return [student.firstName, student.lastName].filter(Boolean).join(' ') || '—';
  }

  if (student.user) {
    return [student.user.firstName, student.user.lastName].filter(Boolean).join(' ') || '—';
  }

  return '—';
}

export function formatConfidence(
  confidence: string | number | null | undefined,
): string {
  if (!confidence && confidence !== 0) return '—';

  if (typeof confidence === 'string') {
    if (['HIGH', 'MEDIUM', 'LOW', 'NONE'].includes(confidence)) {
      return confidence;
    }

    const numeric = parseFloat(confidence);

    if (!Number.isNaN(numeric)) {
      return `${(numeric * 100).toFixed(0)}%`;
    }

    return confidence;
  }

  return `${(confidence * 100).toFixed(0)}%`;
}

function formatLivenessResult(result: string | null | undefined): string {
  if (!result) return '—';

  return result
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function truncateSessionId(id: string, maxLength = 10): string {
  return id.length > maxLength ? `${id.slice(0, maxLength)}…` : id;
}

function formatRecognitionResult(result: unknown): RecognitionResult | null {
  if (!result || typeof result !== 'object') return null;

  return result as RecognitionResult;
}

function CameraIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 7.75A1.75 1.75 0 0 1 5.75 6h2.1l1.05-1.5h2.2L12.15 6h2.1A1.75 1.75 0 0 1 16 7.75v8.5A1.75 1.75 0 0 1 14.25 18h-8.5A1.75 1.75 0 0 1 4 16.25v-8.5Z"
      />
      <circle cx="10" cy="12" r="2.75" />
      <path strokeLinecap="round" d="m16 9 3-1.5v9L16 15" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m12 3 1.35 5.65L19 10l-5.65 1.35L12 17l-1.35-5.65L5 10l5.65-1.35L12 3Z"
      />
      <path strokeLinecap="round" d="m19 16 .55 2.45L22 19l-2.45.55L19 22l-.55-2.45L16 19l2.45-.55L19 16Z" />
    </svg>
  );
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-2 w-2 rounded-full ${
        active ? 'bg-emerald-500' : 'bg-amber-500'
      }`}
    />
  );
}

export function FaceRecognitionPage() {
  const t = useT();

  usePageTitle(t('faceRecognition.title'));

  const { push, toastNode } = useToasts();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<RecognitionFormState>(INITIAL_FORM);
  const [result, setResult] = useState<unknown>(null);

  const engine = useQuery({
    queryKey: queryKeys.face.engine(),
    queryFn: faceApi.engineStatus,
    placeholderData: (previousData) => previousData,
  });

  const groups = useQuery({
    queryKey: queryKeys.groups.selectors(),
    queryFn: () => groupsApi.list({ limit: 100 }),
    placeholderData: (previousData) => previousData,
    staleTime: 5 * 60 * 1000,
  });

  const history = useQuery({
    queryKey: queryKeys.face.history(),
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

  const historyList = useMemo(
    () => historyData?.items || [],
    [historyData],
  );

  const startSession = useMutation({
    mutationFn: () =>
      faceApi.startSession({
        groupId: form.groupId || undefined,
      }),

    onSuccess: (response) => {
      const session = response as RecognitionSession;

      setForm((previous) => ({
        ...previous,
        sessionId: session.sessionId ?? session.id,
      }));

      setResult(null);
      push('success', t('faceRecognition.sessionStarted'));
    },

    onError: (error: Error) => {
      push('error', friendlyFaceError(error));
    },
  });

  const submit = useMutation({
    mutationFn: (base64: string) =>
      faceApi.submitAttempt(form.sessionId, base64),

    onSuccess: (response) => {
      setResult(response);
      push('success', t('faceRecognition.attemptProcessed'));

      queryClient.invalidateQueries({
        queryKey: queryKeys.face.history(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.attendance.all(),
      });
      queryClient.invalidateQueries({
        queryKey: ['attendance-analytics'],
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.all(),
      });
    },

    onError: (error: Error) => {
      push('error', friendlyFaceError(error));
    },
  });

  const finish = useMutation({
    mutationFn: () =>
      faceApi.finishSession(form.sessionId, 'operator_finished'),

    onSuccess: () => {
      push('success', t('faceRecognition.sessionFinished'));

      setForm((previous) => ({
        ...previous,
        sessionId: '',
      }));

      setResult(null);

      queryClient.invalidateQueries({
        queryKey: queryKeys.face.history(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.attendance.all(),
      });
      queryClient.invalidateQueries({
        queryKey: ['attendance-analytics'],
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.all(),
      });
    },

    onError: (error: Error) => {
      push('error', friendlyFaceError(error));
    },
  });

  const handleGroupChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      setForm((previous) => ({
        ...previous,
        groupId: event.target.value,
      }));
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
    (base64: string) => {
      if (!form.sessionId) {
        push('error', t('faceRecognition.noSession'));
        return;
      }

      submit.mutate(base64);
    },
    [form.sessionId, push, submit, t],
  );

  const handleRetryHistory = useCallback(() => {
    void history.refetch();
  }, [history]);

  const handleRetryEngine = useCallback(() => {
    void engine.refetch();
  }, [engine]);

  const isSessionActive = Boolean(form.sessionId);
  const isMockEngine = engineStatus ? !engineStatus.isReal : false;
  const recognitionResult = formatRecognitionResult(result);

  return (
    <div className="page-container space-y-6 pb-8">
      <GlassPageHeader
        title={t('faceRecognition.title')}
        subtitle={t('faceRecognition.subtitle')}
      />

      <section
        className="glass-card relative overflow-hidden"
        aria-label={t('faceRecognition.engineLabel')}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full opacity-30 blur-3xl"
          style={{
            background:
              'radial-gradient(circle, rgba(91,141,239,.35), transparent 68%)',
          }}
        />

        <div className="relative p-5 sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{
                  background: 'var(--bg-elevated)',
                  color: 'var(--accent-primary)',
                }}
              >
                <SparkIcon />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2
                    className="text-sm font-semibold"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {t('faceRecognition.engineLabel')}
                  </h2>

                  {engine.isLoading && !engineStatus && (
                    <span
                      className="text-xs"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {t('common.loading')}
                    </span>
                  )}

                  {engine.isError && (
                    <GlassButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-600"
                      onClick={handleRetryEngine}
                    >
                      {t('faceRecognition.engineRetry')}
                    </GlassButton>
                  )}

                  {engineStatus && (
                    <GlassBadge color={engineStatus.isReal ? 'green' : 'amber'}>
                      <span className="mr-1.5 inline-flex align-middle">
                        <StatusDot active={engineStatus.isReal} />
                      </span>
                      {engineStatus.provider || t('common.unknown')}
                    </GlassBadge>
                  )}
                </div>

                <p
                  className="mt-1 max-w-xl text-xs leading-5"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {isSessionActive
                    ? t('faceRecognition.sessionActive')
                    : t('faceRecognition.startFirst')}
                </p>
              </div>
            </div>

            {isSessionActive ? (
              <div
                className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center"
                style={{
                  borderColor: 'var(--border-subtle)',
                  background: 'var(--bg-glass)',
                }}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <GlassBadge color="green">
                    {t('faceRecognition.sessionActive')}
                  </GlassBadge>

                  <span
                    className="truncate font-mono text-xs"
                    style={{ color: 'var(--text-muted)' }}
                    title={form.sessionId}
                  >
                    {truncateSessionId(form.sessionId)}
                  </span>
                </div>

                <GlassButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleFinishSession}
                  disabled={finish.isPending}
                  aria-busy={finish.isPending}
                >
                  {finish.isPending
                    ? t('faceRecognition.finishing')
                    : t('faceRecognition.finishSession')}
                </GlassButton>
              </div>
            ) : (
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end">
                <GlassField label={t('faceRecognition.groupOptional')}>
                  <GlassSelect
                    value={form.groupId}
                    onChange={handleGroupChange}
                    className="w-full sm:min-w-52"
                    aria-label={t('faceRecognition.groupSelectAria')}
                    disabled={startSession.isPending}
                  >
                    <option value="">
                      {t('faceRecognition.anyGroup')}
                    </option>

                    {activeGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </GlassSelect>
                </GlassField>

                <GlassButton
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleStartSession}
                  disabled={startSession.isPending}
                  aria-busy={startSession.isPending}
                >
                  {startSession.isPending
                    ? t('faceRecognition.starting')
                    : t('faceRecognition.startSession')}
                </GlassButton>
              </div>
            )}
          </div>

          {isMockEngine && (
            <div
              className="mt-5 flex items-start gap-2 rounded-xl px-4 py-3 text-xs leading-5"
              style={{
                background: 'rgba(245,184,106,0.12)',
                color: '#c07828',
              }}
              role="note"
            >
              <span aria-hidden="true">ⓘ</span>
              <span>{t('faceRecognition.mockNotice')}</span>
            </div>
          )}

          {startSession.isError && (
            <div
              className="mt-4 rounded-xl px-4 py-3 text-sm"
              style={{
                background: 'rgba(240,112,112,0.12)',
                color: '#d04545',
              }}
              role="alert"
            >
              {friendlyFaceError(startSession.error as Error)}
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,.92fr)]">
        <section className="glass-card overflow-hidden">
          <div
            className="flex items-center justify-between border-b px-5 py-4 sm:px-6"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{
                  background: 'var(--bg-elevated)',
                  color: 'var(--accent-primary)',
                }}
              >
                <CameraIcon />
              </div>

              <div>
                <h2
                  className="text-sm font-semibold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {isSessionActive
                    ? t('faceRecognition.submitCapture')
                    : t('faceRecognition.startFirst')}
                </h2>

                <p
                  className="mt-0.5 text-xs"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {isSessionActive
                    ? t('faceRecognition.recognizeFace')
                    : t('faceRecognition.captureHint')}
                </p>
              </div>
            </div>

            {isSessionActive && <GlassBadge color="green">Live</GlassBadge>}
          </div>

          <div className="p-5 sm:p-6">
            {isSessionActive ? (
              <div
                className="overflow-hidden rounded-2xl"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div className="relative">
                  <WebcamCapture
                    onCapture={handleCapture}
                    busy={submit.isPending}
                    label={t('faceRecognition.recognizeFace')}
                  />
                  {isMockEngine && (
                    <div className="absolute top-4 right-4 bg-[var(--state-warning)] text-white text-xs font-bold px-3 py-1 rounded-full uppercase shadow-md">
                      Simulation Mode
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div
                className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed px-6 text-center"
                style={{
                  borderColor: 'var(--border-subtle)',
                  background: 'var(--bg-glass)',
                }}
              >
                <div
                  className="mb-3 flex h-12 w-12 items-center justify-center rounded-full"
                  style={{
                    background: 'var(--bg-elevated)',
                    color: 'var(--text-muted)',
                  }}
                >
                  <CameraIcon />
                </div>

                <p
                  className="max-w-sm text-sm leading-6"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {t('faceRecognition.captureHint')}
                </p>
              </div>
            )}

            {submit.isError && (
              <div
                className="mt-4 rounded-xl px-4 py-3 text-sm"
                style={{
                  background: 'rgba(240,112,112,0.12)',
                  color: '#d04545',
                }}
                role="alert"
              >
                {friendlyFaceError(submit.error as Error)}
              </div>
            )}

            {recognitionResult && (
              <div
                className="mt-5 rounded-2xl border p-4 sm:p-5"
                style={{
                  background: 'var(--bg-glass)',
                  borderColor: 'var(--border-subtle)',
                }}
                role="status"
                aria-live="polite"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3
                    className="text-xs font-semibold uppercase tracking-[0.12em]"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {t('faceRecognition.resultTitle')}
                  </h3>

                  <span
                    className="text-xs"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {t('common.status')}
                  </span>
                </div>

                <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0">
                    <span
                      className="text-sm"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {t('faceRecognition.student')}
                    </span>

                    <span
                      className="text-right text-sm font-semibold"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {formatStudentName(recognitionResult.student)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <span
                      className="text-sm"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {t('common.status')}
                    </span>

                    <GlassBadge color={statusColor(recognitionResult.status)}>
                      {recognitionResult.status}
                    </GlassBadge>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <span
                      className="text-sm"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {t('faceRecognition.confidence')}
                    </span>

                    <span
                      className="text-sm font-semibold"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {formatConfidence(recognitionResult.confidence)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 py-3 last:pb-0">
                    <span
                      className="text-sm"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {t('faceRecognition.liveness')}
                    </span>

                    <span
                      className="text-sm font-semibold"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {formatLivenessResult(recognitionResult.livenessResult)}
                    </span>
                  </div>
                </div>

                <details className="mt-4 border-t pt-4" style={{ borderColor: 'var(--border-subtle)' }}>
                  <summary
                    className="cursor-pointer select-none text-xs font-medium outline-none transition-colors hover:opacity-80 focus-visible:ring-2 focus-visible:ring-blue-500"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {t('faceRecognition.viewRaw')}
                  </summary>

                  <pre
                    className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl p-3 font-mono text-xs"
                    style={{
                      background: 'var(--bg-elevated)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </div>
        </section>

        <section className="glass-card min-w-0 overflow-hidden">
          <div
            className="flex items-center justify-between border-b px-5 py-4 sm:px-6"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <div>
              <h2
                className="text-sm font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                {t('faceRecognition.historyTitle')}
              </h2>

              <p
                className="mt-1 text-xs"
                style={{ color: 'var(--text-muted)' }}
              >
                {historyList.length > 0 ? `${historyList.length} records` : ''}
              </p>
            </div>

            {history.isFetching && !history.isLoading && (
              <span
                className="text-xs"
                style={{ color: 'var(--text-muted)' }}
              >
                {t('common.loading')}
              </span>
            )}
          </div>

          {history.isLoading && !historyData ? (
            <div className="p-8">
              <GlassPageLoader label={t('faceRecognition.loadingHistory')} />
            </div>
          ) : history.isError ? (
            <div className="p-8">
              <GlassErrorState
                title={t('faceRecognition.historyError')}
                message={getErrorMessage(history.error as Error)}
                onRetry={handleRetryHistory}
              />
            </div>
          ) : historyList.length === 0 ? (
            <div className="p-5 sm:p-6">
              <GlassEmptyState
                title={t('faceRecognition.emptyHistory')}
                message={t('faceRecognition.emptyHistoryHint')}
              />
            </div>
          ) : (
            <div className="glass-table-wrap overflow-x-auto">
              <table className="glass-table min-w-[680px]">
                <caption className="sr-only">
                  {t('faceRecognition.historyTitle')}
                </caption>

                <thead>
                  <tr>
                    <th>{t('faceRecognition.colTime')}</th>
                    <th>{t('faceRecognition.colStudent')}</th>
                    <th>{t('common.status')}</th>
                    <th>{t('faceRecognition.confidence')}</th>
                    <th>{t('faceRecognition.liveness')}</th>
                  </tr>
                </thead>

                <tbody>
                  {historyList.slice(0, 15).map((attempt) => (
                    <tr key={attempt.id}>
                      <td className="whitespace-nowrap text-xs">
                        {formatDateTime(attempt.occurredAt)}
                      </td>

                      <td
                        className="font-medium"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {formatStudentName(attempt.student)}
                      </td>

                      <td>
                        <GlassBadge color={statusColor(attempt.status)}>
                          {attempt.status}
                        </GlassBadge>
                      </td>

                      <td>{formatConfidence(attempt.confidence)}</td>

                      <td>{formatLivenessResult(attempt.livenessResult)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {toastNode}
    </div>
  );
}
