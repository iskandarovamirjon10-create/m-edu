import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { groupsApi, coursesApi, teachersApi } from '@/lib/api';
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
  GlassModal,
  GlassField,
  GlassInput,
  GlassSelect,
  useToasts,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/errorMessages';
import { fullName } from '@/lib/format';
import type { Paginated, Group, Course, Teacher } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';

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
    ? { variant: 'success', label: 'Active' }
    : { variant: 'muted', label: 'Inactive' };
}

export function GroupsPage() {
  usePageTitle('Groups');
  const navigate = useNavigate();
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);

  // Form state
  const [form, setForm] = useState<GroupFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof GroupFormState, string>>
  >({});

  // Data fetching
  const groups = useQuery({
    queryKey: ['groups'],
    queryFn: () => groupsApi.list({ limit: 100 }),
    placeholderData: (previousData) => previousData,
  });

  const courses = useQuery({
    queryKey: ['courses-selector'],
    queryFn: () => coursesApi.list({ limit: 100 }),
    placeholderData: (previousData) => previousData,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const teachers = useQuery({
    queryKey: ['teachers-selector'],
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
      push('success', 'Group created successfully');
      setModalOpen(false);
      setForm(INITIAL_FORM);
      setFormErrors({});
      qc.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
    },
  });

  // Form validation
  const validateForm = useCallback((): boolean => {
    const errors: Partial<Record<keyof GroupFormState, string>> = {};

    if (!form.name.trim()) {
      errors.name = 'Group name is required';
    }
    if (!form.courseId) {
      errors.courseId = 'Please select a course';
    }
    if (form.capacity && parseInt(form.capacity, 10) < 1) {
      errors.capacity = 'Capacity must be at least 1';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form]);

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

  const { refetch: refetchGroups } = groups;
  const handleRetry = useCallback(() => {
    void refetchGroups();
  }, [refetchGroups]);

  // Early return for loading state
  if (groups.isLoading && !data) {
    return (
      <div className="orb-container">
        <div className="orb orb-cyan-1" />
        <div className="orb orb-cyan-2" />
        <div className="orb orb-indigo-1" />
        <div className="orb orb-deep-1" />
        <div className="page-container">
          <GlassPageHeader
            title="Groups"
            subtitle="Classes and study groups"
          />
          <GlassCard className="p-8">
            <GlassPageLoader label="Loading groups…" />
          </GlassCard>
        </div>
      </div>
    );
  }

  // Early return for error state
  if (groups.isError) {
    return (
      <div className="orb-container">
        <div className="orb orb-cyan-1" />
        <div className="orb orb-cyan-2" />
        <div className="orb orb-indigo-1" />
        <div className="orb orb-deep-1" />
        <div className="page-container">
          <GlassPageHeader
            title="Groups"
            subtitle="Classes and study groups"
          />
          <GlassCard className="p-8">
            <GlassErrorState
              title="Failed to load groups"
              message={getErrorMessage(groups.error as Error)}
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
          title="Groups"
          subtitle="Classes and study groups"
          actions={
            <button
              type="button"
              className="glass-btn glass-btn-primary"
              onClick={handleOpenModal}
            >
              Create group
            </button>
          }
        />

        {/* Groups table */}
        <GlassCard className="overflow-hidden">
          {groupList.length === 0 ? (
            <GlassEmptyState
              title="No groups yet"
              message="Create your first group to organize students."
            />
          ) : (
            <div className="glass-table-wrap">
              <GlassTable>
                <GlassTHead>
                  <GlassTR>
                    <GlassTH>Name</GlassTH>
                    <GlassTH>Course</GlassTH>
                    <GlassTH>Teacher</GlassTH>
                    <GlassTH>Room</GlassTH>
                    <GlassTH>Capacity</GlassTH>
                    <GlassTH>Status</GlassTH>
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
                        aria-label={`View group ${group.name}`}
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

        {/* Create group modal */}
        <GlassModal
          open={modalOpen}
          onClose={handleCloseModal}
          title="Create group"
          wide
        >
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <GlassField label="Group name" required error={formErrors.name}>
                <GlassInput
                  value={form.name}
                  onChange={handleFormChange('name')}
                  required
                  aria-invalid={Boolean(formErrors.name)}
                  aria-describedby={formErrors.name ? 'name-error' : undefined}
                  placeholder="Morning class A"
                />
                {formErrors.name && (
                  <span id="name-error" className="mt-1 text-sm" style={{ color: 'var(--state-error)' }}>
                    {formErrors.name}
                  </span>
                )}
              </GlassField>

              <GlassField label="Course" required error={formErrors.courseId}>
                <GlassSelect
                  value={form.courseId}
                  onChange={handleFormChange('courseId')}
                  required
                  aria-invalid={Boolean(formErrors.courseId)}
                  aria-describedby={
                    formErrors.courseId ? 'course-error' : undefined
                  }
                >
                  <option value="">Select course…</option>
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

              <GlassField label="Teacher">
                <GlassSelect
                  value={form.teacherId}
                  onChange={handleFormChange('teacherId')}
                  aria-label="Select teacher"
                >
                  <option value="">—</option>
                  {teacherList.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {formatTeacherName(teacher)}
                    </option>
                  ))}
                </GlassSelect>
              </GlassField>

              <GlassField label="Room">
                <GlassInput
                  value={form.room}
                  onChange={handleFormChange('room')}
                  placeholder="Room 101"
                />
              </GlassField>

              <GlassField label="Capacity" error={formErrors.capacity}>
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

              <GlassField label="Start date">
                <GlassInput
                  type="date"
                  value={form.startDate}
                  onChange={handleFormChange('startDate')}
                />
              </GlassField>
            </div>

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
                {create.isPending ? 'Saving…' : 'Create group'}
              </button>
            </div>
          </form>
        </GlassModal>

        {toastNode}
      </div>
    </div>
  );
}
