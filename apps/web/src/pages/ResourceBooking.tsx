import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GlassPageHeader, GlassBadge, GlassPageLoader, GlassErrorState, GlassEmptyState, GlassButton, GlassSelect, GlassModal, GlassField, GlassInput, GlassTextArea } from '@/components/ui';
import { useToast } from '@/components/ui/GlassToast';
import { resourcesApi, authApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessages';
import { useAuth } from '@/auth/AuthContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';
import { MapPin, Users } from 'lucide-react';

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
  ROOM: 'resourceBooking.type.ROOM',
  EQUIPMENT: 'resourceBooking.type.EQUIPMENT',
  VEHICLE: 'resourceBooking.type.VEHICLE',
  OTHER: 'resourceBooking.type.OTHER',
};

const BCP47: Record<string, string> = {
  uz: 'uz-UZ',
  ru: 'ru-RU',
  en: 'en-US',
};

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(BCP47[locale] ?? 'en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
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
  const { t, locale } = useI18n();
  usePageTitle(t('resourceBooking.title'));
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
      let bookedBy = user?.id ?? (user as unknown as { sub?: string } | null)?.sub;
      if (!bookedBy) {
        const me = (await authApi.me()) as { id?: string; sub?: string } | null;
        bookedBy = me?.id ?? me?.sub;
      }
      return resourcesApi.createBooking({ ...payload, bookedBy });
    },
    onSuccess: () => {
      toast.success(t('resourceBooking.created'));
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  });

  const bookings: Booking[] = bookingsQuery.data?.items ?? [];
  const resources: Resource[] = (resourcesQuery.data?.items ?? []).filter((r) => r.isActive);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.resourceId) {
      setFormError(t('resourceBooking.validation.resourceRequired'));
      return;
    }
    if (!form.title.trim()) {
      setFormError(t('homework.titleRequired'));
      return;
    }
    if (!form.start || !form.end) {
      setFormError(t('resourceBooking.validation.timesRequired'));
      return;
    }
    const startAt = new Date(form.start);
    const endAt = new Date(form.end);
    if (isNaN(startAt.getTime()) || isNaN(endAt.getTime())) {
      setFormError(t('resourceBooking.validation.timesInvalid'));
      return;
    }
    if (endAt <= startAt) {
      setFormError(t('resourceBooking.validation.endAfterStart'));
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
    <div style={{ display: "contents" }}>
      <div className="orb orb-cyan-1" />
      <div className="orb orb-indigo-1" />
      <div className="page-container space-y-4">
        <div className="flex items-start justify-between">
          <GlassPageHeader
            title={t('resourceBooking.title')}
            subtitle={t('resourceBooking.pageSubtitle')}
          />
          <GlassButton
            variant="primary"
            onClick={() => { setCreateOpen(true); setFormError(null); }}
          >
            {t('resourceBooking.add')}
          </GlassButton>
        </div>

        <div className="glass-card p-3 flex gap-2">
          <GlassButton
            size="sm"
            variant={view === 'bookings' ? 'primary' : 'ghost'}
            onClick={() => setView('bookings')}
          >
            {t('resourceBooking.tab.bookings')}
          </GlassButton>
          <GlassButton
            size="sm"
            variant={view === 'resources' ? 'primary' : 'ghost'}
            onClick={() => setView('resources')}
          >
            {t('resourceBooking.tab.resources')}
          </GlassButton>
        </div>

        {view === 'bookings' ? (
          <>
            <div className="glass-card p-3">
              <GlassSelect
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label={t('resourceBooking.filterByStatus')}
              >
                <option value="">{t('resourceBooking.allStatuses')}</option>
                <option value="PENDING">{t('resourceBooking.status.PENDING')}</option>
                <option value="CONFIRMED">{t('resourceBooking.status.CONFIRMED')}</option>
                <option value="COMPLETED">{t('resourceBooking.status.COMPLETED')}</option>
                <option value="CANCELLED">{t('resourceBooking.status.CANCELLED')}</option>
              </GlassSelect>
            </div>

            <div className="glass-card overflow-hidden">
              {bookingsQuery.isLoading ? (
                <div className="p-8"><GlassPageLoader label={t('resourceBooking.loading')} /></div>
              ) : bookingsQuery.isError ? (
                <div className="p-8">
                  <GlassErrorState
                    title={t('resourceBooking.loadFailed')}
                    message={getErrorMessage(bookingsQuery.error)}
                    onRetry={() => bookingsQuery.refetch()}
                  />
                </div>
              ) : bookings.length === 0 ? (
                <div className="p-8">
                  <GlassEmptyState
                    title={statusFilter ? t('resourceBooking.emptyFiltered') : t('resourceBooking.empty')}
                    message={
                      statusFilter
                        ? t('resourceBooking.emptyFilteredMessage')
                        : t('resourceBooking.emptyMessage')
                    }
                  />
                </div>
              ) : (
                <ul className="divide-y divide-[var(--border-subtle)]">
                  {bookings.map((b) => (
                    <li key={b.id} className="px-4 py-3 flex items-start gap-3">
                      <div className="shrink-0 mt-0.5">
                        <GlassBadge color={statusColor[b.status]}>{t(`resourceBooking.status.${b.status}`)}</GlassBadge>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm text-[var(--text-primary)] truncate">
                          {b.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted flex-wrap">
                          <span>{formatDate(b.startAt, locale)}</span>
                          <span>→</span>
                          <span>{formatDate(b.endAt, locale)}</span>
                          {b.resourceName && (
                            <>
                              <span>·</span>
                              <span>{b.resourceName}</span>
                            </>
                          )}
                          {b.attendees && (
                            <>
                              <span>·</span>
                              <span>{t('resourceBooking.attendees', { n: b.attendees })}</span>
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
              <div className="col-span-full p-8"><GlassPageLoader label={t('resourceBooking.loadingResources')} /></div>
            ) : resourcesQuery.isError ? (
              <div className="col-span-full p-8">
                <GlassErrorState
                  title={t('resourceBooking.loadFailedResources')}
                  message={getErrorMessage(resourcesQuery.error)}
                  onRetry={() => resourcesQuery.refetch()}
                />
              </div>
            ) : resources.length === 0 ? (
              <div className="col-span-full glass-card p-8">
                <GlassEmptyState
                  title={t('resourceBooking.emptyResources')}
                  message={t('resourceBooking.emptyResourcesMessage')}
                />
              </div>
            ) : resources.map((r) => (
              <div key={r.id} className="glass-card p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium text-[var(--text-primary)]">{r.name}</h3>
                  <GlassBadge color={r.isActive ? 'success' : 'muted'}>{r.isActive ? t('common.active') : t('common.inactive')}</GlassBadge>
                </div>
                <p className="text-xs text-muted mb-2">{t(TYPE_LABEL[r.type] ?? 'resourceBooking.type.OTHER')}</p>
                {r.location && <p className="text-sm text-muted mb-1 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {r.location}</p>}
                {r.capacity && <p className="text-sm text-muted mb-1 flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {t('resourceBooking.capacity', { n: r.capacity })}</p>}
                {r.description && <p className="text-xs text-muted mt-2">{r.description}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      <GlassModal
        open={createOpen}
        onClose={() => { setCreateOpen(false); setFormError(null); }}
        title={t('resourceBooking.add')}
      >
        <form onSubmit={handleCreate} className="space-y-4" noValidate>
          <GlassField label={t('resourceBooking.field.resource')} required>
            <GlassSelect
              value={form.resourceId}
              onChange={(e) => setForm((f) => ({ ...f, resourceId: e.target.value }))}
              disabled={createMutation.isPending}
              autoFocus
            >
              <option value="">{t('resourceBooking.chooseResource')}</option>
              {resources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({t(TYPE_LABEL[r.type] ?? 'resourceBooking.type.OTHER')}{r.location ? ` · ${r.location}` : ''})
                </option>
              ))}
            </GlassSelect>
          </GlassField>
          <GlassField label={t('resourceBooking.field.title')} required>
            <GlassInput
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder={t('resourceBooking.titlePlaceholder')}
              disabled={createMutation.isPending}
            />
          </GlassField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <GlassField label={t('resourceBooking.field.starts')} required>
              <GlassInput
                type="datetime-local"
                value={form.start}
                onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))}
                disabled={createMutation.isPending}
              />
            </GlassField>
            <GlassField label={t('resourceBooking.field.ends')} required>
              <GlassInput
                type="datetime-local"
                value={form.end}
                onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))}
                disabled={createMutation.isPending}
              />
            </GlassField>
          </div>
          <GlassField label={t('resourceBooking.field.attendees')} hint={t('common.optional')}>
            <GlassInput
              type="number"
              min={1}
              value={form.attendees}
              onChange={(e) => setForm((f) => ({ ...f, attendees: e.target.value }))}
              placeholder={t('resourceBooking.attendeesPlaceholder')}
              disabled={createMutation.isPending}
            />
          </GlassField>
          <GlassField label={t('resourceBooking.field.description')} hint={t('common.optional')}>
            <GlassTextArea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              disabled={createMutation.isPending}
            />
          </GlassField>
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
              {t('common.cancel')}
            </GlassButton>
            <GlassButton type="submit" variant="primary" disabled={createMutation.isPending}>
              {createMutation.isPending ? t('resourceBooking.creating') : t('resourceBooking.createSubmit')}
            </GlassButton>
          </div>
        </form>
      </GlassModal>
    </div>
  );
}
