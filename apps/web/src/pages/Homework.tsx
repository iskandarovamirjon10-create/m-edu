import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { homeworkApi, groupsApi } from '@/lib/api';
import { GlassPageHeader, GlassBadge, GlassPageLoader, GlassErrorState, GlassEmptyState, GlassTable, GlassTHead, GlassTBody, GlassTR, GlassTH, GlassTD, GlassField, GlassInput, GlassTextArea, GlassSelect, GlassModal, ConfirmDialog, GlassButton, useToasts } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, Homework, Group } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';

interface HomeworkFormState {
  groupId: string;
  title: string;
  description: string;
  deadline: string;
  maxScore: string;
}

const INITIAL_FORM: HomeworkFormState = {
  groupId: '',
  title: '',
  description: '',
  deadline: '',
  maxScore: '',
};

export function formatDeadline(deadline: string | null | undefined): string {
  if (!deadline) return '—';
  return formatDate(deadline);
}

export function formatMaxScore(score: number | null | undefined): string {
  return score != null ? String(score) : '—';
}

export function isDeadlinePast(deadline: string | null | undefined): boolean {
  if (!deadline) return false;
  return new Date(deadline) < new Date();
}

export function isDeadlineSoon(deadline: string | null | undefined): boolean {
  if (!deadline) return false;
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diffDays = Math.ceil(
    (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  return diffDays >= 0 && diffDays <= 3;
}

export function HomeworkPage() {
  const { t } = useI18n();
  usePageTitle(t('homework.title'));
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState<HomeworkFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof HomeworkFormState, string>>
  >({});

  // Data fetching
  const homework = useQuery({
    queryKey: ['homework'],
    queryFn: () => homeworkApi.list({ limit: 100 }),
    placeholderData: (previousData) => previousData,
  });

  const groups = useQuery({
    queryKey: ['groups-homework'],
    queryFn: () => groupsApi.list({ limit: 100 }),
    placeholderData: (previousData) => previousData,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const data = homework.data as Paginated<Homework> | undefined;
  const homeworkList = useMemo(() => data?.items || [], [data]);
  const groupList = useMemo(
    () => (groups.data as Paginated<Group> | undefined)?.items || [],
    [groups.data],
  );

  // Create or update homework mutation
  const save = useMutation({
    mutationFn: () => {
      const payload = {
        groupId: form.groupId,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        deadline: form.deadline
          ? new Date(form.deadline).toISOString()
          : undefined,
        maxScore: form.maxScore ? parseFloat(form.maxScore) : undefined,
      };
      return editingId ? homeworkApi.update(editingId, payload) : homeworkApi.create(payload);
    },
    onSuccess: () => {
      push('success', editingId ? t('homework.updateSuccess') : t('homework.createSuccess'));
      setModalOpen(false);
      setEditingId(null);
      setForm(INITIAL_FORM);
      setFormErrors({});
      qc.invalidateQueries({ queryKey: ['homework'] });
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
    },
  });

  // Delete homework mutation
  const remove = useMutation({
    mutationFn: (id: string) => homeworkApi.remove(id),
    onSuccess: () => {
      push('success', t('homework.deleteSuccess'));
      qc.invalidateQueries({ queryKey: ['homework'] });
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
    },
  });

  // Form validation
  const validateForm = useCallback((): boolean => {
    const errors: Partial<Record<keyof HomeworkFormState, string>> = {};

    if (!form.title.trim()) {
      errors.title = t('homework.titleRequired');
    }
    if (!form.groupId) {
      errors.groupId = t('common.validation.selectGroup');
    }
    if (form.maxScore && parseFloat(form.maxScore) < 0) {
      errors.maxScore = t('homework.maxScorePositive');
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form, t]);

  // Form handlers
  const handleFormChange = useCallback(
    (field: keyof HomeworkFormState) =>
      (
        e: React.ChangeEvent<
          HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
        >,
      ) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
        setFormErrors((prev) => ({ ...prev, [field]: undefined }));
      },
    [],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!validateForm()) {
        return;
      }
      save.mutate();
    },
    [validateForm, save],
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

  const handleEdit = useCallback(
    (item: Homework) => {
      setEditingId(item.id);
      setForm({
        groupId: item.groupId,
        title: item.title,
        description: item.description || '',
        deadline: item.deadline ? item.deadline.slice(0, 16) : '',
        maxScore: item.maxScore != null ? String(item.maxScore) : '',
      });
      setFormErrors({});
      setModalOpen(true);
    },
    [],
  );

  const handleDelete = useCallback((id: string) => {
    setDeleteTarget(id);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    remove.mutate(deleteTarget);
    setDeleteTarget(null);
  }, [deleteTarget, remove]);

  const { refetch: refetchHomework } = homework;
  const handleRetry = useCallback(() => {
    void refetchHomework();
  }, [refetchHomework]);

  // Early return for loading state
  if (homework.isLoading && !data) {
    return (
      <div style={{ display: "contents" }}>
        <div className="page-container space-y-4">
          <GlassPageHeader
            title={t('homework.title')}
            subtitle={t('homework.pageSubtitle')}
          />
          <div className="glass-card p-8">
            <GlassPageLoader label={t('homework.loading')} />
          </div>
        </div>
      </div>
    );
  }

  // Early return for error state
  if (homework.isError) {
    return (
      <div style={{ display: "contents" }}>
        <div className="page-container space-y-4">
          <GlassPageHeader
            title={t('homework.title')}
            subtitle={t('homework.pageSubtitle')}
          />
          <div className="glass-card p-8">
            <GlassErrorState
              title={t('homework.loadFailed')}
              message={getErrorMessage(homework.error as Error)}
              onRetry={handleRetry}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "contents" }}>
      <div className="orb orb-cyan-1"></div>
      <div className="orb orb-cyan-2"></div>
      <div className="orb orb-indigo-1"></div>
      <div className="orb orb-deep-1"></div>
    <div className="page-container space-y-4">
      <GlassPageHeader
        title={t('homework.title')}
        subtitle={t('homework.pageSubtitle')}
        actions={
          <GlassButton
            type="button"
            variant="primary"
            onClick={handleOpenModal}
          >
            {t('homework.addButton')}
          </GlassButton>
        }
      />

      {/* Homework table */}
      <div className="glass-card overflow-hidden">
        {homeworkList.length === 0 ? (
          <GlassEmptyState
            title={t('homework.empty')}
            message={t('homework.emptyMessage')}
          />
        ) : (
          <div className="glass-table-wrap">
            <GlassTable>
              <GlassTHead>
                <GlassTR>
                  <GlassTH>{t('homework.form.title')}</GlassTH>
                  <GlassTH>{t('homework.form.group')}</GlassTH>
                  <GlassTH>{t('homework.form.deadline')}</GlassTH>
                  <GlassTH>{t('homework.form.maxScore')}</GlassTH>
                  <GlassTH>{t('common.status')}</GlassTH>
                  <GlassTH>{t('common.actions')}</GlassTH>
                </GlassTR>
              </GlassTHead>
              <GlassTBody>
                {homeworkList.map((homeworkItem) => {
                  const isPast = isDeadlinePast(homeworkItem.deadline);
                  const isSoon = isDeadlineSoon(homeworkItem.deadline);

                  return (
                    <GlassTR
                      key={homeworkItem.id}
                    >
                      <GlassTD className="font-medium">
                        {homeworkItem.title}
                      </GlassTD>
                      <GlassTD>{homeworkItem.group?.name || '—'}</GlassTD>
                      <GlassTD className="whitespace-nowrap">
                        {formatDeadline(homeworkItem.deadline)}
                      </GlassTD>
                      <GlassTD>{formatMaxScore(homeworkItem.maxScore)}</GlassTD>
                      <GlassTD>
                        {isPast ? (
                          <GlassBadge color="slate">{t('homework.status.pastDue')}</GlassBadge>
                        ) : isSoon ? (
                          <GlassBadge color="amber">{t('homework.status.dueSoon')}</GlassBadge>
                        ) : (
                          <GlassBadge color="green">{t('homework.status.open')}</GlassBadge>
                        )}
                      </GlassTD>
                      <GlassTD>
                        <div className="flex gap-2">
                          <GlassButton
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(homeworkItem)}
                          >
                            {t('common.edit')}
                          </GlassButton>
                          <GlassButton
                            type="button"
                            variant="danger"
                            size="sm"
                            onClick={() => handleDelete(homeworkItem.id)}
                          >
                            {t('common.delete')}
                          </GlassButton>
                        </div>
                      </GlassTD>
                    </GlassTR>
                  );
                })}
              </GlassTBody>
            </GlassTable>
          </div>
        )}
      </div>

      {/* Add homework modal */}
      <GlassModal
        open={modalOpen}
        onClose={handleCloseModal}
        title={editingId ? t('homework.editTitle') : t('homework.addButton')}
        wide
      >
        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <GlassField label={t('homework.form.title')} required error={formErrors.title}>
              <GlassInput
                value={form.title}
                onChange={handleFormChange('title')}
                required
                aria-invalid={Boolean(formErrors.title)}
                aria-describedby={formErrors.title ? 'title-error' : undefined}
                placeholder={t('homework.titlePlaceholder')}
              />
              {formErrors.title && (
                <span id="title-error" className="mt-1 text-sm text-red-600">
                  {formErrors.title}
                </span>
              )}
            </GlassField>

            <GlassField label={t('homework.form.group')} required error={formErrors.groupId}>
              <GlassSelect
                value={form.groupId}
                onChange={handleFormChange('groupId')}
                required
                aria-invalid={Boolean(formErrors.groupId)}
                aria-describedby={
                  formErrors.groupId ? 'group-error' : undefined
                }
              >
                <option value="">{t('homework.groupPlaceholder')}</option>
                {groupList.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </GlassSelect>
              {formErrors.groupId && (
                <span id="group-error" className="mt-1 text-sm text-red-600">
                  {formErrors.groupId}
                </span>
              )}
            </GlassField>

            <GlassField label={t('homework.form.deadline')}>
              <GlassInput
                type="datetime-local"
                value={form.deadline}
                onChange={handleFormChange('deadline')}
              />
            </GlassField>

            <GlassField label={t('homework.form.maxScore')} error={formErrors.maxScore}>
              <GlassInput
                type="number"
                min="0"
                step="0.1"
                value={form.maxScore}
                onChange={handleFormChange('maxScore')}
                aria-invalid={Boolean(formErrors.maxScore)}
                aria-describedby={
                  formErrors.maxScore ? 'maxscore-error' : undefined
                }
                placeholder="100"
              />
              {formErrors.maxScore && (
                <span
                  id="maxscore-error"
                  className="mt-1 text-sm text-red-600"
                >
                  {formErrors.maxScore}
                </span>
              )}
            </GlassField>
          </div>

          <GlassField label={t('homework.form.description')}>
            <GlassTextArea
              rows={3}
              value={form.description}
              onChange={handleFormChange('description')}
              placeholder={t('homework.descriptionPlaceholder')}
            />
          </GlassField>

          <div className="flex justify-end gap-2">
            <GlassButton
              type="button"
              variant="secondary"
              onClick={handleCloseModal}
              disabled={save.isPending}
            >
              {t('common.cancel')}
            </GlassButton>
            <GlassButton
              type="submit"
              variant="primary"
              disabled={save.isPending}
            >
              {save.isPending
                ? t('common.saving')
                : editingId
                  ? t('templates.saveChanges')
                  : t('homework.createSubmit')}
            </GlassButton>
          </div>
        </form>
      </GlassModal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        description={t('homework.confirmDelete')}
        loading={remove.isPending}
      />

      {toastNode}
    </div>
    </div>
  );
}