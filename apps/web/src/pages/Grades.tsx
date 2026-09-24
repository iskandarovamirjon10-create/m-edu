import { useMemo, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gradesApi, studentsApi, groupsApi } from '@/lib/api';
import {
  GlassPageHeader,
  GlassCard,
  GlassPageLoader,
  GlassErrorState,
  GlassEmptyState,
  GlassTable,
  GlassTHead,
  GlassTBody,
  GlassTR,
  GlassTH,
  GlassTD,
  GlassModal,
  GlassSelect,
  GlassInput,
  GlassButton,
  ConfirmDialog,
  useToast,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, Grade, Student, Group } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';

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

function formatStudentName(s?: { user?: { firstName?: string; lastName?: string } } | null): string {
  if (!s?.user) return '—';
  return [s.user.firstName, s.user.lastName].filter(Boolean).join(' ') || '—';
}

function percent(value: number, max: number): string {
  if (!max) return '—';
  return `${Math.round((value / max) * 100)}%`;
}

export function GradesPage() {
  const { t } = useI18n();
  usePageTitle(t('grades.title'));
  const { push, toastNode } = useToast();
  const qc = useQueryClient();

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
    queryKey: ['students-select'],
    queryFn: () => studentsApi.list({ limit: 200 }),
  });

  const groupsQ = useQuery({
    queryKey: ['groups-select'],
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
    },
    onError: (e: unknown) => push('error', getErrorMessage(e)),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => gradesApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grades'] });
      push('success', t('grades.deleted'));
    },
    onError: (e: unknown) => push('error', getErrorMessage(e)),
  });

  const openCreate = useCallback(() => {
    setEditGrade(null);
    setForm(INITIAL_FORM);
    setFormErrors({});
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((g: Grade) => {
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
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditGrade(null);
  }, []);

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

  return (
    <div className="page-container">

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
      <GlassPageHeader
        title={t('grades.title')}
        description={t('grades.total', { n: data?.total ?? 0 })}
        actions={
          <GlassButton variant="primary" size="sm" onClick={openCreate}>
            {t('grades.add')}
          </GlassButton>
        }
      />

      <div className="flex flex-wrap gap-3">
        <GlassSelect
          value={groupFilter}
          onChange={(e) => { setGroupFilter(e.target.value); setPage(1); }}
          options={[{ value: '', label: t('grades.allGroups') }, ...groups.map((g) => ({ value: g.id, label: g.name }))]}
          placeholder={t('grades.allGroups')}
        />
        <GlassSelect
          value={studentFilter}
          onChange={(e) => { setStudentFilter(e.target.value); setPage(1); }}
          options={[{ value: '', label: t('grades.allStudents') }, ...students.map((s) => ({ value: s.id, label: formatStudentName(s) }))]}
          placeholder={t('grades.allStudents')}
        />
      </div>

      {isLoading ? (
        <GlassCard>
          <GlassPageLoader label={t('grades.loading')} />
        </GlassCard>
      ) : error ? (
        <GlassErrorState message={getErrorMessage(error)} />
      ) : items.length === 0 ? (
        <GlassEmptyState
          title={t('grades.empty')}
          description={t('grades.emptyMessage')}
          action={{ label: t('grades.add'), onClick: openCreate }}
        />
      ) : (
        <GlassCard padding="none">
          <GlassTable className="overflow-x-auto">
            <GlassTHead>
              <GlassTR>
                <GlassTH>{t('grades.col.student')}</GlassTH>
                <GlassTH>{t('grades.col.group')}</GlassTH>
                <GlassTH className="text-right">{t('grades.col.score')}</GlassTH>
                <GlassTH className="text-right">%</GlassTH>
                <GlassTH>{t('grades.col.label')}</GlassTH>
                <GlassTH>{t('grades.col.notes')}</GlassTH>
                <GlassTH className="w-20" />
              </GlassTR>
            </GlassTHead>
            <GlassTBody>
              {items.map((g) => (
                <GlassTR key={g.id}>
                  <GlassTD>{formatStudentName((g as Grade & { student?: { user?: { firstName?: string; lastName?: string } } }).student)}</GlassTD>
                  <GlassTD>{(g as Grade & { group?: { name?: string } }).group?.name ?? '—'}</GlassTD>
                  <GlassTD className="text-right font-medium">{g.value}</GlassTD>
                  <GlassTD className="text-right text-[var(--text-muted)]">{percent(g.value, g.maxValue ?? 100)}</GlassTD>
                  <GlassTD>{g.label ?? '—'}</GlassTD>
                  <GlassTD className="max-w-48 truncate text-[var(--text-muted)]">{g.notes ?? '—'}</GlassTD>
                  <GlassTD>
                    <div className="flex gap-2 justify-end">
                      <GlassButton variant="ghost" size="sm" onClick={() => openEdit(g)}>
                        {t('common.edit')}
                      </GlassButton>
                      <GlassButton
                        variant="danger"
                        size="sm"
                        onClick={() => setDeleteTarget(g.id)}
                      >
                        {t('common.delete')}
                      </GlassButton>
                    </div>
                  </GlassTD>
                </GlassTR>
              ))}
            </GlassTBody>
          </GlassTable>
          {data && data.totalPages > 1 && (
            <div className="border-t border-[var(--border-subtle)] p-4">
              <div className="flex justify-center">
                <div className="flex gap-1">
                  {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((p) => (
                    <GlassButton
                      key={p}
                      variant={p === page ? 'primary' : 'ghost'}
                      size="sm"
                      className="w-9 h-9 text-sm font-medium rounded-xl transition-all duration-200"
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </GlassButton>
                  ))}
                </div>
              </div>
            </div>
          )}
        </GlassCard>
      )}

      <GlassModal
        open={modalOpen}
        onClose={closeModal}
        title={editGrade ? t('grades.editTitle') : t('grades.newTitle')}
        footer={
          <>
            <GlassButton variant="secondary" size="sm" onClick={closeModal}>{t('common.cancel')}</GlassButton>
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
            <label className="text-sm font-medium text-[var(--text-secondary)]">{t('grades.col.student')}</label>
            <GlassSelect
              value={form.studentId}
              onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))}
              options={[{ value: '', label: t('grades.studentPlaceholder') }, ...students.map((s) => ({ value: s.id, label: formatStudentName(s) }))]}
              placeholder={t('grades.studentPlaceholder')}
              error={formErrors.studentId}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--text-secondary)]">{t('grades.col.group')}</label>
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
    </div>
  );
}
