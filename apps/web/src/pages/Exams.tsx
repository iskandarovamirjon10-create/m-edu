import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { examsApi, coursesApi, groupsApi } from '@/lib/api';
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
  GlassSelect,
  GlassInput,
  GlassBadge,
  GlassButton,
  useToast,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, Exam, ExamType, Course, Group } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';

interface ExamFormState {
  title: string;
  courseId: string;
  groupId: string;
  type: ExamType | '';
  date: string;
  duration: string;
  maxScore: string;
  passingScore: string;
}

const INITIAL_FORM: ExamFormState = {
  title: '',
  courseId: '',
  groupId: '',
  type: '',
  date: '',
  duration: '60',
  maxScore: '100',
  passingScore: '60',
};

const EXAM_TYPES: ExamType[] = ['MIDTERM', 'FINAL', 'QUIZ', 'ASSIGNMENT'];

function validateExamForm(form: ExamFormState): Partial<Record<keyof ExamFormState, string>> {
  const errors: Partial<Record<keyof ExamFormState, string>> = {};

  if (!form.title.trim()) errors.title = 'Title is required';
  if (!form.courseId) errors.courseId = 'Course is required';
  if (!form.type) errors.type = 'Exam type is required';
  if (!form.date) errors.date = 'Date is required';
  if (!form.maxScore || isNaN(parseInt(form.maxScore)) || parseInt(form.maxScore) <= 0) {
    errors.maxScore = 'Valid max score is required';
  }
  if (!form.passingScore || isNaN(parseInt(form.passingScore)) || parseInt(form.passingScore) <= 0) {
    errors.passingScore = 'Valid passing score is required';
  }
  if (parseInt(form.passingScore) > parseInt(form.maxScore)) {
    errors.passingScore = 'Passing score cannot exceed max score';
  }

  return errors;
}

function getExamTypeBadge(type: ExamType): { variant: 'primary' | 'success' | 'warning' | 'azure'; label: string } {
  const badges: Record<ExamType, { variant: 'primary' | 'success' | 'warning' | 'azure'; label: string }> = {
    MIDTERM: { variant: 'primary', label: 'Midterm' },
    FINAL: { variant: 'warning', label: 'Final' },
    QUIZ: { variant: 'success', label: 'Quiz' },
    ASSIGNMENT: { variant: 'azure', label: 'Assignment' },
  };
  return badges[type];
}

export function ExamsPage() {
  usePageTitle('Exams');
  const { push, toastNode } = useToast();
  const qc = useQueryClient();

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState<ExamFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ExamFormState, string>>>({});

  // Search and filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');

  // Data fetching
  const exams = useQuery({
    queryKey: ['exams'],
    queryFn: () => examsApi.list({ limit: 100 }),
    placeholderData: (previousData) => previousData,
  });

  const courses = useQuery({
    queryKey: ['courses'],
    queryFn: () => coursesApi.list({ limit: 100 }),
  });

  const groups = useQuery({
    queryKey: ['groups'],
    queryFn: () => groupsApi.list({ limit: 100 }),
  });

  const data = exams.data as Paginated<Exam> | undefined;
  const examList = useMemo(() => data?.items || [], [data]);

  const courseData = courses.data as Paginated<Course> | undefined;
  const courseList = useMemo(() => courseData?.items || [], [courseData]);

  const groupData = groups.data as Paginated<Group> | undefined;
  const groupList = useMemo(() => groupData?.items || [], [groupData]);

  const filteredExams = useMemo(() => {
    let filtered = examList;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((exam) => exam.title.toLowerCase().includes(q));
    }

    if (filterType) {
      filtered = filtered.filter((exam) => exam.type === filterType);
    }

    return filtered;
  }, [examList, searchQuery, filterType]);

  // Save exam mutation
  const saveExam = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        courseId: form.courseId,
        type: form.type,
        date: form.date,
        maxScore: parseInt(form.maxScore),
        passingScore: parseInt(form.passingScore),
      };

      if (form.groupId) payload.groupId = form.groupId;
      if (form.duration) payload.duration = parseInt(form.duration);

      if (editingId) {
        return examsApi.update(editingId, payload);
      } else {
        return examsApi.create(payload);
      }
    },
    onSuccess: () => {
      push('success', editingId ? 'Exam updated' : 'Exam created');
      qc.invalidateQueries({ queryKey: ['exams'] });
      closeModal();
    },
    onError: (error) => {
      push('error', getErrorMessage(error));
    },
  });

  // Publish exam mutation
  const publishExam = useMutation({
    mutationFn: (id: string) => examsApi.publish(id),
    onSuccess: () => {
      push('success', 'Exam published');
      qc.invalidateQueries({ queryKey: ['exams'] });
    },
    onError: (error) => {
      push('error', getErrorMessage(error));
    },
  });

  // Delete exam mutation
  const deleteExam = useMutation({
    mutationFn: (id: string) => examsApi.remove(id),
    onSuccess: () => {
      push('success', 'Exam deleted');
      qc.invalidateQueries({ queryKey: ['exams'] });
    },
    onError: (error) => {
      push('error', getErrorMessage(error));
    },
  });

  const openModal = useCallback((exam?: Exam) => {
    if (exam) {
      setEditingId(exam.id);
      setForm({
        title: exam.title,
        courseId: exam.courseId,
        groupId: exam.groupId || '',
        type: exam.type,
        date: exam.date.split('T')[0],
        duration: exam.duration?.toString() || '60',
        maxScore: exam.maxScore.toString(),
        passingScore: exam.passingScore.toString(),
      });
    } else {
      setEditingId(null);
      setForm(INITIAL_FORM);
    }
    setFormErrors({});
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingId(null);
    setForm(INITIAL_FORM);
    setFormErrors({});
  }, []);

  const handleSubmit = useCallback(() => {
    const errors = validateExamForm(form);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    saveExam.mutate();
  }, [form, saveExam]);

  const getCourseName = useCallback((courseId: string) => {
    const course = courseList.find((c) => c.id === courseId);
    return course?.name || 'Unknown';
  }, [courseList]);

  const getGroupName = useCallback((groupId?: string) => {
    if (!groupId) return 'All Groups';
    const group = groupList.find((g) => g.id === groupId);
    return group?.name || 'Unknown';
  }, [groupList]);

  if (exams.isLoading || courses.isLoading || groups.isLoading) {
    return <GlassPageLoader label="Loading exams…" />;
  }

  if (exams.isError) {
    return (
      <GlassErrorState
        message={getErrorMessage(exams.error)}
        onRetry={() => exams.refetch()}
      />
    );
  }

  return (
    <div className="page-container">
      <div className="orb-container">
        <div className="orb orb-cyan-1" />
        <div className="orb orb-cyan-2" />
        <div className="orb orb-indigo-1" />
        <div className="orb orb-deep-1" />
      </div>
      {toastNode}

      <GlassPageHeader
        title="Exams"
        description="Manage exams and assessments"
        actions={
          <GlassButton variant="primary" size="sm" onClick={() => openModal()}>
            Create Exam
          </GlassButton>
        }
      />

      <GlassCard padding="none">
        <div className="p-4 border-b border-[var(--border-subtle)] space-y-4">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-64">
              <GlassInput
                placeholder="Search exams by title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <GlassSelect
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              options={[{ value: '', label: 'All Types' }, ...EXAM_TYPES.map((type) => ({ value: type, label: type.replace(/_/g, ' ') }))]}
              placeholder="All Types"
            />
          </div>
        </div>

        {filteredExams.length === 0 ? (
          <GlassEmptyState
            title={searchQuery || filterType ? 'No exams found' : 'No exams yet'}
            description={
              searchQuery || filterType
                ? 'Try adjusting your search criteria'
                : 'Create your first exam to get started'
            }
            action={!searchQuery && !filterType ? { label: 'Create Exam', onClick: () => openModal() } : undefined}
          />
        ) : (
          <GlassTable className="overflow-x-auto">
            <GlassTHead>
              <GlassTR>
                <GlassTH>Title</GlassTH>
                <GlassTH>Course</GlassTH>
                <GlassTH>Group</GlassTH>
                <GlassTH>Type</GlassTH>
                <GlassTH>Date</GlassTH>
                <GlassTH>Duration</GlassTH>
                <GlassTH>Score</GlassTH>
                <GlassTH>Status</GlassTH>
                <GlassTH>Actions</GlassTH>
              </GlassTR>
            </GlassTHead>
            <GlassTBody>
              {filteredExams.map((exam) => {
                const typeBadge = getExamTypeBadge(exam.type);
                return (
                  <GlassTR key={exam.id}>
                    <GlassTD className="font-medium">{exam.title}</GlassTD>
                    <GlassTD>{getCourseName(exam.courseId)}</GlassTD>
                    <GlassTD>{getGroupName(exam.groupId)}</GlassTD>
                    <GlassTD>
                      <GlassBadge variant={typeBadge.variant}>{typeBadge.label}</GlassBadge>
                    </GlassTD>
                    <GlassTD>{new Date(exam.date).toLocaleDateString()}</GlassTD>
                    <GlassTD>{exam.duration ? `${exam.duration} min` : '—'}</GlassTD>
                    <GlassTD>{exam.passingScore}/{exam.maxScore}</GlassTD>
                    <GlassTD>
                      <GlassBadge variant={exam.isPublished ? 'success' : 'muted'}>
                        {exam.isPublished ? 'Published' : 'Draft'}
                      </GlassBadge>
                    </GlassTD>
                    <GlassTD>
                      <div className="flex gap-2">
                        {!exam.isPublished && (
                          <GlassButton
                            variant="success"
                            size="sm"
                            onClick={() => publishExam.mutate(exam.id)}
                          >
                            Publish
                          </GlassButton>
                        )}
                        <GlassButton variant="ghost" size="sm" onClick={() => openModal(exam)}>
                          Edit
                        </GlassButton>
                        <GlassButton
                          variant="danger"
                          size="sm"
                          onClick={() => {
                            if (window.confirm('Delete this exam?')) {
                              deleteExam.mutate(exam.id);
                            }
                          }}
                        >
                          Delete
                        </GlassButton>
                      </div>
                    </GlassTD>
                  </GlassTR>
                );
              })}
            </GlassTBody>
          </GlassTable>
        )}
      </GlassCard>

      {/* Exam Form Modal */}
      <GlassModal
        open={modalOpen}
        onClose={closeModal}
        title={editingId ? 'Edit Exam' : 'Create Exam'}
        footer={
          <>
            <GlassButton variant="secondary" size="sm" onClick={closeModal}>Cancel</GlassButton>
            <GlassButton variant="primary" size="sm" onClick={handleSubmit} disabled={saveExam.isPending}>
              {saveExam.isPending ? 'Saving...' : 'Save'}
            </GlassButton>
          </>
        }
      >
        <div className="space-y-4">
          <GlassInput
            label="Title *"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Enter exam title"
            error={formErrors.title}
          />

          <GlassSelect
            label="Course *"
            value={form.courseId}
            onChange={(e) => setForm({ ...form, courseId: e.target.value })}
            options={[{ value: '', label: 'Select course' }, ...courseList.map((course) => ({ value: course.id, label: course.name }))]}
            placeholder="Select course"
            error={formErrors.courseId}
          />

          <GlassSelect
            label="Group"
            value={form.groupId}
            onChange={(e) => setForm({ ...form, groupId: e.target.value })}
            options={[{ value: '', label: 'All Groups' }, ...groupList.map((group) => ({ value: group.id, label: group.name }))]}
            placeholder="All Groups"
            error={formErrors.groupId}
          />

          <GlassSelect
            label="Exam Type *"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as ExamType })}
            options={[{ value: '', label: 'Select type' }, ...EXAM_TYPES.map((type) => ({ value: type, label: type.replace(/_/g, ' ') }))]}
            placeholder="Select type"
            error={formErrors.type}
          />

          <GlassInput
            label="Date *"
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            error={formErrors.date}
          />

          <div className="grid grid-cols-3 gap-4">
            <GlassInput
              label="Duration (min)"
              type="number"
              value={form.duration}
              onChange={(e) => setForm({ ...form, duration: e.target.value })}
              placeholder="60"
              min="1"
              error={formErrors.duration}
            />

            <GlassInput
              label="Max Score *"
              type="number"
              value={form.maxScore}
              onChange={(e) => setForm({ ...form, maxScore: e.target.value })}
              placeholder="100"
              min="1"
              error={formErrors.maxScore}
            />

            <GlassInput
              label="Passing Score *"
              type="number"
              value={form.passingScore}
              onChange={(e) => setForm({ ...form, passingScore: e.target.value })}
              placeholder="60"
              min="1"
              error={formErrors.passingScore}
            />
          </div>
        </div>
      </GlassModal>
    </div>
  );
}
