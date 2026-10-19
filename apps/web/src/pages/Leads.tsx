/**
 * M-EDU LeadsPage — Apple Design Award V2 Edition
 *
 * Premium craft:
 *  - Hero header with gradient target icon + live KPI stats bar (Total, Won, Pipeline, Rate)
 *  - Ambient soft lighting substrate
 *  - Staggered row entrances with Spring physics (Framer Motion)
 *  - Stage badges with semantic tone-aware colors
 *  - Deterministic gradient avatar initials
 *  - Interactive stage quick-update
 *  - Glass modal with squircle input fields
 *  - Full preservation of i18n, RBAC, search debounce, and convert-to-student flow
 */

import { useMemo, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, type Variants } from 'framer-motion';
import { leadsApi } from '@/lib/api';
import { openQuickLook, openSidecar } from '@/stores/ui.store';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import {
  GlassErrorState,
  GlassEmptyState,
  GlassPagination,
  GlassInput,
  GlassSelect,
  GlassField,
  GlassModal,
  ConfirmDialog,
  GlassButton,
  FloatingActionIsland,
  useToasts,
} from '@/components/ui';
import { useListKeyboardNavigation } from '@/hooks/useListKeyboardNavigation';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, Lead, LeadStage } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';
import { queryKeys } from '@/lib/query-keys.factory';

/* ══════════════════════════════════════════════════════════════════════════
 * MOTION TOKENS
 * ════════════════════════════════════════════════════════════════════════ */

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  soft:   { type: 'spring', stiffness: 220, damping: 28, mass: 1.0 },
} as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.06 } },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.99 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 340, damping: 30, mass: 0.85 },
  },
};

const LEAD_STAGES: LeadStage[] = [
  'NEW',
  'CONTACTED',
  'TRIAL_LESSON',
  'WON',
  'LOST',
];

function stageKey(stage: string): string {
  return `leads.stage.${stage}`;
}

const STAGE_CONFIG: Record<LeadStage, { bg: string; text: string; ring: string; dot: string }> = {
  NEW: {
    bg: 'bg-sky-500/10 dark:bg-sky-500/15',
    text: 'text-sky-700 dark:text-sky-300',
    ring: 'ring-sky-500/25',
    dot: 'bg-sky-500',
  },
  CONTACTED: {
    bg: 'bg-indigo-500/10 dark:bg-indigo-500/15',
    text: 'text-indigo-700 dark:text-indigo-300',
    ring: 'ring-indigo-500/25',
    dot: 'bg-indigo-500',
  },
  TRIAL_LESSON: {
    bg: 'bg-amber-500/10 dark:bg-amber-500/15',
    text: 'text-amber-700 dark:text-amber-300',
    ring: 'ring-amber-500/25',
    dot: 'bg-amber-500',
  },
  WON: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-300',
    ring: 'ring-emerald-500/25',
    dot: 'bg-emerald-500',
  },
  LOST: {
    bg: 'bg-rose-500/10 dark:bg-rose-500/15',
    text: 'text-rose-700 dark:text-rose-300',
    ring: 'ring-rose-500/25',
    dot: 'bg-rose-500',
  },
};

const AVATAR_PALETTES = [
  'from-blue-600 to-blue-700',
  'from-slate-600 to-slate-700',
  'from-emerald-600 to-emerald-700',
  'from-teal-600 to-teal-700',
  'from-indigo-600 to-indigo-700',
  'from-slate-800 to-zinc-900',
];

function getAvatarGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length];
}

interface LeadFilters {
  page: number;
  limit: number;
  stage?: LeadStage;
  search?: string;
}

interface LeadFormState {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  source: string;
  stage: LeadStage;
  notes: string;
}

const INITIAL_FORM: LeadFormState = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  source: '',
  stage: 'NEW',
  notes: '',
};

function formatLeadName(lead: Lead): string {
  return [lead.firstName, lead.lastName].filter(Boolean).join(' ') || '—';
}

function LeadSkeletonRow() {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-black/[0.05] bg-white/40 p-4 dark:border-white/[0.06] dark:bg-white/[0.02]">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 animate-pulse rounded-full bg-black/10 dark:bg-white/10" />
        <div className="space-y-2">
          <div className="h-4 w-32 animate-pulse rounded bg-black/10 dark:bg-white/10" />
          <div className="h-3 w-24 animate-pulse rounded bg-black/5 dark:bg-white/5" />
        </div>
      </div>
      <div className="h-6 w-20 animate-pulse rounded-full bg-black/10 dark:bg-white/10" />
    </div>
  );
}

export function LeadsPage() {
  const { t } = useI18n();
  usePageTitle(t('leads.title') || 'Leads');
  const sound = usePremiumSound();
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();

  // Filter state
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [stage, setStage] = useState('');
  const [search, setSearch] = useState(() => searchParams.get('search') || searchParams.get('q') || '');
  const debouncedSearch = useDebounce(search, 300);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [convertTarget, setConvertTarget] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [trialTarget, setTrialTarget] = useState<Lead | null>(null);
  const [trialForm, setTrialForm] = useState({
    trialDate: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
    subject: 'General English / Matematika',
    teacherName: '',
    notes: 'Bepul sinov darsi belgilandi',
  });

  const [attendanceTarget, setAttendanceTarget] = useState<Lead | null>(null);
  const [attendanceForm, setAttendanceForm] = useState({
    attended: true,
    feedback: 'O\'quvchiga dars yoqdi, guruhga yozilishga tayyor',
    nextAction: 'To\'lov invoysini chiqarish',
  });

  const trialAnalytics = useQuery({
    queryKey: ['leads-trial-analytics'],
    queryFn: () => leadsApi.getTrialAnalytics() as Promise<{
      totalTrialScheduled: number;
      attended: number;
      convertedWon: number;
      conversionRate: number;
      pendingAttendance: number;
    }>,
  });

  const scheduleTrialMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => leadsApi.scheduleTrial(id, data),
    onSuccess: () => {
      push('success', 'Sinov darsi muvaffaqiyatli belgilandi va lid TRIAL_LESSON bosqichiga o\'tkazildi');
      setTrialTarget(null);
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['leads-trial-analytics'] });
    },
    onError: (e: any) => push('error', getErrorMessage(e)),
  });

  const markAttendanceMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => leadsApi.markTrialAttendance(id, data),
    onSuccess: () => {
      push('success', 'Sinov darsi davomati kiritildi va tahlil yangilandi');
      setAttendanceTarget(null);
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['leads-trial-analytics'] });
    },
    onError: (e: any) => push('error', getErrorMessage(e)),
  });

  // Form state
  const [form, setForm] = useState<LeadFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof LeadFormState, string>>>({});

  // Build query params
  const params = useMemo<LeadFilters>(
    () => ({
      page,
      limit: 20,
      stage: (stage as LeadStage) || undefined,
      search: debouncedSearch || undefined,
    }),
    [page, stage, debouncedSearch],
  );

  // Data fetching
  const leads = useQuery({
    queryKey: ['leads', params],
    queryFn: () => leadsApi.list(params),
    placeholderData: (previousData) => previousData,
  });

  const data = leads.data as Paginated<Lead> | undefined;
  const leadList = useMemo(() => data?.items || [], [data]);
  const totalLeads = data?.total || 0;

  // Derived KPIs
  const wonCount = useMemo(() => leadList.filter((l) => l.stage === 'WON').length, [leadList]);
  const newCount = useMemo(() => leadList.filter((l) => l.stage === 'NEW').length, [leadList]);
  const activeFunnelCount = useMemo(
    () => leadList.filter((l) => l.stage !== 'WON' && l.stage !== 'LOST').length,
    [leadList],
  );

  // Create or update lead mutation
  const create = useMutation({
    mutationFn: () => {
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        source: form.source.trim() || undefined,
        notes: form.notes.trim() || undefined,
        stage: form.stage,
      };
      return editingId ? leadsApi.update(editingId, payload) : leadsApi.create(payload);
    },
    onSuccess: () => {
      push('success', editingId ? t('leads.updated') || 'Lead updated' : t('leads.created') || 'Lead created');
      setModalOpen(false);
      setEditingId(null);
      setForm(INITIAL_FORM);
      setFormErrors({});
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
    },
  });

  // Delete lead mutation
  const remove = useMutation({
    mutationFn: (id: string) => leadsApi.remove(id),
    onSuccess: () => {
      push('success', t('leads.deleted') || 'Lead deleted');
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
    },
  });

  // Update stage mutation
  const updateStage = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: LeadStage }) => leadsApi.updateStage(id, stage),
    onSuccess: () => {
      push('success', t('leads.stageUpdated') || 'Stage updated');
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
    },
  });

  // Convert lead mutation
  const convert = useMutation({
    mutationFn: (id: string) => leadsApi.convert(id, {}),
    onSuccess: () => {
      push('success', t('leads.converted') || 'Lead converted to student');
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: queryKeys.students.all() });
      qc.invalidateQueries({ queryKey: queryKeys.students.selectors() });
      qc.invalidateQueries({ queryKey: queryKeys.students.faces() });
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
    },
  });

  // Form validation
  const validateForm = useCallback((): boolean => {
    const errors: Partial<Record<keyof LeadFormState, string>> = {};

    if (!form.firstName.trim()) {
      errors.firstName = t('leads.form.firstNameRequired') || 'First name is required';
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = t('leads.form.emailInvalid') || 'Invalid email format';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form, t]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  }, []);

  const handleStageFilterChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setStage(e.target.value);
    setPage(1);
  }, []);

  const handleUpdateStage = useCallback(
    (leadId: string, newStage: LeadStage) => {
      updateStage.mutate({ id: leadId, stage: newStage });
    },
    [updateStage],
  );

  const handleConvert = useCallback((leadId: string) => {
    setConvertTarget(leadId);
  }, []);

  const handleEdit = useCallback((lead: Lead) => {
    setEditingId(lead.id);
    setForm({
      firstName: lead.firstName,
      lastName: lead.lastName || '',
      phone: lead.phone || '',
      email: lead.email || '',
      source: lead.source || '',
      stage: lead.stage,
      notes: lead.notes || '',
    });
    setFormErrors({});
    setModalOpen(true);
  }, []);

  const handleOpenLeadSidecar = useCallback(
    (lead: Lead) => {
      sound.playTick();
      const fullNameStr = formatLeadName(lead);
      const stageName = t(stageKey(lead.stage));

      openSidecar({
        id: lead.id,
        type: 'lead',
        title: fullNameStr,
        subtitle: lead.source ? `Manba: ${lead.source}` : 'CRM Lid',
        badge: {
          text: stageName,
          tone: lead.stage === 'WON' ? 'emerald' : lead.stage === 'LOST' ? 'rose' : lead.stage === 'TRIAL_LESSON' ? 'purple' : 'blue',
        },
        avatar: {
          text: fullNameStr.slice(0, 2).toUpperCase(),
          color: lead.stage === 'WON' ? '#10B981' : '#6366F1',
        },
        metrics: [
          {
            label: 'Bosqich',
            value: stageName,
            subtext: `Yaratilgan: ${formatDate(lead.createdAt)}`,
          },
          {
            label: 'Manba',
            value: lead.source || 'To\'g\'ridan-to\'g\'ri',
            subtext: 'Kanal',
          },
          {
            label: 'Aloqa',
            value: lead.phone || '—',
            subtext: lead.email || 'Email yo\'q',
          },
        ],
        details: [
          { label: 'Telefon', value: lead.phone || '—', copyable: true },
          { label: 'Email', value: lead.email || '—', copyable: true },
          { label: 'Manba', value: lead.source || '—' },
          { label: 'Qaydlar', value: lead.notes || 'Izoh yo\'q' },
          { label: 'Sana', value: formatDate(lead.createdAt) },
          { label: 'Lid ID', value: lead.id, copyable: true },
        ],
        tags: lead.source ? [lead.source, stageName] : [stageName],
        primaryAction: {
          label: 'Tahrirlash',
          onExecute: () => handleEdit(lead),
        },
        secondaryAction: lead.stage !== 'WON' && lead.stage !== 'LOST' ? {
          label: 'Talabaga aylantirish',
          onExecute: () => handleConvert(lead.id),
        } : undefined,
      });
    },
    [sound, t, handleEdit, handleConvert],
  );

  const handleQuickLook = useCallback(
    (lead: Lead) => {
      const fullNameStr = formatLeadName(lead);
      const stageName = t(stageKey(lead.stage));

      openQuickLook({
        id: lead.id,
        type: 'lead',
        title: fullNameStr,
        subtitle: lead.source ? `Manba: ${lead.source}` : 'CRM Lid',
        badge: {
          text: stageName,
          tone: lead.stage === 'WON' ? 'emerald' : lead.stage === 'LOST' ? 'rose' : lead.stage === 'TRIAL_LESSON' ? 'purple' : 'blue',
        },
        avatar: {
          text: fullNameStr.slice(0, 2).toUpperCase(),
        },
        metrics: [
          {
            label: 'Bosqich',
            value: stageName,
            subtext: `Yaratilgan: ${formatDate(lead.createdAt)}`,
          },
          {
            label: 'Manba',
            value: lead.source || 'To\'g\'ridan-to\'g\'ri',
            subtext: 'Kanal',
          },
          {
            label: 'Aloqa',
            value: lead.phone || '—',
            subtext: lead.email || 'Email yo\'q',
          },
        ],
        details: [
          { label: 'Telefon', value: lead.phone || '—' },
          { label: 'Email', value: lead.email || '—' },
          { label: 'Manba', value: lead.source || '—' },
          { label: 'Qaydlar', value: lead.notes || 'Izoh yo\'q' },
          { label: 'Sana', value: formatDate(lead.createdAt) },
          { label: 'Lid ID', value: lead.id },
        ],
        tags: lead.source ? [lead.source, stageName] : [stageName],
        primaryAction: {
          label: 'Tahrirlash',
          onExecute: () => handleEdit(lead),
        },
        secondaryAction: lead.stage !== 'WON' && lead.stage !== 'LOST' ? {
          label: 'Talabaga aylantirish',
          onExecute: () => handleConvert(lead.id),
        } : undefined,
      });
    },
    [t, handleEdit, handleConvert],
  );

  const handleDelete = useCallback((id: string) => {
    setDeleteTarget(id);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    remove.mutate(deleteTarget);
    setDeleteTarget(null);
  }, [deleteTarget, remove]);

  const confirmConvert = useCallback(() => {
    if (!convertTarget) return;
    convert.mutate(convertTarget);
    setConvertTarget(null);
  }, [convertTarget, convert]);

  /* ── Superhuman Keyboard-First Navigation ─────────────────────────── */
  const {
    focusedIndex,
    selectedIds,
    selectedCount,
    isSelected,
    toggleSelection,
    clearSelection,
  } = useListKeyboardNavigation<Lead>({
    items: leadList,
    getItemId: (l) => l.id,
    rowIdPrefix: 'lead-row-',
    onSelect: (l) => handleEdit(l),
    onQuickLook: (l) => handleOpenLeadSidecar(l),
    onEdit: (l) => handleEdit(l),
  });

  /* ── Batch actions ────────────────────────────────────────────────── */
  const handleBatchMarkAsWon = async () => {
    let count = 0;
    for (const id of selectedIds) {
      try {
        await leadsApi.update(id, { stage: 'WON' });
        count++;
      } catch {
        // continue
      }
    }
    qc.invalidateQueries({ queryKey: queryKeys.leads.all() });
    clearSelection();
    push('success', `${count} ta lid "Yutib olindi" (WON) deb belgilandi`);
  };

  const handleExportSelectedLeadsCSV = () => {
    const selectedRows = leadList.filter((l) => isSelected(l.id));
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      ['ID,Name,Phone,Email,Stage,Source']
        .concat(
          selectedRows.map(
            (l) =>
              `"${l.id}","${formatLeadName(l)}","${l.phone || ''}","${l.email || ''}","${l.stage}","${l.source || ''}"`
          )
        )
        .join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `leads_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    push('success', `${selectedRows.length} ta lid CSV formatida yuklandi`);
  };

  const handleBatchDeleteLeads = async () => {
    let count = 0;
    for (const id of selectedIds) {
      try {
        await leadsApi.remove(id);
        count++;
      } catch {
        // continue
      }
    }
    qc.invalidateQueries({ queryKey: queryKeys.leads.all() });
    clearSelection();
    push('success', `${count} ta lid o'chirildi`);
  };

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!validateForm()) return;
      create.mutate();
    },
    [validateForm, create],
  );

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setEditingId(null);
    setForm(INITIAL_FORM);
    setFormErrors({});
  }, []);

  const handleOpenModal = useCallback(() => {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setFormErrors({});
    setModalOpen(true);
  }, []);

  const hasActiveFilters = Boolean(stage || search);

  return (
    <motion.main
      className="relative mx-auto max-w-7xl space-y-6 px-4 pb-16 pt-2 sm:px-6 lg:px-8"
      aria-label="CRM Leads"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING.smooth}
    >
      {/* ── 1. Hero Header & Quick Stats Bar ─────────────────────────────── */}
      <section className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 p-5 sm:p-6 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm dark:bg-blue-500">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="6" />
                <circle cx="12" cy="12" r="2" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
                {t('leads.title') || 'Leads & CRM'}
              </h1>
              <p className="text-[13px] text-slate-500 dark:text-slate-400">
                {t('leads.pageSubtitle') || 'Student recruitment pipeline and lead qualification'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <GlassButton
              type="button"
              variant="primary"
              onClick={handleOpenModal}
              className="rounded-xl px-4 py-2 font-medium"
            >
              <svg className="-ml-1 mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {t('leads.add') || 'Yangi lid qo\'shish'}
            </GlassButton>
          </div>
        </div>

        {/* Live KPI Strip */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-3.5 border-t border-slate-100 dark:border-white/[0.06] pt-5">
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5 dark:border-white/[0.06] dark:bg-white/[0.02]">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{t('leads.totalLeads') || 'Jami lidlar'}</span>
            <div className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{totalLeads}</div>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5 dark:border-white/[0.06] dark:bg-white/[0.02]">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{t('leads.activeFunnel') || 'Faol jarayonda'}</span>
            <div className="mt-1 text-2xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">{activeFunnelCount}</div>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5 dark:border-white/[0.06] dark:bg-white/[0.02]">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{t('leads.newToday') || 'Yangi tushgan'}</span>
            <div className="mt-1 text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">{newCount}</div>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5 dark:border-white/[0.06] dark:bg-white/[0.02]">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{t('leads.wonConverted') || 'Muvaffaqiyatli'}</span>
            <div className="mt-1 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">{wonCount}</div>
          </div>
        </div>

        {/* Live Trial Lesson Conversion Analytics */}
        {trialAnalytics.data && trialAnalytics.data.totalTrialScheduled > 0 && (
          <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-amber-800 dark:text-amber-200">
                🎯 Sinov darslari voronkasi & Konversiya
              </span>
              <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:text-amber-100">
                Konversiya: {trialAnalytics.data.conversionRate}%
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs">
              <div className="rounded-lg bg-white/60 p-2.5 dark:bg-black/30">
                <span className="text-slate-500 dark:text-slate-400">Rejalashtirilgan:</span>
                <p className="mt-0.5 font-bold text-slate-900 dark:text-slate-100">{trialAnalytics.data.totalTrialScheduled} ta</p>
              </div>
              <div className="rounded-lg bg-white/60 p-2.5 dark:bg-black/30">
                <span className="text-slate-500 dark:text-slate-400">Darsga kelgan:</span>
                <p className="mt-0.5 font-bold text-indigo-600 dark:text-indigo-400">{trialAnalytics.data.attended} ta</p>
              </div>
              <div className="rounded-lg bg-white/60 p-2.5 dark:bg-black/30">
                <span className="text-slate-500 dark:text-slate-400">O'quvchiga aylangan:</span>
                <p className="mt-0.5 font-bold text-emerald-600 dark:text-emerald-400">{trialAnalytics.data.convertedWon} ta</p>
              </div>
              <div className="rounded-lg bg-white/60 p-2.5 dark:bg-black/30">
                <span className="text-slate-500 dark:text-slate-400">Kutilayotgan davomat:</span>
                <p className="mt-0.5 font-bold text-amber-600 dark:text-amber-400">{trialAnalytics.data.pendingAttendance} ta</p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── 2. Filter & Search Toolbar ───────────────────────────────────── */}
      <section className="flex flex-col gap-3 rounded-2xl border border-black/[0.06] bg-white/80 p-4 shadow-sm backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between dark:border-white/[0.08] dark:bg-surface-900/80">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:flex-1">
          <GlassInput
            placeholder={t('leads.searchPlaceholder') || 'Ism, telefon yoki email bo\'yicha qidiruv...'}
            value={search}
            onChange={handleSearchChange}
            aria-label={t('leads.searchPlaceholder') || 'Qidiruv'}
            type="search"
          />
          <GlassSelect
            value={stage}
            onChange={handleStageFilterChange}
            aria-label={t('leads.filterHint') || 'Bosqich bo\'yicha filtr'}
          >
            <option value="">{t('leads.allStages') || 'Barcha bosqichlar'}</option>
            {LEAD_STAGES.map((s) => (
              <option key={s} value={s}>
                {t(stageKey(s))}
              </option>
            ))}
          </GlassSelect>
        </div>
        <div className="text-xs font-medium text-[var(--text-secondary)] sm:shrink-0 sm:pl-3">
          {totalLeads === 1 ? '1 ta lid' : `${totalLeads} ta lid topildi`}
        </div>
      </section>

      {/* ── 3. Leads List Feed ───────────────────────────────────────────── */}
      <section className="space-y-3">
        {leads.isLoading && !data ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((idx) => (
              <LeadSkeletonRow key={idx} />
            ))}
          </div>
        ) : leads.isError ? (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-8 text-center backdrop-blur-md">
            <GlassErrorState
              title={t('leads.loadFailed') || 'Lidlarni yuklab bo\'lmadi'}
              message={getErrorMessage(leads.error as Error)}
              onRetry={() => leads.refetch()}
            />
          </div>
        ) : leadList.length === 0 ? (
          <div className="rounded-2xl border border-black/[0.06] bg-white/80 p-12 text-center backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card">
            <GlassEmptyState
              title={hasActiveFilters ? t('leads.noMatching') || 'Lidlar topilmadi' : t('leads.noLeads') || 'Hozircha lidlar mavjud emas'}
              message={hasActiveFilters ? t('common.adjustFilters') || 'Filtrlarni o\'zgartirib ko\'ring' : t('leads.addHint') || 'Yangi lid kiritish uchun tugmani bosing'}
            />
          </div>
        ) : (
          <motion.div
            className="space-y-2.5"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {leadList.map((lead, idx) => {
              const fullNameStr = formatLeadName(lead);
              const initials = fullNameStr
                .split(' ')
                .map((w) => w[0])
                .join('')
                .slice(0, 2)
                .toUpperCase() || 'L';
              const stageStyle = STAGE_CONFIG[lead.stage] || STAGE_CONFIG.NEW;
              const isUpdatingStage = updateStage.isPending && updateStage.variables?.id === lead.id;
              const isConverting = convert.isPending && convert.variables === lead.id;
              const isRowSelected = isSelected(lead.id);
              const isRowFocused = focusedIndex === idx;

              return (
                <motion.article
                  key={lead.id}
                  id={`lead-row-${lead.id}`}
                  variants={rowVariants}
                  tabIndex={0}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === ' ') {
                      e.preventDefault();
                      handleQuickLook(lead);
                    }
                  }}
                  className={`group relative flex flex-col gap-4 rounded-2xl border p-4 shadow-card transition-all duration-200 focus-visible:outline-none sm:flex-row sm:items-center sm:justify-between ${
                    isRowFocused
                      ? 'ring-2 ring-[#007AFF] bg-[#007AFF]/[0.06] border-[#007AFF]/40'
                      : isRowSelected
                      ? 'bg-[#007AFF]/[0.04] border-[#007AFF]/30'
                      : 'border-black/[0.06] bg-white/80 hover:bg-white backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 dark:hover:bg-surface-800/80'
                  }`}
                >
                  {/* Lead Info */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Selection Checkbox */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelection(lead.id);
                      }}
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all ${
                        isRowSelected
                          ? 'border-blue-500 bg-blue-500 text-white'
                          : 'border-zinc-300 bg-white/50 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/50'
                      }`}
                      aria-label={isRowSelected ? "Tanlovni bekor qilish" : "Tanlash"}
                    >
                      {isRowSelected && (
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr ${getAvatarGradient(
                        fullNameStr,
                      )} text-sm font-semibold text-white shadow-sm ring-2 ring-white/50 dark:ring-zinc-800`}
                    >
                      {initials}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-semibold text-zinc-900 dark:text-zinc-50">
                          {fullNameStr}
                        </h3>
                        {lead.source && (
                          <span className="hidden sm:inline-block rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                            {lead.source}
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {lead.phone && (
                          <span className="flex items-center gap-1">
                            <svg className="h-3.5 w-3.5 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                            </svg>
                            {lead.phone}
                          </span>
                        )}
                        {lead.email && (
                          <span className="flex items-center gap-1">
                            <svg className="h-3.5 w-3.5 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                              <polyline points="22,6 12,13 2,6" />
                            </svg>
                            {lead.email}
                          </span>
                        )}
                        <span>{formatDate(lead.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Stage Switcher & Actions */}
                  <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5 pt-2 sm:pt-0 border-t sm:border-0 border-black/[0.05] dark:border-white/[0.06]">
                    {/* Stage Select Pill */}
                    <div className="relative">
                      <select
                        value={lead.stage}
                        disabled={isUpdatingStage}
                        onChange={(e) => handleUpdateStage(lead.id, e.target.value as LeadStage)}
                        className={`cursor-pointer appearance-none rounded-xl px-3 py-1.5 pr-7 text-xs font-semibold ring-1 transition-all ${stageStyle.bg} ${stageStyle.text} ${stageStyle.ring} focus:outline-none focus:ring-2`}
                        aria-label={t('leads.updateStageAria', { name: fullNameStr })}
                      >
                        {LEAD_STAGES.map((st) => (
                          <option key={st} value={st} className="bg-white text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
                            {t(stageKey(st))}
                          </option>
                        ))}
                      </select>
                      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-current opacity-60">
                        ▾
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <GlassButton
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleQuickLook(lead)}
                        className="rounded-lg px-2.5 py-1 text-xs text-blue-600 dark:text-blue-400 font-semibold"
                        title="Quick-Look (Space)"
                      >
                        👁 Quick-Look
                      </GlassButton>

                      <GlassButton
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(lead)}
                        className="rounded-lg px-2.5 py-1 text-xs"
                      >
                        {t('common.edit') || 'Tahrirlash'}
                      </GlassButton>

                      {lead.stage !== 'WON' && lead.stage !== 'LOST' && (
                        <>
                          <GlassButton
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setTrialTarget(lead)}
                            className="rounded-lg px-2.5 py-1 text-xs text-amber-600 dark:text-amber-400"
                          >
                            📅 Sinov darsi
                          </GlassButton>

                          {lead.stage === 'TRIAL_LESSON' && (
                            <GlassButton
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => setAttendanceTarget(lead)}
                              className="rounded-lg px-2.5 py-1 text-xs text-indigo-600 dark:text-indigo-400"
                            >
                              ✓ Davomat
                            </GlassButton>
                          )}

                          <GlassButton
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={() => handleConvert(lead.id)}
                          disabled={isConverting}
                          className="rounded-lg px-2.5 py-1 text-xs"
                        >
                          {isConverting ? t('leads.converting') || 'O\'tkazilmoqda...' : t('leads.convert') || 'Talabaga aylantirish'}
                        </GlassButton>
                        </>
                      )}

                      {/* Sidecar Split-View trigger */}
                      <button
                        type="button"
                        onClick={() => handleOpenLeadSidecar(lead)}
                        aria-label="Sidecar tafsilotlarini ochish"
                        title="Sidecar tafsilotlari (Split-View · Space)"
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200/80 bg-white/70 text-slate-600 hover:text-slate-950 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-400 dark:hover:text-white transition-colors"
                      >
                        <span className="text-[12px] leading-none">◨</span>
                      </button>

                      <GlassButton
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => handleDelete(lead.id)}
                        disabled={remove.isPending && remove.variables === lead.id}
                        className="rounded-lg px-2 py-1 text-xs opacity-75 hover:opacity-100"
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </GlassButton>
                    </div>
                  </div>
                </motion.article>
              );
            })}

            {/* Pagination */}
            <div className="pt-4">
              <GlassPagination
                page={page}
                totalPages={data?.totalPages ?? 1}
                onPageChange={setPage}
              />
            </div>
          </motion.div>
        )}
      </section>

      {/* Superhuman Floating Action Island */}
      <FloatingActionIsland
        selectedCount={selectedCount}
        onClearSelection={clearSelection}
        entityName="lid"
        actions={[
          {
            label: 'WON deb belgilash',
            shortcut: 'W',
            icon: (
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ),
            variant: 'primary',
            onClick: handleBatchMarkAsWon,
          },
          {
            label: 'CSV Eksport',
            shortcut: 'C',
            icon: (
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            ),
            variant: 'default',
            onClick: handleExportSelectedLeadsCSV,
          },
          {
            label: "O'chirish",
            shortcut: 'D',
            icon: (
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            ),
            variant: 'destructive',
            onClick: handleBatchDeleteLeads,
          },
        ]}
      />

      {/* ── 4. Add/Edit Lead Modal ───────────────────────────────────────── */}
      <GlassModal
        open={modalOpen}
        onClose={handleCloseModal}
        title={editingId ? t('leads.editTitle') || 'Lidni tahrirlash' : t('leads.add') || 'Yangi lid kiritish'}
        wide
      >
        <form className="space-y-4 pt-2" onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <GlassField label={t('leads.form.firstName') || 'Ism'} required error={formErrors.firstName}>
              <GlassInput
                value={form.firstName}
                onChange={(e) => {
                  setForm((p) => ({ ...p, firstName: e.target.value }));
                  setFormErrors((p) => ({ ...p, firstName: undefined }));
                }}
                required
                aria-invalid={Boolean(formErrors.firstName)}
                placeholder="Ali"
              />
              {formErrors.firstName && (
                <span className="mt-1 block text-xs text-rose-500">{formErrors.firstName}</span>
              )}
            </GlassField>

            <GlassField label={t('leads.form.lastName') || 'Familiya'}>
              <GlassInput
                value={form.lastName}
                onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
                placeholder="Valiyev"
              />
            </GlassField>

            <GlassField label={t('common.phone') || 'Telefon'}>
              <GlassInput
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                placeholder="+998 90 123 4567"
              />
            </GlassField>

            <GlassField label={t('common.email') || 'Email'} error={formErrors.email}>
              <GlassInput
                type="email"
                value={form.email}
                onChange={(e) => {
                  setForm((p) => ({ ...p, email: e.target.value }));
                  setFormErrors((p) => ({ ...p, email: undefined }));
                }}
                aria-invalid={Boolean(formErrors.email)}
                placeholder="ali@example.com"
              />
              {formErrors.email && (
                <span className="mt-1 block text-xs text-rose-500">{formErrors.email}</span>
              )}
            </GlassField>

            <GlassField label={t('leads.col.source') || 'Manba (Qayerdan bildi)'}>
              <GlassInput
                value={form.source}
                onChange={(e) => setForm((p) => ({ ...p, source: e.target.value }))}
                placeholder="Telegram, Instagram, Reklama..."
              />
            </GlassField>

            <GlassField label={t('leads.col.stage') || 'Boshlang\'ich bosqich'}>
              <GlassSelect
                value={form.stage}
                onChange={(e) => setForm((p) => ({ ...p, stage: e.target.value as LeadStage }))}
                aria-label={t('leads.col.stage') || 'Bosqich'}
              >
                {LEAD_STAGES.map((st) => (
                  <option key={st} value={st}>
                    {t(stageKey(st))}
                  </option>
                ))}
              </GlassSelect>
            </GlassField>
          </div>

          <GlassField label={t('common.notes') || 'Qo\'shimcha izoh'}>
            <GlassInput
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Qiziqqan fani, qulay vaqtlari va h.k."
            />
          </GlassField>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200/80 dark:border-slate-800 dark:border-white/[0.08]">
            <GlassButton
              type="button"
              variant="secondary"
              onClick={handleCloseModal}
              disabled={create.isPending}
            >
              {t('common.cancel') || 'Bekor qilish'}
            </GlassButton>
            <GlassButton type="submit" variant="primary" disabled={create.isPending}>
              {create.isPending
                ? t('common.saving') || 'Saqlanmoqda...'
                : editingId
                  ? t('common.save') || 'Saqlash'
                  : t('leads.add') || 'Qo\'shish'}
            </GlassButton>
          </div>
        </form>
      </GlassModal>

      {/* ── 5. Confirmation Dialogs ──────────────────────────────────────── */}
      <ConfirmDialog
        open={convertTarget !== null}
        onClose={() => setConvertTarget(null)}
        onConfirm={confirmConvert}
        description={t('leads.convertConfirm') || 'Ushbu lidni talabalar safiga o\'tkazishni tasdiqlaysizmi?'}
        confirmLabel={t('leads.convert') || 'Talabaga aylantirish'}
        tone="primary"
        loading={convert.isPending}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        description={t('leads.deleteConfirm') || 'Lidni butunlay o\'chirib tashlamoqchimisiz?'}
        confirmLabel={t('common.delete') || 'O\'chirish'}
        tone="danger"
        loading={remove.isPending}
      />

      {/* ── 6. Schedule Trial Lesson Modal ─────────────────────────────── */}
      <GlassModal
        open={trialTarget !== null}
        onClose={() => setTrialTarget(null)}
        title="Sinov darsini rejalashtirish (Trial Lesson)"
      >
        {trialTarget && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              scheduleTrialMutation.mutate({
                id: trialTarget.id,
                data: trialForm,
              });
            }}
            className="space-y-4"
          >
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-200">
              <p className="font-semibold">
                {trialTarget.firstName} {trialTarget.lastName || ''} uchun bepul sinov darsi
              </p>
              <p className="mt-1 text-[11px] opacity-80">
                Sinov darsi belgilangach, lid avtomatik tarzda «TRIAL_LESSON» bosqichiga o'tkaziladi va CRM voronkasida qayd etiladi.
              </p>
            </div>

            <GlassField label="Sinov darsi sanasi va vaqti" required>
              <GlassInput
                type="datetime-local"
                value={trialForm.trialDate}
                onChange={(e) => setTrialForm({ ...trialForm, trialDate: e.target.value })}
                required
              />
            </GlassField>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <GlassField label="Fan / Kurs nomi" required>
                <GlassInput
                  value={trialForm.subject}
                  onChange={(e) => setTrialForm({ ...trialForm, subject: e.target.value })}
                  placeholder="Masalan: General English B1"
                  required
                />
              </GlassField>

              <GlassField label="O'qituvchi (ixtiyoriy)">
                <GlassInput
                  value={trialForm.teacherName}
                  onChange={(e) => setTrialForm({ ...trialForm, teacherName: e.target.value })}
                  placeholder="O'qituvchi ismi..."
                />
              </GlassField>
            </div>

            <GlassField label="Qo'shimcha izoh">
              <GlassInput
                value={trialForm.notes}
                onChange={(e) => setTrialForm({ ...trialForm, notes: e.target.value })}
                placeholder="Talabaning boshlang'ich bilimi yoki talabi..."
              />
            </GlassField>

            <div className="flex justify-end gap-2 pt-2">
              <GlassButton type="button" variant="secondary" onClick={() => setTrialTarget(null)}>
                Bekor qilish
              </GlassButton>
              <GlassButton type="submit" variant="primary" disabled={scheduleTrialMutation.isPending}>
                {scheduleTrialMutation.isPending ? 'Belgilanmoqda...' : 'Sinov darsini tasdiqlash'}
              </GlassButton>
            </div>
          </form>
        )}
      </GlassModal>

      {/* ── 7. Mark Trial Attendance & Outcome Modal ──────────────────────── */}
      <GlassModal
        open={attendanceTarget !== null}
        onClose={() => setAttendanceTarget(null)}
        title="Sinov darsi davomati va xulosasi"
      >
        {attendanceTarget && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              markAttendanceMutation.mutate({
                id: attendanceTarget.id,
                data: attendanceForm,
              });
            }}
            className="space-y-4"
          >
            <div className="rounded-2xl border border-indigo-500/25 bg-indigo-500/10 p-3.5 text-xs text-indigo-800 dark:text-indigo-200">
              <p className="font-semibold">
                {attendanceTarget.firstName} {attendanceTarget.lastName || ''} — Dars natijasi
              </p>
              <p className="mt-1 text-[11px] opacity-80">
                O'quvchining sinov darsidagi taassuroti va keyingi harakatni belgilang.
              </p>
            </div>

            <GlassField label="Darsga qatnashdimi?" required>
              <div className="flex gap-4 pt-1">
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <input
                    type="radio"
                    name="attended"
                    checked={attendanceForm.attended === true}
                    onChange={() => setAttendanceForm({ ...attendanceForm, attended: true })}
                    className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Ha, qatnashdi</span>
                </label>
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <input
                    type="radio"
                    name="attended"
                    checked={attendanceForm.attended === false}
                    onChange={() => setAttendanceForm({ ...attendanceForm, attended: false })}
                    className="h-4 w-4 text-rose-600 focus:ring-rose-500"
                  />
                  <span className="text-rose-700 dark:text-rose-400 font-semibold">Yo'q, kelmadi (No-show)</span>
                </label>
              </div>
            </GlassField>

            <GlassField label="O'qituvchi / Talaba fikri (Feedback)" required>
              <GlassInput
                value={attendanceForm.feedback}
                onChange={(e) => setAttendanceForm({ ...attendanceForm, feedback: e.target.value })}
                placeholder="Dars yaxshi o'tdi, guruhga mos keladi..."
                required
              />
            </GlassField>

            <GlassField label="Keyingi harakat (Next Action)">
              <GlassInput
                value={attendanceForm.nextAction}
                onChange={(e) => setAttendanceForm({ ...attendanceForm, nextAction: e.target.value })}
                placeholder="Masalan: Ota-onasiga qo'ng'iroq qilish va to'lov invoysini yuborish..."
              />
            </GlassField>

            <div className="flex justify-end gap-2 pt-2">
              <GlassButton type="button" variant="secondary" onClick={() => setAttendanceTarget(null)}>
                Bekor qilish
              </GlassButton>
              <GlassButton type="submit" variant="primary" disabled={markAttendanceMutation.isPending}>
                {markAttendanceMutation.isPending ? 'Saqlanmoqda...' : 'Natijani saqlash'}
              </GlassButton>
            </div>
          </form>
        )}
      </GlassModal>

      {toastNode}
    </motion.main>
  );
}

export default LeadsPage;