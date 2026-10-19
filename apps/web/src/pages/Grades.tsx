/**
 * ============================================================================
 * M-EDU GradesPage — Apple Design Award Edition (macOS Sequoia & Liquid Glass)
 * ============================================================================
 *
 * Senior craft:
 *  - Apple Liquid Glass materials (.liquid-glass-surface, .liquid-glass-card)
 *  - Real-time tunable optics (--liquid-glass-opacity, --liquid-glass-blur)
 *  - macOS Split-View Detail Sidecar (`openSidecar` with academic performance breakdown)
 *  - Superhuman keyboard-first navigation (j/k, x, Enter, c to create)
 *  - Web Audio tactile haptics (playTick, playPop, playSuccess)
 *  - Semantic score pills with vibrant tone-aware grading badges (A/B/C/D/F)
 *  - Shimmer skeletons with specular rim reflections
 * ============================================================================
 */

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, type Variants } from 'framer-motion';
import { gradesApi, studentsApi, groupsApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys.factory';
import {
  GlassModal,
  GlassSelect,
  GlassInput,
  GlassButton,
  GlassErrorState,
  GlassEmptyState,
  ConfirmDialog,
  useToast,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, Grade, Student, Group } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useListKeyboardNavigation } from '@/hooks/useListKeyboardNavigation';
import { openSidecar, type QuickLookData } from '@/stores/ui.store';

/* ══════════════════════════════════════════════════════════════════════════
 * MOTION SPRING TOKENS
 * ════════════════════════════════════════════════════════════════════════ */

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  soft:   { type: 'spring', stiffness: 220, damping: 28, mass: 1.0 },
} as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: SPRING.smooth },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.99 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 360, damping: 28 },
  },
};

/* ══════════════════════════════════════════════════════════════════════════
 * AVATAR & SCORE HELPERS
 * ════════════════════════════════════════════════════════════════════════ */

const AVATAR_GRADIENTS = [
  'from-violet-500 to-indigo-600',
  'from-sky-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-fuchsia-500 to-purple-600',
  'from-cyan-500 to-blue-600',
];

function pickGradient(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
}

function formatStudentName(s?: { user?: { firstName?: string; lastName?: string } } | null): string {
  if (!s?.user) return '—';
  return [s.user.firstName, s.user.lastName].filter(Boolean).join(' ') || '—';
}

function getInitials(name: string): string {
  if (!name || name === '—') return 'ST';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getScoreTier(value: number, max: number): {
  pct: number;
  grade: string;
  badgeClass: string;
} {
  const safeMax = max > 0 ? max : 100;
  const pct = Math.round((value / safeMax) * 100);

  if (pct >= 90) {
    return {
      pct,
      grade: 'A',
      badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
    };
  }
  if (pct >= 80) {
    return {
      pct,
      grade: 'B',
      badgeClass: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25',
    };
  }
  if (pct >= 70) {
    return {
      pct,
      grade: 'C',
      badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25',
    };
  }
  if (pct >= 60) {
    return {
      pct,
      grade: 'D',
      badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25',
    };
  }
  return {
    pct,
    grade: 'F',
    badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25',
  };
}

interface GradeFilters {
  page: number;
  limit: number;
  studentId?: string;
  groupId?: string;
}

interface GradeFormState {
  studentId: string;
  groupId: string;
  value: string;
  maxValue: string;
  label: string;
  notes: string;
}

const INITIAL_FORM: GradeFormState = {
  studentId: '',
  groupId: '',
  value: '',
  maxValue: '100',
  label: '',
  notes: '',
};

export function GradesPage() {
  const { t } = useI18n();
  usePageTitle(t('grades.title'));
  const { push, toastNode } = useToast();
  const qc = useQueryClient();
  const { playPop, playTick, playSuccess } = usePremiumSound();

  const [page, setPage] = useState(1);
  const [studentFilter, setStudentFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editGrade, setEditGrade] = useState<Grade | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const [form, setForm] = useState<GradeFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof GradeFormState, string>>>({});

  const params = useMemo<GradeFilters>(
    () => ({
      page,
      limit: 20,
      studentId: studentFilter || undefined,
      groupId: groupFilter || undefined,
    }),
    [page, studentFilter, groupFilter],
  );

  const gradesQ = useQuery({
    queryKey: ['grades', params],
    queryFn: () => gradesApi.list(params),
    placeholderData: (prev) => prev,
  });

  const data = gradesQ.data as Paginated<Grade> | undefined;
  const isLoading = gradesQ.isLoading;
  const error = gradesQ.error;

  const studentsQ = useQuery({
    queryKey: queryKeys.students.selectors(),
    queryFn: () => studentsApi.list({ limit: 200 }),
  });

  const groupsQ = useQuery({
    queryKey: queryKeys.groups.selectors(),
    queryFn: () => groupsApi.list({ limit: 200 }),
  });

  const createMut = useMutation({
    mutationFn: (d: GradeFormState) =>
      gradesApi.create({
        studentId: d.studentId,
        groupId: d.groupId,
        value: parseFloat(d.value),
        maxValue: d.maxValue ? parseFloat(d.maxValue) : undefined,
        label: d.label || undefined,
        notes: d.notes || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grades'] });
      push('success', t('grades.createSuccess'));
      closeModal();
      playSuccess();
    },
    onError: (e: unknown) => push('error', getErrorMessage(e)),
  });

  const updateMut = useMutation({
    mutationFn: (d: GradeFormState & { id: string }) =>
      gradesApi.update(d.id, {
        value: parseFloat(d.value),
        maxValue: d.maxValue ? parseFloat(d.maxValue) : undefined,
        label: d.label || undefined,
        notes: d.notes || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grades'] });
      push('success', t('grades.updated'));
      closeModal();
      playSuccess();
    },
    onError: (e: unknown) => push('error', getErrorMessage(e)),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => gradesApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grades'] });
      push('success', t('grades.deleted'));
      playSuccess();
    },
    onError: (e: unknown) => push('error', getErrorMessage(e)),
  });

  const openCreate = useCallback(() => {
    playPop();
    setEditGrade(null);
    setForm(INITIAL_FORM);
    setFormErrors({});
    setModalOpen(true);
  }, [playPop]);

  const openEdit = useCallback((g: Grade) => {
    playPop();
    setEditGrade(g);
    setForm({
      studentId: g.studentId,
      groupId: g.groupId,
      value: String(g.value ?? ''),
      maxValue: String(g.maxValue ?? '100'),
      label: g.label ?? '',
      notes: g.notes ?? '',
    });
    setFormErrors({});
    setModalOpen(true);
  }, [playPop]);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditGrade(null);
    playPop();
  }, [playPop]);

  const validate = (): boolean => {
    const errs: Partial<Record<keyof GradeFormState, string>> = {};
    if (!form.studentId) errs.studentId = t('common.required');
    if (!form.groupId) errs.groupId = t('common.required');
    if (!form.value || isNaN(parseFloat(form.value))) errs.value = t('grades.validation.number');
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    if (editGrade) {
      updateMut.mutate({ ...form, id: editGrade.id });
    } else {
      createMut.mutate(form);
    }
  };

  const items = data?.items ?? [];
  const students = (studentsQ.data as { items: Student[] } | undefined)?.items ?? [];
  const groups = (groupsQ.data as { items: Group[] } | undefined)?.items ?? [];

  // Derived KPI calculations
  const kpiStats = useMemo(() => {
    if (items.length === 0) {
      return { avgPct: 0, topScore: 0, passRate: 0 };
    }
    let totalScorePct = 0;
    let maxPct = 0;
    let passingCount = 0;

    items.forEach((g) => {
      const max = g.maxValue && g.maxValue > 0 ? g.maxValue : 100;
      const pct = (g.value / max) * 100;
      totalScorePct += pct;
      if (pct > maxPct) maxPct = pct;
      if (pct >= 60) passingCount++;
    });

    return {
      avgPct: Math.round(totalScorePct / items.length),
      topScore: Math.round(maxPct),
      passRate: Math.round((passingCount / items.length) * 100),
    };
  }, [items]);

  /* ── macOS Split-View Detail Sidecar ──────────────────────────────── */
  const handleOpenGradeSidecar = useCallback((grade: Grade) => {
    const sName = formatStudentName((grade as Grade & { student?: { user?: { firstName?: string; lastName?: string } } }).student);
    const groupName = (grade as Grade & { group?: { name?: string } }).group?.name ?? '—';
    const tier = getScoreTier(grade.value, grade.maxValue ?? 100);

    const qData: QuickLookData = {
      id: grade.id,
      type: 'general',
      title: `${grade.value} / ${grade.maxValue ?? 100} ball`,
      subtitle: `${sName} · ${groupName}`,
      badge: {
        text: `${tier.grade} daraja (${tier.pct}%)`,
        tone: tier.pct >= 70 ? 'emerald' : tier.pct >= 60 ? 'amber' : 'rose',
      },
      avatar: {
        text: getInitials(sName),
        color: '#8B5CF6',
      },
      metrics: [
        { label: 'Olingan ball', value: `${grade.value} ball` },
        { label: 'Maks. ball', value: `${grade.maxValue ?? 100} ball` },
        { label: 'O\'zlashtirish', value: `${tier.pct}%` },
        { label: 'Daraja', value: tier.grade },
      ],
      details: [
        { label: 'Baho ID', value: grade.id, copyable: true },
        { label: 'Talaba', value: sName },
        { label: 'Guruh', value: groupName },
        { label: 'Baho turi / Label', value: grade.label || 'Muntazam baho' },
        { label: 'O\'qituvchi izohi', value: grade.notes || 'Izoh qoldirilmagan' },
      ],
      primaryAction: {
        label: 'Bahoni tahrirlash',
        onExecute: () => openEdit(grade),
      },
    };
    openSidecar(qData);
  }, [openEdit]);

  /* ── Keyboard Navigation ──────────────────────────────────────────── */
  const {
    focusedIndex,
    isSelected,
    toggleSelection,
  } = useListKeyboardNavigation<Grade>({
    items,
    getItemId: (g) => g.id,
    rowIdPrefix: 'grade-row-',
    onSelect: (g) => handleOpenGradeSidecar(g),
    onQuickLook: (g) => handleOpenGradeSidecar(g),
    onEdit: (g) => openEdit(g),
  });

  /* ── Keyboard shortcut for 'c' ────────────────────────────────────── */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'c' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        openCreate();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openCreate]);

  return (
    <motion.main
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING.smooth}
      className="page-container space-y-6"
    >
      {toastNode}

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteMut.mutate(deleteTarget);
          setDeleteTarget(null);
        }}
        description={t('grades.confirmDelete')}
        loading={deleteMut.isPending}
      />

      {/* ── Apple Liquid Glass Hero Header ── */}
      <motion.div variants={cardVariants}>
        <div className="liquid-glass-surface rounded-3xl p-6 sm:p-8">
          <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-md sm:h-20 sm:w-20">
              <svg className="h-8 w-8 sm:h-10 sm:w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                <path d="m9 9.5 2 2 4-4" />
              </svg>
            </div>

            <div className="min-w-0 flex-1 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 px-3 py-1 text-[11px] font-bold tracking-tight text-violet-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-500 shadow-[0_0_6px_#8B5CF6]" />
                  {t('grades.title')}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-black/5 bg-neutral-100/70 px-2.5 py-1 text-[11px] font-semibold text-neutral-600 dark:border-white/10 dark:bg-white/5 dark:text-neutral-400">
                  {data?.total ?? 0} yozuv
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-500">
                  {kpiStats.passRate}% o'zlashtirish
                </span>
              </div>

              <h1 className="mt-2.5 text-3xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-4xl">
                {t('grades.title')}
              </h1>
              <p className="mt-1 text-sm font-medium text-neutral-500 dark:text-neutral-400">
                {t('dashboard.academicOverview') || 'Akademik ko\'rsatkichlar & Baholar jurnali'}
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3 text-xs font-bold text-white shadow-md transition-all hover:opacity-95 active:scale-95"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                {t('grades.add')}
                <kbd className="hidden sm:inline rounded-md bg-white/20 px-1.5 py-0.5 text-[10px] font-mono">
                  C
                </kbd>
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Apple Liquid Glass KPI Strip ── */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        <div className="liquid-glass-card p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{t('common.total') || 'Jami'}</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-neutral-900 dark:text-white tabular-nums">
            {data?.total ?? 0}
          </p>
        </div>
        <div className="liquid-glass-card p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{t('grades.averageScore') || 'O\'rtacha'}</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-violet-500 tabular-nums">
            {kpiStats.avgPct}%
          </p>
        </div>
        <div className="liquid-glass-card p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{t('grades.topScore') || 'Top ball'}</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-emerald-500 tabular-nums">
            {kpiStats.topScore}%
          </p>
        </div>
        <div className="liquid-glass-card p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{t('grades.passRate') || 'O\'tish foizi'}</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-blue-500 tabular-nums">
            {kpiStats.passRate}%
          </p>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="liquid-glass-surface flex flex-wrap gap-3 rounded-2xl p-3 border border-black/5 dark:border-white/10">
        <div className="min-w-[220px] flex-1 sm:max-w-xs">
          <GlassSelect
            value={groupFilter}
            onChange={(e) => {
              playTick();
              setGroupFilter(e.target.value);
              setPage(1);
            }}
            options={[{ value: '', label: t('grades.allGroups') }, ...groups.map((g) => ({ value: g.id, label: g.name }))]}
            placeholder={t('grades.allGroups')}
          />
        </div>
        <div className="min-w-[220px] flex-1 sm:max-w-xs">
          <GlassSelect
            value={studentFilter}
            onChange={(e) => {
              playTick();
              setStudentFilter(e.target.value);
              setPage(1);
            }}
            options={[{ value: '', label: t('grades.allStudents') }, ...students.map((s) => ({ value: s.id, label: formatStudentName(s) }))]}
            placeholder={t('grades.allStudents')}
          />
        </div>
      </div>

      {/* KEYBOARD SHORTCUTS HINTS */}
      <div className="hidden sm:flex items-center justify-end gap-2 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
        <span className="rounded-md border border-black/10 bg-black/5 px-1.5 py-0.5 font-mono text-[10px] dark:border-white/10 dark:bg-white/5">
          J / K
        </span>
        <span>Harakat</span>
        <span className="rounded-md border border-black/10 bg-black/5 px-1.5 py-0.5 font-mono text-[10px] dark:border-white/10 dark:bg-white/5">
          ↵ / E
        </span>
        <span>Sidecar</span>
        <span className="rounded-md border border-black/10 bg-black/5 px-1.5 py-0.5 font-mono text-[10px] dark:border-white/10 dark:bg-white/5">
          X
        </span>
        <span>Tanlash</span>
      </div>

      {/* ── Content View ── */}
      {isLoading ? (
        <div className="liquid-glass-card p-12 flex items-center justify-center">
          <motion.div
            className="h-8 w-8 rounded-full border-2 border-violet-500/20 border-t-violet-500"
            animate={{ rotate: 360 }}
            transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
          />
        </div>
      ) : error ? (
        <div className="liquid-glass-card p-8">
          <GlassErrorState message={getErrorMessage(error)} />
        </div>
      ) : items.length === 0 ? (
        <div className="liquid-glass-card p-12 text-center">
          <GlassEmptyState
            title={t('grades.empty')}
            description={t('grades.emptyMessage')}
            action={{ label: t('grades.add'), onClick: openCreate }}
          />
        </div>
      ) : (
        <div className="liquid-glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-black/5 dark:border-white/10 text-xs font-bold text-neutral-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 pl-6 pr-4">{t('grades.col.student')}</th>
                  <th className="px-4 py-3.5">{t('grades.col.group')}</th>
                  <th className="px-4 py-3.5 text-right">{t('grades.col.score')}</th>
                  <th className="px-4 py-3.5 text-center">{t('grades.gradeTier') || 'Daraja / %'}</th>
                  <th className="px-4 py-3.5">{t('grades.col.label')}</th>
                  <th className="px-4 py-3.5">{t('grades.col.notes')}</th>
                  <th className="py-3.5 pl-4 pr-6 text-right w-36">{t('common.actions')}</th>
                </tr>
              </thead>
              <motion.tbody
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="divide-y divide-black/5 dark:divide-white/5"
              >
                {items.map((g, idx) => {
                  const sName = formatStudentName((g as Grade & { student?: { user?: { firstName?: string; lastName?: string } } }).student);
                  const groupName = (g as Grade & { group?: { name?: string } }).group?.name ?? '—';
                  const tier = getScoreTier(g.value, g.maxValue ?? 100);
                  const isFocused = focusedIndex === idx;
                  const isSel = isSelected(g.id);

                  return (
                    <motion.tr
                      key={g.id}
                      variants={rowVariants}
                      onClick={() => {
                        playPop();
                        handleOpenGradeSidecar(g);
                      }}
                      className={`group cursor-pointer transition-colors ${
                        isSel
                          ? 'bg-blue-500/10'
                          : isFocused
                          ? 'bg-black/[0.04] dark:bg-white/[0.04]'
                          : 'hover:bg-black/[0.02] dark:hover:bg-white/[0.02]'
                      }`}
                    >
                      <td className="py-4 pl-6 pr-4">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSel}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => {
                              playTick();
                              toggleSelection(g.id);
                            }}
                            className="h-4 w-4 rounded-md accent-blue-600 cursor-pointer"
                            aria-label={`Select grade for ${sName}`}
                          />
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${pickGradient(sName)} text-xs font-bold text-white shadow-xs`}>
                            {getInitials(sName)}
                          </div>
                          <div>
                            <p className="font-semibold text-neutral-900 dark:text-neutral-100 leading-snug">
                              {sName}
                            </p>
                            <p className="text-[11px] font-mono text-neutral-400">ID: {g.studentId.slice(0, 8)}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4 font-medium text-neutral-700 dark:text-neutral-300">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-100/80 px-2.5 py-1 text-xs font-semibold text-neutral-700 dark:bg-white/5 dark:text-neutral-300">
                          {groupName}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-right">
                        <span className="text-base font-bold tabular-nums text-neutral-900 dark:text-white">
                          {g.value}
                        </span>
                        <span className="text-xs text-neutral-400 ml-1">/ {g.maxValue ?? 100}</span>
                      </td>

                      <td className="px-4 py-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold ${tier.badgeClass}`}>
                          <span>{tier.grade}</span>
                          <span className="font-normal opacity-75">({tier.pct}%)</span>
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        {g.label ? (
                          <span className="inline-flex items-center rounded-md bg-purple-500/10 px-2 py-0.5 text-xs font-medium text-purple-700 dark:text-purple-300 border border-purple-500/20">
                            {g.label}
                          </span>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>

                      <td className="px-4 py-4 max-w-48 truncate text-neutral-500 dark:text-neutral-400 text-xs font-medium">
                        {g.notes ?? '—'}
                      </td>

                      <td className="py-4 pl-4 pr-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              playPop();
                              handleOpenGradeSidecar(g);
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-black/5 bg-white/70 text-xs font-bold text-neutral-600 transition-all hover:bg-white hover:text-black dark:border-white/10 dark:bg-white/5 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-white"
                            title="Split-View Sidecar (Enter / e)"
                          >
                            ◨
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(g);
                            }}
                            className="rounded-lg px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10"
                          >
                            {t('common.edit')}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              playTick();
                              setDeleteTarget(g.id);
                            }}
                            className="rounded-lg px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                          >
                            {t('common.delete')}
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </motion.tbody>
            </table>
          </div>

          {data && data.totalPages > 1 && (
            <div className="border-t border-black/5 dark:border-white/10 p-4">
              <div className="flex justify-center gap-1.5">
                {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      playTick();
                      setPage(p);
                    }}
                    className={`h-9 w-9 rounded-xl text-xs font-bold transition-all ${
                      p === page
                        ? 'bg-violet-600 text-white shadow-md'
                        : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-white/5'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Create / Edit Squircle Glass Modal ── */}
      <GlassModal
        open={modalOpen}
        onClose={closeModal}
        title={editGrade ? t('grades.editTitle') : t('grades.newTitle')}
        footer={
          <>
            <GlassButton variant="secondary" size="sm" onClick={closeModal}>
              {t('common.cancel')}
            </GlassButton>
            <GlassButton
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              disabled={createMut.isPending || updateMut.isPending}
            >
              {editGrade ? t('common.save') : t('common.create')}
            </GlassButton>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              {t('grades.col.student')}
            </label>
            <GlassSelect
              value={form.studentId}
              onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))}
              options={[{ value: '', label: t('grades.studentPlaceholder') }, ...students.map((s) => ({ value: s.id, label: formatStudentName(s) }))]}
              placeholder={t('grades.studentPlaceholder')}
              error={formErrors.studentId}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              {t('grades.col.group')}
            </label>
            <GlassSelect
              value={form.groupId}
              onChange={(e) => setForm((f) => ({ ...f, groupId: e.target.value }))}
              options={[{ value: '', label: t('grades.groupPlaceholder') }, ...groups.map((g) => ({ value: g.id, label: g.name }))]}
              placeholder={t('grades.groupPlaceholder')}
              error={formErrors.groupId}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <GlassInput
              label={t('grades.col.score')}
              type="number"
              min={0}
              value={form.value}
              onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
              placeholder={t('grades.scorePlaceholder')}
              error={formErrors.value}
            />
            <GlassInput
              label={t('grades.maxScore')}
              type="number"
              min={1}
              value={form.maxValue}
              onChange={(e) => setForm((f) => ({ ...f, maxValue: e.target.value }))}
              placeholder="100"
              error={formErrors.maxValue}
            />
          </div>
          <GlassInput
            label={t('grades.col.label')}
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            placeholder={t('grades.labelSamplePlaceholder')}
            error={formErrors.label}
          />
          <GlassInput
            label={t('grades.col.notes')}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder={t('grades.optionalNotesPlaceholder')}
            error={formErrors.notes}
          />
        </div>
      </GlassModal>
    </motion.main>
  );
}

export default GradesPage;
