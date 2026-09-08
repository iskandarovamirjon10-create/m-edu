import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { groupsApi, coursesApi, teachersApi } from '@/lib/api';
import {
  GlassPageHeader,
  GlassCard,
  GlassPageLoader,
  GlassErrorState,
  GlassField,
  GlassInput,
  GlassSelect,
  useToasts,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, Group, Course, Teacher } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';

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
  usePageTitle('Group');
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
    queryKey: ['group', id],
    queryFn: () => groupsApi.get(id!),
    enabled: isEdit,
    placeholderData: (previousData) => previousData,
  });

  const courses = useQuery({
    queryKey: ['courses-selector'],
    queryFn: () => coursesApi.list({ limit: 100, isActive: true }),
    staleTime: 5 * 60 * 1000,
  });

  const teachers = useQuery({
    queryKey: ['teachers-selector'],
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
    if (!form.name.trim()) errors.name = 'Group name is required';
    if (!form.courseId) errors.courseId = 'Please select a course';
    if (form.capacity && (parseInt(form.capacity, 10) < 1 || parseInt(form.capacity, 10) > 100)) {
      errors.capacity = 'Capacity must be between 1 and 100';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form]);

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
      push('success', isEdit ? 'Group updated successfully' : 'Group created successfully');
      qc.invalidateQueries({ queryKey: ['groups'] });
      qc.invalidateQueries({ queryKey: ['group', id] });
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
      <div className="orb-container">
        <div className="orb orb-cyan-1" />
        <div className="orb orb-cyan-2" />
        <div className="orb orb-indigo-1" />
        <div className="orb orb-deep-1" />
        <div className="page-container">
          <GlassPageHeader title="Edit group" subtitle="Loading group…" />
          <GlassCard className="p-8"><GlassPageLoader label="Loading group…" /></GlassCard>
        </div>
      </div>
    );
  }

  if (isEdit && existing.isError) {
    return (
      <div className="orb-container">
        <div className="orb orb-cyan-1" />
        <div className="orb orb-cyan-2" />
        <div className="orb orb-indigo-1" />
        <div className="orb orb-deep-1" />
        <div className="page-container">
          <GlassPageHeader title="Edit group" subtitle="Group details" />
          <GlassCard className="p-8">
            <GlassErrorState title="Group not found" message={getErrorMessage(existing.error as Error)} onRetry={() => existing.refetch()} />
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
          title={isEdit ? 'Edit group' : 'New group'}
          subtitle={isEdit ? 'Update group details' : 'Create a study group'}
        />
        <GlassCard className="p-6">
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <GlassField label="Name" required error={formErrors.name}>
                <GlassInput value={form.name} onChange={(e) => set('name', e.target.value)} required aria-invalid={Boolean(formErrors.name)} />
              </GlassField>
              <GlassField label="Course" required error={formErrors.courseId}>
                <GlassSelect value={form.courseId} onChange={(e) => set('courseId', e.target.value)} required aria-invalid={Boolean(formErrors.courseId)}>
                  <option value="">Select course…</option>
                  {courseList.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </GlassSelect>
              </GlassField>
              <GlassField label="Teacher">
                <GlassSelect value={form.teacherId} onChange={(e) => set('teacherId', e.target.value)}>
                  <option value="">No teacher</option>
                  {teacherList.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.user ? `${t.user.firstName} ${t.user.lastName}` : t.id.slice(0, 8)}
                    </option>
                  ))}
                </GlassSelect>
              </GlassField>
              <GlassField label="Capacity" error={formErrors.capacity}>
                <GlassInput type="number" min={1} max={100} value={form.capacity} onChange={(e) => set('capacity', e.target.value)} aria-invalid={Boolean(formErrors.capacity)} />
              </GlassField>
              <GlassField label="Room">
                <GlassInput value={form.room} onChange={(e) => set('room', e.target.value)} />
              </GlassField>
              <GlassField label="Start date">
                <GlassInput type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
              </GlassField>
              <GlassField label="End date">
                <GlassInput type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} />
              </GlassField>
              {isEdit && (
                <GlassField label="Active">
                  <GlassSelect value={form.isActive ? 'true' : 'false'} onChange={(e) => set('isActive', e.target.value === 'true')}>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </GlassSelect>
                </GlassField>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="glass-btn glass-btn-secondary" onClick={handleCancel} disabled={save.isPending}>Cancel</button>
              <button type="submit" className="glass-btn glass-btn-primary" disabled={save.isPending}>
                {save.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create group'}
              </button>
            </div>
          </form>
        </GlassCard>
        {toastNode}
      </div>
    </div>
  );
}
