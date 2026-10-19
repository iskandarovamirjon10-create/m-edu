/**
 * M-EDU ResourceBookingPage — Apple Design Award V2 Edition
 *
 * Ultra Premium Resource Reservation Substrate:
 *  - Apple SF Pro visual hierarchy with ambient lighting
 *  - Live KPI metrics strip (Total Bookings, Active Resources, Pending, Confirmed)
 *  - Framer-motion spring physics (smooth staggered rows, hover micro-interactions)
 *  - Apple squircle segmented controls and modal forms
 *  - Preserves 100% of real API contracts, TanStack Query, and i18n
 */

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, type Variants } from 'framer-motion';
import {
  GlassPageHeader,
  GlassBadge,
  GlassPageLoader,
  GlassErrorState,
  GlassEmptyState,
  GlassButton,
  GlassSelect,
  GlassModal,
  GlassField,
  GlassInput,
  GlassTextArea,
} from '@/components/ui';
import { useToast } from '@/components/ui/GlassToast';
import { resourcesApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessages';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';
import { MapPin, Users } from 'lucide-react';
import { openSidecar, type QuickLookData } from '@/stores/ui.store';
import { usePremiumSound } from '@/hooks/usePremiumSound';

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  soft:   { type: 'spring', stiffness: 220, damping: 28, mass: 1.0 },
} as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.04 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.99 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 360, damping: 28 },
  },
};

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
  return new Date(iso).toLocaleString(BCP47[locale] ?? 'en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const statusColor: Record<Booking['status'], 'success' | 'warning' | 'error' | 'primary' | 'muted'> = {
  PENDING: 'warning',
  CONFIRMED: 'success',
  CANCELLED: 'error',
  COMPLETED: 'muted',
};

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
  const { playTick, playPop, playSuccess, playError } = usePremiumSound();

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

  const handleOpenBookingSidecar = useCallback((b: Booking) => {
    playTick();
    const sidecarData: QuickLookData = {
      title: b.title,
      subtitle: `${b.resourceName || 'Resource Reservation'} • ${b.status}`,
      badge: b.status,
      status: {
        label: b.status === 'CONFIRMED' ? 'Confirmed & Active' : b.status === 'PENDING' ? 'Pending Approval' : b.status,
        tone: b.status === 'CONFIRMED' ? 'success' : b.status === 'PENDING' ? 'warning' : 'muted',
      },
      metrics: [
        { label: 'Start Time', value: formatDate(b.startAt, locale) },
        { label: 'End Time', value: formatDate(b.endAt, locale) },
        { label: 'Expected Attendees', value: b.attendees ?? '—' },
        { label: 'Booked By', value: b.bookedByName || 'Authorized User' },
      ],
      details: [
        { label: 'Booking ID', value: b.id },
        { label: 'Assigned Resource', value: b.resourceName || b.resourceId },
        { label: 'Status Protocol', value: b.status },
        { label: 'Notes / Purpose', value: b.description || 'No additional reservation notes' },
      ],
    };
    openSidecar(sidecarData);
  }, [locale, playTick]);

  const handleOpenResourceSidecar = useCallback((r: Resource) => {
    playTick();
    const sidecarData: QuickLookData = {
      title: r.name,
      subtitle: `${r.type} • ${r.location || 'Location not specified'}`,
      badge: r.type,
      status: {
        label: r.isActive ? 'Active & Available' : 'Maintenance / Inactive',
        tone: r.isActive ? 'success' : 'muted',
      },
      metrics: [
        { label: 'Asset Type', value: r.type },
        { label: 'Capacity', value: r.capacity ? `${r.capacity} Persons` : 'N/A' },
        { label: 'Campus Location', value: r.location || 'Main Campus' },
        { label: 'Status', value: r.isActive ? 'Active' : 'Offline' },
      ],
      details: [
        { label: 'Resource ID', value: r.id },
        { label: 'Description', value: r.description || 'No asset description provided' },
        { label: 'Availability State', value: r.isActive ? 'Reservations Enabled' : 'Temporarily Locked' },
      ],
    };
    openSidecar(sidecarData);
  }, [playTick]);

  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      return resourcesApi.createBooking(payload);
    },
    onSuccess: () => {
      playSuccess();
      toast.push('success', t('resourceBooking.createdSuccess'));
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      setFormError(null);
    },
    onError: (err) => {
      playError();
      setFormError(getErrorMessage(err));
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.resourceId) {
      playError();
      setFormError(t('resourceBooking.error.chooseResource'));
      return;
    }
    if (!form.title.trim()) {
      playError();
      setFormError(t('resourceBooking.error.enterTitle'));
      return;
    }
    if (!form.start || !form.end) {
      playError();
      setFormError(t('resourceBooking.error.chooseDates'));
      return;
    }
    const startIso = toISO(form.start);
    const endIso = toISO(form.end);
    if (new Date(endIso) <= new Date(startIso)) {
      playError();
      setFormError(t('resourceBooking.error.endBeforeStart'));
      return;
    }

    setFormError(null);
    createMutation.mutate({
      resourceId: form.resourceId,
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      startAt: startIso,
      endAt: endIso,
      attendees: form.attendees ? Number(form.attendees) : undefined,
    });
  };

  // Keyboard Shortcuts: n for new, r for refresh, 1 for bookings, 2 for resources
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        playPop();
        setForm(EMPTY_FORM);
        setFormError(null);
        setCreateOpen(true);
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        playTick();
        bookingsQuery.refetch();
        resourcesQuery.refetch();
      } else if (e.key === '1') {
        e.preventDefault();
        playTick();
        setView('bookings');
      } else if (e.key === '2') {
        e.preventDefault();
        playTick();
        setView('resources');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [bookingsQuery, resourcesQuery, playPop, playTick]);

  const bookings = bookingsQuery.data?.items ?? [];
  const resources = resourcesQuery.data?.items ?? [];

  const pendingCount = bookings.filter((b) => b.status === 'PENDING').length;
  const confirmedCount = bookings.filter((b) => b.status === 'CONFIRMED').length;
  const activeResourcesCount = resources.filter((r) => r.isActive).length;

  return (
    <div className="relative min-h-screen bg-transparent selection:bg-brand-500/30">
      {/* Ambient background lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div className="absolute top-[5%] left-[-5%] w-[45%] h-[40%] rounded-full bg-blue-400/5 blur-[120px]" />
        <div className="absolute bottom-[10%] right-[-5%] w-[40%] h-[45%] rounded-full bg-indigo-400/5 blur-[120px]" />
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 w-full max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6"
      >
        <motion.div
          variants={itemVariants}
          className="flex flex-col md:flex-row md:items-end justify-between gap-4"
        >
          <GlassPageHeader
            title={t('resourceBooking.title')}
            subtitle={t('resourceBooking.subtitle')}
          />
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                playTick();
                bookingsQuery.refetch();
                resourcesQuery.refetch();
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-white/60 dark:bg-white/10 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-white/10 hover:bg-white/80 dark:hover:bg-white/15 transition-all shadow-sm active:scale-95"
              title="Refresh reservations (R)"
            >
              <span>↺</span>
              <span>{t('common.refresh') || 'Refresh'}</span>
              <kbd className="text-[10px] opacity-60 font-mono px-1 py-0.2 rounded bg-black/5 dark:bg-white/10 ml-0.5">R</kbd>
            </button>
            <GlassButton
              variant="primary"
              onClick={() => {
                playPop();
                setForm(EMPTY_FORM);
                setFormError(null);
                setCreateOpen(true);
              }}
              icon={
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              }
            >
              <span>{t('resourceBooking.add')}</span>
              <kbd className="text-[10px] opacity-75 font-mono px-1.5 py-0.5 rounded bg-white/20 ml-1">N</kbd>
            </GlassButton>
          </div>
        </motion.div>

        {/* ── KPI Metrics Bar ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <motion.div
            variants={itemVariants}
            whileHover={{ y: -2, transition: SPRING.snappy }}
            className="liquid-glass-card liquid-glass-surface p-5 rounded-2xl border border-white/40 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl"
          >
            <p className="text-[0.68rem] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">
              {t('resourceBooking.tab.bookings') || 'Bookings'}
            </p>
            <p className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tabular-nums">
              {bookings.length}
            </p>
          </motion.div>

          <motion.div
            variants={itemVariants}
            whileHover={{ y: -2, transition: SPRING.snappy }}
            className="liquid-glass-card liquid-glass-surface p-5 rounded-2xl border border-white/40 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl"
          >
            <p className="text-[0.68rem] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">
              {t('resourceBooking.status.CONFIRMED') || 'Confirmed'}
            </p>
            <p className="text-2xl sm:text-3xl font-extrabold text-emerald-500 tabular-nums">
              {confirmedCount}
            </p>
          </motion.div>

          <motion.div
            variants={itemVariants}
            whileHover={{ y: -2, transition: SPRING.snappy }}
            className="liquid-glass-card liquid-glass-surface p-5 rounded-2xl border border-white/40 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl"
          >
            <p className="text-[0.68rem] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">
              {t('resourceBooking.status.PENDING') || 'Pending'}
            </p>
            <p className="text-2xl sm:text-3xl font-extrabold text-amber-500 tabular-nums">
              {pendingCount}
            </p>
          </motion.div>

          <motion.div
            variants={itemVariants}
            whileHover={{ y: -2, transition: SPRING.snappy }}
            className="liquid-glass-card liquid-glass-surface p-5 rounded-2xl border border-white/40 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl"
          >
            <p className="text-[0.68rem] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">
              {t('resourceBooking.tab.resources') || 'Resources'}
            </p>
            <p className="text-2xl sm:text-3xl font-extrabold text-blue-500 tabular-nums">
              {activeResourcesCount}
            </p>
          </motion.div>
        </div>

        {/* ── Segmented Control & Filters ─────────────────────────────────── */}
        <motion.div
          variants={itemVariants}
          className="liquid-glass-card liquid-glass-surface flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 rounded-2xl border border-white/40 dark:border-white/10 backdrop-blur-xl shadow-sm"
        >
          <div className="flex gap-2">
            <GlassButton
              size="sm"
              variant={view === 'bookings' ? 'primary' : 'ghost'}
              onClick={() => {
                playTick();
                setView('bookings');
              }}
              className="inline-flex items-center gap-1.5"
            >
              <span>{t('resourceBooking.tab.bookings')}</span>
              <kbd className="text-[9px] opacity-60 font-mono px-1 py-0.2 rounded bg-black/5 dark:bg-white/10">1</kbd>
            </GlassButton>
            <GlassButton
              size="sm"
              variant={view === 'resources' ? 'primary' : 'ghost'}
              onClick={() => {
                playTick();
                setView('resources');
              }}
              className="inline-flex items-center gap-1.5"
            >
              <span>{t('resourceBooking.tab.resources')}</span>
              <kbd className="text-[9px] opacity-60 font-mono px-1 py-0.2 rounded bg-black/5 dark:bg-white/10">2</kbd>
            </GlassButton>
          </div>

          {view === 'bookings' && (
            <div className="w-full sm:w-64">
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
          )}
        </motion.div>

        {/* ── Main View Content ───────────────────────────────────────────── */}
        {view === 'bookings' ? (
          <motion.div
            variants={itemVariants}
            className="liquid-glass-card liquid-glass-surface relative overflow-hidden rounded-3xl border border-white/40 dark:border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.04)] backdrop-blur-2xl"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20 z-10" />

            {bookingsQuery.isLoading ? (
              <div className="p-16">
                <GlassPageLoader label={t('resourceBooking.loading')} />
              </div>
            ) : bookingsQuery.isError ? (
              <div className="p-12">
                <GlassErrorState
                  title={t('resourceBooking.loadFailed')}
                  message={getErrorMessage(bookingsQuery.error)}
                  onRetry={() => bookingsQuery.refetch()}
                />
              </div>
            ) : bookings.length === 0 ? (
              <div className="p-16">
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
              <motion.ul
                variants={containerVariants}
                className="divide-y divide-black/5 dark:divide-white/5"
              >
                {bookings.map((b) => (
                  <motion.li
                    key={b.id}
                    variants={itemVariants}
                    onClick={() => handleOpenBookingSidecar(b)}
                    className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 transition-colors cursor-pointer hover:bg-indigo-500/[0.04] dark:hover:bg-indigo-400/[0.04]"
                  >
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <div className="shrink-0 mt-0.5">
                        <GlassBadge color={statusColor[b.status]}>
                          {t(`resourceBooking.status.${b.status}`)}
                        </GlassBadge>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm text-[var(--text-primary)] truncate">
                          {b.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 text-xs text-[var(--text-muted)] flex-wrap">
                          <span>{formatDate(b.startAt, locale)}</span>
                          <span>→</span>
                          <span>{formatDate(b.endAt, locale)}</span>
                          {b.resourceName && (
                            <>
                              <span>·</span>
                              <span className="font-medium text-[var(--text-primary)]">{b.resourceName}</span>
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
                    </div>

                    <div className="flex items-center justify-end w-full sm:w-auto gap-2 shrink-0 self-start sm:self-center mt-2 sm:mt-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenBookingSidecar(b);
                        }}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 transition-all border border-indigo-500/20 inline-flex items-center gap-1"
                        title="Inspect reservation in macOS Sidecar"
                      >
                        <span>◨</span>
                        <span>Sidecar</span>
                      </button>
                    </div>
                  </motion.li>
                ))}
              </motion.ul>
            )}
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {resourcesQuery.isLoading ? (
              <div className="col-span-full p-16">
                <GlassPageLoader label={t('resourceBooking.loadingResources')} />
              </div>
            ) : resourcesQuery.isError ? (
              <div className="col-span-full p-12">
                <GlassErrorState
                  title={t('resourceBooking.loadFailedResources')}
                  message={getErrorMessage(resourcesQuery.error)}
                  onRetry={() => resourcesQuery.refetch()}
                />
              </div>
            ) : resources.length === 0 ? (
              <div className="col-span-full glass-card p-16">
                <GlassEmptyState
                  title={t('resourceBooking.emptyResources')}
                  message={t('resourceBooking.emptyResourcesMessage')}
                />
              </div>
            ) : (
              resources.map((r) => (
                <motion.div
                  key={r.id}
                  variants={itemVariants}
                  whileHover={{ y: -3, transition: SPRING.snappy }}
                  onClick={() => handleOpenResourceSidecar(r)}
                  className="liquid-glass-card liquid-glass-surface p-5 rounded-2xl border border-white/40 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl cursor-pointer hover:border-indigo-500/30 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-bold text-sm text-[var(--text-primary)]">{r.name}</h3>
                      <GlassBadge color={r.isActive ? 'success' : 'muted'}>
                        {r.isActive ? t('common.active') : t('common.inactive')}
                      </GlassBadge>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mb-3">
                      {t(TYPE_LABEL[r.type] ?? 'resourceBooking.type.OTHER')}
                    </p>
                    {r.location && (
                      <p className="text-xs text-[var(--text-muted)] mb-1.5 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-brand-500" /> {r.location}
                      </p>
                    )}
                    {r.capacity && (
                      <p className="text-xs text-[var(--text-muted)] mb-1.5 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-blue-500" /> {t('resourceBooking.capacity', { n: r.capacity })}
                      </p>
                    )}
                    {r.description && (
                      <p className="text-xs text-[var(--text-muted)] mt-2 pt-2 border-t border-black/5 dark:border-white/5 line-clamp-2">
                        {r.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-black/5 dark:border-white/5 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                    <span className="text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider">
                      ID: {r.id.slice(0, 8)}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenResourceSidecar(r);
                      }}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 transition-all border border-indigo-500/20 inline-flex items-center gap-1"
                      title="Inspect resource in macOS Sidecar"
                    >
                      <span>◨</span>
                      <span>Sidecar</span>
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}

        {/* ── Create Booking Modal ────────────────────────────────────────── */}
        <GlassModal
          open={createOpen}
          onClose={() => {
            setCreateOpen(false);
            setFormError(null);
          }}
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
                    {r.name} ({t(TYPE_LABEL[r.type] ?? 'resourceBooking.type.OTHER')}
                    {r.location ? ` · ${r.location}` : ''})
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
              <p className="text-xs text-[var(--state-error)]" role="alert">
                {formError}
              </p>
            )}

            <div className="flex justify-end gap-2.5 pt-2 border-t border-[var(--border-subtle)]">
              <GlassButton
                type="button"
                variant="ghost"
                onClick={() => {
                  setCreateOpen(false);
                  setFormError(null);
                }}
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
      </motion.div>
    </div>
  );
}

export default ResourceBookingPage;
