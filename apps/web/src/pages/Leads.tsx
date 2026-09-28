import { useMemo, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsApi } from '@/lib/api';
import { GlassPageHeader, GlassPageLoader, GlassErrorState, GlassEmptyState, GlassPagination, GlassInput, GlassSelect, GlassField, GlassModal, ConfirmDialog, GlassButton, useToasts } from '@/components/ui';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, Lead, LeadStage } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';
import { queryKeys } from '@/lib/query-keys.factory';

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
  return [lead.firstName, lead.lastName].filter(Boolean).join(' ');
}

export function LeadsPage() {
  const { t } = useI18n();
  usePageTitle(t('leads.title'));
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();

  // Filter state
  const [page, setPage] = useState(1);
  const [stage, setStage] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [convertTarget, setConvertTarget] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState<LeadFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof LeadFormState, string>>
  >({});

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
      return editingId
        ? leadsApi.update(editingId, payload)
        : leadsApi.create(payload);
    },
    onSuccess: () => {
      push('success', editingId ? t('leads.updated') : t('leads.created'));
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
      push('success', t('leads.deleted'));
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
    },
  });

  // Update stage mutation
  const updateStage = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: LeadStage }) =>
      leadsApi.updateStage(id, stage),
    onSuccess: () => {
      push('success', t('leads.stageUpdated'));
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
      push('success', t('leads.converted'));
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: queryKeys.students.all() });
      qc.invalidateQueries({ queryKey: queryKeys.students.selectors() });
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
    },
  });

  // Form validation
  const validateForm = useCallback((): boolean => {
    const errors: Partial<Record<keyof LeadFormState, string>> = {};

    if (!form.firstName.trim()) {
      errors.firstName = t('leads.form.firstNameRequired');
    }
    if (
      form.email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
    ) {
      errors.email = t('leads.form.emailInvalid');
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form, t]);

  // Form handlers
  const handleFormChange = useCallback(
    (field: keyof LeadFormState) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
        setFormErrors((prev) => ({ ...prev, [field]: undefined }));
      },
    [],
  );

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value);
      setPage(1);
    },
    [],
  );

  const handleStageFilterChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setStage(e.target.value);
      setPage(1);
    },
    [],
  );

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

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!validateForm()) {
        return;
      }
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

  const { refetch: refetchLeads } = leads;
  const handleRetry = useCallback(() => {
    void refetchLeads();
  }, [refetchLeads]);

  const hasActiveFilters = Boolean(stage || search);
  const totalLeads = data?.total || 0;

  // Early return for loading state
  if (leads.isLoading && !data) {
    return (
      <div style={{ display: "contents" }}>
        <div className="page-container space-y-4">
          <GlassPageHeader
            title={t('leads.title')}
            subtitle={t('leads.pageSubtitle')}
          />
          <div className="glass-card p-8">
            <GlassPageLoader label={t('leads.loading')} />
          </div>
        </div>
      </div>
    );
  }

  // Early return for error state
  if (leads.isError) {
    return (
      <div style={{ display: "contents" }}>
        <div className="page-container space-y-4">
          <GlassPageHeader
            title={t('leads.title')}
            subtitle={t('leads.pageSubtitle')}
          />
          <div className="glass-card p-8">
            <GlassErrorState
              title={t('leads.loadFailed')}
              message={getErrorMessage(leads.error as Error)}
              onRetry={handleRetry}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "contents" }}>
      <div className="page-container space-y-4">
        <GlassPageHeader
          title={t('leads.title')}
          subtitle={t('leads.pageSubtitle')}
          actions={
            <GlassButton
              type="button"
              variant="primary"
              onClick={handleOpenModal}
            >
              {t('leads.add')}
            </GlassButton>
          }
        />

        {/* Filters */}
        <div className="glass-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:flex-1">
            <GlassInput
              placeholder={t('leads.searchPlaceholder')}
              value={search}
              onChange={handleSearchChange}
              aria-label={t('leads.searchPlaceholder')}
              type="search"
            />
            <GlassSelect
              value={stage}
              onChange={handleStageFilterChange}
              aria-label={t('leads.filterHint')}
            >
              <option value="">{t('leads.allStages')}</option>
              {LEAD_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {t(stageKey(stage))}
                </option>
              ))}
            </GlassSelect>
          </div>
          <div className="text-sm sm:ml-4 sm:shrink-0" style={{ color: 'var(--text-muted)' }}>
            {totalLeads === 1
              ? t('leads.countOne')
              : t('leads.countOther', { count: totalLeads })}
          </div>
        </div>
      </div>

      {/* Leads table */}
      <div className="glass-card">
        {leadList.length === 0 ? (
          <GlassEmptyState
            title={hasActiveFilters ? t('leads.noMatching') : t('leads.noLeads')}
            message={
              hasActiveFilters
                ? t('common.adjustFilters')
                : t('leads.addHint')
            }
          />
        ) : (
          <>
            <div className="glass-table-wrap">
              <table className="glass-table">
                <thead>
                  <tr>
                    <th>{t('leads.col.name')}</th>
                    <th>{t('leads.col.contact')}</th>
                    <th>{t('leads.col.source')}</th>
                    <th>{t('leads.col.stage')}</th>
                    <th>{t('leads.col.created')}</th>
                    <th style={{ textAlign: 'right' }}>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {leadList.map((lead) => {
                    const isUpdatingStage =
                      updateStage.isPending &&
                      updateStage.variables?.id === lead.id;
                    const isConverting =
                      convert.isPending && convert.variables === lead.id;

                    return (
                      <tr key={lead.id}>
                        <td className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          {formatLeadName(lead)}
                        </td>
                        <td>
                          <div className="space-y-0.5">
                            {lead.phone && (
                              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                {lead.phone}
                              </div>
                            )}
                            {lead.email && (
                              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                {lead.email}
                              </div>
                            )}
                            {!lead.phone && !lead.email && (
                              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>—</div>
                            )}
                          </div>
                        </td>
                        <td>{lead.source || '—'}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <GlassSelect
                              className="w-36 !py-1 text-xs"
                              value={lead.stage}
                              onChange={(e) =>
                                handleUpdateStage(
                                  lead.id,
                                  e.target.value as LeadStage,
                                )
                              }
                              aria-label={t('leads.updateStageAria', { name: formatLeadName(lead) })}
                              disabled={isUpdatingStage}
                            >
                              {LEAD_STAGES.map((stage) => (
                                <option key={stage} value={stage}>
                                  {t(stageKey(stage))}
                                </option>
                              ))}
                            </GlassSelect>
                            {isUpdatingStage && (
                              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                {t('common.saving')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="whitespace-nowrap">
                          {formatDate(lead.createdAt)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="flex items-center justify-end gap-2">
                            <GlassButton
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(lead)}
                            >
                              {t('common.edit')}
                            </GlassButton>
                            <GlassButton
                              type="button"
                              variant="danger"
                              size="sm"
                              onClick={() => handleDelete(lead.id)}
                              disabled={remove.isPending && remove.variables === lead.id}
                            >
                              {t('common.delete')}
                            </GlassButton>
                            {lead.stage !== 'WON' && lead.stage !== 'LOST' && (
                              <GlassButton
                                type="button"
                                variant="primary"
                                size="sm"
                                onClick={() => handleConvert(lead.id)}
                                disabled={isConverting}
                              >
                                {isConverting ? t('leads.converting') : t('leads.convert')}
                              </GlassButton>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t px-4 py-3" style={{ borderColor: 'var(--border-subtle)' }}>
              <GlassPagination
                page={page}
                totalPages={data?.totalPages ?? 1}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </div>

      {/* Add lead modal */}
      <GlassModal
        open={modalOpen}
        onClose={handleCloseModal}
        title={editingId ? t('leads.editTitle') : t('leads.add')}
        wide
      >
        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <GlassField label={t('leads.form.firstName')} required error={formErrors.firstName}>
              <GlassInput
                value={form.firstName}
                onChange={handleFormChange('firstName')}
                required
                aria-invalid={Boolean(formErrors.firstName)}
                aria-describedby={
                  formErrors.firstName ? 'firstname-error' : undefined
                }
                placeholder="John"
              />
              {formErrors.firstName && (
                <span
                  id="firstname-error"
                  className="mt-1 text-sm text-red-600"
                >
                  {formErrors.firstName}
                </span>
              )}
            </GlassField>

            <GlassField label={t('leads.form.lastName')}>
              <GlassInput
                value={form.lastName}
                onChange={handleFormChange('lastName')}
                placeholder="Doe"
              />
            </GlassField>

            <GlassField label={t('common.phone')}>
              <GlassInput
                type="tel"
                value={form.phone}
                onChange={handleFormChange('phone')}
                placeholder="+998 90 123 4567"
              />
            </GlassField>

            <GlassField label={t('common.email')} error={formErrors.email}>
              <GlassInput
                type="email"
                value={form.email}
                onChange={handleFormChange('email')}
                aria-invalid={Boolean(formErrors.email)}
                aria-describedby={
                  formErrors.email ? 'email-error' : undefined
                }
                placeholder="john@example.com"
              />
              {formErrors.email && (
                <span id="email-error" className="mt-1 text-sm text-red-600">
                  {formErrors.email}
                </span>
              )}
            </GlassField>

            <GlassField label={t('leads.col.source')}>
              <GlassInput
                value={form.source}
                onChange={handleFormChange('source')}
                placeholder={t('leads.form.sourcePlaceholder')}
              />
            </GlassField>

            <GlassField label={t('leads.col.stage')}>
              <GlassSelect
                value={form.stage}
                onChange={handleFormChange('stage')}
                aria-label={t('leads.col.stage')}
              >
                {LEAD_STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    {t(stageKey(stage))}
                  </option>
                ))}
              </GlassSelect>
            </GlassField>
          </div>

          <GlassField label={t('common.notes')}>
            <GlassInput
              value={form.notes}
              onChange={handleFormChange('notes')}
              placeholder={t('leads.form.notesPlaceholder')}
            />
          </GlassField>

          <div className="flex justify-end gap-2">
            <GlassButton
              type="button"
              variant="secondary"
              onClick={handleCloseModal}
              disabled={create.isPending}
            >
              {t('common.cancel')}
            </GlassButton>
            <GlassButton
              type="submit"
              variant="primary"
              disabled={create.isPending}
            >
              {create.isPending
                ? t('common.saving')
                : editingId
                  ? t('common.save')
                  : t('leads.add')}
            </GlassButton>
          </div>
        </form>
      </GlassModal>

      <ConfirmDialog
        open={convertTarget !== null}
        onClose={() => setConvertTarget(null)}
        onConfirm={confirmConvert}
        description={t('leads.convertConfirm')}
        confirmLabel={t('leads.convert')}
        tone="primary"
        loading={convert.isPending}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        description={t('leads.deleteConfirm')}
        loading={remove.isPending}
      />

      {toastNode}
      </div>
    </div>
  );
}