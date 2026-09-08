import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { homeworkApi, groupsApi } from '@/lib/api';
import {
  PageHeader,
  Badge,
  PageLoader,
  ErrorState,
  EmptyState,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  Field,
  TextInput,
  TextArea,
  Select,
  Modal,
  useToasts,
} from '@/components/ui';
import { formatDate } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, Homework, Group } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';

interface HomeworkFormState {
  groupId: string;
  title: string;
  description: string;
  deadline: string;
  maxScore: string;
}

const INITIAL_FORM: HomeworkFormState = {
  groupId: '',
  title: '',
  description: '',
  deadline: '',
  maxScore: '',
};

export function formatDeadline(deadline: string | null | undefined): string {
  if (!deadline) return '—';
  return formatDate(deadline);
}

export function formatMaxScore(score: number | null | undefined): string {
  return score != null ? String(score) : '—';
}

export function isDeadlinePast(deadline: string | null | undefined): boolean {
  if (!deadline) return false;
  return new Date(deadline) < new Date();
}

export function isDeadlineSoon(deadline: string | null | undefined): boolean {
  if (!deadline) return false;
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diffDays = Math.ceil(
    (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  return diffDays >= 0 && diffDays <= 3;
}

export function HomeworkPage() {
  usePageTitle('Homework');
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);

  // Form state
  const [form, setForm] = useState<HomeworkFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof HomeworkFormState, string>>
  >({});

  // Data fetching
  const homework = useQuery({
    queryKey: ['homework'],
    queryFn: () => homeworkApi.list({ limit: 100 }),
    placeholderData: (previousData) => previousData,
  });

  const groups = useQuery({
    queryKey: ['groups-homework'],
    queryFn: () => groupsApi.list({ limit: 100 }),
    placeholderData: (previousData) => previousData,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const data = homework.data as Paginated<Homework> | undefined;
  const homeworkList = useMemo(() => data?.items || [], [data]);
  const groupList = useMemo(
    () => (groups.data as Paginated<Group> | undefined)?.items || [],
    [groups.data],
  );

  // Create homework mutation
  const create = useMutation({
    mutationFn: () =>
      homeworkApi.create({
        groupId: form.groupId,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        deadline: form.deadline
          ? new Date(form.deadline).toISOString()
          : undefined,
        maxScore: form.maxScore ? parseFloat(form.maxScore) : undefined,
      }),
    onSuccess: () => {
      push('success', 'Homework created successfully');
      setModalOpen(false);
      setForm(INITIAL_FORM);
      setFormErrors({});
      qc.invalidateQueries({ queryKey: ['homework'] });
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
    },
  });

  // Form validation
  const validateForm = useCallback((): boolean => {
    const errors: Partial<Record<keyof HomeworkFormState, string>> = {};

    if (!form.title.trim()) {
      errors.title = 'Title is required';
    }
    if (!form.groupId) {
      errors.groupId = 'Please select a group';
    }
    if (form.maxScore && parseFloat(form.maxScore) < 0) {
      errors.maxScore = 'Max score must be a positive number';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form]);

  // Form handlers
  const handleFormChange = useCallback(
    (field: keyof HomeworkFormState) =>
      (
        e: React.ChangeEvent<
          HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
        >,
      ) => {
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

  const { refetch: refetchHomework } = homework;
  const handleRetry = useCallback(() => {
    void refetchHomework();
  }, [refetchHomework]);

  // Early return for loading state
  if (homework.isLoading && !data) {
    return (
      <div className="orb-container">
        <div className="page-container space-y-4">
          <PageHeader
            title="Homework"
            subtitle="Assignments for groups"
          />
          <div className="glass-card p-8">
            <PageLoader label="Loading homework…" />
          </div>
        </div>
      </div>
    );
  }

  // Early return for error state
  if (homework.isError) {
    return (
      <div className="orb-container">
        <div className="page-container space-y-4">
          <PageHeader
            title="Homework"
            subtitle="Assignments for groups"
          />
          <div className="glass-card p-8">
            <ErrorState
              title="Failed to load homework"
              message={getErrorMessage(homework.error as Error)}
              onRetry={handleRetry}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="orb-container">
      <div className="orb orb-cyan-1"></div>
      <div className="orb orb-cyan-2"></div>
      <div className="orb orb-indigo-1"></div>
      <div className="orb orb-deep-1"></div>
    <div className="page-container space-y-4">
      <PageHeader
        title="Homework"
        subtitle="Assignments for groups"
        actions={
          <button
            type="button"
            className="glass-btn glass-btn-primary"
            onClick={handleOpenModal}
          >
            Add homework
          </button>
        }
      />

      {/* Homework table */}
      <div className="glass-card overflow-hidden">
        {homeworkList.length === 0 ? (
          <EmptyState
            title="No homework"
            message="Create an assignment for a group."
          />
        ) : (
          <div className="glass-table-wrap">
            <Table>
              <THead>
                <TR>
                  <TH>Title</TH>
                  <TH>Group</TH>
                  <TH>Deadline</TH>
                  <TH>Max score</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {homeworkList.map((homeworkItem) => {
                  const isPast = isDeadlinePast(homeworkItem.deadline);
                  const isSoon = isDeadlineSoon(homeworkItem.deadline);

                  return (
                    <TR
                      key={homeworkItem.id}
                    >
                      <TD className="font-medium">
                        {homeworkItem.title}
                      </TD>
                      <TD>{homeworkItem.group?.name || '—'}</TD>
                      <TD className="whitespace-nowrap">
                        {formatDeadline(homeworkItem.deadline)}
                      </TD>
                      <TD>{formatMaxScore(homeworkItem.maxScore)}</TD>
                      <TD>
                        {isPast ? (
                          <Badge color="slate">Past due</Badge>
                        ) : isSoon ? (
                          <Badge color="amber">Due soon</Badge>
                        ) : (
                          <Badge color="green">Open</Badge>
                        )}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </div>
        )}
      </div>

      {/* Add homework modal */}
      <Modal
        open={modalOpen}
        onClose={handleCloseModal}
        title="Add homework"
        wide
      >
        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Title" required error={formErrors.title}>
              <TextInput
                value={form.title}
                onChange={handleFormChange('title')}
                required
                aria-invalid={Boolean(formErrors.title)}
                aria-describedby={formErrors.title ? 'title-error' : undefined}
                placeholder="Chapter 5 exercises"
              />
              {formErrors.title && (
                <span id="title-error" className="mt-1 text-sm text-red-600">
                  {formErrors.title}
                </span>
              )}
            </Field>

            <Field label="Group" required error={formErrors.groupId}>
              <Select
                value={form.groupId}
                onChange={handleFormChange('groupId')}
                required
                aria-invalid={Boolean(formErrors.groupId)}
                aria-describedby={
                  formErrors.groupId ? 'group-error' : undefined
                }
              >
                <option value="">Select group…</option>
                {groupList.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </Select>
              {formErrors.groupId && (
                <span id="group-error" className="mt-1 text-sm text-red-600">
                  {formErrors.groupId}
                </span>
              )}
            </Field>

            <Field label="Deadline">
              <TextInput
                type="datetime-local"
                value={form.deadline}
                onChange={handleFormChange('deadline')}
              />
            </Field>

            <Field label="Max score" error={formErrors.maxScore}>
              <TextInput
                type="number"
                min="0"
                step="0.1"
                value={form.maxScore}
                onChange={handleFormChange('maxScore')}
                aria-invalid={Boolean(formErrors.maxScore)}
                aria-describedby={
                  formErrors.maxScore ? 'maxscore-error' : undefined
                }
                placeholder="100"
              />
              {formErrors.maxScore && (
                <span
                  id="maxscore-error"
                  className="mt-1 text-sm text-red-600"
                >
                  {formErrors.maxScore}
                </span>
              )}
            </Field>
          </div>

          <Field label="Description">
            <TextArea
              rows={3}
              value={form.description}
              onChange={handleFormChange('description')}
              placeholder="Assignment instructions and requirements…"
            />
          </Field>

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
              {create.isPending ? 'Saving…' : 'Create homework'}
            </button>
          </div>
        </form>
      </Modal>

      {toastNode}
    </div>
    </div>
  );
}