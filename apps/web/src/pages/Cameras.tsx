import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { camerasApi } from '@/lib/api';
import {
  PageHeader,
  Badge,
  PageLoader,
  ErrorState,
  EmptyState,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  Field,
  TextInput,
  Select,
  Modal,
  GlassButton,
  ConfirmDialog,
  useToasts,
  statusColor,
  GlassTabs,
} from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Camera, CameraProtocol } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';
import type { TranslateFn } from '@/i18n/I18nProvider';

const CAMERA_PROTOCOLS: CameraProtocol[] = ['RTSP', 'ONVIF'];

const CAMERA_STATUS_LABEL_KEYS: Record<string, string> = {
  CONFIGURED: 'cameras.status.CONFIGURED',
  CONNECTING: 'cameras.status.CONNECTING',
  ONLINE: 'cameras.status.ONLINE',
  ERROR: 'cameras.status.ERROR',
  DISABLED: 'cameras.status.DISABLED',
  RECONNECTING: 'cameras.status.RECONNECTING',
};

interface CameraFormState {
  name: string;
  host: string;
  port: string;
  protocol: CameraProtocol;
  streamPath: string;
  location: string;
  username: string;
  password: string;
}

interface DiscoveredCamera {
  host: string;
  port: number;
  protocol: CameraProtocol;
  name?: string;
}

const INITIAL_FORM: CameraFormState = {
  name: '',
  host: '',
  port: '554',
  protocol: 'RTSP',
  streamPath: '',
  location: '',
  username: '',
  password: '',
};

function formatEndpoint(camera: Camera): string {
  return `${camera.host}:${camera.port}`;
}

function getCameraStatusBadge(camera: Camera): { color: string; label: string } {
  return {
    color: statusColor(camera.status),
    label: camera.status,
  };
}

function getRecognitionBadge(enabled: boolean, t: TranslateFn): { color: string; label: string } {
  return enabled
    ? { color: 'green', label: t('common.on') }
    : { color: 'slate', label: t('common.off') };
}

type TabKey = 'events' | 'health' | 'worker';

function CameraDetailTabs({
  events,
  health,
  workerStatus,
}: {
  events: ReturnType<typeof useQuery>;
  health: ReturnType<typeof useQuery>;
  workerStatus: ReturnType<typeof useQuery>;
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState<TabKey>('events');
  const tabs: { key: TabKey; labelKey: string }[] = [
    { key: 'events', labelKey: 'cameras.tabEvents' },
    { key: 'health', labelKey: 'cameras.tabHealth' },
    { key: 'worker', labelKey: 'cameras.tabWorker' },
  ];

  return (
    <div>
      <GlassTabs
        tabs={tabs.map(tItem => ({ id: tItem.key, label: t(tItem.labelKey) }))}
        active={tab}
        onChange={(id: string) => setTab(id as TabKey)}
      />

      <div className="mt-4">
        {tab === 'events' && (
          <div>
            {events.isLoading ? (
              <PageLoader label={t('cameras.loadingEvents')} />
            ) : events.isError ? (
              <ErrorState message={getErrorMessage(events.error as Error)} />
            ) : (
              <CameraEventsTable data={events.data} />
            )}
          </div>
        )}
        {tab === 'health' && (
          <div>
            {health.isLoading ? (
              <PageLoader label={t('cameras.loadingHealth')} />
            ) : health.isError ? (
              <ErrorState message={getErrorMessage(health.error as Error)} />
            ) : (
              <CameraHealthDisplay data={health.data} />
            )}
          </div>
        )}
        {tab === 'worker' && (
          <div>
            {workerStatus.isLoading ? (
              <PageLoader label={t('cameras.loadingWorker')} />
            ) : workerStatus.isError ? (
              <ErrorState message={getErrorMessage(workerStatus.error as Error)} />
            ) : (
              <CameraWorkerDisplay data={workerStatus.data} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CameraEventsTable({ data }: { data: unknown }) {
  const { t } = useI18n();
  const events = (data as { items?: Array<{ id: string; recognizedAt: string; student?: { user?: { firstName?: string; lastName?: string } }; decision: string; confidence?: string; similarityScore?: string }> })?.items ?? [];
  if (events.length === 0) return <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('cameras.noEvents')}</p>;
  return (
    <div className="overflow-x-auto">
      <Table>
        <THead>
          <TR>
            <TH>{t('cameras.colTime')}</TH>
            <TH>{t('cameras.colStudent')}</TH>
            <TH>{t('cameras.colDecision')}</TH>
            <TH>{t('cameras.colConfidence')}</TH>
            <TH>{t('cameras.colSimilarity')}</TH>
          </TR>
        </THead>
        <TBody>
          {events.map((e) => (
            <TR key={e.id}>
              <TD className="whitespace-nowrap text-xs">{formatDateTime(e.recognizedAt)}</TD>
              <TD>{[e.student?.user?.firstName, e.student?.user?.lastName].filter(Boolean).join(' ') || '—'}</TD>
              <TD><Badge color={e.decision === 'ATTENDANCE_RECORDED' ? 'green' : e.decision === 'BLOCKED' ? 'red' : 'slate'}>{e.decision}</Badge></TD>
              <TD>{e.confidence ?? '—'}</TD>
              <TD>{e.similarityScore ?? '—'}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}

function CameraHealthDisplay({ data }: { data: unknown }) {
  const { t } = useI18n();
  const h = data as Record<string, unknown> | null;
  if (!h) return <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('cameras.noHealth')}</p>;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Object.entries(h).map(([key, val]) => (
        <div key={key} className="glass-card p-3">
          <p className="text-xs text-muted">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
          <p className="mt-1 text-sm font-medium">{String(val ?? '—')}</p>
        </div>
      ))}
    </div>
  );
}

function CameraWorkerDisplay({ data }: { data: unknown }) {
  const { t } = useI18n();
  const w = data as Record<string, unknown> | null;
  if (!w) return <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('cameras.noWorker')}</p>;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Object.entries(w).map(([key, val]) => (
        <div key={key} className="glass-card p-3">
          <p className="text-xs text-muted">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
          <p className="mt-1 text-sm font-medium">{String(val ?? '—')}</p>
        </div>
      ))}
    </div>
  );
}

export function CamerasPage() {
  const { t } = useI18n();
  usePageTitle(t('cameras.title'));
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Camera | null>(null);
  const [configForm, setConfigForm] = useState({ fps: '10', recognitionEnabled: 'true', attendanceEnabled: 'true' });

  // Form states
  const [form, setForm] = useState<CameraFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CameraFormState, string>>>({});
  const [discoverSubnet, setDiscoverSubnet] = useState('');

  // Data fetching
  const cameras = useQuery({
    queryKey: ['cameras'],
    queryFn: () => camerasApi.list({ limit: 100 }),
    placeholderData: (previousData) => previousData,
  });

  const data = cameras.data as { items?: Camera[] } | undefined;
  const list = useMemo(() => data?.items || [], [data]);

  // Create camera mutation
  const create = useMutation({
    mutationFn: () =>
      camerasApi.create({
        name: form.name,
        host: form.host,
        port: parseInt(form.port, 10) || 554,
        protocol: form.protocol,
        streamPath: form.streamPath || undefined,
        location: form.location || undefined,
        username: form.username || undefined,
        password: form.password || undefined,
      }),
    onSuccess: () => {
      push('success', t('cameras.addedToast'));
      setModalOpen(false);
      setForm(INITIAL_FORM);
      setFormErrors({});
      qc.invalidateQueries({ queryKey: ['cameras'] });
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
    },
  });

  // Toggle camera mutation
  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      enabled ? camerasApi.enable(id) : camerasApi.disable(id),
    onSuccess: () => {
      push('success', t('cameras.updatedToast'));
      qc.invalidateQueries({ queryKey: ['cameras'] });
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
    },
  });

  // Start worker mutation
  const startWorker = useMutation({
    mutationFn: (id: string) => camerasApi.startWorker(id),
    onSuccess: () => {
      push('success', t('cameras.workerStartedToast'));
      qc.invalidateQueries({ queryKey: ['cameras'] });
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
    },
  });

  // Discover cameras mutation
  const discover = useMutation({
    mutationFn: () =>
      camerasApi.discover(discoverSubnet ? { subnet: discoverSubnet } : {}),
    onSuccess: () => {
      push('success', t('cameras.discoveryToast'));
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
    },
  });

  const discovered = useMemo(
    () => (discover.data || []) as DiscoveredCamera[],
    [discover.data],
  );

  // Form validation
  const validateForm = useCallback((): boolean => {
    const errors: Partial<Record<keyof CameraFormState, string>> = {};

    if (!form.name.trim()) {
      errors.name = t('cameras.validation.nameRequired');
    }
    if (!form.host.trim()) {
      errors.host = t('cameras.validation.hostRequired');
    }
    if (form.port && (parseInt(form.port, 10) < 1 || parseInt(form.port, 10) > 65535)) {
      errors.port = t('cameras.validation.portRange');
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form, t]);

  // Form handlers
  const handleFormChange = useCallback(
    (field: keyof CameraFormState) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
        setFormErrors((prev) => ({ ...prev, [field]: undefined }));
      },
    [],
  );

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

  const handleCloseDiscover = useCallback(() => {
    setDiscoverOpen(false);
    setDiscoverSubnet('');
  }, []);

  const handleUseDiscovered = useCallback((camera: DiscoveredCamera) => {
    setForm((prev) => ({
      ...prev,
      host: camera.host,
      port: String(camera.port),
      protocol: camera.protocol,
      name: camera.name || prev.name,
    }));
    setDiscoverOpen(false);
    setModalOpen(true);
  }, []);

  const handleToggleCamera = useCallback(
    (camera: Camera) => {
      toggle.mutate({ id: camera.id, enabled: !camera.enabled });
    },
    [toggle],
  );

  const handleStartWorker = useCallback(
    (cameraId: string) => {
      startWorker.mutate(cameraId);
    },
    [startWorker],
  );

  const { refetch: refetchCameras } = cameras;
  const handleRetry = useCallback(() => {
    void refetchCameras();
  }, [refetchCameras]);

  // === Camera detail queries ===
  const selectedCamera = useMemo(
    () => list.find((c) => c.id === selectedCameraId) || null,
    [list, selectedCameraId],
  );

  const cameraEvents = useQuery({
    queryKey: ['camera-events', selectedCameraId],
    queryFn: () => camerasApi.events(selectedCameraId!, { limit: 50 }),
    enabled: !!selectedCameraId,
  });

  const cameraHealth = useQuery({
    queryKey: ['camera-health', selectedCameraId],
    queryFn: () => camerasApi.health(selectedCameraId!),
    enabled: !!selectedCameraId,
  });

  const cameraWorkerStatus = useQuery({
    queryKey: ['camera-worker', selectedCameraId],
    queryFn: () => camerasApi.workerStatus(selectedCameraId!),
    enabled: !!selectedCameraId,
    refetchInterval: 5000,
  });

  // Stop/restart/delete mutations
  const stopWorker = useMutation({
    mutationFn: (id: string) => camerasApi.stopWorker(id),
    onSuccess: () => { push('success', t('cameras.workerStoppedToast')); qc.invalidateQueries({ queryKey: ['cameras'] }); qc.invalidateQueries({ queryKey: ['camera-worker'] }); },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const restartWorker = useMutation({
    mutationFn: (id: string) => camerasApi.restartWorker(id),
    onSuccess: () => { push('success', t('cameras.workerRestartedToast')); qc.invalidateQueries({ queryKey: ['cameras'] }); qc.invalidateQueries({ queryKey: ['camera-worker'] }); },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const deleteCamera = useMutation({
    mutationFn: (id: string) => camerasApi.remove(id),
    onSuccess: () => { push('success', t('cameras.deletedToast')); setSelectedCameraId(null); qc.invalidateQueries({ queryKey: ['cameras'] }); },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const testConnection = useMutation({
    mutationFn: (data: { host: string; port: number }) => camerasApi.testConnection(data),
    onSuccess: () => push('success', t('cameras.connectionToast')),
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const updateConfig = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => camerasApi.config(id, data),
    onSuccess: () => { push('success', t('cameras.configUpdatedToast')); setConfigModalOpen(false); qc.invalidateQueries({ queryKey: ['cameras'] }); },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  // Early return for loading state
  if (cameras.isLoading && !data) {
    return (
      <div className="page-container space-y-4">
        
        <PageHeader
          title={t('cameras.title')}
          subtitle={t('cameras.subtitle')}
        />
        <div className="glass-card p-8">
          <PageLoader label={t('cameras.loading')} />
        </div>
      </div>
    );
  }

  // Early return for error state
  if (cameras.isError) {
    return (
      <div className="page-container space-y-4">
        
        <PageHeader
          title={t('cameras.title')}
          subtitle={t('cameras.subtitle')}
        />
        <div className="glass-card p-8">
          <ErrorState
            title={t('cameras.loadError')}
            message={getErrorMessage(cameras.error as Error)}
            onRetry={handleRetry}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="page-container space-y-4">
      
      <PageHeader
        title={t('cameras.title')}
        subtitle={t('cameras.subtitle')}
        actions={
          <div className="flex flex-col gap-2 sm:flex-row">
            <GlassButton
              type="button"
              variant="secondary"
              onClick={() => setDiscoverOpen(true)}
            >
              {t('cameras.discover')}
            </GlassButton>
            <GlassButton
              type="button"
              variant="primary"
              onClick={() => setModalOpen(true)}
            >
              {t('cameras.add')}
            </GlassButton>
          </div>
        }
      />

      {/* Cameras table */}
      <div className="glass-card overflow-hidden">
        {list.length === 0 ? (
          <EmptyState
            title={t('cameras.empty')}
            message={t('cameras.emptyHint')}
          />
        ) : (
          <div className="glass-table-wrap">
            <Table>
              <THead>
                <TR>
                  <TH>{t('common.name')}</TH>
                  <TH>{t('cameras.endpoint')}</TH>
                  <TH>{t('common.status')}</TH>
                  <TH>{t('cameras.recognition')}</TH>
                  <TH>{t('cameras.lastSeen')}</TH>
                  <TH className="text-right">{t('common.actions')}</TH>
                </TR>
              </THead>
              <TBody>
                {list.map((camera) => {
                  const statusBadge = getCameraStatusBadge(camera);
                  const recognitionBadge = getRecognitionBadge(
                    camera.recognitionEnabled,
                    t,
                  );
                  const isTogglePending =
                    toggle.isPending && toggle.variables?.id === camera.id;
                  const isWorkerPending =
                    startWorker.isPending &&
                    startWorker.variables === camera.id;

                  return (
                    <TR
                      key={camera.id}
                      className={`clickable ${selectedCameraId === camera.id ? 'bg-[rgba(148,234,239,0.10)]' : ''}`}
                      onClick={() => setSelectedCameraId(selectedCameraId === camera.id ? null : camera.id)}
                      tabIndex={0}
                      role="link"
                      aria-label={t('cameras.viewAria', { name: camera.name })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedCameraId(selectedCameraId === camera.id ? null : camera.id);
                        }
                      }}
                    >
                      <TD className="font-medium">
                        {camera.name}
                      </TD>
                      <TD className="font-mono text-xs">
                        {formatEndpoint(camera)}
                      </TD>
                      <TD>
                        <Badge color={statusBadge.color}>
                          {CAMERA_STATUS_LABEL_KEYS[camera.status] ? t(CAMERA_STATUS_LABEL_KEYS[camera.status]) : camera.status}
                        </Badge>
                      </TD>
                      <TD>
                        <Badge color={recognitionBadge.color}>
                          {recognitionBadge.label}
                        </Badge>
                      </TD>
                      <TD className="whitespace-nowrap">
                        {formatDateTime(camera.lastSeenAt)}
                      </TD>
                      <TD className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {camera.status === 'CONFIGURED' && (
                            <GlassButton
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleStartWorker(camera.id)}
                              disabled={isWorkerPending}
                            >
                              {isWorkerPending ? t('cameras.starting') : t('cameras.startWorker')}
                            </GlassButton>
                          )}
                          <GlassButton
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleCamera(camera)}
                            disabled={isTogglePending}
                          >
                            {isTogglePending
                              ? t('common.saving')
                              : camera.enabled
                                ? t('common.disable')
                                : t('common.enable')}
                          </GlassButton>
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </div>
        )}
      </div>

      {/* Camera detail panel */}
      {selectedCamera && (
        <div className="glass-card space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{selectedCamera.name}</h2>
              <p style={{ color: 'var(--text-secondary)' }} className="text-sm">{selectedCamera.host}:{selectedCamera.port} · {selectedCamera.protocol}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedCamera.status === 'ONLINE' && (
                <>
                   <GlassButton onClick={() => restartWorker.mutate(selectedCamera.id)} disabled={restartWorker.isPending}
                    aria-label={t('cameras.restartWorkerAria', { name: selectedCamera.name })}
                    variant="secondary" size="sm">
                    {t('cameras.restartWorker')}
                  </GlassButton>
                  <GlassButton onClick={() => stopWorker.mutate(selectedCamera.id)} disabled={stopWorker.isPending}
                    aria-label={t('cameras.stopWorkerAria', { name: selectedCamera.name })}
                    variant="danger" size="sm">
                    {t('cameras.stopWorker')}
                  </GlassButton>
                </>
              )}
              {(selectedCamera.status === 'CONFIGURED' || selectedCamera.status === 'ERROR') && (
                <GlassButton onClick={() => startWorker.mutate(selectedCamera.id)} disabled={startWorker.isPending}
                  aria-label={t('cameras.startWorkerAria', { name: selectedCamera.name })}
                  variant="primary" size="sm">
                  {t('cameras.startWorkerTitle')}
                </GlassButton>
              )}
              <GlassButton onClick={() => {
                setConfigForm({
                  fps: String((selectedCamera as Camera & { fps?: number }).fps || 10),
                  recognitionEnabled: String(selectedCamera.recognitionEnabled),
                  attendanceEnabled: String(selectedCamera.attendanceEnabled),
                });
                setConfigModalOpen(true);
              }}
                aria-label={t('cameras.configureAria', { name: selectedCamera.name })}
                variant="secondary" size="sm">
                {t('cameras.configure')}
              </GlassButton>
              <GlassButton onClick={() => testConnection.mutate({ host: selectedCamera.host, port: selectedCamera.port })}
                disabled={testConnection.isPending}
                aria-label={t('cameras.testConnectionAria', { name: selectedCamera.name })}
                variant="secondary" size="sm">
                {t('cameras.testConnection')}
              </GlassButton>
              <GlassButton onClick={() => setDeleteTarget(selectedCamera)}
                disabled={deleteCamera.isPending}
                aria-label={t('cameras.deleteAria', { name: selectedCamera.name })}
                variant="danger" size="sm">
                {t('common.delete')}
              </GlassButton>
            </div>
          </div>

          {/* Tabs: Events | Health | Worker Status */}
          <CameraDetailTabs
            events={cameraEvents}
            health={cameraHealth}
            workerStatus={cameraWorkerStatus}
          />
        </div>
      )}

      {/* Config modal */}
      <Modal
        open={modalOpen}
        onClose={handleCloseModal}
        title={t('cameras.add')}
        wide
      >
        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t('cameras.form.name')} required error={formErrors.name}>
              <TextInput
                value={form.name}
                onChange={handleFormChange('name')}
                required
                aria-invalid={Boolean(formErrors.name)}
                aria-describedby={formErrors.name ? 'name-error' : undefined}
                placeholder={t('cameras.form.namePlaceholder')}
              />
              {formErrors.name && (
                <span id="name-error" className="mt-1 text-sm text-red-600">
                  {formErrors.name}
                </span>
              )}
            </Field>
            <Field label={t('cameras.form.protocol')}>
              <Select
                value={form.protocol}
                onChange={handleFormChange('protocol')}
                aria-label={t('cameras.form.protocol')}
              >
                {CAMERA_PROTOCOLS.map((protocol) => (
                  <option key={protocol} value={protocol}>
                    {protocol}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('cameras.form.host')} required error={formErrors.host}>
              <TextInput
                value={form.host}
                onChange={handleFormChange('host')}
                placeholder="192.168.1.100"
                required
                aria-invalid={Boolean(formErrors.host)}
                aria-describedby={formErrors.host ? 'host-error' : undefined}
              />
              {formErrors.host && (
                <span id="host-error" className="mt-1 text-sm text-red-600">
                  {formErrors.host}
                </span>
              )}
            </Field>
            <Field label={t('cameras.form.port')} error={formErrors.port}>
              <TextInput
                type="number"
                value={form.port}
                onChange={handleFormChange('port')}
                min={1}
                max={65535}
                aria-invalid={Boolean(formErrors.port)}
                aria-describedby={formErrors.port ? 'port-error' : undefined}
              />
              {formErrors.port && (
                <span id="port-error" className="mt-1 text-sm text-red-600">
                  {formErrors.port}
                </span>
              )}
            </Field>
            <Field label={t('cameras.form.streamPath')}>
              <TextInput
                value={form.streamPath}
                onChange={handleFormChange('streamPath')}
                placeholder="/Streaming/Channels/101"
              />
            </Field>
            <Field label={t('cameras.form.location')}>
              <TextInput
                value={form.location}
                onChange={handleFormChange('location')}
                placeholder={t('cameras.form.locationPlaceholder')}
              />
            </Field>
            <Field
              label={t('common.username')}
              hint={t('cameras.form.credentialsHint')}
            >
              <TextInput
                value={form.username}
                onChange={handleFormChange('username')}
                autoComplete="off"
              />
            </Field>
            <Field label={t('common.password')}>
              <TextInput
                type="password"
                value={form.password}
                onChange={handleFormChange('password')}
                autoComplete="new-password"
              />
            </Field>
          </div>
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
              {create.isPending ? t('common.saving') : t('cameras.add')}
            </GlassButton>
          </div>
        </form>
      </Modal>

      {/* Discover cameras modal */}
      <Modal
        open={discoverOpen}
        onClose={handleCloseDiscover}
        title={t('cameras.discoverTitle')}
        wide
      >
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t('cameras.discoverHint')}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <TextInput
              value={discoverSubnet}
              onChange={(e) => setDiscoverSubnet(e.target.value)}
              placeholder={t('cameras.subnetPlaceholder')}
              className="flex-1"
              aria-label={t('cameras.subnetAria')}
            />
            <GlassButton
              type="button"
              variant="primary"
              onClick={() => discover.mutate()}
              disabled={discover.isPending}
            >
              {discover.isPending ? t('cameras.scanning') : t('cameras.scan')}
            </GlassButton>
          </div>

          {discover.isError && (
            <div
              className="rounded-lg px-4 py-3 text-sm"
              style={{ border: '1px solid var(--state-error)', background: 'rgba(240,112,112,0.08)', color: 'var(--state-error)' }}
              role="alert"
            >
              {getErrorMessage(discover.error as Error)}
            </div>
          )}

          {discovered.length > 0 ? (
            <div className="glass-table-wrap">
              <Table>
                <THead>
                  <TR>
                    <TH>{t('cameras.form.host')}</TH>
                    <TH>{t('cameras.form.port')}</TH>
                    <TH>{t('cameras.form.protocol')}</TH>
                    <TH className="text-right">{t('cameras.colAction')}</TH>
                  </TR>
                </THead>
                <TBody>
                  {discovered.map((camera, index) => (
                    <TR
                      key={`${camera.host}-${camera.port}-${index}`}
                    >
                      <TD className="font-mono text-xs">{camera.host}</TD>
                      <TD>{camera.port}</TD>
                      <TD>
                        <Badge color="slate">{camera.protocol}</Badge>
                      </TD>
                      <TD className="text-right">
                        <GlassButton
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => handleUseDiscovered(camera)}
                        >
                          {t('cameras.use')}
                        </GlassButton>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          ) : discover.isSuccess ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {t('cameras.noCamerasFound')}
            </p>
          ) : null}
        </div>
      </Modal>

      {/* Config modal */}
      <Modal open={configModalOpen} onClose={() => setConfigModalOpen(false)} title={t('cameras.configTitle')}>
        <div className="space-y-4">
          <Field label={t('cameras.configFps')}>
            <TextInput type="number" min={1} max={30} value={configForm.fps}
              onChange={(e) => setConfigForm((f) => ({ ...f, fps: e.target.value }))} />
          </Field>
          <Field label={t('cameras.configRecognition')}>
            <Select value={configForm.recognitionEnabled}
              onChange={(e) => setConfigForm((f) => ({ ...f, recognitionEnabled: e.target.value }))}>
              <option value="true">{t('common.enable')}</option>
              <option value="false">{t('common.disable')}</option>
            </Select>
          </Field>
          <Field label={t('cameras.configAttendance')}>
            <Select value={configForm.attendanceEnabled}
              onChange={(e) => setConfigForm((f) => ({ ...f, attendanceEnabled: e.target.value }))}>
              <option value="true">{t('common.enable')}</option>
              <option value="false">{t('common.disable')}</option>
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <GlassButton onClick={() => setConfigModalOpen(false)} variant="secondary">{t('common.cancel')}</GlassButton>
            <GlassButton onClick={() => {
              if (selectedCameraId) {
                updateConfig.mutate({
                  id: selectedCameraId,
                  data: {
                    fps: parseInt(configForm.fps) || 10,
                    recognitionEnabled: configForm.recognitionEnabled === 'true',
                    attendanceEnabled: configForm.attendanceEnabled === 'true',
                  },
                });
              }
            }} disabled={updateConfig.isPending}
              variant="primary">
              {updateConfig.isPending ? t('common.saving') : t('common.save')}
            </GlassButton>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteCamera.mutate(deleteTarget.id);
          setDeleteTarget(null);
        }}
        description={deleteTarget ? t('cameras.deleteConfirm', { name: deleteTarget.name }) : ''}
        loading={deleteCamera.isPending}
      />

      {toastNode}
    </div>
  );
}