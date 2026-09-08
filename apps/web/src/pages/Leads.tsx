import { useMemo, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsApi } from '@/lib/api';
import {
  PageHeader,
  PageLoader,
  ErrorState,
  EmptyState,
  Pagination,
  TextInput,
  Select,
  Field,
  Modal,
  useToasts,
} from '@/components/ui';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, Lead, LeadStage } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';

const LEAD_STAGES: LeadStage[] = [
  'NEW',
  'CONTACTED',
  'TRIAL_LESSON',
  'WON',
  'LOST',
];

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

function formatStage(stage: string): string {
  return stage
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatLeadName(lead: Lead): string {
  return [lead.firstName, lead.lastName].filter(Boolean).join(' ');
}

export function LeadsPage() {
  usePageTitle('Leads');
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();

  // Filter state
  const [page, setPage] = useState(1);
  const [stage, setStage] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);

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

  // Create lead mutation
  const create = useMutation({
    mutationFn: () =>
      leadsApi.create({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        source: form.source.trim() || undefined,
        notes: form.notes.trim() || undefined,
      }),
    onSuccess: () => {
      push('success', 'Lead created successfully');
      setModalOpen(false);
      setForm(INITIAL_FORM);
      setFormErrors({});
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
      push('success', 'Lead stage updated');
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
      push('success', 'Lead converted to student');
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
    },
  });

  // Form validation
  const validateForm = useCallback((): boolean => {
    const errors: Partial<Record<keyof LeadFormState, string>> = {};

    if (!form.firstName.trim()) {
      errors.firstName = 'First name is required';
    }
    if (
      form.email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
    ) {
      errors.email = 'Please enter a valid email address';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form]);

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

  const handleConvert = useCallback(
    (leadId: string) => {
      if (
        window.confirm(
          'Are you sure you want to convert this lead to a student?',
        )
      ) {
        convert.mutate(leadId);
      }
    },
    [convert],
  );

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
    setForm(INITIAL_FORM);
    setFormErrors({});
  }, []);

  const handleOpenModal = useCallback(() => {
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
      <div className="orb-container">
        <div className="orb orb-cyan-1" />
        <div className="orb orb-cyan-2" />
        <div className="orb orb-indigo-1" />
        <div className="orb orb-deep-1" />
        <div className="page-container space-y-4">
          <PageHeader
            title="Leads"
            subtitle="Manage prospective students through the funnel"
          />
          <div className="glass-card p-8">
            <PageLoader label="Loading leads…" />
          </div>
        </div>
      </div>
    );
  }

  // Early return for error state
  if (leads.isError) {
    return (
      <div className="orb-container">
        <div className="orb orb-cyan-1" />
        <div className="orb orb-cyan-2" />
        <div className="orb orb-indigo-1" />
        <div className="orb orb-deep-1" />
        <div className="page-container space-y-4">
          <PageHeader
            title="Leads"
            subtitle="Manage prospective students through the funnel"
          />
          <div className="glass-card p-8">
            <ErrorState
              title="Failed to load leads"
              message={getErrorMessage(leads.error as Error)}
              onRetry={handleRetry}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="orb-container">
      <div className="orb orb-cyan-1" />
      <div className="orb orb-cyan-2" />
      <div className="orb orb-indigo-1" />
      <div className="orb orb-deep-1" />
      <div className="page-container space-y-4">
        <PageHeader
          title="Leads"
          subtitle="Manage prospective students through the funnel"
          actions={
            <button
              type="button"
              className="glass-btn glass-btn-primary"
              onClick={handleOpenModal}
            >
              Add lead
            </button>
          }
        />

        {/* Filters */}
        <div className="glass-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:flex-1">
            <TextInput
              placeholder="Search leads…"
              value={search}
              onChange={handleSearchChange}
              aria-label="Search leads"
              type="search"
            />
            <Select
              value={stage}
              onChange={handleStageFilterChange}
              aria-label="Filter by stage"
            >
              <option value="">All stages</option>
              {LEAD_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {formatStage(stage)}
                </option>
              ))}
            </Select>
          </div>
          <div className="text-sm sm:ml-4 sm:shrink-0" style={{ color: 'var(--text-muted)' }}>
            {totalLeads} {totalLeads === 1 ? 'lead' : 'leads'}
          </div>
        </div>
      </div>

      {/* Leads table */}
      <div className="glass-card">
        {leadList.length === 0 ? (
          <EmptyState
            title={hasActiveFilters ? 'No matching leads' : 'No leads'}
            message={
              hasActiveFilters
                ? 'Try adjusting your filters to see more results.'
                : 'Add a lead to start tracking.'
            }
          />
        ) : (
          <>
            <div className="glass-table-wrap">
              <table className="glass-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Contact</th>
                    <th>Source</th>
                    <th>Stage</th>
                    <th>Created</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
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
                            <Select
                              className="w-36 !py-1 text-xs"
                              value={lead.stage}
                              onChange={(e) =>
                                handleUpdateStage(
                                  lead.id,
                                  e.target.value as LeadStage,
                                )
                              }
                              aria-label={`Update stage for ${formatLeadName(lead)}`}
                              disabled={isUpdatingStage}
                            >
                              {LEAD_STAGES.map((stage) => (
                                <option key={stage} value={stage}>
                                  {formatStage(stage)}
                                </option>
                              ))}
                            </Select>
                            {isUpdatingStage && (
                              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                Saving…
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="whitespace-nowrap">
                          {formatDate(lead.createdAt)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {lead.stage !== 'WON' && lead.stage !== 'LOST' && (
                            <button
                              type="button"
                              className="glass-btn glass-btn-primary glass-btn-sm"
                              onClick={() => handleConvert(lead.id)}
                              disabled={isConverting}
                            >
                              {isConverting ? 'Converting…' : 'Convert'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t px-4 py-3" style={{ borderColor: 'var(--border-subtle)' }}>
              <Pagination
                page={page}
                totalPages={data?.totalPages ?? 1}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </div>

      {/* Add lead modal */}
      <Modal
        open={modalOpen}
        onClose={handleCloseModal}
        title="Add lead"
        wide
      >
        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="First name" required error={formErrors.firstName}>
              <TextInput
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
            </Field>

            <Field label="Last name">
              <TextInput
                value={form.lastName}
                onChange={handleFormChange('lastName')}
                placeholder="Doe"
              />
            </Field>

            <Field label="Phone">
              <TextInput
                type="tel"
                value={form.phone}
                onChange={handleFormChange('phone')}
                placeholder="+998 90 123 4567"
              />
            </Field>

            <Field label="Email" error={formErrors.email}>
              <TextInput
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
            </Field>

            <Field label="Source">
              <TextInput
                value={form.source}
                onChange={handleFormChange('source')}
                placeholder="Social media, referral…"
              />
            </Field>

            <Field label="Stage">
              <Select
                value={form.stage}
                onChange={handleFormChange('stage')}
                aria-label="Lead stage"
              >
                {LEAD_STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    {formatStage(stage)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Notes">
            <TextInput
              value={form.notes}
              onChange={handleFormChange('notes')}
              placeholder="Additional notes…"
            />
          </Field>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="glass-btn glass-btn-secondary"
              onClick={handleCloseModal}
              disabled={create.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="glass-btn glass-btn-primary"
              disabled={create.isPending}
            >
              {create.isPending ? 'Saving…' : 'Add lead'}
            </button>
          </div>
        </form>
      </Modal>

      {toastNode}
      </div>
    </div>
  );
}