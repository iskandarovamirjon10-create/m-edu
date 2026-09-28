import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { groupsApi, coursesApi, teachersApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys.factory';
import { GlassPageHeader, GlassCard, GlassPageLoader, GlassErrorState, GlassField, GlassInput, GlassSelect, GlassButton, useToasts } from '@/components/ui';
import { getErrorMessage } from '@/lib/errorMessages';
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
  endDate: string;
  isActive: boolean;
}

const EMPTY_FORM: GroupFormState = {
  name: '',
  courseId: '',
  teacherId: '',
  capacity: '',
  room: '',
  startDate: '',
  endDate: '',
  isActive: true,
};

export function GroupFormPage() {
  const { t } = useI18n();
  usePageTitle(t('enum.badge.GROUP'));
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();

  const [form, setForm] = useState<GroupFormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof GroupFormState, string>>
  >({});

  const existing = useQuery({
    queryKey: queryKeys.groups.detail(id || ''),
    queryFn: () => groupsApi.get(id!),
    enabled: isEdit,
    placeholderData: (previousData) => previousData,
  });

  const courses = useQuery({
    queryKey: queryKeys.courses.selectors(),
    queryFn: () => coursesApi.list({ limit: 100, isActive: true }),
    staleTime: 5 * 60 * 1000,
  });

  const teachers = useQuery({
    queryKey: queryKeys.teachers.selectors(),
    queryFn: () => teachersApi.list({ limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });

  // Load existing group data when in edit mode
  useEffect(() => {
    if (isEdit && existing.data) {
      const group = existing.data as Group;
      setForm({
        name: group.name || '',
        courseId: group.courseId || '',
        teacherId: group.teacherId || '',
        capacity: group.capacity != null ? String(group.capacity) : '',
        room: group.room || '',
        startDate: group.startDate ? group.startDate.slice(0, 10) : '',
        endDate: group.endDate ? group.endDate.slice(0, 10) : '',
        isActive: group.isActive,
      });
    }
  }, [isEdit, existing.data]);

  const courseList = useMemo(() => (courses.data as Paginated<Course> | undefined)?.items || [], [courses.data]);
  const teacherList = useMemo(() => (teachers.data as Paginated<Teacher> | undefined)?.items || [], [teachers.data]);

  const set = useCallback(
    <K extends keyof GroupFormState>(key: K, value: GroupFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setFormErrors((prev) => ({ ...prev, [key]: undefined }));
    },
    [],
  );

  const validateForm = useCallback((): boolean => {
    const errors: Partial<Record<keyof GroupFormState, string>> = {};
    if (!form.name.trim()) errors.name = t('groups.form.nameRequired');
    if (!form.courseId) errors.courseId = t('groups.form.courseRequired');
    if (form.capacity && (parseInt(form.capacity, 10) < 1 || parseInt(form.capacity, 10) > 100)) {
      errors.capacity = t('groupForm.capacityRange');
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form, t]);

  const save = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        courseId: form.courseId,
        teacherId: form.teacherId || undefined,
        capacity: form.capacity ? parseInt(form.capacity, 10) : undefined,
        room: form.room.trim() || undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        isActive: form.isActive,
      };
      return isEdit ? groupsApi.update(id!, payload) : groupsApi.create(payload);
    },
    onSuccess: (res) => {
      push('success', isEdit ? t('groups.updated') : t('groups.created'));
      qc.invalidateQueries({ queryKey: queryKeys.groups.all() });
      qc.invalidateQueries({ queryKey: queryKeys.groups.selectors() });
      qc.invalidateQueries({ queryKey: queryKeys.groups.details() });
      navigate(`/groups/${(res as Group).id}`, { replace: true });
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
    },
  });

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!validateForm()) return;
      save.mutate();
    },
    [validateForm, save],
  );

  const handleCancel = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  if (isEdit && existing.isLoading && !existing.data) {
    return (
      <div style={{ display: "contents" }}>
        <div className="page-container">
          <GlassPageHeader
            title={t('groupForm.editTitle')}
            subtitle={t('groups.loadingGroup')}
          />
          <GlassCard className="p-8">
            <GlassPageLoader label={t('groups.loadingGroup')} />
          </GlassCard>
        </div>
      </div>
    );
  }

  if (isEdit && existing.isError) {
    return (
      <div style={{ display: "contents" }}>
        <div className="page-container">
          <GlassPageHeader
            title={t('groupForm.editTitle')}
            subtitle={t('groups.detailsSubtitle')}
          />
          <GlassCard className="p-8">
            <GlassErrorState title={t('groups.notFound')} message={getErrorMessage(existing.error as Error)} onRetry={() => existing.refetch()} />
          </GlassCard>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "contents" }}>
      <div className="page-container">
        <GlassPageHeader
          title={
            isEdit ? t('groupForm.editTitle') : t('groupForm.newTitle')
          }
          subtitle={
            isEdit ? t('groupForm.editSubtitle') : t('groupForm.createSubtitle')
          }
        />
        <GlassCard className="p-6">
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <GlassField
                label={t('common.name')}
                required
                error={formErrors.name}
              >
                <GlassInput value={form.name} onChange={(e) => set('name', e.target.value)} required aria-invalid={Boolean(formErrors.name)} />
              </GlassField>
              <GlassField
                label={t('groups.form.course')}
                required
                error={formErrors.courseId}
              >
                <GlassSelect value={form.courseId} onChange={(e) => set('courseId', e.target.value)} required aria-invalid={Boolean(formErrors.courseId)}>
                  <option value="">{t('groups.selectCoursePlaceholder')}</option>
                  {courseList.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </GlassSelect>
              </GlassField>
              <GlassField label={t('groups.form.teacher')}>
                <GlassSelect value={form.teacherId} onChange={(e) => set('teacherId', e.target.value)}>
                  <option value="">{t('groupForm.noTeacher')}</option>
                  {teacherList.map((tm) => (
                    <option key={tm.id} value={tm.id}>
                      {tm.user ? `${tm.user.firstName} ${tm.user.lastName}` : tm.id.slice(0, 8)}
                    </option>
                  ))}
                </GlassSelect>
              </GlassField>
              <GlassField label={t('groups.form.capacity')} error={formErrors.capacity}>
                <GlassInput type="number" min={1} max={100} value={form.capacity} onChange={(e) => set('capacity', e.target.value)} aria-invalid={Boolean(formErrors.capacity)} />
              </GlassField>
              <GlassField label={t('groups.form.room')}>
                <GlassInput value={form.room} onChange={(e) => set('room', e.target.value)} />
              </GlassField>
              <GlassField label={t('groups.form.startDate')}>
                <GlassInput type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
              </GlassField>
              <GlassField label={t('groupForm.endDate')}>
                <GlassInput type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} />
              </GlassField>
              {isEdit && (
                <GlassField label={t('enum.status.ACTIVE')}>
                  <GlassSelect value={form.isActive ? 'true' : 'false'} onChange={(e) => set('isActive', e.target.value === 'true')}>
                    <option value="true">{t('enum.status.ACTIVE')}</option>
                    <option value="false">{t('enum.status.INACTIVE')}</option>
                  </GlassSelect>
                </GlassField>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <GlassButton type="button" variant="secondary" onClick={handleCancel} disabled={save.isPending}>
                {t('common.cancel')}
              </GlassButton>
              <GlassButton type="submit" variant="primary" disabled={save.isPending}>
                {save.isPending
                  ? t('common.saving')
                  : isEdit
                    ? t('templates.saveChanges')
                    : t('groups.create')}
              </GlassButton>
            </div>
          </form>
        </GlassCard>
        {toastNode}
      </div>
    </div>
  );
}
