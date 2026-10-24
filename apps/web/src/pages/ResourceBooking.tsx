/**
 * M-EDU ResourceBookingPage — Apple visionOS & macOS Sequoia 10/10 Edition
 *
 * Ultra Premium Resource Reservation Substrate:
 *  - Apple visionOS specular liquid glass styling with meniscus rim highlights.
 *  - Dynamic Aurora mesh backdrop with ambient lighting.
 *  - Animated KPI metrics strip (Total Bookings, Confirmed, Pending, Resources).
 *  - WCAG 2.2 AA SC 2.5.8 compliant touch targets (>= 44x44px for all controls).
 *  - macOS Split-View Sidecar integration for instant resource & booking inspection.
 *  - Apple spring physics (SPRING.snappy, SPRING.smooth).
 *  - Trilingual resilience using `useSafeI18n()` (UZ, RU, EN).
 *  - Sound feedback via `usePremiumSound` (pop, tick, success, error).
 *  - 100% preserved API contracts, TanStack Query, and mutations.
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
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
import { useSafeI18n } from '@/i18n/I18nProvider';
import { openSidecar, type QuickLookData } from '@/stores/ui.store';
import { usePremiumSound } from '@/hooks/usePremiumSound';

/* ============================================================================
 * MOTION TOKENS
 * ========================================================================== */

export const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  soft:   { type: 'spring', stiffness: 220, damping: 28, mass: 1.0 },
} as const;

export const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.04 },
  },
};

export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: SPRING.smooth,
  },
};

/* ============================================================================
 * TYPES & DOMAIN CONTRACTS
 * ========================================================================== */

export interface Resource {
  id: string;
  name: string;
  type: 'ROOM' | 'EQUIPMENT' | 'VEHICLE' | 'OTHER';
  capacity?: number;
  location?: string;
  description?: string;
  isActive: boolean;
}

export interface Booking {
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

export interface BookingFormState {
  resourceId: string;
  title: string;
  description: string;
  start: string;
  end: string;
  attendees: string;
}

export const EMPTY_FORM: BookingFormState = {
  resourceId: '',
  title: '',
  description: '',
  start: '',
  end: '',
  attendees: '',
};

export const TYPE_LABEL: Record<Resource['type'], string> = {
  ROOM: 'resourceBooking.type.ROOM',
  EQUIPMENT: 'resourceBooking.type.EQUIPMENT',
  VEHICLE: 'resourceBooking.type.VEHICLE',
  OTHER: 'resourceBooking.type.OTHER',
};

export const statusColor: Record<Booking['status'], 'success' | 'warning' | 'error' | 'primary' | 'muted'> = {
  PENDING: 'warning',
  CONFIRMED: 'success',
  CANCELLED: 'error',
  COMPLETED: 'muted',
};

/* ============================================================================
 * PURE DOMAIN HELPERS
 * ========================================================================== */

export function toISO(localValue: string): string {
  return new Date(localValue).toISOString();
}

export function formatBookingDateTime(iso: string, locale = 'uz-UZ'): string {
  try {
    return new Date(iso).toLocaleString(locale, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function validateBookingForm(
  form: BookingFormState,
  t: (k: string, f?: string) => string = (_k, f) => f || _k,
): string | null {
  if (!form.resourceId) {
    return t('resourceBooking.error.chooseResource', 'Iltimos, resursni tanlang');
  }
  if (!form.title.trim()) {
    return t('resourceBooking.error.enterTitle', 'Bronlash maqsadini kiriting');
  }
  if (!form.start || !form.end) {
    return t('resourceBooking.error.chooseDates', 'Boshlanish va tugash vaqtini kiriting');
  }
  const startIso = toISO(form.start);
  const endIso = toISO(form.end);
  if (new Date(endIso) <= new Date(startIso)) {
    return t('resourceBooking.error.endBeforeStart', 'Tugash vaqti boshlanish vaqtidan keyin bo\'lishi shart');
  }
  return null;
}

export function computeBookingStats(bookings: Booking[], resources: Resource[]) {
  const total = bookings.length;
  const confirmed = bookings.filter((b) => b.status === 'CONFIRMED').length;
  const pending = bookings.filter((b) => b.status === 'PENDING').length;
  const activeResources = resources.filter((r) => r.isActive).length;
  return { total, confirmed, pending, activeResources };
}

/* ============================================================================
 * ATMOSPHERIC AURORA MESH
 * ========================================================================== */

export function AuroraBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute -top-40 left-1/4 h-96 w-96 rounded-full blur-3xl opacity-30 dark:opacity-20 animate-pulse"
        style={{
          background: 'radial-gradient(circle, rgba(0,122,255,0.4) 0%, rgba(175,82,222,0.25) 60%, transparent 80%)',
          animationDuration: '10s',
        }}
      />
      <div
        className="absolute bottom-20 right-10 h-80 w-80 rounded-full blur-3xl opacity-25 dark:opacity-15 animate-pulse"
        style={{
          background: 'radial-gradient(circle, rgba(52,199,89,0.3) 0%, rgba(0,122,255,0.15) 70%, transparent 85%)',
          animationDuration: '12s',
        }}
      />
    </div>
  );
}

/* ============================================================================
 * COUNT UP NUMBER
 * ========================================================================== */

export function CountUp({
  value,
  duration = 1.0,
}: {
  value: number;
  duration?: number;
}) {
  const [n, setN] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    let raf: number;
    startRef.current = null;
    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const p = Math.min(1, (ts - startRef.current) / (duration * 1000));
      const eased = 1 - Math.pow(1 - p, 4);
      setN(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <span className="tabular-nums">{n.toLocaleString()}</span>;
}

/* ============================================================================
 * MAIN COMPONENT: ResourceBookingPage
 * ========================================================================== */

export function ResourceBookingPage() {
  const { t, locale } = useSafeI18n();
  usePageTitle(t('resourceBooking.title', 'Resurslarni bron qilish'));
  const queryClient = useQueryClient();
  const toast = useToast();
  const { playTick, playPop, playSuccess, playError } = usePremiumSound();

  const [view, setView] = useState<'bookings' | 'resources'>('bookings');
  const [statusFilter, setStatusFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<BookingFormState>(EMPTY_FORM);
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

  const bookings = useMemo(() => bookingsQuery.data?.items ?? [], [bookingsQuery.data]);
  const resources = useMemo(() => resourcesQuery.data?.items ?? [], [resourcesQuery.data]);
  const stats = useMemo(() => computeBookingStats(bookings, resources), [bookings, resources]);

  const handleOpenBookingSidecar = useCallback(
    (b: Booking) => {
      playTick();
      const sidecarData: QuickLookData = {
        id: b.id,
        type: 'general',
        title: b.title,
        subtitle: `${b.resourceName || 'Resource Reservation'} • ${b.status}`,
        badge: b.status,
        status: {
          label:
            b.status === 'CONFIRMED'
              ? 'Confirmed & Active'
              : b.status === 'PENDING'
              ? 'Pending Approval'
              : b.status,
          tone: b.status === 'CONFIRMED' ? 'emerald' : b.status === 'PENDING' ? 'amber' : 'slate',
        },
        metrics: [
          { label: 'Start Time', value: formatBookingDateTime(b.startAt, locale) },
          { label: 'End Time', value: formatBookingDateTime(b.endAt, locale) },
          { label: 'Expected Attendees', value: b.attendees ?? '—' },
          { label: 'Booked By', value: b.bookedByName || 'Authorized User' },
        ],
        details: [
          { label: 'Booking ID', value: b.id, copyable: true },
          { label: 'Assigned Resource', value: b.resourceName || b.resourceId },
          { label: 'Status Protocol', value: b.status },
          { label: 'Notes / Purpose', value: b.description || 'No additional reservation notes' },
        ],
      };
      openSidecar(sidecarData);
    },
    [locale, playTick],
  );

  const handleOpenResourceSidecar = useCallback(
    (r: Resource) => {
      playTick();
      const sidecarData: QuickLookData = {
        id: r.id,
        type: 'general',
        title: r.name,
        subtitle: `${r.type} • ${r.location || 'Location not specified'}`,
        badge: r.type,
        status: {
          label: r.isActive ? 'Active & Available' : 'Maintenance / Inactive',
          tone: r.isActive ? 'emerald' : 'slate',
        },
        metrics: [
          { label: 'Asset Type', value: r.type },
          { label: 'Capacity', value: r.capacity ? `${r.capacity} Persons` : 'N/A' },
          { label: 'Campus Location', value: r.location || 'Main Campus' },
          { label: 'Status', value: r.isActive ? 'Active' : 'Offline' },
        ],
        details: [
          { label: 'Resource ID', value: r.id, copyable: true },
          { label: 'Description', value: r.description || 'No asset description provided' },
          { label: 'Availability State', value: r.isActive ? 'Reservations Enabled' : 'Temporarily Locked' },
        ],
      };
      openSidecar(sidecarData);
    },
    [playTick],
  );

  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      return resourcesApi.createBooking(payload);
    },
    onSuccess: () => {
      playSuccess();
      toast.push('success', t('resourceBooking.createdSuccess', 'Bronlash muvaffaqiyatli saqlandi!'));
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
    const errorMsg = validateBookingForm(form, t);
    if (errorMsg) {
      playError();
      setFormError(errorMsg);
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

  return (
    <div className="relative page-container space-y-6 pb-[max(6rem,env(safe-area-inset-bottom))] selection:bg-blue-500/30">
      <AuroraBackdrop />

      {/* Top Header */}
      <motion.div
        variants={itemVariants}
        initial="hidden"
        animate="visible"
        className="flex flex-col md:flex-row md:items-end justify-between gap-4"
      >
        <GlassPageHeader
          title={t('resourceBooking.title', 'Resurslarni bron qilish')}
          subtitle={t(
            'resourceBooking.subtitle',
            'Auditoriyalar, laboratoriyalar va uskunalarni rejalashtirish va nazorat qilish',
          )}
        />
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              playTick();
              bookingsQuery.refetch();
              resourcesQuery.refetch();
            }}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold bg-white/70 dark:bg-surface-900/70 text-slate-700 dark:text-slate-200 border border-black/[0.08] dark:border-white/[0.12] hover:bg-white dark:hover:bg-surface-800 transition-all shadow-sm active:scale-95"
            title="Refresh reservations (R)"
          >
            <span>↺</span>
            <span>{t('common.refresh', 'Yangilash')}</span>
            <kbd className="text-[10px] opacity-60 font-mono px-1 py-0.5 rounded bg-black/5 dark:bg-white/10 ml-0.5">
              R
            </kbd>
          </button>
          <GlassButton
            variant="primary"
            onClick={() => {
              playPop();
              setForm(EMPTY_FORM);
              setFormError(null);
              setCreateOpen(true);
            }}
            className="min-h-[44px] shadow-sm"
            icon={
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            }
          >
            <span>{t('resourceBooking.add', 'Bron qilish')}</span>
            <kbd className="text-[10px] opacity-75 font-mono px-1.5 py-0.5 rounded bg-white/20 ml-1">N</kbd>
          </GlassButton>
        </div>
      </motion.div>

      {/* ── KPI Metrics Bar ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 sm:gap-4">
        <motion.div
          variants={itemVariants}
          whileHover={{ y: -2, transition: SPRING.snappy }}
          className="liquid-glass-surface p-4.5 rounded-3xl border border-black/[0.08] dark:border-white/[0.12] bg-white/80 dark:bg-surface-900/80 shadow-sm backdrop-blur-2xl"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20"
          />
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
            {t('resourceBooking.tab.bookings', 'Bronlar')}
          </p>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tabular-nums">
            <CountUp value={stats.total} />
          </p>
        </motion.div>

        <motion.div
          variants={itemVariants}
          whileHover={{ y: -2, transition: SPRING.snappy }}
          className="liquid-glass-surface p-4.5 rounded-3xl border border-black/[0.08] dark:border-white/[0.12] bg-white/80 dark:bg-surface-900/80 shadow-sm backdrop-blur-2xl"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20"
          />
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
            {t('resourceBooking.status.CONFIRMED', 'Tasdiqlangan')}
          </p>
          <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
            <CountUp value={stats.confirmed} />
          </p>
        </motion.div>

        <motion.div
          variants={itemVariants}
          whileHover={{ y: -2, transition: SPRING.snappy }}
          className="liquid-glass-surface p-4.5 rounded-3xl border border-black/[0.08] dark:border-white/[0.12] bg-white/80 dark:bg-surface-900/80 shadow-sm backdrop-blur-2xl"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20"
          />
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
            {t('resourceBooking.status.PENDING', 'Kutilmoqda')}
          </p>
          <p className="text-2xl sm:text-3xl font-black text-amber-500 tabular-nums">
            <CountUp value={stats.pending} />
          </p>
        </motion.div>

        <motion.div
          variants={itemVariants}
          whileHover={{ y: -2, transition: SPRING.snappy }}
          className="liquid-glass-surface p-4.5 rounded-3xl border border-black/[0.08] dark:border-white/[0.12] bg-white/80 dark:bg-surface-900/80 shadow-sm backdrop-blur-2xl"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20"
          />
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
            {t('resourceBooking.tab.resources', 'Resurslar')}
          </p>
          <p className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400 tabular-nums">
            <CountUp value={stats.activeResources} />
          </p>
        </motion.div>
      </div>

      {/* ── Segmented Control & Filters ─────────────────────────────────── */}
      <motion.div
        variants={itemVariants}
        className="liquid-glass-surface flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 rounded-2xl border border-black/[0.08] dark:border-white/[0.12] bg-white/70 dark:bg-surface-900/70 backdrop-blur-2xl shadow-sm"
      >
        <div className="flex gap-2">
          <GlassButton
            size="sm"
            variant={view === 'bookings' ? 'primary' : 'ghost'}
            onClick={() => {
              playTick();
              setView('bookings');
            }}
            className="min-h-[44px] inline-flex items-center gap-2"
          >
            <span>{t('resourceBooking.tab.bookings', 'Bronlar')}</span>
            <kbd className="text-[10px] opacity-60 font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10">1</kbd>
          </GlassButton>
          <GlassButton
            size="sm"
            variant={view === 'resources' ? 'primary' : 'ghost'}
            onClick={() => {
              playTick();
              setView('resources');
            }}
            className="min-h-[44px] inline-flex items-center gap-2"
          >
            <span>{t('resourceBooking.tab.resources', 'Resurslar')}</span>
            <kbd className="text-[10px] opacity-60 font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10">2</kbd>
          </GlassButton>
        </div>

        {view === 'bookings' && (
          <div className="w-full sm:w-64">
            <GlassSelect
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label={t('resourceBooking.filterByStatus', 'Holat bo\'yicha filtrlash')}
              className="min-h-[44px]"
            >
              <option value="">{t('resourceBooking.allStatuses', 'Barcha holatlar')}</option>
              <option value="PENDING">{t('resourceBooking.status.PENDING', 'Kutilmoqda')}</option>
              <option value="CONFIRMED">{t('resourceBooking.status.CONFIRMED', 'Tasdiqlangan')}</option>
              <option value="COMPLETED">{t('resourceBooking.status.COMPLETED', 'Yakunlangan')}</option>
              <option value="CANCELLED">{t('resourceBooking.status.CANCELLED', 'Bekor qilingan')}</option>
            </GlassSelect>
          </div>
        )}
      </motion.div>

      {/* ── Main View Content ───────────────────────────────────────────── */}
      {view === 'bookings' ? (
        <motion.div
          variants={itemVariants}
          className="liquid-glass-surface relative overflow-hidden rounded-3xl border border-black/[0.08] dark:border-white/[0.12] bg-white/80 dark:bg-surface-900/80 shadow-sm backdrop-blur-2xl"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20"
          />

          {bookingsQuery.isLoading ? (
            <div className="p-16">
              <GlassPageLoader label={t('resourceBooking.loading', 'Bronlar yuklanmoqda...')} />
            </div>
          ) : bookingsQuery.isError ? (
            <div className="p-12">
              <GlassErrorState
                title={t('resourceBooking.loadFailed', 'Yuklab bo\'lmadi')}
                message={getErrorMessage(bookingsQuery.error)}
                onRetry={() => {
                  playTick();
                  bookingsQuery.refetch();
                }}
              />
            </div>
          ) : bookings.length === 0 ? (
            <div className="p-16">
              <GlassEmptyState
                title={
                  statusFilter
                    ? t('resourceBooking.emptyFiltered', 'Mos keluvchi bronlar topilmadi')
                    : t('resourceBooking.empty', 'Hozircha bronlar mavjud emas')
                }
                message={
                  statusFilter
                    ? t('resourceBooking.emptyFilteredMessage', 'Boshqa holat bo\'yicha tekshirib ko\'ring')
                    : t('resourceBooking.emptyMessage', 'Yangi bron qilish uchun yuqoridagi tugmani bosing')
                }
              />
            </div>
          ) : (
            <motion.ul
              variants={containerVariants}
              className="divide-y divide-black/[0.04] dark:divide-white/[0.06]"
            >
              {bookings.map((b) => (
                <motion.li
                  key={b.id}
                  variants={itemVariants}
                  onClick={() => handleOpenBookingSidecar(b)}
                  className="px-5 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 transition-colors cursor-pointer hover:bg-blue-500/[0.03] dark:hover:bg-white/[0.03]"
                >
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <div className="shrink-0 mt-0.5">
                      <GlassBadge color={statusColor[b.status]}>
                        {t(`resourceBooking.status.${b.status}`, b.status)}
                      </GlassBadge>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                        {b.title}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                        <span className="font-medium">{formatBookingDateTime(b.startAt, locale)}</span>
                        <span>→</span>
                        <span className="font-medium">{formatBookingDateTime(b.endAt, locale)}</span>
                        {b.resourceName && (
                          <>
                            <span>·</span>
                            <span className="font-bold text-slate-700 dark:text-slate-200">
                              {b.resourceName}
                            </span>
                          </>
                        )}
                        {b.attendees && (
                          <>
                            <span>·</span>
                            <span>{t('resourceBooking.attendees', `${b.attendees} kishi`)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div
                    className="flex items-center justify-end w-full sm:w-auto gap-2 shrink-0 self-start sm:self-center mt-2 sm:mt-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenBookingSidecar(b);
                      }}
                      className="min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-all border border-blue-500/20 inline-flex items-center gap-1.5"
                      title="Inspect reservation in macOS Sidecar"
                    >
                      <span className="text-[13px] leading-none">◨</span>
                      <span>Sidecar</span>
                    </button>
                  </div>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {resourcesQuery.isLoading ? (
            <div className="col-span-full p-16">
              <GlassPageLoader label={t('resourceBooking.loadingResources', 'Resurslar yuklanmoqda...')} />
            </div>
          ) : resourcesQuery.isError ? (
            <div className="col-span-full p-12">
              <GlassErrorState
                title={t('resourceBooking.loadFailedResources', 'Resurslarni yuklab bo\'lmadi')}
                message={getErrorMessage(resourcesQuery.error)}
                onRetry={() => {
                  playTick();
                  resourcesQuery.refetch();
                }}
              />
            </div>
          ) : resources.length === 0 ? (
            <div className="col-span-full p-16">
              <GlassEmptyState
                title={t('resourceBooking.emptyResources', 'Resurslar mavjud emas')}
                message={t('resourceBooking.emptyResourcesMessage', 'Tizimda hozircha auditoriya yoki uskunalar kiritilmagan')}
              />
            </div>
          ) : (
            resources.map((r) => (
              <motion.div
                key={r.id}
                variants={itemVariants}
                whileHover={{ y: -3, transition: SPRING.snappy }}
                onClick={() => handleOpenResourceSidecar(r)}
                className="liquid-glass-surface p-5 rounded-3xl border border-black/[0.08] dark:border-white/[0.12] bg-white/80 dark:bg-surface-900/80 shadow-sm backdrop-blur-2xl cursor-pointer hover:border-blue-500/30 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">{r.name}</h3>
                    <GlassBadge color={r.isActive ? 'success' : 'muted'}>
                      {r.isActive ? t('common.active', 'Faol') : t('common.inactive', 'Faol emas')}
                    </GlassBadge>
                  </div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">
                    {t(TYPE_LABEL[r.type] ?? 'resourceBooking.type.OTHER', r.type)}
                  </p>
                  {r.location && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <span>📍</span> {r.location}
                    </p>
                  )}
                  {r.capacity && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <span>👥</span> {t('resourceBooking.capacity', `${r.capacity} kishilik`)}
                    </p>
                  )}
                  {r.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 pt-2 border-t border-black/[0.04] dark:border-white/[0.06] line-clamp-2">
                      {r.description}
                    </p>
                  )}
                </div>

                <div
                  className="mt-4 pt-3 border-t border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                    ID: {r.id.slice(0, 8)}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenResourceSidecar(r);
                    }}
                    className="min-h-[44px] min-w-[44px] px-3 py-1 rounded-xl text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-all border border-blue-500/20 inline-flex items-center gap-1.5"
                    title="Inspect resource in macOS Sidecar"
                  >
                    <span className="text-[13px] leading-none">◨</span>
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
        title={t('resourceBooking.add', 'Yangi bron qilish')}
      >
        <form onSubmit={handleCreate} className="space-y-4" noValidate>
          <GlassField label={t('resourceBooking.field.resource', 'Resurs (Auditoriya / Uskuna) *')} required>
            <GlassSelect
              value={form.resourceId}
              onChange={(e) => setForm((f) => ({ ...f, resourceId: e.target.value }))}
              disabled={createMutation.isPending}
              className="min-h-[44px]"
              autoFocus
            >
              <option value="">{t('resourceBooking.chooseResource', 'Resursni tanlang')}</option>
              {resources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({t(TYPE_LABEL[r.type] ?? 'resourceBooking.type.OTHER', r.type)}
                  {r.location ? ` · ${r.location}` : ''})
                </option>
              ))}
            </GlassSelect>
          </GlassField>

          <GlassField label={t('resourceBooking.field.title', 'Bronlash maqsadi *')} required>
            <GlassInput
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder={t('resourceBooking.titlePlaceholder', 'Masalan: IELTS Masterclass yoki Matematika imtihoni')}
              disabled={createMutation.isPending}
              className="min-h-[44px]"
            />
          </GlassField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <GlassField label={t('resourceBooking.field.starts', 'Boshlanish vaqti *')} required>
              <GlassInput
                type="datetime-local"
                value={form.start}
                onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))}
                disabled={createMutation.isPending}
                className="min-h-[44px]"
              />
            </GlassField>
            <GlassField label={t('resourceBooking.field.ends', 'Tugash vaqti *')} required>
              <GlassInput
                type="datetime-local"
                value={form.end}
                onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))}
                disabled={createMutation.isPending}
                className="min-h-[44px]"
              />
            </GlassField>
          </div>

          <GlassField
            label={t('resourceBooking.field.attendees', 'Qatnashuvchilar soni')}
            hint={t('common.optional', 'Ixtiyoriy')}
          >
            <GlassInput
              type="number"
              min={1}
              value={form.attendees}
              onChange={(e) => setForm((f) => ({ ...f, attendees: e.target.value }))}
              placeholder={t('resourceBooking.attendeesPlaceholder', 'Masalan: 25')}
              disabled={createMutation.isPending}
              className="min-h-[44px]"
            />
          </GlassField>

          <GlassField
            label={t('resourceBooking.field.description', 'Qo\'shimcha izoh')}
            hint={t('common.optional', 'Ixtiyoriy')}
          >
            <GlassTextArea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              disabled={createMutation.isPending}
              className="min-h-[44px]"
            />
          </GlassField>

          {formError && (
            <p className="text-xs font-semibold text-red-600 dark:text-red-400" role="alert">
              {formError}
            </p>
          )}

          <div className="flex justify-end gap-2.5 pt-3 border-t border-black/[0.08] dark:border-white/[0.08]">
            <GlassButton
              type="button"
              variant="secondary"
              onClick={() => {
                setCreateOpen(false);
                setFormError(null);
              }}
              disabled={createMutation.isPending}
              className="min-h-[44px]"
            >
              {t('common.cancel', 'Bekor qilish')}
            </GlassButton>
            <GlassButton
              type="submit"
              variant="primary"
              disabled={createMutation.isPending}
              className="min-h-[44px]"
            >
              {createMutation.isPending
                ? t('resourceBooking.creating', 'Bron qilinmoqda...')
                : t('resourceBooking.createSubmit', 'Tasdiqlash')}
            </GlassButton>
          </div>
        </form>
      </GlassModal>
    </div>
  );
}

export default ResourceBookingPage;
