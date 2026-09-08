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
  useToasts,
} from '@/components/ui';
import { formatCurrency } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, Course, CourseLevel } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';

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
  usePageTitle('Courses');
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);

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

  // Save course mutation
  const save = useMutation({
    mutationFn: () =>
      coursesApi.create({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        price: parseFloat(form.price) || 0,
        duration: parseInt(form.duration, 10) || 1,
        level: (form.level as CourseLevel) || undefined,
      }),
    onSuccess: () => {
      push('success', 'Course created successfully');
      setModalOpen(false);
      setForm(INITIAL_FORM);
      setFormErrors({});
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
      errors.name = 'Course name is required';
    }
    if (!form.price || parseFloat(form.price) < 0) {
      errors.price = 'Price must be a positive number';
    }
    if (!form.duration || parseInt(form.duration, 10) < 1) {
      errors.duration = 'Duration must be at least 1 month';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form]);

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
    setForm(INITIAL_FORM);
    setFormErrors({});
  }, []);

  const { refetch: refetchCourses } = courses;
  const handleRetry = useCallback(() => {
    void refetchCourses();
  }, [refetchCourses]);

  const handleOpenModal = useCallback(() => {
    setForm(INITIAL_FORM);
    setFormErrors({});
    setModalOpen(true);
  }, []);

  // Early return for loading state
  if (courses.isLoading && !data) {
    return (
      <div className="orb-container">
        <div className="orb orb-cyan-1" />
        <div className="orb orb-cyan-2" />
        <div className="orb orb-indigo-1" />
        <div className="orb orb-deep-1" />
        <div className="page-container">
          <GlassPageHeader
            title="Courses"
            subtitle="Course catalog and pricing"
          />
          <GlassCard className="p-8">
            <GlassPageLoader label="Loading courses…" />
          </GlassCard>
        </div>
      </div>
    );
  }

  // Early return for error state
  if (courses.isError) {
    return (
      <div className="orb-container">
        <div className="orb orb-cyan-1" />
        <div className="orb orb-cyan-2" />
        <div className="orb orb-indigo-1" />
        <div className="orb orb-deep-1" />
        <div className="page-container">
          <GlassPageHeader
            title="Courses"
            subtitle="Course catalog and pricing"
          />
          <GlassCard className="p-8">
            <GlassErrorState
              title="Failed to load courses"
              message={getErrorMessage(courses.error as Error)}
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
          title="Courses"
          subtitle="Course catalog and pricing"
          actions={
            <button
              type="button"
              className="glass-btn glass-btn-primary"
              onClick={handleOpenModal}
            >
              Add course
            </button>
          }
        />

        {/* Courses table */}
        <GlassCard className="overflow-hidden">
          {courseList.length === 0 ? (
            <GlassEmptyState
              title="No courses yet"
              message="Add your first course to build the catalog."
            />
          ) : (
            <div className="glass-table-wrap">
              <GlassTable>
                <GlassTHead>
                  <GlassTR>
                    <GlassTH>Name</GlassTH>
                    <GlassTH>Level</GlassTH>
                    <GlassTH>Duration</GlassTH>
                    <GlassTH>Price</GlassTH>
                    <GlassTH>Status</GlassTH>
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
                        <GlassTD>{formatCourseLevel(course.level)}</GlassTD>
                        <GlassTD>{formatDuration(course.duration)}</GlassTD>
                        <GlassTD className="font-medium">
                          {formatCurrency(course.price)}
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
          )}
        </GlassCard>

        {/* Add course modal */}
        <GlassModal
          open={modalOpen}
          onClose={handleCloseModal}
          title="Add course"
        >
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <GlassField label="Course name" required error={formErrors.name}>
              <GlassInput
                value={form.name}
                onChange={handleFormChange('name')}
                required
                aria-invalid={Boolean(formErrors.name)}
                aria-describedby={formErrors.name ? 'name-error' : undefined}
                placeholder="Introduction to Computer Science"
              />
              {formErrors.name && (
                <span id="name-error" className="mt-1 text-sm" style={{ color: 'var(--state-error)' }}>
                  {formErrors.name}
                </span>
              )}
            </GlassField>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <GlassField label="Price (USD)" required error={formErrors.price}>
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
                />
                {formErrors.price && (
                  <span id="price-error" className="mt-1 text-sm" style={{ color: 'var(--state-error)' }}>
                    {formErrors.price}
                  </span>
                )}
              </GlassField>
              <GlassField
                label="Duration (months)"
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

            <GlassField label="Level">
              <GlassSelect
                value={form.level}
                onChange={handleFormChange('level')}
                aria-label="Course level"
              >
                <option value="">Select level…</option>
                {COURSE_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {formatCourseLevel(level)}
                  </option>
                ))}
              </GlassSelect>
            </GlassField>

            <GlassField label="Description">
              <GlassTextArea
                rows={3}
                value={form.description}
                onChange={handleFormChange('description')}
                placeholder="Course description and learning objectives…"
              />
            </GlassField>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="glass-btn glass-btn-secondary"
                onClick={handleCloseModal}
                disabled={save.isPending}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="glass-btn glass-btn-primary"
                disabled={save.isPending}
              >
                {save.isPending ? 'Saving…' : 'Create course'}
              </button>
            </div>
          </form>
        </GlassModal>

        {toastNode}
      </div>
    </div>
  );
}
