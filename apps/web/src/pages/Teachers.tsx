import { useMemo, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teachersApi } from '@/lib/api';
import {
  GlassPageHeader,
  GlassCard,
  GlassBadge,
  GlassPageLoader,
  GlassErrorState,
  GlassEmptyState,
  GlassTable,
  GlassTHead,
  GlassTBody,
  GlassTR,
  GlassTH,
  GlassTD,
  GlassPagination,
  GlassInput,
  GlassModal,
  GlassField,
  GlassTextArea,
  useToasts,
  GlassButton,
  ConfirmDialog,
} from '@/components/ui';
import { useDebounce } from '@/hooks/useDebounce';
import { fullName, formatCurrency } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, Teacher } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';

interface TeacherFilters {
  page: number;
  limit: number;
  search?: string;
}

interface TeacherFormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  specializations: string;
  hourlyRate: string;
  bio: string;
  experience: string;
}

const INITIAL_FORM: TeacherFormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  specializations: '',
  hourlyRate: '',
  bio: '',
  experience: '',
};

function formatTeacherName(teacher: Teacher): string {
  return fullName(teacher.user?.firstName, teacher.user?.lastName);
}

function getTeacherStatusBadge(isActive: boolean | undefined): { variant: 'success' | 'error'; label: string } {
  return isActive === false
    ? { variant: 'error', label: 'enum.status.INACTIVE' }
    : { variant: 'success', label: 'enum.status.ACTIVE' };
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function TeachersPage() {
  const { t } = useI18n();
  usePageTitle(t('teachers.title'));
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();

  // Filter state
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState<TeacherFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof TeacherFormState, string>>
  >({});

  // Build query params
  const params = useMemo<TeacherFilters>(
    () => ({
      page,
      limit: 20,
      search: debouncedSearch || undefined,
    }),
    [page, debouncedSearch],
  );

  // Data fetching
  const teachers = useQuery({
    queryKey: ['teachers', params],
    queryFn: () => teachersApi.list(params),
    placeholderData: (previousData) => previousData,
  });

  const data = teachers.data as Paginated<Teacher> | undefined;
  const teacherList = useMemo(() => data?.items || [], [data]);

  // Create or update teacher mutation
  const create = useMutation({
    mutationFn: () => {
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        specializations: form.specializations
          ? form.specializations
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        hourlyRate: form.hourlyRate ? parseFloat(form.hourlyRate) : undefined,
        bio: form.bio.trim() || undefined,
        experience: form.experience ? parseInt(form.experience, 10) : undefined,
      };
      return editingId
        ? teachersApi.update(editingId, payload)
        : teachersApi.create(payload);
    },
    onSuccess: () => {
      push('success', editingId ? t('teachers.updated') : t('teachers.created'));
      setModalOpen(false);
      setEditingId(null);
      setForm(INITIAL_FORM);
      setFormErrors({});
      qc.invalidateQueries({ queryKey: ['teachers'] });
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
    },
  });

  // Delete teacher mutation
  const remove = useMutation({
    mutationFn: (id: string) => teachersApi.remove(id),
    onSuccess: () => {
      push('success', t('teachers.deleted'));
      qc.invalidateQueries({ queryKey: ['teachers'] });
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
    },
  });

  // Form validation
  const validateForm = useCallback((): boolean => {
    const errors: Partial<Record<keyof TeacherFormState, string>> = {};

    if (!form.firstName.trim()) {
      errors.firstName = t('teachers.form.firstNameRequired');
    }
    if (!form.lastName.trim()) {
      errors.lastName = t('teachers.form.lastNameRequired');
    }
    if (form.email && !validateEmail(form.email)) {
      errors.email = t('common.emailInvalid');
    }
    if (form.hourlyRate && parseFloat(form.hourlyRate) < 0) {
      errors.hourlyRate = t('teachers.form.hourlyRateNumber');
    }
    if (form.experience && parseInt(form.experience, 10) < 0) {
      errors.experience = t('teachers.form.experienceNumber');
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form, t]);

  // Form handlers
  const handleFormChange = useCallback(
    (field: keyof TeacherFormState) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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

  const handleEdit = useCallback((teacher: Teacher) => {
    setEditingId(teacher.id);
    setForm({
      firstName: teacher.user?.firstName || '',
      lastName: teacher.user?.lastName || '',
      email: teacher.user?.email || '',
      phone: teacher.user?.phone || '',
      specializations: (teacher.specializations || []).join(', '),
      hourlyRate: teacher.hourlyRate != null ? String(teacher.hourlyRate) : '',
      bio: teacher.bio || '',
      experience: teacher.experience != null ? String(teacher.experience) : '',
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

  const { refetch: refetchTeachers } = teachers;
  const handleRetry = useCallback(() => {
    void refetchTeachers();
  }, [refetchTeachers]);

  const hasActiveFilter = Boolean(search);
  const totalTeachers = data?.total || 0;

  // Early return for loading state
  if (teachers.isLoading && !data) {
    return (
      <div style={{ display: "contents" }}>
        <div className="page-container">
          <GlassPageHeader
            title={t('teachers.title')}
            subtitle={t('teachers.subtitle')}
          />
          <GlassCard className="p-8">
            <GlassPageLoader label={t('teachers.loading')} />
          </GlassCard>
        </div>
      </div>
    );
  }

  // Early return for error state
  if (teachers.isError) {
    return (
      <div style={{ display: "contents" }}>
        <div className="page-container">
          <GlassPageHeader
            title={t('teachers.title')}
            subtitle={t('teachers.subtitle')}
          />
          <GlassCard className="p-8">
            <GlassErrorState
              title={t('teachers.loadError')}
              message={getErrorMessage(teachers.error as Error)}
              onRetry={handleRetry}
            />
          </GlassCard>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "contents" }}>
      <div className="page-container">
        <GlassPageHeader
          title={t('teachers.title')}
          subtitle={t('teachers.subtitle')}
          actions={
            <GlassButton
              type="button"
              variant="primary"
              onClick={handleOpenModal}
            >
              {t('teachers.add')}
            </GlassButton>
          }
        />

        {/* Filters */}
        <GlassCard className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="sm:flex-1">
              <GlassInput
                placeholder={t('teachers.searchPlaceholder')}
                value={search}
                onChange={handleSearchChange}
                aria-label={t('teachers.searchLabel')}
                type="search"
              />
            </div>
            <div className="text-sm sm:ml-4 sm:shrink-0" style={{ color: 'var(--text-secondary)' }}>
              {totalTeachers === 1
                ? t('teachers.countOne')
                : t('teachers.countOther', { count: totalTeachers })}
            </div>
          </div>
        </GlassCard>

        {/* Teachers table */}
        <GlassCard className="overflow-hidden">
          {teacherList.length === 0 ? (
            <GlassEmptyState
              title={
                hasActiveFilter
                  ? t('teachers.emptyFiltered')
                  : t('teachers.empty')
              }
              message={
                hasActiveFilter
                  ? t('teachers.emptyFilteredHint')
                  : t('teachers.emptyHint')
              }
            />
          ) : (
            <>
              <div className="glass-table-wrap">
                <GlassTable>
                  <GlassTHead>
                    <GlassTR>
                      <GlassTH>{t('common.name')}</GlassTH>
                      <GlassTH>{t('common.email')}</GlassTH>
                      <GlassTH>{t('teachers.col.specializations')}</GlassTH>
                      <GlassTH>{t('teachers.col.hourlyRate')}</GlassTH>
                      <GlassTH>{t('teachers.col.status')}</GlassTH>
                      <GlassTH>{t('common.actions')}</GlassTH>
                    </GlassTR>
                  </GlassTHead>
                  <GlassTBody>
                    {teacherList.map((teacher) => {
                      const statusBadge = getTeacherStatusBadge(
                        teacher.user?.isActive,
                      );
                      const specializations = teacher.specializations || [];

                      return (
                        <GlassTR
                          key={teacher.id}
                          className="transition-colors"
                        >
                          <GlassTD className="font-medium" style={{ color: 'var(--text-primary)' }}>
                            {formatTeacherName(teacher)}
                          </GlassTD>
                          <GlassTD>{teacher.user?.email || '—'}</GlassTD>
                          <GlassTD>
                            <div className="flex flex-wrap gap-1">
                              {specializations.slice(0, 3).map((specialization) => (
                                <GlassBadge key={specialization} variant="primary">
                                  {specialization}
                                </GlassBadge>
                              ))}
                              {specializations.length === 0 && (
                                <span style={{ color: 'var(--text-muted)' }}>—</span>
                              )}
                              {specializations.length > 3 && (
                                <GlassBadge variant="muted">
                                  +{specializations.length - 3}
                                </GlassBadge>
                              )}
                            </div>
                          </GlassTD>
                          <GlassTD>
                            {teacher.hourlyRate
                              ? formatCurrency(teacher.hourlyRate)
                              : '—'}
                          </GlassTD>
                          <GlassTD>
                            <GlassBadge variant={statusBadge.variant}>
                              {t(statusBadge.label)}
                            </GlassBadge>
                          </GlassTD>
                          <GlassTD>
                            <div className="flex gap-2">
                              <GlassButton
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(teacher)}
                              >
                                {t('common.edit')}
                              </GlassButton>
                              <GlassButton
                                type="button"
                                variant="danger"
                                size="sm"
                                onClick={() => handleDelete(teacher.id)}
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
              <div className="px-4 py-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <GlassPagination
                  page={page}
                  totalPages={data?.totalPages ?? 1}
                  onPageChange={setPage}
                />
              </div>
            </>
          )}
        </GlassCard>

        {/* Add teacher modal */}
        <GlassModal
          open={modalOpen}
          onClose={handleCloseModal}
          title={editingId ? t('teachers.editTitle') : t('teachers.add')}
          wide
        >
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <GlassField
                label={t('teachers.form.firstName')}
                required
                error={formErrors.firstName}
              >
                <GlassInput
                  value={form.firstName}
                  onChange={handleFormChange('firstName')}
                  required
                  aria-invalid={Boolean(formErrors.firstName)}
                  aria-describedby={
                    formErrors.firstName ? 'firstname-error' : undefined
                  }
                  placeholder="John"
                  disabled={create.isPending}
                />
                {formErrors.firstName && (
                  <span
                    id="firstname-error"
                    className="mt-1 text-sm"
                    style={{ color: 'var(--state-error)' }}
                  >
                    {formErrors.firstName}
                  </span>
                )}
              </GlassField>

              <GlassField
                label={t('teachers.form.lastName')}
                required
                error={formErrors.lastName}
              >
                <GlassInput
                  value={form.lastName}
                  onChange={handleFormChange('lastName')}
                  required
                  aria-invalid={Boolean(formErrors.lastName)}
                  aria-describedby={
                    formErrors.lastName ? 'lastname-error' : undefined
                  }
                  placeholder="Doe"
                  disabled={create.isPending}
                />
                {formErrors.lastName && (
                  <span
                    id="lastname-error"
                    className="mt-1 text-sm"
                    style={{ color: 'var(--state-error)' }}
                  >
                    {formErrors.lastName}
                  </span>
                )}
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
                  disabled={create.isPending}
                />
                {formErrors.email && (
                  <span id="email-error" className="mt-1 text-sm" style={{ color: 'var(--state-error)' }}>
                    {formErrors.email}
                  </span>
                )}
              </GlassField>

              <GlassField label={t('teachers.form.phone')}>
                <GlassInput
                  type="tel"
                  value={form.phone}
                  onChange={handleFormChange('phone')}
                  placeholder="+998 90 123 4567"
                  disabled={create.isPending}
                />
              </GlassField>

              <GlassField
                label={t('teachers.form.specializations')}
                hint={t('teachers.form.specializationsHint')}
              >
                <GlassInput
                  value={form.specializations}
                  onChange={handleFormChange('specializations')}
                  placeholder={t('teachers.specializationsPlaceholder')}
                  disabled={create.isPending}
                />
              </GlassField>

              <GlassField
                label={t('teachers.form.hourlyRate')}
                error={formErrors.hourlyRate}
              >
                <GlassInput
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.hourlyRate}
                  onChange={handleFormChange('hourlyRate')}
                  aria-invalid={Boolean(formErrors.hourlyRate)}
                  aria-describedby={
                    formErrors.hourlyRate ? 'rate-error' : undefined
                  }
                  placeholder="25.00"
                  disabled={create.isPending}
                />
                {formErrors.hourlyRate && (
                  <span id="rate-error" className="mt-1 text-sm" style={{ color: 'var(--state-error)' }}>
                    {formErrors.hourlyRate}
                  </span>
                )}
              </GlassField>

              <GlassField
                label={t('teachers.form.experience')}
                error={formErrors.experience}
              >
                <GlassInput
                  type="number"
                  min="0"
                  value={form.experience}
                  onChange={handleFormChange('experience')}
                  aria-invalid={Boolean(formErrors.experience)}
                  aria-describedby={
                    formErrors.experience ? 'experience-error' : undefined
                  }
                  placeholder="5"
                  disabled={create.isPending}
                />
                {formErrors.experience && (
                  <span
                    id="experience-error"
                    className="mt-1 text-sm"
                    style={{ color: 'var(--state-error)' }}
                  >
                    {formErrors.experience}
                  </span>
                )}
              </GlassField>
            </div>

            <GlassField label={t('teachers.form.bio')}>
              <GlassTextArea
                rows={3}
                value={form.bio}
                onChange={handleFormChange('bio')}
                placeholder={t('teachers.bioPlaceholder')}
                disabled={create.isPending}
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
                    ? t('teachers.update')
                    : t('teachers.create')}
              </GlassButton>
            </div>
          </form>
        </GlassModal>

        <ConfirmDialog
          open={deleteTarget !== null}
          onClose={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
          description={t('teachers.deleteConfirm')}
          loading={remove.isPending}
        />

        {toastNode}
      </div>
    </div>
  );
}
