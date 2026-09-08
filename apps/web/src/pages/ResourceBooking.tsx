import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader, Badge, PageLoader, ErrorState, EmptyState, GlassButton, Select, GlassModal, Field, TextInput, TextArea } from '@/components/ui';
import { useToast } from '@/components/ui/GlassToast';
import { resourcesApi, authApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessages';
import { useAuth } from '@/auth/AuthContext';
import { usePageTitle } from '@/hooks/usePageTitle';

interface Resource {
  id: string;
  name: string;
  type: 'ROOM' | 'EQUIPMENT' | 'VEHICLE' | 'OTHER';
  capacity?: number;
  location?: string;
  description?: string;
  isActive: boolean;
}

interface Booking {
  id: string;
  resourceId: string;
  resourceName?: string;
  title: string;
  description?: string;
  startAt: string;
  endAt: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  bookedByName?: string;
  attendees?: number;
}

const TYPE_LABEL: Record<Resource['type'], string> = {
  ROOM: 'Room',
  EQUIPMENT: 'Equipment',
  VEHICLE: 'Vehicle',
  OTHER: 'Other',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const statusColor: Record<Booking['status'], 'success' | 'warning' | 'error' | 'primary' | 'muted'> = {
  PENDING: 'warning',
  CONFIRMED: 'success',
  CANCELLED: 'error',
  COMPLETED: 'muted',
};

/** Convert a datetime-local input value to ISO (input gives local time). */
function toISO(localValue: string): string {
  return new Date(localValue).toISOString();
}

const EMPTY_FORM = {
  resourceId: '',
  title: '',
  description: '',
  start: '',
  end: '',
  attendees: '',
};

export function ResourceBookingPage() {
  usePageTitle('Resource Booking');
  const queryClient = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();
  const [view, setView] = useState<'bookings' | 'resources'>('bookings');
  const [statusFilter, setStatusFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const bookingsQuery = useQuery({
    queryKey: ['bookings', statusFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      return resourcesApi.bookings(params) as Promise<{ items: Booking[]; total: number }>;
    },
  });

  const resourcesQuery = useQuery({
    queryKey: ['resources'],
    queryFn: () => resourcesApi.list() as Promise<{ items: Resource[]; total: number }>,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      // bookedBy is required by the schema — resolve the current user's id,
      // falling back to /auth/me if the context is missing it.
      let bookedBy = (user as any)?.id ?? (user as any)?.sub;
      if (!bookedBy) {
        const me = (await authApi.me()) as any;
        bookedBy = me?.id ?? me?.sub;
      }
      return resourcesApi.createBooking({ ...payload, bookedBy });
    },
    onSuccess: () => {
      toast.success('Booking created');
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  });

  const bookings: Booking[] = (bookingsQuery.data as any)?.items ?? [];
  const resources: Resource[] = ((resourcesQuery.data as any)?.items ?? []).filter((r: Resource) => r.isActive);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.resourceId) {
      setFormError('Please choose a resource.');
      return;
    }
    if (!form.title.trim()) {
      setFormError('Title is required.');
      return;
    }
    if (!form.start || !form.end) {
      setFormError('Start and end times are required.');
      return;
    }
    const startAt = new Date(form.start);
    const endAt = new Date(form.end);
    if (isNaN(startAt.getTime()) || isNaN(endAt.getTime())) {
      setFormError('Start and end must be valid dates.');
      return;
    }
    if (endAt <= startAt) {
      setFormError('End time must be after the start time.');
      return;
    }
    setFormError(null);
    createMutation.mutate({
      resourceId: form.resourceId,
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      startAt: toISO(form.start),
      endAt: toISO(form.end),
      attendees: form.attendees ? Number(form.attendees) : undefined,
    });
  };

  return (
    <div className="orb-container">
      <div className="orb orb-cyan-1" />
      <div className="orb orb-indigo-1" />
      <div className="page-container space-y-4">
        <div className="flex items-start justify-between">
          <PageHeader
            title="Resource Booking"
            subtitle="Rooms, equipment, vehicles — every shared resource in one place"
          />
          <GlassButton
            variant="primary"
            onClick={() => { setCreateOpen(true); setFormError(null); }}
          >
            New booking
          </GlassButton>
        </div>

        <div className="glass-card p-3 flex gap-2">
          <GlassButton
            size="sm"
            variant={view === 'bookings' ? 'primary' : 'ghost'}
            onClick={() => setView('bookings')}
          >
            Bookings
          </GlassButton>
          <GlassButton
            size="sm"
            variant={view === 'resources' ? 'primary' : 'ghost'}
            onClick={() => setView('resources')}
          >
            Resources
          </GlassButton>
        </div>

        {view === 'bookings' ? (
          <>
            <div className="glass-card p-3">
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by status"
              >
                <option value="">All statuses</option>
                <option value="PENDING">Pending</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </Select>
            </div>

            <div className="glass-card overflow-hidden">
              {bookingsQuery.isLoading ? (
                <div className="p-8"><PageLoader label="Loading bookings…" /></div>
              ) : bookingsQuery.isError ? (
                <div className="p-8">
                  <ErrorState
                    title="Failed to load bookings"
                    message={getErrorMessage(bookingsQuery.error)}
                    onRetry={() => bookingsQuery.refetch()}
                  />
                </div>
              ) : bookings.length === 0 ? (
                <div className="p-8">
                  <EmptyState
                    title={statusFilter ? 'No bookings with this status' : 'No bookings yet'}
                    message={
                      statusFilter
                        ? 'Try a different status filter.'
                        : 'Schedule a room or piece of equipment to see it here.'
                    }
                  />
                </div>
              ) : (
                <ul className="divide-y divide-[var(--border-subtle)]">
                  {bookings.map((b) => (
                    <li key={b.id} className="px-4 py-3 flex items-start gap-3">
                      <div className="shrink-0 mt-0.5">
                        <Badge color={statusColor[b.status]}>{b.status}</Badge>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm text-[var(--text-primary)] truncate">
                          {b.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted flex-wrap">
                          <span>{formatDate(b.startAt)}</span>
                          <span>→</span>
                          <span>{formatDate(b.endAt)}</span>
                          {b.resourceName && (
                            <>
                              <span>·</span>
                              <span>{b.resourceName}</span>
                            </>
                          )}
                          {b.attendees && (
                            <>
                              <span>·</span>
                              <span>{b.attendees} attendees</span>
                            </>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {resourcesQuery.isLoading ? (
              <div className="col-span-full p-8"><PageLoader label="Loading resources…" /></div>
            ) : resourcesQuery.isError ? (
              <div className="col-span-full p-8">
                <ErrorState
                  title="Failed to load resources"
                  message={getErrorMessage(resourcesQuery.error)}
                  onRetry={() => resourcesQuery.refetch()}
                />
              </div>
            ) : resources.length === 0 ? (
              <div className="col-span-full glass-card p-8">
                <EmptyState
                  title="No active resources"
                  message="Add rooms, projectors, and other shared equipment in the Resources API to see them here."
                />
              </div>
            ) : resources.map((r) => (
              <div key={r.id} className="glass-card p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium text-[var(--text-primary)]">{r.name}</h3>
                  <Badge color={r.isActive ? 'success' : 'muted'}>{r.isActive ? 'Active' : 'Inactive'}</Badge>
                </div>
                <p className="text-xs text-muted mb-2">{TYPE_LABEL[r.type] ?? r.type}</p>
                {r.location && <p className="text-sm text-muted mb-1">📍 {r.location}</p>}
                {r.capacity && <p className="text-sm text-muted mb-1">👥 Capacity {r.capacity}</p>}
                {r.description && <p className="text-xs text-muted mt-2">{r.description}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      <GlassModal
        open={createOpen}
        onClose={() => { setCreateOpen(false); setFormError(null); }}
        title="New booking"
      >
        <form onSubmit={handleCreate} className="space-y-4" noValidate>
          <Field label="Resource" required>
            <Select
              value={form.resourceId}
              onChange={(e) => setForm((f) => ({ ...f, resourceId: e.target.value }))}
              disabled={createMutation.isPending}
              autoFocus
            >
              <option value="">Choose a resource…</option>
              {resources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({TYPE_LABEL[r.type] ?? r.type}{r.location ? ` · ${r.location}` : ''})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Title" required>
            <TextInput
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. IELTS mock exam — Room 2"
              disabled={createMutation.isPending}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Starts" required>
              <TextInput
                type="datetime-local"
                value={form.start}
                onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))}
                disabled={createMutation.isPending}
              />
            </Field>
            <Field label="Ends" required>
              <TextInput
                type="datetime-local"
                value={form.end}
                onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))}
                disabled={createMutation.isPending}
              />
            </Field>
          </div>
          <Field label="Attendees" hint="Optional">
            <TextInput
              type="number"
              min={1}
              value={form.attendees}
              onChange={(e) => setForm((f) => ({ ...f, attendees: e.target.value }))}
              placeholder="e.g. 12"
              disabled={createMutation.isPending}
            />
          </Field>
          <Field label="Description" hint="Optional">
            <TextArea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              disabled={createMutation.isPending}
            />
          </Field>
          {formError && (
            <p className="text-sm text-[var(--state-error)]" role="alert">{formError}</p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <GlassButton
              type="button"
              variant="ghost"
              onClick={() => { setCreateOpen(false); setFormError(null); }}
              disabled={createMutation.isPending}
            >
              Cancel
            </GlassButton>
            <GlassButton type="submit" variant="primary" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating…' : 'Create booking'}
            </GlassButton>
          </div>
        </form>
      </GlassModal>
    </div>
  );
}
