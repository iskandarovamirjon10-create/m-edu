/**
 * CommunicationHistoryPage — Ultra Premium Apple-Style Comm Dashboard
 * Features fluid typography, deep frosted glass modules, macOS-style
 * segmented controls, staggered animations, and dynamic visual timelines.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, type Variants } from 'framer-motion';
import { GlassPageHeader, GlassPageLoader, GlassTable, GlassTHead, GlassTBody, GlassTR, GlassTH, GlassTD, GlassEmptyState, GlassErrorState, GlassSelect, GlassButton, GlassInput, GlassTabs } from '@/components/ui';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { communicationApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessages';
import { AuroraMesh } from '@/components/ui/AuroraMesh';

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

const TABS = [
 { id:'timeline', labelKey:'Timeline'},
 { id:'history', labelKey:'History'},
 { id:'stats', labelKey:'Statistics'},
];

const ENTITY_TYPES = ['STUDENT','PARENT','TEACHER','LEAD'];

// Premium Apple-style configuration for channels
function getChannelConfig(channel: string) {
 switch (channel) {
 case'EMAIL': return { bg:'bg-brand-500/10', text:'text-brand-600', border:'border-blue-500/20', dot:'bg-blue-500', fill:'#3b82f6'};
 case'SMS': return { bg:'bg-emerald-500/10', text:'text-emerald-600', border:'border-emerald-500/20', dot:'bg-emerald-500', fill:'#10b981'};
 case'TELEGRAM': return { bg:'bg-indigo-500/10', text:'text-indigo-600', border:'border-indigo-500/20', dot:'bg-indigo-500', fill:'#6366f1'};
 case'IN_APP': return { bg:'bg-amber-500/10', text:'text-amber-600', border:'border-amber-500/20', dot:'bg-amber-500', fill:'#f59e0b'};
 default: return { bg:'bg-[var(--state-hover)]', text:'text-[var(--text-secondary)]', border:'border-[var(--border-subtle)]/50', dot:'bg-gray-400', fill:'#9ca3af'};
}
}

// Premium Apple-style configuration for delivery statuses
function getStatusConfig(status: string) {
 switch (status) {
 case'DELIVERED': return { bg:'bg-emerald-500/10', text:'text-emerald-600', border:'border-emerald-500/20', dot:'bg-emerald-500', fill:'#10b981'};
 case'SENT': return { bg:'bg-brand-500/10', text:'text-brand-600', border:'border-blue-500/20', dot:'bg-blue-500', fill:'#3b82f6'};
 case'FAILED': return { bg:'bg-rose-500/10', text:'text-rose-600', border:'border-rose-500/20', dot:'bg-rose-500', fill:'#f43f5e'};
 case'BOUNCED': return { bg:'bg-amber-500/10', text:'text-amber-600', border:'border-amber-500/20', dot:'bg-amber-500', fill:'#f59e0b'};
 case'QUEUED': return { bg:'bg-slate-500/10', text:'text-slate-500 dark:text-slate-400', border:'border-slate-500/20', dot:'bg-slate-400 animate-pulse', fill:'#94a3b8'};
 default: return { bg:'bg-[var(--state-hover)]', text:'text-[var(--text-secondary)]', border:'border-[var(--border-subtle)]/50', dot:'bg-gray-400', fill:'#9ca3af'};
}
}

// Custom iOS-style Segmented Control for Tabs
function CommStatCard({ label, value, highlightColor}: { label: string; value: string | number; highlightColor: string}) {
  return (
    <motion.div
      variants={itemVariants}
      whileHover={{ y: -3, transition: SPRING.snappy }}
      className="relative overflow-hidden rounded-2xl p-5 sm:p-6 group transition-all duration-300 glass-card flex flex-col justify-between h-full border border-white/40 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20 z-10" />
      <div className="absolute inset-0 rounded-2xl pointer-events-none ring-1 ring-inset ring-black/5 dark:ring-white/5" aria-hidden />
      <div className={`absolute -top-10 -right-10 w-24 h-24 rounded-full blur-[30px] opacity-10 transition-opacity group-hover:opacity-20 ${highlightColor}`} aria-hidden />
      
      <p className="text-[0.75rem] font-bold text-[var(--text-muted)] uppercase tracking-widest relative z-10 mb-4">
        {label}
      </p>
      <p className="text-[2rem] font-black tracking-tight leading-none text-[var(--text-primary)] relative z-10 tabular-nums">
        {value}
      </p>
    </motion.div>
  );
}

/* ── TABS ─────────────────────────────────────────────────────────────────── */

function TimelineTab() {
 const { t } = useSafeI18n();
 usePageTitle(t('communication.title'));
 const [entityType, setEntityType] = useState('STUDENT');
 const [entityId, setEntityId] = useState('');

 const timelineQuery = useQuery({
 queryKey: ['communication-timeline', entityType, entityId],
 queryFn: () => communicationApi.getTimeline(entityType, entityId),
 enabled: !!entityId.trim(),
});

 const items: any[] = (timelineQuery.data as any)?.items ?? [];

 return (
 <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
 
 {/* Search Toolbar */}
 <div className="rounded-2xl bg-[var(--bg-card)] backdrop-blur-md border border-[var(--border-subtle)]/60 p-6 sm:p-8 shadow-[0_4px_16px_rgba(0,0,0,0.02)]">
 <div className="flex flex-col md:flex-row md:items-end gap-6">
 <div className="flex-1">
 <label className="block text-[0.75rem] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-3">
 {t('communication.entityType')}
 </label>
 <div className="flex flex-wrap gap-2 p-1.5 rounded-[1.25rem] bg-[var(--state-hover)] border border-[var(--border-subtle)]/50 w-max">
 {ENTITY_TYPES.map((et) => (
 <GlassButton
 key={et}
 type="button"
 size="sm"
 variant={entityType === et ?'primary' :'ghost'}
 onClick={() => setEntityType(et)}
 >
 {t(`communication.entity.${et.toLowerCase()}`) || et}
 </GlassButton>
 ))}
 </div>
 </div>
 
 <div className="flex-1">
 <label className="block text-[0.75rem] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-3">
 {t('communication.entityId')}
 </label>
  <div className="relative">
  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] z-10">
  <svg className="w-4 h-4"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2.5"><circle cx="11"cy="11"r="8"/><line x1="21"y1="21"x2="16.65"y2="16.65"/></svg>
  </span>
  <GlassInput
  value={entityId}
  onChange={(e) => setEntityId(e.target.value)}
  placeholder={t('communication.entityIdPlaceholder')}
  className="w-full pl-11 h-[3.25rem] rounded-[1.25rem] font-semibold"
  />
  </div>
 </div>
 </div>
 </div>

 {/* Timeline View */}
 <div className="rounded-[2.5rem] glass-card p-6 sm:p-10 relative overflow-hidden min-h-[400px]">
 <div className="absolute inset-0 rounded-[2.5rem] pointer-events-none ring-1 ring-inset ring-black/5 dark:ring-white/5"aria-hidden="true"/>
 
 <div className="relative z-10">
 {!entityId.trim() ? (
 <div className="py-12 flex items-center justify-center">
 <GlassEmptyState title={t('communication.selectEntity')} message={t('communication.selectEntityHint')} />
 </div>
 ) : timelineQuery.isLoading ? (
 <div className="py-16 flex items-center justify-center"><GlassPageLoader label={t('common.loading')} /></div>
 ) : timelineQuery.isError ? (
 <div className="py-12"><GlassErrorState message={getErrorMessage(timelineQuery.error)} onRetry={() => timelineQuery.refetch()} /></div>
 ) : items.length === 0 ? (
 <div className="py-12 flex items-center justify-center">
 <GlassEmptyState title={t('communication.noTimeline')} message={t('communication.noTimelineHint')} />
 </div>
 ) : (
 <div className="relative pl-6 sm:pl-8">
 {/* Central vertical line */}
 <div className="absolute left-[27px] sm:left-[35px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-gray-200 via-gray-200 to-transparent dark:from-white/10 dark:via-white/10 dark:to-transparent"/>
 
 <div className="space-y-8">
 {items.map((item: any, idx: number) => {
 const cConfig = getChannelConfig(item.channel);
 const sConfig = getStatusConfig(item.status);
 
 return (
 <div key={item.id} className="relative flex gap-6 sm:gap-8 items-start animate-in fade-in slide-in-from-bottom-4 duration-500"style={{ animationDelay: `${idx * 50}ms`}}>
 {/* Timeline Node */}
 <div className="relative z-10 shrink-0 mt-4">
 <div className={`w-3.5 h-3.5 rounded-full ring-4 ring-white dark:ring-[#1a1a1a] shadow-[0_0_8px_rgba(0,0,0,0.2)] ${cConfig.dot}`} />
 </div>

 {/* Card Content */}
 <div className="flex-1 rounded-[1.5rem] bg-[var(--bg-card)] border border-[var(--border-subtle)] p-5 shadow-sm hover:shadow-md transition-shadow">
 <div className="flex flex-wrap items-center gap-2 mb-3">
 <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[0.65rem] font-black uppercase tracking-wider border ${cConfig.bg} ${cConfig.text} ${cConfig.border}`}>
 {item.channel}
 </span>
 <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[0.65rem] font-black uppercase tracking-wider border ${sConfig.bg} ${sConfig.text} ${sConfig.border}`}>
 <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${sConfig.dot}`} />
 {item.status}
 </span>
 <span className="text-[0.75rem] font-bold text-[var(--text-muted)] uppercase tracking-widest ml-auto">
 {new Date(item.createdAt).toLocaleString([], { dateStyle:'medium', timeStyle:'short'})}
 </span>
 </div>
 
 {item.subject && (
 <h4 className="text-[1.05rem] font-bold text-[var(--text-primary)] mb-2">{item.subject}</h4>
 )}
 <p className="text-[0.85rem] font-medium text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap break-words">
 {item.content}
 </p>
 
 {item.failureReason && (
 <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2">
 <svg className="w-4 h-4 text-rose-500 shrink-0 mt-0.5"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2.5"><circle cx="12"cy="12"r="10"/><line x1="12"y1="8"x2="12"y2="12"/><line x1="12"y1="16"x2="12.01"y2="16"/></svg>
 <span className="text-[0.8rem] font-bold text-rose-700 leading-snug">{item.failureReason}</span>
 </div>
 )}
 </div>
 </div>
 );
})}
 </div>
 </div>
 )}
 </div>
 </div>
 </div>
 );
}

function HistoryTab() {
 const { t } = useSafeI18n();
 const [page, setPage] = useState(1);
 const [channelFilter, setChannelFilter] = useState('');
 const [statusFilter, setStatusFilter] = useState('');

 const historyQuery = useQuery({
 queryKey: ['communication-history', page, channelFilter, statusFilter],
 queryFn: () =>
 communicationApi.getHistory({
 page,
 limit: 15,
 ...(channelFilter ? { channel: channelFilter} : {}),
 ...(statusFilter ? { status: statusFilter} : {}),
}),
});

 const items: any[] = (historyQuery.data as any)?.items ?? [];
 const total = (historyQuery.data as any)?.total ?? 0;
 const totalPages = (historyQuery.data as any)?.totalPages ?? 1;

 return (
 <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
 
 {/* Toolbar */}
 <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-[1.5rem] glass-card">
 <div className="flex flex-wrap gap-3 w-full sm:max-w-xl">
 <GlassSelect
 value={channelFilter}
 onChange={(e) => { setChannelFilter(e.target.value); setPage(1);}}
 className="flex-1 sm:max-w-[200px]"
 aria-label={t('communication.allChannels')}
 >
 <option value="">{t('communication.allChannels')}</option>
 <option value="EMAIL">{t('communication.channel.EMAIL') || 'Email'}</option>
 <option value="SMS">{t('communication.channel.SMS') || 'SMS'}</option>
 <option value="TELEGRAM">{t('communication.channel.TELEGRAM') || 'Telegram'}</option>
 <option value="IN_APP">{t('communication.channel.IN_APP')}</option>
 </GlassSelect>
 <GlassSelect
 value={statusFilter}
 onChange={(e) => { setStatusFilter(e.target.value); setPage(1);}}
 className="flex-1 sm:max-w-[200px]"
 aria-label={t('communication.allStatuses')}
 >
 <option value="">{t('communication.allStatuses')}</option>
 <option value="QUEUED">{t('communication.status.QUEUED')}</option>
 <option value="SENT">{t('communication.status.SENT')}</option>
 <option value="DELIVERED">{t('communication.status.DELIVERED')}</option>
 <option value="FAILED">{t('communication.status.FAILED')}</option>
 <option value="BOUNCED">{t('communication.status.BOUNCED')}</option>
 </GlassSelect>
 </div>
  <div className="hidden sm:block text-[0.8rem] font-bold text-[var(--text-muted)] uppercase tracking-widest whitespace-nowrap px-2">
  {total} {total === 1 ? t('communication.recordOne') : t('communication.recordMany')}
  </div>
 </div>

 {/* Main Data Grid */}
 <div className="rounded-[2.5rem] glass-card overflow-hidden relative min-h-[400px]">
 <div className="absolute inset-0 rounded-[2.5rem] pointer-events-none ring-1 ring-inset ring-black/5 dark:ring-white/5"aria-hidden="true"/>

    <div className="relative z-10 w-full overflow-x-auto custom-scrollbar">
      {historyQuery.isLoading ? (
        <div className="p-16 flex items-center justify-center"><GlassPageLoader label={t('common.loading')} /></div>
      ) : historyQuery.isError ? (
        <div className="p-12"><GlassErrorState message={getErrorMessage(historyQuery.error)} onRetry={() => historyQuery.refetch()} /></div>
      ) : items.length === 0 ? (
        <div className="p-16"><GlassEmptyState title={t('communication.noRecords')} message={t('notifications.noMatchHint')} /></div>
      ) : (
 <GlassTable>
 <GlassTHead>
 <GlassTR>
 <GlassTH>{t('communication.col.channel')}</GlassTH>
 <GlassTH>{t('communication.col.entity')}</GlassTH>
 <GlassTH>{t('communication.col.subject')}</GlassTH>
 <GlassTH>{t('communication.col.status')}</GlassTH>
 <GlassTH className="text-right">{t('communication.col.date')}</GlassTH>
 </GlassTR>
 </GlassTHead>
 <GlassTBody>
 {items.map((item: any, idx: number) => {
 const cConfig = getChannelConfig(item.channel);
 const sConfig = getStatusConfig(item.status);

 return (
 <GlassTR key={item.id} className="hover:bg-transparent dark:hover:bg-[var(--bg-card)] transition-colors"style={{ animationDelay: `${idx * 40}ms`}}>
 
 <GlassTD>
 <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[0.65rem] font-black uppercase tracking-wider border ${cConfig.bg} ${cConfig.text} ${cConfig.border}`}>
 {item.channel}
 </span>
 </GlassTD>
 
 <GlassTD>
 <div className="flex flex-col">
 <span className="text-[0.7rem] font-bold text-[var(--text-muted)] uppercase tracking-widest">{item.entityType}</span>
 <span className="text-[0.85rem] font-bold text-[var(--text-primary)] font-mono">{item.entityId.slice(0, 8)}…</span>
 </div>
 </GlassTD>
 
 <GlassTD className="max-w-[16rem]">
 <span className="text-[0.85rem] font-medium text-[var(--text-secondary)] truncate block">
 {item.subject || item.content?.slice(0, 50) ||'—'}
 </span>
 </GlassTD>
 
 <GlassTD>
 <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[0.65rem] font-black uppercase tracking-wider border ${sConfig.bg} ${sConfig.text} ${sConfig.border}`}>
 <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${sConfig.dot}`} />
 {item.status}
 </span>
 </GlassTD>

 <GlassTD className="text-right">
 <span className="text-[0.8rem] font-bold text-[var(--text-muted)] uppercase tracking-widest">
 {new Date(item.createdAt).toLocaleString([], { dateStyle:'short', timeStyle:'short'})}
 </span>
 </GlassTD>

 </GlassTR>
 );
})}
 </GlassTBody>
 </GlassTable>
 )}
 </div>

 {/* Pagination Footer */}
 {totalPages > 1 && (
 <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg-card)] relative z-10">
 <span className="text-[0.8rem] font-bold text-[var(--text-muted)] uppercase tracking-widest hidden sm:block">
 {t('common.showing')} {items.length} {t('common.of')} {total}
 </span>
 <div className="flex gap-2 ml-auto">
 <GlassButton
 type="button"
 size="sm"
 variant="secondary"
 disabled={page <= 1}
 onClick={() => setPage((p) => p - 1)}
 >
 {t('common.previous')}
 </GlassButton>
 <div className="flex items-center px-4 font-mono text-[0.85rem] font-bold text-[var(--text-primary)]">
 {page} <span className="text-[var(--text-muted)] mx-1">/</span> {totalPages}
 </div>
 <GlassButton
 type="button"
 size="sm"
 variant="secondary"
 disabled={page >= totalPages}
 onClick={() => setPage((p) => p + 1)}
 >
 {t('common.next')}
 </GlassButton>
 </div>
 </div>
 )}
 </div>
 </div>
 );
}

// ── SVG Donut & Bar Chart Components ────────────────────────────────────────

function DonutChart({ data}: { data: any[]}) {
 const { t } = useSafeI18n();
 const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
 let cumulative = 0;
 
 const segments = data.map(d => {
 const pct = d.value / total;
 const start = cumulative;
 cumulative += pct;
 return { ...d, pct, start};
});

 const cx = 50;
 const cy = 50;
 const r = 40;
 const circumference = 2 * Math.PI * r;

 return (
 <div className="relative w-48 h-48 drop-shadow-md mx-auto">
 <svg width="100%"height="100%"viewBox="0 0 100 100"className="transform -rotate-90">
 <circle cx={cx} cy={cy} r={r} fill="none"className="stroke-gray-100 dark:stroke-white/5"strokeWidth={12} />
 {segments.map((seg) => {
 const dash = seg.pct * circumference;
 const offset = (1 - seg.start) * circumference;
 return (
 <circle
 key={seg.name}
 cx={cx}
 cy={cy}
 r={r}
 fill="none"
 stroke={getStatusConfig(seg.name).fill}
 strokeWidth={12}
 strokeDasharray={`${dash} ${circumference - dash}`}
 strokeDashoffset={offset}
 strokeLinecap="round"
 className="transition-all duration-1000 ease-out"
 />
 );
 })}
 </svg>
 <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
 <span className="text-[1.5rem] font-extrabold text-[var(--text-primary)] leading-none font-mono">{total}</span>
 <span className="text-[0.65rem] font-bold text-[var(--text-muted)] uppercase tracking-widest mt-1">{t('common.total')}</span>
 </div>
 </div>
 );
}

function StatsTab() {
 const { t } = useSafeI18n();

 const statsQuery = useQuery({
 queryKey: ['communication-stats'],
 queryFn: () => communicationApi.getStats(),
});

 const stats = (statsQuery.data as any) ?? {};

 if (statsQuery.isLoading) {
 return (
 <div className="p-16 flex items-center justify-center rounded-[2.5rem] glass-card animate-in fade-in">
 <GlassPageLoader label={t('common.loading')} />
 </div>
 );
}

 if (statsQuery.isError) {
 return <div className="p-12"><GlassErrorState message={getErrorMessage(statsQuery.error)} onRetry={() => statsQuery.refetch()} /></div>;
}

 const channelData = (stats.byChannel ?? []).map((c: any) => ({
 name: c.channel,
 value: c.count,
}));

 const statusData = (stats.byStatus ?? []).map((s: any) => ({
 name: s.status,
 value: s.count,
}));

 return (
 <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
 
 {/* KPI Cards */}
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
 <CommStatCard label={t('communication.totalSent')} value={stats.total ?? 0} highlightColor="bg-blue-500"/>
 <CommStatCard label={t('communication.delivered')} value={stats.deliveredCount ?? 0} highlightColor="bg-emerald-500"/>
 <CommStatCard label={t('communication.failed')} value={stats.failedCount ?? 0} highlightColor="bg-rose-500"/>
 <CommStatCard label={t('communication.deliveryRate')} value={`${stats.deliveryRate ?? 0}%`} highlightColor="bg-brand-500"/>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 
 {/* Channel Breakdown */}
 <div className="rounded-[2.5rem] bg-[var(--bg-card)] backdrop-blur-[30px] backdrop-saturate-[2] border border-[var(--border-subtle)]/60 p-6 sm:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.04)] relative overflow-hidden">
 <div className="absolute inset-0 rounded-[2.5rem] pointer-events-none ring-1 ring-inset ring-black/5 dark:ring-white/5"aria-hidden="true"/>
 <h3 className="text-[1.1rem] font-bold text-[var(--text-primary)] mb-8 flex items-center gap-2 relative z-10">
 <div className="w-8 h-8 rounded-full bg-cyan-500/10 text-cyan-600 flex items-center justify-center shrink-0">
 <svg className="w-4 h-4"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
 </div>
 {t('communication.byChannel')}
 </h3>
 
 <div className="relative z-10">
 {channelData.length === 0 ? (
 <p className="text-[0.85rem] font-medium text-[var(--text-muted)]">{t('communication.noData')}</p>
 ) : (
 <div className="flex items-end gap-3 sm:gap-6 h-[220px] pb-6 border-b border-[var(--border-subtle)]">
 {channelData.map((entry: any) => {
 const maxVal = Math.max(...channelData.map((d: any) => d.value), 1);
 const pct = Math.max((entry.value / maxVal) * 100, 4); // min height 4%
 const config = getChannelConfig(entry.name);
 return (
 <div key={entry.name} className="flex flex-col items-center flex-1 h-full justify-end group">
 <span className="text-[0.8rem] font-black font-mono mb-2 text-[var(--text-primary)] opacity-0 group-hover:opacity-100 transition-opacity">{entry.value}</span>
 <div className="w-full relative rounded-t-xl overflow-hidden transition-all duration-500 group-hover:brightness-110"style={{ height: `${pct}%`, backgroundColor: config.fill}}>
 <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"/>
 </div>
 <span className="text-[0.65rem] font-bold text-[var(--text-muted)] uppercase tracking-widest mt-3 truncate w-full text-center">{entry.name}</span>
 </div>
 );
})}
 </div>
 )}
 </div>
 </div>

 {/* Status Breakdown Donut */}
 <div className="rounded-[2.5rem] bg-[var(--bg-card)] backdrop-blur-[30px] backdrop-saturate-[2] border border-[var(--border-subtle)]/60 p-6 sm:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.04)] relative overflow-hidden">
 <div className="absolute inset-0 rounded-[2.5rem] pointer-events-none ring-1 ring-inset ring-black/5 dark:ring-white/5"aria-hidden="true"/>
 <h3 className="text-[1.1rem] font-bold text-[var(--text-primary)] mb-8 flex items-center gap-2 relative z-10">
 <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
 <svg className="w-4 h-4"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2.5"><circle cx="12"cy="12"r="10"/><line x1="12"y1="8"x2="12"y2="12"/><line x1="12"y1="16"x2="12.01"y2="16"/></svg>
 </div>
 {t('communication.byStatus')}
 </h3>
 
 <div className="relative z-10 flex flex-col sm:flex-row items-center justify-center gap-10 h-[220px]">
 {statusData.length === 0 ? (
 <p className="text-[0.85rem] font-medium text-[var(--text-muted)]">{t('communication.noData')}</p>
 ) : (
 <>
 <DonutChart data={statusData} />
 <div className="flex flex-col gap-3">
 {statusData.map((s: any) => {
 const config = getStatusConfig(s.name);
 return (
 <div key={s.name} className="flex items-center justify-between gap-4">
 <div className="flex items-center gap-2.5">
 <span className={`w-2.5 h-2.5 rounded-full shadow-sm ${config.dot}`} />
 <span className="text-[0.8rem] font-bold text-[var(--text-secondary)] capitalize">{s.name.toLowerCase()}</span>
 </div>
 <span className="text-[0.85rem] font-black font-mono text-[var(--text-primary)]">{s.value}</span>
 </div>
 );
})}
 </div>
 </>
 )}
 </div>
 </div>

 </div>
 </div>
 );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Main Component */
/* ────────────────────────────────────────────────────────────────────────── */

export function CommunicationHistoryPage() {
 const { t } = useSafeI18n();
 const [activeTab, setActiveTab] = useState('timeline');

 const tabs = TABS.map((tab) => ({ id: tab.id, label: t(`communication.tab.${tab.id}`) || tab.labelKey}));

  return (
    <div className="relative min-h-screen bg-transparent selection:bg-brand-500/30">
      <AuroraMesh variant="corporate" opacity={0.65} />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 w-full max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6 pb-[max(6rem,env(safe-area-inset-bottom))]"
      >
        <motion.div variants={itemVariants}>
          <GlassPageHeader
            title={t('communication.title')}
            subtitle={t('communication.subtitle')}
          />
        </motion.div>

        <motion.div variants={itemVariants} className="overflow-x-auto pb-2">
          <GlassTabs active={activeTab} onChange={setActiveTab} tabs={tabs} />
        </motion.div>

        <motion.div variants={itemVariants} className="pt-2">
          {activeTab === 'timeline' && <TimelineTab />}
          {activeTab === 'history' && <HistoryTab />}
          {activeTab === 'stats' && <StatsTab />}
        </motion.div>
      </motion.div>
    </div>
  );
}

export default CommunicationHistoryPage;