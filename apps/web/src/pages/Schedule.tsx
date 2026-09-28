import { useMemo, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { scheduleApi, groupsApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys.factory';
import { GlassPageHeader, GlassCard, GlassPageLoader, GlassErrorState, GlassEmptyState, GlassTable, GlassTHead, GlassTBody, GlassTR, GlassTH, GlassTD, GlassTabs, GlassModal, GlassSelect, GlassInput, GlassButton, ConfirmDialog, useToast } from '@/components/ui';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, Schedule, Group, DayOfWeek } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';

const DAYS: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

function formatDay(d: DayOfWeek): string {
  return `schedule.day.${d}`;
}

interface ScheduleFilters {
  page: number;
  limit: number;
  groupId?: string;
  dayOfWeek?: string;
}

interface ScheduleFormState {
  groupId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  room: string;
}

const INITIAL_FORM: ScheduleFormState = {
  groupId: '',
  dayOfWeek: 'MONDAY',
  startTime: '09:00',
  endTime: '10:00',
  room: '',
};

export function SchedulePage() {
  const { t } = useI18n();
  usePageTitle(t('nav.schedule'));
  const { push, toastNode } = useToast();
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [groupFilter, setGroupFilter] = useState('');
  const [dayFilter, setDayFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<Schedule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const [form, setForm] = useState<ScheduleFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ScheduleFormState, string>>>({});

  const params = useMemo<ScheduleFilters>(
    () => ({
      page,
      limit: 20,
      groupId: groupFilter || undefined,
      dayOfWeek: dayFilter || undefined,
    }),
    [page, groupFilter, dayFilter],
  );

  const scheduleQ = useQuery({
    queryKey: ['schedule', params],
    queryFn: () => scheduleApi.list(params),
    placeholderData: (prev) => prev,
  });

  const data = scheduleQ.data as Paginated<Schedule> | undefined;
  const isLoading = scheduleQ.isLoading;
  const error = scheduleQ.error;

  const groupsQ = useQuery({
    queryKey: queryKeys.groups.selectors(),
    queryFn: () => groupsApi.list({ limit: 200 }),
    staleTime: 5 * 60 * 1000,
  });

  const createMut = useMutation({
    mutationFn: (d: ScheduleFormState) =>
      scheduleApi.create({
        groupId: d.groupId,
        dayOfWeek: d.dayOfWeek,
        startTime: d.startTime,
        endTime: d.endTime,
        room: d.room || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule'] });
      qc.invalidateQueries({ queryKey: queryKeys.groups.all() });
      qc.invalidateQueries({ queryKey: queryKeys.groups.details() });
      push('success', t('schedule.created'));
      closeModal();
    },
    onError: (e: unknown) => push('error', getErrorMessage(e)),
  });

  const updateMut = useMutation({
    mutationFn: (d: ScheduleFormState & { id: string }) =>
      scheduleApi.update(d.id, {
        dayOfWeek: d.dayOfWeek,
        startTime: d.startTime,
        endTime: d.endTime,
        room: d.room || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule'] });
      qc.invalidateQueries({ queryKey: queryKeys.groups.all() });
      qc.invalidateQueries({ queryKey: queryKeys.groups.details() });
      push('success', t('schedule.updated'));
      closeModal();
    },
    onError: (e: unknown) => push('error', getErrorMessage(e)),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => scheduleApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule'] });
      qc.invalidateQueries({ queryKey: queryKeys.groups.all() });
      qc.invalidateQueries({ queryKey: queryKeys.groups.details() });
      push('success', t('schedule.removed'));
    },
    onError: (e: unknown) => push('error', getErrorMessage(e)),
  });

  const openCreate = useCallback(() => {
    setEditEntry(null);
    setForm(INITIAL_FORM);
    setFormErrors({});
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((s: Schedule) => {
    setEditEntry(s);
    setForm({
      groupId: s.groupId,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      room: s.room ?? '',
    });
    setFormErrors({});
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditEntry(null);
  }, []);

  const validate = (): boolean => {
    const errs: Partial<Record<keyof ScheduleFormState, string>> = {};
    if (!form.groupId) errs.groupId = t('common.required');
    if (!form.startTime) errs.startTime = t('common.required');
    if (!form.endTime) errs.endTime = t('common.required');
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (editEntry) {
      updateMut.mutate({ ...form, id: editEntry.id });
    } else {
      createMut.mutate(form);
    }
  };

  const items = data?.items ?? [];
  const groups = (groupsQ.data as { items: Group[] } | undefined)?.items ?? [];

  const tabs = [
    { id: '', label: t('schedule.allDays') },
    ...DAYS.map((d) => ({ id: d, label: t(formatDay(d)) })),
  ];

  return (
    <div className="page-container">
      
      {toastNode}
      <GlassPageHeader
        title={t('nav.schedule')}
        description={t('schedule.entriesCount', { count: data?.total ?? 0 })}
        actions={
          <GlassButton variant="primary" size="sm" onClick={openCreate}>
            {t('schedule.addEntry')}
          </GlassButton>
        }
      />

      <div className="flex flex-col gap-4">
        <GlassTabs
          tabs={tabs}
          active={dayFilter}
          onChange={(id) => { setDayFilter(id); setPage(1); }}
        />
        <div className="flex flex-wrap gap-3">
          <GlassSelect
            value={groupFilter}
            onChange={(e) => { setGroupFilter(e.target.value); setPage(1); }}
            options={[{ value: '', label: t('students.allGroups') }, ...groups.map((g) => ({ value: g.id, label: g.name }))]}
            placeholder={t('students.allGroups')}
          />
        </div>
      </div>

      {isLoading ? (
        <GlassCard>
          <GlassPageLoader label={t('schedule.loading')} />
        </GlassCard>
      ) : error ? (
        <GlassErrorState message={getErrorMessage(error)} />
      ) : items.length === 0 ? (
        <GlassEmptyState
          title={t('schedule.empty')}
          description={t('schedule.emptyHint')}
          action={{ label: t('schedule.addEntry'), onClick: openCreate }}
        />
      ) : (
        <GlassCard padding="none">
          <GlassTable className="overflow-x-auto">
            <GlassTHead>
              <GlassTR>
                <GlassTH>{t('schedule.col.day')}</GlassTH>
                <GlassTH>{t('schedule.col.time')}</GlassTH>
                <GlassTH>{t('schedule.col.group')}</GlassTH>
                <GlassTH>{t('groups.col.room')}</GlassTH>
                <GlassTH className="w-20" />
              </GlassTR>
            </GlassTHead>
            <GlassTBody>
              {items.map((s) => (
                <GlassTR key={s.id}>
                  <GlassTD className="font-medium">{t(formatDay(s.dayOfWeek))}</GlassTD>
                  <GlassTD>{s.startTime} — {s.endTime}</GlassTD>
                  <GlassTD>{(s as Schedule & { group?: { name?: string } }).group?.name ?? '—'}</GlassTD>
                  <GlassTD>{s.room ?? '—'}</GlassTD>
                  <GlassTD>
                    <div className="flex gap-2 justify-end">
                      <GlassButton variant="ghost" size="sm" onClick={() => openEdit(s)}>
                        {t('common.edit')}
                      </GlassButton>
                      <GlassButton
                        variant="danger"
                        size="sm"
                        onClick={() => setDeleteTarget(s.id)}
                      >
                        {t('schedule.remove')}
                      </GlassButton>
                    </div>
                  </GlassTD>
                </GlassTR>
              ))}
            </GlassTBody>
          </GlassTable>
          {data && data.totalPages > 1 && (
            <div className="border-t border-[var(--border-subtle)] p-4">
              <div className="flex justify-center">
                <div className="flex gap-1">
                  {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((p) => (
                    <GlassButton
                      key={p}
                      onClick={() => setPage(p)}
                      variant={p === page ? 'primary' : 'ghost'}
                      size="sm"
                      className="w-9 h-9 text-sm font-medium rounded-xl transition-all duration-200"
                    >
                      {p}
                    </GlassButton>
                  ))}
                </div>
              </div>
            </div>
          )}
        </GlassCard>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteMut.mutate(deleteTarget);
          setDeleteTarget(null);
        }}
        description={t('schedule.removeConfirm')}
        loading={deleteMut.isPending}
      />

      <GlassModal
        open={modalOpen}
        onClose={closeModal}
        title={editEntry ? t('schedule.editTitle') : t('schedule.newTitle')}
        footer={
          <>
            <GlassButton variant="secondary" size="sm" onClick={closeModal}>
              {t('common.cancel')}
            </GlassButton>
            <GlassButton
              variant="primary"
              size="sm"
              type="submit"
              form="schedule-form"
              disabled={createMut.isPending || updateMut.isPending}
            >
              {editEntry ? t('common.save') : t('common.create')}
            </GlassButton>
          </>
        }
      >
        <form id="schedule-form" onSubmit={handleSubmit} className="space-y-4">
          <GlassSelect
            label={t('exams.form.group')}
            value={form.groupId}
            onChange={(e) => setForm((f) => ({ ...f, groupId: e.target.value }))}
            options={[{ value: '', label: t('schedule.selectGroup') }, ...groups.map((g) => ({ value: g.id, label: g.name }))]}
            placeholder={t('schedule.selectGroup')}
            error={formErrors.groupId}
          />
          <GlassSelect
            label={t('schedule.dayOfWeek')}
            value={form.dayOfWeek}
            onChange={(e) => setForm((f) => ({ ...f, dayOfWeek: e.target.value as DayOfWeek }))}
            options={DAYS.map((d) => ({ value: d, label: t(formatDay(d)) }))}
            error={formErrors.dayOfWeek}
          />
          <div className="grid grid-cols-2 gap-3">
            <GlassInput
              label={t('schedule.startTime')}
              type="time"
              value={form.startTime}
              onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
              error={formErrors.startTime}
            />
            <GlassInput
              label={t('schedule.endTime')}
              type="time"
              value={form.endTime}
              onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
              error={formErrors.endTime}
            />
          </div>
          <GlassInput
            label={t('groups.form.room')}
            value={form.room}
            onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))}
            placeholder={t('schedule.roomPlaceholder')}
            error={formErrors.room}
          />
        </form>
      </GlassModal>
    </div>
  );
}
