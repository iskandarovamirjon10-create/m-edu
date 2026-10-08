import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GlassPageHeader, GlassBadge, GlassPageLoader, GlassEmptyState, GlassErrorState, GlassButton, GlassSelect } from '@/components/ui';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useToast } from '@/components/ui/GlassToast';
import request, { downloadFile } from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessages';
import { useI18n } from '@/i18n/I18nProvider';

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
  const { t } = useI18n();
  usePageTitle(t('importExport.title'));
  const queryClient = useQueryClient();
  const { push } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [entity, setEntity] = useState('STUDENT');

  const jobsQuery = useQuery({
    queryKey: ['import-jobs'],
    queryFn: () => request('/imports') as Promise<{ items: ImportJob[]; total: number }>,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File): Promise<{ id?: string }> => {
      const form = new FormData();
      form.append('file', file);
      form.append('entityType', entity);
      return await request<{ id?: string }>('/imports', {
        method: 'POST',
        body: form,
      });
    },
    onSuccess: (data: any) => {
      const msg = data?.message || t('importExport.jobStarted', { id: data?.id ?? '' });
      push('success', msg);
      queryClient.invalidateQueries({ queryKey: ['import-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e) => push('error', getErrorMessage(e)),
  });

  const downloadTemplate = async (e: string) => {
    try {
      await downloadFile(`/template?entityType=${encodeURIComponent(e)}`, {
        defaultFilename: `${e.toLowerCase()}-template.csv`
      });
    } catch {
      push('error', t('importExport.templateUnavailable'));
    }
  };

  const exportData = async (e: string) => {
    push('info', t('importExport.preparing', { entity: e.toLowerCase() }));
    try {
      await downloadFile(`/export?entityType=${encodeURIComponent(e)}&format=csv`, {
        defaultFilename: `${e.toLowerCase()}-export.csv`
      });
      push('success', t('importExport.exportDownloaded'));
    } catch {
      push('error', t('importExport.exportFailed'));
    }
  };

  const jobs: ImportJob[] = jobsQuery.data?.items ?? [];

  return (
    <div style={{ display: "contents" }}>
      <div className="orb orb-cyan-1" />
      <div className="orb orb-indigo-1" />
      <div className="page-container space-y-4">
        <GlassPageHeader
          title={t('importExport.title')}
          subtitle={t('importExport.pageSubtitle')}
        />

        <div className="glass-card p-4 space-y-3">
          <h3 className="font-semibold text-[var(--text-primary)]">{t('importExport.uploadCsv')}</h3>
 <div className="flex flex-wrap items-center gap-2">
 <GlassSelect
 value={entity}
 onChange={(e) => setEntity(e.target.value)}
 aria-label={t('importExport.uploadCsv')}
 className="w-auto"
 >
 {['STUDENT', 'TEACHER'].map((e) => (
 <option key={e} value={e}>{t(`enum.badge.${e}`)}</option>
 ))}
 </GlassSelect>
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
              >
                {t('importExport.uploadCsv')}
              </GlassButton>
            <GlassButton variant="ghost" onClick={() => downloadTemplate(entity)}>
              {t('importExport.downloadTemplate')}
            </GlassButton>
            <GlassButton variant="ghost" onClick={() => exportData(entity)}>
              {t('importExport.exportEntity', { entity: t(`enum.badge.${entity}`) })}
            </GlassButton>
          </div>
          <p className="text-xs text-muted">
            {t('importExport.csvHint')}
          </p>
        </div>

        <div className="glass-card p-4 space-y-2">
          <h3 className="font-semibold text-[var(--text-primary)]">{t('importExport.howItWorks')}</h3>
          <ul className="text-sm space-y-1.5 text-muted">
            <li>• {t('importExport.howValidation')}</li>
            <li>• {t('importExport.howTenant')}</li>
            <li>• {t('importExport.howAudit')}</li>
            <li>• {t('importExport.howNoAi')}</li>
          </ul>
        </div>

        <div className="glass-card overflow-hidden">
          {jobsQuery.isLoading ? (
            <div className="p-8"><GlassPageLoader label={t('importExport.loading')} /></div>
          ) : jobsQuery.isError ? (
            <div className="p-8">
              <GlassErrorState
                title={t('importExport.loadError')}
                message={getErrorMessage(jobsQuery.error)}
                onRetry={() => jobsQuery.refetch()}
              />
            </div>
          ) : jobs.length === 0 ? (
            <div className="p-8">
              <GlassEmptyState
                title={t('importExport.emptyTitle')}
                message={t('importExport.emptyMessage')}
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
                        {j.startedByName ?? t('common.system')} · {new Date(j.startedAt).toLocaleString()}
                      </p>
                    </div>
                    <GlassBadge
                      color={
                        j.status === 'COMPLETED' ? 'success' :
                        j.status === 'FAILED' ? 'error' :
                        j.status === 'RUNNING' ? 'warning' :
                        'muted'
                      }
                    >
                      {t(`importExport.status.${j.status}`)}
                    </GlassBadge>
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-2 text-xs text-muted">
                    <div>{t('importExport.total')}: <span className="text-[var(--text-primary)]">{j.total}</span></div>
                    <div>{t('importExport.ok')}: <span className="text-emerald-500">{j.succeeded}</span></div>
                    <div>{t('importExport.failed')}: <span className="text-red-500">{j.failed}</span></div>
                    <div>{t('importExport.processed')}: <span className="text-[var(--text-primary)]">{j.processed}</span></div>
                  </div>
                  {j.errors?.length > 0 && (
                    <ul className="mt-2 max-h-32 overflow-y-auto rounded-md bg-red-500/5 px-2 py-1 text-[11px] text-red-500">
                      {j.errors.slice(0, 20).map((e, i) => (
                        <li key={i}>{t('importExport.rowError', { row: e.row })}: {e.message}</li>
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
