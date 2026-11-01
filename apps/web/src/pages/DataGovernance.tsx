/**
 * M-EDU DataGovernancePage — 
 *
 * Enterprise Data Lifecycle, Retention Automation & Security Audit Logging.
 */

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GlassPageHeader,
  GlassButton,
  GlassPageLoader,
  GlassErrorState,
  GlassEmptyState,
  GlassInput,
  GlassSelect,
  GlassSwitch,
} from '@/components/ui';
import { useToast } from '@/components/ui/GlassToast';
import { AuroraMesh } from '@/components/ui/AuroraMesh';
import { dataGovernanceApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessages';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSafeI18n } from '@/i18n/I18nProvider';
import type { DataGovernancePolicy, ExportLog, DataAccessLog, Paginated, RetentionCheckResult } from '@/types/governance';
import { openSidecar, type QuickLookData } from '@/stores/ui.store';
import { usePremiumSound } from '@/hooks/usePremiumSound';

type TabKey = 'policies' | 'exports' | 'access' | 'summary';

const DATA_TYPES = [
  { value: 'STUDENT_RECORDS', label: 'Student Records' },
  { value: 'PAYMENT_RECORDS', label: 'Payment Records' },
  { value: 'AUDIT_LOGS', label: 'Audit Logs' },
  { value: 'FINANCIAL_REPORTS', label: 'Financial Reports' },
  { value: 'CRM_DATA', label: 'CRM Data' },
];

const EXPORT_TYPES = [
  { value: 'STUDENTS', label: 'Students' },
  { value: 'PAYMENTS', label: 'Payments' },
  { value: 'FINANCIAL', label: 'Financial' },
  { value: 'HR', label: 'HR' },
  { value: 'CRM', label: 'CRM' },
  { value: 'AUDIT', label: 'Audit' },
  { value: 'FULL_BACKUP', label: 'Full Backup' },
];

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 350, damping: 28 }}
      className="liquid-glass-card liquid-glass-surface relative overflow-hidden rounded-2xl p-6 group transition-all duration-300 hover:-translate-y-1 border border-white/60 dark:border-white/10 shadow-[0_8px_32px_-8px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-xl"
    >
      <div className="absolute inset-0 rounded-2xl pointer-events-none ring-1 ring-inset ring-black/5 dark:ring-white/5" aria-hidden />
      <div className={`absolute -top-10 -right-10 w-28 h-28 rounded-full blur-[30px] opacity-15 transition-opacity group-hover:opacity-25 ${color}`} aria-hidden />
      <div className="relative z-10 flex flex-col h-full">
        <p className="text-[2rem] font-black text-[var(--text-primary)] tracking-tight mb-1 tabular-nums">{value}</p>
        <p className="text-[0.75rem] font-bold text-[var(--text-muted)] uppercase tracking-wide">{label}</p>
      </div>
    </motion.div>
  );
}

function RetentionPoliciesTab() {
  const { t } = useSafeI18n();
  usePageTitle(t('dg.title'));
  const toast = useToast();
  const queryClient = useQueryClient();
  const { playTick, playSuccess, playError } = usePremiumSound();
  const [editingType, setEditingType] = useState<string | null>(null);
  const [form, setForm] = useState({ retentionDays: 2555, archivalDays: '', deleteAfterDays: '', isActive: true });

  const policiesQuery = useQuery({
    queryKey: ['dg-policies'],
    queryFn: () => dataGovernanceApi.getRetentionPolicies(),
  });

  const handleOpenPolicySidecar = useCallback((dt: { value: string; label: string }, policy?: DataGovernancePolicy) => {
    playTick();
    const sidecarData: QuickLookData = {
      title: dt.label,
      subtitle: `Data Classification Scope: ${dt.value}`,
      badge: {
        text: policy?.isActive ? 'Active Retention Policy' : 'Draft / Inactive',
        tone: policy?.isActive ? 'emerald' : 'amber',
      },
      status: {
        label: policy ? (policy.isActive ? 'Active Enforcement' : 'Inactive') : 'No Policy Defined',
        tone: policy?.isActive ? 'success' : 'warning',
      },
      metrics: [
        { label: 'Retention Threshold', value: policy ? `${policy.retentionDays} Days` : 'Not configured' },
        { label: 'Archival Window', value: policy?.archivalDays ? `${policy.archivalDays} Days` : 'Disabled' },
        { label: 'Auto-Purge Window', value: policy?.deleteAfterDays ? `${policy.deleteAfterDays} Days` : 'Disabled' },
        { label: 'Enforcement State', value: policy?.isActive ? 'Active' : 'Paused' },
      ],
      details: [
        { label: 'Data Classification', value: dt.label },
        { label: 'Scope Target', value: dt.value },
        { label: 'Last Check Execution', value: policy?.lastRunAt ? new Date(policy.lastRunAt).toLocaleString() : 'Never executed' },
        { label: 'Unique Identifier', value: policy?.id || 'Pending creation' },
      ],
    };
    openSidecar(sidecarData);
  }, [playTick]);

  const upsertMutation = useMutation({
    mutationFn: (data: { dataType: string; retentionDays: number; archivalDays: number | null; deleteAfterDays: number | null; isActive: boolean }) =>
      dataGovernanceApi.upsertRetentionPolicy(data),
    onSuccess: () => {
      playSuccess();
      queryClient.invalidateQueries({ queryKey: ['dg-policies'] });
      toast.success(t('dg.policySaved'));
      setEditingType(null);
    },
    onError: (err: Error) => {
      playError();
      toast.error(getErrorMessage(err));
    },
  });

  const policies = policiesQuery.data ?? [];
  const policyMap = new Map(policies.map((p: DataGovernancePolicy) => [p.dataType, p]));

  if (policiesQuery.isLoading) return <GlassPageLoader />;
  if (policiesQuery.error) return <GlassErrorState message={getErrorMessage(policiesQuery.error as Error)} onRetry={() => policiesQuery.refetch()} />;

  return (
    <div className="space-y-4">
      {DATA_TYPES.map((dt) => {
        const existing = policyMap.get(dt.value);
        const isEditing = editingType === dt.value;
        return (
          <motion.div
            key={dt.value}
            layout
            onClick={() => handleOpenPolicySidecar(dt, existing)}
            className="liquid-glass-card liquid-glass-surface rounded-[1.75rem] border border-white/60 dark:border-white/10 backdrop-blur-xl p-5 shadow-[0_8px_32px_-8px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.7)] cursor-pointer hover:border-indigo-500/30 transition-all"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">{dt.label}</h3>
                {existing && (
                  <p className="text-xs text-[var(--text-muted)] mt-1 font-medium">
                    Retention: <span className="font-semibold text-[var(--text-primary)]">{existing.retentionDays}d</span>
                    {existing.archivalDays ? ` • Archive: ${existing.archivalDays}d` : ''}
                    {existing.deleteAfterDays ? ` • Delete: ${existing.deleteAfterDays}d` : ''}
                    {existing.lastRunAt ? ` • Last run: ${new Date(existing.lastRunAt).toLocaleDateString()}` : ''}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenPolicySidecar(dt, existing);
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 transition-all border border-indigo-500/20 inline-flex items-center gap-1"
                  title="Inspect policy in macOS Sidecar"
                >
                  <span>◨</span>
                  <span>Sidecar</span>
                </button>
                {existing && (
                  <span className={`px-3 py-1 rounded-full text-[0.7rem] font-bold tracking-wide ${
                    existing.isActive
                      ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      : 'bg-zinc-500/10 text-zinc-500 border border-zinc-500/20'
                  }`}>
                    {existing.isActive ? 'Active' : 'Inactive'}
                  </span>
                )}
                <GlassButton
                  size="sm"
                  onClick={() => {
                    playTick();
                    setEditingType(isEditing ? null : dt.value);
                    if (existing) {
                      setForm({
                        retentionDays: existing.retentionDays,
                        archivalDays: existing.archivalDays?.toString() ?? '',
                        deleteAfterDays: existing.deleteAfterDays?.toString() ?? '',
                        isActive: existing.isActive,
                      });
                    } else {
                      setForm({ retentionDays: 2555, archivalDays: '', deleteAfterDays: '', isActive: true });
                    }
                  }}
                >
                  {isEditing ? t('common.cancel') : existing ? t('common.edit') : t('common.create')}
                </GlassButton>
              </div>
            </div>

            <AnimatePresence>
              {isEditing && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  onClick={(e) => e.stopPropagation()}
                  className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-[var(--border-subtle)]/50"
                >
                  <GlassInput label={t('dg.retentionDays')} type="number" value={form.retentionDays} onChange={(e) => setForm({ ...form, retentionDays: +e.target.value })} />
                  <GlassInput label={t('dg.archiveAfter')} type="number" value={form.archivalDays} placeholder={t('common.optional')} onChange={(e) => setForm({ ...form, archivalDays: e.target.value })} />
                  <GlassInput label={t('dg.deleteAfter')} type="number" value={form.deleteAfterDays} placeholder={t('common.optional')} onChange={(e) => setForm({ ...form, deleteAfterDays: e.target.value })} />
                  <div className="flex items-end gap-2">
                    <GlassSwitch
                      checked={form.isActive}
                      onChange={(checked) => setForm({ ...form, isActive: checked })}
                      aria-label={t('dg.active')}
                    />
                    <span className="text-sm font-semibold">{t('dg.active')}</span>
                    <GlassButton
                      size="sm"
                      variant="primary"
                      onClick={() => upsertMutation.mutate({
                        dataType: dt.value,
                        retentionDays: form.retentionDays,
                        archivalDays: form.archivalDays ? +form.archivalDays : null,
                        deleteAfterDays: form.deleteAfterDays ? +form.deleteAfterDays : null,
                        isActive: form.isActive,
                      })}
                      disabled={upsertMutation.isPending}
                    >
                      {upsertMutation.isPending ? t('common.saving') : t('common.save')}
                    </GlassButton>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}

function ExportLogTab() {
  const { t } = useSafeI18n();
  const { playTick } = usePremiumSound();
  const [page, setPage] = useState(1);
  const [exportTypeFilter, setExportTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const exportLogQuery = useQuery({
    queryKey: ['dg-export-log', page, exportTypeFilter, statusFilter],
    queryFn: () => dataGovernanceApi.exportLogs({ page, limit: 20, exportType: exportTypeFilter || undefined, status: statusFilter || undefined }),
  });

  const handleOpenExportSidecar = useCallback((item: ExportLog) => {
    playTick();
    const sidecarData: QuickLookData = {
      title: `Export: ${item.exportType}`,
      subtitle: `${item.format} • ${item.status}`,
      badge: {
        text: item.status,
        tone: item.status === 'COMPLETED' ? 'emerald' : item.status === 'FAILED' ? 'rose' : 'amber',
      },
      status: {
        label: item.status === 'COMPLETED' ? 'Export Successful' : item.status === 'FAILED' ? 'Export Failed' : 'Processing Log',
        tone: item.status === 'COMPLETED' ? 'success' : item.status === 'FAILED' ? 'error' : 'warning',
      },
      metrics: [
        { label: 'Exported Records', value: item.recordCount.toLocaleString() },
        { label: 'Data File Format', value: item.format },
        { label: 'Authorized Operator', value: item.user ? `${item.user.firstName} ${item.user.lastName}` : 'System Agent' },
        { label: 'Timestamp', value: new Date(item.createdAt).toLocaleString() },
      ],
      details: [
        { label: 'Log Reference ID', value: item.id },
        { label: 'Data Scope Type', value: item.exportType },
        { label: 'Execution Status', value: item.status },
        { label: 'ISO Timestamp', value: new Date(item.createdAt).toISOString() },
      ],
    };
    openSidecar(sidecarData);
  }, [playTick]);

  const data = exportLogQuery.data as Paginated<ExportLog> | undefined;
  const items = data?.items ?? [];

  if (exportLogQuery.isLoading) return <GlassPageLoader />;
  if (exportLogQuery.error) return <GlassErrorState message={getErrorMessage(exportLogQuery.error as Error)} onRetry={() => exportLogQuery.refetch()} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <GlassSelect value={exportTypeFilter} onChange={(e) => { setExportTypeFilter(e.target.value); setPage(1); }} aria-label={t('dg.allTypes')}>
          <option value="">{t('dg.allTypes')}</option>
          {EXPORT_TYPES.map((et) => <option key={et.value} value={et.value}>{et.label}</option>)}
        </GlassSelect>
        <GlassSelect value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} aria-label={t('dg.allStatus')}>
          <option value="">{t('dg.allStatus')}</option>
          <option value="PENDING">{t('dg.status.PENDING')}</option>
          <option value="PROCESSING">{t('dg.status.PROCESSING')}</option>
          <option value="COMPLETED">{t('dg.status.COMPLETED')}</option>
          <option value="FAILED">{t('dg.status.FAILED')}</option>
        </GlassSelect>
      </div>

      {items.length === 0 ? (
        <GlassEmptyState title={t('dg.noExports')} message={t('dg.noExportsHint')} />
      ) : (
        <div className="liquid-glass-card liquid-glass-surface overflow-hidden rounded-3xl border border-white/60 dark:border-white/10 shadow-[0_12px_40px_-12px_rgba(15,23,42,0.1),inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-card)]/40">
                  <th className="px-5 py-3.5 text-left text-[0.72rem] font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('dg.type')}</th>
                  <th className="px-5 py-3.5 text-left text-[0.72rem] font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('dg.format')}</th>
                  <th className="px-5 py-3.5 text-left text-[0.72rem] font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('dg.records')}</th>
                  <th className="px-5 py-3.5 text-left text-[0.72rem] font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('dg.user')}</th>
                  <th className="px-5 py-3.5 text-left text-[0.72rem] font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('common.status')}</th>
                  <th className="px-5 py-3.5 text-left text-[0.72rem] font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('common.date')}</th>
                  <th className="px-5 py-3.5 text-right text-[0.72rem] font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('common.actions') || 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]/40">
                {items.map((item: { id: string; [key: string]: any }) => (
                  <tr
                    key={item.id}
                    tabIndex={0}
                    role="button"
                    onClick={() => handleOpenExportSidecar(item as any)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleOpenExportSidecar(item as any);
                      }
                    }}
                    className="hover:bg-indigo-500/[0.04] dark:hover:bg-indigo-400/[0.04] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    <td className="px-5 py-3.5 font-semibold text-[var(--text-primary)]">{item.exportType}</td>
                    <td className="px-5 py-3.5 font-mono text-xs text-[var(--text-secondary)]">{item.format}</td>
                    <td className="px-5 py-3.5 font-mono text-xs font-bold text-[var(--text-primary)]">{(item.recordCount ?? 0).toLocaleString()}</td>
                    <td className="px-5 py-3.5 font-medium">{item.user ? `${item.user.firstName} ${item.user.lastName}` : '—'}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[0.7rem] font-bold ${
                        item.status === 'COMPLETED' ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
                        item.status === 'FAILED' ? 'bg-rose-500/12 text-rose-600 dark:text-rose-400 border border-rose-500/20' :
                        'bg-amber-500/12 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-[var(--text-muted)]">{new Date(item.createdAt).toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenExportSidecar(item as any);
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 transition-all border border-indigo-500/20 inline-flex items-center gap-1"
                        title="Inspect export in macOS Sidecar"
                      >
                        <span>◨</span>
                        <span>Sidecar</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <GlassButton size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>{t('common.prev')}</GlassButton>
          <span className="text-sm font-semibold text-[var(--text-muted)]">{page} / {data.totalPages}</span>
          <GlassButton size="sm" onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))} disabled={page >= data.totalPages}>{t('common.next')}</GlassButton>
        </div>
      )}
    </div>
  );
}

function AccessAuditTab() {
  const { t } = useSafeI18n();
  const { playTick } = usePremiumSound();
  const [page, setPage] = useState(1);
  const [entityFilter, setEntityFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const accessQuery = useQuery({
    queryKey: ['dg-access-audit', page, entityFilter, actionFilter],
    queryFn: () => dataGovernanceApi.getDataAccessAudit({ page, limit: 20, entityType: entityFilter || undefined, action: actionFilter || undefined }),
  });

  const handleOpenAccessSidecar = useCallback((item: DataAccessLog) => {
    playTick();
    const sidecarData: QuickLookData = {
      title: `${item.action} on ${item.resource}`,
      subtitle: `Target Resource ID: ${item.resourceId ?? 'N/A'}`,
      badge: {
        text: item.action,
        tone: item.action === 'DELETE' ? 'rose' : item.action === 'CREATE' ? 'emerald' : 'blue',
      },
      status: {
        label: `Access Audit • ${item.action}`,
        tone: item.action === 'DELETE' ? 'error' : item.action === 'CREATE' ? 'success' : 'primary',
      },
      metrics: [
        { label: 'Security Action', value: item.action },
        { label: 'Protected Resource', value: item.resource },
        { label: 'Source IP Address', value: item.ipAddress ?? 'Internal System' },
        { label: 'Actor Name', value: item.userName ?? 'Anonymous / Background' },
      ],
      details: [
        { label: 'Audit Record ID', value: item.id },
        { label: 'Resource Identifier', value: item.resourceId ?? 'None' },
        { label: 'User Identifier', value: item.userId ?? 'None' },
        { label: 'Exact ISO Timestamp', value: new Date(item.timestamp).toISOString() },
      ],
    };
    openSidecar(sidecarData);
  }, [playTick]);

  const data = accessQuery.data as Paginated<DataAccessLog> | undefined;
  const items = data?.items ?? [];

  if (accessQuery.isLoading) return <GlassPageLoader />;
  if (accessQuery.error) return <GlassErrorState message={getErrorMessage(accessQuery.error as Error)} onRetry={() => accessQuery.refetch()} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <GlassSelect value={entityFilter} onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }} aria-label={t('dg.allEntities')}>
          <option value="">{t('dg.allEntities')}</option>
          <option value="STUDENT">{t('dg.entity.STUDENT')}</option>
          <option value="PAYMENT">{t('dg.entity.PAYMENT')}</option>
          <option value="EMPLOYEE">{t('dg.entity.EMPLOYEE')}</option>
          <option value="SALARY">{t('dg.entity.SALARY')}</option>
          <option value="INVOICE">{t('dg.entity.INVOICE')}</option>
          <option value="EXPENSE">{t('dg.entity.EXPENSE')}</option>
          <option value="FACE_ENROLLMENT">{t('dg.entity.FACE_ENROLLMENT')}</option>
          <option value="PARENT_ACCOUNT">{t('dg.entity.PARENT_ACCOUNT')}</option>
        </GlassSelect>
        <GlassSelect value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }} aria-label={t('dg.allActions')}>
          <option value="">{t('dg.allActions')}</option>
          <option value="CREATE">{t('dg.act.CREATE')}</option>
          <option value="UPDATE">{t('dg.act.UPDATE')}</option>
          <option value="DELETE">{t('dg.act.DELETE')}</option>
          <option value="EXPORT">{t('dg.act.EXPORT')}</option>
          <option value="LOGIN">{t('dg.act.LOGIN')}</option>
        </GlassSelect>
      </div>

      {items.length === 0 ? (
        <GlassEmptyState title={t('dg.noAccessLogs')} message={t('dg.noAccessLogsHint')} />
      ) : (
        <div className="liquid-glass-card liquid-glass-surface overflow-hidden rounded-3xl border border-white/60 dark:border-white/10 shadow-[0_12px_40px_-12px_rgba(15,23,42,0.1),inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-card)]/40">
                  <th className="px-5 py-3.5 text-left text-[0.72rem] font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('dg.action')}</th>
                  <th className="px-5 py-3.5 text-left text-[0.72rem] font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('dg.entity')}</th>
                  <th className="px-5 py-3.5 text-left text-[0.72rem] font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('dg.entityId')}</th>
                  <th className="px-5 py-3.5 text-left text-[0.72rem] font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('dg.user')}</th>
                  <th className="px-5 py-3.5 text-left text-[0.72rem] font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('dg.ip')}</th>
                  <th className="px-5 py-3.5 text-left text-[0.72rem] font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('common.date')}</th>
                  <th className="px-5 py-3.5 text-right text-[0.72rem] font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('common.actions') || 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]/40">
                {items.map((item: { id: string; [key: string]: any }) => (
                  <tr
                    key={item.id}
                    onClick={() => handleOpenAccessSidecar(item as any)}
                    className="hover:bg-indigo-500/[0.04] dark:hover:bg-indigo-400/[0.04] transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[0.7rem] font-bold ${
                        item.action === 'DELETE' ? 'bg-rose-500/12 text-rose-600 dark:text-rose-400 border border-rose-500/20' :
                        item.action === 'CREATE' ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
                        item.action === 'EXPORT' ? 'bg-amber-500/12 text-amber-600 dark:text-amber-400 border border-amber-500/20' :
                        'bg-blue-500/12 text-brand-600 dark:text-brand-400 border border-blue-500/20'
                      }`}>{item.action}</span>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-[var(--text-primary)]">{item.resource}</td>
                    <td className="px-5 py-3.5 font-mono text-xs text-[var(--text-secondary)]">{item.resourceId ?? '—'}</td>
                    <td className="px-5 py-3.5 font-medium">{item.userName ?? '—'}</td>
                    <td className="px-5 py-3.5 text-xs font-mono text-[var(--text-muted)]">{item.ipAddress ?? '—'}</td>
                    <td className="px-5 py-3.5 text-xs text-[var(--text-muted)]">{new Date(item.timestamp).toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenAccessSidecar(item as any);
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 transition-all border border-indigo-500/20 inline-flex items-center gap-1"
                        title="Inspect access log in macOS Sidecar"
                      >
                        <span>◨</span>
                        <span>Sidecar</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <GlassButton size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>{t('common.prev')}</GlassButton>
          <span className="text-sm font-semibold text-[var(--text-muted)]">{page} / {data.totalPages}</span>
          <GlassButton size="sm" onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))} disabled={page >= data.totalPages}>{t('common.next')}</GlassButton>
        </div>
      )}
    </div>
  );
}

function SummaryTab() {
  const { t } = useSafeI18n();
  const toast = useToast();
  const { playSuccess, playError } = usePremiumSound();

  const statsQuery = useQuery({
    queryKey: ['dg-export-stats'],
    queryFn: () => dataGovernanceApi.getExportStats(),
  });

  const policiesQuery = useQuery({
    queryKey: ['dg-policies'],
    queryFn: () => dataGovernanceApi.getRetentionPolicies(),
  });

  const retentionMutation = useMutation({
    mutationFn: async () => (await dataGovernanceApi.runRetentionCheck()) as RetentionCheckResult,
    onSuccess: (data) => {
      playSuccess();
      toast.success(t('dg.retentionChecked', { count: data.policiesChecked }));
    },
    onError: (err: Error) => {
      playError();
      toast.error(getErrorMessage(err));
    },
  });

  const stats = statsQuery.data;
  const policies = policiesQuery.data ?? [];
  const activePolicies = policies.filter((p: DataGovernancePolicy) => p.isActive).length;
  const lastRun = policies.reduce((latest: Date | null, p: any) => {
    if (!p.lastRunAt) return latest;
    const d = new Date(p.lastRunAt);
    return !latest || d > latest ? d : latest;
  }, null);

  if (statsQuery.isLoading) return <GlassPageLoader />;
  if (statsQuery.error) return <GlassErrorState message={getErrorMessage(statsQuery.error as Error)} onRetry={() => statsQuery.refetch()} />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t('dg.totalExports')} value={stats?.totalExports ?? 0} color="bg-blue-500" />
        <StatCard label={t('dg.last30Days')} value={stats?.last30Days ?? 0} color="bg-emerald-500" />
        <StatCard label={t('dg.activePolicies')} value={activePolicies} color="bg-purple-500" />
        <StatCard label={t('dg.totalPolicies')} value={policies.length} color="bg-amber-500" />
      </div>

      <div className="liquid-glass-card liquid-glass-surface rounded-2xl border border-white/60 dark:border-white/10 p-6 shadow-[0_8px_32px_-8px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)]">{t('dg.retentionCheck')}</h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {lastRun ? `${t('dg.lastRun')}: ${lastRun.toLocaleString()}` : t('dg.neverRun')}
            </p>
          </div>
          <GlassButton size="sm" variant="primary" onClick={() => retentionMutation.mutate()} disabled={retentionMutation.isPending}>
            {retentionMutation.isPending ? t('common.loading') : t('dg.runCheck')}
          </GlassButton>
        </div>

        {stats?.byType && stats.byType.length > 0 && (
          <div className="mt-5">
            <h4 className="text-[0.72rem] font-bold text-[var(--text-muted)] uppercase tracking-wide mb-3">{t('dg.exportsByType')}</h4>
            <div className="space-y-2">
              {stats.byType.map((item) => (
                <div key={item.type} className="flex items-center justify-between py-2.5 border-b border-[var(--border-subtle)]/40 last:border-0">
                  <span className="text-sm font-semibold">{item.type}</span>
                  <span className="text-sm font-mono font-bold text-[var(--text-muted)]">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {stats?.lastExport && (
          <div className="mt-5 pt-4 border-t border-[var(--border-subtle)]/40">
            <h4 className="text-[0.72rem] font-bold text-[var(--text-muted)] uppercase tracking-wide mb-2">{t('dg.lastExport')}</h4>
            <p className="text-sm font-semibold">{stats.lastExport.exportType} ({stats.lastExport.format}) — {(stats.lastExport.recordCount ?? 0).toLocaleString()} records</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{new Date(stats.lastExport.createdAt).toLocaleString()}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function DataGovernancePage() {
  const { t } = useSafeI18n();
  const { playTick } = usePremiumSound();
  const [activeTab, setActiveTab] = useState<TabKey>('summary');

  const tabs: { id: TabKey; label: string; key: string }[] = [
    { id: 'summary', label: t('dg.tabSummary'), key: '1' },
    { id: 'policies', label: t('dg.tabPolicies'), key: '2' },
    { id: 'exports', label: t('dg.tabExports'), key: '3' },
    { id: 'access', label: t('dg.tabAccess'), key: '4' },
  ];

  // Keyboard Shortcuts: 1-4 for tabs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }
      if (e.key === '1') {
        e.preventDefault();
        playTick();
        setActiveTab('summary');
      } else if (e.key === '2') {
        e.preventDefault();
        playTick();
        setActiveTab('policies');
      } else if (e.key === '3') {
        e.preventDefault();
        playTick();
        setActiveTab('exports');
      } else if (e.key === '4') {
        e.preventDefault();
        playTick();
        setActiveTab('access');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playTick]);

  return (
    <div className="relative space-y-6 pb-[max(6rem,env(safe-area-inset-bottom))]">
      <AuroraMesh variant="corporate" />
      <GlassPageHeader title={t('dg.title')} subtitle={t('dg.subtitle')} />

      {/* Apple segmented control */}
      <div className="liquid-glass-card liquid-glass-surface flex gap-1.5 p-1.5 rounded-2xl border border-[var(--border-subtle)] w-fit overflow-x-auto max-w-full mb-6 backdrop-blur-xl shadow-sm">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                playTick();
                setActiveTab(tab.id);
              }}
              className={`relative inline-flex items-center justify-center min-h-[44px] gap-1.5 px-4 py-2.5 rounded-xl text-[0.85rem] font-semibold transition-colors duration-200 whitespace-nowrap shrink-0 z-10 ${
                isActive
                  ? 'text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="dg-tab-pill"
                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                  className="absolute inset-0 rounded-xl bg-white/80 dark:bg-white/15 border border-black/5 dark:border-white/10 shadow-[0_2px_10px_rgba(0,0,0,0.06)] -z-10"
                />
              )}
              <span>{tab.label}</span>
              <kbd className="hidden sm:inline-block text-[9px] opacity-60 font-mono px-1 py-0.2 rounded bg-black/5 dark:bg-white/10">{tab.key}</kbd>
            </button>
          );
        })}
      </div>

      {activeTab === 'summary' && <SummaryTab />}
      {activeTab === 'policies' && <RetentionPoliciesTab />}
      {activeTab === 'exports' && <ExportLogTab />}
      {activeTab === 'access' && <AccessAuditTab />}
    </div>
  );
}

export default DataGovernancePage;
