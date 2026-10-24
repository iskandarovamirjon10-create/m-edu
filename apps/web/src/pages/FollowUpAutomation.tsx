/**
 * M-EDU FollowUpAutomationPage — Apple Design Award V2 Edition
 *
 * Ultra Premium Apple-Style Automation Dashboard:
 *  - Apple SF Pro visual hierarchy with ambient lighting
 *  - Spring physics with Framer Motion (smooth staggered rows, tactile switches)
 *  - Responsive KPI stat cards (Today, Overdue, Upcoming, Completion Rate)
 *  - Squircle liquid glass tabs (Rules, Queue, Statistics)
 *  - Preserves 100% of real API contracts, TanStack Query, and i18n
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, type Variants } from 'framer-motion';
import { leadsApi } from '@/lib/api';
import {
  GlassPageHeader,
  GlassPageLoader,
  GlassErrorState,
  GlassEmptyState,
  GlassInput,
  GlassSelect,
  useToasts,
  GlassModal,
  GlassField,
  GlassButton,
  GlassSwitch,
  ConfirmDialog,
  GlassTabs,
} from '@/components/ui';
import { AuroraMesh } from '@/components/ui/AuroraMesh';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { openSidecar } from '@/stores/ui.store';
import { usePremiumSound } from '@/hooks/usePremiumSound';

const TRIGGER_TYPES = ['NO_ACTIVITY', 'STAGE_STALE'];
const ACTION_TYPES = ['CREATE_FOLLOW_UP', 'SEND_NOTIFICATION', 'BOTH'];
const STAGE_OPTIONS = ['NEW', 'CONTACTED', 'TRIAL_LESSON', 'WON', 'LOST'];
const CHANNEL_OPTIONS = ['IN_APP', 'SMS', 'TELEGRAM'];

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

interface RuleFormState {
  name: string;
  triggerType: string;
  triggerDays: number;
  targetStage: string;
  actionType: string;
  channel: string;
  message: string;
}

interface FollowUpRule {
  id: string;
  name: string;
  triggerType: string;
  triggerDays: number;
  targetStage?: string | null;
  actionType: string;
  channel?: string | null;
  message?: string | null;
  isActive: boolean;
}

interface FollowUpItem {
  id: string;
  isCompleted?: boolean;
  scheduledAt: string;
  note?: string | null;
  lead?: { firstName?: string; lastName?: string } | null;
}

interface FollowUpsResponse {
  items?: FollowUpItem[];
}

interface FollowUpStats {
  today: number;
  overdue: number;
  upcoming: number;
  completionRate: number;
}

const INITIAL_FORM: RuleFormState = {
  name: '',
  triggerType: 'NO_ACTIVITY',
  triggerDays: 7,
  targetStage: '',
  actionType: 'CREATE_FOLLOW_UP',
  channel: 'IN_APP',
  message: '',
};

function formatType(type: string) {
  return type
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function AutomationStatCard({
  label,
  value,
  highlightColor,
  icon,
}: {
  label: string;
  value: string | number;
  highlightColor: string;
  icon?: React.ReactNode;
}) {
  return (
    <motion.div
      variants={itemVariants}
      whileHover={{ y: -3, transition: SPRING.snappy }}
      className="liquid-glass-card liquid-glass-surface relative overflow-hidden rounded-3xl p-5 sm:p-6 group transition-all duration-300 flex flex-col justify-between h-full border border-slate-200/80 dark:border-slate-800/80 shadow-sm"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20 z-10" />
      <div className={`absolute -top-10 -right-10 w-24 h-24 rounded-full blur-[30px] opacity-10 transition-opacity group-hover:opacity-20 ${highlightColor}`} aria-hidden />

      <div className="flex items-center justify-between mb-3">
        <p className="text-[0.7rem] font-bold text-[var(--text-muted)] uppercase tracking-wider truncate">
          {label}
        </p>
        {icon && <div className="text-[var(--text-muted)] shrink-0">{icon}</div>}
      </div>
      <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-primary)] tabular-nums">
        {value}
      </p>
    </motion.div>
  );
}

export function FollowUpAutomationPage() {
  const { t } = useSafeI18n();
  usePageTitle(t('followUp.title'));
  const { push: toast, toastNode } = useToasts();
  const queryClient = useQueryClient();
  const { playTick, playPop, playSuccess, playError } = usePremiumSound();

  const enumT = (ns: string, v: string) => {
    const key = `${ns}.${v}`;
    const label = t(key);
    return label === key ? formatType(v) : label;
  };

  const [activeTab, setActiveTab] = useState('rules');
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<FollowUpRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FollowUpRule | null>(null);
  const [form, setForm] = useState<RuleFormState>(INITIAL_FORM);

  const { data: rules, isLoading: rulesLoading, error: rulesError } = useQuery({
    queryKey: ['follow-up-rules'],
    queryFn: () => leadsApi.getFollowUpRules() as Promise<FollowUpRule[]>,
  });

  const { data: followUps, isLoading: followUpsLoading, error: followUpsError } = useQuery({
    queryKey: ['follow-ups'],
    queryFn: () => leadsApi.getFollowUps({}) as Promise<FollowUpsResponse>,
  });

  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ['follow-up-stats'],
    queryFn: () => leadsApi.getFollowUpStats() as Promise<FollowUpStats>,
  });

  const handleOpenRuleSidecar = (rule: FollowUpRule) => {
    playPop();
    openSidecar({
      title: rule.name,
      subtitle: `${enumT('followUp.trigger', rule.triggerType)} • ${rule.triggerDays} kun`,
      badge: rule.isActive ? 'Faol' : 'Nofaol',
      status: {
        label: rule.isActive ? 'Avtomatlashtirilgan' : 'To\'xtatilgan',
        tone: rule.isActive ? 'emerald' : 'slate',
      },
      metrics: [
        { label: 'Kutish muddati', value: `${rule.triggerDays} kun` },
        { label: 'Trigyer turi', value: enumT('followUp.trigger', rule.triggerType) },
        { label: 'Harakat', value: enumT('followUp.action', rule.actionType) },
        { label: 'Kanal', value: rule.channel ? enumT('followUp.channel', rule.channel) : 'Ichki bildirishnoma' },
      ],
      details: [
        { label: 'Qoida ID', value: rule.id },
        { label: 'Qoida nomi', value: rule.name },
        { label: 'Maqsadli bosqich', value: rule.targetStage ? enumT('followUp.stage', rule.targetStage) : 'Barcha bosqichlar' },
        { label: 'Yetkazish kanali', value: rule.channel || 'IN_APP' },
        { label: 'Xabar shabloni', value: rule.message || 'Standart eslatma matni' },
      ],
      actions: [
        {
          label: 'Tahrirlash',
          variant: 'primary',
          onClick: () => handleOpenEdit(rule),
        },
        {
          label: rule.isActive ? 'To\'xtatish' : 'Faollashtirish',
          variant: 'secondary',
          onClick: () => toggleMutation.mutate({ id: rule.id, isActive: !rule.isActive }),
        },
      ],
    });
  };

  const handleOpenFollowUpSidecar = (fu: FollowUpItem) => {
    playPop();
    const leadName = `${fu.lead?.firstName || ''} ${fu.lead?.lastName || ''}`.trim() || 'Lid';
    openSidecar({
      title: leadName,
      subtitle: `Rejalashtirilgan: ${new Date(fu.scheduledAt).toLocaleDateString()}`,
      badge: {
        text: fu.isCompleted ? 'Bajarilgan' : 'Kutilmoqda',
        tone: fu.isCompleted ? 'emerald' : 'amber',
      },
      status: {
        label: fu.isCompleted ? 'Yopilgan' : 'Faol Navbatda',
        tone: fu.isCompleted ? 'emerald' : 'amber',
      },
      metrics: [
        { label: 'Holat', value: fu.isCompleted ? 'Bajarilgan' : 'Navbatda' },
        { label: 'Sana', value: new Date(fu.scheduledAt).toLocaleDateString() },
      ],
      details: [
        { label: 'Vazifa ID', value: fu.id },
        { label: 'Mijoz', value: leadName },
        { label: 'Reja vaqti', value: new Date(fu.scheduledAt).toLocaleString() },
        { label: 'Izoh / Eslatma', value: fu.note || 'Maxsus izoh ko\'rsatilmagan' },
      ],
      actions: !fu.isCompleted ? [
        {
          label: 'Bajarildi deb belgilash',
          variant: 'primary',
          onClick: () => completeMutation.mutate(fu.id),
        },
      ] : undefined,
    });
  };



  const createMutation = useMutation({
    mutationFn: (data: RuleFormState) => leadsApi.createFollowUpRule(data),
    onSuccess: () => {
      playSuccess();
      queryClient.invalidateQueries({ queryKey: ['follow-up-rules'] });
      toast('success', t('automation.rule.created'));
      setShowModal(false);
      setForm(INITIAL_FORM);
    },
    onError: () => {
      playError();
      toast('error', t('followUp.createFailed'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<RuleFormState> }) =>
      leadsApi.updateFollowUpRule(id, data),
    onSuccess: () => {
      playSuccess();
      queryClient.invalidateQueries({ queryKey: ['follow-up-rules'] });
      toast('success', t('automation.rule.updated'));
      setShowModal(false);
      setEditingRule(null);
      setForm(INITIAL_FORM);
    },
    onError: () => {
      playError();
      toast('error', t('followUp.updateFailed'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => leadsApi.deleteFollowUpRule(id),
    onSuccess: () => {
      playSuccess();
      queryClient.invalidateQueries({ queryKey: ['follow-up-rules'] });
      toast('success', t('automation.rule.deleted'));
    },
    onError: () => {
      playError();
      toast('error', t('followUp.deleteFailed'));
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      leadsApi.updateFollowUpRule(id, { isActive }),
    onSuccess: () => {
      playTick();
      queryClient.invalidateQueries({ queryKey: ['follow-up-rules'] });
    },
    onError: () => {
      playError();
      toast('error', t('followUp.toggleFailed'));
    },
  });

  const evaluateMutation = useMutation({
    mutationFn: () =>
      leadsApi.evaluateFollowUpRules() as Promise<{ evaluated: number; created: number }>,
    onSuccess: (data) => {
      playSuccess();
      queryClient.invalidateQueries({ queryKey: ['follow-up-rules'] });
      queryClient.invalidateQueries({ queryKey: ['follow-ups'] });
      queryClient.invalidateQueries({ queryKey: ['follow-up-stats'] });
      toast('success', t('followUp.engineEvaluated', { evaluated: data.evaluated, created: data.created }));
    },
    onError: () => {
      playError();
      toast('error', t('followUp.evaluateFailed'));
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => leadsApi.completeFollowUp(id),
    onSuccess: () => {
      playSuccess();
      queryClient.invalidateQueries({ queryKey: ['follow-ups'] });
      queryClient.invalidateQueries({ queryKey: ['follow-up-stats'] });
      toast('success', t('followUp.completed'));
    },
    onError: () => {
      playError();
      toast('error', t('followUp.completeFailed'));
    },
  });

  const handleOpenCreate = () => {
    setEditingRule(null);
    setForm(INITIAL_FORM);
    setShowModal(true);
  };

  const handleOpenEdit = (rule: FollowUpRule) => {
    setEditingRule(rule);
    setForm({
      name: rule.name,
      triggerType: rule.triggerType,
      triggerDays: rule.triggerDays,
      targetStage: rule.targetStage || '',
      actionType: rule.actionType,
      channel: rule.channel || 'IN_APP',
      message: rule.message || '',
    });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (e.key === '1') {
        e.preventDefault();
        playTick();
        setActiveTab('rules');
      } else if (e.key === '2') {
        e.preventDefault();
        playTick();
        setActiveTab('queue');
      } else if (e.key === '3') {
        e.preventDefault();
        playTick();
        setActiveTab('stats');
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        playTick();
        handleOpenCreate();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        playTick();
        evaluateMutation.mutate();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playTick, evaluateMutation]);

  const todayFollowUps =
    followUps?.items?.filter((f) => {
      const now = new Date();
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
      return !f.isCompleted && new Date(f.scheduledAt) >= start && new Date(f.scheduledAt) <= end;
    }) || [];

  const overdueFollowUps =
    followUps?.items?.filter((f) => {
      const now = new Date();
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
      return !f.isCompleted && new Date(f.scheduledAt) < start;
    }) || [];

  const upcomingFollowUps =
    followUps?.items?.filter((f) => {
      const now = new Date();
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
      return !f.isCompleted && new Date(f.scheduledAt) > end;
    }) || [];

  const tabs = [
    { id: 'rules', label: t('followUp.tabs.rules') || 'Rules', count: rules?.length ?? 0 },
    { id: 'queue', label: t('followUp.tabs.queue') || 'Queue', count: todayFollowUps.length + overdueFollowUps.length },
    { id: 'stats', label: t('followUp.tabs.stats') || 'Statistics' },
  ];

  if (rulesLoading || followUpsLoading || statsLoading) {
    return (
      <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
        <GlassPageHeader title={t('followUp.title')} subtitle={t('followUp.loadingSubtitle')} />
        <div className="mt-8 rounded-2xl p-16 flex items-center justify-center glass-card">
          <GlassPageLoader label={t('followUp.loading')} />
        </div>
      </div>
    );
  }

  if (rulesError || followUpsError || statsError) {
    return (
      <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
        <GlassPageHeader title={t('followUp.title')} subtitle={t('followUp.connectionError')} />
        <div className="mt-8 rounded-2xl p-12 glass-card">
          <GlassErrorState
            message={t('followUp.loadError')}
            onRetry={() => queryClient.invalidateQueries({ queryKey: ['follow-up-rules'] })}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-transparent selection:bg-brand-500/30">
      {/* AuroraMesh substrate */}
      <AuroraMesh variant="corporate" />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 w-full max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6 pb-[max(6rem,env(safe-area-inset-bottom))]"
      >
        {toastNode}

        <ConfirmDialog
          open={deleteTarget !== null}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => {
            if (!deleteTarget) return;
            deleteMutation.mutate(deleteTarget.id);
            setDeleteTarget(null);
          }}
          description={t('followUp.deleteConfirm')}
          loading={deleteMutation.isPending}
        />

        {/* ── Header & Action ────────────────────────────────────────────── */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col md:flex-row md:items-end justify-between gap-4"
        >
          <GlassPageHeader
            title={t('followUp.title')}
            subtitle={t('followUp.subtitle')}
          />
          <GlassButton
            type="button"
            variant="secondary"
            className="w-full md:w-auto"
            onClick={() => evaluateMutation.mutate()}
            disabled={evaluateMutation.isPending}
            loading={evaluateMutation.isPending}
            icon={
              !evaluateMutation.isPending ? (
                <svg className="w-4 h-4 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              ) : undefined
            }
          >
            {evaluateMutation.isPending ? t('followUp.engineRunning') : t('followUp.runEngine')}
          </GlassButton>
        </motion.div>

        {/* ── Toolbar & Tabs ─────────────────────────────────────────────── */}
        <motion.div
          variants={itemVariants}
          className="liquid-glass-card liquid-glass-surface flex flex-col md:flex-row md:items-center justify-between gap-4 p-3 sm:p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800/80"
        >
          <GlassTabs
            active={activeTab}
            onChange={(tab) => {
              playTick();
              setActiveTab(tab);
            }}
            tabs={tabs}
          />

          {activeTab === 'rules' && (
            <GlassButton
              type="button"
              variant="primary"
              className="w-full sm:w-auto"
              onClick={() => {
                playTick();
                handleOpenCreate();
              }}
              icon={
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              }
            >
              {t('automation.newRule')}
            </GlassButton>
          )}
        </motion.div>

        {/* ── Content Area ───────────────────────────────────────────────── */}
        <motion.div
          variants={itemVariants}
          className="liquid-glass-card liquid-glass-surface rounded-3xl overflow-hidden relative min-h-[400px] border border-slate-200/80 dark:border-slate-800/80 shadow-sm"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20 z-10" />

          {/* TAB: RULES */}
          {activeTab === 'rules' && (
            <div className="relative z-10 w-full">
              {!rules || rules.length === 0 ? (
                <div className="p-16 flex items-center justify-center">
                  <GlassEmptyState
                    title={t('automation.rule.empty')}
                    message={t('followUp.emptyHint')}
                    action={{ label: t('automation.rule.create'), onClick: handleOpenCreate }}
                  />
                </div>
              ) : (
                <motion.ul
                  variants={containerVariants}
                  className="divide-y divide-black/5 dark:divide-white/5"
                >
                  {rules.map((rule) => (
                    <motion.li
                      key={rule.id}
                      variants={itemVariants}
                      whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.4)', transition: SPRING.snappy }}
                      onClick={() => handleOpenRuleSidecar(rule)}
                      className="group p-5 sm:p-6 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <h4 className="text-base font-bold text-[var(--text-primary)] mr-2">{rule.name}</h4>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[0.65rem] font-bold uppercase tracking-wider border bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20">
                            {enumT('followUp.trigger', rule.triggerType)}
                          </span>
                          {rule.targetStage && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[0.65rem] font-bold uppercase tracking-wider border bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20">
                              {t('followUp.targetLabel')} {enumT('followUp.stage', rule.targetStage)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-normal text-[var(--text-muted)]">
                          {t('followUp.triggerLabel')} <span className="font-bold text-[var(--text-primary)]">{rule.triggerDays} {t('common.days')}</span>
                          <span className="mx-2 opacity-50">•</span>
                          {t('followUp.actionLabel')} <span className="font-bold text-[var(--text-primary)]">{enumT('followUp.action', rule.actionType)}</span>
                          {rule.channel && (
                            <>
                              <span className="mx-2 opacity-50">•</span> {t('followUp.channelLabel')} <span className="font-bold text-[var(--text-primary)]">{enumT('followUp.channel', rule.channel)}</span>
                            </>
                          )}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <GlassSwitch
                          checked={rule.isActive}
                          onChange={() => toggleMutation.mutate({ id: rule.id, isActive: !rule.isActive })}
                          aria-label={t('followUp.toggleStatus')}
                        />

                        <div className="w-px h-6 bg-black/10 dark:bg-white/10 mx-1" />

                        <GlassButton
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => handleOpenRuleSidecar(rule)}
                          title="Tafsilotlar (Sidecar)"
                        >
                          ◨ Sidecar
                        </GlassButton>
                        <GlassButton type="button" variant="secondary" size="sm" onClick={() => handleOpenEdit(rule)}>
                          {t('common.edit')}
                        </GlassButton>
                        <GlassButton variant="danger" size="sm" onClick={() => setDeleteTarget(rule)}>
                          {t('common.delete')}
                        </GlassButton>
                      </div>
                    </motion.li>
                  ))}
                </motion.ul>
              )}
            </div>
          )}

          {/* TAB: QUEUE */}
          {activeTab === 'queue' && (
            <div className="relative z-10 w-full p-6 sm:p-8 space-y-8">
              <FollowUpSection
                title={t('followUp.section.overdue')}
                items={overdueFollowUps}
                onComplete={(id) => completeMutation.mutate(id)}
                onOpenSidecar={handleOpenFollowUpSidecar}
                isOverdue
              />
              <FollowUpSection
                title={t('followUp.section.today')}
                items={todayFollowUps}
                onComplete={(id) => completeMutation.mutate(id)}
                onOpenSidecar={handleOpenFollowUpSidecar}
                isToday
              />
              <FollowUpSection
                title={t('followUp.section.upcoming')}
                items={upcomingFollowUps}
                onComplete={(id) => completeMutation.mutate(id)}
                onOpenSidecar={handleOpenFollowUpSidecar}
              />

              {todayFollowUps.length === 0 && overdueFollowUps.length === 0 && upcomingFollowUps.length === 0 && (
                <div className="py-12 flex items-center justify-center">
                  <GlassEmptyState
                    title={t('followUp.inboxZero')}
                    message={t('followUp.inboxZeroHint')}
                  />
                </div>
              )}
            </div>
          )}

          {/* TAB: STATS */}
          {activeTab === 'stats' && (
            <div className="relative z-10 w-full p-6 sm:p-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <AutomationStatCard
                label={t('followUp.stat.today')}
                value={stats?.today ?? 0}
                highlightColor="bg-brand-500"
                icon={<svg className="w-4 h-4 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>}
              />
              <AutomationStatCard
                label={t('followUp.stat.overdue')}
                value={stats?.overdue ?? 0}
                highlightColor="bg-rose-500"
                icon={<svg className="w-4 h-4 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>}
              />
              <AutomationStatCard
                label={t('followUp.stat.upcoming')}
                value={stats?.upcoming ?? 0}
                highlightColor="bg-indigo-500"
                icon={<svg className="w-4 h-4 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>}
              />
              <AutomationStatCard
                label={t('followUp.stat.completionRate')}
                value={`${stats?.completionRate ?? 0}%`}
                highlightColor="bg-emerald-500"
                icon={<svg className="w-4 h-4 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>}
              />
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* ── Rule Modal ─────────────────────────────────────────────────── */}
      <GlassModal
        open={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingRule(null);
          setForm(INITIAL_FORM);
        }}
        title={editingRule ? t('followUp.configureRule') : t('followUp.newAutomationRule')}
        wide
      >
        <form onSubmit={handleSubmit} className="space-y-5 pt-2" noValidate>
          <GlassField label={t('automation.rule.name')} required>
            <GlassInput
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t('followUp.namePlaceholder')}
              autoFocus
            />
          </GlassField>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <GlassField label={t('followUp.triggerEvent')} required>
              <GlassSelect
                value={form.triggerType}
                onChange={(e) => setForm({ ...form, triggerType: e.target.value })}
              >
                {TRIGGER_TYPES.map((v) => (
                  <option key={v} value={v}>
                    {t(`followUp.trigger.${v}`)}
                  </option>
                ))}
              </GlassSelect>
            </GlassField>

            <GlassField label={t('followUp.timeThreshold')} required>
              <GlassInput
                type="number"
                min="1"
                value={form.triggerDays}
                onChange={(e) => setForm({ ...form, triggerDays: parseInt(e.target.value) || 1 })}
              />
            </GlassField>
          </div>

          {form.triggerType === 'STAGE_STALE' && (
            <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
              <GlassField label={t('followUp.targetStage')} required>
                <GlassSelect
                  value={form.targetStage}
                  onChange={(e) => setForm({ ...form, targetStage: e.target.value })}
                >
                  <option value="">{t('followUp.selectStage')}</option>
                  {STAGE_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {t(`followUp.stage.${s}`)}
                    </option>
                  ))}
                </GlassSelect>
              </GlassField>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-[var(--border-subtle)]">
            <GlassField label={t('followUp.executionAction')} required>
              <GlassSelect
                value={form.actionType}
                onChange={(e) => setForm({ ...form, actionType: e.target.value })}
              >
                {ACTION_TYPES.map((a) => (
                  <option key={a} value={a}>
                    {t(`followUp.action.${a}`)}
                  </option>
                ))}
              </GlassSelect>
            </GlassField>

            {form.actionType !== 'CREATE_FOLLOW_UP' && (
              <GlassField label={t('followUp.deliveryChannel')} required>
                <GlassSelect
                  value={form.channel}
                  onChange={(e) => setForm({ ...form, channel: e.target.value })}
                >
                  {CHANNEL_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {t(`followUp.channel.${c}`)}
                    </option>
                  ))}
                </GlassSelect>
              </GlassField>
            )}
          </div>

          <GlassField label={t('followUp.messageLabel')}>
            <GlassInput
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder={t('followUp.messagePlaceholder')}
            />
          </GlassField>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-[var(--border-subtle)]">
            <GlassButton
              type="button"
              variant="secondary"
              onClick={() => {
                setShowModal(false);
                setEditingRule(null);
                setForm(INITIAL_FORM);
              }}
            >
              {t('common.cancel')}
            </GlassButton>
            <GlassButton type="submit" variant="primary" disabled={!form.name}>
              {editingRule ? t('automation.rule.update') : t('followUp.saveRule')}
            </GlassButton>
          </div>
        </form>
      </GlassModal>
    </div>
  );
}

// ── Follow Up List Section Component ──
function FollowUpSection({
  title,
  items,
  onComplete,
  onOpenSidecar,
  isOverdue,
  isToday,
}: {
  title: string;
  items: FollowUpItem[];
  onComplete: (id: string) => void;
  onOpenSidecar?: (fu: FollowUpItem) => void;
  isOverdue?: boolean;
  isToday?: boolean;
}) {
  const { t } = useSafeI18n();
  if (items.length === 0) return null;
  return (
    <div>
      <h3
        className={`text-[0.75rem] font-bold uppercase tracking-wider mb-3 flex items-center gap-2 ${
          isOverdue
            ? 'text-rose-500'
            : isToday
            ? 'text-brand-500'
            : 'text-[var(--text-muted)]'
        }`}
      >
        {isOverdue && <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />}
        {title}
        <span className="px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-[var(--text-muted)] text-[0.65rem] ml-1">
          {items.length}
        </span>
      </h3>
      <div className="space-y-2.5">
        {items.map((fu) => (
          <div
            key={fu.id}
            onClick={() => onOpenSidecar?.(fu)}
            className="liquid-glass-surface flex cursor-pointer flex-col sm:flex-row sm:items-center justify-between gap-3.5 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 hover:shadow-md transition-all duration-200"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[0.65rem] font-bold bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-600 dark:text-indigo-400 shrink-0">
                  {fu.lead?.firstName?.[0] || 'L'}
                  {fu.lead?.lastName?.[0] || ''}
                </div>
                <p className="font-bold text-sm text-[var(--text-primary)] truncate">
                  {fu.lead?.firstName} {fu.lead?.lastName}
                </p>
                <span className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 text-[var(--text-muted)] text-[0.68rem] font-medium font-mono">
                  {new Date(fu.scheduledAt).toLocaleDateString()}
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed ml-9.5">
                {fu.note || t('followUp.actionRequired')}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-start sm:self-center" onClick={(e) => e.stopPropagation()}>
              <GlassButton
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenSidecar?.(fu)}
                title="Tafsilotlar (Sidecar)"
              >
                ◨
              </GlassButton>
              <GlassButton
                type="button"
                variant="ghost"
                size="sm"
                className="text-emerald-600 dark:text-emerald-400"
                onClick={() => onComplete(fu.id)}
                icon={
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                }
              >
                {t('followUp.markDone')}
              </GlassButton>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default FollowUpAutomationPage;
