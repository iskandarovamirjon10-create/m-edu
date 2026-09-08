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
} from '@/components/ui';
import { useDebounce } from '@/hooks/useDebounce';
import { fullName, formatCurrency } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, Teacher } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';

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
    ? { variant: 'error', label: 'Inactive' }
    : { variant: 'success', label: 'Active' };
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function TeachersPage() {
  usePageTitle('Teachers');
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();

  // Filter state
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);

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

  // Create teacher mutation
  const create = useMutation({
    mutationFn: () =>
      teachersApi.create({
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
      }),
    onSuccess: () => {
      push('success', 'Teacher created successfully');
      setModalOpen(false);
      setForm(INITIAL_FORM);
      setFormErrors({});
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
      errors.firstName = 'First name is required';
    }
    if (!form.lastName.trim()) {
      errors.lastName = 'Last name is required';
    }
    if (form.email && !validateEmail(form.email)) {
      errors.email = 'Please enter a valid email address';
    }
    if (form.hourlyRate && parseFloat(form.hourlyRate) < 0) {
      errors.hourlyRate = 'Hourly rate must be a positive number';
    }
    if (form.experience && parseInt(form.experience, 10) < 0) {
      errors.experience = 'Experience must be a positive number';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form]);

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
    setForm(INITIAL_FORM);
    setFormErrors({});
  }, []);

  const handleOpenModal = useCallback(() => {
    setForm(INITIAL_FORM);
    setFormErrors({});
    setModalOpen(true);
  }, []);

  const { refetch: refetchTeachers } = teachers;
  const handleRetry = useCallback(() => {
    void refetchTeachers();
  }, [refetchTeachers]);

  const hasActiveFilter = Boolean(search);
  const totalTeachers = data?.total || 0;

  // Early return for loading state
  if (teachers.isLoading && !data) {
    return (
      <div className="orb-container">
        <div className="orb orb-cyan-1" />
        <div className="orb orb-cyan-2" />
        <div className="orb orb-indigo-1" />
        <div className="orb orb-deep-1" />
        <div className="page-container">
          <GlassPageHeader title="Teachers" subtitle="Manage teaching staff" />
          <GlassCard className="p-8">
            <GlassPageLoader label="Loading teachers…" />
          </GlassCard>
        </div>
      </div>
    );
  }

  // Early return for error state
  if (teachers.isError) {
    return (
      <div className="orb-container">
        <div className="orb orb-cyan-1" />
        <div className="orb orb-cyan-2" />
        <div className="orb orb-indigo-1" />
        <div className="orb orb-deep-1" />
        <div className="page-container">
          <GlassPageHeader title="Teachers" subtitle="Manage teaching staff" />
          <GlassCard className="p-8">
            <GlassErrorState
              title="Failed to load teachers"
              message={getErrorMessage(teachers.error as Error)}
              onRetry={handleRetry}
            />
          </GlassCard>
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
      <div className="page-container">
        <GlassPageHeader
          title="Teachers"
          subtitle="Manage teaching staff"
          actions={
            <button
              type="button"
              className="glass-btn glass-btn-primary"
              onClick={handleOpenModal}
            >
              Add teacher
            </button>
          }
        />

        {/* Filters */}
        <GlassCard className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="sm:flex-1">
              <GlassInput
                placeholder="Search teachers…"
                value={search}
                onChange={handleSearchChange}
                aria-label="Search teachers"
                type="search"
              />
            </div>
            <div className="text-sm sm:ml-4 sm:shrink-0" style={{ color: 'var(--text-secondary)' }}>
              {totalTeachers} {totalTeachers === 1 ? 'teacher' : 'teachers'}
            </div>
          </div>
        </GlassCard>

        {/* Teachers table */}
        <GlassCard className="overflow-hidden">
          {teacherList.length === 0 ? (
            <GlassEmptyState
              title={hasActiveFilter ? 'No matching teachers' : 'No teachers yet'}
              message={
                hasActiveFilter
                  ? 'Try adjusting your search to see more results.'
                  : 'Add your first teacher to get started.'
              }
            />
          ) : (
            <>
              <div className="glass-table-wrap">
                <GlassTable>
                  <GlassTHead>
                    <GlassTR>
                      <GlassTH>Name</GlassTH>
                      <GlassTH>Email</GlassTH>
                      <GlassTH>Specializations</GlassTH>
                      <GlassTH>Hourly rate</GlassTH>
                      <GlassTH>Status</GlassTH>
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
                              {statusBadge.label}
                            </GlassBadge>
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
          title="Add teacher"
          wide
        >
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <GlassField label="First name" required error={formErrors.firstName}>
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

              <GlassField label="Last name" required error={formErrors.lastName}>
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

              <GlassField label="Email" error={formErrors.email}>
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

              <GlassField label="Phone">
                <GlassInput
                  type="tel"
                  value={form.phone}
                  onChange={handleFormChange('phone')}
                  placeholder="+998 90 123 4567"
                  disabled={create.isPending}
                />
              </GlassField>

              <GlassField
                label="Specializations"
                hint="Comma-separated, e.g. Math, Physics"
              >
                <GlassInput
                  value={form.specializations}
                  onChange={handleFormChange('specializations')}
                  placeholder="Math, Physics"
                  disabled={create.isPending}
                />
              </GlassField>

              <GlassField label="Hourly rate" error={formErrors.hourlyRate}>
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

              <GlassField label="Experience (years)" error={formErrors.experience}>
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

            <GlassField label="Bio">
              <GlassTextArea
                rows={3}
                value={form.bio}
                onChange={handleFormChange('bio')}
                placeholder="Brief description of teaching background…"
                disabled={create.isPending}
              />
            </GlassField>

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
                {create.isPending ? 'Saving…' : 'Create teacher'}
              </button>
            </div>
          </form>
        </GlassModal>

        {toastNode}
      </div>
    </div>
  );
}
