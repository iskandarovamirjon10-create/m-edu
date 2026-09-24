import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { examsApi, groupsApi } from '@/lib/api';
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
  ConfirmDialog,
  useToast,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, Exam, ExamType, Group } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';

interface ExamFormState {
  title: string;
  subject: string;
  groupId: string;
  examType: ExamType | '';
  examDate: string;
  duration: string;
  totalMarks: string;
  passingMarks: string;
}

const INITIAL_FORM: ExamFormState = {
  title: '',
  subject: '',
  groupId: '',
  examType: '',
  examDate: '',
  duration: '60',
  totalMarks: '100',
  passingMarks: '60',
};

const EXAM_TYPES: ExamType[] = ['MIDTERM', 'FINAL', 'QUIZ', 'ASSIGNMENT'];

function validateExamForm(form: ExamFormState): Partial<Record<keyof ExamFormState, string>> {
  const errors: Partial<Record<keyof ExamFormState, string>> = {};

  if (!form.title.trim()) errors.title = 'homework.titleRequired';
  if (!form.subject.trim()) errors.subject = 'exams.subjectRequired';
  if (!form.groupId) errors.groupId = 'exams.groupRequired';
  if (!form.examType) errors.examType = 'exams.form.typeRequired';
  if (!form.examDate) errors.examDate = 'exams.form.dateRequired';
  if (!form.duration || isNaN(parseInt(form.duration)) || parseInt(form.duration) <= 0) {
    errors.duration = 'exams.durationInvalid';
  }
  if (!form.totalMarks || isNaN(parseInt(form.totalMarks)) || parseInt(form.totalMarks) <= 0) {
    errors.totalMarks = 'exams.totalMarksInvalid';
  }
  if (!form.passingMarks || isNaN(parseInt(form.passingMarks)) || parseInt(form.passingMarks) < 0) {
    errors.passingMarks = 'exams.passingMarksInvalid';
  }
  if (parseInt(form.passingMarks) > parseInt(form.totalMarks)) {
    errors.passingMarks = 'exams.passingMarksExceed';
  }

  return errors;
}

function getExamTypeBadge(type: ExamType): { variant: 'primary' | 'success' | 'warning' | 'azure'; label: string } {
  const badges: Record<ExamType, { variant: 'primary' | 'success' | 'warning' | 'azure'; label: string }> = {
    MIDTERM: { variant: 'primary', label: 'exams.type.MIDTERM' },
    FINAL: { variant: 'warning', label: 'exams.type.FINAL' },
    QUIZ: { variant: 'success', label: 'exams.type.QUIZ' },
    ASSIGNMENT: { variant: 'azure', label: 'exams.type.ASSIGNMENT' },
  };
  return badges[type] ?? { variant: 'primary', label: type };
}

export function ExamsPage() {
  const { t } = useI18n();
  usePageTitle(t('exams.title'));
  const { push, toastNode } = useToast();
  const qc = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const [form, setForm] = useState<ExamFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ExamFormState, string>>>({});

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');

  const exams = useQuery({
    queryKey: ['exams'],
    queryFn: () => examsApi.list({ limit: 100 }),
    placeholderData: (previousData) => previousData,
  });

  const groups = useQuery({
    queryKey: ['groups'],
    queryFn: () => groupsApi.list({ limit: 100 }),
  });

  const data = exams.data as Paginated<Exam> | undefined;
  const examList = useMemo(() => data?.items || [], [data]);

  const groupData = groups.data as Paginated<Group> | undefined;
  const groupList = useMemo(() => groupData?.items || [], [groupData]);

  const filteredExams = useMemo(() => {
    let filtered = examList;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (exam) =>
          exam.title.toLowerCase().includes(q) ||
          (exam.subject ?? '').toLowerCase().includes(q)
      );
    }

    if (filterType) {
      filtered = filtered.filter((exam) => exam.examType === filterType);
    }

    return filtered;
  }, [examList, searchQuery, filterType]);

  // Payload must match CreateExamDto / UpdateExamDto exactly (forbidNonWhitelisted).
  const saveExam = useMutation({
    mutationFn: () => {
      const common = {
        title: form.title.trim(),
        examDate: form.examDate,
        duration: parseInt(form.duration, 10),
        totalMarks: parseInt(form.totalMarks, 10),
        passingMarks: parseInt(form.passingMarks, 10),
        examType: form.examType as ExamType,
      };

      if (editingId) {
        // UpdateExamDto does NOT allow groupId/subject.
        return examsApi.update(editingId, common);
      }
      return examsApi.create({
        ...common,
        groupId: form.groupId,
        subject: form.subject.trim(),
      });
    },
    onSuccess: () => {
      push('success', editingId ? t('exams.updated') : t('exams.created'));
      qc.invalidateQueries({ queryKey: ['exams'] });
      closeModal();
    },
    onError: (error) => {
      push('error', getErrorMessage(error));
    },
  });

  // PublishExamDto requires { isPublished: true }. force is NOT sent (results required).
  const publishExam = useMutation({
    mutationFn: (id: string) => examsApi.publish(id),
    onSuccess: () => {
      push('success', t('exams.published'));
      qc.invalidateQueries({ queryKey: ['exams'] });
    },
    onError: (error) => {
      push('error', getErrorMessage(error));
    },
  });

  const deleteExam = useMutation({
    mutationFn: (id: string) => examsApi.remove(id),
    onSuccess: () => {
      push('success', t('exams.deleted'));
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
        subject: exam.subject || '',
        groupId: exam.groupId || '',
        examType: exam.examType,
        examDate: (exam.examDate || '').split('T')[0],
        duration: exam.duration?.toString() || '60',
        totalMarks: exam.totalMarks.toString(),
        passingMarks: exam.passingMarks.toString(),
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

  const getGroupName = useCallback(
    (exam: Exam) => {
      if (exam.group?.name) return exam.group.name;
      if (exam.groupId) {
        const group = groupList.find((g) => g.id === exam.groupId);
        return group?.name || t('common.unknown');
      }
      return '—';
    },
    [groupList, t]
  );

  const getCourseName = useCallback((exam: Exam) => {
    // List include is group.course — never exam.courseId.
    if (exam.group?.course?.name) return exam.group.course.name;
    return '—';
  }, []);

  if (exams.isLoading || groups.isLoading) {
    return <GlassPageLoader label={t('exams.loading')} />;
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

      {toastNode}

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteExam.mutate(deleteTarget);
          setDeleteTarget(null);
        }}
        description={t('exams.deleteConfirm')}
        loading={deleteExam.isPending}
      />

      <GlassPageHeader
        title={t('exams.title')}
        description={t('exams.pageDescription')}
        actions={
          <GlassButton variant="primary" size="sm" onClick={() => openModal()}>
            {t('exams.add')}
          </GlassButton>
        }
      />

      <GlassCard padding="none">
        <div className="p-4 border-b border-[var(--border-subtle)] space-y-4">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-64">
              <GlassInput
                placeholder={t('exams.searchInputPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <GlassSelect
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              options={[
                { value: '', label: t('enum.allTypes') },
                ...EXAM_TYPES.map((type) => ({ value: type, label: t(`exams.type.${type}`) })),
              ]}
              placeholder={t('enum.allTypes')}
            />
          </div>
        </div>

        {filteredExams.length === 0 ? (
          <GlassEmptyState
            title={searchQuery || filterType ? t('exams.emptySearch') : t('exams.empty')}
            description={
              searchQuery || filterType
                ? t('certificates.emptySearchHint')
                : t('exams.emptyMessage')
            }
            action={
              !searchQuery && !filterType
                ? { label: t('exams.add'), onClick: () => openModal() }
                : undefined
            }
          />
        ) : (
          <GlassTable className="overflow-x-auto">
            <GlassTHead>
              <GlassTR>
                <GlassTH>{t('exams.col.title')}</GlassTH>
                <GlassTH>{t('exams.col.course')}</GlassTH>
                <GlassTH>{t('exams.form.group')}</GlassTH>
                <GlassTH>{t('exams.col.type')}</GlassTH>
                <GlassTH>{t('common.date')}</GlassTH>
                <GlassTH>{t('courses.col.duration')}</GlassTH>
                <GlassTH>{t('grades.col.score')}</GlassTH>
                <GlassTH>{t('common.status')}</GlassTH>
                <GlassTH>{t('common.actions')}</GlassTH>
              </GlassTR>
            </GlassTHead>
            <GlassTBody>
              {filteredExams.map((exam) => {
                const typeBadge = getExamTypeBadge(exam.examType);
                return (
                  <GlassTR key={exam.id}>
                    <GlassTD className="font-medium">{exam.title}</GlassTD>
                    <GlassTD>{getCourseName(exam)}</GlassTD>
                    <GlassTD>{getGroupName(exam)}</GlassTD>
                    <GlassTD>
                      <GlassBadge variant={typeBadge.variant}>{t(typeBadge.label)}</GlassBadge>
                    </GlassTD>
                    <GlassTD>{new Date(exam.examDate).toLocaleDateString()}</GlassTD>
                    <GlassTD>
                      {exam.duration ? t('exams.durationMinutes', { n: exam.duration }) : '—'}
                    </GlassTD>
                    <GlassTD>{exam.passingMarks}/{exam.totalMarks}</GlassTD>
                    <GlassTD>
                      <GlassBadge variant={exam.isPublished ? 'success' : 'muted'}>
                        {exam.isPublished ? t('exams.status.published') : t('exams.status.draft')}
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
                            {t('exams.publish')}
                          </GlassButton>
                        )}
                        <GlassButton variant="ghost" size="sm" onClick={() => openModal(exam)}>
                          {t('common.edit')}
                        </GlassButton>
                        <GlassButton
                          variant="danger"
                          size="sm"
                          onClick={() => setDeleteTarget(exam.id)}
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
        )}
      </GlassCard>

      <GlassModal
        open={modalOpen}
        onClose={closeModal}
        title={editingId ? t('exams.editTitle') : t('exams.add')}
        footer={
          <>
            <GlassButton variant="secondary" size="sm" onClick={closeModal}>{t('common.cancel')}</GlassButton>
            <GlassButton variant="primary" size="sm" onClick={handleSubmit} disabled={saveExam.isPending}>
              {saveExam.isPending ? t('common.saving') : t('common.save')}
            </GlassButton>
          </>
        }
      >
        <div className="space-y-4">
          <GlassInput
            label={t('exams.field.title')}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder={t('exams.titlePlaceholder')}
            error={formErrors.title ? t(formErrors.title) : undefined}
          />

          {!editingId && (
            <>
              <GlassInput
                label={t('exams.field.subject')}
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder={t('exams.subjectPlaceholder')}
                error={formErrors.subject ? t(formErrors.subject) : undefined}
              />

              <GlassSelect
                label={t('exams.field.group')}
                value={form.groupId}
                onChange={(e) => setForm({ ...form, groupId: e.target.value })}
                options={[
                  { value: '', label: t('exams.groupPlaceholder') },
                  ...groupList.map((group) => ({ value: group.id, label: group.name })),
                ]}
                placeholder={t('exams.groupPlaceholder')}
                error={formErrors.groupId ? t(formErrors.groupId) : undefined}
              />
            </>
          )}

          <GlassSelect
            label={t('exams.field.examType')}
            value={form.examType}
            onChange={(e) => setForm({ ...form, examType: e.target.value as ExamType })}
            options={[
              { value: '', label: t('exams.form.selectType') },
              ...EXAM_TYPES.map((type) => ({ value: type, label: t(`exams.type.${type}`) })),
            ]}
            placeholder={t('exams.form.selectType')}
            error={formErrors.examType ? t(formErrors.examType) : undefined}
          />

          <GlassInput
            label={t('exams.field.date')}
            type="date"
            value={form.examDate}
            onChange={(e) => setForm({ ...form, examDate: e.target.value })}
            error={formErrors.examDate ? t(formErrors.examDate) : undefined}
          />

          <div className="grid grid-cols-3 gap-4">
            <GlassInput
              label={t('exams.field.duration')}
              type="number"
              value={form.duration}
              onChange={(e) => setForm({ ...form, duration: e.target.value })}
              placeholder="60"
              min="1"
              error={formErrors.duration ? t(formErrors.duration) : undefined}
            />

            <GlassInput
              label={t('exams.field.totalMarks')}
              type="number"
              value={form.totalMarks}
              onChange={(e) => setForm({ ...form, totalMarks: e.target.value })}
              placeholder="100"
              min="0"
              error={formErrors.totalMarks ? t(formErrors.totalMarks) : undefined}
            />

            <GlassInput
              label={t('exams.field.passingMarks')}
              type="number"
              value={form.passingMarks}
              onChange={(e) => setForm({ ...form, passingMarks: e.target.value })}
              placeholder="60"
              min="0"
              error={formErrors.passingMarks ? t(formErrors.passingMarks) : undefined}
            />
          </div>

          {editingId && (
            <p className="text-xs text-[var(--text-muted)]">
              {t('exams.editLockedHint')}
            </p>
          )}
        </div>
      </GlassModal>
    </div>
  );
}
