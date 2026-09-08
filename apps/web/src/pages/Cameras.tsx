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
  useToasts,
  statusColor,
} from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Camera, CameraProtocol } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';

const CAMERA_PROTOCOLS: CameraProtocol[] = ['RTSP', 'ONVIF'];

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

function getRecognitionBadge(enabled: boolean): { color: string; label: string } {
  return enabled
    ? { color: 'green', label: 'On' }
    : { color: 'slate', label: 'Off' };
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
  const [tab, setTab] = useState<TabKey>('events');
  const tabs: { key: TabKey; label: string }[] = [
    { key: 'events', label: 'Events' },
    { key: 'health', label: 'Health' },
    { key: 'worker', label: 'Worker Status' },
  ];

  return (
    <div>
      <div className="glass-tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`glass-tab ${tab === t.key ? 'active' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === 'events' && (
          <div>
            {events.isLoading ? (
              <PageLoader label="Loading events…" />
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
              <PageLoader label="Loading health…" />
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
              <PageLoader label="Loading worker status…" />
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
  const events = (data as { items?: Array<{ id: string; recognizedAt: string; student?: { user?: { firstName?: string; lastName?: string } }; decision: string; confidence?: string; similarityScore?: string }> })?.items ?? [];
  if (events.length === 0) return <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No recognition events yet.</p>;
  return (
    <div className="overflow-x-auto">
      <Table>
        <THead>
          <TR>
            <TH>Time</TH>
            <TH>Student</TH>
            <TH>Decision</TH>
            <TH>Confidence</TH>
            <TH>Similarity</TH>
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
  const h = data as Record<string, unknown> | null;
  if (!h) return <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No health data available.</p>;
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
  const w = data as Record<string, unknown> | null;
  if (!w) return <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No worker running.</p>;
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
  usePageTitle('Cameras');
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [configModalOpen, setConfigModalOpen] = useState(false);
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
      push('success', 'Camera added successfully');
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
      push('success', 'Camera updated');
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
      push('success', 'Worker started');
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
      push('success', 'Discovery finished — found cameras below');
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
      errors.name = 'Camera name is required';
    }
    if (!form.host.trim()) {
      errors.host = 'Host is required';
    }
    if (form.port && (parseInt(form.port, 10) < 1 || parseInt(form.port, 10) > 65535)) {
      errors.port = 'Port must be between 1 and 65535';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form]);

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
    onSuccess: () => { push('success', 'Worker stopped'); qc.invalidateQueries({ queryKey: ['cameras'] }); qc.invalidateQueries({ queryKey: ['camera-worker'] }); },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const restartWorker = useMutation({
    mutationFn: (id: string) => camerasApi.restartWorker(id),
    onSuccess: () => { push('success', 'Worker restarted'); qc.invalidateQueries({ queryKey: ['cameras'] }); qc.invalidateQueries({ queryKey: ['camera-worker'] }); },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const deleteCamera = useMutation({
    mutationFn: (id: string) => camerasApi.remove(id),
    onSuccess: () => { push('success', 'Camera deleted'); setSelectedCameraId(null); qc.invalidateQueries({ queryKey: ['cameras'] }); },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const testConnection = useMutation({
    mutationFn: (data: { host: string; port: number }) => camerasApi.testConnection(data),
    onSuccess: () => push('success', 'Connection successful'),
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const updateConfig = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => camerasApi.config(id, data),
    onSuccess: () => { push('success', 'Configuration updated'); setConfigModalOpen(false); qc.invalidateQueries({ queryKey: ['cameras'] }); },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  // Early return for loading state
  if (cameras.isLoading && !data) {
    return (
      <div className="page-container space-y-4">
        <div className="orb-container">
          <div className="orb orb-cyan-1" />
          <div className="orb orb-cyan-2" />
          <div className="orb orb-indigo-1" />
          <div className="orb orb-deep-1" />
        </div>
        <PageHeader
          title="Cameras"
          subtitle="IP camera management for automatic attendance"
        />
        <div className="glass-card p-8">
          <PageLoader label="Loading cameras…" />
        </div>
      </div>
    );
  }

  // Early return for error state
  if (cameras.isError) {
    return (
      <div className="page-container space-y-4">
        <div className="orb-container">
          <div className="orb orb-cyan-1" />
          <div className="orb orb-cyan-2" />
          <div className="orb orb-indigo-1" />
          <div className="orb orb-deep-1" />
        </div>
        <PageHeader
          title="Cameras"
          subtitle="IP camera management for automatic attendance"
        />
        <div className="glass-card p-8">
          <ErrorState
            title="Failed to load cameras"
            message={getErrorMessage(cameras.error as Error)}
            onRetry={handleRetry}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="page-container space-y-4">
      <div className="orb-container">
        <div className="orb orb-cyan-1" />
        <div className="orb orb-cyan-2" />
        <div className="orb orb-indigo-1" />
        <div className="orb orb-deep-1" />
      </div>
      <PageHeader
        title="Cameras"
        subtitle="IP camera management for automatic attendance"
        actions={
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className="glass-btn glass-btn-secondary"
              onClick={() => setDiscoverOpen(true)}
            >
              Discover cameras
            </button>
            <button
              type="button"
              className="glass-btn glass-btn-primary"
              onClick={() => setModalOpen(true)}
            >
              Add camera
            </button>
          </div>
        }
      />

      {/* Cameras table */}
      <div className="glass-card overflow-hidden">
        {list.length === 0 ? (
          <EmptyState
            title="No cameras"
            message="Add an RTSP camera to enable automatic recognition attendance."
          />
        ) : (
          <div className="glass-table-wrap">
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Endpoint</TH>
                  <TH>Status</TH>
                  <TH>Recognition</TH>
                  <TH>Last seen</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {list.map((camera) => {
                  const statusBadge = getCameraStatusBadge(camera);
                  const recognitionBadge = getRecognitionBadge(
                    camera.recognitionEnabled,
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
                      aria-label={`View camera ${camera.name}`}
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
                          {statusBadge.label}
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
                            <button
                              type="button"
                              className="glass-btn glass-btn-ghost glass-btn-sm"
                              onClick={() => handleStartWorker(camera.id)}
                              disabled={isWorkerPending}
                            >
                              {isWorkerPending ? 'Starting…' : 'Start worker'}
                            </button>
                          )}
                          <button
                            type="button"
                            className="glass-btn glass-btn-ghost glass-btn-sm"
                            onClick={() => handleToggleCamera(camera)}
                            disabled={isTogglePending}
                          >
                            {isTogglePending
                              ? 'Updating…'
                              : camera.enabled
                                ? 'Disable'
                                : 'Enable'}
                          </button>
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
                   <button onClick={() => restartWorker.mutate(selectedCamera.id)} disabled={restartWorker.isPending}
                    aria-label={`Restart worker for ${selectedCamera.name}`}
                    className="glass-btn glass-btn-secondary glass-btn-sm">
                    Restart Worker
                  </button>
                  <button onClick={() => stopWorker.mutate(selectedCamera.id)} disabled={stopWorker.isPending}
                    aria-label={`Stop worker for ${selectedCamera.name}`}
                    className="glass-btn glass-btn-danger glass-btn-sm">
                    Stop Worker
                  </button>
                </>
              )}
              {(selectedCamera.status === 'CONFIGURED' || selectedCamera.status === 'ERROR') && (
                <button onClick={() => startWorker.mutate(selectedCamera.id)} disabled={startWorker.isPending}
                  aria-label={`Start worker for ${selectedCamera.name}`}
                  className="glass-btn glass-btn-primary glass-btn-sm">
                  Start Worker
                </button>
              )}
              <button onClick={() => {
                setConfigForm({
                  fps: String((selectedCamera as Camera & { fps?: number }).fps || 10),
                  recognitionEnabled: String(selectedCamera.recognitionEnabled),
                  attendanceEnabled: String(selectedCamera.attendanceEnabled),
                });
                setConfigModalOpen(true);
              }}
                aria-label={`Configure ${selectedCamera.name}`}
                className="glass-btn glass-btn-secondary glass-btn-sm">
                Configure
              </button>
              <button onClick={() => testConnection.mutate({ host: selectedCamera.host, port: selectedCamera.port })}
                disabled={testConnection.isPending}
                aria-label={`Test connection to ${selectedCamera.name}`}
                className="glass-btn glass-btn-secondary glass-btn-sm">
                Test Connection
              </button>
              <button onClick={() => { if (confirm(`Delete camera "${selectedCamera.name}"?`)) deleteCamera.mutate(selectedCamera.id); }}
                disabled={deleteCamera.isPending}
                aria-label={`Delete camera ${selectedCamera.name}`}
                className="glass-btn glass-btn-danger glass-btn-sm">
                Delete
              </button>
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
        title="Add camera"
        wide
      >
        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Camera name" required error={formErrors.name}>
              <TextInput
                value={form.name}
                onChange={handleFormChange('name')}
                required
                aria-invalid={Boolean(formErrors.name)}
                aria-describedby={formErrors.name ? 'name-error' : undefined}
                placeholder="Front entrance camera"
              />
              {formErrors.name && (
                <span id="name-error" className="mt-1 text-sm text-red-600">
                  {formErrors.name}
                </span>
              )}
            </Field>
            <Field label="Protocol">
              <Select
                value={form.protocol}
                onChange={handleFormChange('protocol')}
                aria-label="Camera protocol"
              >
                {CAMERA_PROTOCOLS.map((protocol) => (
                  <option key={protocol} value={protocol}>
                    {protocol}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Host" required error={formErrors.host}>
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
            <Field label="Port" error={formErrors.port}>
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
            <Field label="Stream path">
              <TextInput
                value={form.streamPath}
                onChange={handleFormChange('streamPath')}
                placeholder="/Streaming/Channels/101"
              />
            </Field>
            <Field label="Location">
              <TextInput
                value={form.location}
                onChange={handleFormChange('location')}
                placeholder="Main entrance"
              />
            </Field>
            <Field
              label="Username"
              hint="Credentials are encrypted at rest."
            >
              <TextInput
                value={form.username}
                onChange={handleFormChange('username')}
                autoComplete="off"
              />
            </Field>
            <Field label="Password">
              <TextInput
                type="password"
                value={form.password}
                onChange={handleFormChange('password')}
                autoComplete="new-password"
              />
            </Field>
          </div>
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
              {create.isPending ? 'Saving…' : 'Add camera'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Discover cameras modal */}
      <Modal
        open={discoverOpen}
        onClose={handleCloseDiscover}
        title="Discover cameras on the network"
        wide
      >
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Scans the local network for ONVIF cameras. Enter an optional
            subnet (e.g. 192.168.1.0/24) to narrow the scan. Discovery is
            rate-limited per organization and may be disabled in production.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <TextInput
              value={discoverSubnet}
              onChange={(e) => setDiscoverSubnet(e.target.value)}
              placeholder="192.168.1.0/24 (optional)"
              className="flex-1"
              aria-label="Subnet to scan"
            />
            <button
              type="button"
              className="glass-btn glass-btn-primary"
              onClick={() => discover.mutate()}
              disabled={discover.isPending}
            >
              {discover.isPending ? 'Scanning…' : 'Scan'}
            </button>
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
                    <TH>Host</TH>
                    <TH>Port</TH>
                    <TH>Protocol</TH>
                    <TH className="text-right">Action</TH>
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
                        <button
                          type="button"
                          className="glass-btn glass-btn-secondary glass-btn-sm"
                          onClick={() => handleUseDiscovered(camera)}
                        >
                          Use
                        </button>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          ) : discover.isSuccess ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No cameras found on the scanned range.
            </p>
          ) : null}
        </div>
      </Modal>

      {/* Config modal */}
      <Modal open={configModalOpen} onClose={() => setConfigModalOpen(false)} title="Camera Configuration">
        <div className="space-y-4">
          <Field label="Frames per second (FPS)">
            <TextInput type="number" min={1} max={30} value={configForm.fps}
              onChange={(e) => setConfigForm((f) => ({ ...f, fps: e.target.value }))} />
          </Field>
          <Field label="Face recognition">
            <Select value={configForm.recognitionEnabled}
              onChange={(e) => setConfigForm((f) => ({ ...f, recognitionEnabled: e.target.value }))}>
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </Select>
          </Field>
          <Field label="Auto-attendance">
            <Select value={configForm.attendanceEnabled}
              onChange={(e) => setConfigForm((f) => ({ ...f, attendanceEnabled: e.target.value }))}>
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <button onClick={() => setConfigModalOpen(false)} className="glass-btn glass-btn-secondary">Cancel</button>
            <button onClick={() => {
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
              className="glass-btn glass-btn-primary">
              {updateConfig.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>

      {toastNode}
    </div>
  );
}