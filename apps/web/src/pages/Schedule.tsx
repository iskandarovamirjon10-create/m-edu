import { useMemo, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { scheduleApi, groupsApi } from '@/lib/api';
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
  GlassTabs,
  GlassModal,
  GlassSelect,
  GlassInput,
  GlassButton,
  useToast,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, Schedule, Group, DayOfWeek } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';

const DAYS: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

function formatDay(d: DayOfWeek): string {
  return d.charAt(0) + d.slice(1).toLowerCase();
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
  usePageTitle('Schedule');
  const { push, toastNode } = useToast();
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [groupFilter, setGroupFilter] = useState('');
  const [dayFilter, setDayFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<Schedule | null>(null);

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
    queryKey: ['groups-select'],
    queryFn: () => groupsApi.list({ limit: 200 }),
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
      push('success', 'Schedule entry created');
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
      push('success', 'Schedule entry updated');
      closeModal();
    },
    onError: (e: unknown) => push('error', getErrorMessage(e)),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => scheduleApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule'] });
      push('success', 'Schedule entry removed');
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
    if (!form.groupId) errs.groupId = 'Required';
    if (!form.startTime) errs.startTime = 'Required';
    if (!form.endTime) errs.endTime = 'Required';
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
    { id: '', label: 'All Days' },
    ...DAYS.map((d) => ({ id: d, label: formatDay(d) })),
  ];

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
        title="Schedule"
        description={`${data?.total ?? 0} entries`}
        actions={
          <GlassButton variant="primary" size="sm" onClick={openCreate}>
            Add Entry
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
            options={[{ value: '', label: 'All groups' }, ...groups.map((g) => ({ value: g.id, label: g.name }))]}
            placeholder="All groups"
          />
        </div>
      </div>

      {isLoading ? (
        <GlassCard>
          <GlassPageLoader label="Loading schedule…" />
        </GlassCard>
      ) : error ? (
        <GlassErrorState message={getErrorMessage(error)} />
      ) : items.length === 0 ? (
        <GlassEmptyState
          title="No schedule entries"
          description="Create the first schedule entry to get started."
          action={{ label: 'Add Entry', onClick: openCreate }}
        />
      ) : (
        <GlassCard padding="none">
          <GlassTable className="overflow-x-auto">
            <GlassTHead>
              <GlassTR>
                <GlassTH>Day</GlassTH>
                <GlassTH>Time</GlassTH>
                <GlassTH>Group</GlassTH>
                <GlassTH>Room</GlassTH>
                <GlassTH className="w-20" />
              </GlassTR>
            </GlassTHead>
            <GlassTBody>
              {items.map((s) => (
                <GlassTR key={s.id}>
                  <GlassTD className="font-medium">{formatDay(s.dayOfWeek)}</GlassTD>
                  <GlassTD>{s.startTime} — {s.endTime}</GlassTD>
                  <GlassTD>{(s as Schedule & { group?: { name?: string } }).group?.name ?? '—'}</GlassTD>
                  <GlassTD>{s.room ?? '—'}</GlassTD>
                  <GlassTD>
                    <div className="flex gap-2 justify-end">
                      <GlassButton variant="ghost" size="sm" onClick={() => openEdit(s)}>Edit</GlassButton>
                      <GlassButton
                        variant="danger"
                        size="sm"
                        onClick={() => { if (confirm('Remove this schedule entry?')) deleteMut.mutate(s.id); }}
                      >
                        Remove
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
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={[
                        'w-9 h-9 text-sm font-medium rounded-xl transition-all duration-200',
                        p === page
                          ? 'glass-btn-primary glass-btn-sm'
                          : 'glass-btn-ghost glass-btn-sm',
                      ].join(' ')}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </GlassCard>
      )}

      <GlassModal
        open={modalOpen}
        onClose={closeModal}
        title={editEntry ? 'Edit Schedule' : 'New Schedule Entry'}
        footer={
          <>
            <GlassButton variant="secondary" size="sm" onClick={closeModal}>Cancel</GlassButton>
            <GlassButton
              variant="primary"
              size="sm"
              type="submit"
              form="schedule-form"
              disabled={createMut.isPending || updateMut.isPending}
            >
              {editEntry ? 'Save' : 'Create'}
            </GlassButton>
          </>
        }
      >
        <form id="schedule-form" onSubmit={handleSubmit} className="space-y-4">
          <GlassSelect
            label="Group"
            value={form.groupId}
            onChange={(e) => setForm((f) => ({ ...f, groupId: e.target.value }))}
            options={[{ value: '', label: 'Select group' }, ...groups.map((g) => ({ value: g.id, label: g.name }))]}
            placeholder="Select group"
            error={formErrors.groupId}
          />
          <GlassSelect
            label="Day of Week"
            value={form.dayOfWeek}
            onChange={(e) => setForm((f) => ({ ...f, dayOfWeek: e.target.value as DayOfWeek }))}
            options={DAYS.map((d) => ({ value: d, label: formatDay(d) }))}
            error={formErrors.dayOfWeek}
          />
          <div className="grid grid-cols-2 gap-3">
            <GlassInput
              label="Start Time"
              type="time"
              value={form.startTime}
              onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
              error={formErrors.startTime}
            />
            <GlassInput
              label="End Time"
              type="time"
              value={form.endTime}
              onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
              error={formErrors.endTime}
            />
          </div>
          <GlassInput
            label="Room"
            value={form.room}
            onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))}
            placeholder="e.g. Room 101"
            error={formErrors.room}
          />
        </form>
      </GlassModal>
    </div>
  );
}
