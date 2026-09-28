import { useState, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { groupsApi, coursesApi, teachersApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys.factory';
import { GlassPageHeader, GlassCard, GlassBadge, GlassPageLoader, GlassErrorState, GlassEmptyState, GlassTable, GlassTHead, GlassTBody, GlassTR, GlassTH, GlassTD, GlassModal, GlassField, GlassInput, GlassSelect, GlassButton, useToasts, ConfirmDialog } from '@/components/ui';
import { getErrorMessage } from '@/lib/errorMessages';
import { fullName } from '@/lib/format';
import type { Paginated, Group, Course, Teacher } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';

interface GroupFormState {
  name: string;
  courseId: string;
  teacherId: string;
  capacity: string;
  room: string;
  startDate: string;
}

const INITIAL_FORM: GroupFormState = {
  name: '',
  courseId: '',
  teacherId: '',
  capacity: '',
  room: '',
  startDate: '',
};

function formatTeacherName(teacher: Teacher | null | undefined): string {
  if (!teacher) return '—';
  return fullName(teacher.user?.firstName, teacher.user?.lastName);
}

function formatCapacity(group: Group): string {
  const current = group._count?.enrollments ?? 0;
  return group.capacity ? `${current} / ${group.capacity}` : String(current);
}

function getGroupStatusBadge(isActive: boolean): { variant: 'success' | 'muted'; label: string } {
  return isActive
    ? { variant: 'success', label: 'enum.status.ACTIVE' }
    : { variant: 'muted', label: 'enum.status.INACTIVE' };
}

export function GroupsPage() {
  const { t } = useI18n();
  usePageTitle(t('groups.title'));
  const navigate = useNavigate();
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState<GroupFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof GroupFormState, string>>
  >({});

  // Data fetching
  const groups = useQuery({
    queryKey: queryKeys.groups.all(),
    queryFn: () => groupsApi.list({ limit: 100 }),
    placeholderData: (previousData) => previousData,
  });

  const courses = useQuery({
    queryKey: queryKeys.courses.selectors(),
    queryFn: () => coursesApi.list({ limit: 100 }),
    placeholderData: (previousData) => previousData,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const teachers = useQuery({
    queryKey: queryKeys.teachers.selectors(),
    queryFn: () => teachersApi.list({ limit: 100 }),
    placeholderData: (previousData) => previousData,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const data = groups.data as Paginated<Group> | undefined;
  const groupList = useMemo(() => data?.items || [], [data]);
  const courseList = useMemo(
    () => (courses.data as Paginated<Course> | undefined)?.items || [],
    [courses.data],
  );
  const teacherList = useMemo(
    () => (teachers.data as Paginated<Teacher> | undefined)?.items || [],
    [teachers.data],
  );

  // Create group mutation
  const create = useMutation({
    mutationFn: () =>
      groupsApi.create({
        name: form.name.trim(),
        courseId: form.courseId,
        teacherId: form.teacherId || undefined,
        capacity: form.capacity ? parseInt(form.capacity, 10) : undefined,
        room: form.room.trim() || undefined,
        startDate: form.startDate || undefined,
      }),
    onSuccess: () => {
      push('success', t('groups.created'));
      setModalOpen(false);
      setForm(INITIAL_FORM);
      setFormErrors({});
      qc.invalidateQueries({ queryKey: queryKeys.groups.all() });
      qc.invalidateQueries({ queryKey: queryKeys.groups.selectors() });
      qc.invalidateQueries({ queryKey: queryKeys.groups.details() });
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
    },
  });

  // Delete group mutation
  const remove = useMutation({
    mutationFn: (id: string) => groupsApi.remove(id),
    onSuccess: () => {
      push('success', t('groups.deleted'));
      qc.invalidateQueries({ queryKey: queryKeys.groups.all() });
      qc.invalidateQueries({ queryKey: queryKeys.groups.selectors() });
      qc.invalidateQueries({ queryKey: queryKeys.groups.details() });
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
    },
  });

  // Form validation
  const validateForm = useCallback((): boolean => {
    const errors: Partial<Record<keyof GroupFormState, string>> = {};

    if (!form.name.trim()) {
      errors.name = t('groups.form.nameRequired');
    }
    if (!form.courseId) {
      errors.courseId = t('groups.form.courseRequired');
    }
    if (form.capacity && parseInt(form.capacity, 10) < 1) {
      errors.capacity = t('groups.form.capacityMin');
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form, t]);

  // Form handlers
  const handleFormChange = useCallback(
    (field: keyof GroupFormState) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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

  const handleGroupClick = useCallback(
    (groupId: string) => {
      navigate(`/groups/${groupId}`);
    },
    [navigate],
  );

  const handleDelete = useCallback((id: string) => {
    setDeleteTarget(id);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    remove.mutate(deleteTarget);
    setDeleteTarget(null);
  }, [deleteTarget, remove]);

  const { refetch: refetchGroups } = groups;
  const handleRetry = useCallback(() => {
    void refetchGroups();
  }, [refetchGroups]);

  // Early return for loading state
  if (groups.isLoading && !data) {
    return (
      <div style={{ display: "contents" }}>
        <div className="page-container">
          <GlassPageHeader
            title={t('groups.title')}
            subtitle={t('groups.pageSubtitle')}
          />
          <GlassCard className="p-8">
            <GlassPageLoader label={t('groups.loading')} />
          </GlassCard>
        </div>
      </div>
    );
  }

  // Early return for error state
  if (groups.isError) {
    return (
      <div style={{ display: "contents" }}>
        <div className="page-container">
          <GlassPageHeader
            title={t('groups.title')}
            subtitle={t('groups.pageSubtitle')}
          />
          <GlassCard className="p-8">
            <GlassErrorState
              title={t('groups.loadError')}
              message={getErrorMessage(groups.error as Error)}
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
          title={t('groups.title')}
          subtitle={t('groups.pageSubtitle')}
          actions={
            <GlassButton
              type="button"
              variant="primary"
              onClick={handleOpenModal}
            >
              {t('groups.create')}
            </GlassButton>
          }
        />

        {/* Groups table */}
        <GlassCard className="overflow-hidden">
          {groupList.length === 0 ? (
            <GlassEmptyState
              title={t('groups.empty')}
              message={t('groups.emptyMessage')}
            />
          ) : (
            <div className="glass-table-wrap">
              <GlassTable>
                <GlassTHead>
                  <GlassTR>
                    <GlassTH>{t('common.name')}</GlassTH>
                    <GlassTH>{t('groups.col.course')}</GlassTH>
                    <GlassTH>{t('groups.col.teacher')}</GlassTH>
                    <GlassTH>{t('groups.col.room')}</GlassTH>
                    <GlassTH>{t('groups.col.capacity')}</GlassTH>
                    <GlassTH>{t('groups.col.status')}</GlassTH>
                    <GlassTH>{t('common.actions')}</GlassTH>
                  </GlassTR>
                </GlassTHead>
                <GlassTBody>
                  {groupList.map((group) => {
                    const statusBadge = getGroupStatusBadge(group.isActive);
                    const teacherName = formatTeacherName(group.teacher);

                    return (
                      <GlassTR
                        key={group.id}
                        onClick={() => handleGroupClick(group.id)}
                        className="cursor-pointer transition-colors"
                        tabIndex={0}
                        role="link"
                        aria-label={t('groups.viewAria', { name: group.name })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleGroupClick(group.id);
                          }
                        }}
                      >
                        <GlassTD className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          {group.name}
                        </GlassTD>
                        <GlassTD>{group.course?.name || '—'}</GlassTD>
                        <GlassTD>{teacherName}</GlassTD>
                        <GlassTD>{group.room || '—'}</GlassTD>
                        <GlassTD>{formatCapacity(group)}</GlassTD>
                        <GlassTD>
                          <GlassBadge variant={statusBadge.variant}>
                            {t(statusBadge.label)}
                          </GlassBadge>
                        </GlassTD>
                        <GlassTD>
                          <div
                            className="flex gap-2"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            <GlassButton asChild variant="ghost" size="sm">
                              <Link to={`/groups/${group.id}/edit`}>
                                {t('common.edit')}
                              </Link>
                            </GlassButton>
                            <GlassButton
                              type="button"
                              variant="danger"
                              size="sm"
                              onClick={() => handleDelete(group.id)}
                              disabled={remove.isPending && remove.variables === group.id}
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

        {/* Create group modal */}
        <GlassModal
          open={modalOpen}
          onClose={handleCloseModal}
          title={t('groups.create')}
          wide
        >
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <GlassField
                label={t('groups.form.name')}
                required
                error={formErrors.name}
              >
                <GlassInput
                  value={form.name}
                  onChange={handleFormChange('name')}
                  required
                  aria-invalid={Boolean(formErrors.name)}
                  aria-describedby={formErrors.name ? 'name-error' : undefined}
                  placeholder={t('groups.namePlaceholder')}
                />
                {formErrors.name && (
                  <span id="name-error" className="mt-1 text-sm" style={{ color: 'var(--state-error)' }}>
                    {formErrors.name}
                  </span>
                )}
              </GlassField>

              <GlassField
                label={t('groups.form.course')}
                required
                error={formErrors.courseId}
              >
                <GlassSelect
                  value={form.courseId}
                  onChange={handleFormChange('courseId')}
                  required
                  aria-invalid={Boolean(formErrors.courseId)}
                  aria-describedby={
                    formErrors.courseId ? 'course-error' : undefined
                  }
                >
                  <option value="">{t('groups.selectCoursePlaceholder')}</option>
                  {courseList.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </GlassSelect>
                {formErrors.courseId && (
                  <span id="course-error" className="mt-1 text-sm" style={{ color: 'var(--state-error)' }}>
                    {formErrors.courseId}
                  </span>
                )}
              </GlassField>

              <GlassField label={t('groups.form.teacher')}>
                <GlassSelect
                  value={form.teacherId}
                  onChange={handleFormChange('teacherId')}
                  aria-label={t('groups.selectTeacherAria')}
                >
                  <option value="">—</option>
                  {teacherList.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {formatTeacherName(teacher)}
                    </option>
                  ))}
                </GlassSelect>
              </GlassField>

              <GlassField label={t('groups.form.room')}>
                <GlassInput
                  value={form.room}
                  onChange={handleFormChange('room')}
                  placeholder={t('groups.roomPlaceholder')}
                />
              </GlassField>

              <GlassField label={t('groups.form.capacity')} error={formErrors.capacity}>
                <GlassInput
                  type="number"
                  min="1"
                  value={form.capacity}
                  onChange={handleFormChange('capacity')}
                  aria-invalid={Boolean(formErrors.capacity)}
                  aria-describedby={
                    formErrors.capacity ? 'capacity-error' : undefined
                  }
                  placeholder="20"
                />
                {formErrors.capacity && (
                  <span
                    id="capacity-error"
                    className="mt-1 text-sm"
                    style={{ color: 'var(--state-error)' }}
                  >
                    {formErrors.capacity}
                  </span>
                )}
              </GlassField>

              <GlassField label={t('groups.form.startDate')}>
                <GlassInput
                  type="date"
                  value={form.startDate}
                  onChange={handleFormChange('startDate')}
                />
              </GlassField>
            </div>

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
                {create.isPending ? t('common.saving') : t('groups.create')}
              </GlassButton>
            </div>
          </form>
        </GlassModal>

        <ConfirmDialog
          open={deleteTarget !== null}
          onClose={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
          description={t('groups.confirmDelete')}
          loading={remove.isPending}
        />

        {toastNode}
      </div>
    </div>
  );
}
