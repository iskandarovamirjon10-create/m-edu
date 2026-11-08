/**
 * M-EDU Feature Flags Page
 * System feature flags, rollouts, organization-level toggles, and runtime feature configuration.
 */

import {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  type FormEvent,
  type SVGProps,
} from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { GlassSwitch, GlassModal, GlassField, GlassInput, GlassSelect } from '@/components/ui';
import { useToast } from '@/components/ui/GlassToast';
import { featureFlagsApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessages';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { usePrefersReducedMotion, cn } from '@/lib/design';
import { openSidecar } from '@/stores/ui.store';

/* ============================================================================
 * MOTION TOKENS ( Physics)
 * ========================================================================== */

const SPRING_PHYSICS = {
  snappy: { type: 'spring' as const, stiffness: 420, damping: 32, mass: 0.8 },
  smooth: { type: 'spring' as const, stiffness: 320, damping: 30, mass: 0.9 },
  gentle: { type: 'spring' as const, stiffness: 220, damping: 28, mass: 1.0 },
};

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.05 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
  },
};

/* ============================================================================
 * TYPES & INTERFACES
 * ========================================================================== */

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  type: string;
  enabled: boolean;
  rolloutPercentage?: number | null;
}

export type StatusFilter = 'ALL' | 'ENABLED' | 'DISABLED';

export const FLAG_TYPES = [
  { value: 'BOOLEAN', labelKey: 'featureFlags.type.boolean' },
  { value: 'STRING', labelKey: 'featureFlags.type.string' },
  { value: 'NUMBER', labelKey: 'featureFlags.type.number' },
  { value: 'JSON', labelKey: 'featureFlags.type.json' },
] as const;

/* ============================================================================
 * PURE EXPORTED HELPERS (Zero Dependencies, Fully Testable)
 * ========================================================================== */

export function formatRollout(rolloutPercentage?: number | null): string {
  if (rolloutPercentage === null || rolloutPercentage === undefined) {
    return '100% Rollout';
  }
  return `${rolloutPercentage}% Staged`;
}

export function getTypeBadgeStyle(type: string): { bg: string; text: string; border: string } {
  switch (type.toUpperCase()) {
    case 'BOOLEAN':
      return { bg: 'bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500/20' };
    case 'NUMBER':
      return { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/20' };
    case 'JSON':
      return { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/20' };
    case 'STRING':
    default:
      return { bg: 'bg-neutral-500/10', text: 'text-neutral-600 dark:text-neutral-400', border: 'border-neutral-500/20' };
  }
}

/* ============================================================================
 * SVG ICONS
 * ========================================================================== */

const ICONS = {
  flag: [
    'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z',
    'M4 22v-7',
  ],
  plus: ['M12 5v14', 'M5 12h14'],
  checkCircle: [
    'M22 11.08V12a10 10 0 1 1-5.93-9.14',
    'M22 4 12 14.01l-3-3',
  ],
  slash: ['M18.36 5.64L5.64 18.36', 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z'],
  sparkles: [
    'M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z',
    'M18.5 3.5v3',
    'M20 5h-3',
  ],
  search: ['M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'],
  edit: [
    'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
    'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  ],
  eye: [
    'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z',
    'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  ],
};

function Icon({
  paths,
  size = 18,
  className = '',
  strokeWidth = 1.8,
  ...rest
}: {
  paths: string[];
  size?: number;
  className?: string;
  strokeWidth?: number;
} & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

/* ============================================================================
 * AURORA MESH BACKGROUND (Atmospheric Canvas)
 * ========================================================================== */

function AuroraMesh() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className="absolute -left-[10%] -top-[15%] h-[560px] w-[560px] rounded-full bg-gradient-to-br from-purple-500/12 via-indigo-500/8 to-transparent blur-[120px] dark:from-purple-600/16 dark:via-indigo-600/10" />
      <div className="absolute -right-[10%] top-[30%] h-[520px] w-[520px] rounded-full bg-gradient-to-bl from-pink-500/12 via-rose-500/8 to-transparent blur-[120px] dark:from-pink-600/16 dark:via-rose-600/10" />
      <div className="absolute bottom-[-15%] left-[25%] h-[480px] w-[480px] rounded-full bg-gradient-to-tr from-blue-500/10 via-cyan-500/6 to-transparent blur-[110px] dark:from-blue-600/14" />
    </div>
  );
}

/* ============================================================================
 * COUNT UP COMPONENT
 * ========================================================================== */

function CountUp({
  value,
  duration = 0.85,
  suffix = '',
}: {
  value: number;
  duration?: number;
  suffix?: string;
}) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef<number | null>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      return;
    }
    let raf: number;
    startRef.current = null;
    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const progress = Math.min(1, (ts - startRef.current) / (duration * 1000));
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplay(value * eased);
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduced]);

  return (
    <span className="tabular-nums font-semibold">
      {Math.round(display).toLocaleString()}
      {suffix}
    </span>
  );
}

/* ============================================================================
 * SHIMMER SKELETON
 * ========================================================================== */

function FeatureFlagsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true">
      <div className="h-36 w-full rounded-3xl bg-neutral-200/60 dark:bg-white/[0.04]" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 rounded-2xl bg-neutral-200/60 dark:bg-white/[0.04]"
          />
        ))}
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-20 rounded-2xl bg-neutral-200/60 dark:bg-white/[0.04]"
          />
        ))}
      </div>
    </div>
  );
}

/* ============================================================================
 * MAIN COMPONENT
 * ========================================================================== */

export function FeatureFlagsPage() {
  const { t } = useSafeI18n();
  usePageTitle(t('featureFlags.title') || 'Feature Flags');

  const queryClient = useQueryClient();
  const toast = useToast();
  const reduced = usePrefersReducedMotion();
  const { playTick, playPop, playSuccess } = usePremiumSound();

  const [createOpen, setCreateOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [form, setForm] = useState({ key: '', name: '', description: '', type: 'BOOLEAN' });
  const [formError, setFormError] = useState<string | null>(null);

  const [activeFilter, setActiveFilter] = useState<StatusFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);

  /* ── Queries ── */
  const flagsQuery = useQuery({
    queryKey: ['feature-flags'],
    queryFn: () => featureFlagsApi.list() as Promise<{ items: FeatureFlag[]; total: number }>,
  });

  const flags: FeatureFlag[] = (flagsQuery.data?.items) ?? [];

  /* ── Filtered Flags ── */
  const filteredFlags = useMemo(() => {
    let list = flags;
    if (activeFilter === 'ENABLED') {
      list = list.filter((f) => f.enabled);
    } else if (activeFilter === 'DISABLED') {
      list = list.filter((f) => !f.enabled);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.key.toLowerCase().includes(q) ||
          (f.description && f.description.toLowerCase().includes(q))
      );
    }
    return list;
  }, [flags, activeFilter, searchQuery]);

  const activeCount = flags.filter((f) => f.enabled).length;
  const inactiveCount = flags.length - activeCount;

  /* ── Mutations ── */
  const toggleMutation = useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) =>
      featureFlagsApi.update(key, { enabled }),
    onSuccess: (_data, variables) => {
      playTick();
      toast.success(
        variables.enabled
          ? t('featureFlags.enabledToast') || 'Flag enabled'
          : t('featureFlags.disabledToast') || 'Flag disabled'
      );
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
    },
    onError: (e) => toast.error(t('featureFlags.updateError') || 'Failed to update flag', getErrorMessage(e)),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) =>
      editingKey
        ? featureFlagsApi.update(editingKey, {
            name: data.name,
            description: data.description,
            type: data.type,
          })
        : featureFlagsApi.create(data),
    onSuccess: () => {
      playSuccess();
      toast.success(
        editingKey
          ? t('featureFlags.updated') || 'Flag updated'
          : t('featureFlags.createdToast') || 'Flag created'
      );
      setCreateOpen(false);
      setEditingKey(null);
      setForm({ key: '', name: '', description: '', type: 'BOOLEAN' });
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  });

  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    if (createMutation.isPending) return;
    const keyPattern = /^[a-z0-9][a-z0-9._-]*$/i;
    if (!form.name.trim() || (!editingKey && !form.key.trim())) {
      setFormError(t('featureFlags.validation.required') || 'Key and Name are required');
      return;
    }
    if (!editingKey && !keyPattern.test(form.key.trim())) {
      setFormError(t('featureFlags.validation.keyPattern') || 'Invalid key format');
      return;
    }
    setFormError(null);
    createMutation.mutate({
      ...form,
      key: form.key.trim(),
      name: form.name.trim(),
    });
  };

  const closeForm = () => {
    setCreateOpen(false);
    setEditingKey(null);
    setFormError(null);
  };

  const openCreate = () => {
    playPop();
    setEditingKey(null);
    setForm({ key: '', name: '', description: '', type: 'BOOLEAN' });
    setFormError(null);
    setCreateOpen(true);
  };

  const openEdit = (flag: FeatureFlag) => {
    playPop();
    setEditingKey(flag.key);
    setForm({
      key: flag.key,
      name: flag.name,
      description: flag.description || '',
      type: flag.type,
    });
    setFormError(null);
    setCreateOpen(true);
  };

  /* ── Open Sidecar Detail Inspector ── */
  const handleInspectFlag = useCallback(
    (flag: FeatureFlag) => {
      playPop();

      openSidecar({
        id: flag.id,
        type: 'general',
        title: flag.name,
        subtitle: `Key: ${flag.key} • Type: ${flag.type}`,
        badge: {
          text: flag.enabled ? 'Enabled' : 'Disabled',
          tone: flag.enabled ? 'emerald' : 'slate',
        },
        avatar: {
          text: flag.name.slice(0, 2).toUpperCase(),
          color: flag.enabled ? '#10B981' : '#6B7280',
        },
        metrics: [
          {
            label: 'Current Status',
            value: flag.enabled ? 'Active' : 'Off',
          },
          {
            label: 'Rollout',
            value: formatRollout(flag.rolloutPercentage),
          },
        ],
        details: [
          {
            label: 'Configuration Key',
            value: flag.key,
            copyable: true,
          },
          {
            label: 'Data Type',
            value: flag.type,
          },
          {
            label: 'Description',
            value: flag.description || 'No description provided',
          },
        ],
        actions: [
          {
            label: t('common.edit') || 'Edit Flag',
            variant: 'primary',
            onClick: () => openEdit(flag),
          },
        ],
      });
    },
    [t, playPop]
  );

  /* ── Keyboard Shortcuts (J / K, C, Enter) ── */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl?.tagName === 'INPUT' ||
        activeEl?.tagName === 'TEXTAREA' ||
        activeEl?.tagName === 'SELECT';

      if (isInput) return;

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        playTick();
        setFocusedIndex((prev) => (prev + 1 < filteredFlags.length ? prev + 1 : 0));
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        playTick();
        setFocusedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filteredFlags.length - 1));
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        openCreate();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredFlags[focusedIndex]) {
          handleInspectFlag(filteredFlags[focusedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredFlags, focusedIndex, handleInspectFlag, playTick]);

  /* ── Loading State ── */
  if (flagsQuery.isLoading && !flags.length) {
    return (
      <div className="relative min-h-full px-4 py-8 sm:px-6 lg:px-8">
        <AuroraMesh />
        <div className="mx-auto max-w-7xl">
          <FeatureFlagsSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-full px-4 py-6 sm:px-6 lg:px-8 pb-[max(6rem,env(safe-area-inset-bottom))]">
      <AuroraMesh />

      <motion.div
        variants={containerVariants}
        initial={reduced ? false : 'hidden'}
        animate="visible"
        className="mx-auto max-w-7xl space-y-6"
      >
        {/* ====================================================================
         * 1. HERO HEADER
         * ================================================================== */}
        <motion.div
          variants={itemVariants}
          className="liquid-glass-surface relative overflow-hidden rounded-3xl p-6 sm:p-8"
        >
          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-purple-600/15 text-purple-600 shadow-inner ring-1 ring-purple-500/30 dark:bg-purple-500/20 dark:text-purple-400">
                <Icon paths={ICONS.flag} size={28} strokeWidth={2} />
              </div>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 ring-1 ring-emerald-500/25 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {activeCount} {t('common.on') || 'Active Flags'}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-neutral-500/10 px-2.5 py-0.5 text-xs font-semibold text-neutral-600 ring-1 ring-neutral-500/20 dark:text-neutral-300">
                    {flags.length} Total Configured
                  </span>
                </div>

                <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900 dark:text-white sm:text-3xl">
                  {t('featureFlags.title') || 'Feature Switches & Release Control'}
                </h1>
                <p className="max-w-2xl text-sm font-medium text-neutral-500 dark:text-neutral-400">
                  {t('featureFlags.subtitle') ||
                    'Real-time runtime switches, staged rollouts, and killswitches across all microservices.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-700 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
              >
                <Icon paths={ICONS.plus} size={18} strokeWidth={2.4} />
                <span>{t('featureFlags.newFlag') || 'New Feature Flag'}</span>
                <kbd className="hidden rounded bg-indigo-800/60 px-1.5 py-0.5 text-[10px] font-mono sm:inline-block">
                  C
                </kbd>
              </button>
            </div>
          </div>
        </motion.div>

        {/* ====================================================================
         * 2. INTERACTIVE COUNT-UP KPI TILES
         * ================================================================== */}
        <motion.div
          variants={itemVariants}
          className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4"
        >
          {/* Total Flags Tile */}
          <button
            type="button"
            onClick={() => {
              playTick();
              setActiveFilter('ALL');
            }}
            className={cn(
              'liquid-glass-card group flex min-h-[44px] flex-col justify-between p-4 text-left transition-all',
              activeFilter === 'ALL' && 'ring-2 ring-indigo-500/40 bg-indigo-500/5'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                {t('common.total') || 'Total Flags'}
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Icon paths={ICONS.flag} size={16} />
              </div>
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
              <CountUp value={flags.length} />
            </div>
          </button>

          {/* Enabled Tile */}
          <button
            type="button"
            onClick={() => {
              playTick();
              setActiveFilter('ENABLED');
            }}
            className={cn(
              'liquid-glass-card group flex min-h-[44px] flex-col justify-between p-4 text-left transition-all',
              activeFilter === 'ENABLED' && 'ring-2 ring-emerald-500/50 bg-emerald-500/5'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                {t('common.on') || 'Enabled'}
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Icon paths={ICONS.checkCircle} size={16} />
              </div>
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              <CountUp value={activeCount} />
            </div>
          </button>

          {/* Disabled Tile */}
          <button
            type="button"
            onClick={() => {
              playTick();
              setActiveFilter('DISABLED');
            }}
            className={cn(
              'liquid-glass-card group flex min-h-[44px] flex-col justify-between p-4 text-left transition-all',
              activeFilter === 'DISABLED' && 'ring-2 ring-neutral-500/50 bg-neutral-500/5'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                {t('common.off') || 'Disabled'}
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-neutral-500/10 text-neutral-600 dark:text-neutral-400">
                <Icon paths={ICONS.slash} size={16} />
              </div>
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight text-neutral-500">
              <CountUp value={inactiveCount} />
            </div>
          </button>
        </motion.div>

        {/* ====================================================================
         * 3. CONTROL BAR (Segmented Control + Search)
         * ================================================================== */}
        <motion.div
          variants={itemVariants}
          className="liquid-glass-card flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"
        >
          {/* Segmented Filter Control */}
          <div
            className="flex items-center rounded-2xl bg-neutral-200/50 p-1 dark:bg-white/[0.05]"
            role="tablist"
          >
            {(['ALL', 'ENABLED', 'DISABLED'] as StatusFilter[]).map((level) => {
              const isActive = activeFilter === level;
              return (
                <button
                  key={level}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => {
                    playTick();
                    setActiveFilter(level);
                    setFocusedIndex(0);
                  }}
                  className={cn(
                    'relative flex min-h-[44px] items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all',
                    isActive
                      ? 'text-neutral-900 dark:text-white'
                      : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeFlagPill"
                      className="absolute inset-0 rounded-xl bg-white shadow-sm dark:bg-neutral-800"
                      transition={SPRING_PHYSICS.snappy}
                    />
                  )}
                  <span className="relative z-10">
                    {level === 'ALL'
                      ? t('common.all') || 'All'
                      : level === 'ENABLED'
                      ? t('common.on') || 'Enabled'
                      : t('common.off') || 'Disabled'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px] flex-1 sm:max-w-xs">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-neutral-400">
              <Icon paths={ICONS.search} size={16} />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setFocusedIndex(0);
              }}
              placeholder={`${t('common.search') || 'Search flags by name/key'}...`}
              className="min-h-[44px] w-full rounded-xl border border-black/[0.08] bg-white/60 pl-9 pr-3 text-xs font-medium text-neutral-900 outline-none transition-all placeholder:text-neutral-400 focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
            />
          </div>
        </motion.div>

        {/* ====================================================================
         * 4. FEATURE FLAGS FEED
         * ================================================================== */}
        <motion.div variants={itemVariants} className="liquid-glass-card overflow-hidden">
          <AnimatePresence mode="wait">
            {filteredFlags.length === 0 ? (
              <motion.div
                key="empty-flags"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center p-12 text-center"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-500 ring-1 ring-purple-500/25">
                  <Icon paths={ICONS.flag} size={24} />
                </div>
                <h3 className="mt-4 text-base font-bold text-neutral-800 dark:text-neutral-200">
                  {t('featureFlags.empty') || 'No Feature Flags Configured'}
                </h3>
                <p className="mt-1 max-w-sm text-xs text-neutral-500 dark:text-neutral-400">
                  {t('featureFlags.emptyHint') ||
                    'Add a new switch to dynamically toggle features across the platform.'}
                </p>
                <button
                  type="button"
                  onClick={openCreate}
                  className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md transition-all hover:bg-indigo-700 active:scale-95"
                >
                  <Icon paths={ICONS.plus} size={15} />
                  {t('featureFlags.newFlag') || 'Create Flag'}
                </button>
              </motion.div>
            ) : (
              <div
                key="flags-list"
                className="divide-y divide-black/[0.04] dark:divide-white/[0.04]"
              >
                {filteredFlags.map((flag, idx) => {
                  const isFocused = focusedIndex === idx;
                  const typeStyle = getTypeBadgeStyle(flag.type);

                  return (
                    <motion.div
                      key={flag.id}
                      onClick={() => handleInspectFlag(flag)}
                      className={cn(
                        'group flex min-h-[44px] cursor-pointer flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 sm:p-5 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]',
                        isFocused && 'bg-purple-500/[0.06] dark:bg-purple-500/[0.1]'
                      )}
                    >
                      <div className="flex items-start gap-4">
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="pt-1 shrink-0"
                        >
                          <GlassSwitch
                            checked={flag.enabled}
                            onChange={() =>
                              toggleMutation.mutate({ key: flag.key, enabled: !flag.enabled })
                            }
                            disabled={toggleMutation.isPending}
                            aria-label={t('featureFlags.toggleAria', { name: flag.name })}
                          />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                              {flag.name}
                            </h4>
                            <span
                              className={cn(
                                'inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-mono font-bold',
                                typeStyle.bg,
                                typeStyle.text,
                                typeStyle.border
                              )}
                            >
                              {flag.type}
                            </span>
                          </div>

                          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                            {flag.description || flag.key}
                          </p>

                          <div className="mt-2 flex items-center gap-2 text-[11px] text-neutral-400">
                            <code className="rounded bg-neutral-200/60 px-1.5 py-0.5 font-mono text-neutral-700 dark:bg-white/[0.06] dark:text-neutral-300">
                              {flag.key}
                            </code>
                            <span>•</span>
                            <span>{formatRollout(flag.rolloutPercentage)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(flag);
                          }}
                          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-neutral-400 hover:text-purple-600 hover:bg-purple-500/10 transition-colors"
                          title="Edit flag"
                        >
                          <Icon paths={ICONS.edit} size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInspectFlag(flag);
                          }}
                          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-neutral-400 hover:text-indigo-600 hover:bg-indigo-500/10 transition-colors"
                          title="Inspect details"
                        >
                          <Icon paths={ICONS.eye} size={16} />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>

      {/* ====================================================================
       * 5. FLAG CREATE / EDIT MODAL
       * ================================================================== */}
      <GlassModal
        open={createOpen}
        onClose={closeForm}
        title={editingKey ? t('featureFlags.editTitle') || 'Edit Flag' : t('featureFlags.createTitle') || 'New Feature Flag'}
      >
        <form onSubmit={handleCreate} className="space-y-4" noValidate>
          <GlassField label={t('featureFlags.form.key') || 'Unique Key'} required={!editingKey}>
            <GlassInput
              value={form.key}
              onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
              placeholder={t('featureFlags.form.keyPlaceholder') || 'e.g. enable_v4_mobile_nav'}
              disabled={createMutation.isPending || Boolean(editingKey)}
              readOnly={Boolean(editingKey)}
              autoFocus={!editingKey}
            />
          </GlassField>
          <GlassField label={t('featureFlags.form.name') || 'Display Name'} required>
            <GlassInput
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={t('featureFlags.form.namePlaceholder') || 'e.g. v4.0 Mobile Glass Navigation'}
              disabled={createMutation.isPending}
            />
          </GlassField>
          <GlassField label={t('featureFlags.form.description') || 'Description'}>
            <GlassInput
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder={t('featureFlags.form.descriptionPlaceholder') || 'Describe feature purpose and scope'}
              disabled={createMutation.isPending}
            />
          </GlassField>
          <GlassField label={t('featureFlags.form.type') || 'Flag Type'}>
            <GlassSelect
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              disabled={createMutation.isPending}
            >
              {FLAG_TYPES.map((ft) => (
                <option key={ft.value} value={ft.value}>
                  {t(ft.labelKey)}
                </option>
              ))}
            </GlassSelect>
          </GlassField>
          <p className="text-xs text-neutral-400">
            {t('featureFlags.createHint') || 'Flags propagate to connected clients within 30 seconds.'}
          </p>
          {formError && (
            <p className="text-sm text-rose-500 font-medium" role="alert">
              {formError}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={closeForm}
              disabled={createMutation.isPending}
              className="min-h-[44px] rounded-xl border border-black/[0.08] bg-neutral-100/60 px-5 py-2.5 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-200/60 disabled:opacity-50 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-neutral-300 dark:hover:bg-white/[0.08]"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-semibold text-white shadow-md transition-all hover:bg-indigo-700 disabled:opacity-50 active:scale-95"
            >
              {createMutation.isPending
                ? editingKey
                  ? t('users.updating') || 'Saving…'
                  : t('featureFlags.creating') || 'Creating…'
                : editingKey
                ? t('common.save') || 'Save Changes'
                : t('featureFlags.create') || 'Create Flag'}
            </button>
          </div>
        </form>
      </GlassModal>
    </div>
  );
}

export default FeatureFlagsPage;
