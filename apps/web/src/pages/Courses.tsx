import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { coursesApi } from '@/lib/api';
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
  GlassField,
  GlassInput,
  GlassTextArea,
  GlassSelect,
  GlassBadge,
  GlassButton,
  useToasts,
  ConfirmDialog,
} from '@/components/ui';
import { formatCurrency } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, Course, CourseLevel } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';

const COURSE_LEVELS: CourseLevel[] = [
  'BEGINNER',
  'INTERMEDIATE',
  'ADVANCED',
  'EXPERT',
];

interface CourseFormState {
  name: string;
  description: string;
  price: string;
  duration: string;
  level: CourseLevel | '';
}

const INITIAL_FORM: CourseFormState = {
  name: '',
  description: '',
  price: '',
  duration: '',
  level: '',
};

export function formatDuration(months: number): string {
  if (months === 1) return '1 month';
  return `${months} months`;
}

export function getCourseStatusBadge(isActive: boolean): { variant: 'success' | 'muted'; label: string } {
  return isActive
    ? { variant: 'success', label: 'Active' }
    : { variant: 'muted', label: 'Inactive' };
}

export function formatCourseLevel(level: string | null | undefined): string {
  if (!level) return '—';
  return level
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function CoursesPage() {
  const { t } = useI18n();
  usePageTitle(t('courses.title'));
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState<CourseFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof CourseFormState, string>>
  >({});

  // Data fetching
  const courses = useQuery({
    queryKey: ['courses'],
    queryFn: () => coursesApi.list({ limit: 100 }),
    placeholderData: (previousData) => previousData,
  });

  const data = courses.data as Paginated<Course> | undefined;
  const courseList = useMemo(() => data?.items || [], [data]);

  // Save course mutation (create or update)
  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        price: parseFloat(form.price) || 0,
        duration: parseInt(form.duration, 10) || 1,
        level: (form.level as CourseLevel) || undefined,
      };
      return editingId
        ? coursesApi.update(editingId, payload)
        : coursesApi.create(payload);
    },
    onSuccess: () => {
      push('success', editingId ? t('courses.updated') : t('courses.createSuccess'));
      setModalOpen(false);
      setEditingId(null);
      setForm(INITIAL_FORM);
      setFormErrors({});
      qc.invalidateQueries({ queryKey: ['courses'] });
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
    },
  });

  // Delete course mutation
  const remove = useMutation({
    mutationFn: (id: string) => coursesApi.remove(id),
    onSuccess: () => {
      push('success', t('courses.deleted'));
      qc.invalidateQueries({ queryKey: ['courses'] });
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
    },
  });

  // Form validation
  const validateForm = useCallback((): boolean => {
    const errors: Partial<Record<keyof CourseFormState, string>> = {};

    if (!form.name.trim()) {
      errors.name = t('courses.validation.nameRequired');
    }
    if (!form.price || parseFloat(form.price) < 0) {
      errors.price = t('courses.validation.priceInvalid');
    }
    if (!form.duration || parseInt(form.duration, 10) < 1) {
      errors.duration = t('courses.validation.durationMin');
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form, t]);

  // Form handlers
  const handleFormChange = useCallback(
    (field: keyof CourseFormState) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
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

  const { refetch: refetchCourses } = courses;
  const handleRetry = useCallback(() => {
    void refetchCourses();
  }, [refetchCourses]);

  const handleOpenModal = useCallback(() => {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setFormErrors({});
    setModalOpen(true);
  }, []);

  const handleEdit = useCallback((course: Course) => {
    setEditingId(course.id);
    setForm({
      name: course.name,
      description: course.description || '',
      price: String(course.price),
      duration: String(course.duration),
      level: (course.level as CourseLevel) || '',
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

  // Early return for loading state
  if (courses.isLoading && !data) {
    return (
      <div style={{ display: "contents" }}>
        <div className="page-container">
          <GlassPageHeader
            title={t('courses.title')}
            subtitle={t('courses.pageSubtitle')}
          />
          <GlassCard className="p-8">
            <GlassPageLoader label={t('courses.loading')} />
          </GlassCard>
        </div>
      </div>
    );
  }

  // Early return for error state
  if (courses.isError) {
    return (
      <div style={{ display: "contents" }}>
        <div className="page-container">
          <GlassPageHeader
            title={t('courses.title')}
            subtitle={t('courses.pageSubtitle')}
          />
          <GlassCard className="p-8">
            <GlassErrorState
              title={t('courses.loadFailed')}
              message={getErrorMessage(courses.error as Error)}
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
          title={t('courses.title')}
          subtitle={t('courses.pageSubtitle')}
          actions={
            <GlassButton
              type="button"
              variant="primary"
              onClick={handleOpenModal}
            >
              {t('courses.add')}
            </GlassButton>
          }
        />

        {/* Courses table */}
        <GlassCard className="overflow-hidden">
          {courseList.length === 0 ? (
            <GlassEmptyState
              title={t('courses.empty')}
              message={t('courses.emptyMessage')}
            />
          ) : (
            <div className="glass-table-wrap">
              <GlassTable>
                <GlassTHead>
                  <GlassTR>
                    <GlassTH>{t('courses.col.name')}</GlassTH>
                    <GlassTH>{t('courses.col.level')}</GlassTH>
                    <GlassTH>{t('courses.col.duration')}</GlassTH>
                    <GlassTH>{t('courses.col.price')}</GlassTH>
                    <GlassTH>{t('common.status')}</GlassTH>
                    <GlassTH>{t('common.actions')}</GlassTH>
                  </GlassTR>
                </GlassTHead>
                <GlassTBody>
                  {courseList.map((course) => {
                    const statusBadge = getCourseStatusBadge(course.isActive);

                    return (
                      <GlassTR
                        key={course.id}
                        className="transition-colors"
                      >
                        <GlassTD className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          {course.name}
                        </GlassTD>
                        <GlassTD>
                          {course.level
                            ? (() => {
                                const key = `courses.level.${course.level}`;
                                const label = t(key);
                                return label === key ? formatCourseLevel(course.level) : label;
                              })()
                            : '—'}
                        </GlassTD>
                        <GlassTD>
                          {t(
                            course.duration === 1 ? 'courses.duration.month' : 'courses.duration.months',
                            { count: course.duration },
                          )}
                        </GlassTD>
                        <GlassTD className="font-medium">
                          {formatCurrency(course.price)}
                        </GlassTD>
                        <GlassTD>
                          <GlassBadge variant={statusBadge.variant}>
                            {course.isActive ? t('common.active') : t('common.inactive')}
                          </GlassBadge>
                        </GlassTD>
                        <GlassTD>
                          <div className="flex gap-2">
                            <GlassButton
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(course)}
                            >
                              {t('common.edit')}
                            </GlassButton>
                            <GlassButton
                              type="button"
                              variant="danger"
                              size="sm"
                              onClick={() => handleDelete(course.id)}
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
        </GlassCard>

        {/* Add course modal */}
        <GlassModal
          open={modalOpen}
          onClose={handleCloseModal}
          title={editingId ? t('courses.editTitle') : t('courses.add')}
        >
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <GlassField label={t('courses.form.name')} required error={formErrors.name}>
              <GlassInput
                value={form.name}
                onChange={handleFormChange('name')}
                required
                aria-invalid={Boolean(formErrors.name)}
                aria-describedby={formErrors.name ? 'name-error' : undefined}
                placeholder={t('courses.namePlaceholder')}
              />
              {formErrors.name && (
                <span id="name-error" className="mt-1 text-sm" style={{ color: 'var(--state-error)' }}>
                  {formErrors.name}
                </span>
              )}
            </GlassField>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <GlassField label={t('courses.form.price')} required error={formErrors.price}>
                <GlassInput
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price}
                  onChange={handleFormChange('price')}
                  required
                  aria-invalid={Boolean(formErrors.price)}
                  aria-describedby={formErrors.price ? 'price-error' : undefined}
                  placeholder="299.99"
                />                {formErrors.price && (
                  <span id="price-error" className="mt-1 text-sm" style={{ color: 'var(--state-error)' }}>
                    {formErrors.price}
                  </span>
                )}
              </GlassField>
              <GlassField
                label={t('courses.form.durationLabel')}
                required
                error={formErrors.duration}
              >
                <GlassInput
                  type="number"
                  min="1"
                  value={form.duration}
                  onChange={handleFormChange('duration')}
                  required
                  aria-invalid={Boolean(formErrors.duration)}
                  aria-describedby={
                    formErrors.duration ? 'duration-error' : undefined
                  }
                  placeholder="6"
                />
                {formErrors.duration && (
                  <span
                    id="duration-error"
                    className="mt-1 text-sm"
                    style={{ color: 'var(--state-error)' }}
                  >
                    {formErrors.duration}
                  </span>
                )}
              </GlassField>
            </div>

            <GlassField label={t('courses.col.level')}>
              <GlassSelect
                value={form.level}
                onChange={handleFormChange('level')}
                aria-label={t('courses.col.level')}
              >
                <option value="">{t('courses.levelPlaceholder')}</option>
                {COURSE_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {(() => {
                      const key = `courses.level.${level}`;
                      const label = t(key);
                      return label === key ? formatCourseLevel(level) : label;
                    })()}
                  </option>
                ))}
              </GlassSelect>
            </GlassField>

            <GlassField label={t('courses.form.description')}>
              <GlassTextArea
                rows={3}
                value={form.description}
                onChange={handleFormChange('description')}
                placeholder={t('courses.descriptionPlaceholder')}
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
                    ? t('courses.form.update')
                    : t('courses.form.create')}
              </GlassButton>
            </div>
          </form>
        </GlassModal>

        <ConfirmDialog
          open={deleteTarget !== null}
          onClose={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
          description={t('courses.deleteConfirm')}
          loading={remove.isPending}
        />

        {toastNode}
      </div>
    </div>
  );
}
