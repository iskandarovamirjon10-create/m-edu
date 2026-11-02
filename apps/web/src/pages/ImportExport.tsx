/**
 * M-EDU ImportExportPage — 
 *
 * Ultra Premium Bulk Data Exchange Substrate:
 *  - Apple SF Pro visual hierarchy with ambient backdrop
 *  - Tactile File Ingestion zone with squircle geometry
 *  - Live KPI strip (Total Jobs, Succeeded, Running, Failed)
 *  - Spring physics with Framer Motion (smooth staggered rows)
 *  - Preserves 100% of real API contracts, file download logic, and i18n
 */

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, type Variants } from 'framer-motion';
import {
  GlassPageHeader,
  GlassBadge,
  GlassPageLoader,
  GlassEmptyState,
  GlassErrorState,
  GlassButton,
  GlassSelect,
} from '@/components/ui';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useToast } from '@/components/ui/GlassToast';
import { openSidecar } from '@/stores/ui.store';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import request, { downloadFile } from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessages';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/design';
import { ModmeExcelMigrationStudio } from '@/components/migration/ModmeExcelMigrationStudio';

function AuroraMesh() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="absolute -top-[10%] -left-[10%] h-[560px] w-[560px] rounded-full bg-gradient-to-br from-blue-500/12 via-indigo-500/8 to-transparent blur-[130px] dark:from-blue-600/14 dark:via-indigo-600/10" />
      <div className="absolute top-[25%] -right-[10%] h-[520px] w-[520px] rounded-full bg-gradient-to-bl from-teal-500/12 via-cyan-500/8 to-transparent blur-[130px] dark:from-teal-600/14 dark:via-cyan-600/10" />
      <div className="absolute -bottom-[15%] left-[25%] h-[480px] w-[480px] rounded-full bg-gradient-to-tr from-purple-500/10 via-pink-500/6 to-transparent blur-[120px] dark:from-purple-600/12" />
    </div>
  );
}

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  soft:   { type: 'spring', stiffness: 220, damping: 28, mass: 1.0 },
} as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.04 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.99 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 360, damping: 28 },
  },
};

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
  const { t } = useSafeI18n();
  usePageTitle(t('importExport.title'));
  const queryClient = useQueryClient();
  const { push } = useToast();
  const { playTick, playPop, playSuccess, playError } = usePremiumSound();
  const fileInput = useRef<HTMLInputElement>(null);
  const [viewMode, setViewMode] = useState<'migration' | 'classic'>('migration');
  const [entity, setEntity] = useState('STUDENT');
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'csv' | 'pdf'>('xlsx');
  const [isDragging, setIsDragging] = useState(false);

  const jobsQuery = useQuery({
    queryKey: ['import-jobs'],
    queryFn: () => request('/imports') as Promise<{ items: ImportJob[]; total: number }>,
  });

  const handleOpenJobSidecar = (job: ImportJob) => {
    playPop();
    openSidecar({
      id: job.id,
      type: 'general',
      title: `${job.entityType} Importi`,
      subtitle: job.fileName,
      badge: {
        text: job.status,
        tone: job.status === 'COMPLETED' ? 'emerald' : job.status === 'FAILED' ? 'rose' : 'amber',
      },
      avatar: {
        text: job.entityType.slice(0, 2).toUpperCase(),
        color: job.status === 'COMPLETED' ? '#10B981' : job.status === 'FAILED' ? '#F43F5E' : '#F59E0B',
      },
      metrics: [
        { label: 'Jami qatorlar', value: job.total },
        { label: 'Muvaffaqiyatli', value: job.succeeded },
        { label: 'Xatolar', value: job.failed },
        { label: 'Qayta ishlangan', value: job.processed },
      ],
      details: [
        { label: 'Topshiriq ID', value: job.id },
        { label: 'Fayl nomi', value: job.fileName },
        { label: 'Entiti turi', value: job.entityType },
        { label: 'Boshlangan sana', value: new Date(job.startedAt).toLocaleString() },
        { label: 'Tugallangan sana', value: job.finishedAt ? new Date(job.finishedAt).toLocaleString() : 'Davom etmoqda' },
        { label: 'Ijrochi', value: job.startedByName || 'Tizim' },
        { label: 'Xatolar soni', value: `${job.errors?.length || 0} ta` },
      ],
      actions: [
        {
          label: 'Shablonni qayta yuklash',
          variant: 'secondary',
          onClick: () => downloadTemplate(job.entityType),
        },
      ],
    });
  };

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
      playSuccess();
      const msg = data?.message || t('importExport.jobStarted', { id: data?.id ?? '' });
      push('success', msg);
      queryClient.invalidateQueries({ queryKey: ['import-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e) => {
      playError();
      push('error', getErrorMessage(e));
    },
  });

  const downloadTemplate = async (e: string) => {
    playTick();
    try {
      await downloadFile(`/template?entityType=${encodeURIComponent(e)}`, {
        defaultFilename: `${e.toLowerCase()}-template.csv`,
      });
      playSuccess();
    } catch {
      playError();
      push('error', t('importExport.templateUnavailable'));
    }
  };

  const exportData = async (e: string, format = exportFormat) => {
    playTick();
    push('info', t('importExport.preparing', { entity: e.toLowerCase() }));
    try {
      const ext = format === 'xlsx' ? 'xlsx' : format === 'pdf' ? 'pdf' : 'csv';
      await downloadFile(`/export?entityType=${encodeURIComponent(e)}&format=${format}`, {
        defaultFilename: `${e.toLowerCase()}-export.${ext}`,
      });
      playSuccess();
      push('success', t('importExport.exportDownloaded'));
    } catch {
      playError();
      push('error', t('importExport.exportFailed'));
    }
  };

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (e.key === 'u' || e.key === 'U') {
        e.preventDefault();
        playTick();
        fileInput.current?.click();
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        playTick();
        downloadTemplate(entity);
      } else if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        playTick();
        exportData(entity);
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        playTick();
        jobsQuery.refetch();
        push('info', 'Import/Eksport ma\'lumotlari yangilandi');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playTick, entity, jobsQuery, push]);

  const jobs: ImportJob[] = jobsQuery.data?.items ?? [];
  const completedJobs = jobs.filter((j) => j.status === 'COMPLETED').length;
  const runningJobs = jobs.filter((j) => j.status === 'RUNNING' || j.status === 'PENDING').length;
  const failedJobs = jobs.filter((j) => j.status === 'FAILED').length;

  return (
    <div className="relative min-h-screen bg-transparent selection:bg-brand-500/30 pb-[max(6rem,env(safe-area-inset-bottom))]">
      <AuroraMesh />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 w-full max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6"
      >
        <motion.div variants={itemVariants}>
          <GlassPageHeader
            title={t('importExport.title')}
            subtitle={t('importExport.pageSubtitle')}
          />
        </motion.div>

        {/* ── KPI Metrics Bar ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <motion.div
            variants={itemVariants}
            whileHover={{ y: -2, transition: SPRING.snappy }}
            className="liquid-glass-card liquid-glass-surface p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm"
          >
            <p className="text-[0.68rem] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">
              {t('importExport.total') || 'Total Jobs'}
            </p>
            <p className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tabular-nums">
              {jobs.length}
            </p>
          </motion.div>

          <motion.div
            variants={itemVariants}
            whileHover={{ y: -2, transition: SPRING.snappy }}
            className="liquid-glass-card liquid-glass-surface p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm"
          >
            <p className="text-[0.68rem] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">
              {t('importExport.ok') || 'Succeeded'}
            </p>
            <p className="text-2xl sm:text-3xl font-extrabold text-emerald-500 tabular-nums">
              {completedJobs}
            </p>
          </motion.div>

          <motion.div
            variants={itemVariants}
            whileHover={{ y: -2, transition: SPRING.snappy }}
            className="liquid-glass-card liquid-glass-surface p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm"
          >
            <p className="text-[0.68rem] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">
              {t('importExport.processed') || 'In Progress'}
            </p>
            <p className="text-2xl sm:text-3xl font-extrabold text-amber-500 tabular-nums">
              {runningJobs}
            </p>
          </motion.div>

          <motion.div
            variants={itemVariants}
            whileHover={{ y: -2, transition: SPRING.snappy }}
            className="liquid-glass-card liquid-glass-surface p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm"
          >
            <p className="text-[0.68rem] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">
              {t('importExport.failed') || 'Failed'}
            </p>
            <p className="text-2xl sm:text-3xl font-extrabold text-rose-500 tabular-nums">
              {failedJobs}
            </p>
          </motion.div>
        </div>

        {/* ── View Mode Switcher (i18n & Responsive) ───────────────────── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-1.5 rounded-2xl bg-black/30 border border-white/10 w-full sm:w-fit">
          <button
            type="button"
            onClick={() => {
              playTick();
              setViewMode('migration');
            }}
            className={cn(
              'px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 min-h-[40px]',
              viewMode === 'migration'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-white/60 hover:text-white'
            )}
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shrink-0" />
            {t('importExport.tabMigration', 'Modme & Smart Excel Migratsiya (1-Click)')}
          </button>
          <button
            type="button"
            onClick={() => {
              playTick();
              setViewMode('classic');
            }}
            className={cn(
              'px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 min-h-[40px]',
              viewMode === 'classic'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-white/60 hover:text-white'
            )}
          >
            {t('importExport.tabClassic', 'Klassik Import / Eksport & Tarix')}
          </button>
        </div>

        {viewMode === 'migration' ? (
          <motion.div variants={itemVariants}>
            <ModmeExcelMigrationStudio />
          </motion.div>
        ) : (
          <>
            {/* ── Upload & Action Card ────────────────────────────────────────── */}
            <motion.div
              variants={itemVariants}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const f = e.dataTransfer.files?.[0];
                if (f) uploadMutation.mutate(f);
              }}
              className={cn(
                'liquid-glass-card liquid-glass-surface relative overflow-hidden rounded-3xl p-6 sm:p-7 border shadow-sm transition-all duration-200',
                isDragging
                  ? 'border-blue-500 bg-blue-50/20 dark:border-blue-400 dark:bg-blue-950/20 scale-[1.005]'
                  : 'border-slate-200/80 dark:border-slate-800/80',
              )}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20 z-10" />

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div>
                  <h3 className="text-base font-bold text-[var(--text-primary)] mb-1 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                    </div>
                    {t('importExport.uploadCsv')}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    {isDragging ? 'Faylni yuklash uchun shu yerga tashlang (.csv, .xlsx)' : t('importExport.csvHint')}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <GlassSelect
                    value={entity}
                    onChange={(e) => {
                      playTick();
                      setEntity(e.target.value);
                    }}
                    aria-label={t('importExport.uploadCsv')}
                    className="w-auto"
                  >
                    {['STUDENT', 'TEACHER', 'GROUP', 'COURSE', 'PAYMENT'].map((e) => (
                      <option key={e} value={e}>
                        {t(`enum.badge.${e}`) || e}
                      </option>
                    ))}
                  </GlassSelect>

                  <input
                    ref={fileInput}
                    type="file"
                    accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
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
                    loading={uploadMutation.isPending}
                    icon={
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                    }
                  >
                    {t('importExport.uploadCsv')}
                  </GlassButton>

                  <GlassButton variant="secondary" onClick={() => downloadTemplate(entity)}>
                    {t('importExport.downloadTemplate')}
                  </GlassButton>

                  {/* Format Switcher */}
                  <div className="flex rounded-xl bg-slate-100 p-0.5 dark:bg-white/[0.06] border border-black/5 dark:border-white/5">
                    {(['xlsx', 'csv', 'pdf'] as const).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => {
                          playTick();
                          setExportFormat(fmt);
                        }}
                        className={cn(
                          'rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase transition-all',
                          exportFormat === fmt
                            ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-xs'
                            : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white',
                        )}
                      >
                        {fmt === 'xlsx' ? 'Excel' : fmt.toUpperCase()}
                      </button>
                    ))}
                  </div>

                  <GlassButton variant="ghost" onClick={() => exportData(entity, exportFormat)}>
                    {t('importExport.exportEntity', { entity: t(`enum.badge.${entity}`) || entity })}
                  </GlassButton>
                </div>
              </div>
            </motion.div>

            {/* ── Guidelines Info Card ────────────────────────────────────────── */}
            <motion.div
              variants={itemVariants}
              className="liquid-glass-surface relative overflow-hidden rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800/80 space-y-2 text-xs"
            >
              <h4 className="font-bold text-xs text-[var(--text-primary)] uppercase tracking-wider">
                {t('importExport.howItWorks')}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-[var(--text-muted)]">
                <div className="p-2.5 rounded-2xl bg-white/50 dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
                  • {t('importExport.howValidation')}
                </div>
                <div className="p-2.5 rounded-2xl bg-white/50 dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
                  • {t('importExport.howTenant')}
                </div>
                <div className="p-2.5 rounded-2xl bg-white/50 dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
                  • {t('importExport.howAudit')}
                </div>
                <div className="p-2.5 rounded-2xl bg-white/50 dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
                  • {t('importExport.howNoAi')}
                </div>
              </div>
            </motion.div>
          </>
        )}

        {/* ── Jobs Ledger ─────────────────────────────────────────────────── */}
        <motion.div
          variants={itemVariants}
          className="liquid-glass-card liquid-glass-surface relative overflow-hidden rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20 z-10" />

          {jobsQuery.isLoading ? (
            <div className="p-16">
              <GlassPageLoader label={t('importExport.loading')} />
            </div>
          ) : jobsQuery.isError ? (
            <div className="p-12">
              <GlassErrorState
                title={t('importExport.loadError')}
                message={getErrorMessage(jobsQuery.error)}
                onRetry={() => jobsQuery.refetch()}
              />
            </div>
          ) : jobs.length === 0 ? (
            <div className="p-16">
              <GlassEmptyState
                title={t('importExport.emptyTitle')}
                message={t('importExport.emptyMessage')}
              />
            </div>
          ) : (
            <motion.ul
              variants={containerVariants}
              className="divide-y divide-black/5 dark:divide-white/5"
            >
              {jobs.map((j) => (
                <motion.li
                  key={j.id}
                  variants={itemVariants}
                  whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.4)', transition: SPRING.snappy }}
                  onClick={() => handleOpenJobSidecar(j)}
                  className="px-6 py-4.5 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-sm text-[var(--text-primary)] truncate">
                        {j.entityType} · {j.fileName}
                      </h4>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        {j.startedByName ?? t('common.system')} · {new Date(j.startedAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleOpenJobSidecar(j)}
                        className="rounded-lg border border-slate-200/80 bg-white/60 px-2 py-1 text-[11px] font-bold text-slate-700 shadow-sm transition-all hover:bg-white dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-800"
                        title="Tafsilotlar (Sidecar)"
                      >
                        ◨ Sidecar
                      </button>
                      <GlassBadge
                        color={
                          j.status === 'COMPLETED'
                            ? 'success'
                            : j.status === 'FAILED'
                            ? 'error'
                            : j.status === 'RUNNING'
                            ? 'warning'
                            : 'muted'
                        }
                      >
                        {t(`importExport.status.${j.status}`)}
                      </GlassBadge>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-[var(--text-muted)] tabular-nums">
                    <div className="p-2 rounded-xl bg-black/5 dark:bg-white/5">
                      {t('importExport.total')}: <span className="font-bold text-[var(--text-primary)]">{j.total}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      {t('importExport.ok')}: <span className="font-bold">{j.succeeded}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                      {t('importExport.failed')}: <span className="font-bold">{j.failed}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-black/5 dark:bg-white/5">
                      {t('importExport.processed')}: <span className="font-bold text-[var(--text-primary)]">{j.processed}</span>
                    </div>
                  </div>
                  {j.errors?.length > 0 && (
                    <ul className="mt-3 max-h-32 overflow-y-auto rounded-xl bg-rose-500/5 border border-rose-500/15 p-2.5 text-[11px] text-rose-600 dark:text-rose-400 space-y-1">
                      {j.errors.slice(0, 20).map((e, i) => (
                        <li key={i}>
                          {t('importExport.rowError', { row: e.row })}: {e.message}
                        </li>
                      ))}
                    </ul>
                  )}
                </motion.li>
              ))}
            </motion.ul>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}

export default ImportExportPage;
