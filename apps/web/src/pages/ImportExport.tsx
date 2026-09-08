import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PageHeader,
  Badge,
  PageLoader,
  EmptyState,
  ErrorState,
  GlassButton,
} from '@/components/ui';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useToast } from '@/components/ui/GlassToast';
import request from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessages';

interface ImportJob {
  id: string;
  entityType: string;
  fileName: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  errors: { row: number; message: string }[];
  startedAt: string;
  finishedAt?: string;
  startedByName?: string;
}

export function ImportExportPage() {
  usePageTitle('Import / Export Center');
  const queryClient = useQueryClient();
  const { push } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [entity, setEntity] = useState('STUDENT');

  const jobsQuery = useQuery({
    queryKey: ['import-jobs'],
    queryFn: () => request('/import-export/imports') as Promise<{ items: ImportJob[]; total: number }>,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      form.append('entityType', entity);
      // FormData upload: no Content-Type header (browser sets the boundary)
      const res = await fetch('/api/import-export/imports', {
        method: 'POST',
        body: form,
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || 'Upload failed');
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      push('success', `Import job started: ${data?.id ?? ''}`);
      queryClient.invalidateQueries({ queryKey: ['import-jobs'] });
    },
    onError: (e) => push('error', getErrorMessage(e)),
  });

  const downloadTemplate = async (e: string) => {
    const res = await fetch(`/api/import-export/template?entity=${encodeURIComponent(e)}`, {
      credentials: 'include',
    });
    if (!res.ok) return push('error', 'Template unavailable');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${e.toLowerCase()}-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportData = async (e: string) => {
    push('info', `Preparing ${e.toLowerCase()} export…`);
    const res = await fetch(`/api/import-export/export?entity=${encodeURIComponent(e)}&format=csv`, {
      credentials: 'include',
    });
    if (!res.ok) return push('error', 'Export failed — please try again');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${e.toLowerCase()}-export.csv`;
    a.click();
    URL.revokeObjectURL(url);
    push('success', 'Export downloaded');
  };

  const jobs: ImportJob[] = (jobsQuery.data as any)?.items ?? [];

  return (
    <div className="orb-container">
      <div className="orb orb-cyan-1" />
      <div className="orb orb-indigo-1" />
      <div className="page-container space-y-4">
        <PageHeader
          title="Import / Export Center"
          subtitle="CSV-based, deterministic, transactional — no AI parsing"
        />

        <div className="glass-card p-4 space-y-3">
          <h3 className="font-semibold text-[var(--text-primary)]">Upload CSV</h3>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={entity}
              onChange={(e) => setEntity(e.target.value)}
              className="rounded-xl border border-[var(--border-medium)] bg-[var(--bg-glass)] px-3 py-2 text-sm"
            >
              {['STUDENT', 'TEACHER', 'GROUP', 'COURSE', 'PAYMENT', 'EMPLOYEE', 'BOOK', 'LEAD'].map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
            <input
              ref={fileInput}
              type="file"
              accept=".csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadMutation.mutate(f);
                e.target.value = '';
              }}
              className="hidden"
            />
            <GlassButton
              variant="primary"
              onClick={() => fileInput.current?.click()}
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending ? 'Uploading…' : 'Choose file'}
            </GlassButton>
            <GlassButton variant="ghost" onClick={() => downloadTemplate(entity)}>
              Download template
            </GlassButton>
            <GlassButton variant="ghost" onClick={() => exportData(entity)}>
              Export {entity.toLowerCase()}s
            </GlassButton>
          </div>
          <p className="text-xs text-muted">
            CSV must match the template (UTF-8, comma-separated, header row required). Imports run in a single
            transaction — partial failures roll back the entire batch.
          </p>
        </div>

        <div className="glass-card p-4 space-y-2">
          <h3 className="font-semibold text-[var(--text-primary)]">How it works</h3>
          <ul className="text-sm space-y-1.5 text-muted">
            <li>• <strong className="text-[var(--text-primary)]">Validation</strong> — each row is checked against the entity DTO; bad rows are reported with line numbers</li>
            <li>• <strong className="text-[var(--text-primary)]">Tenant isolation</strong> — every imported record is tagged with the current organizationId</li>
            <li>• <strong className="text-[var(--text-primary)]">Audit</strong> — a single import batch creates one bulk audit entry per entity</li>
            <li>• <strong className="text-[var(--text-primary)]">No AI column mapping</strong> — headers must match exactly</li>
          </ul>
        </div>

        <div className="glass-card overflow-hidden">
          {jobsQuery.isLoading ? (
            <div className="p-8"><PageLoader label="Loading import jobs…" /></div>
          ) : jobsQuery.isError ? (
            <div className="p-8">
              <ErrorState
                title="Failed to load import jobs"
                message={getErrorMessage(jobsQuery.error)}
                onRetry={() => jobsQuery.refetch()}
              />
            </div>
          ) : jobs.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="No imports yet"
                message="Upload a CSV to start. The job history will appear here."
              />
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {jobs.map((j) => (
                <li key={j.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium text-sm text-[var(--text-primary)]">
                        {j.entityType} · {j.fileName}
                      </h4>
                      <p className="text-xs text-muted">
                        {j.startedByName ?? 'system'} · {new Date(j.startedAt).toLocaleString()}
                      </p>
                    </div>
                    <Badge
                      color={
                        j.status === 'COMPLETED' ? 'success' :
                        j.status === 'FAILED' ? 'error' :
                        j.status === 'RUNNING' ? 'warning' :
                        'muted'
                      }
                    >
                      {j.status}
                    </Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-2 text-xs text-muted">
                    <div>Total: <span className="text-[var(--text-primary)]">{j.total}</span></div>
                    <div>OK: <span className="text-emerald-500">{j.succeeded}</span></div>
                    <div>Failed: <span className="text-red-500">{j.failed}</span></div>
                    <div>Processed: <span className="text-[var(--text-primary)]">{j.processed}</span></div>
                  </div>
                  {j.errors?.length > 0 && (
                    <ul className="mt-2 max-h-32 overflow-y-auto rounded-md bg-red-500/5 px-2 py-1 text-[11px] text-red-500">
                      {j.errors.slice(0, 20).map((e, i) => (
                        <li key={i}>Row {e.row}: {e.message}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
