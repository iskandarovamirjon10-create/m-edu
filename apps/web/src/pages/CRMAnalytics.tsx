/**
 * CRMAnalyticsPage — Ultra Premium Apple-Style Analytics Dashboard
 * Features fluid typography, deep frosted glass modules, macOS-style
 * segmented controls, staggered animations, and dynamic visual funnels.
 */
import { useState} from'react';
import { useQuery} from'@tanstack/react-query';
import {
 GlassPageHeader,
 GlassPageLoader,
 GlassErrorState,
 GlassEmptyState,
 GlassTable,
 GlassTHead,
 GlassTBody,
 GlassTR,
 GlassTH,
 GlassTD, GlassTabs } from '@/components/ui';
import { analyticsApi} from'@/lib/api';
import { CRMFunnelResponse, CRMSources, CRMVelocityResponse, CRMLostReasonsResponse, CRMAgingResponse, CRMModeratorStats, CRMAgingLead } from '@/types/analytics';
import { usePageTitle} from'@/hooks/usePageTitle';
import { useI18n} from'../i18n/I18nProvider';
import { getErrorMessage} from'@/lib/errorMessages';

type TabId ='funnel' |'sources' |'velocity' |'lost-reasons' |'aging' |'moderators';

const TABS: { id: TabId; labelKey: string}[] = [
 { id:'funnel', labelKey:'crm.tab.funnel'},
 { id:'sources', labelKey:'crm.tab.sources'},
 { id:'velocity', labelKey:'crm.tab.velocity'},
 { id:'lost-reasons', labelKey:'crm.tab.lost-reasons'},
 { id:'aging', labelKey:'crm.tab.aging'},
 { id:'moderators', labelKey:'crm.tab.moderators'},
];

// Premium Apple-style configuration for pipeline stages
function getStageConfig(stage: string) {
 switch (stage) {
 case'NEW': return { bg:'bg-blue-500/10', text:'text-blue-600', border:'border-blue-500/20', dot:'bg-blue-500', fill:'bg-gradient-to-r from-blue-400 to-blue-500', label:'New'};
 case'CONTACTED': return { bg:'bg-cyan-500/10', text:'text-cyan-600', border:'border-cyan-500/20', dot:'bg-cyan-500', fill:'bg-gradient-to-r from-cyan-400 to-cyan-500', label:'Contacted'};
 case'TRIAL_LESSON': return { bg:'bg-amber-500/10', text:'text-amber-600', border:'border-amber-500/20', dot:'bg-amber-500', fill:'bg-gradient-to-r from-amber-400 to-amber-500', label:'Trial Lesson'};
 case'WON': return { bg:'bg-emerald-500/10', text:'text-emerald-600', border:'border-emerald-500/20', dot:'bg-emerald-500', fill:'bg-gradient-to-r from-emerald-400 to-emerald-500', label:'Won'};
 case'LOST': return { bg:'bg-rose-500/10', text:'text-rose-600', border:'border-rose-500/20', dot:'bg-rose-500', fill:'bg-gradient-to-r from-rose-400 to-rose-500', label:'Lost'};
 default: return { bg:'bg-[var(--state-hover)]', text:'text-[var(--text-secondary)]', border:'border-[var(--border-subtle)]/50', dot:'bg-gray-400', fill:'bg-gray-400', label: stage};
}
}

// Premium Apple-style configuration for lead status
function getStatusConfig(status: string) {
 switch (status) {
 case'FRESH': return { bg:'bg-emerald-500/10', text:'text-emerald-600', border:'border-emerald-500/20', dot:'bg-emerald-500', label:'Fresh'};
 case'WARMING': return { bg:'bg-amber-500/10', text:'text-amber-600', border:'border-amber-500/20', dot:'bg-amber-500', label:'Warming'};
 case'STALE': return { bg:'bg-rose-500/10', text:'text-rose-600', border:'border-rose-500/20', dot:'bg-rose-500', label:'Stale'};
 case'STUCK': return { bg:'bg-purple-500/10', text:'text-purple-600', border:'border-purple-500/20', dot:'bg-purple-500 animate-pulse', label:'Stuck'};
 default: return { bg:'bg-[var(--state-hover)]', text:'text-[var(--text-secondary)]', border:'border-[var(--border-subtle)]/50', dot:'bg-gray-400', label: status};
}
}

// Custom iOS-style Segmented Control for Tabs
// Premium Local Stat Card
function CRMStatCard({ label, value, highlightColor, icon}: { label: string; value: string | number; highlightColor: string; icon?: React.ReactNode}) {
 return (
 <div className="relative overflow-hidden rounded-[2rem] p-5 sm:p-6 group transition-all duration-300 hover:-translate-y-1 glass-card flex flex-col justify-between h-full">
 <div className="absolute inset-0 rounded-[2rem] pointer-events-none ring-1 ring-inset ring-black/5 dark:ring-white/5"aria-hidden />
 <div className={`absolute -top-10 -right-10 w-24 h-24 rounded-full blur-[30px] opacity-10 transition-opacity group-hover:opacity-20 ${highlightColor}`} aria-hidden />
 
 <div className="relative z-10 flex items-start justify-between mb-3">
 <p className="text-[0.75rem] font-bold text-[var(--text-muted)] uppercase tracking-widest leading-snug w-2/3">
 {label}
 </p>
 {icon && (
 <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-[var(--state-hover)] text-[var(--text-muted)]`}>
 {icon}
 </div>
 )}
 </div>
 
 <p className="text-[2rem] font-black tracking-tight leading-none text-[var(--text-primary)] relative z-10 mt-auto">
 {value}
 </p>
 </div>
 );
}

/* ── TABS ─────────────────────────────────────────────────────────────────── */

function FunnelTab({ data }: { data: CRMFunnelResponse }) {
 const { t} = useI18n();
 usePageTitle(t('crm.title'));
 const maxCount = Math.max(...data.funnel.map((s) => s.count), 1);
 const activeLeads = data.total - (data.funnel.find((s) => s.stage ==='WON')?.count || 0) - (data.funnel.find((s) => s.stage ==='LOST')?.count || 0);

 return (
 <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
 <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
 <CRMStatCard label={t('crm.totalLeads') ||'Total Leads'} value={data.total} highlightColor="bg-blue-500"/>
 <CRMStatCard label={t('crm.activeLeads') ||'Active Leads'} value={activeLeads} highlightColor="bg-brand-500"/>
 <CRMStatCard label={t('crm.wonLeads') ||'Won Leads'} value={data.funnel.find((s) => s.stage ==='WON')?.count || 0} highlightColor="bg-emerald-500"/>
 <CRMStatCard label={t('crm.overallConversion') ||'Conversion Rate'} value={`${data.overallConversion}%`} highlightColor="bg-purple-500"/>
 </div>

 <div className="rounded-[2.5rem] glass-card p-6 sm:p-10 relative overflow-hidden">
 <div className="absolute inset-0 rounded-[2.5rem] pointer-events-none ring-1 ring-inset ring-black/5 dark:ring-white/5"aria-hidden />

 <h3 className="text-[1.1rem] font-bold text-[var(--text-primary)] mb-8 flex items-center gap-2 relative z-10">
 <div className="w-8 h-8 rounded-full bg-brand-500/10 text-brand-600 flex items-center justify-center shrink-0">
 <svg className="w-4 h-4"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2.5"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
 </div>
 Pipeline Conversion Funnel
 </h3>

 <div className="relative z-10 space-y-5">
 {data.funnel.map((stage, idx: number) => {
 const width = maxCount > 0 ? Math.max((stage.count / maxCount) * 100, 2) : 2; // Min width 2%
 const config = getStageConfig(stage.stage);

 return (
 <div key={stage.stage} className="group relative"style={{ animationDelay: `${idx * 50}ms`}}>
 <div className="flex items-center justify-between text-[0.85rem] font-bold mb-2 px-1">
 <span className="text-[var(--text-secondary)]">{config.label}</span>
 <span className="text-[var(--text-muted)] font-mono">
 {stage.count} <span className="opacity-50">({stage.conversionFromTop}%)</span>
 </span>
 </div>
 <div className="h-10 rounded-[12px] bg-[var(--state-hover)] overflow-hidden border border-[var(--border-subtle)]/50 shadow-inner">
 <div
 className={`h-full rounded-[12px] ${config.fill} transition-all duration-1000 ease-out flex items-center justify-end px-4`}
 style={{ width: `${width}%`}}
 >
 {stage.count > 0 && width > 10 && (
 <span className="text-[0.75rem] font-black text-white drop-shadow-md">
 {stage.count}
 </span>
 )}
 </div>
 </div>
 </div>
 );
})}
 </div>
 </div>
 </div>
 );
}

function SourcesTab({ data }: { data: CRMSources[] }) {
 const { t} = useI18n();

 if (data.length === 0) {
 return (
 <div className="p-16 flex items-center justify-center rounded-[2.5rem] glass-card animate-in fade-in duration-500">
 <GlassEmptyState title={t('crm.noSources') ||'No Sources'} message={t('crm.noSourcesHint') ||'Lead sources will appear here.'} />
 </div>
 );
}

 return (
 <div className="rounded-[2.5rem] glass-card overflow-hidden relative animate-in fade-in slide-in-from-bottom-4 duration-500">
 <div className="absolute inset-0 rounded-[2.5rem] pointer-events-none ring-1 ring-inset ring-black/5 dark:ring-white/5"aria-hidden />
 
 <div className="relative z-10 w-full overflow-x-auto custom-scrollbar">
 <GlassTable>
 <GlassTHead>
 <GlassTR>
 <GlassTH>{t('crm.col.source') ||'Source'}</GlassTH>
 <GlassTH className="text-center">{t('crm.col.totalLeads') ||'Total Leads'}</GlassTH>
 <GlassTH className="text-center">{t('crm.col.won') ||'Won'}</GlassTH>
 <GlassTH className="text-center">{t('crm.col.lost') ||'Lost'}</GlassTH>
 <GlassTH className="text-center">{t('crm.col.conversionRate') ||'Conversion'}</GlassTH>
 <GlassTH className="text-right">{t('crm.col.avgDaysToConvert') ||'Avg Days'}</GlassTH>
 </GlassTR>
 </GlassTHead>
 <GlassTBody>
 {data.map((src, idx: number) => (
 <GlassTR key={src.source} className="hover:bg-transparent dark:hover:bg-[var(--bg-card)] transition-colors"style={{ animationDelay: `${idx * 40}ms`}}>
 <GlassTD>
 <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[0.7rem] font-bold uppercase tracking-wider bg-[var(--state-hover)] text-[var(--text-secondary)] border border-black/5 ">
 {src.source}
 </span>
 </GlassTD>
 <GlassTD className="text-center font-bold text-[var(--text-primary)] font-mono">{src.totalLeads}</GlassTD>
 <GlassTD className="text-center">
 <span className="px-2.5 py-1 rounded-[6px] bg-emerald-500/10 text-emerald-600 font-bold font-mono text-[0.8rem] border border-emerald-500/20">
 {src.wonLeads}
 </span>
 </GlassTD>
 <GlassTD className="text-center">
 <span className="px-2.5 py-1 rounded-[6px] bg-rose-500/10 text-rose-600 font-bold font-mono text-[0.8rem] border border-rose-500/20">
 {src.lostLeads}
 </span>
 </GlassTD>
 <GlassTD className="text-center">
 <span className={`text-[0.95rem] font-black tracking-tight ${src.conversionRate >= 50 ?'text-emerald-600' : src.conversionRate >= 20 ?'text-amber-600' :'text-rose-600'}`}>
 {src.conversionRate}%
 </span>
 </GlassTD>
 <GlassTD className="text-right text-[0.85rem] font-medium text-[var(--text-secondary)] ">
 {src.avgDaysToConvert} <span className="text-[0.7rem] uppercase tracking-wider">d</span>
 </GlassTD>
 </GlassTR>
 ))}
 </GlassTBody>
 </GlassTable>
 </div>
 </div>
 );
}

function VelocityTab({ data }: { data: CRMVelocityResponse }) {
 const { t} = useI18n();

 return (
 <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
 <CRMStatCard label={t('crm.avgDaysInPipeline') ||'Avg Days in Pipeline'} value={data.avgDaysInPipeline} highlightColor="bg-cyan-500"/>
 <CRMStatCard label={t('crm.avgTimeToWin') ||'Avg Time to Win'} value={data.avgTimeToWin} highlightColor="bg-emerald-500"/>
 <CRMStatCard label={t('crm.activeLeads') ||'Total Active Leads'} value={data.totalActiveLeads} highlightColor="bg-brand-500"/>
 </div>

 <div className="rounded-[2.5rem] glass-card overflow-hidden relative">
 <div className="absolute inset-0 rounded-[2.5rem] pointer-events-none ring-1 ring-inset ring-black/5 dark:ring-white/5"aria-hidden />
 
 <div className="relative z-10 w-full overflow-x-auto custom-scrollbar">
 <GlassTable>
 <GlassTHead>
 <GlassTR>
 <GlassTH>{t('crm.col.stage') ||'Pipeline Stage'}</GlassTH>
 <GlassTH className="text-center">{t('crm.col.leadCount') ||'Current Leads'}</GlassTH>
 <GlassTH className="text-center">{t('crm.col.avgDays') ||'Average Dwell'}</GlassTH>
 <GlassTH className="text-right">{t('crm.col.medianDays') ||'Median Dwell'}</GlassTH>
 </GlassTR>
 </GlassTHead>
 <GlassTBody>
 {data.stageVelocity.map((sv, idx: number) => {
 const config = getStageConfig(sv.stage);
 return (
 <GlassTR key={sv.stage} className="hover:bg-transparent dark:hover:bg-[var(--bg-card)] transition-colors"style={{ animationDelay: `${idx * 40}ms`}}>
 <GlassTD>
 <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[0.65rem] font-black uppercase tracking-wider border ${config.bg} ${config.text} ${config.border}`}>
 <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${config.dot}`} />
 {config.label}
 </span>
 </GlassTD>
 <GlassTD className="text-center font-bold text-[var(--text-primary)] font-mono">{sv.avgDays}</GlassTD>
 <GlassTD className="text-center">
 <span className="text-[0.85rem] font-bold text-brand-600 bg-brand-500/10 px-2 py-0.5 rounded-md border border-brand-500/20">
 {sv.avgDays} <span className="text-[0.65rem] uppercase">d</span>
 </span>
 </GlassTD>
 <GlassTD className="text-right text-[0.85rem] font-medium text-[var(--text-secondary)] ">
 {sv.avgDays} <span className="text-[0.65rem] uppercase">d</span>
 </GlassTD>
 </GlassTR>
 );
})}
 </GlassTBody>
 </GlassTable>
 </div>
 </div>
 </div>
 );
}

function LostReasonsTab({ data }: { data: CRMLostReasonsResponse }) {
 const { t} = useI18n();
 const maxCount = Math.max(...data.reasons.map((r) => r.count), 1);

 if (data.totalLost === 0) {
 return (
 <div className="p-16 flex items-center justify-center rounded-[2.5rem] glass-card animate-in fade-in duration-500">
 <GlassEmptyState title={t('crm.noLostLeads') ||'No Lost Leads'} message={t('crm.noLostLeadsHint') ||'No data to display yet.'} />
 </div>
 );
}

 return (
 <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
 <CRMStatCard label={t('crm.totalLostLeads') ||'Total Lost Leads'} value={data.totalLost} highlightColor="bg-rose-500"/>

 <div className="rounded-[2.5rem] glass-card p-6 sm:p-10 relative overflow-hidden">
 <div className="absolute inset-0 rounded-[2.5rem] pointer-events-none ring-1 ring-inset ring-black/5 dark:ring-white/5"aria-hidden />
 
 <h3 className="text-[1.1rem] font-bold text-[var(--text-primary)] mb-8 flex items-center gap-2 relative z-10">
 <div className="w-8 h-8 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
 <svg className="w-4 h-4"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2.5"><line x1="18"y1="6"x2="6"y2="18"/><line x1="6"y1="6"x2="18"y2="18"/></svg>
 </div>
 Primary Loss Reasons
 </h3>

 <div className="relative z-10 space-y-5">
 {data.reasons.map((reason, idx: number) => {
 const width = maxCount > 0 ? Math.max((reason.count / maxCount) * 100, 2) : 2;
 return (
 <div key={reason.reason} className="group relative"style={{ animationDelay: `${idx * 50}ms`}}>
 <div className="flex items-center justify-between text-[0.85rem] font-bold mb-2 px-1">
 <span className="text-[var(--text-secondary)]">{reason.reason ||'Unspecified'}</span>
 <span className="text-[var(--text-muted)] font-mono">{reason.count}</span>
 </div>
 <div className="h-6 rounded-[8px] bg-[var(--state-hover)] overflow-hidden border border-[var(--border-subtle)]/50 shadow-inner">
 <div
 className="h-full rounded-[8px] bg-gradient-to-r from-rose-400 to-rose-500 transition-all duration-1000 ease-out"
 style={{ width: `${width}%`}}
 />
 </div>
 </div>
 );
})}
 </div>
 </div>
 </div>
 );
}

function AgingTab({ data }: { data: CRMAgingResponse }) {
 const { t} = useI18n();

 if (data.total === 0) {
 return (
 <div className="p-16 flex items-center justify-center rounded-[2.5rem] glass-card animate-in fade-in duration-500">
 <GlassEmptyState title={t('crm.noActiveLeads') ||'No Active Leads'} message={t('crm.noActiveLeadsHint') ||'No aging data to display.'} />
 </div>
 );
}

 return (
 <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-5">
 {Object.entries(data.statusCounts).map(([status, count]) => {
 const config = getStatusConfig(status);
 return (
 <CRMStatCard
 key={status}
 label={config.label}
 value={count as number}
 highlightColor={status ==='STUCK' ?'bg-purple-500' : status ==='STALE' ?'bg-rose-500' : status ==='WARMING' ?'bg-amber-500' :'bg-emerald-500'}
 />
 );
})}
 </div>

 <div className="rounded-[2.5rem] glass-card overflow-hidden relative">
 <div className="absolute inset-0 rounded-[2.5rem] pointer-events-none ring-1 ring-inset ring-black/5 dark:ring-white/5"aria-hidden />
 
 <div className="relative z-10 w-full overflow-x-auto custom-scrollbar">
 <GlassTable>
 <GlassTHead>
 <GlassTR>
 <GlassTH>{t('crm.col.name') ||'Lead Name'}</GlassTH>
 <GlassTH>{t('crm.col.stage') ||'Stage'}</GlassTH>
 <GlassTH>{t('crm.col.source') ||'Source'}</GlassTH>
 <GlassTH className="text-center">{t('crm.col.daysInPipeline') ||'Days in Pipeline'}</GlassTH>
 <GlassTH className="text-center">{t('crm.col.daysSinceUpdate') ||'Stagnation'}</GlassTH>
 <GlassTH className="text-right">{t('crm.col.status') ||'Health'}</GlassTH>
 </GlassTR>
 </GlassTHead>
 <GlassTBody>
 {data.leads.map((lead: CRMAgingLead, idx: number) => {
 const stageConfig = getStageConfig(lead.stage);
 const statusConfig = getStatusConfig(lead.status);

 return (
 <GlassTR key={lead.id} className="hover:bg-transparent dark:hover:bg-[var(--bg-card)] transition-colors"style={{ animationDelay: `${idx * 40}ms`}}>
 <GlassTD className="font-bold text-[var(--text-primary)] max-w-[12rem] truncate">
 {lead.name}
 </GlassTD>
 <GlassTD>
 <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[0.65rem] font-black uppercase tracking-wider border ${stageConfig.bg} ${stageConfig.text} ${stageConfig.border}`}>
 <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${stageConfig.dot}`} />
 {stageConfig.label}
 </span>
 </GlassTD>
 <GlassTD>
 <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[0.65rem] font-bold uppercase tracking-wider bg-[var(--state-hover)] text-[var(--text-muted)] border border-black/5 ">
 {lead.source ||'—'}
 </span>
 </GlassTD>
 <GlassTD className="text-center font-mono font-medium text-[var(--text-secondary)]">
 {lead.daysInPipeline} <span className="text-[0.65rem] uppercase">d</span>
 </GlassTD>
 <GlassTD className="text-center font-mono font-bold">
 <span className={`${lead.daysSinceUpdate > 7 ?'text-rose-500' :'text-[var(--text-primary)]'}`}>
 {lead.daysSinceUpdate} <span className="text-[0.65rem] uppercase">d</span>
 </span>
 </GlassTD>
 <GlassTD className="text-right">
 <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[0.65rem] font-black uppercase tracking-wider border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}>
 {statusConfig.label}
 </span>
 </GlassTD>
 </GlassTR>
 );
})}
 </GlassTBody>
 </GlassTable>
 </div>
 </div>
 </div>
 );
}

function ModeratorsTab({ data }: { data: CRMModeratorStats[] }) {
 const { t} = useI18n();

 if (data.length === 0) {
 return (
 <div className="p-16 flex items-center justify-center rounded-[2.5rem] glass-card animate-in fade-in duration-500">
 <GlassEmptyState title={t('crm.noModerators') ||'No Moderators'} message={t('crm.noModeratorsHint') ||'No team data to display.'} />
 </div>
 );
}

 return (
 <div className="rounded-[2.5rem] glass-card overflow-hidden relative animate-in fade-in slide-in-from-bottom-4 duration-500">
 <div className="absolute inset-0 rounded-[2.5rem] pointer-events-none ring-1 ring-inset ring-black/5 dark:ring-white/5"aria-hidden />
 
 <div className="relative z-10 w-full overflow-x-auto custom-scrollbar">
 <GlassTable>
 <GlassTHead>
 <GlassTR>
 <GlassTH>{t('crm.col.moderator') ||'Team Member'}</GlassTH>
 <GlassTH className="text-center">{t('crm.col.totalLeads') ||'Total Assigned'}</GlassTH>
 <GlassTH className="text-center">{t('crm.col.active') ||'Active'}</GlassTH>
 <GlassTH className="text-center">{t('crm.col.won') ||'Won'}</GlassTH>
 <GlassTH className="text-center">{t('crm.col.lost') ||'Lost'}</GlassTH>
 <GlassTH className="text-right">{t('crm.col.conversionRate') ||'Conversion'}</GlassTH>
 </GlassTR>
 </GlassTHead>
 <GlassTBody>
 {data.map((mod, idx: number) => (
 <GlassTR key={mod.moderatorId} className="hover:bg-transparent dark:hover:bg-[var(--bg-card)] transition-colors"style={{ animationDelay: `${idx * 40}ms`}}>
 <GlassTD>
 <div className="flex items-center gap-3">
 <div className="w-9 h-9 rounded-full flex items-center justify-center text-[0.65rem] font-extrabold bg-gradient-to-br from-indigo-400 to-purple-600 text-white shadow-sm shrink-0">
 {mod.name.split('').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
 </div>
 <div className="flex flex-col">
 <span className="font-bold text-[0.95rem] text-[var(--text-primary)] truncate">{mod.name}</span>
 {mod.email && <span className="text-[0.75rem] font-medium text-[var(--text-muted)] truncate mt-0.5">{mod.email}</span>}
 </div>
 </div>
 </GlassTD>
 <GlassTD className="text-center font-bold text-[var(--text-primary)] font-mono">{mod.totalLeads}</GlassTD>
 <GlassTD className="text-center font-medium text-[var(--text-secondary)] font-mono">{mod.activeLeads}</GlassTD>
 <GlassTD className="text-center">
 <span className="px-2.5 py-1 rounded-[6px] bg-emerald-500/10 text-emerald-600 font-bold font-mono text-[0.8rem] border border-emerald-500/20">
 {mod.wonLeads}
 </span>
 </GlassTD>
 <GlassTD className="text-center">
 <span className="px-2.5 py-1 rounded-[6px] bg-rose-500/10 text-rose-600 font-bold font-mono text-[0.8rem] border border-rose-500/20">
 {mod.lostLeads}
 </span>
 </GlassTD>
 <GlassTD className="text-right">
 <span className={`text-[1.05rem] font-black tracking-tight ${mod.conversionRate >= 50 ?'text-emerald-600' : mod.conversionRate >= 20 ?'text-amber-600' :'text-rose-600'}`}>
 {mod.conversionRate}%
 </span>
 </GlassTD>
 </GlassTR>
 ))}
 </GlassTBody>
 </GlassTable>
 </div>
 </div>
 );
}

export function CRMAnalyticsPage() {
 const { t} = useI18n();
 const [activeTab, setActiveTab] = useState('funnel');

 const funnelQuery = useQuery({ queryKey: ['crm-funnel'], queryFn: () => analyticsApi.crmFunnel(), enabled: activeTab ==='funnel'});
 const sourcesQuery = useQuery({ queryKey: ['crm-sources'], queryFn: () => analyticsApi.crmSources(), enabled: activeTab ==='sources'});
 const velocityQuery = useQuery({ queryKey: ['crm-velocity'], queryFn: () => analyticsApi.crmVelocity(), enabled: activeTab ==='velocity'});
 const lostReasonsQuery = useQuery({ queryKey: ['crm-lost-reasons'], queryFn: () => analyticsApi.crmLostReasons(), enabled: activeTab ==='lost-reasons'});
 const agingQuery = useQuery({ queryKey: ['crm-aging'], queryFn: () => analyticsApi.crmAging(), enabled: activeTab ==='aging'});
 const moderatorsQuery = useQuery({ queryKey: ['crm-moderators'], queryFn: () => analyticsApi.crmModerators(), enabled: activeTab ==='moderators'});

 const tabs = TABS.map((tab) => ({ id: tab.id, label: t(tab.labelKey) || tab.id}));

 const getActiveQuery = () => {
 switch (activeTab) {
 case'funnel': return funnelQuery;
 case'sources': return sourcesQuery;
 case'velocity': return velocityQuery;
 case'lost-reasons': return lostReasonsQuery;
 case'aging': return agingQuery;
 case'moderators': return moderatorsQuery;
 default: return funnelQuery;
}
};

 const activeQuery = getActiveQuery();

 const renderContent = () => {
 if (activeQuery.isLoading) return (
 <div className="h-64 flex items-center justify-center rounded-[2.5rem] glass-card">
 <GlassPageLoader label={t('common.loading') ||'Loading…'} />
 </div>
 );
 if (activeQuery.isError) {
 return (
 <div className="p-12 rounded-[2.5rem] glass-card">
 <GlassErrorState message={getErrorMessage(activeQuery.error)} onRetry={() => activeQuery.refetch()} />
 </div>
 );
}

const data = activeQuery.data;
 if (!data || (typeof data ==='object' &&'total' in data && (data as { total?: number }).total === 0 && activeTab !=='funnel' && activeTab !=='velocity')) {
 return (
 <div className="p-16 rounded-[2.5rem] glass-card flex items-center justify-center">
 <GlassEmptyState title={t('crm.emptyTitle') ||'No Data'} message={t('crm.emptyHint') ||'No analytics data available for this view.'} />
 </div>
 );
}

 switch (activeTab) {
 case'funnel': return <FunnelTab data={data as CRMFunnelResponse} />;
 case'sources': return <SourcesTab data={data as CRMSources[]} />;
 case'velocity': return <VelocityTab data={data as CRMVelocityResponse} />;
 case'lost-reasons': return <LostReasonsTab data={data as CRMLostReasonsResponse} />;
 case'aging': return <AgingTab data={data as CRMAgingResponse} />;
 case'moderators': return <ModeratorsTab data={data as CRMModeratorStats[]} />;
 default: return null;
 }
};

 return (
 <div className="relative min-h-screen bg-transparent selection:bg-brand-500/30">
 
 {/* Soft Apple-style Background Ambient Orbs */}
 <div className="fixed inset-0 pointer-events-none overflow-hidden"aria-hidden="true">
 <div className="absolute top-[0%] left-[-10%] w-[40%] h-[40%] rounded-full bg-brand-400/5 blur-[120px]"/>
 <div className="absolute bottom-[20%] right-[-5%] w-[30%] h-[50%] rounded-full bg-cyan-400/5 blur-[130px]"/>
 </div>

 <div className="relative z-10 w-full max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6 animate-in fade-in duration-500">
 <GlassPageHeader
 title={t('crm.title') ||'CRM Analytics'}
 subtitle={t('crm.subtitle') ||'Analyze lead conversion, pipeline velocity, and team performance.'}
 />

 <div className="overflow-x-auto pb-2">
 <GlassTabs active={activeTab} onChange={(id: string) => setActiveTab(id)} tabs={tabs} />
 </div>

 <div className="pt-2">
 {renderContent()}
 </div>
 </div>
 </div>
 );
}

export default CRMAnalyticsPage;